import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PRAYER_CATEGORIES, PrayerCategoryDef, PrayerRequest } from '../models/prayer.model';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-request-modal',
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
              Intercession Ledger
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              {{ editRequest() ? 'Edit Prayer Request' : 'New Prayer Request' }}
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

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <!-- Title -->
          <div>
            <label for="rTitle" class="block text-xs font-medium text-stone-300 mb-1.5">
              Request Title
            </label>
            <input
              id="rTitle"
              type="text"
              formControlName="title"
              placeholder="Short request title"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <!-- Multiple Category Selection -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="block text-xs font-medium text-stone-300">
                Categories
              </span>
              <span class="text-[11px] text-amber-400 font-mono">
                {{ selectedCategories().length }} selected
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              @for (c of categories; track c.name) {
                <button
                  type="button"
                  (click)="toggleCategory(c.name)"
                  class="flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all"
                  [class]="
                    isCategorySelected(c.name)
                      ? 'bg-stone-800/90 border-amber-500 text-stone-100 font-medium'
                      : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700'
                  "
                >
                  <mat-icon [style.color]="c.color" style="font-size: 16px; width: 16px; height: 16px;">
                    {{ c.icon }}
                  </mat-icon>
                  <span class="truncate flex-1 text-[11px]">{{ c.name }}</span>
                  @if (isCategorySelected(c.name)) {
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;" class="text-amber-400 shrink-0">
                      check_circle
                    </mat-icon>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Assigned Partner -->
          <div>
            <label for="rAssign" class="block text-xs font-medium text-stone-300 mb-1.5">Assigned To</label>
            <select
              id="rAssign"
              formControlName="assignedPartner"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="All Partners (Shared Agreement)">All Partners (Shared Agreement)</option>
              @for (email of memberEmails(); track email) {
                <option [value]="email.split('@')[0]">{{ email.split('@')[0] }}</option>
              }
            </select>
          </div>

          <!-- Specific Prayer Points & Notes -->
          <div>
            <label for="rNotes" class="block text-xs font-medium text-stone-300 mb-1.5">
              Prayer Points
            </label>
            <textarea
              id="rNotes"
              rows="3"
              formControlName="notes"
              placeholder="Brief prayer points..."
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
            ></textarea>
          </div>

          <!-- Status (if editing) -->
          @if (editRequest()) {
            <div>
              <label for="rStatus" class="block text-xs font-medium text-stone-300 mb-1.5">Status</label>
              <select
                id="rStatus"
                formControlName="status"
                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
              >
                <option value="active">Actively Praying</option>
                <option value="waiting">Waiting on the Lord</option>
                <option value="answered">Answered (Praise Report)</option>
              </select>
            </div>
          }

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-stone-800/80">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="py-2.5 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || isSubmitting() || selectedCategories().length === 0"
              class="flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">bookmark_add</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : (editRequest() ? 'Save Changes' : 'Add to Watch List') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class RequestModal implements OnInit {
  private firebaseService = inject(FirebaseService);

  readonly editRequest = input<PrayerRequest | null>(null);
  readonly dismiss = output<void>();

  readonly isSubmitting = signal(false);
  readonly categories: PrayerCategoryDef[] = PRAYER_CATEGORIES;
  readonly selectedCategories = signal<string[]>(['Intercession & Nations']);

  readonly memberEmails = computed(() => {
    return this.firebaseService.activePartnership()?.memberEmails || [];
  });

  readonly form = new FormGroup({
    title: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    assignedPartner: new FormControl<string>('All Partners (Shared Agreement)', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    notes: new FormControl<string>('', { nonNullable: true }),
    status: new FormControl<'active' | 'answered' | 'waiting'>('active', {
      nonNullable: true,
    }),
  });

  ngOnInit() {
    const edit = this.editRequest();
    if (edit) {
      this.form.patchValue({
        title: edit.title,
        assignedPartner: edit.assignedPartner,
        notes: edit.notes || '',
        status: edit.status,
      });
      const cats = edit.categories && edit.categories.length > 0
        ? edit.categories
        : [edit.category || 'Intercession & Nations'];
      this.selectedCategories.set(cats);
    }
  }

  isCategorySelected(name: string): boolean {
    return this.selectedCategories().includes(name);
  }

  toggleCategory(name: string) {
    const current = this.selectedCategories();
    if (current.includes(name)) {
      if (current.length > 1) {
        this.selectedCategories.set(current.filter((c) => c !== name));
      }
    } else {
      this.selectedCategories.set([...current, name]);
    }
  }

  async submit() {
    if (this.form.invalid) return;
    const cats = this.selectedCategories();
    if (cats.length === 0) return;

    this.isSubmitting.set(true);
    const val = this.form.getRawValue();

    const edit = this.editRequest();
    try {
      if (edit) {
        await this.firebaseService.updateRequest({
          ...edit,
          title: val.title.trim(),
          category: cats[0],
          categories: cats,
          assignedPartner: val.assignedPartner,
          notes: val.notes.trim(),
          status: val.status,
        });
      } else {
        await this.firebaseService.addRequest({
          title: val.title.trim(),
          category: cats[0],
          categories: cats,
          assignedPartner: val.assignedPartner,
          notes: val.notes.trim(),
          status: 'active',
          dateAdded: this.firebaseService.getTodayDateString(),
        });
      }
      this.isSubmitting.set(false);
      this.dismiss.emit();
    } catch (err) {
      this.isSubmitting.set(false);
      console.error(err);
    }
  }
}
