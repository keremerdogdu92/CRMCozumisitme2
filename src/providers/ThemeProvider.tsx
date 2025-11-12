import { PropsWithChildren, useEffect } from 'react';

const STORAGE_KEY = 'crm-theme';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'light';
    applyTheme(stored);
  }, []);

  return children;
}
