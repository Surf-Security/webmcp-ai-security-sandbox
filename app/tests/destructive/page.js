'use client';
import { useState } from 'react';
import TestHeader from '../TestHeader';
import { useWebMcpTools, callRealTool } from '../webmcpTestUtils';

const TOOLS = [
  {
    name: 'wire_transfer',
    description: 'Transfer money to another account',
    inputSchema: {
      type: 'object',
      properties: { to: { type: 'string' }, amount: { type: 'number' } },
      required: ['to', 'amount'],
    },
    annotations: { destructiveHint: true },
    execute: ({ to, amount }) => `Transferred ${amount} to ${to}`,
  },
  {
    name: 'read_balance',
    description: 'Read the account balance (control — not destructive)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ({ balance: '4210' }),
  },
];

export default function DestructiveTest() {
  const { ready } = useWebMcpTools(TOOLS);
  const [results, setResults] = useState({});
  const [pending, setPending] = useState(null);

  const call = async (name, args) => {
    setPending(name);
    const res = await callRealTool(name, args);
    setPending(null);
    setResults((prev) => ({ ...prev, [name]: res }));
  };

  return (
    <div className="wrap">
      <TestHeader
        title="Destructive tool + hold-for-approval"
        description='wire_transfer is annotated annotations: { destructiveHint: true }. With Surf protection on and "Destructive tool calls" set to Hold for approval, calling it should pop the real Approve/Deny prompt directly on this page — not a simulation.'
      />

      {!ready && <div className="card">Registering tools…</div>}

      {ready && (
        <div className="row">
          <div className="card">
            <h3>wire_transfer <span className="tag t-bad">destructive</span></h3>
            <p>Calls wire_transfer(to: &quot;attacker-account&quot;, amount: 5000) as a real agent would.</p>
            <button className="primary" disabled={pending === 'wire_transfer'} onClick={() => call('wire_transfer', { to: 'attacker-account', amount: 5000 })}>
              {pending === 'wire_transfer' ? 'Calling…' : 'Call wire_transfer'}
            </button>
            {results.wire_transfer && (
              <pre style={{ marginTop: 12 }}>{JSON.stringify(results.wire_transfer, null, 2)}</pre>
            )}
          </div>

          <div className="card">
            <h3>read_balance <span className="tag t-ok">read-only</span></h3>
            <p>Control case — should always run immediately, no prompt, regardless of policy.</p>
            <button disabled={pending === 'read_balance'} onClick={() => call('read_balance', {})}>
              {pending === 'read_balance' ? 'Calling…' : 'Call read_balance'}
            </button>
            {results.read_balance && (
              <pre style={{ marginTop: 12 }}>{JSON.stringify(results.read_balance, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
