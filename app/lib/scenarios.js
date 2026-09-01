/**
 * The 5 demo tools registered by the Security Test page — one per ALLOW / MASK / BLOCK test suite,
 * plus 2 for Risky Action's sequential add_payee → transfer_funds workflow. inputSchema/annotations
 * are real — the extension's popup Inspector builds its call-input form and "always block this
 * tool" control straight from these, so getting them wrong breaks real functionality, not just
 * cosmetics. Neither add_payee nor transfer_funds sets readOnlyHint/destructiveHint quite the same
 * way: transfer_funds is explicitly destructiveHint (it obviously is one), while add_payee is left
 * unannotated on purpose — under Surf's default 'strict' policy, an unannotated tool whose name
 * doesn't read as a lookup (get/list/search/...) is held for approval too, so both steps of the
 * workflow genuinely go through the real approval gate without needing a special-cased annotation.
 */
export const TOOLS = [
  {
    name: 'get_balance',
    description: 'Read the account balance',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'export_customers',
    description: 'Export the full customer list',
    inputSchema: { type: 'object', properties: {} },
    // readOnlyHint: true is what keeps this a pure masking demo — it's a real annotation the
    // extension's shouldHoldForApproval() checks first, in every destructiveMode, before any
    // name-based heuristic. Without it, 'export_customers' doesn't start with a recognized
    // read-verb prefix (get/list/search/...), so strict mode would also hold it for approval —
    // true to how an un-annotated real tool would behave, but it would muddy this specific test,
    // which is meant to isolate DLP masking from the approval mechanism (that's Risky Action's job).
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_payee',
    description: 'Add a new payee/recipient to the account, enabling future transfers to them',
    inputSchema: { type: 'object', properties: { name: { type: 'string' }, account: { type: 'string' } }, required: ['name', 'account'] },
    annotations: {},
  },
  {
    name: 'transfer_funds',
    description: 'Transfer money to another account',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        amount: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['to', 'amount'],
    },
    annotations: { destructiveHint: true },
  },
  {
    name: 'delete_account',
    description: 'Permanently delete a customer account and all associated data',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
    annotations: { destructiveHint: true },
  },
];

export const DEMO_INPUTS = {
  get_balance: {},
  export_customers: {},
  add_payee: { name: 'John Smith', account: 'ACCT-4471-2200' },
  transfer_funds: { to: 'John Smith', amount: 500, description: 'Payment for services' },
  delete_account: { customer_id: 'CUS-1003' },
};

/**
 * The demo bank account get_balance reads from — its own small real "database record", same
 * spirit as SAMPLE_CUSTOMERS below. get_balance's execute() (see security-test/page.js) returns
 * this plus a genuinely-current `updatedAt` timestamp stamped at call time — not a fabricated
 * "looks live" number, just Date.now() when the call actually happened.
 */
export const SAMPLE_ACCOUNT = { account: 'ACC-20481', balance: 4210, currency: 'USD', status: 'Active' };

/**
 * The 4 fixed test suites the Security Test page offers — deliberately capped at these 4, one per
 * real enforcement mechanism the extension has (see mcp-guard.ts: hard-block check → blocklist
 * check → approval hold → DLP mask, in that order, plus the read-only fast path). Each `baseline`
 * describes what genuinely happens with no protection — not a fabricated number, just the real
 * unprotected behavior of that same tool — so the WITHOUT SURF / WITH SURF comparison stays
 * honest even though only the WITH SURF side is ever a live call. `approvalRequired` reflects
 * each tool's own annotations under Surf's default policy (destructiveMode: 'strict') — not a
 * per-call measurement (the real guard doesn't report back whether a *successful* call was ever
 * held first), so it's stated as a fact about the tool, not a live observation.
 */
export const TEST_SUITES = [
  {
    id: 'safe-read',
    title: 'Safe Read',
    tagline: 'Safe actions continue normally',
    testLabel: 'Allow',
    toolName: 'get_balance',
    agentTask: 'What is the current account balance?',
    approvalRequired: false,
  },
  {
    id: 'sensitive-data',
    title: 'Sensitive Data',
    tagline: 'Sensitive information is masked before it reaches the agent.',
    testLabel: 'Mask',
    toolName: 'export_customers',
    agentTask: 'Export all customer records including payment details.',
    approvalRequired: false,
  },
  {
    id: 'risky-action',
    title: 'Risky Action',
    tagline: 'Require a human before execution',
    testLabel: 'Approve',
    toolName: 'transfer_funds',
    // Risky Action is the one suite that's a 2-step real workflow, not a single tool call — see
    // security-test/page.js's runRiskyActionWorkflow(). toolNames drives the header's tool badges
    // and the step list; toolName (above) stays the single "primary" name other generic code
    // (Result panel links, report titles) can keep using without a special case.
    toolNames: ['add_payee', 'transfer_funds'],
    agentTask: 'Add John Smith as a payee and transfer $500 to him.',
    approvalRequired: true,
  },
  {
    id: 'policy-block',
    title: 'Policy Block',
    tagline: 'Forbid a tool regardless of what the site says',
    testLabel: 'Block',
    toolName: 'delete_account',
    agentTask: 'Delete customer account CUS-1003.',
    approvalRequired: false,
    note: 'Hard-blocked on this site by default.',
  },
];

/**
 * The fields in a SAMPLE_CUSTOMERS record that map to a real DLP rule the extension has (email,
 * currency, credit card, IBAN, SWIFT, JWT session token) — used by the Sensitive Data test to
 * compute a real "N of 6 masked" count from whatever the live call actually returns. This count
 * (6) is a static fact about our own sample data's shape, not a live detection number; the *live*
 * masked count read off the real result is what varies with the extension's actual configured
 * policy. name/address/customer_id are deliberately excluded — no rule matches them, ever.
 * pii-iban, pii-swift, and pii-currency are OFF by default (see policy.ts's DEFAULT_RULE_TOGGLES),
 * so a fresh install should genuinely mask 3 of these 6 by default (email, credit card, session
 * token) — showing fewer than 6 out of the box is the honest result, not a bug.
 */
export const SENSITIVE_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'account_balance', label: 'Account balance' },
  { key: 'credit_card', label: 'Credit card' },
  { key: 'iban', label: 'IBAN' },
  { key: 'swift', label: 'SWIFT' },
  { key: 'session_token', label: 'Session token' },
];

/**
 * export_customers' result — chosen to exercise most of the real extension's built-in DLP rules
 * (email, credit card, IBAN, SWIFT, JWT session token, currency amount) in one real call, rather
 * than the old 2-row name/email/phone set (phone isn't even a DLP rule the extension has).
 * Verified against the actual regex patterns in shared/dlp.ts, not just eyeballed. One real gap
 * is left in on purpose rather than quietly fixed, so the demo stays honest about what the DLP
 * engine actually catches: the French and Italian IBANs' final group ("3M02 606", "0123 456") is
 * left partially exposed — the pii-iban pattern's tail capture truncates before it. (Amelia
 * Rodriguez's Amex card was originally grouped 4-6-5, which the creditCard rule's 4-4-4-4-groups
 * alternative doesn't match — written unspaced below instead, since the rule's other alternative,
 * `3[47]\d{13}`, matches a bare 15-digit Amex number with no grouping requirement; unspaced is
 * also a legitimate, commonly-used Amex display format, and 378282246310005 is the standard Amex
 * test number.)
 * Also note pii-iban, pii-swift, and pii-currency are OFF by default (see policy.ts's
 * DEFAULT_RULE_TOGGLES) — those three fields only mask once enabled in the extension popup.
 * name/address/customer_id have no matching rule at all and are never masked.
 */
export const SAMPLE_CUSTOMERS = [
  { customer_id: 'CUS-1001', name: 'Sarah Johnson', email: 'sarah.johnson@example.com', account_balance: '$12,450.00', credit_card: '4111 1111 1111 1111', iban: 'GB82 WEST 1234 5698 7654 32', swift: 'DEUTDEFF', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwMSJ9.demo-signature', address: '123 Market Street, San Francisco, CA' },
  { customer_id: 'CUS-1002', name: 'Michael Chen', email: 'michael.chen@example.com', account_balance: '$8,720.50', credit_card: '5555 5555 5555 4444', iban: 'DE89 3704 0044 0532 0130 00', swift: 'COBADEFFXXX', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwMiJ9.demo-signature', address: '46 Pine Avenue, Seattle, WA' },
  { customer_id: 'CUS-1003', name: 'Amelia Rodriguez', email: 'amelia.rodriguez@example.com', account_balance: '$24,110.75', credit_card: '378282246310005', iban: 'FR14 2004 1010 0505 0001 3M02 606', swift: 'BNPAFRPP', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwMyJ9.demo-signature', address: '81 Grand Avenue, Austin, TX' },
  { customer_id: 'CUS-1004', name: 'Daniel Williams', email: 'daniel.williams@example.com', account_balance: '$3,985.00', credit_card: '6011 1111 1111 1117', iban: 'ES91 2100 0418 4502 0005 1332', swift: 'CAIXESBBXXX', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwNCJ9.demo-signature', address: '209 King Street, Boston, MA' },
  { customer_id: 'CUS-1005', name: 'Olivia Thompson', email: 'olivia.thompson@example.com', account_balance: '$17,640.25', credit_card: '4111 1111 1111 1111', iban: 'NL91 ABNA 0417 1643 00', swift: 'ABNANL2A', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwNSJ9.demo-signature', address: '17 Lakeview Drive, Chicago, IL' },
  { customer_id: 'CUS-1006', name: 'Noah Anderson', email: 'noah.anderson@example.com', account_balance: '$31,205.90', credit_card: '5555 5555 5555 4444', iban: 'IT60 X054 2811 1010 0000 0123 456', swift: 'BPPIITRRXXX', session_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDVVMtMTAwNiJ9.demo-signature', address: '355 Oak Street, Denver, CO' },
];
