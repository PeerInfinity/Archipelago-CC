/**
 * seedlingDemo/hammerBombPhase.test — ⛓⛓ SEEDLING HAMMER-PHASE 376-BOMB: A WALK THAT MEETS A LOBBER'S BOMB WAITS OUT
 * THE BOMB'S PHASE (`BOMB_PHASE_WAIT`, OFF). ⚖ The user queued the slice on 2026-11-07 ("Yes, hammer slice
 * (Recommended)"). The fast rows: the switch, its env name, and the two pricing pieces it adds (the arrival tail and the
 * bombs-only tail sample). The leg rows (leg 376 at hammer phase 23 solved hitless ON, OFF unchanged) are the train
 * tier's (`hammerBombPhase.train.test.js`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { BOMB } from './bombPusher.js';
import { atlasLevelSource } from './levelSource.js';
import {
    BOMB_PHASE_WAIT, BOMB_PHASE_WAIT_DEFAULT, PACE, bombArrivalTail, previewWalk, withBombPhaseWait,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { createRunForStaging } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'hammer-376-bomb');
const ENV = globalThis.process?.env ?? {};
const LEG376 = JSON.parse(gunzipSync(readFileSync(join(FIX, 'leg376-l40-request.json.gz'))).toString('utf8'));

/** The fixture's own run, its tape prefix replayed: the player in L40 at the arrival, the lobber live. */
function arrivalRun() {
    const req = restoreRequest(LEG376.request);
    const run = createRunForStaging(req.staging, atlasLevelSource(), { scratchPersistence: req.scratchPersistence === true });
    for (const k of req.perTick) run.advance(k);
    return run;
}

describe('hammer-phase 376-BOMB — the switch', () => {
    it('ships OFF, read from SEEDLING_BOMB_PHASE_WAIT, and is a name the solver-env channel carries', () => {
        expect(BOMB_PHASE_WAIT_DEFAULT).toBe(false);
        expect(BOMB_PHASE_WAIT.enabled).toBe(ENV.SEEDLING_BOMB_PHASE_WAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_BOMB_PHASE_WAIT');
        expect(withBombPhaseWait(true, () => BOMB_PHASE_WAIT.enabled)).toBe(true);
        expect(withBombPhaseWait(false, () => BOMB_PHASE_WAIT.enabled)).toBe(false);
    });

    it('its bounds are the game\'s: one bomb period of still ticks, a bomb\'s whole flight of arrival tail', () => {
        // `BombPusher`: a launch every 46 ticks in range (`bombPusher.js`, measured on the game)
        expect(BOMB_PHASE_WAIT.maxStill).toBe(46);
        // `Bomb`: tMax updates onto the aim, the 31st moves once more and explodes
        expect(BOMB_PHASE_WAIT.arrivalTicks).toBe(BOMB.tMax + 1);
        expect(BOMB.explosionHitRadius).toBe(15);
        // the paced arm covers two bomb periods with whole MOVING_WAIT cycles
        expect(BOMB_PHASE_WAIT.paceTicks).toBe(2 * 46);
        expect(PACE.spans.length).toBeGreaterThan(0);
    });
});

describe('hammer-phase 376-BOMB — the arrival tail', () => {
    it('OFF: no tail (the walk is priced as before)', () => {
        const run = arrivalRun();
        expect(withBombPhaseWait(false, () => bombArrivalTail(run))).toBe(null);
    });

    it('ON in L40 (the lobber live): a 31-tick still tail, bombs only; none for a walk that crosses', () => {
        const run = arrivalRun();
        expect(run.level).toBe(40);
        expect((run.entities('bombPushers') ?? []).map((b) => b.id)).toEqual(['bombpusher@112,128']);
        const tail = withBombPhaseWait(true, () => bombArrivalTail(run));
        expect(tail.ticks).toBe(31);
        expect(tail.bombsOnly).toBe(true);
        expect([...tail.keys()({})]).toEqual([]);
        expect(withBombPhaseWait(true, () => bombArrivalTail(run, { crossTo: { level: 42 } }))).toBe(null);
    });

    it('the tail\'s samples are stamped `bombsOnly` (`standBombsOnly`), and only then', () => {
        const run = arrivalRun();
        const to = [{ x: run.state.x, y: run.state.y + 8 }];
        const keys = () => () => new Set();
        const plain = previewWalk(run, to, 2, { standFor: 4, standKeys: keys });
        const marked = previewWalk(run, to, 2, { standFor: 4, standKeys: keys, standBombsOnly: true });
        const dwell = (w) => w.samples.filter((s) => s.phase === 'dwell');
        expect(dwell(plain).length).toBe(4);
        expect(dwell(plain).every((s) => s.bombsOnly === undefined)).toBe(true);
        expect(dwell(marked).every((s) => s.bombsOnly === true)).toBe(true);
        // the transit is the same walk either way
        const transit = (w) => w.samples.filter((s) => s.phase !== 'dwell').map((s) => [s.x, s.y, s.tick]);
        expect(transit(marked)).toEqual(transit(plain));
    });
});
