import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStats {
  id: number;
  userId: string;
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  activityScore: number;
}

export interface TasksByStatus {
  todo: number;
  inProgress: number;
  done: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private apiUrl = 'http://localhost:5000/api/analytics';

  constructor(private http: HttpClient) { }

  getStats(days: number = 30): Observable<UserStats[]> {
    return this.http.get<UserStats[]>(`${this.apiUrl}/stats?days=${days}`);
  }

  getSummary(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/summary`);
  }

  getTasksByStatus(): Observable<TasksByStatus> {
    return this.http.get<TasksByStatus>(`${this.apiUrl}/tasks-by-status`);
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/csv`, { responseType: 'blob' });
  }
}
