import { Injectable, computed, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<AppTheme>('dark');
  readonly isDark = computed(() => this.currentTheme() === 'dark');
  readonly isLight = computed(() => this.currentTheme() === 'light');

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('watchman_theme') as AppTheme | null;
      if (stored === 'light' || stored === 'dark') {
        this.setTheme(stored);
      } else {
        // Default to dark mode (the signature stone altar aesthetic)
        this.setTheme('dark');
      }
    } catch {
      this.setTheme('dark');
    }
  }

  setTheme(theme: AppTheme) {
    this.currentTheme.set(theme);
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('watchman_theme', theme);
    } catch {
      // ignore storage restrictions
    }

    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }

  toggleTheme() {
    this.setTheme(this.currentTheme() === 'dark' ? 'light' : 'dark');
  }
}
