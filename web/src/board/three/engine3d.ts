// WebGL1/WebGL2 render dvigateli: 1024×1024 soya xaritasi, PBR yoritish, dinamik LED nurlari va Bloom.
import type { RealStyle } from '../../theme';
import { mat4LookAt, mat4Multiply, mat4Ortho, normalize3, type OrbitCamera } from './math3d';
import { VERTEX_FLOATS, type MeshBucket, type Scene3DData } from './meshes3d';
import { BLUR_FRAG, COMPOSITE_FRAG, EXTRACT_FRAG, MAIN_FRAG, MAIN_VERT, QUAD_VERT, SHADOW_FRAG, SHADOW_VERT } from './shaders3d';
import { buildBoardTileCanvas, buildChipAtlasCanvas, buildLabelAtlasCanvas, PALETTES_3D, type UVRect } from './textures3d';

type GL = WebGLRenderingContext | WebGL2RenderingContext;

interface GPUBucket {
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  indexCount: number;
}

interface FBO {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  depth?: WebGLRenderbuffer;
  w: number;
  h: number;
}

interface MsaaFBO {
  fbo: WebGLFramebuffer;
  color: WebGLRenderbuffer;
  depth: WebGLRenderbuffer;
  samples: number;
  w: number;
  h: number;
}

interface AnisoExt {
  TEXTURE_MAX_ANISOTROPY_EXT: number;
  MAX_TEXTURE_MAX_ANISOTROPY_EXT: number;
}

const SHADOW_SIZE = 2048;
const SUN_DIR: [number, number, number] = normalize3([0.45, 0.85, 0.35]);
const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

export class Engine3D {
  readonly gl: GL;
  private isWebGL2: boolean;
  private anisoExt: AnisoExt | null;
  private maxAniso: number;
  private shadowProg: WebGLProgram;
  private mainProg: WebGLProgram;
  private extractProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private compProg: WebGLProgram;

  private quadVbo: WebGLBuffer;
  private buckets: Record<'solid' | 'boardTop' | 'chipTops' | 'labels', GPUBucket>;

  private chipTex: WebGLTexture;
  private boardTex: WebGLTexture;
  private labelTex: WebGLTexture;
  private currentStyle: RealStyle | null = null;
  private labelKey = '';
  labelUVs = new Map<string, UVRect>();

  private shadowFbo: FBO | null = null;
  private msaaFbo: MsaaFBO | null = null;
  private sceneFbo: FBO | null = null;
  private bloomA: FBO | null = null;
  private bloomB: FBO | null = null;
  private usePost = false;

  private width = 1;
  private height = 1;
  private pixelW = 1;
  private pixelH = 1;

  private lightPosArr = new Float32Array(24);
  private lightColArr = new Float32Array(24);

  private constructor(gl: GL) {
    this.gl = gl;
    this.isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.anisoExt = (gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')) as AnisoExt | null;
    this.maxAniso = this.anisoExt
      ? Math.min(8, Number(gl.getParameter(this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 1)
      : 1;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    this.shadowProg = this.program(SHADOW_VERT, SHADOW_FRAG);
    this.mainProg = this.program(MAIN_VERT, MAIN_FRAG, true);
    this.extractProg = this.program(QUAD_VERT, EXTRACT_FRAG);
    this.blurProg = this.program(QUAD_VERT, BLUR_FRAG);
    this.compProg = this.program(QUAD_VERT, COMPOSITE_FRAG);

    this.quadVbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const mkBucket = (): GPUBucket => ({
      vbo: gl.createBuffer()!,
      ibo: gl.createBuffer()!,
      indexCount: 0,
    });
    this.buckets = {
      solid: mkBucket(),
      boardTop: mkBucket(),
      chipTops: mkBucket(),
      labels: mkBucket(),
    };

    this.chipTex = gl.createTexture()!;
    this.boardTex = gl.createTexture()!;
    this.labelTex = gl.createTexture()!;

    this.shadowFbo = this.createFBO(SHADOW_SIZE, SHADOW_SIZE, true, false);
    // Post-ishlov (bloom) sahna va bloom buferlarini talab qiladi — ular resize() da, o'lcham ma'lum
    // bo'lgach yaratiladi. Oldin bu yerda soya buferiga qarab yoqilardi va ResizeObserver'dan oldingi
    // birinchi kadr (maydon hali o'lchamsiz bo'lsa) bo'sh sceneFbo ga murojaat qilib TypeError berardi.
    this.usePost = false;
  }

  static create(canvas: HTMLCanvasElement): Engine3D | null {
    const opts: WebGLContextAttributes = { antialias: true, alpha: false, powerPreference: 'high-performance' };
    const gl = (canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts)) as GL | null;
    if (!gl || gl.isContextLost()) return null;
    try {
      return new Engine3D(gl);
    } catch {
      return null;
    }
  }

  /**
   * Kanvasdagi kontekst bor, lekin hozir yo'qolgan (GPU xotirasi bo'shatilgan) — brauzer uni qaytaradi,
   * bu «WebGL yo'q» degani emas. Faqat create() null qaytargandan keyin chaqiriladi.
   */
  static isLost(canvas: HTMLCanvasElement): boolean {
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as GL | null;
    return !!gl && gl.isContextLost();
  }

  private shader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) ?? 'shader error';
      gl.deleteShader(s);
      throw new Error(log);
    }
    return s;
  }

  private program(vsSrc: string, fsSrc: string, fullAttribs = false): WebGLProgram {
    const gl = this.gl;
    const vs = this.shader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.shader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    if (fullAttribs) {
      gl.bindAttribLocation(p, 1, 'aNorm');
      gl.bindAttribLocation(p, 2, 'aUV');
      gl.bindAttribLocation(p, 3, 'aCol');
      gl.bindAttribLocation(p, 4, 'aMat');
    }
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? 'link error';
      gl.deleteProgram(p);
      throw new Error(log);
    }
    return p;
  }

  private createFBO(w: number, h: number, withDepth: boolean, linear: boolean): FBO | null {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let depth: WebGLRenderbuffer | undefined;
    if (withDepth) {
      depth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      const depthFmt = this.isWebGL2 ? (gl as WebGL2RenderingContext).DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16;
      gl.renderbufferStorage(gl.RENDERBUFFER, depthFmt, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }

    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
      if (depth) gl.deleteRenderbuffer(depth);
      return null;
    }
    return { fbo, tex, depth, w, h };
  }

  /** WebGL2 apparat MSAA buferi: post-ishlov (bloom) paytida ham barcha 3D qirralar silliq chiziladi. */
  private createMsaaFBO(w: number, h: number, targetSamples: number): MsaaFBO | null {
    if (!this.isWebGL2) return null;
    const gl2 = this.gl as WebGL2RenderingContext;
    const maxSamples = Number(gl2.getParameter(gl2.MAX_SAMPLES)) || 0;
    const samples = Math.min(targetSamples, maxSamples);
    if (samples < 2) return null;

    const fbo = gl2.createFramebuffer();
    const color = gl2.createRenderbuffer();
    const depth = gl2.createRenderbuffer();
    if (!fbo || !color || !depth) {
      if (fbo) gl2.deleteFramebuffer(fbo);
      if (color) gl2.deleteRenderbuffer(color);
      if (depth) gl2.deleteRenderbuffer(depth);
      return null;
    }

    gl2.bindFramebuffer(gl2.FRAMEBUFFER, fbo);
    gl2.bindRenderbuffer(gl2.RENDERBUFFER, color);
    gl2.renderbufferStorageMultisample(gl2.RENDERBUFFER, samples, gl2.RGBA8, w, h);
    gl2.framebufferRenderbuffer(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.RENDERBUFFER, color);

    let ok = false;
    for (const depthFmt of [gl2.DEPTH_COMPONENT24, gl2.DEPTH_COMPONENT16]) {
      gl2.bindRenderbuffer(gl2.RENDERBUFFER, depth);
      gl2.renderbufferStorageMultisample(gl2.RENDERBUFFER, samples, depthFmt, w, h);
      gl2.framebufferRenderbuffer(gl2.FRAMEBUFFER, gl2.DEPTH_ATTACHMENT, gl2.RENDERBUFFER, depth);
      if (gl2.checkFramebufferStatus(gl2.FRAMEBUFFER) === gl2.FRAMEBUFFER_COMPLETE) {
        ok = true;
        break;
      }
    }
    gl2.bindRenderbuffer(gl2.RENDERBUFFER, null);
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);

    if (!ok) {
      gl2.deleteFramebuffer(fbo);
      gl2.deleteRenderbuffer(color);
      gl2.deleteRenderbuffer(depth);
      return null;
    }
    return { fbo, color, depth, samples, w, h };
  }

  private deleteMsaaFBO(f: MsaaFBO | null) {
    if (!f) return;
    const gl = this.gl;
    gl.deleteFramebuffer(f.fbo);
    gl.deleteRenderbuffer(f.color);
    gl.deleteRenderbuffer(f.depth);
  }

  private deleteFBO(f: FBO | null) {
    if (!f) return;
    const gl = this.gl;
    gl.deleteFramebuffer(f.fbo);
    gl.deleteTexture(f.tex);
    if (f.depth) gl.deleteRenderbuffer(f.depth);
  }

  private uploadTexture(tex: WebGLTexture, canvas: HTMLCanvasElement, repeat: boolean) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    const canMip = this.isWebGL2 || (isPow2(canvas.width) && isPow2(canvas.height));
    const wrap = repeat && canMip ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (canMip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (this.anisoExt && this.maxAniso > 1) {
        gl.texParameterf(gl.TEXTURE_2D, this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, this.maxAniso);
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  syncTextures(style: RealStyle, labels: string[], expWord = 'kerak') {
    if (this.currentStyle !== style) {
      this.currentStyle = style;
      this.uploadTexture(this.chipTex, buildChipAtlasCanvas(style), false);
      this.uploadTexture(this.boardTex, buildBoardTileCanvas(style), true);
      this.labelKey = '';
    }
    const key = `${style}|${expWord}|${labels.join(',')}`;
    if (this.labelKey !== key) {
      this.labelKey = key;
      const atlas = buildLabelAtlasCanvas(style, labels, expWord);
      this.labelUVs = atlas.uvs;
      this.uploadTexture(this.labelTex, atlas.canvas, false);
    }
  }

  uploadScene(scene: Scene3DData) {
    const upload = (b: GPUBucket, data: MeshBucket) => {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data.verts, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.DYNAMIC_DRAW);
      b.indexCount = data.indexCount;
    };
    upload(this.buckets.solid, scene.solid);
    upload(this.buckets.boardTop, scene.boardTop);
    upload(this.buckets.chipTops, scene.chipTops);
    upload(this.buckets.labels, scene.labels);
  }

  resize(cssWidth: number, cssHeight: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, cssWidth);
    this.height = Math.max(1, cssHeight);
    const pw = Math.max(1, Math.round(this.width * dpr));
    const ph = Math.max(1, Math.round(this.height * dpr));
    if (pw === this.pixelW && ph === this.pixelH && this.sceneFbo) return;
    this.pixelW = pw;
    this.pixelH = ph;
    const gl = this.gl;
    gl.canvas.width = pw;
    gl.canvas.height = ph;

    this.deleteMsaaFBO(this.msaaFbo);
    this.deleteFBO(this.sceneFbo);
    this.deleteFBO(this.bloomA);
    this.deleteFBO(this.bloomB);

    const bw = Math.max(64, Math.floor(pw / 2));
    const bh = Math.max(64, Math.floor(ph / 2));
    this.msaaFbo = this.createMsaaFBO(pw, ph, dpr > 1.5 ? 4 : 8);
    this.sceneFbo = this.createFBO(pw, ph, !this.msaaFbo, true);
    this.bloomA = this.createFBO(bw, bh, false, true);
    this.bloomB = this.createFBO(bw, bh, false, true);
    this.usePost = !!(this.sceneFbo && this.bloomA && this.bloomB);
  }

  private bindMeshAttribs(_prog: WebGLProgram, b: GPUBucket, full: boolean) {
    const gl = this.gl;
    const stride = VERTEX_FLOATS * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ibo);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    if (full) {
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 48);
    } else {
      for (let i = 1; i <= 4; i++) gl.disableVertexAttribArray(i);
    }
  }

  private drawQuad(_prog: WebGLProgram) {
    const gl = this.gl;
    for (let i = 1; i <= 4; i++) gl.disableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  render(camera: OrbitCamera, scene: Scene3DData, style: RealStyle, timeSec: number, motionOn: boolean) {
    const gl = this.gl;
    // loseContext() bilan 'webglcontextlost' hodisasi orasidagi kadr: chizish baribir hech narsa qilmaydi.
    if (gl.isContextLost()) return;
    const pal = PALETTES_3D[style];
    const { eye, vp } = camera.matrices(this.width, this.height);

    // Soya kamerasi (sxema markaziga qaratilgan)
    const b = scene.bounds3D;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 300) * 0.72;
    const lEye: [number, number, number] = [cx + SUN_DIR[0] * 700, SUN_DIR[1] * 700, cz + SUN_DIR[2] * 700];
    const lView = mat4LookAt(lEye, [cx, 0, cz], [0, 1, 0]);
    const lProj = mat4Ortho(-span, span, -span, span, 80, 1600);
    const lightVP = mat4Multiply(lProj, lView);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    // 1. Soya xaritasi bosqichi
    if (this.shadowFbo) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo.fbo);
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.shadowProg);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.shadowProg, 'uLightVP'), false, lightVP);

      for (const key of ['solid', 'boardTop'] as const) {
        const bk = this.buckets[key];
        if (!bk.indexCount) continue;
        this.bindMeshAttribs(this.shadowProg, bk, false);
        gl.drawElements(gl.TRIANGLES, bk.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    // 2. Asosiy PBR + dinamik LED yoritish bosqichi (WebGL2 da apparat MSAA orqali)
    const direct = !this.usePost;
    const renderTarget = direct ? null : (this.msaaFbo?.fbo ?? this.sceneFbo!.fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget);
    gl.viewport(0, 0, this.pixelW, this.pixelH);
    gl.clearColor(pal.clearColor[0], pal.clearColor[1], pal.clearColor[2], 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.mainProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.mainProg, 'uVP'), false, vp);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.mainProg, 'uLightVP'), false, lightVP);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uCamPos'), eye);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uSunDir'), SUN_DIR);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uSkyCol'), pal.ambientSky);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uGroundCol'), pal.ambientGround);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uClearCol'), pal.clearColor);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uPulseCol'), pal.pulse);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'uTime'), timeSec);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'uMotion'), motionOn ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(this.mainProg, 'uDirect'), direct ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(this.mainProg, 'uShadowTexel'), 1 / SHADOW_SIZE, 1 / SHADOW_SIZE);

    this.lightPosArr.fill(0);
    this.lightColArr.fill(0);
    for (let i = 0; i < 8 && i < scene.lights.length; i++) {
      const l = scene.lights[i];
      this.lightPosArr[i * 3] = l.pos[0];
      this.lightPosArr[i * 3 + 1] = l.pos[1];
      this.lightPosArr[i * 3 + 2] = l.pos[2];
      this.lightColArr[i * 3] = l.color[0] * l.intensity;
      this.lightColArr[i * 3 + 1] = l.color[1] * l.intensity;
      this.lightColArr[i * 3 + 2] = l.color[2] * l.intensity;
    }
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uLightPos[0]'), this.lightPosArr);
    gl.uniform3fv(gl.getUniformLocation(this.mainProg, 'uLightCol[0]'), this.lightColArr);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowFbo ? this.shadowFbo.tex : this.boardTex);
    gl.uniform1i(gl.getUniformLocation(this.mainProg, 'uShadowMap'), 1);

    // TEXTURE0 da oldingi kadrdagi sceneFbo.tex qolib FBO feedback-loop xatosini bermasligi uchun
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.boardTex);
    gl.uniform1i(gl.getUniformLocation(this.mainProg, 'uTex'), 0);

    const drawBucket = (bk: GPUBucket, tex: WebGLTexture | null, discardAlpha: boolean) => {
      if (!bk.indexCount) return;
      gl.uniform1f(gl.getUniformLocation(this.mainProg, 'uUseTex'), tex ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.mainProg, 'uTexAlphaDiscard'), discardAlpha ? 1 : 0);
      if (tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.mainProg, 'uTex'), 0);
      }
      this.bindMeshAttribs(this.mainProg, bk, true);
      gl.drawElements(gl.TRIANGLES, bk.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    drawBucket(this.buckets.solid, null, false);
    drawBucket(this.buckets.boardTop, this.boardTex, false);
    drawBucket(this.buckets.chipTops, this.chipTex, false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.depthMask(false);
    drawBucket(this.buckets.labels, this.labelTex, true);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    if (direct) return;

    // 2b. WebGL2 MSAA buferini teksturali sceneFbo ga aniq ko'chirish (resolve)
    if (this.msaaFbo) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, this.msaaFbo.fbo);
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, this.sceneFbo!.fbo);
      gl2.blitFramebuffer(0, 0, this.pixelW, this.pixelH, 0, 0, this.pixelW, this.pixelH, gl2.COLOR_BUFFER_BIT, gl2.NEAREST);
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, null);
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, null);
    }

    // 3. Bloom va ACES Filmic kompozit bosqichi
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const bw = this.bloomA!.w;
    const bh = this.bloomA!.h;
    gl.viewport(0, 0, bw, bh);

    // 3a. Yorqinlik niqobini ajratish
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA!.fbo);
    gl.useProgram(this.extractProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo!.tex);
    gl.uniform1i(gl.getUniformLocation(this.extractProg, 'uScene'), 0);
    this.drawQuad(this.extractProg);

    // 3b. Ikki bosqichli Gaussian xiralashtirish (H + V)
    gl.useProgram(this.blurProg);
    gl.uniform1i(gl.getUniformLocation(this.blurProg, 'uTex'), 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomB!.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA!.tex);
    gl.uniform2f(gl.getUniformLocation(this.blurProg, 'uStep'), 1.6 / bw, 0);
    this.drawQuad(this.blurProg);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA!.fbo);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomB!.tex);
    gl.uniform2f(gl.getUniformLocation(this.blurProg, 'uStep'), 0, 1.6 / bh);
    this.drawQuad(this.blurProg);

    // 3c. Ekranga yakuniy kompozit (WebGL1 da FXAA silliqlash bilan)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.pixelW, this.pixelH);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo!.tex);
    gl.uniform1i(gl.getUniformLocation(this.compProg, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomA!.tex);
    gl.uniform1i(gl.getUniformLocation(this.compProg, 'uBloom'), 1);
    gl.uniform2f(gl.getUniformLocation(this.compProg, 'uTexel'), 1 / this.pixelW, 1 / this.pixelH);
    gl.uniform1f(gl.getUniformLocation(this.compProg, 'uFxaa'), this.msaaFbo ? 0 : 1);
    this.drawQuad(this.compProg);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.shadowProg);
    gl.deleteProgram(this.mainProg);
    gl.deleteProgram(this.extractProg);
    gl.deleteProgram(this.blurProg);
    gl.deleteProgram(this.compProg);
    gl.deleteBuffer(this.quadVbo);
    for (const bk of Object.values(this.buckets)) {
      gl.deleteBuffer(bk.vbo);
      gl.deleteBuffer(bk.ibo);
    }
    gl.deleteTexture(this.chipTex);
    gl.deleteTexture(this.boardTex);
    gl.deleteTexture(this.labelTex);
    this.deleteFBO(this.shadowFbo);
    this.deleteMsaaFBO(this.msaaFbo);
    this.deleteFBO(this.sceneFbo);
    this.deleteFBO(this.bloomA);
    this.deleteFBO(this.bloomB);
  }
}
