import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges,
  SimpleChanges, ElementRef, ViewChild, NgZone,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import gsap from 'gsap';

type WiltLevel = 'healthy' | 'mild' | 'moderate' | 'critical';

// ─── Placed collectible item ──────────────────────────────────────────────────
export interface PlacedItem {
  emoji: string;
  x: number;
  y: number;
  z: number;
}

// ─── Keywords used to detect pot vs plant parts ───────────────────────────────
const POT_KEYWORDS  = ['pot', 'vase', 'planter', 'soil', 'terra', 'clay',
                       'ceramic', 'container', 'base', 'dirt', 'ground'];
const EYE_KEYWORDS  = ['eye', 'pupil', 'iris', 'ocular', 'eyeball', 'lid'];

// Pixels of movement before a pointerdown→pointerup is treated as a drag
const DRAG_THRESHOLD_PX = 5;

@Component({
  selector: 'app-plant-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer-shell" #shell
         (dragover)="onDragOver($event)"
         (drop)="onDrop($event)"
         (dragleave)="onDragLeave($event)">
      <canvas #canvas></canvas>
      <div class="drop-overlay" [class.active]="isDragOver">
        <span class="drop-hint">🌿</span>
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
      cursor: pointer;
    }
    canvas:active { cursor: grabbing; }

    /* ── Drop-zone overlay (shelf → canvas DnD) ── */
    .drop-overlay {
      position: absolute;
      inset: 0;
      border-radius: 14px;
      border: 2.5px dashed transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .drop-overlay.active {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.08);
    }
    .drop-hint {
      font-size: 30px;
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.15s, transform 0.15s;
      filter: drop-shadow(0 2px 6px rgba(16,185,129,0.5));
    }
    .drop-overlay.active .drop-hint {
      opacity: 1;
      transform: scale(1.15);
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

  @Input()  healthPercent: number   = 100;
  @Input()  wiltingLevel:  WiltLevel = 'healthy';
  @Input()  done:          number   = 0;
  @Input()  total:         number   = 0;
  @Input()  placements:    PlacedItem[] = [];

  /** Fired when user drops a new emoji onto the canvas (shelf → canvas DnD). */
  @Output() placed  = new EventEmitter<PlacedItem>();
  /** Fired when user drags an already-placed sprite to a new position. */
  @Output() moved   = new EventEmitter<PlacedItem>();
  /** Fired when user double-clicks a placed sprite to remove it. */
  @Output() removed = new EventEmitter<string>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('shell',  { static: true }) shellRef!:  ElementRef<HTMLDivElement>;

  loading    = true;
  isDragOver = false;   // shelf-drag overlay

  // ── Three.js core ─────────────────────────────────────────────────────────
  private renderer!: THREE.WebGLRenderer;
  private scene!:    THREE.Scene;
  private camera!:   THREE.PerspectiveCamera;
  private rafId = 0;

  // ── Scene hierarchy ───────────────────────────────────────────────────────
  private potGroup:    THREE.Group | null = null;
  private plantRoot:   THREE.Group | null = null;
  private swayPivot:   THREE.Group | null = null;
  private cursorPivot: THREE.Group | null = null;
  private plantGroup:  THREE.Group | null = null;

  // ── Eyes ──────────────────────────────────────────────────────────────────
  private eyeObjects:       THREE.Object3D[] = [];
  private eyeRestRotations: THREE.Euler[]    = [];

  // ── Decoration sprites ────────────────────────────────────────────────────
  private decorSprites: THREE.Sprite[]    = [];
  private decorTweens:  gsap.core.Tween[] = [];

  // ── Sprite interaction (in-scene drag / remove) ───────────────────────────
  private raycaster             = new THREE.Raycaster();
  private isDraggingSprite      = false;
  private dragSpriteIdx         = -1;
  private hasDragged            = false;
  private dragStartPos          = { x: 0, y: 0 };
  /**
   * When true, the next `updateDecorSprites` call is a no-op.
   * Set after an in-scene sprite drag so the parent position-save doesn't
   * trigger a full visual rebuild (the sprite is already at the right place).
   */
  private skipNextDecorRebuild  = false;

  private onPointerDown!: (e: PointerEvent) => void;
  private onPointerMove!: (e: PointerEvent) => void;
  private onPointerUp!:   (e: PointerEvent) => void;

  // ── Combined scene bounding box ───────────────────────────────────────────
  private sceneBox = new THREE.Box3();

  // ── Lights ────────────────────────────────────────────────────────────────
  private ambientLight!: THREE.AmbientLight;
  private moodLight!:    THREE.PointLight;

  // ── Mouse tracking ────────────────────────────────────────────────────────
  private mouseTarget   = { x: 0, y: 0 };
  private mouseLerped   = { x: 0, y: 0 };
  private mouseOnPage   = false;
  private onMouseMove!:  (e: MouseEvent) => void;
  private onMouseLeave!: () => void;

  // ── GSAP ──────────────────────────────────────────────────────────────────
  private idleTL:   gsap.core.Timeline | null = null;
  private sadTimer: ReturnType<typeof setInterval> | null = null;
  private prevWilt: WiltLevel = 'healthy';
  private jumpActive = false;

  // ── Misc event handlers ───────────────────────────────────────────────────
  private onDblClick!: (e: MouseEvent) => void;

  private readonly WILT_SCALES: Record<WiltLevel, number> = {
    healthy: 1.00, mild: 0.88, moderate: 0.74, critical: 0.58,
  };

  // ── Resize ────────────────────────────────────────────────────────────────
  private ro!: ResizeObserver;
  private threeReady = false;

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  // ──────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      this.watchResizeAndInit();
      this.listenMouse();
      this.listenDblClick();
      this.listenSpriteInteraction();
    });
  }

  ngOnChanges(c: SimpleChanges) {
    if ((c['wiltingLevel'] || c['done'] || c['total']) && this.plantRoot) {
      this.syncMoodState();
    }
    if (c['placements'] && this.scene) {
      this.updateDecorSprites();
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    this.idleTL?.kill();
    gsap.killTweensOf(this.plantRoot);
    gsap.killTweensOf(this.swayPivot);
    this.clearDecorSprites();
    clearInterval(this.sadTimer!);
    this.ro?.disconnect();
    window.removeEventListener('mousemove',    this.onMouseMove);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    const shell = this.shellRef?.nativeElement;
    shell?.removeEventListener('dblclick',    this.onDblClick);
    shell?.removeEventListener('pointerdown', this.onPointerDown);
    shell?.removeEventListener('pointermove', this.onPointerMove);
    shell?.removeEventListener('pointerup',   this.onPointerUp);
    this.renderer?.dispose();
  }

  // ─── HTML5 DnD handlers (shelf → canvas) ─────────────────────────────────

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (!this.isDragOver) {
      this.isDragOver = true;
      this.cdr.markForCheck();
    }
  }

  onDragLeave(e: DragEvent): void {
    const shell = this.shellRef.nativeElement;
    if (!shell.contains(e.relatedTarget as Node)) {
      this.isDragOver = false;
      this.cdr.markForCheck();
    }
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
    this.cdr.markForCheck();

    const emoji = e.dataTransfer?.getData('text/plain');
    if (!emoji || !this.camera) return;

    const rect    = this.shellRef.nativeElement.getBoundingClientRect();
    const world   = this.canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
    world.x = THREE.MathUtils.clamp(world.x, -2.5, 2.5);
    world.y = THREE.MathUtils.clamp(world.y,  0.0, 4.5);

    this.zone.run(() => {
      this.placed.emit({ emoji, x: world.x, y: world.y, z: world.z });
    });
  }

  // ─── Sprite interaction — drag to move, double-click to remove ─────────────

  private listenSpriteInteraction() {
    const shell  = this.shellRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    // ── Pointer down ─────────────────────────────────────────────────────────
    this.onPointerDown = (e: PointerEvent) => {
      if (!this.camera || this.decorSprites.length === 0) return;

      const hit = this.spriteAt(e.clientX, e.clientY);
      if (hit === -1) return;

      this.isDraggingSprite = true;
      this.dragSpriteIdx    = hit;
      this.hasDragged       = false;
      this.dragStartPos     = { x: e.clientX, y: e.clientY };

      // Kill the floating-bob tween so we can move freely
      this.decorTweens[hit]?.kill();

      // Lift the sprite slightly as visual feedback
      const sprite = this.decorSprites[hit];
      gsap.to(sprite.scale, { x: 0.82, y: 0.82, duration: 0.12, ease: 'power2.out' });

      shell.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };

    // ── Pointer move ─────────────────────────────────────────────────────────
    this.onPointerMove = (e: PointerEvent) => {
      if (!this.isDraggingSprite) {
        // Hover cursor: show "grab" when hovering over a placed sprite
        if (this.camera && this.decorSprites.length > 0) {
          canvas.style.cursor = this.spriteAt(e.clientX, e.clientY) !== -1 ? 'grab' : 'pointer';
        }
        return;
      }

      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;
      if (!this.hasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        this.hasDragged = true;
      }

      if (this.hasDragged) {
        const rect  = shell.getBoundingClientRect();
        const world = this.canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
        world.x = THREE.MathUtils.clamp(world.x, -2.5, 2.5);
        world.y = THREE.MathUtils.clamp(world.y,  0.0, 4.5);
        this.decorSprites[this.dragSpriteIdx].position.set(world.x, world.y, world.z);
      }
    };

    // ── Pointer up ───────────────────────────────────────────────────────────
    this.onPointerUp = (e: PointerEvent) => {
      if (!this.isDraggingSprite) return;

      const wasDrag = this.hasDragged;
      const idx     = this.dragSpriteIdx;
      const sprite  = this.decorSprites[idx];
      const item    = this.placements[idx];

      this.isDraggingSprite = false;
      this.dragSpriteIdx    = -1;
      this.hasDragged       = false;
      canvas.style.cursor   = 'pointer';

      // Scale back to normal
      gsap.to(sprite.scale, { x: 0.68, y: 0.68, duration: 0.18, ease: 'back.out(2)' });

      if (wasDrag && item) {
        const { x, y, z } = sprite.position;

        // Restart bob from the new resting position
        const bobAmp = 0.08 + Math.random() * 0.04;
        const bobDur = 1.8  + Math.random() * 0.7;
        this.decorTweens[idx] = gsap.to(sprite.position, {
          y: y + bobAmp,
          duration: bobDur,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        // Skip the visual rebuild triggered by the parent saving the new position
        this.skipNextDecorRebuild = true;
        this.zone.run(() => {
          this.moved.emit({ emoji: item.emoji, x, y, z });
        });

      } else {
        // Pure click on sprite (no drag): just restart the bob
        const { y } = sprite.position;
        const bobAmp = 0.08 + Math.random() * 0.04;
        const bobDur = 1.8  + Math.random() * 0.7;
        this.decorTweens[idx] = gsap.to(sprite.position, {
          y: y + bobAmp,
          duration: bobDur,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
    };

    shell.addEventListener('pointerdown', this.onPointerDown);
    shell.addEventListener('pointermove', this.onPointerMove);
    shell.addEventListener('pointerup',   this.onPointerUp);
  }

  // ─── Double-click: remove sprite OR bounce plant ──────────────────────────

  private listenDblClick() {
    this.onDblClick = (e: MouseEvent) => {
      // First check if the click landed on a placed sprite
      if (this.camera && this.decorSprites.length > 0) {
        const idx = this.spriteAt(e.clientX, e.clientY);
        if (idx !== -1 && idx < this.placements.length) {
          this.removeSpriteAt(idx);
          return;   // ← don't bounce the plant
        }
      }

      // No sprite hit → play the bounce jump
      if (this.jumpActive || !this.plantRoot) return;
      this.playJump();
    };
    this.shellRef.nativeElement.addEventListener('dblclick', this.onDblClick);
  }

  /**
   * Animated removal of the sprite at `idx`.
   * Splices it from the tracking arrays immediately to prevent re-add if
   * `updateDecorSprites` runs during the exit animation.
   */
  private removeSpriteAt(idx: number): void {
    const sprite = this.decorSprites.splice(idx, 1)[0];
    this.decorTweens.splice(idx, 1)[0]?.kill();
    const item   = this.placements[idx];
    if (!item) return;

    const emoji = item.emoji;

    // Pop-out exit animation, then dispose + notify parent
    gsap.timeline({
      onComplete: () => {
        this.scene?.remove(sprite);
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        sprite.material.dispose();
        this.zone.run(() => { this.removed.emit(emoji); });
      }
    })
      .to(sprite.scale,    { x: 1.25, y: 1.25, duration: 0.10, ease: 'back.out(2)'  })
      .to(sprite.scale,    { x: 0.01, y: 0.01, duration: 0.22, ease: 'power3.in'    })
      .to(sprite.material as THREE.SpriteMaterial,
                           { opacity: 0,        duration: 0.22, ease: 'power2.in'    }, '<0.05');
  }

  // ─── Raycasting helper ────────────────────────────────────────────────────

  /** Returns the index in `decorSprites` that the screen point hits, or -1. */
  private spriteAt(clientX: number, clientY: number): number {
    const rect = this.shellRef.nativeElement.getBoundingClientRect();
    const ndcX =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hits = this.raycaster.intersectObjects(this.decorSprites);
    if (hits.length === 0) return -1;
    return this.decorSprites.indexOf(hits[0].object as THREE.Sprite);
  }

  // ─── Canvas coordinate → 3-D world position ──────────────────────────────

  private canvasToWorld(canvasX: number, canvasY: number): THREE.Vector3 {
    const rect = this.shellRef.nativeElement.getBoundingClientRect();
    const ndcX =  (canvasX / rect.width)  * 2 - 1;
    const ndcY = -((canvasY / rect.height) * 2 - 1);

    const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
    vec.unproject(this.camera);

    const dir = vec.clone().sub(this.camera.position).normalize();

    const SPRITE_DEPTH = 1.0;
    if (Math.abs(dir.z) < 0.0001) return new THREE.Vector3(0, 1.5, SPRITE_DEPTH);

    const t = (SPRITE_DEPTH - this.camera.position.z) / dir.z;
    return new THREE.Vector3(
      this.camera.position.x + dir.x * t,
      this.camera.position.y + dir.y * t,
      SPRITE_DEPTH,
    );
  }

  // ─── ResizeObserver ───────────────────────────────────────────────────────
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

  // ─── Three.js init ────────────────────────────────────────────────────────
  private initThree(W: number, H: number) {
    const canvas = this.canvasRef.nativeElement;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled   = true;
    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, W / H, 0.01, 1000);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 1, 0);

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

  // ─── Camera fit ───────────────────────────────────────────────────────────
  private fitCamera() {
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
    const box0  = new THREE.Box3().setFromObject(fbx);
    const size0 = box0.getSize(new THREE.Vector3());
    fbx.scale.setScalar(4.0 / Math.max(size0.x, size0.y, size0.z));
    const box1 = new THREE.Box3().setFromObject(fbx);
    const ctr  = box1.getCenter(new THREE.Vector3());
    fbx.position.set(-ctr.x, -box1.min.y, -ctr.z);
    fbx.rotation.y = Math.PI * (260 / 180);

    fbx.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = child.receiveShadow = true;
        (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) { m.roughness = 0.72; m.metalness = 0.0; }
          m.needsUpdate = true;
        });
      }
    });

    this.eyeObjects       = [];
    this.eyeRestRotations = [];
    fbx.traverse(obj => {
      const n = obj.name.toLowerCase();
      if (EYE_KEYWORDS.some(k => n.includes(k))) {
        this.eyeObjects.push(obj);
        this.eyeRestRotations.push(new THREE.Euler().copy(obj.rotation));
      }
    });

    const totalBox   = new THREE.Box3().setFromObject(fbx);
    const potCeiling = totalBox.min.y + (totalBox.max.y - totalBox.min.y) * 0.32;
    fbx.updateWorldMatrix(false, true);

    const topChildren = [...fbx.children];
    this.potGroup   = new THREE.Group();
    this.plantGroup = new THREE.Group();

    for (const child of topChildren) {
      const name      = child.name.toLowerCase();
      const nameHit   = POT_KEYWORDS.some(k => name.includes(k));
      const childBox  = new THREE.Box3().setFromObject(child);
      const heightHit = !nameHit && childBox.max.y <= potCeiling + 0.05;
      const isPot     = nameHit || heightHit;
      const dest      = isPot ? this.potGroup : this.plantGroup;

      const wPos = new THREE.Vector3(), wQuat = new THREE.Quaternion(), wScale = new THREE.Vector3();
      child.matrixWorld.decompose(wPos, wQuat, wScale);
      dest.add(child);
      child.position.copy(wPos);
      child.quaternion.copy(wQuat);
      child.scale.copy(wScale);
      child.updateMatrix();
    }

    if (this.potGroup.children.length === 0 && this.plantGroup.children.length === 0) {
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

  private buildHierarchy() {
    this.scene.add(this.potGroup!);

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
    this.updateDecorSprites();
  }

  private buildProceduralFlower(): { pot: THREE.Group; plant: THREE.Group } {
    const pot   = new THREE.Group();
    const plant = new THREE.Group();

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

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 2.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.7 })
    );
    stem.position.y = 0.72 + 1.0;
    plant.add(stem);

    for (let i = 0; i < 4; i++) {
      const a   = (i / 4) * Math.PI * 2;
      const geo = new THREE.SphereGeometry(0.28, 8, 8);
      geo.scale(2.0, 0.35, 0.9);
      const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x28a745, roughness: 0.6 }));
      leaf.position.set(Math.cos(a) * 0.55, 1.0 + i * 0.32, Math.sin(a) * 0.55);
      leaf.rotation.z = a;
      plant.add(leaf);
    }

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

  // ─── Animations ───────────────────────────────────────────────────────────

  private playWelcome() {
    if (!this.plantRoot) return;
    const root = this.plantRoot;
    root.scale.set(0.001, 0.001, 0.001);
    root.rotation.y = -0.5;
    gsap.to(root.scale,    { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.6)', onComplete: () => this.playWave() });
    gsap.to(root.rotation, { y: 0, duration: 0.8, ease: 'power3.out' });
  }

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

  private startIdle() {
    if (!this.plantRoot || !this.swayPivot) return;
    this.idleTL?.kill();
    const root = this.plantRoot;
    const sway = this.swayPivot;
    this.idleTL = gsap.timeline({ repeat: -1 });
    this.idleTL
      .to(root.scale, { x: 1.004, y: 1.005, z: 1.004, duration: 4.0, ease: 'sine.inOut' })
      .to(root.scale, { x: 1.000, y: 1.000, z: 1.000, duration: 4.0, ease: 'sine.inOut' });
    gsap.to(sway.rotation, { z: 0.006, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  private syncMoodState() {
    const isSad      = this.wiltingLevel !== 'healthy' || (this.total > 0 && this.done / this.total < 0.4);
    const wasHealthy = this.prevWilt === 'healthy';
    this.prevWilt    = this.wiltingLevel;
    if (isSad  && wasHealthy)  this.enterSadState();
    if (!isSad && !wasHealthy) this.clearSadState();
    this.updateMoodLight();
    this.applyWiltScale();
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
    if (this.plantRoot) gsap.to(this.plantRoot.rotation, { x: 0, duration: 1.2, ease: 'power2.inOut' });
  }

  private updateMoodLight() {
    const colors: Record<WiltLevel, number> = {
      healthy: 0x10b981, mild: 0xfbbf24, moderate: 0xf97316, critical: 0xef4444
    };
    const c = new THREE.Color(colors[this.wiltingLevel]);
    gsap.to(this.moodLight.color, { r: c.r, g: c.g, b: c.b, duration: 1.5 });
  }

  private applyWiltScale(): void {
    if (!this.plantGroup) return;
    const s = this.WILT_SCALES[this.wiltingLevel];
    gsap.to(this.plantGroup.scale, { x: s, y: s, z: s, duration: 1.2, ease: 'power2.inOut' });
  }

  private playJump() {
    if (!this.plantRoot) return;
    this.jumpActive = true;
    const r = this.plantRoot;
    gsap.killTweensOf(r.position);
    gsap.killTweensOf(r.scale);
    this.idleTL?.pause();

    gsap.timeline({ onComplete: () => { this.jumpActive = false; this.idleTL?.resume(); } })
      .to(r.position, { y:  0.42, duration: 0.20, ease: 'power2.out' })
      .to(r.scale,    { x: 0.87, y: 1.16, z: 0.87, duration: 0.20, ease: 'power2.out' }, '<')
      .to(r.position, { y:  0,   duration: 0.18, ease: 'power2.in'  })
      .to(r.scale,    { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.18, ease: 'power2.in'  }, '<')
      .to(r.scale,    { x: 1.12, y: 0.88, z: 1.12, duration: 0.06, ease: 'power2.in'  })
      .to(r.scale,    { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.10, ease: 'back.out(3)' })
      .to(r.position, { y:  0.24, duration: 0.16, ease: 'power2.out' })
      .to(r.scale,    { x: 0.91, y: 1.10, z: 0.91, duration: 0.16, ease: 'power2.out' }, '<')
      .to(r.position, { y:  0,   duration: 0.14, ease: 'power2.in'  })
      .to(r.scale,    { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.14, ease: 'power2.in'  }, '<')
      .to(r.scale,    { x: 1.07, y: 0.93, z: 1.07, duration: 0.05, ease: 'power2.in'  })
      .to(r.scale,    { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.08, ease: 'back.out(3)' })
      .to(r.position, { y:  0.10, duration: 0.11, ease: 'power2.out' })
      .to(r.scale,    { x: 0.96, y: 1.05, z: 0.96, duration: 0.11, ease: 'power2.out' }, '<')
      .to(r.position, { y:  0,   duration: 0.10, ease: 'power2.in'  })
      .to(r.scale,    { x: 1.0,  y: 1.0,  z: 1.0,  duration: 0.14, ease: 'elastic.out(1, 0.55)' }, '<');
  }

  // ─── Render loop ──────────────────────────────────────────────────────────
  private startRenderLoop() {
    const HEAD_H = 0.66, HEAD_V_U = 0.32, HEAD_V_D = -0.21, HEAD_LRP = 0.048;
    const EYE_H  = 0.22, EYE_V   = 0.16, EYE_LRP  = 0.10;
    const IDLE_LRP = 0.018;
    const clamp = THREE.MathUtils.clamp;

    const tick = () => {
      this.rafId = requestAnimationFrame(tick);

      const tx  = this.mouseOnPage ? this.mouseTarget.x : 0;
      const ty  = this.mouseOnPage ? this.mouseTarget.y : 0;
      const lrp = this.mouseOnPage ? HEAD_LRP : IDLE_LRP;
      this.mouseLerped.x += (tx - this.mouseLerped.x) * lrp;
      this.mouseLerped.y += (ty - this.mouseLerped.y) * lrp;

      if (this.cursorPivot) {
        const wantY = clamp(this.mouseLerped.x * HEAD_H,   -HEAD_H,   HEAD_H);
        const wantX = clamp(this.mouseLerped.y * HEAD_V_U,  HEAD_V_D, HEAD_V_U);
        this.cursorPivot.rotation.y += (wantY - this.cursorPivot.rotation.y) * 0.08;
        this.cursorPivot.rotation.x += (wantX - this.cursorPivot.rotation.x) * 0.08;
      }

      if (this.eyeObjects.length > 0) {
        const exH = clamp(-this.mouseLerped.x * EYE_H, -EYE_H, EYE_H);
        const exV = clamp( this.mouseLerped.y * EYE_V,  -EYE_V, EYE_V);
        for (let i = 0; i < this.eyeObjects.length; i++) {
          const eye = this.eyeObjects[i], rest = this.eyeRestRotations[i];
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
    this.onMouseMove = (e: MouseEvent) => {
      this.mouseOnPage  = true;
      this.mouseTarget.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouseTarget.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    this.onMouseLeave = () => { this.mouseOnPage = false; };
    window.addEventListener('mousemove',    this.onMouseMove,  { passive: true });
    document.addEventListener('mouseleave', this.onMouseLeave, { passive: true });
  }

  // ─── Decoration sprites ───────────────────────────────────────────────────

  private emojiToSprite(emoji: string): THREE.Sprite {
    const SIZE   = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.font = `${SIZE * 0.70}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, SIZE / 2, SIZE / 2);
    const texture  = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite   = new THREE.Sprite(material);
    sprite.scale.set(0.68, 0.68, 1);
    return sprite;
  }

  private clearDecorSprites(): void {
    this.decorTweens.forEach(t => t.kill());
    this.decorTweens = [];
    this.decorSprites.forEach(s => {
      this.scene?.remove(s);
      (s.material as THREE.SpriteMaterial).map?.dispose();
      s.material.dispose();
    });
    this.decorSprites = [];
  }

  private updateDecorSprites(): void {
    if (!this.scene) return;

    // Skip if triggered by a position-save after an in-scene drag
    // (visuals already correct, no rebuild needed)
    if (this.skipNextDecorRebuild) {
      this.skipNextDecorRebuild = false;
      return;
    }

    this.clearDecorSprites();

    this.placements.forEach((item, i) => {
      const sprite = this.emojiToSprite(item.emoji);
      sprite.position.set(item.x, item.y, item.z);
      this.scene.add(sprite);
      this.decorSprites.push(sprite);

      const bobAmp    = 0.08 + Math.random() * 0.04;
      const bobDur    = 1.8  + Math.random() * 0.7;
      const phaseDelay = (i / Math.max(this.placements.length, 1)) * bobDur;

      const tween = gsap.to(sprite.position, {
        y: item.y + bobAmp, duration: bobDur,
        ease: 'sine.inOut', yoyo: true, repeat: -1, delay: phaseDelay,
      });
      this.decorTweens.push(tween);

      sprite.scale.set(0, 0, 1);
      gsap.to(sprite.scale, {
        x: 0.68, y: 0.68, duration: 0.45,
        ease: 'back.out(2)', delay: i * 0.07,
      });
    });
  }
}
