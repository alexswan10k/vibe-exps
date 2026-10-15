/* ==========================================================================
 * HYPERBOLIA — WebGL2 renderer
 *
 * A single fullscreen triangle, one fragment shader, no textures and no
 * buffers. Owns the canvas, the resolution scaler and every uniform.
 * ========================================================================== */

class HyperRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl =
      canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      });

    if (!this.gl) throw new Error("WebGL2 is required for HYPERBOLIA.");

    this.program = this._link(HYPERBOLIA_VERT, HYPERBOLIA_FRAG);
    this.u = {};
    const n = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = this.gl.getActiveUniform(this.program, i);
      this.u[info.name] = this.gl.getUniformLocation(this.program, info.name);
    }

    this.vao = this.gl.createVertexArray();

    /**
     * Adaptive resolution. The signal has to be the rAF interval, not the time
     * spent in drawArrays — GL commands are queued, so submit time says
     * nothing about how long the frame actually took.
     */
    this.scale = 0.85;
    this.minScale = 0.4;
    this.maxScale = 1.0;
    this.fps = 60;
    this._acc = 0;
    this._frames = 0;
    this.lastTime = 0;
  }

  _compile(type, src) {
    const sh = this.gl.createShader(type);
    this.gl.shaderSource(sh, src);
    this.gl.compileShader(sh);
    if (!this.gl.getShaderParameter(sh, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(sh);
      const numbered = src
        .split("\n")
        .map((l, i) => `${String(i + 1).padStart(4)} | ${l}`)
        .join("\n");
      throw new Error(`Shader compile failed:\n${log}\n\n${numbered}`);
    }
    return sh;
  }

  _link(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this._compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this._compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, this.gl.LINK_STATUS)) {
      throw new Error("Link failed: " + gl.getProgramInfoLog(p));
    }
    return p;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * this.scale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * this.scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /**
   * @param {object} s scene description, all already in Klein/folded space.
   */
  draw(s, now) {
    const gl = this.gl;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, now / 1000);
    gl.uniform3f(this.u.uRo, s.camPos[0], s.camPos[1], s.camPos[2]);
    gl.uniformMatrix3fv(this.u.uCam, false, s.camMat);
    gl.uniform1f(this.u.uTanHalf, Math.tan((s.fov * Math.PI) / 360));
    gl.uniform1f(this.u.uD, s.D);
    gl.uniform1f(this.u.uDoor, s.door);
    gl.uniform1f(this.u.uCurv, s.curv);
    gl.uniform1f(this.u.uFog, s.fog);
    gl.uniform1f(this.u.uGlow, s.glow);
    gl.uniform1f(this.u.uPanel, s.panel);
    gl.uniform1f(this.u.uPalette, s.palette);
    gl.uniform1f(this.u.uHead, s.head);
    gl.uniform1f(this.u.uShadow, s.shadow);
    gl.uniform1i(this.u.uSteps, s.steps);
    gl.uniform1i(this.u.uAA, s.aa ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- adaptive resolution, driven by the real frame interval ----------
    if (this.lastTime) {
      this._acc += now - this.lastTime;
      this._frames++;
    }
    this.lastTime = now;
    if (this._acc > 400) {
      this.fps = (this._frames * 1000) / this._acc;
      this._acc = 0;
      this._frames = 0;
      const prev = this.scale;
      if (this.fps < 40) this.scale -= 0.07;
      else if (this.fps > 78) this.scale += 0.04;
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
      if (Math.abs(this.scale - prev) > 1e-3) this.resize();
    }
  }
}
