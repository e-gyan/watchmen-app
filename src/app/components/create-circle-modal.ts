import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-create-circle-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              Prayer Circle Covenant
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              Establish Prayer Partnership
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
          Create a shared prayer altar and link your partner's email address (or multiple partners). When they sign in with their Google account, they will automatically see this circle, log sessions, and track advancing targets together.
        </p>

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <!-- Circle Name -->
          <div>
            <label for="circleName" class="block text-xs font-medium text-stone-300 mb-1.5">
              Partnership / Circle Name
            </label>
            <input
              id="circleName"
              type="text"
              formControlName="name"
              placeholder="e.g. Emmanuel & Friends Prayer Altar"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <!-- Partner Emails -->
          <div>
            <label for="partnerEmails" class="block text-xs font-medium text-stone-300 mb-1.5">
              Prayer Partner Emails (comma-separated, can be more than 1)
            </label>
            <input
              id="partnerEmails"
              type="text"
              formControlName="partnerEmails"
              placeholder="e.g. friend1@gmail.com, partner2@gmail.com"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
            <p class="text-[11px] text-stone-500 mt-1">
              Your own email is automatically included as the covenant creator.
            </p>
          </div>

          <!-- Target Milestone -->
          <div class="p-3.5 rounded-xl bg-stone-950 border border-stone-800/80 space-y-3">
            <span class="block text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Accountability Targets
            </span>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label for="cDaily" class="block text-stone-400 mb-1">Daily Target (mins)</label>
                <input
                  id="cDaily"
                  type="number"
                  min="5"
                  max="720"
                  formControlName="dailyMinutes"
                  class="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-100 font-mono"
                />
              </div>

              <div>
                <label for="cWeekly" class="block text-stone-400 mb-1">Weekly Target (hours)</label>
                <input
                  id="cWeekly"
                  type="number"
                  min="1"
                  max="100"
                  formControlName="weeklyHours"
                  class="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label for="cPeriod" class="block text-xs text-stone-400 mb-1">Period Milestone Target (hours)</label>
              <input
                id="cPeriod"
                type="number"
                min="10"
                max="1000"
                formControlName="periodHours"
                class="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1.5 text-sm font-mono text-amber-400"
              />
              <span class="text-[11px] text-stone-500 mt-0.5 block">
                Default: 100 Hours for Year 2026.
              </span>
            </div>
          </div>

          <!-- Error message -->
          @if (errorMessage()) {
            <div class="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-300">
              {{ errorMessage() }}
            </div>
          }

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
              <mat-icon style="font-size: 18px;">handshake</mat-icon>
              <span>{{ isSubmitting() ? 'Connecting...' : 'Establish Circle' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class CreateCircleModal {
  private firebaseService = inject(FirebaseService);

  readonly dismiss = output<void>();
  readonly created = output<string>();

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl<string>('Watchman Prayer Circle', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    partnerEmails: new FormControl<string>('', {
      nonNullable: true,
    }),
    dailyMinutes: new FormControl<number>(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(5)],
    }),
    weeklyHours: new FormControl<number>(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    periodHours: new FormControl<number>(100, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(5)],
    }),
  });

  async submit() {
    if (this.form.invalid) return;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    const emails = val.partnerEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'));

    try {
      const pId = await this.firebaseService.createPartnership(val.name, emails, {
        dailyMinutes: val.dailyMinutes,
        weeklyMinutes: val.weeklyHours * 60,
        periodTitle: 'Year 2026 Milestone Covenant',
        periodTargetMinutes: val.periodHours * 60,
        periodStartDate: '2026-01-01',
        periodEndDate: '2026-12-31',
      });
      this.isSubmitting.set(false);
      this.created.emit(pId);
      this.dismiss.emit();
    } catch (err: unknown) {
      this.isSubmitting.set(false);
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to establish circle');
    }
  }
}
