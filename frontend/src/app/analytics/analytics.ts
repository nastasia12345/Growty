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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BoardService } from '../services/board';
import { TaskService } from '../services/task';

interface EnrichedTask {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  completedAt: string;
  boardId: number;
  boardTitle: string;
}

const PRIORITY_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
    MatProgressBarModule
  ],
  templateUrl: './analytics.html',
  styleUrls: ['./analytics.css']
})
export class AnalyticsComponent implements OnInit {
  isLoading = true;
  boards: any[] = [];
  allTasks: EnrichedTask[] = [];

  // ── Period selector ──────────────────────────────
  periods = [
    { label: 'Today',      value: 'today' },
    { label: 'This week',  value: 'week' },
    { label: 'This month', value: 'month' },
    { label: 'All time',   value: 'all' },
    { label: 'Custom',     value: 'custom' }
  ];
  activePeriod = 'week';
  customFrom = '';
  customTo   = '';

  // ── Table filters ────────────────────────────────
  tableSearch   = '';
  tableStatus   = 'all';
  tablePriority = 'all';
  tableBoard    = 'all';
  tableSortBy   = 'deadline_asc';

  sortOptions = [
    { label: 'Deadline ↑', value: 'deadline_asc' },
    { label: 'Deadline ↓', value: 'deadline_desc' },
    { label: 'Priority ↓', value: 'priority_desc' },
    { label: 'Priority ↑', value: 'priority_asc' },
    { label: 'Title A→Z',  value: 'title_asc' },
    { label: 'Board',      value: 'board' }
  ];

  constructor(
    private boardService: BoardService,
    private taskService: TaskService,
    private cdr: ChangeDetectorRef
  ) {}

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

  // ── Aggregate stats ──────────────────────────────
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

  // ── Completed tasks by period ────────────────────
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

  // ── All tasks table ──────────────────────────────
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

  // ══════════ PRODUCTIVITY INSIGHTS ALGORITHM ══════════

  /** Count completed tasks per day-of-week. Returns 7 entries Mon→Sun. */
  get dayOfWeekActivity(): { day: string; short: string; count: number; pct: number; isTop: boolean }[] {
    const shorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fulls  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    this.allTasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => counts[new Date(t.completedAt).getDay()]++);

    const max    = Math.max(...counts, 1);
    const topIdx = counts.indexOf(Math.max(...counts));

    return fulls.map((day, i) => ({
      day,
      short:  shorts[i],
      count:  counts[i],
      pct:    Math.round(counts[i] / max * 100),
      isTop:  i === topIdx && counts[i] > 0
    }));
  }

  get bestDay(): string {
    const data = this.dayOfWeekActivity;
    const top  = data.reduce((a, b) => b.count > a.count ? b : a, data[0]);
    return top.count > 0 ? top.day : '';
  }

  /** Count completed tasks per time-of-day slot. */
  get timeOfDayActivity(): { label: string; icon: string; range: string; hours: number[]; count: number; pct: number; isTop: boolean }[] {
    const slots = [
      { label: 'Morning',   icon: 'wb_sunny',    range: '6 AM – 11 AM',  hours: [6,7,8,9,10,11] },
      { label: 'Afternoon', icon: 'light_mode',  range: '12 PM – 4 PM',  hours: [12,13,14,15,16] },
      { label: 'Evening',   icon: 'nights_stay', range: '5 PM – 9 PM',   hours: [17,18,19,20,21] },
      { label: 'Night',     icon: 'bedtime',     range: '10 PM – 5 AM',  hours: [22,23,0,1,2,3,4,5] }
    ];
    const counts = slots.map(() => 0);

    this.allTasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => {
        const h   = new Date(t.completedAt).getHours();
        const idx = slots.findIndex(s => s.hours.includes(h));
        if (idx >= 0) counts[idx]++;
      });

    const max    = Math.max(...counts, 1);
    const topIdx = counts.indexOf(Math.max(...counts));

    return slots.map((s, i) => ({
      ...s,
      count: counts[i],
      pct:   Math.round(counts[i] / max * 100),
      isTop: i === topIdx && counts[i] > 0
    }));
  }

  get bestTimeSlot(): string {
    const data = this.timeOfDayActivity;
    const top  = data.reduce((a, b) => b.count > a.count ? b : a, data[0]);
    return top.count > 0 ? `${top.label} (${top.range})` : '';
  }

  /** Completion streak — consecutive calendar days with ≥1 completed task. */
  get streaks(): { current: number; best: number } {
    const done = this.allTasks.filter(t => t.status === 'Done' && t.completedAt);
    if (!done.length) return { current: 0, best: 0 };

    // Unique dates, sorted ascending
    const dateSet = new Set(done.map(t => {
      const d = new Date(t.completedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }));
    const dates = Array.from(dateSet).sort((a, b) => a - b).map(ms => new Date(ms));

    let best = 1, run = 1;
    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
      run  = diffDays === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }

    // Is the streak still alive? (last date was today or yesterday)
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const lastDate = dates[dates.length - 1];
    const gap      = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
    const current  = gap <= 1 ? run : 0;

    return { current, best };
  }

  /** Percentage of completed tasks that were finished before their deadline. */
  get onTimeRate(): number {
    const doneWithDeadline = this.allTasks.filter(t => t.status === 'Done' && t.completedAt && t.deadline);
    if (!doneWithDeadline.length) return 0;
    const onTime = doneWithDeadline.filter(t => new Date(t.completedAt) <= new Date(t.deadline)).length;
    return Math.round(onTime / doneWithDeadline.length * 100);
  }

  /** Weekday vs weekend productivity split. */
  get weekdayVsWeekend(): { weekday: number; weekend: number } {
    const done = this.allTasks.filter(t => t.status === 'Done' && t.completedAt);
    let weekday = 0, weekend = 0;
    done.forEach(t => {
      const dow = new Date(t.completedAt).getDay();
      (dow === 0 || dow === 6) ? weekend++ : weekday++;
    });
    return { weekday, weekend };
  }

  /** Personalised recommendation based on the computed patterns. */
  get smartRecommendation(): { icon: string; text: string } {
    const done = this.allTasks.filter(t => t.status === 'Done' && t.completedAt);

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
        text: `🔥 ${current}-day streak! Outstanding consistency. Your peak window is ${topDay.day} ${topSlot.label.toLowerCase()}s — protect that time.` };

    if (overduePct >= 30)
      return { icon: 'alarm',
        text: `${overduePct}% of your open tasks are overdue. Tackle them on ${topDay.day} ${topSlot.label.toLowerCase()}s — that's when you get the most done.` };

    if (ww.weekend > ww.weekday && ww.weekend > 0)
      return { icon: 'weekend',
        text: `You're a weekend warrior! ${ww.weekend} tasks completed on weekends vs ${ww.weekday} on weekdays. Consider planning hard tasks for Saturdays.` };

    if (this.onTimeRate >= 80)
      return { icon: 'verified',
        text: `You deliver ${this.onTimeRate}% of tasks on time — excellent discipline! Keep scheduling your heaviest work on ${topDay.day}s.` };

    if (best >= 3 && current === 0)
      return { icon: 'restart_alt',
        text: `You hit a ${best}-day streak before. ${topDay.day} ${topSlot.label.toLowerCase()}s are your sweet spot — try restarting your streak then!` };

    return { icon: 'psychology',
      text: `Your most productive time is ${topDay.day} ${topSlot.label.toLowerCase()}s. Schedule your Critical and High-priority tasks in that window!` };
  }

  // ── Helpers ──────────────────────────────────────
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

  statusLabel(s: string) {
    return s === 'ToDo' ? 'To Do' : s === 'InProgress' ? 'In Progress' : s;
  }

  exportCsv() {
    const rows = [
      ['Title', 'Board', 'Status', 'Priority', 'Deadline', 'Completed At'],
      ...this.filteredTasks.map(t => [
        `"${t.title}"`, `"${t.boardTitle}"`, t.status, t.priority,
        t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
        t.completedAt ? new Date(t.completedAt).toLocaleDateString() : ''
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `growty_tasks_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }
}
