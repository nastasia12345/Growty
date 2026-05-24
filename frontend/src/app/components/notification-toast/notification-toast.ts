import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NotificationService, ToastNotification } from '../../services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <div
        *ngFor="let toast of toasts; trackBy: trackId"
        class="toast"
        [class.urgency-soon]="toast.urgency === 'soon'"
        [class.urgency-today]="toast.urgency === 'today'"
        [class.urgency-now]="toast.urgency === 'now'"
        [class.leaving]="leaving.has(toast.id)"
        role="alert">

        <!-- Header row -->
        <div class="toast-header">
          <div class="brand">
            <img src="/icons/growty-notify.svg" alt="Growty" class="brand-icon"/>
            <span class="brand-name">Growty</span>
            <span class="urgency-badge">
              {{ urgencyLabel(toast.urgency) }}
            </span>
          </div>
          <button class="close-btn" (click)="dismiss(toast.id)" aria-label="Dismiss">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="3" x2="13" y2="13"/>
              <line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </div>

        <!-- Divider -->
        <div class="divider"></div>

        <!-- Body -->
        <div class="toast-body">
          <div class="task-title">{{ toast.title }}</div>
          <div class="date-row">
            <svg class="icon-clock" viewBox="0 0 20 20" fill="none"
                 stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <circle cx="10" cy="10" r="8"/>
              <polyline points="10,5 10,10 13,13"/>
            </svg>
            {{ toast.dateLabel }}
          </div>
          <div class="message">{{ toast.message }}</div>
        </div>

        <!-- Auto-close progress bar -->
        <div class="progress-track">
          <div
            class="progress-fill"
            [class.urgency-bar-soon]="toast.urgency === 'soon'"
            [class.urgency-bar-today]="toast.urgency === 'today'"
            [class.urgency-bar-now]="toast.urgency === 'now'"
            [style.animation-duration.ms]="toast.durationMs">
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ── Stack container ─────────────────────────────────────────── */
    .toast-stack {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      width: 360px;
    }

    /* ── Individual toast ────────────────────────────────────────── */
    .toast {
      background: #ffffff;
      border-radius: 18px;
      box-shadow:
        0 4px 6px rgba(0,0,0,0.04),
        0 10px 28px rgba(0,0,0,0.10),
        0 0 0 1.5px #d1fae5;
      overflow: hidden;
      pointer-events: all;
      animation: toastEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .toast.leaving {
      opacity: 0;
      transform: translateX(110%);
    }

    /* Urgency border tints */
    .urgency-soon  { box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.10), 0 0 0 1.5px #a7f3d0; }
    .urgency-today { box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.10), 0 0 0 1.5px #fde68a; }
    .urgency-now   { box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.10), 0 0 0 1.5px #fca5a5; }

    @keyframes toastEnter {
      from { opacity: 0; transform: translateX(110%) scale(0.92); }
      to   { opacity: 1; transform: translateX(0)   scale(1);     }
    }

    /* ── Header ──────────────────────────────────────────────────── */
    .toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-icon {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .brand-name {
      font-size: 14px;
      font-weight: 800;
      color: #10b981;
      letter-spacing: -0.01em;
    }

    .urgency-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 999px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .urgency-soon  .urgency-badge { background: #d1fae5; color: #065f46; }
    .urgency-today .urgency-badge { background: #fef3c7; color: #92400e; }
    .urgency-now   .urgency-badge { background: #fee2e2; color: #7f1d1d; }

    .close-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: #f8fafc;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      transition: background 0.15s, color 0.15s;
      padding: 0;
      flex-shrink: 0;
    }
    .close-btn:hover { background: #f1f5f9; color: #475569; }
    .close-btn svg   { width: 12px; height: 12px; }

    /* ── Divider ─────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: #f1f5f9;
      margin: 0 16px;
    }

    /* ── Body ────────────────────────────────────────────────────── */
    .toast-body {
      padding: 12px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .task-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
      word-break: break-word;
    }

    .date-row {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12.5px;
      font-weight: 600;
      color: #64748b;
    }

    .icon-clock {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    .message {
      font-size: 13px;
      color: #64748b;
      font-style: italic;
      line-height: 1.5;
      padding: 6px 10px;
      background: #f8fafc;
      border-radius: 10px;
      border-left: 3px solid #a7f3d0;
    }
    .urgency-today .message { border-left-color: #fde68a; }
    .urgency-now   .message { border-left-color: #fca5a5; }

    /* ── Progress bar ────────────────────────────────────────────── */
    .progress-track {
      height: 4px;
      background: #f1f5f9;
    }

    .progress-fill {
      height: 100%;
      width: 100%;
      transform-origin: left;
      animation: progressShrink linear forwards;
    }

    .urgency-bar-soon  { background: linear-gradient(90deg, #10b981, #34d399); }
    .urgency-bar-today { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .urgency-bar-now   { background: linear-gradient(90deg, #ef4444, #f87171); }

    @keyframes progressShrink {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `]
})
export class NotificationToastComponent implements OnInit, OnDestroy {

  toasts: ToastNotification[] = [];
  leaving = new Set<string>();   // IDs of toasts playing exit animation

  private sub!: Subscription;
  private autoTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private notifService: NotificationService,
    private cdr:          ChangeDetectorRef,
    private translate:    TranslateService
  ) {}

  ngOnInit() {
    this.sub = this.notifService.toasts$.subscribe(toasts => {
      // Find newly added toasts and schedule auto-dismiss
      toasts.forEach(t => {
        if (!this.autoTimers.has(t.id)) {
          const timer = setTimeout(() => this.dismiss(t.id), t.durationMs);
          this.autoTimers.set(t.id, timer);
        }
      });
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.autoTimers.forEach(t => clearTimeout(t));
  }

  dismiss(id: string) {
    // Play exit animation, then remove from service
    this.leaving.add(id);
    this.cdr.markForCheck();
    clearTimeout(this.autoTimers.get(id));
    this.autoTimers.delete(id);
    setTimeout(() => {
      this.leaving.delete(id);
      this.notifService.dismiss(id);
    }, 320);
  }

  urgencyLabel(urgency: 'soon' | 'today' | 'now'): string {
    if (urgency === 'now')   return this.translate.instant('notif.urgencyNow');
    if (urgency === 'today') return this.translate.instant('notif.urgencySoon');
    return this.translate.instant('notif.urgencyUpcoming');
  }

  trackId(_: number, t: ToastNotification) { return t.id; }
}
