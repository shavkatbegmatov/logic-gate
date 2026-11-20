// Sof TypeScript 3D matematika, orbita kamerasi va nur kesishish funksiyalari (tashqi kutubxonasiz).

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

export const MIN_CAM_DIST = 170;
export const MAX_CAM_DIST = 2400;
export const MIN_CAM_PITCH = 0.36;
export const MAX_CAM_PITCH = 1.48;
export const STUDIO_YAW = -0.2;
export const STUDIO_PITCH = 0.94;
export const PORTRAIT_STUDIO_YAW = -0.08;
export const PORTRAIT_STUDIO_PITCH = 1.02;
export const TOP_YAW = 0;
export const TOP_PITCH = 1.46;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / Math.max(0.05, aspect);
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4Ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = -2 * lr;
  out[5] = -2 * bt;
  out[10] = 2 * nf;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = normalize3(sub3(eye, target));
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  const out = new Float32Array(16);
  out[0] = x[0];
  out[1] = y[0];
  out[2] = z[0];
  out[4] = x[1];
  out[5] = y[1];
  out[6] = z[1];
  out[8] = x[2];
  out[9] = y[2];
  out[10] = z[2];
  out[12] = -dot3(x, eye);
  out[13] = -dot3(y, eye);
  out[14] = -dot3(z, eye);
  out[15] = 1;
  return out;
}

export function mat4Invert(a: Mat4): Mat4 | null {
  const m = a;
  const out = new Float32Array(16);
  const b00 = m[0] * m[5] - m[1] * m[4];
  const b01 = m[0] * m[6] - m[2] * m[4];
  const b02 = m[0] * m[7] - m[3] * m[4];
  const b03 = m[1] * m[6] - m[2] * m[5];
  const b04 = m[1] * m[7] - m[3] * m[5];
  const b05 = m[2] * m[7] - m[3] * m[6];
  const b06 = m[8] * m[13] - m[9] * m[12];
  const b07 = m[8] * m[14] - m[10] * m[12];
  const b08 = m[8] * m[15] - m[11] * m[12];
  const b09 = m[9] * m[14] - m[10] * m[13];
  const b10 = m[9] * m[15] - m[11] * m[13];
  const b11 = m[10] * m[15] - m[11] * m[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) return null;
  det = 1 / det;
  out[0] = (m[5] * b11 - m[6] * b10 + m[7] * b09) * det;
  out[1] = (m[2] * b10 - m[1] * b11 - m[3] * b09) * det;
  out[2] = (m[13] * b05 - m[14] * b04 + m[15] * b03) * det;
  out[3] = (m[10] * b04 - m[9] * b05 - m[11] * b03) * det;
  out[4] = (m[6] * b08 - m[4] * b11 - m[7] * b07) * det;
  out[5] = (m[0] * b11 - m[2] * b08 + m[3] * b07) * det;
  out[6] = (m[14] * b02 - m[12] * b05 - m[15] * b01) * det;
  out[7] = (m[8] * b05 - m[10] * b02 + m[11] * b01) * det;
  out[8] = (m[4] * b10 - m[5] * b08 + m[7] * b06) * det;
  out[9] = (m[1] * b08 - m[0] * b10 - m[3] * b06) * det;
  out[10] = (m[12] * b04 - m[13] * b02 + m[15] * b00) * det;
  out[11] = (m[9] * b02 - m[8] * b04 - m[11] * b00) * det;
  out[12] = (m[5] * b07 - m[4] * b09 - m[6] * b06) * det;
  out[13] = (m[0] * b09 - m[1] * b07 + m[2] * b06) * det;
  out[14] = (m[13] * b01 - m[12] * b03 - m[14] * b00) * det;
  out[15] = (m[8] * b03 - m[9] * b01 + m[10] * b00) * det;
  return out;
}

function mulVec4(m: Mat4, x: number, y: number, z: number, w: number): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

export function projectPoint(world: Vec3, vp: Mat4, width: number, height: number): { x: number; y: number; z: number } | null {
  const [cx, cy, cz, cw] = mulVec4(vp, world[0], world[1], world[2], 1);
  if (cw <= 1e-4) return null;
  const nx = cx / cw;
  const ny = cy / cw;
  const nz = cz / cw;
  return {
    x: (nx * 0.5 + 0.5) * width,
    y: (0.5 - ny * 0.5) * height,
    z: nz,
  };
}

export function unprojectRay(sx: number, sy: number, width: number, height: number, invVP: Mat4): Ray {
  const nx = (sx / Math.max(1, width)) * 2 - 1;
  const ny = 1 - (sy / Math.max(1, height)) * 2;
  const [ax, ay, az, aw] = mulVec4(invVP, nx, ny, -1, 1);
  const [bx, by, bz, bw] = mulVec4(invVP, nx, ny, 1, 1);
  const origin: Vec3 = [ax / aw, ay / aw, az / aw];
  const farPt: Vec3 = [bx / bw, by / bw, bz / bw];
  return { origin, dir: normalize3(sub3(farPt, origin)) };
}

export function rayPlaneY(ray: Ray, planeY = 0): { x: number; z: number } | null {
  if (Math.abs(ray.dir[1]) < 1e-6) return null;
  const t = (planeY - ray.origin[1]) / ray.dir[1];
  if (t < 0) return null;
  return { x: ray.origin[0] + ray.dir[0] * t, z: ray.origin[2] + ray.dir[2] * t };
}

export function rayAABB(
  ray: Ray,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const mins = [minX, minY, minZ];
  const maxs = [maxX, maxY, maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ray.dir[i]) < 1e-8) {
      if (ray.origin[i] < mins[i] || ray.origin[i] > maxs[i]) return null;
    } else {
      let t1 = (mins[i] - ray.origin[i]) / ray.dir[i];
      let t2 = (maxs[i] - ray.origin[i]) / ray.dir[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function raySphere(ray: Ray, cx: number, cy: number, cz: number, r: number): number | null {
  const oc = sub3(ray.origin, [cx, cy, cz]);
  const b = dot3(oc, ray.dir);
  const c = dot3(oc, oc) - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  if (t0 >= 0) return t0;
  const t1 = -b + s;
  return t1 >= 0 ? t1 : null;
}

/** Nur va 3D siniq chiziq (sim) orasidagi eng qisqa masofa. */
export function rayPolylineDist(ray: Ray, pts: Vec3[], maxDist: number): { t: number; dist: number } | null {
  let best: { t: number; dist: number } | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const u = ray.dir;
    const v = sub3(p1, p0);
    const w = sub3(ray.origin, p0);
    const a = dot3(u, u);
    const b = dot3(u, v);
    const c = dot3(v, v);
    const d = dot3(u, w);
    const e = dot3(v, w);
    const D = a * c - b * b;
    let sc: number;
    let tc: number;
    if (D < 1e-8) {
      sc = 0;
      tc = clamp(c > 1e-8 ? e / c : 0, 0, 1);
    } else {
      sc = Math.max(0, (b * e - c * d) / D);
      tc = (a * e - b * d) / D;
      if (tc < 0) {
        tc = 0;
        sc = Math.max(0, -d / a);
      } else if (tc > 1) {
        tc = 1;
        sc = Math.max(0, (b - d) / a);
      }
    }
    const rx = ray.origin[0] + u[0] * sc - (p0[0] + v[0] * tc);
    const ry = ray.origin[1] + u[1] * sc - (p0[1] + v[1] * tc);
    const rz = ray.origin[2] + u[2] * sc - (p0[2] + v[2] * tc);
    const dist = Math.hypot(rx, ry, rz);
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { t: sc, dist };
    }
  }
  return best;
}

export class OrbitCamera {
  targetX = 250;
  targetZ = 100;
  yaw = STUDIO_YAW;
  pitch = STUDIO_PITCH;
  distance = 620;
  readonly fov = (38 * Math.PI) / 180;

  private goalYaw: number | null = null;
  private goalPitch: number | null = null;
  private goalDist: number | null = null;
  private goalTX: number | null = null;
  private goalTZ: number | null = null;

  eye(): Vec3 {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    return [
      this.targetX + this.distance * cp * Math.sin(this.yaw),
      this.distance * sp,
      this.targetZ + this.distance * cp * Math.cos(this.yaw),
    ];
  }

  matrices(width: number, height: number) {
    const aspect = Math.max(0.1, width / Math.max(1, height));
    const eye = this.eye();
    const view = mat4LookAt(eye, [this.targetX, 0, this.targetZ], [0, 1, 0]);
    const proj = mat4Perspective(this.fov, aspect, 12, 4800);
    const vp = mat4Multiply(proj, view);
    const invVP = mat4Invert(vp) ?? mat4Identity();
    return { eye, view, proj, vp, invVP };
  }

  stopAnim() {
    this.goalYaw = null;
    this.goalPitch = null;
    this.goalDist = null;
    this.goalTX = null;
    this.goalTZ = null;
  }

  orbitByDelta(dx: number, dy: number) {
    this.stopAnim();
    this.yaw -= dx * 0.0065;
    this.pitch = clamp(this.pitch + dy * 0.0065, MIN_CAM_PITCH, MAX_CAM_PITCH);
  }

  panByScreenDelta(dx: number, dy: number, width: number, height: number) {
    this.stopAnim();
    const { invVP } = this.matrices(width, height);
    const a = rayPlaneY(unprojectRay(width / 2, height / 2, width, height, invVP), 0);
    const b = rayPlaneY(unprojectRay(width / 2 - dx, height / 2 - dy, width, height, invVP), 0);
    if (a && b) {
      this.targetX += b.x - a.x;
      this.targetZ += b.z - a.z;
    }
  }

  zoomAtScreen(factor: number, sx: number, sy: number, width: number, height: number) {
    this.stopAnim();
    const before = rayPlaneY(unprojectRay(sx, sy, width, height, this.matrices(width, height).invVP), 0);
    this.distance = clamp(this.distance / Math.max(0.25, factor), MIN_CAM_DIST, MAX_CAM_DIST);
    const after = rayPlaneY(unprojectRay(sx, sy, width, height, this.matrices(width, height).invVP), 0);
    if (before && after) {
      this.targetX += before.x - after.x;
      this.targetZ += before.z - after.z;
    }
  }

  fitBounds(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    width: number,
    height: number,
    topInset = 0,
    animate = false,
    bottomInset = 0,
    rightInset = 0,
  ) {
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const cy = 4;
    const yaw = animate && this.goalYaw !== null ? this.goalYaw : this.yaw;
    const pitch = animate && this.goalPitch !== null ? this.goalPitch : this.pitch;

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const zAxis: Vec3 = [cp * Math.sin(yaw), sp, cp * Math.cos(yaw)];
    const xAxis = normalize3(cross3([0, 1, 0], zAxis));
    const yAxis = cross3(zAxis, xAxis);

    const pad = width <= 560 ? 10 : 20;
    const leftPad = pad;
    const rightPad = Math.max(pad, rightInset);
    const topPad = Math.max(pad, topInset + 6);
    const bottomPad = Math.max(pad, bottomInset + 6);

    const usableW = clamp((width - leftPad - rightPad) / Math.max(1, width), 0.42, 0.96);
    const usableH = clamp((height - topPad - bottomPad) / Math.max(1, height), 0.38, 0.96);
    const aspect = Math.max(0.2, width / Math.max(1, height));
    const tanY = Math.tan(this.fov / 2);
    const tanX = tanY * aspect;

    let reqDist = MIN_CAM_DIST;
    for (const x of [minX, maxX]) {
      for (const y of [-6, 18]) {
        for (const z of [minZ, maxZ]) {
          const rel: Vec3 = [x - cx, y - cy, z - cz];
          const vx = dot3(rel, xAxis);
          const vy = dot3(rel, yAxis);
          const vz = dot3(rel, zAxis);
          reqDist = Math.max(reqDist, vz + Math.abs(vx) / (tanX * usableW), vz + Math.abs(vy) / (tanY * usableH));
        }
      }
    }
    const dist = clamp(reqDist, MIN_CAM_DIST, MAX_CAM_DIST);

    // Kadrda plata yuqori/pastki va o'ng panellar orasidagi bo'sh maydon markaziga joylashtiriladi.
    const sxGoal = (leftPad + width - rightPad) / 2;
    const syGoal = (topPad + height - bottomPad) / 2;
    let tx = cx;
    let tz = cz;
    const eye0: Vec3 = [cx + dist * zAxis[0], dist * zAxis[1], cz + dist * zAxis[2]];
    const vp0 = mat4Multiply(mat4Perspective(this.fov, aspect, 12, 4800), mat4LookAt(eye0, [cx, 0, cz], [0, 1, 0]));
    const inv0 = mat4Invert(vp0);
    if (inv0) {
      const midHit = rayPlaneY(unprojectRay(width / 2, height / 2, width, height, inv0), 0);
      const goalHit = rayPlaneY(unprojectRay(sxGoal, syGoal, width, height, inv0), 0);
      if (midHit && goalHit) {
        tx = cx + (midHit.x - goalHit.x);
        tz = cz + (midHit.z - goalHit.z);
      }
    }

    if (animate) {
      this.goalTX = tx;
      this.goalTZ = tz;
      this.goalDist = dist;
    } else {
      this.stopAnim();
      this.targetX = tx;
      this.targetZ = tz;
      this.distance = dist;
    }
  }

  setAngle(preset: 'studio' | 'top', animate = true, narrow = false) {
    const yaw = preset === 'top' ? TOP_YAW : narrow ? PORTRAIT_STUDIO_YAW : STUDIO_YAW;
    const pitch = preset === 'top' ? TOP_PITCH : narrow ? PORTRAIT_STUDIO_PITCH : STUDIO_PITCH;
    if (animate) {
      this.goalYaw = yaw;
      this.goalPitch = pitch;
    } else {
      this.yaw = yaw;
      this.pitch = pitch;
    }
  }

  targetAngles(animate = true): { yaw: number; pitch: number } {
    return {
      yaw: animate && this.goalYaw !== null ? this.goalYaw : this.yaw,
      pitch: animate && this.goalPitch !== null ? this.goalPitch : this.pitch,
    };
  }

  step(dt: number): boolean {
    const k = 1 - Math.exp(-Math.min(0.1, dt) * 12);
    let moving = false;
    const approach = (cur: number, goal: number | null): number => {
      if (goal === null) return cur;
      const diff = goal - cur;
      if (Math.abs(diff) < 1e-3) return goal;
      moving = true;
      return cur + diff * k;
    };
    this.yaw = approach(this.yaw, this.goalYaw);
    this.pitch = approach(this.pitch, this.goalPitch);
    this.distance = approach(this.distance, this.goalDist);
    this.targetX = approach(this.targetX, this.goalTX);
    this.targetZ = approach(this.targetZ, this.goalTZ);
    if (!moving) this.stopAnim();
    return moving;
  }
}
