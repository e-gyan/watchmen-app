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

  // Search & Filters for Journal
  readonly journalSearch = signal('');
  readonly journalCategory = signal<string>('all');
  readonly journalMember = signal<string>('all');

  // Search & Filters for Testimonies
  readonly testimonySearch = signal('');
  readonly testimonyCategory = signal<string>('all');

  // WhatsApp Digest generator state
  readonly copiedDigest = signal(false);
  readonly isGeneratingDigest = signal(false);
  readonly generatedEncouragement = signal<string | null>(null);

  // Delete confirmation
  readonly deleteConfirmation = signal<{ type: 'session' | 'testimony' | 'request'; id: string } | null>(null);

  readonly categories = PRAYER_CATEGORIES;
  readonly Math = Math;

  // Current user display name or email prefix
  readonly currentUserName = computed(() => {
    const user = this.firebaseService.currentUser();
    if (!user) return '';
    return user.displayName || user.email?.split('@')[0] || 'Intercessor';
  });

  // Filtered session journal list (Timeline stream)
  readonly displayedJournalSessions = computed(() => {
    let list = this.firebaseService.sessions();
    const query = this.journalSearch().trim().toLowerCase();
    const cat = this.journalCategory();
    const member = this.journalMember();

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

    return list;
  });

  // Filtered Daily Prayer Bundles
  readonly displayedDailyBundles = computed<DailyPrayerBundle[]>(() => {
    const bundles = this.firebaseService.dailyPrayerBundles();
    const query = this.journalSearch().trim().toLowerCase();
    const cat = this.journalCategory();
    const member = this.journalMember();

    return bundles
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

        const filteredTotalMins = matchingSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

        return {
          ...bundle,
          sessions: matchingSessions,
          totalMinutes: filteredTotalMins,
          metDailyTarget: filteredTotalMins >= bundle.dailyTargetMinutes,
        };
      })
      .filter((bundle) => {
        // Keep bundle if it has matching sessions or query matches date/day name
        if (bundle.sessions.length > 0) return true;
        if (query && (bundle.formattedDisplayDate.toLowerCase().includes(query) || bundle.dayName.toLowerCase().includes(query))) {
          return true;
        }
        return false;
      });
  });

  // Filtered testimonies list
  readonly displayedTestimonies = computed(() => {
    let list = this.firebaseService.testimonies();
    const query = this.testimonySearch().trim().toLowerCase();
    const cat = this.testimonyCategory();

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

    return list;
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

  confirmDelete(type: 'session' | 'testimony' | 'request', id: string) {
    this.deleteConfirmation.set({ type, id });
  }

  async executeDelete() {
    const item = this.deleteConfirmation();
    if (!item) return;

    try {
      if (item.type === 'session') {
        await this.firebaseService.deleteSession(item.id);
        this.showToast('Prayer encounter record removed');
      } else if (item.type === 'testimony') {
        await this.firebaseService.deleteTestimony(item.id);
        this.showToast('Testimony record removed');
      } else if (item.type === 'request') {
        await this.firebaseService.deleteRequest(item.id);
        this.showToast('Prayer request removed');
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
