'use client';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../lib/theme';

const CYCLE = ['light', 'dark', 'system'];
const ICON = { light: Sun, dark: Moon, system: Monitor };
const LABEL = { light: 'Light theme — click for dark', dark: 'Dark theme — click to match system', system: 'Matching system theme — click for light' };

// Compact single-icon control for the sidebar footer (matches the mockup's corner icon) — cycles
// light -> dark -> system -> light on click, rather than the 3-button row a dedicated Settings
// page would use. Same underlying useTheme()/ThemeProvider as before, just a different control.
export default function ThemeToggleIcon() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme] || Monitor;

  const cycle = () => {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      title={LABEL[theme] || 'Theme'}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
    >
      <Icon size={20} />
    </button>
  );
}
