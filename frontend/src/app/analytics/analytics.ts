import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BoardService } from '../services/board';
import { LanguageService } from '../services/language.service';
import { TaskService } from '../services/task';
import {
  EnrichedTask,
  DayOfWeekInsightStrategy,
  TimeOfDayInsightStrategy,
  StreakInsightStrategy,
  OnTimeRateInsightStrategy,
  WeekdayWeekendInsightStrategy,
  PowerDaysInsightStrategy
} from './insight-strategies';

const PRIORITY_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
    MatProgressBarModule, MatChipsModule, TranslateModule
  ],
  templateUrl: './analytics.html',
  styleUrls: ['./analytics.css']
})
export class AnalyticsComponent implements OnInit {
  isLoading = true;
  boards: any[] = [];
  allTasks: EnrichedTask[] = [];

  // в"Ђв"Ђ Strategy instances (Context holds references to strategies) в"Ђв"Ђ
  private readonly dayOfWeekStrategy      = new DayOfWeekInsightStrategy();
  private readonly timeOfDayStrategy      = new TimeOfDayInsightStrategy();
  private readonly streakStrategy         = new StreakInsightStrategy();
  private readonly onTimeRateStrategy     = new OnTimeRateInsightStrategy();
  private readonly weekdayWeekendStrategy = new WeekdayWeekendInsightStrategy();
  private readonly powerDaysStrategy      = new PowerDaysInsightStrategy();

  // в"Ђв"Ђ Tab navigation в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  activeTab = 'overview';

  tabs = [
    { id: 'overview',  labelKey: 'analytics.overview',  icon: 'dashboard' },
    { id: 'insights',  labelKey: 'analytics.activity',  icon: 'psychology' },
    { id: 'tasks',     labelKey: 'analytics.tasks',     icon: 'task_alt' },
    { id: 'heatmap',   labelKey: 'analytics.heatmap',   icon: 'grid_view' }
  ];

  // в"Ђв"Ђ Completion trend chart в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  lineChartWindow = 30;
  lineChartWindowOptions = [
    { label: '7d',  days: 7  },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 }
  ]; // numbers — intentionally not translated

  // в"Ђв"Ђ Insights period filter в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  insightsPeriodDays = 0;  // 0 = all time
  insightsPeriodOptions = [
    { labelKey: 'analytics.periodAllTime',   days: 0   },
    { labelKey: 'analytics.period6months',   days: 180 },
    { labelKey: 'analytics.period3months',   days: 90  },
    { labelKey: 'analytics.periodLastMonth', days: 30  }
  ];

  // в"Ђв"Ђ Forecast window в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  forecastWindowDays = 14;
  forecastWindowOptions = [
    { label: '7d',  days: 7  },
    { label: '14d', days: 14 },
    { label: '30d', days: 30 }
  ]; // numbers — intentionally not translated

  // в"Ђв"Ђ Methodology panel в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  showMethodology = false;

  // в"Ђв"Ђ Period selector (Tasks tab) в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  periods = [
    { labelKey: 'calendar.today',             value: 'today'  },
    { labelKey: 'analytics.periodThisWeek',   value: 'week'   },
    { labelKey: 'analytics.periodThisMonth',  value: 'month'  },
    { labelKey: 'analytics.periodAllTime',    value: 'all'    },
    { labelKey: 'analytics.periodCustom',     value: 'custom' }
  ];
  activePeriod = 'week';
  customFrom = '';
  customTo   = '';

  // в"Ђв"Ђ Table filters в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  tableSearch   = '';
  tableStatus   = 'all';
  tablePriority = 'all';
  tableBoard    = 'all';
  tableSortBy   = 'deadline_asc';

  sortOptions = [
    { label: 'Deadline ASC',  value: 'deadline_asc'  },
    { label: 'Deadline DESC', value: 'deadline_desc' },
    { label: 'Priority DESC', value: 'priority_desc' },
    { label: 'Priority ASC',  value: 'priority_asc'  },
    { label: 'Title A-Z',     value: 'title_asc'     },
    { label: 'Board',         value: 'board'         }
  ];

  constructor(
    private boardService: BoardService,
    private taskService: TaskService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    public  langService: LanguageService
  ) {}

  get locale(): string { return this.langService.current; }

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading = true;
    this.boardService.getBoards().subscribe({
      next: (boards) => {
        this.boards = boards;
        if (!boards.length) { this.isLoading = false; return; }

        const requests = boards.map(b =>
          this.taskService.getTasksByBoard(b.id).pipe(catchError(() => of([])))
        );

        forkJoin(requests).subscribe({
          next: (results) => {
            this.allTasks = [];
            results.forEach((tasks: any[], i) => {
              tasks.forEach(t => {
                this.allTasks.push({ ...t, boardTitle: boards[i].title });
              });
            });
            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: () => { this.isLoading = false; }
        });
      },
      error: () => { this.isLoading = false; }
    });
  }

  // в"Ђв"Ђ Aggregate stats в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get total()      { return this.allTasks.length; }
  get totalDone()  { return this.allTasks.filter(t => t.status === 'Done').length; }
  get totalTodo()  { return this.allTasks.filter(t => t.status === 'ToDo').length; }
  get totalInProg(){ return this.allTasks.filter(t => t.status === 'InProgress').length; }
  get totalOverdue(){ return this.allTasks.filter(t => t.status !== 'Done' && this.isOverdue(t.deadline)).length; }
  get completionRate(){ return this.total > 0 ? Math.round(this.totalDone / this.total * 100) : 0; }

  priorityCount(p: string) { return this.allTasks.filter(t => t.priority === p).length; }

  boardStats(boardId: number) {
    const tasks = this.allTasks.filter(t => t.boardId === boardId);
    return {
      total: tasks.length,
      done: tasks.filter(t => t.status === 'Done').length,
      inProgress: tasks.filter(t => t.status === 'InProgress').length,
      todo: tasks.filter(t => t.status === 'ToDo').length,
      overdue: tasks.filter(t => t.status !== 'Done' && this.isOverdue(t.deadline)).length,
      rate: tasks.length > 0 ? Math.round(tasks.filter(t => t.status === 'Done').length / tasks.length * 100) : 0
    };
  }

  // в"Ђв"Ђ Insights period filter в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  /** Tasks used for all insight calculations вЂ" respects the Insights period selector */
  get insightTasks(): EnrichedTask[] {
    if (this.insightsPeriodDays === 0) return this.allTasks;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.insightsPeriodDays);
    return this.allTasks.filter(t => {
      const ref = t.completedAt ? new Date(t.completedAt) : null;
      return ref ? ref >= cutoff : true;
    });
  }

  // в"Ђв"Ђ Stat trends (compare last 30d vs prev 30d) в"Ђв"Ђв"Ђ
  get trendCompleted(): { value: string; dir: 'up' | 'down' | 'flat' } {
    const now  = new Date();
    const cut1 = new Date(now.getTime() - 30 * 86400000);
    const cut2 = new Date(now.getTime() - 60 * 86400000);
    const recent = this.allTasks.filter(t => t.status === 'Done' && t.completedAt && new Date(t.completedAt) >= cut1).length;
    const prev   = this.allTasks.filter(t => t.status === 'Done' && t.completedAt && new Date(t.completedAt) >= cut2 && new Date(t.completedAt) < cut1).length;
    if (prev === 0) return { value: recent > 0 ? `+${recent}` : 'вЂ"', dir: recent > 0 ? 'up' : 'flat' };
    const pct = Math.round((recent - prev) / prev * 100);
    return { value: pct >= 0 ? `+${pct}%` : `${pct}%`, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
  }

  get trendOverdue(): { value: string; dir: 'up' | 'down' | 'flat' } {
    const cur = this.totalOverdue;
    return cur === 0
      ? { value: 'вњ"', dir: 'flat' }
      : { value: `${cur}`, dir: 'down' };
  }

  // в"Ђв"Ђ Date range validation в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get dateRangeError(): string {
    if (this.activePeriod !== 'custom') return '';
    if (this.customFrom && this.customTo && new Date(this.customFrom) > new Date(this.customTo))
      return '"From" date must be before "To" date';
    return '';
  }

  // в"Ђв"Ђ Weekly bar chart data в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get weeklyBarData(): { label: string; count: number; pct: number; isCurrentWeek: boolean }[] {
    const today = new Date(); today.setHours(0,0,0,0);
    const weeks: { label: string; count: number; isCurrentWeek: boolean }[] = [];

    for (let w = this.HEATMAP_WEEKS - 1; w >= 0; w--) {
      const weekStart = new Date(today); weekStart.setDate(today.getDate() - (w * 7 + today.getDay() - 1));
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
      const count = this.allTasks.filter(t =>
        t.status === 'Done' && t.completedAt &&
        new Date(t.completedAt) >= weekStart && new Date(t.completedAt) <= weekEnd
      ).length;
      weeks.push({
        label: weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        count,
        isCurrentWeek: w === 0
      });
    }
    const max = Math.max(...weeks.map(w => w.count), 1);
    return weeks.map(w => ({ ...w, pct: Math.round(w.count / max * 100) }));
  }

  // в"Ђв"Ђ Monthly bar chart data в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get monthlyBarData(): { label: string; count: number; pct: number; isCurrentMonth: boolean }[] {
    const today = new Date();
    const months: { label: string; count: number; isCurrentMonth: boolean }[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const count = this.allTasks.filter(t =>
        t.status === 'Done' && t.completedAt &&
        new Date(t.completedAt) >= start && new Date(t.completedAt) <= end
      ).length;
      months.push({
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        count,
        isCurrentMonth: m === 0
      });
    }
    const max = Math.max(...months.map(m => m.count), 1);
    return months.map(m => ({ ...m, pct: Math.round(m.count / max * 100) }));
  }

  // в"Ђв"Ђ Completed tasks by period в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get completedInPeriod(): EnrichedTask[] {
    const done = this.allTasks.filter(t => t.status === 'Done' && t.completedAt);
    if (this.activePeriod === 'all') return done;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return done.filter(t => {
      const d = new Date(t.completedAt);
      switch (this.activePeriod) {
        case 'today':
          return d >= today;
        case 'week':
          return d >= new Date(today.getTime() - 6 * 86400000);
        case 'month':
          return d >= new Date(today.getFullYear(), today.getMonth(), 1);
        case 'custom':
          const from = this.customFrom ? new Date(this.customFrom) : null;
          const to   = this.customTo   ? new Date(this.customTo + 'T23:59:59') : null;
          if (from && d < from) return false;
          if (to   && d > to)   return false;
          return true;
        default: return true;
      }
    }).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  // в"Ђв"Ђ All tasks table в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  get filteredTasks(): EnrichedTask[] {
    let result = [...this.allTasks];

    if (this.tableSearch.trim()) {
      const q = this.tableSearch.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    if (this.tableStatus   !== 'all') result = result.filter(t => t.status   === this.tableStatus);
    if (this.tablePriority !== 'all') result = result.filter(t => t.priority === this.tablePriority);
    if (this.tableBoard    !== 'all') result = result.filter(t => t.boardId  === +this.tableBoard);

    return result.sort((a, b) => {
      switch (this.tableSortBy) {
        case 'deadline_asc':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1; if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'deadline_desc':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1; if (!b.deadline) return -1;
          return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        case 'priority_desc':
          return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        case 'priority_asc':
          return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'board':
          return a.boardTitle.localeCompare(b.boardTitle);
        default: return 0;
      }
    });
  }

  // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ PRODUCTIVITY INSIGHTS ALGORITHM в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

  get dayOfWeekActivity() { return this.dayOfWeekStrategy.compute(this.insightTasks); }

  get bestDay(): string {
    const data = this.dayOfWeekActivity;
    const top  = data.reduce((a, b) => b.count > a.count ? b : a, data[0]);
    return top.count > 0 ? top.day : '';
  }

  get timeOfDayActivity() { return this.timeOfDayStrategy.compute(this.insightTasks); }

  get bestTimeSlot(): string {
    const data = this.timeOfDayActivity;
    const top  = data.reduce((a, b) => b.count > a.count ? b : a, data[0]);
    return top.count > 0 ? `${top.label} (${top.range})` : '';
  }

  get streaks()         { return this.streakStrategy.compute(this.insightTasks); }
  get onTimeRate()      { return this.onTimeRateStrategy.compute(this.insightTasks); }
  get weekdayVsWeekend(){ return this.weekdayWeekendStrategy.compute(this.insightTasks); }

  /** Personalised recommendation based on the computed patterns. */
  get smartRecommendation(): { icon: string; text: string } {
    const done = this.insightTasks.filter(t => t.status === 'Done' && t.completedAt);

    if (done.length < 3) {
      return { icon: 'tips_and_updates',
        text: 'Complete a few more tasks to unlock personalised productivity insights!' };
    }

    const topDay  = this.dayOfWeekActivity.reduce((a, b) => b.count > a.count ? b : a);
    const topSlot = this.timeOfDayActivity.reduce((a, b)  => b.count > a.count ? b : a);
    const { current, best } = this.streaks;
    const overduePct = this.total > 0 ? Math.round(this.totalOverdue / this.total * 100) : 0;
    const ww = this.weekdayVsWeekend;

    if (current >= 5)
      return { icon: 'local_fire_department',
        text: `рџ"Ґ ${current}-day streak! Outstanding consistency. Your peak window is ${topDay.day} ${topSlot.label.toLowerCase()}s вЂ" protect that time.` };

    if (overduePct >= 30)
      return { icon: 'alarm',
        text: `${overduePct}% of your open tasks are overdue. Tackle them on ${topDay.day} ${topSlot.label.toLowerCase()}s вЂ" that's when you get the most done.` };

    if (ww.weekend > ww.weekday && ww.weekend > 0)
      return { icon: 'weekend',
        text: `You're a weekend warrior! ${ww.weekend} tasks completed on weekends vs ${ww.weekday} on weekdays. Consider planning hard tasks for Saturdays.` };

    if (this.onTimeRate >= 80)
      return { icon: 'verified',
        text: `You deliver ${this.onTimeRate}% of tasks on time вЂ" excellent discipline! Keep scheduling your heaviest work on ${topDay.day}s.` };

    if (best >= 3 && current === 0)
      return { icon: 'restart_alt',
        text: `You hit a ${best}-day streak before. ${topDay.day} ${topSlot.label.toLowerCase()}s are your sweet spot вЂ" try restarting your streak then!` };

    return { icon: 'psychology',
      text: `Your most productive time is ${topDay.day} ${topSlot.label.toLowerCase()}s. Schedule your Critical and High-priority tasks in that window!` };
  }

  // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ CAPACITY FORECAST ALGORITHM в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
  // Based on: RiskCoefficient = PlannedLoad / AvgProductivity
  // High risk > 1.3, Medium > 1.1, Low в‰¤ 1.1

  readonly HISTORY_DAYS = 30;  // history window for avg productivity

  // Priority weights for weighted load calculation
  private readonly PRIORITY_WEIGHT: Record<string, number> = {
    Critical: 2.0, High: 1.5, Medium: 1.0, Low: 0.5
  };

  get capacityForecast() {
    const FORECAST_DAYS = this.forecastWindowDays;
    const now           = new Date(); now.setHours(0, 0, 0, 0);
    const historyStart  = new Date(now.getTime() - this.HISTORY_DAYS * 86400000);
    const forecastEnd   = new Date(now.getTime() + FORECAST_DAYS * 86400000);

    // в"Ђв"Ђ Step 2: Load history в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    const completedInHistory = this.allTasks.filter(t =>
      t.status === 'Done' && t.completedAt &&
      new Date(t.completedAt) >= historyStart
    );

    // в"Ђв"Ђ Step 3: Average productivity (weighted tasks/day, scaled to forecast window)
    const totalWeight = completedInHistory.reduce(
      (sum, t) => sum + (this.PRIORITY_WEIGHT[t.priority] ?? 1.0), 0
    );
    // Weighted tasks per day, extrapolated to forecast window
    const avgProductivity = (totalWeight / this.HISTORY_DAYS) * FORECAST_DAYS;

    // в"Ђв"Ђ Step 4: Upcoming tasks with deadlines in forecast window в"Ђв"Ђ
    const upcomingTasks = this.allTasks
      .filter(t => {
        if (t.status === 'Done' || !t.deadline) return false;
        const dl = new Date(t.deadline); dl.setHours(0, 0, 0, 0);
        return dl >= now && dl <= forecastEnd;
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    // Planned load = weighted sum of upcoming tasks
    const plannedLoad = upcomingTasks.reduce(
      (sum, t) => sum + (this.PRIORITY_WEIGHT[t.priority] ?? 1.0), 0
    );

    // в"Ђв"Ђ Step 5: Risk coefficient в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    const riskCoefficient = avgProductivity > 0
      ? plannedLoad / avgProductivity
      : (plannedLoad > 0 ? 2.0 : 0);

    // в"Ђв"Ђ Step 6: Risk level classification в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    const isHigh   = riskCoefficient > 1.3;
    const isMedium = !isHigh && riskCoefficient > 1.1;
    const riskLevel = isHigh ? 'high' : isMedium ? 'medium' : 'low';

    // в"Ђв"Ђ Step 7: Build prediction в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
    const rawAvgPerDay   = completedInHistory.length / this.HISTORY_DAYS;
    const capacityRawPct = Math.round(riskCoefficient * 100);

    // Task-count version (unweighted) for human-readable text
    const upcomingCount  = upcomingTasks.length;
    const avgCountPeriod = Math.round(rawAvgPerDay * FORECAST_DAYS * 10) / 10;
    const surplus        = Math.round((plannedLoad - avgProductivity) * 10) / 10;

    let warning      = '';
    let prediction   = '';
    let suggestion   = '';

    if (isHigh) {
      warning    = `вљ пёЏ Overload detected вЂ" your planned workload is ${Math.round((riskCoefficient - 1) * 100)}% above your capacity.`;
      prediction = `You have ${upcomingCount} task${upcomingCount !== 1 ? 's' : ''} due in the next ${FORECAST_DAYS} days. Based on your history you typically complete ~${avgCountPeriod} tasks in this period.`;
      suggestion = `Consider rescheduling low-priority tasks or splitting large ones. Focus Critical and High items first.`;
    } else if (isMedium) {
      warning    = `рџ"‹ Slightly above capacity вЂ" manageable with good prioritisation.`;
      prediction = `You have ${upcomingCount} task${upcomingCount !== 1 ? 's' : ''} due in the next ${FORECAST_DAYS} days, slightly above your average of ~${avgCountPeriod}.`;
      suggestion = `Try to complete Medium and High tasks early in the week to avoid a last-minute crunch.`;
    } else {
      warning    = upcomingCount > 0
        ? `вњ… Workload is within your capacity вЂ" you're on track.`
        : `вњ… No tasks due in the next ${FORECAST_DAYS} days вЂ" great time to plan ahead.`;
      prediction = upcomingCount > 0
        ? `You have ${upcomingCount} task${upcomingCount !== 1 ? 's' : ''} due in the next ${FORECAST_DAYS} days, well within your average capacity of ~${avgCountPeriod}.`
        : `Your upcoming schedule is clear. Your average capacity is ~${avgCountPeriod} tasks per ${FORECAST_DAYS} days.`;
      suggestion = `Keep your current rhythm. You could take on ${Math.max(0, Math.round(avgCountPeriod - upcomingCount))} more tasks comfortably.`;
    }

    // Daily breakdown for the forecast chart
    const dailyMap: Record<string, { count: number; weight: number; tasks: any[] }> = {};
    for (let i = 0; i < FORECAST_DAYS; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { count: 0, weight: 0, tasks: [] };
    }
    upcomingTasks.forEach(t => {
      const key = new Date(t.deadline).toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].count++;
        dailyMap[key].weight += this.PRIORITY_WEIGHT[t.priority] ?? 1.0;
        dailyMap[key].tasks.push(t);
      }
    });

    const dailyBreakdown = Object.entries(dailyMap).map(([date, val]) => {
      const d = new Date(date);
      return {
        date,
        dayLabel: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayShort: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dateNum:  d.getDate(),
        ...val
      };
    });

    const maxDailyWeight = Math.max(...dailyBreakdown.map(d => d.weight), 1);

    return {
      historyDays:      this.HISTORY_DAYS,
      forecastDays:     FORECAST_DAYS,
      completedCount:   completedInHistory.length,
      avgProductivity:  Math.round(avgProductivity   * 10) / 10,
      avgCountPeriod,
      plannedLoad:      Math.round(plannedLoad        * 10) / 10,
      upcomingCount,
      upcomingTasks,
      riskCoefficient:  Math.round(riskCoefficient   * 100) / 100,
      capacityPct:      Math.min(capacityRawPct, 200),
      riskLevel,
      isHigh,
      isMedium,
      warning,
      prediction,
      suggestion,
      dailyBreakdown,
      maxDailyWeight,
      noHistory:        completedInHistory.length === 0
    };
  }

  // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ ACTIVITY HEATMAP в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
  // GitHub-style calendar: last 12 weeks, rows = Mon-Sun, cols = weeks

  readonly HEATMAP_WEEKS = 12;

  get activityHeatmap(): {
    weeks: { days: { date: string; count: number; level: number; label: string }[] }[];
    months: { label: string; colSpan: number }[];
    maxCount: number;
  } {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Start on the Monday of the week that is HEATMAP_WEEKS weeks ago
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - (this.HEATMAP_WEEKS * 7 - 1));
    // Align to Monday
    const dow = startDay.getDay(); // 0=Sun
    const diff = (dow === 0 ? -6 : 1 - dow);
    startDay.setDate(startDay.getDate() + diff);

    // Count completions per day
    const dailyCounts: Record<string, number> = {};
    this.allTasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => {
        const key = new Date(t.completedAt).toISOString().slice(0, 10);
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
      });

    const maxCount = Math.max(...Object.values(dailyCounts), 1);

    // Build week columns
    const weeks: { days: { date: string; count: number; level: number; label: string }[] }[] = [];
    const monthTracker: { label: string; col: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < this.HEATMAP_WEEKS; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDay);
        date.setDate(startDay.getDate() + w * 7 + d);
        if (date > today) {
          days.push({ date: '', count: 0, level: -1, label: '' });
          continue;
        }
        const key = date.toISOString().slice(0, 10);
        const count = dailyCounts[key] || 0;
        const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
        const label = `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' })}: ${count} task${count !== 1 ? 's' : ''}`;

        if (date.getMonth() !== lastMonth) {
          monthTracker.push({ label: date.toLocaleDateString('en-GB', { month: 'short' }), col: w });
          lastMonth = date.getMonth();
        }
        days.push({ date: key, count, level, label });
      }
      weeks.push({ days });
    }

    // Build month spans for header
    const months: { label: string; colSpan: number }[] = [];
    for (let i = 0; i < monthTracker.length; i++) {
      const next = monthTracker[i + 1];
      months.push({
        label: monthTracker[i].label,
        colSpan: next ? next.col - monthTracker[i].col : this.HEATMAP_WEEKS - monthTracker[i].col
      });
    }

    return { weeks, months, maxCount };
  }

  get heatmapTotalDays(): number {
    return this.allTasks.filter(t => {
      if (t.status !== 'Done' || !t.completedAt) return false;
      const d = new Date(t.completedAt);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - this.HEATMAP_WEEKS * 7);
      return d >= cutoff;
    }).length;
  }

  get heatmapActiveDays(): number {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - this.HEATMAP_WEEKS * 7);
    const dateSet = new Set(
      this.allTasks
        .filter(t => t.status === 'Done' && t.completedAt && new Date(t.completedAt) >= cutoff)
        .map(t => new Date(t.completedAt).toISOString().slice(0, 10))
    );
    return dateSet.size;
  }

  // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ LINE CHART вЂ" daily completion trend в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

  // SVG plot area shared by both charts: x 40вЂ"590 (W=550), y 20вЂ"130 (H=110)
  private readonly CHART_PAD_L = 40;
  private readonly CHART_W     = 550;
  private readonly CHART_PAD_T = 20;
  private readonly CHART_H     = 110;
  private readonly CHART_BASE  = 130; // padT + H

  private chartX(i: number, n: number): number {
    return this.CHART_PAD_L + (n > 1 ? (i / (n - 1)) * this.CHART_W : this.CHART_W / 2);
  }
  private chartY(value: number, max: number): number {
    return this.CHART_PAD_T + this.CHART_H - (value / max) * this.CHART_H;
  }

  get lineChartData(): { label: string; count: number; x: number; y: number }[] {
    const days = this.lineChartWindow;
    const result: { label: string; count: number; x: number; y: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      const count = this.allTasks.filter(t =>
        t.status === 'Done' && t.completedAt &&
        new Date(t.completedAt) >= d && new Date(t.completedAt) <= end
      ).length;
      result.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count, x: 0, y: 0 });
    }

    const max = Math.max(...result.map(d => d.count), 1);
    const n   = result.length;
    return result.map((d, i) => ({ ...d, x: this.chartX(i, n), y: this.chartY(d.count, max) }));
  }

  get lineChartMax(): number {
    return Math.max(...this.lineChartData.map(d => d.count), 1);
  }
  get lineChartYMid(): number { return Math.round(this.lineChartMax / 2); }

  get lineChartPolyline(): string {
    return this.lineChartData.map(d => `${d.x},${d.y}`).join(' ');
  }
  get lineChartArea(): string {
    const data = this.lineChartData;
    if (!data.length) return '';
    return `${data[0].x},${this.CHART_BASE} ${data.map(d => `${d.x},${d.y}`).join(' ')} ${data[data.length - 1].x},${this.CHART_BASE}`;
  }
  get lineChartXLabels(): { label: string; x: number }[] {
    const data = this.lineChartData;
    if (data.length < 2) return [];
    const count = Math.min(7, data.length);
    const step  = (data.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.min(Math.round(i * step), data.length - 1);
      return { label: data[idx].label, x: data[idx].x };
    });
  }

  // в"Ђв"Ђ Distribution chart (forecast window, task load per day) в"Ђв"Ђ
  get distributionChartData(): { x: number; y: number; count: number; label: string; dayShort: string; dateNum: number }[] {
    const fc  = this.capacityForecast;
    const bd  = fc.dailyBreakdown;
    const max = Math.max(fc.maxDailyWeight, 1);
    const n   = bd.length;
    return bd.map((d: any, i: number) => ({
      x:        this.chartX(i, n),
      y:        this.chartY(d.weight, max),
      count:    d.count,
      label:    d.dayLabel  || '',
      dayShort: d.dayShort  || '',
      dateNum:  d.dateNum   || 0
    }));
  }
  get distributionPolyline(): string {
    return this.distributionChartData.map(d => `${d.x},${d.y}`).join(' ');
  }
  get distributionArea(): string {
    const data = this.distributionChartData;
    if (!data.length) return '';
    return `${data[0].x},${this.CHART_BASE} ${data.map(d => `${d.x},${d.y}`).join(' ')} ${data[data.length - 1].x},${this.CHART_BASE}`;
  }
  get distributionXLabels(): { label: string; x: number }[] {
    const data = this.distributionChartData;
    if (data.length < 2) return [];
    const count = Math.min(7, data.length);
    const step  = (data.length - 1) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const idx  = Math.min(Math.round(i * step), data.length - 1);
      const d    = data[idx];
      return { label: `${d.dayShort} ${d.dateNum}`, x: d.x };
    });
  }
  get distributionMax(): number {
    return Math.max(...this.distributionChartData.map(d => d.count), 1);
  }
  get distributionYMid(): number { return Math.round(this.distributionMax / 2); }

  // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ POWER DAYS в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
  get powerDays() { return this.powerDaysStrategy.compute(this.insightTasks); }

  // в"Ђв"Ђ Helpers в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  isOverdue(deadline: string): boolean {
    if (!deadline) return false;
    const d = new Date(deadline); d.setHours(0, 0, 0, 0);
    const t = new Date();         t.setHours(0, 0, 0, 0);
    return d < t;
  }

  isDueToday(deadline: string): boolean {
    if (!deadline) return false;
    return new Date(deadline).toDateString() === new Date().toDateString();
  }

  statusLabel(s: string): string {
    if (s === 'ToDo')       return this.translate.instant('board.todo');
    if (s === 'InProgress') return this.translate.instant('board.inProgress');
    if (s === 'Done')       return this.translate.instant('board.done');
    return s;
  }

  priorityLabel(p: string): string {
    if (p === 'High')   return this.translate.instant('board.high');
    if (p === 'Medium') return this.translate.instant('board.medium');
    if (p === 'Low')    return this.translate.instant('board.low');
    return p;
  }

  // в"Ђв"Ђ Excel export period в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  isExporting = false;
  xlsExportPeriod = 'all';
  xlsExportFrom   = '';
  xlsExportTo     = '';

  xlsPeriodOptions = [
    { labelKey: 'analytics.periodAllTime',   value: 'all'     },
    { labelKey: 'analytics.periodThisWeek',  value: 'week'    },
    { labelKey: 'analytics.periodThisMonth', value: 'month'   },
    { labelKey: 'analytics.period3months',   value: '3months' },
    { labelKey: 'analytics.period6months',   value: '6months' },
    { labelKey: 'analytics.periodCustom',    value: 'custom'  },
  ];

  get xlsPeriodLabel(): string {
    const t = (k: string) => this.translate.instant(k);
    const map: Record<string, string> = {
      all:      t('analytics.periodAllTime'),
      week:     t('analytics.periodThisWeek'),
      month:    t('analytics.periodThisMonth'),
      '3months': t('analytics.period3monthsLong'),
      '6months': t('analytics.period6monthsLong'),
      custom: (this.xlsExportFrom || this.xlsExportTo)
        ? `${this.xlsExportFrom || '…'} → ${this.xlsExportTo || '…'}`
        : t('analytics.periodCustomRange')
    };
    return map[this.xlsExportPeriod] ?? t('analytics.periodAllTime');
  }

  /** Done tasks filtered by completedAt in the chosen period + all active tasks */
  get xlsFilteredTasks(): EnrichedTask[] {
    const active = this.allTasks.filter(t => t.status !== 'Done');
    const done   = this.allTasks.filter(t => t.status === 'Done');
    if (this.xlsExportPeriod === 'all') return this.allTasks;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let from: Date | null = null;
    let to:   Date | null = null;

    switch (this.xlsExportPeriod) {
      case 'week':    from = new Date(today.getTime() - 6 * 86400000); break;
      case 'month':   from = new Date(today.getFullYear(), today.getMonth(), 1); break;
      case '3months': from = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()); break;
      case '6months': from = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()); break;
      case 'custom':
        from = this.xlsExportFrom ? new Date(this.xlsExportFrom) : null;
        to   = this.xlsExportTo   ? new Date(this.xlsExportTo + 'T23:59:59') : null;
        break;
    }

    const filteredDone = done.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });

    return [...active, ...filteredDone];
  }

  // в"Ђв"Ђ Excel report в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
  async generateExcelReport() {
    this.isExporting = true;
    try {
      const { Workbook } = await import('exceljs');
      const wb  = new Workbook();
      wb.creator = 'Growty';
      wb.created = new Date();

      const now     = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const tasks   = this.xlsFilteredTasks;
      const period  = this.xlsPeriodLabel;

      // ARGB colour palette
      const C = {
        green:   'FF10B981', dark:    'FF0F172A', gray:    'FF64748B',
        light:   'FFF8FAFC', white:   'FFFFFFFF', red:     'FFEF4444',
        amber:   'FFF59E0B', border:  'FFE2E8F0',
        greenBg: 'FFD1FAE5', redBg:   'FFFEE2E2', amberBg: 'FFFEF3C7',
        grayBg:  'FFF1F5F9',
      };

      // в"Ђв"Ђ helpers в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
      const hdr = (row: any, bg = C.green) => {
        row.height = 28;
        row.eachCell((cell: any) => {
          cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font      = { bold: true, color: { argb: C.white }, size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
          cell.border    = { bottom: { style: 'thin', color: { argb: C.border } } };
        });
      };

      const section = (ws: any, label: string, cols: number) => {
        const row = ws.addRow([label]);
        ws.mergeCells(`A${row.number}:${colLetter(cols)}${row.number}`);
        row.getCell(1).value = label;
        row.getCell(1).font  = { bold: true, color: { argb: C.dark }, size: 10 };
        row.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
        row.getCell(1).alignment = { indent: 1, vertical: 'middle' };
        row.height = 22;
      };

      const colLetter = (n: number) =>
        n <= 26 ? String.fromCharCode(64 + n) : 'A' + String.fromCharCode(64 + n - 26);

      const altFill = (row: any, idx: number, skipCols: number[] = []) => {
        if (idx % 2 === 0) return;
        row.eachCell((cell: any, col: number) => {
          if (!skipCols.includes(col))
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };
        });
      };

      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      //  SHEET 1 вЂ" SUMMARY
      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      const ws1 = wb.addWorksheet('Summary', { properties: { tabColor: { argb: C.green } } });
      ws1.columns = [
        { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }
      ];

      // Title
      ws1.mergeCells('A1:F1');
      Object.assign(ws1.getCell('A1'), {
        value: 'Growty вЂ" Analytics Report',
        font:      { bold: true, color: { argb: C.white }, size: 15 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.green } },
        alignment: { vertical: 'middle', indent: 1 },
      });
      ws1.getRow(1).height = 38;

      // Meta row
      ws1.mergeCells('A2:D2');
      ws1.mergeCells('E2:F2');
      ws1.getCell('A2').value = `Period: ${period}`;
      ws1.getCell('A2').font  = { italic: true, color: { argb: C.gray } };
      ws1.getCell('E2').value = `Generated: ${dateStr}`;
      ws1.getCell('E2').font  = { italic: true, color: { argb: C.gray } };
      ws1.getCell('E2').alignment = { horizontal: 'right' };
      ws1.getRow(2).height = 20;
      ws1.addRow([]);

      // KPI block
      section(ws1, 'OVERVIEW', 6);
      const kpiHdr = ws1.addRow(['Metric', 'Total', 'Done', 'In Progress', 'To Do', 'Overdue']);
      hdr(kpiHdr);

      const done   = tasks.filter(t => t.status === 'Done').length;
      const inProg = tasks.filter(t => t.status === 'InProgress').length;
      const todo   = tasks.filter(t => t.status === 'ToDo').length;
      const ov     = tasks.filter(t => t.status !== 'Done' && this.isOverdue(t.deadline)).length;
      const rate   = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;

      const kpiVals = ws1.addRow(['Tasks', tasks.length, done, inProg, todo, ov]);
      kpiVals.height = 26;
      const kpiColors = [C.dark, C.dark, C.green, C.amber, C.gray, C.red];
      kpiVals.eachCell((cell: any, col: number) => {
        cell.font      = { bold: col > 1, size: col > 1 ? 14 : 10, color: { argb: kpiColors[col - 1] } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      });

      ws1.mergeCells(`B${ws1.rowCount + 1}:F${ws1.rowCount + 1}`);
      const rateRow = ws1.addRow(['Completion Rate', `${rate}%`]);
      ws1.mergeCells(`B${rateRow.number}:F${rateRow.number}`);
      rateRow.getCell(1).font = { color: { argb: C.gray } };
      rateRow.getCell(2).font = { bold: true, size: 12, color: { argb: rate >= 66 ? C.green : rate >= 33 ? C.amber : C.red } };
      rateRow.height = 22;
      ws1.addRow([]);

      // Activity block
      section(ws1, 'ACTIVITY', 6);
      const actHdr = ws1.addRow(['Metric', 'Value', 'Note']);
      ws1.mergeCells(`C${actHdr.number}:F${actHdr.number}`);
      hdr(actHdr);

      const st  = this.streaks;
      const ww  = this.weekdayVsWeekend;
      const td  = this.dayOfWeekActivity.reduce((a, b) => b.count > a.count ? b : a);
      const ts  = this.timeOfDayActivity.reduce((a, b)  => b.count > a.count ? b : a);
      const acts: [string, string, string][] = [
        ['Current streak',    `${st.current} days`,   st.current > 0 ? 'рџ"Ґ Keep it going' : 'Start today!'],
        ['Best streak',       `${st.best} days`,      ''],
        ['On-time rate',      `${this.onTimeRate}%`,  this.onTimeRate >= 80 ? 'Excellent' : this.onTimeRate >= 60 ? 'Good' : 'Improve'],
        ['Active days',       `${this.heatmapActiveDays}`, 'last 12 weeks'],
        ['Most active day',   td.count > 0 ? td.day  : 'вЂ"', td.count > 0 ? `${td.count} tasks` : ''],
        ['Best time slot',    ts.count > 0 ? `${ts.label} (${ts.range})` : 'вЂ"', ''],
        ['Weekday / Weekend', `${ww.weekday} / ${ww.weekend}`, 'completions'],
      ];
      acts.forEach(([m, v, n], i) => {
        const r = ws1.addRow([m, v, n]);
        ws1.mergeCells(`C${r.number}:F${r.number}`);
        r.getCell(1).font = { color: { argb: C.gray } };
        r.getCell(2).font = { bold: true, color: { argb: C.dark } };
        r.getCell(3).font = { italic: true, color: { argb: C.gray } };
        r.height = 20;
        altFill(r, i);
      });
      ws1.addRow([]);

      // Capacity forecast
      const fc = this.capacityForecast;
      if (!fc.noHistory) {
        section(ws1, 'CAPACITY FORECAST', 6);
        const fcHdr = ws1.addRow(['Metric', 'Value', 'Details']);
        ws1.mergeCells(`C${fcHdr.number}:F${fcHdr.number}`);
        hdr(fcHdr);

        const riskColor = fc.isHigh ? C.red : fc.isMedium ? C.amber : C.green;
        const riskBg    = fc.isHigh ? C.redBg : fc.isMedium ? C.amberBg : C.greenBg;
        const fcRows: [string, string, string][] = [
          ['Risk level',      fc.isHigh ? 'HIGH' : fc.isMedium ? 'MEDIUM' : 'LOW', fc.warning.replace(/\p{Emoji}/gu, '').trim()],
          ['Risk coefficient',`${fc.riskCoefficient}`,  'PlannedLoad / AvgCapacity'],
          ['Avg capacity',    `${fc.avgCountPeriod}`,   `tasks per ${fc.forecastDays} days`],
          ['Upcoming tasks',  `${fc.upcomingCount}`,    `due in next ${fc.forecastDays} days`],
          ['Suggestion',      '',                        fc.suggestion],
        ];
        fcRows.forEach(([m, v, n], i) => {
          const r = ws1.addRow([m, v, n]);
          ws1.mergeCells(`C${r.number}:F${r.number}`);
          r.getCell(1).font = { color: { argb: C.gray } };
          r.getCell(2).font = { bold: true, color: { argb: i === 0 ? riskColor : C.dark } };
          if (i === 0) r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riskBg } };
          r.getCell(3).font = { italic: true, color: { argb: C.gray } };
          r.height = 20;
          altFill(r, i, [2]);
        });
      }

      ws1.views = [{ state: 'frozen', ySplit: 1 }];

      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      //  SHEET 2 вЂ" TASKS
      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      const ws2 = wb.addWorksheet('Tasks', { properties: { tabColor: { argb: 'FF6366F1' } } });
      ws2.columns = [
        { key: 'title',       width: 42 },
        { key: 'board',       width: 24 },
        { key: 'status',      width: 16 },
        { key: 'priority',    width: 14 },
        { key: 'deadline',    width: 16 },
        { key: 'completed',   width: 16 },
        { key: 'description', width: 38 },
      ];

      ws2.mergeCells('A1:G1');
      Object.assign(ws2.getCell('A1'), {
        value: `Tasks вЂ" ${period}  (${tasks.length})`,
        font:      { bold: true, color: { argb: C.white }, size: 12 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.green } },
        alignment: { vertical: 'middle', indent: 1 },
      });
      ws2.getRow(1).height = 32;

      const t2Hdr = ws2.addRow(['Task', 'Board', 'Status', 'Priority', 'Deadline', 'Completed At', 'Description']);
      hdr(t2Hdr);
      ws2.views = [{ state: 'frozen', ySplit: 2 }];
      ws2.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 7 } };

      const statusFg:  Record<string,string> = { Done: C.green, InProgress: C.amber, ToDo: C.gray };
      const statusBg:  Record<string,string> = { Done: C.greenBg, InProgress: C.amberBg, ToDo: C.grayBg };
      const priColor:  Record<string,string> = { High: C.red, Medium: C.amber, Low: C.green };
      const priBg:     Record<string,string> = { High: C.redBg, Medium: C.amberBg, Low: C.greenBg };

      tasks.forEach((t, idx) => {
        const r = ws2.addRow([
          t.title,
          t.boardTitle,
          this.statusLabel(t.status),
          t.priority ?? 'вЂ"',
          t.deadline    ? new Date(t.deadline).toLocaleDateString('en-GB')    : 'вЂ"',
          t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-GB') : 'вЂ"',
          t.description ?? '',
        ]);
        r.height = 20;
        r.eachCell((cell: any) => {
          cell.alignment = { vertical: 'middle' };
          cell.border    = { bottom: { style: 'hair', color: { argb: C.border } } };
        });
        altFill(r, idx);

        // Status cell
        const sc = r.getCell(3);
        if (statusFg[t.status]) {
          sc.font      = { bold: true, color: { argb: statusFg[t.status] } };
          sc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg[t.status] } };
          sc.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        // Priority cell
        const pc = r.getCell(4);
        if (t.priority && priColor[t.priority]) {
          pc.font      = { bold: true, color: { argb: priColor[t.priority] } };
          pc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: priBg[t.priority] } };
          pc.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        // Overdue deadline
        if (t.status !== 'Done' && this.isOverdue(t.deadline)) {
          const dc = r.getCell(5);
          dc.font = { bold: true, color: { argb: C.red } };
          dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
        }
      });

      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      //  SHEET 3 вЂ" BOARDS
      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      const ws3 = wb.addWorksheet('Boards', { properties: { tabColor: { argb: 'FF8B5CF6' } } });
      ws3.columns = [
        { width: 38 }, { width: 12 }, { width: 12 }, { width: 16 },
        { width: 12 }, { width: 12 }, { width: 12 },
      ];
      ws3.mergeCells('A1:G1');
      Object.assign(ws3.getCell('A1'), {
        value: 'Boards Overview',
        font:      { bold: true, color: { argb: C.white }, size: 12 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.green } },
        alignment: { vertical: 'middle', indent: 1 },
      });
      ws3.getRow(1).height = 32;

      const b3Hdr = ws3.addRow(['Board', 'Total', 'Done', 'In Progress', 'To Do', 'Overdue', 'Done %']);
      hdr(b3Hdr);
      ws3.views    = [{ state: 'frozen', ySplit: 2 }];
      ws3.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 7 } };

      this.boards.forEach((b, idx) => {
        const s = this.boardStats(b.id);
        const r = ws3.addRow([b.title, s.total, s.done, s.inProgress, s.todo, s.overdue, `${s.rate}%`]);
        r.height = 22;
        r.getCell(1).font = { bold: true, color: { argb: C.dark } };
        r.eachCell((cell: any, col: number) => {
          cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
          cell.border    = { bottom: { style: 'hair', color: { argb: C.border } } };
        });
        altFill(r, idx);
        // Rate colour
        const rateColor = s.rate >= 66 ? C.green : s.rate >= 33 ? C.amber : C.red;
        r.getCell(7).font = { bold: true, color: { argb: rateColor } };
        // Overdue
        if (s.overdue > 0) {
          r.getCell(6).font = { bold: true, color: { argb: C.red } };
          r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.redBg } };
        }
      });

      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      //  SHEET 4 вЂ" POWER DAYS  (only if data exists)
      // в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
      const pds = this.powerDays;
      if (pds.length > 0) {
        const ws4 = wb.addWorksheet('Power Days', { properties: { tabColor: { argb: 'FFF59E0B' } } });
        ws4.columns = [{ width: 8 }, { width: 18 }, { width: 22 }, { width: 18 }];

        ws4.mergeCells('A1:D1');
        Object.assign(ws4.getCell('A1'), {
          value: 'Power Days вЂ" Top Productivity Windows',
          font:      { bold: true, color: { argb: C.white }, size: 12 },
          fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amber } },
          alignment: { vertical: 'middle', indent: 1 },
        });
        ws4.getRow(1).height = 32;

        const pd4Hdr = ws4.addRow(['Rank', 'Day', 'Time Slot', 'Tasks Completed']);
        hdr(pd4Hdr, C.amber);

        pds.forEach((pd: any, idx: number) => {
          const r = ws4.addRow([pd.rank, pd.day, pd.slot, pd.count]);
          r.height = 22;
          r.eachCell((cell: any, col: number) => {
            cell.alignment = { vertical: 'middle', horizontal: col === 1 || col === 4 ? 'center' : 'left' };
            cell.border    = { bottom: { style: 'hair', color: { argb: C.border } } };
          });
          if (idx === 0) {
            r.eachCell((cell: any) => {
              cell.font = { bold: true, color: { argb: C.amber } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amberBg } };
            });
          } else {
            altFill(r, idx);
          }
        });
      }

      // в"Ђв"Ђ Write & download в"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђв"Ђ
      const buf  = await wb.xlsx.writeBuffer() as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `growty-analytics-${now.toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);

    } catch (err) {
      console.error('Excel generation failed:', err);
    } finally {
      this.isExporting = false;
      this.cdr.detectChanges();
    }
  }

  // export period selector (Tasks tab)
  exportPeriod = 'filtered'; // 'filtered' | 'all' | 'custom'
  exportFrom = '';
  exportTo   = '';

  get exportableTasks(): EnrichedTask[] {
    if (this.exportPeriod === 'filtered') return this.filteredTasks;
    if (this.exportPeriod === 'all')      return this.allTasks;
    // custom date range on completedAt or createdAt
    return this.allTasks.filter(t => {
      const date = t.completedAt ? new Date(t.completedAt) : null;
      const from = this.exportFrom ? new Date(this.exportFrom) : null;
      const to   = this.exportTo   ? new Date(this.exportTo + 'T23:59:59') : null;
      if (!date) return false;
      if (from && date < from) return false;
      if (to   && date > to)   return false;
      return true;
    });
  }

  exportCsv() {
    const tasks = this.exportableTasks;
    const now = new Date().toISOString().slice(0, 10);
    const periodLabel = this.exportPeriod === 'custom'
      ? `${this.exportFrom || 'start'}вЂ"${this.exportTo || 'now'}`
      : this.exportPeriod;

    const done      = tasks.filter(t => t.status === 'Done').length;
    const inProg    = tasks.filter(t => t.status === 'InProgress').length;
    const todo      = tasks.filter(t => t.status === 'ToDo').length;
    const overdue   = tasks.filter(t => t.status !== 'Done' && this.isOverdue(t.deadline)).length;
    const onTime    = tasks.filter(t => t.status === 'Done' && t.completedAt && t.deadline
                        && new Date(t.completedAt) <= new Date(t.deadline)).length;
    const rate      = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;

    const rows: string[][] = [
      // в"Ђв"Ђ Header block в"Ђв"Ђ
      [`Growty Export вЂ" ${periodLabel} вЂ" generated ${now}`],
      [],
      ['SUMMARY'],
      ['Total tasks', String(tasks.length)],
      ['Completed',   String(done)],
      ['In Progress', String(inProg)],
      ['To Do',       String(todo)],
      ['Overdue',     String(overdue)],
      ['On-time rate',`${onTime} / ${done} (${rate}%)`],
      [],
      // в"Ђв"Ђ Tasks table в"Ђв"Ђ
      ['Title','Board','Status','Priority','Deadline','Completed At','Created At','On Time'],
      ...tasks.map(t => {
        const onTimeFlag = t.status === 'Done' && t.completedAt && t.deadline
          ? (new Date(t.completedAt) <= new Date(t.deadline) ? 'Yes' : 'No')
          : '';
        return [
          `"${(t.title || '').replace(/"/g,'""')}"`,
          `"${(t.boardTitle || '').replace(/"/g,'""')}"`,
          t.status,
          t.priority || '',
          t.deadline    ? new Date(t.deadline).toLocaleDateString('en-GB')    : '',
          t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-GB') : '',
          '',
          onTimeFlag
        ];
      })
    ];

    const csv = rows.map(r => r.join(',')).join('\r\n');
    const bom = 'п»ї'; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `growty_export_${now}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }
}
