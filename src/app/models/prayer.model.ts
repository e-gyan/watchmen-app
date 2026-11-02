export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
}

export interface Partnership {
  id: string;
  name: string;
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
  category: string;                   // primary category (for backwards compat)
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

export interface PrayerCategoryDef {
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const PRAYER_CATEGORIES: PrayerCategoryDef[] = [
  {
    name: 'Adoration & Praise',
    icon: 'auto_awesome',
    color: '#f59e0b',
    description: 'Worship, beholding His majesty, exaltation of His attributes',
  },
  {
    name: 'Intercession & Nations',
    icon: 'public',
    color: '#10b981',
    description: 'Standing in the gap for souls, revival, leaders, family and friends',
  },
  {
    name: 'Spiritual Warfare',
    icon: 'shield',
    color: '#ef4444',
    description: 'Breaking strongholds, speaking authority in the name of Jesus',
  },
  {
    name: 'Word & Meditation',
    icon: 'menu_book',
    color: '#6366f1',
    description: 'Praying scriptures, waiting upon the Lord, listening prayer',
  },
  {
    name: 'Petition & Personal',
    icon: 'pan_tool_alt',
    color: '#8b5cf6',
    description: 'Personal needs, wisdom, direction, health, guidance and provision',
  },
  {
    name: 'Thanksgiving & Altar',
    icon: 'favorite',
    color: '#ec4899',
    description: 'Remembering His deeds, grateful celebration for past answers',
  },
];

