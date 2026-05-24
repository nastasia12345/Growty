import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DeadlineItem {
  id:          string;
  title:       string;
  deadline:    Date;
  type:        'task' | 'event';
  boardTitle?: string;
}

export interface ToastNotification {
  id:         string;
  title:      string;
  dateLabel:  string;
  message:    string;
  urgency:    'soon' | 'today' | 'now';
  durationMs: number;
  createdAt:  number;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const STORAGE_SHOWN = 'growty_notif_shown';
const ICON_URL      = '/icons/growty-notify.svg';

/** Reminder triggers: how many minutes BEFORE the deadline to fire */
const REMINDER_OFFSETS: { minutesBefore: number }[] = [
  { minutesBefore: 24 * 60 },
  { minutesBefore: 2  * 60 },
  { minutesBefore: 30      },
  { minutesBefore: 0       },
];

const MSG_KEYS: Record<'soon' | 'today' | 'now', string[]> = {
  soon:  ['notif.soonMsg1',  'notif.soonMsg2',  'notif.soonMsg3',  'notif.soonMsg4'],
  today: ['notif.todayMsg1', 'notif.todayMsg2', 'notif.todayMsg3', 'notif.todayMsg4'],
  now:   ['notif.nowMsg1',   'notif.nowMsg2',   'notif.nowMsg3'],
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationService {

  // Stream that the toast component subscribes to
  private toastsSubject = new BehaviorSubject<ToastNotification[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();

  private timers  = new Map<string, ReturnType<typeof setTimeout>>();
  private shown   = new Set<string>(this.loadShown());

  constructor(private translate: TranslateService) {}

  // ── Permission ──────────────────────────────────────────────────────────────

  get permissionStatus(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied')  return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // ── Schedule reminders ──────────────────────────────────────────────────────

  /**
   * Pass in all tasks/events that have deadlines.
   * The service clears stale timers and schedules fresh ones.
   */
  scheduleReminders(items: DeadlineItem[]): void {
    this.clearAllTimers();

    const now = Date.now();

    for (const item of items) {
      const dl = item.deadline.getTime();
      if (isNaN(dl) || dl < now) continue;                    // past or invalid
      if (dl - now > 8 * 24 * 60 * 60 * 1000) continue;      // >8 days away

      for (const offset of REMINDER_OFFSETS) {
        const fireAt = dl - offset.minutesBefore * 60_000;
        const delay  = fireAt - now;
        if (delay < 0) continue;

        const key = `${item.id}_${offset.minutesBefore}`;
        if (this.shown.has(key)) continue;

        const timer = setTimeout(() => {
          this.fire(item, offset.minutesBefore);
          this.markShown(key);
        }, delay);

        this.timers.set(key, timer);
      }
    }
  }

  clearAllTimers(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  // ── Dismiss a toast ─────────────────────────────────────────────────────────

  dismiss(id: string): void {
    this.toastsSubject.next(
      this.toastsSubject.value.filter(t => t.id !== id)
    );
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private fire(item: DeadlineItem, minutesBefore: number): void {
    const urgency   = this.urgency(minutesBefore);
    const dateLabel = this.formatDeadline(item.deadline, minutesBefore);
    const message   = this.pickMessage(urgency);

    const toast: ToastNotification = {
      id:         `${item.id}_${minutesBefore}_${Date.now()}`,
      title:      item.title,
      dateLabel,
      message,
      urgency,
      durationMs: urgency === 'now' ? 15_000 : 10_000,
      createdAt:  Date.now(),
    };

    // In-app toast
    this.toastsSubject.next([...this.toastsSubject.value, toast]);

    // Native browser notification (fires even if tab is in background)
    if (Notification.permission === 'granted') {
      this.showNative(item, dateLabel, message, urgency);
    }
  }

  private showNative(
    item:      DeadlineItem,
    dateLabel: string,
    message:   string,
    urgency:   'soon' | 'today' | 'now'
  ): void {
    const titles: Record<typeof urgency, string> = {
      soon:  `${this.translate.instant('notif.nativeUpcoming')} ${item.title}`,
      today: `${this.translate.instant('notif.nativeDueSoon')} ${item.title}`,
      now:   `${this.translate.instant('notif.nativeDeadlineNow')} ${item.title}`,
    };

    try {
      const n = new Notification(titles[urgency], {
        body:  `${dateLabel}\n${message}`,
        icon:  ICON_URL,
        badge: ICON_URL,
        tag:   `growty-${item.id}`,
        renotify: true,
      } as any);
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private urgency(min: number): 'soon' | 'today' | 'now' {
    if (min === 0)    return 'now';
    if (min <= 120)   return 'today';
    return 'soon';
  }

  private pickMessage(urgency: 'soon' | 'today' | 'now'): string {
    const pool = MSG_KEYS[urgency];
    const key  = pool[Math.floor(Math.random() * pool.length)];
    return this.translate.instant(key);
  }

  private formatDeadline(date: Date, minutesBefore: number): string {
    if (minutesBefore === 0) return this.translate.instant('notif.dueRightNow');

    const locale = this.translate.currentLang === 'uk' ? 'uk-UA' : 'en-US';
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    };

    if (minutesBefore >= 24 * 60) {
      const tomorrow = this.translate.instant('notif.tomorrow');
      return `${tomorrow} · ${date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}`;
    }

    return date.toLocaleString(locale, opts);
  }

  // ── Persistence (so refreshing the page doesn't re-show same notification) ──

  private loadShown(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_SHOWN);
      const arr = raw ? JSON.parse(raw) : [];
      // Prune entries older than 48 h (stored as "key|timestamp")
      const cutoff = Date.now() - 48 * 3600_000;
      return arr
        .filter((s: string) => {
          const ts = parseInt(s.split('|')[1] ?? '0', 10);
          return ts > cutoff;
        })
        .map((s: string) => s.split('|')[0]);
    } catch { return []; }
  }

  private markShown(key: string): void {
    this.shown.add(key);
    try {
      const raw  = localStorage.getItem(STORAGE_SHOWN);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      arr.push(`${key}|${Date.now()}`);
      // Keep at most 200 entries
      localStorage.setItem(STORAGE_SHOWN, JSON.stringify(arr.slice(-200)));
    } catch {}
  }
}
