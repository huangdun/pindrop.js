export type ThemePreference = 'auto' | 'light' | 'dark';

export function detectTheme(preference: ThemePreference = 'auto'): 'light' | 'dark' {
  if (preference === 'auto') {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  return preference;
}

export function applyTheme(shadowHost: HTMLElement, theme: 'light' | 'dark', customStyles?: Record<string, string>): void {
  shadowHost.dataset.pindropTheme = theme;

  if (customStyles) {
    for (const [key, value] of Object.entries(customStyles)) {
      shadowHost.style.setProperty(key, value);
    }
  }
}