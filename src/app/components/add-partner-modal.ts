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
  selector: 'app-add-partner-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              Expand Prayer Circle
            </span>
            <h2 class="text-xl font-serif font-bold text-stone-100">
              Add Prayer Partner
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
          Enter your friend's email address. Once added, whenever they sign in with this email, they will share this prayer circle, log their prayer hours, and see real-time progress on your {{ (currentPartnership()?.periodTargetMinutes || 6000) / 60 }}-hour target!
        </p>

        <!-- Current Members in this Circle -->
        <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5">
          <span class="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Current Members ({{ currentPartnership()?.memberEmails?.length || 0 }}):
          </span>
          <div class="flex flex-wrap gap-1.5 pt-1">
            @for (email of currentPartnership()?.memberEmails; track email) {
              <span class="text-xs bg-stone-900 text-stone-300 border border-stone-800 px-2 py-0.5 rounded-lg">
                {{ email }}
              </span>
            }
          </div>
        </div>

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label for="addEmail" class="block text-xs font-medium text-stone-300 mb-1.5">
              Friend's Email Address
            </label>
            <input
              id="addEmail"
              type="email"
              formControlName="email"
              placeholder="e.g. david.prayer@gmail.com"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

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
              <mat-icon style="font-size: 18px;">person_add</mat-icon>
              <span>{{ isSubmitting() ? 'Linking...' : 'Add Partner' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class AddPartnerModal {
  private firebaseService = inject(FirebaseService);

  readonly dismiss = output<void>();
  readonly added = output<void>();

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly currentPartnership = this.firebaseService.activePartnership;

  readonly form = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  async submit() {
    if (this.form.invalid) return;
    const p = this.currentPartnership();
    if (!p) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const email = this.form.getRawValue().email.trim().toLowerCase();

    try {
      await this.firebaseService.addPartnerByEmail(p.id, email);
      this.isSubmitting.set(false);
      this.added.emit();
      this.dismiss.emit();
    } catch (err: unknown) {
      this.isSubmitting.set(false);
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to add partner');
    }
  }
}
