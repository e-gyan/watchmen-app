import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';
import { CATEGORY_COLOR_PALETTE, Testimony } from '../models/prayer.model';

@Component({
  selector: 'app-testimony-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="modal-pop-in bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              {{ testimonyToEdit() ? 'Edit Memorial' : 'Praise Altar' }}
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              {{ testimonyToEdit() ? 'Update Testimony' : 'Record Testimony' }}
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

        @if (linkedSessionId()) {
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
            <mat-icon style="font-size: 18px;" class="text-amber-400 shrink-0">link</mat-icon>
            <span>Linked to recorded prayer session.</span>
          </div>
        }

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <!-- Title -->
          <div>
            <label for="tTitle" class="block text-xs font-medium text-stone-300 mb-1.5">
              Title
            </label>
            <input
              id="tTitle"
              type="text"
              formControlName="title"
              placeholder="Short title"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <!-- Date -->
          <div>
            <label for="tDate" class="block text-xs font-medium text-stone-300 mb-1.5">Date Answered</label>
            <input
              id="tDate"
              type="date"
              formControlName="date"
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
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                @for (cat of firebaseService.userCategories(); track cat.name) {
                  <div
                    class="flex items-center justify-between gap-1 p-2 rounded-xl border text-xs transition-all"
                    [class]="
                      isCategorySelected(cat.name)
                        ? 'bg-stone-800/90 border-amber-500 text-stone-100 font-medium'
                        : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700'
                    "
                  >
                    <button
                      type="button"
                      (click)="toggleCategory(cat.name)"
                      class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                    >
                      <span
                        class="w-2.5 h-2.5 rounded-full shrink-0"
                        [style.backgroundColor]="cat.color"
                      ></span>
                      <span class="truncate text-[11px]">{{ cat.name }}</span>
                    </button>
                    <button
                      type="button"
                      (click)="deleteCustomCategory(cat.name)"
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

          <!-- Prayer Request -->
          <div>
            <label for="tBurden" class="block text-xs font-medium text-stone-300 mb-1.5">
              Prayer Request
            </label>
            <textarea
              id="tBurden"
              rows="2"
              formControlName="prayerBurden"
              placeholder="What was prayed for"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
            ></textarea>
          </div>

          <!-- How God Answered -->
          <div>
            <label for="tAnswer" class="block text-xs font-medium text-stone-300 mb-1.5">
              Answer Note
            </label>
            <textarea
              id="tAnswer"
              rows="3"
              formControlName="answeredDetail"
              placeholder="Brief testimony note..."
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
            ></textarea>
          </div>

          <!-- Scripture -->
          <div>
            <label for="tScripture" class="block text-xs font-medium text-stone-300 mb-1.5">
              Scripture (optional)
            </label>
            <input
              id="tScripture"
              type="text"
              formControlName="scripturePraise"
              placeholder="Psalm 126:1"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

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
              <mat-icon style="font-size: 18px;">celebration</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : (testimonyToEdit() ? 'Update' : 'Save Testimony') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TestimonyModal implements OnInit {
  readonly firebaseService = inject(FirebaseService);

  readonly prefillBurden = input<string>('');
  readonly prefillTitle = input<string>('');
  readonly linkedSessionId = input<string | null>(null);
  readonly testimonyToEdit = input<Testimony | null>(null);

  readonly dismiss = output<void>();
  readonly saved = output<void>();

  readonly isSubmitting = signal(false);
  readonly colorPalette = CATEGORY_COLOR_PALETTE;
  readonly newCategoryName = signal('');
  readonly newCategoryColor = signal(CATEGORY_COLOR_PALETTE[0]);
  readonly selectedCategories = signal<string[]>([]);

  readonly form = new FormGroup({
    title: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    date: new FormControl<string>(new Date().toISOString().split('T')[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    prayerBurden: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    answeredDetail: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    scripturePraise: new FormControl<string>('', { nonNullable: true }),
  });

  ngOnInit() {
    const edit = this.testimonyToEdit();
    if (edit) {
      this.form.patchValue({
        title: edit.title,
        date: edit.date,
        prayerBurden: edit.prayerBurden,
        answeredDetail: edit.answeredDetail,
        scripturePraise: edit.scripturePraise || '',
      });
      const cats =
        edit.categories && edit.categories.length > 0
          ? edit.categories
          : edit.category
            ? [edit.category]
            : [];
      this.selectedCategories.set(cats);
    } else {
      if (this.prefillTitle()) {
        this.form.patchValue({ title: this.prefillTitle() });
      }
      if (this.prefillBurden()) {
        this.form.patchValue({ prayerBurden: this.prefillBurden() });
      }
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

    try {
      const edit = this.testimonyToEdit();
      if (edit) {
        await this.firebaseService.updateTestimony({
          ...edit,
          title: val.title.trim(),
          date: val.date,
          category: cats[0],
          categories: cats,
          prayerBurden: val.prayerBurden.trim(),
          answeredDetail: val.answeredDetail.trim(),
          scripturePraise: val.scripturePraise.trim(),
        });
      } else {
        await this.firebaseService.addTestimony({
          title: val.title.trim(),
          date: val.date,
          category: cats[0],
          categories: cats,
          prayerBurden: val.prayerBurden.trim(),
          answeredDetail: val.answeredDetail.trim(),
          scripturePraise: val.scripturePraise.trim(),
          linkedSessionId: this.linkedSessionId() || '',
        });
      }

      this.isSubmitting.set(false);
      this.saved.emit();
      this.dismiss.emit();
    } catch (err) {
      this.isSubmitting.set(false);
      console.error('Error saving testimony:', err);
    }
  }
}
