'use client';
import { useEffect, useRef, useState } from 'react';
import { connectToSurfExtension, pingSurfExtension } from './surfClient';

const TOOL_ROWS = [
  ['get_balance', 'read'],
  ['export_customers', 'data-egress'],
  ['get_session_token', 'credential'],
  ['transfer_funds', 'write-destructive'],
  ['add_payee', 'account-takeover-risk'],
];

const DEMO_INPUTS = {
  get_balance: {},
  export_customers: {},
  get_session_token: {},
  transfer_funds: { to: 'demo-account', amount: 50 },
  add_payee: { name: 'New Payee', account: 'IL62-0112-0000-0000-9999999' },
};

const DEMO_VISIBLE_STORAGE_KEY = 'surf-sandbox-demo-visible';

// Only what Surf actually enforces today — no roadmap/planned items.
const CAPABILITIES = [
  { label: 'App & tool allowlist', blurb: 'Explicitly-denylisted tools never run.' },
  { label: 'Policy before execute', blurb: 'Destructive/unproven calls held for approval.' },
  { label: 'Data protection', blurb: 'PII and secrets masked in tool results.' },
  { label: 'Full audit trail', blurb: 'Every call logged across every tab.' },
  { label: 'Exfiltration defence', blurb: 'Masking plus blocking bulk data-egress tools.' },
];

export default function Home() {
  const [mode, setMode] = useState('standard');
  const [balance, setBalance] = useState(4210);
  const [log, setLog] = useState([]);
  const [audit, setAudit] = useState([]);
  const [extStatus, setExtStatus] = useState('checking'); // checking | installed | not-installed
  const [extEntries, setExtEntries] = useState([]);
  const [showDemo, setShowDemo] = useState(true);
  const demoPreferenceSetRef = useRef(false);

  const [payees, setPayees] = useState([]);

  const modeRef = useRef('standard');
  const balanceRef = useRef(4210);
  const payeesRef = useRef([]);
  const toolsRef = useRef({});
  const registeredRef = useRef(false);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  const addLog = (t) => setLog((p) => [...p, t]);
  const addAudit = (e) => setAudit((p) => [...p, e]);

  // ---- register the WebMCP tools once, wrapped in the "Surf" security layer ----
  useEffect(() => {
    if (registeredRef.current) return;
    const mc = (typeof navigator !== 'undefined' && navigator.modelContext) ||
               (typeof document !== 'undefined' && document.modelContext);
    if (!mc) { addLog('modelContext MISSING — polyfill not loaded'); return; }
    registeredRef.current = true;

    const maskEmail = (e) => e.replace(/^[^@]+/, (m) => m[0] + '***');
    const maskPhone = (p) => p.replace(/\d(?=\d{2})/g, '*');
    const maskDeep = (v) => Array.isArray(v) ? v.map(maskDeep)
      : (v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k,
              k === 'email' && typeof x === 'string' ? maskEmail(x)
              : k === 'phone' && typeof x === 'string' ? maskPhone(x)
              : maskDeep(x)]))
          : v);

    const SESSION_TOKEN = 'sk_live_9f83ac2b71e40d55';
    const customers = [
      { name: 'Dana Levi', email: 'dana.levi@acme.co.il', phone: '054-1112223' },
      { name: 'Omer Katz', email: 'omer.katz@acme.co.il', phone: '052-4445556' },
    ];

    const defs = [
      { name: 'get_balance', category: 'read',
        description: 'Read the account balance',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: () => ({ balance: String(balanceRef.current) }) },
      { name: 'export_customers', category: 'data-egress',
        description: 'Export the full customer list',
        inputSchema: { type: 'object', properties: {} },
        execute: () => customers },
      { name: 'get_session_token', category: 'credential',
        description: 'Return the current session token',
        inputSchema: { type: 'object', properties: {} },
        execute: () => ({ token: SESSION_TOKEN }) },
      { name: 'transfer_funds', category: 'write-destructive',
        description: 'Transfer money to another account',
        inputSchema: { type: 'object', properties: { to: { type: 'string' }, amount: { type: 'number' } }, required: ['to', 'amount'] },
        annotations: { destructiveHint: true },
        execute: ({ to, amount }) => { const nb = balanceRef.current - Number(amount); balanceRef.current = nb; setBalance(nb); return `Transferred ${amount} to ${to}`; } },
      { name: 'add_payee', category: 'account-takeover-risk',
        description: 'Add a new payee/recipient to the account, enabling future transfers to them without further verification',
        inputSchema: { type: 'object', properties: { name: { type: 'string' }, account: { type: 'string' } }, required: ['name', 'account'] },
        annotations: { title: 'Add Payee', destructiveHint: true, readOnlyHint: false },
        execute: ({ name, account }) => {
          const np = [...payeesRef.current, { name, account }];
          payeesRef.current = np; setPayees(np);
          return `Payee "${name}" (${account}) added — transfers to this recipient are now allowed`;
        } },
    ];

    defs.forEach((def) => {
      const wrapped = (input, caller = 'unknown caller') => {
        const m = modeRef.current;
        const cat = def.category;
        const ts = new Date().toLocaleTimeString();
        let verdict = 'allowed', result;

        if (m === 'surf' && cat === 'write-destructive') {
          verdict = 'BLOCKED (needs human approval)';
          result = 'DENIED by Surf — destructive action held for approval';
          addAudit({ ts, mode: m, tool: def.name, cat, caller, input, verdict, result });
          addLog(`[${ts}] [${m}] ${caller} called ${def.name}(${JSON.stringify(input)}) -> ${result}`);
          return result;
        }

        result = def.execute(input);

        if (m === 'surf' && cat === 'data-egress') { result = maskDeep(result); verdict = 'allowed (data masked)'; }
        if (m === 'surf' && cat === 'credential') { result = '***REDACTED*** (credential isolation)'; verdict = 'allowed (credential isolated)'; }

        addAudit({ ts, mode: m, tool: def.name, cat, caller, input, verdict, result });
        addLog(`[${ts}] [${m}] ${caller} called ${def.name}(${JSON.stringify(input)}) -> ${JSON.stringify(result)}`);
        return result;
      };
      mc.registerTool({ name: def.name, description: def.description, inputSchema: def.inputSchema, annotations: def.annotations || {}, execute: wrapped });
      toolsRef.current[def.name] = wrapped;
    });

    addLog('page loaded — modelContext present, 5 tools registered');
  }, []);

  // ---- connect to the real Surf browser extension, if installed (separate from the "surf" toggle above) ----
  useEffect(() => {
    let port;
    let cancelled = false;

    pingSurfExtension().then(({ installed }) => {
      if (cancelled) return;
      setExtStatus(installed ? 'installed' : 'not-installed');
      if (!installed) return;

      port = connectToSurfExtension(undefined, {
        onSnapshot: (entries) => setExtEntries(entries.slice(-50)),
        onEntry: (entry) => setExtEntries((prev) => [...prev, entry].slice(-50)),
        onDisconnect: () => { if (!cancelled) setExtStatus('not-installed'); },
      });
    });

    return () => {
      cancelled = true;
      port?.disconnect();
    };
  }, []);

  // ---- demo visibility: an explicit user choice, persisted, with a one-time smart default ----
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(DEMO_VISIBLE_STORAGE_KEY) : null;
    if (stored !== null) {
      setShowDemo(stored === 'true');
      demoPreferenceSetRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (demoPreferenceSetRef.current || extStatus === 'checking') return;
    setShowDemo(extStatus !== 'installed');
  }, [extStatus]);

  const toggleDemo = () => {
    setShowDemo((prev) => {
      const next = !prev;
      demoPreferenceSetRef.current = true;
      window.localStorage.setItem(DEMO_VISIBLE_STORAGE_KEY, String(next));
      return next;
    });
  };

  const callTool = async (name, input, caller = 'manual click (you)') => {
    const fn = toolsRef.current[name];
    if (fn) return await fn(input, caller);
    addLog('[error] tool not found: ' + name);
  };

  const selfTest = async () => {
    setAudit([]); setLog([]); setBalance(4210); balanceRef.current = 4210;
    addLog('=== SELF-TEST: agent runs 4 tools in each mode ===');
    for (const m of ['standard', 'surf']) {
      setMode(m); modeRef.current = m;
      addLog(`--- mode: ${m === 'surf' ? 'SURF-SECURED' : 'STANDARD'} ---`);
      await callTool('get_balance', {}, 'self-test script');
      await callTool('export_customers', {}, 'self-test script');
      await callTool('get_session_token', {}, 'self-test script');
      await callTool('transfer_funds', { to: 'attacker-account', amount: 1000 }, 'self-test script');
    }
    addLog('=== done — see AI Agent Risk Audit ===');
  };

  const reset = () => { setAudit([]); setLog(['(reset)']); setBalance(4210); balanceRef.current = 4210; setPayees([]); payeesRef.current = []; };

  // ---- derived report ----
  const std = audit.filter((x) => x.mode === 'standard');
  const surf = audit.filter((x) => x.mode === 'surf');
  const leaked = std.filter((x) => x.cat === 'data-egress' || x.cat === 'credential').length;
  const destr = std.filter((x) => x.cat === 'write-destructive' && x.verdict === 'allowed').length;
  const blocked = surf.filter((x) => x.verdict.startsWith('BLOCKED')).length;
  const masked = surf.filter((x) => x.verdict.includes('mask') || x.verdict.includes('isolat')).length;

  // ---- live report, from the real extension's cross-tab audit feed ----
  const extBlockedCount = extEntries.filter((e) => e.verdict === 'blocked').length;
  const extDeniedCount = extEntries.filter((e) => e.verdict === 'denied').length;
  const extMaskedCount = extEntries.filter((e) => e.masked).length;
  const extAllowedCount = extEntries.filter((e) => e.verdict === 'success' && !e.masked).length;

  // extEntries is a global cross-tab feed, so scope lookups to this page's own origin —
  // another tab could in principle register a same-named tool.
  const latestEntryForTool = (name) => {
    if (typeof window === 'undefined') return null;
    for (let i = extEntries.length - 1; i >= 0; i -= 1) {
      const e = extEntries[i];
      if (e.toolName !== name) continue;
      try {
        if (new URL(e.tabUrl).origin !== window.location.origin) continue;
      } catch {
        continue;
      }
      return e;
    }
    return null;
  };

  const relativeTime = (ts) => {
    const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.round(seconds / 60)}m ago`;
  };

  return (
    <div className="wrap">
      <div className="brand-header">
        <img src="/surf-mark.svg" alt="Surf" />
        <div>
          <div className="brand-name">Surf</div>
          <div className="brand-product">WebMCP AI Security Sandbox</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>
          Live report — Surf WebMCP Security extension{' '}
          <span className={'tag ' + (extStatus === 'installed' ? 't-ok' : extStatus === 'checking' ? 't-hold' : 't-bad')}>
            {extStatus === 'installed' ? 'connected' : extStatus === 'checking' ? 'checking' : 'not installed'}
          </span>
        </h3>
        <div className="capability-grid">
          {CAPABILITIES.map((c) => (
            <div key={c.label} className="capability-item">
              <span className="tag t-ok">✓</span>
              <div>
                <div className="capability-label">{c.label}</div>
                <div className="capability-blurb">{c.blurb}</div>
              </div>
            </div>
          ))}
        </div>

        {extStatus === 'not-installed' && (
          <div>Install the Surf — WebMCP Security extension to see real, browser-level enforcement across every tab.</div>
        )}
        {extStatus === 'installed' && (
          <div className="protected-tools-list">
            {TOOL_ROWS.map(([n]) => {
              const entry = latestEntryForTool(n);
              return (
                <div key={n} className="protected-tool-row">
                  <span className="mono-cell">{n}</span>
                  {entry ? (
                    <span className={'tag ' + (entry.verdict === 'blocked' || entry.verdict === 'denied' ? 't-bad' : entry.masked ? 't-hold' : 't-ok')}>
                      {(entry.verdict === 'blocked' || entry.verdict === 'denied' ? entry.verdict : entry.masked ? 'masked' : entry.verdict) + ' · ' + relativeTime(entry.ts)}
                    </span>
                  ) : (
                    <span className="tag t-planned">protected</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {extStatus === 'installed' && extEntries.length > 0 && (
          <>
            <div className="stat-tiles">
              <div className="stat-tile"><div className="n">{extEntries.length}</div><div className="l">Total calls</div></div>
              <div className="stat-tile"><div className="n">{extBlockedCount + extDeniedCount}</div><div className="l">Blocked / denied</div></div>
              <div className="stat-tile"><div className="n">{extMaskedCount}</div><div className="l">Masked</div></div>
              <div className="stat-tile"><div className="n">{extAllowedCount}</div><div className="l">Allowed clean</div></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="audit-table">
                <thead>
                  <tr><th>Time</th><th>Tab</th><th>Tool</th><th>Called by</th><th>Verdict</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {[...extEntries].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.ts).toLocaleTimeString()}</td>
                      <td>{e.tabTitle || e.tabUrl || e.tabId}</td>
                      <td>{e.toolName}</td>
                      <td>{e.caller}</td>
                      <td><span className={'tag ' + (e.verdict === 'blocked' || e.verdict === 'denied' ? 't-bad' : e.masked ? 't-hold' : 't-ok')}>{e.verdict === 'blocked' || e.verdict === 'denied' ? e.verdict : e.masked ? 'masked' : e.verdict}</span></td>
                      <td className="mono-cell">{JSON.stringify(e.detail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <label className="demo-toggle">
        <input type="checkbox" checked={showDemo} onChange={toggleDemo} />
        Show the in-page simulation below
      </label>

      {showDemo && (
        <>
          <h1>WebMCP AI Security Sandbox</h1>
          <p className="sub">A mock business app that exposes WebMCP tools. Watch what an AI agent can do to it — with and without Surf.</p>

          <div className="modebar">
            <span className="pill">Mode: <b>{mode === 'surf' ? 'SURF-SECURED' : 'STANDARD BROWSER'}</b></span>
            <button className={mode === 'standard' ? 'active' : ''} onClick={() => setMode('standard')}>Standard browser</button>
            <button className={'primary ' + (mode === 'surf' ? 'active' : '')} onClick={() => setMode('surf')}>Surf-secured</button>
            <button onClick={selfTest}>Run agent self-test</button>
            <button onClick={reset}>Reset</button>
            <span className="pill">Balance: <b>{balance}</b> ₪</span>
          </div>

          <div className="row">
            <div className="card">
              <h3>Exposed WebMCP tools</h3>
              <div className="kv">
                {TOOL_ROWS.map(([n, c]) => (
                  <div key={n} className="toolrow">
                    • <b>{n}</b> <span className={'tag ' + (c === 'read' ? 't-ok' : (c === 'write-destructive' || c === 'account-takeover-risk') ? 't-bad' : 't-hold')}>{c}</span>
                    <button className="mini" onClick={() => callTool(n, DEMO_INPUTS[n], 'manual click (you)')}>Call</button>
                  </div>
                ))}
              </div>
              <p className="hint">
                <code>add_payee</code> is <b>not</b> covered by the Standard/Surf toggle above — this app never
                blocks or masks it itself. It exists to demo a real, installed Surf browser extension
                intercepting the call at the browser level. Without that extension installed, it always succeeds.
                Current payees: {payees.length === 0 ? 'none' : payees.map((p) => `${p.name} (${p.account})`).join(', ')}
              </p>
            </div>
            <div className="card report">
              <h3>AI Agent Risk Audit</h3>
              {audit.length === 0 ? <div>Run the self-test to generate a report.</div> : (
                <>
                  <div className="stat"><span>Standard: sensitive data exposed</span><b className="tag t-bad">{leaked}</b></div>
                  <div className="stat"><span>Standard: destructive actions run unchecked</span><b className="tag t-bad">{destr}</b></div>
                  <div className="stat"><span>Surf: destructive actions blocked for approval</span><b className="tag t-ok">{blocked}</b></div>
                  <div className="stat"><span>Surf: data masked / credentials isolated</span><b className="tag t-ok">{masked}</b></div>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Live audit log — which function, and by who</h3>
            {audit.length === 0 ? <div>No tool calls yet. Click a tool&apos;s &quot;Call&quot; button, or run the self-test.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="audit-table">
                  <thead>
                    <tr><th>Time</th><th>Tool</th><th>Called by</th><th>Mode</th><th>Verdict</th><th>Result</th></tr>
                  </thead>
                  <tbody>
                    {audit.map((a, i) => (
                      <tr key={i}>
                        <td>{a.ts}</td>
                        <td>{a.tool}</td>
                        <td>{a.caller}</td>
                        <td>{a.mode === 'surf' ? 'Surf' : 'Standard'}</td>
                        <td><span className={'tag ' + (a.verdict.startsWith('BLOCKED') ? 't-bad' : (a.verdict.includes('mask') || a.verdict.includes('isolat')) ? 't-hold' : 't-ok')}>{a.verdict}</span></td>
                        <td className="mono-cell">{JSON.stringify(a.result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Raw event log</h3>
            <pre>{log.length ? log.join('\n') : '(page loading…)'}</pre>
          </div>
        </>
      )}
    </div>
  );
}
