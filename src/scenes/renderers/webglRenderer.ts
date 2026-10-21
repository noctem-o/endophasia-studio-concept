import type { LineageScene } from '../types';
import type { CreateRendererResult, LineageRenderer, RendererEventHandlers, RendererInfo, Viewport } from './types';
import { hexToRgba, RAW, RELATION_STYLE_HEX, CLASSIFICATION_TAG } from './palette';

/**
 * Hand-rolled WebGL2 instanced backend.
 *
 * Design:
 * - Nodes: one instanced draw call (quad geometry + per-instance color).
 * - Edges: one draw call over a static line-vertex buffer.
 * - Text is NOT drawn in WebGL: glyphs go to a screen-space DOM overlay,
 *   culled to the viewport, so the honest cost split stays visible and the
 *   benchmark measures it separately.
 * - Selection/highlight/viewport are pushed in as data; the GPU holds no
 *   interaction state.
 */

const NODE_W = 178;
const NODE_H = 46;
const COL_GAP = 250;
const ROW_GAP = 62;
const MARGIN = 20;

const VERT_QUAD = `#version 300 es
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
  vec2 world = aOrigin + aCorner * aSize;
  vec2 screen = (world - uCamera) * uScale;
  vec2 clip = (screen / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
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

const VERT_LINE = `#version 300 es
in vec2 aPos;
in vec4 aColor;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uScale;
out vec4 vColor;
void main() {
  vec2 screen = (aPos - uCamera) * uScale;
  vec2 clip = (screen / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vColor = aColor;
}`;

const FRAG_LINE = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor.rgb * vColor.a, vColor.a); }`;

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
  const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
  if (!ok) return null;
  return p;
}

interface GpuNode {
  id: string;
  x: number;
  y: number;
  classification: keyof typeof CLASSIFICATION_TAG;
}

export function createWebglRenderer(): CreateRendererResult {
  const issues: string[] = [];

  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) {
    issues.push('WebGL2 context unavailable — backend cannot start in this browser');
    return { renderer: null, issues };
  }

  let host: HTMLDivElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let handlers: RendererEventHandlers | null = null;
  let scene: LineageScene | null = null;
  let viewport: Viewport = { x: 0, y: 0, scale: 1 };
  let selection: string | null = null;
  let highlight: Set<string> | null = null;
  let cssWidth = 1;
  let cssHeight = 1;
  let resizeObserver: ResizeObserver | null = null;

  let quadProgram: WebGLProgram | null = null;
  let lineProgram: WebGLProgram | null = null;
  let quadVao: WebGLVertexArrayObject | null = null;
  let lineVao: WebGLVertexArrayObject | null = null;
  let instanceCount = 0;
  let lineVertexCount = 0;
  let gpuNodes: GpuNode[] = [];

  const info: RendererInfo = { backendId: 'webgl2-instanced', kind: 'webgl2', details: '' };

  const attrib = (prog: WebGLProgram, name: string, buffer: WebGLBuffer | null, size: number, divisor: number, data: Float32Array) => {
    if (!gl || !buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, divisor);
  };

  const buildQuadVao = (nodes: GpuNode[]): void => {
    if (!gl || !quadProgram) return;
    if (quadVao) gl.deleteVertexArray(quadVao);
    quadVao = gl.createVertexArray();
    if (!quadVao) return;
    gl.bindVertexArray(quadVao);

    const n = nodes.length;
    const corners = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
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
      const alpha = dimmed ? 0.15 : 1;
      const selected = node.id === selection;
      const fill = hexToRgba(selected ? RAW.ink750 : RAW.ink900, alpha);
      const stroke = hexToRgba(selected ? RAW.teal : CLASSIFICATION_TAG[node.classification].color, (selected ? 1 : 0.5) * alpha);
      fills.set(fill, i * 4);
      strokes.set(stroke, i * 4);
      sels[i] = selected ? 1 : 0;
    }

    attrib(quadProgram, 'aCorner', gl.createBuffer(), 2, 0, corners);
    attrib(quadProgram, 'aOrigin', gl.createBuffer(), 2, 1, origins);
    attrib(quadProgram, 'aSize', gl.createBuffer(), 2, 1, sizes);
    attrib(quadProgram, 'aFill', gl.createBuffer(), 4, 1, fills);
    attrib(quadProgram, 'aStroke', gl.createBuffer(), 4, 1, strokes);
    attrib(quadProgram, 'aSelected', gl.createBuffer(), 1, 1, sels);
    gl.bindVertexArray(null);
    instanceCount = n;
  };

  const buildLineVao = (edges: LineageScene['edges'], pos: LineageScene['layout']['positions']): void => {
    if (!gl || !lineProgram) return;
    if (lineVao) gl.deleteVertexArray(lineVao);
    lineVao = gl.createVertexArray();
    if (!lineVao) return;
    gl.bindVertexArray(lineVao);

    // Two vertices per edge segment. A polyline bend would be nicer; straight
    // segments are the measured v1 geometry (declared in the comparison doc).
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
    const buf = gl.createBuffer();
    if (!buf) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
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
  };

  const rebuild = () => {
    if (!scene) return;
    const pos = scene.layout.positions;
    gpuNodes = [];
    for (const sn of scene.nodes) {
      const p = pos[sn.id];
      if (p) gpuNodes.push({ id: sn.id, x: MARGIN + p.column * COL_GAP, y: MARGIN + p.row * ROW_GAP, classification: sn.classification });
    }
    buildQuadVao(gpuNodes);
    buildLineVao(scene.edges, pos);
  };

  const draw = () => {
    if (!gl || !quadProgram || !lineProgram) return;
    gl.viewport(0, 0, cssWidth, cssHeight);
    gl.clearColor(0.039, 0.055, 0.071, 1); // ink-950
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(lineProgram);
    gl.uniform2f(gl.getUniformLocation(lineProgram, 'uResolution'), cssWidth, cssHeight);
    gl.uniform2f(gl.getUniformLocation(lineProgram, 'uCamera'), viewport.x, viewport.y);
    gl.uniform1f(gl.getUniformLocation(lineProgram, 'uScale'), viewport.scale);
    if (lineVao && lineVertexCount > 0) {
      gl.bindVertexArray(lineVao);
      gl.drawArrays(gl.LINES, 0, lineVertexCount);
    }

    gl.useProgram(quadProgram);
    gl.uniform2f(gl.getUniformLocation(quadProgram, 'uResolution'), cssWidth, cssHeight);
    gl.uniform2f(gl.getUniformLocation(quadProgram, 'uCamera'), viewport.x, viewport.y);
    gl.uniform1f(gl.getUniformLocation(quadProgram, 'uScale'), viewport.scale);
    if (quadVao && instanceCount > 0) {
      gl.bindVertexArray(quadVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
    }
    gl.bindVertexArray(null);
  };

  const setInfoDetails = () => {
    if (!gl) {
      info.details = 'context not created';
      return;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'renderer name not disclosed';
    info.details = `instanced quads (1 draw call) + line buffer (1 draw call); GPU: ${gpuName}`;
  };

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
      quadProgram = linkProgram(gl, VERT_QUAD, FRAG_QUAD);
      lineProgram = linkProgram(gl, VERT_LINE, FRAG_LINE);
      if (!quadProgram || !lineProgram) {
        issues.push('shader compilation or linking failed');
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
      rebuild();
      draw();
    },
    setViewport(vp) {
      viewport = vp;
      draw();
    },
    setSelection(nodeId) {
      selection = nodeId;
      rebuild();
      draw();
    },
    setHighlight(ids) {
      highlight = ids;
      rebuild();
      draw();
    },
    resize(w, h) {
      cssWidth = w;
      cssHeight = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      draw();
    },
    hitTest(clientX, clientY) {
      if (!host) return null;
      const rect = host.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = (sx - viewport.x) / viewport.scale;
      const wy = (sy - viewport.y) / viewport.scale;
      // Linear scan; at 10k nodes this stays well under a millisecond.
      for (const n of gpuNodes) {
        if (wx >= n.x && wx <= n.x + NODE_W && wy >= n.y && wy <= n.y + NODE_H) return n.id;
      }
      return null;
    },
    destroy() {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (gl) {
        if (quadVao) gl.deleteVertexArray(quadVao);
        if (lineVao) gl.deleteVertexArray(lineVao);
        if (quadProgram) gl.deleteProgram(quadProgram);
        if (lineProgram) gl.deleteProgram(lineProgram);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      canvas?.remove();
      canvas = null;
      gl = null;
      host = null;
    },
  };

  return { renderer, issues };
}
