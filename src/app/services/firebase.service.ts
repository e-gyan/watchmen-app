import { Injectable, computed, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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
  AuthorityFigureSeed,
  CategoryMetric,
  DailyChartBar,
  DailyPrayerBundle,
  MessageListeningRecord,
  Partnership,
  PRAYER_CATEGORIES,
  PrayerRequest,
  PrayerSession,
  SeedGivingRecord,
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

export interface AuthDiagnosticError {
  code: string;
  message: string;
  domain: string;
  projectId: string;
}

const FALLBACK_USER_KEY = 'watchman_partner_auth_user_v1';
const LOCAL_STORE_KEY = 'watchman_local_cloud_backup_v1';

interface LocalCloudBackup {
  partnerships: Partnership[];
  sessions: Record<string, PrayerSession[]>;
  testimonies: Record<string, Testimony[]>;
  requests: Record<string, PrayerRequest[]>;
  messages: Record<string, MessageListeningRecord[]>;
  authorities: Record<string, AuthorityFigureSeed[]>;
  seeds: Record<string, SeedGivingRecord[]>;
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

/**
 * Recursively strips undefined keys from any object or array so Firestore setDoc/updateDoc
 * will never fail with "Unsupported field value: undefined".
 */
export function removeUndefinedFields<T>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(val)) {
      if (value !== undefined) {
        result[key] = removeUndefinedFields(value);
      }
    }
    return result as T;
  }
  return val;
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  // Auth state
  readonly currentUser = signal<User | null>(null);
  readonly isAuthReady = signal<boolean>(false);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isFallbackMode = signal<boolean>(false);
  readonly lastAuthError = signal<AuthDiagnosticError | null>(null);
  readonly firebaseProjectId = firebaseConfig.projectId;

  // Firestore collections & subscriptions
  readonly partnerships = signal<Partnership[]>([]);
  readonly activePartnershipId = signal<string | null>(null);

  readonly sessions = signal<PrayerSession[]>([]);
  readonly testimonies = signal<Testimony[]>([]);
  readonly requests = signal<PrayerRequest[]>([]);
  readonly messages = signal<MessageListeningRecord[]>([]);
  readonly authorities = signal<AuthorityFigureSeed[]>([]);
  readonly seeds = signal<SeedGivingRecord[]>([]);

  // Filter state (e.g. view all in circle or specific partner)
  readonly activeFilterMember = signal<string>('all');

  // Live FX conversion to GHS (Dashboard & Seed main currency)
  readonly fxToGhs = signal<Record<string, number>>({
    GHS: 1,
    USD: 15.8,
    GBP: 20.1,
    EUR: 17.1,
    NGN: 0.01,
  });
  readonly fxSource = signal<'live' | 'fallback'>('fallback');
  readonly fxUpdatedAt = signal<string>('');

  private unsubPartnerships: (() => void) | null = null;
  private unsubSessions: (() => void) | null = null;
  private unsubTestimonies: (() => void) | null = null;
  private unsubRequests: (() => void) | null = null;
  private unsubMessages: (() => void) | null = null;
  private unsubAuthorities: (() => void) | null = null;
  private unsubSeeds: (() => void) | null = null;
  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.testConnection();
    this.initAuthListener();
    this.refreshLiveExchangeRates();
  }

  async refreshLiveExchangeRates(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/fx-rates');
      if (res.ok) {
        const data = (await res.json()) as {
          toGhs?: Record<string, number>;
          source?: 'live' | 'fallback';
          updatedAt?: string;
        };
        if (data.toGhs) {
          this.fxToGhs.set({ ...this.fxToGhs(), ...data.toGhs, GHS: 1 });
          this.fxSource.set(data.source || 'live');
          this.fxUpdatedAt.set(data.updatedAt || new Date().toISOString());
          return;
        }
      }
    } catch {
      // Try direct public API if /api/fx-rates is unavailable
    }

    try {
      const directRes = await fetch('https://open.er-api.com/v6/latest/GHS');
      if (directRes.ok) {
        const data = (await directRes.json()) as {
          rates?: Record<string, number>;
          time_last_update_utc?: string;
        };
        if (data.rates) {
          const map: Record<string, number> = { ...this.fxToGhs(), GHS: 1 };
          for (const [code, rate] of Object.entries(data.rates)) {
            if (typeof rate === 'number' && rate > 0) {
              map[code] = Number((1 / rate).toFixed(4));
            }
          }
          this.fxToGhs.set(map);
          this.fxSource.set('live');
          this.fxUpdatedAt.set(data.time_last_update_utc || new Date().toISOString());
        }
      }
    } catch {
      // Keep default fallback rates
    }
  }

  getRateToGhs(currency: string): number {
    const code = (currency || 'GHS').toUpperCase().trim();
    if (code === 'GHS') return 1;
    const rates = this.fxToGhs();
    return rates[code] || 1;
  }

  convertToGhs(amount: number, currency: string): number {
    const num = Number(amount) || 0;
    const rate = this.getRateToGhs(currency);
    return num * rate;
  }

  getCurrentDomain(): string {
    if (typeof window === 'undefined') return '';
    return window.location.hostname || '';
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

    // Complete any pending OAuth redirect flow
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          this.lastAuthError.set(null);
          this.isFallbackMode.set(false);
          localStorage.removeItem(FALLBACK_USER_KEY);
        }
      })
      .catch((err) => {
        this.recordAuthError(err);
      });

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.isFallbackMode.set(false);
        this.stopFallbackPolling();
        localStorage.removeItem(FALLBACK_USER_KEY);
        this.currentUser.set(user);
        this.isAuthReady.set(true);
        await this.syncUserProfile(user);
        this.subscribeToUserPartnerships(user);
      } else {
        // Check if the user signed in via Partner Email fallback (e.g. on Render prior to domain authorization)
        const savedFallback = this.loadFallbackUser();
        if (savedFallback) {
          this.isFallbackMode.set(true);
          this.currentUser.set(savedFallback);
          this.isAuthReady.set(true);
          await this.loadFromFallbackCloud(savedFallback);
          this.startFallbackPolling(savedFallback);
        } else {
          this.isFallbackMode.set(false);
          this.currentUser.set(null);
          this.isAuthReady.set(true);
          this.clearSubscriptions();
        }
      }
    });
  }

  private recordAuthError(err: unknown): AuthDiagnosticError {
    const code = (err as { code?: string })?.code || 'auth/unknown';
    const rawMsg = err instanceof Error ? err.message : String(err);
    const domain = this.getCurrentDomain();
    let friendly = rawMsg;

    if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
      friendly = `Domain "${domain}" is not yet added to Firebase Authorized Domains for Google Popup Sign-In.`;
    } else if (code === 'auth/popup-blocked' || rawMsg.includes('popup-blocked')) {
      friendly = 'Your browser blocked the Google Sign-In popup window.';
    } else if (code === 'auth/popup-closed-by-user') {
      friendly = 'The Google Sign-In window was closed before completing login.';
    }

    const diag: AuthDiagnosticError = {
      code,
      message: friendly,
      domain,
      projectId: firebaseConfig.projectId,
    };
    this.lastAuthError.set(diag);
    return diag;
  }

  async loginWithGoogle(): Promise<User | null> {
    this.lastAuthError.set(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      this.isFallbackMode.set(false);
      localStorage.removeItem(FALLBACK_USER_KEY);
      return result.user;
    } catch (err) {
      const diag = this.recordAuthError(err);
      // If popup was blocked by browser, try redirect automatically
      if (diag.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        return null;
      }
      console.error('Google Sign In Error:', err);
      throw err;
    }
  }

  async loginWithGoogleRedirect(): Promise<void> {
    this.lastAuthError.set(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (err) {
      this.recordAuthError(err);
      throw err;
    }
  }

  /**
   * Direct Partner Email & Name Sign-In:
   * Allows users on Render (or any custom host) to sign in immediately using their
   * Google email address and name even before the domain is added to Firebase Console's
   * Authorized Domains list.
   */
  async loginWithPartnerEmail(emailInput: string, displayNameInput: string): Promise<User> {
    const cleanEmail = emailInput.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    const cleanName = displayNameInput.trim() || cleanEmail.split('@')[0] || 'Intercessor';
    const deterministicUid = 'partner-' + cleanEmail.replace(/[^a-z0-9]/g, '_');

    const fallbackUser = {
      uid: deterministicUid,
      email: cleanEmail,
      displayName: cleanName,
      emailVerified: true,
      isAnonymous: false,
      photoURL: null,
      providerData: [{ providerId: 'partner-email', email: cleanEmail, displayName: cleanName }],
    } as unknown as User;

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        FALLBACK_USER_KEY,
        JSON.stringify({ uid: deterministicUid, email: cleanEmail, displayName: cleanName })
      );
    }

    this.lastAuthError.set(null);
    this.isFallbackMode.set(true);
    this.currentUser.set(fallbackUser);
    this.isAuthReady.set(true);
    await this.loadFromFallbackCloud(fallbackUser);
    this.startFallbackPolling(fallbackUser);
    return fallbackUser;
  }

  private loadFallbackUser(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(FALLBACK_USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { uid: string; email: string; displayName: string };
      if (!parsed.email) return null;
      return {
        uid: parsed.uid,
        email: parsed.email,
        displayName: parsed.displayName,
        emailVerified: true,
        isAnonymous: false,
        photoURL: null,
        providerData: [{ providerId: 'partner-email', email: parsed.email, displayName: parsed.displayName }],
      } as unknown as User;
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    this.stopFallbackPolling();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FALLBACK_USER_KEY);
    }
    this.isFallbackMode.set(false);
    this.currentUser.set(null);
    this.clearSubscriptions();
    try {
      await signOut(auth);
    } catch {
      // ignore if already signed out of firebase
    }
  }

  // --- Fallback Server + Local Cloud Store Helpers ---

  private getLocalBackup(): LocalCloudBackup {
    if (typeof window === 'undefined') {
      return { partnerships: [], sessions: {}, testimonies: {}, requests: {}, messages: {}, authorities: {}, seeds: {} };
    }
    try {
      const raw = localStorage.getItem(LOCAL_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LocalCloudBackup>;
        return {
          partnerships: parsed.partnerships || [],
          sessions: parsed.sessions || {},
          testimonies: parsed.testimonies || {},
          requests: parsed.requests || {},
          messages: parsed.messages || {},
          authorities: parsed.authorities || {},
          seeds: parsed.seeds || {},
        };
      }
    } catch {
      // ignore
    }
    return { partnerships: [], sessions: {}, testimonies: {}, requests: {}, messages: {}, authorities: {}, seeds: {} };
  }

  private saveLocalBackup(data: LocalCloudBackup) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  private startFallbackPolling(user: User) {
    this.stopFallbackPolling();
    this.fallbackPollTimer = setInterval(() => {
      this.loadFromFallbackCloud(user);
    }, 8000);
  }

  private stopFallbackPolling() {
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
  }

  private async loadFromFallbackCloud(user: User) {
    if (typeof window === 'undefined') return;
    const email = (user.email || '').toLowerCase().trim();
    const activeId = this.activePartnershipId();
    const backup = this.getLocalBackup();

    try {
      const queryParams = new URLSearchParams({ email });
      if (activeId) queryParams.set('partnershipId', activeId);
      const resp = await fetch(`/api/cloud-sync?${queryParams.toString()}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          partnerships?: Partnership[];
          sessions?: PrayerSession[];
          testimonies?: Testimony[];
          requests?: PrayerRequest[];
          messages?: MessageListeningRecord[];
          authorities?: AuthorityFigureSeed[];
          seeds?: SeedGivingRecord[];
        };

        // Merge server partnerships with local backup partnerships (strictly restricted to user's memberEmails)
        const mergedPartnershipsMap = new Map<string, Partnership>();
        backup.partnerships
          .filter((p) => p.memberEmails.map((e) => e.toLowerCase()).includes(email))
          .forEach((p) => mergedPartnershipsMap.set(p.id, p));
        (data.partnerships || [])
          .filter((p) => p.memberEmails.map((e) => e.toLowerCase()).includes(email))
          .forEach((p) => mergedPartnershipsMap.set(p.id, p));

        const list = Array.from(mergedPartnershipsMap.values());
        this.partnerships.set(list);

        let targetPid = activeId;
        if (list.length > 0 && (!targetPid || !list.some((p) => p.id === targetPid))) {
          targetPid = list[0].id;
          this.activePartnershipId.set(targetPid);
        }

        if (targetPid) {
          // Fetch subcollections if targetPid changed
          let subData = data;
          if (targetPid !== activeId) {
            const subResp = await fetch(
              `/api/cloud-sync?email=${encodeURIComponent(email)}&partnershipId=${encodeURIComponent(targetPid)}`
            );
            if (subResp.ok) {
              subData = await subResp.json();
            }
          }

          const mergeById = <T extends { id: string }>(localArr: T[], serverArr: T[]): T[] => {
            const m = new Map<string, T>();
            (localArr || []).forEach((item) => m.set(item.id, item));
            (serverArr || []).forEach((item) => m.set(item.id, item));
            return Array.from(m.values());
          };

          const mergedSessions = mergeById(backup.sessions[targetPid] || [], subData.sessions || []);
          mergedSessions.sort((a, b) => b.date.localeCompare(a.date));
          this.sessions.set(mergedSessions);

          const mergedTestimonies = mergeById(backup.testimonies[targetPid] || [], subData.testimonies || []);
          mergedTestimonies.sort((a, b) => b.date.localeCompare(a.date));
          this.testimonies.set(mergedTestimonies);

          const mergedRequests = mergeById(backup.requests[targetPid] || [], subData.requests || []);
          mergedRequests.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
          this.requests.set(mergedRequests);

          const mergedMessages = mergeById(backup.messages[targetPid] || [], subData.messages || []);
          mergedMessages.sort((a, b) => b.date.localeCompare(a.date));
          this.messages.set(mergedMessages);

          const mergedAuthorities = mergeById(backup.authorities[targetPid] || [], subData.authorities || []);
          mergedAuthorities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          this.authorities.set(mergedAuthorities);

          const mergedSeeds = mergeById(backup.seeds[targetPid] || [], subData.seeds || []);
          mergedSeeds.sort((a, b) => b.date.localeCompare(a.date));
          this.seeds.set(mergedSeeds);

          // Persist merged state locally
          backup.partnerships = list;
          backup.sessions[targetPid] = mergedSessions;
          backup.testimonies[targetPid] = mergedTestimonies;
          backup.requests[targetPid] = mergedRequests;
          backup.messages[targetPid] = mergedMessages;
          backup.authorities[targetPid] = mergedAuthorities;
          backup.seeds[targetPid] = mergedSeeds;
          this.saveLocalBackup(backup);
        }
        return;
      }
    } catch {
      // Fallback to localStorage if offline
    }

    const localPartnerships = backup.partnerships.filter((p) =>
      p.memberEmails.map((e) => e.toLowerCase()).includes(email)
    );
    this.partnerships.set(localPartnerships);
    if (localPartnerships.length > 0) {
      const pid = activeId && localPartnerships.some((p) => p.id === activeId) ? activeId : localPartnerships[0].id;
      this.activePartnershipId.set(pid);
      this.sessions.set(backup.sessions[pid] || []);
      this.testimonies.set(backup.testimonies[pid] || []);
      this.requests.set(backup.requests[pid] || []);
      this.messages.set(backup.messages[pid] || []);
      this.authorities.set(backup.authorities[pid] || []);
      this.seeds.set(backup.seeds[pid] || []);
    }
  }

  private async pushToFallbackCloud(
    type: 'partnership' | 'sessions' | 'testimonies' | 'requests' | 'messages' | 'authorities' | 'seeds',
    action: 'upsert' | 'delete',
    item: Record<string, unknown>,
    partnershipId?: string
  ) {
    const backup = this.getLocalBackup();
    const itemId = String(item['id'] || '');

    if (type === 'partnership') {
      const idx = backup.partnerships.findIndex((p) => p.id === itemId);
      if (action === 'delete') {
        if (idx >= 0) backup.partnerships.splice(idx, 1);
      } else if (idx >= 0) {
        backup.partnerships[idx] = { ...backup.partnerships[idx], ...(item as unknown as Partnership) };
      } else {
        backup.partnerships.push(item as unknown as Partnership);
      }
      this.partnerships.set([...backup.partnerships]);
    } else if (partnershipId) {
      if (!backup[type][partnershipId]) {
        backup[type][partnershipId] = [];
      }
      const arr = backup[type][partnershipId] as unknown as Record<string, unknown>[];
      const idx = arr.findIndex((x) => x['id'] === itemId);
      if (action === 'delete') {
        if (idx >= 0) arr.splice(idx, 1);
      } else if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...item };
      } else {
        arr.push(item);
      }

      if (type === 'sessions') {
        const list = [...backup.sessions[partnershipId]].sort((a, b) => b.date.localeCompare(a.date));
        this.sessions.set(list);
      } else if (type === 'testimonies') {
        const list = [...backup.testimonies[partnershipId]].sort((a, b) => b.date.localeCompare(a.date));
        this.testimonies.set(list);
      } else if (type === 'requests') {
        const list = [...backup.requests[partnershipId]].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
        this.requests.set(list);
      } else if (type === 'messages') {
        const list = [...backup.messages[partnershipId]].sort((a, b) => b.date.localeCompare(a.date));
        this.messages.set(list);
      } else if (type === 'authorities') {
        const list = [...backup.authorities[partnershipId]].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.authorities.set(list);
      } else if (type === 'seeds') {
        const list = [...backup.seeds[partnershipId]].sort((a, b) => b.date.localeCompare(a.date));
        this.seeds.set(list);
      }
    }

    this.saveLocalBackup(backup);

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/cloud-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, action, partnershipId, item }),
        });
      } catch {
        // ignore network error; saved in local backup
      }
    }
  }

  private async syncUserProfile(user: User) {
    if (this.isFallbackMode() || !auth.currentUser) return;
    const userPath = `users/${user.uid}`;
    try {
      const profileData: AppUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Intercessor',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), removeUndefinedFields(profileData), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }

  private subscribeToUserPartnerships(user: User) {
    if (this.isFallbackMode() || !auth.currentUser) {
      this.loadFromFallbackCloud(user);
      return;
    }

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
          this.messages.set([]);
          this.authorities.set([]);
          this.seeds.set([]);
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
    if (this.isFallbackMode() || !auth.currentUser) {
      const u = this.currentUser();
      if (u) this.loadFromFallbackCloud(u);
      return;
    }
    this.subscribeToPartnershipData(partnershipId);
  }

  private subscribeToPartnershipData(partnershipId: string) {
    if (this.isFallbackMode() || !auth.currentUser) return;

    // Unsubscribe previous subcollections
    if (this.unsubSessions) this.unsubSessions();
    if (this.unsubTestimonies) this.unsubTestimonies();
    if (this.unsubRequests) this.unsubRequests();
    if (this.unsubMessages) this.unsubMessages();
    if (this.unsubAuthorities) this.unsubAuthorities();
    if (this.unsubSeeds) this.unsubSeeds();

    // 1. Sessions
    const sessionsPath = `partnerships/${partnershipId}/sessions`;
    this.unsubSessions = onSnapshot(
      collection(db, sessionsPath),
      (snapshot) => {
        const list: PrayerSession[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as PrayerSession);
        });
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

    // 4. Messages (Listening Tracker)
    const messagesPath = `partnerships/${partnershipId}/messages`;
    this.unsubMessages = onSnapshot(
      collection(db, messagesPath),
      (snapshot) => {
        const list: MessageListeningRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as MessageListeningRecord);
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        this.messages.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, messagesPath);
      }
    );

    // 5. Authority Figures (Seed Targets)
    const authoritiesPath = `partnerships/${partnershipId}/authorities`;
    this.unsubAuthorities = onSnapshot(
      collection(db, authoritiesPath),
      (snapshot) => {
        const list: AuthorityFigureSeed[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as AuthorityFigureSeed);
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.authorities.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, authoritiesPath);
      }
    );

    // 6. Seeds Given
    const seedsPath = `partnerships/${partnershipId}/seeds`;
    this.unsubSeeds = onSnapshot(
      collection(db, seedsPath),
      (snapshot) => {
        const list: SeedGivingRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as SeedGivingRecord);
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        this.seeds.set(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, seedsPath);
      }
    );
  }

  private clearSubscriptions() {
    if (this.unsubPartnerships) this.unsubPartnerships();
    if (this.unsubSessions) this.unsubSessions();
    if (this.unsubTestimonies) this.unsubTestimonies();
    if (this.unsubRequests) this.unsubRequests();
    if (this.unsubMessages) this.unsubMessages();
    if (this.unsubAuthorities) this.unsubAuthorities();
    if (this.unsubSeeds) this.unsubSeeds();
    this.unsubPartnerships = null;
    this.unsubSessions = null;
    this.unsubTestimonies = null;
    this.unsubRequests = null;
    this.unsubMessages = null;
    this.unsubAuthorities = null;
    this.unsubSeeds = null;
    this.partnerships.set([]);
    this.activePartnershipId.set(null);
    this.sessions.set([]);
    this.testimonies.set([]);
    this.requests.set([]);
    this.messages.set([]);
    this.authorities.set([]);
    this.seeds.set([]);
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
    },
    circleType: 'individual' | 'partner' = 'partner'
  ): Promise<string> {
    const user = this.currentUser();
    if (!user) throw new Error('User must be logged in to create a prayer partnership');

    const currentUserEmail = (user.email || '').toLowerCase().trim();
    const currentUserName = user.displayName || currentUserEmail.split('@')[0] || 'Me';

    // If individual private space, only include creator's email so nobody else can see it.
    // If with partner, include partner emails so only those partners can see the circle they belong to.
    const rawEmails = circleType === 'individual'
      ? [currentUserEmail]
      : [currentUserEmail, ...partnerEmailsInput.map((e) => e.toLowerCase().trim())];

    const cleanEmails = Array.from(
      new Set(rawEmails.filter((e) => e.length > 0 && e.includes('@')))
    );

    const pId = 'partnership-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const pPath = `partnerships/${pId}`;

    const newPartnership: Partnership = {
      id: pId,
      name: name.trim() || (circleType === 'individual' ? 'Private Prayer Space' : 'Prayer Accountability Circle'),
      circleType,
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

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('partnership', 'upsert', removeUndefinedFields(newPartnership) as unknown as Record<string, unknown>);
      this.selectPartnership(pId);
      return pId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId), removeUndefinedFields(newPartnership));
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

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('partnership', 'upsert', { ...p, circleType: 'partner', memberEmails: updatedEmails } as unknown as Record<string, unknown>);
      return;
    }

    const pPath = `partnerships/${partnershipId}`;
    try {
      await updateDoc(doc(db, 'partnerships', partnershipId), {
        circleType: 'partner',
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
    if (this.isFallbackMode() || !auth.currentUser) {
      const p = this.partnerships().find((x) => x.id === partnershipId);
      if (p) {
        await this.pushToFallbackCloud('partnership', 'upsert', {
          ...p,
          dailyTargetMinutes: targets.dailyMinutes,
          weeklyTargetMinutes: targets.weeklyMinutes,
          periodTitle: targets.periodTitle,
          periodTargetMinutes: targets.periodTargetMinutes,
          periodStartDate: targets.periodStartDate,
          periodEndDate: targets.periodEndDate,
        } as unknown as Record<string, unknown>);
      }
      return;
    }

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
      : [sessionData.category || 'Thanksgiving & Praise'];

    const newSession: Record<string, unknown> = {
      id: sId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      date: sessionData.date,
      durationMinutes: sessionData.durationMinutes,
      category: categories[0] || 'Thanksgiving & Praise',
      categories,
      topics: sessionData.topics || [],
      notes: sessionData.notes || '',
      participantNames: sessionData.participantNames || [],
      wasTogether: !!sessionData.wasTogether,
      createdAt: new Date().toISOString(),
    };

    if (sessionData.startTime) {
      newSession['startTime'] = sessionData.startTime;
    }
    if (sessionData.scripture) {
      newSession['scripture'] = sessionData.scripture;
    }
    if (sessionData.linkedTestimonyId) {
      newSession['linkedTestimonyId'] = sessionData.linkedTestimonyId;
    }
    if (sessionData.linkedTestimonyTitle) {
      newSession['linkedTestimonyTitle'] = sessionData.linkedTestimonyTitle;
    }

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('sessions', 'upsert', removeUndefinedFields(newSession), pId);
      return sId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'sessions', sId), removeUndefinedFields(newSession));
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
      : [session.category || 'Thanksgiving & Praise'];

    const updatedData: Record<string, unknown> = {
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
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'sessions',
        'upsert',
        removeUndefinedFields({ ...session, ...updatedData }),
        pId
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'sessions', session.id), removeUndefinedFields(updatedData));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, sPath);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('sessions', 'delete', { id: sessionId }, pId);
      return;
    }

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
      : [testimonyData.category || 'Thanksgiving & Praise'];

    const newTestimony: Record<string, unknown> = {
      id: tId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      title: testimonyData.title,
      date: testimonyData.date,
      category: categories[0] || 'Thanksgiving & Praise',
      categories,
      prayerBurden: testimonyData.prayerBurden || '',
      answeredDetail: testimonyData.answeredDetail || '',
      amensCount: 1,
      amenUids: [user.uid],
      createdAt: new Date().toISOString(),
    };

    if (testimonyData.scripturePraise) {
      newTestimony['scripturePraise'] = testimonyData.scripturePraise;
    }
    if (testimonyData.linkedSessionId) {
      newTestimony['linkedSessionId'] = testimonyData.linkedSessionId;
    }

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('testimonies', 'upsert', removeUndefinedFields(newTestimony), pId);
      if (testimonyData.linkedSessionId) {
        await this.linkTestimonyToSession(testimonyData.linkedSessionId, tId, testimonyData.title);
      }
      return tId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'testimonies', tId), removeUndefinedFields(newTestimony));

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
      : [testimony.category || 'Thanksgiving & Praise'];

    const updatedData: Record<string, unknown> = {
      title: testimony.title,
      date: testimony.date,
      category: categories[0] || 'Thanksgiving & Praise',
      categories,
      prayerBurden: testimony.prayerBurden || '',
      answeredDetail: testimony.answeredDetail || '',
      scripturePraise: testimony.scripturePraise || '',
      linkedSessionId: testimony.linkedSessionId || null,
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'testimonies',
        'upsert',
        removeUndefinedFields({ ...testimony, ...updatedData }),
        pId
      );
      if (testimony.linkedSessionId) {
        await this.linkTestimonyToSession(testimony.linkedSessionId, testimony.id, testimony.title);
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'testimonies', testimony.id), removeUndefinedFields(updatedData));

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

    if (this.isFallbackMode() || !auth.currentUser) {
      const existingSession = this.sessions().find((s) => s.id === sessionId);
      if (existingSession) {
        await this.pushToFallbackCloud(
          'sessions',
          'upsert',
          { ...existingSession, linkedTestimonyId: testimonyId, linkedTestimonyTitle: testimonyTitle } as unknown as Record<string, unknown>,
          pId
        );
      }
      const existingTestimony = this.testimonies().find((t) => t.id === testimonyId);
      if (existingTestimony) {
        await this.pushToFallbackCloud(
          'testimonies',
          'upsert',
          { ...existingTestimony, linkedSessionId: sessionId } as unknown as Record<string, unknown>,
          pId
        );
      }
      return;
    }

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

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'testimonies',
        'upsert',
        { ...t, amensCount: (t.amensCount || 0) + 1, amenUids: [...uids, user.uid] } as unknown as Record<string, unknown>,
        pId
      );
      return;
    }

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

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('testimonies', 'delete', { id: testimonyId }, pId);
      return;
    }

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

    const categories = requestData.categories && requestData.categories.length > 0
      ? requestData.categories
      : [requestData.category || 'Intercession & Nations'];

    const newRequest: Record<string, unknown> = {
      id: rId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      title: requestData.title,
      status: requestData.status || 'active',
      category: categories[0] || 'Intercession & Nations',
      categories,
      dateAdded: requestData.dateAdded || this.getTodayDateString(),
      assignedPartner: requestData.assignedPartner || 'All Partners (Shared Agreement)',
      notes: requestData.notes || '',
      createdAt: new Date().toISOString(),
    };

    if (requestData.answeredTestimonyId) {
      newRequest['answeredTestimonyId'] = requestData.answeredTestimonyId;
    }

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('requests', 'upsert', removeUndefinedFields(newRequest), pId);
      return;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'requests', rId), removeUndefinedFields(newRequest));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, rPath);
    }
  }

  async updateRequest(request: PrayerRequest): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const rPath = `partnerships/${pId}/requests/${request.id}`;

    const categories = request.categories && request.categories.length > 0
      ? request.categories
      : [request.category || 'Intercession & Nations'];

    const updatedData: Record<string, unknown> = {
      title: request.title,
      status: request.status,
      category: categories[0] || 'Intercession & Nations',
      categories,
      assignedPartner: request.assignedPartner,
      notes: request.notes || '',
      answeredTestimonyId: request.answeredTestimonyId || null,
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'requests',
        'upsert',
        removeUndefinedFields({ ...request, ...updatedData }),
        pId
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'requests', request.id), removeUndefinedFields(updatedData));
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
    const nextStatus = currentStatus === 'answered' ? 'active' : 'answered';

    if (this.isFallbackMode() || !auth.currentUser) {
      const existing = this.requests().find((r) => r.id === requestId);
      if (existing) {
        await this.pushToFallbackCloud(
          'requests',
          'upsert',
          { ...existing, status: nextStatus } as unknown as Record<string, unknown>,
          pId
        );
      }
      return;
    }

    const rPath = `partnerships/${pId}/requests/${requestId}`;
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

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('requests', 'delete', { id: requestId }, pId);
      return;
    }

    const rPath = `partnerships/${pId}/requests/${requestId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, rPath);
    }
  }

  // --- Message Listening Operations ---

  async addMessageRecord(
    data: Omit<MessageListeningRecord, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt'>
  ): Promise<string> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active circle and user required');

    const mId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const mPath = `partnerships/${pId}/messages/${mId}`;
    const dur = Number(data.durationMinutes) || 0;

    const newMsg: Record<string, unknown> = {
      id: mId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      title: data.title.trim(),
      speaker: data.speaker ? data.speaker.trim() : '',
      date: data.date,
      durationMinutes: dur,
      initialDurationMinutes: Number(data.initialDurationMinutes) || dur,
      listenCount: Number(data.listenCount) || 1,
      notes: data.notes ? data.notes.trim() : '',
      wasTogether: !!data.wasTogether,
      createdAt: new Date().toISOString(),
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('messages', 'upsert', removeUndefinedFields(newMsg), pId);
      return mId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'messages', mId), removeUndefinedFields(newMsg));
      return mId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, mPath);
      throw err;
    }
  }

  async updateMessageRecord(record: MessageListeningRecord): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const mPath = `partnerships/${pId}/messages/${record.id}`;
    const dur = Number(record.durationMinutes) || 0;

    const updatedData: Record<string, unknown> = {
      title: record.title.trim(),
      speaker: record.speaker ? record.speaker.trim() : '',
      date: record.date,
      durationMinutes: dur,
      initialDurationMinutes: Number(record.initialDurationMinutes) || dur,
      listenCount: Number(record.listenCount) || 1,
      notes: record.notes ? record.notes.trim() : '',
      wasTogether: !!record.wasTogether,
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'messages',
        'upsert',
        removeUndefinedFields({ ...record, ...updatedData }),
        pId
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'messages', record.id), removeUndefinedFields(updatedData));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, mPath);
    }
  }

  /**
   * Adds additional listening time or repeats the initial recorded duration for an existing message.
   */
  async addMoreTimeToMessage(record: MessageListeningRecord, additionalMinutes: number): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const addMins = Math.max(1, Number(additionalMinutes) || 0);
    const currentTotal = Number(record.durationMinutes) || 0;
    const initialMins = Number(record.initialDurationMinutes) || currentTotal;
    const nextTotal = currentTotal + addMins;
    const nextCount = (Number(record.listenCount) || 1) + 1;
    const mPath = `partnerships/${pId}/messages/${record.id}`;

    const updatedData: Record<string, unknown> = {
      durationMinutes: nextTotal,
      initialDurationMinutes: initialMins,
      listenCount: nextCount,
      date: this.getTodayDateString(),
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'messages',
        'upsert',
        removeUndefinedFields({ ...record, ...updatedData }),
        pId
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'messages', record.id), removeUndefinedFields(updatedData));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, mPath);
    }
  }

  async deleteMessageRecord(messageId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('messages', 'delete', { id: messageId }, pId);
      return;
    }

    const mPath = `partnerships/${pId}/messages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'messages', messageId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, mPath);
    }
  }

  // --- Authority Figure & Seed Giving Operations ---

  async addAuthorityFigure(
    data: Omit<AuthorityFigureSeed, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt'>
  ): Promise<string> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active circle and user required');

    const aId = 'auth-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const aPath = `partnerships/${pId}/authorities/${aId}`;

    const newAuthority: Record<string, unknown> = {
      id: aId,
      partnershipId: pId,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      authorityName: data.authorityName.trim(),
      roleTitle: data.roleTitle ? data.roleTitle.trim() : '',
      currency: data.currency || 'USD',
      yearTargetAmount: Number(data.yearTargetAmount) || 0,
      targetYear: data.targetYear || String(new Date().getFullYear()),
      mode: data.mode || 'individual',
      createdAt: new Date().toISOString(),
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('authorities', 'upsert', removeUndefinedFields(newAuthority), pId);
      return aId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'authorities', aId), removeUndefinedFields(newAuthority));
      return aId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, aPath);
      throw err;
    }
  }

  async updateAuthorityFigure(authority: AuthorityFigureSeed): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;
    const aPath = `partnerships/${pId}/authorities/${authority.id}`;

    const updatedData: Record<string, unknown> = {
      authorityName: authority.authorityName.trim(),
      roleTitle: authority.roleTitle ? authority.roleTitle.trim() : '',
      currency: authority.currency || 'USD',
      yearTargetAmount: Number(authority.yearTargetAmount) || 0,
      targetYear: authority.targetYear || String(new Date().getFullYear()),
      mode: authority.mode || 'individual',
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud(
        'authorities',
        'upsert',
        removeUndefinedFields({ ...authority, ...updatedData }),
        pId
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'partnerships', pId, 'authorities', authority.id), removeUndefinedFields(updatedData));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, aPath);
    }
  }

  async deleteAuthorityFigure(authorityId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('authorities', 'delete', { id: authorityId }, pId);
      return;
    }

    const aPath = `partnerships/${pId}/authorities/${authorityId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'authorities', authorityId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, aPath);
    }
  }

  async addSeedRecord(
    data: Omit<SeedGivingRecord, 'id' | 'partnershipId' | 'authorUid' | 'authorName' | 'createdAt'>
  ): Promise<string> {
    const pId = this.activePartnershipId();
    const user = this.currentUser();
    if (!pId || !user) throw new Error('Active circle and user required');

    const seedId = 'seed-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const seedPath = `partnerships/${pId}/seeds/${seedId}`;

    const newSeed: Record<string, unknown> = {
      id: seedId,
      partnershipId: pId,
      authorityId: data.authorityId,
      authorityName: data.authorityName,
      authorUid: user.uid,
      authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
      amount: Number(data.amount) || 0,
      date: data.date,
      mode: data.mode || 'individual',
      notes: data.notes ? data.notes.trim() : '',
      createdAt: new Date().toISOString(),
    };

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('seeds', 'upsert', removeUndefinedFields(newSeed), pId);
      return seedId;
    }

    try {
      await setDoc(doc(db, 'partnerships', pId, 'seeds', seedId), removeUndefinedFields(newSeed));
      return seedId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, seedPath);
      throw err;
    }
  }

  async deleteSeedRecord(seedId: string): Promise<void> {
    const pId = this.activePartnershipId();
    if (!pId) return;

    if (this.isFallbackMode() || !auth.currentUser) {
      await this.pushToFallbackCloud('seeds', 'delete', { id: seedId }, pId);
      return;
    }

    const seedPath = `partnerships/${pId}/seeds/${seedId}`;
    try {
      await deleteDoc(doc(db, 'partnerships', pId, 'seeds', seedId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, seedPath);
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

  // Filtered messages based on activeFilterMember
  readonly filteredMessages = computed<MessageListeningRecord[]>(() => {
    const filter = this.activeFilterMember();
    const list = this.messages();
    if (filter === 'all') return list;
    return list.filter((m) => m.authorUid === filter || m.authorName === filter);
  });

  readonly totalMessageMinutes = computed(() => {
    return this.filteredMessages().reduce((acc, m) => acc + (Number(m.durationMinutes) || 0), 0);
  });

  readonly totalMessageRepeats = computed(() => {
    return this.filteredMessages().reduce((acc, m) => acc + (Number(m.listenCount) || 1), 0);
  });

  // High-level Seed Totals across all specified Authority Figures (Main currency: GHS with live conversion)
  readonly seedTotalsSummary = computed(() => {
    const authorities = this.authorities();
    const seeds = this.seeds();
    const rates = this.fxToGhs();
    const primaryCurrency = 'GHS';

    let totalTargetGhs = 0;
    let totalGivenGhs = 0;
    let hasForeignCurrency = false;

    const byCurrencyMap = new Map<
      string,
      {
        currency: string;
        target: number;
        given: number;
        remaining: number;
        rateToGhs: number;
        targetGhs: number;
        givenGhs: number;
        remainingGhs: number;
      }
    >();

    for (const authItem of authorities) {
      const curr = (authItem.currency || 'GHS').toUpperCase();
      if (curr !== 'GHS') hasForeignCurrency = true;
      const rate = curr === 'GHS' ? 1 : rates[curr] || 1;
      const t = Number(authItem.yearTargetAmount) || 0;
      const tGhs = t * rate;
      totalTargetGhs += tGhs;

      const entry = byCurrencyMap.get(curr) || {
        currency: curr,
        target: 0,
        given: 0,
        remaining: 0,
        rateToGhs: rate,
        targetGhs: 0,
        givenGhs: 0,
        remainingGhs: 0,
      };
      entry.target += t;
      entry.targetGhs += tGhs;
      byCurrencyMap.set(curr, entry);
    }

    for (const s of seeds) {
      const amt = Number(s.amount) || 0;
      const parentAuth = authorities.find((a) => a.id === s.authorityId);
      const curr = (parentAuth?.currency || 'GHS').toUpperCase();
      if (curr !== 'GHS') hasForeignCurrency = true;
      const rate = curr === 'GHS' ? 1 : rates[curr] || 1;
      const amtGhs = amt * rate;
      totalGivenGhs += amtGhs;

      const entry = byCurrencyMap.get(curr) || {
        currency: curr,
        target: 0,
        given: 0,
        remaining: 0,
        rateToGhs: rate,
        targetGhs: 0,
        givenGhs: 0,
        remainingGhs: 0,
      };
      entry.given += amt;
      entry.givenGhs += amtGhs;
      byCurrencyMap.set(curr, entry);
    }

    const byCurrency = Array.from(byCurrencyMap.values()).map((c) => {
      const rem = Math.max(0, c.target - c.given);
      const remGhs = Math.max(0, c.targetGhs - c.givenGhs);
      return {
        ...c,
        remaining: rem,
        remainingGhs: remGhs,
        pct: c.target > 0 ? Math.min(100, Math.round((c.given / c.target) * 1000) / 10) : 0,
      };
    });

    const totalRemainingGhs = Math.max(0, totalTargetGhs - totalGivenGhs);
    const progressPct =
      totalTargetGhs > 0 ? Math.min(100, Math.round((totalGivenGhs / totalTargetGhs) * 1000) / 10) : 0;

    return {
      primaryCurrency,
      totalTarget: totalTargetGhs,
      totalGiven: totalGivenGhs,
      totalRemaining: totalRemainingGhs,
      progressPct,
      hasForeignCurrency,
      authoritiesCount: authorities.length,
      seedsCount: seeds.length,
      byCurrency,
    };
  });

  readonly totalAmensCount = computed(() => {
    return this.testimonies().reduce((acc, t) => acc + (Number(t.amensCount) || 0), 0);
  });

  readonly activeRequestsCount = computed(() => {
    return this.requests().filter((r) => r.status !== 'answered').length;
  });

  readonly answeredRequestsCount = computed(() => {
    return this.requests().filter((r) => r.status === 'answered').length;
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

    for (let i = 4; i >= 0; i--) {
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

    for (let w = 1; w >= 0; w--) {
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

      const label = w === 0 ? 'This Week' : 'Last Week';

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
    const requiredDailyMins = Math.round((remainingMins / daysRemaining) * 10) / 10;

    const loggedHours = Math.round((this.periodMinutesLogged() / 60) * 10) / 10;
    const targetHours = Math.round((p.periodTargetMinutes / 60) * 10) / 10;

    const isAhead = requiredDailyMins <= p.dailyTargetMinutes;

    return {
      daysRemaining,
      requiredDailyMins,
      loggedHours,
      targetHours,
      avgDailyVelocityMinutes: Math.round((this.thisWeekMinutes() / 7) * 10) / 10,
      isAhead,
    };
  });

  // Floating-point & Time formatting utilities (strictly 1 decimal point for floats)
  formatOneDecimal(val: number): string {
    const num = Number(val);
    if (!Number.isFinite(num)) return '0.0';
    return (Math.round(num * 10) / 10).toFixed(1);
  }

  formatHours(mins: number): string {
    const num = Number(mins);
    if (!Number.isFinite(num) || num <= 0) return '0.0';
    return (Math.round((num / 60) * 10) / 10).toFixed(1);
  }

  formatPercentage(value: number, target: number): string {
    const v = Number(value) || 0;
    const t = Number(target) || 0;
    if (t <= 0) return '0.0';
    const pct = Math.min(100, Math.max(0, (v / t) * 100));
    return (Math.round(pct * 10) / 10).toFixed(1);
  }

  formatMinutes(mins: number): string {
    const safeMins = Math.round((Number(mins) || 0) * 10) / 10;
    if (safeMins < 60) {
      return Number.isInteger(safeMins) ? `${safeMins}m` : `${safeMins.toFixed(1)}m`;
    }
    const h = Math.floor(safeMins / 60);
    const m = Math.round((safeMins % 60) * 10) / 10;
    if (m === 0) return `${h}h`;
    const mStr = Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
    return `${h}h ${mStr}`;
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
