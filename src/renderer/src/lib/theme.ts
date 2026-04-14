export type Theme = 'light' | 'dark';

export const readSystemTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
