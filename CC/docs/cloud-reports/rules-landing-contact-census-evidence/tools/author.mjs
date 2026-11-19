#!/usr/bin/env node
// rules-landing-contact-census: HAND-AUTHORED (open-loop) key scripts on L73, authored on the JS model of the room
// WITH THE RUNNER MOVED (`--spot=x,y`, default 32,24; `--spot=vanilla` for the delivered room as committed), from the
// game's own landing (`fidelityArrival.arrivalStaging`). Ported from rules-fire-only-witness's `fireonly.mjs` (same
// ops); the model only CHOOSES keys and predicts, the game decides (`play.mjs`).
//   node author.mjs [--spot=32,24] [--case=a,b] [--trace] [--build=<dir>]
// Ops: ['to', x, y] walk (1 px tolerance) until there or stalled; ['go', x, y] a 4-connected tile path then 'to';
// ['fire'] one primary press; ['wait', n]; ['keys', 'up+left', n]; ['until', ms] idle until no chaser is alive (cap).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keysToward = (x, y, tx, ty, tol = 1) => {
    const k = [];
    if (tx - x > tol) k.push('right'); else if (tx - x < -tol) k.push('left');
    if (ty - y > tol) k.push('down'); else if (ty - y < -tol) k.push('up');
    return k;
};
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { arrivalStaging } = await M('fidelityArrival.js');
const { buildStagedTape } = await M('botDriverV1.js');
const { moveRow } = await import('./move-search.mjs');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SPOT = arg('spot', '32,24');
// 'delivered' = the committed table (the move included); 'vanilla' = the table WITHOUT the L73 row (the runner at
// 72,24); 'x,y' = the table with the L73 row replaced by a move to (x, y)
const others = () => SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved');
export const patchesFor = (spot) => (spot === 'delivered' ? [...SEEDLING_SET_PATCHES] : spot === 'vanilla' ? others()
    : [...others(), moveRow(...spot.split(',').map(Number))]);
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, patchesFor(SPOT)));

const L74 = { level: 73, x: 64, y: 16 };
const L72 = { level: 73, x: 32, y: 128 };
export const CASES = {
    // criterion 3, south: from the L74 landing, Sword. Kill the runner when it comes round the r1c3 wall, break the
    // rock from above, kill the bulb, out by the L72 door.
    'l73s-sword': { boot: L74, items: ['hasSword'], script: [['to', 72, 40], ['keys', 'left', 1], ['fireEvery', 6, 12],
        ['keys', 'down', 1], ['fire'], ['wait', 24], ['to', 72, 60], ['fireEvery', 4, 12], ['go', 72, 88], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    // the same, but the bulb is NOT killed (its death writes lava under it, `Bulb.as:79`, which in the gap seals the
    // way down): lure it east first from the pocket's east end, then break, then walk out west past it (0.8 > 0.65)
    'l73s-sword-lure': { boot: L74, items: ['hasSword'], script: [['to', 72, 40], ['keys', 'left', 1], ['fireEvery', 6, 12],
        ['to', 100, 28], ['wait', Number(arg('lure', '90'))], ['to', 72, 40], ['keys', 'down', 1], ['fire'], ['wait', 24],
        ['to', 72, 72], ['go', 56, 88], ['go', 40, 120], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    // the bulb cannot be lured clear of the gap (it parks at x ≈ 91 under the wall), so: kill the runner, break the
    // rock, step back to (88,24) facing down and kill the bulb as it climbs into the pocket — its lava tile is then
    // r2c5, off the c4 column the way down uses
    'l73s-sword-bulb-up': { boot: L74, items: ['hasSword'], script: [['to', 72, 40], ['keys', 'left', 1], ['fireEvery', 6, 12],
        ['to', 72, 40], ['keys', 'down', 1], ['fire'], ['wait', 4], ['to', 88, 24], ['keys', 'down', 1], ['fireEvery', Number(arg('slashes', '8')), 12],
        ['to', 72, 40], ['to', 72, 72], ['go', 56, 88], ['go', 40, 120], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    // the bulb parks below-right of the gap (r4c5): kill it from the gap's east edge facing down, so its lava tile is
    // r4c5 and the c4 column stays open
    'l73s-sword-gap': { boot: L74, items: ['hasSword'], script: [['to', 72, 40], ['keys', 'left', 1], ['fireEvery', 6, 12],
        ['to', 72, 40], ['keys', 'down', 1], ['fire'], ['wait', Number(arg('w', '24'))], ['to', Number(arg('gx', '78')), Number(arg('gy', '56'))], ['keys', 'down', 1],
        ['fireEvery', Number(arg('slashes', '6')), 12], ['to', 72, 60], ['to', 72, 72], ['go', 56, 88], ['go', 40, 120], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    // drag the bulb EAST first (stand at r2c5 until it slides to x ≈ 88 under the wall), break from the gap's east
    // edge, then kill it from the gap facing down while its centre is past x 80: its lava tile is r4c5
    'l73s-sword-east': { boot: L74, items: ['hasSword'], script: [['to', 72, 40], ['keys', 'left', 1], ['fireEvery', 6, 12],
        ['to', Number(arg('ex', '88')), 40], ['wait', Number(arg('w1', '60'))], ['to', Number(arg('sx', '78')), 44], ['keys', 'down', 1], ['fire'],
        ['wait', Number(arg('w2', '20'))], ['to', 78, Number(arg('gy', '58'))], ['keys', 'down', 1], ['fireEvery', Number(arg('slashes', '4')), 12],
        ['to', 72, 60], ['to', 72, 72], ['go', 56, 88], ['go', 40, 120], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    // the Fire OBSERVATION (no rule change): the same shape with Fire (Fire cannot kill the runner, damage 0)
    'l73s-fire': { boot: L74, items: ['hasFire'], script: [['to', 72, 36], ['keys', 'down', 1], ['fire'], ['wait', 24],
        ['go', 72, 88], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    'l73s-fire-west': { boot: L74, items: ['hasFire'], script: [['to', 80, 24], ['to', 80, 36], ['keys', 'down', 1], ['fire'], ['wait', 24],
        ['go', 72, 88], ['go', 40, 136], ['keys', 'down', 40], ['wait', 20]] },
    'l73n-fire-bulb': { boot: L72, items: ['hasFire'], script: [['go', 72, 120], ['go', 40, 136], ['wait', 80], ['go', 72, 73], ['fire'], ['wait', 24],
        ['go', 72, 24], ['keys', 'up', 40], ['wait', 30]] },
};

const grids = new Map();
function gridOf(level) {
    if (grids.has(level)) return grids.get(level);
    const w = buildLevelWorld(levelSource(level), { roles: ROLES });
    const solid = new Set(w.solids.filter((x) => x.tag !== 'breakablerock').map((x) => `${Math.floor(x.rect.x / 16)},${Math.floor(x.rect.y / 16)}`));
    const g = new Set(w.tiles.filter((t) => !/Lava|Water|Pit/.test(t.name)).map((t) => `${t.tx},${t.ty}`).filter((k) => !solid.has(k)));
    grids.set(level, g);
    return g;
}

export function author(c0, { trace = false } = {}) {
    const c = { ...c0, script: c0.script.map((o) => [...o]) };
    const st = arrivalStaging(c.boot, { items: c.items });
    const run = createRunForStaging(JSON.parse(JSON.stringify(st)), levelSource, { scratchPersistence: true });
    const perTick = []; const log = []; let firstHit = null; let err = null;
    const snap = () => ({ t: perTick.length, level: run.level, x: +run.state.x.toFixed(2), y: +run.state.y.toFixed(2), hits: run.playerHits.length,
        chasers: (run.chasers ?? []).filter((b) => !b.destroy).map((b) => `${b.id}(${b.x.toFixed(1)},${b.y.toFixed(1)})${b.dying ? 'D' : ''}`) });
    const step = (k) => { perTick.push([...k]); run.advance(new Set(k)); if (firstHit === null && run.playerHits.length > 0) firstHit = perTick.length; if (trace) log.push(snap()); };
    try {
        for (const op of c.script) {
            if (run.level !== c.boot.level) break;
            if (op[0] === 'wait') { for (let i = 0; i < op[1]; i++) step([]); continue; }
            if (op[0] === 'keys') { for (let i = 0; i < op[2]; i++) step(op[1].split('+')); continue; }
            if (op[0] === 'fire') { step(['primary']); continue; }
            if (op[0] === 'fireEvery') { for (let i = 0; i < op[1]; i++) { step(['primary']); for (let j = 1; j < op[2]; j++) step([]); } continue; }
            if (op[0] === 'go') {
                const g = gridOf(run.level);
                const from = `${Math.floor(run.state.x / 16)},${Math.floor(run.state.y / 16)}`;
                const goal = `${Math.floor(op[1] / 16)},${Math.floor(op[2] / 16)}`;
                const prev = new Map([[from, null]]); const q = [from];
                while (q.length) { const cc = q.shift(); if (cc === goal) break; const [cx, cy] = cc.split(',').map(Number);
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${cx + dx},${cy + dy}`; if (g.has(k) && !prev.has(k)) { prev.set(k, cc); q.push(k); } } }
                if (!prev.has(goal)) throw new Error(`go: no tile path ${from} -> ${goal}`);
                const path = []; for (let cc = goal; cc; cc = prev.get(cc)) path.unshift(cc);
                const way = path.slice(1, -1).map((cc) => cc.split(',').map((v) => Number(v) * 16 + 8));
                c.script.splice(c.script.indexOf(op) + 1, 0, ...way.map(([x, y]) => ['to', x, y]), ['to', op[1], op[2]]);
                continue;
            }
            if (op[0] === 'to') {
                let best = Infinity; let stall = 0;
                for (let n = 0; n < 900; n++) {
                    if (run.level !== c.boot.level) break;
                    const k = keysToward(run.state.x, run.state.y, op[1], op[2]);
                    if (!k.length) break;
                    step(k);
                    const d = Math.hypot(run.state.x - op[1], run.state.y - op[2]);
                    if (d < best - 0.05) { best = d; stall = 0; } else if (++stall > 30) break;
                }
                if (trace) console.error('TO', JSON.stringify(op), '->', JSON.stringify(snap()));
            }
        }
    } catch (e) { err = String(e.message).split('\n')[0].slice(0, 300); }
    return { st, perTick, log, model: { ticks: perTick.length, end: snap(), firstHit, refusal: err,
        hitBy: run.playerHits.map((h) => `${h.id ?? h.source}@${h.t}`), rocks: (run.rocksBroken ?? []).map((k) => `${k.id}`) } };
}

export function tapeOf(a, name, note) {
    const tape = buildStagedTape({ staging: a.st, perTick: [...a.perTick.map((k) => new Set(k)), ...Array.from({ length: 8 }, () => new Set())], name });
    return { ...tape, description: `rules-landing-contact-census: ${name} (hand script on the room with the runner at ${SPOT}${note ? `; ${note}` : ''})` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const names = arg('case') ? arg('case').split(',') : Object.keys(CASES);
    const dir = arg('build');
    if (dir) mkdirSync(dir, { recursive: true });
    for (const n of names) {
        const a = author(CASES[n], { trace: process.argv.includes('--trace') });
        console.log('MODEL', SPOT, n, JSON.stringify(a.model));
        if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % Number(arg('every', '5')) === 0) console.error(JSON.stringify(s));
        if (dir) writeFileSync(join(dir, `${n}@${SPOT.replace(',', '-')}.tape.json`), JSON.stringify(tapeOf(a, `${n}@${SPOT}`)));
    }
}
