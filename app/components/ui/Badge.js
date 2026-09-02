import clsx from 'clsx';

// The direct successor to globals.css's .tag/.t-ok/.t-bad/.t-hold — adds the 'masked' (blue)
// variant that system lacked. Uses the same token-driven colors so it stays correct across
// light/dark automatically (see globals.css's [data-surf-shell] cascade).
// Exported so other components needing the same verdict colors (FilterChips) share one mapping
// instead of duplicating it.
export const VARIANT_CLASSES = {
  allowed: 'bg-ok-bg text-ok',
  held: 'bg-hold-bg text-hold',
  blocked: 'bg-bad-bg text-bad',
  masked: 'bg-masked-bg text-masked',
  neutral: 'bg-line text-mut',
};

// Text-only half of VARIANT_CLASSES, for callers (e.g. the "What results show" legend) that need
// just the verdict color on its own — an explicit map instead of splitting VARIANT_CLASSES'
// strings apart, which would silently break if a bg-*/text-* pair were ever reordered or a class
// were added to one entry but not the others.
export const TEXT_CLASSES = {
  allowed: 'text-ok',
  held: 'text-hold',
  blocked: 'text-bad',
  masked: 'text-masked',
  neutral: 'text-mut',
};

export default function Badge({ variant = 'neutral', children, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
