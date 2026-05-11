import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TaskService } from '../../services/task';
import { MatDividerModule } from '@angular/material/divider';  // ← Додайте це


@Component({
  selector: 'app-ai-suggestion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule 
  ],
  templateUrl: './ai-suggestion-dialog.html',
  styleUrls: ['./ai-suggestion-dialog.css']
})
export class AiSuggestionDialog {
  applyDescription: boolean = true;
  applySubtasks: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<AiSuggestionDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private taskService: TaskService
  ) { }

  acceptSuggestion() {
    if (this.applyDescription && this.data.suggestion.improvedText) {
      const updatedTask: any = {
        ...this.data.task,
        description: this.data.suggestion.improvedText
      };
      this.taskService.updateTask(this.data.task.id, updatedTask).subscribe();
    }

    if (this.applySubtasks && this.data.suggestion.subtasks?.length) {
      this.data.suggestion.subtasks.forEach((subtaskTitle: string) => {
        const newTask: any = {
          title: subtaskTitle,
          description: `Підзадача для: ${this.data.task.title}`,
          status: 'ToDo',
          priority: this.data.task.priority || 'Medium',
          boardId: this.data.task.boardId
        };
        this.taskService.createTask(newTask).subscribe();
      });
    }

    this.dialogRef.close({ accepted: true });
  }

  rejectSuggestion() {
    this.dialogRef.close({ accepted: false });
  }
}
