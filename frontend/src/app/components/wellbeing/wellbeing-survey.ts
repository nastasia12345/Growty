import {
  Component, OnInit, OnDestroy, signal, computed,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { WellbeingService, WellbeingQuestion, WellbeingAnswer } from '../../services/wellbeing.service';

type Phase = 'prompt' | 'loading' | 'survey' | 'submitting' | 'final';

interface RatingOption {
  score: number;
  emoji: string;
  labelKey: string;
}

const RATINGS: RatingOption[] = [
  { score: 1, emoji: '😞', labelKey: 'wellbeing.poor'  },
  { score: 2, emoji: '😕', labelKey: 'wellbeing.low'   },
  { score: 3, emoji: '😐', labelKey: 'wellbeing.okay'  },
  { score: 4, emoji: '🙂', labelKey: 'wellbeing.good'  },
  { score: 5, emoji: '😄', labelKey: 'wellbeing.great' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  mood:        '💭',
  sleep:       '😴',
  energy:      '⚡',
  motivation:  '🎯',
  plans:       '📋',
  day_summary: '🗓️',
  stress:      '🌬️',
  productivity:'✅',
  emotions:    '❤️',
  wellbeing:   '🌿',
  general:     '💚',
};

@Component({
  selector: 'app-wellbeing-survey',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  templateUrl: './wellbeing-survey.html',
  styleUrl: './wellbeing-survey.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WellbeingSurveyComponent implements OnInit, OnDestroy {

  phase: Phase = 'prompt';

  questions:    WellbeingQuestion[] = [];
  answers:      WellbeingAnswer[]   = [];
  currentIndex  = 0;
  slideDir:     'left' | 'right'    = 'right';
  sliding       = false;

  finalQuote    = '';
  finalEmoji    = '🌻';

  ratings = RATINGS;
  hoveredScore: number | null = null;

  // For period display
  get period(): string { return this.wb.activePeriod(); }
  get visible(): boolean { return this.wb.showPrompt(); }

  get periodLabel(): string {
    if (this.period === 'morning') return 'wellbeing.periodMorning';
    if (this.period === 'evening') return 'wellbeing.periodEvening';
    return 'wellbeing.periodGeneral';
  }

  get currentQuestion(): WellbeingQuestion | null {
    return this.questions[this.currentIndex] ?? null;
  }

  get currentAnswer(): number | null {
    const a = this.answers.find(a => a.category === this.currentQuestion?.category);
    return a?.score ?? null;
  }

  get categoryEmoji(): string {
    return CATEGORY_EMOJI[this.currentQuestion?.category ?? ''] ?? '💚';
  }

  get progress(): number {
    if (!this.questions.length) return 0;
    return ((this.currentIndex + 1) / this.questions.length) * 100;
  }

  constructor(
    private wb:  WellbeingService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {}
  ngOnDestroy(): void {}

  // ── Prompt actions ─────────────────────────────────────────────────────────

  async onNotYet(): Promise<void> {
    this.phase = 'loading';
    this.cdr.detectChanges();

    this.questions = await this.wb.generateQuestions(this.period);
    this.answers   = [];
    this.currentIndex = 0;

    this.phase = 'survey';
    this.cdr.detectChanges();
  }

  onAlreadyDone(): void {
    this.wb.markCompleted(this.period);
  }

  onDismiss(): void {
    this.wb.dismiss();
  }

  // ── Survey actions ─────────────────────────────────────────────────────────

  selectRating(option: RatingOption): void {
    const q = this.currentQuestion;
    if (!q) return;

    // Upsert answer
    const idx = this.answers.findIndex(a => a.category === q.category);
    const ans: WellbeingAnswer = { category: q.category, label: option.labelKey, score: option.score };
    if (idx >= 0) this.answers[idx] = ans;
    else this.answers.push(ans);
  }

  async next(): Promise<void> {
    if (!this.currentAnswer) return;

    if (this.currentIndex < this.questions.length - 1) {
      await this.animateSlide('left');
      this.currentIndex++;
      this.cdr.detectChanges();
    } else {
      await this.submitSurvey();
    }
  }

  async prev(): Promise<void> {
    if (this.currentIndex === 0) return;
    await this.animateSlide('right');
    this.currentIndex--;
    this.cdr.detectChanges();
  }

  private async animateSlide(dir: 'left' | 'right'): Promise<void> {
    this.slideDir = dir;
    this.sliding  = true;
    this.cdr.detectChanges();
    await this.delay(320);
    this.sliding = false;
  }

  private async submitSurvey(): Promise<void> {
    this.phase = 'submitting';
    this.cdr.detectChanges();

    const quote = await this.wb.generateQuote(this.answers);
    const avg   = this.answers.reduce((s, a) => s + a.score, 0) / this.answers.length;
    this.finalQuote = quote;
    this.finalEmoji = avg >= 4 ? '🌻' : avg >= 3 ? '🌱' : '🌿';

    this.wb.markCompleted(this.period);
    this.phase = 'final';
    this.cdr.detectChanges();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  trackByScore(_: number, r: RatingOption): number { return r.score; }
}
