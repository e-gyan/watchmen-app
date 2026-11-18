import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from './services/firebase.service';
import {
  AppTabId,
  PrayerRequest,
  PrayerSession,
  Testimony,
} from './models/prayer.model';
import { LogSessionModal } from './components/log-session-modal';
import { TestimonyModal } from './components/testimony-modal';
import { TargetModal } from './components/target-modal';
import { RequestModal } from './components/request-modal';
import { CreateCircleModal } from './components/create-circle-modal';
import { AddPartnerModal } from './components/add-partner-modal';
import { MessagesTracker } from './components/messages-tracker';
import { SeedTracker } from './components/seed-tracker';
import { AnalyticsTracker } from './components/analytics-tracker';
import { Streak } from './components/streak';
import { ThemeToggle } from './components/theme-toggle';
import { AuthModal } from './components/auth-modal';
import { ThemeService } from './services/theme.service';
import { PwaService } from './services/pwa.service';

export type AppTab = AppTabId;
export type JournalGroupMode = 'day' | 'week' | 'month' | 'year' | 'custom' | 'all';

export interface JournalRecordGroup {
  key: string;
  title: string;
  subtitle: string;
  totalMinutes: number;
  sessionsCount: number;
  sessions: PrayerSession[];
  defaultDate?: string;
}

const TAB_ORDER: AppTab[] = [
  'dashboard',
  'messages',
  'seeds',
  'journal',
  'analytics',
  'testimonies',
  'covenant',
];

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    LogSessionModal,
    TestimonyModal,
    TargetModal,
    RequestModal,
    CreateCircleModal,
    AddPartnerModal,
    MessagesTracker,
    SeedTracker,
    AnalyticsTracker,
    Streak,
    ThemeToggle,
    AuthModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class App implements OnInit, OnDestroy {
  readonly firebaseService = inject(FirebaseService);
  readonly themeService = inject(ThemeService);
  readonly pwaService = inject(PwaService);
  private http = inject(HttpClient);

  // Active navigation tab & directional slide animation state
  readonly activeTab = signal<AppTab>('dashboard');
  readonly tabSlideDirection = signal<'next' | 'prev'>('next');

  // Backend-Driven Bottom Menu Bar Left/Right Sliding Track & Touch/Swipe State
  readonly isSlideAnimating = signal<boolean>(false);
  readonly isSwiping = signal<boolean>(false);
  readonly swipeOffsetPx = signal<number>(0);
  private slideAnimTimeout: ReturnType<typeof setTimeout> | null = null;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchLockedAxis: 'x' | 'y' | null = null;

  // Computed index inside the backend-configured bottom menu bar (0..N-1, or -1 if sidebar-only tab)
  readonly activeBottomIndex = computed(() => {
    const tab = this.activeTab();
    return this.firebaseService.bottomNavItems().findIndex((item) => item.id === tab);
  });

  readonly isBottomBarTab = computed(() => this.activeBottomIndex() >= 0);

  readonly canSlidePrev = computed(() => {
    const idx = this.activeBottomIndex();
    return idx > 0;
  });

  readonly canSlideNext = computed(() => {
    const idx = this.activeBottomIndex();
    const total = this.firebaseService.bottomNavItems().length;
    return idx >= 0 && idx < total - 1;
  });

  // Hardware-accelerated horizontal track transform for the bottom menu bar views
  readonly carouselTrackTransform = computed(() => {
    const idx = Math.max(0, this.activeBottomIndex());
    const offset = this.swipeOffsetPx();
    return `translate3d(calc(${-idx * 100}% + ${offset}px), 0, 0)`;
  });

  readonly carouselTrackTransition = computed(() => {
    if (this.isSwiping()) return 'none';
    const cfg = this.firebaseService.slideConfig();
    return `transform ${cfg.durationMs}ms ${cfg.easing}`;
  });

  // Smoothly sliding active indicator pill transform inside the bottom menu bar
  readonly bottomPillTransform = computed(() => {
    const idx = Math.max(0, this.activeBottomIndex());
    return `translate3d(${idx * 100}%, 0, 0)`;
  });

  readonly bottomPillTransition = computed(() => {
    const cfg = this.firebaseService.slideConfig();
    return `transform ${cfg.durationMs}ms ${cfg.easing}`;
  });

  // Slide-Over Sidebar Menu state
  readonly showHeaderMenu = signal<boolean>(false);

  // Journal Grouping Mode: Day, Week, Month, Year, Custom, or All
  readonly journalGroupMode = signal<JournalGroupMode>('day');
  readonly journalCustomStart = signal<string>(this.getDefaultCustomStartDate());
  readonly journalCustomEnd = signal<string>(this.firebaseService.getTodayDateString());

  // Modals state
  readonly showLogModal = signal(false);
  readonly showTestimonyModal = signal(false);
  readonly showTargetModal = signal(false);
  readonly showRequestModal = signal(false);
  readonly showCreateCircleModal = signal(false);
  readonly showAddPartnerModal = signal(false);
  readonly showAuthModal = signal(false);

  readonly initialLogMinutes = signal<number>(0);
  readonly initialLogDate = signal<string | null>(null);
  readonly sessionToEdit = signal<PrayerSession | null>(null);

  readonly prefillTestimonyTitle = signal('');
  readonly prefillTestimonyBurden = signal('');
  readonly allocatingSessionId = signal<string | null>(null);
  readonly testimonyToEdit = signal<Testimony | null>(null);

  readonly editingRequest = signal<PrayerRequest | null>(null);

  // Toast notification
  readonly toastMessage = signal<string | null>(null);
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;
  private alertCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Daily Notification Alert Parameters Form (Configured inside Covenant tab)
  readonly isSavingAlerts = signal(false);
  readonly alertSettingsForm = new FormGroup({
    prayerAlertEnabled: new FormControl<boolean>(true, { nonNullable: true }),
    prayerCheckTime: new FormControl<string>('20:00', { nonNullable: true }),
    prayerAlertMessage: new FormControl<string>(
      'No prayer session recorded today. Take time at the altar.',
      { nonNullable: true }
    ),
    messageAlertEnabled: new FormControl<boolean>(true, { nonNullable: true }),
    messageCheckTime: new FormControl<string>('21:00', { nonNullable: true }),
    messageAlertMessage: new FormControl<string>(
      'No message listening recorded today. Feed on the Word.',
      { nonNullable: true }
    ),
  });

  // Search, Filters & Sort for Dashboard Recent Records
  readonly dashboardRecordSearch = signal('');
  readonly dashboardRecordType = signal<'all' | 'prayer' | 'message' | 'seed' | 'testimony' | 'petition'>('all');
  readonly dashboardRecordSort = signal<'newest' | 'oldest'>('newest');

  // Search, Filters & Sort for Journal
  readonly journalSearch = signal('');
  readonly journalCategory = signal<string>('all');
  readonly journalMember = signal<string>('all');
  readonly journalSort = signal<'newest' | 'oldest' | 'longest'>('newest');

  // Search, Filters & Sort for Testimonies
  readonly testimonySearch = signal('');
  readonly testimonyCategory = signal<string>('all');
  readonly testimonySort = signal<'newest' | 'oldest' | 'mostAmens'>('newest');

  // Search, Filters & Sort for Covenant Petitions
  readonly requestSearch = signal('');
  readonly requestStatusFilter = signal<'all' | 'active' | 'waiting' | 'answered'>('all');
  readonly requestSort = signal<'newest' | 'oldest'>('newest');

  // WhatsApp Digest generator state
  readonly copiedDigest = signal(false);
  readonly isGeneratingDigest = signal(false);
  readonly generatedEncouragement = signal<string | null>(null);

  // Delete confirmation
  readonly deleteConfirmation = signal<{ type: 'session' | 'testimony' | 'request' | 'message' | 'authority' | 'seed'; id: string } | null>(null);

  readonly Math = Math;

  constructor() {
    effect(() => {
      const settings = this.firebaseService.alertSettings();
      this.alertSettingsForm.patchValue(
        {
          prayerAlertEnabled: settings.prayerCheckEnabled,
          prayerCheckTime: settings.prayerCheckTime || '20:00',
          prayerAlertMessage:
            settings.prayerAlertMessage ||
            'No prayer session recorded today. Take time at the altar.',
          messageAlertEnabled: settings.messageCheckEnabled,
          messageCheckTime: settings.messageCheckTime || '21:00',
          messageAlertMessage:
            settings.messageAlertMessage ||
            'No message listening recorded today. Feed on the Word.',
        },
        { emitEvent: false }
      );
    });
  }

  ngOnInit() {
    if (typeof window !== 'undefined') {
      // Check daily prayer & message alert conditions every 60 seconds
      this.alertCheckInterval = setInterval(() => {
        this.runDailyActivityAlertCheck(false);
      }, 60_000);
    }
  }

  ngOnDestroy() {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    if (this.slideAnimTimeout) {
      clearTimeout(this.slideAnimTimeout);
    }
  }

  // Current user display name or email prefix
  readonly currentUserName = computed(() => {
    const user = this.firebaseService.currentUser();
    if (!user) return '';
    return user.displayName || user.email?.split('@')[0] || 'Intercessor';
  });

  // Unified Recent Records on Dashboard (Newest on Top by default, with Filter & Sort)
  readonly dashboardRecords = computed(() => {
    const search = this.dashboardRecordSearch().trim().toLowerCase();
    const typeFilter = this.dashboardRecordType();
    const sortOrder = this.dashboardRecordSort();

    const authoritiesMap = new Map(
      this.firebaseService.authorities().map((a) => [a.id, a])
    );

    interface DashboardRecordItem {
      id: string;
      type: 'prayer' | 'message' | 'seed' | 'testimony' | 'petition';
      typeLabel: string;
      icon: string;
      title: string;
      subtitle: string;
      metricPrimary: string;
      metricSecondary?: string;
      date: string;
      sortTimestamp: string;
      authorName: string;
      tab: AppTab;
      authorityId?: string;
    }

    const items: DashboardRecordItem[] = [];

    // 1. Prayer Sessions
    for (const s of this.firebaseService.filteredSessions()) {
      items.push({
        id: s.id,
        type: 'prayer',
        typeLabel: 'Prayer',
        icon: 'menu_book',
        title: s.category || 'Prayer Session',
        subtitle: s.notes || (s.topics?.length ? s.topics.join(', ') : 'Prayer log'),
        metricPrimary: this.firebaseService.formatMinutes(s.durationMinutes),
        metricSecondary: s.wasTogether ? 'Partner' : 'Individual',
        date: s.date,
        sortTimestamp: `${s.date}T${s.startTime || '00:00'}`,
        authorName: s.authorName,
        tab: 'journal',
      });
    }

    // 2. Messages
    for (const m of this.firebaseService.filteredMessages()) {
      items.push({
        id: m.id,
        type: 'message',
        typeLabel: 'Message',
        icon: 'headphones',
        title: m.title,
        subtitle: m.speaker ? `Speaker: ${m.speaker}` : (m.notes || 'Message listening'),
        metricPrimary: `${this.firebaseService.formatMinutes(m.durationMinutes)} (${this.firebaseService.formatInteger(m.listenCount || 1)}x)`,
        metricSecondary: m.wasTogether ? 'Partner' : 'Individual',
        date: m.date,
        sortTimestamp: `${m.date}T${m.createdAt || ''}`,
        authorName: m.authorName,
        tab: 'messages',
      });
    }

    // 3. Seeds (Only seeds belonging to an existing Authority Seed Target)
    for (const seed of this.firebaseService.seeds()) {
      const authTarget = authoritiesMap.get(seed.authorityId);
      if (!authTarget) continue;
      const curr = (authTarget.currency || 'GHS').toUpperCase();
      const amountNum = Number(seed.amount) || 0;
      const amountGhs = this.firebaseService.convertToGhs(amountNum, curr);
      items.push({
        id: seed.id,
        type: 'seed',
        typeLabel: 'Seed',
        icon: 'volunteer_activism',
        title: authTarget.authorityName,
        subtitle: seed.notes || `Annual target (${authTarget.targetYear})`,
        metricPrimary:
          curr === 'GHS'
            ? `GHS ${this.firebaseService.formatOneDecimal(amountNum)}`
            : `${curr} ${this.firebaseService.formatOneDecimal(amountNum)} (≈ GHS ${this.firebaseService.formatOneDecimal(amountGhs)})`,
        metricSecondary: seed.mode === 'partner' ? 'Partner' : 'Alone',
        date: seed.date,
        sortTimestamp: `${seed.date}T${seed.createdAt || ''}`,
        authorName: seed.authorName,
        tab: 'seeds',
        authorityId: authTarget.id,
      });
    }

    // 4. Testimonies
    for (const t of this.firebaseService.testimonies()) {
      items.push({
        id: t.id,
        type: 'testimony',
        typeLabel: 'Testimony',
        icon: 'celebration',
        title: t.title,
        subtitle: t.answeredDetail,
        metricPrimary: `${this.firebaseService.formatInteger(t.amensCount || 0)} Amens`,
        metricSecondary: t.category,
        date: t.date,
        sortTimestamp: `${t.date}T${t.id}`,
        authorName: t.authorName,
        tab: 'testimonies',
      });
    }

    // 5. Covenant Petitions
    for (const r of this.firebaseService.requests()) {
      items.push({
        id: r.id,
        type: 'petition',
        typeLabel: 'Petition',
        icon: 'handshake',
        title: r.title,
        subtitle: r.notes || 'Covenant prayer request',
        metricPrimary: r.status === 'answered' ? 'Answered' : (r.status === 'waiting' ? 'Waiting' : 'Active'),
        date: r.dateAdded,
        sortTimestamp: `${r.dateAdded}T${r.id}`,
        authorName: 'Circle',
        tab: 'covenant',
      });
    }

    let filtered = items;
    if (typeFilter !== 'all') {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (search) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.subtitle.toLowerCase().includes(search) ||
          item.authorName.toLowerCase().includes(search) ||
          item.typeLabel.toLowerCase().includes(search) ||
          item.metricPrimary.toLowerCase().includes(search)
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'oldest') {
        return (
          (a.date || '').localeCompare(b.date || '') ||
          (a.sortTimestamp || '').localeCompare(b.sortTimestamp || '')
        );
      }
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.sortTimestamp || '').localeCompare(a.sortTimestamp || '')
      );
    });
  });

  // Filtered session journal list (with custom date range support when 'custom' is active)
  readonly displayedJournalSessions = computed(() => {
    let list = this.firebaseService.sessions();
    const query = this.journalSearch().trim().toLowerCase();
    const cat = this.journalCategory();
    const member = this.journalMember();
    const sort = this.journalSort();
    const mode = this.journalGroupMode();
    const start = this.journalCustomStart();
    const end = this.journalCustomEnd();

    if (mode === 'custom') {
      if (start) {
        list = list.filter((s) => s.date >= start);
      }
      if (end) {
        list = list.filter((s) => s.date <= end);
      }
    }

    if (member !== 'all') {
      list = list.filter(
        (s) =>
          s.authorUid === member ||
          s.authorName === member ||
          s.participantNames?.includes(member)
      );
    }

    if (cat !== 'all') {
      list = list.filter(
        (s) => s.category === cat || (s.categories && s.categories.includes(cat))
      );
    }

    if (query) {
      list = list.filter(
        (s) =>
          s.notes.toLowerCase().includes(query) ||
          (s.scripture && s.scripture.toLowerCase().includes(query)) ||
          s.category.toLowerCase().includes(query) ||
          (s.categories && s.categories.some((c) => c.toLowerCase().includes(query))) ||
          s.authorName.toLowerCase().includes(query) ||
          (s.participantNames && s.participantNames.some((p) => p.toLowerCase().includes(query))) ||
          s.topics.some((t) => t.toLowerCase().includes(query))
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'oldest') {
        return (
          (a.date || '').localeCompare(b.date || '') ||
          (a.startTime || '').localeCompare(b.startTime || '') ||
          (a.id || '').localeCompare(b.id || '')
        );
      }
      if (sort === 'longest') {
        return (Number(b.durationMinutes) || 0) - (Number(a.durationMinutes) || 0);
      }
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.startTime || '').localeCompare(a.startTime || '') ||
        (b.id || '').localeCompare(a.id || '')
      );
    });
  });

  // Grouped Journal Records by Day, Week, Month, Year, or Custom Date Range
  readonly groupedJournalRecords = computed<JournalRecordGroup[]>(() => {
    const sessions = this.displayedJournalSessions();
    const mode = this.journalGroupMode();
    const sort = this.journalSort();

    if (mode === 'all') {
      return [];
    }

    if (mode === 'custom') {
      if (sessions.length === 0) return [];
      const start = this.journalCustomStart() || 'Start';
      const end = this.journalCustomEnd() || 'Today';
      const totalMinutes = sessions.reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0);
      return [
        {
          key: `custom-${start}-${end}`,
          title: `${start} — ${end}`,
          subtitle: 'Custom Range',
          totalMinutes,
          sessionsCount: sessions.length,
          sessions,
          defaultDate: this.firebaseService.getTodayDateString(),
        },
      ];
    }

    const groupMap = new Map<string, JournalRecordGroup>();

    for (const s of sessions) {
      const [yStr, mStr, dStr] = (s.date || '').split('-');
      const year = Number(yStr) || new Date().getFullYear();
      const month = Number(mStr) || 1;
      const day = Number(dStr) || 1;
      const dateObj = new Date(year, month - 1, day);

      let key = s.date;
      let title = s.date;
      let subtitle = '';
      let defaultDate = s.date;

      if (mode === 'day') {
        key = s.date;
        title = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        subtitle = s.date;
        defaultDate = s.date;
      } else if (mode === 'week') {
        const dayOfWeek = dateObj.getDay();
        const distToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(dateObj);
        monday.setDate(dateObj.getDate() - distToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const monKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        const monLabel = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const sunLabel = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        key = monKey;
        title = `${monLabel} – ${sunLabel}`;
        subtitle = 'Weekly Group';
        defaultDate = s.date;
      } else if (mode === 'month') {
        key = `${year}-${String(month).padStart(2, '0')}`;
        title = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        subtitle = 'Monthly Group';
        defaultDate = s.date;
      } else if (mode === 'year') {
        key = `${year}`;
        title = `${year}`;
        subtitle = 'Yearly Group';
        defaultDate = s.date;
      }

      const existing = groupMap.get(key);
      if (existing) {
        existing.sessions.push(s);
        existing.totalMinutes += Number(s.durationMinutes) || 0;
        existing.sessionsCount += 1;
      } else {
        groupMap.set(key, {
          key,
          title,
          subtitle,
          totalMinutes: Number(s.durationMinutes) || 0,
          sessionsCount: 1,
          sessions: [s],
          defaultDate,
        });
      }
    }

    const groups = Array.from(groupMap.values());
    return groups.sort((a, b) => {
      if (sort === 'oldest') {
        return a.key.localeCompare(b.key);
      }
      if (sort === 'longest') {
        return b.totalMinutes - a.totalMinutes || b.key.localeCompare(a.key);
      }
      return b.key.localeCompare(a.key);
    });
  });

  // Total minutes across currently filtered Journal sessions
  readonly filteredJournalTotalMinutes = computed(() => {
    return this.displayedJournalSessions().reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0);
  });

  // Filtered testimonies list (Newest on top by default)
  readonly displayedTestimonies = computed(() => {
    let list = this.firebaseService.testimonies();
    const query = this.testimonySearch().trim().toLowerCase();
    const cat = this.testimonyCategory();
    const sort = this.testimonySort();

    if (cat !== 'all') {
      list = list.filter(
        (t) => t.category === cat || (t.categories && t.categories.includes(cat))
      );
    }

    if (query) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.answeredDetail.toLowerCase().includes(query) ||
          t.prayerBurden.toLowerCase().includes(query) ||
          (t.scripturePraise && t.scripturePraise.toLowerCase().includes(query))
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'oldest') {
        return (
          (a.date || '').localeCompare(b.date || '') ||
          (a.id || '').localeCompare(b.id || '')
        );
      }
      if (sort === 'mostAmens') {
        return (Number(b.amensCount) || 0) - (Number(a.amensCount) || 0);
      }
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.id || '').localeCompare(a.id || '')
      );
    });
  });

  // Filtered & sorted Covenant Petitions (Newest on top by default)
  readonly displayedRequests = computed(() => {
    let list = this.firebaseService.requests();
    const query = this.requestSearch().trim().toLowerCase();
    const status = this.requestStatusFilter();
    const sort = this.requestSort();

    if (status !== 'all') {
      list = list.filter((r) => r.status === status);
    }

    if (query) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          (r.notes && r.notes.toLowerCase().includes(query))
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'oldest') {
        return (
          (a.dateAdded || '').localeCompare(b.dateAdded || '') ||
          (a.id || '').localeCompare(b.id || '')
        );
      }
      return (
        (b.dateAdded || '').localeCompare(a.dateAdded || '') ||
        (b.id || '').localeCompare(a.id || '')
      );
    });
  });

  // SVG Chart Computations for 5-Day Bar Chart
  readonly chart7DaysMaxMins = computed(() => {
    const bars = this.firebaseService.past7DaysData();
    const p = this.firebaseService.activePartnership();
    const target = p ? p.dailyTargetMinutes : 60;
    const maxVal = Math.max(target * 1.3, ...bars.map((b) => b.totalMinutes));
    return Math.max(90, maxVal);
  });

  // SVG Chart Computations for 2-Week Trend Chart
  readonly chart8WeeksMaxMins = computed(() => {
    const weeks = this.firebaseService.past8WeeksData();
    const p = this.firebaseService.activePartnership();
    const target = p ? p.weeklyTargetMinutes : 420;
    const maxVal = Math.max(target * 1.2, ...weeks.map((w) => w.totalMinutes));
    return Math.max(480, maxVal);
  });

  private getDefaultCustomStartDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  setCustomRangePreset(preset: '7d' | '30d' | '90d' | 'year') {
    const today = new Date();
    const endStr = this.firebaseService.getTodayDateString();
    this.journalCustomEnd.set(endStr);

    if (preset === 'year') {
      this.journalCustomStart.set(`${today.getFullYear()}-01-01`);
      return;
    }

    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const start = new Date();
    start.setDate(today.getDate() - days);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    this.journalCustomStart.set(`${y}-${m}-${d}`);
  }

  async installPwaApp() {
    this.showHeaderMenu.set(false);
    const accepted = await this.pwaService.promptInstall();
    if (accepted) {
      this.showToast('Watchman installed on your device.');
    }
  }

  async enableNotificationAlerts() {
    const status = await this.pwaService.enableNotifications();
    if (status === 'granted') {
      this.showToast('Notification alerts enabled.');
    } else if (status === 'denied') {
      this.showToast('Notifications blocked in browser settings.');
    } else if (status === 'unsupported') {
      this.showToast('Notifications not supported in this browser.');
    }
  }

  async sendTestNotificationAlert() {
    await this.pwaService.sendAlert(
      'Watchman Prayer Reminder',
      'Stay steadfast on your daily prayer and word watch.'
    );
    this.showToast('Test notification alert sent.');
  }

  // Save Covenant Daily Prayer & Message Notification Alert Settings
  async saveAlertSettings() {
    this.isSavingAlerts.set(true);
    const val = this.alertSettingsForm.getRawValue();
    try {
      if (val.prayerAlertEnabled || val.messageAlertEnabled) {
        if (this.pwaService.notificationStatus() === 'default') {
          await this.pwaService.enableNotifications();
        }
      }
      await this.firebaseService.updateAlertSettings({
        enabled: val.prayerAlertEnabled || val.messageAlertEnabled,
        prayerCheckEnabled: val.prayerAlertEnabled,
        prayerCheckTime: val.prayerCheckTime || '20:00',
        prayerAlertMessage:
          val.prayerAlertMessage.trim() ||
          'No prayer session recorded today. Take time at the altar.',
        messageCheckEnabled: val.messageAlertEnabled,
        messageCheckTime: val.messageCheckTime || '21:00',
        messageAlertMessage:
          val.messageAlertMessage.trim() ||
          'No message listening recorded today. Feed on the Word.',
      });
      this.showToast('Alert parameters saved.');
    } finally {
      this.isSavingAlerts.set(false);
    }
  }

  // Evaluate daily prayer and message logs and fire notification alerts if none recorded for today
  async runDailyActivityAlertCheck(manual = false) {
    if (typeof window === 'undefined') return;
    if (!this.firebaseService.isAuthenticated()) return;

    const settings = this.firebaseService.alertSettings();
    const todayStr = this.firebaseService.getTodayDateString();
    const now = new Date();
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todayPrayerMins = this.firebaseService.todayMinutes();
    const todayMsgMins = this.firebaseService.todayMessageMinutes();

    let triggeredAny = false;

    // 1. Daily Prayer Check
    if (settings.prayerCheckEnabled) {
      const checkTime = settings.prayerCheckTime || '20:00';
      const storageKey = `watchman_prayer_alert_${todayStr}`;
      const alreadyNotified = !manual && localStorage.getItem(storageKey) === '1';

      if (todayPrayerMins <= 0 && (manual || (nowTimeStr >= checkTime && !alreadyNotified))) {
        if (!manual) {
          localStorage.setItem(storageKey, '1');
        }
        await this.pwaService.sendAlert(
          'Daily Prayer Watch Check',
          settings.prayerAlertMessage || 'No prayer session recorded today. Take time at the altar.'
        );
        this.showToast('Prayer check alert: 0 mins recorded today.');
        triggeredAny = true;
      }
    }

    // 2. Daily Message Check
    if (settings.messageCheckEnabled) {
      const checkTime = settings.messageCheckTime || '21:00';
      const storageKey = `watchman_message_alert_${todayStr}`;
      const alreadyNotified = !manual && localStorage.getItem(storageKey) === '1';

      if (todayMsgMins <= 0 && (manual || (nowTimeStr >= checkTime && !alreadyNotified))) {
        if (!manual) {
          localStorage.setItem(storageKey, '1');
        }
        await this.pwaService.sendAlert(
          'Daily Message Check',
          settings.messageAlertMessage || 'No message listening recorded today. Feed on the Word.'
        );
        if (!triggeredAny) {
          this.showToast('Message check alert: 0 mins recorded today.');
        }
        triggeredAny = true;
      }
    }

    if (manual && !triggeredAny) {
      this.showToast(
        `Daily check complete: ${this.firebaseService.formatMinutes(todayPrayerMins)} prayer & ${this.firebaseService.formatMinutes(todayMsgMins)} message logged today.`
      );
    }
  }

  toggleHeaderMenu() {
    this.showHeaderMenu.update((v) => !v);
  }

  closeHeaderMenu() {
    this.showHeaderMenu.set(false);
  }

  // Switch Active Tab with Directional Left/Right Slide Transition & Collapse Sidebar Menu
  setTab(tab: AppTab) {
    const prev = this.activeTab();
    if (prev !== tab) {
      const prevIdx = TAB_ORDER.indexOf(prev);
      const nextIdx = TAB_ORDER.indexOf(tab);
      this.tabSlideDirection.set(nextIdx >= prevIdx ? 'next' : 'prev');
      this.triggerSlideAnimation();
      this.activeTab.set(tab);
    }
    this.swipeOffsetPx.set(0);
    this.isSwiping.set(false);
    this.showHeaderMenu.set(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private triggerSlideAnimation() {
    if (this.slideAnimTimeout) {
      clearTimeout(this.slideAnimTimeout);
    }
    this.isSlideAnimating.set(true);
    const duration = this.firebaseService.slideConfig().durationMs || 360;
    this.slideAnimTimeout = setTimeout(() => {
      this.isSlideAnimating.set(false);
    }, duration + 40);
  }

  // Slide Left to Previous Option in Bottom Menu Bar
  slidePrevTab() {
    const items = this.firebaseService.bottomNavItems();
    const idx = this.activeBottomIndex();
    if (idx > 0) {
      this.setTab(items[idx - 1].id);
    } else if (idx === -1 && items.length > 0) {
      this.setTab(items[0].id);
    }
  }

  // Slide Right to Next Option in Bottom Menu Bar
  slideNextTab() {
    const items = this.firebaseService.bottomNavItems();
    const idx = this.activeBottomIndex();
    if (idx >= 0 && idx < items.length - 1) {
      this.setTab(items[idx + 1].id);
    } else if (idx === -1 && items.length > 0) {
      this.setTab(items[0].id);
    }
  }

  // Touch & Swipe Left/Right Handlers for Seamless Bottom Menu Bar Navigation
  onTouchStart(event: TouchEvent) {
    if (!this.firebaseService.slideConfig().enabled) return;
    if (event.touches.length !== 1) return;

    const targetEl = event.target as HTMLElement | null;
    if (
      targetEl &&
      targetEl.closest('input, textarea, select, [data-no-swipe="true"]')
    ) {
      this.touchStartX = null;
      this.touchStartY = null;
      return;
    }

    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchLockedAxis = null;
  }

  onTouchMove(event: TouchEvent) {
    if (this.touchStartX === null || this.touchStartY === null) return;
    if (!this.isBottomBarTab()) return;
    if (event.touches.length !== 1) return;

    const dx = event.touches[0].clientX - this.touchStartX;
    const dy = event.touches[0].clientY - this.touchStartY;

    if (!this.touchLockedAxis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      this.touchLockedAxis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'x' : 'y';
    }

    if (this.touchLockedAxis !== 'x') return;

    this.isSwiping.set(true);
    const idx = this.activeBottomIndex();
    const total = this.firebaseService.bottomNavItems().length;

    // Apply rubber-band resistance at first and last bottom menu bar options
    const atEdge = (idx === 0 && dx > 0) || (idx === total - 1 && dx < 0);
    const dampedOffset = atEdge ? dx * 0.25 : dx * 0.85;
    this.swipeOffsetPx.set(Math.max(-220, Math.min(220, dampedOffset)));
  }

  onTouchEnd() {
    if (this.touchStartX === null) return;
    const dx = this.swipeOffsetPx();
    const wasHorizontal = this.touchLockedAxis === 'x';
    const threshold = this.firebaseService.slideConfig().swipeThresholdPx || 48;

    this.touchStartX = null;
    this.touchStartY = null;
    this.touchLockedAxis = null;
    this.isSwiping.set(false);
    this.swipeOffsetPx.set(0);

    if (!wasHorizontal) return;

    // Swipe Left (dx < -threshold) -> Slide Right to Next Option
    // Swipe Right (dx > threshold) -> Slide Left to Previous Option
    if (dx <= -threshold && this.canSlideNext()) {
      this.slideNextTab();
    } else if (dx >= threshold && this.canSlidePrev()) {
      this.slidePrevTab();
    } else {
      this.triggerSlideAnimation();
    }
  }

  // Keyboard Escape & Left/Right Arrow Navigation Across Bottom Menu Bar Options
  onWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.deleteConfirmation()) {
        this.cancelDelete();
        return;
      }
      if (this.pwaService.showInstallGuide()) {
        this.pwaService.closeInstallGuide();
        return;
      }
      if (this.showHeaderMenu()) {
        this.closeHeaderMenu();
        return;
      }
    }

    if (!this.firebaseService.slideConfig().enabled) return;
    if (
      this.showHeaderMenu() ||
      this.showLogModal() ||
      this.showTestimonyModal() ||
      this.showTargetModal() ||
      this.showRequestModal() ||
      this.showCreateCircleModal() ||
      this.showAddPartnerModal() ||
      this.showAuthModal() ||
      this.deleteConfirmation() ||
      this.pwaService.showInstallGuide() ||
      (typeof document !== 'undefined' && !!document.querySelector('[data-no-swipe="true"]'))
    ) {
      return;
    }

    const activeEl = document?.activeElement as HTMLElement | null;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable)
    ) {
      return;
    }

    if (event.key === 'ArrowLeft' && this.canSlidePrev()) {
      this.slidePrevTab();
    } else if (event.key === 'ArrowRight' && this.canSlideNext()) {
      this.slideNextTab();
    }
  }

  selectCircleFromMenu(partnershipId: string) {
    this.firebaseService.selectPartnership(partnershipId);
    this.showHeaderMenu.set(false);
  }

  selectFilterMemberFromMenu(member: string) {
    this.firebaseService.setActiveFilterMember(member);
    this.showHeaderMenu.set(false);
  }

  openCreateCircleFromMenu() {
    this.showHeaderMenu.set(false);
    this.showCreateCircleModal.set(true);
  }

  openAddPartnerFromMenu() {
    this.showHeaderMenu.set(false);
    this.showAddPartnerModal.set(true);
  }

  openTargetsFromMenu() {
    this.showHeaderMenu.set(false);
    this.showTargetModal.set(true);
  }

  // Auth actions
  openSignInModal() {
    this.showHeaderMenu.set(false);
    this.showAuthModal.set(true);
  }

  async signInWithGoogle() {
    this.showHeaderMenu.set(false);
    try {
      const user = await this.firebaseService.loginWithGoogle();
      if (user) {
        this.showToast('Welcome to Watchman.');
      }
    } catch (err) {
      console.error('Sign in failed', err);
      this.showAuthModal.set(true);
    }
  }

  async signOut() {
    this.showHeaderMenu.set(false);
    try {
      await this.firebaseService.logout();
      this.showToast('Signed out.');
    } catch {
      this.showToast('Sign out error.');
    }
  }

  // Quick action: open session log modal
  openNewSessionModal(mins = 0, date: string | null = null) {
    this.showHeaderMenu.set(false);
    if (!this.firebaseService.isAuthenticated()) {
      this.showAuthModal.set(true);
      return;
    }
    if (!this.firebaseService.activePartnership()) {
      this.showCreateCircleModal.set(true);
      return;
    }
    this.sessionToEdit.set(null);
    this.initialLogMinutes.set(mins);
    this.initialLogDate.set(date);
    this.showLogModal.set(true);
  }

  // Add a new prayer time to a specific past or current day bundle
  openNewSessionForDate(dateStr: string) {
    this.openNewSessionModal(0, dateStr);
  }

  // Edit past prayer session
  openEditSessionModal(s: PrayerSession) {
    this.sessionToEdit.set(s);
    this.initialLogMinutes.set(0);
    this.initialLogDate.set(s.date);
    this.showLogModal.set(true);
  }

  // Allocate / Connect a testimony to a prayer encounter
  allocateTestimonyForSession(s: PrayerSession) {
    if (!this.firebaseService.isAuthenticated()) {
      this.signInWithGoogle();
      return;
    }
    this.testimonyToEdit.set(null);
    this.allocatingSessionId.set(s.id);
    const summaryTopic = s.topics && s.topics.length > 0 ? s.topics[0] : 'Altar Prayer';
    this.prefillTestimonyTitle.set(`Answered: ${summaryTopic}`);
    this.prefillTestimonyBurden.set(s.notes);
    this.showTestimonyModal.set(true);
  }

  // Edit existing testimony
  openEditTestimonyModal(t: Testimony) {
    this.testimonyToEdit.set(t);
    this.allocatingSessionId.set(t.linkedSessionId || null);
    this.prefillTestimonyTitle.set(t.title);
    this.prefillTestimonyBurden.set(t.prayerBurden);
    this.showTestimonyModal.set(true);
  }

  openNewTestimonyModal() {
    if (!this.firebaseService.isAuthenticated()) {
      this.signInWithGoogle();
      return;
    }
    if (!this.firebaseService.activePartnership()) {
      this.showCreateCircleModal.set(true);
      return;
    }
    this.testimonyToEdit.set(null);
    this.allocatingSessionId.set(null);
    this.showTestimonyModal.set(true);
  }

  confirmDelete(type: 'session' | 'testimony' | 'request' | 'message' | 'authority' | 'seed', id: string) {
    this.deleteConfirmation.set({ type, id });
  }

  async executeDelete() {
    const item = this.deleteConfirmation();
    if (!item) return;

    try {
      if (item.type === 'session') {
        await this.firebaseService.deleteSession(item.id);
        this.showToast('Prayer record removed.');
      } else if (item.type === 'testimony') {
        await this.firebaseService.deleteTestimony(item.id);
        this.showToast('Testimony removed.');
      } else if (item.type === 'request') {
        await this.firebaseService.deleteRequest(item.id);
        this.showToast('Petition removed.');
      } else if (item.type === 'message') {
        await this.firebaseService.deleteMessageRecord(item.id);
        this.showToast('Message removed.');
      } else if (item.type === 'authority') {
        await this.firebaseService.deleteAuthorityFigure(item.id);
        this.showToast('Seed target and all saved seeds removed.');
      } else if (item.type === 'seed') {
        await this.firebaseService.deleteSeedRecord(item.id);
        this.showToast('Seed record removed.');
      }
    } catch (e) {
      console.error('Delete error', e);
      this.showToast('Error removing record.');
    }

    this.deleteConfirmation.set(null);
  }

  cancelDelete() {
    this.deleteConfirmation.set(null);
  }

  openNewRequestModal() {
    if (!this.firebaseService.isAuthenticated()) {
      this.signInWithGoogle();
      return;
    }
    if (!this.firebaseService.activePartnership()) {
      this.showCreateCircleModal.set(true);
      return;
    }
    this.editingRequest.set(null);
    this.showRequestModal.set(true);
  }

  editRequest(r: PrayerRequest) {
    this.editingRequest.set(r);
    this.showRequestModal.set(true);
  }

  async toggleRequestAnswered(r: PrayerRequest) {
    try {
      await this.firebaseService.toggleRequestAnswered(r.id, r.status);
      if (r.status === 'active') {
        this.showToast('Marked as Answered.');
      } else {
        this.showToast('Moved back to active watch list.');
      }
    } catch (e) {
      console.error('Toggle error', e);
    }
  }

  markRequestAnswered(r: PrayerRequest) {
    this.prefillTestimonyTitle.set(`Answered: ${r.title}`);
    this.prefillTestimonyBurden.set(r.notes || r.title);
    this.showTestimonyModal.set(true);
  }

  async celebrateAmen(id: string) {
    try {
      await this.firebaseService.incrementAmen(id);
      this.showToast('Amen recorded.');
    } catch (e) {
      console.error('Amen error', e);
    }
  }

  // Generate & copy weekly partner digest for WhatsApp / messaging
  copyWeeklyDigest() {
    const p = this.firebaseService.activePartnership();
    if (!p) return;

    const partners = p.memberNames && p.memberNames.length > 0
      ? p.memberNames.join(' & ')
      : p.memberEmails.map((e) => e.split('@')[0]).join(' & ');

    const weekMins = this.firebaseService.thisWeekMinutes();
    const targetMins = p.weeklyTargetMinutes;
    const weekHoursStr = this.firebaseService.formatMinutes(weekMins);
    const targetHoursStr = this.firebaseService.formatMinutes(targetMins);
    const pct = this.firebaseService.formatPercentage(weekMins, targetMins);

    const loggedHours = this.firebaseService.formatHours(this.firebaseService.periodMinutesLogged());
    const targetHours = this.firebaseService.formatHours(p.periodTargetMinutes);
    const periodPct = this.firebaseService.formatOneDecimal(this.firebaseService.periodProgressPct());

    const streak = this.firebaseService.streakDays();
    const testimoniesCount = this.firebaseService.testimonies().length;

    const digestText = `🔥 WATCHMAN PRAYER ACCOUNTABILITY CHECK-IN
Partnership: ${p.name}
Partners: ${partners}
Covenant: ${p.periodTitle}

⏱️ This Week's Altar:
Logged: ${weekHoursStr} / ${targetHoursStr} target (${pct}%)

🎯 Milestone Progress:
${loggedHours} / ${targetHours} Hours (${periodPct}% achieved!)
Consecutive Streak: ${streak} Days in Prayer
Testimonies & Praise Reports: ${testimoniesCount} recorded`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(digestText).then(() => {
        this.copiedDigest.set(true);
        this.showToast('Weekly digest copied.');
        setTimeout(() => this.copiedDigest.set(false), 3000);
      });
    }
  }

  // Request AI Partner Encouragement via Express Backend
  fetchPartnerEncouragement() {
    const p = this.firebaseService.activePartnership();
    if (!p) return;

    this.isGeneratingDigest.set(true);
    const partners = p.memberNames && p.memberNames.length > 0
      ? p.memberNames.join(', ')
      : p.memberEmails.map((e) => e.split('@')[0]).join(', ');

    const weekHours = this.firebaseService.formatMinutes(this.firebaseService.thisWeekMinutes());
    const yearlyProgress = `${this.firebaseService.formatOneDecimal(this.firebaseService.periodProgressPct())}%`;
    const targetHours = this.firebaseService.formatHours(p.periodTargetMinutes);
    const answeredCount = this.firebaseService.testimonies().length;

    this.http
      .post<{ success: boolean; data: { message: string } }>('/api/prayer-assist', {
        action: 'encouragement',
        partnershipName: p.name,
        partners,
        weeklyHours: weekHours,
        yearlyProgress,
        targetHours,
        answeredCount,
      })
      .subscribe({
        next: (res) => {
          this.isGeneratingDigest.set(false);
          if (res?.data?.message) {
            this.generatedEncouragement.set(res.data.message);
          }
        },
        error: () => {
          this.isGeneratingDigest.set(false);
          this.generatedEncouragement.set(
            `Grace and peace to ${p.name}! Together you have logged ${weekHours} this week towards your ${targetHours}-hour target.`
          );
        },
      });
  }

  showToast(msg: string) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastMessage.set(msg);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }
}
