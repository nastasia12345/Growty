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
    const existingChecklist: { text: string; done: boolean }[] = (() => {
      try { return this.data.task.checklist ? JSON.parse(this.data.task.checklist) : []; }
      catch { return []; }
    })();

    const newChecklist = this.applySubtasks && this.data.suggestion.subtasks?.length
      ? [
          ...existingChecklist,
          ...this.data.suggestion.subtasks.map((t: string) => ({ text: t, done: false }))
        ]
      : existingChecklist;

    const updatedTask: any = {
      ...this.data.task,
      description: this.applyDescription && this.data.suggestion.improvedText
        ? this.data.suggestion.improvedText
        : this.data.task.description,
      checklist: newChecklist.length ? JSON.stringify(newChecklist) : (this.data.task.checklist ?? null)
    };

    this.taskService.updateTask(this.data.task.id, updatedTask).subscribe({
      next:  () => this.dialogRef.close({ accepted: true }),
      error: () => this.dialogRef.close({ accepted: true })
    });
  }

  rejectSuggestion() {
    this.dialogRef.close({ accepted: false });
  }
}
