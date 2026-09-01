'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

/**
 * One generic table for both Live Activity (real data, "load more" reveal) and Audit Trail
 * (sample data, numbered pagination) — sort/filter/search/pagination all client-side, which is
 * fine at today's data volumes (the extension caps its in-memory log at 300 entries; revisit if
 * Phase 2's real persisted history grows large — see the redesign plan).
 */
export default function DataTable({
  columns,
  rows,
  searchQuery = '',
  searchKeys,
  filterFn,
  pageSize = 10,
  initialSort = null,
  pagination = 'numbered', // 'numbered' | 'loadMore' | 'none'
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const [revealCount, setRevealCount] = useState(pageSize);

  const filtered = useMemo(() => {
    let r = rows;
    if (filterFn) r = r.filter(filterFn);
    if (searchQuery && searchKeys?.length) {
      const q = searchQuery.toLowerCase();
      r = r.filter((row) => searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)));
    }
    return r;
  }, [rows, filterFn, searchQuery, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  useEffect(() => setPage(0), [searchQuery, filterFn]);
  useEffect(() => setRevealCount(pageSize), [searchQuery, filterFn]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);

  const visibleRows =
    pagination === 'numbered'
      ? sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)
      : pagination === 'loadMore'
      ? sorted.slice(0, revealCount)
      : sorted;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-left text-[11px] uppercase tracking-wide text-mut">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx('whitespace-nowrap px-4 py-3 font-medium', col.sortable && 'cursor-pointer select-none')}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sort?.key === col.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-mut">
                  No results.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => (
                <tr key={row.id ?? i} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 align-top">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination === 'numbered' && totalPages > 1 && (
        <div className="mt-2 flex items-center justify-between text-xs text-mut">
          <span>
            Showing {clampedPage * pageSize + 1}-{Math.min(sorted.length, (clampedPage + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={clsx('rounded px-2 py-1', i === clampedPage ? 'bg-surf text-white' : 'hover:bg-bg')}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {pagination === 'loadMore' && revealCount < sorted.length && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setRevealCount((c) => c + pageSize)}
            className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
          >
            Load more events
          </button>
        </div>
      )}
    </div>
  );
}
