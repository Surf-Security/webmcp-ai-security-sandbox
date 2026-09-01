'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, RefreshCw, Download } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import SearchInput from '../../components/ui/SearchInput';
import Dropdown from '../../components/ui/Dropdown';
import DateRangePicker from '../../components/ui/DateRangePicker';
import StatTileGroup from '../../components/ui/StatTileGroup';
import EmptyState from '../../components/ui/EmptyState';
import ExportAuditModal from '../../components/domain/ExportAuditModal';
import ExpandableDetail from '../../components/ui/ExpandableDetail';
import { describeVerdict, riskBadgeVariant, inferRiskLevel } from '../../lib/verdict';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { useExtensionConnection } from '../../lib/useExtensionConnection';
import { useTopBarActions } from '../../lib/topBarSlot';
import { getAuditHistory } from '../../surfClient';

const RETENTION_DAYS = 7;

function toDateInputValue(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export default function AuditTrailPage() {
  const { status, extensionId } = useExtensionConnection();
  const [query, setQuery] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);

  useTopBarActions({ subtitle: 'Events captured', actionLabel: 'Export', actionIcon: Download, onAction: () => setExportOpen(true) });

  const [range, setRange] = useState(() => {
    const to = Date.now();
    const from = to - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return { from: toDateInputValue(from), to: toDateInputValue(to) };
  });

  const [loadState, setLoadState] = useState('idle'); // idle | loading | error | ready
  const [entries, setEntries] = useState([]);

  const fetchHistory = useCallback(async () => {
    setLoadState('loading');
    const fromTs = new Date(range.from + 'T00:00:00').getTime();
    const toTs = new Date(range.to + 'T23:59:59.999').getTime();
    const res = await getAuditHistory({ from: fromTs, to: toTs }, extensionId || undefined);
    if (!res.ok) {
      setLoadState('error');
      return;
    }
    setEntries(res.data);
    setLoadState('ready');
  }, [range, extensionId]);

  useEffect(() => {
    if (status === 'installed') fetchHistory();
  }, [status, fetchHistory]);

  const rows = useMemo(
    () =>
      entries.map((e) => {
        const verdictInfo = describeVerdict(e);
        return {
          ...e,
          domainTab: e.tabTitle || e.tabUrl || String(e.tabId),
          verdictInfo,
          decision: verdictInfo.label,
          risk: inferRiskLevel(e),
        };
      }),
    [entries],
  );

  const tabOptions = ['all', ...new Set(rows.map((r) => r.domainTab))];
  const agentOptions = ['all', ...new Set(rows.map((r) => r.caller))];
  const decisionOptions = ['all', 'allowed', 'blocked', 'masked'];

  const filterFn = (r) =>
    (tabFilter === 'all' || r.domainTab === tabFilter) &&
    (decisionFilter === 'all' || r.verdictInfo.variant === decisionFilter) &&
    (agentFilter === 'all' || r.caller === agentFilter);

  const columns = [
    { key: 'ts', label: 'Time', sortable: true, render: (r) => <span className="whitespace-nowrap font-mono text-xs text-mut">{formatRelativeTime(r.ts)}</span> },
    { key: 'domainTab', label: 'Domain / Tab', render: (r) => <span className="text-xs text-mut">{r.domainTab}</span> },
    { key: 'toolName', label: 'Tool', sortable: true, render: (r) => <span className="font-mono text-xs text-ink">{r.toolName}</span> },
    { key: 'caller', label: 'Agent', render: (r) => <span className="text-xs text-ink">{r.caller}</span> },
    { key: 'verdict', label: 'Decision', render: (r) => <Badge variant={r.verdictInfo.variant}>{r.verdictInfo.label}</Badge> },
    { key: 'risk', label: 'Risk', sortable: true, render: (r) => <Badge variant={riskBadgeVariant(r.risk)}>{r.risk}</Badge> },
    { key: 'detail', label: 'Details', render: (r) => <ExpandableDetail value={r.detail} /> },
  ];

  const summary = {
    total: rows.length,
    blocked: rows.filter((r) => r.verdictInfo.variant === 'blocked').length,
    masked: rows.filter((r) => r.verdictInfo.variant === 'masked').length,
    allowed: rows.filter((r) => r.verdictInfo.variant === 'allowed').length,
  };

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Audit Trail</h1>
        <p className="mt-1 text-sm text-mut">
          Complete audit log of WebMCP tool activity — retained for {RETENTION_DAYS} days.
        </p>
      </div>

      {status === 'installed' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
            <Dropdown label="Tab" value={tabFilter} onChange={setTabFilter} options={tabOptions.map((t) => ({ value: t, label: t === 'all' ? 'All Tabs' : t }))} />
            <Dropdown
              label="Decision"
              value={decisionFilter}
              onChange={setDecisionFilter}
              options={decisionOptions.map((d) => ({ value: d, label: d === 'all' ? 'All Decisions' : d[0].toUpperCase() + d.slice(1) }))}
            />
            <Dropdown label="Agent" value={agentFilter} onChange={setAgentFilter} options={agentOptions.map((a) => ({ value: a, label: a === 'all' ? 'All Agents' : a }))} />
            <SearchInput value={query} onChange={setQuery} placeholder="Search tools, domains, agents…" />
            <button
              onClick={fetchHistory}
              title="Refresh"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink hover:bg-bg"
            >
              <RefreshCw size={14} className={loadState === 'loading' ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadState === 'error' && (
            <EmptyState icon={ScrollText} title="Couldn't load audit history" body="The extension didn't respond. Try refreshing." />
          )}

          {loadState === 'ready' && rows.length === 0 && (
            <EmptyState icon={ScrollText} title="No activity in this range" body="Try widening the date range, or generate some activity from the Security Test page." />
          )}

          {loadState === 'ready' && rows.length > 0 && (
            <>
              <StatTileGroup
                tiles={[
                  { value: summary.total, label: 'Total events' },
                  { value: summary.blocked, label: 'Blocked / Denied' },
                  { value: summary.masked, label: 'Masked' },
                  { value: summary.allowed, label: 'Allowed clean' },
                ]}
              />
              <DataTable
                columns={columns}
                rows={rows}
                searchQuery={query}
                searchKeys={['toolName', 'domainTab', 'caller']}
                filterFn={filterFn}
                pageSize={10}
                initialSort={{ key: 'ts', dir: 'desc' }}
                pagination="numbered"
              />
            </>
          )}
        </>
      )}

      <ExportAuditModal open={exportOpen} onClose={() => setExportOpen(false)} rows={rows} />
    </div>
  );
}
