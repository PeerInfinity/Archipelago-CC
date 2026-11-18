#!/usr/bin/env node
// rules-landing-contact-census: the L73 move search on an 8 px grid (the vanilla placement 72,24 is off the 16 px
// grid). A spot is a placement (x, y) whose runner box (centre + 8, 12×12) overlaps no solid and whose centre tile
// is terrain a LavaRunner holds (Igneous Stone or Lava; `LavaRunner.as` dieInLava = false), and that no entity
// tile, door tile or rock tile holds. Per spot, item-less, on the model:
//   A  the L74 landing (64,16): idle + 4 held, --ticks: any hit sourced by a BODY (lava burns from walking into the
//      lava are the player's own) → fails criterion 1
//   B  the L72 landing (32,128): idle + 4 held, --ticks: any hit sourced by the RUNNER → fails criterion 3 (the
//      runner may not become a south-floor arrival hazard); also the runner's closest approach to the player
//   node move-search8.mjs [--ticks=300] [--max=80]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const TICKS = Number(arg('ticks', '300'));
const MAX = Number(arg('max', '80'));
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { moveRow } = await import('./move-search.mjs');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const LANDINGS = { L74: { level: 73, x: 64, y: 16 }, L72: { level: 73, x: 32, y: 128 } };
const INPUTS = [null, 'up', 'down', 'left', 'right'];

function arrival(src, boot, key, ticks) {
    const run = createRunForStaging(JSON.parse(JSON.stringify(arrivalStaging(boot, {}))), src, { scratchPersistence: true });
    let minD = Infinity; let left = null;
    for (let t = 0; t < ticks; t++) {
        run.advance(new Set(key ? [key] : []));
        if (run.level !== boot.level) { left = t + 1; break; }
        const r = (run.chasers ?? []).find((b) => /lavarunner/.test(b.id) && !b.destroy);
        if (r) minD = Math.min(minD, Math.hypot(r.x - run.state.x, r.y - run.state.y));
    }
    return { hits: run.playerHits.map((h) => ({ t: h.t, src: String(h.id ?? h.source) })), left, minD: +minD.toFixed(1) };
}

const base = levelSourceFromAtlas(patchedMapDocument(MAP))(73);
const w = buildLevelWorld(base, { roles: ROLES });
const terrain = new Map(w.tiles.map((t) => [`${t.tx},${t.ty}`, t.name]));
const solid = new Set([...terrain].filter(([, n]) => /Dark Stone/.test(n)).map(([k]) => k));
const blocked = new Set(base.entities.filter((e) => !/lavarunner|lightalpha/.test(e.type)).map((e) => `${Math.floor(e.x / 16)},${Math.floor(e.y / 16)}`));
const spots = [];
for (let x = 0; x <= 144; x += 8) for (let y = 0; y <= 144; y += 8) {
    const cx = x + 8; const cy = y + 8;
    const tiles = []; for (const px of [cx - 6, cx + 5]) for (const py of [cy - 6, cy + 5]) tiles.push(`${Math.floor(px / 16)},${Math.floor(py / 16)}`);
    const centre = `${Math.floor(cx / 16)},${Math.floor(cy / 16)}`;
    if (tiles.some((k) => solid.has(k) || blocked.has(k)) || !/Igneous Stone|Lava/.test(terrain.get(centre) ?? '')) continue;
    if (x === 72 && y === 24) continue;
    const move = Math.hypot(x - 72, y - 24);
    if (move <= MAX) spots.push({ x, y, move: +move.toFixed(1), terrain: terrain.get(centre) });
}
spots.sort((a, b) => a.move - b.move);
for (const s of spots) {
    const src = levelSourceFromAtlas(patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved'), moveRow(s.x, s.y)]));
    const res = {};
    for (const [n, boot] of Object.entries(LANDINGS)) res[n] = INPUTS.map((k) => ({ key: k ?? 'idle', ...arrival(src, boot, k, TICKS) }));
    const okA = res.L74.every((v) => !v.hits.some((h) => /lavarunner|bulb/.test(h.src)));
    const okB = res.L72.every((v) => !v.hits.some((h) => /lavarunner/.test(h.src)));
    const fmt = (v) => `${v.key}:${v.hits.filter((h) => !/lava@/.test(h.src)).map((h) => `${h.src.split('@')[0]}@${h.t}`).join('+') || 'ok'}${v.left ? `>out@${v.left}` : ''}(d${v.minD})`;
    console.log('SPOT', JSON.stringify({ ...s, okA, okB, L74: res.L74.map(fmt), L72: res.L72.map(fmt) }));
}
