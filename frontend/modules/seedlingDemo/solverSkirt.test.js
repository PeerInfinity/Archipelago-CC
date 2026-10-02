/**
 * ⛓⛓ SEEDLING SWIM U1, D2 — THE `skirt` VERB: walk PAST a stand-on presser
 * whose press only drops a rock (L29's `button@112,128` → `fallrock@112,112`).
 *
 * Three claims, each its own row:
 *   1. the PREDICATE is the narrowest one that names L29 — over the whole atlas
 *      it answers exactly L29's and L74's buttons, so every other button (L4's
 *      and L5's openers among them) keeps `hold`;
 *   2. the PASS works where the lane can be entered: from a boot ON the east
 *      lane the solve skirts, collects the Green Key and leaves the rock
 *      standing, with no press and no hit;
 *   3. the route's own arrival ENTERS it (⛓ SEEDLING SWIM U2, D1). The lane
 *      admits x = 126.000 only; U1's string-pulled walk held `right+up` from
 *      t=13, diagonal friction took x off the 0.05 grid at t=14, and the stance
 *      was reached at x = 125.97137961649308, which no x-input sequence can
 *      move onto 126 (the U1 STOP). The stance walk is now AXIS-ALIGNED
 *      (`planWaypoints`' `manhattan` + `holdOneAxis`), so x reaches the stance
 *      on the grid and the x-only alignment lands the lane.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, ROLES } from './levelWorld.js';
import { fallTrapPresser, solveSegment } from './solverBot.js';
import { holdOneAxis } from './botDriverV2.js';

const TAPE = new URL('./fixtures/tapes/r8-solve-11.json', import.meta.url);
const GOALS = Object.freeze([
    { kind: 'collect-placement', placement: { x: 112, y: 64 } },
    { kind: 'reach-exit', exit: { x: 112, y: 32 } },
]);

/** The survey's staged construction: `r8-solve-11` re-pointed at L29. */
function l29Run(x, y) {
    const staging = solveStaging(stagingFromTape(parseTape(JSON.parse(readFileSync(TAPE, 'utf8')))));
    staging.boot = { level: 29, x, y };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return { run: createRunForStaging(staging, atlasLevelSource()), boot: staging.boot };
}

describe('skirt — the predicate (a trap presser)', () => {
    it('over all 116 levels, exactly L29\'s and L74\'s buttons are traps; every other button keeps `hold`', () => {
        const source = atlasLevelSource();
        const traps = [];
        let buttons = 0;
        for (let n = 0; n < 116; n += 1) {
            const world = buildLevelWorld(source(n), { roles: ROLES });
            for (const p of world.pressers ?? []) {
                if (p.tag !== 'button') continue;
                buttons += 1;
                const id = `button@${p.x},${p.y}`;
                const trap = fallTrapPresser({ world }, { kind: 'proximity-hazard', tag: 'button', id });
                if (trap) traps.push(`L${n} ${id} -> [${trap.rocks.join(', ')}]`);
            }
        }
        // ⛔ THE POPULATION FIRST: a predicate that answered nothing would pass the pair below.
        expect(buttons).toBeGreaterThan(2);
        expect(traps).toEqual([
            'L29 button@112,128 -> [fallrock@112,112]',
            'L74 button@288,128 -> [fallrock@288,144]',
        ]);
    });
});

describe('skirt — L29, the pass', () => {
    it('from a boot ON the east lane (spawn 126,152): skirts in 28 t, collects the key, the rock stands, crosses at 150', () => {
        const { run, boot } = l29Run(118, 144);
        const out = solveSegment({ run, goals: GOALS.map((g) => ({ ...g })), name: 'u1-skirt', boot });
        expect(out.perTick.length).toBe(150);
        expect(run.transitions).toEqual([{ t: 150, from_level: 29, to_level: 31 }]);
        expect(out.records[0]).toMatchObject({
            strategy: 'skirt', target: 'button@112,128', lane: 'east', x: 126, from: 0, ticks: 28,
            rocksStanding: ['fallrock@112,112'],
        });
        expect(out.records[1]).toMatchObject({ strategy: 'collect', pickup: { tag: 'bosskey' } });
        expect([...run.progress('keys')]).toEqual([1]);
        // ⛔ The pair: the run's own rock ledger is EMPTY, and the run was one that
        // would have written it (T3's arm is live in L29 — `fallRockButton.test.js`).
        expect(run.rockFalls).toEqual([]);
        expect(run.playerHits).toEqual([]);
        expect(out.trace.rows[0]).toMatchObject({ obstacle: { id: 'button@112,128' },
            strategy: { verb: 'skirt' } });
    });

    it('from the ROUTE\'s arrival (16,224): an axis-aligned approach keeps x on the 0.05 grid, and the solve SKIRTS, collects the key and crosses at 379 (383 before swim U15\'s spit DODGE)', () => {
        const { run, boot } = l29Run(16, 224);
        const trail = [];
        const advance = run.advance.bind(run);
        run.advance = (held) => {
            const r = advance(held);
            trail.push({ held: [...held], x: run.state.x, vx: run.state.vx, vy: run.state.vy });
            return r;
        };
        const out = solveSegment({ run, goals: GOALS.map((g) => ({ ...g })), name: 'u2-skirt-route', boot });
        // ⛓ swim U15: 383 → 379 — L29's turrets are stepped now and the solve DODGES their
        // spit (a stall at walk-offset 183), which also shortens the walk by 4 ticks.
        expect(out.perTick.length).toBe(379);
        expect(run.transitions).toEqual([{ t: 379, from_level: 29, to_level: 31 }]);
        expect(out.records[0]).toMatchObject({
            strategy: 'skirt', target: 'button@112,128', lane: 'east', x: 126, from: 211, ticks: 38,
            rocksStanding: ['fallrock@112,112'],
        });
        expect(out.records[1]).toMatchObject({ strategy: 'collect', pickup: { tag: 'bosskey', x: 112, y: 64 } });
        expect(out.records[2]).toMatchObject({ goal: 'reach-exit', to: 31, t: 379 });
        expect([...run.progress('keys')]).toEqual([1]);
        expect(run.rockFalls).toEqual([]);
        expect(run.playerHits).toEqual([]);
        // ⛔ THE DISCIPLINE, tick by tick over the approach and the skirt: never two
        // axes held, never two axes moving, and x on the 0.05 grid at the stance.
        const approach = trail.slice(0, 211 + 38);  // ⛓ swim U15: the skirt starts at 211 (215 before)
        const X = ['left', 'right'];
        const Y = ['up', 'down'];
        expect(approach.filter((r) => r.held.some((k) => X.includes(k))
            && r.held.some((k) => Y.includes(k)))).toEqual([]);
        expect(approach.filter((r) => r.vx !== 0 && r.vy !== 0)).toEqual([]);
        const stanceX = trail[214].x;
        expect(Math.abs(stanceX * 20 - Math.round(stanceX * 20))).toBeLessThan(1e-9);
        expect(trail[211 + 10 - 1].x).toBe(126);
    });

    it('`holdOneAxis`: a moving axis keeps the keys, a resting one loses them; from rest the farther axis wins', () => {
        const at = (vx, vy) => ({ x: 0, y: 0, vx, vy });
        const both = new Set(['right', 'up', 'primary']);
        expect([...holdOneAxis(both, at(0.8, 0), { x: 1, y: -50 })]).toEqual(['right', 'primary']);
        expect([...holdOneAxis(both, at(0, -0.8), { x: 50, y: -1 })]).toEqual(['up', 'primary']);
        expect([...holdOneAxis(both, at(0, 0), { x: 50, y: -1 })]).toEqual(['right', 'primary']);
        expect([...holdOneAxis(both, at(0, 0), { x: 1, y: -50 })]).toEqual(['up', 'primary']);
        // a y key while x still coasts waits for x to stop
        expect([...holdOneAxis(new Set(['up']), at(0.3, 0), { x: 0, y: -50 })]).toEqual([]);
        const one = new Set(['left']);
        expect(holdOneAxis(one, at(0, 0), { x: -9, y: 9 })).toBe(one);
    });
});
