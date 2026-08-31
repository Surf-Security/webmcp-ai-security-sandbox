'use client';
import { useState } from 'react';
import TestHeader from '../TestHeader';
import { useWebMcpTools, callRealTool } from '../webmcpTestUtils';

const TOOLS = [
  { name: 'safe_tool', description: 'A plain tool with no special meaning', execute: () => 'safe_tool ran fine' },
  { name: 'risky_tool', description: 'Also a plain tool — block this one from the extension popup', execute: () => 'risky_tool ran fine' },
];

export default function BlocklistTest() {
  const { ready } = useWebMcpTools(TOOLS);
  const [results, setResults] = useState({});
  const [pending, setPending] = useState(null);

  const call = async (name) => {
    setPending(name);
    const res = await callRealTool(name, {});
    setPending(null);
    setResults((prev) => ({ ...prev, [name]: res }));
  };

  return (
    <div className="wrap">
      <TestHeader
        title="Per-tool blocklist"
        description='Neither tool is annotated destructive or returns sensitive data — the blocklist is the only thing that can stop either one. Open the extension popup → Inspector tab, find risky_tool, check "Always block this tool," then call both below.'
      />

      {!ready && <div className="card">Registering tools…</div>}

      {ready && (
        <div className="row">
          {TOOLS.map((t) => (
            <div key={t.name} className="card">
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <button disabled={pending === t.name} onClick={() => call(t.name)}>
                {pending === t.name ? 'Calling…' : `Call ${t.name}`}
              </button>
              {results[t.name] && (
                <pre style={{ marginTop: 12 }}>{JSON.stringify(results[t.name], null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
