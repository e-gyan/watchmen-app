import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year' | 'all';

interface TrendBarPoint {
  label: string;
  subLabel: string;
  prayerMinutes: number;
  prayerHours: number;
  messageMinutes: number;
  messageHours: number;
  seedGhs: number;
  prayerHeightPct: number;
  messageHeightPct: number;
  seedHeightPct: number;
}

interface SpeakerRankItem {
  speaker: string;
  minutes: number;
  hours: number;
  listenCount: number;
  pct: number;
}

@Component({
  selector: 'app-analytics-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="space-y-6">
      <!-- Header & Period Filter -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Growth & Insights
          </span>
          <h1 class="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
            Analytics
          </h1>
          <p class="text-xs text-stone-400 mt-0.5">
            Period trends and progress across prayers, messages, seeds (GHS), and answers.
          </p>
        </div>

        <!-- Period Selector -->
        <div class="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-stone-900 border border-stone-800">
          @for (p of periods; track p.id) {
            <button
              type="button"
              (click)="selectPeriod(p.id)"
              class="py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
              [class]="
                selectedPeriod() === p.id
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              "
            >
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- High-Level Period Summary KPIs with Growth Delta -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Prayer Volume -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Prayer Time
            </span>
            @if (selectedPeriod() !== 'all') {
              <span
                class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full tabular-nums"
                [class]="
                  periodComparison().prayerGrowthPct >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-stone-800 text-stone-400'
                "
              >
                {{ periodComparison().prayerGrowthPct >= 0 ? '+' : '' }}{{ firebaseService.formatOneDecimal(periodComparison().prayerGrowthPct) }}%
              </span>
            }
          </div>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-amber-400 font-mono tabular-nums">
            {{ firebaseService.formatHours(periodMetrics().prayerMinutes) }}h
          </div>
          <div class="flex items-center justify-between text-[11px] text-stone-500 font-mono tabular-nums">
            <span>{{ firebaseService.formatMinutes(periodMetrics().prayerMinutes) }}</span>
            <span>{{ firebaseService.formatInteger(periodMetrics().prayerSessionsCount) }} sessions</span>
          </div>
        </div>

        <!-- Message Intake -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Message Intake
            </span>
            @if (selectedPeriod() !== 'all') {
              <span
                class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full tabular-nums"
                [class]="
                  periodComparison().messageGrowthPct >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-stone-800 text-stone-400'
                "
              >
                {{ periodComparison().messageGrowthPct >= 0 ? '+' : '' }}{{ firebaseService.formatOneDecimal(periodComparison().messageGrowthPct) }}%
              </span>
            }
          </div>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-stone-100 font-mono tabular-nums">
            {{ firebaseService.formatHours(periodMetrics().messageMinutes) }}h
          </div>
          <div class="flex items-center justify-between text-[11px] text-stone-500 font-mono tabular-nums">
            <span>{{ firebaseService.formatInteger(periodMetrics().messagesCount) }} titles</span>
            <span>{{ firebaseService.formatInteger(periodMetrics().messageListenings) }}x listened</span>
          </div>
        </div>

        <!-- Seeds Sown (GHS) -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Seeds Given (GHS)
            </span>
            @if (selectedPeriod() !== 'all') {
              <span
                class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full tabular-nums"
                [class]="
                  periodComparison().seedGrowthPct >= 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-stone-800 text-stone-400'
                "
              >
                {{ periodComparison().seedGrowthPct >= 0 ? '+' : '' }}{{ firebaseService.formatOneDecimal(periodComparison().seedGrowthPct) }}%
              </span>
            }
          </div>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-emerald-400 font-mono tabular-nums">
            GHS {{ firebaseService.formatOneDecimal(periodMetrics().seedGivenGhs) }}
          </div>
          <div class="flex items-center justify-between text-[11px] text-stone-500 font-mono tabular-nums">
            <span>{{ firebaseService.formatOneDecimal(firebaseService.seedTotalsSummary().progressPct) }}% of annual target</span>
            <span>{{ firebaseService.formatInteger(periodMetrics().seedEntriesCount) }} seeds</span>
          </div>
        </div>

        <!-- Answered Petitions & Testimonies -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Answer Rate
            </span>
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 tabular-nums">
              {{ firebaseService.formatInteger(periodMetrics().testimoniesCount) }} testimonies
            </span>
          </div>
          <div class="text-2xl sm:text-3xl font-serif font-bold text-stone-100 font-mono tabular-nums">
            {{ firebaseService.formatOneDecimal(answerRatePct()) }}%
          </div>
          <div class="flex items-center justify-between text-[11px] text-stone-500 font-mono tabular-nums">
            <span>{{ firebaseService.formatInteger(answeredPetitionsCount()) }} answered</span>
            <span>{{ firebaseService.formatInteger(activePetitionsCount()) }} active</span>
          </div>
        </div>
      </div>

      <!-- Multi-Series Period Trend Chart (Prayer Hours, Message Hours, Seeds in GHS) -->
      <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
              Timeline Progression
            </span>
            <h2 class="text-lg font-serif font-bold text-stone-100">
              {{ trendChartTitle() }}
            </h2>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="flex items-center gap-1.5 text-stone-300">
              <span class="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
              <span>Prayer (hrs)</span>
            </span>
            <span class="flex items-center gap-1.5 text-stone-300">
              <span class="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
              <span>Messages (hrs)</span>
            </span>
            <span class="flex items-center gap-1.5 text-stone-300">
              <span class="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span>
              <span>Seeds (GHS)</span>
            </span>
          </div>
        </div>

        <div class="grid grid-cols-6 sm:grid-cols-7 md:grid-cols-12 gap-2 pt-2 items-end h-48">
          @for (pt of trendBars(); track pt.label + pt.subLabel) {
            <div class="flex flex-col items-center h-full justify-end group">
              <!-- Tooltip figures on hover -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-center bg-stone-950 border border-stone-800 rounded-lg px-1.5 py-1 mb-1 whitespace-nowrap z-10 pointer-events-none">
                <div class="text-amber-400">{{ firebaseService.formatOneDecimal(pt.prayerHours) }}h pray</div>
                <div class="text-sky-400">{{ firebaseService.formatOneDecimal(pt.messageHours) }}h msg</div>
                <div class="text-emerald-400">₵{{ firebaseService.formatOneDecimal(pt.seedGhs) }}</div>
              </div>

              <!-- Grouped Bars -->
              <div class="w-full flex items-end justify-center gap-1 h-32 px-0.5">
                <div
                  class="flex-1 max-w-2.5 rounded-t bg-amber-500 transition-all duration-500"
                  [style.height.%]="pt.prayerHeightPct"
                ></div>
                <div
                  class="flex-1 max-w-2.5 rounded-t bg-sky-400 transition-all duration-500"
                  [style.height.%]="pt.messageHeightPct"
                ></div>
                <div
                  class="flex-1 max-w-2.5 rounded-t bg-emerald-400 transition-all duration-500"
                  [style.height.%]="pt.seedHeightPct"
                ></div>
              </div>

              <span class="text-[10px] font-mono text-stone-300 mt-1.5 truncate max-w-full">
                {{ pt.label }}
              </span>
              <span class="text-[9px] font-mono text-stone-500 truncate max-w-full">
                {{ pt.subLabel }}
              </span>
            </div>
          }
        </div>
      </div>

      <!-- Deep Dive Grid: Prayer Analytics, Message Insights, Seed Fulfillment -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 1. Prayer Discipline & Mode Split -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                Prayer Watch
              </span>
              <h3 class="text-base font-serif font-bold text-stone-100">
                Consistency & Mode
              </h3>
            </div>
            <mat-icon class="text-amber-400">local_fire_department</mat-icon>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Daily Average</span>
              <span class="text-base font-mono font-bold text-amber-400 tabular-nums">
                {{ firebaseService.formatMinutes(periodMetrics().dailyAvgPrayerMinutes) }}
              </span>
            </div>
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Active Days</span>
              <span class="text-base font-mono font-bold text-stone-100 tabular-nums">
                {{ firebaseService.formatInteger(periodMetrics().activePrayerDays) }} days
              </span>
            </div>
          </div>

          <!-- Individual vs Partner Split -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-stone-400">Partner vs Individual</span>
              <span class="font-mono text-stone-300 tabular-nums">
                {{ firebaseService.formatOneDecimal(periodMetrics().partnerPrayerPct) }}% together
              </span>
            </div>
            <div class="h-2.5 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-800 flex">
              <div
                class="h-full bg-emerald-400 transition-all duration-500"
                [style.width.%]="periodMetrics().partnerPrayerPct"
              ></div>
              <div
                class="h-full bg-amber-500 transition-all duration-500"
                [style.width.%]="100 - periodMetrics().partnerPrayerPct"
              ></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-stone-400 font-mono tabular-nums">
              <span class="text-emerald-400">
                Partner: {{ firebaseService.formatHours(periodMetrics().partnerPrayerMinutes) }}h
              </span>
              <span class="text-amber-400">
                Alone: {{ firebaseService.formatHours(periodMetrics().individualPrayerMinutes) }}h
              </span>
            </div>
          </div>

          <!-- Custom Categories Distribution -->
          <div class="space-y-2.5 pt-2 border-t border-stone-800">
            <span class="text-xs font-semibold text-stone-300 block">
              Category Focus
            </span>
            @if (firebaseService.categoryBreakdown().length === 0) {
              <p class="text-xs text-stone-500">No categorized sessions yet.</p>
            } @else {
              <div class="space-y-2 max-h-44 overflow-y-auto pr-1">
                @for (cat of firebaseService.categoryBreakdown(); track cat.category) {
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-stone-300 truncate">{{ cat.category }}</span>
                      <span class="font-mono text-stone-400 tabular-nums">
                        {{ firebaseService.formatMinutes(cat.totalMinutes) }} ({{ firebaseService.formatOneDecimal(cat.percentage) }}%)
                      </span>
                    </div>
                    <div class="h-1.5 w-full bg-stone-950 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        [style.width.%]="cat.percentage"
                        [style.backgroundColor]="cat.color"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- 2. Message Intake & Repeat Depth -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Word Depth
              </span>
              <h3 class="text-base font-serif font-bold text-stone-100">
                Message Retention
              </h3>
            </div>
            <mat-icon class="text-sky-400">headphones</mat-icon>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Avg per Message</span>
              <span class="text-base font-mono font-bold text-sky-400 tabular-nums">
                {{ firebaseService.formatMinutes(periodMetrics().avgMinutesPerMessage) }}
              </span>
            </div>
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Repeat Ratio</span>
              <span class="text-base font-mono font-bold text-emerald-400 tabular-nums">
                {{ firebaseService.formatOneDecimal(periodMetrics().avgListenMultiplier) }}x
              </span>
            </div>
          </div>

          <!-- Top Speakers / Ministers -->
          <div class="space-y-2.5 pt-2 border-t border-stone-800">
            <span class="text-xs font-semibold text-stone-300 block">
              Top Speakers & Series
            </span>
            @if (topSpeakers().length === 0) {
              <p class="text-xs text-stone-500">No messages recorded in this period.</p>
            } @else {
              <div class="space-y-2.5">
                @for (sp of topSpeakers(); track sp.speaker) {
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-stone-200 font-medium truncate">{{ sp.speaker }}</span>
                      <span class="font-mono text-sky-400 tabular-nums">
                        {{ firebaseService.formatHours(sp.minutes) }}h ({{ firebaseService.formatInteger(sp.listenCount) }}x)
                      </span>
                    </div>
                    <div class="h-1.5 w-full bg-stone-950 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-sky-400 rounded-full"
                        [style.width.%]="sp.pct"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- 3. Seed Altar Velocity & Currency Breakdown (GHS) -->
        <div class="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Seed Altar (GHS)
              </span>
              <h3 class="text-base font-serif font-bold text-stone-100">
                Target Fulfillment
              </h3>
            </div>
            <mat-icon class="text-emerald-400">volunteer_activism</mat-icon>
          </div>

          @let seedSum = firebaseService.seedTotalsSummary();
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Annual Target</span>
              <span class="text-sm font-mono font-bold text-stone-100 tabular-nums">
                GHS {{ firebaseService.formatOneDecimal(seedSum.totalTarget) }}
              </span>
            </div>
            <div class="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-0.5">
              <span class="text-stone-400 block">Remaining</span>
              <span class="text-sm font-mono font-bold text-amber-400 tabular-nums">
                GHS {{ firebaseService.formatOneDecimal(seedSum.totalRemaining) }}
              </span>
            </div>
          </div>

          <!-- Overall Seed Progress Bar -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-stone-400">Overall Fulfillment</span>
              <span class="font-mono font-bold text-emerald-400 tabular-nums">
                {{ firebaseService.formatOneDecimal(seedSum.progressPct) }}%
              </span>
            </div>
            <div class="h-2.5 w-full bg-stone-950 rounded-full overflow-hidden border border-stone-800">
              <div
                class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                [style.width.%]="seedSum.progressPct"
              ></div>
            </div>
          </div>

          <!-- Currency Distribution -->
          <div class="space-y-2.5 pt-2 border-t border-stone-800">
            <span class="text-xs font-semibold text-stone-300 block">
              By Currency (Live GHS Equivalent)
            </span>
            @if (seedSum.byCurrency.length === 0) {
              <p class="text-xs text-stone-500">No seed targets configured yet.</p>
            } @else {
              <div class="space-y-2">
                @for (c of seedSum.byCurrency; track c.currency) {
                  <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
                    <div>
                      <span class="font-mono font-bold text-stone-200">{{ c.currency }}</span>
                      <span class="text-stone-400 font-mono tabular-nums ml-1.5">
                        {{ firebaseService.formatOneDecimal(c.given) }} / {{ firebaseService.formatOneDecimal(c.target) }}
                      </span>
                    </div>
                    <span class="font-mono text-emerald-400 font-semibold tabular-nums">
                      GHS {{ firebaseService.formatOneDecimal(c.givenGhs) }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AnalyticsTracker implements OnInit {
  readonly firebaseService = inject(FirebaseService);

  readonly periods: { id: AnalyticsPeriod; label: string }[] = [
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'quarter', label: '90 Days' },
    { id: 'year', label: '1 Year' },
    { id: 'all', label: 'All Time' },
  ];

  readonly selectedPeriod = signal<AnalyticsPeriod>('month');
  readonly backendSyncedAt = signal<string | null>(null);

  ngOnInit() {
    this.syncWithBackendAnalytics(this.selectedPeriod());
  }

  selectPeriod(period: AnalyticsPeriod) {
    this.selectedPeriod.set(period);
    this.syncWithBackendAnalytics(period);
  }

  private async syncWithBackendAnalytics(period: AnalyticsPeriod) {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.computedAt) {
        this.backendSyncedAt.set(data.computedAt);
      }
    } catch {
      // ignore offline
    }
  }

  private getDateOffsetStr(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getPeriodDays(period: AnalyticsPeriod): number {
    if (period === 'week') return 7;
    if (period === 'month') return 30;
    if (period === 'quarter') return 90;
    if (period === 'year') return 365;
    return 3650;
  }

  readonly periodMetrics = computed(() => {
    const period = this.selectedPeriod();
    const days = this.getPeriodDays(period);
    const startStr = period === 'all' ? '0000-01-01' : this.getDateOffsetStr(days - 1);

    const sessions = this.firebaseService
      .filteredSessions()
      .filter((s) => (s.date || '') >= startStr);
    const messages = this.firebaseService
      .messages()
      .filter((m) => (m.date || '') >= startStr);
    const seeds = this.firebaseService
      .seeds()
      .filter((s) => (s.date || '') >= startStr);
    const testimonies = this.firebaseService
      .testimonies()
      .filter((t) => (t.date || '') >= startStr);

    const authoritiesMap = new Map(
      this.firebaseService.authorities().map((a) => [a.id, a.currency || 'GHS'])
    );

    const prayerMinutes = sessions.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
    const partnerPrayerMinutes = sessions
      .filter((s) => s.wasTogether)
      .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
    const individualPrayerMinutes = Math.max(0, prayerMinutes - partnerPrayerMinutes);
    const partnerPrayerPct =
      prayerMinutes > 0 ? Math.round((partnerPrayerMinutes / prayerMinutes) * 1000) / 10 : 0;

    const uniquePrayerDays = new Set(sessions.map((s) => s.date)).size;
    const divisorDays =
      period === 'all' ? Math.max(1, uniquePrayerDays) : Math.max(1, days);
    const dailyAvgPrayerMinutes = Math.round((prayerMinutes / divisorDays) * 10) / 10;

    const messageMinutes = messages.reduce(
      (sum, m) => sum + (Number(m.durationMinutes) || 0),
      0
    );
    const messageListenings = messages.reduce(
      (sum, m) => sum + Math.max(1, Number(m.listenCount) || 1),
      0
    );
    const avgMinutesPerMessage =
      messages.length > 0 ? Math.round((messageMinutes / messages.length) * 10) / 10 : 0;
    const avgListenMultiplier =
      messages.length > 0 ? Math.round((messageListenings / messages.length) * 10) / 10 : 0;

    const seedGivenGhs = seeds.reduce((sum, s) => {
      const curr = authoritiesMap.get(s.authorityId) || 'GHS';
      return sum + this.firebaseService.convertToGhs(Number(s.amount) || 0, curr);
    }, 0);

    return {
      prayerMinutes,
      prayerSessionsCount: sessions.length,
      partnerPrayerMinutes,
      individualPrayerMinutes,
      partnerPrayerPct,
      activePrayerDays: uniquePrayerDays,
      dailyAvgPrayerMinutes,
      messageMinutes,
      messagesCount: messages.length,
      messageListenings,
      avgMinutesPerMessage,
      avgListenMultiplier,
      seedGivenGhs,
      seedEntriesCount: seeds.length,
      testimoniesCount: testimonies.length,
    };
  });

  readonly periodComparison = computed(() => {
    const period = this.selectedPeriod();
    if (period === 'all') {
      return { prayerGrowthPct: 0, messageGrowthPct: 0, seedGrowthPct: 0 };
    }
    const days = this.getPeriodDays(period);
    const currentStart = this.getDateOffsetStr(days - 1);
    const prevStart = this.getDateOffsetStr(days * 2 - 1);

    const prevSessions = this.firebaseService
      .filteredSessions()
      .filter((s) => s.date >= prevStart && s.date < currentStart);
    const prevMessages = this.firebaseService
      .messages()
      .filter((m) => m.date >= prevStart && m.date < currentStart);
    const prevSeeds = this.firebaseService
      .seeds()
      .filter((s) => s.date >= prevStart && s.date < currentStart);

    const authoritiesMap = new Map(
      this.firebaseService.authorities().map((a) => [a.id, a.currency || 'GHS'])
    );

    const prevPrayerMins = prevSessions.reduce(
      (sum, s) => sum + (Number(s.durationMinutes) || 0),
      0
    );
    const prevMsgMins = prevMessages.reduce(
      (sum, m) => sum + (Number(m.durationMinutes) || 0),
      0
    );
    const prevSeedGhs = prevSeeds.reduce((sum, s) => {
      const curr = authoritiesMap.get(s.authorityId) || 'GHS';
      return sum + this.firebaseService.convertToGhs(Number(s.amount) || 0, curr);
    }, 0);

    const curr = this.periodMetrics();
    const calcDelta = (nowVal: number, prevVal: number): number => {
      if (prevVal <= 0) return nowVal > 0 ? 100 : 0;
      return Math.round(((nowVal - prevVal) / prevVal) * 1000) / 10;
    };

    return {
      prayerGrowthPct: calcDelta(curr.prayerMinutes, prevPrayerMins),
      messageGrowthPct: calcDelta(curr.messageMinutes, prevMsgMins),
      seedGrowthPct: calcDelta(curr.seedGivenGhs, prevSeedGhs),
    };
  });

  readonly answeredPetitionsCount = computed(
    () => this.firebaseService.requests().filter((r) => r.status === 'answered').length
  );

  readonly activePetitionsCount = computed(
    () => this.firebaseService.requests().filter((r) => r.status !== 'answered').length
  );

  readonly answerRatePct = computed(() => {
    const total = this.firebaseService.requests().length;
    if (total === 0) return 0;
    return Math.round((this.answeredPetitionsCount() / total) * 1000) / 10;
  });

  readonly topSpeakers = computed<SpeakerRankItem[]>(() => {
    const period = this.selectedPeriod();
    const days = this.getPeriodDays(period);
    const startStr = period === 'all' ? '0000-01-01' : this.getDateOffsetStr(days - 1);
    const list = this.firebaseService
      .messages()
      .filter((m) => (m.date || '') >= startStr);

    const map = new Map<string, { minutes: number; listenCount: number }>();
    let totalMins = 0;

    for (const m of list) {
      const key = (m.speaker || '').trim() || m.title || 'Unspecified';
      const mins = Number(m.durationMinutes) || 0;
      const listens = Math.max(1, Number(m.listenCount) || 1);
      totalMins += mins;
      const existing = map.get(key) || { minutes: 0, listenCount: 0 };
      existing.minutes += mins;
      existing.listenCount += listens;
      map.set(key, existing);
    }

    return Array.from(map.entries())
      .map(([speaker, data]) => ({
        speaker,
        minutes: data.minutes,
        hours: Math.round((data.minutes / 60) * 10) / 10,
        listenCount: data.listenCount,
        pct: totalMins > 0 ? Math.min(100, Math.round((data.minutes / totalMins) * 1000) / 10) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
  });

  readonly trendChartTitle = computed(() => {
    const p = this.selectedPeriod();
    if (p === 'week') return 'Daily Activity (Last 7 Days)';
    if (p === 'month') return 'Weekly Progression (Last 6 Weeks)';
    if (p === 'quarter') return 'Bi-Weekly Progression (Last 12 Weeks)';
    return 'Monthly Progression (Last 6 Months)';
  });

  readonly trendBars = computed<TrendBarPoint[]>(() => {
    const p = this.selectedPeriod();
    const sessions = this.firebaseService.filteredSessions();
    const messages = this.firebaseService.messages();
    const seeds = this.firebaseService.seeds();
    const authoritiesMap = new Map(
      this.firebaseService.authorities().map((a) => [a.id, a.currency || 'GHS'])
    );

    const buckets: {
      label: string;
      subLabel: string;
      startDate: string;
      endDate: string;
    }[] = [];

    if (p === 'week') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = this.getDateOffsetStr(i);
        buckets.push({
          label: dayNames[d.getDay()],
          subLabel: ds.slice(5),
          startDate: ds,
          endDate: ds,
        });
      }
    } else if (p === 'month' || p === 'quarter') {
      const count = 6;
      const spanDays = p === 'month' ? 7 : 14;
      for (let i = count - 1; i >= 0; i--) {
        const endOffset = i * spanDays;
        const startOffset = endOffset + spanDays - 1;
        const startStr = this.getDateOffsetStr(startOffset);
        const endStr = this.getDateOffsetStr(endOffset);
        buckets.push({
          label: startStr.slice(5),
          subLabel: `to ${endStr.slice(5)}`,
          startDate: startStr,
          endDate: endStr,
        });
      }
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const startStr = `${y}-${m}-01`;
        const endStr = `${y}-${m}-31`;
        buckets.push({
          label: monthNames[d.getMonth()],
          subLabel: String(y),
          startDate: startStr,
          endDate: endStr,
        });
      }
    }

    const rawPoints = buckets.map((b) => {
      const prayerMinutes = sessions
        .filter((s) => s.date >= b.startDate && s.date <= b.endDate)
        .reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
      const messageMinutes = messages
        .filter((m) => m.date >= b.startDate && m.date <= b.endDate)
        .reduce((sum, m) => sum + (Number(m.durationMinutes) || 0), 0);
      const seedGhs = seeds
        .filter((s) => s.date >= b.startDate && s.date <= b.endDate)
        .reduce((sum, s) => {
          const curr = authoritiesMap.get(s.authorityId) || 'GHS';
          return sum + this.firebaseService.convertToGhs(Number(s.amount) || 0, curr);
        }, 0);

      return {
        label: b.label,
        subLabel: b.subLabel,
        prayerMinutes,
        prayerHours: Math.round((prayerMinutes / 60) * 10) / 10,
        messageMinutes,
        messageHours: Math.round((messageMinutes / 60) * 10) / 10,
        seedGhs: Math.round(seedGhs * 10) / 10,
      };
    });

    const maxHours = Math.max(
      1,
      ...rawPoints.map((r) => Math.max(r.prayerHours, r.messageHours))
    );
    const maxSeed = Math.max(1, ...rawPoints.map((r) => r.seedGhs));

    return rawPoints.map((r) => ({
      ...r,
      prayerHeightPct:
        r.prayerHours > 0 ? Math.max(10, Math.round((r.prayerHours / maxHours) * 100)) : 4,
      messageHeightPct:
        r.messageHours > 0 ? Math.max(10, Math.round((r.messageHours / maxHours) * 100)) : 4,
      seedHeightPct:
        r.seedGhs > 0 ? Math.max(10, Math.round((r.seedGhs / maxSeed) * 100)) : 4,
    }));
  });
}
