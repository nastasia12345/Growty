import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AnalyticsService, UserStats } from '../../services/analytics';
import { GoogleCalendarService, GoogleEvent } from '../../services/google-calendar';
import { NotificationService, DeadlineItem } from '../../services/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { TaskService } from '../../services/task';
import { LanguageService } from '../../services/language.service';

interface CalendarDay {
  date: Date | null;
  dayNum: number | null;
  stats: UserStats | null;
  googleEvents: GoogleEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, TranslateModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  viewDate = new Date();
  today    = new Date();
  days: CalendarDay[] = [];
  statsMap: Map<string, UserStats>    = new Map();
  googleEventsMap: Map<string, GoogleEvent[]> = new Map();
  allGoogleEvents: GoogleEvent[] = [];

  isLoading  = true;
  hasError   = false;

  googleConnected  = false;
  googleConnecting = false;
  googleSyncing    = false;
  googleImporting  = false;
  googleMessage    = '';
  googleError      = '';

  notifPermission: NotificationPermission = 'default';
  notifRequesting = false;

  hoveredDay: CalendarDay | null = null;
  tooltipX = 0;
  tooltipY = 0;

  secondDeg = 0;
  minuteDeg = 0;
  hourDeg   = 0;
  private clockTimer: any;

  readonly weekDays = [
    'calendar.weekSun','calendar.weekMon','calendar.weekTue','calendar.weekWed',
    'calendar.weekThu','calendar.weekFri','calendar.weekSat'
  ];

  constructor(
    private analyticsService: AnalyticsService,
    private googleService:    GoogleCalendarService,
    private taskService:      TaskService,
    private notifService:     NotificationService,
    private route:            ActivatedRoute,
    private cdr:              ChangeDetectorRef,
    public  langService:      LanguageService,
  ) {}

  ngOnInit() {
    this.startClock();
    this.handleCallbackParams();
    this.checkGoogleStatus();
    this.loadStats();
    this.notifPermission = this.notifService.permissionStatus;
    // Auto-request if not yet decided
    if (this.notifPermission === 'default') this.requestNotifPermission();
  }

  ngOnDestroy() {
    clearInterval(this.clockTimer);
    this.notifService.clearAllTimers();
  }

  // ── Notifications ────────────────────────────────────────────────────────

  async requestNotifPermission() {
    this.notifRequesting = true;
    this.cdr.markForCheck();
    const granted = await this.notifService.requestPermission();
    this.notifPermission = granted ? 'granted' : 'denied';
    this.notifRequesting = false;
    if (granted) this.scheduleDeadlineReminders();
    this.cdr.markForCheck();
  }

  private scheduleDeadlineReminders() {
    const items: DeadlineItem[] = [];

    // 1. From Google Calendar events already loaded
    this.allGoogleEvents.forEach(ev => {
      if (!ev.start) return;
      const dl = new Date(ev.start);
      if (isNaN(dl.getTime())) return;
      items.push({ id: `gcal_${ev.id ?? ev.start}`, title: ev.title ?? 'Google Event', deadline: dl, type: 'event' });
    });

    // 2. From Growty tasks with deadlines
    this.taskService.getAllTasks().pipe(
      catchError(() => of([] as any[]))
    ).subscribe(tasks => {
      tasks.forEach((t: any) => {
        if (!t.deadline) return;
        const dl = new Date(t.deadline);
        if (isNaN(dl.getTime())) return;
        if (t.status === 'Done') return;
        items.push({ id: `task_${t.id}`, title: t.title ?? t.name ?? 'Task', deadline: dl, type: 'task', boardTitle: t.boardTitle });
      });
      this.notifService.scheduleReminders(items);
    });
  }

  // ── OAuth callback handling ──────────────────────────────────────────────

  private handleCallbackParams() {
    this.route.queryParams.subscribe(params => {
      if (params['gcal'] === 'connected') {
        this.googleConnected = true;
        this.googleMessage   = '✓ Google Calendar connected! Your tasks have been synced.';
        this.loadGoogleEvents();
        window.history.replaceState({}, '', '/calendar');
        this.cdr.markForCheck();
      } else if (params['gcal_error']) {
        const msg = params['gcal_error'];
        this.googleError = msg === 'access_denied'
          ? 'Access was denied. Please try again and allow the required permissions.'
          : 'Could not connect to Google Calendar. Please try again.';
        window.history.replaceState({}, '', '/calendar');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Google status & events ───────────────────────────────────────────────

  private checkGoogleStatus() {
    this.googleService.getStatus().pipe(
      catchError(() => of({ connected: false, connectedAt: null }))
    ).subscribe(status => {
      this.googleConnected = status.connected;
      if (status.connected) this.loadGoogleEvents();
      this.cdr.markForCheck();
    });
  }

  private loadGoogleEvents() {
    this.googleService.getEvents().pipe(
      catchError(() => of([] as GoogleEvent[]))
    ).subscribe(events => {
      this.allGoogleEvents = events;
      this.googleEventsMap.clear();
      events.forEach(ev => {
        if (!ev.start) return;
        const key = ev.start.slice(0, 10);
        if (!this.googleEventsMap.has(key)) this.googleEventsMap.set(key, []);
        this.googleEventsMap.get(key)!.push(ev);
      });
      this.buildCalendar();
      if (this.notifPermission === 'granted') this.scheduleDeadlineReminders();
      this.cdr.markForCheck();
    });
  }

  // ── Clock ───────────────────────────────────────────────────────────────

  private startClock() {
    const tick = () => {
      const now = new Date();
      const s   = now.getSeconds();
      const m   = now.getMinutes() + s / 60;
      const h   = (now.getHours() % 12) + m / 60;
      this.secondDeg = s * 6;
      this.minuteDeg = m * 6;
      this.hourDeg   = h * 30;
      this.cdr.markForCheck();
    };
    tick();
    this.clockTimer = setInterval(tick, 1000);
  }

  // ── Task stats ──────────────────────────────────────────────────────────

  private loadStats() {
    this.isLoading = true;
    this.analyticsService.getStats(90).pipe(
      timeout(8000),
      catchError(() => {
        this.hasError  = true;
        this.isLoading = false;
        this.cdr.markForCheck();
        return of([] as UserStats[]);
      })
    ).subscribe(stats => {
      this.statsMap.clear();
      stats.forEach(s => {
        const key = s.date.slice(0, 10);
        this.statsMap.set(key, s);
      });
      this.isLoading = false;
      this.buildCalendar();
      this.cdr.markForCheck();
    });
  }

  // ── Calendar grid ───────────────────────────────────────────────────────

  buildCalendar() {
    const year  = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const cells: CalendarDay[] = [];

    for (let i = 0; i < first.getDay(); i++) {
      cells.push({ date: null, dayNum: null, stats: null, googleEvents: [], isToday: false, isCurrentMonth: false });
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const date    = new Date(year, month, d);
      const key     = this.isoKey(date);
      const isToday = this.isoKey(this.today) === key;
      cells.push({
        date,
        dayNum: d,
        stats:        this.statsMap.get(key) ?? null,
        googleEvents: this.googleEventsMap.get(key) ?? [],
        isToday,
        isCurrentMonth: true
      });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ date: null, dayNum: null, stats: null, googleEvents: [], isToday: false, isCurrentMonth: false });
      }
    }
    this.days = cells;
  }

  private isoKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  prevMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth() {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.buildCalendar();
  }

  get monthLabel(): string {
    const locale = this.langService.current === 'uk' ? 'uk-UA' : 'en-US';
    return this.viewDate.toLocaleString(locale, { month: 'long', year: 'numeric' });
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────

  onDayEnter(day: CalendarDay, event: MouseEvent) {
    if (!day.date) return;
    this.hoveredDay = day;
    this.positionTooltip(event);
    this.cdr.markForCheck();
  }

  onDayMove(event: MouseEvent) {
    this.positionTooltip(event);
  }

  onDayLeave() {
    this.hoveredDay = null;
    this.cdr.markForCheck();
  }

  private positionTooltip(e: MouseEvent) {
    this.tooltipX = e.clientX + 12;
    this.tooltipY = e.clientY - 10;
  }

  activityLevel(day: CalendarDay): string {
    if (!day.stats) return 'none';
    const s = day.stats.activityScore;
    if (s >= 8) return 'high';
    if (s >= 4) return 'mid';
    if (s >= 1) return 'low';
    return 'none';
  }

  // ── Google Calendar actions ──────────────────────────────────────────────

  connectGoogle() {
    this.googleConnecting = true;
    this.googleError      = '';
    this.cdr.markForCheck();

    this.googleService.getAuthUrl().subscribe({
      next: ({ url }) => {
        // Redirect in the same tab — Google returns back to /calendar?gcal=connected
        window.location.href = url;
      },
      error: (err) => {
        this.googleConnecting = false;
        this.googleError = err?.error?.error
          ?? 'Google OAuth is not configured. Please follow the setup instructions.';
        this.cdr.markForCheck();
      }
    });
  }

  syncNow() {
    this.googleSyncing = true;
    this.googleMessage = '';
    this.googleError   = '';
    this.cdr.markForCheck();

    this.googleService.syncTasks().subscribe({
      next: ({ synced }) => {
        this.googleSyncing = false;
        this.googleMessage = `✓ Synced ${synced} task${synced !== 1 ? 's' : ''} to Google Calendar.`;
        this.loadGoogleEvents();
        this.cdr.markForCheck();
      },
      error: () => {
        this.googleSyncing = false;
        this.googleError   = 'Sync failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  importFromGoogle() {
    this.googleImporting = true;
    this.googleMessage   = '';
    this.googleError     = '';
    this.cdr.markForCheck();

    this.googleService.importEvents().subscribe({
      next: ({ imported }) => {
        this.googleImporting = false;
        this.googleMessage = imported > 0
          ? `✓ Imported ${imported} event${imported !== 1 ? 's' : ''} as tasks.`
          : '✓ No new events to import (all events already exist as tasks).';
        this.cdr.markForCheck();
      },
      error: () => {
        this.googleImporting = false;
        this.googleError = 'Import failed. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  disconnectGoogle() {
    this.googleService.disconnect().subscribe({
      next: () => {
        this.googleConnected   = false;
        this.allGoogleEvents   = [];
        this.googleEventsMap.clear();
        this.googleMessage     = '';
        this.googleError       = '';
        this.buildCalendar();
        this.cdr.markForCheck();
      }
    });
  }

  // ── Upcoming events list ─────────────────────────────────────────────────

  get upcomingEvents(): GoogleEvent[] {
    const now = new Date().toISOString().slice(0, 10);
    return this.allGoogleEvents
      .filter(e => e.start && e.start.slice(0, 10) >= now)
      .slice(0, 8);
  }

  formatEventTime(dateStr: string | null): string {
    if (!dateStr) return '';
    if (dateStr.length === 10) return 'All day';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatEventDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
