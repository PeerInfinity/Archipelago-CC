/**
 * seedlingDemo/hammerStrikeEtaFloor.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE SF: AN ADMISSIBLE STRIKE FLOOR PLUS THE MEASURED
 * ETA (`STRIKE_ETA_FLOOR`, `solverBot.js`, OFF).
 *
 * SC measured `minTicksBetween` (`ceil(cheb / WALK_SPEED)`) inadmissible — an axis runs at up to 2·`moveSpeed` and the
 * arrival tolerance shortens a walk — and measured that an admissible floor ALONE refuses where the base finds a
 * strike (the forty fill with admissible pairs whose real walk is too slow). ON is the floor plus the measured ETA:
 * the bounded pass previews a cell at its first opportunity and skips the pairs its walk cannot make, the budget
 * counted in distinct cells previewed. The rows:
 *   · the switch ships OFF, and its wrapper restores it (also on a throw);
 *   · the floor's edges: the 1.6 cap, the tolerance, a knocked-back `v0`, ice (a tile, the sticky flag) and a
 *     waterfall — each one a mutant's row (`WALK_SPEED` for 1.6, the tolerance dropped, `v0` ignored);
 *   · two derivations on committed walks: one where ON presses EARLIER at a cell OFF's floor skipped at that tick,
 *     and one where ON keeps a strike the floor alone refuses (the floor-only mutant's row).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    STRIKE_ETA_FLOOR, STRIKE_ETA_FLOOR_DEFAULT, deriveStrike, strikeEtaFloorOf, withStrikeEtaFloor,
} from './solverBot.js';
import { PROFILE } from './seedlingProfile.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

/** A hand-built run: the floor reads `run.state` (position, velocity, the sticky hazard flags) and `run.world`. */
const stub = ({ x = 0, y = 0, vx = 0, vy = 0, onIce = false, tiles = [] } = {}) => ({
    state: { x, y, vx, vy, hazard: { onIce, onWaterfall: false, inWater: false, inLava: false } },
    world: { walkableTiles: tiles.map((t) => ({ tx: 0, ty: 0, t })) },
});
const floorTo = (run, x, y) => strikeEtaFloorOf(run)({ x, y });

describe('STRIKE_ETA_FLOOR — the switch', () => {
    it.skipIf(globalThis.process?.env?.SEEDLING_STRIKE_ETA_FLOOR !== undefined)('ships OFF', () => {
        expect(STRIKE_ETA_FLOOR_DEFAULT).toBe(false);
        expect(STRIKE_ETA_FLOOR.enabled).toBe(false);
    });

    it('withStrikeEtaFloor sets and restores it, also on a throw', () => {
        const was = STRIKE_ETA_FLOOR.enabled;
        expect(withStrikeEtaFloor(true, () => STRIKE_ETA_FLOOR.enabled)).toBe(true);
        expect(withStrikeEtaFloor(false, () => STRIKE_ETA_FLOOR.enabled)).toBe(false);
        expect(STRIKE_ETA_FLOOR.enabled).toBe(was);
        expect(() => withStrikeEtaFloor(true, () => { throw new Error('x'); })).toThrow('x');
        expect(STRIKE_ETA_FLOOR.enabled).toBe(was);
    });
});

describe('strikeEtaFloorOf — the admissible floor\'s edges', () => {
    it('ground: (reach − 1) / 1.6, rounded up — 2·WALK_SPEED, never WALK_SPEED', () => {
        const run = stub();
        expect(floorTo(run, 161, 0)).toBe(100);
        expect(floorTo(run, 161.1, 0)).toBe(101);
        expect(floorTo(run, -40, 161)).toBe(100); // the longer axis, either sign
        expect(floorTo(run, 17, 17)).toBe(10); // a diagonal is bounded per axis
    });

    it('the tolerance: a cell within 1 px on both axes is 0 ticks away, and 2.6 px is one', () => {
        const run = stub({ x: 10, y: 10 });
        expect(floorTo(run, 11, 9)).toBe(0);
        expect(floorTo(run, 10, 10)).toBe(0);
        expect(floorTo(run, 12.6, 10)).toBe(1);
        expect(floorTo(run, 12.61, 10)).toBe(2);
    });

    it('a knocked-back start: an axis faster than the cap bounds the walk at its own speed', () => {
        expect(floorTo(stub({ vx: 3 }), 161, 0)).toBe(54);
        expect(floorTo(stub({ vy: -2.5 }), 0, 161)).toBe(64);
        // a start under the cap changes nothing
        expect(floorTo(stub({ vx: 1.2, vy: -0.4 }), 161, 0)).toBe(100);
    });

    it('ice: a walkable ice tile in the room, or the sticky `onIce` flag, caps an axis at 2·SLIDING_SPEED', () => {
        expect(floorTo(stub({ tiles: [0, PROFILE.iceState] }), 161, 0)).toBe(80);
        expect(floorTo(stub({ onIce: true }), 161, 0)).toBe(80);
        expect(floorTo(stub({ tiles: [0, PROFILE.waterState] }), 161, 0)).toBe(100);
    });

    it('a waterfall: its push adds to v.y past any cap, so only the horizontal axis bounds the walk', () => {
        const run = stub({ tiles: [PROFILE.waterfallState] });
        expect(floorTo(run, 0, 161)).toBe(0);
        expect(floorTo(run, 161, 400)).toBe(100);
    });
});

/** The run after each of `ticks` on a committed tape, handed to `at(t, run)` (`hammerRefugeCut.test.js`'s walk). */
function replayTo(url, ticks, at) {
    const tape = parseTape(readFileSync(url, 'utf8'));
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
    const want = new Set(ticks);
    for (const k of held.filter(Boolean)) {
        if (want.has(run.ticksCompleted)) at(run.ticksCompleted, run);
        if (run.ticksCompleted >= Math.max(...ticks)) break;
        run.advance(k);
    }
}

/** G1's game witness: C1's staging A with the ghost sword, the solve's own executed prefix (a committed walk). */
const G1 = new URL('./fixtures/hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json', import.meta.url);
const BODY = 'spinner@880,848';
const NO_CONTACTS = new Set();
const derive = (run, on) => withStrikeEtaFloor(on, () => deriveStrike(run, BODY, NO_CONTACTS, 0));
const short = (r) => (r.cell === null ? null : [r.cell.x, r.cell.y, r.pressAt, r.eta]);
/** The OFF floor (`minTicksBetween`), restated: `ceil(cheb / WALK_SPEED)`. */
const offFloor = (run, c) => Math.ceil(Math.max(Math.abs(c.x - run.state.x), Math.abs(c.y - run.state.y))
    / PROFILE.walkSpeed);

describe('STRIKE_ETA_FLOOR — derivations on G1\'s witness walk (staging A, the ghost sword)', () => {
    it('t190: ON presses 65 ticks earlier, at a cell OFF\'s floor skipped at that tick', () => {
        replayTo(G1, [190], (t, run) => {
            const off = derive(run, false);
            const on = derive(run, true);
            expect(short(off)).toEqual([728, 680, 497, 201]);
            expect(short(on)).toEqual([744, 728, 432, 241]);
            const i = on.pressAt - run.ticksCompleted;
            // the walk arrives by the aim tick, and OFF's floor dropped the pair: `i − 1 < ceil(cheb / WALK_SPEED)`
            expect(on.eta).toBeLessThanOrEqual(i - 1);
            expect(i - 1).toBeLessThan(offFloor(run, on.cell));
            // and the admissible floor admits it (it is under the walk the preview measured)
            expect(strikeEtaFloorOf(run)(on.cell)).toBeLessThanOrEqual(on.eta);
        });
    }, 120_000);

    it('t160 / t240 / t330: the admissible floor ALONE would refuse there; ON keeps a strike (the measured ETA)', () => {
        const seen = [];
        replayTo(G1, [160, 240, 330], (t, run) => {
            const off = derive(run, false);
            const on = derive(run, true);
            seen.push([t, short(off), short(on), on.scanned ?? null]);
            expect(on.cell, `t${t}`).not.toBeNull();
            expect(on.pressAt, `t${t}`).toBeLessThanOrEqual(off.pressAt);
        });
        expect(seen.map((s) => [s[0], s[1], s[2]])).toEqual([
            [160, [744, 680, 488, 240], [744, 680, 488, 240]],
            [240, [744, 696, 474, 167], [744, 728, 431, 190]],
            [330, [744, 728, 428, 97], [744, 728, 428, 97]],
        ]);
    }, 120_000);
});
