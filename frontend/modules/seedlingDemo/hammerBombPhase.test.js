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
    BOMB_PHASE_WAIT, BOMB_PHASE_WAIT_DEFAULT, PACE, bombArrivalTail, bombsOnlyDanger, previewWalk, withBombPhaseWait,
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
        expect(BOMB_PHASE_WAIT_DEFAULT).toBe(true); // ⚖ ON in the L40 flip (hammer L40-FLIP-BUILD)
        expect(BOMB_PHASE_WAIT.enabled).toBe(ENV.SEEDLING_BOMB_PHASE_WAIT !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_BOMB_PHASE_WAIT');
        expect(withBombPhaseWait(true, () => BOMB_PHASE_WAIT.enabled)).toBe(true);
        expect(withBombPhaseWait(false, () => BOMB_PHASE_WAIT.enabled)).toBe(false);
    });

    it('its bounds are the game\'s: one bomb period of still ticks; the escape reaches the blast disc at tick 12', () => {
        // `BombPusher`: a launch every 46 ticks in range (`bombPusher.js`, measured on the game)
        expect(BOMB_PHASE_WAIT.maxStill).toBe(46);
        // from rest, the farthest reach per tick (measured, `up+left` on L40): the disc's 15 px at k = 12
        const reach = BOMB_PHASE_WAIT.escapeReach;
        expect(reach.length).toBe(13);
        expect(reach[0]).toBe(0);
        expect(reach.at(-1)).toBe(BOMB.explosionHitRadius);
        expect(reach.slice(0, -1).every((r) => r < BOMB.explosionHitRadius)).toBe(true);
        expect(reach.every((r, k) => k === 0 || r > reach[k - 1])).toBe(true);
        expect(BOMB.explosionHitRadius).toBe(15);
        // the paced arm covers two bomb periods with whole MOVING_WAIT cycles
        expect(BOMB_PHASE_WAIT.paceTicks).toBe(2 * 46);
        expect(PACE.spans.length).toBeGreaterThan(0);
    });
});

describe('hammer-phase 376-BOMB — the stance tail', () => {
    it('OFF: no tail (the walk is priced as before)', () => {
        const run = arrivalRun();
        expect(withBombPhaseWait(false, () => bombArrivalTail(run, { standTicks: 22 }))).toBe(null);
    });

    it('ON in L40 (the lobber live): the verb\'s still ticks + 12, bombs only; none without a stand or across a door', () => {
        const run = arrivalRun();
        expect(run.level).toBe(40);
        expect((run.entities('bombPushers') ?? []).map((b) => b.id)).toEqual(['bombpusher@112,128']);
        // the frontier's break: aim + press + WAIT_AFTER_PRESS_TICKS (20)
        const tail = withBombPhaseWait(true, () => bombArrivalTail(run, { standTicks: 22 }));
        expect(tail.ticks).toBe(34);
        expect(tail.bombsOnly).toBe(22);
        expect([...tail.keys()({})]).toEqual([]);
        expect(withBombPhaseWait(true, () => bombArrivalTail(run))).toBe(null);
        expect(withBombPhaseWait(true, () => bombArrivalTail(run, { standTicks: 22, crossTo: { level: 42 } }))).toBe(null);
    });

    it('a `bombsOnly` sample answers for its bombs alone (`bombsOnlyDanger`, what the probe asks of it)', () => {
        const bomb = { kind: 'bomb', id: 'bombpusher@112,128#13' };
        const chaser = { kind: 'chaser', id: 'bob@272,112' };
        expect(bombsOnlyDanger({ danger: true, sources: [chaser, bomb] })).toEqual({ danger: true, sources: [bomb] });
        // a tail sample a chaser reaches but no bomb does is clean for this question (the next verb prices the chaser)
        expect(bombsOnlyDanger({ danger: true, sources: [chaser] })).toEqual({ danger: false, sources: [] });
        const clean = { danger: false, sources: [] };
        expect(bombsOnlyDanger(clean)).toBe(clean);
    });

    it('past the stand, a blast counts only where no move off the stance clears its disc', () => {
        const bomb = { kind: 'bomb', id: 'bombpusher@112,128#13' };
        // leg 376 phase 23: #13 at (207,141), the stance (199.56,135.57) — 9.4 px; 2 ticks after the stand
        const spit = { kind: 'bomb', id: bomb.id, x: 207, y: 141, radius: 15 };
        const at = (escape, x = 199.56, y = 135.57) => ({ x, y, escape, spits: [spit], bombsOnly: true });
        const hit = { danger: true, sources: [bomb] };
        expect(bombsOnlyDanger(hit, at(0)).danger).toBe(true);
        expect(bombsOnlyDanger(hit, at(2)).danger).toBe(true); // 9.4 + 3.1 <= 15
        expect(bombsOnlyDanger(hit, at(5)).danger).toBe(false); // 9.4 + 7.7 > 15: a move clears it
        // a blast on the stance itself holds until the reach is the radius
        expect(bombsOnlyDanger(hit, at(11, 207, 141)).danger).toBe(true);
        expect(bombsOnlyDanger(hit, at(12, 207, 141)).danger).toBe(true); // 0 + 15.0 <= 15
    });

    it('the tail\'s samples are stamped `bombsOnly` (`standBombsOnly`), and only then', () => {
        const run = arrivalRun();
        const to = [{ x: run.state.x, y: run.state.y + 8 }];
        const keys = () => () => new Set();
        const plain = previewWalk(run, to, 2, { standFor: 4, standKeys: keys });
        const marked = previewWalk(run, to, 2, { standFor: 4, standKeys: keys, standBombsOnly: 2 });
        const dwell = (w) => w.samples.filter((s) => s.phase === 'dwell');
        expect(dwell(plain).length).toBe(4);
        expect(dwell(plain).every((s) => s.bombsOnly === undefined)).toBe(true);
        expect(dwell(marked).every((s) => s.bombsOnly === true)).toBe(true);
        // `escape`: 0 while the verb stands (its first 2 ticks), then the ticks since
        expect(dwell(marked).map((s) => s.escape)).toEqual([0, 0, 1, 2]);
        // the transit is the same walk either way
        const transit = (w) => w.samples.filter((s) => s.phase !== 'dwell').map((s) => [s.x, s.y, s.tick]);
        expect(transit(marked)).toEqual(transit(plain));
    });
});
