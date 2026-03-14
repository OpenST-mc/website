class LitematicEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.gl = null;
    this.renderer = null;
    this.structure = null;

    this.camera = {
      pitch: 0.8,
      yaw: 0.5,
      pos: glMatrix.vec3.create(),
    };

    this.pressedKeys = new Set();
    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.appendChild(this.canvas);
    this.gl = this.canvas.getContext('webgl');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this._setupInputs(); // 这里会调用下面两个方法
    this._startMovementTick();
  }

  _setupInputs() {
    // 按键按下
    document.addEventListener('keydown', e => {
      // 防止页面在操作时滚动
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.pressedKeys.add(e.code);
    });

    // 按键松开
    document.addEventListener('keyup', e => {
      this.pressedKeys.delete(e.code);
    });

    // --- 刹车逻辑：防止持续飞行 ---

    // 当窗口失去焦点（比如 Alt+Tab）时清空按键
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      console.log("🛡️ 窗口失去焦点，已自动停机");
    });

    // 当右键菜单弹出时清空按键（解决你说的右键导致飞行问题）
    window.addEventListener('contextmenu', () => {
      this.pressedKeys.clear();
    });

    // 鼠标和滚轮逻辑保持不变...
    this._setupMouseInteractions();
  }

  _setupMouseInteractions() {
    let isDragging = false;
    let lastPos = [0, 0];

    this.canvas.addEventListener('mousedown', e => {
      isDragging = true;
      lastPos = [e.clientX, e.clientY];
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - lastPos[0];
      const dy = e.clientY - lastPos[1];

      if (e.buttons === 1) { // 左键旋转
        this.camera.yaw += dx / 200;
        this.camera.pitch += dy / 200;
      } else if (e.buttons === 4 || (e.buttons === 1 && e.shiftKey)) { // 中键或 Shift+左键平移
        this._pan([dx, dy]);
      }

      lastPos = [e.clientX, e.clientY];
      this.requestRender();
    });

    window.addEventListener('mouseup', () => isDragging = false);
  }

  _pan(offset) {
    const { vec3 } = glMatrix;
    let move = vec3.fromValues(offset[0] / 500, -offset[1] / 500, 0);
    vec3.rotateX(move, move, [0,0,0], -this.camera.pitch);
    vec3.rotateY(move, move, [0,0,0], -this.camera.yaw);
    vec3.add(this.camera.pos, this.camera.pos, move);
  }

  // ... 其他方法 (resize, render, setStructure, move3d, _startMovementTick) 保持不变 ...
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setStructure(structure) {
    this.renderer = new deepslate.StructureRenderer(this.gl, structure, deepslateResources, { chunkSize: 8 });
    this.requestRender();
  }

  render = () => {
    if (!this.renderer) return;
    const { mat4 } = glMatrix;
    const view = mat4.create();
    this.camera.yaw = this.camera.yaw % (Math.PI * 2);
    this.camera.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.pitch));
    mat4.rotateX(view, view, this.camera.pitch);
    mat4.rotateY(view, view, this.camera.yaw);
    mat4.translate(view, view, this.camera.pos);
    this.renderer.drawStructure(view);
    this.renderer.drawGrid(view);
  }

  requestRender() { requestAnimationFrame(this.render); }

  move3d(direction, relativeVertical = true) {
    const { vec3 } = glMatrix;
    let offset = vec3.fromValues(...direction);
    if (relativeVertical) vec3.rotateX(offset, offset, [0,0,0], -this.camera.pitch);
    vec3.rotateY(offset, offset, [0,0,0], -this.camera.yaw);
    vec3.add(this.camera.pos, this.camera.pos, offset);
    this.requestRender();
  }

  _startMovementTick() {
    const moveDist = 0.2;
    const keyMap = { KeyW: [0, 0, moveDist], KeyS: [0, 0, -moveDist], KeyA: [moveDist, 0, 0], KeyD: [-moveDist, 0, 0], ShiftLeft: [0, moveDist, 0], Space: [0, -moveDist, 0] };
    setInterval(() => {
      if (this.pressedKeys.size === 0) return;
      let direction = glMatrix.vec3.create();
      this.pressedKeys.forEach(k => { if (keyMap[k]) glMatrix.vec3.add(direction, direction, keyMap[k]); });
      this.move3d(direction, false);
    }, 1000/60);
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  window.vEngine = new LitematicEngine('viewer');
});