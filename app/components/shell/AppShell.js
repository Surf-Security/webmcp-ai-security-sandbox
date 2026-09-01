'use client';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopStatusBar from './TopStatusBar';
import { useExtensionConnection } from '../../lib/useExtensionConnection';

const COLLAPSED_STORAGE_KEY = 'surf-dashboard-sidebar-collapsed';

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const connection = useExtensionConnection();

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
    } catch {
      // localStorage unavailable — default (expanded) stands
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  };

  // Fixed to the viewport height (not min-h-screen, which lets tall page content push the whole
  // document — sidebar included — into scrolling). Only the content area below TopStatusBar
  // scrolls; the sidebar and the status bar stay put, matching the reference.
  return (
    <div data-surf-shell className="flex h-screen overflow-hidden bg-bg text-text">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} connection={connection} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopStatusBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
