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
import { FirebaseService } from '../services/firebase.service';
import { CATEGORY_COLOR_PALETTE, PrayerSession } from '../models/prayer.model';

@Component({
  selector: 'app-log-session-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  host: {
    '(window:keydown.escape)': 'dismiss.emit()',
  },
  template: `
    <div
      data-no-swipe="true"
      class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm modal-backdrop-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close log prayer modal"
        (click)="dismiss.emit()"
        class="fixed inset-0 w-full h-full cursor-default focus:outline-none"
      ></button>
      <div
        class="relative z-10 bg-stone-900 border border-stone-800 rounded-2xl w-full max-h-[85dvh] overflow-y-auto shadow-2xl p-5 sm:p-7 space-y-5 modal-pop-in my-auto"
        [class]="isQuickTimeMode() ? 'max-w-md' : 'max-w-xl'"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-3.5">
          <div>
            <span class="text-[11px] font-semibold tracking-wider uppercase text-amber-500">
              {{
                sessionToEdit()
                  ? 'Edit Record'
                  : isQuickTimeMode()
                    ? 'Quick Log · ' + selectedDate()
                    : 'Prayer Log'
              }}
            </span>
            <h2 class="text-lg sm:text-xl font-serif font-bold text-stone-100">
              {{
                sessionToEdit()
                  ? 'Update Prayer'
                  : isQuickTimeMode()
                    ? 'Add Prayer Time'
                    : 'Record Prayer'
              }}
            </h2>
          </div>
          <button
            type="button"
            (click)="dismiss.emit()"
            class="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800/80 transition-colors"
            aria-label="Close modal"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>

        @if (isQuickTimeMode()) {
          <div class="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 text-amber-300">
              <mat-icon style="font-size: 16px;" class="text-amber-400 shrink-0">schedule</mat-icon>
              <span>Already logged <strong>{{ existingMinutesFormatted() }}</strong> for this day.</span>
            </div>
            <button
              type="button"
              (click)="showFullFormOverride.set(true)"
              class="text-[11px] font-semibold text-amber-400 hover:underline shrink-0"
            >
              Full form
            </button>
          </div>
        }

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5">
          <!-- Mode: Individual or Partner -->
          <div>
            <span class="block text-xs font-medium text-stone-300 mb-2">
              Prayer Mode
            </span>

            <div class="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                (click)="setParticipant(currentUserName(), false)"
                class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all"
                [class]="
                  !form.value.wasTogether
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold shadow-xs'
                    : 'bg-stone-800/50 border-stone-700/60 text-stone-400 hover:border-stone-600'
                "
              >
                <mat-icon style="font-size: 16px;">person</mat-icon>
                <span>Individual ({{ currentUserName() }})</span>
              </button>

              <button
                type="button"
                (click)="setParticipant('Circle Agreement', true)"
                class="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all"
                [class]="
                  form.value.wasTogether
                    ? 'bg-amber-400 text-stone-950 font-bold border-amber-400 shadow-sm'
                    : 'bg-stone-800/50 border-stone-700/60 text-stone-400 hover:border-stone-600'
                "
              >
                <mat-icon style="font-size: 16px;">people</mat-icon>
                <span>Partner Agreement</span>
              </button>
            </div>

            @if (!form.value.wasTogether && otherPartnerEmails().length > 0 && !isQuickTimeMode()) {
              <div class="flex flex-wrap items-center gap-1.5 mt-2">
                <span class="text-[11px] text-stone-500">Log for partner:</span>
                <button
                  type="button"
                  (click)="setParticipant(currentUserName(), false)"
                  class="text-[11px] py-0.5 px-2 rounded-md border transition-colors"
                  [class]="
                    form.value.participantName === currentUserName()
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400'
                  "
                >
                  {{ currentUserName() }}
                </button>
                @for (email of otherPartnerEmails(); track email) {
                  <button
                    type="button"
                    (click)="setParticipant(email.split('@')[0], false)"
                    class="text-[11px] py-0.5 px-2 rounded-md border transition-colors"
                    [class]="
                      form.value.participantName === email.split('@')[0]
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-stone-900 border-stone-800 text-stone-400'
                    "
                  >
                    {{ email.split('@')[0] }}
                  </button>
                }
              </div>
            }
          </div>

          <!-- Date & Duration row -->
          <div class="grid grid-cols-1 gap-4" [class]="isQuickTimeMode() ? 'sm:grid-cols-1' : 'sm:grid-cols-3'">
            @if (!isQuickTimeMode()) {
              <div class="sm:col-span-1">
                <label for="pDate" class="block text-xs font-medium text-stone-300 mb-1.5">Date</label>
                <input
                  id="pDate"
                  type="date"
                  formControlName="date"
                  (change)="onDateChange($any($event.target).value)"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            }

            <!-- Hours & Mins Duration -->
            <div [class]="isQuickTimeMode() ? 'col-span-1' : 'sm:col-span-2'">
              <span class="block text-xs font-medium text-stone-300 mb-1.5">Duration (Hours &amp; Minutes)</span>
              <div class="grid grid-cols-2 gap-2.5">
                <div class="relative">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    formControlName="hours"
                    placeholder="0"
                    class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-sm text-stone-100 tabular-nums focus:outline-none focus:border-amber-500 pr-12"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-stone-500 pointer-events-none">hrs</span>
                </div>
                <div class="relative">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    formControlName="minutes"
                    placeholder="30"
                    class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-sm text-stone-100 tabular-nums focus:outline-none focus:border-amber-500 pr-12"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-stone-500 pointer-events-none">mins</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Duration presets -->
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-stone-500 mr-1">Presets:</span>
            @for (preset of presets; track preset.label) {
              <button
                type="button"
                (click)="setPreset(preset.h, preset.m)"
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100 transition-colors font-mono tabular-nums"
              >
                {{ preset.label }}
              </button>
            }
          </div>

          <!-- Extended Details -->
          @if (!isQuickTimeMode()) {
            <!-- Custom User Category Setup -->
            <div class="space-y-2.5 p-3.5 rounded-xl bg-stone-950/70 border border-stone-800">
              <div class="flex items-center justify-between">
                <span class="block text-xs font-medium text-stone-300">
                  Your Categories
                </span>
                <span class="text-[11px] text-amber-400 font-mono tabular-nums">
                  {{ selectedCategories().length }} selected
                </span>
              </div>

              <!-- Add New Custom Category Input -->
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  [value]="newCategoryName()"
                  (input)="newCategoryName.set($any($event.target).value)"
                  (keydown.enter)="$event.preventDefault(); addNewCategory()"
                  placeholder="Create your category (e.g. Morning Watch, Family)..."
                  class="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
                <div class="flex items-center gap-1">
                  @for (c of colorOptions; track c) {
                    <button
                      type="button"
                      (click)="newCategoryColor.set(c)"
                      class="w-4 h-4 rounded-full border transition-transform"
                      [style.background-color]="c"
                      [class]="newCategoryColor() === c ? 'scale-125 border-white' : 'border-transparent opacity-70'"
                      title="Pick category color"
                    ></button>
                  }
                </div>
                <button
                  type="button"
                  (click)="addNewCategory()"
                  class="flex items-center gap-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold shrink-0"
                >
                  <mat-icon style="font-size: 15px;">add</mat-icon>
                  <span>Add</span>
                </button>
              </div>

              <!-- User's Custom Categories List -->
              @if (userCategories().length === 0) {
                <p class="text-[11px] text-stone-500">
                  No categories set up yet. Type a category name above and tap Add.
                </p>
              } @else {
                <div class="flex flex-wrap gap-1.5 pt-1">
                  @for (cat of userCategories(); track cat.name) {
                    <div
                      class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl border text-xs transition-all"
                      [class]="
                        isCategorySelected(cat.name)
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                      "
                    >
                      <button
                        type="button"
                        (click)="toggleCategory(cat.name)"
                        class="flex items-center gap-1.5 text-left"
                      >
                        <span
                          class="w-2 h-2 rounded-full shrink-0"
                          [style.background-color]="cat.color"
                        ></span>
                        <span>{{ cat.name }}</span>
                      </button>
                      <button
                        type="button"
                        (click)="removeCategory(cat.name)"
                        class="p-0.5 rounded text-stone-500 hover:text-red-400 transition-colors"
                        title="Remove category"
                      >
                        <mat-icon style="font-size: 12px; width: 12px; height: 12px;">close</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Topics & Scripture on a clean 2-col row -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="pTopics" class="block text-xs font-medium text-stone-300 mb-1">
                  Topics
                </label>
                <input
                  id="pTopics"
                  type="text"
                  formControlName="topics"
                  placeholder="Family, Healing"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label for="pScripture" class="block text-xs font-medium text-stone-300 mb-1">
                  Scripture (optional)
                </label>
                <input
                  id="pScripture"
                  type="text"
                  formControlName="scripture"
                  placeholder="Psalm 91:1"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <!-- Session Notes -->
            <div>
              <label for="pNotes" class="block text-xs font-medium text-stone-300 mb-1">
                Prayer Focus / Notes
              </label>
              <textarea
                id="pNotes"
                rows="3"
                formControlName="notes"
                placeholder="Brief prayer notes..."
                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500 leading-relaxed"
              ></textarea>
            </div>
          }

          <!-- Modal Actions -->
          <div class="grid grid-cols-2 sm:flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="w-full sm:w-auto flex items-center justify-center gap-1 py-2.5 sm:py-2 px-4 rounded-xl text-xs font-medium text-stone-300 bg-stone-800/70 hover:bg-stone-800 hover:text-stone-100 transition-colors"
            >
              <mat-icon style="font-size: 15px;">close</mat-icon>
              <span>Cancel</span>
            </button>

            <button
              type="submit"
              [disabled]="isSubmitting()"
              class="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
            >
              <mat-icon style="font-size: 18px;">{{ sessionToEdit() ? 'save' : 'done_all' }}</mat-icon>
              <span>{{ isSubmitting() ? 'Saving...' : (sessionToEdit() ? 'Update' : 'Save Prayer') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class LogSessionModal implements OnInit {
  private firebaseService = inject(FirebaseService);

  readonly initialMinutes = input<number>(0);
  readonly initialDate = input<string | null>(null);
  readonly sessionToEdit = input<PrayerSession | null>(null);

  readonly dismiss = output<void>();
  readonly saved = output<void>();

  readonly isSubmitting = signal(false);
  readonly showFullFormOverride = signal(false);
  readonly selectedDate = signal<string>(new Date().toISOString().split('T')[0]);

  readonly userCategories = this.firebaseService.userCategories;
  readonly selectedCategories = signal<string[]>([]);
  readonly newCategoryName = signal<string>('');
  readonly colorOptions = CATEGORY_COLOR_PALETTE.slice(0, 5);
  readonly newCategoryColor = signal<string>(CATEGORY_COLOR_PALETTE[0]);

  readonly presets = [
    { label: '15m', h: 0, m: 15 },
    { label: '30m', h: 0, m: 30 },
    { label: '45m', h: 0, m: 45 },
    { label: '1h', h: 1, m: 0 },
    { label: '1.5h', h: 1, m: 30 },
    { label: '2h', h: 2, m: 0 },
  ];

  readonly existingSessionsForDate = computed(() => {
    const d = this.selectedDate();
    return this.firebaseService.sessions().filter((s) => s.date === d);
  });

  readonly existingMinutesFormatted = computed(() => {
    const total = this.existingSessionsForDate().reduce((sum, s) => sum + s.durationMinutes, 0);
    return this.firebaseService.formatMinutes(total);
  });

  readonly isQuickTimeMode = computed(() => {
    if (this.sessionToEdit()) return false;
    if (this.showFullFormOverride()) return false;
    return this.existingSessionsForDate().length > 0;
  });

  readonly currentUserName = computed(() => {
    const user = this.firebaseService.currentUser();
    if (!user) return 'Me';
    return user.displayName || user.email?.split('@')[0] || 'Me';
  });

  readonly otherPartnerEmails = computed(() => {
    const p = this.firebaseService.activePartnership();
    const user = this.firebaseService.currentUser();
    if (!p || !user) return [];
    const myEmail = (user.email || '').toLowerCase();
    return p.memberEmails.filter((e) => e.toLowerCase() !== myEmail);
  });

  readonly form = new FormGroup({
    date: new FormControl<string>(new Date().toISOString().split('T')[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    hours: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(24)],
    }),
    minutes: new FormControl<number>(45, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(59)],
    }),
    topics: new FormControl<string>('', { nonNullable: true }),
    scripture: new FormControl<string>('', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
    participantName: new FormControl<string>('Me', { nonNullable: true }),
    wasTogether: new FormControl<boolean>(false, { nonNullable: true }),
  });

  ngOnInit() {
    const todayStr = this.firebaseService.getTodayDateString();
    this.form.patchValue({ date: todayStr });
    this.selectedDate.set(todayStr);

    const edit = this.sessionToEdit();
    if (edit) {
      const h = Math.floor(edit.durationMinutes / 60);
      const m = edit.durationMinutes % 60;
      this.form.patchValue({
        date: edit.date,
        hours: h,
        minutes: m,
        topics: (edit.topics || []).join(', '),
        scripture: edit.scripture || '',
        notes: edit.notes,
        participantName: edit.authorName,
        wasTogether: !!edit.wasTogether,
      });
      this.selectedDate.set(edit.date);

      const cats =
        edit.categories && edit.categories.length > 0
          ? edit.categories
          : edit.category
            ? [edit.category]
            : [];
      this.selectedCategories.set(cats);
    } else {
      const initMins = this.initialMinutes();
      if (initMins > 0) {
        const h = Math.floor(initMins / 60);
        const m = initMins % 60;
        this.form.patchValue({ hours: h, minutes: m });
      }
      const targetDate = this.initialDate();
      if (targetDate) {
        this.form.patchValue({ date: targetDate });
        this.selectedDate.set(targetDate);
      }
      this.form.patchValue({ participantName: this.currentUserName() });

      const currentCats = this.userCategories();
      if (currentCats.length > 0) {
        this.selectedCategories.set([currentCats[0].name]);
      }
    }
  }

  onDateChange(newDate: string) {
    if (newDate) {
      this.selectedDate.set(newDate);
    }
  }

  async addNewCategory() {
    const name = this.newCategoryName().trim();
    if (!name) return;
    const created = await this.firebaseService.addCustomCategory(
      name,
      this.newCategoryColor()
    );
    if (created) {
      const curr = this.selectedCategories();
      if (!curr.includes(created.name)) {
        this.selectedCategories.set([...curr, created.name]);
      }
      this.newCategoryName.set('');
    }
  }

  async removeCategory(name: string) {
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

  setParticipant(name: string, together: boolean) {
    this.form.patchValue({
      participantName: name,
      wasTogether: together,
    });
  }

  setPreset(h: number, m: number) {
    this.form.patchValue({ hours: h, minutes: m });
  }

  async submit() {
    const val = this.form.getRawValue();
    const durationMins = val.hours * 60 + val.minutes;
    if (durationMins <= 0) return;

    // If user typed a category name in the input without clicking Add, auto-create and select it
    const pendingCat = this.newCategoryName().trim();
    if (pendingCat) {
      await this.addNewCategory();
    }

    const existing = this.existingSessionsForDate();
    let cats =
      this.isQuickTimeMode() && existing.length > 0
        ? existing[0].categories && existing[0].categories.length > 0
          ? existing[0].categories
          : [existing[0].category || 'Prayer']
        : this.selectedCategories();

    if (cats.length === 0) {
      const userCats = this.userCategories();
      cats = userCats.length > 0 ? [userCats[0].name] : ['Prayer'];
    }

    this.isSubmitting.set(true);

    const topicArr = val.topics
      ? val.topics
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    const cleanNotes =
      val.notes.trim() ||
      (val.wasTogether ? 'Partner prayer watch' : 'Individual prayer watch');

    try {
      const edit = this.sessionToEdit();
      if (edit) {
        await this.firebaseService.updateSession({
          ...edit,
          date: val.date,
          durationMinutes: durationMins,
          category: cats[0],
          categories: cats,
          topics: topicArr,
          scripture: val.scripture.trim(),
          notes: cleanNotes,
          participantNames: [val.participantName],
          wasTogether: val.wasTogether,
        });
      } else {
        await this.firebaseService.addSession({
          date: val.date,
          durationMinutes: durationMins,
          category: cats[0],
          categories: cats,
          topics: topicArr,
          scripture: val.scripture.trim(),
          notes: cleanNotes,
          participantNames: [val.participantName],
          wasTogether: val.wasTogether,
        });
      }

      this.isSubmitting.set(false);
      this.saved.emit();
      this.dismiss.emit();
    } catch (err) {
      this.isSubmitting.set(false);
      console.error('Error saving prayer session:', err);
    }
  }
}
