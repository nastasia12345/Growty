import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { BoardService } from '../../services/board';
import { TaskService } from '../../services/task';
import { AIService, AISuggestion } from '../../services/ai';
import { AiSuggestionDialog } from '../ai-suggestion-dialog/ai-suggestion-dialog';

export interface FilterState {
  period: string;
  sortBy: string;
  sortDir: string;
  priority: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 4, High: 3, Medium: 2, Low: 1
};

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    DragDropModule
  ],
  templateUrl: './board-detail.html',
  styleUrls: ['./board-detail.css']
})
export class BoardDetailComponent implements OnInit {
  boardId: number = 0;
  board: any = null;
  tasks: any[] = [];
  isLoading: boolean = false;
  aiLoadingTaskId: number | null = null;

  // ── Filter & sort state ──────────────────────────
  filterPeriods = [
    { label: 'All',   value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Week',  value: 'week' },
    { label: 'Month', value: 'month' }
  ];

  sortOptions = [
    { label: 'Deadline ↑ (earliest first)', value: 'date_asc' },
    { label: 'Deadline ↓ (latest first)',   value: 'date_desc' },
    { label: 'Priority ↓ (Critical first)', value: 'priority_desc' },
    { label: 'Priority ↑ (Low first)',      value: 'priority_asc' },
    { label: 'Title A → Z',                 value: 'title_asc' },
    { label: 'Title Z → A',                 value: 'title_desc' }
  ];

  priorityFilters = [
    { label: 'All priorities', value: 'all' },
    { label: 'Critical',       value: 'Critical' },
    { label: 'High',           value: 'High' },
    { label: 'Medium',         value: 'Medium' },
    { label: 'Low',            value: 'Low' }
  ];

  activeFilter: string  = 'all';
  activeSortBy: string  = 'date_asc';
  activePriority: string = 'all';

  // ── Task form ────────────────────────────────────
  taskForm = {
    title: '', description: '', deadline: '',
    priority: 'Medium', status: 'ToDo'
  };
  editingTask: any = null;

  columns = [
    { name: 'To Do',       status: 'ToDo' },
    { name: 'In Progress', status: 'InProgress' },
    { name: 'Done',        status: 'Done' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private boardService: BoardService,
    private taskService: TaskService,
    private aiService: AIService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  // ── Lifecycle ────────────────────────────────────
  ngOnInit() {
    this.boardId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSavedFilters();
    this.loadBoard();
    this.loadTasks();
  }

  // ── localStorage helpers ─────────────────────────
  private storageKey(): string {
    return `growty_filters_board_${this.boardId}`;
  }

  loadSavedFilters() {
    try {
      const saved = localStorage.getItem(this.storageKey());
      if (saved) {
        const state: FilterState = JSON.parse(saved);
        this.activeFilter   = state.period   || 'all';
        this.activeSortBy   = state.sortBy   || 'date_asc';
        this.activePriority = state.priority || 'all';
      }
    } catch { /* ignore */ }
  }

  saveFilters() {
    const state: FilterState = {
      period:   this.activeFilter,
      sortBy:   this.activeSortBy,
      sortDir:  '',
      priority: this.activePriority
    };
    localStorage.setItem(this.storageKey(), JSON.stringify(state));
  }

  resetFilters() {
    this.activeFilter   = 'all';
    this.activeSortBy   = 'date_asc';
    this.activePriority = 'all';
    localStorage.removeItem(this.storageKey());
  }

  get hasActiveFilters(): boolean {
    return this.activeFilter !== 'all'
      || this.activeSortBy !== 'date_asc'
      || this.activePriority !== 'all';
  }

  get activeSortLabel(): string {
    return this.sortOptions.find(s => s.value === this.activeSortBy)?.label ?? '';
  }

  // ── Navigation ───────────────────────────────────
  goBack() { this.location.back(); }

  // ── Data loading ─────────────────────────────────
  loadBoard() {
    this.boardService.getBoard(this.boardId).subscribe({
      next: (data: any) => { this.board = data; },
      error: (err: any) => console.error('Board load error:', err)
    });
  }

  loadTasks() {
    this.taskService.getTasksByBoard(this.boardId).subscribe({
      next: (data: any[]) => { this.tasks = data; },
      error: (err: any) => console.error('Tasks load error:', err)
    });
  }

  // ── Filter + sort pipeline ───────────────────────
  getTasksByStatus(status: string): any[] {
    let result = this.tasks.filter(t => t.status === status);

    // 1. Period filter
    if (this.activeFilter !== 'all') {
      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      result = result.filter(task => {
        if (!task.deadline) return false;
        const dl = new Date(task.deadline);
        switch (this.activeFilter) {
          case 'today':
            return dl >= today && dl < new Date(today.getTime() + 86400000);
          case 'week':
            return dl >= today && dl <= new Date(today.getTime() + 7 * 86400000);
          case 'month':
            return dl >= today && dl <= new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          default: return true;
        }
      });
    }

    // 2. Priority filter
    if (this.activePriority !== 'all') {
      result = result.filter(t => t.priority === this.activePriority);
    }

    // 3. Sort
    result = [...result].sort((a, b) => {
      switch (this.activeSortBy) {
        case 'date_asc': {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        case 'date_desc': {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        }
        case 'priority_desc':
          return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        case 'priority_asc':
          return (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        default: return 0;
      }
    });

    return result;
  }

  setFilter(period: string) {
    this.activeFilter = period;
    this.saveFilters();
  }

  setSort(sortBy: string) {
    this.activeSortBy = sortBy;
    this.saveFilters();
  }

  setPriority(priority: string) {
    this.activePriority = priority;
    this.saveFilters();
  }

  clearFilters() {
    this.resetFilters();
  }

  getConnectedDropLists(): string[] {
    return this.columns.map(col => col.status);
  }

  // ── Drag & drop ──────────────────────────────────
  drop(event: any, newStatus: string) {
    const task = event.previousContainer.data[event.previousIndex];
    if (task && task.status !== newStatus) {
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => {
          task.status = newStatus;
          if (newStatus === 'Done') task.completedAt = new Date().toISOString();
          this.loadTasks();
        },
        error: (err: any) => console.error('Status update error:', err)
      });
    }
  }

  // ── Task CRUD ────────────────────────────────────
  openCreateTaskDialog() {
    this.editingTask = null;
    this.taskForm = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
  }

  editTask(task: any) {
    this.editingTask = task;
    this.taskForm = {
      title:       task.title,
      description: task.description || '',
      deadline:    task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
      priority:    task.priority,
      status:      task.status
    };
  }

  saveTask() {
    if (!this.taskForm.title.trim()) { alert('Enter task title'); return; }
    const payload = {
      ...this.taskForm,
      deadline: this.taskForm.deadline ? this.taskForm.deadline : null
    };
    if (this.editingTask) {
      this.taskService.updateTask(this.editingTask.id, payload).subscribe({
        next: () => { this.loadTasks(); this.resetForm(); },
        error: (err: any) => console.error('Update error:', err)
      });
    } else {
      this.taskService.createTask({ ...payload, boardId: this.boardId }).subscribe({
        next: () => { this.loadTasks(); this.resetForm(); },
        error: (err: any) => console.error('Create error:', err)
      });
    }
  }

  deleteTask(id: number) {
    if (confirm('Delete this task?')) {
      this.taskService.deleteTask(id).subscribe({
        next: () => this.loadTasks(),
        error: (err: any) => console.error('Delete error:', err)
      });
    }
  }

  resetForm() {
    this.editingTask = null;
    this.taskForm = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
  }

  // ── AI ───────────────────────────────────────────
  openAISuggestion(task: any) {
    this.aiLoadingTaskId = task.id;
    this.aiService.improveTask(task.id).subscribe({
      next: (suggestion: AISuggestion) => {
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
        const dialogRef = this.dialog.open(AiSuggestionDialog, {
          width: '700px', maxWidth: '95vw',
          data: { task, suggestion }
        });
        dialogRef.afterClosed().subscribe((result: any) => {
          if (result?.accepted) this.loadTasks();
        });
      },
      error: (err: any) => {
        console.error('AI error:', err);
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
        alert('Could not get AI suggestion. Try again later.');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────
  isOverdue(deadline: string): boolean {
    if (!deadline) return false;
    const d = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }

  isDueToday(deadline: string): boolean {
    if (!deadline) return false;
    const d = new Date(deadline);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  totalFiltered(): number {
    return this.columns.reduce((sum, col) => sum + this.getTasksByStatus(col.status).length, 0);
  }
}
