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
 *     and one where ON keeps a strike the floor alone refuses (the floor-only mutant's row);
 *   · the game witness `hammer-sf-l40-strikefloor` (`plan-seedling-hammer-sf-strikefloor.mjs`): staging A with the
 *     ghost sword, the solve's executed prefix ON — the walk's landings, the game's rows of the killed body, and the
 *     ON solve reproducing it key for key.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    STRIKE_ETA_FLOOR, STRIKE_ETA_FLOOR_DEFAULT, deriveStrike, solveSegment, strikeEtaFloorOf, withStrikeEtaFloor,
} from './solverBot.js';
import { SPINNER } from './spinner.js';
import { PROFILE } from './seedlingProfile.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';
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

/**
 * The game witness (D1): `hammer-sf-l40-strikefloor`, C1's staging A with the ghost sword (G1's witness staging),
 * `solveSegment`'s executed prefix with the switch ON (`scripts/procgen/plan-seedling-hammer-sf-strikefloor.mjs`). The
 * game played it tick for tick (the drained player stream 1630 / 1630, `Bot.slashTests` at every sampled tick) and its
 * rows of the killed Spinner are the model's (the committed samples beside the tape). Not a roster tape.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const WDIR = join(HERE, 'fixtures', 'hammer-sf-strikefloor-witness');
const WNAME = 'hammer-sf-l40-strikefloor';
const wtape = parseTape(readFileSync(join(WDIR, `${WNAME}.tape.json`), 'utf8'));
const wgame = JSON.parse(readFileSync(join(WDIR, `${WNAME}.game-bodies.json`), 'utf8'));

function witnessWalk() {
    const held = [];
    const st = createTapeStepper(wtape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const keys = held.filter(Boolean);
    const run = createRunForStaging({ ...stagingFromTape(wtape), equips: [] }, atlasLevelSource());
    const row = () => (run.entities('spinnerBodies') ?? []).map((b) => [b.id, b.hits, b.hitsTimer, b.rect]);
    const rows = [row()];
    for (const k of keys) {
        run.advance(k);
        rows.push(row());
    }
    return { keys, run, rows };
}

describe(`${WNAME} — the strike the admissible floor lets the scan see, on the game (hammer-phase SF, D1)`, () => {
    const w = witnessWalk();
    const landed = w.run.spinnerPressHits.filter((h) => h.landed);

    it('⛓⛓⛓ the walk: three ghost landings on spinner@880,848, the kill at t1616 (OFF\'s walk, G1\'s witness, kills at '
        + 't2114), and the chaser\'s three hits', () => {
        expect(w.keys.length).toBe(1630);
        expect(landed.map((h) => [h.t, h.id, h.weapon, h.hits, h.killed])).toEqual([
            [501, BODY, 'ghostsword', 2, false], [1583, BODY, 'ghostsword', 2, false],
            [1616, BODY, 'ghostsword', 4, true]]);
        expect(w.run.entities('spinnerBodies').map((b) => b.id)).not.toContain(BODY);
        expect(w.run.playerHits.map((h) => [h.t, h.id, h.died])).toEqual([[658, 'bob@736,752', false],
            [747, 'bob@736,752', false], [778, 'bob@736,752', true]]);
    });

    it('⛓⛓ it is G1\'s OFF walk for 602 ticks (the kill\'s first landing at t501 is shared), then it parts', () => {
        const held = [];
        const st = createTapeStepper(parseTape(readFileSync(G1, 'utf8')), { levelSource: atlasLevelSource(),
            onTick: (t, s2, h) => { held[t] = h; } });
        for (let r = st.next(); !r.done; r = st.next());
        const g1 = held.filter(Boolean).map((k) => [...k].sort().join('+'));
        const sf = w.keys.map((k) => [...k].sort().join('+'));
        let i = 0;
        while (i < sf.length && sf[i] === g1[i]) i += 1;
        expect(i).toBe(602);
    });

    it('⛓⛓⛓ THE GAME AGREES: its rows of the killed Spinner (position, hits, hits_timer) are the model\'s at every '
        + 'sampled tick, and it reaches hits 4', () => {
        const bad = [];
        for (const [t, x, y, hits, hitsTimer] of wgame.rows) {
            const m = w.rows[t]?.find((b) => Math.abs(b[3].x + SPINNER.originX - x) < 1e-9
                && Math.abs(b[3].y + SPINNER.originY - y) < 1e-9);
            if (!m || m[0] !== BODY || m[1] !== hits || m[2] !== hitsTimer) bad.push(t);
        }
        expect(bad).toEqual([]);
        expect(wgame.rows.length).toBe(1624);
        expect(Math.max(...wgame.rows.map((r) => r[3]))).toBe(4);
    });

    it('⛓⛓⛓ ON: the solve\'s executed prefix IS the witness, key for key', () => {
        const staging = solveStaging(stagingFromTape(parseTape(readFileSync(join(HERE, 'fixtures',
            'hammer-p1-l40-south-boot.json'), 'utf8'))));
        staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
        const run = createRunForStaging(staging, atlasLevelSource());
        const perTick = withStrikeEtaFloor(true, () => {
            try {
                return solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }],
                    name: WNAME, boot: staging.boot, dashMode: 'all' }).perTick;
            } catch (e) {
                return e.perTick ?? [];
            }
        });
        expect(perTick.length).toBe(1629);
        expect(perTick.map((k) => [...k].sort())).toEqual(w.keys.slice(0, 1629).map((k) => [...k].sort()));
    }, 900_000);
});
