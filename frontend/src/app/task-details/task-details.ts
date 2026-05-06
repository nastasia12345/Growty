import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { KanbanTask } from '../models/board.model';
import { TaskService } from '../services/task';
import { FeedbackService } from '../services/feedback';


@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  templateUrl: './task-details.html',
  styleUrls: ['./task-details.css']
})

export class TaskDetailComponent {
  @Output() taskChanged = new EventEmitter<void>();

  task: KanbanTask = { id: 0, title: '', description: '', priority: 'Medium', status: 'ToDo', boardId: 0 } as KanbanTask;
  isOpen = false;
  deadlineDate: Date | null = null;
  isDone = false;
  feedbackComment = '';
  difficultyRating = 0;
  hoverRating = 0;

  constructor(
    private taskService: TaskService,
    private feedbackService: FeedbackService,
    private snackBar: MatSnackBar
  ) { }

  openForCreate(boardId: number, initialStatus: string = 'ToDo') {
    this.task = {
      id: 0,
      title: '',
      description: '',
      deadline: undefined,
      priority: 'Medium',
      status: initialStatus,
      boardId: boardId,
      completedAt: undefined
    } as KanbanTask;
    this.deadlineDate = null;
    this.isDone = false;
    this.feedbackComment = '';
    this.difficultyRating = 0;
    this.isOpen = true;
  }

  openForEdit(taskId: number) {
    this.taskService.getTask(taskId).subscribe({
      next: (task) => {
        this.task = task;
        this.deadlineDate = task.deadline ? new Date(task.deadline) : null;
        this.isDone = task.status === 'Done';
        this.loadFeedback();
        this.isOpen = true;
      },
      error: (err) => console.error(err)
    });
  }

  close() {
    this.isOpen = false;
  }

  loadFeedback() {
    if (this.task.id) {
      this.feedbackService.getFeedback(this.task.id).subscribe({
        next: (fb) => {
          if (fb) {
            this.feedbackComment = fb.comment || '';
            this.difficultyRating = fb.difficultyRating || 0;
          }
        }
      });
    }
  }

  onStatusChanged() {
    if (!this.task.id) return;
    const newStatus = this.isDone ? 'Done' : 'ToDo';
    this.taskService.moveTask(this.task.id, newStatus).subscribe({
      next: () => {
        this.task.status = newStatus;
        this.snackBar.open('Статус оновлено', 'OK', { duration: 2000 });
        this.taskChanged.emit();
      }
    });
  }

  submitFeedback() {
    if (!this.task.id) return;
    this.feedbackService.addFeedback(this.task.id, this.feedbackComment, this.difficultyRating).subscribe({
      next: () => {
        this.snackBar.open('Дякуємо за відгук!', 'OK', { duration: 2000 });
        this.taskChanged.emit();
      }
    });
  }

  saveTask() {
    const taskData = {
      ...this.task,
      deadline: this.deadlineDate ? this.deadlineDate.toISOString() : undefined
    };
    if (this.task.id) {
      this.taskService.updateTask(this.task.id, taskData).subscribe({
        next: () => {
          this.snackBar.open('Завдання оновлено', 'OK', { duration: 2000 });
          this.taskChanged.emit();
          this.close();
        }
      });
    } else {
      this.taskService.createTask(taskData).subscribe({
        next: () => {
          this.snackBar.open('Завдання створено', 'OK', { duration: 2000 });
          this.taskChanged.emit();
          this.close();
        }
      });
    }
  }

  deleteTask() {
    if (!this.task.id) return;
    if (confirm('Видалити завдання?')) {
      this.taskService.deleteTask(this.task.id).subscribe({
        next: () => {
          this.snackBar.open('Завдання видалено', 'OK', { duration: 2000 });
          this.taskChanged.emit();
          this.close();
        }
      });
    }
  }
}
