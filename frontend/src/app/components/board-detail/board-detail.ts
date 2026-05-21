import { Component, OnInit, AfterViewChecked, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BoardService } from '../../services/board';
import { TaskService } from '../../services/task';
import { AIService, AISuggestion } from '../../services/ai';
import { AiSuggestionDialog } from '../ai-suggestion-dialog/ai-suggestion-dialog';
import { LanguageService } from '../../services/language.service';

const PRIORITY_ORDER: Record<string, number> = {
  High: 3, Medium: 2, Low: 1
};

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSidenavModule,
    MatTooltipModule, MatMenuModule, MatChipsModule,
    MatProgressBarModule, DragDropModule, TranslateModule
  ],
  templateUrl: './board-detail.html',
  styleUrls: ['./board-detail.css']
})
export class BoardDetailComponent implements OnInit, AfterViewChecked, OnDestroy {
  boardId: number = 0;
  board: any = null;
  tasks: any[] = [];
  isLoading: boolean = false;
  aiLoadingTaskId: number | null = null;

  // Pre-computed stable task lists for CDK drop lists
  todoTasks:       any[] = [];
  inProgressTasks: any[] = [];
  doneTasks:       any[] = [];

  // Search
  taskSearch = '';

  // Delete confirmation overlay (styled, no browser confirm())
  deleteConfirm: { show: boolean; taskId: number; taskTitle: string } = {
    show: false, taskId: 0, taskTitle: ''
  };

  // Form validation errors
  formErrors: { title: string; deadline: string } = { title: '', deadline: '' };

  // View mode
  viewMode: 'kanban' | 'pipeline' = 'kanban';
  private pipelineScrolled = false;

  // ── Gantt / Pipeline ─────────────────────────────────────
  @ViewChild('ganttScroll') ganttScrollRef!: ElementRef;
  readonly DAY_W   = 52;
  readonly LABEL_W = 180;
  pipelineDays: Date[] = [];
  dayIndexMap = new Map<string, number>();

  // Resize state
  resizingTask: any          = null;
  resizeStartX               = 0;
  resizeOrigDeadline         = new Date();
  private readonly _onMove   = (e: MouseEvent) => this.onResizeMove(e);
  private readonly _onUp     = ()               => this.onResizeUp();

  // Filter state
  priorityFilters = [
    { labelKey: 'analytics.allPriorities', value: 'all'    },
    { labelKey: 'board.high',              value: 'High'   },
    { labelKey: 'board.medium',            value: 'Medium' },
    { labelKey: 'board.low',               value: 'Low'    }
  ];

  activePriority: string = 'all';

  // Task form
  taskForm = {
    title: '', description: '',
    priority: 'Medium', status: 'ToDo'
  };
  deadlineDate: Date | null = null;
  editingTask: any = null;

  // Checklist
  checklist: { text: string; done: boolean }[] = [];
  checklistInput = '';

  columns = [
    { status: 'ToDo',       icon: 'radio_button_unchecked' },
    { status: 'InProgress', icon: 'pending' },
    { status: 'Done',       icon: 'check_circle' }
  ];

  // ── Column name editing ──────────────────────────
  private readonly DEFAULT_COL_NAMES: Record<string, string> = {
    ToDo: 'To Do', InProgress: 'In Progress', Done: 'Done'
  };
  columnNames: Record<string, string> = { ...this.DEFAULT_COL_NAMES };
  editingColumnStatus: string | null = null;
  columnNameInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private boardService: BoardService,
    private taskService: TaskService,
    private aiService: AIService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    public  langService: LanguageService
  ) {}

  get locale(): string { return this.langService.current; }

  ngOnInit() {
    this.boardId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSavedFilters();
    this.loadColumnNames();
    this.loadBoard();
    this.loadTasks();
    this.initPipelineDays();
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('mouseup',   this._onUp);
  }

  // localStorage helpers
  private storageKey(): string { return `growty_filters_board_${this.boardId}`; }
  private colNamesKey(): string { return `growty_colnames_board_${this.boardId}`; }

  // ── Column names ─────────────────────────────────
  loadColumnNames() {
    try {
      const saved = localStorage.getItem(this.colNamesKey());
      if (saved) this.columnNames = { ...this.DEFAULT_COL_NAMES, ...JSON.parse(saved) };
    } catch { /* ignore */ }
  }

  colName(status: string): string {
    return this.columnNames[status] ?? this.DEFAULT_COL_NAMES[status];
  }

  startEditColumn(status: string) {
    this.editingColumnStatus = status;
    this.columnNameInput = this.colName(status);
  }

  saveColumnName() {
    const name = this.columnNameInput.trim();
    if (name && this.editingColumnStatus) {
      this.columnNames[this.editingColumnStatus] = name;
      localStorage.setItem(this.colNamesKey(), JSON.stringify(this.columnNames));
    }
    this.editingColumnStatus = null;
  }

  cancelEditColumn() { this.editingColumnStatus = null; }

  resetColumnNames() {
    this.columnNames = { ...this.DEFAULT_COL_NAMES };
    localStorage.removeItem(this.colNamesKey());
  }

  loadSavedFilters() {
    try {
      const saved = localStorage.getItem(this.storageKey());
      if (saved) {
        const state = JSON.parse(saved);
        this.activePriority = state.priority || 'all';
      }
    } catch { /* ignore */ }
  }

  saveFilters() {
    localStorage.setItem(this.storageKey(), JSON.stringify({
      priority: this.activePriority
    }));
  }

  get hasActiveFilters(): boolean {
    return this.activePriority !== 'all' || this.taskSearch.trim() !== '';
  }

  goBack() { this.location.back(); }

  // Data loading
  loadBoard() {
    this.boardService.getBoard(this.boardId).subscribe({
      next: (data: any) => { this.board = data; },
      error: (err: any) => console.error('Board load error:', err)
    });
  }

  loadTasks() {
    this.taskService.getTasksByBoard(this.boardId).subscribe({
      next: (data: any[]) => {
        this.tasks = data;
        this.refreshTaskLists();
      },
      error: (err: any) => console.error('Tasks load error:', err)
    });
  }

  refreshTaskLists() {
    this.todoTasks       = this.computeTasksForStatus('ToDo');
    this.inProgressTasks = this.computeTasksForStatus('InProgress');
    this.doneTasks       = this.computeTasksForStatus('Done');
    this.cdr.detectChanges();
  }

  private computeTasksForStatus(status: string): any[] {
    let result = this.tasks.filter(t => t.status === status);

    // 0. Search filter
    if (this.taskSearch.trim()) {
      const q = this.taskSearch.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    // 1. Priority filter
    if (this.activePriority !== 'all') {
      result = result.filter(t => t.priority === this.activePriority);
    }

    return result;
  }

  getTasksByStatus(status: string): any[] {
    if (status === 'ToDo')       return this.todoTasks;
    if (status === 'InProgress') return this.inProgressTasks;
    if (status === 'Done')       return this.doneTasks;
    return [];
  }

  // Unfiltered count for column header progress
  totalTaskCount(status: string): number {
    return this.tasks.filter(t => t.status === status).length;
  }

  // Overall completion progress for the board (Done / Total)
  get boardCompletionPct(): number {
    return this.tasks.length > 0
      ? Math.round(this.tasks.filter(t => t.status === 'Done').length / this.tasks.length * 100)
      : 0;
  }

  // Overdue count in a column (for badge)
  columnOverdueCount(status: string): number {
    if (status === 'Done') return 0;
    return this.tasks.filter(t => t.status === status && this.isOverdue(t.deadline)).length;
  }

  setPriority(p: string) { this.activePriority = p; this.saveFilters(); this.refreshTaskLists(); }
  onSearchChange()       { this.refreshTaskLists(); }

  clearFilters() {
    this.activePriority = 'all';
    this.taskSearch     = '';
    localStorage.removeItem(this.storageKey());
    this.refreshTaskLists();
  }

  setViewMode(mode: 'kanban' | 'pipeline') {
    this.viewMode = mode;
    if (mode === 'pipeline') {
      this.pipelineScrolled = false;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewChecked() {
    if (this.viewMode === 'pipeline' && !this.pipelineScrolled && this.ganttScrollRef) {
      const el = this.ganttScrollRef.nativeElement as HTMLElement;
      const scrollLeft = this.todayLineOffset - this.LABEL_W - 80;
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = Math.max(0, scrollLeft);
        this.pipelineScrolled = true;
      }
    }
  }

  // ── Pipeline / Gantt helpers ──────────────────────────────

  initPipelineDays() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 14);
    this.pipelineDays = Array.from({ length: 105 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
    this.dayIndexMap.clear();
    this.pipelineDays.forEach((d, i) => this.dayIndexMap.set(d.toDateString(), i));
  }

  get ganttWidth(): number { return this.pipelineDays.length * this.DAY_W; }

  get todayLineOffset(): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (this.dayIndexMap.get(today.toDateString()) ?? 14) * this.DAY_W;
  }

  get tasksWithDeadline(): any[] {
    return this.filteredTasks.filter(t => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline); d.setHours(0, 0, 0, 0);
      return this.dayIndexMap.has(d.toDateString());
    });
  }

  getBarStyle(task: any): { left: string; width: string } {
    const dlDate = new Date(task.deadline); dlDate.setHours(0, 0, 0, 0);
    const dlIdx  = this.dayIndexMap.get(dlDate.toDateString()) ?? -1;
    if (dlIdx < 0) return { left: '0px', width: '0px' };
    const startIdx = Math.max(0, dlIdx - 6);
    const width    = (dlIdx - startIdx + 1) * this.DAY_W;
    return { left: `${startIdx * this.DAY_W}px`, width: `${width}px` };
  }

  // Drag-resize
  startResize(event: MouseEvent, task: any) {
    event.preventDefault();
    event.stopPropagation();
    this.resizingTask      = task;
    this.resizeStartX      = event.clientX;
    this.resizeOrigDeadline = new Date(task.deadline);
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('mouseup',   this._onUp);
  }

  private onResizeMove(e: MouseEvent) {
    if (!this.resizingTask) return;
    const delta     = e.clientX - this.resizeStartX;
    const daysDelta = Math.round(delta / this.DAY_W);
    const newDl     = new Date(this.resizeOrigDeadline);
    newDl.setDate(newDl.getDate() + daysDelta);
    this.resizingTask.deadline = newDl.toISOString();
    this.cdr.detectChanges();
  }

  private onResizeUp() {
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('mouseup',   this._onUp);
    if (this.resizingTask) {
      const t = this.resizingTask;
      this.taskService.updateTask(t.id, {
        title:       t.title,
        description: t.description || '',
        priority:    t.priority,
        status:      t.status,
        deadline:    t.deadline,
        boardId:     this.boardId,
        checklist:   t.checklist ?? null
      }).subscribe({ next: () => this.loadTasks() });
    }
    this.resizingTask = null;
  }

  get filteredTasks(): any[] {
    let result = [...this.tasks];
    if (this.taskSearch.trim()) {
      const q = this.taskSearch.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    if (this.activePriority !== 'all') {
      result = result.filter(t => t.priority === this.activePriority);
    }
    return result;
  }

  getTasksForDay(day: Date): any[] {
    const str = day.toDateString();
    return this.filteredTasks.filter(t =>
      t.deadline && new Date(t.deadline).toDateString() === str
    );
  }

  get pipelineNoDeadlineTasks(): any[] {
    return this.filteredTasks.filter(t => !t.deadline);
  }

  isPipelineToday(day: Date): boolean {
    return day.toDateString() === new Date().toDateString();
  }

  isPipelinePast(day: Date): boolean {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return day < today;
  }

  isFirstOfMonth(day: Date): boolean {
    return day.getDate() === 1;
  }

  pipelineMonthLabel(day: Date): string {
    return this.isFirstOfMonth(day)
      ? day.toLocaleDateString('en', { month: 'short', year: 'numeric' })
      : '';
  }

  isMonday(day: Date): boolean {
    return day.getDay() === 1;
  }

  weekNumber(day: Date): number {
    const d = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  jumpToToday() {
    if (this.ganttScrollRef) {
      const el = this.ganttScrollRef.nativeElement as HTMLElement;
      el.scrollTo({ left: Math.max(0, this.todayLineOffset - this.LABEL_W - 80), behavior: 'smooth' });
    }
  }

  getConnectedDropLists(): string[] { return this.columns.map(col => col.status); }

  // Drag & drop
  drop(event: any, newStatus: string) {
    const task = event.previousContainer.data[event.previousIndex];
    if (task && task.status !== newStatus) {
      task.status = newStatus;
      if (newStatus === 'Done') task.completedAt = new Date().toISOString();
      else task.completedAt = null;
      this.refreshTaskLists();

      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => this.loadTasks(),
        error: () => this.loadTasks()
      });
    }
  }

  // Quick complete (InProgress → Done in one click)
  quickComplete(task: any) {
    task.status      = 'Done';
    task.completedAt = new Date().toISOString();
    this.refreshTaskLists();
    this.taskService.updateTaskStatus(task.id, 'Done').subscribe({
      next: () => this.loadTasks(),
      error: () => this.loadTasks()
    });
  }

  // Task CRUD
  openCreateTaskDialog(status: string = 'ToDo') {
    this.editingTask    = null;
    this.formErrors     = { title: '', deadline: '' };
    this.taskForm       = { title: '', description: '', priority: 'Medium', status };
    this.deadlineDate   = null;
    this.checklist      = [];
    this.checklistInput = '';
  }

  editTask(task: any) {
    this.editingTask    = task;
    this.formErrors     = { title: '', deadline: '' };
    this.checklistInput = '';
    this.deadlineDate   = task.deadline ? new Date(task.deadline) : null;
    this.taskForm = {
      title:       task.title,
      description: task.description || '',
      priority:    task.priority,
      status:      task.status
    };
    try {
      this.checklist = task.checklist ? JSON.parse(task.checklist) : [];
    } catch {
      this.checklist = [];
    }
  }

  saveTask() {
    this.formErrors = { title: '', deadline: '' };

    // Validation
    if (!this.taskForm.title.trim()) {
      this.formErrors.title = 'Task title is required';
      return;
    }
    if (this.taskForm.title.trim().length > 120) {
      this.formErrors.title = 'Title must be under 120 characters';
      return;
    }
    if (!this.deadlineDate) {
      this.formErrors.deadline = 'Deadline is required';
      return;
    }

    const payload: any = {
      ...this.taskForm,
      title:     this.taskForm.title.trim(),
      deadline:  this.deadlineDate.toISOString(),
      checklist: this.checklist.length ? JSON.stringify(this.checklist) : null
    };

    if (this.editingTask) {
      this.taskService.updateTask(this.editingTask.id, payload).subscribe({
        next: () => { this.resetForm(); this.loadTasks(); },
        error: (err: any) => {
          this.formErrors.title = `Update failed: ${err?.error?.error ?? err.statusText}`;
        }
      });
    } else {
      this.taskService.createTask({ ...payload, boardId: this.boardId }).subscribe({
        next: () => { this.resetForm(); this.loadTasks(); },
        error: (err: any) => {
          this.formErrors.title = `Create failed: ${err?.error?.error ?? err.statusText}`;
        }
      });
    }
  }

  // Show styled delete confirmation (not browser confirm())
  deleteTask(id: number, title: string = '') {
    this.deleteConfirm = { show: true, taskId: id, taskTitle: title };
  }

  confirmDelete() {
    this.taskService.deleteTask(this.deleteConfirm.taskId).subscribe({
      next: () => { this.cancelDelete(); this.loadTasks(); },
      error: (err: any) => { console.error('Delete error:', err); this.cancelDelete(); }
    });
  }

  cancelDelete() {
    this.deleteConfirm = { show: false, taskId: 0, taskTitle: '' };
  }

  resetForm() {
    this.editingTask    = null;
    this.formErrors     = { title: '', deadline: '' };
    this.deadlineDate   = null;
    this.checklist      = [];
    this.checklistInput = '';
    this.taskForm       = { title: '', description: '', priority: 'Medium', status: 'ToDo' };
  }

  // Checklist helpers
  addChecklistItem() {
    const text = this.checklistInput.trim();
    if (!text) return;
    this.checklist.push({ text, done: false });
    this.checklistInput = '';
  }

  removeChecklistItem(i: number) {
    this.checklist.splice(i, 1);
  }

  toggleChecklistItem(i: number) {
    this.checklist[i].done = !this.checklist[i].done;
  }

  checklistDoneInForm(): number {
    return this.checklist.filter(i => i.done).length;
  }

  checklistDoneCount(task: any): number {
    if (!task.checklist) return 0;
    try {
      return (JSON.parse(task.checklist) as { done: boolean }[]).filter(i => i.done).length;
    } catch { return 0; }
  }

  checklistTotalCount(task: any): number {
    if (!task.checklist) return 0;
    try {
      return (JSON.parse(task.checklist) as unknown[]).length;
    } catch { return 0; }
  }

  checklistPct(task: any): number {
    const total = this.checklistTotalCount(task);
    if (!total) return 0;
    return Math.round(this.checklistDoneCount(task) / total * 100);
  }

  // AI
  openAISuggestion(task: any) {
    this.aiLoadingTaskId = task.id;
    this.aiService.improveTask(task.id).subscribe({
      next: (suggestion: AISuggestion) => {
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
        this.dialog.open(AiSuggestionDialog, {
          width: '700px', maxWidth: '95vw',
          data: { task, suggestion }
        }).afterClosed().subscribe((result: any) => {
          if (result?.accepted) this.loadTasks();
        });
      },
      error: (err: any) => {
        console.error('AI error:', err);
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
      }
    });
  }

  // Helpers
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

  isDueSoon(deadline: string): boolean {
    if (!deadline) return false;
    const d = new Date(deadline);
    const soon = new Date(); soon.setDate(soon.getDate() + 2);
    return d <= soon && !this.isOverdue(deadline);
  }

  totalFiltered(): number {
    return this.columns.reduce((sum, col) => sum + this.getTasksByStatus(col.status).length, 0);
  }
}
