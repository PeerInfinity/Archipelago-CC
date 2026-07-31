/**
 * levelRun — the shared cross-level engine loop.
 *
 * This module exists because a SECOND caller appeared: `botDriverV2` has to
 * advance the same physics through the same world swaps while choosing each
 * tick's keys instead of reading them off a tape. So the tests worth having
 * are the ones that would go red if the two ever stopped being the same
 * thing — not a re-derivation of the transition semantics, which
 * `playerPhysicsV2.test.js` already owns and `transition-west-return` pins
 * against the real game.
 *
 * The failure mode this guards is specifically nasty and is why the
 * factoring was worth the churn: the driver's copy of a world swap is what
 * SYNTHESIZES the tape that the differential then runs through the runner's
 * copy. Two copies would be wrong together, and the tape would still
 * reconcile against the game — a verifier sharing the generator's
 * assumptions, one level up.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt } from './tapeFormat.js';
import { runTapeToStream } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const boot = { level: 0, x: 80, y: 128 };

/** Drive a run by hand off a tape, the way `botDriverV2` drives it by plan. */
function driveByHand(tape) {
    const run = createLevelRun({ levelSource, boot: tape.boot, noclip: tape.noclip });
    const ticks = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level }];
    for (let t = 0; t < tape.tick_count; t++) {
        run.advance(heldKeysAt(tape, t));
        ticks.push({ t: t + 1, x: run.state.x, y: run.state.y, level: run.level });
    }
    return { ticks, transitions: run.transitions, run };
}

describe('one loop, two callers', () => {
    it('hand-driving it reproduces runTape exactly, across a transition', () => {
        // `tapeRunner` reads held keys from the tape; `botDriverV2` chooses
        // them. If those two paths ever diverge, this is where it shows —
        // and `transition-west-return` is the tape that makes it a real
        // claim, because it crosses twice.
        const tape = loadTape('transition-west-return');
        const byHand = driveByHand(tape);
        const byRunner = runTapeToStream(tape, { levelSource });
        expect(byHand.ticks).toEqual(byRunner.ticks);
        expect(byHand.transitions).toEqual(byRunner.transitions);
        expect(byHand.transitions).toHaveLength(2);
    });

    it('reproduces a driver-synthesized tape too', () => {
        const tape = loadTape('cross-level-leg');
        expect(driveByHand(tape).ticks).toEqual(runTapeToStream(tape, { levelSource }).ticks);
    });
});

describe('what the run owns', () => {
    it('counts COMPLETED movement ticks, which is what a transition t means', () => {
        // §1 ruling 2: an entry's `t` is "the first observation tick whose
        // level is the new level". After the swap tick, `ticksCompleted` IS
        // that index — which is why the record can be built here rather than
        // by a caller tracking its own loop variable.
        const tape = loadTape('transition-west-return');
        const { run, transitions } = driveByHand(tape);
        expect(run.ticksCompleted).toBe(tape.tick_count);
        expect(transitions.map((t) => t.t)).toEqual([61, 109]);
    });

    it('swaps the world, not just the level number', () => {
        const tape = loadTape('transition-west-return');
        const run = createLevelRun({ levelSource, boot, noclip: tape.noclip });
        expect(run.level).toBe(0);
        expect(run.world.level).toBe(0);
        for (let t = 0; t < 61; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(94);
        expect(run.world.level).toBe(94);
        // A world with level 94's geometry, not level 0's under a new name.
        expect(run.world.pixelmasks.length).toBe(10);
        // The arrival, with the half-tile ctor offset and a fresh player.
        expect(run.state).toMatchObject({ x: 296, y: 168, vx: 0, vy: 0, terrain: 0 });
    });

    it('surfaces the sweep hits the AS3 caller discards', () => {
        // The driver needs them to tell a completed move from one the
        // geometry cut short — the difference between a plan that worked and
        // a planner bug. `collide-up-rock` presses into a BreakableRock.
        const tape = loadTape('collide-up-rock');
        const run = createLevelRun({ levelSource, boot, noclip: false });
        const hits = [];
        for (let t = 0; t < tape.tick_count; t++) {
            const { hitX, hitY } = run.advance(heldKeysAt(tape, t));
            if (hitX || hitY) hits.push({ t, tag: (hitX || hitY).tag });
        }
        expect(hits.length).toBeGreaterThan(0);
        expect(new Set(hits.map((h) => h.tag))).toEqual(new Set(['breakablerock']));
    });

    it('builds a level lazily, so a level nobody enters never throws', () => {
        // `buildLevelWorld` throws by name on geometry v2 does not model.
        // Level 0 exits to 1, 2, 12, 13, 86, 89 and 94, and only 94 builds —
        // so eager construction would make level 0 itself unloadable.
        const run = createLevelRun({ levelSource, boot, noclip: false });
        expect(run.level).toBe(0);
        expect(() => run.worldFor(12)).toThrow(/NOT for the "blocking" role/);
        // ...and it memoises, so a revisited level is not rebuilt.
        expect(run.worldFor(0)).toBe(run.world);
    });

    it('needs a levelSource — there is no default geometry', () => {
        expect(() => createLevelRun({ boot, noclip: false }))
            .toThrow(/needs a levelSource/);
    });
});

/**
 * R0's grants — the crutch that lets an item walk gate R1 before the pickup
 * ceremony is modelled.
 *
 * The shared contract (R0 kickoff §3.1): a grant is applied by BOTH sides
 * on the FIRST OBSERVATION TICK whose level equals the grant's level. On
 * this side that is two call sites and no third — construction (the boot
 * level, observed at tick 0) and immediately after a world swap — because a
 * swap lands at END of tick `t`, so "the run's level just became L" and
 * "observation `t` reports level L" are the same instant.
 *
 * ⚠ The inventory here is a MIRROR. R1's acceptance assertion reads
 * `botStatus.items` from the recompiled game; these tests pin the TIMING
 * contract the two sides share, not the item state.
 */
describe('grants fire on first entry, at the arrival tick', () => {
    const withGrants = (grants) => createLevelRun({
        levelSource, boot, noclip: true, grants,
    });

    it('starts from an empty inventory with hitsMax at the AS3 default', () => {
        const run = withGrants([]);
        expect(run.inventory.hasSword).toBe(false);
        // `Player.hitsMaxDef` is 3 — health ADDS to it, so the mirror has to
        // start at the base rather than at false.
        expect(run.inventory.hitsMax).toBe(3);
        expect(run.grantsFired).toEqual([]);
    });

    it('fires a BOOT-level grant at tick 0, before any tick runs', () => {
        const run = withGrants([{ level: 0, items: ['sword'] }]);
        expect(run.inventory.hasSword).toBe(true);
        expect(run.grantsFired).toEqual([{ t: 0, level: 0, items: ['sword'] }]);
    });

    it('fires an ARRIVAL grant on the transition tick, not one tick either side', () => {
        // `transition-west-return` crosses into level 94 at tick 61 and back
        // at 109 — recorded from the real game, so the tick is not this
        // module's opinion. A grant for level 94 must land at exactly 61.
        const tape = loadTape('transition-west-return');
        const run = createLevelRun({
            levelSource, boot: tape.boot, noclip: tape.noclip,
            grants: [{ level: 94, items: ['conch'] }],
        });
        for (let t = 0; t < 60; t++) run.advance(heldKeysAt(tape, t));
        expect(run.inventory.canSwim).toBe(false);
        const { grant } = run.advance(heldKeysAt(tape, 60));
        expect(grant).toEqual({ t: 61, level: 94, items: ['conch'] });
        expect(run.inventory.canSwim).toBe(true);
    });

    it('does NOT re-grant on a revisit — which only hitsMax could reveal', () => {
        // The round trip enters level 0 twice. For a boolean a second grant
        // is invisible; `health` ADDS, so a re-grant would silently inflate
        // hitsMax to 5 and the "13 true" assertion would still pass.
        const tape = loadTape('transition-west-return');
        const run = createLevelRun({
            levelSource, boot: tape.boot, noclip: tape.noclip,
            grants: [{ level: 0, items: ['health'] }],
        });
        expect(run.inventory.hitsMax).toBe(4);
        for (let t = 0; t < tape.tick_count; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(0);
        expect(run.inventory.hitsMax).toBe(4);
        expect(run.grantsFired).toHaveLength(1);
    });

    it('reports a grant for a level the run never entered', () => {
        const run = withGrants([{ level: 42, items: ['wand'] }]);
        expect(run.unfiredGrantLevels).toEqual([42]);
        expect(run.inventory.hasWand).toBe(false);
    });

    it('changes NOTHING about the observation stream', () => {
        // A grant is inventory state, not position. If it ever moved the
        // player, every committed expectation would be wrong — so this is
        // the guard that lets the eleven v1 fixtures stay byte-identical
        // while the engine grows a grant path.
        const tape = loadTape('transition-west-return');
        const plain = driveByHand(tape);
        const granted = createLevelRun({
            levelSource, boot: tape.boot, noclip: tape.noclip,
            grants: [{ level: 94, items: ['conch', 'feather'] }],
        });
        const ticks = [{ t: 0, x: granted.state.x, y: granted.state.y, level: granted.level }];
        for (let t = 0; t < tape.tick_count; t++) {
            granted.advance(heldKeysAt(tape, t));
            ticks.push({
                t: t + 1, x: granted.state.x, y: granted.state.y, level: granted.level,
            });
        }
        expect(ticks).toEqual(plain.ticks);
    });
});
