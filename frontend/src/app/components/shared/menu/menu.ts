import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { AuthModalComponent } from '../../auth/auth-modal';
import { LanguageService } from '../../../services/language.service';
import { GamificationService } from '../../../services/gamification';
import { AnalyticsService } from '../../../services/analytics';
import { ProfileService } from '../../../services/profile.service';
import { ProfileSettingsModalComponent } from '../../profile-settings-modal/profile-settings-modal';

// Collectibles definition (mirrors plant.ts)
const ALL_COLLECTIBLES = [
  { emoji: '🌾', nameKey: 'plant.collectibleWheat',     threshold: 25  },
  { emoji: '🦋', nameKey: 'plant.collectibleButterfly', threshold: 50  },
  { emoji: '🌻', nameKey: 'plant.collectibleSunflower', threshold: 75  },
  { emoji: '🍄', nameKey: 'plant.collectibleMushroom',  threshold: 100 },
  { emoji: '🌈', nameKey: 'plant.collectibleRainbow',   threshold: 125 },
  { emoji: '⭐', nameKey: 'plant.collectibleStar',      threshold: 150 },
  { emoji: '🦄', nameKey: 'plant.collectibleUnicorn',   threshold: 200 },
  { emoji: '🏆', nameKey: 'plant.collectibleTrophy',    threshold: 250 },
];

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
    TranslateModule,
    AuthModalComponent,
    ProfileSettingsModalComponent,
  ],
  templateUrl: './menu.html',
  styleUrls: ['./menu.css']
})
export class MenuComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  showAuthModal       = false;
  showUserDropdown    = false;
  showProfileModal    = false;

  // ── Dropdown mini-data ─────────────────────────────────────────────────────
  menuHealthPercent = 0;
  menuWiltingLevel: 'healthy' | 'mild' | 'moderate' | 'critical' = 'healthy';
  menuDoneCount     = 0;
  menuDataLoading   = false;

  get menuHealthColor(): string {
    if (this.menuHealthPercent >= 60) return '#10b981';
    if (this.menuHealthPercent >= 30) return '#f59e0b';
    return '#ef4444';
  }

  get menuHealthLabel(): string {
    const hp = this.menuHealthPercent;
    const w  = this.menuWiltingLevel;
    if (w === 'critical') return '🥀';
    if (w === 'moderate') return '🍂';
    if (w === 'mild')     return '🌿';
    if (hp >= 80) return '🌳';
    if (hp >= 50) return '🌱';
    return '🪴';
  }

  get menuCollectibles() {
    return ALL_COLLECTIBLES.map(c => ({ ...c, unlocked: this.menuDoneCount >= c.threshold }));
  }

  get menuUnlockedCount(): number {
    return this.menuCollectibles.filter(c => c.unlocked).length;
  }

  /** Returns the uploaded avatar URL, or empty string to show initials. */
  get avatarDataUrl(): string {
    return this.profileSvc.profile.avatarDataUrl ?? '';
  }

  constructor(
    public  auth:       AuthService,
    public  lang:       LanguageService,
    private router:     Router,
    private gam:        GamificationService,
    private analytics:  AnalyticsService,
    private cdr:        ChangeDetectorRef,
    public  profileSvc: ProfileService,
  ) {}

  openAuth()  { this.showAuthModal = true;  this.showUserDropdown = false; }
  closeAuth() { this.showAuthModal = false; }

  openProfileModal()  { this.showProfileModal = true;  this.showUserDropdown = false; }
  closeProfileModal() { this.showProfileModal = false; this.cdr.markForCheck(); }

  toggleDropdown() {
    this.showUserDropdown = !this.showUserDropdown;
    if (this.showUserDropdown && this.auth.isLoggedIn) {
      this.loadMenuData();
    }
  }
  closeDropdown() { this.showUserDropdown = false; }

  logout() {
    this.auth.logout();
    this.profileSvc.clear();
    this.showUserDropdown  = false;
    this.showProfileModal  = false;
    this.menuHealthPercent = 0;
    this.menuDoneCount     = 0;
    this.menuDataLoading   = false;
    this.router.navigate(['/']);
  }

  private loadMenuData(): void {
    if (this.menuDataLoading) return;
    this.menuDataLoading = true;

    forkJoin({
      gam:   this.gam.getState().pipe(catchError(() => of(null))),
      tasks: this.analytics.getTasksByStatus().pipe(
               catchError(() => of({ todo: 0, inProgress: 0, done: 0 })))
    }).subscribe(({ gam, tasks }) => {
      if (gam) {
        this.menuHealthPercent = gam.healthLevel;
        this.menuWiltingLevel  = gam.wiltingLevel;
      }
      this.menuDoneCount   = tasks.done;
      this.menuDataLoading = false;
      this.cdr.markForCheck();
    });
  }
}
