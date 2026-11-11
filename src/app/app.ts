import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from './services/firebase.service';
import {
  DailyPrayerBundle,
  PRAYER_CATEGORIES,
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
import { ThemeToggle } from './components/theme-toggle';
import { AuthModal } from './components/auth-modal';
import { ThemeService } from './services/theme.service';

export type AppTab = 'dashboard' | 'messages' | 'seeds' | 'journal' | 'testimonies' | 'covenant';

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
    ThemeToggle,
    AuthModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly firebaseService = inject(FirebaseService);
  readonly themeService = inject(ThemeService);
  private http = inject(HttpClient);

  // Active navigation tab
  readonly activeTab = signal<AppTab>('dashboard');

  // Collapsible Header Menu state
  readonly showHeaderMenu = signal<boolean>(false);

  // Journal View Mode: Daily Bundles (grouped by day) vs Timeline Stream
  readonly journalViewMode = signal<'bundles' | 'stream'>('bundles');

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

  readonly categories = PRAYER_CATEGORIES;
  readonly Math = Math;

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
      // Default: Newest on top
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.sortTimestamp || '').localeCompare(a.sortTimestamp || '')
      );
    });
  });

  // Filtered session journal list (Timeline stream)
  readonly displayedJournalSessions = computed(() => {
    let list = this.firebaseService.sessions();
    const query = this.journalSearch().trim().toLowerCase();
    const cat = this.journalCategory();
    const member = this.journalMember();
    const sort = this.journalSort();

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
      // Default: 'newest'
      return (
        (b.date || '').localeCompare(a.date || '') ||
        (b.startTime || '').localeCompare(a.startTime || '') ||
        (b.id || '').localeCompare(a.id || '')
      );
    });
  });

  // Filtered Daily Prayer Bundles
  readonly displayedDailyBundles = computed<DailyPrayerBundle[]>(() => {
    const bundles = this.firebaseService.dailyPrayerBundles();
    const query = this.journalSearch().trim().toLowerCase();
    const cat = this.journalCategory();
    const member = this.journalMember();
    const sort = this.journalSort();

    const filteredBundles = bundles
      .map((bundle) => {
        let matchingSessions = bundle.sessions;

        if (member !== 'all') {
          matchingSessions = matchingSessions.filter(
            (s) =>
              s.authorUid === member ||
              s.authorName === member ||
              s.participantNames?.includes(member)
          );
        }

        if (cat !== 'all') {
          matchingSessions = matchingSessions.filter(
            (s) => s.category === cat || (s.categories && s.categories.includes(cat))
          );
        }

        if (query) {
          matchingSessions = matchingSessions.filter(
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

        const sortedSessions = [...matchingSessions].sort((a, b) => {
          if (sort === 'oldest') {
            return (
              (a.startTime || '').localeCompare(b.startTime || '') ||
              (a.id || '').localeCompare(b.id || '')
            );
          }
          if (sort === 'longest') {
            return (Number(b.durationMinutes) || 0) - (Number(a.durationMinutes) || 0);
          }
          return (
            (b.startTime || '').localeCompare(a.startTime || '') ||
            (b.id || '').localeCompare(a.id || '')
          );
        });

        const filteredTotalMins = sortedSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

        return {
          ...bundle,
          sessions: sortedSessions,
          totalMinutes: filteredTotalMins,
          metDailyTarget: filteredTotalMins >= bundle.dailyTargetMinutes,
        };
      })
      .filter((bundle) => {
        if (bundle.sessions.length > 0) return true;
        if (query && (bundle.formattedDisplayDate.toLowerCase().includes(query) || bundle.dayName.toLowerCase().includes(query))) {
          return true;
        }
        return false;
      });

    return [...filteredBundles].sort((a, b) => {
      if (sort === 'oldest') {
        return a.date.localeCompare(b.date);
      }
      if (sort === 'longest') {
        return b.totalMinutes - a.totalMinutes || b.date.localeCompare(a.date);
      }
      return b.date.localeCompare(a.date);
    });
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

  toggleHeaderMenu() {
    this.showHeaderMenu.update((v) => !v);
  }

  closeHeaderMenu() {
    this.showHeaderMenu.set(false);
  }

  // Switch Active Tab & Collapse Header Menu
  setTab(tab: AppTab) {
    this.activeTab.set(tab);
    this.showHeaderMenu.set(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        this.showToast('Welcome to the Secret Place altar!');
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
      this.showToast('Signed out of prayer session.');
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
    this.prefillTestimonyTitle.set(`Testimony: Answered for ${summaryTopic}`);
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
        this.showToast('Marked as Answered! Glory to God.');
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
      this.showToast('Amen! God is faithful.');
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
Testimonies & Praise Reports: ${testimoniesCount} recorded

"Again I say to you, if two of you agree on earth about anything they ask, it will be done for them by my Father in heaven." - Matthew 18:19

Keep pressing in, partners! 🕊️`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(digestText).then(() => {
        this.copiedDigest.set(true);
        this.showToast('Weekly partner digest copied to clipboard!');
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
            `Grace and peace to the ${p.name} altar! Together you have faithfully preserved the flame, logging ${weekHours} this week towards your ${targetHours}-hour target. Where partners agree in prayer, heaven moves. Continue steadfast in faith!`
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
