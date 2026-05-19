import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface WellbeingQuestion {
  id: number;
  text: string;
  category: string;
}

export interface WellbeingAnswer {
  category: string;
  label: string;
  score: number;
}

export type SurveyTriggerReason = 'login' | 'morning' | 'evening';

const LS_KEY      = 'growty_wellbeing';
const PROMPT_KEY  = 'growty_wb_prompt_seen';

interface WBStorage {
  lastMorning?: string;   // ISO date string (YYYY-MM-DD)
  lastEvening?: string;
  lastLogin?:   string;
}

@Injectable({ providedIn: 'root' })
export class WellbeingService {
  private api = 'http://localhost:5000/api/wellbeing';

  /** Emits true to show the prompt overlay */
  showPrompt = signal<boolean>(false);

  /** Which period triggered the survey ('morning' | 'evening' | 'general') */
  activePeriod = signal<string>('general');

  constructor(private http: HttpClient) {
    this.startScheduler();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  triggerIfNeeded(reason: SurveyTriggerReason): void {
    const today = this.todayKey();
    const store = this.load();
    const hour  = new Date().getHours();

    if (reason === 'login') {
      // Show at most once per login session
      const seenKey = `${PROMPT_KEY}_login_${today}`;
      if (localStorage.getItem(seenKey)) return;

      const period = hour >= 18 ? 'evening' : hour >= 6 ? 'morning' : 'general';
      // Don't show if already completed today for this period
      if (period === 'morning' && store.lastMorning === today) return;
      if (period === 'evening' && store.lastEvening === today) return;

      localStorage.setItem(seenKey, '1');
      this.activePeriod.set(period);
      this.showPrompt.set(true);
      return;
    }

    if (reason === 'morning') {
      if (store.lastMorning === today) return;
      this.activePeriod.set('morning');
      this.showPrompt.set(true);
      return;
    }

    if (reason === 'evening') {
      if (store.lastEvening === today) return;
      this.activePeriod.set('evening');
      this.showPrompt.set(true);
      return;
    }
  }

  dismiss(): void {
    this.showPrompt.set(false);
  }

  markCompleted(period: string): void {
    const store = this.load();
    const today = this.todayKey();
    if (period === 'morning') store.lastMorning = today;
    else if (period === 'evening') store.lastEvening = today;
    else { store.lastMorning = today; store.lastEvening = today; }
    this.save(store);
    this.showPrompt.set(false);
  }

  async generateQuestions(period: string): Promise<WellbeingQuestion[]> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ questions: WellbeingQuestion[] }>(`${this.api}/questions`, { period })
      );
      return res.questions;
    } catch {
      return this.fallbackQuestions(period);
    }
  }

  async generateQuote(answers: WellbeingAnswer[]): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ quote: string }>(`${this.api}/quote`, { answers })
      );
      return res.quote;
    } catch {
      const avg = answers.length > 0
        ? answers.reduce((s, a) => s + a.score, 0) / answers.length
        : 3;
      if (avg >= 4) return "You're blooming beautifully — keep nurturing that energy! 🌻";
      if (avg >= 3) return "Every day is a new chance to grow. You've got this! 🌱";
      return "Even the smallest seed grows in time. Be gentle with yourself today. 🌿";
    }
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  private startScheduler(): void {
    // Check every 5 minutes whether a morning / evening window just opened
    setInterval(() => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      if (h === 6  && m < 5) this.triggerIfNeeded('morning');
      if (h === 18 && m < 5) this.triggerIfNeeded('evening');
    }, 5 * 60 * 1000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private load(): WBStorage {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  private save(s: WBStorage): void {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }

  private fallbackQuestions(period: string): WellbeingQuestion[] {
    if (period === 'evening') return [
      { id: 1, text: 'How would you describe your day overall?',        category: 'day_summary'  },
      { id: 2, text: 'How manageable was your stress today?',           category: 'stress'       },
      { id: 3, text: 'How productive did you feel today?',              category: 'productivity' },
      { id: 4, text: 'How are your emotions settling as the day ends?', category: 'emotions'     },
      { id: 5, text: 'How is your overall wellbeing right now?',        category: 'wellbeing'    },
    ];
    return [
      { id: 1, text: 'How is your mood feeling right now?',             category: 'mood'       },
      { id: 2, text: 'How well did you sleep last night?',              category: 'sleep'      },
      { id: 3, text: 'How is your energy level right now?',             category: 'energy'     },
      { id: 4, text: 'How motivated do you feel to tackle today?',      category: 'motivation' },
      { id: 5, text: 'How clear do you feel about your plans today?',   category: 'plans'      },
    ];
  }
}
