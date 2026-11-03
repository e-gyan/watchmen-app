import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div
      role="group"
      aria-label="Color theme selector"
      class="inline-flex items-center p-0.5 sm:p-1 rounded-xl bg-stone-900 border border-stone-800/80 transition-colors shadow-inner"
    >
      <!-- Stone Dark Mode Option -->
      <button
        type="button"
        (click)="themeService.setTheme('dark')"
        class="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all focus:outline-none focus:ring-1 focus:ring-amber-500"
        [class]="
          themeService.isDark()
            ? 'bg-stone-800 text-amber-400 font-semibold shadow-sm ring-1 ring-amber-500/20'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
        "
        [attr.aria-pressed]="themeService.isDark()"
        title="Stone Dark Altar Mode"
        aria-label="Switch to Stone Dark Mode"
      >
        <mat-icon style="font-size: 15px;">dark_mode</mat-icon>
        <span class="hidden md:inline font-medium text-[11px]">Dark</span>
      </button>

      <!-- High-Contrast Light Mode Option -->
      <button
        type="button"
        (click)="themeService.setTheme('light')"
        class="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs transition-all focus:outline-none focus:ring-1 focus:ring-amber-500"
        [class]="
          themeService.isLight()
            ? 'bg-amber-500 text-stone-950 font-bold shadow-sm ring-1 ring-amber-600'
            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
        "
        [attr.aria-pressed]="themeService.isLight()"
        title="High-Contrast Light Mode (Accessible)"
        aria-label="Switch to High-Contrast Light Mode"
      >
        <mat-icon style="font-size: 15px;">light_mode</mat-icon>
        <span class="hidden md:inline font-medium text-[11px]">Light</span>
      </button>
    </div>
  `,
})
export class ThemeToggle {
  readonly themeService = inject(ThemeService);
}
