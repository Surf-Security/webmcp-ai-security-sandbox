'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { connectToSurfExtension, pingSurfExtension } from '../surfClient';

/**
 * Real "is the extension connected" state, run exactly ONCE via ExtensionConnectionProvider
 * (mounted in the dashboard layout) and shared by every consumer through context — the sidebar
 * and whatever page is active both read the SAME state. An earlier version of this file exported
 * a plain hook that each caller ran independently; that meant the sidebar and the page each had
 * their own ping/connect cycle and could disagree (confirmed: clicking a page's "Check again"
 * updated that page but left the sidebar still saying "not connected", since it was watching a
 * completely separate, un-rechecked instance).
 *
 * `version` is the real installed extension's version, read straight from its manifest via the
 * existing SURF_PING response (chrome.runtime.getManifest().version on the extension side) —
 * not the sandbox app's own package.json version. Displayed in the sidebar footer instead of a
 * "Developer test sites" link.
 */

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

// A single ping can fail right after the user reloads/enables the extension for two different
// reasons that need different fixes: the service worker is asleep and slow to wake (fixed by
// surfClient.js's longer PING_TIMEOUT_MS), or chrome.runtime.sendMessage fails *immediately*
// with "receiving end does not exist" because Chrome hasn't finished re-registering the
// extension's message routes yet (a longer timeout does nothing for this — it needs a retry).
async function pingWithRetries(isStale) {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const result = await pingSurfExtension();
    if (result.installed || isStale() || attempt === RETRY_ATTEMPTS - 1) return result;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}

const ExtensionConnectionContext = createContext(null);

export function ExtensionConnectionProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | installed | not-installed
  const [version, setVersion] = useState(null);
  // Whichever candidate ID (dev or a configured prod one — see surfClient.js's
  // SURF_EXTENSION_IDS) actually answered the ping. Exposed so callers needing a specific ID
  // afterward (Audit Trail's getAuditHistory) use the one that's actually live, not a guess.
  const [extensionId, setExtensionId] = useState(null);
  // Whether Surf protection is actually turned on for THIS origin right now — distinct from
  // `status`, which only says the extension exists and answered a ping. A page can be connected
  // to an installed, reachable extension that has protection explicitly toggled off for its own
  // origin (see the popup's "Surf protection: OFF" switch / perOriginDisabled in shared/policy.ts)
  // — in that state every call runs completely unguarded, which used to be indistinguishable from
  // "Surf evaluated this and allowed it", producing an honest-looking but misleading result.
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [entries, setEntries] = useState([]);
  const portRef = useRef(null);
  // A monotonically increasing counter, not a boolean. React StrictMode deliberately mounts an
  // effect, cleans it up, then remounts it once in dev — with a plain `cancelledRef.current`
  // boolean, the remount resets the flag back to false, so the FIRST mount's in-flight async
  // chain reads "not cancelled" when it later resolves and goes on to open a second real port.
  // Confirmed: this produced two live ports, both appending every incoming event, so each real
  // event showed up twice. A generation number closed over per-call sidesteps this: each connect()
  // call captures its own generation at call time and checks it's still current before acting,
  // rather than sharing one flag across every call.
  const generationRef = useRef(0);

  const connect = useCallback(() => {
    portRef.current?.disconnect();
    portRef.current = null;
    setStatus('checking');
    const myGeneration = ++generationRef.current;
    const isStale = () => generationRef.current !== myGeneration;

    pingWithRetries(isStale).then(({ installed, version: v, extensionId: id, protectionEnabled: p }) => {
      if (isStale()) return;
      setStatus(installed ? 'installed' : 'not-installed');
      setVersion(installed ? v : null);
      setExtensionId(installed ? id : null);
      setProtectionEnabled(installed ? p !== false : true);
      if (!installed) return;

      portRef.current = connectToSurfExtension(id, {
        onSnapshot: (snapshot) => { if (!isStale()) setEntries(snapshot.slice(-300)); },
        onEntry: (entry) => { if (!isStale()) setEntries((prev) => [...prev, entry].slice(-300)); },
        onDisconnect: () => { if (!isStale()) setStatus('not-installed'); },
      });
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      generationRef.current++; // invalidates this call's in-flight ping/port callbacks
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, [connect]);

  const value = { status, version, extensionId, protectionEnabled, entries, recheck: connect };
  return <ExtensionConnectionContext.Provider value={value}>{children}</ExtensionConnectionContext.Provider>;
}

export function useExtensionConnection() {
  const ctx = useContext(ExtensionConnectionContext);
  if (!ctx) {
    throw new Error('useExtensionConnection() must be used inside <ExtensionConnectionProvider> (mounted in app/(dashboard)/layout.js)');
  }
  return ctx;
}
