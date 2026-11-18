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
  host: {
    '(window:keydown.escape)': 'closeAllModals()',
  },
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-stone-800/80">
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
          class="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 active:scale-98 transition-all shadow-md shrink-0"
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
            {{ firebaseService.formatInteger(filteredMessages().length) }}
          </div>
          <span class="text-[11px] text-stone-500 font-mono tabular-nums">
            {{ firebaseService.formatInteger(firebaseService.totalMessageRepeats()) }} total listenings
          </span>
        </div>
      </div>

      <!-- Filter & Sort Bar -->
      @if (firebaseService.messages().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-stone-900 border border-stone-800">
          <div>
            <label for="msgSearch" class="block text-[11px] font-medium text-stone-400 mb-1">Search</label>
            <input
              id="msgSearch"
              type="text"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              placeholder="Search title or speaker..."
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label for="msgModeFilter" class="block text-[11px] font-medium text-stone-400 mb-1">Mode</label>
            <select
              id="msgModeFilter"
              [value]="filterMode()"
              (change)="filterMode.set($any($event.target).value)"
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Modes</option>
              <option value="individual">Individual</option>
              <option value="partner">With Partner</option>
            </select>
          </div>

          <div>
            <label for="msgSort" class="block text-[11px] font-medium text-stone-400 mb-1">Sort</label>
            <select
              id="msgSort"
              [value]="sortBy()"
              (change)="sortBy.set($any($event.target).value)"
              class="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="mostTime">Most Time</option>
              <option value="mostListened">Most Listened</option>
            </select>
          </div>
        </div>
      }

      <!-- Recorded Messages List -->
      @if (filteredMessages().length === 0) {
        <div class="text-center py-12 px-4 rounded-2xl bg-stone-900/50 border border-stone-800 space-y-3">
          <mat-icon class="text-stone-600" style="font-size: 40px;">headphones</mat-icon>
          <h3 class="text-base font-semibold text-stone-300">
            {{ firebaseService.messages().length === 0 ? 'No messages yet' : 'No matching messages' }}
          </h3>
          <p class="text-xs text-stone-500 max-w-sm mx-auto">
            {{ firebaseService.messages().length === 0 ? 'Log your first message and duration.' : 'Try adjusting your search or filter.' }}
          </p>
          @if (firebaseService.messages().length === 0) {
            <button
              type="button"
              (click)="openForm()"
              class="py-2.5 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 inline-flex items-center gap-1.5 shadow-md"
            >
              <mat-icon style="font-size: 16px;">add</mat-icon>
              <span>Log Message</span>
            </button>
          }
        </div>
      } @else {
        <div class="space-y-3">
          @for (msg of filteredMessages(); track msg.id) {
            @let baseMins = msg.initialDurationMinutes || msg.durationMinutes;
            <div class="rounded-2xl bg-stone-900 border border-stone-800 p-4 sm:p-5 space-y-3 hover:border-stone-700 transition-all">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div class="space-y-1.5 min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span class="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs tabular-nums">
                      Total: {{ firebaseService.formatMinutes(msg.durationMinutes) }}
                      ({{ firebaseService.formatHours(msg.durationMinutes) }}h)
                    </span>
                    <span class="px-2 py-0.5 rounded-lg bg-stone-800 text-stone-300 font-mono text-[11px] tabular-nums">
                      Initial: {{ firebaseService.formatMinutes(baseMins) }}
                    </span>
                    <span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-semibold tabular-nums">
                      {{ firebaseService.formatInteger(msg.listenCount || 1) }}x listened
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
                    <h3 class="text-base font-serif font-bold text-stone-100 break-words">{{ msg.title }}</h3>
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

                <!-- Mobile-Fit Action Bar: Repeat, + Add Time, Edit, Delete -->
                <div class="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-stone-800/70 shrink-0">
                  <button
                    type="button"
                    [disabled]="isSaving()"
                    (click)="repeatInitialTime(msg)"
                    class="min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 py-2 sm:py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                    title="Repeat initial recorded listening time"
                  >
                    <mat-icon class="shrink-0" style="font-size: 15px;">replay</mat-icon>
                    <span class="truncate">Repeat (+{{ firebaseService.formatMinutes(baseMins) }})</span>
                  </button>

                  <button
                    type="button"
                    (click)="openAddTimeModal(msg)"
                    class="min-w-0 flex-1 sm:flex-initial flex items-center justify-center gap-1 py-2 sm:py-1.5 px-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold transition-colors"
                    title="Add more listening time to this message"
                  >
                    <mat-icon class="shrink-0" style="font-size: 15px;">more_time</mat-icon>
                    <span class="truncate">+ Add Time</span>
                  </button>

                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      (click)="editRecord(msg)"
                      class="p-2 sm:p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors"
                      title="Edit Message"
                      aria-label="Edit Message"
                    >
                      <mat-icon style="font-size: 16px;">edit</mat-icon>
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteRecord(msg)"
                      class="p-2 sm:p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
                      title="Delete Message"
                      aria-label="Delete Message"
                    >
                      <mat-icon style="font-size: 16px;">delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- POP-UP MODAL 1: Log / Edit Message -->
      @if (showForm()) {
        <div
          data-no-swipe="true"
          class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm modal-backdrop-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close message form overlay"
            (click)="closeForm()"
            class="fixed inset-0 w-full h-full cursor-default focus:outline-none"
          ></button>
          <div
            class="relative z-10 modal-pop-in bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg max-h-[85dvh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5 my-auto"
          >
            <div class="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                  Word Intake
                </span>
                <h2 class="text-lg font-serif font-bold text-stone-100">
                  {{ editingMessage() ? 'Edit Message' : 'Log Message' }}
                </h2>
              </div>
              <button
                type="button"
                (click)="closeForm()"
                class="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800"
                aria-label="Close modal"
              >
                <mat-icon style="font-size: 18px;">close</mat-icon>
              </button>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div>
                <span class="block text-xs font-medium text-stone-300 mb-1">
                  Mode
                </span>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="form.controls.wasTogether.setValue(false)"
                    class="py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
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
                    class="py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
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

              <div class="grid grid-cols-2 sm:flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  (click)="closeForm()"
                  class="w-full sm:w-auto flex items-center justify-center gap-1 py-2.5 sm:py-2 px-4 rounded-xl text-xs font-medium text-stone-300 bg-stone-800/70 hover:bg-stone-800 hover:text-stone-100"
                >
                  <mat-icon style="font-size: 15px;">close</mat-icon>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  [disabled]="isSaving()"
                  class="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-5 rounded-xl text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-50 shadow-md"
                >
                  <mat-icon style="font-size: 16px;">check</mat-icon>
                  <span>{{ isSaving() ? 'Saving...' : (editingMessage() ? 'Update' : 'Save') }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- POP-UP MODAL 2: Add More Time / Repeat Message -->
      @if (addingTimeMessage(); as targetMsg) {
        @let baseMins = targetMsg.initialDurationMinutes || targetMsg.durationMinutes;
        <div
          data-no-swipe="true"
          class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm modal-backdrop-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close add time overlay"
            (click)="addingTimeMessage.set(null)"
            class="fixed inset-0 w-full h-full cursor-default focus:outline-none"
          ></button>
          <div
            class="relative z-10 modal-pop-in bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md max-h-[85dvh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5 my-auto"
          >
            <div class="flex items-center justify-between border-b border-stone-800 pb-3">
              <div class="min-w-0 pr-2">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Add Listening Time
                </span>
                <h2 class="text-base font-serif font-bold text-stone-100 truncate">
                  {{ targetMsg.title }}
                </h2>
              </div>
              <button
                type="button"
                (click)="addingTimeMessage.set(null)"
                class="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 shrink-0"
                aria-label="Close modal"
              >
                <mat-icon style="font-size: 18px;">close</mat-icon>
              </button>
            </div>

            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
              <span class="text-stone-400">Current Total</span>
              <span class="font-mono font-bold text-amber-400 tabular-nums">
                {{ firebaseService.formatMinutes(targetMsg.durationMinutes) }}
                ({{ firebaseService.formatInteger(targetMsg.listenCount || 1) }}x)
              </span>
            </div>

            <!-- Quick Repeat Initial Duration Button -->
            <button
              type="button"
              [disabled]="isSaving()"
              (click)="repeatInitialTime(targetMsg)"
              class="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <mat-icon style="font-size: 16px;">replay</mat-icon>
              <span>Repeat Initial Duration (+{{ firebaseService.formatMinutes(baseMins) }})</span>
            </button>

            <div class="relative flex py-1 items-center">
              <div class="flex-grow border-t border-stone-800"></div>
              <span class="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-stone-500">Or Custom Time</span>
              <div class="flex-grow border-t border-stone-800"></div>
            </div>

            <form [formGroup]="addTimeForm" (ngSubmit)="submitAddedTime(targetMsg)" class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="addHrs" class="block text-xs font-medium text-stone-300 mb-1">Hours</label>
                  <div class="relative">
                    <input
                      id="addHrs"
                      type="number"
                      min="0"
                      max="24"
                      formControlName="hours"
                      class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                    <span class="absolute right-3 top-2 text-[11px] text-stone-500">hrs</span>
                  </div>
                </div>
                <div>
                  <label for="addMins" class="block text-xs font-medium text-stone-300 mb-1">Minutes</label>
                  <div class="relative">
                    <input
                      id="addMins"
                      type="number"
                      min="0"
                      max="59"
                      formControlName="minutes"
                      class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                    />
                    <span class="absolute right-3 top-2 text-[11px] text-stone-500">mins</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  (click)="addingTimeMessage.set(null)"
                  class="w-full sm:w-auto flex items-center justify-center gap-1 py-2.5 sm:py-2 px-4 rounded-xl text-xs font-medium text-stone-300 bg-stone-800/70 hover:bg-stone-800 hover:text-stone-100"
                >
                  <mat-icon style="font-size: 15px;">close</mat-icon>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  [disabled]="isSaving()"
                  class="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-semibold disabled:opacity-50 shadow-md"
                >
                  <mat-icon style="font-size: 16px;">check</mat-icon>
                  <span>Add to Total</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- POP-UP MODAL 3: Delete Message Confirmation -->
      @if (deletingMessage(); as delMsg) {
        <div
          data-no-swipe="true"
          class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm modal-backdrop-in"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close delete message overlay"
            (click)="deletingMessage.set(null)"
            class="fixed inset-0 w-full h-full cursor-default focus:outline-none"
          ></button>
          <div
            class="relative z-10 modal-pop-in bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-base font-serif font-bold text-stone-100">Delete Message</h3>
              <button
                type="button"
                (click)="deletingMessage.set(null)"
                class="text-stone-400 hover:text-stone-100 p-1 rounded-lg hover:bg-stone-800"
                aria-label="Close modal"
              >
                <mat-icon style="font-size: 18px;">close</mat-icon>
              </button>
            </div>
            <p class="text-xs text-stone-300 leading-relaxed">
              Remove <strong>{{ delMsg.title }}</strong> from your message records?
            </p>
            <div class="grid grid-cols-2 sm:flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                (click)="deletingMessage.set(null)"
                class="w-full sm:w-auto flex items-center justify-center gap-1 py-2.5 sm:py-2 px-4 rounded-xl text-xs font-medium text-stone-300 bg-stone-800/70 hover:bg-stone-800 hover:text-stone-100"
              >
                <mat-icon style="font-size: 15px;">close</mat-icon>
                <span>Cancel</span>
              </button>
              <button
                type="button"
                (click)="executeDeleteRecord()"
                class="w-full sm:w-auto flex items-center justify-center gap-1 py-2.5 sm:py-2 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white"
              >
                <mat-icon style="font-size: 15px;">delete</mat-icon>
                <span>Delete</span>
              </button>
            </div>
          </div>
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
  readonly addingTimeMessage = signal<MessageListeningRecord | null>(null);
  readonly deletingMessage = signal<MessageListeningRecord | null>(null);

  // Filter & Sort state
  readonly searchQuery = signal('');
  readonly filterMode = signal<'all' | 'individual' | 'partner'>('all');
  readonly sortBy = signal<'newest' | 'oldest' | 'mostTime' | 'mostListened'>('newest');

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
    const memberFilter = this.firebaseService.activeFilterMember();
    const query = this.searchQuery().trim().toLowerCase();
    const mode = this.filterMode();
    const sort = this.sortBy();

    let list = this.firebaseService.messages();

    if (memberFilter !== 'all') {
      list = list.filter((m) => m.authorUid === memberFilter || m.authorName === memberFilter);
    }

    if (mode === 'partner') {
      list = list.filter((m) => !!m.wasTogether);
    } else if (mode === 'individual') {
      list = list.filter((m) => !m.wasTogether);
    }

    if (query) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          (m.speaker && m.speaker.toLowerCase().includes(query)) ||
          (m.notes && m.notes.toLowerCase().includes(query)) ||
          m.authorName.toLowerCase().includes(query)
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'oldest') {
        return (
          (a.date || '').localeCompare(b.date || '') ||
          (a.createdAt || '').localeCompare(b.createdAt || '') ||
          (a.id || '').localeCompare(b.id || '')
        );
      }
      if (sort === 'mostTime') {
        return (Number(b.durationMinutes) || 0) - (Number(a.durationMinutes) || 0);
      }
      if (sort === 'mostListened') {
        return (Number(b.listenCount) || 1) - (Number(a.listenCount) || 1);
      }
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '') ||
        (b.id || '').localeCompare(a.id || '')
      );
    });
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

  closeAllModals() {
    this.showForm.set(false);
    this.addingTimeMessage.set(null);
    this.deletingMessage.set(null);
    this.editingMessage.set(null);
    this.errorMsg.set(null);
  }

  openForm() {
    this.editingMessage.set(null);
    this.addingTimeMessage.set(null);
    this.deletingMessage.set(null);
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
    this.addingTimeMessage.set(null);
    this.deletingMessage.set(null);
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

  openAddTimeModal(msg: MessageListeningRecord) {
    this.showForm.set(false);
    this.deletingMessage.set(null);
    this.addTimeForm.reset({ hours: 0, minutes: 30 });
    this.addingTimeMessage.set(msg);
  }

  async repeatInitialTime(msg: MessageListeningRecord) {
    const baseMins = Math.max(
      1,
      Number(msg.initialDurationMinutes) || Number(msg.durationMinutes) || 0
    );
    this.isSaving.set(true);
    try {
      await this.firebaseService.addMoreTimeToMessage(msg, baseMins);
      this.addingTimeMessage.set(null);
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
      this.addingTimeMessage.set(null);
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
        this.saved.emit('Message record updated.');
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
        this.saved.emit('Message logged.');
      }
      this.isSaving.set(false);
      this.closeForm();
    } catch (err) {
      this.isSaving.set(false);
      this.errorMsg.set(err instanceof Error ? err.message : 'Failed to save message record.');
    }
  }

  confirmDeleteRecord(msg: MessageListeningRecord) {
    this.showForm.set(false);
    this.addingTimeMessage.set(null);
    this.deletingMessage.set(msg);
  }

  async executeDeleteRecord() {
    const msg = this.deletingMessage();
    if (!msg) return;
    this.deletingMessage.set(null);
    try {
      await this.firebaseService.deleteMessageRecord(msg.id);
      this.saved.emit('Message removed.');
    } catch {
      // ignore
    }
  }
}
