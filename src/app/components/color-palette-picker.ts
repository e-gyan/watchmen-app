import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  APP_COLOR_PALETTES,
  AppColorPalette,
  ThemeService,
} from '../services/theme.service';

@Component({
  selector: 'app-color-palette-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div
      role="group"
      aria-label="App color palette"
      [class]="
        variant() === 'compact'
          ? 'grid grid-cols-3 gap-1.5 w-full'
          : 'grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 w-full'
      "
    >
      @for (p of palettes; track p.id) {
        @let isActive = themeService.colorPalette() === p.id;
        <button
          type="button"
          (click)="selectPalette(p.id)"
          [attr.aria-pressed]="isActive"
          [class]="
            variant() === 'compact'
              ? 'min-w-0 min-h-[38px] flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all text-left'
              : 'min-w-0 min-h-[44px] flex items-center justify-between sm:justify-start gap-2 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all text-left'
          "
          [style.border-color]="isActive ? p.swatch : ''"
          [style.background-color]="isActive ? p.swatch + '22' : ''"
          [class.bg-stone-950]="!isActive"
          [class.border-stone-800]="!isActive"
          [class.text-stone-300]="!isActive"
          [class.hover:border-stone-700]="!isActive"
          [class.text-stone-100]="isActive"
          [class.font-semibold]="isActive"
          [title]="'Select ' + p.label + ' color theme'"
        >
          <span
            class="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-xs"
            [style.background-color]="p.swatch"
          ></span>
          <span class="truncate flex-1">{{ p.label }}</span>
          @if (isActive && variant() === 'expanded') {
            <mat-icon class="shrink-0 sm:hidden" [style.color]="p.swatch" style="font-size: 14px;">check</mat-icon>
          }
        </button>
      }
    </div>
  `,
})
export class ColorPalettePicker {
  readonly themeService = inject(ThemeService);
  readonly variant = input<'compact' | 'expanded'>('expanded');
  readonly paletteChanged = output<AppColorPalette>();

  readonly palettes = APP_COLOR_PALETTES;

  selectPalette(id: AppColorPalette) {
    this.themeService.setColorPalette(id);
    this.paletteChanged.emit(id);
  }
}
