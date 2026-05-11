import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = 'https://localhost:5001/api/tasks';

  constructor(private http: HttpClient) { }

  getTasksByBoard(boardId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/board/${boardId}`);
  }

  getTask(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createTask(task: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, task);
  }

  updateTask(id: number, task: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, task);
  }

  updateTaskStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/move`, `"${status}"`, {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Додайте цей метод для сумісності
  moveTask(id: number, newStatus: string): Observable<any> {
    return this.updateTaskStatus(id, newStatus);
  }

  deleteTask(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
