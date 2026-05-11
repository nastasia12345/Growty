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
