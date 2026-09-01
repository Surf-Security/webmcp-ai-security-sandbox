'use client';
import Link from 'next/link';
import clsx from 'clsx';

// The sidebar is a fixed dark navy panel in BOTH light and dark app themes (matches both mockup
// sheets exactly — only the main content area responds to the theme toggle), so nav items use a
// hardcoded slate/navy palette rather than the theme-reactive --ink/--bg tokens.
export default function NavItem({ href, icon: Icon, label, active }) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-blue-500/20 text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
      )}
    >
      <Icon size={20} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
