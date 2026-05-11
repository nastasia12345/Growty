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
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { BoardService } from '../../services/board';
import { TaskService } from '../../services/task';
import { AIService, AISuggestion } from '../../services/ai';
import { AiSuggestionDialog } from '../ai-suggestion-dialog/ai-suggestion-dialog';

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

  filterPeriods = [
    { label: 'Всі', value: 'all' },
    { label: 'Сьогодні', value: 'today' },
    { label: 'Тиждень', value: 'week' },
    { label: 'Місяць', value: 'month' }
  ];
  activeFilter: string = 'all';

  taskForm = {
    title: '',
    description: '',
    deadline: '',
    priority: 'Medium',
    status: 'ToDo'
  };
  editingTask: any = null;

  columns = [
    { name: 'To Do', status: 'ToDo' },
    { name: 'In Progress', status: 'InProgress' },
    { name: 'Done', status: 'Done' }
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
  ) { }

  ngOnInit() {
    this.boardId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadBoard();
    this.loadTasks();
  }

  goBack() {
    this.location.back();
  }

  loadBoard() {
    this.boardService.getBoard(this.boardId).subscribe({
      next: (data: any) => { this.board = data; },
      error: (err: any) => console.error('Помилка завантаження дошки:', err)
    });
  }

  loadTasks() {
    this.taskService.getTasksByBoard(this.boardId).subscribe({
      next: (data: any[]) => { this.tasks = this.filterTasks(data); },
      error: (err: any) => console.error('Помилка завантаження задач:', err)
    });
  }

  filterTasks(tasks: any[]): any[] {
    if (this.activeFilter === 'all') return tasks;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return tasks.filter(task => {
      if (!task.deadline) return false;
      const deadline = new Date(task.deadline);
      switch (this.activeFilter) {
        case 'today':
          return deadline >= today && deadline < new Date(today.getTime() + 86400000);
        case 'week':
          return deadline >= today && deadline <= new Date(today.getTime() + 7 * 86400000);
        case 'month':
          return deadline >= today && deadline <= new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        default:
          return true;
      }
    });
  }

  setFilter(period: string) {
    this.activeFilter = period;
    this.loadTasks();
  }

  getTasksByStatus(status: string): any[] {
    return this.tasks.filter(task => task.status === status);
  }

  getConnectedDropLists(): string[] {
    return this.columns.map(col => col.status);
  }

  drop(event: any, newStatus: string) {
    const task = event.previousContainer.data[event.previousIndex];
    if (task && task.status !== newStatus) {
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => {
          task.status = newStatus;
          if (newStatus === 'Done') task.completedAt = new Date().toISOString();
          this.loadTasks();
        },
        error: (err: any) => console.error('Помилка оновлення статусу:', err)
      });
    }
  }

  openCreateTaskDialog() {
    this.editingTask = null;
    this.taskForm = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
  }

  editTask(task: any) {
    this.editingTask = task;
    this.taskForm = {
      title: task.title,
      description: task.description || '',
      deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '',
      priority: task.priority,
      status: task.status
    };
  }

  saveTask() {
    if (!this.taskForm.title.trim()) {
      alert('Введіть назву задачі');
      return;
    }
    if (this.editingTask) {
      this.taskService.updateTask(this.editingTask.id, this.taskForm).subscribe({
        next: () => { this.loadTasks(); this.resetForm(); },
        error: (err: any) => console.error('Помилка оновлення:', err)
      });
    } else {
      this.taskService.createTask({ ...this.taskForm, boardId: this.boardId }).subscribe({
        next: () => { this.loadTasks(); this.resetForm(); },
        error: (err: any) => console.error('Помилка створення:', err)
      });
    }
  }

  deleteTask(id: number) {
    if (confirm('Видалити це завдання?')) {
      this.taskService.deleteTask(id).subscribe({
        next: () => this.loadTasks(),
        error: (err: any) => console.error('Помилка видалення:', err)
      });
    }
  }

  resetForm() {
    this.editingTask = null;
    this.taskForm = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
  }

  openAISuggestion(task: any) {
    this.aiLoadingTaskId = task.id;
    this.aiService.improveTask(task.id).subscribe({
      next: (suggestion: AISuggestion) => {
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
        const dialogRef = this.dialog.open(AiSuggestionDialog, {
          width: '700px',
          maxWidth: '95vw',
          data: { task, suggestion }
        });
        dialogRef.afterClosed().subscribe((result: any) => {
          if (result?.accepted) this.loadTasks();
        });
      },
      error: (err: any) => {
        console.error('AI помилка:', err);
        this.aiLoadingTaskId = null;
        this.cdr.detectChanges();
        alert('Не вдалося отримати пропозицію від AI. Спробуйте пізніше.');
      }
    });
  }

  isOverdue(deadline: string): boolean {
    if (!deadline) return false;
    const d = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d < today;
  }
}
