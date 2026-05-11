import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AnalyticsService } from '../../services/analytics';

interface Collectible {
  emoji: string;
  name: string;
  threshold: number;
}

const ALL_COLLECTIBLES: Collectible[] = [
  { emoji: '🌾', name: 'Пшениця',  threshold: 25  },
  { emoji: '🦋', name: 'Метелик',  threshold: 50  },
  { emoji: '🌻', name: 'Соняшник', threshold: 75  },
  { emoji: '🍄', name: 'Гриб',     threshold: 100 },
  { emoji: '🌈', name: 'Веселка',  threshold: 125 },
  { emoji: '⭐', name: 'Зірка',    threshold: 150 },
  { emoji: '🦄', name: 'Єдиноріг', threshold: 200 },
  { emoji: '🏆', name: 'Трофей',   threshold: 250 },
];

@Component({
  selector: 'app-plant',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './plant.html',
  styleUrls: ['./plant.css']
})
export class PlantComponent implements OnInit {
  todo       = 0;
  inProgress = 0;
  done       = 0;
  isLoading  = true;
  hasError   = false;

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.analyticsService.getTasksByStatus().pipe(
      timeout(8000),
      catchError(() => {
        this.hasError  = true;
        this.isLoading = false;
        this.cdr.markForCheck();
        return of({ todo: 0, inProgress: 0, done: 0 });
      })
    ).subscribe(data => {
      this.todo       = data.todo;
      this.inProgress = data.inProgress;
      this.done       = data.done;
      this.isLoading  = false;
      this.cdr.markForCheck();
    });
  }

  get total(): number { return this.todo + this.inProgress + this.done; }

  get healthPercent(): number {
    if (this.total === 0) return 0;
    const rate = this.done / this.total + (this.inProgress / this.total) * 0.3;
    return Math.min(100, Math.round(rate * 100));
  }

  get healthLabel(): string {
    const hp = this.healthPercent;
    if (hp >= 80) return 'Excellent';
    if (hp >= 60) return 'Good';
    if (hp >= 40) return 'Fair';
    if (hp >= 20) return 'Weak';
    return 'Critical';
  }

  get healthColor(): string {
    const hp = this.healthPercent;
    if (hp >= 60) return '#10b981';
    if (hp >= 30) return '#f59e0b';
    return '#ef4444';
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
