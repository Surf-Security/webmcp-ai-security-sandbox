import Link from 'next/link';

const SITES = [
  {
    href: '/tests/destructive',
    name: 'Destructive tool + hold-for-approval',
    desc: 'A tool annotated destructiveHint: true. With protection on and set to "Hold for approval," calling it should show the real in-page Approve/Deny prompt.',
  },
  {
    href: '/tests/dlp',
    name: 'DLP rule coverage',
    desc: 'One tool per masking rule — SSN, credit card, IBAN, SWIFT, currency, PEM key, AWS key, JWT, bearer token, OpenAI-style key — to check each one masks correctly.',
  },
  {
    href: '/tests/blocklist',
    name: 'Per-tool blocklist',
    desc: 'Two plain tools with no special annotations. Block one from the extension\'s Inspector tab, then confirm it\'s denied instantly while the other still works.',
  },
  {
    href: '/tests/multi-frame',
    name: 'Cross-origin frame detection',
    desc: 'A top-level tool plus a tool registered inside a genuinely cross-origin iframe (127.0.0.1 vs localhost), to check per-frame/per-origin detection and blocklisting.',
  },
];

export default function TestsIndex() {
  return (
    <div className="wrap">
      <div className="brand-header">
        <img src="/surf-mark.svg" alt="Surf" />
        <div>
          <div className="brand-name">Surf</div>
          <div className="brand-product">WebMCP test sites</div>
        </div>
      </div>
      <p className="sub">
        <Link href="/">Main sandbox</Link>
      </p>
      <h1>Test sites</h1>
      <p className="sub">
        Each page registers real WebMCP tools and calls them via <code>modelContext.executeTool()</code> directly —
        the same path a real AI agent uses. Unlike the main sandbox, there's no in-page simulation here: whatever
        happens is entirely down to the real Surf extension.
      </p>

      <div className="row">
        {SITES.map((s) => (
          <div key={s.href} className="card">
            <h3><Link href={s.href}>{s.name}</Link></h3>
            <div>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
