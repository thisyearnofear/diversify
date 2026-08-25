import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ThemeMode } from './types';

type ThemeContextValue = {
  darkMode: boolean;
  themeMode: ThemeMode;
  themeLoaded: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function shouldBeDarkBasedOnOS(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getStoredPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return null;
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = localStorage.getItem('themeMode') as ThemeMode;
    if (stored && ['auto', 'light', 'dark'].includes(stored)) return stored;
  } catch {
    // ignore
  }
  return 'auto';
}

function calculateDarkMode(themeMode: ThemeMode): boolean {
  if (themeMode === 'auto') return shouldBeDarkBasedOnOS();
  return themeMode === 'dark';
}

function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return;
  if (isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [darkMode, setDarkModeState] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    // migrate legacy darkMode -> themeMode if needed
    let mode = getStoredThemeMode();
    const legacy = getStoredPreference();
    if (legacy !== null && !localStorage.getItem('themeMode')) {
      mode = legacy ? 'dark' : 'light';
      localStorage.setItem('themeMode', mode);
    }

    const initialDark = calculateDarkMode(mode);
    applyTheme(initialDark);

    setThemeMode(mode);
    setDarkModeState(initialDark);
    setThemeLoaded(true);
  }, []);

  // auto update — react to the OS-level theme change so the app follows
  // the user's device setting (system dark mode toggles, etc).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setThemeMode((prevMode) => {
        if (prevMode !== 'auto') return prevMode;
        const nextDark = mql.matches;
        setDarkModeState((prevDark) => {
          if (prevDark !== nextDark) applyTheme(nextDark);
          return nextDark;
        });
        return prevMode;
      });
    };

    // Safari < 14 only supports addListener/removeListener (deprecated but
    // still shipped). Modern browsers use addEventListener.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto';
      const nextDark = calculateDarkMode(next);

      localStorage.setItem('themeMode', next);
      localStorage.setItem('darkMode', String(nextDark));
      applyTheme(nextDark);

      setDarkModeState(nextDark);
      return next;
    });
  }, []);

  const setDarkMode = useCallback((isDark: boolean) => {
    const nextMode: ThemeMode = isDark ? 'dark' : 'light';
    localStorage.setItem('themeMode', nextMode);
    localStorage.setItem('darkMode', String(isDark));
    applyTheme(isDark);

    setThemeMode(nextMode);
    setDarkModeState(isDark);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      darkMode,
      themeMode,
      themeLoaded,
      toggleDarkMode,
      setDarkMode,
    }),
    [darkMode, themeMode, themeLoaded, toggleDarkMode, setDarkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
