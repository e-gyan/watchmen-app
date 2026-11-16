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
import { CATEGORY_COLOR_PALETTE, PrayerRequest } from '../models/prayer.model';
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
        class="modal-pop-in bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              Petitions
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              {{ editRequest() ? 'Edit Petition' : 'New Petition' }}
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
              Title
            </label>
            <input
              id="rTitle"
              type="text"
              formControlName="title"
              placeholder="Short petition title"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <!-- Custom Category Setup & Selection -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="block text-xs font-medium text-stone-300">
                Custom Categories
              </span>
              <span class="text-[11px] text-amber-400 font-mono tabular-nums">
                {{ selectedCategories().length }} selected
              </span>
            </div>

            <!-- Add Custom Category Bar -->
            <div class="flex items-center gap-2">
              <input
                type="text"
                [value]="newCategoryName()"
                (input)="newCategoryName.set($any($event.target).value)"
                (keydown.enter)="$event.preventDefault(); createCustomCategory()"
                placeholder="Create custom category..."
                class="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              />
              <div class="flex items-center gap-1">
                @for (color of colorPalette.slice(0, 4); track color) {
                  <button
                    type="button"
                    (click)="newCategoryColor.set(color)"
                    class="w-4 h-4 rounded-full border transition-transform"
                    [style.backgroundColor]="color"
                    [class]="newCategoryColor() === color ? 'scale-125 border-white' : 'border-transparent opacity-70'"
                    aria-label="Category color"
                  ></button>
                }
              </div>
              <button
                type="button"
                (click)="createCustomCategory()"
                class="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors shrink-0"
              >
                <mat-icon style="font-size: 14px;">add</mat-icon>
                <span>Add</span>
              </button>
            </div>

            @if (firebaseService.userCategories().length === 0) {
              <p class="text-[11px] text-stone-500 italic">
                No preset categories. Add your own custom categories above.
              </p>
            } @else {
              <div class="grid grid-cols-2 gap-2">
                @for (c of firebaseService.userCategories(); track c.name) {
                  <div
                    class="flex items-center justify-between gap-1 p-2 rounded-xl border text-xs transition-all"
                    [class]="
                      isCategorySelected(c.name)
                        ? 'bg-stone-800/90 border-amber-500 text-stone-100 font-medium'
                        : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700'
                    "
                  >
                    <button
                      type="button"
                      (click)="toggleCategory(c.name)"
                      class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      <span
                        class="w-2.5 h-2.5 rounded-full shrink-0"
                        [style.backgroundColor]="c.color"
                      ></span>
                      <span class="truncate text-[11px]">{{ c.name }}</span>
                    </button>
                    <button
                      type="button"
                      (click)="deleteCustomCategory(c.name)"
                      class="p-0.5 text-stone-500 hover:text-red-400 rounded shrink-0"
                      title="Delete category"
                    >
                      <mat-icon style="font-size: 13px;">close</mat-icon>
                    </button>
                  </div>
                }
              </div>
            }
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
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="answered">Answered</option>
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
              [disabled]="form.invalid || isSubmitting()"
              class="flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">bookmark_add</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : (editRequest() ? 'Save Changes' : 'Add Petition') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class RequestModal implements OnInit {
  readonly firebaseService = inject(FirebaseService);

  readonly editRequest = input<PrayerRequest | null>(null);
  readonly dismiss = output<void>();

  readonly isSubmitting = signal(false);
  readonly colorPalette = CATEGORY_COLOR_PALETTE;
  readonly newCategoryName = signal('');
  readonly newCategoryColor = signal(CATEGORY_COLOR_PALETTE[0]);
  readonly selectedCategories = signal<string[]>([]);

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
      const cats =
        edit.categories && edit.categories.length > 0
          ? edit.categories
          : edit.category
            ? [edit.category]
            : [];
      this.selectedCategories.set(cats);
    } else {
      const existing = this.firebaseService.userCategories();
      if (existing.length > 0) {
        this.selectedCategories.set([existing[0].name]);
      }
    }
  }

  async createCustomCategory() {
    const name = this.newCategoryName().trim();
    if (!name) return;
    await this.firebaseService.addCustomCategory(name, this.newCategoryColor(), 'label');
    this.newCategoryName.set('');
    if (!this.selectedCategories().includes(name)) {
      this.selectedCategories.set([...this.selectedCategories(), name]);
    }
  }

  async deleteCustomCategory(name: string) {
    await this.firebaseService.removeCustomCategory(name);
    this.selectedCategories.set(this.selectedCategories().filter((c) => c !== name));
  }

  isCategorySelected(name: string): boolean {
    return this.selectedCategories().includes(name);
  }

  toggleCategory(name: string) {
    const current = this.selectedCategories();
    if (current.includes(name)) {
      this.selectedCategories.set(current.filter((c) => c !== name));
    } else {
      this.selectedCategories.set([...current, name]);
    }
  }

  async submit() {
    if (this.form.invalid) return;
    const rawCats = this.selectedCategories();
    const cats = rawCats.length > 0 ? rawCats : ['Uncategorized'];

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
