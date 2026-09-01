import ThemeToggleIcon from '../ui/ThemeToggleIcon';

// Shows the real installed extension's version (from its manifest, via SURF_PING — see
// useExtensionConnection) rather than this sandbox app's own package.json version, since what
// matters here is which Surf build is actually running. Blank until connected, not "0.1.0" —
// showing a version for software that isn't confirmed installed would be a guess, not a fact.
export default function SidebarFooter({ version }) {
  return (
    <div className="flex items-center justify-between border-t border-white/10 px-1 pt-3 text-xs text-slate-500">
      <span>{version ? `v${version}` : '—'}</span>
      <ThemeToggleIcon />
    </div>
  );
}
