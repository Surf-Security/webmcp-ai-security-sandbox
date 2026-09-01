import { ThemeProvider, ANTI_FLICKER_SCRIPT } from '../lib/theme';
import { ExtensionConnectionProvider } from '../lib/useExtensionConnection';
import { TopBarSlotProvider } from '../lib/topBarSlot';
import AppShell from '../components/shell/AppShell';

// Overrides the root layout's title (which stays 'WebMCP AI Security Sandbox' for the legacy
// demo at '/') for every page in this route group.
export const metadata = {
  title: 'Surf Agent Control',
  description: 'See what an AI agent can do to WebMCP tools — with and without Surf.',
};

// This route group is the only part of the app with theme/dark-mode support — the legacy single-
// page demo (app/page.js) and dev test sites (app/tests/*) live outside it and are unaffected
// (see the [data-surf-shell]-scoped cascade in app/globals.css). A plain inline <script> (not
// next/script — beforeInteractive is restricted to the root layout) applies any stored theme
// override to <html> before hydration, avoiding a flash of the wrong theme.
export default function DashboardLayout({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ANTI_FLICKER_SCRIPT }} />
      <ThemeProvider>
        <ExtensionConnectionProvider>
          <TopBarSlotProvider>
            <AppShell>{children}</AppShell>
          </TopBarSlotProvider>
        </ExtensionConnectionProvider>
      </ThemeProvider>
    </>
  );
}
