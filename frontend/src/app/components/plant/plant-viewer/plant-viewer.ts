import {
  Component, Input, OnInit, OnDestroy, OnChanges,
  SimpleChanges, ElementRef, ViewChild, NgZone,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import gsap from 'gsap';

type WiltLevel = 'healthy' | 'mild' | 'moderate' | 'critical';

// ─── Keywords used to detect pot vs plant parts ───────────────────────────────
const POT_KEYWORDS  = ['pot', 'vase', 'planter', 'soil', 'terra', 'clay',
                       'ceramic', 'container', 'base', 'dirt', 'ground'];
const EYE_KEYWORDS  = ['eye', 'pupil', 'iris', 'ocular', 'eyeball', 'lid'];

@Component({
  selector: 'app-plant-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer-shell" #shell>
      <canvas #canvas></canvas>
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
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px; font-size: 12px; color: #94a3b8; font-weight: 600;
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

  @Input() healthPercent: number   = 100;
  @Input() wiltingLevel:  WiltLevel = 'healthy';
  @Input() done:          number   = 0;
  @Input() total:         number   = 0;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('shell',  { static: true }) shellRef!:  ElementRef<HTMLDivElement>;

  loading = true;

  // ── Three.js core ─────────────────────────────────────────────────────────
  private renderer!: THREE.WebGLRenderer;
  private scene!:    THREE.Scene;
  private camera!:   THREE.PerspectiveCamera;
  private rafId = 0;

  // ── Scene structure ───────────────────────────────────────────────────────
  //
  //  scene
  //   ├── potGroup      ← STATIC: pot meshes, never animated
  //   └── plantRoot     ← GSAP: very subtle breathe scale + sad droop
  //        └── swayPivot   ← GSAP: very subtle side sway
  //             └── cursorPivot  ← render-loop lerp: horizontal mouse turn
  //                  └── plantGroup  ← only stem / leaves / flower meshes
  //
  private potGroup:    THREE.Group | null = null;  // static
  private plantRoot:   THREE.Group | null = null;  // animated root
  private swayPivot:   THREE.Group | null = null;
  private cursorPivot: THREE.Group | null = null;
  private plantGroup:  THREE.Group | null = null;

  // ── Eyes ──────────────────────────────────────────────────────────────────
  private eyeObjects:       THREE.Object3D[] = [];
  private eyeRestRotations: THREE.Euler[]    = [];

  // ── Combined scene bounding box (for camera fit) ──────────────────────────
  private sceneBox = new THREE.Box3();

  // ── Lights ────────────────────────────────────────────────────────────────
  private ambientLight!: THREE.AmbientLight;
  private moodLight!:    THREE.PointLight;

  // ── Mouse ─────────────────────────────────────────────────────────────────
  private mouseTarget   = { x: 0, y: 0 };
  private mouseLerped   = { x: 0, y: 0 };
  private mouseOnPage   = false;
  private onMouseMove!:  (e: MouseEvent) => void;
  private onMouseLeave!: () => void;

  // ── GSAP ──────────────────────────────────────────────────────────────────
  private idleTL:   gsap.core.Timeline | null = null;
  private sadTimer: ReturnType<typeof setInterval> | null = null;
  private prevWilt: WiltLevel = 'healthy';

  // ── Resize ────────────────────────────────────────────────────────────────
  private ro!: ResizeObserver;
  private threeReady = false;

  constructor(private zone: NgZone) {}

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      this.watchResizeAndInit();
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
    window.removeEventListener('mousemove',  this.onMouseMove);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    this.renderer?.dispose();
  }

  // ─── ResizeObserver — first call initialises Three.js ────────────────────
  private watchResizeAndInit() {
    this.ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect;
      if (!w || !h) return;

      if (!this.threeReady) {
        this.threeReady = true;
        this.initThree(w, h);
        this.loadFBX();
        this.startRenderLoop();
      } else {
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.plantRoot) this.fitCamera();
      }
    });
    this.ro.observe(this.shellRef.nativeElement);
  }

  // ─── Three.js initialisation ──────────────────────────────────────────────
  private initThree(W: number, H: number) {
    const canvas = this.canvasRef.nativeElement;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, W / H, 0.01, 1000);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 1, 0);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.ambientLight);

    const key = new THREE.DirectionalLight(0xfff8e7, 1.6);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd4edda, 0.6);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x90ee90, 0.4);
    rim.position.set(0, 10, -6);
    this.scene.add(rim);

    this.moodLight = new THREE.PointLight(0x10b981, 1.2, 25);
    this.moodLight.position.set(0, 3, 4);
    this.scene.add(this.moodLight);
  }

  // ─── Camera auto-fit using combined scene box ─────────────────────────────
  private fitCamera() {
    // Combine pot + plant bounding boxes
    this.sceneBox.makeEmpty();
    if (this.potGroup)  this.sceneBox.expandByObject(this.potGroup);
    if (this.plantRoot) this.sceneBox.expandByObject(this.plantRoot);
    if (this.sceneBox.isEmpty()) return;

    const size   = this.sceneBox.getSize(new THREE.Vector3());
    const center = this.sceneBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const distV  = (maxDim / 2) / Math.tan(fovRad / 2);
    const distH  = (maxDim / 2) / Math.tan((fovRad * this.camera.aspect) / 2);
    const dist   = Math.max(distV, distH) * 1.15;

    this.camera.position.set(center.x, center.y + size.y * 0.05, center.z + dist);
    this.camera.lookAt(center.x, center.y, center.z);
    this.camera.near = dist * 0.001;
    this.camera.far  = dist * 10;
    this.camera.updateProjectionMatrix();

    this.moodLight.position.set(center.x, center.y + size.y * 0.2, center.z + dist * 0.55);
    this.moodLight.distance = dist * 4;
  }

  // ─── FBX loading ──────────────────────────────────────────────────────────
  private loadFBX() {
    new FBXLoader().load(
      'assets/models/Flower.fbx',
      fbx  => this.onModelLoaded(fbx),
      undefined,
      err  => { console.warn('FBX failed, fallback:', err); this.buildFallbackPlant(); }
    );
  }

  private onModelLoaded(fbx: THREE.Group) {
    // 1. Normalize to 4-unit height, sit on y=0
    const box0   = new THREE.Box3().setFromObject(fbx);
    const size0  = box0.getSize(new THREE.Vector3());
    fbx.scale.setScalar(4.0 / Math.max(size0.x, size0.y, size0.z));
    const box1   = new THREE.Box3().setFromObject(fbx);
    const ctr    = box1.getCenter(new THREE.Vector3());
    fbx.position.set(-ctr.x, -box1.min.y, -ctr.z);
    fbx.rotation.y = Math.PI * (260 / 180);   // 260° left

    // 2. Material polish + shadow
    fbx.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = child.receiveShadow = true;
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) {
            m.roughness = 0.72; m.metalness = 0.0;
          }
          m.needsUpdate = true;
        });
      }
    });

    // 3. Collect eye objects BEFORE reparenting (they stay inside their subtree)
    this.eyeObjects       = [];
    this.eyeRestRotations = [];
    fbx.traverse(obj => {
      const n = obj.name.toLowerCase();
      if (EYE_KEYWORDS.some(k => n.includes(k))) {
        this.eyeObjects.push(obj);
        this.eyeRestRotations.push(new THREE.Euler().copy(obj.rotation));
      }
    });
    if (this.eyeObjects.length > 0) {
      console.log(`[PlantViewer] Found ${this.eyeObjects.length} eye object(s):`,
        this.eyeObjects.map(e => e.name));
    }

    // 4. Separate pot children from plant children
    //    We work on fbx's DIRECT children only; deeper children travel with them.
    const totalBox  = new THREE.Box3().setFromObject(fbx);
    const potCeiling = totalBox.min.y + (totalBox.max.y - totalBox.min.y) * 0.32;

    // Force matrix updates so matrixWorld is correct for each child
    fbx.updateWorldMatrix(false, true);

    const topChildren = [...fbx.children];
    this.potGroup   = new THREE.Group();
    this.plantGroup = new THREE.Group();

    for (const child of topChildren) {
      const name    = child.name.toLowerCase();
      const nameHit = POT_KEYWORDS.some(k => name.includes(k));

      // Bounding-box fallback: top of child below potCeiling → it's the pot
      const childBox  = new THREE.Box3().setFromObject(child);
      const heightHit = !nameHit && childBox.max.y <= potCeiling + 0.05;

      const isPot = nameHit || heightHit;
      const dest  = isPot ? this.potGroup : this.plantGroup;

      // Extract world transform before reparenting
      const wPos   = new THREE.Vector3();
      const wQuat  = new THREE.Quaternion();
      const wScale = new THREE.Vector3();
      child.matrixWorld.decompose(wPos, wQuat, wScale);

      dest.add(child);          // removes from fbx, adds to dest
      child.position.copy(wPos);
      child.quaternion.copy(wQuat);
      child.scale.copy(wScale);
      child.updateMatrix();
    }

    // Fallback: if nothing was classified as pot, just put everything in plantGroup
    if (this.potGroup.children.length === 0 && this.plantGroup.children.length === 0) {
      console.warn('[PlantViewer] Separation failed, using whole model as plant');
      this.plantGroup.add(fbx);
    }

    this.buildHierarchy();
  }

  private buildFallbackPlant() {
    this.potGroup   = new THREE.Group();
    this.plantGroup = new THREE.Group();

    const { pot, plant } = this.buildProceduralFlower();
    this.potGroup.add(pot);
    this.plantGroup.add(plant);
    this.buildHierarchy();
  }

  // ─── Wire up the scene hierarchy ──────────────────────────────────────────
  private buildHierarchy() {
    // Pot: completely static
    this.scene.add(this.potGroup!);

    // Plant: animated pivot chain
    this.cursorPivot = new THREE.Group();
    this.cursorPivot.add(this.plantGroup!);

    this.swayPivot = new THREE.Group();
    this.swayPivot.add(this.cursorPivot);

    this.plantRoot = new THREE.Group();
    this.plantRoot.add(this.swayPivot);
    this.scene.add(this.plantRoot);

    this.fitCamera();

    this.loading = false;
    this.playWelcome();
    this.startIdle();
    this.syncMoodState();
  }

  // ─── Procedural fallback ──────────────────────────────────────────────────
  private buildProceduralFlower(): { pot: THREE.Group; plant: THREE.Group } {
    const pot   = new THREE.Group();
    const plant = new THREE.Group();

    // Pot part
    pot.add(Object.assign(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.38, 0.7, 20),
        new THREE.MeshStandardMaterial({ color: 0xc2732e, roughness: 0.8 })
      ), { position: new THREE.Vector3(0, 0.35, 0) }
    ));
    pot.add(Object.assign(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20),
        new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 1.0 })
      ), { position: new THREE.Vector3(0, 0.72, 0) }
    ));

    // Plant part: stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 2.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.7 })
    );
    stem.position.y = 0.72 + 1.0;
    plant.add(stem);

    // Leaves
    for (let i = 0; i < 4; i++) {
      const a    = (i / 4) * Math.PI * 2;
      const geo  = new THREE.SphereGeometry(0.28, 8, 8);
      geo.scale(2.0, 0.35, 0.9);
      const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x28a745, roughness: 0.6 }));
      leaf.position.set(Math.cos(a) * 0.55, 1.0 + i * 0.32, Math.sin(a) * 0.55);
      leaf.rotation.z = a;
      plant.add(leaf);
    }

    // Flower head
    const head = new THREE.Group();
    head.position.y = 2.75;
    head.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 })
    ));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.6 })
      );
      p.position.set(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52);
      head.add(p);
    }
    plant.add(head);

    return { pot, plant };
  }

  // ─── ANIMATION: Welcome pop-in ────────────────────────────────────────────
  private playWelcome() {
    if (!this.plantRoot) return;
    const root = this.plantRoot;
    root.scale.set(0.001, 0.001, 0.001);
    root.rotation.y = -0.5;

    gsap.to(root.scale,    { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.6)',
      onComplete: () => this.playWave() });
    gsap.to(root.rotation, { y: 0, duration: 0.8, ease: 'power3.out' });
  }

  // ─── ANIMATION: Wave greeting ─────────────────────────────────────────────
  private playWave() {
    if (!this.swayPivot) return;
    const p = this.swayPivot;
    gsap.timeline()
      .to(p.rotation, { z:  0.22, duration: 0.17, ease: 'power2.out'  })
      .to(p.rotation, { z: -0.22, duration: 0.28, ease: 'sine.inOut'  })
      .to(p.rotation, { z:  0.16, duration: 0.26, ease: 'sine.inOut'  })
      .to(p.rotation, { z: -0.14, duration: 0.26, ease: 'sine.inOut'  })
      .to(p.rotation, { z:  0.06, duration: 0.20, ease: 'sine.inOut'  })
      .to(p.rotation, { z:  0,    duration: 0.18, ease: 'power2.in'   });
  }

  // ─── ANIMATION: Idle — very subtle, like quiet breathing ─────────────────
  //  • NO vertical float   (pot stays planted)
  //  • Barely-visible scale (±0.4 % in x/z, ±0.5 % in y)
  //  • Very slight lateral sway (±0.35 °)
  private startIdle() {
    if (!this.plantRoot || !this.swayPivot) return;
    this.idleTL?.kill();

    const root = this.plantRoot;
    const sway = this.swayPivot;

    // Subtle breath: inhale/exhale over 4 s
    this.idleTL = gsap.timeline({ repeat: -1 });
    this.idleTL
      .to(root.scale, { x: 1.004, y: 1.005, z: 1.004, duration: 4.0, ease: 'sine.inOut' })
      .to(root.scale, { x: 1.000, y: 1.000, z: 1.000, duration: 4.0, ease: 'sine.inOut' });

    // Barely perceptible lateral sway — independent phase
    gsap.to(sway.rotation, {
      z: 0.006, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1
    });
  }

  // ─── ANIMATION: Mood ──────────────────────────────────────────────────────
  private syncMoodState() {
    const isSad      = this.wiltingLevel !== 'healthy'
                    || (this.total > 0 && this.done / this.total < 0.4);
    const wasHealthy = this.prevWilt === 'healthy';
    this.prevWilt    = this.wiltingLevel;

    if (isSad  && wasHealthy)  this.enterSadState();
    if (!isSad && !wasHealthy) this.clearSadState();
    this.updateMoodLight();
  }

  private enterSadState() {
    if (!this.plantRoot) return;
    this.idleTL?.timeScale(0.45);
    gsap.to(this.plantRoot.rotation, { x: 0.10, duration: 1.8, ease: 'power2.out' });
    this.schedSadDip();
    this.sadTimer = setInterval(() => this.schedSadDip(), 30_000);
  }

  private schedSadDip() {
    if (!this.plantRoot) return;
    const r = this.plantRoot;
    gsap.timeline()
      .to(r.rotation, { x: 0.22,  duration: 1.0, ease: 'power2.out' })
      .to(r.position, { y: -0.05, duration: 1.0, ease: 'power2.out' }, '<')
      .to(r.rotation, { x: 0.10,  duration: 1.6, ease: 'elastic.out(1, 0.5)' })
      .to(r.position, { y: 0,     duration: 1.6, ease: 'elastic.out(1, 0.5)' }, '<');
  }

  private clearSadState() {
    clearInterval(this.sadTimer!);
    this.sadTimer = null;
    this.idleTL?.timeScale(1.0);
    if (this.plantRoot)
      gsap.to(this.plantRoot.rotation, { x: 0, duration: 1.2, ease: 'power2.inOut' });
  }

  private updateMoodLight() {
    const colors: Record<WiltLevel, number> = {
      healthy: 0x10b981, mild: 0xfbbf24, moderate: 0xf97316, critical: 0xef4444
    };
    const c = new THREE.Color(colors[this.wiltingLevel]);
    gsap.to(this.moodLight.color, { r: c.r, g: c.g, b: c.b, duration: 1.5 });
  }

  // ─── Render loop ──────────────────────────────────────────────────────────
  private startRenderLoop() {

    // ── Head (cursorPivot) limits ────────────────────────────────────────
    // Horizontal: ±38° — comfortable side-look range
    // Vertical:   +18° up  / −12° down  — head tilts up more naturally than down
    const HEAD_H   =  0.66;   // rad  ≈ ±38°
    const HEAD_V_U =  0.32;   // rad  ≈  18° up
    const HEAD_V_D = -0.21;   // rad  ≈ −12° down
    const HEAD_LRP =  0.048;  // lerp α — deliberate, like a real neck turn

    // ── Eye micro-movement on top of head rotation ───────────────────────
    // Eyes lead slightly ahead of the head and have a tighter range
    const EYE_H   = 0.22;    // rad  extra horizontal saccade
    const EYE_V   = 0.16;    // rad  extra vertical saccade
    const EYE_LRP = 0.10;    // faster than head — eyes dart first

    // ── Idle return speed when mouse leaves the page ─────────────────────
    const IDLE_LRP = 0.018;   // slow drift back to centre

    const clamp = THREE.MathUtils.clamp;

    const tick = () => {
      this.rafId = requestAnimationFrame(tick);

      // Lerp mouse toward target (or toward 0 when page is idle)
      const tx = this.mouseOnPage ? this.mouseTarget.x : 0;
      const ty = this.mouseOnPage ? this.mouseTarget.y : 0;
      const lrp = this.mouseOnPage ? HEAD_LRP : IDLE_LRP;
      this.mouseLerped.x += (tx - this.mouseLerped.x) * lrp;
      this.mouseLerped.y += (ty - this.mouseLerped.y) * lrp;

      // ── Head: full dual-axis tracking ───────────────────────────────────
      if (this.cursorPivot) {
        const wantY = clamp(this.mouseLerped.x * HEAD_H,   -HEAD_H,   HEAD_H);
        const wantX = clamp(this.mouseLerped.y * HEAD_V_U,  HEAD_V_D, HEAD_V_U);
        // Extra inner lerp so rotation eases smoothly into target each frame
        this.cursorPivot.rotation.y += (wantY - this.cursorPivot.rotation.y) * 0.08;
        this.cursorPivot.rotation.x += (wantX - this.cursorPivot.rotation.x) * 0.08;
      }

      // ── Eyes: micro-rotation layered on top of the head turn ────────────
      if (this.eyeObjects.length > 0) {
        // Eyes move slightly FURTHER than the head so they appear to lead
        const exH = clamp(-this.mouseLerped.x * EYE_H, -EYE_H, EYE_H);
        const exV = clamp( this.mouseLerped.y * EYE_V,  -EYE_V, EYE_V);

        for (let i = 0; i < this.eyeObjects.length; i++) {
          const eye  = this.eyeObjects[i];
          const rest = this.eyeRestRotations[i];
          eye.rotation.x += (rest.x + exV - eye.rotation.x) * EYE_LRP;
          eye.rotation.y += (rest.y + exH - eye.rotation.y) * EYE_LRP;
        }
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ─── Mouse tracking ───────────────────────────────────────────────────────
  private listenMouse() {
    // Use viewport-relative coords so the plant "looks toward" cursor anywhere on page
    this.onMouseMove = (e: MouseEvent) => {
      this.mouseOnPage  = true;
      // Normalise to [−1 … +1] relative to full viewport centre
      this.mouseTarget.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouseTarget.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    // When mouse leaves the browser window → drift back to looking straight
    this.onMouseLeave = () => { this.mouseOnPage = false; };

    window.addEventListener('mousemove',       this.onMouseMove,  { passive: true });
    document.addEventListener('mouseleave',    this.onMouseLeave, { passive: true });
  }
}
