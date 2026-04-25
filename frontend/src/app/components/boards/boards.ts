import { Component, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { BoardService } from '../../services/board';
import { Board } from '../../models/board.model';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './boards.html',
  styleUrls: ['./boards.css']
})
export class BoardsComponent implements OnInit {
  [x: string]: any;
  boards: Board[] = [];
  @ViewChild('boardDialog') boardDialog!: TemplateRef<any>;
  dialogRef: any;
  boardForm = { title: '', description: '' };
  editingBoard: Board | null = null;

  constructor(private boardService: BoardService, private dialog: MatDialog, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.loadBoards();
  }

  loadBoards() {
    this.boardService.getBoards().subscribe(data => {
      this.boards = data;
      this.cdr.detectChanges(); // примусове оновлення
    });
  }

  createBoard() {
    const title = prompt('Назва дошки');
    if (title) {
      this.boardService.createBoard({ title, description: '' }).subscribe(() => this.loadBoards());
    }
  }

  editBoard(board: Board) {
    const newTitle = prompt('Нова назва', board.title);
    if (newTitle) {
      this.boardService.updateBoard(board.id, { title: newTitle, description: board.description || '' })
        .subscribe(() => this.loadBoards());
    }
  }

  deleteBoard(id: number) {
    if (confirm('Видалити дошку з усіма завданнями?')) {
      this.boardService.deleteBoard(id).subscribe(() => this.loadBoards());
    }
  }
}
