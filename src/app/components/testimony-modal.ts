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
import { PRAYER_CATEGORIES, PrayerCategoryDef, Testimony } from '../models/prayer.model';

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
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
          <div>
            <span class="text-xs font-semibold tracking-wider uppercase text-amber-500">
              {{ testimonyToEdit() ? 'Edit Memorial Record' : 'Praise & Memorial Altar' }}
            </span>
            <h2 class="text-xl sm:text-2xl font-serif font-bold text-stone-100">
              {{ testimonyToEdit() ? 'Update Answered Prayer' : 'Record Answered Prayer' }}
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
            <span>
              Allocating and connecting this testimony directly to the recorded prayer session.
            </span>
          </div>
        }

        <p class="text-xs text-stone-400 leading-relaxed">
          "They overcame him by the blood of the Lamb and by the word of their testimony." Document God's faithfulness so everyone in your prayer circle can rejoice together.
        </p>

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <!-- Title -->
          <div>
            <label for="tTitle" class="block text-xs font-medium text-stone-300 mb-1.5">
              Testimony Title
            </label>
            <input
              id="tTitle"
              type="text"
              formControlName="title"
              placeholder="e.g. Breakthrough: Full Scholarship Approved for Sister"
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

          <!-- Multiple Category Selection -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="block text-xs font-medium text-stone-300">
                Praise Categories (Select all that apply)
              </span>
              <span class="text-[11px] text-amber-400 font-mono">
                {{ selectedCategories().length }} selected
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              @for (cat of categories; track cat.name) {
                <button
                  type="button"
                  (click)="toggleCategory(cat.name)"
                  class="flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all"
                  [class]="
                    isCategorySelected(cat.name)
                      ? 'bg-stone-800/90 border-amber-500 text-stone-100 font-medium'
                      : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700'
                  "
                >
                  <mat-icon
                    [style.color]="cat.color"
                    style="font-size: 16px; width: 16px; height: 16px;"
                  >
                    {{ cat.icon }}
                  </mat-icon>
                  <span class="truncate flex-1 text-[11px]">{{ cat.name }}</span>
                  @if (isCategorySelected(cat.name)) {
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;" class="text-amber-400 shrink-0">
                      check_circle
                    </mat-icon>
                  }
                </button>
              }
            </div>
          </div>

          <!-- What We Asked (The Burden) -->
          <div>
            <label for="tBurden" class="block text-xs font-medium text-stone-300 mb-1.5">
              What Was Prayed About (The Petition / Burden)
            </label>
            <textarea
              id="tBurden"
              rows="2"
              formControlName="prayerBurden"
              placeholder="What was the original prayer request or burden carried to the altar?"
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
            ></textarea>
          </div>

          <!-- How God Answered (The Manifestation) -->
          <div>
            <label for="tAnswer" class="block text-xs font-medium text-stone-300 mb-1.5">
              How God Answered (The Praise Report)
            </label>
            <textarea
              id="tAnswer"
              rows="4"
              formControlName="answeredDetail"
              placeholder="Document the exact details of how God answered: what happened, when it took place, and how His power was revealed..."
              class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
            ></textarea>
          </div>

          <!-- Scripture of Praise -->
          <div>
            <label for="tScripture" class="block text-xs font-medium text-stone-300 mb-1.5">
              Scripture of Praise or Thanksgiving (optional)
            </label>
            <input
              id="tScripture"
              type="text"
              formControlName="scripturePraise"
              placeholder="e.g. Psalm 126:1-3, Ephesians 3:20, Luke 1:45"
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
              [disabled]="form.invalid || isSubmitting() || selectedCategories().length === 0"
              class="flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">celebration</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : (testimonyToEdit() ? 'Update Testimony' : 'Publish to Praise Altar') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TestimonyModal implements OnInit {
  private firebaseService = inject(FirebaseService);

  readonly prefillBurden = input<string>('');
  readonly prefillTitle = input<string>('');
  readonly linkedSessionId = input<string | null>(null);
  readonly testimonyToEdit = input<Testimony | null>(null);

  readonly dismiss = output<void>();
  readonly saved = output<void>();

  readonly isSubmitting = signal(false);
  readonly categories: PrayerCategoryDef[] = PRAYER_CATEGORIES;
  readonly selectedCategories = signal<string[]>(['Thanksgiving & Altar']);

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
      const cats = edit.categories && edit.categories.length > 0
        ? edit.categories
        : [edit.category || 'Thanksgiving & Altar'];
      this.selectedCategories.set(cats);
    } else {
      if (this.prefillTitle()) {
        this.form.patchValue({ title: this.prefillTitle() });
      }
      if (this.prefillBurden()) {
        this.form.patchValue({ prayerBurden: this.prefillBurden() });
      }
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
