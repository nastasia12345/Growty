import { Injectable, signal } from '@angular/core';

const PROFILE_KEY = 'growty_profile';

export interface UserProfile {
  avatarDataUrl?: string;
  phone?:         string;
  gender?:        string;
  hobbies?:       string[];
  happyThings?:   string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {

  private _profile = signal<UserProfile>(this.load());

  get profile(): UserProfile { return this._profile(); }

  save(p: UserProfile): void {
    this._profile.set({ ...p });
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  }

  /** Call on logout so stale data doesn't leak to the next account. */
  clear(): void {
    this._profile.set({});
    try { localStorage.removeItem(PROFILE_KEY); } catch {}
  }

  private load(): UserProfile {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
}
