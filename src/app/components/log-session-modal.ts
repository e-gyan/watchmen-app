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
import { PRAYER_CATEGORIES, PrayerCategoryDef, PrayerSession } from '../models/prayer.model';

@Component({
  selector: 'app-log-session-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="bg-stone-900 border border-stone-800 rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-7 space-y-5 transition-all"
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
              Prayer Mode (Individual or Partner)
            </span>

            <div class="grid grid-cols-2 gap-2.5">
              <!-- Individual Option -->
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

              <!-- Partner / Agreement Option -->
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
            <!-- Date (Hidden in Quick Time Mode to focus strictly on Hours/Minutes + Individual/Partner) -->
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
                class="text-xs py-1 px-2.5 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100 transition-colors"
              >
                {{ preset.label }}
              </button>
            }
          </div>

          <!-- Extended Details: Only shown if no prayer recorded yet for this day, or when editing/expanded -->
          @if (!isQuickTimeMode()) {
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

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                @for (cat of categories; track cat.name) {
                  <button
                    type="button"
                    (click)="toggleCategory(cat.name)"
                    class="flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all relative overflow-hidden"
                    [class]="
                      isCategorySelected(cat.name)
                        ? 'bg-stone-800/90 border-amber-500 text-stone-100 font-medium shadow-xs'
                        : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                    "
                  >
                    <mat-icon
                      [style.color]="cat.color"
                      style="font-size: 16px; width: 16px; height: 16px;"
                    >
                      {{ cat.icon }}
                    </mat-icon>
                    <span class="truncate flex-1">{{ cat.name }}</span>
                    @if (isCategorySelected(cat.name)) {
                      <mat-icon style="font-size: 14px; width: 14px; height: 14px;" class="text-amber-400 shrink-0">
                        check_circle
                      </mat-icon>
                    }
                  </button>
                }
              </div>
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

            <!-- Session Notes: What was prayed about? -->
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
          <div class="flex items-center justify-between pt-3 border-t border-stone-800/80">
            <button
              type="button"
              (click)="dismiss.emit()"
              class="py-2 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              [disabled]="isSubmitting() || (!isQuickTimeMode() && selectedCategories().length === 0)"
              class="flex items-center gap-1.5 py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md"
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

  readonly categories: PrayerCategoryDef[] = PRAYER_CATEGORIES;
  readonly selectedCategories = signal<string[]>(['Adoration & Praise']);

  readonly presets = [
    { label: '15m', h: 0, m: 15 },
    { label: '30m', h: 0, m: 30 },
    { label: '45m', h: 0, m: 45 },
    { label: '1h', h: 1, m: 0 },
    { label: '1.5h', h: 1, m: 30 },
    { label: '2h', h: 2, m: 0 },
  ];

  // Sessions already recorded for the selected date
  readonly existingSessionsForDate = computed(() => {
    const d = this.selectedDate();
    return this.firebaseService.sessions().filter((s) => s.date === d);
  });

  readonly existingMinutesFormatted = computed(() => {
    const total = this.existingSessionsForDate().reduce((sum, s) => sum + s.durationMinutes, 0);
    return this.firebaseService.formatMinutes(total);
  });

  // When a prayer is already recorded for the day (and not editing), show only Hours/Minutes + Individual/Partner
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

      const cats = edit.categories && edit.categories.length > 0
        ? edit.categories
        : [edit.category || 'Adoration & Praise'];
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
    }
  }

  onDateChange(newDate: string) {
    if (newDate) {
      this.selectedDate.set(newDate);
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

    const existing = this.existingSessionsForDate();
    const cats =
      this.isQuickTimeMode() && existing.length > 0
        ? existing[0].categories && existing[0].categories.length > 0
          ? existing[0].categories
          : [existing[0].category || 'Adoration & Praise']
        : this.selectedCategories();

    if (cats.length === 0) return;

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
