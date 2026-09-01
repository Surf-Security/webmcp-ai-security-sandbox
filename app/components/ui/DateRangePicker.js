export default function DateRangePicker({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-surf focus:outline-none"
      />
      <span className="text-mut">–</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-surf focus:outline-none"
      />
    </div>
  );
}
