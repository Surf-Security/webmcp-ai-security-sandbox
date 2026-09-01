export default function StatTile({ value, label }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3 text-center">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-mut">{label}</div>
    </div>
  );
}
