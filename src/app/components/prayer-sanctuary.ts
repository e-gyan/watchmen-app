import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FirebaseService } from '../services/firebase.service';

interface ScripturePrompt {
  reference: string;
  text: string;
  theme: string;
}

const DEFAULT_SCRIPTURES: ScripturePrompt[] = [
  {
    reference: 'Philippians 4:6-7',
    text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.',
    theme: 'Peace & Thanksgiving',
  },
  {
    reference: '1 Thessalonians 5:16-18',
    text: 'Rejoice always, pray continually, give thanks in all circumstances; for this is God’s will for you in Christ Jesus.',
    theme: 'Unceasing Communion',
  },
  {
    reference: 'James 5:16',
    text: 'The prayer of a righteous person is powerful and effective. Elijah was a human being, even as we are. He prayed earnestly that it would not rain, and it did not rain on the land for three and a half years.',
    theme: 'Power of Fervent Prayer',
  },
  {
    reference: 'Matthew 18:19-20',
    text: 'Again, truly I tell you that if two of you on earth agree about anything they ask for, it will be done for them by my Father in heaven. For where two or three gather in my name, there am I with them.',
    theme: 'Partner Agreement',
  },
  {
    reference: 'Jeremiah 33:3',
    text: 'Call to me and I will answer you and tell you great and unsearchable things you do not know.',
    theme: 'Divine Revelation',
  },
  {
    reference: 'Isaiah 40:31',
    text: 'Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
    theme: 'Renewed Strength',
  },
];

@Component({
  selector: 'app-prayer-sanctuary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <!-- Sanctuary Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-500">
            The Secret Place
          </span>
          <h1 class="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
            Live Prayer Sanctuary & Timer
          </h1>
          <p class="text-xs text-stone-400 mt-0.5">
            Set aside holy time to stand in the gap, meditate on God's word, and account for your hours.
          </p>
        </div>

        <!-- Mode selector: Stopwatch vs Countdown -->
        <div class="flex items-center gap-1 p-1 bg-stone-900 border border-stone-800 rounded-xl shrink-0">
          <button
            type="button"
            (click)="setTimerMode('stopwatch')"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            [class]="
              timerMode() === 'stopwatch'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-100'
            "
          >
            Stopwatch
          </button>
          <button
            type="button"
            (click)="setTimerMode('countdown')"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            [class]="
              timerMode() === 'countdown'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-100'
            "
          >
            Target Countdown
          </button>
        </div>
      </div>

      <!-- Main Focus Timer Card -->
      <div class="relative overflow-hidden rounded-2xl bg-stone-950 border border-stone-800/80 p-6 sm:p-10 text-center space-y-8">
        <!-- Ambient subtle glow behind timer -->
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none blur-3xl transition-opacity duration-700"
          [class]="isRunning() ? 'bg-amber-500/10 opacity-100' : 'bg-stone-800/5 opacity-50'"
        ></div>

        <!-- Who is in prayer right now -->
        <div class="relative z-10 flex flex-wrap items-center justify-center gap-2">
          <span class="text-xs text-stone-400 mr-1">Intercessor:</span>
          <button
            type="button"
            (click)="selectedIntercessor.set(currentUserName())"
            class="text-xs py-1 px-3 rounded-full border transition-all"
            [class]="
              selectedIntercessor() === currentUserName()
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-medium'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
            "
          >
            {{ currentUserName() }} (Me)
          </button>

          @for (email of otherPartnerEmails(); track email) {
            <button
              type="button"
              (click)="selectedIntercessor.set(email.split('@')[0])"
              class="text-xs py-1 px-3 rounded-full border transition-all"
              [class]="
                selectedIntercessor() === email.split('@')[0]
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-medium'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
              "
            >
              {{ email.split('@')[0] }}
            </button>
          }

          <button
            type="button"
            (click)="selectedIntercessor.set('Joint Agreement')"
            class="text-xs py-1 px-3 rounded-full border transition-all"
            [class]="
              selectedIntercessor() === 'Joint Agreement'
                ? 'bg-amber-400 text-stone-950 font-semibold border-amber-400'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
            "
          >
            Both in Agreement
          </button>
        </div>

        <!-- Countdown duration presets (if countdown mode) -->
        @if (timerMode() === 'countdown' && !isRunning() && elapsedSeconds() === 0) {
          <div class="relative z-10 flex flex-wrap items-center justify-center gap-2">
            <span class="text-xs text-stone-500">Target Session:</span>
            @for (p of countdownPresets; track p.mins) {
              <button
                type="button"
                (click)="setCountdownMinutes(p.mins)"
                class="text-xs py-1.5 px-3 rounded-lg border transition-all"
                [class]="
                  countdownTargetMinutes() === p.mins
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-semibold'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'
                "
              >
                {{ p.label }}
              </button>
            }
          </div>
        }

        <!-- Digital Timer Display -->
        <div class="relative z-10 space-y-3">
          <div class="text-5xl sm:text-7xl md:text-8xl font-mono font-bold tracking-tight text-stone-100 tabular-nums">
            {{ formatTimeDisplay() }}
          </div>
          <div class="flex items-center justify-center gap-3 text-xs text-stone-400">
            @if (timerMode() === 'countdown') {
              <span>
                {{ Math.floor(countdownTargetMinutes()) }}m Target
                · {{ Math.floor(elapsedSeconds() / 60) }}m Completed
              </span>
            } @else {
              <span>
                Elapsed: {{ Math.floor(elapsedSeconds() / 60) }} mins
                ({{ (elapsedSeconds() / 3600).toFixed(2) }} hrs)
              </span>
            }
            <span aria-hidden="true">·</span>
            <span class="text-amber-400">
              {{ isRunning() ? 'Prayer Active' : (elapsedSeconds() > 0 ? 'Paused' : 'Ready') }}
            </span>
          </div>
        </div>

        <!-- Timer Controls -->
        <div class="relative z-10 flex flex-wrap items-center justify-center gap-4">
          @if (!isRunning()) {
            <button
              type="button"
              (click)="startTimer()"
              class="flex items-center gap-2 py-3 px-8 rounded-xl bg-amber-500 text-stone-950 font-bold text-sm hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20"
            >
              <mat-icon style="font-size: 22px;">play_arrow</mat-icon>
              <span>{{ elapsedSeconds() > 0 ? 'Resume Prayer' : 'Begin Prayer' }}</span>
            </button>
          } @else {
            <button
              type="button"
              (click)="pauseTimer()"
              class="flex items-center gap-2 py-3 px-8 rounded-xl bg-stone-800 text-stone-100 font-bold text-sm hover:bg-stone-700 active:scale-95 transition-all border border-stone-700"
            >
              <mat-icon style="font-size: 22px;">pause</mat-icon>
              <span>Pause</span>
            </button>
          }

          @if (elapsedSeconds() > 0) {
            <!-- Complete and Log Button -->
            <button
              type="button"
              (click)="finishAndLog()"
              class="flex items-center gap-2 py-3 px-6 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 active:scale-95 transition-all shadow-md shadow-emerald-900/30"
            >
              <mat-icon style="font-size: 20px;">check_circle</mat-icon>
              <span>Log Session ({{ Math.max(1, Math.round(elapsedSeconds() / 60)) }}m)</span>
            </button>

            <!-- Reset Button -->
            <button
              type="button"
              (click)="resetTimer()"
              class="flex items-center gap-1.5 py-3 px-4 rounded-xl text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-900 transition-colors"
            >
              <mat-icon style="font-size: 18px;">restart_alt</mat-icon>
              <span>Reset</span>
            </button>
          }

          <!-- Sound Chime Toggle -->
          <button
            type="button"
            (click)="toggleSoundChime()"
            class="flex items-center gap-1.5 py-3 px-4 rounded-xl border text-xs transition-colors"
            [class]="
              soundEnabled()
                ? 'bg-stone-900 border-amber-500/40 text-amber-300'
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
            "
            [title]="soundEnabled() ? 'Prayer bell chime enabled' : 'Prayer bell chime muted'"
          >
            <mat-icon style="font-size: 18px;">{{ soundEnabled() ? 'notifications_active' : 'notifications_off' }}</mat-icon>
            <span>{{ soundEnabled() ? 'Chime ON' : 'Chime Muted' }}</span>
          </button>
        </div>
      </div>

      <!-- Scripture Anchor & Meditation Carousel -->
      <div class="rounded-2xl bg-stone-950 border border-stone-800/80 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-amber-500">
            <mat-icon style="font-size: 18px;">auto_stories</mat-icon>
            <span class="text-xs font-semibold uppercase tracking-wider">
              Scripture Anchor for Prayer
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-stone-500">
              {{ currentScriptureIndex() + 1 }} of {{ scriptures().length }}
            </span>
            <button
              type="button"
              (click)="nextScripture()"
              class="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
              title="Next Scripture"
            >
              <mat-icon style="font-size: 20px;">chevron_right</mat-icon>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <blockquote class="text-base sm:text-lg font-serif italic text-stone-200 leading-relaxed">
            "{{ currentScripture().text }}"
          </blockquote>
          <div class="flex items-center gap-3 text-xs text-stone-400">
            <span class="font-semibold text-amber-400 font-sans">{{ currentScripture().reference }}</span>
            <span aria-hidden="true">·</span>
            <span>Focus: {{ currentScripture().theme }}</span>
          </div>
        </div>
      </div>

      <!-- Scripture & Prayer Points Assistant -->
      <div class="rounded-2xl bg-stone-950 border border-stone-800/80 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-amber-400" style="font-size: 18px;">lightbulb</mat-icon>
            <h3 class="text-sm font-semibold text-stone-200">
              Scripture Finder & Prayer Directive
            </h3>
          </div>
          <span class="text-xs text-stone-500">Topic-Specific Inspiration</span>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            [formControl]="customTopicControl"
            placeholder="Type a topic: e.g. Peace in decision making, Healing, Family unity..."
            class="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            (keyup.enter)="fetchAssistance()"
          />
          <button
            type="button"
            (click)="fetchAssistance()"
            [disabled]="isFetchingAssist()"
            class="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-amber-300 border border-stone-700 disabled:opacity-50 transition-all shrink-0"
          >
            <mat-icon style="font-size: 16px;">explore</mat-icon>
            <span>{{ isFetchingAssist() ? 'Consulting Word...' : 'Get Scriptures' }}</span>
          </button>
        </div>

        <!-- Render fetched scriptures if available -->
        @if (assistedScriptures().length > 0) {
          <div class="pt-2 space-y-3">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-amber-400">
              {{ assistedTitle() }}
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              @for (rec of assistedScriptures(); track rec.scripture) {
                <div class="p-3.5 rounded-xl bg-stone-900 border border-stone-800 space-y-2">
                  <div class="text-xs font-bold text-amber-400 font-sans">{{ rec.scripture }}</div>
                  <p class="text-xs text-stone-300 italic line-clamp-3">"{{ rec.text }}"</p>
                  <p class="text-xs text-stone-400 border-t border-stone-800/80 pt-2 font-medium">
                    {{ rec.prayerPoint }}
                  </p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PrayerSanctuary implements OnDestroy {
  readonly firebaseService = inject(FirebaseService);
  private http = inject(HttpClient);

  readonly openLogModal = output<{ minutes: number; partner?: string }>();

  // State
  readonly timerMode = signal<'stopwatch' | 'countdown'>('stopwatch');
  readonly isRunning = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly countdownTargetMinutes = signal(60); // 1 hour default
  readonly soundEnabled = signal(true);

  readonly currentUserName = computed(
    () =>
      this.firebaseService.currentUser()?.displayName ||
      this.firebaseService.currentUser()?.email?.split('@')[0] ||
      'Me'
  );

  readonly otherPartnerEmails = computed(() => {
    const p = this.firebaseService.activePartnership();
    const myEmail = (this.firebaseService.currentUser()?.email || '').toLowerCase();
    return (p?.memberEmails || []).filter((e) => e.toLowerCase() !== myEmail);
  });

  readonly selectedIntercessor = signal<string>('Me');

  readonly countdownPresets = [
    { label: '15 mins', mins: 15 },
    { label: '30 mins', mins: 30 },
    { label: '45 mins', mins: 45 },
    { label: '60 mins', mins: 60 },
    { label: '90 mins', mins: 90 },
    { label: '120 mins', mins: 120 },
  ];

  // Scriptures
  readonly scriptures = signal<ScripturePrompt[]>(DEFAULT_SCRIPTURES);
  readonly currentScriptureIndex = signal(0);

  // AI Assistance
  readonly customTopicControl = new FormControl('', { nonNullable: true });
  readonly isFetchingAssist = signal(false);
  readonly assistedTitle = signal('');
  readonly assistedScriptures = signal<{ scripture: string; text: string; prayerPoint: string }[]>([]);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  readonly Math = Math;

  currentScripture(): ScripturePrompt {
    return this.scriptures()[this.currentScriptureIndex()] || DEFAULT_SCRIPTURES[0];
  }

  setTimerMode(mode: 'stopwatch' | 'countdown') {
    if (this.isRunning()) return;
    this.timerMode.set(mode);
    this.resetTimer();
  }

  setCountdownMinutes(mins: number) {
    if (this.isRunning()) return;
    this.countdownTargetMinutes.set(mins);
    this.resetTimer();
  }

  startTimer() {
    this.isRunning.set(true);
    this.playChime(528, 1.2); // 528Hz peaceful prayer tone

    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.elapsedSeconds.update((s) => s + 1);

        // Check if countdown target reached
        if (this.timerMode() === 'countdown') {
          const targetSecs = this.countdownTargetMinutes() * 60;
          if (this.elapsedSeconds() >= targetSecs) {
            this.pauseTimer();
            this.playChime(660, 2.0); // celebration tone
          }
        }
      }, 1000);
    }
  }

  pauseTimer() {
    this.isRunning.set(false);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetTimer() {
    this.pauseTimer();
    this.elapsedSeconds.set(0);
  }

  finishAndLog() {
    const mins = Math.max(1, Math.round(this.elapsedSeconds() / 60));
    const intercessor = this.selectedIntercessor();
    this.pauseTimer();
    this.playChime(660, 1.5);
    this.openLogModal.emit({ minutes: mins, partner: intercessor });
    this.resetTimer();
  }

  toggleSoundChime() {
    this.soundEnabled.update((v) => !v);
    if (this.soundEnabled()) {
      this.playChime(528, 0.5);
    }
  }

  formatTimeDisplay(): string {
    const totalSecs =
      this.timerMode() === 'countdown'
        ? Math.max(0, this.countdownTargetMinutes() * 60 - this.elapsedSeconds())
        : this.elapsedSeconds();

    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  nextScripture() {
    this.currentScriptureIndex.update((i) => (i + 1) % this.scriptures().length);
  }

  fetchAssistance() {
    const topic = this.customTopicControl.value.trim();
    this.isFetchingAssist.set(true);

    this.http
      .post<{
        success: boolean;
        data?: {
          title?: string;
          recommendations?: { scripture: string; text: string; prayerPoint: string }[];
        };
      }>('/api/prayer-assist', {
        action: 'scriptures',
        topic: topic || 'Unceasing Prayer & Faithfulness',
      })
      .subscribe({
        next: (res) => {
          this.isFetchingAssist.set(false);
          if (res?.data?.recommendations) {
            this.assistedTitle.set(res.data.title || `Scriptures for "${topic}"`);
            this.assistedScriptures.set(res.data.recommendations);
          }
        },
        error: () => {
          this.isFetchingAssist.set(false);
          // graceful fallback
          this.assistedTitle.set(`Scriptures for "${topic || 'Prayer'}"`);
          this.assistedScriptures.set([
            {
              scripture: 'Hebrews 4:16',
              text: 'Let us then approach God’s throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.',
              prayerPoint: 'Come boldly before the Father, knowing your partner stands with you.',
            },
            {
              scripture: 'Mark 11:24',
              text: 'Whatever you ask for in prayer, believe that you have received it, and it will be yours.',
              prayerPoint: 'Anchor your faith in God’s unwavering character.',
            },
          ]);
        },
      });
  }

  private playChime(freq: number, duration: number) {
    if (!this.soundEnabled()) return;
    if (typeof window === 'undefined') return;

    try {
      const windowWithWebkit = window as unknown as { webkitAudioContext?: typeof AudioContext };
      const AudioCtxClass = window.AudioContext || windowWithWebkit.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      // Bell envelope (instant attack, exponential decay)
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // AudioContext policy or unsupported
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // audio context already closed
      }
    }
  }
}
