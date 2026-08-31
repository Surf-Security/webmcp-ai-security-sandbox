'use client';
import { useState } from 'react';
import TestHeader from '../TestHeader';
import { useWebMcpTools, callRealTool } from '../webmcpTestUtils';

const PEM_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN\nOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ==\n-----END RSA PRIVATE KEY-----';

const TOOLS = [
  { name: 'get_ssn', rule: 'ssn', description: 'Returns a US SSN', execute: () => ({ ssn: '123-45-6789' }) },
  { name: 'get_credit_card', rule: 'creditCard', description: 'Returns a Visa card number', execute: () => ({ card: '4111 1111 1111 1111' }) },
  { name: 'get_email', rule: 'pii-email', description: 'Returns an email address', execute: () => ({ email: 'dana.levi@acme.co.il' }) },
  { name: 'get_iban', rule: 'pii-iban', description: 'Returns an IBAN', execute: () => ({ iban: 'DE89370400440532013000' }) },
  { name: 'get_swift', rule: 'pii-swift', description: 'Returns a SWIFT/BIC code', execute: () => ({ swift: 'DEUTDEFF' }) },
  { name: 'get_amount', rule: 'pii-currency', description: 'Returns a currency amount', execute: () => ({ amount: '$12,345.67' }) },
  { name: 'get_private_key', rule: 'secret-pem', description: 'Returns a PEM private key', execute: () => ({ key: PEM_KEY }) },
  { name: 'get_aws_key', rule: 'secret-aws', description: 'Returns an AWS access key', execute: () => ({ key: 'AKIAABCDEFGHIJKLMNOP' }) },
  { name: 'get_jwt', rule: 'secret-jwt', description: 'Returns a JWT', execute: () => ({ jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdHNpZ25hdHVyZQ' }) },
  { name: 'get_bearer', rule: 'secret-bearer', description: 'Returns a bearer token', execute: () => ({ header: 'Bearer abcdefghijklmnopqrstuvwxyz123456' }) },
  { name: 'get_openai_key', rule: 'secret-openai-sk', description: 'Returns an OpenAI-style API key', execute: () => ({ key: 'sk-abcdefghijklmnopqrstuvwxyz123456' }) },
];

export default function DlpTest() {
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
        title="DLP rule coverage"
        description="Each tool returns one value matching a specific masking rule. None are annotated destructive, so results should come back immediately — masked if the matching rule is enabled in the Protection tab, raw if it's off."
      />

      {!ready && <div className="card">Registering tools…</div>}

      {ready && (
        <div className="card">
          <table className="audit-table">
            <thead>
              <tr><th>Rule</th><th>Tool</th><th></th><th>Result</th></tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td><span className="tag t-hold">{t.rule}</span></td>
                  <td className="mono-cell">{t.name}</td>
                  <td>
                    <button className="mini" disabled={pending === t.name} onClick={() => call(t.name)}>
                      {pending === t.name ? '…' : 'Call'}
                    </button>
                  </td>
                  <td className="mono-cell">{results[t.name] ? JSON.stringify(results[t.name]) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
