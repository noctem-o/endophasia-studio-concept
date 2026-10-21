import type { LineageScene, SceneNodeClassification } from '../types';
import type { CreateRendererResult, LineageRenderer, RendererEventHandlers, RendererInfo, Viewport } from './types';
import { hexToRgba, nodePaint, RAW, RELATION_STYLE_HEX } from './palette';
import { worldFromScreen } from '../interaction';

/**
 * Hand-rolled WebGL2 instanced backend.
 *
 * Design:
 * - Nodes: one instanced draw call (quad geometry + per-instance color).
 * - Edges: one draw call over a static line-vertex buffer.
 * - Text is NOT drawn in WebGL: glyphs go to a screen-space DOM overlay,
 *   culled to the viewport, so the honest cost split stays visible and the
 *   benchmark measures it separately.
 * - Selection/highlight are per-instance colors updated in-place over a
 *   small buffer range — geometry is never rebuilt for interaction state.
 * - Every buffer, VAO, and program is tracked and deleted on scene swap and
 *   destroy; context loss releases everything through the loss handler.
 *
 * Camera convention (identical to SVG backend and CPU hit-testing):
 *   screen = world * scale + offset — in CSS pixels. The drawing buffer is
 * DPR × CSS size; gl.viewport works in buffer pixels, while uResolution is
 * the CSS-pixel size so the clip mapping matches SVG and hit-testing at any
 * DPR. Mouse positions (CSS px) map directly, no DPR conversion.
 */

const NODE_W = 178;
const NODE_H = 46;
const COL_GAP = 250;
const ROW_GAP = 62;
const MARGIN = 20;

// Shared GLSL camera: world→screen follows the documented convention
// screen = world * scale + offset; screen→clip flips Y because GL clip space
// has +Y up while screen space has +Y down. Identical mapping to the SVG
// backend's translate+scale group transform and the CPU hit-test.
const GLSL_CAMERA = `
vec2 worldToScreen(vec2 world, vec2 offset, float scale) {
  return world * scale + offset;
}
vec2 screenToClip(vec2 screen, vec2 resolution) {
  vec2 clip = (screen / resolution) * 2.0 - 1.0;
  return vec2(clip.x, -clip.y);
}`;

const VERT_QUAD = `#version 300 es
${GLSL_CAMERA}
in vec2 aCorner;
in vec2 aOrigin;
in vec2 aSize;
in vec4 aFill;
in vec4 aStroke;
in float aSelected;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uScale;
out vec2 vLocal;
out vec4 vFill;
out vec4 vStroke;
out float vSelected;
void main() {
  vec2 screen = worldToScreen(aOrigin + aCorner * aSize, uCamera, uScale);
  vec2 clip = screenToClip(screen, uResolution);
  gl_Position = vec4(clip, 0.0, 1.0);
  vLocal = aCorner;
  vFill = aFill;
  vStroke = aStroke;
  vSelected = aSelected;
}`;

const FRAG_QUAD = `#version 300 es
precision mediump float;
in vec2 vLocal;
in vec4 vFill;
in vec4 vStroke;
in float vSelected;
out vec4 outColor;
void main() {
  float ring = 0.02;
  bool body = vLocal.x > ring && vLocal.x < 1.0 - ring && vLocal.y > ring && vLocal.y < 1.0 - ring;
  vec4 color = body ? vFill : vStroke;
  outColor = vec4(color.rgb * color.a, color.a);
}`;

const FRAG_LINE = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor.rgb * vColor.a, vColor.a); }`;

const VERT_LINE = `#version 300 es
${GLSL_CAMERA}
in vec2 aPos;
in vec4 aColor;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uScale;
out vec4 vColor;
void main() {
  vec2 screen = worldToScreen(aPos, uCamera, uScale);
  vec2 clip = screenToClip(screen, uResolution);
  gl_Position = vec4(clip, 0.0, 1.0);
  vColor = aColor;
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.detachShader(p, v);
    gl.detachShader(p, f);
    gl.deleteShader(v);
    gl.deleteShader(f);
    gl.deleteProgram(p);
    return null;
  }
  gl.detachShader(p, v);
  gl.detachShader(p, f);
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}

interface GpuNode {
  id: string;
  x: number;
  y: number;
  classification: SceneNodeClassification;
}

interface GpuResources {
  buffers: WebGLBuffer[];
  vaos: WebGLVertexArrayObject[];
  programs: WebGLProgram[];
  shaders: WebGLShader[];
}

function newResources(): GpuResources {
  return { buffers: [], vaos: [], programs: [], shaders: [] };
}

function deleteResources(gl: WebGL2RenderingContext, r: GpuResources): void {
  for (const b of r.buffers) gl.deleteBuffer(b);
  for (const v of r.vaos) gl.deleteVertexArray(v);
  for (const p of r.programs) gl.deleteProgram(p);
  for (const s of r.shaders) gl.deleteShader(s);
  r.buffers.length = 0;
  r.vaos.length = 0;
  r.programs.length = 0;
  r.shaders.length = 0;
}

export function createWebglRenderer(): CreateRendererResult {
  const issues: string[] = [];

  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) {
    issues.push('WebGL2 context unavailable — backend cannot start in this browser');
    return { renderer: null, issues };
  }
  void probe;

  let host: HTMLDivElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let handlers: RendererEventHandlers | null = null;
  let scene: LineageScene | null = null;
  let viewport: Viewport = { x: 0, y: 0, scale: 1 };
  let selection: string | null = null;
  let highlight: Set<string> | null = null;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let resizeObserver: ResizeObserver | null = null;
  let contextLost = false;

  let resources: GpuResources = newResources();
  let quadProgram: WebGLProgram | null = null;
  let lineProgram: WebGLProgram | null = null;
  let quadVao: WebGLVertexArrayObject | null = null;
  let lineVao: WebGLVertexArrayObject | null = null;
  let quadOriginBuf: WebGLBuffer | null = null;
  let quadSizeBuf: WebGLBuffer | null = null;
  let quadFillBuf: WebGLBuffer | null = null;
  let quadStrokeBuf: WebGLBuffer | null = null;
  let quadSelBuf: WebGLBuffer | null = null;
  let quadCornerBuf: WebGLBuffer | null = null;
  let lineBuf: WebGLBuffer | null = null;
  let instanceCount = 0;
  let lineVertexCount = 0;
  let gpuNodes: GpuNode[] = [];

  const info: RendererInfo = { backendId: 'webgl2-instanced', kind: 'webgl2', details: '' };

  function trackBuffer(b: WebGLBuffer | null): WebGLBuffer | null {
    if (b) resources.buffers.push(b);
    return b;
  }

  function trackVao(v: WebGLVertexArrayObject | null): WebGLVertexArrayObject | null {
    if (v) resources.vaos.push(v);
    return v;
  }

  function releaseAll(): void {
    if (!gl) return;
    deleteResources(gl, resources);
    resources = newResources();
    quadProgram = null;
    lineProgram = null;
    quadVao = null;
    lineVao = null;
    quadOriginBuf = quadSizeBuf = quadFillBuf = quadStrokeBuf = quadSelBuf = quadCornerBuf = lineBuf = null;
    instanceCount = 0;
    lineVertexCount = 0;
    gpuNodes = [];
  }

  const draw = () => {
    if (!gl || !canvas || contextLost || !quadProgram || !lineProgram) return;
    if (cssW <= 0 || cssH <= 0) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const [clearR, clearG, clearB] = hexToRgba(RAW.canvas, 1); // the canvas surface token
    gl.clearColor(clearR, clearG, clearB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // uResolution is the CSS-pixel size, not the buffer size: the camera
    // produces CSS-pixel screen coordinates (same as SVG and hit-testing),
    // and the clip mapping must divide by CSS size to agree at any DPR.
    // gl.viewport above handles the buffer-pixel mapping.
    const resW = cssW;
    const resH = cssH;

    gl.useProgram(lineProgram);
    gl.uniform2f(gl.getUniformLocation(lineProgram, 'uResolution'), resW, resH);
    gl.uniform2f(gl.getUniformLocation(lineProgram, 'uCamera'), viewport.x, viewport.y);
    gl.uniform1f(gl.getUniformLocation(lineProgram, 'uScale'), viewport.scale);
    if (lineVao && lineVertexCount > 0) {
      gl.bindVertexArray(lineVao);
      gl.drawArrays(gl.LINES, 0, lineVertexCount);
    }

    gl.useProgram(quadProgram);
    gl.uniform2f(gl.getUniformLocation(quadProgram, 'uResolution'), resW, resH);
    gl.uniform2f(gl.getUniformLocation(quadProgram, 'uCamera'), viewport.x, viewport.y);
    gl.uniform1f(gl.getUniformLocation(quadProgram, 'uScale'), viewport.scale);
    if (quadVao && instanceCount > 0) {
      gl.bindVertexArray(quadVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
    }
    gl.bindVertexArray(null);
  };

  function untrackBuffer(b: WebGLBuffer | null): void {
    if (!b) return;
    const i = resources.buffers.indexOf(b);
    if (i >= 0) resources.buffers.splice(i, 1);
  }

  /** Delete the per-scene geometry (VAOs + buffers). Called before every
   * scene upload so repeated setScene calls do not retain GPU objects;
   * programs and shaders live for the renderer's lifetime. */
  function releaseSceneGeometry(): void {
    if (!gl) return;
    if (quadVao) gl.deleteVertexArray(quadVao);
    if (lineVao) gl.deleteVertexArray(lineVao);
    for (const b of [quadCornerBuf, quadOriginBuf, quadSizeBuf, quadFillBuf, quadStrokeBuf, quadSelBuf, lineBuf]) {
      if (b) gl.deleteBuffer(b);
      untrackBuffer(b);
    }
    quadVao = lineVao = null;
    quadCornerBuf = quadOriginBuf = quadSizeBuf = quadFillBuf = quadStrokeBuf = quadSelBuf = lineBuf = null;
    instanceCount = 0;
    lineVertexCount = 0;
    gpuNodes = [];
  }

  function uploadQuadGeometry(nodes: GpuNode[]): void {
    if (!gl || !quadProgram) return;
    const n = nodes.length;
    const origins = new Float32Array(n * 2);
    const sizes = new Float32Array(n * 2);
    const fills = new Float32Array(n * 4);
    const strokes = new Float32Array(n * 4);
    const sels = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      origins[i * 2] = node.x;
      origins[i * 2 + 1] = node.y;
      sizes[i * 2] = NODE_W;
      sizes[i * 2 + 1] = NODE_H;
      const dimmed = highlight !== null && !highlight.has(node.id);
      const selected = node.id === selection;
      const paint = nodePaint(node.classification, { selected, dimmed });
      const fill = hexToRgba(paint.fill.hex, paint.fill.alpha);
      const stroke = hexToRgba(paint.stroke.hex, paint.stroke.alpha);
      fills.set(fill, i * 4);
      strokes.set(stroke, i * 4);
      sels[i] = selected ? 1 : 0;
    }

    if (quadVao) return;
    quadVao = trackVao(gl.createVertexArray());
    if (!quadVao) return;
    gl.bindVertexArray(quadVao);

    const corners = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
    quadCornerBuf = trackBuffer(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, quadCornerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(quadProgram, 'aCorner');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    quadOriginBuf = trackBuffer(gl.createBuffer());
    quadSizeBuf = trackBuffer(gl.createBuffer());
    quadFillBuf = trackBuffer(gl.createBuffer());
    quadStrokeBuf = trackBuffer(gl.createBuffer());
    quadSelBuf = trackBuffer(gl.createBuffer());

    bindInstanced(quadProgram, 'aOrigin', quadOriginBuf, 2, origins);
    bindInstanced(quadProgram, 'aSize', quadSizeBuf, 2, sizes);
    bindInstanced(quadProgram, 'aFill', quadFillBuf, 4, fills);
    bindInstanced(quadProgram, 'aStroke', quadStrokeBuf, 4, strokes);
    bindInstanced(quadProgram, 'aSelected', quadSelBuf, 1, sels);

    gl.bindVertexArray(null);
    instanceCount = n;
  }

  function bindInstanced(prog: WebGLProgram, name: string, buf: WebGLBuffer | null, size: number, data: Float32Array): void {
    if (!gl || !buf) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, 1);
    void loc;
  }

  function buildLineGeometry(edges: LineageScene['edges'], pos: LineageScene['layout']['positions']): void {
    if (!gl || !lineProgram) return;
    lineVao = trackVao(gl.createVertexArray());
    if (!lineVao) return;
    gl.bindVertexArray(lineVao);

    const verts: number[] = [];
    for (const e of edges) {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) continue;
      const ax = MARGIN + a.column * COL_GAP + NODE_W;
      const ay = MARGIN + a.row * ROW_GAP + NODE_H / 2;
      const bx = MARGIN + b.column * COL_GAP;
      const by = MARGIN + b.row * ROW_GAP + NODE_H / 2;
      const [r, g, b2, a2] = hexToRgba(RELATION_STYLE_HEX[e.relation].stroke, 0.7);
      verts.push(ax, ay, r, g, b2, a2, bx, by, r, g, b2, a2);
    }
    lineBuf = trackBuffer(gl.createBuffer());
    if (!lineBuf) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const stride = 6 * 4;
    const aPos = gl.getAttribLocation(lineProgram, 'aPos');
    if (aPos >= 0) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    }
    const aColor = gl.getAttribLocation(lineProgram, 'aColor');
    if (aColor >= 0) {
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 8);
    }
    gl.bindVertexArray(null);
    lineVertexCount = verts.length / 6;
  }

  function rebuildAll(): void {
    if (!scene) return;
    releaseSceneGeometry();
    gpuNodes = [];
    for (const sn of scene.nodes) {
      const p = scene.layout.positions[sn.id];
      if (p) gpuNodes.push({ id: sn.id, x: MARGIN + p.column * COL_GAP, y: MARGIN + p.row * ROW_GAP, classification: sn.classification });
    }
    uploadQuadGeometry(gpuNodes);
    buildLineGeometry(scene.edges, scene.layout.positions);
  }

  // Per-instance selection/highlight colors are updated in place: only the
  // changed instances' ranges are re-uploaded, geometry is untouched.
  function updateInstanceColors(): void {
    if (!gl || !quadFillBuf || !quadStrokeBuf || !quadSelBuf) return;
    const fills = new Float32Array(instanceCount * 4);
    const strokes = new Float32Array(instanceCount * 4);
    const sels = new Float32Array(instanceCount);
    for (let i = 0; i < instanceCount; i++) {
      const node = gpuNodes[i];
      const dimmed = highlight !== null && !highlight.has(node.id);
      const selected = node.id === selection;
      const paint = nodePaint(node.classification, { selected, dimmed });
      const fill = hexToRgba(paint.fill.hex, paint.fill.alpha);
      const stroke = hexToRgba(paint.stroke.hex, paint.stroke.alpha);
      fills.set(fill, i * 4);
      strokes.set(stroke, i * 4);
      sels[i] = selected ? 1 : 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadFillBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, fills);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadStrokeBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, strokes);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadSelBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sels);
    draw();
  }

  function setInfoDetails(): void {
    if (!gl) {
      info.details = 'context not created';
      return;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'renderer name not disclosed';
    info.details = `instanced quads (1 draw call) + line buffer (1 draw call); GPU: ${gpuName}`;
  }

  const renderer: LineageRenderer = {
    info,
    mount(h, eventHandlers) {
      host = h;
      handlers = eventHandlers;
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      h.appendChild(canvas);
      gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });
      if (!gl) {
        issues.push('WebGL2 context creation failed on mount');
        return;
      }

      canvas.addEventListener('webglcontextlost', (ev) => {
        ev.preventDefault();
        contextLost = true;
        releaseAll();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        initGl();
        if (scene) rebuildAll();
        draw();
      });

      initGl();
      if (!quadProgram || !lineProgram) {
        issues.push('shader compilation or linking failed — backend reports itself unavailable');
        releaseAll();
        return;
      }

      setInfoDetails();

      const rect = h.getBoundingClientRect();
      renderer.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      resizeObserver = new ResizeObserver(() => {
        const r = h.getBoundingClientRect();
        renderer.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
      });
      resizeObserver.observe(h);

      h.addEventListener('click', (ev: MouseEvent) => {
        const nodeId = renderer.hitTest(ev.clientX, ev.clientY);
        handlers?.onNodeClick(nodeId);
      });
    },
    setScene(s) {
      scene = s;
      rebuildAll();
      draw();
    },
    setViewport(vp) {
      viewport = vp;
      draw();
    },
    setSelection(nodeId) {
      selection = nodeId;
      updateInstanceColors();
    },
    setHighlight(ids) {
      highlight = ids;
      updateInstanceColors();
    },
    resize(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = w;
      cssH = h;
      if (canvas) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      draw();
    },
    hitTest(clientX, clientY) {
      if (!host) return null;
      const rect = host.getBoundingClientRect();
      // Mouse position is CSS px; world mapping is DPR-independent because the
      // camera lives in CSS-pixel space (buffer conversion happens in draw).
      const w = worldFromScreen(viewport, clientX - rect.left, clientY - rect.top);
      for (const n of gpuNodes) {
        if (w.x >= n.x && w.x <= n.x + NODE_W && w.y >= n.y && w.y <= n.y + NODE_H) return n.id;
      }
      return null;
    },
    destroy() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      releaseAll();
      cssW = 0;
      cssH = 0;
      canvas?.remove();
      canvas = null;
      gl = null;
      host = null;
      handlers = null;
    },
  };

  function initGl(): void {
    if (!gl) return;
    releaseAll();

    const vq = compile(gl, gl.VERTEX_SHADER, VERT_QUAD);
    const fq = compile(gl, gl.FRAGMENT_SHADER, FRAG_QUAD);
    const vl = compile(gl, gl.VERTEX_SHADER, VERT_LINE);
    const fl = compile(gl, gl.FRAGMENT_SHADER, FRAG_LINE);
    if (!vq || !fq || !vl || !fl) {
      if (vq) gl.deleteShader(vq);
      if (fq) gl.deleteShader(fq);
      if (vl) gl.deleteShader(vl);
      if (fl) gl.deleteShader(fl);
      return;
    }
    quadProgram = linkProgram(gl, VERT_QUAD, FRAG_QUAD);
    lineProgram = linkProgram(gl, VERT_LINE, FRAG_LINE);
    if (!quadProgram || !lineProgram) return;
  }

  return { renderer, issues };
}
