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
  isUpcoming: boolean;
  isToday: boolean;
  metTarget: boolean;
}

@Component({
  selector: 'app-streak',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4 h-full flex flex-col justify-between min-w-0">
      <!-- Top Header -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Streak
            </span>
            <span class="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-stone-700/70 text-[10px] font-medium text-stone-400 whitespace-nowrap">
              Mon–Sat
            </span>
            @if (streakDays() > 0) {
              <span class="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-400 whitespace-nowrap">
                Active
              </span>
            }
          </div>
          <div class="flex items-center gap-2.5 text-xs font-mono text-stone-400 tabular-nums whitespace-nowrap">
            <span>
              Week: <strong class="text-amber-400">{{ weekPrayedCount() }}/6</strong>
            </span>
            <span class="text-stone-700">·</span>
            <span>
              Best: <strong class="text-stone-200">{{ firebaseService.formatInteger(longestStreak()) }}d</strong>
            </span>
          </div>
        </div>

        <!-- Primary Streak Counter -->
        <div class="flex items-baseline justify-between gap-3">
          <div class="min-w-0">
            <div class="text-3xl font-serif font-bold text-amber-400 font-mono tabular-nums flex items-baseline gap-1.5">
              <span>{{ firebaseService.formatInteger(streakDays()) }}</span>
              <span class="text-sm font-sans font-normal text-stone-400">
                {{ streakDays() === 1 ? 'day' : 'days' }}
              </span>
            </div>
            <span class="text-xs text-stone-400 block truncate">
              {{ statusCopy() }}
            </span>
          </div>

          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shrink-0"
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

      <!-- Circular Day Badges Strip (Current Week: Mon to Sat) -->
      <div class="py-1.5 space-y-2">
        <div class="flex items-center justify-between text-[10px] text-stone-500 font-mono">
          <span>{{ weekRangeLabel() }}</span>
          <span>Tap day to log</span>
        </div>

        <div class="grid grid-cols-6 gap-1 sm:gap-1.5">
          @for (badge of streakBadges(); track badge.dateStr) {
            <button
              type="button"
              (click)="onSelectDay(badge.dateStr)"
              class="group flex flex-col items-center gap-1 min-w-0 focus:outline-none"
              [title]="
                badge.dateStr +
                ' · ' +
                (badge.hasPrayed
                  ? firebaseService.formatMinutes(badge.minutesLogged) + ' logged'
                  : badge.isToday
                    ? 'Tap to log today'
                    : badge.isUpcoming
                      ? 'Upcoming prayer day · Tap to log'
                      : 'Missed day · Tap to log')
              "
            >
              <!-- Weekday short label (Mon-Sat) -->
              <span
                class="text-[10px] font-medium tracking-tight transition-colors truncate max-w-full"
                [class]="
                  badge.inActiveStreak
                    ? 'text-amber-400 font-semibold'
                    : badge.isToday
                      ? 'text-stone-200 font-semibold'
                      : badge.isUpcoming
                        ? 'text-stone-500'
                        : 'text-stone-400'
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
                        ? 'bg-stone-950 text-amber-400 border-dashed border-amber-500/60'
                        : badge.isUpcoming
                          ? 'bg-stone-950/60 text-stone-500 border-stone-800/70 opacity-75'
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
                class="text-[9px] font-mono tabular-nums leading-none truncate max-w-full"
                [class]="
                  badge.inActiveStreak
                    ? 'text-amber-400 font-semibold'
                    : badge.hasPrayed
                      ? 'text-stone-300'
                      : badge.isToday
                        ? 'text-amber-400/90'
                        : badge.isUpcoming
                          ? 'text-stone-600'
                          : 'text-stone-500'
                "
              >
                {{
                  badge.hasPrayed
                    ? firebaseService.formatMinutes(badge.minutesLogged)
                    : badge.isToday
                      ? 'Today'
                      : badge.isUpcoming
                        ? 'Next'
                        : 'Missed'
                }}
              </span>
            </button>
          }
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-stone-400">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Streak</span>
            </span>
            <span class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-stone-800 border border-stone-700"></span>
              <span>Missed</span>
            </span>
          </div>
          <span class="text-stone-500">Sun rest</span>
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

    // Only account for Mon–Sat prayer days with logged minutes
    const uniqueDates = Array.from(
      new Set(
        sessions
          .filter((s) => s.durationMinutes > 0 && this.firebaseService.isPrayerWeekDayStr(s.date))
          .map((s) => s.date)
      )
    ).sort();

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
        // Consecutive if adjacent day (Mon–Sat) OR Saturday -> Monday across Sunday rest day
        const isSatToMon =
          diffDays === 2 && prevDate.getDay() === 6 && currDate.getDay() === 1;

        if (diffDays === 1 || isSatToMon) {
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

  readonly weekPrayedCount = computed(() => {
    return this.streakBadges().filter((b) => b.hasPrayed).length;
  });

  readonly weekRangeLabel = computed(() => {
    const weekDates = this.firebaseService.getCurrentPrayerWeekDates();
    if (weekDates.length < 6) return 'This Week';
    const mon = this.parseDate(weekDates[0]);
    const sat = this.parseDate(weekDates[5]);
    const monLabel = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const satLabel = sat.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${monLabel} – ${satLabel}`;
  });

  readonly statusCopy = computed(() => {
    const streak = this.streakDays();
    const now = new Date();
    const isSunday = now.getDay() === 0;

    if (isSunday) {
      if (this.weekPrayedCount() >= 6) {
        return 'Week complete · New week starts Mon';
      }
      return streak > 0
        ? 'Rest day · New week starts Mon'
        : 'Rest day · Week starts Mon';
    }

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
    return 'Consecutive Mon–Sat days';
  });

  readonly streakBadges = computed<StreakDayBadge[]>(() => {
    const sessions = this.firebaseService.filteredSessions();
    const activeP = this.firebaseService.activePartnership();
    const dailyTarget = activeP ? activeP.dailyTargetMinutes : 60;

    // Sum minutes per Mon–Sat date
    const minutesByDate = new Map<string, number>();
    for (const s of sessions) {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + s.durationMinutes);
    }

    const todayStr = this.firebaseService.getTodayDateString();

    // Determine exact set of Mon–Sat dates belonging to the active streak
    const activeStreakDates = new Set<string>();
    const cursor = new Date();
    if (cursor.getDay() === 0) {
      cursor.setDate(cursor.getDate() - 1); // Anchor Sunday at Saturday
    }

    const anchorStr = this.formatDate(cursor);
    if ((minutesByDate.get(anchorStr) || 0) <= 0) {
      this.firebaseService.stepBackPrayerDay(cursor);
    }

    while ((minutesByDate.get(this.formatDate(cursor)) || 0) > 0) {
      activeStreakDates.add(this.formatDate(cursor));
      this.firebaseService.stepBackPrayerDay(cursor);
    }

    // Build current week's Mon–Sat 6-day circular badge strip (resets automatically each Monday)
    const weekDates = this.firebaseService.getCurrentPrayerWeekDates();
    return weekDates.map((dateStr) => {
      const d = this.parseDate(dateStr);
      const minutesLogged = minutesByDate.get(dateStr) || 0;
      const hasPrayed = minutesLogged > 0;
      const isToday = dateStr === todayStr;
      const isUpcoming = dateStr > todayStr;
      const inActiveStreak = activeStreakDates.has(dateStr);

      return {
        dateStr,
        dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: String(d.getDate()),
        minutesLogged,
        hasPrayed,
        inActiveStreak,
        isMissed: !hasPrayed && !isToday && !isUpcoming,
        isUpcoming,
        isToday,
        metTarget: minutesLogged >= dailyTarget,
      };
    });
  });

  onSelectDay(dateStr: string): void {
    this.selectDate.emit(dateStr);
  }

  private parseDate(dateStr: string): Date {
    const [y, m, day] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
