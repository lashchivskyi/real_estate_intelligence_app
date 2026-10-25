"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 3D Vidomo mark — "the lit window in focus". 6-second loop:
 *   frame corners converge (focus) → a scan plane passes through the house → the window lights up (known) → hold → reset.
 * Reduced motion: final state, static.
 */
export function Logo3D({ className, dark = false }: { className?: string; dark?: boolean }) {
  const host = useRef<HTMLDivElement>(null);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.2, 9.5);

    const COBALT = dark ? 0x8b9bff : 0x2b45d4;
    const INK = dark ? 0xeef0f4 : 0x12151b;
    const AMBER = 0xf2b550;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x0b0d12, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(3, 4, 6);
    scene.add(key);

    // house outline: extruded pentagon with a pentagon hole
    const pent = (s: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(-1.05 * s, -1.15 * s);
      sh.lineTo(1.05 * s, -1.15 * s);
      sh.lineTo(1.05 * s, 0.3 * s);
      sh.lineTo(0, 1.2 * s);
      sh.lineTo(-1.05 * s, 0.3 * s);
      sh.closePath();
      return sh;
    };
    const outer = pent(1);
    const hole = new THREE.Path(pent(0.78).getPoints());
    outer.holes.push(hole);
    const houseGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
    houseGeo.translate(0, 0, -0.19);
    const house = new THREE.Mesh(houseGeo, new THREE.MeshPhysicalMaterial({ color: COBALT, roughness: 0.3, metalness: 0.1, clearcoat: 0.7 }));
    scene.add(house);

    // the window: dark glass that lights up amber
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1e27, emissive: AMBER, emissiveIntensity: 0, roughness: 0.4 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), winMat);
    win.position.set(0, -0.35, 0);
    scene.add(win);
    const glow = new THREE.PointLight(AMBER, 0, 6);
    glow.position.set(0, -0.35, 0.8);
    scene.add(glow);

    // focus frame corners
    const cornerMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5 });
    const corners: Array<{ g: THREE.Group; dir: THREE.Vector2 }> = [];
    const L = 0.75;
    const T = 0.13;
    for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
      const g = new THREE.Group();
      const a = new THREE.Mesh(new THREE.BoxGeometry(L, T, T), cornerMat);
      a.position.set((-sx * L) / 2 + (sx * T) / 2, 0, 0);
      const b = new THREE.Mesh(new THREE.BoxGeometry(T, L, T), cornerMat);
      b.position.set(0, (-sy * L) / 2 + (sy * T) / 2, 0);
      g.add(a, b);
      scene.add(g);
      corners.push({ g, dir: new THREE.Vector2(sx, sy) });
    }

    // scan plane
    const scan = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.03),
      new THREE.MeshBasicMaterial({ color: COBALT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scan.position.z = 0.3;
    scene.add(scan);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
    const LOOP = 6;
    const draw = (t: number, elapsed: number) => {
      const out = ease((t - 5.3) / 0.7);
      const focus = ease(t / 1) * (1 - out);
      corners.forEach(({ g, dir }) => {
        const d = 1.75 + (1 - focus) * 1.2;
        g.position.set(dir.x * d, dir.y * d - 0.0, 0);
        g.rotation.z = (1 - focus) * 0.4 * dir.x * dir.y;
      });
      const s = clamp01((t - 1.1) / 1.1);
      scan.position.y = 1.4 - s * 2.8;
      (scan.material as THREE.MeshBasicMaterial).opacity = Math.sin(s * Math.PI) * 0.9;
      const lit = ease((t - 2.2) / 0.5) * (1 - out);
      const flicker = t > 2.2 && t < 2.6 ? 0.6 + 0.4 * Math.sin(t * 80) : 1;
      winMat.emissiveIntensity = lit * 1.1 * flicker;
      glow.intensity = lit * 18 * flicker;
      scene.rotation.y = Math.sin(elapsed * 0.6) * 0.4;
      scene.rotation.x = Math.sin(elapsed * 0.4) * 0.08;
      renderer.render(scene, camera);
    };

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const start = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const elapsed = (performance.now() - start) / 1000;
      draw(elapsed % LOOP, elapsed);
    };
    if (reduce) draw(4, 0);
    else loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dark]);

  return <div ref={host} className={className} aria-hidden />;
}
