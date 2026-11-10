import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';
import { MessageListeningRecord } from '../models/prayer.model';

@Component({
  selector: 'app-messages-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Word Intake
          </span>
          <h1 class="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
            Messages
          </h1>
          <p class="text-xs text-stone-400 mt-0.5">
            Log and repeat message listening time.
          </p>
        </div>

        <button
          type="button"
          (click)="openForm()"
          class="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-md shrink-0"
        >
          <mat-icon style="font-size: 18px;">add</mat-icon>
          <span>Log Message</span>
        </button>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Total Time
          </span>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-amber-400 tabular-nums">
            {{ firebaseService.formatHours(totalListeningMinutes()) }} hrs
          </div>
          <span class="text-[11px] text-stone-500 font-mono tabular-nums">
            {{ firebaseService.formatMinutes(totalListeningMinutes()) }} total
          </span>
        </div>

        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
            This Week
          </span>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-stone-100 tabular-nums">
            {{ firebaseService.formatMinutes(thisWeekListeningMinutes()) }}
          </div>
          <span class="text-[11px] text-stone-500 font-mono tabular-nums">
            {{ firebaseService.formatHours(thisWeekListeningMinutes()) }} hrs
          </span>
        </div>

        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Messages
          </span>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-emerald-400 tabular-nums">
            {{ filteredMessages().length }}
          </div>
          <span class="text-[11px] text-stone-500 font-mono tabular-nums">
            {{ firebaseService.totalMessageRepeats() }} total listenings
          </span>
        </div>
      </div>

      <!-- Inline Log / Edit Form Card -->
      @if (showForm()) {
        <div class="rounded-2xl bg-stone-900 border border-amber-500/40 p-5 sm:p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <h2 class="text-base font-serif font-bold text-stone-100">
              {{ editingMessage() ? 'Edit Message' : 'Log Message' }}
            </h2>
            <button
              type="button"
              (click)="closeForm()"
              class="text-stone-400 hover:text-stone-100 p-1 rounded-lg hover:bg-stone-800"
              aria-label="Close form"
            >
              <mat-icon style="font-size: 18px;">close</mat-icon>
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Message Title -->
              <div>
                <label for="msgTitle" class="block text-xs font-medium text-stone-300 mb-1">
                  Title
                </label>
                <input
                  id="msgTitle"
                  type="text"
                  formControlName="title"
                  placeholder="Message title"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <!-- Speaker / Minister (Optional) -->
              <div>
                <label for="msgSpeaker" class="block text-xs font-medium text-stone-300 mb-1">
                  Speaker (optional)
                </label>
                <input
                  id="msgSpeaker"
                  type="text"
                  formControlName="speaker"
                  placeholder="Speaker"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <!-- Date & Duration (Hours / Minutes) + Mode -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="msgDate" class="block text-xs font-medium text-stone-300 mb-1">
                  Date
                </label>
                <input
                  id="msgDate"
                  type="date"
                  formControlName="date"
                  class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <span class="block text-xs font-medium text-stone-300 mb-1">
                  Duration
                </span>
                <div class="grid grid-cols-2 gap-2">
                  <div class="relative">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      formControlName="hours"
                      aria-label="Hours spent listening"
                      class="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                    <span class="absolute right-2.5 top-2 text-[11px] text-stone-500">hrs</span>
                  </div>
                  <div class="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      formControlName="minutes"
                      aria-label="Minutes spent listening"
                      class="w-full bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                    <span class="absolute right-2.5 top-2 text-[11px] text-stone-500">mins</span>
                  </div>
                </div>
              </div>

              <!-- Individual vs Partner -->
              <div>
                <span class="block text-xs font-medium text-stone-300 mb-1">
                  Mode
                </span>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="form.controls.wasTogether.setValue(false)"
                    class="py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      !form.controls.wasTogether.value
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 15px;">person</mat-icon>
                    <span>Individual</span>
                  </button>
                  <button
                    type="button"
                    (click)="form.controls.wasTogether.setValue(true)"
                    class="py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all"
                    [class]="
                      form.controls.wasTogether.value
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    "
                  >
                    <mat-icon style="font-size: 15px;">groups</mat-icon>
                    <span>Partner</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Key Takeaway / Note -->
            <div>
              <label for="msgNotes" class="block text-xs font-medium text-stone-300 mb-1">
                Note (optional)
              </label>
              <textarea
                id="msgNotes"
                rows="2"
                formControlName="notes"
                placeholder="Brief takeaway"
                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              ></textarea>
            </div>

            @if (errorMsg()) {
              <div class="p-2.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                {{ errorMsg() }}
              </div>
            }

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                (click)="closeForm()"
                class="py-2 px-4 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-100 hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="isSaving()"
                class="flex items-center gap-1.5 py-2 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 shadow-md"
              >
                <mat-icon style="font-size: 16px;">check</mat-icon>
                <span>{{ isSaving() ? 'Saving...' : (editingMessage() ? 'Update' : 'Save') }}</span>
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Recorded Messages List -->
      @if (filteredMessages().length === 0) {
        <div class="text-center py-12 px-4 rounded-2xl bg-stone-900/50 border border-stone-800 space-y-3">
          <mat-icon class="text-stone-600" style="font-size: 40px;">headphones</mat-icon>
          <h3 class="text-base font-semibold text-stone-300">No messages yet</h3>
          <p class="text-xs text-stone-500 max-w-sm mx-auto">
            Log your first message and duration.
          </p>
          <button
            type="button"
            (click)="openForm()"
            class="py-2 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400"
          >
            Log Message
          </button>
        </div>
      } @else {
        <div class="space-y-3">
          @for (msg of filteredMessages(); track msg.id) {
            @let baseMins = msg.initialDurationMinutes || msg.durationMinutes;
            <div class="rounded-2xl bg-stone-900 border border-stone-800 p-4 sm:p-5 space-y-3 hover:border-stone-700 transition-all">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="space-y-1.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs tabular-nums">
                      Total: {{ firebaseService.formatMinutes(msg.durationMinutes) }}
                      ({{ firebaseService.formatHours(msg.durationMinutes) }}h)
                    </span>
                    <span class="px-2 py-0.5 rounded-lg bg-stone-800 text-stone-300 font-mono text-[11px] tabular-nums">
                      Initial: {{ firebaseService.formatMinutes(baseMins) }}
                    </span>
                    <span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-semibold tabular-nums">
                      {{ msg.listenCount || 1 }}x listened
                    </span>
                    <span class="text-xs font-mono text-stone-400">{{ msg.date }}</span>
                    <span class="text-stone-600">·</span>
                    <span class="text-xs text-stone-300 font-medium">By {{ msg.authorName }}</span>
                    <span
                      class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      [class]="
                        msg.wasTogether
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-stone-800 text-stone-300'
                      "
                    >
                      {{ msg.wasTogether ? 'With Partner' : 'Individual' }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-baseline gap-2">
                    <h3 class="text-base font-serif font-bold text-stone-100">{{ msg.title }}</h3>
                    @if (msg.speaker) {
                      <span class="text-xs text-amber-400/90 font-medium">— {{ msg.speaker }}</span>
                    }
                  </div>

                  @if (msg.notes) {
                    <p class="text-xs text-stone-300 leading-relaxed whitespace-pre-line">
                      {{ msg.notes }}
                    </p>
                  }
                </div>

                <!-- Action Buttons: Repeat Initial Time, Add More Time, Edit, Delete -->
                <div class="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    [disabled]="isSaving()"
                    (click)="repeatInitialTime(msg)"
                    class="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                    title="Repeat initial recorded listening time and add to total"
                  >
                    <mat-icon style="font-size: 15px;">replay</mat-icon>
                    <span>Repeat (+{{ firebaseService.formatMinutes(baseMins) }})</span>
                  </button>

                  <button
                    type="button"
                    (click)="toggleAddTimePanel(msg.id)"
                    class="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-colors"
                    [class]="
                      addingTimeForId() === msg.id
                        ? 'bg-emerald-500 text-stone-950 border-emerald-500'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                    "
                    title="Add more listening time to this message"
                  >
                    <mat-icon style="font-size: 15px;">more_time</mat-icon>
                    <span>+ Add Time</span>
                  </button>

                  <button
                    type="button"
                    (click)="editRecord(msg)"
                    class="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors"
                    title="Edit Message"
                  >
                    <mat-icon style="font-size: 16px;">edit</mat-icon>
                  </button>
                  <button
                    type="button"
                    (click)="deleteRecord(msg.id)"
                    class="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    title="Delete Message"
                  >
                    <mat-icon style="font-size: 16px;">delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Inline Add More Time Panel for this Message -->
              @if (addingTimeForId() === msg.id) {
                <div class="pt-3 border-t border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-950/70 p-3 rounded-xl">
                  <div class="text-xs text-stone-300">
                    <span class="font-semibold text-amber-400">Add More Listening Time</span>
                    <span class="text-stone-400 ml-1">
                      (Current total: {{ firebaseService.formatMinutes(msg.durationMinutes) }})
                    </span>
                  </div>

                  <form [formGroup]="addTimeForm" (ngSubmit)="submitAddedTime(msg)" class="flex flex-wrap items-center gap-2">
                    <div class="relative w-20">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        formControlName="hours"
                        aria-label="Additional hours"
                        class="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                      <span class="absolute right-2 top-1.5 text-[10px] text-stone-400">hrs</span>
                    </div>
                    <div class="relative w-20">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        formControlName="minutes"
                        aria-label="Additional minutes"
                        class="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                      <span class="absolute right-2 top-1.5 text-[10px] text-stone-400">mins</span>
                    </div>
                    <button
                      type="submit"
                      [disabled]="isSaving()"
                      class="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-semibold disabled:opacity-50"
                    >
                      <mat-icon style="font-size: 14px;">check</mat-icon>
                      <span>Add to Total</span>
                    </button>
                    <button
                      type="button"
                      (click)="addingTimeForId.set(null)"
                      class="py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MessagesTracker {
  readonly firebaseService = inject(FirebaseService);
  readonly saved = output<string>();

  readonly showForm = signal(false);
  readonly isSaving = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly editingMessage = signal<MessageListeningRecord | null>(null);
  readonly addingTimeForId = signal<string | null>(null);

  readonly form = new FormGroup({
    title: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    speaker: new FormControl<string>('', { nonNullable: true }),
    date: new FormControl<string>(this.firebaseService.getTodayDateString(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    hours: new FormControl<number>(1, { nonNullable: true, validators: [Validators.min(0)] }),
    minutes: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    wasTogether: new FormControl<boolean>(false, { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  readonly addTimeForm = new FormGroup({
    hours: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    minutes: new FormControl<number>(30, { nonNullable: true, validators: [Validators.min(0)] }),
  });

  readonly filteredMessages = computed(() => {
    const filter = this.firebaseService.activeFilterMember();
    const all = this.firebaseService.messages();
    if (filter === 'all') return all;
    return all.filter((m) => m.authorUid === filter || m.authorName === filter);
  });

  readonly totalListeningMinutes = computed(() => {
    return this.filteredMessages().reduce((sum, m) => sum + (Number(m.durationMinutes) || 0), 0);
  });

  readonly thisWeekListeningMinutes = computed(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const d = String(monday.getDate()).padStart(2, '0');
    const mondayStr = `${y}-${m}-${d}`;

    return this.filteredMessages()
      .filter((msg) => msg.date >= mondayStr)
      .reduce((sum, msg) => sum + (Number(msg.durationMinutes) || 0), 0);
  });

  openForm() {
    this.editingMessage.set(null);
    this.addingTimeForId.set(null);
    this.errorMsg.set(null);
    this.form.reset({
      title: '',
      speaker: '',
      date: this.firebaseService.getTodayDateString(),
      hours: 1,
      minutes: 0,
      wasTogether: false,
      notes: '',
    });
    this.showForm.set(true);
  }

  editRecord(msg: MessageListeningRecord) {
    this.editingMessage.set(msg);
    this.addingTimeForId.set(null);
    this.errorMsg.set(null);
    const hrs = Math.floor((msg.durationMinutes || 0) / 60);
    const mins = Math.round((msg.durationMinutes || 0) % 60);
    this.form.reset({
      title: msg.title,
      speaker: msg.speaker || '',
      date: msg.date,
      hours: hrs,
      minutes: mins,
      wasTogether: !!msg.wasTogether,
      notes: msg.notes || '',
    });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingMessage.set(null);
    this.errorMsg.set(null);
  }

  toggleAddTimePanel(msgId: string) {
    if (this.addingTimeForId() === msgId) {
      this.addingTimeForId.set(null);
      return;
    }
    this.addTimeForm.reset({ hours: 0, minutes: 30 });
    this.addingTimeForId.set(msgId);
  }

  async repeatInitialTime(msg: MessageListeningRecord) {
    const baseMins = Math.max(1, Number(msg.initialDurationMinutes) || Number(msg.durationMinutes) || 0);
    this.isSaving.set(true);
    try {
      await this.firebaseService.addMoreTimeToMessage(msg, baseMins);
      this.saved.emit(
        `Repeated +${this.firebaseService.formatMinutes(baseMins)} for "${msg.title}"!`
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  async submitAddedTime(msg: MessageListeningRecord) {
    const val = this.addTimeForm.getRawValue();
    const addedMins = (Number(val.hours) || 0) * 60 + (Number(val.minutes) || 0);
    if (addedMins <= 0) return;

    this.isSaving.set(true);
    try {
      await this.firebaseService.addMoreTimeToMessage(msg, addedMins);
      this.addingTimeForId.set(null);
      this.saved.emit(
        `Added +${this.firebaseService.formatMinutes(addedMins)} to "${msg.title}"!`
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  async submit() {
    const val = this.form.getRawValue();
    if (!val.title.trim()) {
      this.errorMsg.set('Please enter the message title.');
      return;
    }
    const totalMinutes = (Number(val.hours) || 0) * 60 + (Number(val.minutes) || 0);
    if (totalMinutes <= 0) {
      this.errorMsg.set('Please enter hours or minutes spent listening.');
      return;
    }

    this.isSaving.set(true);
    this.errorMsg.set(null);

    try {
      const existing = this.editingMessage();
      if (existing) {
        await this.firebaseService.updateMessageRecord({
          ...existing,
          title: val.title.trim(),
          speaker: val.speaker.trim(),
          date: val.date,
          durationMinutes: totalMinutes,
          wasTogether: val.wasTogether,
          notes: val.notes.trim(),
        });
        this.saved.emit('Message listening record updated!');
      } else {
        await this.firebaseService.addMessageRecord({
          title: val.title.trim(),
          speaker: val.speaker.trim(),
          date: val.date,
          durationMinutes: totalMinutes,
          initialDurationMinutes: totalMinutes,
          listenCount: 1,
          wasTogether: val.wasTogether,
          notes: val.notes.trim(),
        });
        this.saved.emit('Message listening time logged!');
      }
      this.isSaving.set(false);
      this.closeForm();
    } catch (err) {
      this.isSaving.set(false);
      this.errorMsg.set(err instanceof Error ? err.message : 'Failed to save message record.');
    }
  }

  async deleteRecord(id: string) {
    try {
      await this.firebaseService.deleteMessageRecord(id);
      this.saved.emit('Message record removed.');
    } catch {
      // ignore
    }
  }
}
