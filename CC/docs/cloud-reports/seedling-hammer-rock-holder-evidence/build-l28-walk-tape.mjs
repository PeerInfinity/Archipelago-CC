// Builds the game-witness tapes for slice ROCK-HOLDER: L28 from (136,296) — re-measure-2 Arm A′'s arrival — north
// through grasslock@176,208's tile (11,13) — on rules-6's grid the only way to the L30 door (19,1).
//
// The model cannot plan it (it reads the lock closed: the fallen rock is not a presser there), so the tape is steered
// by hand: a BFS tile path on the model's own `collidesSolid` grid with the lock tile opened, followed greedily, closed
// loop against the model up to the tile below the lock (leg A); then a straight `up` hold over the lock tile (the
// crossing); then leg B, steered closed loop against a model booted just north of the lock. Two tapes, ONE input list:
//   l28-rock-holder-walk      persistence {28,0} + {28,1} cleared (the rope cut, the rock fallen — Arm A′'s state)
//   l28-rock-holder-control   nothing cleared (rope up, rock parked, the button bare)
// Writes <evidence>/tapes/<name>.json and prints the model's own trace of each leg.
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/build-l28-walk-tape.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { DEFAULT_LATTICE, nodeCentre, planTilePath } from '../../../../frontend/modules/seedlingDemo/botDriverV2.js';
import { buildStagedTape } from '../../../../frontend/modules/seedlingDemo/botDriverV1.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const BOOT = { level: 28, x: 128, y: 288 }; // → run.state (136,296), Arm A′'s arrival
const LOCK = { tx: 11, ty: 13 };
const items = ['hasSword'];
const mk = (boot, cleared) => createRunForStaging(arrivalStaging(boot, { items, cleared }), SRC);

// ── the bot's own tile planner (`botDriverV2.planTilePath`), one leg either side of the lock's tile
const probe = mk(BOOT, [0, 1]);
const w = probe.worldFor(28);
const P = DEFAULT_LATTICE;
const centreOf = (tx, ty) => nodeCentre(tx, ty, P);
const below = centreOf(LOCK.tx, LOCK.ty + 1);
const above = centreOf(LOCK.tx, LOCK.ty - 1);
const pathA = planTilePath(w, { x: probe.state.x, y: probe.state.y }, below, null, { snapStart: true });
const key = (t) => `${t.tx},${t.ty}`;
console.log(`leg A tiles: ${pathA.map(key).join(' ')}`);
const centre = (t) => centreOf(t.tx, t.ty);

// ── greedy closed-loop steering against a model run
function steer(run, waypoints, { maxPer = 200, tol = 3, lastTol = 1.5 } = {}) {
    // `tol` px for a passing waypoint, `lastTol` for the leg's last; a tick presses an axis only while it is more than
    // 1 px off (the player accelerates, so a tighter dead band oscillates).
    const ticks = [];
    for (const [i, wp] of waypoints.entries()) {
        const c = centre(wp);
        const t = i === waypoints.length - 1 ? lastTol : tol;
        let n = 0;
        while (Math.abs(run.state.x - c.x) > t || Math.abs(run.state.y - c.y) > t) {
            if (run.level !== 28) return { ticks, left: true };
            if (++n > maxPer) return { ticks, stuck: { wp: key(wp), x: run.state.x, y: run.state.y, hits: run.damage.hits } };
            const s = new Set();
            const dx = c.x - run.state.x, dy = c.y - run.state.y;
            if (dx > 1) s.add('right'); else if (dx < -1) s.add('left');
            if (dy > 1) s.add('down'); else if (dy < -1) s.add('up');
            run.advance(s);
            ticks.push(s);
        }
    }
    return { ticks };
}

// leg A: boot → the tile below the lock
const runA = mk(BOOT, [0, 1]);
const legA = steer(runA, pathA);
if (legA.stuck) throw new Error(`leg A stuck: ${JSON.stringify(legA.stuck)}`);
const ySpeed = (() => { // px per held tick, measured on leg A's own straight runs
    const r = mk(BOOT, [0, 1]); const y0 = r.state.y; r.advance(new Set(['up'])); r.advance(new Set(['up']));
    return Math.abs(r.state.y - y0) / 2 || 1;
})();
// the model's view of the crossing: does `up` move the player into the lock tile? (it should NOT — lock closed)
const crossTicks = Math.ceil((below.y - above.y) / ySpeed);
const crossing = Array.from({ length: crossTicks }, () => new Set(['up']));
const yBefore = runA.state.y;
for (let i = 0; i < crossTicks + 24; i += 1) runA.advance(new Set(['up']));
console.log(JSON.stringify({ legA: legA.ticks.length, at: below, ySpeed, crossTicks,
    modelCrossing: { yBefore, yAfter: runA.state.y, hits: runA.damage.hits } }));
// The crossing is held 24 ticks past the 32 px it needs, so a game player through the lock ends well north of it.
for (let i = 0; i < 24; i += 1) crossing.push(new Set(['up']));
const perTick = [...legA.ticks, ...crossing, ...Array.from({ length: 10 }, () => new Set())];

mkdirSync(join(HERE, 'tapes'), { recursive: true });
for (const [name, cleared] of [['l28-rock-holder-walk', [0, 1]], ['l28-rock-holder-control', []]]) {
    const staging = arrivalStaging(BOOT, { items, cleared });
    const tape = buildStagedTape({ staging, perTick, name });
    tape.description = `seedling-hammer-rock-holder: L28 (8,18) → grasslock@176,208 → L30 door (19,1), `
        + `persistence ${JSON.stringify(cleared)} (build-l28-walk-tape.mjs)`;
    writeFileSync(join(HERE, 'tapes', `${name}.json`), `${JSON.stringify(tape, null, 1)}\n`);
    console.log(`wrote tapes/${name}.json (${perTick.length} ticks; the up hold starts at tick ${legA.ticks.length})`);
}
