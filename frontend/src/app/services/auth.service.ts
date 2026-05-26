import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WellbeingService } from './wellbeing.service';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = 'http://localhost:5000/api/auth';
  private readonly TOKEN_KEY = 'growty_token';
  private readonly USER_KEY  = 'growty_user';

  currentUser = signal<AuthUser | null>(this.loadUser());

  constructor(private http: HttpClient, private wb: WellbeingService) {}

  get isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get initials(): string {
    const name = this.currentUser()?.displayName ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  register(email: string, displayName: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/register`, { email, displayName, password })
      .pipe(tap(res => this.saveSession(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, { email, password })
      .pipe(tap(res => this.saveSession(res)));
  }

  resetPassword(email: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/reset-password`, { email, newPassword });
  }

  logout() {
    this.wb.resetLoginPrompt();          // survey must re-appear on next login
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
  }

  private saveSession(res: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.currentUser.set(res.user);
    // Small delay so the login modal can close first
    setTimeout(() => this.wb.triggerIfNeeded('login'), 800);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
