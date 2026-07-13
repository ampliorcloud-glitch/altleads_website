import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
}

/**
 * Theme management hook with system preference detection.
 * Persists choice to localStorage. Falls back to OS preference.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('zen-theme') as Theme | null;
    return stored ?? 'system';
  });

  const resolved = getResolvedTheme(theme);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(getSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === 'system') {
      localStorage.removeItem('zen-theme');
    } else {
      localStorage.setItem('zen-theme', next);
    }
  }, []);

  const toggle = useCallback(() => {
    const next = resolved === 'light' ? 'dark' : 'light';
    setTheme(next);
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggle } as const;
}
