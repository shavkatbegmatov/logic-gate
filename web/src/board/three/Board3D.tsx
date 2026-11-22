import { useSignal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sfx } from '../../audio';
import { showToast } from '../../components/Toast';
import { t } from '../../i18n';
import { stateNames } from '../../sim/formula';
import { depths } from '../../sim/sim';
import { GATE_ARITY, type Gate } from '../../sim/types';
import { activeTheme, instantCheck, resolveRealStyle, systemReducedMotion } from '../../theme';
import { settings } from '../../state';
import { cam3d } from '../cam3d';
import type { Editor } from '../editor';
import { bounds, GATE_H, GATE_W, GRID, inputPortY, outputPortY, portPoint, routeMid, type Point } from '../geometry';
import { routeAll } from '../routing';
import { capture } from '../useBoard2D';
import { Engine3D } from './engine3d';
import { OrbitCamera, projectPoint, rayAABB, rayPlaneY, rayPolylineDist, unprojectRay, type Vec3 } from './math3d';
import { buildScene3D, type Scene3DData } from './meshes3d';

interface Props {
  editor: Editor;
  expected?: number[] | null;
  topInset?: number;
  onUnsupported?: () => void;
}

type Drag3D =
  | { kind: 'pan'; lx: number; ly: number; sx: number; sy: number; moved: boolean }
  | { kind: 'orbit'; lx: number; ly: number; sx: number; sy: number; moved: boolean }
  | { kind: 'pinch'; dist: number; cx: number; cy: number }
  | { kind: 'gate'; id: string; ox: number; oz: number; sx: number; sy: number; moved: boolean }
  | { kind: 'wire'; port: string; sx: number; sy: number; moved: boolean }
  | { kind: 'pin'; k: number; sx: number; sy: number; moved: boolean }
  | { kind: 'wireSel'; index: number; sx: number; sy: number; moved: boolean };

const MOVE_THRESHOLD = 6;

export function Board3D({ editor, expected, topInset = 0, onUnsupported }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const delBtnRef = useRef<HTMLButtonElement>(null);

  const camera = useMemo(() => new OrbitCamera(), []);
  const engineRef = useRef<Engine3D | null>(null);
  const sceneRef = useRef<Scene3DData | null>(null);
  const leverAngles = useRef(new Map<string, number>());
  const drag = useRef<Drag3D | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const ghost = useSignal<{ a: Point; b: Point } | null>(null);
  const wiring = useSignal<string | null>(null);
  const draggingGate = useSignal<string | null>(null);
  const sizeRef = useRef({ w: 800, h: 500 });
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;
  // WebGL konteksti qaytgan sari oshadi: dvigatel (shaderlar, teksturalar, sahna) qaytadan quriladi.
  const [glGen, setGlGen] = useState(0);

  const style = resolveRealStyle(activeTheme.value);
  const { gates, wires } = editor.circuit.value;
  const lay = editor.layout.value;
  const spec = editor.spec.value;
  const gmap = useMemo(() => new Map<string, Gate>(gates.map((g) => [g.id, g])), [gates]);
  const { values, outputs } = editor.evaluation.value;
  const bits = editor.bits.value;
  const sel = editor.selection.value;
  const pending = editor.pending.value;
  const highlight = editor.highlight.value;
  const wave = editor.wave.value;
  const active = wiring.value ?? pending;

  const routed = useMemo(
    () => routeAll(wires, gmap, lay, draggingGate.value !== null && wires.length > 40),
    [wires, gmap, lay, draggingGate.value],
  );
  const states = useMemo(() => stateNames({ gates, wires }), [gates, wires]);

  const depth = wave === null ? null : depths(editor.compiled.value);
  const stepOf = (src: string, extra: number) => 2 * (depth?.get(src) ?? 0) + extra;
  const reached = (src: string, extra: number) => wave === null || stepOf(src, extra) <= wave;
  const drivers = editor.compiled.value.drivers;

  // Eng so'nggi holatni rAF tsikli o'qishi uchun
  const stateRef = useRef({
    style,
    spec,
    circuit: editor.circuit.value,
    layout: lay,
    routed,
    values,
    outputs,
    bits,
    expected,
    drivers,
    reached,
    selection: sel,
    activePort: active,
    highlight,
    draggingGateId: draggingGate.value,
    ghost: ghost.value,
    stateNames: states,
    dirty: true,
  });

  stateRef.current = {
    style,
    spec,
    circuit: editor.circuit.value,
    layout: lay,
    routed,
    values,
    outputs,
    bits,
    expected,
    drivers,
    reached,
    selection: sel,
    activePort: active,
    highlight,
    draggingGateId: draggingGate.value,
    ghost: ghost.value,
    stateNames: states,
    dirty: true,
  };

  // Kamera burchagi va tiklash buyruqlarini kuzatish
  const camAngle = cam3d.value.angle;
  const camReset = cam3d.value.resetSeq;
  useEffect(() => {
    camera.setAngle(camAngle, true, sizeRef.current.w <= 560);
  }, [camAngle]);
  useEffect(() => {
    if (camReset > 0) {
      camera.setAngle(cam3d.value.angle, true, sizeRef.current.w <= 560);
      editor.viewTouched = false;
      editor.fit();
    }
  }, [camReset]);

  // 3D'dagi aylantirish/surish faqat 3D kamerani suradi, lekin editor.viewTouched ni qo'yadi — 2D maydon
  // (useBoard2D) buni «o'yinchi ko'rinishni o'zi joylagan» deb, fit() qilmasdi: ekran to'g'ridan-to'g'ri 3D'da
  // ochilgan bo'lsa (3D moduli allaqachon yuklangan), 2D'da sxema 1:1 masshtabda chap yuqorida, kirishlar
  // ekrandan tashqarida chiqardi. Faqat haqiqiy yopilishda (kontekst tiklanishida emas) tozalanadi.
  useEffect(
    () => () => {
      editor.viewTouched = false;
    },
    [editor],
  );

  // WebGL dvigateli, ResizeObserver, Editor 3D hooklari va 60 FPS kadr tsikli
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;

    // Telefon GPU xotirasini bo'shatganda (boshqa ilovaga o'tilib qaytilganda, Telegram ichida ham) kontekst
    // yo'qoladi: barcha bufer, tekstura va shaderlar bekor bo'ladi, chizish esa jim hech narsa qilmaydi —
    // maydon bo'sh qolardi. preventDefault — brauzer kontekstni qaytarishi uchun; qaytganda effekt qaytadan
    // ishlaydi (glGen). data-gl — holat (tutun testi shuni kuzatadi).
    let lost = false;
    let raf = 0;
    // Chizish faqat kerak bo'lganda (pastda, frame): o'lcham o'zgarsa kanvas tozalanadi — qayta chizish shart.
    let redraw = true;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      wrap.dataset.gl = 'lost';
    };
    const onRestored = () => setGlGen((n) => n + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    const unlisten = () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };

    const eng = Engine3D.create(canvas);
    if (!eng) {
      // Kontekst hozir yo'qolgan (effekt shu paytda qayta ishladi) — qaytishini kutamiz; aks holda WebGL yo'q.
      if (Engine3D.isLost(canvas)) {
        wrap.dataset.gl = 'lost';
        return unlisten;
      }
      unlisten();
      unsupportedRef.current?.();
      return;
    }
    engineRef.current = eng;
    // Yangi dvigatelga sahna qaytadan yuklanadi (oldingisi yo'qolgan kontekstda edi).
    sceneRef.current = null;
    editor.el = wrap;
    wrap.dataset.gl = 'ready';

    const fit3D = (animate: boolean) => {
      const { w, h } = sizeRef.current;
      const narrow = w <= 560;
      if (!editor.viewTouched) camera.setAngle(cam3d.peek().angle, animate, narrow);
      const b = bounds(editor.circuit.peek(), editor.layout.peek(), false);
      const bx0 = b.minX - 24;
      const bz0 = b.minY - 26;
      const bx1 = b.maxX + 24;
      const bz1 = b.maxY + 26;
      const hasClock = editor.spec.peek().gates.includes('DFF');
      const bottomInset = w <= 820 ? (hasClock ? 96 : 46) : (hasClock ? 64 : 50);

      let rightInset = w > 820 ? 52 : 0;
      if (w <= 820) {
        const probe = new OrbitCamera();
        const ang = camera.targetAngles(animate);
        probe.yaw = ang.yaw;
        probe.pitch = ang.pitch;
        probe.fitBounds(bx0, bz0, bx1, bz1, w, h, editor.insetTop, false, bottomInset, 0);
        const { vp } = probe.matrices(w, h);
        const hitsZoom = (
          [
            [bx1, 16, bz0],
            [bx1, 0, bz1],
            [bx1, 16, (bz0 + bz1) / 2],
          ] as Vec3[]
        ).some((pt) => {
          const sp = projectPoint(pt, vp, w, h);
          return !!sp && sp.x > w - 48 && sp.y > h - 164;
        });
        if (hitsZoom) rightInset = 46;
      }
      camera.fitBounds(bx0, bz0, bx1, bz1, w, h, editor.insetTop, animate, bottomInset, rightInset);
    };

    editor.worldFromScreen = (sx, sy) => {
      const { w, h } = sizeRef.current;
      const { invVP } = camera.matrices(w, h);
      const hit = rayPlaneY(unprojectRay(sx, sy, w, h, invVP), 0);
      return hit ? { x: hit.x, y: hit.z } : null;
    };
    editor.fitOverride = () => fit3D(true);
    editor.zoomOverride = (factor, sx, sy) => {
      const { w, h } = sizeRef.current;
      camera.zoomAtScreen(factor, sx ?? w / 2, sy ?? h / 2, w, h);
    };

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 10 || height < 10) return;
      const big = Math.abs(width - sizeRef.current.w) > 40 || Math.abs(height - sizeRef.current.h) > 40;
      sizeRef.current = { w: width, h: height };
      editor.size = { w: width, h: height };
      editor.vertical.value = false;
      const prevInset = editor.insetTop;
      editor.insetTop = width <= 820 ? topInset : 0;
      eng.resize(width, height);
      redraw = true;
      if (!editor.viewTouched || big || prevInset !== editor.insetTop) fit3D(false);
    });
    ro.observe(wrap);
    if (wrap.clientWidth > 10 && wrap.clientHeight > 10) {
      sizeRef.current = { w: wrap.clientWidth, h: wrap.clientHeight };
      editor.size = { w: wrap.clientWidth, h: wrap.clientHeight };
      editor.vertical.value = false;
      editor.insetTop = wrap.clientWidth <= 820 ? topInset : 0;
      eng.resize(wrap.clientWidth, wrap.clientHeight);
      fit3D(false);
    }

    let lastT = performance.now();
    const startT = lastT;
    /** Oxirgi chizilgan kadrdagi kamera matritsasi: sudrash, aylantirish, zoom — hammasi shu orqali seziladi. */
    let lastVP: number[] | null = null;
    const sameView = (vp: ArrayLike<number>) => !!lastVP && lastVP.every((x, i) => x === vp[i]);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const cur = stateRef.current;
      const camMoved = camera.step(dt);

      // Tumbler dastaklarini silliq aylantirish
      let leversMoving = false;
      const k = 1 - Math.exp(-dt * 18);
      cur.spec.inputs.forEach((name, idx) => {
        const target = cur.bits[idx] === 1 ? 0.6 : -0.6;
        const prev = leverAngles.current.get(name) ?? target;
        if (Math.abs(target - prev) > 0.002) {
          leverAngles.current.set(name, prev + (target - prev) * k);
          leversMoving = true;
        } else if (prev !== target) {
          leverAngles.current.set(name, target);
        }
      });

      const motionSetting = settings.peek().motion ?? 'auto';
      const motionOn = motionSetting === 'on' || (motionSetting === 'auto' && !systemReducedMotion.peek() && !instantCheck());

      let rebuilt = false;
      if (cur.dirty || leversMoving || !sceneRef.current) {
        rebuilt = true;
        const labelStrings = [
          ...cur.spec.inputs,
          ...cur.spec.outputs,
          ...cur.stateNames.values(),
          ...(cur.expected ? cur.expected.map((v) => `exp:${v}`) : []),
        ];
        eng.syncTextures(cur.style, labelStrings, t.play.expected.toLowerCase());
        const built = buildScene3D({
          style: cur.style,
          spec: cur.spec,
          circuit: cur.circuit,
          layout: cur.layout,
          routed: cur.routed,
          values: cur.values,
          outputs: cur.outputs,
          bits: cur.bits,
          expected: cur.expected,
          drivers: cur.drivers,
          reached: cur.reached,
          selection: cur.selection,
          activePort: cur.activePort,
          highlight: cur.highlight,
          draggingGateId: cur.draggingGateId,
          ghost: cur.ghost,
          leverAngles: leverAngles.current,
          stateNames: cur.stateNames,
          labelUVs: eng.labelUVs,
        });
        sceneRef.current = built;
        eng.uploadScene(built);
        cur.dirty = false;
      }

      const { vp } = camera.matrices(sizeRef.current.w, sizeRef.current.h);

      // Tanlangan element/sim uchun suzuvchi o'chirish tugmasini 3D dan ekranga proyeksiya qilish
      const delBtn = delBtnRef.current;
      if (delBtn) {
        let wp: Vec3 | null = null;
        if (cur.selection?.kind === 'gate') {
          const gid = cur.selection.id;
          const g = cur.circuit.gates.find((x) => x.id === gid);
          if (g) wp = [g.x + GATE_W - 2, 16, g.y - 6];
        } else if (cur.selection?.kind === 'wire') {
          const r = cur.routed.routes[cur.selection.index];
          if (r) {
            const m = routeMid(r);
            wp = [m.x, 12, m.y];
          }
        }
        const sp = wp ? projectPoint(wp, vp, sizeRef.current.w, sizeRef.current.h) : null;
        if (sp && sp.z >= -1 && sp.z <= 1) {
          delBtn.style.display = 'grid';
          delBtn.style.left = `${sp.x}px`;
          delBtn.style.top = `${sp.y}px`;
        } else {
          delBtn.style.display = 'none';
        }
      }

      // Har kadrda to'liq chizish (soya, sahna, bloom, DPR 2 gacha) telefonni bekorga qizdirib, batareyani
      // yeydi: sahna va kamera o'zgarmasa, kadr oldingisining aynan nusxasi — ekranda o'sha qoladi. Vaqtga
      // bog'liq yagona narsa — yoniq simdagi signal to'lqini (faqat animatsiya yoqilganda).
      const scene = sceneRef.current;
      if (scene && (redraw || rebuilt || camMoved || !sameView(vp) || (motionOn && scene.pulsing))) {
        eng.render(camera, scene, cur.style, (now - startT) / 1000, motionOn);
        lastVP = Array.from(vp);
        redraw = false;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unlisten();
      if (editor.el === wrap) editor.el = null;
      editor.worldFromScreen = null;
      editor.fitOverride = null;
      editor.zoomOverride = null;
      // Yo'qolgan kontekstdagi obyektlarni o'chirish faqat konsolga INVALID_OPERATION yozadi.
      if (!lost) eng.dispose();
      engineRef.current = null;
    };
  }, [editor, camera, topInset, glGen]);

  const local = (e: PointerEvent | WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** Ekrandagi nuqtadan port, element, tumbler yoki simni aniqlash. */
  const hitTest = (sx: number, sy: number, isTouch: boolean) => {
    const { w, h } = sizeRef.current;
    const { vp, invVP } = camera.matrices(w, h);
    const ray = unprojectRay(sx, sy, w, h, invVP);

    // 1. Portlar (ekran masofasi bo'yicha aniq tanlash)
    let bestPort: string | null = null;
    let bestPortD = isTouch ? 28 : 15;
    const ports: [string, number, number][] = [];
    const layNow = editor.layout.value;
    const cNow = editor.circuit.value;
    for (const [name, p] of layNow.inputs) ports.push([`in:${name}`, p.x, p.y]);
    for (const [name, p] of layNow.outputs) ports.push([`out:${name}`, p.x, p.y]);
    for (const g of cNow.gates) {
      ports.push([g.id, g.x + GATE_W, g.y + outputPortY(g)]);
      for (let i = 0; i < GATE_ARITY[g.type]; i++) ports.push([`${g.id}:${i}`, g.x, g.y + inputPortY(g, i)]);
    }
    for (const [id, x, y] of ports) {
      const sp = projectPoint([x, 2.5, y], vp, w, h);
      if (!sp || sp.z > 1) continue;
      const d = Math.hypot(sp.x - sx, sp.y - sy);
      if (d < bestPortD) {
        bestPortD = d;
        bestPort = id;
      }
    }
    if (bestPort) return { kind: 'port' as const, port: bestPort };

    // 2. Elementlar (AABB)
    let bestGate: { id: string; t: number } | null = null;
    for (const g of cNow.gates) {
      const tHit = rayAABB(ray, g.x + 4, -2, g.y - 2, g.x + GATE_W - 4, 17, g.y + GATE_H + 2);
      if (tHit !== null && (!bestGate || tHit < bestGate.t)) bestGate = { id: g.id, t: tHit };
    }

    // 3. Kirish tumblerlari (AABB)
    let bestPin: { k: number; t: number } | null = null;
    const ins = editor.spec.value.inputs;
    for (let k = 0; k < ins.length; k++) {
      const p = layNow.inputs.get(ins[k])!;
      const tHit = rayAABB(ray, p.x - 82, -2, p.y - 26, p.x - 10, 26, p.y + 26);
      if (tHit !== null && (!bestPin || tHit < bestPin.t)) bestPin = { k, t: tHit };
    }

    if (bestGate && (!bestPin || bestGate.t <= bestPin.t)) return { kind: 'gate' as const, id: bestGate.id };
    if (bestPin) return { kind: 'pin' as const, k: bestPin.k };

    // 4. Simlar (3D siniq chiziq)
    let bestWire: { index: number; t: number } | null = null;
    for (const wh of sceneRef.current?.wireHits ?? []) {
      const hit = rayPolylineDist(ray, wh.pts, isTouch ? 14 : 9);
      if (hit && (!bestWire || hit.t < bestWire.t)) bestWire = { index: wh.index, t: hit.t };
    }
    if (bestWire) return { kind: 'wire' as const, index: bestWire.index };

    return { kind: 'empty' as const };
  };

  const connect = (a: string, b: string, fromDrag: boolean) => {
    const res = editor.connect(a, b);
    if (res === 'cycle') {
      sfx.error();
      showToast(t.play.cycle, 'error');
    } else if (res === 'kind' && fromDrag) {
      showToast(t.play.sameKind, 'error');
    }
    return res;
  };

  const tapPort = (port: string) => {
    const pend = editor.pending.value;
    if (!pend) {
      editor.pending.value = port;
      sfx.click();
    } else if (pend === port) {
      editor.pending.value = null;
    } else {
      const res = connect(pend, port, false);
      editor.pending.value = res === 'kind' ? port : null;
    }
  };

  const onDown = (e: PointerEvent) => {
    if (editor.busy.value) return;
    capture(canvasRef.current!, e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2) {
      if (drag.current?.kind === 'gate') {
        draggingGate.value = null;
        editor.endDrag();
      }
      ghost.value = null;
      wiring.value = null;
      const [a, b] = [...pointers.current.values()];
      drag.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.current.size > 2) return;

    // O'ng/o'rta tugma yoki Shift/Alt yoki Burish rejimi — 3D orbita
    if (e.button === 2 || e.button === 1 || e.altKey || e.shiftKey) {
      drag.current = { kind: 'orbit', lx: p.x, ly: p.y, sx: p.x, sy: p.y, moved: false };
      return;
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const hit = hitTest(p.x, p.y, e.pointerType !== 'mouse');
    if (hit.kind === 'port') {
      drag.current = { kind: 'wire', port: hit.port, sx: p.x, sy: p.y, moved: false };
    } else if (hit.kind === 'gate') {
      const g = editor.circuit.value.gates.find((x) => x.id === hit.id)!;
      const w = editor.toWorld(p.x, p.y);
      editor.beginDrag();
      drag.current = { kind: 'gate', id: hit.id, ox: w.x - g.x, oz: w.y - g.y, sx: p.x, sy: p.y, moved: false };
    } else if (hit.kind === 'pin') {
      drag.current = { kind: 'pin', k: hit.k, sx: p.x, sy: p.y, moved: false };
    } else if (hit.kind === 'wire') {
      drag.current = { kind: 'wireSel', index: hit.index, sx: p.x, sy: p.y, moved: false };
    } else {
      drag.current = {
        kind: cam3d.value.orbitMode ? 'orbit' : 'pan',
        lx: p.x,
        ly: p.y,
        sx: p.x,
        sy: p.y,
        moved: false,
      };
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (!d) return;

    if (d.kind === 'pinch') {
      if (pointers.current.size !== 2) return;
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const { w, h } = sizeRef.current;
      if (d.dist > 0) camera.zoomAtScreen(dist / d.dist, cx, cy, w, h);
      camera.panByScreenDelta(cx - d.cx, cy - d.cy, w, h);
      editor.viewTouched = true;
      drag.current = { kind: 'pinch', dist, cx, cy };
      return;
    }

    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > MOVE_THRESHOLD) d.moved = true;
    if (!d.moved) return;

    const { w, h } = sizeRef.current;
    if (d.kind === 'orbit') {
      camera.orbitByDelta(p.x - d.lx, p.y - d.ly);
      editor.viewTouched = true;
      d.lx = p.x;
      d.ly = p.y;
    } else if (d.kind === 'pan') {
      camera.panByScreenDelta(p.x - d.lx, p.y - d.ly, w, h);
      editor.viewTouched = true;
      d.lx = p.x;
      d.ly = p.y;
    } else if (d.kind === 'gate') {
      draggingGate.value = d.id;
      const wpt = editor.toWorld(p.x, p.y);
      editor.dragGate(d.id, wpt.x - d.ox, wpt.y - d.oz);
    } else if (d.kind === 'wire') {
      const a = portPoint(d.port, gmap, lay);
      if (a) ghost.value = { a, b: editor.toWorld(p.x, p.y) };
      wiring.value = d.port;
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    drag.current = null;

    if (d.kind === 'gate') {
      draggingGate.value = null;
      editor.endDrag();
      if (!d.moved) {
        const curSel = editor.selection.value;
        editor.selection.value = curSel?.kind === 'gate' && curSel.id === d.id ? null : { kind: 'gate', id: d.id };
        editor.pending.value = null;
      }
    } else if (d.kind === 'wire') {
      ghost.value = null;
      wiring.value = null;
      if (!d.moved) {
        tapPort(d.port);
      } else if (e.type === 'pointerup') {
        const p = local(e);
        const target = hitTest(p.x, p.y, e.pointerType !== 'mouse');
        if (target.kind === 'port' && target.port !== d.port) connect(d.port, target.port, true);
        editor.pending.value = null;
      }
    } else if (d.kind === 'pin' && !d.moved && e.type === 'pointerup') {
      editor.toggleInput(d.k);
    } else if (d.kind === 'wireSel' && !d.moved && e.type === 'pointerup') {
      const curSel = editor.selection.value;
      editor.selection.value = curSel?.kind === 'wire' && curSel.index === d.index ? null : { kind: 'wire', index: d.index };
      editor.pending.value = null;
    } else if ((d.kind === 'pan' || d.kind === 'orbit') && !d.moved) {
      editor.selection.value = null;
      editor.pending.value = null;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    const { w, h } = sizeRef.current;
    camera.zoomAtScreen(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y, w, h);
    editor.viewTouched = true;
  };

  const onDoubleClick = (e: MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const hit = hitTest(e.clientX - r.left, e.clientY - r.top, false);
    if (hit.kind === 'empty') {
      editor.viewTouched = false;
      editor.fit();
    }
  };

  const a11y = t.play.a11y;
  const plain = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey;
  const activates = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && plain(e);
  const deletes = (e: KeyboardEvent) => (e.key === 'Delete' || e.key === 'Backspace') && plain(e);

  return (
    <div class="board-3d-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        class="board-3d-canvas"
        aria-label={a11y.board}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDblClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div class="board-3d-hint">{t.play.view.tiltHint}</div>
      <button
        ref={delBtnRef}
        class="delete-3d-btn"
        style={{ display: 'none' }}
        aria-label={t.play.remove}
        title={t.play.remove}
        onClick={() => editor.removeSelection()}
      >
        ×
      </button>

      {/* Klaviatura va ekran o'quvchi uchun 3D sahnaning to'liq boshqaruv ro'yxati */}
      <div class="a11y-3d-list" role="group" aria-label={a11y.board}>
        {spec.inputs.map((name, k) => (
          <button
            key={`in:${name}`}
            role="switch"
            aria-checked={bits[k] === 1}
            aria-label={name}
            onClick={() => editor.toggleInput(k)}
          />
        ))}
        {gates.map((g, gi) => (
          <button
            key={g.id}
            aria-label={a11y.gate(`${g.type} ${gi + 1}`)}
            onKeyDown={(e) => {
              if (deletes(e)) {
                e.preventDefault();
                editor.selection.value = { kind: 'gate', id: g.id };
                editor.removeSelection();
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const dx = e.key === 'ArrowLeft' ? -GRID : e.key === 'ArrowRight' ? GRID : 0;
                const dy = e.key === 'ArrowUp' ? -GRID : e.key === 'ArrowDown' ? GRID : 0;
                editor.beginDrag();
                editor.dragGate(g.id, g.x + dx, g.y + dy);
                editor.endDrag();
              }
            }}
            onClick={() => (editor.selection.value = { kind: 'gate', id: g.id })}
          />
        ))}
        {spec.outputs.map((name) => (
          <button
            key={`out:${name}`}
            aria-label={a11y.output(name)}
            onKeyDown={(e) => {
              if (activates(e)) {
                e.preventDefault();
                tapPort(`out:${name}`);
              } else if (deletes(e)) {
                const idx = wires.findIndex((w) => w.to === `out:${name}`);
                if (idx >= 0) {
                  e.preventDefault();
                  editor.selection.value = { kind: 'wire', index: idx };
                  editor.removeSelection();
                }
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
