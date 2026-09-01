'use client';
import { useEffect, useState } from 'react';
import { FileBarChart2, Layers } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { listRiskReports, generateCombinedReport } from '../../lib/riskReports';

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
                    <div className="text-sm font-semibold text-ink">{r.title}</div>
                    <div className="mt-0.5 text-xs text-mut">{formatDate(r.createdAt)}</div>
                    <p className="mt-2 text-sm text-ink">{r.summary}</p>
                  </div>
                  <Badge variant={r.verdictVariant}>{r.verdictLabel}</Badge>
                </div>

                {expanded && (
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
                    {r.stats.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="text-mut">{s.label}</span>
                        <span className="font-medium text-ink">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    {expanded ? 'Hide details' : 'View'}
                  </button>
                  <button
                    onClick={() => downloadJson(`${r.suiteId}-report-${r.id}.json`, r)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg"
                  >
                    Export
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
