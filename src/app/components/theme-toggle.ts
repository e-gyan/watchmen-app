import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppTheme, ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="w-full space-y-1.5">
      <div
        role="group"
        aria-label="Display mode selector (Auto system preference, 6:45 AM Light / 6:45 PM Dark schedule, Light, Dark)"
        class="grid grid-cols-4 gap-1 w-full p-1 rounded-xl bg-stone-950 border border-stone-800/80 transition-colors"
      >
        <!-- Auto: Learns from system selection / preference -->
        <button
          type="button"
          (click)="selectAuto()"
          [attr.aria-pressed]="themeService.isAuto()"
          class="min-w-0 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] transition-all focus:outline-none whitespace-nowrap"
          [class]="
            themeService.isAuto()
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
          "
          title="Auto: Follows your device system display preference"
        >
          <mat-icon class="shrink-0" style="font-size: 14px;">brightness_auto</mat-icon>
          <span class="truncate">Auto</span>
        </button>

        <!-- 6:45 Automated Schedule (6:45 AM Light + blended color / 6:45 PM Dark) -->
        <button
          type="button"
          (click)="selectSchedule()"
          [attr.aria-pressed]="themeService.isSchedule()"
          class="min-w-0 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] transition-all focus:outline-none whitespace-nowrap"
          [class]="
            themeService.isSchedule()
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
          "
          title="6:45 Auto: Light at 6:45 AM, Dark at 6:45 PM"
        >
          <mat-icon class="shrink-0" style="font-size: 14px;">schedule</mat-icon>
          <span class="truncate">6:45</span>
        </button>

        <!-- Light Mode -->
        <button
          type="button"
          (click)="selectManual('light')"
          [attr.aria-pressed]="!themeService.isAuto() && !themeService.isSchedule() && themeService.isLight()"
          class="min-w-0 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] transition-all focus:outline-none whitespace-nowrap"
          [class]="
            !themeService.isAuto() && !themeService.isSchedule() && themeService.isLight()
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
          "
          title="Light mode blended with selected color"
        >
          <mat-icon class="shrink-0" style="font-size: 14px;">light_mode</mat-icon>
          <span class="truncate">Light</span>
        </button>

        <!-- Dark Mode -->
        <button
          type="button"
          (click)="selectManual('dark')"
          [attr.aria-pressed]="!themeService.isAuto() && !themeService.isSchedule() && themeService.isDark()"
          class="min-w-0 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] transition-all focus:outline-none whitespace-nowrap"
          [class]="
            !themeService.isAuto() && !themeService.isSchedule() && themeService.isDark()
              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 font-medium'
          "
          title="Dark mode"
        >
          <mat-icon class="shrink-0" style="font-size: 14px;">dark_mode</mat-icon>
          <span class="truncate">Dark</span>
        </button>
      </div>

      <p class="text-[11px] text-stone-400 leading-tight px-0.5">
        {{ modeSummary() }}
      </p>
    </div>
  `,
})
export class ThemeToggle {
  readonly themeService = inject(ThemeService);
  readonly selected = output<void>();

  readonly modeSummary = computed(() => {
    const pref = this.themeService.preference();
    const active = this.themeService.currentTheme() === 'light' ? 'Light' : 'Dark';
    if (pref === 'auto') {
      const sys = this.themeService.systemTheme() === 'light' ? 'Light' : 'Dark';
      return `System preference active (${sys})`;
    }
    if (pref === 'schedule') {
      return `6:45 AM Light · 6:45 PM Dark (Now: ${active})`;
    }
    return pref === 'light' ? 'Light mode blended with theme color' : 'Dark mode';
  });

  selectAuto() {
    this.themeService.setAutoTheme();
    this.selected.emit();
  }

  selectSchedule() {
    this.themeService.setScheduleTheme();
    this.selected.emit();
  }

  selectManual(theme: AppTheme) {
    this.themeService.setTheme(theme);
    this.selected.emit();
  }
}
