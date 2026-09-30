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
 *   3. the route's own arrival CANNOT enter it: the lane admits x = 126.000
 *      only, the walk to the stance arrives at x = 125.97137961649308, and no
 *      x-input sequence lands on 126 from there — refused BY NAME (the U1 STOP).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, ROLES } from './levelWorld.js';
import { fallTrapPresser, solveSegment } from './solverBot.js';

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

    it('from the ROUTE\'s arrival (16,224): the stance is reached at a sub-pixel x the lane cannot take — refused BY NAME', () => {
        const { run, boot } = l29Run(16, 224);
        expect(() => solveSegment({ run, goals: GOALS.map((g) => ({ ...g })), name: 'u1-skirt-route', boot }))
            .toThrow(/skirt \(button@112,128, east lane x=126\): no x-input sequence of at most 16 ticks takes the stance state \(x=125\.97137961649308, vx=0\) EXACTLY onto x=126 at rest/);
        expect(run.rockFalls).toEqual([]);
    });
});
