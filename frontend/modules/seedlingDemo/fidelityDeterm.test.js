/**
 * ⛓ SEEDLING FIDELITY DETERM — the determinism bundle (wave 33).
 *
 * (a) L69's flier sequence. `lightBoss.js` numbered its fliers from a MODULE-level counter, so a second L69 run in one
 *     process numbered them 7..12 and `stateDigest`'s `visit` part (`lightsFights`) differed from the first run's from
 *     the first spawn on (G10's finding: tick 43 of `lights-witness/lights-solve-sword`). The ordinal is now the fight's
 *     own (`bodies.length + 1`); a fork's clone carries `bodies`, so it continues the same ordinal.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGHT_BOSS, cloneLightsFight, createLightsFight, stepLightsController } from './lightBoss.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witnessTape = (path) => JSON.parse(readFileSync(join(HERE, 'fixtures', `${path}.json`), 'utf8')).tape;

/** A fight past its intro, stepped once: the controller spawns its fliers. */
function spawned() {
    const fight = createLightsFight({ x: 72, y: 72, flierNum: 6, tag: 0 });
    fight.introUp = false;
    stepLightsController(fight, { time: 100 });
    return fight;
}

describe('DETERM (a) — the L69 flier ordinal is the fight\'s, not the module\'s', () => {
    it('two fights in one process number their fliers 1..6 each', () => {
        const a = spawned();
        const b = spawned();
        expect(a.fliers.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(b.fliers.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(LIGHT_BOSS.controller.spawnY).toBeTypeOf('number');
    });

    it('a fork clone carries the ordinal: same seqs, and its fliers resolve to its own bodies', () => {
        const a = spawned();
        a.fliers.splice(2, 1);
        const c = cloneLightsFight(a);
        expect(c.fliers.map((f) => f.seq)).toEqual([1, 2, 4, 5, 6]);
        for (const f of c.fliers) expect(c.bodies).toContain(f);
        expect(c.bodies.map((f) => f.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('lights-solve-sword replayed twice in one process: stateDigest equal EVERY tick', () => {
        const once = () => {
            const digests = [];
            runTape(witnessTape('lights-witness/lights-solve-sword'), {
                levelSource: atlasLevelSource(),
                onTick: (t, now, held, run) => { digests.push(JSON.stringify(run.stateDigest())); },
            });
            return digests;
        };
        const r1 = once();
        const r2 = once();
        expect(r1.length).toBeGreaterThan(43);
        const first = r1.findIndex((d, i) => d !== r2[i]);
        expect(first, `the two runs' stateDigest first differs at tick index ${first}`).toBe(-1);
        expect(r2.length).toBe(r1.length);
    }, 240_000);
});
