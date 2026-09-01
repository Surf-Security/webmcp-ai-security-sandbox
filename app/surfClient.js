/**
 * Talks to the real Surf WebMCP Inspector browser extension, if it's installed, over
 * `externally_connectable` (see SurfMCP/manifest.json). This is the bridge between this demo
 * page and the actual browser-level enforcement — separate from the in-page "Surf mode"
 * simulation in page.js, which only fakes the effect for pages that don't have the extension.
 *
 * The extension only accepts connections from origins listed in its manifest's
 * `externally_connectable.matches` (currently localhost/127.0.0.1 for dev) — update that list
 * before pointing this at a deployed domain.
 *
 * Chrome derives an extension's ID deterministically from the keypair that signs it — the same
 * private key always produces the same ID, whether the extension is loaded unpacked, packed into
 * a .crx, or uploaded to the Chrome Web Store for the first time (the Store honors an explicit
 * manifest `key` field on first publish rather than assigning its own). So the packed/production
 * ID only matches this dev one if packing reuses the exact same private key — a different key
 * (e.g. one the Store auto-generates because no key was reused) produces a different ID. Rather
 * than guess which will happen, both are supported: try the dev ID first, then an optional real
 * prod ID once one exists, supplied via env var at deploy time (never hardcoded here) so this
 * file doesn't need editing again once that ID is known.
 */

// Computed from SurfMCP/manifest.json's `key` field — keep in sync if that key ever changes.
const DEV_EXTENSION_ID = 'eopkbbbmfbmdhfhenfmdpdfijcnapmcc';

// Set at deploy time once the extension has a real published/packed ID, e.g.
// NEXT_PUBLIC_SURF_EXTENSION_IDS=abcdefghijklmnopqrstuvwxyzabcdef (comma-separate for more than
// one). Never commit a real prod ID here — this stays empty until it's supplied via environment
// config, keeping this file deploy-target-agnostic.
const CONFIGURED_IDS = (process.env.NEXT_PUBLIC_SURF_EXTENSION_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

// Dev ID first so local development never waits on a prod lookup that will only fail there;
// de-duped in case the configured list happens to already include it.
export const SURF_EXTENSION_IDS = [...new Set([DEV_EXTENSION_ID, ...CONFIGURED_IDS])];

// Kept for any external callers still importing the old single-ID export — points at the same
// dev ID as before, so existing behavior (and any explicit-ID override) is unaffected.
export const SURF_EXTENSION_ID = DEV_EXTENSION_ID;

// MV3 service workers go idle after inactivity and need a moment to cold-start on the next
// message — 800ms was too tight for that, especially right after the user reloads/enables the
// extension (exactly when they'd click "Check again"), causing a false "not installed" result
// even though the extension is really there and just hasn't woken up yet.
const PING_TIMEOUT_MS = 2500;

function getChromeRuntime() {
  if (typeof window === 'undefined') return null;
  const rt = window.chrome && window.chrome.runtime;
  return rt && typeof rt.sendMessage === 'function' ? rt : null;
}

const AUDIT_HISTORY_TIMEOUT_MS = 5000;

/**
 * One-shot query against the extension's durable (chrome.storage.local, 7-day retention) audit
 * history — SURF_GET_AUDIT_HISTORY, added alongside shared/audit-history.ts. This is distinct
 * from connectToSurfExtension's live push feed below: that one only sees new events from the
 * moment it connects, while this can look back across tab closes/navigations/browser restarts,
 * up to the extension's retention window. Resolves { ok: true, data: AuditLogEntry[] } or
 * { ok: false, error }, never throws.
 */
export function getAuditHistory({ from, to } = {}, extensionId = SURF_EXTENSION_ID, timeoutMs = AUDIT_HISTORY_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const runtime = getChromeRuntime();
    if (!runtime) {
      resolve({ ok: false, error: 'no-extension-api' });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

    try {
      runtime.sendMessage(extensionId, { type: 'SURF_GET_AUDIT_HISTORY', from, to }, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (runtime.lastError || !response || !response.ok) {
          resolve({ ok: false, error: runtime.lastError?.message || response?.error || 'no-response' });
          return;
        }
        resolve({ ok: true, data: response.data });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: String(err?.message || err) });
    }
  });
}

/** One attempt against a single specific ID. Resolves { installed, version?, reason? }. */
function pingOnce(extensionId, timeoutMs) {
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
        // response.data.protectionEnabled is only sent by extension builds that know about it
        // (see service-worker.ts's SURF_PING handler) — treat a missing field as "unknown, assume
        // protected" rather than as "off", so an older installed build doesn't get flagged as
        // unprotected just because it predates this check.
        resolve({ installed: true, version: response.data?.version, protectionEnabled: response.data?.protectionEnabled !== false });
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ installed: false, reason: String(err?.message || err) });
    }
  });
}

/**
 * Tries each candidate ID in SURF_EXTENSION_IDS in turn (dev ID first), resolving as soon as one
 * responds — so this keeps working whether the installed extension is the dev-key build or a
 * differently-keyed packed/published one, without knowing in advance which. The successful id is
 * returned so callers needing a specific ID afterward (connectToSurfExtension, getAuditHistory)
 * use the one that's actually live, not a guess. Resolves { installed, version?, extensionId?,
 * reason? } — never throws. Pass an explicit `extensionIds` array to override the candidate list
 * (e.g. to test one ID directly) rather than the configured default.
 */
export async function pingSurfExtension(timeoutMs = PING_TIMEOUT_MS, extensionIds = SURF_EXTENSION_IDS) {
  let lastReason = 'no-extension-api';
  for (const id of extensionIds) {
    const result = await pingOnce(id, timeoutMs);
    if (result.installed) return { ...result, extensionId: id };
    lastReason = result.reason;
  }
  return { installed: false, reason: lastReason };
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
