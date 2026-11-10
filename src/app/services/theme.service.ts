import { Injectable, computed, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';
export type ThemePreference = 'auto' | 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<AppTheme>('dark');
  readonly preference = signal<ThemePreference>('auto');
  readonly isDark = computed(() => this.currentTheme() === 'dark');
  readonly isLight = computed(() => this.currentTheme() === 'light');
  readonly isAuto = computed(() => this.preference() === 'auto');

  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private lastScheduledPeriod: AppTheme | null = null;

  constructor() {
    this.initTheme();
  }

  /**
   * Computes scheduled theme based on local time:
   * - Light mode from 6:45 AM (405 mins) until 6:45 PM (1125 mins)
   * - Dark mode from 6:45 PM (1125 mins) until 6:45 AM (405 mins)
   */
  getScheduledTheme(now = new Date()): AppTheme {
    const minsSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const lightStart = 6 * 60 + 45; // 06:45 AM (405)
    const darkStart = 18 * 60 + 45; // 06:45 PM (1125)
    return minsSinceMidnight >= lightStart && minsSinceMidnight < darkStart ? 'light' : 'dark';
  }

  private initTheme() {
    if (typeof window === 'undefined') return;

    const scheduled = this.getScheduledTheme();
    this.lastScheduledPeriod = scheduled;

    try {
      const storedPref = localStorage.getItem('watchman_theme_pref') as ThemePreference | null;
      if (storedPref === 'light' || storedPref === 'dark') {
        this.preference.set(storedPref);
        this.applyThemeToDom(storedPref);
      } else {
        this.preference.set('auto');
        this.applyThemeToDom(scheduled);
      }
    } catch {
      this.preference.set('auto');
      this.applyThemeToDom(scheduled);
    }

    // Check every 30s to automate 6:45 AM Light / 6:45 PM Dark transitions
    this.scheduleTimer = setInterval(() => {
      const nextScheduled = this.getScheduledTheme();
      const crossedBoundary = this.lastScheduledPeriod !== null && this.lastScheduledPeriod !== nextScheduled;
      this.lastScheduledPeriod = nextScheduled;

      if (this.preference() === 'auto' || crossedBoundary) {
        if (crossedBoundary) {
          this.preference.set('auto');
          try {
            localStorage.setItem('watchman_theme_pref', 'auto');
          } catch {
            // ignore
          }
        }
        this.applyThemeToDom(nextScheduled);
      }
    }, 30000);
  }

  setAutoTheme() {
    this.preference.set('auto');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('watchman_theme_pref', 'auto');
      } catch {
        // ignore
      }
    }
    this.applyThemeToDom(this.getScheduledTheme());
  }

  setTheme(theme: AppTheme) {
    this.preference.set(theme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('watchman_theme_pref', theme);
        localStorage.setItem('watchman_theme', theme);
      } catch {
        // ignore storage restrictions
      }
    }
    this.applyThemeToDom(theme);
  }

  private applyThemeToDom(theme: AppTheme) {
    this.currentTheme.set(theme);
    if (typeof window === 'undefined') return;

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
