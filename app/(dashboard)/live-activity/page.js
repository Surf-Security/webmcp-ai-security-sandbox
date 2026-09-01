'use client';
import { useMemo, useState } from 'react';
import { Radio } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import FilterChips from '../../components/ui/FilterChips';
import SearchInput from '../../components/ui/SearchInput';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import ExpandableDetail from '../../components/ui/ExpandableDetail';
import { useExtensionConnection } from '../../lib/useExtensionConnection';
import { useTopBarActions } from '../../lib/topBarSlot';
import { describeVerdict } from '../../lib/verdict';
import { formatRelativeTime } from '../../lib/formatRelativeTime';

// No "Held" filter — the real extension only ever logs a call's final resolution, never the
// in-between "awaiting approval" moment, so that state can never have real data (see lib/verdict.js).
const FILTERS = [
  { key: 'all', label: 'All Events' },
  { key: 'allowed', label: 'Allowed', variant: 'allowed' },
  { key: 'blocked', label: 'Blocked', variant: 'blocked' },
  { key: 'masked', label: 'Masked', variant: 'masked' },
];

export default function LiveActivityPage() {
  const { status, entries } = useExtensionConnection();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useTopBarActions({ subtitle: 'Streaming live events' });

  const rows = useMemo(
    () =>
      entries.map((e) => {
        let domain = e.tabTitle || String(e.tabId);
        let path = '';
        try {
          if (e.tabUrl) {
            const u = new URL(e.tabUrl);
            domain = u.hostname;
            path = u.pathname !== '/' ? u.pathname : '';
          }
        } catch {
          // tabUrl missing/invalid — fall back to the plain title/id above
        }
        return { ...e, domain, path, domainTab: path ? `${domain}${path}` : domain, verdictInfo: describeVerdict(e) };
      }),
    [entries],
  );

  const columns = [
    { key: 'ts', label: 'Time', sortable: true, render: (r) => <span className="whitespace-nowrap font-mono text-xs text-mut">{formatRelativeTime(r.ts)}</span> },
    { key: 'toolName', label: 'Tool', sortable: true, render: (r) => <span className="font-mono text-sm text-ink">{r.toolName}</span> },
    {
      key: 'domainTab',
      label: 'Domain / Tab',
      render: (r) => (
        <div>
          <div className="text-sm text-ink">{r.domain}</div>
          {r.path && <div className="text-xs text-mut">{r.path}</div>}
        </div>
      ),
    },
    { key: 'caller', label: 'Agent', render: (r) => <span className="text-sm text-ink">{r.caller}</span> },
    { key: 'verdict', label: 'Decision', render: (r) => <Badge variant={r.verdictInfo.variant}>{r.verdictInfo.label}</Badge> },
    { key: 'detail', label: 'Details', render: (r) => <ExpandableDetail value={r.detail} className="text-sm text-mut" /> },
  ];

  const filterFn = (row) => filter === 'all' || row.verdictInfo.variant === filter;
  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? rows.length : rows.filter((r) => r.verdictInfo.variant === f.key).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink">
            Live Activity
            {status === 'installed' && <Radio size={14} className="animate-pulse text-ok" />}
          </h1>
          <p className="mt-1 text-sm text-mut">Real-time view of WebMCP tool calls across protected tabs.</p>
        </div>
      </div>

      {status === 'installed' && entries.length === 0 && (
        <EmptyState
          icon={Radio}
          title="No activity yet"
          body="Call a WebMCP tool on a protected tab — events will stream in here in real time."
        />
      )}

      {status === 'installed' && entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} active={filter} onChange={setFilter} />
            <SearchInput value={query} onChange={setQuery} placeholder="Search tools, domains, agents…" />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            searchQuery={query}
            searchKeys={['toolName', 'domainTab', 'caller']}
            filterFn={filterFn}
            pageSize={10}
            initialSort={{ key: 'ts', dir: 'desc' }}
            pagination="loadMore"
          />
        </>
      )}
    </div>
  );
}
