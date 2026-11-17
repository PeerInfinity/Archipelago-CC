#!/usr/bin/env node
// rules-arrival-chase-witness: a STEERED-route search on the JS model (not the solver): beam search over held key
// sets (8 directions + idle, optionally + primary), each held for --seg ticks, from the game's own arrival staging on
// the DELIVERED room. A node survives only with 0 player hits and 0 deaths and still in the boot level; it scores by
// the tile-path distance (BFS over floor tiles; lava counts as floor with --lava) to the goal exit's tile. Reaching
// the goal's level ends the search. The model only CHOOSES keys; the game decides (play.mjs).
//   node beam.mjs --boot=77:96:288 --goal=0:32:76 [--items=hasSword] [--width=12] [--seg=10] [--depth=40]
//                 [--primary] [--lava] [--margin=<px>] [--edge=<px>] [--out=<tape path>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { buildStagedTape } = await M('botDriverV1.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES]));
const [level, bx, by] = arg('boot').split(':').map(Number);
// --goal=<x>:<y>:<level> (an exit: success = arriving in <level>); --goal=tiles:<tx>,<ty>;… (a sub-region: success =
// standing on one of its tiles); --goal=chest:<x>:<y> (a chest's OEL coordinates: success = the model opens a chest)
const G = arg('goal');
const KIND = G.startsWith('tiles:') ? 'tiles' : G.startsWith('chest:') ? 'chest' : 'exit';
const GT = KIND === 'tiles' ? G.slice(6).split(';').map((p) => p.split(',').map(Number)) : null;
const [gx, gy, glevel] = KIND === 'tiles' ? [GT[0][0] * 16, GT[0][1] * 16, null] : KIND === 'chest' ? G.slice(6).split(':').map(Number) : G.split(':').map(Number);
const goalReached = (run) => (KIND === 'tiles' ? GT.some(([tx, ty]) => Math.floor(run.state.x / 16) === tx && Math.floor(run.state.y / 16) === ty)
    : KIND === 'chest' ? (run.chestOpens?.length ?? 0) > 0 || (run.openChests?.size ?? run.openChests?.length ?? 0) > 0 : false);
const items = (arg('items', '') || '').split(',').filter(Boolean);
const WIDTH = Number(arg('width', '12')); const SEG = Number(arg('seg', '10')); const DEPTH = Number(arg('depth', '40'));
const LAVA = process.argv.includes('--lava');
const MARGIN = Number(arg('margin', '0'));
const EDGE = Number(arg('edge', '0'));
const st = arrivalStaging({ level, x: bx, y: by }, { items });
// tile distance field to the goal tile
const w = buildLevelWorld(levelSource(level), { roles: ROLES });
const solid = new Set(w.solids.map((s) => `${Math.floor(s.rect.x / 16)},${Math.floor(s.rect.y / 16)}`));
const floor = new Set(w.tiles.filter((t) => (LAVA || !/Lava|Water|Pit/.test(t.name)) || t.name === 'Igneous-to-Lava').map((t) => `${t.tx},${t.ty}`).filter((k) => !solid.has(k)));
const goalTs = KIND === 'tiles' ? GT.map(([tx, ty]) => `${tx},${ty}`) : [`${Math.floor(gx / 16)},${Math.floor(gy / 16)}`];
for (const g of goalTs) floor.add(g);
const dist = new Map(goalTs.map((g) => [g, 0])); const q = [...goalTs];
while (q.length) { const c = q.shift(); const [cx, cy] = c.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${cx + dx},${cy + dy}`; if (floor.has(k) && !dist.has(k)) { dist.set(k, dist.get(c) + 1); q.push(k); } } }
const DIRS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
const CHOICES = process.argv.includes('--primary') ? [...DIRS, ...DIRS.map((d) => [...d, 'primary'])] : DIRS;
function play(keys) {
    const run = createRunForStaging(JSON.parse(JSON.stringify(st)), levelSource, { scratchPersistence: true });
    let t = 0;
    for (const k of keys) {
        try { run.advance(new Set(k)); } catch (e) { return { dead: true, t, refused: String(e.message).slice(0, 120) }; }
        t++;
        if (run.playerHits.length || (run.playerDeaths?.length ?? 0)) return { dead: true, t };
        // --margin=M: a safety band for the model's contact error: refuse a tick where any live chaser's centre is
        // within M px of the player's on both axes (the game hit L80's first Dark Suit plan at a model gap of ~2 px)
        // --edge=E: the model let the L77 Sword plan stand at x 95.6 beside the 1-wide corridor where the game's
        // `Player.getState` (nearest tile) put it in lava and killed it (t47): refuse a tick whose (x±E, y±E) corners
        // are not all on floor (lava/water/pit tiles excluded unless --lava)
        if (EDGE && [[-EDGE, -EDGE], [EDGE, -EDGE], [-EDGE, EDGE], [EDGE, EDGE]].some(([dx, dy]) => !floor.has(`${Math.floor((run.state.x + dx) / 16)},${Math.floor((run.state.y + dy) / 16)}`))) return { dead: true, t };
        if (MARGIN && (run.chasers ?? []).some((b) => !b.destroy && !b.dying && Math.abs(b.x - run.state.x) < MARGIN && Math.abs(b.y - run.state.y) < MARGIN)) return { dead: true, t };
        if (run.level !== level) return { left: run.level, t, run };
        if (goalReached(run)) return { left: 'goal', t, run };
    }
    return { run, t };
}
function score(run) {
    const tx = Math.floor(run.state.x / 16); const ty = Math.floor(run.state.y / 16);
    const d = dist.get(`${tx},${ty}`) ?? 999;
    return d * 16 + Math.hypot(run.state.x - (gx + 8), run.state.y - (gy + 8)) / 100;
}
const sig = (run) => [Math.round(run.state.x / 4), Math.round(run.state.y / 4), ...(run.chasers ?? []).filter((b) => !b.destroy).map((b) => `${Math.round(b.x / 6)},${Math.round(b.y / 6)}`)].join('|');
let beam = [{ keys: [], s: score(play([]).run) }];
let best = null; let tried = 0; let survivors = 0; let won = null; let maxProgress = beam[0].s;
const t0 = Date.now();
for (let depth = 0; depth < DEPTH && beam.length && !won; depth++) {
    const next = []; const seen = new Set();
    for (const node of beam) for (const c of CHOICES) {
        const keys = [...node.keys, ...Array.from({ length: SEG }, () => c)];
        const r = play(keys); tried++;
        if (r.dead) continue;
        if (r.left !== undefined) { if (r.left === glevel || r.left === 'goal') { won = { keys: keys.slice(0, r.t), t: r.t }; break; } continue; }
        const k = sig(r.run); if (seen.has(k)) continue; seen.add(k);
        survivors++;
        const s = score(r.run);
        next.push({ keys, s, at: [+r.run.state.x.toFixed(1), +r.run.state.y.toFixed(1)], ch: (r.run.chasers ?? []).filter((b) => !b.destroy).map((b) => `${b.id}(${b.x.toFixed(0)},${b.y.toFixed(0)})`) });
        if (won) break;
    }
    next.sort((a, b) => a.s - b.s);
    beam = next.slice(0, WIDTH);
    if (beam[0] && (!best || beam[0].s < best.s)) best = beam[0];
    console.log('DEPTH', depth + 1, JSON.stringify({ alive: next.length, best: beam[0] ? { s: +beam[0].s.toFixed(2), at: beam[0].at, ch: beam[0].ch } : null }));
}
const out = { boot: [level, bx, by], goal: [gx, gy, glevel], items, width: WIDTH, seg: SEG, depth: DEPTH, tried, survivors,
    verdict: won ? 'MODEL ROUTE' : 'NO MODEL ROUTE', ticks: won?.t ?? null,
    bestHitFree: best ? { tiles: Math.floor(best.s / 16), at: best.at, ticks: best.keys.length, ch: best.ch } : null, ms: Date.now() - t0 };
console.log('BEAM', JSON.stringify(out));
const keep = won?.keys ?? best?.keys;
if (arg('out') && keep) {
    const name = arg('out').split('/').pop().replace(/\.tape\.json$/, '');
    const tape = buildStagedTape({ staging: st, perTick: [...keep.map((k) => new Set(k)), ...Array.from({ length: 8 }, () => new Set())], name });
    writeFileSync(arg('out'), JSON.stringify({ ...tape, description: `rules-arrival-chase-witness: beam ${won ? 'route' : 'best hit-free prefix'} ${JSON.stringify(out)}` }));
}
