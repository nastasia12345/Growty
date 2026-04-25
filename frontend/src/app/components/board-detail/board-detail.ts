import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

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
        this.cdr.detectChanges(); // Примусове виявлення змін
      });
    }
  }

  getTasksByStatus(status: string): KanbanTask[] {
    return this.tasks.filter(t => t.status === status);
  }

  getConnectedDropLists(): string[] {
    return this.columns.map(c => c.status);
  }

  drop(event: CdkDragDrop<KanbanTask[]>, newStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.cdr.detectChanges(); // Оновлюємо порядок в межах колонки
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      this.taskService.moveTask(task.id, newStatus).subscribe({
        next: () => {
          this.loadTasks(); // Перезавантажуємо всі завдання
        },
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
        next: () => {
          this.loadTasks();
          this.dialogRef.close();
        },
        error: (err) => console.error('Помилка оновлення:', err)
      });
    } else {
      this.taskService.createTask(taskData).subscribe({
        next: () => {
          this.loadTasks();
          this.dialogRef.close();
        },
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
