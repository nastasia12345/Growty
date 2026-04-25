import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Board } from '../models/board.model';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private apiUrl = 'https://localhost:5001/api/boards'; // зміни порт якщо треба

  constructor(private http: HttpClient) { }

  getBoards(): Observable<Board[]> {
    return this.http.get<Board[]>(this.apiUrl);
  }

  createBoard(board: Partial<Board>): Observable<Board> {
    return this.http.post<Board>(this.apiUrl, board);
  }

  updateBoard(id: number, board: Partial<Board>): Observable<Board> {
    return this.http.put<Board>(`${this.apiUrl}/${id}`, board);
  }

  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
