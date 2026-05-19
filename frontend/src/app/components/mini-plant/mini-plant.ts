import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, NgZone,
  ChangeDetectorRef, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { WellbeingService } from '../../services/wellbeing.service';
import { PlantMessageService, BUBBLE_TEST_MODE } from '../../services/plant-message.service';

// ── WELLBEING TEST MODE (set true to re-enable) ───────────────────────────────
const TEST_MODE = false;

const STORAGE_KEY = 'growty_mini_plant';
const DEF_W = 130, DEF_H = 170;
const MIN_W = 90,  MIN_H = 110;
const MAX_W = 340, MAX_H = 440;

@Component({
  selector: 'app-mini-plant',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ══ SPEECH BUBBLE (outside wrap — not clipped) ══ -->
    <div class="plant-bubble"
         [class.bubble-visible]="bubbleShow"
         (click)="dismissBubble()">
      <span class="bubble-text">{{ bubbleMsg }}</span>
      <div class="bubble-tail"></div>
    </div>

    <!-- ══ PLANT WIDGET ══ -->
    <div class="mini-wrap" #wrap [class.visible]="visible">
      <canvas #canvas></canvas>
      <div class="resize-handle" #resizeHandle title="Drag to resize"></div>

      <!-- WELLBEING test btn (TEST_MODE only) -->
      <button *ngIf="testMode" class="test-survey-btn"
              (click)="openTestSurvey($event)" title="Test wellbeing survey">🧪</button>

      <!-- BUBBLE test btn (BUBBLE_TEST_MODE only) -->
      <button *ngIf="bubbleTestMode" class="test-bubble-btn"
              (click)="triggerTestBubble($event)" title="Test plant message">💬</button>
    </div>
  `,
  styles: [`
    /* ── Host: fixed position, left/top controlled by JS ── */
    :host {
      position: fixed;
      z-index: 9999;
      /* left / top set imperatively */
    }

    /* ── Container ── */
    .mini-wrap {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      background: transparent;
      cursor: grab;
      user-select: none;
      touch-action: none;
      opacity: 0;
      transform: translateY(18px) scale(0.88);
      /* Appear with spring pop, disappear with slow fade */
      transition:
        opacity   0.55s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
      will-change: opacity, transform;
      filter: drop-shadow(0 6px 20px rgba(16,185,129,0.20));
    }
    .mini-wrap:hover {
      filter: drop-shadow(0 10px 28px rgba(16,185,129,0.30));
    }
    .mini-wrap.dragging {
      cursor: grabbing;
      filter: drop-shadow(0 16px 40px rgba(16,185,129,0.35));
    }
    .mini-wrap.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      transition:
        opacity   0.85s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* Canvas fills the wrap, pointer-events off so the wrap captures drag */
    canvas {
      display: block;
      width:  100% !important;
      height: 100% !important;
      pointer-events: none;
    }

    /* ── Resize handle (bottom-right corner) ── */
    .resize-handle {
      position: absolute;
      bottom: 0;
      right:  0;
      width:  22px;
      height: 22px;
      cursor: nwse-resize;
      opacity: 0;
      transition: opacity 0.2s;
      /* Three diagonal grip lines rendered as inline SVG background */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Cg stroke='%2310b981' stroke-width='1.5' stroke-linecap='round' opacity='0.9'%3E%3Cline x1='4' y1='12' x2='12' y2='4'/%3E%3Cline x1='8' y1='12' x2='12' y2='8'/%3E%3Cline x1='12' y1='12' x2='12' y2='12'/%3E%3C/g%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 5px 5px;
    }
    .mini-wrap:hover .resize-handle,
    .mini-wrap.resizing .resize-handle { opacity: 1; }

    /* ── TEST button ── */
    .test-survey-btn {
      position: absolute;
      top: -38px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 15px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      white-space: nowrap;
      pointer-events: auto;
      z-index: 10;
    }
    .mini-wrap:hover .test-survey-btn { opacity: 1; }
    .test-survey-btn:hover { background: #10b981; transform: translateX(-50%) scale(1.08); }

    /* ── Bubble test btn (left side) ── */
    .test-bubble-btn {
      position: absolute;
      top: -38px;
      left: calc(50% - 52px);
      transform: none;
      background: #1e293b;
      color: #fff;
      border: none;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 15px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: auto;
      z-index: 10;
    }
    .mini-wrap:hover .test-bubble-btn { opacity: 1; }
    .test-bubble-btn:hover { background: #10b981; }

    /* ── Speech bubble ── */
    .plant-bubble {
      position: absolute;
      bottom: calc(100% + 14px);   /* sits above the plant widget */
      right: 0;
      width: 200px;
      background: #ffffff;
      border: 2px solid #10b981;
      border-radius: 16px;
      padding: 10px 14px;
      box-shadow: 0 8px 28px rgba(16,185,129,.22), 0 2px 8px rgba(0,0,0,.1);
      cursor: pointer;
      pointer-events: auto;
      /* hidden by default */
      opacity: 0;
      transform: translateY(8px) scale(0.92);
      transition: opacity 0.35s cubic-bezier(.22,1,.36,1),
                  transform 0.35s cubic-bezier(.34,1.56,.64,1);
    }
    .plant-bubble.bubble-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .bubble-text {
      font-size: 13px;
      font-weight: 500;
      color: #0f172a;
      line-height: 1.45;
      display: block;
    }
    /* Little triangle pointing down-right toward the plant */
    .bubble-tail {
      position: absolute;
      bottom: -10px;
      right: 20px;
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-top: 10px solid #10b981;
    }
    .bubble-tail::after {
      content: '';
      position: absolute;
      top: -12px;
      left: -7px;
      width: 0;
      height: 0;
      border-left: 7px solid transparent;
      border-right: 7px solid transparent;
      border-top: 8px solid #ffffff;
    }
  `]
})
export class MiniPlantComponent implements OnInit, OnDestroy {

  @ViewChild('canvas',       { static: true }) canvasRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('wrap',         { static: true }) wrapRef!:    ElementRef<HTMLDivElement>;
  @ViewChild('resizeHandle', { static: true }) resizeRef!:  ElementRef<HTMLDivElement>;

  visible = false;

  // ── Three.js ─────────────────────────────────────────────────────────────
  private renderer!: THREE.WebGLRenderer;
  private scene!:    THREE.Scene;
  private camera!:   THREE.PerspectiveCamera;
  private rafId = 0;
  private ready = false;
  private headPivot:   THREE.Group | null = null;
  private modelCenter = new THREE.Vector3();
  private modelSize   = new THREE.Vector3();

  // ── Look-at / mouse ───────────────────────────────────────────────────────
  private mouseX = 0; private mouseY = 0;
  private lerpX  = 0; private lerpY  = 0;
  private mouseOnPage = false;
  private onMouseMove!:  (e: MouseEvent) => void;
  private onMouseLeave!: () => void;

  // ── Drag ──────────────────────────────────────────────────────────────────
  private posX = 0; private posY = 0;
  private dragging = false;
  private dragOffX = 0; private dragOffY = 0;
  private onDragMove!: (e: MouseEvent) => void;
  private onDragEnd!:  ()              => void;

  // ── Resize ────────────────────────────────────────────────────────────────
  private sizeW = DEF_W; private sizeH = DEF_H;
  private resizing    = false;
  private resStartX   = 0; private resStartY  = 0;
  private resStartW   = 0; private resStartH  = 0;
  private onResMove!: (e: MouseEvent) => void;
  private onResEnd!:  ()              => void;

  // ── Misc ─────────────────────────────────────────────────────────────────
  private hideTimer:  ReturnType<typeof setTimeout> | null = null;
  private routerSub!: Subscription;

  // ── Test mode ─────────────────────────────────────────────────────────────
  testMode       = TEST_MODE;
  bubbleTestMode = BUBBLE_TEST_MODE;
  private testTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Speech bubble (read from service signals) ──────────────────────────────
  get bubbleShow(): boolean { return this.plantMsg.showBubble(); }
  get bubbleMsg():  string  { return this.plantMsg.currentMsg(); }

  /** Arrow fields — Angular strict template checker resolves these 100% */
  openTestSurvey = (e: MouseEvent) => {
    e.stopPropagation();
    this.wb.activePeriod.set('morning');
    this.wb.showPrompt.set(true);
  };

  triggerTestBubble = (e: MouseEvent) => {
    e.stopPropagation();
    this.plantMsg.showTestMessage();
  };

  dismissBubble = () => this.plantMsg.dismiss();

  constructor(
    private zone:     NgZone,
    private router:   Router,
    private elRef:    ElementRef,
    private wb:       WellbeingService,
    private plantMsg: PlantMessageService,
    private cdr:      ChangeDetectorRef,
  ) {
    // Re-run change detection whenever the bubble signal changes
    effect(() => {
      this.plantMsg.showBubble();
      this.plantMsg.currentMsg();
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.loadState();
    this.applyTransform();
    this.setVisible(!this.isPlantRoute(this.router.url), true);

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: any) => !this.isPlantRoute(e.urlAfterRedirects)),
      distinctUntilChanged()
    ).subscribe(show => this.setVisible(show, false));

    // WELLBEING test — auto-show survey after 5 s
    if (TEST_MODE) {
      this.testTimer = setTimeout(() => {
        this.wb.activePeriod.set('morning');
        this.wb.showPrompt.set(true);
      }, 5000);
    }

    // BUBBLE test — auto-show plant message after 5 s
    if (BUBBLE_TEST_MODE) {
      setTimeout(() => this.plantMsg.showTestMessage(), 5000);
    }

    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.loadModel();
      this.listenMouse();
      this.bindDrag();
      this.bindResize();
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    if (this.hideTimer)  clearTimeout(this.hideTimer);
    if (this.testTimer)  clearTimeout(this.testTimer);
    this.routerSub?.unsubscribe();
    window.removeEventListener('mousemove',    this.onMouseMove);
    window.removeEventListener('mousemove',    this.onDragMove);
    window.removeEventListener('mouseup',      this.onDragEnd);
    window.removeEventListener('mousemove',    this.onResMove);
    window.removeEventListener('mouseup',      this.onResEnd);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    this.renderer?.dispose();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────
  private loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (s) {
        this.posX  = +s.x; this.posY  = +s.y;
        this.sizeW = +s.w; this.sizeH = +s.h;
        return;
      }
    } catch {}
    this.posX  = window.innerWidth  - DEF_W - 24;
    this.posY  = window.innerHeight - DEF_H - 24;
    this.sizeW = DEF_W;
    this.sizeH = DEF_H;
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(
        { x: this.posX, y: this.posY, w: this.sizeW, h: this.sizeH }
      ));
    } catch {}
  }

  // ─── Apply position + size to DOM (no Angular binding — perf) ────────────
  private applyTransform() {
    // Position lives on the host element (fixed positioning)
    const host = this.elRef.nativeElement as HTMLElement;
    host.style.left = `${this.posX}px`;
    host.style.top  = `${this.posY}px`;
    // Size lives on the wrap
    const wrap = this.wrapRef.nativeElement;
    wrap.style.width  = `${this.sizeW}px`;
    wrap.style.height = `${this.sizeH}px`;
  }

  // ─── Visibility ───────────────────────────────────────────────────────────
  private setVisible(show: boolean, immediate: boolean) {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    if (show) {
      this.visible = true;
    } else if (immediate) {
      this.visible = false;
    } else {
      this.hideTimer = setTimeout(() => { this.visible = false; }, 650);
    }
  }

  private isPlantRoute(url: string): boolean {
    return url.split('?')[0] === '/plant';
  }

  // ─── Three.js init ────────────────────────────────────────────────────────
  private initThree() {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.sizeW, this.sizeH);
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure  = 1.3;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, this.sizeW / this.sizeH, 0.01, 500);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xfff8e7, 1.6);
    key.position.set(4, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd4edda, 0.6);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);
    const mood = new THREE.PointLight(0x10b981, 1.0, 20);
    mood.position.set(0, 3, 4);
    this.scene.add(mood);

    this.startLoop();
  }

  private loadModel() {
    new FBXLoader().load(
      'assets/models/Flower.fbx',
      fbx => this.onLoaded(fbx),
      undefined,
      err => console.warn('[MiniPlant] FBX failed:', err)
    );
  }

  private onLoaded(fbx: THREE.Group) {
    const b0 = new THREE.Box3().setFromObject(fbx);
    const s0 = b0.getSize(new THREE.Vector3());
    fbx.scale.setScalar(4.0 / Math.max(s0.x, s0.y, s0.z));
    const b1  = new THREE.Box3().setFromObject(fbx);
    const ctr = b1.getCenter(new THREE.Vector3());
    fbx.position.set(-ctr.x, -b1.min.y, -ctr.z);
    fbx.rotation.y = Math.PI * (260 / 180);

    fbx.traverse(child => {
      if (child instanceof THREE.Mesh) {
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) { m.roughness = 0.72; m.metalness = 0; }
          m.needsUpdate = true;
        });
      }
    });

    this.headPivot = new THREE.Group();
    this.headPivot.add(fbx);
    this.scene.add(this.headPivot);

    const b2 = new THREE.Box3().setFromObject(this.headPivot);
    this.modelSize.copy(b2.getSize(new THREE.Vector3()));
    this.modelCenter.copy(b2.getCenter(new THREE.Vector3()));
    this.fitCamera();
    this.ready = true;
  }

  private fitCamera() {
    if (!this.modelSize.length()) return;
    const c = this.modelCenter, s = this.modelSize;
    const dist = (Math.max(s.x, s.y, s.z) / 2 / Math.tan(THREE.MathUtils.degToRad(19))) * 1.12;
    this.camera.position.set(c.x, c.y + s.y * 0.05, c.z + dist);
    this.camera.lookAt(c.x, c.y, c.z);
    this.camera.aspect = this.sizeW / this.sizeH;
    this.camera.near   = dist * 0.001;
    this.camera.far    = dist * 10;
    this.camera.updateProjectionMatrix();
  }

  // ─── Render loop ──────────────────────────────────────────────────────────
  private startLoop() {
    const clamp    = THREE.MathUtils.clamp;
    const HEAD_H   = 0.55, HEAD_V_U = 0.25, HEAD_V_D = -0.16;
    const HEAD_LRP = 0.048, IDLE_LRP = 0.016;

    const tick = () => {
      this.rafId = requestAnimationFrame(tick);

      // Pause look-at while user is dragging (keeps face stable during move)
      const active = this.mouseOnPage && !this.dragging && !this.resizing;
      const tx  = active ? this.mouseX : 0;
      const ty  = active ? this.mouseY : 0;
      const lrp = active ? HEAD_LRP : IDLE_LRP;

      this.lerpX += (tx - this.lerpX) * lrp;
      this.lerpY += (ty - this.lerpY) * lrp;

      if (this.ready && this.headPivot) {
        const wantY = clamp(this.lerpX * HEAD_H,   -HEAD_H,   HEAD_H);
        const wantX = clamp(this.lerpY * HEAD_V_U,  HEAD_V_D, HEAD_V_U);
        this.headPivot.rotation.y += (wantY - this.headPivot.rotation.y) * 0.08;
        this.headPivot.rotation.x += (wantX - this.headPivot.rotation.x) * 0.08;
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ─── Drag ─────────────────────────────────────────────────────────────────
  private bindDrag() {
    const wrap = this.wrapRef.nativeElement;
    const host = this.elRef.nativeElement as HTMLElement;

    wrap.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as Element).closest('.resize-handle')) return;
      e.preventDefault();
      this.dragging = true;
      this.dragOffX = e.clientX - this.posX;
      this.dragOffY = e.clientY - this.posY;
      wrap.classList.add('dragging');
    });

    this.onDragMove = (e: MouseEvent) => {
      if (!this.dragging) return;
      this.posX = Math.max(0, Math.min(window.innerWidth  - this.sizeW, e.clientX - this.dragOffX));
      this.posY = Math.max(0, Math.min(window.innerHeight - this.sizeH, e.clientY - this.dragOffY));
      host.style.left = `${this.posX}px`;
      host.style.top  = `${this.posY}px`;
    };

    this.onDragEnd = () => {
      if (!this.dragging) return;
      this.dragging = false;
      wrap.classList.remove('dragging');
      this.saveState();
    };

    window.addEventListener('mousemove', this.onDragMove, { passive: true });
    window.addEventListener('mouseup',   this.onDragEnd);
  }

  // ─── Resize ───────────────────────────────────────────────────────────────
  private bindResize() {
    const wrap   = this.wrapRef.nativeElement;
    const handle = this.resizeRef.nativeElement;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.resizing  = true;
      this.resStartX = e.clientX; this.resStartY = e.clientY;
      this.resStartW = this.sizeW; this.resStartH = this.sizeH;
      wrap.classList.add('resizing');
    });

    this.onResMove = (e: MouseEvent) => {
      if (!this.resizing) return;
      this.sizeW = Math.max(MIN_W, Math.min(MAX_W, this.resStartW + (e.clientX - this.resStartX)));
      this.sizeH = Math.max(MIN_H, Math.min(MAX_H, this.resStartH + (e.clientY - this.resStartY)));
      wrap.style.width  = `${this.sizeW}px`;
      wrap.style.height = `${this.sizeH}px`;
      this.renderer.setSize(this.sizeW, this.sizeH);
      this.fitCamera();
    };

    this.onResEnd = () => {
      if (!this.resizing) return;
      this.resizing = false;
      wrap.classList.remove('resizing');
      this.saveState();
    };

    window.addEventListener('mousemove', this.onResMove, { passive: true });
    window.addEventListener('mouseup',   this.onResEnd);
  }

  // ─── Mouse look-at ────────────────────────────────────────────────────────
  private listenMouse() {
    this.onMouseMove = (e: MouseEvent) => {
      this.mouseOnPage = true;
      this.mouseX =  (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    this.onMouseLeave = () => { this.mouseOnPage = false; };
    window.addEventListener('mousemove',    this.onMouseMove,  { passive: true });
    document.addEventListener('mouseleave', this.onMouseLeave, { passive: true });
  }
}
