import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

export interface StreakDayBadge {
  dateStr: string;
  dayShort: string;
  dayNumber: string;
  minutesLogged: number;
  hasPrayed: boolean;
  inActiveStreak: boolean;
  isMissed: boolean;
  isToday: boolean;
  metTarget: boolean;
}

@Component({
  selector: 'app-streak',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4 h-full flex flex-col justify-between">
      <!-- Top Header -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Streak
            </span>
            @if (streakDays() > 0) {
              <span class="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-400">
                Active
              </span>
            }
          </div>
          <span class="text-xs font-mono text-stone-400 tabular-nums">
            Best: <strong class="text-stone-200">{{ firebaseService.formatInteger(longestStreak()) }}d</strong>
          </span>
        </div>

        <!-- Primary Streak Counter -->
        <div class="flex items-baseline justify-between">
          <div>
            <div class="text-3xl font-serif font-bold text-amber-400 font-mono tabular-nums flex items-baseline gap-1.5">
              <span>{{ firebaseService.formatInteger(streakDays()) }}</span>
              <span class="text-sm font-sans font-normal text-stone-400">
                {{ streakDays() === 1 ? 'day' : 'days' }}
              </span>
            </div>
            <span class="text-xs text-stone-400">
              {{ statusCopy() }}
            </span>
          </div>

          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors"
            [class]="
              streakDays() > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-stone-950 border-stone-800 text-stone-500'
            "
          >
            <mat-icon>{{ streakDays() > 0 ? 'local_fire_department' : 'schedule' }}</mat-icon>
          </div>
        </div>
      </div>

      <!-- Circular Day Badges Strip (Last 7 Days) -->
      <div class="py-2 space-y-2">
        <div class="flex items-center justify-between gap-1.5">
          @for (badge of streakBadges(); track badge.dateStr) {
            <button
              type="button"
              (click)="onSelectDay(badge.dateStr)"
              class="group flex flex-col items-center gap-1 flex-1 focus:outline-none"
              [title]="
                badge.dateStr +
                ' · ' +
                (badge.hasPrayed
                  ? firebaseService.formatMinutes(badge.minutesLogged) + ' logged'
                  : badge.isToday
                    ? 'Tap to log today'
                    : 'Missed day · Tap to log')
              "
            >
              <!-- Weekday initial -->
              <span
                class="text-[10px] font-medium tracking-tight transition-colors"
                [class]="
                  badge.inActiveStreak
                    ? 'text-amber-400 font-semibold'
                    : badge.isToday
                      ? 'text-stone-200 font-semibold'
                      : 'text-stone-500'
                "
              >
                {{ badge.dayShort }}
              </span>

              <!-- Circular Badge -->
              <div
                class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex flex-col items-center justify-center border transition-all group-hover:scale-105 group-active:scale-95 relative"
                [class]="
                  badge.inActiveStreak
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-sm'
                    : badge.hasPrayed
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-semibold'
                      : badge.isToday
                        ? 'bg-stone-950 text-amber-400 border-dashed border-amber-500/50'
                        : 'bg-stone-950 text-stone-500 border-stone-800'
                "
              >
                @if (badge.inActiveStreak) {
                  <mat-icon style="font-size: 15px; width: 15px; height: 15px; line-height: 15px;">
                    local_fire_department
                  </mat-icon>
                } @else if (badge.hasPrayed) {
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px; line-height: 14px;">
                    check
                  </mat-icon>
                } @else {
                  <span class="text-[11px] font-mono tabular-nums">
                    {{ badge.dayNumber }}
                  </span>
                }
              </div>

              <!-- Day duration or status label -->
              <span
                class="text-[9px] font-mono tabular-nums leading-none"
                [class]="
                  badge.inActiveStreak
                    ? 'text-amber-400 font-semibold'
                    : badge.hasPrayed
                      ? 'text-stone-300'
                      : 'text-stone-500'
                "
              >
                {{ badge.hasPrayed ? firebaseService.formatMinutes(badge.minutesLogged) : (badge.isToday ? 'Today' : 'Missed') }}
              </span>
            </button>
          }
        </div>

        <!-- Legend & Quick Action -->
        <div class="flex items-center justify-between pt-1 text-[10px] text-stone-400">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Active streak</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-stone-800 border border-stone-700"></span>
              <span>Missed</span>
            </span>
          </div>
          <span class="text-stone-500">Tap day to log</span>
        </div>
      </div>

      <!-- Footer Stats -->
      <div class="pt-3 border-t border-stone-800 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-stone-500">Sessions</span>
          <div class="text-stone-200 font-semibold font-mono tabular-nums">
            {{ firebaseService.formatInteger(firebaseService.filteredSessions().length) }}
          </div>
        </div>
        <div>
          <span class="text-stone-500">Testimonies</span>
          <div class="text-amber-400 font-semibold font-mono tabular-nums">
            {{ firebaseService.formatInteger(firebaseService.testimonies().length) }}
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Streak {
  readonly firebaseService = inject(FirebaseService);

  /** Emits YYYY-MM-DD when the user taps a circular day badge to log prayer for that date */
  readonly selectDate = output<string>();

  readonly streakDays = computed(() => this.firebaseService.streakDays());

  readonly longestStreak = computed(() => {
    const sessions = this.firebaseService.filteredSessions();
    if (sessions.length === 0) return 0;

    const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort();
    let best = 0;
    let current = 0;
    let prevDate: Date | null = null;

    for (const dateStr of uniqueDates) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const currDate = new Date(y, (m || 1) - 1, d || 1);

      if (prevDate) {
        const diffDays = Math.round(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) {
          current += 1;
        } else {
          current = 1;
        }
      } else {
        current = 1;
      }

      if (current > best) {
        best = current;
      }
      prevDate = currDate;
    }

    return Math.max(best, this.streakDays());
  });

  readonly statusCopy = computed(() => {
    const streak = this.streakDays();
    const todayStr = this.firebaseService.getTodayDateString();
    const prayedToday = this.firebaseService
      .filteredSessions()
      .some((s) => s.date === todayStr && s.durationMinutes > 0);

    if (streak === 0) {
      return 'Log today to start streak';
    }
    if (!prayedToday) {
      return 'Log today to keep streak';
    }
    return 'Consecutive prayer days';
  });

  readonly streakBadges = computed<StreakDayBadge[]>(() => {
    const sessions = this.firebaseService.filteredSessions();
    const activeP = this.firebaseService.activePartnership();
    const dailyTarget = activeP ? activeP.dailyTargetMinutes : 60;

    // Sum minutes per date
    const minutesByDate = new Map<string, number>();
    for (const s of sessions) {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + s.durationMinutes);
    }

    const todayStr = this.firebaseService.getTodayDateString();
    const yesterdayStr = this.firebaseService.getYesterdayDateString();

    // Determine exact set of dates belonging to the current active consecutive streak
    const activeStreakDates = new Set<string>();
    const hasToday = (minutesByDate.get(todayStr) || 0) > 0;
    const hasYesterday = (minutesByDate.get(yesterdayStr) || 0) > 0;

    if (hasToday || hasYesterday) {
      const cursor = new Date();
      if (!hasToday) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (true) {
        const dStr = this.formatDate(cursor);
        if ((minutesByDate.get(dStr) || 0) > 0) {
          activeStreakDates.add(dStr);
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Build 7-day circular badge window ending today (oldest -> today)
    const badges: StreakDayBadge[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const minutesLogged = minutesByDate.get(dateStr) || 0;
      const hasPrayed = minutesLogged > 0;
      const isToday = i === 0;
      const inActiveStreak = activeStreakDates.has(dateStr);

      badges.push({
        dateStr,
        dayShort: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayNumber: String(d.getDate()),
        minutesLogged,
        hasPrayed,
        inActiveStreak,
        isMissed: !hasPrayed && !isToday,
        isToday,
        metTarget: minutesLogged >= dailyTarget,
      });
    }

    return badges;
  });

  onSelectDay(dateStr: string): void {
    this.selectDate.emit(dateStr);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
