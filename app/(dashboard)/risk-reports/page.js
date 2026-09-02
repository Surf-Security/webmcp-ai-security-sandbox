'use client';
import { useEffect, useState } from 'react';
import { FileBarChart2, Layers, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { listRiskReports, generateCombinedReport } from '../../lib/riskReports';
import { formatDateTime } from '../../lib/formatDate';
import { downloadFile } from '../../lib/download';
import { reportToCsv, exportReportAsPdf } from '../../lib/reportExport';

const RISK_TEXT_CLASS = { Critical: 'text-bad', High: 'text-hold', Medium: 'text-masked', Low: 'text-ok' };

function EventTable({ events }) {
  if (!events || events.length === 0) {
    return <p className="mt-3 border-t border-line pt-3 text-xs text-mut">No per-step event data was captured for this report.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto border-t border-line pt-3">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="text-mut">
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Step</th>
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Tool</th>
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Risk</th>
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Surf action</th>
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Decision</th>
            <th className="pb-1.5 pr-3 font-medium uppercase tracking-wide">Executed</th>
            <th className="pb-1.5 font-medium uppercase tracking-wide">Result</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.step} className="border-t border-line/60">
              <td className="py-1.5 pr-3 align-top text-mut">{e.step}</td>
              <td className="py-1.5 pr-3 align-top font-mono text-ink">{e.tool}</td>
              <td className={`py-1.5 pr-3 align-top font-semibold ${RISK_TEXT_CLASS[e.riskLevel] || 'text-mut'}`}>{e.riskLevel}</td>
              <td className="py-1.5 pr-3 align-top text-ink">{e.surfAction.replace(/_/g, ' ')}</td>
              <td className="py-1.5 pr-3 align-top text-ink">{e.userDecision}</td>
              <td className="py-1.5 pr-3 align-top text-ink">{e.executed}</td>
              <td className="py-1.5 align-top text-mut">{e.resultSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskReportsPage() {
  const [reports, setReports] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setReports(listRiskReports());
  }, []);

  const handleCombine = () => {
    generateCombinedReport();
    setReports(listRiskReports());
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Risk Reports</h1>
          <p className="mt-1 text-sm text-mut">
            Security reports generated from your WebMCP tests — saved in this browser only.
          </p>
        </div>
        <button
          onClick={handleCombine}
          disabled={reports.filter((r) => r.suiteId !== 'combined').length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50"
        >
          <Layers size={14} /> Generate combined report
        </button>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileBarChart2}
          title="No reports yet"
          body='Run a test on the Security Test page and click "Generate Risk Report" to save one here.'
        />
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-mut">Recent reports</div>
          {reports.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-line bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{r.title}</span>
                      <span className="font-mono text-[11px] text-mut">{r.reportId}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-mut">{formatDateTime(r.createdAt)}</div>
                    {r.agentTask && <p className="mt-2 text-xs italic text-mut">&ldquo;{r.agentTask}&rdquo;</p>}
                    <p className="mt-1 text-sm text-ink">{r.summary}</p>
                  </div>
                  <Badge variant={r.verdictVariant}>{r.verdictLabel}</Badge>
                </div>

                {expanded && <EventTable events={r.events} />}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    {expanded ? 'Hide details' : 'View'}
                  </button>
                  <button
                    onClick={() => downloadFile(`${r.reportId}.csv`, reportToCsv(r), 'text/csv')}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    <FileSpreadsheet size={13} /> Export CSV
                  </button>
                  <button
                    onClick={() => exportReportAsPdf(r)}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    <FileText size={13} /> Export PDF
                  </button>
                  <button
                    onClick={() => downloadFile(`${r.reportId}.json`, JSON.stringify(r, null, 2), 'application/json')}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    <FileJson size={13} /> Export JSON
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
