import { Injectable, computed, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  AppUser,
  CategoryMetric,
  DailyChartBar,
  DailyPrayerBundle,
  Partnership,
  PRAYER_CATEGORIES,
  PrayerRequest,
  PrayerSession,
  Testimony,
  WeeklyTrendBar,
} from '../models/prayer.model';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  // Auth state
  readonly currentUser = signal<User | null>(null);
  readonly isAuthReady = signal<boolean>(false);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  // Firestore collections & subscriptions
  readonly partnerships = signal<Partnership[]>([]);
  readonly activePartnershipId = signal<string | null>(null);

  readonly sessions = signal<PrayerSession[]>([]);
  readonly testimonies = signal<Testimony[]>([]);
  readonly requests = signal<PrayerRequest[]>([]);

  // Filter state (e.g. view all in circle or specific partner)
  readonly activeFilterMember = signal<string>('all');

  private unsubPartnerships: (() => void) | null = null;
  private unsubSessions: (() => void) | null = null;
  private unsubTestimonies: (() => void) | null = null;
  private unsubRequests: (() => void) | null = null;

  constructor() {
    this.testConnection();
    this.initAuthListener();
  }

  private async testConnection() {
    if (typeof window === 'undefined') return;
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  private initAuthListener() {
    if (typeof window === 'undefined') return;
    onAuthStateChanged(auth, async (user) => {
      this.currentUser.set(user);
      this.isAuthReady.set(true);

      if (user) {
        await this.syncUserProfile(user);
        this.subscribeToUserPartnerships(user);
      } else {
        this.clearSubscriptions();
      }
    });
  }

  async loginWithGoogle(): Promise<User | null> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error('Google Sign In Error:', err);
      throw err;
    }
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.clearSubscriptions();
  }

  private async syncUserProfile(user: User) {
    const userPath = `users/${user.uid}`;
    try {
      const profileData: AppUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Intercessor',
        photoURL: user.photoURL || undefined,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }

  private subscribeToUserPartnerships(user: User) {
    this.clearSubscriptions();
    const userEmail = (user.email || '').toLowerCase();
    const partnershipsPath = 'partnerships';

    // Query partnerships where current user is a member
    const q1 = query(
      collection(db, partnershipsPath),
      where('memberEmails', 'array-contains', userEmail)
    );

    this.unsubPartnerships = onSnapshot(
      q1,
      (snapshot) => {
        const list: Partnership[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Partnership);
        });

        // Also ensure memberUids includes user.uid if not yet updated
        list.forEach((p) => {
          if (!p.memberUids.includes(user.uid)) {
            updateDoc(doc(db, 'partnerships', p.id), {
              memberUids: [...p.memberUids, user.uid],
            }).catch(() => {
              // ignore sync error
            });
          }
        });

        this.partnerships.set(list);

        // Auto-select active partnership
        if (list.length > 0) {
          const current = this.activePartnershipId();
          if (!current || !list.some((p) => p.id === current)) {
            this.selectPartnership(list[0].id);
          }
        } else {
          this.activePartnershipId.set(null);
          this.sessions.set([]);
          this.testimonies.set([]);
          this.requests.set([]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, partnershipsPath);
      }
    );
  }

  selectPartnership(partnershipId: string) {
    this.activePartnershipId.set(partnershipId);
    this.activeFilterMember.set('all');
    this.subscribeToPartnershipData(partnershipId);
  }

  private subscribeToPartnershipData(partnershipId: string) {
    // Unsubscribe previous subcollections
    if (this.unsubSessions) this.unsubSessions();
    if (this.unsubTestimonies) this.unsubTestimonies();
    if (this.unsubRequests) this.unsubRequests();

    // 1. Sessions
    const sessionsPath = `partnerships/${partnershipId}/sessions`;
    this.unsubSessions = onSnapshot(
      collection(db, sessionsPath),
      (snapshot) => {
        const list: PrayerSession[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as PrayerSession);
        });
        // Sort descending by date
        list.sort((a, b) => b.date.localeCompare(a.date));
        this.sessions.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, sessionsPath);
      }
    );

    // 2. Testimonies
    const testimoniesPath = `partnerships/${partnershipId}/testimonies`;
    this.unsubTestimonies = onSnapshot(
      collection(db, testimoniesPath),
      (snapshot) => {
        const list: Testimony[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Testimony);
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        this.testimonies.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, testimoniesPath);
      }
    );

    // 3. Requests
    const requestsPath = `partnerships/${partnershipId}/requests`;
    this.unsubRequests = onSnapshot(
      collection(db, requestsPath),
      (snapshot) => {
        const list: PrayerRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as PrayerRequest);
        });
        list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
        this.requests.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, requestsPath);
      }
    );
  }

  private clearSubscriptions() {
    if (this.unsubPartnerships) this.unsubPartnerships();
    if (this.unsubSessions) this.unsubSessions();
    if (this.unsubTestimonies) this.unsubTestimonies();
    if (this.unsubRequests) this.unsubRequests();
    this.unsubPartnerships = null;
    this.unsubSessions = null;
    this.unsubTestimonies = null;
    this.unsubRequests = null;
    this.partnerships.set([]);
    this.activePartnershipId.set(null);
    this.sessions.set([]);
    this.testimonies.set([]);
    this.requests.set([]);
  }

  // --- Partnership Operations ---

  async createPartnership(
    name: string,
    partnerEmailsInput: string[],
    targets: {
      dailyMinutes: number;
      weeklyMinutes: number;
      periodTitle: string;
      periodTargetMinutes: number;
      periodStartDate: string;
      periodEndDate: string;
    }
  ): Promise<string> {
    const user = this.currentUser();
    if (!user) throw new Error('User must be logged in to create a prayer partnership');

    const currentUserEmail = (user.email || '').toLowerCase().trim();
    const currentUserName = user.displayName || currentUserEmail.split('@')[0] || 'Me';

    // Normalize emails and ensure creator is included
    const cleanEmails = Array.from(
      new Set(
        [currentUserEmail, ...partnerEmailsInput.map((e) => e.toLowerCase().trim())].filter(
          (e) => e.length > 0 && e.includes('@')
        )
      )
    );

    const pId = 'partnership-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const pPath = `partnerships/${pId}`;

    const newPartnership: Partnership = {
      id: pId,
      name: name.trim() || 'Prayer Accountability Circle',
      createdBy: user.uid,
      memberUids: [user.uid],
      memberEmails: cleanEmails,
      memberNames: [currentUserName],
      dailyTargetMinutes: targets.dailyMinutes,
      weeklyTargetMinutes: targets.weeklyMinutes,
      periodTitle: targets.periodTitle,
      periodTargetMinutes: targets.periodTargetMinutes,
      periodStartDate: targets.periodStartDate,
      periodEndDate: targets.periodEndDate,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'partnerships', pId), newPartnership);
      this.selectPartnership(pId);
      return pId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pPath);
    }
  }

  async addPartnerByEmail(partnershipId: string, email: string): Promise<void> {
    const p = this.partnerships().find((x) => x.id === partnershipId);
    if (!p) return;

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please provide a valid email address');
    }

    if (p.memberEmails.includes(normalizedEmail)) {
      return; // already a member
    }

    const updatedEmails = [...p.memberEmails, normalizedEmail];
    const pPath = `partnerships/${partnershipId}`;
    try {
      await updateDoc(doc(db, 'partnerships', partnershipId), {
        memberEmails: updatedEmails,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, pPath);
    }
  }

  async updatePartnershipTargets(
    partnershipId: string,
    targets: {
      dailyMinutes: number;
      weeklyMinutes: number;
      periodTitle: string;
      periodTargetMinutes: number;
      periodStartDate: string;
      periodEndDate: string;
    }
  ): Promise<void> {
    const pPath = `partnerships/${partnershipId}`;
    try {
      await updateDoc(doc(db, 'partnerships', partnershipId), {
        dailyTargetMinutes: targets.dailyMinutes,
        weeklyTargetMinutes: targets.weeklyMinutes,
        periodTitle: targets.periodTitle,
        periodTargetMinutes: targets.periodTargetMinutes,
        periodStartDate: targets.periodStartDate,
        periodEndDate: targets.periodEndDate,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, pPath);
    }
  }

  // --- Session Operations ---

  async addSession(
    sessionData: Omit<PrayerSession, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt'>
  ): Promise<string> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active prayer partnership and user required');

    const sId = 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const sPath = `partnerships/${pId}/sessions/${sId}`;

    const categories = sessionData.categories && sessionData.categories.length > 0
      ? sessionData.categories
      : [sessionData.category];

    const newSession: PrayerSession = {
      ...sessionData,
      id: sId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      category: categories[0] || 'Thanksgiving & Praise',
      categories,
      topics: sessionData.topics || [],
      participantNames: sessionData.participantNames || [],
      linkedTestimonyId: sessionData.linkedTestimonyId || undefined,
      linkedTestimonyTitle: sessionData.linkedTestimonyTitle || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'partnerships', pId, 'sessions', sId), newSession);
      return sId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, sPath);
      throw err;
    }
  }

  async updateSession(session: PrayerSession): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const sPath = `partnerships/${pId}/sessions/${session.id}`;

    const categories = session.categories && session.categories.length > 0
      ? session.categories
      : [session.category];

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'sessions', session.id), {
        date: session.date,
        startTime: session.startTime || '',
        durationMinutes: session.durationMinutes,
        category: categories[0] || 'Thanksgiving & Praise',
        categories,
        topics: session.topics || [],
        notes: session.notes || '',
        scripture: session.scripture || '',
        participantNames: session.participantNames || [],
        wasTogether: !!session.wasTogether,
        linkedTestimonyId: session.linkedTestimonyId || null,
        linkedTestimonyTitle: session.linkedTestimonyTitle || null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, sPath);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const sPath = `partnerships/${pId}/sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'sessions', sessionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, sPath);
    }
  }

  // --- Testimony Operations ---

  async addTestimony(
    testimonyData: Omit<Testimony, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt' | 'amensCount' | 'amenUids'>
  ): Promise<string> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active prayer partnership and user required');

    const tId = 'testimony-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const tPath = `partnerships/${pId}/testimonies/${tId}`;

    const categories = testimonyData.categories && testimonyData.categories.length > 0
      ? testimonyData.categories
      : [testimonyData.category];

    const newTestimony: Testimony = {
      ...testimonyData,
      id: tId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      category: categories[0] || 'Thanksgiving & Praise',
      categories,
      amensCount: 1,
      amenUids: [user.uid],
      linkedSessionId: testimonyData.linkedSessionId || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'partnerships', pId, 'testimonies', tId), newTestimony);

      // If linked to an existing prayer session, update the session with this testimony's ID and title
      if (testimonyData.linkedSessionId) {
        await this.linkTestimonyToSession(testimonyData.linkedSessionId, tId, testimonyData.title);
      }

      return tId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, tPath);
      throw err;
    }
  }

  async updateTestimony(testimony: Testimony): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const tPath = `partnerships/${pId}/testimonies/${testimony.id}`;

    const categories = testimony.categories && testimony.categories.length > 0
      ? testimony.categories
      : [testimony.category];

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'testimonies', testimony.id), {
        title: testimony.title,
        date: testimony.date,
        category: categories[0] || 'Thanksgiving & Praise',
        categories,
        prayerBurden: testimony.prayerBurden,
        answeredDetail: testimony.answeredDetail,
        scripturePraise: testimony.scripturePraise || '',
        linkedSessionId: testimony.linkedSessionId || null,
      });

      // If linked to session, also update the session's cached title
      if (testimony.linkedSessionId) {
        await updateDoc(doc(db, 'partnerships', pId, 'sessions', testimony.linkedSessionId), {
          linkedTestimonyId: testimony.id,
          linkedTestimonyTitle: testimony.title,
        }).catch(() => {
          // ignore non-critical session sync
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, tPath);
    }
  }

  async linkTestimonyToSession(
    sessionId: string,
    testimonyId: string,
    testimonyTitle: string
  ): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;

    try {
      // 1. Update session with testimony info
      await updateDoc(doc(db, 'partnerships', pId, 'sessions', sessionId), {
        linkedTestimonyId: testimonyId,
        linkedTestimonyTitle: testimonyTitle,
      });
      // 2. Update testimony with session link
      await updateDoc(doc(db, 'partnerships', pId, 'testimonies', testimonyId), {
        linkedSessionId: sessionId,
      });
    } catch (err) {
      console.warn('Could not link session and testimony:', err);
    }
  }

  async incrementAmen(testimonyId: string): Promise<void> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) return;

    const t = this.testimonies().find((x) => x.id === testimonyId);
    if (!t) return;

    const uids = t.amenUids || [];
    if (uids.includes(user.uid)) return; // already praised

    const tPath = `partnerships/${pId}/testimonies/${testimonyId}`;
    try {
      await updateDoc(doc(db, 'partnerships', pId, 'testimonies', testimonyId), {
        amensCount: (t.amensCount || 0) + 1,
        amenUids: [...uids, user.uid],
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, tPath);
    }
  }

  async deleteTestimony(testimonyId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const tPath = `partnerships/${pId}/testimonies/${testimonyId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'testimonies', testimonyId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, tPath);
    }
  }

  // --- Request Operations ---

  async addRequest(
    requestData: Omit<PrayerRequest, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt'>
  ): Promise<void> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active prayer partnership and user required');

    const rId = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const rPath = `partnerships/${pId}/requests/${rId}`;

    const newRequest: PrayerRequest = {
      ...requestData,
      id: rId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'partnerships', pId, 'requests', rId), newRequest);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, rPath);
    }
  }

  async updateRequest(request: PrayerRequest): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const rPath = `partnerships/${pId}/requests/${request.id}`;
    try {
      await updateDoc(doc(db, 'partnerships', pId, 'requests', request.id), {
        title: request.title,
        status: request.status,
        category: request.category,
        assignedPartner: request.assignedPartner,
        notes: request.notes,
        answeredTestimonyId: request.answeredTestimonyId || null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, rPath);
    }
  }

  setActiveFilterMember(member: string) {
    this.activeFilterMember.set(member);
  }

  async toggleRequestAnswered(requestId: string, currentStatus: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const rPath = `partnerships/${pId}/requests/${requestId}`;
    const nextStatus = currentStatus === 'answered' ? 'active' : 'answered';
    try {
      await updateDoc(doc(db, 'partnerships', pId, 'requests', requestId), {
        status: nextStatus,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, rPath);
    }
  }

  async deleteRequest(requestId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const rPath = `partnerships/${pId}/requests/${requestId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, rPath);
    }
  }

  // --- Computed Analytics for Active Partnership ---

  readonly activePartnership = computed<Partnership | null>(() => {
    const id = this.activePartnershipId();
    if (!id) return null;
    return this.partnerships().find((p) => p.id === id) || null;
  });

  // Filtered sessions based on activeFilterMember
  readonly filteredSessions = computed<PrayerSession[]>(() => {
    const filter = this.activeFilterMember();
    const list = this.sessions();
    if (filter === 'all') return list;
    return list.filter((s) => s.authorUid === filter || s.authorName === filter || s.participantNames?.includes(filter));
  });

  readonly totalMinutes = computed(() => {
    return this.filteredSessions().reduce((acc, s) => acc + s.durationMinutes, 0);
  });

  readonly todayMinutes = computed(() => {
    const today = this.getTodayDateString();
    return this.filteredSessions()
      .filter((s) => s.date === today)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  });

  readonly thisWeekMinutes = computed(() => {
    const weekDates = this.getCurrentWeekDates();
    const dateSet = new Set(weekDates);
    return this.filteredSessions()
      .filter((s) => dateSet.has(s.date))
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  });

  readonly periodMinutesLogged = computed(() => {
    const p = this.activePartnership();
    if (!p) return 0;
    return this.filteredSessions()
      .filter((s) => s.date >= p.periodStartDate && s.date <= p.periodEndDate)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  });

  readonly periodProgressPct = computed(() => {
    const p = this.activePartnership();
    if (!p || p.periodTargetMinutes <= 0) return 0;
    const logged = this.periodMinutesLogged();
    return Math.min(100, Math.round((logged / p.periodTargetMinutes) * 1000) / 10);
  });

  readonly periodMinutesRemaining = computed(() => {
    const p = this.activePartnership();
    if (!p) return 0;
    return Math.max(0, p.periodTargetMinutes - this.periodMinutesLogged());
  });

  readonly streakDays = computed(() => {
    const sessions = this.filteredSessions();
    if (sessions.length === 0) return 0;

    const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort().reverse();
    const today = this.getTodayDateString();
    const yesterday = this.getYesterdayDateString();

    if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
      return 0;
    }

    let streak = 0;
    const checkDate = new Date();
    if (!uniqueDates.includes(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = this.formatDate(checkDate);
      if (uniqueDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  });

  readonly past7DaysData = computed<DailyChartBar[]>(() => {
    const p = this.activePartnership();
    const target = p ? p.dailyTargetMinutes : 60;
    const all = this.filteredSessions();
    const bars: DailyChartBar[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

      const daySessions = all.filter((s) => s.date === dateStr);
      const total = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

      const partnerMap = new Map<string, number>();
      for (const s of daySessions) {
        partnerMap.set(s.authorName, (partnerMap.get(s.authorName) || 0) + s.durationMinutes);
      }

      const breakdown = Array.from(partnerMap.entries()).map(([name, minutes]) => ({
        name,
        minutes,
      }));

      bars.push({
        dayLabel,
        dateStr,
        totalMinutes: total,
        targetMinutes: target,
        metTarget: total >= target,
        partnerBreakdown: breakdown,
      });
    }

    return bars;
  });

  readonly past8WeeksData = computed<WeeklyTrendBar[]>(() => {
    const p = this.activePartnership();
    const target = p ? p.weeklyTargetMinutes : 420;
    const all = this.filteredSessions();
    const weeks: WeeklyTrendBar[] = [];

    for (let w = 7; w >= 0; w--) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const distanceToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday - w * 7);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startStr = this.formatDate(monday);
      const endStr = this.formatDate(sunday);

      const weekSessions = all.filter((s) => s.date >= startStr && s.date <= endStr);
      const total = weekSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

      const label =
        w === 0
          ? 'This Week'
          : w === 1
          ? 'Last Wk'
          : `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      weeks.push({
        weekLabel: label,
        totalMinutes: total,
        targetMinutes: target,
      });
    }

    return weeks;
  });

  readonly categoryBreakdown = computed<CategoryMetric[]>(() => {
    const sessions = this.filteredSessions();
    const total = this.totalMinutes();
    if (total === 0) return [];

    const map = new Map<string, { mins: number; count: number }>();
    for (const c of PRAYER_CATEGORIES) {
      map.set(c.name, { mins: 0, count: 0 });
    }

    for (const s of sessions) {
      const cats = s.categories && s.categories.length > 0 ? s.categories : [s.category];
      for (const catName of cats) {
        const entry = map.get(catName) || { mins: 0, count: 0 };
        entry.mins += Math.round(s.durationMinutes / cats.length);
        entry.count += 1;
        map.set(catName, entry);
      }
    }

    const result: CategoryMetric[] = [];
    for (const [catName, data] of map.entries()) {
      if (data.mins > 0) {
        const catObj = PRAYER_CATEGORIES.find((c) => c.name === catName);
        result.push({
          category: catName,
          totalMinutes: data.mins,
          sessionCount: data.count,
          percentage: Math.round((data.mins / total) * 100),
          color: catObj ? catObj.color : '#f59e0b',
        });
      }
    }

    return result.sort((a, b) => b.totalMinutes - a.totalMinutes);
  });

  // Daily Prayer Bundles: aggregates all sessions and testimonies grouped by day
  readonly dailyPrayerBundles = computed<DailyPrayerBundle[]>(() => {
    const sessions = this.filteredSessions();
    const testimonies = this.testimonies();
    const p = this.activePartnership();
    const dailyTarget = p ? p.dailyTargetMinutes : 60;

    // Group sessions by date
    const dateMap = new Map<string, PrayerSession[]>();
    for (const s of sessions) {
      const existing = dateMap.get(s.date) || [];
      existing.push(s);
      dateMap.set(s.date, existing);
    }

    // Also include dates that only have testimonies
    for (const t of testimonies) {
      if (!dateMap.has(t.date)) {
        dateMap.set(t.date, []);
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
    const bundles: DailyPrayerBundle[] = [];

    for (const dateStr of sortedDates) {
      const daySessions = (dateMap.get(dateStr) || []).sort((a, b) => {
        const timeA = a.startTime || a.createdAt;
        const timeB = b.startTime || b.createdAt;
        return timeA.localeCompare(timeB);
      });

      const totalMinutes = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);

      // Find testimonies on this date or linked to any session of this date
      const sessionIds = new Set(daySessions.map((s) => s.id));
      const dayTestimonies = testimonies.filter(
        (t) => t.date === dateStr || (t.linkedSessionId && sessionIds.has(t.linkedSessionId))
      );

      const topicsSet = new Set<string>();
      const catsSet = new Set<string>();

      daySessions.forEach((s) => {
        (s.topics || []).forEach((top) => topicsSet.add(top));
        if (s.categories && s.categories.length > 0) {
          s.categories.forEach((c) => catsSet.add(c));
        } else if (s.category) {
          catsSet.add(s.category);
        }
      });

      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, (month || 1) - 1, day || 1);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDisplayDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      bundles.push({
        date: dateStr,
        dayName,
        formattedDisplayDate,
        totalMinutes,
        sessions: daySessions,
        metDailyTarget: totalMinutes >= dailyTarget,
        dailyTargetMinutes: dailyTarget,
        testimoniesCount: dayTestimonies.length,
        testimonies: dayTestimonies,
        allTopics: Array.from(topicsSet),
        allCategories: Array.from(catsSet),
      });
    }

    return bundles;
  });

  readonly jointSessionsCount = computed(() => {
    return this.sessions().filter((s) => s.wasTogether).length;
  });

  readonly pacingAnalysis = computed(() => {
    const p = this.activePartnership();
    if (!p) {
      return {
        daysRemaining: 1,
        requiredDailyMins: 0,
        loggedHours: 0,
        targetHours: 100,
        avgDailyVelocityMinutes: 0,
        isAhead: true,
      };
    }

    const now = new Date();
    const endDate = new Date(p.periodEndDate);
    const msDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    const remainingMins = this.periodMinutesRemaining();
    const requiredDailyMins = Math.ceil(remainingMins / daysRemaining);

    const loggedHours = Math.round((this.periodMinutesLogged() / 60) * 10) / 10;
    const targetHours = Math.round((p.periodTargetMinutes / 60) * 10) / 10;

    const isAhead = requiredDailyMins <= p.dailyTargetMinutes;

    return {
      daysRemaining,
      requiredDailyMins,
      loggedHours,
      targetHours,
      avgDailyVelocityMinutes: Math.round(this.thisWeekMinutes() / 7),
      isAhead,
    };
  });

  // Time formatting utilities
  formatMinutes(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  getYesterdayDateString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.formatDate(d);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getCurrentWeekDates(): string[] {
    const dates: string[] = [];
    const now = new Date();
    const day = now.getDay();
    const distanceToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(this.formatDate(d));
    }
    return dates;
  }
}
