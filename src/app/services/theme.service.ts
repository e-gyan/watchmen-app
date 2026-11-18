import { Injectable, computed, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';
export type ThemePreference = 'auto' | 'schedule' | 'dark' | 'light';
export type AppColorPalette =
  | 'emerald'
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'rose'
  | 'fuchsia'
  | 'slate'
  | 'cyan'
  | 'sky';

export interface ColorPaletteOption {
  id: AppColorPalette;
  label: string;
  swatch: string;
  lightThemeColor: string;
  darkThemeColor: string;
}

export const APP_COLOR_PALETTES: ColorPaletteOption[] = [
  { id: 'emerald', label: 'Emerald', swatch: '#10b981', lightThemeColor: '#ecfdf5', darkThemeColor: '#0f1714' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6', lightThemeColor: '#f0fdfa', darkThemeColor: '#0f1716' },
  { id: 'indigo', label: 'Indigo', swatch: '#6366f1', lightThemeColor: '#eef2ff', darkThemeColor: '#12131d' },
  { id: 'amber', label: 'Amber', swatch: '#f59e0b', lightThemeColor: '#fffbeb', darkThemeColor: '#171412' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e', lightThemeColor: '#fff1f2', darkThemeColor: '#1a1214' },
  { id: 'fuchsia', label: 'Fuchsia', swatch: '#d946ef', lightThemeColor: '#fdf4ff', darkThemeColor: '#19121b' },
  { id: 'slate', label: 'Slate', swatch: '#64748b', lightThemeColor: '#f8fafc', darkThemeColor: '#0f172a' },
  { id: 'cyan', label: 'Cyan', swatch: '#06b6d4', lightThemeColor: '#ecfeff', darkThemeColor: '#0e1719' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9', lightThemeColor: '#f0f9ff', darkThemeColor: '#0e161d' },
];

const THEME_PREF_KEY = 'watchman_theme_pref';
const COLOR_PALETTE_KEY = 'watchman_color_palette';

const VALID_PALETTES = new Set<string>(APP_COLOR_PALETTES.map((p) => p.id));

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<AppTheme>('dark');
  readonly preference = signal<ThemePreference>('schedule');
  readonly systemTheme = signal<AppTheme>('dark');
  readonly colorPalette = signal<AppColorPalette>('amber');

  readonly isDark = computed(() => this.currentTheme() === 'dark');
  readonly isLight = computed(() => this.currentTheme() === 'light');
  readonly isAuto = computed(() => this.preference() === 'auto');
  readonly isSchedule = computed(() => this.preference() === 'schedule');
  readonly activePaletteOption = computed(
    () => APP_COLOR_PALETTES.find((p) => p.id === this.colorPalette()) || APP_COLOR_PALETTES[3]
  );

  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.initTheme();
  }

  /**
   * Computes automated schedule theme based on local time:
   * - Light mode from 6:45 AM (405 mins) until 6:45 PM (1125 mins), blended with selected color theme
   * - Dark mode from 6:45 PM (1125 mins) until 6:45 AM (405 mins)
   */
  getScheduledTheme(now = new Date()): AppTheme {
    const minsSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const lightStart = 6 * 60 + 45; // 06:45 AM (405)
    const darkStart = 18 * 60 + 45; // 06:45 PM (1125)
    return minsSinceMidnight >= lightStart && minsSinceMidnight < darkStart ? 'light' : 'dark';
  }

  private detectSystemTheme(): AppTheme {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return this.getScheduledTheme();
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private initTheme() {
    if (typeof window === 'undefined') return;

    const detectedSystem = this.detectSystemTheme();
    this.systemTheme.set(detectedSystem);

    // Load saved color palette
    try {
      const storedPalette = localStorage.getItem(COLOR_PALETTE_KEY);
      if (storedPalette && VALID_PALETTES.has(storedPalette)) {
        this.applyPaletteToDom(storedPalette as AppColorPalette);
      } else {
        this.applyPaletteToDom('amber');
      }
    } catch {
      this.applyPaletteToDom('amber');
    }

    // Load saved display mode preference ('auto' = system preference, 'schedule' = 6:45 AM/PM, 'light', 'dark')
    try {
      const storedPref = localStorage.getItem(THEME_PREF_KEY) as ThemePreference | null;
      if (storedPref === 'light' || storedPref === 'dark') {
        this.preference.set(storedPref);
        this.applyThemeToDom(storedPref);
      } else if (storedPref === 'auto') {
        this.preference.set('auto');
        this.applyThemeToDom(detectedSystem);
      } else {
        this.preference.set('schedule');
        this.applyThemeToDom(this.getScheduledTheme());
      }
    } catch {
      this.preference.set('schedule');
      this.applyThemeToDom(this.getScheduledTheme());
    }

    // Watch OS/system light-dark selection changes so 'Auto' learns & follows system preference live
    if (typeof window.matchMedia === 'function') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (event: MediaQueryListEvent) => {
        const nextSys: AppTheme = event.matches ? 'dark' : 'light';
        this.systemTheme.set(nextSys);
        if (this.preference() === 'auto') {
          this.applyThemeToDom(nextSys);
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }

    // Check every 30s + on window focus/visibility resume for 6:45 AM Light / 6:45 PM Dark automation
    const syncScheduled = () => {
      if (this.preference() === 'schedule') {
        const nextScheduled = this.getScheduledTheme();
        if (this.currentTheme() !== nextScheduled) {
          this.applyThemeToDom(nextScheduled);
        }
      } else if (this.preference() === 'auto') {
        const nextSys = this.detectSystemTheme();
        this.systemTheme.set(nextSys);
        if (this.currentTheme() !== nextSys) {
          this.applyThemeToDom(nextSys);
        }
      }
    };

    this.scheduleTimer = setInterval(syncScheduled, 30000);
    window.addEventListener('focus', syncScheduled);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncScheduled();
      }
    });
  }

  /**
   * Auto mode: learns from the device/OS system selection (prefers-color-scheme).
   */
  setAutoTheme() {
    this.preference.set('auto');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THEME_PREF_KEY, 'auto');
      } catch {
        // ignore
      }
    }
    const sys = this.detectSystemTheme();
    this.systemTheme.set(sys);
    this.applyThemeToDom(sys);
  }

  /**
   * Automated 6:45 schedule mode: Light at 6:45 AM (with blended color theme) and Dark at 6:45 PM.
   */
  setScheduleTheme() {
    this.preference.set('schedule');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THEME_PREF_KEY, 'schedule');
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
        localStorage.setItem(THEME_PREF_KEY, theme);
        localStorage.setItem('watchman_theme', theme);
      } catch {
        // ignore storage restrictions
      }
    }
    this.applyThemeToDom(theme);
  }

  setColorPalette(palette: AppColorPalette) {
    if (!VALID_PALETTES.has(palette)) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COLOR_PALETTE_KEY, palette);
      } catch {
        // ignore
      }
    }
    this.applyPaletteToDom(palette);
    this.updateThemeColorMeta(this.currentTheme(), palette);
  }

  private applyPaletteToDom(palette: AppColorPalette) {
    this.colorPalette.set(palette);
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-palette', palette);
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
    this.updateThemeColorMeta(theme, this.colorPalette());
  }

  private updateThemeColorMeta(theme: AppTheme, palette: AppColorPalette) {
    if (typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const opt = APP_COLOR_PALETTES.find((p) => p.id === palette) || APP_COLOR_PALETTES[3];
    meta.setAttribute('content', theme === 'light' ? opt.lightThemeColor : opt.darkThemeColor);
  }

  toggleTheme() {
    this.setTheme(this.currentTheme() === 'dark' ? 'light' : 'dark');
  }
}
