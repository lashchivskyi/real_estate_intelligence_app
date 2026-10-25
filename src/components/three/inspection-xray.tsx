"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useI18n } from "../providers";

/**
 * "What you see vs. what the inspection finds" — a furnished room after a fresh cosmetic renovation
 * (cutaway "dollhouse" view). Each step scans one surface and reveals what the renovation hides.
 * Finding order (index → step-1): electrics, plaster, moisture, crack, window, ventilation, plumbing, floor.
 * Step 0 = what the buyer sees at a viewing; last step = everything at once.
 * Pure presentational: the parent owns the step.
 */

export interface XrayLabel {
  title: string;
  sub: string;
  tone: "bad" | "warn";
}

const NF = 8;
const STEPS = NF + 2;
type V3 = [number, number, number];
const CAMERA: Array<{ pos: V3; look: V3 }> = [
  { pos: [5.4, 4.0, 6.4], look: [-0.4, 1.0, -0.6] },
  { pos: [1.6, 2.0, 3.2], look: [-3.0, 1.5, 0.4] }, // electrics
  { pos: [0.9, 1.9, 1.8], look: [-3.0, 1.5, -0.4] }, // plaster
  { pos: [1.4, 2.4, 2.2], look: [-2.4, 1.3, -2.4] }, // moisture
  { pos: [0.3, 2.0, 1.2], look: [-0.4, 2.1, -2.5] }, // crack
  { pos: [0.4, 1.8, 2.4], look: [1.0, 1.5, -2.5] }, // window
  { pos: [0.9, 2.0, 0.6], look: [2.3, 2.4, -2.5] }, // ventilation
  { pos: [0.6, 2.2, 1.6], look: [2.7, 1.4, -2.3] }, // plumbing
  { pos: [3.9, 3.9, 3.9], look: [0.0, 0.0, -0.4] }, // floor
  { pos: [5.6, 4.6, 6.8], look: [-0.4, 1.0, -0.8] },
];
/** Label anchors per finding. */
const ANCHORS: V3[] = [
  [-2.9, 1.45, 1.6],
  [-2.9, 1.95, -0.45],
  [-2.2, 1.15, -2.4],
  [-0.35, 2.45, -2.4],
  [1.0, 1.9, -2.4],
  [2.25, 2.6, -2.4],
  [2.6, 1.25, -2.15],
  [-1.6, 0.05, 0.3],
];

/** Floor flatness map: blue = high, red = low, contour lines every ~3 mm. */
const FLOOR_FRAG = /* glsl */ `
  uniform float uReveal;
  varying vec2 vUv;
  void main() {
    float t = clamp(vUv.x * 0.85 + vUv.y * 0.15, 0.0, 1.0);
    vec3 col = mix(vec3(0.15, 0.35, 0.95), vec3(0.95, 0.3, 0.2), t);
    float contour = smoothstep(0.92, 1.0, fract(t * 8.0));
    col = mix(col, vec3(1.0), contour * 0.6);
    gl_FragColor = vec4(col, uReveal * 0.4);
  }
`;

const THERMAL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
/** Thermal palette (blue → cyan → yellow → red) around a hot/cold centre, with a little noise. */
const THERMAL_FRAG = /* glsl */ `
  uniform float uReveal;
  uniform float uTime;
  uniform vec2 uCenter;
  uniform float uCold;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
    vec2 u = f * f * (3. - 2. * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
  }
  vec3 pal(float t) {
    vec3 c1 = vec3(0.10, 0.25, 0.85), c2 = vec3(0.10, 0.80, 0.85), c3 = vec3(0.98, 0.85, 0.20), c4 = vec3(0.95, 0.25, 0.15);
    return t < 0.33 ? mix(c1, c2, t / 0.33) : t < 0.66 ? mix(c2, c3, (t - 0.33) / 0.33) : mix(c3, c4, (t - 0.66) / 0.34);
  }
  void main() {
    float d = distance(vUv, uCenter);
    float n = noise(vUv * 6.0 + uTime * 0.15) * 0.25;
    float t = clamp(1.0 - d * 1.6 + n, 0.0, 1.0);
    if (uCold > 0.5) t = 1.0 - t; // cold bridge: centre is the coldest
    vec3 col = uCold > 0.5 ? mix(vec3(0.1, 0.3, 0.95), vec3(0.75, 0.9, 1.0), 1.0 - t) : pal(t);
    float a = uReveal * smoothstep(0.0, 0.25, uCold > 0.5 ? (1.0 - t) : t) * 0.85;
    gl_FragColor = vec4(col, a);
  }
`;

function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#b98b5c";
  g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 128;
    for (let x = -off; x < 512; x += 256) {
      const shade = 150 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${shade + 40},${shade},${shade - 40})`;
      g.fillRect(x + 2, row * 64 + 2, 252, 60);
      g.strokeStyle = "rgba(60,35,15,0.25)";
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(x + 6, row * 64 + 8 + k * 9);
        g.bezierCurveTo(x + 80, row * 64 + 6 + k * 9, x + 160, row * 64 + 12 + k * 9, x + 248, row * 64 + 8 + k * 9);
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function InspectionXray({ step, labels, className }: { step: number; labels: XrayLabel[]; className?: string }) {
  const { dict } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step);
  const labelEls = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(...CAMERA[0].pos);
    const look = new THREE.Vector3(...CAMERA[0].look);

    // ---- light: daylight from the window + warm interior ----
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb89a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const lamp = new THREE.PointLight(0xffc98a, 6, 6);
    lamp.position.set(1.9, 1.7, 0.9);
    scene.add(lamp);

    const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };

    // ---- shell ----
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const H = 2.8;
    const T = 0.15;
    const leftWallMat = std(0xefece6, { transparent: true });
    const backWallMat = std(0xefece6);
    box(T, H, 5, leftWallMat, -3 - T / 2 + 0.075, H / 2, 0, false).castShadow = false;
    // back wall with a window opening x∈[0.2,1.8], y∈[0.9,2.2]
    box(3.2, H, T, backWallMat, -1.4, H / 2, -2.5);
    box(1.2, H, T, backWallMat, 2.4, H / 2, -2.5);
    box(1.6, 0.9, T, backWallMat, 1.0, 0.45, -2.5);
    box(1.6, 0.6, T, backWallMat, 1.0, 2.5, -2.5);
    const white = std(0xfafafa, { roughness: 0.4 });
    box(1.6, 0.06, 0.12, white, 1.0, 0.93, -2.45);
    box(1.6, 0.06, 0.12, white, 1.0, 2.17, -2.45);
    box(0.06, 1.3, 0.12, white, 0.23, 1.55, -2.45);
    box(0.06, 1.3, 0.12, white, 1.77, 1.55, -2.45);
    box(0.04, 1.3, 0.1, white, 1.0, 1.55, -2.45);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshStandardMaterial({ color: 0xbfd9ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }));
    glass.position.set(1.0, 1.55, -2.5);
    scene.add(glass);
    // radiator
    for (let i = 0; i < 9; i++) box(0.08, 0.5, 0.08, white, 0.45 + i * 0.14, 0.45, -2.35);
    // baseboards
    box(6, 0.08, 0.03, white, 0, 0.04, -2.42, false);
    box(0.03, 0.08, 5, white, -2.92, 0.04, 0, false);

    // ---- furniture (the renovation looks perfect) ----
    const wardrobeMat = std(0xd8c7ad, { transparent: true });
    box(1.3, 2.2, 0.6, wardrobeMat, -2.25, 1.1, -2.1);
    const sofaMat = std(0x6f7a8c);
    box(2.2, 0.42, 0.95, sofaMat, 0.2, 0.21, 0.7);
    box(2.2, 0.55, 0.22, sofaMat, 0.2, 0.62, 1.1);
    box(0.22, 0.55, 0.95, sofaMat, -0.9, 0.42, 0.7);
    box(0.22, 0.55, 0.95, sofaMat, 1.3, 0.42, 0.7);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), std(0xd9d2c3));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.2, 0.005, -0.5);
    rug.receiveShadow = true;
    scene.add(rug);
    box(0.9, 0.38, 0.55, std(0x3b3f48, { roughness: 0.5 }), 0.2, 0.19, -0.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6), std(0x22252b));
    pole.position.set(1.9, 0.8, 0.9);
    scene.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(1.9, 1.7, 0.9);
    scene.add(shade);
    box(1.0, 0.7, 0.03, std(0x8a93a6, { roughness: 0.6 }), -0.8, 1.7, -2.41, false); // art print
    // electrical panel + sockets on the left wall
    const panel = box(0.04, 0.42, 0.32, std(0xd9dbe0, { roughness: 0.4 }), -2.9, 1.65, 1.6, false);
    for (const z of [-0.5, 0.8]) box(0.03, 0.09, 0.09, white, -2.91, 0.32, z, false);
    // drywall box hiding the riser (back-right corner)
    const riserBoxMat = std(0xefece6, { transparent: true });
    box(0.42, H, 0.42, riserBoxMat, 2.79, H / 2, -2.21);

    // ---- hidden layer 1: aluminium wiring inside the left wall ----
    const wireMat = new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0xff4a1d, emissiveIntensity: 0, transparent: true, opacity: 0 });
    const wirePaths: V3[][] = [
      [[-2.98, 1.65, 1.6], [-2.98, 2.55, 1.6], [-2.98, 2.55, -0.5], [-2.98, 0.32, -0.5]],
      [[-2.98, 1.65, 1.6], [-2.98, 2.45, 1.45], [-2.98, 2.45, 0.8], [-2.98, 0.32, 0.8]],
      [[-2.98, 1.65, 1.6], [-2.98, 2.6, 1.75], [-2.98, 2.6, -2.2]],
    ];
    for (const path of wirePaths) {
      const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.05);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.018, 8, false), wireMat);
      scene.add(tube);
    }
    const panelGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: 0xff4a1d, transparent: true, opacity: 0, wireframe: true }));
    panelGlow.position.copy(panel.position);
    scene.add(panelGlow);

    // ---- hidden layer 2: humidity map in the cold corner (back + left walls) ----
    const thermal = (center: [number, number], cold = 0) =>
      new THREE.ShaderMaterial({
        vertexShader: THERMAL_VERT,
        fragmentShader: THERMAL_FRAG,
        uniforms: { uReveal: { value: 0 }, uTime: { value: 0 }, uCenter: { value: new THREE.Vector2(...center) }, uCold: { value: cold } },
        transparent: true,
        depthWrite: false,
      });
    const moistBack = thermal([0.05, 0.25]);
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), moistBack);
    mb.position.set(-1.88, 1.3, -2.42);
    scene.add(mb);
    const moistLeft = thermal([0.95, 0.25]);
    const ml = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6), moistLeft);
    ml.rotation.y = Math.PI / 2;
    ml.position.set(-2.915, 1.3, -1.5);
    scene.add(ml);

    // ---- hidden layer 3: corroded riser + drips ----
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.9, metalness: 0.4, transparent: true, opacity: 0 });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H, 16), pipeMat);
    pipe.position.set(2.79, H / 2, -2.21);
    scene.add(pipe);
    const joint = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), new THREE.MeshStandardMaterial({ color: 0x5c2d14, transparent: true, opacity: 0 }));
    joint.rotation.x = Math.PI / 2;
    joint.position.set(2.79, 1.25, -2.21);
    scene.add(joint);
    const drips: THREE.Mesh[] = [];
    const dripMat = new THREE.MeshStandardMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0, roughness: 0.1 });
    for (let i = 0; i < 4; i++) {
      const dr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), dripMat);
      dr.userData.phase = i / 4;
      scene.add(dr);
      drips.push(dr);
    }
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), new THREE.MeshStandardMaterial({ color: 0x4a6f9a, transparent: true, opacity: 0, roughness: 0.05 }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(2.62, 0.006, -2.05);
    scene.add(puddle);

    // ---- hidden layer 4: cold bridge around the window ----
    const coldMat = thermal([0.5, 0.5], 1);
    const cold = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.9), coldMat);
    cold.position.set(1.0, 1.55, -2.415);
    scene.add(cold);

    // ---- hidden layer: plaster delamination on the left wall (tap test) ----
    const plasterMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, transparent: true, opacity: 0, roughness: 1 });
    const plaster = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), plasterMat);
    plaster.rotation.y = Math.PI / 2;
    plaster.position.set(-2.905, 1.6, -0.45);
    scene.add(plaster);
    const outlineMat = new THREE.LineDashedMaterial({ color: 0xe3a83e, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0 });
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2.9, 1.22, -0.95),
        new THREE.Vector3(-2.9, 1.98, -0.95),
        new THREE.Vector3(-2.9, 1.98, 0.05),
        new THREE.Vector3(-2.9, 1.22, 0.05),
      ]),
      outlineMat,
    );
    outline.computeLineDistances();
    scene.add(outline);
    const tapRings = [0, 1, 2].map((k) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 48), new THREE.MeshBasicMaterial({ color: 0xe3a83e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-2.895, 1.6, -0.45);
      ring.userData.phase = k / 3;
      scene.add(ring);
      return ring;
    });

    // ---- hidden layer: crack under the filler on the back wall ----
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x2a2523, transparent: true, opacity: 0 });
    const crackPts: V3[] = [[-0.15, 2.8, -2.42], [-0.22, 2.62, -2.42], [-0.12, 2.48, -2.42], [-0.3, 2.3, -2.42], [-0.24, 2.18, -2.42], [-0.42, 2.06, -2.42]];
    const crack = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crackPts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0), 48, 0.009, 6, false), crackMat);
    scene.add(crack);
    const gaugeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    for (const y of [2.55, 2.25]) box(0.16, 0.05, 0.01, gaugeMat, -0.22, y, -2.415, false);

    // ---- hidden layer: ventilation without draught (smoke drifts back into the room) ----
    box(0.32, 0.22, 0.03, std(0xf4f4f4, { roughness: 0.5 }), 2.25, 2.5, -2.41, false);
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0xb8bcc6, transparent: true, opacity: 0, depthWrite: false });
    const smoke = Array.from({ length: 10 }, (_, k) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), smokeMat);
      m.userData.phase = k / 10;
      scene.add(m);
      return m;
    });
    const noFlowMat = new THREE.MeshBasicMaterial({ color: 0xf07a68, transparent: true, opacity: 0 });
    const noFlow = new THREE.Group();
    for (const r of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.01), noFlowMat);
      bar.rotation.z = r;
      noFlow.add(bar);
    }
    noFlow.position.set(2.25, 2.5, -2.39);
    scene.add(noFlow);

    // ---- hidden layer: floor flatness map (laser level) ----
    const floorMapMat = new THREE.ShaderMaterial({ vertexShader: THERMAL_VERT, fragmentShader: FLOOR_FRAG, uniforms: { uReveal: { value: 0 } }, transparent: true, depthWrite: false });
    const floorMap = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 4.9), floorMapMat);
    floorMap.rotation.x = -Math.PI / 2;
    floorMap.position.y = 0.012;
    scene.add(floorMap);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const laser = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.012, 0.012), laserMat);
    laser.position.set(0, 0.06, 0);
    scene.add(laser);

    // ---- scanner: a cobalt line sweeping the surface being inspected ----
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, 0.02), new THREE.MeshBasicMaterial({ color: 0x8b9bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(scanner);
    const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, H), new THREE.MeshBasicMaterial({ color: 0x8b9bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(scanGlow);

    // ---- sizing ----
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 55 : 40;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // ---- animation state ----
    const reveal = new Array(NF).fill(0); // per finding 0..1
    let current = -1;
    let stepStart = 0;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const tmp = new THREE.Vector3();
    const SCAN_S = 1.1;

    const draw = (now: number) => {
      const s = stepRef.current;
      if (s !== current) {
        current = s;
        stepStart = now;
      }
      const since = (now - stepStart) / 1000;
      // camera glide
      const cam = CAMERA[Math.min(s, STEPS - 1)];
      const k = reduce ? 1 : 0.05;
      camera.position.lerp(tmp.set(...cam.pos), k);
      look.lerp(tmp.set(...cam.look), k);
      camera.lookAt(look);

      // targets: a finding fades in after its scan; summary shows all
      const scanDone = reduce || since > SCAN_S;
      for (let i = 0; i < NF; i++) {
        const target = s === STEPS - 1 ? 1 : s === i + 1 && scanDone ? 1 : s > i + 1 ? 0.35 : 0;
        reveal[i] += (target - reveal[i]) * (reduce ? 1 : 0.08);
      }
      // scanner sweep: walls get a vertical line moving along the wall; the floor gets a horizontal laser
      const scanning = !reduce && s >= 1 && s <= NF && since < SCAN_S;
      const p = clamp01(since / SCAN_S);
      const sm = scanner.material as THREE.MeshBasicMaterial;
      const sg = scanGlow.material as THREE.MeshBasicMaterial;
      sm.opacity = scanning && s !== 8 ? 0.95 : 0;
      sg.opacity = scanning && s !== 8 ? 0.18 : 0;
      laserMat.opacity = scanning && s === 8 ? 0.95 : reveal[7] * 0.5;
      if (scanning) {
        const along = (x: number, z: number, yaw: number) => {
          scanner.position.set(x, H / 2, z);
          scanGlow.position.copy(scanner.position);
          scanGlow.rotation.set(0, yaw, 0);
        };
        if (s === 1) along(-2.9, 2.4 - p * 4.6, Math.PI / 2);
        else if (s === 2) along(-2.9, 0.4 - p * 1.8, Math.PI / 2);
        else if (s === 3) along(-2.9 + p * 2.4, -2.4, 0);
        else if (s === 4) along(-1.2 + p * 1.6, -2.38, 0);
        else if (s === 5) along(0 + p * 2.0, -2.38, 0);
        else if (s === 6) along(1.8 + p * 0.9, -2.38, 0);
        else if (s === 7) along(2.4 + p * 0.6, -1.95, 0);
        else laser.position.set(0, 0.06, 2.4 - p * 4.8);
      } else if (s !== 8) laser.position.set(0, 0.06, 0);

      const t = now / 1000;
      // 1 electrics: the wall turns translucent, wires glow
      const e = reveal[0];
      leftWallMat.opacity = 1 - e * 0.72;
      leftWallMat.depthWrite = leftWallMat.opacity > 0.98;
      wireMat.opacity = e;
      wireMat.emissiveIntensity = e * (0.6 + 0.4 * Math.sin(t * 5));
      (panelGlow.material as THREE.MeshBasicMaterial).opacity = e * (0.5 + 0.5 * Math.sin(t * 6));
      // 2 moisture: wardrobe ghosts, heat map appears
      const m = reveal[2];
      wardrobeMat.opacity = 1 - m * 0.8;
      wardrobeMat.depthWrite = wardrobeMat.opacity > 0.98;
      moistBack.uniforms.uReveal.value = m;
      moistLeft.uniforms.uReveal.value = m;
      moistBack.uniforms.uTime.value = t;
      moistLeft.uniforms.uTime.value = t;
      // 3 plumbing: box ghosts, rusty riser + drips
      const pl = reveal[6];
      riserBoxMat.opacity = 1 - pl * 0.82;
      riserBoxMat.depthWrite = riserBoxMat.opacity > 0.98;
      pipeMat.opacity = pl;
      (joint.material as THREE.MeshStandardMaterial).opacity = pl;
      dripMat.opacity = pl * 0.9;
      (puddle.material as THREE.MeshStandardMaterial).opacity = pl * 0.55;
      drips.forEach((dr) => {
        const ph = (t * 0.6 + dr.userData.phase) % 1;
        dr.position.set(2.66, 1.2 - ph * 1.19, -2.06);
        dr.scale.setScalar(pl > 0.05 ? 1 : 0.001);
      });
      // 4 window cold bridge
      coldMat.uniforms.uReveal.value = reveal[4];
      coldMat.uniforms.uTime.value = t;
      // plaster: hollow patch, dashed outline, tap-test rings
      const pa = reveal[1];
      plasterMat.opacity = pa * 0.9;
      outlineMat.opacity = pa;
      tapRings.forEach((ring) => {
        const ph = (t * 0.7 + ring.userData.phase) % 1;
        ring.scale.setScalar(1 + ph * 6);
        (ring.material as THREE.MeshBasicMaterial).opacity = pa * (1 - ph) * 0.9;
      });
      // crack + gauges
      crackMat.opacity = reveal[3];
      gaugeMat.opacity = reveal[3];
      // ventilation: smoke falls back into the room, red cross on the grille
      const v = reveal[5];
      smokeMat.opacity = v * 0.45;
      noFlowMat.opacity = v;
      smoke.forEach((pf) => {
        const ph = (t * 0.25 + pf.userData.phase) % 1;
        pf.position.set(2.25 + Math.sin(ph * 6 + pf.userData.phase * 9) * 0.15, 2.4 - ph * 0.9, -2.3 + ph * 0.9);
        pf.scale.setScalar(v > 0.05 ? 0.6 + ph * 1.6 : 0.001);
      });
      // floor flatness map
      floorMapMat.uniforms.uReveal.value = reveal[7];

      renderer.render(scene, camera);

      // project labels
      const w = el.clientWidth;
      const h = el.clientHeight;
      ANCHORS.forEach((a, i) => {
        const node = labelEls.current[i];
        if (!node) return;
        tmp.set(...a).project(camera);
        const vis = reveal[i] > 0.5 && tmp.z < 1;
        node.style.opacity = vis ? String(Math.min(1, (reveal[i] - 0.5) * 2.5)) : "0";
        node.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      });
    };

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(el);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      draw(performance.now());
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      scene.traverse((o) => {
        const mm = o as THREE.Mesh;
        mm.geometry?.dispose();
        const mat = mm.material as THREE.Material | undefined;
        if (mat && "map" in mat && (mat as THREE.MeshStandardMaterial).map) (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={host} className={`relative overflow-hidden ${className ?? ""}`} aria-hidden>
      {labels.map((l, i) => (
        <div
          key={i}
          ref={(n) => {
            labelEls.current[i] = n;
          }}
          className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity"
          style={{ willChange: "transform" }}
        >
          <div className={`mb-2 max-w-[220px] rounded-xl border bg-surface/95 px-3 py-2 shadow-card backdrop-blur ${l.tone === "bad" ? "border-bad" : "border-warn"}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${l.tone === "bad" ? "text-bad" : "text-warn"}`}>{dict.enums.severity[l.tone === "bad" ? "red" : "yellow"]}</p>
            <p className="text-sm font-semibold leading-snug">{l.title}</p>
            <p className="num text-xs text-ink2">{l.sub}</p>
          </div>
          <div className={`mx-auto h-3 w-3 rounded-full border-2 border-surface ${l.tone === "bad" ? "bg-bad" : "bg-warn"}`} />
        </div>
      ))}
    </div>
  );
}
