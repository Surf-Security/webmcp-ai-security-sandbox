'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Separate from the SurfMCP extension's own 'surfTheme' chrome.storage key — this is a plain web
// app using localStorage, a different storage mechanism entirely, so there's no collision risk,
// but the distinct name keeps the two straight when reading either codebase.
export const THEME_STORAGE_KEY = 'surf-dashboard-theme';

// The default before the user has ever made an explicit choice. 'system' remains a selectable
// option in ThemeToggle for anyone who wants to follow their OS — it's just no longer what a
// first-time visitor gets.
const DEFAULT_THEME = 'light';

function applyThemeAttribute(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

// Executed as a plain inline <script> (not next/script) by the dashboard route group's layout,
// so it runs synchronously during initial HTML parsing, before React hydrates — this avoids a
// flash of the wrong theme on first paint. Plain <script> tags work in any layout; next/script's
// beforeInteractive strategy is restricted to the root layout only, which would be too broad here
// (this dashboard route group is the only part of the app with theme support — see globals.css's
// [data-surf-shell] scoping comment).
export const ANTI_FLICKER_SCRIPT = `
(function () {
  try {
    var t = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (t !== 'light' && t !== 'dark' && t !== 'system') t = ${JSON.stringify(DEFAULT_THEME)};
    if (t !== 'system') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

const ThemeContext = createContext({ theme: DEFAULT_THEME, setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    let stored = DEFAULT_THEME;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to the default above
    }
    setThemeState(stored);
  }, []);

  const setTheme = (next) => {
    setThemeState(next);
    applyThemeAttribute(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // best-effort; theme still applies for this session even if it can't persist
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
