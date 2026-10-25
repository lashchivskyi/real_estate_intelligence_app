// MapLibre's web worker can't be bundled by Turbopack; serve it as a static asset instead.
import { cpSync, mkdirSync } from "node:fs";
const from = "node_modules/maplibre-gl/dist";
const to = "public/vendor/maplibre";
mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) cpSync(`${from}/${f}`, `${to}/${f}`);
