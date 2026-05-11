import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AnalyticsService, UserStats } from '../../services/analytics';

interface CalendarDay {
  date: Date | null;
  dayNum: number | null;
  stats: UserStats | null;
  isToday: boolean;
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  viewDate = new Date();
  today    = new Date();
  days: CalendarDay[] = [];
  statsMap: Map<string, UserStats> = new Map();
  isLoading = true;
  hasError  = false;

  googleConnected = false;
  googleConnecting = false;

  hoveredDay: CalendarDay | null = null;
  tooltipX = 0;
  tooltipY = 0;

  // Clock hands
  secondDeg = 0;
  minuteDeg = 0;
  hourDeg   = 0;
  private clockTimer: any;

  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.startClock();
    this.loadStats();
  }

  ngOnDestroy() {
    clearInterval(this.clockTimer);
  }

  private startClock() {
    const tick = () => {
      const now  = new Date();
      const s    = now.getSeconds();
      const m    = now.getMinutes() + s / 60;
      const h    = (now.getHours() % 12) + m / 60;
      this.secondDeg = s * 6;
      this.minuteDeg = m * 6;
      this.hourDeg   = h * 30;
      this.cdr.markForCheck();
    };
    tick();
    this.clockTimer = setInterval(tick, 1000);
  }

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

  buildCalendar() {
    const year  = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const cells: CalendarDay[] = [];

    for (let i = 0; i < first.getDay(); i++) {
      cells.push({ date: null, dayNum: null, stats: null, isToday: false, isCurrentMonth: false });
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const date  = new Date(year, month, d);
      const key   = this.isoKey(date);
      const isToday = this.isoKey(this.today) === key;
      cells.push({ date, dayNum: d, stats: this.statsMap.get(key) ?? null, isToday, isCurrentMonth: true });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ date: null, dayNum: null, stats: null, isToday: false, isCurrentMonth: false });
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
    return this.viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

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

  private positionTooltip(event: MouseEvent) {
    this.tooltipX = event.clientX + 12;
    this.tooltipY = event.clientY - 10;
  }

  activityLevel(day: CalendarDay): string {
    if (!day.stats) return 'none';
    const score = day.stats.activityScore;
    if (score >= 8) return 'high';
    if (score >= 4) return 'mid';
    if (score >= 1) return 'low';
    return 'none';
  }

  connectGoogle() {
    const clientId    = 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = encodeURIComponent(window.location.origin + '/calendar');
    const scope       = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;
    window.open(url, '_blank', 'width=500,height=600');
  }
}
