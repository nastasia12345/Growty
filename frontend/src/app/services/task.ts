import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KanbanTask } from '../models/board.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = 'https://localhost:5001/api/tasks';

  constructor(private http: HttpClient) { }

  getTasksByBoard(boardId: number): Observable<KanbanTask[]> {
    return this.http.get<KanbanTask[]>(`${this.apiUrl}/board/${boardId}`);
  }

  createTask(task: Partial<KanbanTask>): Observable<KanbanTask> {
    return this.http.post<KanbanTask>(this.apiUrl, task);
  }

  updateTask(id: number, task: Partial<KanbanTask>): Observable<KanbanTask> {
    return this.http.put<KanbanTask>(`${this.apiUrl}/${id}`, task);
  }

  moveTask(id: number, newStatus: string): Observable<KanbanTask> {
    return this.http.patch<KanbanTask>(`${this.apiUrl}/${id}/move`, newStatus);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
