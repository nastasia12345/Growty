import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GamificationState {
  healthLevel: number;
  inactiveDays: number;
  lastActivityDate: string | null;
  overdueCount: number;
  wiltingLevel: 'healthy' | 'mild' | 'moderate' | 'critical';
  isWilting: boolean;
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private apiUrl = 'http://localhost:5000/api/gamification';

  constructor(private http: HttpClient) {}

  getState(): Observable<GamificationState> {
    return this.http.get<GamificationState>(`${this.apiUrl}/state`);
  }

  recordActivity(): Observable<{ healthLevel: number }> {
    return this.http.post<{ healthLevel: number }>(`${this.apiUrl}/activity`, {});
  }
}
