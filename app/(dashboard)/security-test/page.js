'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Database,
  AlertTriangle,
  Ban,
  Play,
  Loader2,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  EyeOff,
  ScrollText,
  FileBarChart2,
  Trash2,
  FlaskConical,
  Monitor,
  Activity,
} from 'lucide-react';
import Badge, { VARIANT_CLASSES, TEXT_CLASSES } from '../../components/ui/Badge';
import { useExtensionConnection } from '../../lib/useExtensionConnection';
import { saveRiskReport, listRiskReports } from '../../lib/riskReports';
import { formatDateTime, formatTime } from '../../lib/formatDate';
import { TOOLS, DEMO_INPUTS, SAMPLE_CUSTOMERS, SAMPLE_ACCOUNT, SENSITIVE_FIELDS, TEST_SUITES } from '../../lib/scenarios';

const HOW_IT_WORKS_STEPS = [
  { icon: FlaskConical, label: 'Choose a test', description: 'Pick a test suite that matches the scenario you want to evaluate.' },
  { icon: Monitor, label: 'Run baseline preview', description: 'See how the tool responds without Surf protection.' },
  { icon: ShieldCheck, label: 'Run with Surf', description: 'Run the same tool with Surf enabled to see protection in action.' },
  { icon: FileBarChart2, label: 'Generate risk report', description: 'Save a detailed report with the findings and decision.' },
];

const RESULT_LEGEND = [
  { icon: CheckCircle2, label: 'Allowed', description: 'Action allowed — safe to proceed.', variant: 'allowed' },
  { icon: EyeOff, label: 'Masked', description: 'Sensitive information masked before output.', variant: 'masked' },
  { icon: AlertTriangle, label: 'Approval required', description: 'Action requires your approval to continue.', variant: 'held' },
  { icon: Ban, label: 'Blocked', description: 'Action blocked by Surf policy.', variant: 'blocked' },
];

// Reused by ResultPanel below so the outcome icon is defined in exactly one place.
const ICON_BY_VARIANT = Object.fromEntries(RESULT_LEGEND.map((r) => [r.variant, r.icon]));

/** Newest report per suite only, so the same suite run twice doesn't crowd out the others here —
 * the full (undeduped) history is still one click away on the Risk Reports page. */
function latestPerSuite(reports, limit) {
  const seen = new Set();
  const result = [];
  for (const r of reports) {
    if (seen.has(r.suiteId)) continue;
    seen.add(r.suiteId);
    result.push(r);
    if (result.length === limit) break;
  }
  return result;
}

// One visual style per suite, keyed to the same verdict-color tokens used everywhere else in the
// app (Badge/verdict.js). Written as literal class strings (not built from a template) so
// Tailwind's static content scan picks them up.
const SUITE_STYLE = {
  'safe-read': { icon: ShieldCheck, variant: 'allowed', border: 'border-ok/30 hover:border-ok/60', iconWrap: 'bg-ok-bg text-ok', title: 'text-ok' },
  'sensitive-data': { icon: Database, variant: 'masked', border: 'border-masked/30 hover:border-masked/60', iconWrap: 'bg-masked-bg text-masked', title: 'text-masked' },
  'risky-action': { icon: AlertTriangle, variant: 'held', border: 'border-hold/30 hover:border-hold/60', iconWrap: 'bg-hold-bg text-hold', title: 'text-hold' },
  'policy-block': { icon: Ban, variant: 'blocked', border: 'border-bad/30 hover:border-bad/60', iconWrap: 'bg-bad-bg text-bad', title: 'text-bad' },
};

const DISPLAY_FIELDS = [{ key: 'name', label: 'Name' }, ...SENSITIVE_FIELDS];

// Risky Action is a real 2-step workflow (add_payee then transfer_funds), not a single tool call —
// see runRiskyActionWorkflow. Both steps go through the exact same real approval gate; there are no
// fake Approve/Deny buttons drawn by this page anywhere in this workflow — the real decision UI is
// the extension's own in-page prompt (content/policy-bridge.ts), which this page has no way to
// embed or fabricate. This constant is the one place that ordering is defined.
const RISKY_ACTION_TOOLS = ['add_payee', 'transfer_funds'];

function isMaskedValue(value) {
  return typeof value === 'string' && /^\[REDACTED(:[\w-]+)?]$/i.test(value);
}

function formatMoney(amount, currency) {
  return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** Real per-call outcome, read off the actual guard return value — never inferred/guessed. */
function describeOutcome(state) {
  if (state.error) return { status: 'error' };
  const r = state.result;
  if (r && typeof r === 'object' && r.surfBlocked) {
    return { status: r.error === 'DENIED_BY_SURF' ? 'denied' : 'blocked', message: r.message };
  }
  return { status: 'success' };
}

/**
 * Risky Action's result, computed from the real per-step outcomes recorded by
 * runRiskyActionWorkflow — never from a guess about what "should" have happened. Returns null
 * until the workflow has actually finished (or stopped early on a denial/block).
 */
function computeRiskyActionResult(state) {
  const steps = state.steps || [];
  if (state.loading || steps.length === 0) return null;

  const stoppedStep = steps.find((s) => s.status === 'denied' || s.status === 'blocked' || s.status === 'error');
  const transferStep = steps.find((s) => s.tool === 'transfer_funds');
  const fundsTransferred = transferStep?.status === 'success';
  const executedCount = steps.filter((s) => s.status === 'success').length;

  let label = 'APPROVED';
  let variant = 'allowed';
  let summary = 'Both actions were approved and executed.';
  if (stoppedStep?.status === 'denied') {
    label = 'DENIED';
    variant = 'blocked';
    summary = `${stoppedStep.tool} was denied.`;
  } else if (stoppedStep?.status === 'blocked') {
    label = 'BLOCKED';
    variant = 'blocked';
    summary = `${stoppedStep.tool} was blocked by Surf policy.`;
  } else if (stoppedStep?.status === 'error') {
    label = 'ERROR';
    variant = 'neutral';
    summary = stoppedStep.error || 'Something went wrong.';
  }

  const stats = [
    { label: 'Workflow actions', value: String(RISKY_ACTION_TOOLS.length) },
    { label: 'Executed', value: String(executedCount) },
  ];
  if (stoppedStep?.status === 'denied') stats.push({ label: 'Denied', value: '1' });
  if (stoppedStep?.status === 'blocked') stats.push({ label: 'Blocked', value: '1' });
  stats.push({ label: 'Funds transferred', value: fundsTransferred ? 'Yes' : 'No' });
  stats.push({ label: 'Audit events recorded', value: String(steps.length) });

  return { label, variant, summary, stats, outcome: { status: label.toLowerCase() } };
}

/**
 * Everything the Test Result panel shows AND everything a saved Risk Report snapshots — computed
 * once, in one place, so the two can never disagree. Returns null before a call has resolved.
 */
function computeResult(suite, state) {
  if (suite.id === 'risky-action') return computeRiskyActionResult(state);
  const hasRun = state.result !== undefined || !!state.error;
  if (!hasRun) return null;
  const outcome = describeOutcome(state);
  const isSensitive = suite.id === 'sensitive-data';
  const isAction = suite.id === 'policy-block';

  let label = 'ALLOWED';
  let variant = 'allowed';
  let summary = `${suite.toolName} ran with no interruption.`;
  const stats = [];

  // Block/deny/error must win regardless of which suite this is — checked first, before any
  // suite-specific success-path logic, so a blocked or denied Sensitive Data call (say, a custom
  // per-tool block on export_customers) can never fall into the masking branch below and get
  // reported as ALLOWED just because isSensitive happened to be checked first.
  if (outcome.status === 'error') {
    label = 'ERROR';
    variant = 'neutral';
    summary = "Surf (or the browser's WebMCP bridge) couldn't be reached — see the error for details.";
  } else if (outcome.status === 'denied') {
    label = 'DENIED';
    variant = 'blocked';
    summary = outcome.message || 'This action was not approved.';
  } else if (outcome.status === 'blocked') {
    label = 'BLOCKED';
    variant = 'blocked';
    summary = outcome.message || 'Surf prevented this tool from executing.';
  } else if (isSensitive) {
    const record = Array.isArray(state.result) ? state.result[0] : undefined;
    const foundCount = SENSITIVE_FIELDS.length;
    const maskedCount = SENSITIVE_FIELDS.filter((f) => isMaskedValue(record?.[f.key])).length;
    label = maskedCount > 0 ? 'MASKED' : 'ALLOWED';
    variant = maskedCount > 0 ? 'masked' : 'allowed';
    summary = `Surf masked ${maskedCount} of ${foundCount} sensitive value${foundCount === 1 ? '' : 's'} before they reached the agent.`;
    stats.push({ label: 'Sensitive values found', value: String(foundCount) });
    stats.push({ label: 'Sensitive values masked', value: String(maskedCount) });
  } else if (suite.id === 'safe-read') {
    summary = 'This safe read action was allowed with no interruption.';
  }

  if (suite.id === 'safe-read') {
    stats.push({ label: 'Sensitive values masked', value: '0' });
  }
  if (isAction) {
    stats.push({ label: 'Executed', value: outcome.status === 'success' ? 'Yes' : 'No' });
  }
  stats.push({ label: 'Approval required', value: suite.approvalRequired ? 'Yes' : 'No' });
  stats.push({ label: 'Audit event recorded', value: outcome.status === 'error' ? 'No' : 'Yes' });

  return { label, variant, summary, stats, outcome };
}

/** Real risk classification derived from a tool's own annotations — a destructive tool is always
 * Critical (attempting one is inherently high-stakes regardless of outcome), a mutating but
 * non-destructive tool is High, and a read-only tool is Low unless it actually exposed sensitive
 * data (masked), which bumps it to Medium. Not fabricated per-call — the same tool always gets
 * the same base classification, since it's a property of the tool, not of one specific run. */
function classifyRisk(toolName, { masked = false } = {}) {
  const tool = TOOLS.find((t) => t.name === toolName);
  const a = tool?.annotations || {};
  if (a.destructiveHint) return 'Critical';
  if (a.readOnlyHint) return masked ? 'Medium' : 'Low';
  return 'High';
}

function toolType(toolName) {
  const a = TOOLS.find((t) => t.name === toolName)?.annotations || {};
  if (a.destructiveHint) return 'write-destructive';
  if (a.readOnlyHint) return 'read';
  return 'write';
}

/** A plain "key: value; key: value" rendering of the real args this call sent — our own demo
 * inputs are already synthetic/non-sensitive, so showing them as-is is honest; nothing here
 * pretends to mask something Surf didn't actually mask. */
function summarizeArgs(args) {
  if (!args || typeof args !== 'object' || Object.keys(args).length === 0) return '—';
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/**
 * One real event row per actual tool call a test made — the single source of truth for both the
 * on-screen report and the CSV/PDF/JSON exports, built entirely from what the test itself
 * produced (DEMO_INPUTS for what was sent, computeResult/steps for what happened). A multi-step
 * suite like Risky Action yields one row per step; every other suite yields exactly one.
 */
function buildReportEvents(suite, state, result) {
  if (suite.id === 'risky-action') {
    const steps = state.steps || [];
    return steps.map((s, i) => {
      const success = s.status === 'success';
      return {
        step: i + 1,
        tool: s.tool,
        toolType: toolType(s.tool),
        riskLevel: classifyRisk(s.tool),
        surfAction: 'approval_required',
        userDecision: success ? 'approved' : s.status === 'denied' ? 'denied' : s.status,
        executed: success ? 'Yes' : 'No',
        inputSummary: summarizeArgs(DEMO_INPUTS[s.tool]),
        resultSummary: success
          ? s.tool === 'add_payee'
            ? `${s.result?.name} added (${s.result?.account})`
            : `Transferred ${s.result?.amount} to ${s.result?.to}`
          : s.message || s.error || 'Not executed',
        sensitiveValuesMasked: 0,
        ts: s.ts || state.completedAt,
      };
    });
  }

  const outcome = result?.outcome || { status: state.error ? 'error' : 'success' };
  const isSensitive = suite.id === 'sensitive-data';
  const success = outcome.status === 'success';
  let sensitiveValuesMasked = 0;
  if (isSensitive && success) {
    const record = Array.isArray(state.result) ? state.result[0] : undefined;
    sensitiveValuesMasked = SENSITIVE_FIELDS.filter((f) => isMaskedValue(record?.[f.key])).length;
  }
  return [
    {
      step: 1,
      tool: suite.toolName,
      toolType: toolType(suite.toolName),
      riskLevel: classifyRisk(suite.toolName, { masked: sensitiveValuesMasked > 0 }),
      surfAction:
        outcome.status === 'blocked'
          ? 'blocked'
          : outcome.status === 'denied'
            ? 'approval_required'
            : isSensitive && sensitiveValuesMasked > 0
              ? 'masked'
              : 'allowed',
      userDecision: outcome.status === 'denied' ? 'denied' : suite.approvalRequired ? 'approved' : 'n/a',
      executed: success ? 'Yes' : 'No',
      inputSummary: summarizeArgs(DEMO_INPUTS[suite.toolName]),
      resultSummary: result?.summary || (state.error ? `Error: ${state.error}` : 'No result'),
      sensitiveValuesMasked,
      ts: state.completedAt,
    },
  ];
}

function FieldTable({ record, mode }) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <colgroup>
        <col className="w-20" />
        <col />
      </colgroup>
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-mut">
          <th className="border-b border-line pb-1.5 pr-3 font-medium">Field</th>
          <th className="border-b border-line pb-1.5 font-medium">{mode === 'protected' ? 'Agent receives (after Surf)' : 'Agent receives'}</th>
        </tr>
      </thead>
      <tbody>
        {DISPLAY_FIELDS.map(({ key, label }) => {
          const value = record?.[key];
          const masked = isMaskedValue(value);
          return (
            <tr key={key}>
              <td className="border-b border-line/60 py-1.5 pr-3 align-top text-mut">{label}</td>
              <td className={`border-b border-line/60 py-1.5 align-top font-mono ${mode === 'raw' ? 'text-bad' : masked ? 'text-masked' : 'text-ink'}`}>
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate" title={typeof value === 'string' ? value : undefined}>
                    {value ?? '—'}
                  </span>
                  {mode === 'protected' && masked && <EyeOff size={12} className="shrink-0 text-masked" />}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A tight "label / value" row, used throughout both panels for the enriched-field mockup style. */
function Row({ label, value, valueClassName = 'text-ink' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <span className="text-mut">{label}</span>
      <span className={`text-right font-mono ${valueClassName}`}>{value}</span>
    </div>
  );
}

/** One numbered step in the Risky Action workflow (add_payee → transfer_funds), used by both the
 * baseline preview and the live panel so they stay visually identical apart from the outcome. */
function WorkflowStep({ index, tool, statusLabel, statusVariant, detail }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line text-[10px] font-semibold text-mut">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink">{tool}</span>
          {statusLabel && <Badge variant={statusVariant}>{statusLabel}</Badge>}
        </div>
        {detail && <p className="mt-1 text-xs text-mut">{detail}</p>}
      </div>
    </div>
  );
}

function PanelShell({ tone, header, subtitle, pill, children }) {
  const toneClasses = {
    neutral: 'border-line bg-bg',
    ok: 'border-ok/30 bg-ok-bg/40',
    bad: 'border-bad/30 bg-bad-bg/40',
    hold: 'border-hold/30 bg-hold-bg/40',
  };
  const textClasses = { neutral: 'text-mut', ok: 'text-ok', bad: 'text-bad', hold: 'text-hold' };
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      <div className={`flex items-center justify-between border-b border-line px-4 py-2.5 ${toneClasses[tone]}`}>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${textClasses[tone]}`}>{header}</div>
          <div className="text-[11px] text-mut">{subtitle}</div>
        </div>
        {pill}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BaselinePanel({ suite }) {
  if (suite.id === 'safe-read') {
    return (
      <PanelShell tone="neutral" header="Without Surf (Baseline)" subtitle="Tool executed without protection">
        <Row label="Account" value={SAMPLE_ACCOUNT.account} />
        <Row label="Available balance" value={formatMoney(SAMPLE_ACCOUNT.balance, SAMPLE_ACCOUNT.currency)} />
        <Row label="Currency" value={SAMPLE_ACCOUNT.currency} />
        <Row label="Status" value={SAMPLE_ACCOUNT.status} />
        <Row label="Last updated" value="—" />
      </PanelShell>
    );
  }
  if (suite.id === 'sensitive-data') {
    return (
      <PanelShell tone="bad" header="Without Surf (Baseline)" subtitle="Agent receives unprotected data">
        <FieldTable record={SAMPLE_CUSTOMERS[0]} mode="raw" />
      </PanelShell>
    );
  }
  if (suite.id === 'risky-action') {
    const { name: payeeName, account: payeeAccount } = DEMO_INPUTS.add_payee;
    const { to, amount, description } = DEMO_INPUTS.transfer_funds;
    const newBalance = SAMPLE_ACCOUNT.balance - amount;
    return (
      <PanelShell tone="bad" header="Without Surf (Baseline)" subtitle="Actions executed without confirmation">
        <WorkflowStep index={1} tool="add_payee" statusLabel="Executed" statusVariant="allowed" detail={`${payeeName} added (${payeeAccount})`} />
        <div className="flex justify-center py-1 text-line">
          <ArrowRight size={14} className="rotate-90" />
        </div>
        <WorkflowStep
          index={2}
          tool="transfer_funds"
          statusLabel="Executed"
          statusVariant="allowed"
          detail={`Transferred ${formatMoney(amount, SAMPLE_ACCOUNT.currency)} to ${to} (${description})`}
        />
        <div className="mt-3 border-t border-line pt-3">
          <Row
            label="Balance"
            value={`${formatMoney(SAMPLE_ACCOUNT.balance, SAMPLE_ACCOUNT.currency)} → ${formatMoney(newBalance, SAMPLE_ACCOUNT.currency)}`}
            valueClassName="text-bad font-semibold"
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-bad">
          <AlertTriangle size={12} /> No human confirmation
        </div>
      </PanelShell>
    );
  }
  // policy-block
  const { customer_id } = DEMO_INPUTS.delete_account;
  return (
    <PanelShell tone="bad" header="Without Surf (Baseline)" subtitle="Tool executed without protection">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-line text-mut">
          <Trash2 size={24} />
        </span>
        <div className="font-mono text-sm text-ink">delete_account</div>
        <div className="text-xs text-mut">Account {customer_id} deleted</div>
        <div className="text-xs font-semibold text-bad">Irreversible change made</div>
      </div>
    </PanelShell>
  );
}

function LiveContent({ suite, state, extensionInstalled, protectionEnabled, apiPresent, onRun }) {
  const hasRun = state.result !== undefined || !!state.error;
  const result = computeResult(suite, state);
  // apiPresent means this page's own tool registration actually finished — without it, a click
  // could race a genuinely-installed, genuinely-protected extension against a tool that isn't
  // callable yet, surfacing as a raw "Tool not registered" error or (worse) a half-registered
  // call returning a malformed result.
  const canRun = extensionInstalled && protectionEnabled && apiPresent;

  if (!hasRun) {
    return (
      <>
        <button
          onClick={onRun}
          disabled={!canRun || state.loading}
          className="flex items-center gap-1.5 rounded-lg bg-surf px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {state.loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {state.loading ? (suite.approvalRequired ? 'Waiting for approval…' : 'Running…') : 'Run with Surf'}
        </button>
        {!extensionInstalled && <p className="mt-2 text-xs text-bad">Connect the Surf extension to run this test live.</p>}
        {extensionInstalled && !protectionEnabled && (
          <p className="mt-2 text-xs text-bad">Protection is off for this site — turn it on in the Surf popup.</p>
        )}
        {extensionInstalled && protectionEnabled && !apiPresent && (
          <p className="mt-2 text-xs text-mut">Preparing this test's tools — one moment…</p>
        )}
        {state.loading && suite.approvalRequired && <p className="mt-2 text-xs text-mut">Check the in-page approval prompt to continue.</p>}
        {suite.note && <p className="mt-3 text-xs text-mut">{suite.note}</p>}
      </>
    );
  }

  if (state.error) {
    return <p className="text-sm text-bad">Error: {state.error}</p>;
  }

  if (suite.id === 'sensitive-data') {
    const liveRecord = Array.isArray(state.result) ? state.result[0] : undefined;
    return (
      <>
        <FieldTable record={liveRecord} mode="protected" />
        <button onClick={onRun} className="mt-3 text-xs font-medium text-surf hover:underline">
          Run again
        </button>
      </>
    );
  }

  if (suite.id === 'safe-read') {
    const r = state.result;
    return (
      <>
        <Row label="Account" value={r.account} />
        <Row label="Available balance" value={formatMoney(r.balance, r.currency)} />
        <Row label="Currency" value={r.currency} />
        <Row label="Status" value={r.status} />
        <Row label="Last updated" value={formatTime(r.updatedAt)} />
        <button onClick={onRun} className="mt-3 text-xs font-medium text-surf hover:underline">
          Run again
        </button>
      </>
    );
  }

  // policy-block
  if (result.outcome.status === 'blocked') {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-bad text-bad">
          <Ban size={26} />
        </span>
        <div className="font-mono text-sm text-ink">delete_account</div>
        <div className="text-xs text-mut">blocked before execution</div>
        <div className="text-xs font-semibold text-ok">No execution. No data changed.</div>
      </div>
    );
  }
  const r = state.result;
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-bg text-ok">
        <CheckCircle2 size={26} />
      </span>
      <div className="font-mono text-sm text-ink">delete_account</div>
      <div className="text-xs text-mut">Account {r.customer_id} deleted</div>
      <button onClick={onRun} className="text-xs font-medium text-surf hover:underline">
        Run again
      </button>
    </div>
  );
}

function LivePanel({ suite, state, extensionInstalled, protectionEnabled, apiPresent, onRun }) {
  const hasRun = state.result !== undefined || !!state.error;
  const result = hasRun ? computeResult(suite, state) : null;

  let tone = 'ok';
  let subtitle = 'Live extension test';
  let pill = null;
  if (!hasRun) {
    subtitle = state.loading ? (suite.approvalRequired ? 'Waiting for your decision' : 'Running…') : 'Live extension test';
    if (state.loading && suite.approvalRequired) {
      tone = 'hold';
      pill = <Badge variant="held">Approval required</Badge>;
    } else if (extensionInstalled && !protectionEnabled) {
      tone = 'bad';
      subtitle = 'Protection is off for this site';
      pill = <Badge variant="blocked">Unprotected</Badge>;
    }
  } else if (state.error) {
    tone = 'neutral';
    subtitle = 'Could not run';
  } else {
    tone = result.variant === 'blocked' ? 'bad' : 'ok';
    subtitle =
      result.label === 'BLOCKED'
        ? 'Blocked by Surf policy'
        : result.label === 'DENIED'
          ? 'Denied by Surf policy'
          : suite.id === 'sensitive-data'
            ? 'Sensitive values are masked'
            : suite.id === 'safe-read'
              ? 'Safe read allowed'
              : 'Approved and executed';
  }

  return (
    <PanelShell tone={tone} header="With Surf Protection" subtitle={subtitle} pill={pill}>
      <LiveContent suite={suite} state={state} extensionInstalled={extensionInstalled} protectionEnabled={protectionEnabled} apiPresent={apiPresent} onRun={onRun} />
    </PanelShell>
  );
}

/**
 * Risky Action's live panel — a real 2-step sequence (add_payee → transfer_funds), each step a
 * genuine mc.executeTool() call. There is no Approve/Deny UI drawn here: the real approval prompt
 * is rendered by the extension's own content script overlay elsewhere on the page (see
 * content/policy-bridge.ts) — this page has no channel to fabricate that decision itself, so a
 * pending step just says to check it there and waits on the same promise the extension resolves.
 */
function RiskyActionLive({ state, extensionInstalled, protectionEnabled, apiPresent, onRun }) {
  const steps = state.steps || [];
  const result = computeResult({ id: 'risky-action' }, state);
  const canRun = extensionInstalled && protectionEnabled && apiPresent;
  const transferStep = steps.find((s) => s.tool === 'transfer_funds');

  let tone = 'ok';
  let subtitle = 'Live extension test';
  let pill = null;
  if (!result) {
    subtitle = state.loading ? 'Waiting for your decision' : 'Live extension test';
    if (state.loading) {
      tone = 'hold';
      pill = <Badge variant="held">Approval required</Badge>;
    } else if (extensionInstalled && !protectionEnabled) {
      tone = 'bad';
      subtitle = 'Protection is off for this site';
      pill = <Badge variant="blocked">Unprotected</Badge>;
    }
  } else {
    tone = result.variant === 'blocked' ? 'bad' : result.variant === 'neutral' ? 'neutral' : 'ok';
    subtitle = result.label === 'DENIED' ? 'Denied by Surf policy' : result.label === 'BLOCKED' ? 'Blocked by Surf policy' : 'Approved and executed';
  }

  const stepView = (toolName, i) => {
    const s = steps[i];
    if (!s) return <WorkflowStep key={toolName} index={i + 1} tool={toolName} statusLabel="Not started" statusVariant="neutral" />;
    if (s.status === 'pending') {
      return (
        <WorkflowStep
          key={toolName}
          index={i + 1}
          tool={toolName}
          statusLabel="Approval required"
          statusVariant="held"
          detail="Check the in-page approval prompt to continue."
        />
      );
    }
    if (s.status === 'success') {
      const detail =
        toolName === 'add_payee'
          ? `${s.result?.name} added (${s.result?.account})`
          : `Transferred ${formatMoney(s.result?.amount, SAMPLE_ACCOUNT.currency)} to ${s.result?.to}`;
      return <WorkflowStep key={toolName} index={i + 1} tool={toolName} statusLabel="Approved & executed" statusVariant="allowed" detail={detail} />;
    }
    const label = s.status === 'denied' ? 'Denied' : s.status === 'blocked' ? 'Blocked' : 'Error';
    return <WorkflowStep key={toolName} index={i + 1} tool={toolName} statusLabel={label} statusVariant="blocked" detail={s.message || s.error} />;
  };

  return (
    <PanelShell tone={tone} header="With Surf Protection" subtitle={subtitle} pill={pill}>
      {steps.length === 0 && !state.loading ? (
        <>
          <WorkflowStep index={1} tool="add_payee" />
          <div className="flex justify-center py-1 text-line">
            <ArrowRight size={14} className="rotate-90" />
          </div>
          <WorkflowStep index={2} tool="transfer_funds" />
          <button
            onClick={onRun}
            disabled={!canRun}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-surf px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Play size={14} /> Run with Surf
          </button>
          {!extensionInstalled && <p className="mt-2 text-xs text-bad">Connect the Surf extension to run this test live.</p>}
          {extensionInstalled && !protectionEnabled && (
            <p className="mt-2 text-xs text-bad">Protection is off for this site — turn it on in the Surf popup.</p>
          )}
          {extensionInstalled && protectionEnabled && !apiPresent && (
            <p className="mt-2 text-xs text-mut">Preparing this test's tools — one moment…</p>
          )}
        </>
      ) : (
        <>
          {stepView('add_payee', 0)}
          <div className="flex justify-center py-1 text-line">
            <ArrowRight size={14} className="rotate-90" />
          </div>
          {stepView('transfer_funds', 1)}

          {result && (
            <div className="mt-3 border-t border-line pt-3">
              {transferStep?.status === 'success' ? (
                <Row
                  label="Balance"
                  value={`${formatMoney(transferStep.result.previousBalance, SAMPLE_ACCOUNT.currency)} → ${formatMoney(transferStep.result.newBalance, SAMPLE_ACCOUNT.currency)}`}
                  valueClassName="text-ok font-semibold"
                />
              ) : (
                <p className="text-xs font-semibold text-bad">No funds transferred.</p>
              )}
              <button onClick={onRun} className="mt-3 text-xs font-medium text-surf hover:underline">
                Run again
              </button>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
}

function ResultPanel({ suite, state, onGenerateReport, reportSaved }) {
  const result = computeResult(suite, state);
  if (!result) {
    return (
      <div className="rounded-lg border border-line bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-mut">Result</div>
        <p className="mt-2 text-sm text-mut">Run the test to see what Surf actually did.</p>
      </div>
    );
  }

  const Icon = ICON_BY_VARIANT[result.variant] || AlertTriangle;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-mut">Result</div>
      <div className={`flex items-center gap-2 text-base font-bold ${result.variant === 'blocked' ? 'text-bad' : result.variant === 'masked' ? 'text-masked' : result.variant === 'neutral' ? 'text-mut' : 'text-ok'}`}>
        <Icon size={20} />
        {result.label}
      </div>
      <p className="text-sm text-ink">{result.summary}</p>
      <ul className="space-y-1.5 border-t border-line pt-3 text-xs">
        {result.stats.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="text-mut">{s.label}</span>
            <span className="font-medium text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
        <Link
          href="/audit-trail"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-2 text-xs font-medium text-ink hover:bg-line/40"
        >
          <ScrollText size={13} /> View in Audit Trail
        </Link>
        <button
          onClick={onGenerateReport}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-surf px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={reportSaved}
        >
          <FileBarChart2 size={13} /> {reportSaved ? 'Report saved' : 'Generate Risk Report'}
        </button>
      </div>
    </div>
  );
}

export default function SecurityTestPage() {
  const { status, protectionEnabled } = useExtensionConnection();
  const extensionInstalled = status === 'installed';
  const [apiPresent, setApiPresent] = useState(false);
  const canRunProtected = extensionInstalled && protectionEnabled && apiPresent;
  const [callState, setCallState] = useState({}); // toolName -> { loading, result, error }
  const [selectedId, setSelectedId] = useState(null); // null = grid view
  const [savedReportFor, setSavedReportFor] = useState(null); // toolName last saved, to disable re-save
  const [reports, setReports] = useState([]);

  useEffect(() => {
    setReports(listRiskReports());
  }, [savedReportFor]);

  useEffect(() => {
    // Deliberately no "already ran" ref guard here — the effect is idempotent (registerTool
    // rejections for an already-registered name are caught below), so it's safe for React
    // StrictMode's dev-mode mount→cleanup→remount to run it twice. A guard ref combined with a
    // `cancelled` flag set on cleanup would instead cancel the *only* real attempt on the first
    // synthetic unmount and never register anything in dev.
    let cancelled = false;

    const balanceRef = { current: SAMPLE_ACCOUNT.balance };
    const execByName = {
      get_balance: () => ({ ...SAMPLE_ACCOUNT, balance: balanceRef.current, updatedAt: Date.now() }),
      export_customers: () => SAMPLE_CUSTOMERS,
      add_payee: ({ name, account }) => ({ name, account }),
      transfer_funds: ({ to, amount, description }) => {
        const previousBalance = balanceRef.current;
        balanceRef.current -= Number(amount);
        return { to, amount: Number(amount), description: description || 'Uncategorized transfer', previousBalance, newBalance: balanceRef.current };
      },
      delete_account: ({ customer_id }) => ({ customer_id, deleted: true }),
    };

    // The polyfill script (or the browser's own native modelContext) can still be a beat behind
    // React hydration on a genuinely fresh load — a single synchronous check-and-bail here used
    // to silently register nothing at all if it lost that race, leaving the Run button armed
    // (its own disabled check never looked at apiPresent) against a tool that was never actually
    // registered. Poll briefly instead, the same resilience pattern surfClient.js already uses
    // for the extension ping.
    const getMc = () =>
      (typeof navigator !== 'undefined' && navigator.modelContext) ||
      (typeof document !== 'undefined' && document.modelContext);

    (async () => {
      let mc = getMc();
      for (let attempt = 0; !mc && attempt < 20 && !cancelled; attempt++) {
        await new Promise((r) => setTimeout(r, 150));
        mc = getMc();
      }
      if (!mc || cancelled) return;

      // Each registerTool() call is async and was previously fired without awaiting — under load
      // (or a hot-reload re-running this effect) that let "tool not registered yet" races surface
      // as a real, user-visible error on the very first call. Awaiting them, and tolerating
      // "already registered" specifically (a harmless re-registration attempt), makes apiPresent
      // an honest signal that every tool is actually callable by the time it flips true.
      for (const { name, description, inputSchema, annotations } of TOOLS) {
        try {
          await mc.registerTool({ name, description, inputSchema, annotations, execute: (input) => execByName[name](input) });
        } catch (err) {
          if (!String(err?.message || err).includes('already registered')) throw err;
        }
      }
      if (!cancelled) setApiPresent(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const callTool = async (name) => {
    if (!canRunProtected) return; // button is disabled for this case too — belt and suspenders
    setSavedReportFor(null);
    setCallState((prev) => ({ ...prev, [name]: { loading: true } }));
    try {
      const mc = navigator.modelContext || document.modelContext;
      const tools = await mc.getTools();
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error('Tool not registered.');
      // Real call through modelContext.executeTool — if the Surf extension is installed and
      // guarding this origin, this is the exact call its guard intercepts (block/hold/mask).
      const result = await mc.executeTool(tool, JSON.stringify(DEMO_INPUTS[name]), { caller: 'Security Test' });
      setCallState((prev) => ({ ...prev, [name]: { loading: false, result, completedAt: Date.now() } }));
    } catch (err) {
      setCallState((prev) => ({ ...prev, [name]: { loading: false, error: String(err?.message || err), completedAt: Date.now() } }));
    }
  };

  /**
   * Risky Action's real 2-step sequence: add_payee, then transfer_funds — each a genuine
   * mc.executeTool() call awaited one at a time, so a denial/block on step 1 genuinely stops step
   * 2 from ever being attempted (matching how a dependent workflow should behave), rather than
   * firing both calls and hoping the UI can fake the dependency after the fact.
   */
  const runRiskyActionWorkflow = async () => {
    if (!canRunProtected) return;
    setSavedReportFor(null);
    setCallState((prev) => ({ ...prev, 'risky-action': { loading: true, steps: [] } }));
    let mc;
    let tools;
    try {
      mc = navigator.modelContext || document.modelContext;
      tools = await mc.getTools();
    } catch (err) {
      setCallState((prev) => ({
        ...prev,
        'risky-action': {
          loading: false,
          steps: [{ tool: RISKY_ACTION_TOOLS[0], status: 'error', error: String(err?.message || err), ts: Date.now() }],
          completedAt: Date.now(),
        },
      }));
      return;
    }
    const steps = [];
    for (const toolName of RISKY_ACTION_TOOLS) {
      steps.push({ tool: toolName, status: 'pending' });
      setCallState((prev) => ({ ...prev, 'risky-action': { loading: true, steps: [...steps] } }));
      const tool = tools.find((t) => t.name === toolName);
      try {
        const result = await mc.executeTool(tool, JSON.stringify(DEMO_INPUTS[toolName]), { caller: 'Security Test' });
        const blocked = result && typeof result === 'object' && result.surfBlocked;
        steps[steps.length - 1] = {
          tool: toolName,
          status: blocked ? (result.error === 'DENIED_BY_SURF' ? 'denied' : 'blocked') : 'success',
          result,
          message: blocked ? result.message : undefined,
          ts: Date.now(),
        };
        setCallState((prev) => ({ ...prev, 'risky-action': { loading: true, steps: [...steps] } }));
        if (blocked) break;
      } catch (err) {
        steps[steps.length - 1] = { tool: toolName, status: 'error', error: String(err?.message || err), ts: Date.now() };
        break;
      }
    }
    setCallState((prev) => ({ ...prev, 'risky-action': { loading: false, steps, completedAt: Date.now() } }));
  };

  if (selectedId) {
    const suite = TEST_SUITES.find((s) => s.id === selectedId);
    const style = SUITE_STYLE[suite.id];
    const Icon = style.icon;
    const stateKey = suite.id === 'risky-action' ? 'risky-action' : suite.toolName;
    const state = callState[stateKey] || {};
    const result = computeResult(suite, state);

    const handleGenerateReport = () => {
      if (!result) return;
      saveRiskReport({
        suiteId: suite.id,
        title: `${suite.title} Report`,
        agentTask: suite.agentTask,
        caller: 'Security Test',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        verdictLabel: result.label,
        verdictVariant: result.variant,
        summary: result.summary,
        stats: result.stats,
        events: buildReportEvents(suite, state, result),
      });
      setSavedReportFor(stateKey);
    };

    return (
      <div className="space-y-5 p-6">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm font-medium text-surf hover:underline">
          <ChevronLeft size={16} /> All tests
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`flex items-center gap-2 text-lg font-bold uppercase tracking-wide ${style.title}`}>
            <Icon size={22} />
            {suite.title}
            {result && <Badge variant="allowed">Completed</Badge>}
            {!result && state.loading && <Badge variant="neutral">{suite.approvalRequired ? 'Waiting for approval' : 'Running'}</Badge>}
          </div>
          {result && <div className="text-xs text-mut">{formatTime(state.completedAt || Date.now())}</div>}
        </div>
        <p className="-mt-3 text-sm text-mut">{suite.tagline}</p>

        <div className="rounded-lg border border-line bg-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Agent task</div>
              <p className="mt-1 text-sm italic text-ink">&ldquo;{suite.agentTask}&rdquo;</p>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">{suite.toolNames ? 'Tools' : 'Tool'}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(suite.toolNames || [suite.toolName]).map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BaselinePanel suite={suite} />
            {suite.id === 'risky-action' ? (
              <RiskyActionLive state={state} extensionInstalled={extensionInstalled} protectionEnabled={protectionEnabled} apiPresent={apiPresent} onRun={runRiskyActionWorkflow} />
            ) : (
              <LivePanel
                suite={suite}
                state={state}
                extensionInstalled={extensionInstalled}
                protectionEnabled={protectionEnabled}
                apiPresent={apiPresent}
                onRun={() => callTool(suite.toolName)}
              />
            )}
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:flex">
              <span className="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-[10px] font-semibold text-mut shadow-sm">
                VS
              </span>
            </div>
          </div>
          <ResultPanel suite={suite} state={state} onGenerateReport={handleGenerateReport} reportSaved={savedReportFor === stateKey} />
        </div>

        {!apiPresent && (
          <div className="rounded-lg border border-line bg-card p-4 text-sm text-mut">
            WebMCP polyfill not detected — reload the page to enable tool calls.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-surf">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-ink">Security Test</h1>
          <p className="mt-1 text-sm text-mut">Run focused WebMCP security tests to see how Surf protects what matters.</p>
          <p className="text-sm text-mut">Then inspect results in Live Activity, Audit Trail, and Risk Reports.</p>
        </div>
      </div>

      {!apiPresent && (
        <div className="rounded-lg border border-line bg-card p-4 text-sm text-mut">
          WebMCP polyfill not detected — reload the page to enable tool calls.
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink">Choose a test</h2>
        <p className="mt-0.5 text-xs text-mut">Each test demonstrates a core Surf security capability.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEST_SUITES.map((s) => {
          const style = SUITE_STYLE[s.id];
          const Icon = style.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex flex-col rounded-xl border bg-card p-5 text-left transition-colors ${style.border}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${style.iconWrap}`}>
                <Icon size={22} />
              </div>
              <div className="mt-4">
                <div className={`text-xs font-bold uppercase tracking-wide ${style.title}`}>{s.title}</div>
                <p className="mt-1 text-sm text-mut">{s.tagline}</p>
              </div>
              <div className="mt-3">
                <Badge variant={style.variant}>Test: {s.testLabel}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-mut">{s.toolNames ? 'Example tools' : 'Example tool'}</div>
                  <div className="font-mono text-sm font-semibold text-ink">{(s.toolNames || [s.toolName]).join(', ')}</div>
                </div>
                <ArrowRight size={16} className="text-mut" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-5">
          <div className="text-sm font-semibold text-ink">How Security Test works</div>
          <div className="mt-4">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
                {i < HOW_IT_WORKS_STEPS.length - 1 && <span className="absolute left-4 top-9 h-full w-px bg-line" />}
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surf text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <step.icon size={13} className="text-mut" /> {step.label}
                  </div>
                  <p className="mt-0.5 text-xs text-mut">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card p-5">
          <div className="text-sm font-semibold text-ink">What results show</div>
          <p className="mt-1 text-xs text-mut">Each test resolves to one of four outcomes.</p>
          <div className="mt-4 space-y-1">
            {RESULT_LEGEND.map((r) => (
              <div key={r.label} className="flex items-start gap-3 rounded-lg p-1.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${VARIANT_CLASSES[r.variant]}`}>
                  <r.icon size={15} />
                </span>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wide ${TEXT_CLASSES[r.variant]}`}>{r.label}</div>
                  <p className="text-xs text-mut">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed brand navy-to-blue gradient, not the theme-reactive ink/surf tokens — those flip
            to light colors in dark mode (ink becomes near-white text-on-dark), which would wash
            this card out to near-invisible instead of the intended dark gradient in both themes. */}
        <div className="flex h-fit flex-col self-start rounded-xl bg-gradient-to-br from-[#1a3353] to-[#3e79f7] p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Activity size={20} />
            </div>
            <div className="text-lg font-bold leading-tight">
              Need to see real events?
              <br />
              Open Live Activity
            </div>
          </div>
          <p className="mt-3 text-sm text-white/80">Real-time WebMCP calls captured by the extension, across every protected tab.</p>
          <Link
            href="/live-activity"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#1a3353] hover:opacity-90"
          >
            Go to Live Activity <ArrowRight size={14} />
          </Link>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/80">
            <span className={`h-2 w-2 rounded-full ${extensionInstalled ? 'bg-ok' : 'bg-white/40'}`} />
            {extensionInstalled ? 'Live monitoring is active' : 'Live monitoring requires the Surf extension'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Recent reports</div>
            <p className="mt-0.5 text-xs text-mut">Your latest test reports and findings.</p>
          </div>
          <Link href="/risk-reports" className="flex items-center gap-1 text-xs font-medium text-surf hover:underline">
            View all reports <ArrowRight size={12} />
          </Link>
        </div>

        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-mut">No reports yet — run a test above and generate one.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {latestPerSuite(reports, 4).map((r) => {
              const suite = TEST_SUITES.find((s) => s.id === r.suiteId);
              return (
                <Link
                  key={r.id}
                  href="/risk-reports"
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg p-3 hover:bg-line/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-line/60 text-mut">
                      <FileBarChart2 size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{r.title}</span>
                        {suite && <Badge variant="neutral">{suite.testLabel}</Badge>}
                      </div>
                      <div className="text-xs text-mut">{formatDateTime(r.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="allowed">Completed</Badge>
                    <ChevronRight size={16} className="text-mut" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
