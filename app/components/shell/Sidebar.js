'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical, Activity, ScrollText, FileBarChart2, PanelLeftClose, PanelLeftOpen, ArrowRight, ShieldCheck } from 'lucide-react';
import NavItem from './NavItem';
import SidebarFooter from './SidebarFooter';

// Policies was removed for now — it was a fully fake page (sample data, no onClick-backed
// persistence) with no real extension API to back it yet. Re-add once shared/policy.ts gets
// external read/write messages (see the redesign plan's Phase 2 notes).
// No Settings/About nav items — not in the reference mockup, which puts theme control in the
// footer instead (see SidebarFooter/ThemeToggleIcon).
const NAV_ITEMS = [
  { href: '/security-test', label: 'Security Test', icon: FlaskConical },
  { href: '/live-activity', label: 'Live Activity', icon: Activity },
  { href: '/audit-trail', label: 'Audit Trail', icon: ScrollText },
  { href: '/risk-reports', label: 'Risk Reports', icon: FileBarChart2 },
];

export default function Sidebar({ collapsed, onToggleCollapse, connection }) {
  const pathname = usePathname();

  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-[#0e1b2e] py-4">
        <button
          onClick={onToggleCollapse}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={22} />
        </button>
        <div className="mt-2 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <CollapsedNavLink
              key={item.href}
              href={item.href}
              active={pathname === item.href}
              icon={item.icon}
            />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-r border-white/10 bg-[#0e1b2e] p-4">
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <img src="/surf-mark.svg" alt="" className="h-10 w-10" />
          <div>
            <div className="whitespace-nowrap text-base font-semibold leading-tight text-white">Surf Agent Control</div>
            <div className="text-xs leading-tight text-slate-500">Powered by Surf Security</div>
          </div>
        </div>
        <button
          onClick={onToggleCollapse}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="shrink-0 text-blue-300" />
            <div className="text-sm font-semibold text-white">Protect your organization</div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Bring Surf&apos;s agent security controls across your organization.</p>
          <a
            href="https://www.surf.security/contactus"
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-surf px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Start Surf Security Trial <ArrowRight size={13} />
          </a>
        </div>

        <SidebarFooter version={connection.version} />
      </div>
    </aside>
  );
}

// Minimal icon-only link used only in the collapsed rail — kept local since it's a tiny variant
// of NavItem, not worth a shared prop-driven mode on the full-width component.
function CollapsedNavLink({ href, icon: Icon, active }) {
  return (
    <Link
      href={href}
      className={
        'flex items-center justify-center rounded-lg p-2 ' +
        (active ? 'bg-blue-500/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100')
      }
    >
      <Icon size={20} />
    </Link>
  );
}
