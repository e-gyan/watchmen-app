import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-target-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              Accountability Settings
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              Update Circle Prayer Targets
            </h2>
          </div>
          <button
            type="button"
            (click)="dismiss.emit()"
            class="text-stone-400 hover:text-stone-100 p-2 rounded-lg hover:bg-stone-800/80 transition-colors"
            aria-label="Close modal"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <p class="text-xs text-stone-400 leading-relaxed">
          Configure daily, weekly, and annual covenant targets for this prayer circle. Changes are saved to Firestore and immediately synchronized across all partner devices.
        </p>

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">
          <!-- Daily Target -->
          <div class="p-4 rounded-xl bg-stone-950 border border-stone-800/80 space-y-3">
            <div class="flex items-center justify-between">
              <label for="dailyMinutes" class="text-sm font-semibold text-stone-200">
                Daily Prayer Target
              </label>
              <span class="text-xs text-amber-400 font-mono">
                {{ formatMins(form.value.dailyMinutes || 0) }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <input
                id="dailyMinutes"
                type="number"
                min="5"
                max="720"
                step="5"
                formControlName="dailyMinutes"
                class="w-32 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 tabular-nums focus:outline-none focus:border-amber-500"
              />
              <span class="text-xs text-stone-400">minutes / day</span>
            </div>
            <!-- Quick buttons -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                (click)="form.patchValue({ dailyMinutes: 30 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                30 mins
              </button>
              <button
                type="button"
                (click)="form.patchValue({ dailyMinutes: 45 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                45 mins
              </button>
              <button
                type="button"
                (click)="form.patchValue({ dailyMinutes: 60 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                1 hour (60m)
              </button>
              <button
                type="button"
                (click)="form.patchValue({ dailyMinutes: 90 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                1.5 hours (90m)
              </button>
              <button
                type="button"
                (click)="form.patchValue({ dailyMinutes: 120 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                2 hours (120m)
              </button>
            </div>
          </div>

          <!-- Weekly Target -->
          <div class="p-4 rounded-xl bg-stone-950 border border-stone-800/80 space-y-3">
            <div class="flex items-center justify-between">
              <label for="weeklyHours" class="text-sm font-semibold text-stone-200">
                Weekly Prayer Target
              </label>
              <span class="text-xs text-amber-400 font-mono">
                {{ form.value.weeklyHours || 0 }} hours / week
              </span>
            </div>
            <div class="flex items-center gap-3">
              <input
                id="weeklyHours"
                type="number"
                min="1"
                max="100"
                step="1"
                formControlName="weeklyHours"
                class="w-32 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 tabular-nums focus:outline-none focus:border-amber-500"
              />
              <span class="text-xs text-stone-400">hours / week</span>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                (click)="form.patchValue({ weeklyHours: 5 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                5 hours
              </button>
              <button
                type="button"
                (click)="form.patchValue({ weeklyHours: 7 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                7 hours
              </button>
              <button
                type="button"
                (click)="form.patchValue({ weeklyHours: 10 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                10 hours
              </button>
              <button
                type="button"
                (click)="form.patchValue({ weeklyHours: 14 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                14 hours
              </button>
            </div>
          </div>

          <!-- Long-Term / Year Covenant Target (e.g. 100 Hours) -->
          <div class="p-4 rounded-xl bg-stone-950 border border-stone-800/80 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs text-amber-500 font-semibold uppercase tracking-wider">
                  Long-Term Milestone
                </span>
                <h3 class="text-sm font-semibold text-stone-100">Period / Annual Target</h3>
              </div>
              <span class="text-sm text-amber-400 font-serif font-bold">
                {{ form.value.periodHours || 100 }} Hours
              </span>
            </div>

            <!-- Title & Hours -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="pTitle" class="block text-xs font-medium text-stone-400 mb-1">
                  Target Name
                </label>
                <input
                  id="pTitle"
                  type="text"
                  formControlName="periodTitle"
                  placeholder="2026 Goal"
                  class="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label for="pHours" class="block text-xs font-medium text-stone-400 mb-1">
                  Target Hours
                </label>
                <div class="relative">
                  <input
                    id="pHours"
                    type="number"
                    min="10"
                    max="1000"
                    step="5"
                    formControlName="periodHours"
                    class="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 tabular-nums focus:outline-none focus:border-amber-500 pr-14"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-stone-500 pointer-events-none">hours</span>
                </div>
              </div>
            </div>

            <!-- Presets -->
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                (click)="form.patchValue({ periodHours: 50 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                50 Hours
              </button>
              <button
                type="button"
                (click)="form.patchValue({ periodHours: 100 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40"
              >
                100 Hours (Recommended)
              </button>
              <button
                type="button"
                (click)="form.patchValue({ periodHours: 150 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                150 Hours
              </button>
              <button
                type="button"
                (click)="form.patchValue({ periodHours: 200 })"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100"
              >
                200 Hours
              </button>
            </div>

            <!-- Start & End Date -->
            <div class="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label for="pStart" class="block text-xs font-medium text-stone-400 mb-1">Start Date</label>
                <input
                  id="pStart"
                  type="date"
                  formControlName="startDate"
                  class="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label for="pEnd" class="block text-xs font-medium text-stone-400 mb-1">Target End Date</label>
                <input
                  id="pEnd"
                  type="date"
                  formControlName="endDate"
                  class="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-stone-800/80">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="py-2 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || isSubmitting()"
              class="flex items-center gap-2 py-2 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">check</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : 'Save Targets to Circle' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TargetModal implements OnInit {
  private firebaseService = inject(FirebaseService);

  readonly dismiss = output<void>();
  readonly isSubmitting = signal(false);

  readonly form = new FormGroup({
    dailyMinutes: new FormControl<number>(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(5)],
    }),
    weeklyHours: new FormControl<number>(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    periodTitle: new FormControl<string>('Year 2026 Milestone Covenant', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    periodHours: new FormControl<number>(100, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    startDate: new FormControl<string>('2026-01-01', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    endDate: new FormControl<string>('2026-12-31', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit() {
    const p = this.firebaseService.activePartnership();
    if (p) {
      this.form.patchValue({
        dailyMinutes: p.dailyTargetMinutes,
        weeklyHours: Math.round(p.weeklyTargetMinutes / 60),
        periodTitle: p.periodTitle,
        periodHours: Math.round(p.periodTargetMinutes / 60),
        startDate: p.periodStartDate,
        endDate: p.periodEndDate,
      });
    }
  }

  formatMins(mins: number): string {
    return this.firebaseService.formatMinutes(mins);
  }

  async submit() {
    if (this.form.invalid) return;
    const p = this.firebaseService.activePartnership();
    if (!p) return;

    this.isSubmitting.set(true);
    const val = this.form.getRawValue();

    try {
      await this.firebaseService.updatePartnershipTargets(p.id, {
        dailyMinutes: Number(val.dailyMinutes),
        weeklyMinutes: Number(val.weeklyHours) * 60,
        periodTitle: val.periodTitle.trim(),
        periodTargetMinutes: Number(val.periodHours) * 60,
        periodStartDate: val.startDate,
        periodEndDate: val.endDate,
      });
      this.isSubmitting.set(false);
      this.dismiss.emit();
    } catch (err) {
      this.isSubmitting.set(false);
      console.error(err);
    }
  }
}
