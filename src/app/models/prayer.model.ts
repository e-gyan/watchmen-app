export type AppTabId =
  | 'dashboard'
  | 'messages'
  | 'seeds'
  | 'journal'
  | 'analytics'
  | 'testimonies'
  | 'covenant';

export interface NavigationMenuItem {
  id: AppTabId;
  label: string;
  icon: string;
  showInBottomBar: boolean;
  showInSidebar: boolean;
  slideOrder?: number;
}

export interface BottomBarSlideConfig {
  enabled: boolean;
  swipeThresholdPx: number;
  durationMs: number;
  easing: string;
  loop: boolean;
  order: AppTabId[];
}

export interface DailyAlertSettings {
  enabled: boolean;
  prayerCheckEnabled: boolean;
  prayerCheckTime: string;          // "HH:MM" 24-hour format, e.g. "20:00"
  prayerAlertMessage: string;       // Brief alert copy when no prayer logged today
  messageCheckEnabled: boolean;
  messageCheckTime: string;         // "HH:MM" 24-hour format, e.g. "21:00"
  messageAlertMessage: string;      // Brief alert copy when no message logged today
  lastPrayerAlertDate?: string;     // "YYYY-MM-DD"
  lastMessageAlertDate?: string;    // "YYYY-MM-DD"
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
}

export interface PrayerCategoryDef {
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export interface Partnership {
  id: string;
  name: string;
  circleType?: 'individual' | 'partner'; // 'individual' = private space, 'partner' = shared with partner(s)
  createdBy: string;
  memberUids: string[];
  memberEmails: string[];
  memberNames: string[];
  dailyTargetMinutes: number;         // e.g. 60
  weeklyTargetMinutes: number;        // e.g. 420 (7h)
  periodTitle: string;                // e.g. "Year 2026 Covenant"
  periodTargetMinutes: number;        // e.g. 6000 (100h)
  periodStartDate: string;            // e.g. "2026-01-01"
  periodEndDate: string;              // e.g. "2026-12-31"
  customCategories?: PrayerCategoryDef[];
  alertSettings?: DailyAlertSettings;
  createdAt?: string;
}

export interface PrayerSession {
  id: string;
  partnershipId: string;
  authorUid: string;
  authorName: string;
  date: string;                       // "YYYY-MM-DD"
  startTime?: string;                 // "06:15 AM"
  durationMinutes: number;            // in minutes
  category: string;                   // primary category
  categories?: string[];              // multiple selected prayer categories
  topics: string[];
  notes: string;
  scripture?: string;
  participantNames: string[];         // who participated
  wasTogether: boolean;
  linkedTestimonyId?: string;         // ID of allocated testimony if prayer was answered
  linkedTestimonyTitle?: string;      // Quick title of allocated testimony
  createdAt: string;
}

export interface Testimony {
  id: string;
  partnershipId: string;
  authorUid: string;
  authorName: string;
  title: string;
  date: string;                       // "YYYY-MM-DD"
  category: string;                   // primary category
  categories?: string[];              // multiple selected categories
  prayerBurden: string;
  answeredDetail: string;
  scripturePraise?: string;
  amensCount: number;
  amenUids: string[];
  linkedSessionId?: string;           // ID of the prayer session this testimony answered
  createdAt: string;
}

export interface PrayerRequest {
  id: string;
  partnershipId: string;
  authorUid: string;
  authorName: string;
  title: string;
  status: 'active' | 'answered' | 'waiting';
  category: string;
  categories?: string[];
  dateAdded: string;
  assignedPartner: string;
  notes: string;
  answeredTestimonyId?: string;
  createdAt: string;
}

export interface MessageListeningRecord {
  id: string;
  partnershipId: string;
  authorUid: string;
  authorName: string;
  title: string;
  speaker?: string;
  durationMinutes: number;            // cumulative total minutes spent on this message
  initialDurationMinutes?: number;    // initial single-listen duration in minutes
  listenCount?: number;               // number of listenings / repeats
  date: string;
  notes?: string;
  wasTogether: boolean;
  createdAt: string;
}

export interface AuthorityFigureSeed {
  id: string;
  partnershipId: string;
  authorUid: string;
  authorName: string;
  authorityName: string;
  roleTitle?: string;
  currency: string;
  yearTargetAmount: number;
  targetYear: string;
  mode: 'individual' | 'partner';
  createdAt: string;
}

export interface SeedGivingRecord {
  id: string;
  partnershipId: string;
  authorityId: string;
  authorityName: string;
  authorUid: string;
  authorName: string;
  amount: number;
  date: string;
  mode: 'individual' | 'partner';
  notes?: string;
  createdAt: string;
}

export interface DailyPrayerBundle {
  date: string;                       // "YYYY-MM-DD"
  dayName: string;                    // "Monday"
  formattedDisplayDate: string;       // "Mon, Nov 2, 2026"
  totalMinutes: number;
  sessions: PrayerSession[];
  metDailyTarget: boolean;
  dailyTargetMinutes: number;
  testimoniesCount: number;
  testimonies: Testimony[];
  allTopics: string[];
  allCategories: string[];
}

export interface DailyChartBar {
  dayLabel: string;                   // "Mon", "Tue", etc.
  dateStr: string;                    // "2026-11-02"
  totalMinutes: number;
  targetMinutes: number;
  metTarget: boolean;
  partnerBreakdown: { name: string; minutes: number }[];
}

export interface WeeklyTrendBar {
  weekLabel: string;
  totalMinutes: number;
  targetMinutes: number;
}

export interface CategoryMetric {
  category: string;
  totalMinutes: number;
  sessionCount: number;
  percentage: number;
  color: string;
}

// Default preset categories removed so users define their own custom categories
export const PRAYER_CATEGORIES: PrayerCategoryDef[] = [];

export const CATEGORY_COLOR_PALETTE: string[] = [
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#14b8a6',
  '#f97316',
];

export const CATEGORY_ICON_PALETTE: string[] = [
  'label',
  'local_fire_department',
  'auto_awesome',
  'public',
  'shield',
  'menu_book',
  'favorite',
  'bolt',
];
