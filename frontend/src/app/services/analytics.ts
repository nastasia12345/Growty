import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStats {
  id: number;
  userId: string;
  date: string; // ISO date
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  activityScore: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private apiUrl = 'https://localhost:5001/api/analytics';

  constructor(private http: HttpClient) { }

  getStats(days: number = 30): Observable<UserStats[]> {
    return this.http.get<UserStats[]>(`${this.apiUrl}/stats?days=${days}`);
  }

  getSummary(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/summary`);
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/csv`, { responseType: 'blob' });
  }
}
