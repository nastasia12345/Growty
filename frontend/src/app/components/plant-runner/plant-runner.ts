import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-plant-runner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="runner-wrap" *ngIf="visible" [class.run-right]="direction === 'right'" [class.run-left]="direction === 'left'">
      <div class="runner-plant" [class.flipped]="direction === 'left'">
        <!-- Legs -->
        <div class="legs">
          <div class="leg leg-l"></div>
          <div class="leg leg-r"></div>
        </div>
        <!-- Body -->
        <div class="body">
          <!-- Pot -->
          <div class="pot">
            <div class="pot-rim"></div>
            <div class="pot-body"></div>
          </div>
          <!-- Stem + flower -->
          <div class="stem-wrap">
            <div class="stem"></div>
            <div class="flower">
              <div class="petal p1"></div>
              <div class="petal p2"></div>
              <div class="petal p3"></div>
              <div class="petal p4"></div>
              <div class="center"></div>
            </div>
            <!-- Leaves -->
            <div class="leaf leaf-l"></div>
            <div class="leaf leaf-r"></div>
          </div>
        </div>
        <!-- Speed lines -->
        <div class="speed-lines" *ngIf="visible">
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Wrapper that slides across the viewport ── */
    .runner-wrap {
      position: fixed;
      bottom: 22px;
      z-index: 9999;
      pointer-events: none;
      will-change: transform;
    }

    /* Running right (default): enter from left, exit to right */
    .runner-wrap.run-right {
      animation: runRight 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    /* Running left: enter from right, exit to left */
    .runner-wrap.run-left {
      animation: runLeft 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    @keyframes runRight {
      0%   { left: -120px;            opacity: 0; }
      8%   { opacity: 1; }
      88%  { opacity: 1; }
      100% { left: calc(100vw + 40px); opacity: 0; }
    }
    @keyframes runLeft {
      0%   { right: -120px; left: auto; opacity: 0; }
      8%   { opacity: 1; }
      88%  { opacity: 1; }
      100% { right: calc(100vw + 40px); left: auto; opacity: 0; }
    }

    /* ── Plant body ── */
    .runner-plant {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 60px;
      animation: bob 0.22s ease-in-out infinite alternate;
    }
    .runner-plant.flipped { transform: scaleX(-1); }

    @keyframes bob {
      from { transform: translateY(0px);  }
      to   { transform: translateY(-7px); }
    }
    .runner-plant.flipped { animation: bobFlip 0.22s ease-in-out infinite alternate; }
    @keyframes bobFlip {
      from { transform: scaleX(-1) translateY(0px);  }
      to   { transform: scaleX(-1) translateY(-7px); }
    }

    /* Pot */
    .pot { display: flex; flex-direction: column; align-items: center; }
    .pot-rim {
      width: 36px; height: 7px;
      background: #d97706;
      border-radius: 4px 4px 0 0;
    }
    .pot-body {
      width: 30px; height: 20px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border-radius: 0 0 8px 8px;
      clip-path: polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%);
    }

    /* Stem + flower */
    .stem-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .stem {
      width: 5px;
      height: 22px;
      background: #16a34a;
      border-radius: 3px;
    }

    /* Flower */
    .flower {
      position: relative;
      width: 28px;
      height: 28px;
      animation: spin 2.5s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .petal {
      position: absolute;
      width: 10px; height: 14px;
      background: #f9a8d4;
      border-radius: 50%;
      left: 50%; top: 50%;
      transform-origin: 50% 100%;
    }
    .p1 { transform: translateX(-50%) translateY(-100%) rotate(0deg); }
    .p2 { transform: translateX(-50%) translateY(-100%) rotate(90deg); }
    .p3 { transform: translateX(-50%) translateY(-100%) rotate(180deg); }
    .p4 { transform: translateX(-50%) translateY(-100%) rotate(270deg); }
    .center {
      position: absolute;
      width: 12px; height: 12px;
      background: #fbbf24;
      border-radius: 50%;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      z-index: 1;
    }

    /* Leaves */
    .leaf {
      position: absolute;
      width: 14px; height: 8px;
      background: #22c55e;
      border-radius: 50%;
      top: 10px;
      animation: leafWag 0.22s ease-in-out infinite alternate;
    }
    .leaf-l { left: -14px; transform: rotate(-30deg); }
    .leaf-r { right: -14px; transform: rotate(30deg); }
    @keyframes leafWag {
      from { transform: rotate(-30deg) scaleY(1); }
      to   { transform: rotate(-40deg) scaleY(0.85); }
    }
    .leaf-r { animation-name: leafWagR; }
    @keyframes leafWagR {
      from { transform: rotate(30deg) scaleY(1); }
      to   { transform: rotate(40deg) scaleY(0.85); }
    }

    /* Legs */
    .legs {
      display: flex;
      gap: 8px;
      margin-top: 2px;
    }
    .leg {
      width: 7px; height: 14px;
      background: #16a34a;
      border-radius: 0 0 5px 5px;
      transform-origin: top center;
    }
    .leg-l { animation: legL 0.22s ease-in-out infinite alternate; }
    .leg-r { animation: legR 0.22s ease-in-out infinite alternate; }
    @keyframes legL {
      from { transform: rotate(-25deg); }
      to   { transform: rotate(25deg);  }
    }
    @keyframes legR {
      from { transform: rotate(25deg);  }
      to   { transform: rotate(-25deg); }
    }

    /* Speed lines */
    .speed-lines {
      position: absolute;
      left: -30px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .line {
      height: 2px;
      background: rgba(16,185,129,0.5);
      border-radius: 1px;
      animation: speedLine 0.22s ease-in-out infinite alternate;
    }
    .line:nth-child(1) { width: 18px; animation-delay: 0s; }
    .line:nth-child(2) { width: 12px; animation-delay: 0.05s; }
    .line:nth-child(3) { width: 8px;  animation-delay: 0.10s; }
    @keyframes speedLine {
      from { opacity: 0.8; transform: scaleX(1); }
      to   { opacity: 0.2; transform: scaleX(0.5); }
    }
  `]
})
export class PlantRunnerComponent implements OnInit, OnDestroy {
  visible   = false;
  direction: 'right' | 'left' = 'right';

  private sub!: Subscription;
  private hideTimer: any;
  private prevUrl = '';

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.sub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.onNavStart(event.url);
      }
      if (event instanceof NavigationEnd    ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError) {
        this.scheduleHide();
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.hideTimer);
  }

  private onNavStart(toUrl: string) {
    clearTimeout(this.hideTimer);

    // Determine direction based on nav order (simple heuristic)
    const pages = ['/', '/boards', '/analytics', '/plant', '/calendar'];
    const fromIdx = pages.indexOf(this.prevUrl);
    const toIdx   = pages.indexOf(toUrl);
    this.direction = (toIdx >= fromIdx) ? 'right' : 'left';
    this.prevUrl   = toUrl;

    this.visible = true;
    this.cdr.markForCheck();
  }

  private scheduleHide() {
    this.hideTimer = setTimeout(() => {
      this.visible = false;
      this.cdr.markForCheck();
    }, 1200);
  }
}
