"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * "City scan" — a night city in Ukrainian constructivist style (slab blocks, setback towers,
 * corner rotundas, ribbon windows) and the Vidomo process in one 16-second loop:
 *   1 SCAN      a cobalt ring sweeps the city: every building becomes data
 *   2 MARKET    comparable buildings light up; arcs pull their prices into the subject
 *   3 INSPECT   the subject is x-rayed: every window lights, a defect pulses red
 *   4 VERDICT   an amber halo settles around the subject — the decision
 * Two instanced meshes (boxes + cylinders) share one shader. Pauses off-screen / in hidden tabs;
 * reduced motion renders one still frame.
 */
export type ScanPhase = "scan" | "market" | "inspect" | "verdict";

const LOOP = 16;
const phaseAt = (t: number): ScanPhase => (t < 4.5 ? "scan" : t < 8.5 ? "market" : t < 12 ? "inspect" : "verdict");

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERT = /* glsl */ `
  attribute float aRole;   // 0 regular, 1 comparable, 2 subject
  attribute float aSeed;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vRole;
  varying float vSeed;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormalW = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vRole = aRole;
    vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform float uKind;      // 0 box, 1 cylinder
  uniform float uScan;
  uniform float uMarket;
  uniform float uInspect;
  uniform float uVerdict;
  uniform float uTime;
  uniform vec3 uCobalt;
  uniform vec3 uAmber;
  uniform vec3 uLine;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying float vRole;
  varying float vSeed;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

  float boxEdge(vec3 p) {
    vec3 d = 0.5 - abs(p - vec3(0.0, 0.5, 0.0));
    float mn = min(d.x, min(d.y, d.z));
    float mx = max(d.x, max(d.y, d.z));
    float second = d.x + d.y + d.z - mn - mx;
    float fw = fwidth(second) * 1.3;
    return 1.0 - smoothstep(0.0, fw, second);
  }
  float rimEdge(vec3 p) {
    float d = min(abs(p.y - 1.0), abs(p.y));
    return 1.0 - smoothstep(0.0, fwidth(p.y) * 1.5, d);
  }

  void main() {
    float r = length(vWorld.xz);
    float ring = exp(-pow((r - uScan) / 1.4, 2.0));
    float revealed = smoothstep(uScan + 0.5, uScan - 1.5, r);
    vec3 n = normalize(vNormalW);
    bool roof = n.y > 0.5;

    float shade = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.35, 0.8, 0.5))), 0.0);
    vec3 col = vec3(0.085, 0.10, 0.135) * shade;
    if (roof) col = vec3(0.11, 0.125, 0.16);

    // ribbon windows: a horizontal band per floor, thin mullions
    float floorH = 0.26;
    float f = fract(vWorld.y / floorH);
    float band = smoothstep(0.40, 0.44, f) - smoothstep(0.80, 0.84, f);
    float h = uKind > 0.5 ? atan(vLocal.z, vLocal.x) * 1.6 : (abs(n.x) > 0.5 ? vWorld.z : vWorld.x);
    float mullion = step(0.9, fract(h / 0.22));
    float win = (roof || vWorld.y < 0.18) ? 0.0 : band * (1.0 - mullion);
    float cell = hash(vec3(floor(h / 0.22), floor(vWorld.y / floorH), vSeed * 97.0));
    float lit = step(0.74, cell) + (vRole > 1.5 ? uInspect : 0.0);
    vec3 glass = vec3(0.05, 0.07, 0.11);
    vec3 warm = uAmber * (0.55 + 0.45 * cell);
    col = mix(col, mix(glass, warm, clamp(lit, 0.0, 1.0)), win);

    float e = uKind > 0.5 ? rimEdge(vLocal) : boxEdge(vLocal);
    float edgeAmt = e * (0.10 + 0.30 * revealed + 1.4 * ring);
    vec3 edgeCol = mix(uLine, uCobalt, ring);

    if (vRole > 0.5 && vRole < 1.5) {
      edgeCol = mix(edgeCol, uCobalt, uMarket);
      edgeAmt += e * uMarket * 1.3;
      col += uCobalt * uMarket * 0.07;
    }
    if (vRole > 1.5) {
      float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
      edgeCol = mix(uCobalt, uAmber, uVerdict);
      edgeAmt += e * (0.9 + uInspect);
      col += uCobalt * 0.05 * pulse * (uMarket + uInspect);
    }
    col += edgeCol * edgeAmt * 0.9;
    col += uCobalt * ring * 0.04;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ARC_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ARC_FRAG = /* glsl */ `
  uniform float uProgress;
  uniform vec3 uColor;
  varying float vT;
  void main() {
    float head = smoothstep(uProgress - 0.25, uProgress, vT) * step(vT, uProgress);
    float body = step(vT, uProgress) * 0.6;
    gl_FragColor = vec4(uColor, max(head, body));
  }
`;

interface Vol {
  kind: 0 | 1;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  b: number;
}

/** Constructivist massing: a slab, sometimes a taller setback tower and a corner rotunda. */
function buildCity(rnd: () => number) {
  const vols: Vol[] = [];
  const buildings: Array<{ id: number; x: number; z: number; h: number }> = [];
  const LOT = 2.7;
  const N = 10;
  let id = 0;
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const cx = i * LOT + (rnd() - 0.5) * 0.3;
      const cz = j * LOT + (rnd() - 0.5) * 0.3;
      const r = Math.hypot(cx, cz);
      if (r > 26 + rnd() * 3) continue;
      if (rnd() < 0.14) continue;
      const along = rnd() < 0.5;
      const len = 1.4 + rnd() * 0.85;
      const dep = 0.75 + rnd() * 0.35;
      const centre = Math.exp(-(r * r) / 90);
      const h = 0.55 + rnd() * (0.6 + 0.9 * (1 - centre)) + (r > 10 && rnd() < 0.08 ? 1.6 + rnd() * 1.4 : 0);
      const w = along ? len : dep;
      const d = along ? dep : len;
      const bid = id++;
      vols.push({ kind: 0, x: cx, z: cz, w, d, h, b: bid });
      if (rnd() < 0.45) {
        const tw = along ? 0.55 : dep * 0.85;
        const td = along ? dep * 0.85 : 0.55;
        const off = (len / 2 - 0.3) * (rnd() < 0.5 ? -1 : 1);
        vols.push({ kind: 0, x: cx + (along ? off : 0), z: cz + (along ? 0 : off), w: tw, d: td, h: h + 0.35 + rnd() * 0.7, b: bid });
      }
      if (rnd() < 0.3) {
        const rr = 0.32 + rnd() * 0.12;
        const sx = rnd() < 0.5 ? -1 : 1;
        const sz = rnd() < 0.5 ? -1 : 1;
        vols.push({ kind: 1, x: cx + sx * (w / 2), z: cz + sz * (d / 2), w: rr * 2, d: rr * 2, h: h + 0.15 + rnd() * 0.3, b: bid });
      }
      buildings.push({ id: bid, x: cx, z: cz, h });
    }
  }
  return { vols, buildings };
}

export function CityScan({ onPhase, className }: { onPhase?: (p: ScanPhase) => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const phaseCb = useRef(onPhase);
  useEffect(() => {
    phaseCb.current = onPhase;
  }, [onPhase]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0c11, 38, 90);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

    const cobalt = new THREE.Color("#8b9bff");
    const amber = new THREE.Color("#f2b550");
    const line = new THREE.Color("#c9d2e6");

    const rnd = mulberry32(19);
    const { vols, buildings } = buildCity(rnd);

    const subject = buildings.map((b) => ({ b, s: Math.hypot(b.x - 4, b.z + 2) + Math.abs(b.h - 1.2) * 3 })).sort((a, c) => a.s - c.s)[0].b;
    const comps = buildings
      .filter((b) => b.id !== subject.id)
      .map((b) => ({ b, dist: Math.hypot(b.x - subject.x, b.z - subject.z) }))
      .filter((c) => c.dist > 3 && c.dist < 13 && Math.abs(c.b.h - subject.h) < 0.5)
      .sort((a, c) => a.dist - c.dist)
      .filter((_, k) => k % 2 === 0)
      .slice(0, 9)
      .map((c) => c.b);
    const compIds = new Set(comps.map((c) => c.id));
    const roleOf = (bid: number) => (bid === subject.id ? 2 : compIds.has(bid) ? 1 : 0);

    const makeMat = (kind: number) =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uKind: { value: kind },
          uScan: { value: 0 },
          uMarket: { value: 0 },
          uInspect: { value: 0 },
          uVerdict: { value: 0 },
          uTime: { value: 0 },
          uCobalt: { value: cobalt },
          uAmber: { value: amber },
          uLine: { value: line },
        },
      });
    const mats = [makeMat(0), makeMat(1)];
    const geos = [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(0.5, 0.5, 1, 28, 1)];
    geos.forEach((g) => g.translate(0, 0.5, 0));
    ([0, 1] as const).forEach((kind) => {
      const list = vols.filter((v) => v.kind === kind);
      const roles = new Float32Array(list.length);
      const seeds = new Float32Array(list.length);
      const mesh = new THREE.InstancedMesh(geos[kind], mats[kind], list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((v, k) => {
        m4.makeScale(v.w, v.h, v.d);
        m4.setPosition(v.x, 0, v.z);
        mesh.setMatrixAt(k, m4);
        roles[k] = roleOf(v.b);
        seeds[k] = (v.b * 0.6180339) % 1;
      });
      geos[kind].setAttribute("aRole", new THREE.InstancedBufferAttribute(roles, 1));
      geos[kind].setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
      scene.add(mesh);
    });

    const grid = new THREE.GridHelper(70, 70, 0x1c2230, 0x121621);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    scene.add(grid);

    const ringGeo = new THREE.RingGeometry(0.98, 1, 128);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: cobalt, transparent: true, opacity: 0.8, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    scene.add(ring);

    const arcMats: THREE.ShaderMaterial[] = [];
    const subjTop = new THREE.Vector3(subject.x, subject.h + 0.15, subject.z);
    comps.forEach((b, k) => {
      const from = new THREE.Vector3(b.x, b.h + 0.1, b.z);
      const mid = from.clone().lerp(subjTop, 0.5);
      mid.y += 1.6 + from.distanceTo(subjTop) * 0.3;
      const pts = new THREE.QuadraticBezierCurve3(from, mid, subjTop).getPoints(48);
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      g.setAttribute("aT", new THREE.Float32BufferAttribute(pts.map((_, i) => i / (pts.length - 1)), 1));
      const am = new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        uniforms: { uProgress: { value: 0 }, uColor: { value: cobalt } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      am.userData.delay = k * 0.12;
      arcMats.push(am);
      scene.add(new THREE.Line(g, am));
    });

    const defect = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), new THREE.MeshBasicMaterial({ color: "#f07a68", transparent: true, opacity: 0 }));
    defect.position.set(subject.x + 0.3, subject.h * 0.5, subject.z + 0.55);
    scene.add(defect);
    const haloGeo = new THREE.RingGeometry(1.7, 1.8, 96);
    haloGeo.rotateX(-Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0, depthWrite: false }));
    halo.position.set(subject.x, 0.04, subject.z);
    scene.add(halo);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: cobalt, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(subject.x, subject.h + 3.2, subject.z);
    beam.scale.y = 6;
    scene.add(beam);

    let shift = 0;
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      shift = w / h > 1.2 ? 10 : 0;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 48 : 34;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
    let lastPhase: ScanPhase | null = null;

    const draw = (t: number, elapsed: number) => {
      const scanR = ease(t / 4.5) * 34;
      const market = ease((t - 4.6) / 1.2) * (1 - ease((t - 14.8) / 1.0));
      const inspect = ease((t - 8.6) / 1.2) * (1 - ease((t - 14.8) / 1.0));
      const verdict = ease((t - 12.1) / 1.0) * (1 - ease((t - 15) / 0.9));
      for (const m of mats) {
        const u = m.uniforms;
        u.uTime.value = elapsed;
        u.uScan.value = scanR;
        u.uMarket.value = market;
        u.uInspect.value = inspect;
        u.uVerdict.value = verdict;
      }
      ring.scale.setScalar(Math.max(0.01, scanR));
      ringMat.opacity = 0.8 * (1 - ease((t - 3.8) / 0.8));
      arcMats.forEach((a) => {
        a.uniforms.uProgress.value = ease((t - 5 - a.userData.delay) / 1.6) * (1 - ease((t - 14.8) / 1.0));
      });
      (defect.material as THREE.MeshBasicMaterial).opacity = inspect * (0.6 + 0.4 * Math.sin(elapsed * 6));
      defect.scale.setScalar(1 + 0.4 * Math.sin(elapsed * 6) * inspect);
      (halo.material as THREE.MeshBasicMaterial).opacity = verdict * 0.9;
      halo.scale.setScalar(1 + (1 - verdict) * 1.5);
      (beam.material as THREE.MeshBasicMaterial).opacity = (market * 0.25 + verdict * 0.5) * 0.9;

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const focus = ease((t - 4.5) / 4) * (1 - ease((t - 14.8) / 1.2));
      const ang = elapsed * 0.035 + mouse.x * 0.12;
      const dist = 38 - focus * 14;
      const target = new THREE.Vector3(subject.x * focus - shift * Math.cos(ang), 0, subject.z * focus + shift * Math.sin(ang));
      camera.position.set(target.x + Math.sin(ang) * dist, 18 - focus * 6 - mouse.y * 2, target.z + Math.cos(ang) * dist);
      camera.lookAt(target.x, 1, target.z);
      renderer.render(scene, camera);

      const p = phaseAt(t);
      if (p !== lastPhase) {
        lastPhase = p;
        phaseCb.current?.(p);
      }
    };

    let raf = 0;
    let visible = true;
    const start = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const elapsed = (performance.now() - start) / 1000;
      draw(elapsed % LOOP, elapsed);
    };
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    if (reduce) draw(13.5, 0);
    else loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden />;
}
