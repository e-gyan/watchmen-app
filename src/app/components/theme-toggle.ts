import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AppTheme, ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div
      role="group"
      aria-label="Color theme selector (Auto 6:45 AM Light / 6:45 PM Dark)"
      class="inline-flex items-center p-1 rounded-xl bg-stone-900 border border-stone-800/80 transition-colors shadow-inner gap-0.5"
    >
      <!-- Auto 6:45 AM / 6:45 PM Schedule Option -->
      <button
        type="button"
        (click)="selectAuto()"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all focus:outline-none"
        [class]="
          themeService.isAuto()
            ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-xs'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
        "
        title="Auto: Light 6:45 AM · Dark 6:45 PM"
      >
        <mat-icon style="font-size: 14px;">schedule</mat-icon>
        <span class="font-medium text-[11px]">Auto (6:45)</span>
      </button>

      <!-- Stone Dark Mode Option -->
      <button
        type="button"
        (click)="selectManual('dark')"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all focus:outline-none"
        [class]="
          !themeService.isAuto() && themeService.isDark()
            ? 'bg-stone-800 text-amber-400 font-semibold shadow-xs ring-1 ring-amber-500/20'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
        "
        title="Stone Dark Mode"
      >
        <mat-icon style="font-size: 14px;">dark_mode</mat-icon>
        <span class="font-medium text-[11px]">Dark</span>
      </button>

      <!-- High-Contrast Light Mode Option -->
      <button
        type="button"
        (click)="selectManual('light')"
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all focus:outline-none"
        [class]="
          !themeService.isAuto() && themeService.isLight()
            ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
        "
        title="High-Contrast Light Mode"
      >
        <mat-icon style="font-size: 14px;">light_mode</mat-icon>
        <span class="font-medium text-[11px]">Light</span>
      </button>
    </div>
  `,
})
export class ThemeToggle {
  readonly themeService = inject(ThemeService);
  readonly selected = output<void>();

  selectAuto() {
    this.themeService.setAutoTheme();
    this.selected.emit();
  }

  selectManual(theme: AppTheme) {
    this.themeService.setTheme(theme);
    this.selected.emit();
  }
}
