/** Absolute local date/time, e.g. "Sep 1, 2026, 10:32 PM". */
export function formatDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Same, without the year — for contexts (like a just-run test) where "today" is already implied. */
export function formatTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
