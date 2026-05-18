import {
  Component, Input, OnInit, OnDestroy, OnChanges,
  SimpleChanges, ElementRef, ViewChild, NgZone,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import gsap from 'gsap';

// ─── Types ────────────────────────────────────────────────────────────────────
type WiltLevel = 'healthy' | 'mild' | 'moderate' | 'critical';

@Component({
  selector: 'app-plant-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer-shell" #shell>
      <canvas #canvas></canvas>
      <div class="loader-dot" *ngIf="loading">
        <div class="dot"></div>
        <span>Growing…</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }

    .viewer-shell {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 300px;
    }

    canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
      border-radius: 14px;
    }

    .loader-dot {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
    }
    .dot {
      width: 14px; height: 14px; border-radius: 50%;
      background: #10b981;
      animation: dotPulse 1s ease-in-out infinite;
    }
    @keyframes dotPulse {
      0%,100% { transform: scale(1);   opacity: 1; }
      50%      { transform: scale(1.6); opacity: 0.5; }
    }
  `]
})
export class PlantViewerComponent implements OnInit, OnDestroy, OnChanges {

  @Input() healthPercent: number  = 100;
  @Input() wiltingLevel: WiltLevel = 'healthy';
  @Input() done:         number   = 0;
  @Input() total:        number   = 0;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('shell',  { static: true }) shellRef!:  ElementRef<HTMLDivElement>;

  loading = true;

  // ── Three.js core ─────────────────────────────────────────────────────────
  private renderer!: THREE.WebGLRenderer;
  private scene!:    THREE.Scene;
  private camera!:   THREE.PerspectiveCamera;
  private rafId     = 0;

  // ── Plant hierarchy ───────────────────────────────────────────────────────
  //  scene
  //   └── plantRoot   ← GSAP: position.y (float), scale (breathe), rotation.x (sad)
  //         └── swayPivot  ← GSAP: rotation.z (sway)
  //               └── cursorPivot  ← render-loop lerp: rotation.y (mouse)
  //                     └── fbxModel
  private plantRoot:   THREE.Group | null = null;
  private swayPivot:   THREE.Group | null = null;
  private cursorPivot: THREE.Group | null = null;

  // ── Ambient & mood light ───────────────────────────────────────────────────
  private ambientLight!:    THREE.AmbientLight;
  private moodLight!:       THREE.PointLight;

  // ── Mouse tracking ────────────────────────────────────────────────────────
  private mouseTarget  = { x: 0, y: 0 };
  private mouseLerped  = { x: 0, y: 0 };
  private onMouseMove!: (e: MouseEvent) => void;

  // ── GSAP timelines ────────────────────────────────────────────────────────
  private idleTL:   gsap.core.Timeline | null = null;
  private sadTimer: ReturnType<typeof setInterval> | null = null;
  private prevWilt: WiltLevel = 'healthy';

  // ── Resize ────────────────────────────────────────────────────────────────
  private ro!: ResizeObserver;

  constructor(private zone: NgZone) {}

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.loadFBX();
      this.startRenderLoop();
      this.watchResize();
      this.listenMouse();
    });
  }

  ngOnChanges(c: SimpleChanges) {
    if ((c['wiltingLevel'] || c['done'] || c['total']) && this.plantRoot) {
      this.syncMoodState();
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    this.idleTL?.kill();
    gsap.killTweensOf(this.plantRoot);
    gsap.killTweensOf(this.swayPivot);
    clearInterval(this.sadTimer!);
    this.ro?.disconnect();
    window.removeEventListener('mousemove', this.onMouseMove);
    this.renderer?.dispose();
  }

  // ─── Three.js setup ───────────────────────────────────────────────────────
  private initThree() {
    const canvas = this.canvasRef.nativeElement;
    const shell  = this.shellRef.nativeElement;
    const W = shell.clientWidth  || 400;
    const H = shell.clientHeight || 320;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 500);
    this.camera.position.set(0, 1.8, 6);
    this.camera.lookAt(0, 1.2, 0);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambientLight);

    const key = new THREE.DirectionalLight(0xfff8e7, 1.4);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd4edda, 0.5);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x90ee90, 0.35);
    rim.position.set(0, 10, -6);
    this.scene.add(rim);

    this.moodLight = new THREE.PointLight(0x10b981, 1.0, 15);
    this.moodLight.position.set(0, 2, 3);
    this.scene.add(this.moodLight);
  }

  // ─── FBX loading ──────────────────────────────────────────────────────────
  private loadFBX() {
    const loader = new FBXLoader();
    loader.load(
      'assets/models/Flower.fbx',
      (fbx) => this.onModelLoaded(fbx),
      undefined,
      (err) => { console.warn('FBX load failed, using fallback:', err); this.buildFallbackPlant(); }
    );
  }

  private onModelLoaded(fbx: THREE.Group) {
    // ── Normalise model size ───────────────────────────────────────────
    const box    = new THREE.Box3().setFromObject(fbx);
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale  = 2.8 / maxDim;
    fbx.scale.setScalar(scale);

    // Re-compute after scale
    box.setFromObject(fbx);
    const center = box.getCenter(new THREE.Vector3());
    fbx.position.x = -center.x;
    fbx.position.y = -box.min.y;   // sit on y=0
    fbx.position.z = -center.z;

    // Shadows + material polish
    fbx.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial) {
            m.roughness  = 0.75;
            m.metalness  = 0.0;
            (m as any).needsUpdate = true;
          }
        });
      }
    });

    this.buildHierarchy(fbx);
  }

  private buildFallbackPlant() {
    const fbx = this.buildProceduralFlower();
    this.buildHierarchy(fbx);
  }

  private buildHierarchy(model: THREE.Object3D) {
    // Three-level pivot hierarchy for clean animation separation
    this.cursorPivot = new THREE.Group();
    this.cursorPivot.add(model);

    this.swayPivot = new THREE.Group();
    this.swayPivot.add(this.cursorPivot);

    this.plantRoot = new THREE.Group();
    this.plantRoot.add(this.swayPivot);
    this.scene.add(this.plantRoot);

    this.loading = false;
    this.playWelcome();
    this.startIdle();
    this.syncMoodState();
  }

  // ─── Procedural fallback plant ────────────────────────────────────────────
  private buildProceduralFlower(): THREE.Group {
    const g = new THREE.Group();

    // Pot
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.38, 0.7, 20),
      new THREE.MeshStandardMaterial({ color: 0xc2732e, roughness: 0.8 })
    );
    pot.position.y = 0.35;
    g.add(pot);

    // Soil
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 1.0 })
    );
    soil.position.y = 0.72;
    g.add(soil);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 2.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.7 })
    );
    stem.position.y = 1.73;
    g.add(stem);

    // Leaves
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const leafG = new THREE.SphereGeometry(0.28, 8, 8);
      leafG.scale(2.0, 0.35, 0.9);
      const leaf = new THREE.Mesh(leafG, new THREE.MeshStandardMaterial({ color: 0x28a745, roughness: 0.6 }));
      leaf.position.set(Math.cos(a) * 0.55, 1.0 + i * 0.32, Math.sin(a) * 0.55);
      leaf.rotation.z = a;
      g.add(leaf);
    }

    // Flower head group (becomes cursorPivot child → tracked by mouse)
    const headGroup = new THREE.Group();
    headGroup.position.y = 2.75;

    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 })
    );
    headGroup.add(center);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.6 })
      );
      petal.position.set(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
      headGroup.add(petal);
    }

    g.add(headGroup);
    return g;
  }

  // ─── ANIMATION: Welcome ───────────────────────────────────────────────────
  private playWelcome() {
    if (!this.plantRoot) return;
    const root = this.plantRoot;
    root.scale.set(0.001, 0.001, 0.001);
    root.rotation.y = -0.6;

    // Pop in with spring
    gsap.to(root.scale, { x: 1, y: 1, z: 1, duration: 0.85, ease: 'back.out(1.8)',
      onComplete: () => this.playWave()
    });
    gsap.to(root.rotation, { y: 0, duration: 0.85, ease: 'power3.out' });
  }

  // ─── ANIMATION: Wave greeting ─────────────────────────────────────────────
  private playWave() {
    if (!this.swayPivot) return;
    const p = this.swayPivot;
    const tl = gsap.timeline();
    tl.to(p.rotation, { z:  0.32, duration: 0.18, ease: 'power2.out' })
      .to(p.rotation, { z: -0.32, duration: 0.30, ease: 'sine.inOut' })
      .to(p.rotation, { z:  0.24, duration: 0.28, ease: 'sine.inOut' })
      .to(p.rotation, { z: -0.22, duration: 0.28, ease: 'sine.inOut' })
      .to(p.rotation, { z:  0.10, duration: 0.22, ease: 'sine.inOut' })
      .to(p.rotation, { z:  0,    duration: 0.20, ease: 'power2.in'  });
  }

  // ─── ANIMATION: Idle (always running) ────────────────────────────────────
  private startIdle() {
    if (!this.plantRoot || !this.swayPivot) return;
    this.idleTL?.kill();

    const root = this.plantRoot;
    const sway = this.swayPivot;

    this.idleTL = gsap.timeline({ repeat: -1 });

    // Floating up/down
    this.idleTL.to(root.position, { y: 0.09,  duration: 2.4, ease: 'sine.inOut' })
               .to(root.position, { y: 0,      duration: 2.4, ease: 'sine.inOut' });

    // Breathing scale (separate, offset phase)
    gsap.to(root.scale, { x: 1.018, y: 1.030, z: 1.018,
      duration: 2.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    // Gentle sway
    gsap.to(sway.rotation, { z: 0.028, duration: 3.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  // ─── ANIMATION: Mood sync ─────────────────────────────────────────────────
  private syncMoodState() {
    const isSad = this.wiltingLevel !== 'healthy'
               || (this.total > 0 && this.done / this.total < 0.4);

    const wasHealthy = this.prevWilt === 'healthy';
    const isNowSad   = isSad;
    this.prevWilt    = this.wiltingLevel;

    if (isNowSad && wasHealthy) {
      this.enterSadState();
    } else if (!isNowSad && !wasHealthy) {
      this.clearSadState();
    }
    this.updateMoodLight();
  }

  private enterSadState() {
    if (!this.plantRoot || !this.swayPivot) return;
    const root = this.plantRoot;

    // Slow down all GSAP animations by setting timescale on the idle TL
    this.idleTL?.timeScale(0.4);

    // Droop forward
    gsap.to(root.rotation, { x: 0.20, duration: 1.6, ease: 'power2.out' });

    // Schedule periodic sad dip (every 30 s)
    this.schedSadDip();
    this.sadTimer = setInterval(() => this.schedSadDip(), 30_000);
  }

  private schedSadDip() {
    if (!this.plantRoot) return;
    const root = this.plantRoot;
    gsap.timeline()
      .to(root.rotation,  { x: 0.38, duration: 0.9, ease: 'power2.out' })
      .to(root.position,  { y: -0.14, duration: 0.9, ease: 'power2.out' }, '<')
      .to(root.rotation,  { x: 0.20, duration: 1.4, ease: 'elastic.out(1, 0.45)' })
      .to(root.position,  { y: 0,    duration: 1.4, ease: 'elastic.out(1, 0.45)' }, '<');
  }

  private clearSadState() {
    clearInterval(this.sadTimer!);
    this.sadTimer = null;
    this.idleTL?.timeScale(1.0);
    if (!this.plantRoot) return;
    gsap.to(this.plantRoot.rotation, { x: 0, duration: 1.2, ease: 'power2.inOut' });
  }

  private updateMoodLight() {
    const colors: Record<WiltLevel, number> = {
      healthy:  0x10b981,
      mild:     0xfbbf24,
      moderate: 0xf97316,
      critical: 0xef4444
    };
    const target = new THREE.Color(colors[this.wiltingLevel]);
    gsap.to(this.moodLight.color, {
      r: target.r, g: target.g, b: target.b, duration: 1.5
    });
  }

  // ─── Render loop ──────────────────────────────────────────────────────────
  private startRenderLoop() {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);

      // Smooth cursor tracking on cursorPivot (y-axis look only)
      this.mouseLerped.x += (this.mouseTarget.x - this.mouseLerped.x) * 0.038;

      if (this.cursorPivot) {
        this.cursorPivot.rotation.y +=
          (this.mouseLerped.x * 0.28 - this.cursorPivot.rotation.y) * 0.06;
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ─── Mouse tracking ───────────────────────────────────────────────────────
  private listenMouse() {
    this.onMouseMove = (e: MouseEvent) => {
      const rect = this.shellRef.nativeElement.getBoundingClientRect();
      this.mouseTarget.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      this.mouseTarget.y = ((e.clientY - rect.top)  / rect.height - 0.5) * -2;
    };
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
  }

  // ─── Resize observer ──────────────────────────────────────────────────────
  private watchResize() {
    this.ro = new ResizeObserver(() => {
      const el = this.shellRef.nativeElement;
      const w  = el.clientWidth;
      const h  = el.clientHeight;
      if (w && h) {
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
    });
    this.ro.observe(this.shellRef.nativeElement);
  }
}
