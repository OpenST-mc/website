// 3D 预览引擎（自 apps/extra/litematic-preview/src/viewer.js 迁移）。
// 命令式核心：WebGL/deepslate/gl-matrix 状态不进 React 状态流；仅类型化边界。
import type { mat4, vec3 } from 'gl-matrix';
import type { Structure, StructureRenderer as DeepslateStructureRenderer, Resources } from 'deepslate';
import type { DeepslateResources, StructurePlacement } from './types';

interface RendererEntry {
  renderer: DeepslateStructureRenderer;
  position: [number, number, number];
}

interface TouchState {
  mode: 'none' | 'joystick' | 'rotate' | 'pan';
  lastPos: [number, number] | null;
  joystickStart: [number, number] | null;
  lastPinchDist: number;
}

export class LitematicEngine {
  private readonly container: HTMLElement | null;
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private readonly resources: DeepslateResources;
  private structures: StructurePlacement[] = [];
  private renderers: RendererEntry[] = [];
  private speedScale = 1.0;
  private isPaused = false;
  private cachedStructures: StructurePlacement[] | null = null;
  private readonly joystickVector: vec3;
  private readonly pressedKeys = new Set<string>();
  private lastAspect: number;
  private isRequested = false;
  private touchState: TouchState = {
    mode: 'none',
    lastPos: null,
    joystickStart: null,
    lastPinchDist: 0,
  };

  mirrorMode = false;

  readonly camera: { pitch: number; yaw: number; pos: vec3 };

  constructor(containerId: string, resources: DeepslateResources) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.resources = resources;
    this.joystickVector = glMatrix.vec3.create();
    this.camera = {
      pitch: 0.5,
      yaw: 0.5,
      pos: glMatrix.vec3.fromValues(0, -5, -30),
    };
    this.lastAspect = window.innerWidth / window.innerHeight;
    this.init();
  }

  private init(): void {
    if (!this.container) return;
    this.container.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl');

    this.lastAspect = window.innerWidth / window.innerHeight;

    this.resize();
    window.addEventListener('resize', () => {
      const currentAspect = window.innerWidth / window.innerHeight;
      if (Math.abs(currentAspect - this.lastAspect) > 0.5) {
        console.log('检测到屏幕翻转，执行强制重置...');
        this.lastAspect = currentAspect;
        this.resize();
        if (this.structures.length > 0) this.setStructures(this.structures);
      } else {
        this.resize();
      }
    });

    this.setupInputs();
    this.setupVerticalButtons();
    this.startMovementTick();
    this.setupIntersectionObserver();
  }

  private setupInputs(): void {
    document.addEventListener('keydown', (e) => {
      const tag = e.target && (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const handled = [
        'KeyW',
        'KeyS',
        'KeyA',
        'KeyD',
        'Space',
        'ShiftLeft',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ];
      if (handled.includes(e.code)) {
        e.preventDefault();
      }
      this.pressedKeys.add(e.code);
    });

    document.addEventListener('keyup', (e) => {
      this.pressedKeys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      console.log('窗口失去焦点');
    });

    window.addEventListener('contextmenu', () => {
      this.pressedKeys.clear();
    });

    this.setupMouseInteractions();
    this.setupTouchInteractions();
  }

  private setupMouseInteractions(): void {
    let isDragging = false;
    let lastPos: [number, number] = [0, 0];

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastPos = [e.clientX, e.clientY];
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPos[0];
      const dy = e.clientY - lastPos[1];

      if (e.buttons === 1) {
        this.camera.yaw += dx / 200;
        this.camera.pitch += dy / 200;
      } else if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) {
        this.pan([dx, dy]);
      }

      lastPos = [e.clientX, e.clientY];
      this.requestRender();
    });

    window.addEventListener('mouseup', () => (isDragging = false));
  }

  private setupTouchInteractions(): void {
    const isJoystickZone = (x: number) =>
      this.mirrorMode ? x >= window.innerWidth * 0.6 : x < window.innerWidth * 0.4;

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (this.renderers.length === 0) return;
        if (e.cancelable) e.preventDefault();

        if (e.touches.length === 1) {
          const touch = e.touches[0]!;
          if (isJoystickZone(touch.clientX)) {
            this.touchState.mode = 'joystick';
            this.touchState.joystickStart = [touch.clientX, touch.clientY];
          } else {
            this.touchState.mode = 'rotate';
            this.touchState.lastPos = [touch.clientX, touch.clientY];
          }
        } else if (e.touches.length >= 2) {
          this.touchState.mode = 'pan';
          const first = e.touches[0]!;
          const second = e.touches[1]!;
          const cx = (first.clientX + second.clientX) / 2;
          const cy = (first.clientY + second.clientY) / 2;
          this.touchState.lastPos = [cx, cy];
          this.touchState.lastPinchDist = Math.hypot(
            first.clientX - second.clientX,
            first.clientY - second.clientY
          );
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (this.renderers.length === 0) return;
        if (e.cancelable) e.preventDefault();

        if (this.touchState.mode === 'joystick' && e.touches.length >= 1) {
          for (let i = e.touches.length - 1; i >= 0; i--) {
            const touch = e.touches[i]!;
            if (isJoystickZone(touch.clientX)) {
              const start = this.touchState.joystickStart ?? [touch.clientX, touch.clientY];
              const dx = touch.clientX - start[0];
              const dy = touch.clientY - start[1];
              const dist = Math.min(Math.hypot(dx, dy), 60);
              const angle = Math.atan2(dy, dx);
              const power = dist / 60;
              this.joystickVector[0] = Math.cos(angle) * power;
              this.joystickVector[2] = -Math.sin(angle) * power;
              break;
            }
          }
        } else if (this.touchState.mode === 'rotate' && e.touches.length === 1) {
          const touch = e.touches[0]!;
          const lastPos = this.touchState.lastPos ?? [touch.clientX, touch.clientY];
          const dx = touch.clientX - lastPos[0];
          const dy = touch.clientY - lastPos[1];
          this.camera.yaw += dx * 0.008;
          this.camera.pitch += dy * 0.008;
          this.touchState.lastPos = [touch.clientX, touch.clientY];
          this.requestRender();
        } else if (this.touchState.mode === 'pan' && e.touches.length >= 2) {
          const first = e.touches[0]!;
          const second = e.touches[1]!;
          const cx = (first.clientX + second.clientX) / 2;
          const cy = (first.clientY + second.clientY) / 2;
          const lastPos = this.touchState.lastPos ?? [cx, cy];
          const pdx = cx - lastPos[0];
          const pdy = cy - lastPos[1];
          this.pan([-pdx, -pdy]);

          const dist = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
          const zoomDelta = (dist - this.touchState.lastPinchDist) * this.speedScale * 0.02;
          const forward = glMatrix.vec3.fromValues(0, 0, zoomDelta);
          glMatrix.vec3.rotateX(forward, forward, [0, 0, 0], -this.camera.pitch);
          glMatrix.vec3.rotateY(forward, forward, [0, 0, 0], -this.camera.yaw);
          glMatrix.vec3.add(this.camera.pos, this.camera.pos, forward);

          this.touchState.lastPos = [cx, cy];
          this.touchState.lastPinchDist = dist;
          this.requestRender();
        }
      },
      { passive: false }
    );

    this.canvas.addEventListener('touchend', () => {
      if (this.touchState.mode === 'joystick') {
        glMatrix.vec3.set(this.joystickVector, 0, 0, 0);
      }
      this.touchState.mode = 'none';
    });
  }

  private setupVerticalButtons(): void {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    if (!btnUp || !btnDown) return;
    btnUp.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.pressedKeys.add('Space');
    });
    btnUp.addEventListener('touchend', () => {
      this.pressedKeys.delete('Space');
    });
    btnDown.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.pressedKeys.add('ShiftLeft');
    });
    btnDown.addEventListener('touchend', () => {
      this.pressedKeys.delete('ShiftLeft');
    });
  }

  private pan(offset: [number, number]): void {
    const { vec3 } = glMatrix;
    const move = vec3.fromValues(offset[0] / 500, -offset[1] / 500, 0);
    vec3.rotateX(move, move, [0, 0, 0], -this.camera.pitch);
    vec3.rotateY(move, move, [0, 0, 0], -this.camera.yaw);
    vec3.add(this.camera.pos, this.camera.pos, move);
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.resume();
          } else {
            this.pause();
          }
        }
      },
      { threshold: 0 }
    );
    if (this.container) observer.observe(this.container);
  }

  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.cachedStructures = this.structures;
    this.renderers = [];
    this.pressedKeys.clear();
    glMatrix.vec3.set(this.joystickVector, 0, 0, 0);
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.cachedStructures && this.cachedStructures.length > 0) {
      this.setStructures(this.cachedStructures);
    }
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    this.requestRender();
  }

  setStructure(structure: Structure): void {
    this.setStructures([{ structure, position: [0, 0, 0] }]);
  }

  setStructures(structuresList: StructurePlacement[]): void {
    this.structures = structuresList;
    this.cachedStructures = structuresList;
    if (this.isPaused) return;

    this.renderers = structuresList.map((s) => ({
      renderer: new deepslate.StructureRenderer(
        this.gl!,
        s.structure as Structure,
        this.resources as unknown as Resources,
        { chunkSize: 16 }
      ),
      position: s.position || [0, 0, 0],
    }));

    // 根据模型包围盒动态计算移动速度
    let maxDim = 1;
    if (structuresList.length > 0) {
      let minX = 0,
        minY = 0,
        minZ = 0;
      let maxX = 0,
        maxY = 0,
        maxZ = 0;
      let first = true;
      for (const st of structuresList) {
        const structure = st.structure as Structure;
        const dims = structure.getSize();
        const pos = st.position || [0, 0, 0];
        if (first) {
          minX = pos[0];
          minY = pos[1];
          minZ = pos[2];
          maxX = pos[0] + dims[0];
          maxY = pos[1] + dims[1];
          maxZ = pos[2] + dims[2];
          first = false;
        } else {
          if (pos[0] < minX) minX = pos[0];
          if (pos[1] < minY) minY = pos[1];
          if (pos[2] < minZ) minZ = pos[2];
          if (pos[0] + dims[0] > maxX) maxX = pos[0] + dims[0];
          if (pos[1] + dims[1] > maxY) maxY = pos[1] + dims[1];
          if (pos[2] + dims[2] > maxZ) maxZ = pos[2] + dims[2];
        }
      }
      maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    }
    this.speedScale = Math.min(Math.max(Math.pow(maxDim, 0.5) / 5, 0.2), 5);

    this.requestRender();

    // 移动端显示触控提示 + 上下按钮，首次触摸后消失
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    const vControls = document.getElementById('vertical-controls');
    const hints = document.getElementById('touch-hints');
    if (vControls) vControls.classList.remove('hidden');
    if (!hints) return;

    hints.classList.remove('hidden');
    document.addEventListener(
      'touchstart',
      () => {
        hints.style.opacity = '0';
        setTimeout(() => {
          hints.classList.add('hidden');
          hints.style.opacity = '';
        }, 500);
        if (vControls) vControls.classList.add('fade-guide');
      },
      { once: true }
    );
  }

  private render = (): void => {
    if (this.isPaused || this.renderers.length === 0) return;
    const { mat4 } = glMatrix;
    const canvas = this.canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projectionMatrix: mat4 = mat4.create();
    mat4.perspective(projectionMatrix, (70 * Math.PI) / 180, aspect, 0.1, 1000.0);
    const view: mat4 = mat4.create();
    this.camera.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.pitch));
    mat4.rotateX(view, view, this.camera.pitch);
    mat4.rotateY(view, view, this.camera.yaw);
    mat4.translate(view, view, this.camera.pos);

    for (const r of this.renderers) {
      const offsetView = mat4.clone(view);
      mat4.translate(offsetView, offsetView, [r.position[0], r.position[1], r.position[2]]);
      r.renderer.drawStructure(offsetView);
    }
    this.renderers[0]!.renderer.drawGrid(view);
  };

  requestRender(): void {
    if (this.isRequested) return;

    this.isRequested = true;
    requestAnimationFrame(() => {
      this.render();
      this.isRequested = false;
    });
  }

  move3d(direction: vec3, relativeVertical = false): void {
    const { vec3 } = glMatrix;
    const offset = vec3.fromValues(-direction[0], direction[1], direction[2]);

    if (relativeVertical) {
      vec3.rotateX(offset, offset, [0, 0, 0], -this.camera.pitch);
    }
    vec3.rotateY(offset, offset, [0, 0, 0], -this.camera.yaw);

    vec3.add(this.camera.pos, this.camera.pos, offset);

    this.requestRender();
  }

  private startMovementTick(): void {
    setInterval(() => {
      if (this.isPaused) return;
      const direction = glMatrix.vec3.create();
      const s = this.speedScale;

      const keyMap: Record<string, [number, number, number]> = {
        KeyW: [0, 0, 0.2 * s],
        KeyS: [0, 0, -0.2 * s],
        KeyA: [-0.2 * s, 0, 0],
        KeyD: [0.2 * s, 0, 0],
        Space: [0, -0.2 * s, 0],
        ShiftLeft: [0, 0.2 * s, 0],
      };

      this.pressedKeys.forEach((k) => {
        const move = keyMap[k];
        if (move) glMatrix.vec3.add(direction, direction, move);
      });

      const jv = this.joystickVector;
      if (jv[0] !== 0 || jv[2] !== 0) {
        const js = 0.3 * s;
        glMatrix.vec3.add(direction, direction, [jv[0] * js, 0, jv[2] * js]);
      }

      if (glMatrix.vec3.length(direction) > 0) {
        this.move3d(direction, false);
      }
    }, 1000 / 60);
  }
}

let engine: LitematicEngine | null = null;

export function createEngine(containerId: string, resources: DeepslateResources): LitematicEngine {
  engine = new LitematicEngine(containerId, resources);
  return engine;
}

export function getEngine(): LitematicEngine | null {
  return engine;
}
