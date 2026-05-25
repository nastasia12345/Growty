import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
type WiltLevel = 'healthy' | 'mild' | 'moderate' | 'critical';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../../services/analytics';
import { GamificationService, GamificationState } from '../../services/gamification';
import { PlantViewerComponent, PlacedItem } from './plant-viewer/plant-viewer';

interface Collectible {
  emoji:     string;
  nameKey:   string;
  threshold: number;
}

const ALL_COLLECTIBLES: Collectible[] = [
  { emoji: '🌾', nameKey: 'plant.collectibleWheat',     threshold: 25  },
  { emoji: '🦋', nameKey: 'plant.collectibleButterfly', threshold: 50  },
  { emoji: '🌻', nameKey: 'plant.collectibleSunflower', threshold: 75  },
  { emoji: '🍄', nameKey: 'plant.collectibleMushroom',  threshold: 100 },
  { emoji: '🌈', nameKey: 'plant.collectibleRainbow',   threshold: 125 },
  { emoji: '⭐', nameKey: 'plant.collectibleStar',      threshold: 150 },
  { emoji: '🦄', nameKey: 'plant.collectibleUnicorn',   threshold: 200 },
  { emoji: '🏆', nameKey: 'plant.collectibleTrophy',    threshold: 250 },
];

/** Storage key for placed collectibles (v2 = PlacedItem[] format). */
const PLACED_KEY = 'growty_placements_v2';

/**
 * Default world positions for click-to-place.
 * Index matches ALL_COLLECTIBLES order.
 * Matches the scene coordinate system (plant ~4 units tall, pot at y=0).
 */
const DEFAULT_POSITIONS: [number, number, number][] = [
  [-1.05,  0.90,  1.00],  // 0 — front-left,  low
  [ 1.05,  0.90,  1.00],  // 1 — front-right, low
  [-1.45,  2.05,  0.55],  // 2 — mid-left
  [ 1.45,  2.05,  0.55],  // 3 — mid-right
  [-0.75,  3.10,  0.70],  // 4 — upper-left
  [ 0.75,  3.10,  0.70],  // 5 — upper-right
  [ 0.00,  3.85,  0.80],  // 6 — top-center
  [ 0.00,  0.30,  1.30],  // 7 — base-front
];

@Component({
  selector: 'app-plant',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, PlantViewerComponent, TranslateModule],
  templateUrl: './plant.html',
  styleUrls: ['./plant.css']
})

export class PlantComponent implements OnInit {
  todo       = 0;
  inProgress = 0;
  done       = 0;
  isLoading  = true;
  hasError   = false;

  // Gamification state from backend
  gamState: GamificationState | null = null;

  // ── Placed decorations ──────────────────────────────────────────────────
  placements: PlacedItem[] = this.loadPlaced();

  constructor(
    private analyticsService: AnalyticsService,
    private gamificationService: GamificationService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  isPlaced(emoji: string): boolean {
    return this.placements.some(p => p.emoji === emoji);
  }

  /**
   * Click-to-toggle: if already placed, remove it; otherwise add at its
   * pre-defined default world position so it appears near the plant immediately.
   */
  togglePlaced(emoji: string): void {
    if (this.isPlaced(emoji)) {
      this.placements = this.placements.filter(p => p.emoji !== emoji);
    } else {
      const idx = ALL_COLLECTIBLES.findIndex(c => c.emoji === emoji);
      const [x, y, z] = DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length];
      this.placements = [...this.placements, { emoji, x, y, z }];
    }
    this.savePlaced();
    this.cdr.markForCheck();
  }

  /** Called when the user drags an emoji onto the 3-D plant canvas. */
  onDragStart(e: DragEvent, emoji: string): void {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', emoji);
    e.dataTransfer.effectAllowed = 'move';
  }

  /** Called by (placed) output from plant-viewer after a successful drop. */
  onPlaced(item: PlacedItem): void {
    // Replace any existing placement for this emoji with the new drop position
    this.placements = [
      ...this.placements.filter(p => p.emoji !== item.emoji),
      item,
    ];
    this.savePlaced();
    this.cdr.markForCheck();
  }

  /** Called when the user drags a placed sprite to a new position inside the canvas. */
  onMoved(item: PlacedItem): void {
    this.placements = [
      ...this.placements.filter(p => p.emoji !== item.emoji),
      item,
    ];
    this.savePlaced();
    // No markForCheck needed — plant-viewer handles the visual itself
    // and sets skipNextDecorRebuild before emitting.
  }

  /** Called when the user double-clicks a placed sprite to remove it. */
  onRemoved(emoji: string): void {
    this.placements = this.placements.filter(p => p.emoji !== emoji);
    this.savePlaced();
    this.cdr.markForCheck();
  }

  private loadPlaced(): PlacedItem[] {
    try {
      const raw = localStorage.getItem(PLACED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private savePlaced(): void {
    try { localStorage.setItem(PLACED_KEY, JSON.stringify(this.placements)); } catch {}
  }

  ngOnInit() {
    forkJoin({
      tasks: this.analyticsService.getTasksByStatus().pipe(
        timeout(8000),
        catchError(() => of({ todo: 0, inProgress: 0, done: 0 }))
      ),
      gam: this.gamificationService.getState().pipe(
        timeout(8000),
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ tasks, gam }) => {
        this.todo       = tasks.todo;
        this.inProgress = tasks.inProgress;
        this.done       = tasks.done;
        this.gamState   = gam;
        this.isLoading  = false;
        if (!gam) this.hasError = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.hasError  = true;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get total(): number { return this.todo + this.inProgress + this.done; }

  // Use backend HealthLevel if available, otherwise fallback to local calculation
  get healthPercent(): number {
    if (this.gamState) return this.gamState.healthLevel;
    if (this.total === 0) return 0;
    const rate = this.done / this.total + (this.inProgress / this.total) * 0.3;
    return Math.min(100, Math.round(rate * 100));
  }

  get wiltingLevel(): WiltLevel {
    const val = this.gamState?.wiltingLevel ?? 'healthy';
    const valid: WiltLevel[] = ['healthy', 'mild', 'moderate', 'critical'];
    return valid.includes(val as WiltLevel) ? (val as WiltLevel) : 'healthy';
  }

  get inactiveDays(): number {
    return this.gamState?.inactiveDays ?? 0;
  }

  get overdueCount(): number {
    return this.gamState?.overdueCount ?? 0;
  }

  get healthLabel(): string {
    const hp = this.healthPercent;
    const wilt = this.wiltingLevel;
    if (wilt === 'critical') return this.translate.instant('plant.healthCriticalWilting');
    if (wilt === 'moderate') return this.translate.instant('plant.healthWilting');
    if (wilt === 'mild')     return this.translate.instant('plant.healthStressed');
    if (hp >= 80) return this.translate.instant('plant.healthExcellent');
    if (hp >= 60) return this.translate.instant('plant.healthGood');
    if (hp >= 40) return this.translate.instant('plant.healthFair');
    if (hp >= 20) return this.translate.instant('plant.healthWeak');
    return this.translate.instant('plant.healthCritical');
  }

  get healthColor(): string {
    const hp = this.healthPercent;
    if (hp >= 60) return '#10b981';
    if (hp >= 30) return '#f59e0b';
    return '#ef4444';
  }

  // Plant emoji changes based on wilting level
  get plantEmoji(): string {
    switch (this.wiltingLevel) {
      case 'critical': return '🥀';
      case 'moderate': return '🍂';
      case 'mild':     return '🌿';
      default:         return this.healthPercent >= 70 ? '🌳' : '🌱';
    }
  }

  get wiltingMessage(): string | null {
    const t = (k: string, p?: object) => this.translate.instant(k, p);
    if (this.wiltingLevel === 'critical') {
      return this.inactiveDays >= 7
        ? t('plant.wiltCriticalDays',    { count: this.inactiveDays })
        : t('plant.wiltCriticalOverdue', { count: this.overdueCount });
    }
    if (this.wiltingLevel === 'moderate') {
      return this.inactiveDays >= 3
        ? t('plant.wiltModerateDays',    { count: this.inactiveDays })
        : t('plant.wiltModerateOverdue', { count: this.overdueCount });
    }
    if (this.wiltingLevel === 'mild') {
      return t('plant.wiltMild');
    }
    return null;
  }

  get daysInactiveLabel(): string {
    return this.translate.instant('plant.daysInactive', { count: this.inactiveDays });
  }

  get overdueTasksLabel(): string {
    return this.translate.instant('plant.overdueTasks', { count: this.overdueCount });
  }

  get collectibles(): (Collectible & { unlocked: boolean })[] {
    return ALL_COLLECTIBLES.map(c => ({ ...c, unlocked: this.done >= c.threshold }));
  }

  get unlockedCount(): number {
    return this.collectibles.filter(c => c.unlocked).length;
  }

  get nextThreshold(): number | null {
    const next = ALL_COLLECTIBLES.find(c => this.done < c.threshold);
    return next ? next.threshold : null;
  }

  get tasksUntilNext(): number {
    return this.nextThreshold ? this.nextThreshold - this.done : 0;
  }
}
