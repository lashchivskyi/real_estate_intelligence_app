"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SectionId } from "@/domain/inspection";

type V3 = [number, number, number];

/** On-demand rendering: no animation loop, controls or GPU work when the card is closed. */
export function IssueDiagram({ section, solution, healthy, fallback }: { section: SectionId; solution: boolean; healthy: boolean; fallback: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known after trying the browser API
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xeeeae1, 1);
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(4.4, 3.0, 6.2);
    camera.lookAt(0, 1.15, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d887d, 2.8));
    const light = new THREE.DirectionalLight(0xfff6e4, 3.2);
    light.position.set(3, 6, 5);
    scene.add(light);
    const group = new THREE.Group();
    scene.add(group);
    const good = solution || healthy;
    const accent = good ? 0x217864 : 0xc05432;
    const mat = (color: number, opacity = 1) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: opacity < 1, opacity });
      return m;
    };
    const box = (size: V3, pos: V3, color: number, opacity = 1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color, opacity));
      m.position.set(...pos); group.add(m); return m;
    };
    const pipe = (points: V3[], color: number, radius = 0.045) => {
      const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, radius, 8, false), mat(color));
      group.add(mesh); return mesh;
    };
    const ball = (pos: V3, radius: number, color: number) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat(color));
      mesh.position.set(...pos); group.add(mesh); return mesh;
    };
    const arrow = (pos: V3, dir: V3, color: number, length = 0.7) => {
      group.add(new THREE.ArrowHelper(new THREE.Vector3(...dir).normalize(), new THREE.Vector3(...pos), length, color, 0.15, 0.1));
    };
    box([3.8, 0.12, 2.4], [0, 0, 0.4], 0xc8bca7);
    box([3.8, 2.8, 0.14], [0, 1.4, -0.65], 0xe0dbcf);
    box([0.12, 2.8, 2.2], [-1.85, 1.4, 0.4], 0xd2cdc0);
    let focus: V3 = [0, 1.4, 0];

    switch (section) {
      case "electrical": {
        box([1.3, 1.65, 0.22], [-0.3, 1.5, -0.43], 0x667272);
        box([1.12, 1.45, 0.05], [-0.3, 1.5, -0.28], 0x263b3d);
        for (let i = 0; i < (solution ? 5 : 3); i++) {
          const x = -0.73 + i * (solution ? 0.21 : 0.38);
          box([solution ? 0.16 : 0.24, 0.46, 0.13], [x, 1.7, -0.16], 0xe8e9df);
          box([0.08, 0.1, 0.06], [x, 1.72, -0.06], accent);
          pipe([[x, 1.42, -0.12], [x + (solution ? 0 : 0.11), 1.05, 0.03], [x, 0.55, 0.03]], solution ? [0x4379a1, 0xbf923e, 0x267b61][i % 3] : 0x9c7052, 0.026);
        }
        if (!good) ball([-0.36, 1.08, 0.08], 0.16, accent);
        focus = [-0.3, 1.15, 0.12];
        break;
      }
      case "moisture": {
        box([1.25, 1.45, 0.12], [0.7, 1.65, -0.48], 0x6f9cad);
        for (const x of [0.02, 1.37]) box([0.09, 1.6, 0.2], [x, 1.65, -0.38], 0xf9f6ec);
        for (const y of [0.88, 2.42]) box([1.42, 0.09, 0.2], [0.7, y, -0.38], 0xf9f6ec);
        box([0.6, 2.3, 0.12], [-1.36, 1.25, -0.5], good ? 0x81ae96 : 0x579bc2, 0.8);
        if (!good) for (let i = 0; i < 22; i++) {
          const b = ball([-1.55 + (i % 5) * 0.11, 0.38 + Math.floor(i / 5) * 0.12, -0.39], 0.035 + (i % 3) * 0.014, 0x4c5847);
          b.scale.z = 0.2;
        }
        if (solution) arrow([1.3, 2.65, -0.25], [-1, 0, 0], 0x217864, 1.2);
        focus = [-1.32, 1.2, -0.3];
        break;
      }
      case "plumbing": {
        const color = good ? 0x85b1af : 0x946b49;
        pipe([[-0.8, 0.15, -0.22], [-0.8, 1.15, -0.22], [-0.8, 2.6, -0.22]], color, 0.11);
        pipe([[-0.8, 1.3, -0.22], [0, 1.3, -0.22], [0.65, 1.3, 0.1], [0.65, 0.8, 0.1]], color, 0.065);
        box([0.34, 0.17, 0.2], [0.05, 1.3, -0.21], accent);
        box([1.1, 0.18, 0.65], [0.7, 0.72, 0.1], 0xf5f1e7);
        if (!good) {
          for (let i = 0; i < 6; i++) ball([-0.78 + (i % 2) * 0.08, 0.6 + i * 0.22, -0.1], 0.075, 0xb76c39);
          for (let i = 0; i < 3; i++) { const drop = ball([0.04, 0.95 - i * 0.23, -0.1], 0.045, 0x4c9ec9); drop.scale.y = 1.4; }
        }
        focus = [-0.7, 1.3, -0.05];
        break;
      }
      case "windows": {
        box([2.25, 1.85, 0.08], [0, 1.65, -0.5], 0x8bb6c4, 0.7);
        for (const x of [-1.15, 0, 1.15]) box([0.1, 2, 0.25], [x, 1.65, -0.35], 0xf9f7ef);
        for (const y of [0.67, 2.63]) box([2.4, 0.1, 0.25], [0, y, -0.35], 0xf9f7ef);
        for (const x of [-1.02, 1.02]) box([0.035, 1.78, 0.05], [x, 1.65, -0.18], accent);
        if (!good) for (let i = 0; i < 3; i++) arrow([0.9, 1.1 + i * 0.45, -0.12], [-0.7, 0, 1], 0x408daf, 0.8);
        focus = [1.04, 1.7, -0.12];
        break;
      }
      case "common": {
        for (let i = 0; i < 4; i++) box([1.45, 0.18 + i * 0.24, 0.38], [-0.2, (0.18 + i * 0.24) / 2, 1 - i * 0.4], 0xbab7ad);
        const roof = box([3.9, 0.14, 2.3], [0, 2.65, 0.35], good ? 0x779b8a : 0x8d8a83);
        roof.rotation.z = -0.06;
        if (!good) {
          box([0.65, 0.8, 0.03], [0.75, 2.1, -0.55], 0x9c865b, 0.8);
          for (let i = 0; i < 3; i++) { const drop = ball([0.75, 2.35 - i * 0.35, 0.15], 0.055, 0x438baa); drop.scale.y = 1.5; }
        } else box([0.9, 0.07, 1.3], [0.7, 2.82, 0.35], 0x217864);
        focus = [0.7, 2.67, 0.55];
        break;
      }
      case "structure": {
        box([1.9, 2.1, 0.07], [0.15, 1.4, -0.5], 0xeae3d4);
        pipe([[-0.35, 2.25, -0.44], [-0.4, 2.0, -0.44], [-0.28, 1.85, -0.44], [-0.35, 1.62, -0.44]], good ? 0x9caa9c : accent, 0.012);
        box([0.6, 0.22, 0.04], [-0.32, 1.95, -0.39], 0xfcfbef);
        for (let i = 0; i < 7; i++) box([0.008, i % 2 ? 0.07 : 0.11, 0.015], [-0.55 + i * 0.075, 1.95, -0.36], 0x39745d);
        focus = [-0.3, 1.95, -0.3];
        break;
      }
      case "renovation": {
        for (let x = 0; x < 5; x++) for (let z = 0; z < 3; z++) box([0.64, 0.035, 0.61], [-1.35 + x * 0.67, 0.09, -0.15 + z * 0.64], (x + z) % 2 ? 0xc8bb9f : 0xe7decb);
        box([2.4, 0.07, 0.11], [0, 0.17, 0.6], 0x487861);
        box([0.22, 0.1, 0.13], [0, 0.19, 0.61], 0xd4eab0);
        focus = [0, 0.27, 0.65];
        break;
      }
      case "heating": {
        for (let i = 0; i < 9; i++) box([0.16, 1.1, 0.3], [-0.9 + i * 0.22, 1, -0.32], good ? 0xd19e68 : i < 4 ? 0x88afbd : 0xd19e68);
        pipe([[-1.15, 0.15, -0.2], [-1.15, 0.5, -0.2], [-0.9, 0.5, -0.2]], 0x9caaa5);
        focus = [0, 1.05, -0.05];
        break;
      }
      case "energy": {
        box([1.4, 1.65, 0.8], [-0.15, 0.9, 0], 0x364b4b);
        box([1.2, 0.8, 0.05], [-0.15, 1, 0.43], 0xe0e5d5);
        for (let i = 0; i < 4; i++) box([0.17, 0.45, 0.04], [-0.5 + i * 0.24, 1, 0.48], good || i === 0 ? 0x5b9b76 : 0xc2c7bb);
        pipe([[0.55, 0.5, 0], [1.1, 0.5, 0], [1.25, 1.3, -0.45]], 0x4f625b);
        focus = [0, 1.1, 0.5];
        break;
      }
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, 40), mat(accent));
    ring.position.set(...focus); group.add(ring);
    const marker = document.createElement("span");
    marker.className = "pointer-events-none absolute grid h-6 w-6 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm";
    marker.style.backgroundColor = `#${accent.toString(16).padStart(6, "0")}`;
    marker.textContent = "1";
    marker.setAttribute("aria-hidden", "true");
    el.appendChild(marker);

    const render = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const point = new THREE.Vector3(...focus).project(camera);
      marker.style.left = `${(point.x * 0.5 + 0.5) * width - 12}px`;
      marker.style.top = `${(-point.y * 0.5 + 0.5) * height - 38}px`;
    };
    const resize = new ResizeObserver(render);
    resize.observe(el);
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    render();
    return () => {
      resize.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      marker.remove();
    };
  }, [section, solution, healthy]);

  return <div className="relative h-56 overflow-hidden rounded-lg sm:h-64">
    <div ref={host} className="absolute inset-0" />
    {unavailable && <p className="absolute inset-0 grid place-items-center bg-surface2 p-5 text-center text-sm text-ink2">{fallback}</p>}
  </div>;
}
