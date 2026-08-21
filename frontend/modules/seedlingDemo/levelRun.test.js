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
import { RELAXED_ROLES, ROLES, buildLevelWorld, rectsOverlap } from './levelWorld.js';
import {
    DEFAULT_FRICTION, SLIDING_FRICTION, SLIDING_SPEED, WALK_SPEED,
} from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// ⛓ R8 slice 3: the two staging counts are IMPORTED, never typed — the
// animation's length is `chasers`' own derivation from `Bob.as:36`'s
// `add("die", [3,4,5,6], 5)` and the fade's is `enemyDamage`'s loop.
import { deathTicks } from './chasers.js';
import { MOBILE_DEATH_FADE, PIT_FADE } from './enemyDamage.js';
import { DEFAULT_TOLERANCE, chooseHeld, hasArrived } from './botDriverV1.js';
import { distanceRectPoint, SLASH_REACH } from './presses.js';

const DEATH_ANIM_TICKS = deathTicks('bob');
import { runTapeToStream } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const boot = { level: 0, x: 80, y: 128 };

/**
 * `probe-seedling-l65-breach.mjs`'s walk, verbatim — the CONTROL arm.
 *
 * Copied rather than imported: the probe is a Playwright script that boots
 * a browser, and the tape is the only part of it a unit test can use. The
 * three `primary` spans below are the press arm's only difference.
 */
const L65_BREACH_SPANS = [
    { key: 'left', from: 5, to: 12 },
    { key: 'down', from: 62, to: 73 },
    { key: 'left', from: 78, to: 83 },
    { key: 'down', from: 88, to: 99 },
    { key: 'left', from: 104, to: 119 },
    { key: 'up', from: 124, to: 125 },
    { key: 'right', from: 178, to: 193 },
    { key: 'up', from: 198, to: 205 },
    { key: 'right', from: 210, to: 221 },
    { key: 'up', from: 226, to: 265 },
    { key: 'left', from: 270, to: 281 },
    { key: 'down', from: 335, to: 350 },
    { key: 'left', from: 355, to: 378 },
    { key: 'up', from: 383, to: 422 },
];
const L65_BREACH_PRESS_SPANS = [
    ...L65_BREACH_SPANS,
    { key: 'primary', from: 18, to: 19 },
    { key: 'primary', from: 130, to: 131 },
    { key: 'primary', from: 286, to: 287 },
];

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

/**
 * ── R4: THE PRESS, against the game's own recordings ──────────────────
 *
 * Two probe tapes are replayed here rather than re-derived, because both
 * were run against the real recompiled game and both printed a number this
 * model has to reproduce. That makes these the strongest tests in the file:
 * everything else pins the model against the AS3, and these pin it against
 * what the AS3 DID.
 */
describe('R4: the spear press, the bridge and the block', () => {
    /** Drive a run with hand-built spans, the way a probe tape does. */
    function drive(run, spans, ticks) {
        for (let t = 0; t < ticks; t++) {
            const held = new Set();
            for (const s of spans) if (t >= s.from && t < s.to) held.add(s.key);
            run.advance(held);
        }
        return run;
    }
    const D6_HAZARDS = ['water', 'lava', 'ice', 'waterfall'];

    it('opens L63\'s bridge exactly 60 ticks after the press — the probe\'s own numbers', () => {
        // `probe-seedling-bridge.mjs`, verbatim: boot at tile (2,8), hold
        // DOWN until the player pins against the bridge's north face at
        // y = 141, press ONCE at tick 25, hold DOWN for the rest. The game
        // reported the pin breaking at tick **85**.
        //
        // Reproducing that number is what pins the whole fencepost chain:
        // the press tick, the one-tick lag before the rect fires, the sixty
        // renders, and — the part no source reading settled — which
        // observation index the crossing lands on.
        const run = createLevelRun({
            levelSource,
            boot: { level: 63, x: 32, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 63, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        const ys = [{ t: 0, y: run.state.y }];
        const spans = [
            { key: 'down', from: 5, to: 20 },
            { key: 'primary', from: 25, to: 26 },
            { key: 'down', from: 30, to: 198 },
        ];
        for (let t = 0; t < 200; t++) {
            const held = new Set();
            for (const s of spans) if (t >= s.from && t < s.to) held.add(s.key);
            run.advance(held);
            ys.push({ t: t + 1, y: run.state.y });
        }
        const pinned = ys.find((o) => o.t >= 22).y;
        expect(pinned).toBe(141);
        const moved = ys.find((o) => o.t >= 22 && o.y > pinned + 0.01);
        expect(moved.t).toBe(85);
        expect(moved.t - 25).toBe(60);
        // The press ledger: pressed at 25, the rect fired at 26, and it hit
        // the bridge tile (2,9) and nothing else.
        expect(run.presses).toEqual([expect.objectContaining({
            t: 25, fired: 26, level: 63, weapon: 'spear', direction: 3,
            hits: [{ as3: 'Tile', id: '2,9' }],
        })]);
        expect([...run.openBridges]).toEqual(['2,9']);
    });

    it('...and with the SWORD equipped the same tape never opens it', () => {
        // The pair's shut arm, one field apart: `equips` emptied, so
        // `useItem` routes through `slashing` and `genericHit`'s Tile arm —
        // which fires only under `t == "Spear"` — never runs.
        const run = createLevelRun({
            levelSource,
            boot: { level: 63, x: 32, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 63, items: ['sword', 'spear'] }],
            equips: [],
        });
        drive(run, [
            { key: 'down', from: 5, to: 20 },
            { key: 'primary', from: 25, to: 26 },
            { key: 'down', from: 30, to: 198 },
        ], 200);
        expect(run.state.y).toBe(141);
        expect([...run.openBridges]).toEqual([]);
        expect(run.presses[0]).toMatchObject({ weapon: 'sword', hits: [] });
    });

    it('reproduces the L65 breach pair\'s CONTROL arm to the pixel', () => {
        // `probe-seedling-l65-breach.mjs`'s control: the identical 440-tick
        // walk with the three `primary` spans removed. The game's own final
        // was (194.05, 114.15) — pinned at the block's east face, then under
        // `rock@192,96`.
        const run = createLevelRun({
            levelSource,
            boot: { level: 65, x: 192, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 65, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        drive(run, L65_BREACH_SPANS, 440);
        expect(run.state.x).toBeCloseTo(194.05, 10);
        expect(run.state.y).toBeCloseTo(114.15, 10);
        expect(run.pushedBlocks).toEqual([]);
    });

    it('reproduces the L65 breach pair\'s PRESS arm too — and the pole it lights', () => {
        // The same 440 ticks with three `primary` spans. The game's own
        // recorded final was (166.65, 98.05): the player walked through the
        // vacated corridor and pinned under (10,5)'s Body Wall, against the
        // control's (194.05, 114.15) at the block's own east face.
        //
        // ⚠ AND THE THIRD PUSH LIGHTS A LIGHTPOLE, unavoidably. The block at
        // tile (10,7) and `lightpole@176,120` occupy the same rows, so every
        // rect that reaches the block spans the pole — there is no stance in
        // that row that does not. `LightPole.set activate` writes
        // `Game.setPersistence(tag, !activate)`, so the press is a LEDGER
        // ENTRY, and the run reports it as an EARNED clear rather than
        // letting it go unaccounted.
        const run = createLevelRun({
            levelSource,
            boot: { level: 65, x: 192, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 65, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        drive(run, L65_BREACH_PRESS_SPANS, 440);
        expect(run.state.x).toBeCloseTo(166.65, 10);
        expect(run.state.y).toBeCloseTo(98.05, 10);
        // The block ended on (9,7)'s pit and was destroyed there.
        expect(run.pushedBlocks).toEqual([{
            id: 'pushableblockspear@176,128', x: 144, y: 112, tx: 9, ty: 7, removed: true,
        }]);
        expect(run.presses).toHaveLength(3);
        // The third press hit BOTH — the block it was aimed at and the pole
        // it could not miss.
        expect(run.presses[2].hits.map((h) => h.as3).sort())
            .toEqual(['LightPole', 'PushableBlockSpear']);
        // ⚠ FIELD-WISE (see `finalDoorL113.test.js`): the row grew a `t` with
        // the editor arc's clears layer, and this test is about the POLE.
        expect(run.earnedClears.map((c) => [c.level, c.tag, c.by]))
            .toEqual([[65, 2, 'lightpole']]);
    });

    it('⚠ the lightpole is a TOGGLE, so the ledger reads the FINAL state', () => {
        // `hit()` flips `activate` behind a 25-tick `hitsTimer`; a second hit
        // puts the flag back. A ledger that counted presses would report a
        // clear the game does not have.
        const run = createLevelRun({
            levelSource,
            boot: { level: 65, x: 192, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 65, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        // The breach walk plus a FOURTH press from the same stance, 34
        // ticks after the third — past the 25-tick timer, and by then the
        // block is gone, so the pole is all the rect still contains.
        drive(run, [
            ...L65_BREACH_PRESS_SPANS,
            { key: 'primary', from: 320, to: 321 },
        ], 440);
        const lit = run.presses.flatMap((p) => p.hits).filter((h) => h.as3 === 'LightPole');
        expect(lit.map((h) => h.activate)).toEqual([true, false]);
        expect(run.earnedClears).toEqual([]);
    });

    it('a block is 32 ticks of MOVING WALL, and the run reports it live', () => {
        const run = createLevelRun({
            levelSource,
            boot: { level: 65, x: 192, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 65, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        const id = 'pushableblockspear@176,128';
        drive(run, [{ key: 'left', from: 5, to: 12 }, { key: 'primary', from: 18, to: 19 }], 25);
        // Pressed at 18, fired at 19, moving from 20 — and mid-glide the
        // rect is in neither cell.
        expect(run.pushables.get(id).rect.x).toBe(173.5);
        expect(run.pushesSettled).toBe(false);
        drive(run, [], 40);
        expect(run.pushables.get(id).rect.x).toBe(160);
        expect(run.pushesSettled).toBe(true);
        expect(run.pushedBlocks).toEqual([
            { id, x: 160, y: 128, tx: 10, ty: 8, removed: false },
        ]);
    });

    it('⚠ both families are PER VISIT — a rebuilt level has them back', () => {
        // `Tile.bridgeOpeningTimer` and `PushableBlockFire.tile` are instance
        // variables with no persistence, so the level the walk RETURNS to is
        // the level it first entered. The earned-clear family is the
        // opposite, three lines away in the same file, and unifying them
        // would plan the return through a door the game has shut.
        const run = createLevelRun({
            levelSource,
            boot: { level: 63, x: 32, y: 128 },
            noHazards: D6_HAZARDS,
            grants: [{ level: 63, items: ['sword', 'spear'] }],
            equips: [{ t: 0, slot: 1 }],
        });
        // Open the bridge, cross it, and keep walking down column 2 — the
        // only north-south corridor in that half of L63 — to the L65 door at
        // (32,304). Then turn round and come straight back.
        drive(run, [
            { key: 'down', from: 5, to: 20 },
            { key: 'primary', from: 25, to: 26 },
            { key: 'down', from: 30, to: 260 },
        ], 100);
        expect([...run.openBridges]).toEqual(['2,9']);
        drive(run, [{ key: 'down', from: 0, to: 160 }], 160);
        expect(run.level).toBe(65);
        // ...and the same door back.
        drive(run, [{ key: 'up', from: 0, to: 40 }], 40);
        expect(run.level).toBe(63);
        expect(run.transitions).toHaveLength(2);
        // The bridge the run OPENED is closed again, because `Game` was
        // reconstructed and `bridgeOpeningTimer` is an instance variable.
        expect([...run.openBridges]).toEqual([]);
    });
});

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
        // `buildLevelWorld` throws by name on geometry the census does not
        // cover, and the laziness is what keeps one uncovered level from
        // making its NEIGHBOURS unloadable. The exemplar has moved twice:
        // level 1 held an unclassified tag until R5's sweep classified the
        // last 22, so the only level left that refuses is 112, whose `pod`
        // avoid volume is R6's to price.
        //
        // ⛓⛓⛓ R6 SLICE 6b: AND NOW NO LEVEL REFUSES — the pod bill is paid,
        // so L112 builds. The laziness claim is unchanged and still has to be
        // checked, so the exemplar becomes a SYNTHETIC level the census
        // genuinely cannot cover: `worldFor` must throw when it reaches it
        // and must not throw before.
        const run = createLevelRun({ levelSource, boot, noclip: false });
        expect(run.level).toBe(0);
        expect(() => run.worldFor(112)).not.toThrow();
        // ...and it memoises, so a revisited level is not rebuilt.
        expect(run.worldFor(0)).toBe(run.world);

        const withUnknown = (level) => (level === 900 ? {
            level: 900, class: 'Synthetic', width: 10, height: 10,
            layers: [{ name: 'tiles', set: 'tileset', tiles: [] }],
            entities: [{ type: 'notatag', x: 16, y: 16 }],
        } : levelSource(level));
        // Constructing the run does NOT reach level 900 — that is the whole
        // claim — and asking for it does.
        const lazy = createLevelRun({ levelSource: withUnknown, boot, noclip: false });
        expect(lazy.level).toBe(0);
        expect(() => lazy.worldFor(900)).toThrow(/"notatag".*not in the transcribed/s);
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

/**
 * ── R2: the run's own view of which locks are open ────────────────────
 *
 * `botDriverV2` re-plans before every waypoint, and whether a tile is
 * walkable depends on per-tick state a plan object cannot hold. The getter
 * exists so the planner reads the SAME set `advance` hands `stepV2` — the
 * walkTo-divergence lesson, one mechanic later.
 */
describe('R2: openActivators', () => {
    const levelSource = atlasLevelSource();
    /** L71's `lock@112,160`, whose button is `button@112,176` directly below. */
    const LOCK = 'lock@112,160';
    /** The spawn `boot: {level: 71, x: 112, y: 176}` lands on, i.e. the button. */
    const ON_THE_BUTTON = { level: 71, x: 112, y: 176 };

    it('is null under noclip — the arm `advance` actually takes', () => {
        const run = createLevelRun({
            levelSource, boot: ON_THE_BUTTON, noclip: true, roles: undefined,
        });
        expect(run.openActivators).toBe(null);
    });

    it('opens the lock on tick 101 of standing on its button, and not on 100', () => {
        const run = createLevelRun({ levelSource, boot: ON_THE_BUTTON });
        expect(run.openActivators.has(LOCK)).toBe(false);
        for (let t = 0; t < 100; t++) run.advance(new Set());
        // ⚠ 100 is the answer `1 / 0.01` gives and it is WRONG:
        // `Lock.activationStep` tests `alpha > 0` BEFORE decrementing and
        // `Image.alpha` clamps at 0, so `turnOff()` lands one tick later.
        expect(run.openActivators.has(LOCK)).toBe(false);
        run.advance(new Set());
        expect(run.openActivators.has(LOCK)).toBe(true);
    });

    it('shuts again when the player steps off a lock they are not inside', () => {
        const run = createLevelRun({ levelSource, boot: ON_THE_BUTTON });
        for (let t = 0; t < 101; t++) run.advance(new Set());
        expect(run.openActivators.has(LOCK)).toBe(true);
        // Walk SOUTH, away from both volumes: the occupancy guard no longer
        // holds it open, so `returnToNormal` fires. This is the half that
        // makes the crossing a knife-edge rather than a latch.
        for (let t = 0; t < 40; t++) run.advance(new Set(['down']));
        expect(run.openActivators.has(LOCK)).toBe(false);
    });

    it('is per LEVEL and per VISIT — a round trip re-solidifies it', () => {
        const run = createLevelRun({
            levelSource, boot: ON_THE_BUTTON,
            noHazards: ['water', 'lava', 'ice', 'waterfall'],
        });
        const driveUntil = (held, done, what) => {
            for (let t = 0; t < 600; t++) {
                run.advance(new Set(held));
                if (done()) return;
            }
            throw new Error(`never ${what} (level ${run.level} at `
                + `${run.state.x},${run.state.y})`);
        };
        for (let t = 0; t < 101; t++) run.advance(new Set());
        expect(run.openActivators.has(LOCK)).toBe(true);

        // Out through L71's north trigger and straight back in through
        // L75's. `Game` is reconstructed on every world swap, so a lock that
        // was open when the player left is a fresh `type = normType` when
        // they come back — memoising the state alongside the world would
        // keep it open across a round trip the game closes.
        driveUntil(['up'], () => run.state.y < 40, 'walked north');
        driveUntil(['left'], () => run.state.x <= 106, 'lined up on the north trigger');
        driveUntil(['up'], () => run.level === 75, 'left L71');
        driveUntil(['right'], () => run.state.x > 96, 'cleared L75\'s return trigger');
        driveUntil(['left', 'down'], () => run.level === 71, 'came back to L71');
        expect(run.openActivators.has(LOCK)).toBe(false);
    });
});

/**
 * ── R3: THE TOUCH-LOCK WINDOW ─────────────────────────────────────────
 *
 * The second thing on this ladder that refuses input, and it is a different
 * animal from the first. A pit transport and a pickup ceremony both stop the
 * player; a ShieldLock stops the player's KEYS. `receiveInput` is read at
 * the top of `Player.input()` (`Player.as:1501`) and nowhere else, so
 * friction, both sweeps and `getState` all keep running and whatever
 * velocity the player carried into the snap keeps carrying them.
 *
 * The three throws below are guards on states the game really has. Two of
 * them are unreachable on the committed map and say so with a census; the
 * third is unreachable on LAND and says so with arithmetic. None of them is
 * asserted in prose.
 */
describe('R3: the touch-lock window', () => {
    const levelSource = atlasLevelSource();
    const L71_BOOT = { level: 71, x: 256, y: 256 };
    const DARK = [{ level: 71, items: ['darkshield'] }];
    const NO_HAZARDS = ['water', 'lava', 'ice', 'waterfall'];
    const LOCK = 'shieldlock@288,256';

    const runL71 = (grants) => createLevelRun({
        levelSource, boot: L71_BOOT, noclip: false, noDamage: true,
        noHazards: NO_HAZARDS, grants,
    });

    it('refuses the KEYS, not the tick — and the velocity survives it', () => {
        const run = runL71(DARK);
        expect(run.inputRefused).toBe(false);
        // Walk east into the lock. The snap fires on the tick the sweep
        // first rests inside the `x - 1` collide rect.
        let snapped = -1;
        for (let t = 0; t < 40 && snapped < 0; t++) {
            run.advance(new Set(['right']));
            if (run.inputRefused) snapped = run.ticksCompleted;
        }
        expect(snapped).toBeGreaterThan(0);
        // ⚠ THE SNAP IS NOT VISIBLE YET, and the game is what said so. A Lock
        // is added BELOW the Player in `Game.loadlevel` and `addUpdate`
        // PREPENDS, so it updates BEFORE the player and writes `p.y` at the
        // top of the NEXT tick. The first recording of `l71-shieldlock-open`
        // caught the model applying it a tick early: observation 19 is 264.
        expect(run.state.y).toBe(264);

        // ⚠ The keys are dropped, so pressing does nothing — but the tick is
        // a REAL tick. A model that skipped it (the freeze model, one
        // mechanic over) would shift every observation after the window.
        run.advance(new Set(['right', 'up']));
        // `p.y = y - originY + 7` — 264 to 263, which is the whole reason the
        // pair's shut control shows a different y.
        expect(run.state.y).toBe(263);
        const held = { x: run.state.x, y: run.state.y };
        for (let t = 2; t <= 100; t++) {
            run.advance(new Set(['right', 'up']));
            expect(run.state, `window tick ${t}`).toMatchObject(held);
        }
        expect(run.ticksCompleted).toBe(snapped + 100);
        expect(run.inputRefused).toBe(false);
        expect(run.openActivators.has(LOCK)).toBe(true);
        expect(run.lockSnaps).toEqual([{
            id: LOCK, level: 71, persistTag: 2, y: 263,
            from: snapped, to: snapped + 100, ticks: 100,
        }]);

        // ...and input is back on the very next tick.
        run.advance(new Set(['right']));
        expect(run.state.x).toBeGreaterThan(held.x);
    });

    it('never fires without the shield — the lock is just a wall', () => {
        const run = runL71([]);
        for (let t = 0; t < 200; t++) run.advance(new Set(['right']));
        expect(run.inputRefused).toBe(false);
        expect(run.lockSnaps).toEqual([]);
        expect(run.openActivators.has(LOCK)).toBe(false);
        // Pinned on the west face, at the y nothing snapped.
        expect(run.state.y).toBe(264);
    });

    /**
     * ⚠ A BOUNDED VACUITY, WITH ITS WITNESS. `ShieldLock.turnOff()` restores
     * `receiveInput` only `if (p)`, where `p` is the collide it re-ran this
     * tick — so a player carried out of the rect during the fade never gets
     * input back, and `levelRun` throws rather than emit a run no span can
     * reach. That throw has never fired, and here is why it cannot on land:
     * the snap lands the player 5 px from the rect's near edge and 6 from
     * its far one, and friction is SUBTRACTIVE, so the whole coast from
     * walking speed is under two pixels.
     *
     * The escape hatch is named: ice (friction 0.025) and a waterfall would
     * both clear that margin easily. Both are in `noHazards` on every tape
     * on this ladder, and no touch responder on the map sits on either.
     */
    it('cannot be carried out of the collide rect at walking speed', () => {
        // The coast, from the module's own constants rather than a number
        // typed here: |v| shortens by DEFAULT_FRICTION per tick from at most
        // WALK_SPEED, and anything under 0.05 is zeroed.
        let v = WALK_SPEED;
        let coast = 0;
        while (v >= 0.05) { v = Math.max(v - DEFAULT_FRICTION, 0); coast += v; }
        expect(coast).toBeLessThan(2);
        // The margin the snap leaves: box [snapY-2, snapY+3) inside
        // [y, y+16), with snapY = y + 7.
        const above = (7 - 2) - 0;        // 5 px before the box clears the top
        const below = 16 - (7 + 3);       // 6 px before it clears the bottom
        expect(coast).toBeLessThan(Math.min(above, below));
        // And on ice it would NOT be bounded — which is the guard's reason.
        let ice = SLIDING_SPEED;
        let iceCoast = 0;
        while (ice >= 0.05) { ice = Math.max(ice - SLIDING_FRICTION, 0); iceCoast += ice; }
        expect(iceCoast).toBeGreaterThan(Math.min(above, below));
    });

    /**
     * The other two throws, turned into map-wide facts rather than left as
     * branches nobody can reach. Three touch responders exist in the whole
     * extract (L12, L20, L71); a census over all of them is cheap and it is
     * the only thing that would notice a re-extraction moving one.
     */
    it('no teleporter and no second touch rect overlaps a touch responder', () => {
        const found = [];
        const offenders = [];
        for (let lv = 0; lv < 116; lv++) {
            let world;
            try {
                world = buildLevelWorld(levelSource(lv), { roles: RELAXED_ROLES });
            } catch { continue; }
            const touch = world.activators.filter((a) => a.touchRect);
            for (const a of touch) {
                found.push(`L${lv} ${a.id}`);
                // A trigger inside the window would swap the world out from
                // under the lock, leaving nothing to call `turnOff`.
                for (const tp of world.teleporters) {
                    if (rectsOverlap(tp.rect, a.touchRect)) {
                        offenders.push(`L${lv} ${a.id} overlaps teleporter->${tp.to}`);
                    }
                }
                // Two windows at once is not transcribed.
                for (const b of touch) {
                    if (b !== a && rectsOverlap(b.touchRect, a.touchRect)) {
                        offenders.push(`L${lv} ${a.id} overlaps ${b.id}`);
                    }
                }
            }
        }
        expect(offenders).toEqual([]);
        // ⚠ And the census is not vacuous: it really did look at three.
        expect(found).toEqual([
            'L12 shieldlocknorm@288,704',
            'L20 shieldlocknorm@176,16',
            'L71 shieldlock@288,256',
        ]);
    });

    /**
     * ⚠ THE HALF OF `turnOff` WITH A FUTURE IN IT, and the reason R3's route
     * can come back the way it went. `Lock.turnOff()` writes
     * `setPersistence(tag, false)`, and `Lock.check()` on a NEWLY BUILT
     * `Game` removes any lock whose flag is off — so the shield lock is not
     * merely non-solid for this visit, it is GONE on the next one.
     *
     * The route depends on it: the walk goes out through L71's lock to
     * reach darksuit and comes BACK through the same corridor to L71's pit.
     * A model that rebuilt the level with the lock standing would send the
     * return leg into a wall the game does not have — and it would present
     * as a collision divergence two thousand ticks later, in another level.
     */
    it('EARNS the clear: the lock is gone when the level is re-entered', () => {
        const run = runL71(DARK);
        for (let t = 0; t < 40 && !run.inputRefused; t++) run.advance(new Set(['right']));
        expect(run.inputRefused).toBe(true);
        for (let t = 0; t < 200 && run.inputRefused; t++) run.advance(new Set());
        expect(run.lockSnaps).toHaveLength(1);
        expect(run.earnedClears.map((c) => [c.level, c.tag, c.by]))
            .toEqual([[71, 2, LOCK]]);

        // Still THERE for the rest of this visit — non-solid, but present.
        // Despawning it now would be a tick early and on the very tick the
        // player is standing inside it.
        expect(run.world.activators.some((a) => a.id === LOCK)).toBe(true);
        expect(run.openActivators.has(LOCK)).toBe(true);

        // Out east through the teleporter to L76, then back.
        const driveUntil = (held, done, what) => {
            for (let t = 0; t < 800; t++) {
                run.advance(new Set(held));
                if (done()) return;
            }
            throw new Error(`never ${what} (level ${run.level} at `
                + `${run.state.x},${run.state.y})`);
        };
        driveUntil(['right'], () => run.level === 76, 'left L71 eastward');
        driveUntil(['left'], () => run.level === 71, 'came back to L71');
        // ...and NOW it is gone, because the Game that was just built read a
        // flag the player turned off.
        expect(run.world.activators.some((a) => a.id === LOCK)).toBe(false);
        expect(run.world.solids.some((s) => s.tag === 'shieldlock')).toBe(false);
    });

    it('the two spellings demand DIFFERENT shields', () => {
        // `Game.as:2144-2145` builds `shieldlocknorm` with `_type = 0` and
        // `shieldlock` with 1, and `ShieldLock.as:33` reads them as two arms
        // of a disjunction. Treating the argument as a sprite choice would
        // open every normal lock on the dark shield — and L20's is the very
        // first one a walk meets.
        const l20 = buildLevelWorld(levelSource(20), { roles: RELAXED_ROLES });
        const l71 = buildLevelWorld(levelSource(71), { roles: RELAXED_ROLES });
        expect(l20.activators.find((a) => a.touchRect).shield).toBe('hasShield');
        expect(l71.activators.find((a) => a.touchRect).shield).toBe('hasDarkShield');
    });
});

describe('⛓ R5: a level BUILDS differently for a run that already holds the item', () => {
    // `Karlore.added()` runs inside `new Game(48, ...)`, so L48's geometry
    // is a function of the inventory at CONSTRUCTION — and which side of the
    // construction a grant lands on is the whole of §15.8.
    const plugged = (run) => run.world.solids.some((s) => s.tag === 'karlore');

    it('a BOOT grant naming L48 does NOT open it — a boot is not an entry', () => {
        // Two recordings were spent on this. `Bot` applies a boot grant
        // AFTER `new Game` has run every `added()`, so the plug is built as
        // though the item were absent; the model boots its world from an
        // EMPTY inventory for exactly that reason. The item IS held one
        // instant later, which is what makes this a trap rather than a bug.
        const run = createLevelRun({
            levelSource, boot: { level: 48, x: 120, y: 296 }, noclip: true,
            grants: [{ level: 48, items: ['fire'] }],
        });
        expect(run.inventory.hasFire).toBe(true);
        expect(plugged(run)).toBe(true);
        expect(run.world.addedTimeRemoved).toEqual([]);
    });

    it('...and neither does a grant naming L48 on a walk that ENTERS L48', () => {
        // The second recording's shape: `synthesizeLegs` emits the grant
        // against the level its RUN banked the item in, which for a two-leg
        // plan is the destination — and that grant fires on the first
        // observation whose level is 48, i.e. after the world was built.
        const tape = loadTape('r5-karlore-fire');
        const run = createLevelRun({
            levelSource, boot: tape.boot, noclip: false, noDamage: true,
            noHazards: tape.noHazards, pins: tape.pins,
            grants: [{ level: 48, items: ['fire'] }],
        });
        for (let t = 0; t < tape.tick_count; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(48);
        expect(run.inventory.hasFire).toBe(true);
        expect(plugged(run)).toBe(true);
    });

    it('⛓ but a grant naming the level BEFORE it does — the shipped fixture', () => {
        // `r5-karlore-fire`'s own grant names L47, the level the walk boots
        // into, so the item is banked thirteen ticks before the door and
        // `new Game(48, ...)` builds a level with no Karlore in it at all.
        const tape = loadTape('r5-karlore-fire');
        expect(tape.grants).toEqual([{ level: 47, items: ['fire'] }]);
        const run = createLevelRun({
            levelSource, boot: tape.boot, noclip: false, noDamage: true,
            noHazards: tape.noHazards, pins: tape.pins, grants: tape.grants,
        });
        for (let t = 0; t < tape.tick_count; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(48);
        expect(plugged(run)).toBe(false);
        expect(run.world.addedTimeRemoved.map((r) => r.tag)).toEqual(['karlore']);
        // ...and the walk really is PAST the plug, not merely in a world
        // without one — row 16, which the control arm cannot reach.
        expect(Math.floor(run.state.y / 16)).toBe(16);
    });

    it('⛔ a MEMOISED world is rebuilt when the item arrives between two visits', () => {
        // The failure this guards: a world memo keyed on the level alone
        // serves the first build to the second visit, and the game does the
        // opposite — `new Game(n, ...)` re-runs every `added()` every time.
        // Driven on a real round trip: `transition-west-return` leaves L0
        // for L94 and comes back, and the grant is banked in L94.
        //
        // ⚠ The vehicle is a SYNTHETIC source (L0 with a karlore added at a
        // tile the walk never touches), because no level on a round-trip
        // tape holds one. The entity is real, its class is real, and the
        // question — "does the memo survive an item" — is the shipped one.
        const tape = loadTape('transition-west-return');
        const withKarlore = (n) => {
            const rec = levelSource(n);
            return n === 0
                ? { ...rec, entities: [...rec.entities, { type: 'karlore', x: 16, y: 16, attrs: {} }] }
                : rec;
        };
        const run = createLevelRun({
            levelSource: withKarlore, boot: tape.boot, noclip: tape.noclip,
            grants: [{ level: 94, items: ['fire'] }],
        });
        expect(run.level).toBe(0);
        expect(plugged(run)).toBe(true);          // built before the item
        for (let t = 0; t < tape.tick_count; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(0);                // and back again
        expect(run.inventory.hasFire).toBe(true);
        expect(plugged(run)).toBe(false);         // ...rebuilt, as `new Game` would
    });

    it('⚠ ...and NOT mid-visit, because `added()` has already run', () => {
        // The mirror of the earned-clears rule: dropping a memo while the
        // run is standing in the level would remove the entity under the
        // player's feet, and the game does not. An item picked up in L48
        // does not make Karlore vanish; the next `new Game(48, ...)` does.
        const tape = loadTape('transition-west-return');
        const withKarlore = (n) => {
            const rec = levelSource(n);
            return n === 94
                ? { ...rec, entities: [...rec.entities, { type: 'karlore', x: 16, y: 16, attrs: {} }] }
                : rec;
        };
        const run = createLevelRun({
            levelSource: withKarlore, boot: tape.boot, noclip: tape.noclip,
            grants: [{ level: 94, items: ['fire'] }],
        });
        for (let t = 0; t < 61; t++) run.advance(heldKeysAt(tape, t));
        expect(run.level).toBe(94);
        expect(run.inventory.hasFire).toBe(true);  // banked ON arrival...
        expect(plugged(run)).toBe(true);           // ...and the NPC stays put
    });
});

/**
 * ── ⛓⛓⛓ R5 SLICE 15: THE CRUSHER, AND THE ONLY CHECK THAT COUNTS ────
 *
 * §25.4 called the burn *"wired end to end"* and §28.2 found four call
 * sites that had been handed an option and silently dropped it — including
 * `stepV2` itself, the one mover whose collisions decide where a route
 * goes. 1,745 green tests could not see it, because the only producer of
 * the option was a verb nothing had driven.
 *
 * ⇒ THE ONLY TEST THAT DISCHARGES "WIRED" IS ONE WHERE THE PLAYER'S OWN
 * SWEEP MEETS A MOVED SOLID. Everything else — the roster, the ledger, the
 * option's presence in a destructuring list — can be green over a silence.
 * So this drives a real `createLevelRun` in L41, makes the crusher charge,
 * and asks the PLAYER where they can and cannot walk.
 */
describe('⛓⛓⛓ R5 slice 15: the crusher, driven through the player\'s own sweep', () => {
    /**
     * L41 with both `breakablerock`s declared clear, and the boot in the
     * crusher's WEST lane.
     *
     * ⛓ The rocks are what shield it (§28.8), so this boot is the state a
     * route reaches by breaking them — declared here rather than slashed,
     * because what is under test is the MOVER and not the press.
     */
    const l41 = () => createLevelRun({
        levelSource,
        boot: { level: 41, x: 208, y: 80 },
        persistence: [{ level: 41, tag: 1 }, { level: 41, tag: 2 }],
        noDamage: true,
    });
    const drive = (run, spans, ticks) => {
        const at = (t) => new Set(
            spans.filter((s) => t >= s.from && t < s.to).map((s) => s.key),
        );
        for (let t = 0; t < ticks; t++) run.advance(at(t));
        return run;
    };
    /** The bait: retreat west two tiles, then drop SOUTH out of the lane. */
    const BAIT = [{ key: 'left', from: 0, to: 21 }, { key: 'down', from: 21, to: 61 }];
    const only = (run) => [...run.crushers.values()][0];

    it('⛓⛓ it charges at exactly 1 px/tick, and only once the rocks are gone', () => {
        const run = l41();
        expect(only(run)).toMatchObject({ x: 256, y: 80 });
        const xs = [];
        for (let t = 0; t < 5; t += 1) { run.advance(new Set()); xs.push(only(run).x); }
        expect(xs).toEqual([255, 254, 253, 252, 251]);
        // ⛔ AND THE SHIELD IS REAL: the same boot with the rocks STANDING
        // never moves it, which is what makes the line above a measurement
        // of the sight test rather than of the roster.
        const shielded = createLevelRun({
            levelSource, boot: { level: 41, x: 208, y: 80 }, noDamage: true,
        });
        for (let t = 0; t < 5; t += 1) shielded.advance(new Set());
        expect(only(shielded)).toMatchObject({ x: 256, y: 80 });
    });

    /**
     * ⛓⛓⛓ THE CLAIM THE SLICE EXISTS FOR. After the park, the player walks
     * EAST into `crusher@240,64`'s own constructor cells — geometry the
     * level built as a 32x32 Solid — and the sweep lets them through.
     * Before it, the same walk stops dead against the same cells.
     *
     * A model that dropped the `crushers` key in `stepV2` (the §28.2 shape)
     * passes every other assertion in this file and fails this one, in both
     * directions at once: it would walk through the spawn box on the BEFORE
     * arm and into thin air on the AFTER arm.
     */
    it('⛓⛓⛓ the PLAYER stands where the STATIC geometry says a Solid is', () => {
        const run = drive(l41(), BAIT, 220);
        expect(run.crushersParked).toBe(true);
        expect(only(run)).toMatchObject({ x: 64, y: 80 });
        // ⛔ ZERO CONTACTS. `Bot.noDamage` is why a bad bait would not
        // throw, so the count is the claim.
        expect(run.crusherContacts).toEqual([]);
        drive(run, [
            { key: 'up', from: 0, to: 44 },
            { key: 'right', from: 44, to: 130 },
        ], 130);
        // The crusher's CONSTRUCTOR body is [240,272) x [64,96) and the
        // player is standing inside it.
        expect(run.state.x).toBeGreaterThan(240);
        expect(run.state.x).toBeLessThan(272);
        expect(run.state.y).toBeGreaterThanOrEqual(64);
        expect(run.state.y).toBeLessThan(96);
        expect(run.crusherContacts).toEqual([]);
        // ⛓⛓⛓ AND THIS PAIR IS THE DISCRIMINATOR §28.2 DID NOT HAVE. The
        // same box, asked of the same world twice: the STATIC geometry says
        // Solid and only the live option says otherwise. A `stepV2` that
        // dropped the `crushers` key — the shape that hid the burn for two
        // slices behind 1,745 green tests — would have used the static
        // answer and REFUSED this walk, so the player's arrival here is
        // itself the proof the key is read.
        const box = playerBoxAt(run.state.x, run.state.y);
        expect(run.world.collidesSolid(box, {})).toBeTruthy();
        expect(run.world.collidesSolid(box, { crushers: run.crushers })).toBe(null);
    });

    /**
     * ⛔⛔ A PARKED CRUSHER IS NOT A DISARMED ONE, and this is the finding
     * the first cut of the test above walked straight into.
     *
     * `update()` re-derives `v` on EVERY tick it is at rest, so a park is a
     * position and not a state. The route that has just walked east through
     * its constructor cells is standing in its EAST lane, and stepping back
     * west along that row hands it a fresh sight line and a fresh charge —
     * from a crusher a plan had written off.
     *
     * ⇒ phase 2's precondition is `crushersParked` AT THE TICK IT IS ASKED,
     * and a leg that re-enters a lane is phase 1 again.
     */
    it('⛔⛔ a parked crusher re-arms — walking back into its lane charges it', () => {
        const run = drive(l41(), BAIT, 220);
        expect(only(run)).toMatchObject({ x: 64, y: 80 });
        drive(run, [{ key: 'up', from: 0, to: 44 }, { key: 'left', from: 44, to: 200 }], 200);
        // It charged EAST this time — the opposite direction to the bait
        // that parked it — and ran the walk down.
        expect(only(run).x).toBeGreaterThan(64);
        expect(run.crusherContacts.length).toBeGreaterThan(0);
    });

    /**
     * ⛔⛔ AND A RE-ENTRY PUTS IT BACK. `Crusher.as` writes no persistence
     * at all — no `check()`, no `removed()` — so every `new Game` rebuilds
     * it at its constructor cell however far the last visit drove it.
     *
     * ⇒ a window plan may NEVER carry a crusher position across a re-boot,
     * and a botched park is one room-exit from reset.
     */
    it('⛔⛔ a rebuilt room puts the crusher back at its constructor cell', () => {
        const run = drive(l41(), BAIT, 220);
        expect(only(run).x).toBe(64);
        // The same run, told the level was rebuilt — which is what a
        // transition does.
        const again = drive(l41(), BAIT, 0);
        expect(only(again)).toMatchObject({ x: 256, y: 80 });
    });

    /**
     * ⛔ THE NEGATIVE CONTROL FOR `crusherContacts`. A route that stands
     * still is run over, and the run REPORTS it rather than dying —
     * `Bot.noDamage` is on, so a model that threw here would diverge from
     * the recording it is checked against. A silent list would make every
     * "the route stayed clear" claim vacuous.
     */
    it('⛔ standing in the lane is reported as contacts, not as a death', () => {
        const run = drive(l41(), [], 60);
        expect(run.crusherContacts.length).toBeGreaterThan(0);
        expect(run.crusherContacts[0]).toMatchObject({ level: 41, id: 'crusher@240,64' });
    });

    /**
     * ⛓ AND THE PARK IS WHAT MAKES THE PART REACHABLE — measured with the
     * flood, under the ROUTE's own policy (§28.4). The crusher at its
     * constructor cell leaves `totempart 3` outside the component even with
     * every activator open; parked, it is inside.
     */
    it('⛓⛓ the park is the mechanic: the part crosses on the crusher alone', () => {
        const run = drive(l41(), BAIT, 220);
        const w = run.world;
        const openAll = new Set(w.solids.filter((s) => s.activatorId).map((s) => s.activatorId));
        const flood = (crushers) => {
            const ok = (x, y) => x > 0 && y > 0 && x < 21 * 16 && y < 22 * 16
                && !w.collidesSolid(playerBoxAt(x, y), { openActivators: openAll, crushers });
            const start = [184, 136];
            const seen = new Set([start.join(',')]);
            const q = [start];
            while (q.length) {
                const [x, y] = q.shift();
                for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
                    if (!ok(x + dx, y + dy)) continue;
                    const k = `${x + dx},${y + dy}`;
                    if (seen.has(k)) continue;
                    seen.add(k); q.push([x + dx, y + dy]);
                }
            }
            return seen;
        };
        const spawn = new Map([['crusher@240,64', {
            id: 'crusher@240,64',
            rect: { x: 240, y: 64, w: 32, h: 32, right: 272, bottom: 96 },
        }]]);
        const parked = flood(run.crushers);
        const home = flood(spawn);
        expect(parked.has('248,152')).toBe(true);
        expect(home.has('248,152')).toBe(false);
        expect(parked.size).toBe(332);
        expect(home.size).toBe(305);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 23 — THE WAND WINDOW'S JOIN, WHICH IS FIVE FAMILIES DEEP.
 *
 * `bossTotem.test.js` owns the boss's own arithmetic. What is only testable
 * HERE is the JOIN: a v6 `save` block reaching `Wand.update`'s gate, the
 * gate deciding whether the CONTACT test runs at all, the collect
 * publishing to tset 0, three `fallrock`s sharing one freeze span, the boss
 * riding that span, and the clamp being written into the player's own y.
 *
 * The two arms are the committed pair, driven from the tapes on disk — so a
 * fixture edited out from under this file is a red rather than a silence.
 */
describe('⛓⛓⛓ R5 slice 23: the L43 wand window, and its shut-before control', () => {
    const driveTape = (name) => {
        const t = loadTape(name);
        const run = createLevelRun({
            levelSource,
            boot: t.boot,
            noclip: t.noclip,
            noHazards: t.noHazards,
            noDamage: t.noDamage,
            grants: t.grants,
            persistence: t.persistence,
            equips: t.equips,
            pins: t.pins,
            save: t.save,
        });
        const stream = [];
        for (let k = 0; k < t.tick_count; k += 1) {
            stream.push({ t: k, x: run.state.x, y: run.state.y, level: run.level });
            run.advance(heldKeysAt(t, k));
        }
        return { run, stream, tape: t };
    };
    const armed = driveTape('r5-l43-wand');
    const control = driveTape('r5-l43-wand-control');

    it('the two tapes differ in ONE FIELD and nothing else', () => {
        const strip = (t) => ({ ...t, save: null, name: null, description: null });
        expect(JSON.stringify(strip(armed.tape)))
            .toBe(JSON.stringify(strip(control.tape)));
        expect(armed.tape.save.totem_parts).toEqual([0, 1, 2, 3, 4]);
        expect(control.tape.save.totem_parts).toEqual([]);
    });

    it('⛓⛓⛓ the drive collects the wand and the control cannot', () => {
        expect(armed.run.collected.map((c) => c.item)).toEqual(['wand']);
        expect(armed.run.inventory.hasWand).toBe(true);
        // ⛔ AND THE GATE WRAPS THE CONTACT TEST, not only the fade. The
        // control walks the same route onto the same 3x8 press rect.
        expect(control.run.collected).toEqual([]);
        expect(control.run.inventory.hasWand).toBe(false);
    });

    it('⛔⛔ the approach FADE is 99 frozen frames and fires before the contact', () => {
        expect(armed.run.wandFades).toHaveLength(1);
        expect(armed.run.wandFades[0].deadFrames).toBe(99);
        // Tick 0: the gate is the player's Y alone, and the boot is inside it.
        expect(armed.run.wandFades[0].t).toBe(0);
        expect(control.run.wandFades).toEqual([]);
    });

    it('⛔⛔ the three tset-0 rocks share ONE span — 186, not 560', () => {
        expect(armed.run.rockFalls).toHaveLength(3);
        const spans = armed.run.rockFalls.map((r) => r.deadFrames);
        expect(new Set(spans).size).toBe(1);
        expect(spans[0]).toBe(186);
        // The whole point: summing them would be the freeze the game never
        // spends, because the EARLIEST camera expiry clears the flag for all.
        expect(spans.reduce((s, n) => s + n, 0)).toBe(558);
        expect(armed.run.frozenFramesOwed).toBe(99 + 186);
        expect(control.run.rockFalls).toEqual([]);
        expect(control.run.frozenFramesOwed).toBe(0);
    });

    it('⛓⛓⛓ the CLAMP is an assignment, at A+216, into the player\'s own y', () => {
        expect(armed.run.bossesWoken).toHaveLength(1);
        expect(armed.run.bossClamps.length).toBeGreaterThan(0);
        const first = armed.run.bossClamps[0];
        expect(first.sinceActivation).toBe(216);
        expect(first.to).toBe(212);
        expect(first.from).toBeLessThan(212);
        // ⛔⛔ AND THE CLAMP'S OWN NUMBER IS NOT IN THE STREAM, because the
        // boss updates BEFORE the player: `addUpdate` PREPENDS and the
        // Player is added at `Game.as:2092` against the boss's `:2121`, so
        // the assignment lands and then THAT SAME TICK's movement runs off
        // it. The observation after the clamp is 211.20, not 212.
        //
        // ⇒ the witness is the JUMP, not the value — 195.60 to 211.20 in
        // one tick, against a walk that had been climbing at ~1 px/tick. A
        // test written as `=== 212` would be asserting an update order the
        // game does not have. [[feedback_divergence_tick_is_not_the_event]]
        expect(armed.stream[first.t].y).toBe(first.from);
        const after = armed.stream[first.t + 1].y;
        // ⚠ THE PREDICATE IS THE SHAPE, NOT A MAGNITUDE. The first cut
        // asserted `> first.from + 14` — fitted to the schedule the pair had
        // before the control's refutation moved the press cadence — and went
        // red at 13.70 px on a run where the clamp fired perfectly. What no
        // re-authoring can move: the jump is far larger than a walking step
        // and lands within one step of the clamp.
        // [[feedback_coincidental_predicate_rots]]
        expect(after - first.from).toBeGreaterThan(10);
        expect(Math.abs(after - 212)).toBeLessThan(2);
        expect(after).toBeLessThan(212);
        // …and once the keys stop, it comes to REST on the clamp exactly.
        expect(armed.stream[armed.stream.length - 1].y).toBe(212);
        expect(control.run.bossesWoken).toEqual([]);
        expect(control.run.bossClamps).toEqual([]);
    });

    it('⛓⛓ the arms are byte-identical to the CONTACT and part exactly there', () => {
        let firstDiff = -1;
        for (let i = 0; i < armed.stream.length; i += 1) {
            const a = armed.stream[i];
            const b = control.stream[i];
            if (a.x !== b.x || a.y !== b.y || a.level !== b.level) { firstDiff = i; break; }
        }
        expect(firstDiff).toBe(10);
    });

    it('⛓⛓ …and they stop at the SAME NUMBER by two different mechanisms', () => {
        const north = (s) => Math.min(...s.slice(28).map((o) => o.y));
        // an ASSIGNMENT for the drive…
        expect(north(armed.stream)).toBeLessThan(212);
        expect(armed.stream[armed.stream.length - 1].y).toBe(212);
        // …and a COLLISION with the unwoken boss's wall for the control:
        // the box's bottom edge is 212 and the player's origin is 2 px.
        expect(north(control.stream)).toBeGreaterThan(212);
        expect(north(control.stream)).toBeLessThan(216);
    });

    it('⛔ the window is TERMINAL — neither arm leaves level 43', () => {
        for (const arm of [armed, control]) {
            expect([...new Set(arm.stream.map((o) => o.level))]).toEqual([43]);
            expect(arm.run.transitions).toEqual([]);
        }
    });
});

/**
 * ── ⛓⛓⛓ R7 SLICE 6e: THE WITNESSED MID-RUN ENEMY REMOVAL ─────────────
 *
 * `persistence[].at`'s twin, and its tests are that field's tests one class
 * along: the removal lands AT its tick and not before, the live binding is
 * refreshed and not merely the memo (trap 149), and an id nobody can find is
 * a named throw rather than a silent no-op.
 *
 * ⛔ THE POSITIVE CONTROL WAS THE REFUSAL ITSELF, AND R8 SLICE 1 MOVED IT.
 * L6's `bob@112,48` used to be a `mover`, so walking into its placement box
 * WITHOUT the declaration threw by name. The bridge steps a `bob` now: the
 * body LEAVES its placement on the first tick the player is inside `runRange`
 * 80, so the old control asserts a throw that can no longer happen — and a
 * control that has stopped being able to fire is not a weak control, it is
 * not a control (trap 62's shape).
 *
 * ⇒ the refusal is re-pointed at an UNCONVERTED SIBLING, and the sibling is
 * chosen to make the partition sharp rather than convenient: `jellyfish` is
 * in `chasers.CHASERS` with the SAME transcription depth as `bob` and has NO
 * `MODELLED_ENEMY_CLASSES` row, so it is the one class where "transcribed"
 * and "bridged" visibly differ. Its throw is what proves the bridge converted
 * ONE class and not a family.
 */
describe('despawn — the witnessed mid-run enemy removal (v10)', () => {
    const L6_BOB = 'bob@112,48';
    /**
     * ⚠ BOOTED TWO TILES WEST OF THE BODY AND WALKED STRAIGHT AT IT. The
     * chain's own route is what a segment does; what a UNIT test needs is
     * the shortest walk that reaches the placement, so the run boots at
     * tile (5,3) and holds `right` into (7,3). The contact lands at tick 24.
     */
    const runWith = (despawn, ticks = 30) => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 6, x: 80, y: 48 },
            noclip: false,
            noDamage: false,
            despawn,
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        for (let t = 0; t < ticks; t += 1) run.advance(new Set(['right']));
        return run;
    };

    /**
     * ⛔⛔ THE CONTROL, RE-POINTED: an UNCONVERTED SIBLING still throws BY
     * NAME. L63 holds two `jellyfish` — transcribed in the same module as
     * `bob`, with the same `chaserStep`, and deliberately WITHOUT a roster
     * row. Walking into one is still the `mover` refusal, word for word.
     */
    it('⛔ THE CONTROL: an unconverted sibling class still throws BY NAME', () => {
        // L45's `jellyfish@224,176`, walked into from two tiles north. The
        // contact lands at tick 14.
        const drive = () => {
            const run = createLevelRun({
                levelSource: atlasLevelSource(),
                boot: { level: 45, x: 224, y: 144 },
                noclip: false,
                noDamage: false,
                roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
            });
            for (let t = 0; t < 30; t += 1) run.advance(new Set(['down']));
        };
        expect(drive).toThrow(/standing inside jellyfish@224,176 in level 45/);
        // ⛔ THE WORD IS THE CLAIM: still `mover`, still refused, and the
        // refusal still names the class rather than the bridge.
        expect(drive).toThrow(/prices it as "mover"/);
    });

    /**
     * ⛓⛓⛓ AND THE CONVERTED CLASS IS PRICED INSTEAD OF REFUSED — the pair's
     * other half, at the same placement the old control used.
     *
     * ⚠ THE WITNESS IS THE WALK, NOT THE HIT (trap 113). A hit count is
     * invariant under a permutation of its causes; what says the BODY WAS
     * STEPPED is `chaserWalks` — rows the model can only produce by moving a
     * body `chaserStep` returned a new position for.
     */
    it('⛓ the CONVERTED class is stepped and priced, not refused', () => {
        const run = runWith([]);
        expect(run.chaserWalks.length).toBeGreaterThan(0);
        expect(run.chaserWalks.every((w) => w.level === 6)).toBe(true);
        // …and the body really LEFT its placement, which is why the census
        // scan must skip it.
        const live = run.chasers.find((c) => c.id === L6_BOB);
        const moved = run.chaserWalks.filter((w) => w.id === L6_BOB);
        expect(moved.length).toBeGreaterThan(0);
        if (live) expect(live.x !== 120 || live.y !== 56).toBe(true);
    });

    it('⛓ a removal declared at tick 0 makes the same walk legal', () => {
        const run = runWith([{ level: 6, id: L6_BOB, at: 0 }]);
        expect(run.level).toBe(6);
        expect(run.playerHits).toEqual([]);
        expect(run.world.combat.enemies.some((e) => `${e.tag}@${e.x},${e.y}` === L6_BOB))
            .toBe(false);
        // …and the OTHER body is untouched, so this is a removal and not a
        // switch that turns the census off.
        expect(run.world.combat.enemies.some((e) => `${e.tag}@${e.x},${e.y}` === 'bob@96,16'))
            .toBe(true);
    });

    /**
     * ⛔ MUTATION, RE-AIMED AT WHAT THE DECLARATION NOW BUYS. Before the
     * bridge, a late removal left a throw behind; now it leaves a LIVE BODY
     * behind, and the difference is visible in the ledger rather than in an
     * exception: declared at tick 0 the body never walks, declared at 29 it
     * walks for 29 ticks first. A declaration that bought nothing would make
     * the two identical.
     */
    it('⛔ MUTATION: a removal AFTER the tick is a body that walked until then', () => {
        const late = runWith([{ level: 6, id: L6_BOB, at: 29 }]);
        const early = runWith([{ level: 6, id: L6_BOB, at: 0 }]);
        const walked = (r) => r.chaserWalks.filter((w) => w.id === L6_BOB).length;
        expect(walked(late)).toBeGreaterThan(0);
        expect(walked(early)).toBe(0);
    });

    /**
     * ⛔⛔ TRAP 149's SECOND CUSTOMER. Dropping the world memo does NOT rebind
     * the run's live `world`, so a removal applied while the player is
     * standing in that very level has to refresh both. This asserts the LIVE
     * binding, which is the half that a memo-only fix leaves broken.
     */
    it('⛓ the removal refreshes the LIVE world binding, not just the memo', () => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 6, x: 80, y: 48 },
            noclip: false,
            noDamage: false,
            despawn: [{ level: 6, id: L6_BOB, at: 5 }],
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        const has = () => run.world.combat.enemies
            .some((e) => `${e.tag}@${e.x},${e.y}` === L6_BOB);
        run.advance(new Set());
        expect(has()).toBe(true);           // before its tick, the body is there
        for (let t = 1; t < 6; t += 1) run.advance(new Set());
        expect(has()).toBe(false);          // …and at it, the LIVE world has lost it
    });

    it('⛔ MUTATION: an id no placement matches is a NAMED throw', () => {
        expect(() => runWith([{ level: 6, id: 'bob@1,1', at: 0 }]))
            .toThrow(/level record has no such placement/);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE ARROW × ENEMY FAMILY, DRIVEN.
 *
 * Slice 1's wall was that this model's arrows hit nothing, so a room with a
 * ceiling could not be stepped at all (trap 157: a body's position without
 * its lifetime is wrong for ever after the tick it should have died). These
 * drive the committed L4 walk — the room the GAME's own measurement covers
 * (R7 slice 6c: hits `0->1->2->3`, the body gone at t~158) — and assert the
 * staging the model now owns.
 *
 * ⛔ THE TAPE IS THE COMMITTED ONE, replayed offline. Its BYTE-EXACTNESS is
 * `tapeRunner.test.js`'s claim, not this file's; what is asserted here is the
 * LEDGER, which the stream cannot show — a byte-exact player stream is not a
 * witness about bodies (trap 113, and slice 2 paid for that lesson in full).
 */
describe('⛓⛓⛓ R8 slice 3: an arrow kills a chaser, and the staging is three fenceposts', () => {
    const ROLES_ON = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
    const L4_BOB = 'bob@64,64';

    const driveTape = (name) => {
        const t = loadTape(name);
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: t.boot,
            noclip: t.noclip,
            noDamage: t.noDamage,
            noHazards: t.noHazards,
            grants: t.grants,
            persistence: t.persistence,
            despawn: t.despawn ?? [],
            equips: t.equips,
            pins: t.pins ?? [],
            save: t.save ?? null,
            rng: t.rng ?? null,
            seam: t.seam ?? null,
            roles: ROLES_ON,
        });
        for (let i = 0; i < t.tick_count; i += 1) run.advance(new Set(heldKeysAt(t, i)));
        return run;
    };

    it('⛓ the L4 bob takes THREE arrows and dies to the third', () => {
        const run = driveTape('r8-solve-4');
        const landed = run.arrowBodyHits
            .filter((h) => h.body === L4_BOB && h.damaged);
        expect(landed.map((h) => h.hitsAfter)).toEqual([1, 2, 3]);
        // ⛔ ONE DAMAGE PER ARROW, NOT FIVE — trap 143. `Arrow.as:52` is
        // `hit(v.length, new Point(x, y))` and `Enemy.hit(f, p, d = 1, t = "")`
        // says the 5 is the KNOCKBACK FORCE. A model that read the 5 as damage
        // would kill this body with the FIRST arrow, 67 ticks early.
        expect(run.chaserKills).toHaveLength(1);
        expect(run.chaserKills[0]).toMatchObject({ id: L4_BOB, by: 'arrow', hits: 3 });
    });

    it('⛓ the i-frames really gate it — every arrow between the three is REFUSED by name', () => {
        const run = driveTape('r8-solve-4');
        const at = run.arrowBodyHits.filter((h) => h.body === L4_BOB);
        const refused = at.filter((h) => !h.damaged);
        // The trap fires three arrows every eleven ticks and the body has 30
        // i-frames, so the refusals vastly outnumber the landings — and each
        // one says WHY rather than being a silent miss.
        expect(refused.length).toBeGreaterThan(at.length - refused.length);
        expect(refused.every((h) => /i-frames/.test(h.refusedAt))).toBe(true);
    });

    /**
     * ⛔⛔ THE FLOOR IS 60 TICKS AND THE CADENCE CANNOT BEAT IT. Derived from
     * the ledger rather than asserted as a literal: `hitsTimerMax` is 30 and
     * three landings need two full i-frame windows between them.
     */
    it('⛓ the first and third landings are at least 60 ticks apart', () => {
        const run = driveTape('r8-solve-4');
        const landed = run.arrowBodyHits.filter((h) => h.body === L4_BOB && h.damaged);
        expect(landed[2].t - landed[0].t).toBeGreaterThanOrEqual(60);
    });

    /**
     * ⛔ THE KILLING HIT TAKES NO KNOCKBACK, and this is the assertion that
     * separates the `if` arm from the `else` one. `Enemy.hit` is
     * `if (hits >= hitsMax) { startDeath(t) } else { knockback(f, p) }` — so
     * the third arrow stages a death and leaves the velocity exactly where
     * the second one left it. A model that knocked back on every landed hit
     * would slide every corpse up to fifty pixels the game leaves standing.
     */
    it('⛔ the KILLING hit does not knock back — the corpse keeps the velocity it had', () => {
        const run = driveTape('r8-solve-4');
        const kill = run.chaserKills[0];
        const walks = run.chaserWalks.filter((w) => w.id === L4_BOB);
        const justBefore = walks.filter((w) => w.t < kill.t).pop();
        const justAfter = walks.find((w) => w.t === kill.t);
        // The killing tick's own motion is the PREVIOUS tick's velocity minus
        // friction — never that plus five. `ARROW_ENEMY_HIT.force` is 5 and
        // `FRICTION` is 0.25, so a knockback would show as a speed JUMP.
        const speed = (w) => Math.hypot(w.vx, w.vy);
        if (justAfter) expect(speed(justAfter)).toBeLessThanOrEqual(speed(justBefore));
    });

    /**
     * ⛓⛓⛓ THE THREE FENCEPOSTS, apart. `startDeath` plays the animation and
     * does NOT set `destroy`; `endAnim` sets it 25 graphic updates later;
     * `Mobile.death`'s fade removes the body eleven ticks after THAT — and
     * `totalEnemies()` counts it through all of it (trap 87, now with three
     * posts instead of two).
     */
    it('⛓⛓ dying, then destroy, then removed — three ticks, not one', () => {
        const run = driveTape('r8-solve-4');
        const kill = run.chaserKills[0];
        // Replay to the kill tick and step forward reading the getter.
        const t = loadTape('r8-solve-4');
        const r2 = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: t.boot,
            noclip: false,
            noDamage: false,
            noHazards: t.noHazards,
            grants: t.grants,
            persistence: t.persistence,
            equips: t.equips,
            pins: t.pins ?? [],
            save: t.save ?? null,
            rng: t.rng ?? null,
            seam: t.seam ?? null,
            roles: ROLES_ON,
        });
        const seen = { dying: null, destroy: null, gone: null };
        for (let i = 0; i < t.tick_count; i += 1) {
            r2.advance(new Set(heldKeysAt(t, i)));
            const body = r2.chasers.find((c) => c.id === L4_BOB);
            if (!body) { if (seen.gone === null && seen.dying !== null) seen.gone = i + 1; continue; }
            if (body.dying && seen.dying === null) seen.dying = i + 1;
            if (body.destroy && seen.destroy === null) seen.destroy = i + 1;
        }
        expect(seen.dying).toBe(kill.t);
        expect(seen.destroy).toBeGreaterThan(seen.dying);
        expect(seen.gone).toBeGreaterThan(seen.destroy);
        // ⛔ THE COUNTS ARE DERIVED, NOT TYPED: the animation is
        // `chasers.deathTicks('bob')` updates and the fade is
        // `MOBILE_DEATH_FADE.ticks`. An ARROW kill lands BEFORE the body's own
        // graphic update in the tick (an Arrow is prepended and updates
        // first), so the animation's first update is the killing tick itself —
        // which is one tick earlier than a press's would be.
        expect(seen.destroy - seen.dying).toBe(DEATH_ANIM_TICKS - 1);
        expect(seen.gone - seen.destroy).toBe(MOBILE_DEATH_FADE.ticks);
    });

    /**
     * ⛔⛔⛔ THE ROOM VERDICT, WIDENED — and what is left of it is NARROWER.
     */
    it('⛓ a trap room with only chasers is STEPPED; one with an unstaged static body is not', () => {
        const l4 = driveTape('r8-solve-4');
        // L4 holds two arrow traps and one bob: stepped, and the ledger says so.
        expect(l4.chaserWalks.filter((w) => w.level === 4).length).toBeGreaterThan(0);
        // L8 holds a trap and two sandtraps whose arrow-death this rung does
        // NOT stage — refused BY NAME, with the missing thing in the message.
        const l8 = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 8, x: 64, y: 64 },
            noclip: false,
            noDamage: false,
            roles: ROLES_ON,
        });
        l8.advance(new Set());
        expect(l8.chasers).toEqual([]);
    });

    /**
     * ⛓⛓⛓ THE KILL-LOCK CONSEQUENCE IS COMPUTED, AND THE DECLARATION IS THE
     * CHECK (trap 148's shape). L5's three deaths take `totalEnemies()` to
     * zero and open `lock@48,112` — the room's whole solve — and the tape
     * DECLARES `{5,0}`. The model does not write the flag (two writers of one
     * persistence slot is two cost models); it PREDICTS the opening and names
     * the tick the tape declares.
     */
    it('⛓⛓ L5\'s deaths OPEN {5,0}, computed, against the tape\'s own declaration', () => {
        const run = driveTape('r7-act2-5');
        const opens = run.chaserKillLockOpens.filter((o) => !o.nil);
        expect(opens).toHaveLength(1);
        expect(opens[0].opens).toEqual([{ flag: 0, at: 'lock@48,112' }]);
        expect(opens[0].declaredAt).toEqual([737]);
        // …and every EARLIER death computed the nil rather than skipping the
        // scan ("there were no kill locks" and "nobody looked" print the same
        // thing — the IceTurret arm's own law).
        const nils = run.chaserKillLockOpens.filter((o) => o.nil);
        expect(nils.length).toBe(2);
        expect(nils.every((o) => /stay shut/.test(o.why))).toBe(true);
    });

    /**
     * ⛔ MUTATION, RUN: strip the tape's declared clear and the same walk
     * THROWS by name. A clear the model can see coming and the tape does not
     * carry is a blocker that opens in the game and stays shut here — which
     * is the silent divergence this arm exists to prevent.
     */
    it('⛔ MUTATION: an UNDECLARED kill-lock opening is a named throw', () => {
        const t = loadTape('r7-act2-5');
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: t.boot,
            noclip: false,
            noDamage: false,
            noHazards: t.noHazards,
            grants: t.grants,
            persistence: [],              // ⛔ the declaration, removed
            equips: t.equips,
            pins: t.pins ?? [],
            save: t.save ?? null,
            rng: t.rng ?? null,
            seam: t.seam ?? null,
            roles: ROLES_ON,
        });
        expect(() => {
            for (let i = 0; i < t.tick_count; i += 1) run.advance(new Set(heldKeysAt(t, i)));
        }).toThrow(/OPENS 1 kill lock\(s\) in level 5 \[\{5,0\}\]/);
    });

    /**
     * ⛓⛓⛓ THE PIT, AND ITS OWN BOUND IS WHAT BUILT IT.
     *
     * Slice 1 refused `Enemy.update`'s `case 6` by name with a bound — "no
     * room this bridge steps has one". This slice stepped L4, which HAS one,
     * and the first full-config run threw exactly there. The descent is a
     * SCHEDULE, not an instant: a lerp a tenth of the way to the tile centre
     * per tick and a 0.05 fade, and only when the alpha runs out does the
     * body leave the world.
     *
     * ⛔ Driven from a stance that walks the player PAST the pit so the bob's
     * chase line crosses it — trap 152's own shape ("ask what the ROOM does
     * to the mover, and pick the stance that makes the room do it").
     */
    it('⛓⛓ a chaser that walks into a pit FALLS — a schedule, not an instant', () => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            // The stance the dangerMap suite already boots — the one whose
            // full-config run threw here at tick 14, kept so the witness and
            // the finding are the same walk.
            boot: { level: 4, x: 16, y: 64 },
            noclip: false,
            noDamage: false,
            roles: ROLES_ON,
        });
        for (let i = 0; i < 400; i += 1) run.advance(new Set());
        const fell = run.chaserTerrainDeaths.filter((d) => d.cause === 'pit');
        expect(fell).toHaveLength(1);
        expect(fell[0].id).toBe(L4_BOB);
        // ⛔ AND IT TOOK THE SCHEDULE'S OWN LENGTH. The fall is armed on the
        // tick the body stands on the tile and the body leaves the world when
        // `PIT_FADE` runs out — a model that read `case 6` as an instant
        // would remove it twenty ticks early.
        const armed = run.chaserWalks.filter((w) => w.id === L4_BOB).pop();
        expect(fell[0].t - armed.t).toBeGreaterThanOrEqual(PIT_FADE.ticks - 1);
        // …and while it fell it damaged nothing: the descent replaces
        // `super.update()`, so `hitPlayer()` never runs.
        expect(run.playerHits).toEqual([]);
    });

    /**
     * ⛓ COVER IS A RESOURCE, MEASURED. An arrow stops on anything it touches,
     * and the ledger says which — so "the body is in shadow" stops being a
     * plan-time prediction and becomes a fact inside the run.
     */
    it('⛓ arrows die on COVER as well as on bodies, and the ledger names which', () => {
        const run = driveTape('r7-act2-5');
        const arms = new Set(run.arrowBodyHits.map((h) => h.arm));
        expect(arms.has('cover')).toBe(true);
        expect(arms.has('chaser')).toBe(true);
        // Every row names an arrow and a body — a hit with no subject is a
        // count, and a count is not a witness (trap 113).
        expect(run.arrowBodyHits.every((h) => h.arrow && h.body)).toBe(true);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 5 — THE RECORDING THAT REFUTED THE MODEL, REPLAYED THROUGH
 * THE FIXED ONE.
 *
 * `r8-solve-5` was withdrawn in slice 4: the GAME reported `hits: 1` against
 * the model's 0 and the streams parted at t=207. The tape and the game's own
 * per-tick stream are banked in `fixtures/refuted/`, and this is the whole
 * point of banking them — a withdrawn recording is a free oracle, and the
 * cheapest possible statement of a model fix is "the recording that refuted
 * it now replays through it".
 *
 * ⛔ THREE DEFECTS, AND NO ONE OF THEM WOULD HAVE DONE IT ALONE:
 *
 *   1. `applyArrowHit` never billed the player — `ARROW_PLAYER_ARM` named
 *      `PUZZLEMENT_HAZARDS.arrowtrap`, which is a CENSUS row nothing bills
 *      from. Fix that alone and the model still misses, because…
 *   2. …a fresh volley was stepped by the same call that created it, where
 *      `Engine.update` adds it to the world only AFTER the frame's updates.
 *      Fix that too and the model is STILL one tick early, because…
 *   3. …the trap fired on a flag one frame stale where the game's is two: the
 *      Player is added FIRST at `Game.as:2115` and therefore updates LAST, so
 *      the button that publishes the group saw the player a frame before that.
 *
 * ⚠ THE COMPARISON STOPS AT 276 AND SAYS WHY. The knockback this fix restores
 * pushes the walk west into WATER, and the model refuses an unpinned water
 * entry BY NAME (`Music.soundPosition("Swim")` is a wall clock). That refusal
 * is a determinism gate, not a divergence — and the tape is withdrawn, so it
 * will never be pinned. Comparing 277 of 556 ticks INCLUDING the hit is the
 * whole of what the recording can adjudicate.
 */
describe('R8 slice 5 — the refuted recording, replayed through the fixed model', () => {
    const REFUTED = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'refuted');
    const tape = parseTape(JSON.parse(
        readFileSync(join(REFUTED, 'r8-solve-5.tape.json'), 'utf8')));
    const expectation = JSON.parse(
        readFileSync(join(REFUTED, 'r8-solve-5.expectation.json'), 'utf8'));

    const replay = () => {
        const run = createLevelRun({
            levelSource,
            boot: tape.boot,
            noclip: false,
            noHazards: tape.noHazards,
            noDamage: false,
            grants: tape.grants,
            persistence: tape.persistence,
            despawn: [],
            equips: tape.equips,
            pins: tape.pins ?? [],
            save: tape.save ?? null,
            rng: tape.rng ?? null,
            seam: tape.seam ?? null,
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        const diffs = [];
        let compared = 0;
        let refusedAt = null;
        for (let i = 0; i < tape.tick_count; i += 1) {
            const want = expectation.ticks[i];
            if (want) {
                compared += 1;
                if (run.state.x !== want.x || run.state.y !== want.y
                    || run.level !== want.level) {
                    diffs.push({ t: i, want, got: { x: run.state.x, y: run.state.y } });
                }
            }
            try {
                run.advance(heldKeysAt(tape, i));
            } catch (e) {
                refusedAt = { t: i, why: e.message };
                break;
            }
        }
        return { run, diffs, compared, refusedAt };
    };

    it('⛓⛓⛓ reproduces the GAME\'s own stream, tick for tick, up to the refusal', () => {
        const { diffs, compared, refusedAt } = replay();
        expect(diffs).toEqual([]);
        // ⛔ NON-VACUITY: a comparison that ran out after ten ticks would also
        // report no diffs. The hit is at 207, so the compared prefix must
        // reach past it.
        expect(compared).toBeGreaterThan(207);
        expect(refusedAt.t).toBe(276);
        expect(refusedAt.why).toMatch(/entered Water/);
    });

    /**
     * ⛔ THE HIT ITSELF, AND EVERY DIGIT OF IT — the game reported `hits: 1`
     * and this is the model's own row for the same event.
     */
    it('⛓⛓⛓ bills the arrow the GAME billed, from the arrow the GAME hit', () => {
        const { run } = replay();
        expect(run.playerHits).toHaveLength(1);
        const hit = run.playerHits[0];
        expect(hit.source).toBe('arrow');
        expect(hit.id).toBe('arrowtrap@64,48#14.0');
        expect(hit.t).toBe(207);
        expect(hit.hits).toBe(1);
        // The y impulse is DROPPED by `KNOCKBACK_COMPARATORS.y`'s strict `>`.
        expect(hit.knockback.dx).toBe(-4.3951592784836375);
        expect(hit.knockback.dy).toBe(0);
        expect(hit.knockback.landed).toEqual({ x: true, y: false });
        // …and that impulse is what makes the next tick's x the game's.
        expect(expectation.ticks[207].x).toBe(62.35484072151636);
    });

    /**
     * ⛓ THE SECOND DEFECT, MEASURED ON ITS OWN: a volley is in the ledger on
     * the tick it FIRED and has not moved yet. Two facts, and only one of them
     * was wrong — reading `arrowVolleys[].t` as "the tick the arrow started
     * falling" is the mistake this row exists to keep visible.
     */
    it('⛓ a fresh volley is at its SPAWN row on the tick after it fired', () => {
        const run = createLevelRun({
            levelSource,
            boot: tape.boot,
            noclip: false,
            noHazards: tape.noHazards,
            noDamage: false,
            grants: tape.grants,
            persistence: tape.persistence,
            equips: tape.equips,
            pins: tape.pins ?? [],
            save: tape.save ?? null,
            rng: tape.rng ?? null,
            seam: tape.seam ?? null,
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        let seen = null;
        for (let i = 0; i < 210 && !seen; i += 1) {
            run.advance(heldKeysAt(tape, i));
            const volley = run.arrowVolleys.find((v) => v.id === 'arrowtrap@64,48');
            if (volley && run.ticksCompleted === volley.t) {
                const fresh = run.arrowsInFlight
                    .filter((a) => volley.arrows.includes(a.id));
                if (fresh.length === 3) seen = { volley, fresh };
            }
        }
        expect(seen, 'no volley was observed on its own firing tick').not.toBeNull();
        // `ARROW_TRAP.spawnDY` below the trap's entity y (50) — UNMOVED.
        for (const a of seen.fresh) expect(a.y).toBe(48);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 5 — THE FORECAST IS THE RUN'S OWN ARITHMETIC, PROVED BY
 * DRIVING BOTH.
 *
 * `arrowForecast()` exists so a corridor probe can ask where the arrows will
 * be along a walk that has not happened. It calls the same `stepArrowTrap` and
 * `stepArrow` the live tick calls — but "calls the same functions" is a claim
 * about a source file, and the law is that two cost models must agree BY
 * CONSTRUCTION, checked by driving the real path
 * ([[feedback_two_cost_models_must_agree]]).
 *
 * ⛔ SO THIS DRIVES BOTH OVER ONE COMMITTED WALK: the run replays `r7-act2-5`
 * while a forecast, seeded at tick 0, is stepped along the SAME positions. If
 * the two ever disagree about one arrow's position, the fast path has drifted
 * — including on the two facts this slice fixed, the spawn deferral and the
 * two-frame arming lag, both of which live in exactly one of the two.
 */
describe('R8 slice 5 — the arrow forecast agrees with the run it forecasts', () => {
    const TICKS = 400;

    it('⛓⛓⛓ predicts every arrow position of a committed walk, tick for tick', () => {
        const t = loadTape('r7-act2-5');
        const mk = () => createLevelRun({
            levelSource,
            boot: t.boot,
            noclip: t.noclip,
            noHazards: t.noHazards,
            noDamage: t.noDamage,
            grants: t.grants,
            persistence: t.persistence,
            equips: t.equips,
            pins: t.pins,
            save: t.save,
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        const run = mk();
        const forecast = mk().arrowForecast();
        expect(forecast, 'L5 has four arrow traps').not.toBeNull();
        let comparedTicks = 0;
        let comparedArrows = 0;
        const extras = new Set();
        for (let i = 0; i < TICKS; i += 1) {
            // The forecast reads the player where the live stepper does: the
            // position at the START of the tick, before `stepV2`.
            const predicted = forecast.step({ x: run.state.x, y: run.state.y });
            run.advance(heldKeysAt(t, i));
            // The run's own arrows AFTER that tick — the same instant.
            const live = run.arrowFlights
                .filter((a) => a.v.x !== 0 || a.v.y !== 0)
                .map((a) => `${a.id}@${a.x},${a.y}`);
            const seen = new Set(predicted.map((a) => `${a.id}@${a.x},${a.y}`));
            /**
             * ⛔ EVERY LIVE ARROW IS PREDICTED, AT THE SAME PIXEL. That is the
             * agreement, and it is the direction that matters: a forecast that
             * lost an arrow would clear a cell the game shoots.
             */
            for (const a of live) expect(seen.has(a), `tick ${i}: ${a}`).toBe(true);
            for (const a of predicted) {
                if (!live.includes(`${a.id}@${a.x},${a.y}`)) extras.add(a.id);
            }
            comparedTicks += 1;
            comparedArrows += live.length;
        }
        // ⛔ THE POSITIVE COUNT, so a pair of empty lists cannot pass for
        // agreement: this walk holds a ceiling that fires for the whole
        // window (the silent-watcher law).
        expect(comparedTicks).toBe(TICKS);
        expect(comparedArrows).toBeGreaterThan(1000);
        /**
         * ⛓⛓ AND THE OVER-APPROXIMATION IS ACCOUNTED FOR, NOT TOLERATED.
         * The forecast steps `stepArrow` with `bodies: []` on purpose (a body
         * may have moved or died by the horizon), so an arrow the run killed
         * on a BOB keeps flying in the forecast. Every extra must therefore be
         * an arrow the run's own ledger says died on a body — and cover is NOT
         * an excuse, because the forecast asks the same cover query.
         */
        const onBodies = new Set(run.arrowBodyHits
            .filter((h) => h.arm !== 'cover').map((h) => h.arrow));
        for (const id of extras) {
            expect(onBodies.has(id), `${id} flew on in the forecast and the run's `
                + 'ledger does not say a body stopped it').toBe(true);
        }
        // ⛔ AND THERE WERE SOME — otherwise the exclusion above is a
        // declaration rather than a measurement.
        expect(extras.size).toBeGreaterThan(0);
    });

    /**
     * ⛔ MUTATION, RUN: seed the forecast one tick late and it disagrees BY
     * TICK. A comparison that has never seen a disagreement might be comparing
     * nothing — this is the row that says it can fail.
     */
    it('⛔ a forecast fed the WRONG player positions diverges, and says when', () => {
        const t = loadTape('r7-act2-5');
        const mk = () => createLevelRun({
            levelSource,
            boot: t.boot,
            noclip: t.noclip,
            noHazards: t.noHazards,
            noDamage: t.noDamage,
            grants: t.grants,
            persistence: t.persistence,
            equips: t.equips,
            pins: t.pins,
            save: t.save,
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        });
        const run = mk();
        const forecast = mk().arrowForecast();
        // ⛔ THE MUTATION: the walk is told the player never left the spawn, so
        // the button is never pressed and the ceiling never arms.
        const spawn = { x: run.state.x, y: run.state.y };
        let firstDisagreement = null;
        for (let i = 0; i < TICKS && firstDisagreement === null; i += 1) {
            const predicted = forecast.step(spawn).map((a) => a.id).sort().join(',');
            run.advance(heldKeysAt(t, i));
            const live = run.arrowFlights.filter((a) => a.v.x !== 0 || a.v.y !== 0)
                .map((a) => a.id).sort().join(',');
            if (predicted !== live) firstDisagreement = i;
        }
        expect(firstDisagreement).not.toBeNull();
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 6 — THE PRESS ARM AGAINST A BODY THAT MOVES ON ITS OWN.
 *
 * `KILL_ARM_POLICY.Spinner` flipped `refused` -> `modelled` this slice. These
 * rows are the model-side half of the conversion; the game-side half is
 * `r8-l18-spinner-press`, recorded against the differential.
 */
describe('R8 slice 6: the Spinner press arm', () => {
    const src = atlasLevelSource();
    const boot = { level: 18, x: 16, y: 112 };
    const l18 = () => createLevelRun({
        levelSource: src, boot, noclip: false, noHazards: [], noDamage: true,
        grants: [], persistence: [], despawn: [], equips: [], pins: [],
        save: null, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });

    /**
     * ⛔ THE WITNESS IS THE TICK AND THE SOURCE OF EACH TEST, NEVER A COUNT
     * (trap 113). `spinnerPressHits` is one row per HIT TEST because a press
     * is five of them and the RECEIVER decides how many land — a ledger keyed
     * on presses could not say "one landed and four were refused".
     */
    it('⛔ ONE PRESS IS FIVE TESTS AND ONE HIT — the receiver\'s i-frame refuses 2..5', () => {
        const run = l18();
        // Stand where `spinner@48,96`'s orbit begins and swing once it is in
        // reach. The stance is chosen; the COUNT is the mechanism's.
        const stance = { x: 56, y: 104 };
        for (let i = 0; i < 400; i += 1) {
            if (hasArrived(run.state, stance, DEFAULT_TOLERANCE)) break;
            run.advance(chooseHeld(run.state, stance, DEFAULT_TOLERANCE));
        }
        let pressed = false;
        for (let i = 0; i < 200 && !pressed; i += 1) {
            const b = run.spinnerBodies.find((s) => s.id === 'spinner@48,96');
            const reach = b ? distanceRectPoint(run.state.x, run.state.y, b.rect) : Infinity;
            if (reach <= SLASH_REACH && b.hitsTimer === 0) {
                run.advance(new Set(['primary']));
                pressed = true;
            } else {
                run.advance(new Set());
            }
        }
        expect(pressed).toBe(true);
        for (let i = 0; i < 8; i += 1) run.advance(new Set());
        const tests = run.spinnerPressHits;
        /**
         * ⛓⛓⛓ AND A THIRD MECHANISM CULLS THE FIVE TESTS — the BODY'S OWN
         * MOTION, which is new on this roster.
         *
         * §14.4 measured two: the RECEIVER's i-frame (a row per refusal) and
         * the Owl's recession out of the 16 px reach (trap 114 — the reach
         * gate leaves a row, the sweep's absence does not). A spinner adds
         * the third: it drifts out of the RECT between tests, and
         * `pressRespondersIn` then reports no responder at all, so tests 2..5
         * leave NO ROW. ⇒ the count of rows is not five and asserting five
         * would be asserting the weapon's animation instead of the mechanism.
         */
        expect(tests.length).toBeGreaterThanOrEqual(1);
        const landed = tests.filter((h) => h.landed);
        // ⛔ EXACTLY ONE LANDS. The four behind it are refused BY THE
        // RECEIVER, and each says so — the Owl's `justKnock` arm sets no
        // timer and takes all five (§14.4), which is why the count is
        // derived per class rather than assumed per weapon.
        expect(landed).toHaveLength(1);
        for (const h of tests.filter((x) => !x.landed && x.reach <= SLASH_REACH)) {
            expect(h.why).toMatch(/i-frames/);
        }
        // The TICKS are consecutive — the five tests are five ticks, not one.
        const ticks = tests.map((h) => h.t);
        expect(new Set(ticks).size).toBe(ticks.length);
    });

    /**
     * ⛔⛔⛔ THE TWO CONSEQUENCES, BOTH COMPUTED — and this is the first
     * `modelled` kill arm whose kill-lock scan is NOT a nil.
     */
    it('⛔ the second kill takes totalEnemies() to zero and OPENS `lock@144,112`', () => {
        const tape = JSON.parse(readFileSync(join(
            dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tapes',
            'r8-l18-spinner-press.json'), 'utf8'));
        const t = parseTape(tape);
        const run = createLevelRun({
            levelSource: src, boot: t.boot, noclip: t.noclip, noHazards: t.noHazards,
            noDamage: t.noDamage, grants: t.grants, persistence: t.persistence,
            despawn: t.despawn ?? [], equips: t.equips, pins: t.pins ?? [],
            save: t.save ?? null, rng: t.rng ?? null, seam: t.seam ?? null, roles: ROLES,
        });
        for (let i = 0; i < t.tick_count; i += 1) run.advance(new Set(heldKeysAt(t, i)));
        const kills = run.spinnerPressKills;
        expect(kills).toHaveLength(2);
        // `CORPSE_COUNTING.Spinner` is a `fade` row — no animation stage — so
        // the removal is the killing tick plus `MOBILE_DEATH_FADE.ticks`.
        for (const k of kills) expect(k.removedTick - k.t).toBe(11);
        const scans = run.spinnerKillLocks;
        expect(scans).toHaveLength(2);
        // ⛓ THE FIRST IS A NIL AND THE SECOND IS NOT, and the ledger RAN for
        // both — "there were no kill locks" and "nobody looked" print the
        // same thing otherwise (§9.3's law).
        expect(scans[0].nil).toBe(true);
        expect(scans[1].nil).toBe(false);
        expect(scans[1].opens).toEqual([{ level: 18, tag: 0 }]);
        /**
         * ⛔ AND EACH REMOVAL WRITES **OUT OF BAND**. Both placements carry
         * `tag = "-1"`; `Main.levelPersistenceSet` indexes `level*30 + tag`
         * with no bounds check, so the write lands on {17,29}. Kickoff §13.10
         * measured this consequence as NIL — "the write is a no-op" — and it
         * is not.
         */
        const writes = run.spinnerWrites;
        expect(writes).toHaveLength(2);
        for (const w of writes) {
            expect(w.outOfBand).toBe(true);
            expect(w.flag).toEqual({ level: 17, tag: 29, value: false });
        }
        /**
         * ⛔⛔ AND IT IS A LEDGER ENTRY, NEVER A PERMISSION (trap 120's law
         * from the other side). An out-of-band slot is one no entity reads —
         * that is what −1 MEANS — so banking it as a clear makes the next
         * build of that level throw "the tape clears tag(s) 29, which no
         * entity in this level reads". `r5-feather` measured exactly that.
         */
        expect((run.earnedClears ?? []).some((c) => c.level === 17)).toBe(false);
    });

    /**
     * ⛔ THE HAMMER IS A NAMED REFUSAL, NOT A SILENT ZERO — the model does
     * not carry `Game.time`, so the ANGLE is not predictable and the honest
     * union is the disc.
     */
    it('⛔ an honest tape whose player enters the hammer disc is REFUSED by name', () => {
        const run = createLevelRun({
            levelSource: src, boot, noclip: false, noHazards: [], noDamage: false,
            grants: [], persistence: [], despawn: [], equips: [], pins: [],
            save: null, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const stance = { x: 56, y: 104 };
        expect(() => {
            for (let i = 0; i < 400; i += 1) {
                run.advance(chooseHeld(run.state, stance, DEFAULT_TOLERANCE));
            }
        }).toThrow(/HAMMER REACH/);
        // ⚠ AND THE SAME WALK UNDER `noDamage` IS FINE — `Player.hit`'s first
        // line is `if (Bot.noDamage) return`, which is why every committed
        // spinner-room tape has walked straight through one.
        const inert = l18();
        for (let i = 0; i < 400; i += 1) {
            inert.advance(chooseHeld(inert.state, stance, DEFAULT_TOLERANCE));
        }
        expect(inert.playerHits).toHaveLength(0);
    });
});

/**
 * ── ⛔⛓ THE POD GATE (editor arc slice 8, charge A) ────────────────────────
 *
 * `owlStateFor` level-filtered the BOSS list and not the POD list, so
 * `run.owlPods` answered `pod0..pod3` at the Owl arena's coordinates from
 * ANY level — the editor arc's slice-6 audit measured it in **153 tapes out
 * of 153**, the highest hit-rate of any channel in its sweep (kickoff §14.3b).
 *
 * ⛓ WHY IT NEVER BIT, AND WHY THAT IS THE DANGEROUS PART: every present
 * reader stands inside the Owl's own room, where the answer was right. The
 * cost was owed to the NEXT reader — a pod overlay would have painted his
 * arena furniture into every room in the game at plausible coordinates, with
 * nothing on the page able to say so. These rows are the ones that would have
 * caught it, written from outside that room.
 */
describe('run.owlPods — the level gate the boss half always had', () => {
    /** A room with no `finalboss` and no `pod` in its `.oel`. */
    it('⛔ is EMPTY in a bossless room — it used to report four', () => {
        const run = createLevelRun({ levelSource, boot: { level: 0, x: 80, y: 128 } });
        expect(run.finalBosses).toEqual([]);
        expect(run.owlPods).toEqual([]);
    });

    /**
     * ⚠ THE SPREAD MATTERS, not one sample. The old behaviour was uniform
     * across every level, so a single bossless room could be explained away;
     * a sweep of the rooms this arc's walks actually visit cannot.
     */
    it('⛔ …and in EVERY room the campaign route walks through', () => {
        const rooms = [0, 2, 3, 4, 5, 6, 8, 11, 14, 15, 16, 18];
        const reported = [];
        for (const level of rooms) {
            const run = createLevelRun({ levelSource, boot: { level, x: 16, y: 16 } });
            if (run.owlPods.length > 0) reported.push({ level, pods: run.owlPods.length });
        }
        expect(reported).toEqual([]);
    });

    /**
     * ⛓⛓⛓ THE POSITIVE CONTROL — the gate must not have cost the Owl his pods.
     * L112 is his arena, and the four come back in `podPositions` ORDER, which
     * is NOT the `.oel`'s: `FinalBoss.check()` walks `podPositions` and
     * collides at each, so the boss's pod 1 is the level's pod 2. The order is
     * asserted, not just the count, because a gate that rebuilt the list would
     * be free to rebuild it in file order and the walk would still look
     * plausible.
     */
    it('⛓⛓⛓ the OWL ROOM still has all four, in `podPositions` order', () => {
        const run = createLevelRun({
            levelSource, boot: { level: 112, x: 120, y: 176 }, roles: ROLES,
        });
        expect(run.finalBosses.length).toBe(1);
        expect(run.owlPods.map((p) => `${p.x},${p.y}`))
            .toEqual(['120,56', '48,128', '120,200', '192,128']);
    });

    /**
     * ⚠⛔ THE SECOND DELTA, NAMED RATHER THAN DISCOVERED LATER. The gate also
     * empties `owlPods` for a COMBAT-BLIND run standing in L112 — and that is
     * the CENSUS's answer, not the gate's invention: `levelWorld` pushes a
     * `pod` only under `consults.has('combat')`, so a relaxed run's L112
     * holds no boss AND no pod. Reporting four there was the same manufactured
     * furniture as reporting four in a corridor, one room further in where it
     * looked most plausible.
     *
     * ⛓ Nothing live reads it: `stepOwlNow` returns at `bosses.size === 0`
     * before it touches the pod list, which is why the fix is inert.
     */
    it('⚠ a COMBAT-BLIND run in L112 reports none — the census refuses them too', () => {
        const run = createLevelRun({
            levelSource, boot: { level: 112, x: 120, y: 176 }, roles: RELAXED_ROLES,
        });
        expect(run.finalBosses).toEqual([]);
        expect(run.worldFor(112).pods).toEqual([]);
        expect(run.owlPods).toEqual([]);
    });
});

/**
 * ⛓⛓⛓ PROCGEN ELEMENTS ARC 3, SLICE 2d — THE FORECAST MEMO'S ONLY CLAIM.
 *
 * `spinnerForecast` now keeps ONE forecast per tick and slices or EXTENDS it
 * for every later request, because probe 2b profiled `deriveStrike` →
 * `dangerDuringTransit` → `spinnerForecast` → `stepSpinner` at 65% of a 39 s
 * solve (kickoff §9b.2). A cache is only allowed here if it is invisible, so
 * the claim is EQUALITY WITH A COLD ONE and nothing else.
 *
 * ⛔ THE REFERENCE ARM IS A RUN PER QUERY. A second call on the SAME run would
 * be the memo grading itself; a fresh run driven to the same tick and asked
 * ONCE has a cold memo, which is byte-for-byte the function that shipped
 * before this slice.
 */
describe('⛓⛓⛓ arc 3 slice 2d: the memoised spinner forecast', () => {
    const src = atlasLevelSource();
    const boot = { level: 18, x: 16, y: 112 };
    const mk = () => createLevelRun({
        levelSource: src, boot, noclip: false, noHazards: [], noDamage: true,
        grants: [], persistence: [], despawn: [], equips: [], pins: [],
        save: null, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });
    const NONE = new Set();
    /** A run driven to tick `t` and asked ONCE — the pre-memo behaviour. */
    const coldAt = (t, h) => {
        const r = mk();
        for (let i = 0; i < t; i += 1) r.advance(NONE);
        return r.spinnerForecast(h);
    };

    it('⛔ MEMOISED === COLD, over 3 ticks × 6 horizons, in a hostile query order', () => {
        // ⛓ NON-VACUITY FIRST: L18 is the two-body room the claim is about.
        expect(mk().spinnerBodies.map((b) => b.id))
            .toEqual(['spinner@48,96', 'spinner@112,48']);

        const HORIZONS = [1, 2, 3, 5, 12, 40];
        const subject = mk();
        let compared = 0;
        for (let t = 0; t < 3; t += 1) {
            /**
             * ⛔ BOTH MEMO PATHS AT EVERY TICK. Longest-first makes every
             * later query a SLICE of a longer row set; shortest-first makes
             * every later query EXTEND a shorter one from where it stopped.
             * Testing one order would leave half the mechanism unmeasured.
             */
            const order = t % 2 === 0 ? [...HORIZONS].reverse() : [...HORIZONS];
            for (const h of order) {
                expect(subject.spinnerForecast(h)).toEqual(coldAt(t, h));
                compared += 1;
            }
            // ...and the same horizon twice: the plain cache hit.
            expect(subject.spinnerForecast(order[0])).toEqual(coldAt(t, order[0]));
            subject.advance(NONE);
        }
        expect(compared).toBe(18);
    });

    /**
     * ⛔⛔ THE ROW THAT MAKES THE ONE ABOVE MEAN SOMETHING. A memo served
     * across `advance` would be caught only if the forecast actually MOVES
     * between ticks — otherwise "memoised === cold" is satisfied by a
     * function that returns the same thing for ever.
     */
    it('⛔ NON-VACUITY: the forecast MOVES with the tick, so a stale memo is visible', () => {
        /**
         * ⛔⛔ THE FIRST TICK IS THE WRONG ONE TO ASK ON, and the mutant is
         * what said so (trap 306). Written as `spinnerForecast → advance →
         * spinnerForecast` from tick 0 this row PASSED under the memo-without-
         * the-tick-key mutant — not because the key worked, but because
         * `firstTickInWorld` flips `true -> false` across exactly that
         * `advance` and a DIFFERENT clause of the key caught it. A property
         * guarded twice needs the measurement taken where only ONE guard is
         * live: from tick 1 onward `firstTickInWorld` is false on both sides
         * and the tick is the only thing that has moved.
         */
        const run = mk();
        run.advance(NONE);
        const before = run.spinnerForecast(4);
        run.advance(NONE);
        const after = run.spinnerForecast(4);
        expect(after).not.toEqual(before);
        expect(after).toEqual(coldAt(2, 4));
        expect(before).toEqual(coldAt(1, 4));
    });

    /**
     * ⚠ THE LENGTH LAW THE OLD LOOP HAD, KEPT. `for (i = 0; i < n; …)` yields
     * `ceil(n)` rows and none at all for `n <= 0` or `NaN` — no caller passes
     * those, and a `slice(0, n)` that quietly re-derived the length would be
     * a behaviour change hiding inside a cache.
     */
    it('⚠ the row COUNT is the old loop\'s, including for arguments nobody passes', () => {
        const run = mk();
        expect(run.spinnerForecast(0)).toEqual([]);
        expect(run.spinnerForecast(-2)).toEqual([]);
        expect(run.spinnerForecast(Number.NaN)).toEqual([]);
        expect(run.spinnerForecast(4).length).toBe(4);
        expect(run.spinnerForecast(2.5).length).toBe(3);
        expect(run.spinnerForecast(7).length).toBe(7);
    });
});
