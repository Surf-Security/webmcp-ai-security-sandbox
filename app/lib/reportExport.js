import { formatDateTime } from './formatDate';

const CSV_COLUMNS = [
  ['report_id', (r, e) => r.reportId],
  ['test_suite', (r, e) => r.title.replace(/ Report$/, '')],
  ['agent_task', (r, e) => r.agentTask || ''],
  ['step', (r, e) => e.step],
  ['tool', (r, e) => e.tool],
  ['tool_type', (r, e) => e.toolType],
  ['risk_level', (r, e) => e.riskLevel],
  ['surf_action', (r, e) => e.surfAction],
  ['user_decision', (r, e) => e.userDecision],
  ['executed', (r, e) => e.executed],
  ['input_summary', (r, e) => e.inputSummary],
  ['result_summary', (r, e) => e.resultSummary],
  ['sensitive_values_masked', (r, e) => e.sensitiveValuesMasked],
  ['caller', (r, e) => r.caller || ''],
  ['origin', (r, e) => r.origin || ''],
  ['event_time', (r, e) => new Date(e.ts || r.createdAt).toISOString()],
];

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A machine-readable, event-level export — one row per real tool call the test made, not a
 * one-row copy of the report's summary. This is the file a security/compliance reviewer would
 * actually load into a spreadsheet, so every column is something we genuinely captured (or
 * derived from the tool's own annotations), never invented to fill the column.
 */
export function reportToCsv(report) {
  const header = CSV_COLUMNS.map(([name]) => name).join(',');
  const events = report.events && report.events.length > 0 ? report.events : [];
  const body = events.map((e) => CSV_COLUMNS.map(([, get]) => csvField(get(report, e))).join(',')).join('\n');
  return `${header}\n${body}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const RISK_COLOR = { Critical: '#ff525a', High: '#b4790a', Medium: '#2f6fed', Low: '#21b573' };

/**
 * Opens a clean, print-ready document in a new tab and triggers the browser's print dialog —
 * "Save as PDF" in that dialog is a real PDF, produced by the browser itself, not a fabricated
 * file. This avoids adding a PDF-generation dependency for what the browser already does well.
 */
export function exportReportAsPdf(report) {
  const events = report.events || [];
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = events
    .map(
      (e) => `
    <tr>
      <td>${e.step}</td>
      <td><code>${escapeHtml(e.tool)}</code></td>
      <td><span class="risk" style="color:${RISK_COLOR[e.riskLevel] || '#72849a'}">${escapeHtml(e.riskLevel)}</span></td>
      <td>${escapeHtml(e.surfAction.replace(/_/g, ' '))}</td>
      <td>${escapeHtml(e.userDecision)}</td>
      <td>${e.executed}</td>
      <td>${escapeHtml(e.resultSummary)}</td>
    </tr>`,
    )
    .join('');

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(report.reportId)} — ${escapeHtml(report.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a3353; margin: 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #72849a; font-size: 13px; margin-bottom: 4px; }
  .task { font-style: italic; margin: 16px 0; font-size: 14px; }
  .verdict { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 13px; margin: 8px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e6ebf1; }
  th { text-transform: uppercase; font-size: 11px; color: #72849a; letter-spacing: 0.03em; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .risk { font-weight: 600; }
  .footer { margin-top: 24px; font-size: 11px; color: #72849a; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="meta">${escapeHtml(report.reportId)} &middot; Generated ${escapeHtml(formatDateTime(report.createdAt))}</div>
  ${report.agentTask ? `<div class="task">"${escapeHtml(report.agentTask)}"</div>` : ''}
  <div class="verdict" style="background:#f4f7fc">${escapeHtml(report.verdictLabel)}</div>
  <p>${escapeHtml(report.summary)}</p>
  <table>
    <thead><tr><th>Step</th><th>Tool</th><th>Risk</th><th>Surf action</th><th>Decision</th><th>Executed</th><th>Result</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
}
