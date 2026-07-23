class LitematicEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.gl = null;
    this.renderer = null;
    this.structure = null;
    this.structures = [];
    this.renderers = [];
    this.speedScale = 1.0;
    this.isPaused = false;
    this.cachedStructures = null;
    this.joystickVector = glMatrix.vec3.create();
    this.mirrorMode = false;

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
        if (this.structures.length > 0) this.setStructures(this.structures);
      } else {
        // 普通的窗口微调，走常规重绘
        this.resize();
      }
    });

    this._setupInputs();
    this._setupVerticalButtons();
    this._startMovementTick();
    this._setupIntersectionObserver();
  }

  _setupInputs() {
     // 按键按下，仅阻止移动/操作相关键以免影响 F12 等系统键
     document.addEventListener('keydown', e => {
       var tag = e.target && e.target.tagName;
       if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
       var handled = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft',
         'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
       if (handled.includes(e.code)) {
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
    this.touchState = { mode: 'none', lastPos: null, joystickStart: null, lastPinchDist: 0 };

    var self = this;

    function isJoystickZone(x) {
      return self.mirrorMode ? (x >= window.innerWidth * 0.6) : (x < window.innerWidth * 0.4);
    }

    this.canvas.addEventListener('touchstart', function(e) {
      if (self.renderers.length === 0) return;
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 1) {
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;
        if (isJoystickZone(tx)) {
          self.touchState.mode = 'joystick';
          self.touchState.joystickStart = [tx, ty];
        } else {
          self.touchState.mode = 'rotate';
          self.touchState.lastPos = [tx, ty];
        }
      } else if (e.touches.length >= 2) {
        self.touchState.mode = 'pan';
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        self.touchState.lastPos = [cx, cy];
        self.touchState.lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', function(e) {
      if (self.renderers.length === 0) return;
      if (e.cancelable) e.preventDefault();

      if (self.touchState.mode === 'joystick' && e.touches.length >= 1) {
        for (var i = e.touches.length - 1; i >= 0; i--) {
          if (isJoystickZone(e.touches[i].clientX)) {
            var dx = e.touches[i].clientX - self.touchState.joystickStart[0];
            var dy = e.touches[i].clientY - self.touchState.joystickStart[1];
            var dist = Math.min(Math.hypot(dx, dy), 60);
            var angle = Math.atan2(dy, dx);
            var power = dist / 60;
            self.joystickVector[0] = Math.cos(angle) * power;
            self.joystickVector[2] = -Math.sin(angle) * power;
            break;
          }
        }
      } else if (self.touchState.mode === 'rotate' && e.touches.length === 1) {
        var dx = e.touches[0].clientX - self.touchState.lastPos[0];
        var dy = e.touches[0].clientY - self.touchState.lastPos[1];
        self.camera.yaw += dx * 0.008;
        self.camera.pitch += dy * 0.008;
        self.touchState.lastPos = [e.touches[0].clientX, e.touches[0].clientY];
        self.requestRender();
      } else if (self.touchState.mode === 'pan' && e.touches.length >= 2) {
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var pdx = cx - self.touchState.lastPos[0];
        var pdy = cy - self.touchState.lastPos[1];
        self._pan([-pdx, -pdy]);

        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        var zoomDelta = (dist - self.touchState.lastPinchDist) * self.speedScale * 0.02;
        var forward = glMatrix.vec3.fromValues(0, 0, zoomDelta);
        glMatrix.vec3.rotateX(forward, forward, [0, 0, 0], -self.camera.pitch);
        glMatrix.vec3.rotateY(forward, forward, [0, 0, 0], -self.camera.yaw);
        glMatrix.vec3.add(self.camera.pos, self.camera.pos, forward);

        self.touchState.lastPos = [cx, cy];
        self.touchState.lastPinchDist = dist;
        self.requestRender();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', function() {
      if (self.touchState.mode === 'joystick') {
        glMatrix.vec3.set(self.joystickVector, 0, 0, 0);
      }
      self.touchState.mode = 'none';
    });
  }

  _setupVerticalButtons() {
    var btnUp = document.getElementById('btn-up');
    var btnDown = document.getElementById('btn-down');
    if (!btnUp || !btnDown) return;
    var self = this;
    btnUp.addEventListener('touchstart', function(e) { e.preventDefault(); self.pressedKeys.add('Space'); });
    btnUp.addEventListener('touchend', function() { self.pressedKeys.delete('Space'); });
    btnDown.addEventListener('touchstart', function(e) { e.preventDefault(); self.pressedKeys.add('ShiftLeft'); });
    btnDown.addEventListener('touchend', function() { self.pressedKeys.delete('ShiftLeft'); });
  }

  _pan(offset) {
    const {vec3} = glMatrix;
    let move = vec3.fromValues(offset[0] / 500, -offset[1] / 500, 0);
    vec3.rotateX(move, move, [0, 0, 0], -this.camera.pitch);
    vec3.rotateY(move, move, [0, 0, 0], -this.camera.yaw);
    vec3.add(this.camera.pos, this.camera.pos, move);
  }

  _setupIntersectionObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    var self = this;
    var observer = new IntersectionObserver(function(entries) {
      for (var e of entries) {
        if (e.isIntersecting) {
          self.resume();
        } else {
          self.pause();
        }
      }
    }, { threshold: 0 });
    observer.observe(this.container);
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.cachedStructures = this.structures;
    this.renderers = [];
    this.pressedKeys.clear();
    glMatrix.vec3.set(this.joystickVector, 0, 0, 0);
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.cachedStructures && this.cachedStructures.length > 0) {
      this.setStructures(this.cachedStructures);
    }
    this.resize();
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
    this.setStructures([{ structure: structure, position: [0, 0, 0] }]);
  }

  setStructures(structuresList) {
    this.structures = structuresList;
    this.cachedStructures = structuresList;
    if (this.isPaused) return;
    this.renderers = structuresList.map(function(s) {
      return {
        renderer: new deepslate.StructureRenderer(this.gl, s.structure, deepslateResources, {chunkSize: 16}),
        position: s.position || [0, 0, 0]
      };
    }, this);

    // 根据模型包围盒动态计算移动速度
    var maxDim = 1;
    if (structuresList.length > 0) {
      var minX = 0, minY = 0, minZ = 0;
      var maxX = 0, maxY = 0, maxZ = 0;
      var first = true;
      for (var i = 0; i < structuresList.length; i++) {
        var st = structuresList[i];
        var dims = st.structure.getSize();
        var pos = st.position || [0, 0, 0];
        if (first) {
          minX = pos[0]; minY = pos[1]; minZ = pos[2];
          maxX = pos[0] + dims[0]; maxY = pos[1] + dims[1]; maxZ = pos[2] + dims[2];
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
    var isTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    var vControls = document.getElementById('vertical-controls');
    var hints = document.getElementById('touch-hints');
    if (vControls) vControls.classList.remove('hidden');
    if (!hints) return;

    hints.classList.remove('hidden');
    document.addEventListener('touchstart', function() {
      hints.style.opacity = '0';
      setTimeout(function() {
        hints.classList.add('hidden');
        hints.style.opacity = '';
      }, 500);
      // 上下按钮保留，仅消退引导色
      if (vControls) vControls.classList.add('fade-guide');
    }, { once: true });
  }

  render = () => {
    if (this.isPaused || this.renderers.length === 0) return;
    const {mat4, vec3} = glMatrix;
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 70 * Math.PI / 180, aspect, 1, 5000.0);
    const view = mat4.create();
    this.camera.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.pitch));
    mat4.rotateX(view, view, this.camera.pitch);
    mat4.rotateY(view, view, this.camera.yaw);
    mat4.translate(view, view, this.camera.pos);

    for (var i = 0; i < this.renderers.length; i++) {
      var r = this.renderers[i];
      var offsetView = mat4.clone(view);
      mat4.translate(offsetView, offsetView,
        [r.position[0], r.position[1], r.position[2]]);
      r.renderer.drawStructure(offsetView, projectionMatrix);
    }
    this.renderers[0].renderer.drawGrid(view, projectionMatrix);
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
      if (this.isPaused) return;
      let direction = glMatrix.vec3.create();
      var s = this.speedScale;

      const keyMap = {
        KeyW: [0, 0, 0.2 * s],
        KeyS: [0, 0, -0.2 * s],
        KeyA: [-0.2 * s, 0, 0],
        KeyD: [0.2 * s, 0, 0],
        Space: [0, -0.2 * s, 0],
        ShiftLeft: [0, 0.2 * s, 0]
      };

      this.pressedKeys.forEach(k => {
        if (keyMap[k]) glMatrix.vec3.add(direction, direction, keyMap[k]);
      });

      if (this.joystickVector) {
        var jv = this.joystickVector;
        if (jv[0] !== 0 || jv[2] !== 0) {
          var js = 0.3 * s;
          glMatrix.vec3.add(direction, direction,
            [jv[0] * js, 0, jv[2] * js]);
        }
      }

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