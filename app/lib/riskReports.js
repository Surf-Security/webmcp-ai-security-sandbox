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

/** report: { suiteId, title, verdictLabel, verdictVariant, summary, stats: [{label, value}] } */
export function saveRiskReport(report) {
  const entry = { id: crypto.randomUUID(), createdAt: Date.now(), ...report };
  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteRiskReport(id) {
  writeAll(readAll().filter((r) => r.id !== id));
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
    verdictLabel: `${included.length} TEST${included.length === 1 ? '' : 'S'}`,
    verdictVariant: 'neutral',
    summary: `Combines the latest result from ${included.length} test${included.length === 1 ? '' : 's'}: ${included.map((r) => r.title).join(', ')}.`,
    stats: included.map((r) => ({ label: r.title, value: r.verdictLabel })),
  });
}
