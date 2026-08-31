/**
 * Talks to the real Surf WebMCP Inspector browser extension, if it's installed, over
 * `externally_connectable` (see SurfMCP/manifest.json). This is the bridge between this demo
 * page and the actual browser-level enforcement — separate from the in-page "Surf mode"
 * simulation in page.js, which only fakes the effect for pages that don't have the extension.
 *
 * The extension only accepts connections from origins listed in its manifest's
 * `externally_connectable.matches` (currently localhost/127.0.0.1 for dev) — update that list
 * before pointing this at a deployed domain.
 */

// Computed from SurfMCP/manifest.json's `key` field — keep in sync if that key ever changes.
export const SURF_EXTENSION_ID = 'eopkbbbmfbmdhfhenfmdpdfijcnapmcc';

const PING_TIMEOUT_MS = 800;

function getChromeRuntime() {
  if (typeof window === 'undefined') return null;
  const rt = window.chrome && window.chrome.runtime;
  return rt && typeof rt.sendMessage === 'function' ? rt : null;
}

/** Resolves { installed: boolean, version?, reason? } — never throws. */
export function pingSurfExtension(extensionId = SURF_EXTENSION_ID, timeoutMs = PING_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const runtime = getChromeRuntime();
    if (!runtime) {
      resolve({ installed: false, reason: 'no-extension-api' });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ installed: false, reason: 'timeout' });
    }, timeoutMs);

    try {
      runtime.sendMessage(extensionId, { type: 'SURF_PING' }, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (runtime.lastError || !response || !response.ok) {
          resolve({ installed: false, reason: runtime.lastError?.message || 'no-response' });
          return;
        }
        resolve({ installed: true, version: response.data?.version });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ installed: false, reason: String(err?.message || err) });
    }
  });
}

const HEARTBEAT_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 1_000;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Opens a live, self-healing connection to the extension. `onSnapshot` fires once (and again
 * after every reconnect) with the full cross-tab audit backlog; `onEntry` fires for every new
 * entry afterwards, from any tab the extension is guarding — not just this one.
 *
 * MV3 background service workers are torn down after ~30s of inactivity — completely normal,
 * and not the same thing as the extension being uninstalled. A bare `chrome.runtime.connect`
 * port disconnects when that happens, so this sends a periodic no-op heartbeat to keep the
 * worker's event loop busy, and transparently reconnects (which itself wakes the worker back
 * up) if a disconnect slips through anyway. `onDisconnect` only fires after several consecutive
 * reconnect attempts fail immediately (i.e. the extension really is gone), not on every blip.
 *
 * Returns `{ disconnect() }` to stop everything on cleanup, or `null` if the extension API
 * isn't available in this browser.
 */
export function connectToSurfExtension(extensionId = SURF_EXTENSION_ID, { onSnapshot, onEntry, onDisconnect } = {}) {
  const runtime = getChromeRuntime();
  if (!runtime || typeof runtime.connect !== 'function') return null;

  let port = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let stopped = false;
  let consecutiveFailures = 0;

  const clearHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    reconnectTimer = setTimeout(open, RECONNECT_DELAY_MS);
  };

  function open() {
    if (stopped) return;
    const connectStartedAt = Date.now();
    let gotSnapshot = false;

    try {
      port = runtime.connect(extensionId);
    } catch (err) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) onDisconnect?.(String(err?.message || err));
      else scheduleReconnect();
      return;
    }

    port.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'SURF_SNAPSHOT' && Array.isArray(message.entries)) {
        gotSnapshot = true;
        consecutiveFailures = 0;
        onSnapshot?.(message.entries);
      } else if (message.type === 'SURF_ENTRY' && message.entry) {
        onEntry?.(message.entry);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      clearHeartbeat();
      if (stopped) return;

      // Never got a snapshot and it died almost immediately -> the extension isn't there to
      // answer, not just a service worker that happened to be asleep. Otherwise, it was working
      // and something (most likely the worker going idle) closed it — just reconnect quietly.
      if (!gotSnapshot && Date.now() - connectStartedAt < 800) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          onDisconnect?.(runtime.lastError?.message);
          return;
        }
      }
      scheduleReconnect();
    });

    heartbeatTimer = setInterval(() => {
      try {
        port?.postMessage({ type: 'SURF_KEEPALIVE' });
      } catch {
        // port is already gone; onDisconnect will fire and this loop will get torn down there
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  open();

  return {
    disconnect() {
      stopped = true;
      clearHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        port?.disconnect();
      } catch {
        // already gone
      }
    },
  };
}
