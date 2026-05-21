import {
  Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BoardService } from '../../services/board';
import { Board } from '../../models/board.model';

const BOARD_COLORS = [
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#ef4444,#f87171)',
  'linear-gradient(135deg,#06b6d4,#22d3ee)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#64748b,#94a3b8)',
];

const COLOR_STORAGE_KEY = 'growty_board_colors';

@Component({
  selector: 'app-boards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslateModule
  ],
  templateUrl: './boards.html',
  styleUrls: ['./boards.css']
})
export class BoardsComponent implements OnInit {
  boards: Board[] = [];

  // ── Sliding panel ───────────────────────────────────────────
  panelOpen  = false;
  panelMode: 'create' | 'edit' = 'create';
  form       = { title: '', description: '' };
  formError  = '';
  saving     = false;
  editingBoard: Board | null = null;

  // Color picker
  colors        = BOARD_COLORS;
  selectedColor = BOARD_COLORS[0];
  boardColors: Record<number, string> = {};

  // ── Delete overlay ──────────────────────────────────────────
  deleteTarget: Board | null = null;
  deleting = false;

  constructor(
    private boardService: BoardService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadBoardColors();
    this.loadBoards();
  }

  // ── Color persistence ───────────────────────────────────────
  loadBoardColors() {
    try {
      const raw = localStorage.getItem(COLOR_STORAGE_KEY);
      if (raw) this.boardColors = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  saveBoardColors() {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(this.boardColors));
  }

  getBoardColor(id: number): string {
    return this.boardColors[id] ?? BOARD_COLORS[0];
  }

  // ── Load ────────────────────────────────────────────────────
  loadBoards() {
    this.boardService.getBoards().subscribe(data => {
      this.boards = data;
      this.cdr.markForCheck();
    });
  }

  // ── Panel open/close ────────────────────────────────────────
  openCreate() {
    this.panelMode    = 'create';
    this.editingBoard = null;
    this.form         = { title: '', description: '' };
    this.formError    = '';
    this.selectedColor = BOARD_COLORS[0];
    this.panelOpen    = true;
    this.cdr.markForCheck();
  }

  openEdit(board: Board, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.panelMode     = 'edit';
    this.editingBoard  = board;
    this.form          = { title: board.title, description: board.description || '' };
    this.formError     = '';
    this.selectedColor = this.getBoardColor(board.id);
    this.panelOpen     = true;
    this.cdr.markForCheck();
  }

  closePanel() {
    if (this.saving) return;
    this.panelOpen = false;
    this.cdr.markForCheck();
  }

  // ── Save ────────────────────────────────────────────────────
  save() {
    const title = this.form.title.trim();
    if (!title) { this.formError = this.translate.instant('boards.titleRequired'); return; }
    if (title.length > 100) { this.formError = this.translate.instant('boards.titleTooLong'); return; }

    this.formError = '';
    this.saving    = true;
    this.cdr.markForCheck();

    if (this.panelMode === 'create') {
      this.boardService.createBoard({ title, description: this.form.description.trim() })
        .subscribe({
          next: (created: any) => {
            if (created?.id) {
              this.boardColors[created.id] = this.selectedColor;
              this.saveBoardColors();
            }
            this.saving    = false;
            this.panelOpen = false;
            this.loadBoards();
          },
          error: () => {
            this.formError = this.translate.instant('boards.createFailed');
            this.saving    = false;
            this.cdr.markForCheck();
          }
        });
    } else if (this.editingBoard) {
      const id = this.editingBoard.id;
      this.boardColors[id] = this.selectedColor;
      this.saveBoardColors();
      this.boardService.updateBoard(id, { title, description: this.form.description.trim() })
        .subscribe({
          next: () => {
            this.saving    = false;
            this.panelOpen = false;
            this.loadBoards();
          },
          error: () => {
            this.formError = this.translate.instant('boards.updateFailed');
            this.saving    = false;
            this.cdr.markForCheck();
          }
        });
    }
  }

  // ── Delete overlay ──────────────────────────────────────────
  openDelete(board: Board, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.deleteTarget = board;
    this.cdr.markForCheck();
  }

  cancelDelete() {
    this.deleteTarget = null;
    this.cdr.markForCheck();
  }

  confirmDelete() {
    if (!this.deleteTarget || this.deleting) return;
    this.deleting = true;
    this.cdr.markForCheck();
    this.boardService.deleteBoard(this.deleteTarget.id).subscribe({
      next: () => {
        if (this.deleteTarget) {
          delete this.boardColors[this.deleteTarget.id];
          this.saveBoardColors();
        }
        this.deleteTarget = null;
        this.deleting     = false;
        this.loadBoards();
      },
      error: () => {
        this.deleting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
