/**
 * Risk Reports are real, just not server-backed — "Generate Risk Report" on a completed Security
 * Test snapshots that call's actual outcome (the exact same fields the Test Result panel just
 * showed) into localStorage. That means a report only ever exists because a real mc.executeTool()
 * call happened and resolved; nothing here is fabricated to make the Risk Reports page look
 * populated. Being localStorage-backed (not a database) is an honest limitation worth stating
 * plainly wherever reports are shown: they live in this browser only.
 */
import { safeGetJSON, safeSetJSON } from './safeStorage';

const STORAGE_KEY = 'surf-risk-reports';
const MAX_REPORTS = 50;

function readAll() {
  if (typeof window === 'undefined') return [];
  const parsed = safeGetJSON(STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAll(reports) {
  safeSetJSON(STORAGE_KEY, reports.slice(0, MAX_REPORTS));
}

export function listRiskReports() {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

function nextReportId(createdAt) {
  const d = new Date(createdAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `RPT-${yyyy}${mm}${dd}-${suffix}`;
}

/**
 * report: { suiteId, title, agentTask, caller, origin, verdictLabel, verdictVariant, summary,
 * stats: [{label, value}], events: [{step, tool, toolType, riskLevel, surfAction, userDecision,
 * executed, inputSummary, resultSummary, sensitiveValuesMasked, ts}] } — events is the real,
 * per-tool-call breakdown that both the report view and the CSV/PDF exports render from.
 */
export function saveRiskReport(report) {
  const createdAt = Date.now();
  const entry = { id: crypto.randomUUID(), reportId: nextReportId(createdAt), createdAt, ...report };
  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteRiskReport(id) {
  writeAll(readAll().filter((r) => r.id !== id));
}

/**
 * Reports saved before the per-event schema existed have no `events` array at all — combining
 * them shouldn't just silently drop them from the table. Falls back to one row built from that
 * report's own already-stored summary fields (real data it genuinely has), rather than either
 * fabricating fake step detail or making the report vanish from the combined view entirely.
 */
function eventsForReport(r) {
  if (r.events && r.events.length > 0) return r.events;
  return [
    {
      step: 1,
      tool: r.suiteId,
      toolType: '—',
      riskLevel: '—',
      surfAction: '—',
      userDecision: '—',
      executed: '—',
      inputSummary: '—',
      // Explains the dashes above rather than leaving them unexplained — this row exists because
      // an older report predates per-step tracking, not because nothing happened.
      resultSummary: `${r.summary || r.verdictLabel || 'No summary recorded'} (saved before per-step detail was tracked — re-run and regenerate "${r.title}" for full detail)`,
      sensitiveValuesMasked: 0,
      ts: r.createdAt,
    },
  ];
}

/**
 * A "combined" report is a real aggregate over whatever individual reports already exist in this
 * browser — counts and a merged stat list, not new numbers invented for the occasion. Returns
 * null if there's nothing to combine yet.
 */
export function generateCombinedReport() {
  const reports = listRiskReports().filter((r) => r.suiteId !== 'combined');
  if (reports.length === 0) return null;
  const bySuite = new Map();
  for (const r of reports) if (!bySuite.has(r.suiteId)) bySuite.set(r.suiteId, r);
  const included = [...bySuite.values()];
  return saveRiskReport({
    suiteId: 'combined',
    title: 'Combined Security Report',
    caller: 'Security Test',
    origin: included[0]?.origin || '',
    verdictLabel: `${included.length} TEST${included.length === 1 ? '' : 'S'}`,
    verdictVariant: 'neutral',
    summary: `Combines the latest result from ${included.length} test${included.length === 1 ? '' : 's'}: ${included.map((r) => r.title).join(', ')}.`,
    stats: included.map((r) => ({ label: r.title, value: r.verdictLabel })),
    // Each source report's own events, real numbering re-sequenced across the whole combined set
    // (rather than restarting at 1 per suite) so the exported CSV reads as one continuous log.
    events: included.flatMap((r) => eventsForReport(r)).map((e, i) => ({ ...e, step: i + 1 })),
  });
}
