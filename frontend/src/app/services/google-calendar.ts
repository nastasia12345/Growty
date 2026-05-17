import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GoogleEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
  source: 'google' | 'growty';
}

export interface GoogleStatus {
  connected: boolean;
  connectedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  private api = 'http://localhost:5000/api/google-calendar';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<GoogleStatus> {
    return this.http.get<GoogleStatus>(`${this.api}/status`);
  }

  getAuthUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.api}/auth-url`);
  }

  getEvents(): Observable<GoogleEvent[]> {
    return this.http.get<GoogleEvent[]>(`${this.api}/events`);
  }

  syncTasks(): Observable<{ synced: number }> {
    return this.http.post<{ synced: number }>(`${this.api}/sync-tasks`, {});
  }

  importEvents(): Observable<{ imported: number }> {
    return this.http.post<{ imported: number }>(`${this.api}/import-events`, {});
  }

  disconnect(): Observable<{ disconnected: boolean }> {
    return this.http.delete<{ disconnected: boolean }>(`${this.api}/disconnect`);
  }
}
