/**
 * ⛓⛓⛓ SEEDLING FIDELITY KNOCKBACK376 (wave 37c) — sweep leg 376 (L40 Totem Part 64,144 from L42): the game does not
 * follow the planned hit's knockback past `breakablerock@176,128`. Measured (W0): the knockback is exact; the rock's
 * cell opened two observations early in the model. Key `rockGoneFencepost` (D1, OFF): `brokenRockIds` lags the solid
 * past `goneAt` (`endAnim`'s update, unchanged) by `ROCK_GONE_FENCEPOST_TICKS` (2). The witnesses are recorded on the game
 * (`fixtures/rockgone-witness/`, p4g headless, 0 px): two short tapes (`probe-seedling-rock-gone.mjs --record`) and
 * the leg's own captured play (`probe-seedling-contact-divergence.mjs --capture`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    HIT_TO_GONE_TICKS, ROCK_GONE_FENCEPOST_TICKS, brokenRockIds, createRockState, hitRock,
} from './breakableRocks.js';
import {
    ROCKGONE_TAPES, ROCKGONE_WITNESS_DIR, compareRockGoneWitness, firstMoveAfter, firstTestAfter, replayLegWitness,
    rockGoneModelSamples, rockGoneTape, unpackRockGoneSample,
} from './fidelityRockGone.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const recorded = (name) => {
    const w = JSON.parse(readFileSync(join(ROCKGONE_WITNESS_DIR, `${name}.json`), 'utf8'));
    return { ...w, game: w.samples.map(unpackRockGoneSample) };
};
const legWitness = () => JSON.parse(gunzipSync(readFileSync(join(ROCKGONE_WITNESS_DIR, 'rockgone-leg376-play.json.gz'))));

describe('KNOCKBACK376 — the switch', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_ROCK_GONE_FENCEPOST)(
        'D1 ships ON (⚖ user 2026-11-05 "Flip + re-record"), last in the defaults', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.rockGoneFencepost).toBe(true);
            expect(CONTACT_FIDELITY.rockGoneFencepost).toBe(true);
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).at(-1)).toBe('rockGoneFencepost');
        });
    it('the env name is a known worker env name', () => {
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_ROCK_GONE_FENCEPOST');
    });
});

describe('KNOCKBACK376 D1 — the lag', () => {
    it('`goneAt` keeps the animation\'s 7; the solid outlives it by the two fenceposts', () => {
        expect(HIT_TO_GONE_TICKS).toBe(7);
        expect(ROCK_GONE_FENCEPOST_TICKS).toBe(2);
    });
    it('`brokenRockIds` takes the lag as an option; without it, the OFF arithmetic', () => {
        const rock = { rockId: 'breakablerock@176,128', persistTag: 22, rockType: 0, x: 176, y: 128 };
        const st = createRockState();
        expect(hitRock(st, rock, 11).goneAt).toBe(18);
        expect(brokenRockIds(st, 17).size).toBe(0);
        expect(brokenRockIds(st, 18).has(rock.rockId)).toBe(true);
        expect(brokenRockIds(st, 19, { lag: ROCK_GONE_FENCEPOST_TICKS }).size).toBe(0);
        expect(brokenRockIds(st, 20, { lag: ROCK_GONE_FENCEPOST_TICKS }).has(rock.rockId)).toBe(true);
    });
});

describe('KNOCKBACK376 D1 — the short game witnesses (p4g, 0 px)', () => {
    for (const name of Object.keys(ROCKGONE_TAPES)) {
        it(`${name}: the recorded tape is the one the module builds`, async () => {
            const w = recorded(name);
            expect(w.tape).toEqual(await rockGoneTape(name));
        });
        it(`${name}: the game = the model with the key ON at 0 px, the cell opening on the game's observation`, async () => {
            const w = recorded(name);
            const on = await withContactFidelity({ rockGoneFencepost: true }, () => rockGoneModelSamples(w.tape));
            expect(on.error).toBe(null);
            expect(compareRockGoneWitness(w.game, on.samples, w.tape.tick_count)).toEqual([]);
            const last = Math.max(...ROCKGONE_TAPES[name].presses);
            const gameOpen = firstMoveAfter(w.game, last + 1);
            expect(firstMoveAfter(on.samples.filter(Boolean), last + 1)).toBe(gameOpen);
            const rock = on.samples.at(-1).rocks.find((r) => r.id === 'breakablerock@176,128');
            // The game's swing counter shows the first test on the observation after the model's `hitTick`; `goneAt`
            // is unchanged ON (`hitTick + 7`), and the cell opens on `goneAt + 2`.
            expect(firstTestAfter(w.game, last)).toBe(rock.hitTick + 1);
            expect(rock.goneAt).toBe(rock.hitTick + HIT_TO_GONE_TICKS);
            expect(gameOpen).toBe(rock.goneAt + ROCK_GONE_FENCEPOST_TICKS);
        });
        it(`${name}: OFF, the model frees the cell two observations before the game`, async () => {
            const w = recorded(name);
            const off = await withContactFidelity({ rockGoneFencepost: false }, () => rockGoneModelSamples(w.tape));
            const last = Math.max(...ROCKGONE_TAPES[name].presses);
            expect(firstMoveAfter(off.samples.filter(Boolean), last + 1)).toBe(firstMoveAfter(w.game, last + 1) - 2);
            expect(compareRockGoneWitness(w.game, off.samples, w.tape.tick_count).length).toBeGreaterThan(0);
        });
    }
    it('the witnesses\' expected numbers: plain opens on observation 20 (hit 11), dash on 18 (hit 9)', () => {
        expect(firstMoveAfter(recorded('rockgone-l40-plain').game, 11)).toBe(20);
        expect(firstMoveAfter(recorded('rockgone-l40-dash').game, 9)).toBe(18);
    });
});

describe('KNOCKBACK376 D1 — the leg\'s own play (sweep leg 376, the 1565-tick full-pass plan; p4g, 0 px)', () => {
    it('the witness is leg 376 at seam 5271 with one planned hit and 1259 sampled game ticks', () => {
        const w = legWitness();
        expect(w.leg.key).toBe('level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144');
        expect(w.seam).toBe(5271);
        expect(w.plan.solution.length).toBe(1565);
        expect(w.samples.length).toBe(1259);
    });
    it('ON: the model replays the plan = the game on every sampled tick (x, y, vx, vy, hits, hits_timer)', async () => {
        const r = await withContactFidelity({ rockGoneFencepost: true }, () => replayLegWitness(legWitness(), { restore: restoreRequest }));
        expect(r).toEqual({ compared: 1259, firstDiff: null });
    });
    it('OFF: the first difference is t1256, player.x — game 194.673 (still pinned), model 191.593 (through the cell)', async () => {
        const r = await withContactFidelity({ rockGoneFencepost: false }, () => replayLegWitness(legWitness(), { restore: restoreRequest }));
        expect(r.firstDiff).toMatchObject({ t: 1256, field: 'player.x' });
        expect(r.firstDiff.game).toBeCloseTo(194.673376995835, 9);
        expect(r.firstDiff.model).toBeCloseTo(191.59297027375132, 9);
    });
});
