class LitematicEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.gl = null;
    this.renderer = null;
    this.structure = null;

    this.camera = {
      pitch: 0.5,
      yaw: 0.5,
      pos: glMatrix.vec3.fromValues(0, -5, -30),
    };

    this.pressedKeys = new Set();
    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.appendChild(this.canvas);
    this.gl = this.canvas.getContext('webgl');

    // 记录初始化时的宽高比，作为对比基准
    this.lastAspect = window.innerWidth / window.innerHeight;

    this.resize();
    window.addEventListener('resize', () => {
      const currentAspect = window.innerWidth / window.innerHeight;
      if (Math.abs(currentAspect - this.lastAspect) > 0.5) {
        console.log("检测到屏幕翻转，执行强制重置...");
        this.lastAspect = currentAspect;
     // window.location.reload();
        this.resize();
        if (this.structure) this.setStructure(this.structure);
      } else {
        // 普通的窗口微调，走常规重绘
        this.resize();
      }
    });

    this._setupInputs();
    this._startMovementTick();
    this._setupVerticalButtons();
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
    // 当窗口失去焦点（比如 Alt+Tab）时清空按键
    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
      console.log("窗口失去焦点");
    });

    // 当右键菜单弹出时清空按键
    window.addEventListener('contextmenu', () => {
      this.pressedKeys.clear();
    });
    this._setupMouseInteractions();
    this._setupTouchInteractions();
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

  _setupTouchInteractions() {
    this.moveVector = glMatrix.vec3.create();
    let stickId = null;
    let stickStart = null;
    this.lastTouchPos = [0, 0];

    const joystickContainer = document.getElementById('mobile-joystick');
    const knob = document.getElementById('joystick-knob');

    // 初始隐藏摇杆，直到模型加载
    if (joystickContainer) joystickContainer.style.display = 'none';

    const handleTouch = (e, type) => {
      // 只有当渲染器就绪时才允许摇杆逻辑
      if (!this.renderer) return;
      if (joystickContainer) joystickContainer.style.display = 'block';

      if (e.cancelable) e.preventDefault();

      for (let touch of e.changedTouches) {
        if (touch.target.closest('#vertical-controls')) continue;
        if (type === 'start') {
          // 只要是左半屏就启动摇杆，不限制像素大小，适配 iPad
          if (touch.clientX < window.innerWidth / 2 && stickId === null) {
            stickId = touch.identifier;
            stickStart = [touch.clientX, touch.clientY];
          } else {
            this.lastTouchPos = [touch.clientX, touch.clientY];
          }
        }
        else if (type === 'move') {
          if (touch.identifier === stickId && stickStart) {
            const dx = touch.clientX - stickStart[0];
            const dy = touch.clientY - stickStart[1];
            const dist = Math.min(Math.hypot(dx, dy), 60);
            const angle = Math.atan2(dy, dx);

            if (knob) {
              knob.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
            }

            const power = dist / 60;
            this.moveVector[0] = Math.cos(angle) * power * 0.3;
            this.moveVector[2] = -Math.sin(angle) * power * 0.3;
          } else if (touch.identifier !== stickId) {
            const rdx = touch.clientX - this.lastTouchPos[0];
            const rdy = touch.clientY - this.lastTouchPos[1];
            this.camera.yaw += rdx * 0.005;
            this.camera.pitch += rdy * 0.005;
            this.lastTouchPos = [touch.clientX, touch.clientY];
          }
        }
        else if (type === 'end') {
          if (touch.identifier === stickId) {
            stickId = null;
            stickStart = null;
            if (knob) knob.style.transform = `translate(-50%, -50%)`;
            glMatrix.vec3.set(this.moveVector, 0, 0, 0);
          }
        }
      }
      this.requestRender();
    };

    this.canvas.addEventListener('touchstart', e => handleTouch(e, 'start'), { passive: false });
    this.canvas.addEventListener('touchmove', e => handleTouch(e, 'move'), { passive: false });
    this.canvas.addEventListener('touchend', e => handleTouch(e, 'end'), { passive: false });
  }

  _setupVerticalButtons() {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const container = document.getElementById('vertical-controls');
    const bindBtn = (el, keyCode) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.pressedKeys.add(keyCode);
      });
      el.addEventListener('touchend', () => {
        this.pressedKeys.delete(keyCode);
      });
    };

    bindBtn(btnUp, 'Space');
    bindBtn(btnDown, 'ShiftLeft');
  }

  _pan(offset) {
    const {vec3} = glMatrix;
    let move = vec3.fromValues(offset[0] / 500, -offset[1] / 500, 0);
    vec3.rotateX(move, move, [0, 0, 0], -this.camera.pitch);
    vec3.rotateY(move, move, [0, 0, 0], -this.camera.yaw);
    vec3.add(this.camera.pos, this.camera.pos, move);
  }

  resize() {
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

  setStructure(structure) {
    this.structure = structure;
    // 每次重新创建 Renderer，彻底刷掉旧矩阵的缓存
    this.renderer = new deepslate.StructureRenderer(this.gl, structure, deepslateResources, {chunkSize: 8});
    this.requestRender();
    const vControls = document.getElementById('vertical-controls');
    const joystick = document.getElementById('mobile-joystick');

    if (vControls) {
      vControls.classList.remove('hidden');
      vControls.style.opacity = "1";
      vControls.style.pointerEvents = "auto";
    }
    if (joystick) {
      joystick.style.display = 'block';
    }
  }

  render = () => {
    if (!this.renderer) return;
    const {mat4, vec3} = glMatrix;
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 70 * Math.PI / 180, aspect, 0.1, 1000.0);
    const view = mat4.create();
    this.camera.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.pitch));
    mat4.rotateX(view, view, this.camera.pitch);
    mat4.rotateY(view, view, this.camera.yaw);
    // 再应用相机的平移 相机移动 [x,y,z]，世界就要向反方向移动
    mat4.translate(view, view, this.camera.pos);

    // 执行渲染
    // 确保传入了最新的 projectionMatrix
    this.renderer.drawStructure(view, projectionMatrix);
    this.renderer.drawGrid(view, projectionMatrix);
  }

  requestRender() {
    if (this.isRequested) return;

    this.isRequested = true;
    requestAnimationFrame(() => {
      this.render();
      this.isRequested = false; // 渲染完成后释放锁，允许下一帧请求
    });
  }

  move3d(direction, relativeVertical = false) {
    const { vec3 } = glMatrix;

    // direction[0] 是左右，direction[2] 是前后
    // 如果推左往右走，就给 direction[0] 取反
    let offset = vec3.fromValues(-direction[0], direction[1], direction[2]);

    if (relativeVertical) {
      vec3.rotateX(offset, offset, [0, 0, 0], -this.camera.pitch);
    }
    vec3.rotateY(offset, offset, [0, 0, 0], -this.camera.yaw);

    // 相机位置累加。注意：pos 增加意味着相机移动，渲染时世界会反向移动
    vec3.add(this.camera.pos, this.camera.pos, offset);

    this.requestRender();
  }

  _startMovementTick() {
    setInterval(() => {
      let direction = glMatrix.vec3.create();

      // 键盘逻辑：加入高度
      const keyMap = {
        KeyW: [0, 0, 0.2],   // 前
        KeyS: [0, 0, -0.2],  // 后
        KeyA: [-0.2, 0, 0],   // 左 (正位移)
        KeyD: [0.2, 0, 0],  // 右 (负位移)
        Space: [0, -0.2, 0], ShiftLeft: [0, 0.2, 0] // 修正垂直方向
      };

      this.pressedKeys.forEach(k => {
        if (keyMap[k]) glMatrix.vec3.add(direction, direction, keyMap[k]);
      });

      if (this.moveVector) glMatrix.vec3.add(direction, direction, this.moveVector);

      if (glMatrix.vec3.length(direction) > 0) {
        this.move3d(direction, false);
      }
    }, 1000 / 60);
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  window.vEngine = new LitematicEngine('viewer');
});