import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { BoardService } from '../../services/board';
import { TaskService } from '../../services/task';
import { Board, KanbanTask } from '../../models/board.model';

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterModule,
    FormsModule,
    DragDropModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './board-detail.html',
  styleUrls: ['./board-detail.css']
})
export class BoardDetailComponent implements OnInit {
  board: Board | null = null;
  tasks: KanbanTask[] = [];

  columns = [
    { name: 'To Do', status: 'ToDo' },
    { name: 'In Progress', status: 'InProgress' },
    { name: 'Done', status: 'Done' }
  ];

  @ViewChild('taskDialog') taskDialog!: TemplateRef<any>;
  dialogRef: any;
  taskForm: any = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
  editingTask: KanbanTask | null = null;

  filterPeriods = [
    { label: 'Всі', value: 'all' },
    { label: 'Сьогодні', value: 'today' },
    { label: 'Тиждень', value: 'week' },
    { label: 'Місяць', value: 'month' },
    { label: 'Виконані', value: 'done' }
  ];

  activeFilter = 'all';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private boardService: BoardService,
    private taskService: TaskService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.boardService.getBoards().subscribe(boards => {
      this.board = boards.find(b => b.id === id) || null;
      if (this.board) {
        this.loadTasks();
      } else {
        this.router.navigate(['/boards']);
      }
    });
  }

  loadTasks() {
    if (this.board) {
      this.taskService.getTasksByBoard(this.board.id).subscribe(tasks => {
        this.tasks = tasks;
        this.cdr.detectChanges();
      });
    }
  }

  setFilter(value: string) {
    this.activeFilter = value;
  }

  getFilteredTasks(): KanbanTask[] {
    if (!this.tasks) return [];
    const now = new Date();

    switch (this.activeFilter) {
      case 'today':
        return this.tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === now.toDateString());
      case 'week': {
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + 7);
        return this.tasks.filter(t => t.deadline && new Date(t.deadline) <= weekEnd);
      }
      case 'month': {
        const monthEnd = new Date(now);
        monthEnd.setDate(now.getDate() + 30);
        return this.tasks.filter(t => t.deadline && new Date(t.deadline) <= monthEnd);
      }
      case 'done':
        return this.tasks.filter(t => t.status === 'Done');
      default:
        return this.tasks;
    }
  }

  getTasksByStatus(status: string): KanbanTask[] {
    return this.getFilteredTasks().filter(t => t.status === status);
  }

  getConnectedDropLists(): string[] {
    return this.columns.map(c => c.status);
  }

  drop(event: CdkDragDrop<KanbanTask[]>, newStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.cdr.detectChanges();
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      this.taskService.moveTask(task.id, newStatus).subscribe({
        next: () => this.loadTasks(),
        error: (err) => console.error('Помилка переміщення:', err)
      });
    }
  }

  openCreateTaskDialog() {
    this.editingTask = null;
    this.taskForm = { title: '', description: '', deadline: '', priority: 'Medium', status: 'ToDo' };
    this.dialogRef = this.dialog.open(this.taskDialog);
  }

  editTask(task: KanbanTask) {
    this.editingTask = task;
    this.taskForm = { ...task, deadline: task.deadline?.slice(0, 16) || '' };
    this.dialogRef = this.dialog.open(this.taskDialog);
  }

  saveTask() {
    const taskData = { ...this.taskForm, boardId: this.board!.id };
    if (this.editingTask) {
      this.taskService.updateTask(this.editingTask.id, taskData).subscribe({
        next: () => { this.loadTasks(); this.dialogRef.close(); },
        error: (err) => console.error('Помилка оновлення:', err)
      });
    } else {
      this.taskService.createTask(taskData).subscribe({
        next: () => { this.loadTasks(); this.dialogRef.close(); },
        error: (err) => console.error('Помилка створення:', err)
      });
    }
  }

  deleteTask(id: number) {
    if (confirm('Видалити завдання?')) {
      this.taskService.deleteTask(id).subscribe({
        next: () => this.loadTasks(),
        error: (err) => console.error('Помилка видалення:', err)
      });
    }
  }

  isOverdue(deadline: string): boolean {
    return new Date(deadline) < new Date();
  }
}
