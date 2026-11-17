#!/usr/bin/env node
// rules-landing-contact-census: the L73 lavarunner MOVE search on the JS model (the screen; the game decides).
//
// For every tile the runner could stand on (Igneous Stone or Lava in L73, not a door tile, not the rock's, not an
// occupied entity tile), build the DELIVERED map with one extra `op: 'move'` row (`lavarunner@72,24` -> that tile),
// and run, item-less, 180 ticks each:
//   A  the L74 door's landing (64,16): idle, up, down, left, right   — criterion 1 (no hit)
//   B  the L72 door's landing (32,128): idle, up, down, left, right  — criterion 3 (no hit the vanilla room lacks;
//      the runner must not become an arrival hazard on the south floor)
// and print one JSON row per candidate: the move's length, the hits per input (with the source ids), level changes.
//   node move-search.mjs [--ticks=180] [--only=x,y;x,y] [--vanilla]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const TICKS = Number(arg('ticks', '180'));

const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const FROM = { type: 'lavarunner', x: 72, y: 24, attrs: {} };
export const moveRow = (x, y) => Object.freeze({ id: 'l73-lavarunner-moved', level: 73, op: 'move', match: FROM, to: { x, y }, why: 'search' });

const LANDINGS = { L74: { level: 73, x: 64, y: 16 }, L72: { level: 73, x: 32, y: 128 } };
const INPUTS = [null, 'up', 'down', 'left', 'right'];

export function runArrival(levelSource, boot, key, { ticks = TICKS, items = [] } = {}) {
    const run = createRunForStaging(JSON.parse(JSON.stringify(arrivalStaging(boot, { items }))), levelSource, { scratchPersistence: true });
    let left = null;
    for (let t = 0; t < ticks; t++) {
        run.advance(new Set(key ? [key] : []));
        if (left === null && run.level !== boot.level) { left = { level: run.level, t: t + 1 }; break; }
    }
    const hits = run.playerHits.map((h) => ({ t: h.t, src: h.id ?? h.source }));
    return { hits, left, end: { level: run.level, x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1) } };
}

export function evalSpot(spot) {
    const doc = spot ? patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved'), moveRow(spot.x, spot.y)]) : patchedMapDocument(MAP, SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved')); // --vanilla: the runner at 72,24
    const src = levelSourceFromAtlas(doc);
    const out = {};
    for (const [name, boot] of Object.entries(LANDINGS)) {
        out[name] = INPUTS.map((k) => {
            try {
                const r = runArrival(src, boot, k);
                return { key: k ?? 'idle', hits: r.hits.length, first: r.hits[0] ?? null, left: r.left };
            } catch (e) { return { key: k ?? 'idle', refused: String(e.message).split('\n')[0].slice(0, 160) }; }
        });
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const base = levelSourceFromAtlas(patchedMapDocument(MAP))(73);
    const w = buildLevelWorld(base, { roles: ROLES });
    const occupied = new Set(base.entities.filter((e) => e.type !== 'lavarunner' && e.type !== 'lightalpha')
        .map((e) => `${Math.floor(e.x / 16)},${Math.floor(e.y / 16)}`));
    const terrain = new Map(w.tiles.map((t) => [`${t.tx},${t.ty}`, t.name]));
    let spots = [...terrain].filter(([k, n]) => /Igneous Stone|Lava/.test(n) && !occupied.has(k))
        .map(([k, n]) => { const [tx, ty] = k.split(',').map(Number); return { x: tx * 16, y: ty * 16, terrain: n }; });
    if (arg('only')) spots = arg('only').split(';').map((p) => { const [x, y] = p.split(',').map(Number); return { x, y, terrain: terrain.get(`${x / 16},${y / 16}`) }; });
    if (process.argv.includes('--vanilla')) { console.log('VANILLA', JSON.stringify(evalSpot(null))); process.exit(0); }
    for (const s of spots.sort((a, b) => Math.hypot(a.x - 72, a.y - 24) - Math.hypot(b.x - 72, b.y - 24))) {
        const r = evalSpot(s);
        const okA = r.L74.every((v) => !v.refused && v.hits === 0);
        const okB = r.L72.every((v) => !v.refused && !(v.first && /lavarunner/.test(String(v.first.src))));
        console.log('SPOT', JSON.stringify({ x: s.x, y: s.y, terrain: s.terrain, move: +Math.hypot(s.x - 72, s.y - 24).toFixed(1), okA, okB,
            L74: r.L74.map((v) => `${v.key}:${v.refused ? 'REFUSED' : v.hits ? `hit@${v.first.t}(${v.first.src})` : 'clear'}${v.left ? `>L${v.left.level}@${v.left.t}` : ''}`),
            L72: r.L72.map((v) => `${v.key}:${v.refused ? 'REFUSED' : v.hits ? `hit@${v.first.t}(${v.first.src})` : 'clear'}${v.left ? `>L${v.left.level}@${v.left.t}` : ''}`) }));
    }
}
