import clsx from 'clsx';
import { VARIANT_CLASSES } from './Badge';

// Solid fill for the currently-selected chip — Badge's VARIANT_CLASSES (light tint + colored
// text) is what an unselected chip uses directly, already readable on its own. Dimming that
// further with opacity for the "inactive" state (an earlier version of this file) double-fades
// an already-subtle color and reads as washed out / illegible, not just "less emphasized".
const SOLID_CLASSES = {
  allowed: 'bg-ok text-white',
  held: 'bg-hold text-white',
  blocked: 'bg-bad text-white',
  masked: 'bg-masked text-white',
  neutral: 'bg-surf text-white',
};

// Each option can carry a `variant` (Badge's allowed/held/blocked/masked/neutral keys) so the
// chip is colored by what it means, not just a single generic "active" blue — e.g. "Blocked"
// reads red-tinted whether or not it's the current filter, matching the reference.
export default function FilterChips({ options, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = active === opt.key;
        const variant = opt.variant || 'neutral';
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              isActive ? SOLID_CLASSES[variant] : VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral,
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && <span className="ml-1.5 opacity-80">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
