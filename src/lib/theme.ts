export type AppTheme = 'light' | 'dark' | 'system';

export function applyTheme(theme?: AppTheme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const savedTheme = localStorage.getItem('theme') as AppTheme

  if (savedTheme) {
    theme = savedTheme;
  } else if (prefersDark.matches) {
    theme = 'dark';
  } else {
    theme = 'light';
  }


  const setClass = (isDark: boolean) => {
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // Initial apply
  if (theme === 'system') {
    setClass(prefersDark.matches);
  } else {
    setClass(theme === 'dark');
  }

  // Respond to system changes if using system theme
  const listener = (e: MediaQueryListEvent) => {
    if (theme === 'system') setClass(e.matches);
  };
  try {
    prefersDark.addEventListener('change', listener);
  } catch (_e) {
    // Safari fallback
    // @ts-ignore
    prefersDark.addListener(listener);
  }
}


