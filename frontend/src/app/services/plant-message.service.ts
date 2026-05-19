import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TaskService } from './task';

// ── BUBBLE TEST MODE ──────────────────────────────────────────────────────────
// Set to false when you're done testing the speech bubble UI.
export const BUBBLE_TEST_MODE = false;

const LS_LAST_SHOWN  = 'growty_plant_msg_shown';
const INTERVAL_MS    = 3 * 60 * 60 * 1000;   // 3 hours
const BUBBLE_AUTO_DISMISS_MS = 9000;           // 9 seconds

const FALLBACKS = [
  "You're doing great — keep growing! 🌱",
  "One step at a time, we'll bloom together! 🌿",
  "I believe in you! Let's make today count! 🌻",
  "Small steps still move you forward! 💚",
  "You've got this — I'm rooting for you! 🪴",
  "Every moment is a chance to grow a little more! 🌸",
];

@Injectable({ providedIn: 'root' })
export class PlantMessageService {
  private api = 'http://localhost:5000/api/wellbeing/plant-message';

  /** Whether the speech bubble is currently visible */
  showBubble   = signal(false);
  /** Text inside the bubble */
  currentMsg   = signal('');

  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http:        HttpClient,
    private taskService: TaskService,
  ) {
    this.startScheduler();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async triggerIfNeeded(): Promise<void> {
    const lastShown = +(localStorage.getItem(LS_LAST_SHOWN) ?? '0');
    if (Date.now() - lastShown < INTERVAL_MS) return;
    await this.fireMessage(await this.resolveContext());
  }

  async showTestMessage(): Promise<void> {
    await this.fireMessage('general');
  }

  dismiss(): void {
    this.showBubble.set(false);
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private startScheduler(): void {
    // Check every 5 minutes
    setInterval(() => this.triggerIfNeeded(), 5 * 60 * 1000);

    // Also check once at evening (18:00) for "no tasks" message
    setInterval(() => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      if (h === 18 && m < 5) this.checkNoTasksToday();
    }, 5 * 60 * 1000);
  }

  private async resolveContext(): Promise<string> {
    const hour = new Date().getHours();
    if (hour < 10) return 'morning';
    if (hour >= 20) return 'evening';
    return 'general';
  }

  private async checkNoTasksToday(): Promise<void> {
    try {
      const tasks: any[] = await firstValueFrom(this.taskService.getAllTasks());
      const today = new Date().toDateString();
      const doneToday = tasks.filter(t =>
        (t.status === 'Done' || t.status === 'done' || t.status === 'completed') &&
        t.updatedAt && new Date(t.updatedAt).toDateString() === today
      ).length;
      if (doneToday === 0) await this.fireMessage('no_tasks');
    } catch {
      // Silently skip if tasks can't be fetched
    }
  }

  private async fireMessage(context: string): Promise<void> {
    const msg = await this.fetchMessage(context);
    this.currentMsg.set(msg);
    this.showBubble.set(true);
    localStorage.setItem(LS_LAST_SHOWN, Date.now().toString());

    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => this.showBubble.set(false), BUBBLE_AUTO_DISMISS_MS);
  }

  private async fetchMessage(context: string): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ message: string }>(this.api, { context, completedToday: 0 })
      );
      return res.message?.trim() || this.randomFallback();
    } catch {
      return this.randomFallback();
    }
  }

  private randomFallback(): string {
    return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  }
}
