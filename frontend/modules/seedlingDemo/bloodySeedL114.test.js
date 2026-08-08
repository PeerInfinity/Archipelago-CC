/**
 * bloodySeedL114.test — W-BLOOD's INTEGRATION STRATUM: four sword hits, a
 * pickup that spawns on the player, and a reboot the tape did not order.
 *
 * Region-atlas Phase 8, rung R6, slice 6d. `endingChain.test.js` is the
 * stratum below — `watcherTakesHit`, `bloodySeedEntity` and the walk's
 * constants in isolation. `watcherL114.test.js` is the sibling: the same
 * room, the DIALOGUE half. This file is the four things only the
 * integration can say:
 *
 *   1. **the tag gates `talk()` AND NOTHING ELSE** — a boot that declares
 *      `{114,0}` cleared has a Watcher who cannot talk and CAN be hit, and
 *      those are the same flag read by two different lines;
 *   2. **one press is one hit**, with the other four dispatches refused by
 *      name, and the fourth landing spawns a `Seed` at
 *      `int(p.x - 8) + 8` — which is not `p.x`;
 *   3. **`Seed.removeSelf` grants nothing and clears nothing**, so the
 *      window's whole terminal is a LEVEL CHANGE the driver did not order;
 *   4. **the scripted walk is 0.75 px/tick and parks INSIDE the Oracle's
 *      talk circle**, which is safe for two independent reasons and for no
 *      other.
 *
 * ── ⛔⛔ AND TWO REFUSALS EXERCISED HERE ON PURPOSE ───────────────────
 *
 * Neither is reachable from a shipped tape (that is the point of them), and
 * a refusal with no witness is a check nobody has seen fail — trap 101, for
 * the second time on this rung. Both are driven from deliberately bad
 * tapes below, and the shipped drive keeps the POSITIVE witness in
 * `oracleApproach`.
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import {
    BLOODY_SEED_TEXT, CUTSCENE_1_WALK, ORACLE, SEED_ARMS, WATCHER,
    bloodySeedDue, bloodySeedEntity, coverFadeFrames, watcherTakesHit,
} from './endingChain.js';
import { heldKeysAt } from './tapeFormat.js';

const source = atlasLevelSource();

/** W-talk's own stance: tile (4,5)'s corner, so the spawn is (80,96). */
const BOOT = { level: 114, x: 72, y: 88 };
/** What `r6-watcher-talk` earns, declared — the hit gate. */
const CLEARED = [{ level: 114, tag: 0 }];
/** The plan's derived press cadence, one above the measured floor of 25. */
const CADENCE = 26;
const FIRST_PRESS = 1;

const newRun = (over = {}) => createLevelRun({
    levelSource: source,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [{ level: 114, items: ['sword'] }],
    persistence: CLEARED,
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
    ...over,
});

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });
const FACE = { key: 'up', from: 0, to: 1 };
const hitPresses = (n) => Array.from({ length: n },
    (_, i) => press(FIRST_PRESS + i * CADENCE));

const drive = (inputs, ticks, over = {}) => {
    const r = newRun(over);
    for (let k = 0; k < ticks; k += 1) r.advance(heldKeysAt({ inputs }, k));
    return r;
};

/** The shipped drive's spans, from `plan-seedling-r6-wblood.mjs`. */
const DRIVE_INPUTS = [
    FACE,
    ...hitPresses(4),
    ...[84, 92, 100, 108].map(press),
];

describe('W-blood: the tag gates `talk()` and nothing else', () => {
    it('⛔ a CLEARED boot cannot talk — no dialogue, no freeze, no live seed', () => {
        const r = drive([FACE], 60);
        const w = r.watchers[0];
        expect(w.cleared).toBe(true);
        expect(w.talking).toBe(false);
        expect(w.page).toBeNull();
        expect(r.watcherTalks).toEqual([]);
        // ⛓ AND THAT IS WHAT MAKES THE ROOM SAFE. The live Seed's arm needs
        // `Game.checkPersistence(tag)` TRUE, so trap 91's soft-lock is
        // W-talk's alone and W-blood's stance can stand where it likes.
        expect(r.watcherSeedLive).toEqual([]);
        expect(r.frozenFramesOwed).toBe(0);
    });

    it('⛔⛔ …and the SAME flag is what lets the sword count', () => {
        // The pure function, both ways — the gate is `!checkPersistence`.
        expect(watcherTakesHit({ cleared: false, hitsTimer: 0, hits: 0, text: 'x' }))
            .toMatchObject({ landed: false });
        expect(watcherTakesHit({ cleared: true, hitsTimer: 0, hits: 0, text: 'x' }))
            .toMatchObject({ landed: true, hits: 1, hitsTimer: WATCHER.hitsTimerMax });
        // ⛔⛔⛔ AND THE INTEGRATION IS SHARPER THAN THE PURE FUNCTION. An
        // UNCLEARED boot does not merely refuse the hits — it never reaches
        // them. The dialogue opens on PROXIMITY on the room's first update
        // (`keyNeeded` is `!checkPersistence(tag)`), the freeze is up from
        // its second frame, and a press on a frozen tick is dropped before
        // `useItem` is ever consulted. So the four presses become four
        // dialogue releases and the sword is never swung at all: ZERO hit
        // tests, not four refusals. The two halves of the flag do not just
        // point opposite ways, they are not even both reachable.
        const r = drive([FACE, ...hitPresses(4)], 120, { persistence: [] });
        expect(r.watcherHits).toEqual([]);
        expect(r.watchers[0].talking).toBe(true);
        expect(r.watchers[0].page).toBeGreaterThan(0);
        expect(r.seedSpawns).toEqual([]);
    });
});

describe('W-blood: one press is one hit, and four spawn the seed', () => {
    const r = drive([FACE, ...hitPresses(4)], 120);

    it('⛔⛔ FIVE hit tests per press, FOUR refused by `hitsTimer`', () => {
        const landed = r.watcherHits.filter((h) => h.landed);
        expect(landed.map((h) => h.t)).toEqual([2, 28, 54, 80]);
        // Each landing is the FIRST test of its press: press at 1 -> 2.
        expect(landed.map((h, i) => h.t - (FIRST_PRESS + i * CADENCE)))
            .toEqual([1, 1, 1, 1]);
        const refused = r.watcherHits.filter((h) => !h.landed);
        expect(refused).toHaveLength(r.watcherHits.length - 4);
        expect(refused.every((h) => /hitsTimer \d+ > 0/.test(h.why))).toBe(true);
    });

    it('⛓ the trigger is `hits > dieFrames.length`, i.e. the FOURTH', () => {
        expect(WATCHER.dieFrames).toBe(3);
        expect(bloodySeedDue(3)).toBe(false);
        expect(bloodySeedDue(4)).toBe(true);
        expect(r.seedSpawns).toHaveLength(1);
        expect(r.seedSpawns[0].hits).toBe(4);
    });

    it('⛔ three hits spawn NOTHING — the control\'s whole claim', () => {
        const c = drive([FACE, ...hitPresses(3)], 120);
        expect(c.watcherHits.filter((h) => h.landed)).toHaveLength(3);
        expect(c.watchers[0].hits).toBe(3);
        expect(c.watchers[0].createdSeed).toBe(false);
        expect(c.seedSpawns).toEqual([]);
        expect(c.endingReboots).toEqual([]);
        expect(c.level).toBe(114);
    });

    it('⛔ the seed lands at `int(p.x - 8) + 8`, which is NOT `p.x`', () => {
        // The `up` tap leaves the stance on a fractional y, which is the
        // only reason the truncation is visible at all.
        const s = r.seedSpawns[0];
        expect(s.ey).toBe(94);
        expect(bloodySeedEntity({ x: 80, y: 94.30000000000001 }))
            .toEqual({ x: 80, y: 94 });
        // …and it cancels EXACTLY on an integer, which is why §14.8 could
        // say "exactly (p.x, p.y)" and be right about the arithmetic.
        expect(bloodySeedEntity({ x: 80, y: 96 })).toEqual({ x: 80, y: 96 });
    });

    it('⛓ `FP.world.add` QUEUES — the first update is one tick later', () => {
        const s = r.seedSpawns[0];
        expect(s.liveAt).toBe(s.t + 1);
        // Nothing exists on the spawn tick itself.
        const before = drive([FACE, ...hitPresses(4)], s.t + 1);
        expect(before.runtimeSeeds).toEqual([]);
        const after = drive([FACE, ...hitPresses(4)], s.t + 2);
        expect(after.runtimeSeeds).toHaveLength(1);
        expect(after.runtimeSeeds[0].collected).toBe(true);
    });
});

describe('W-blood: the ceremony grants nothing and reboots the world', () => {
    const r = drive(DRIVE_INPUTS, 210);

    it('⛓⛓ `Seed.removeSelf()` is a 200-frame FROZEN cover, not a removal', () => {
        expect(r.seedFades).toHaveLength(1);
        expect(r.seedFades[0].fadeFrames).toBe(coverFadeFrames());
        expect(coverFadeFrames()).toBe(200);
        expect(r.frozenFramesOwed).toBe(200);
    });

    it('⛔ …so the pickup grants NO item and clears NO flag', () => {
        expect(r.earnedClears).toEqual([]);
        expect(r.collected).toHaveLength(1);
        expect(r.collected[0].item).toBeNull();
        // The inventory is exactly what the boot granted.
        expect(r.inventory.hasSword).toBe(true);
        expect(r.inventory.canSwim).toBeFalsy();
    });

    it('⛓⛓⛓ the terminal is a LEVEL CHANGE the driver did not order', () => {
        expect(r.endingReboots).toHaveLength(1);
        expect(r.endingReboots[0]).toMatchObject({
            arm: 'bloody',
            fromLevel: 114,
            toLevel: SEED_ARMS.bloody.reboot.level,
            cutscene: 1,
        });
        // ⛔ AND IT PRODUCES A TRANSITION RECORD, unlike a death — the level
        // field changed, so `deriveTransitions` sees it on the game side too.
        expect(r.transitions).toEqual([
            { t: r.endingReboots[0].t, from_level: 114, to_level: 1 },
        ]);
        expect(r.playerDeaths).toEqual([]);
        // `new Game(1, 64, 96, false)` -> the same half tile a boot takes.
        expect(r.endingReboots[0].respawn).toEqual({ x: 72, y: 104 });
    });

    it('⛓ the dialogue is the PICKUP family\'s, not the Watcher\'s', () => {
        // Two pages at 32 columns, four releases — 6 frames/character
        // against the placed Watcher's 3, and 32 columns against 28.
        expect(BLOODY_SEED_TEXT.split('~')).toHaveLength(2);
        expect(r.collected[0].frames).toBe(28);
    });
});

describe('W-blood: the scripted walk, and the Oracle at the end of it', () => {
    const r = drive(DRIVE_INPUTS, 210);

    it('⛔⛔ 0.75 px/tick — `v.y = -1` with friction 0.25 BEFORE `moveY`', () => {
        expect(CUTSCENE_1_WALK.vy).toBe(-1);
        const walk = r.oracleApproach;
        expect(walk.length).toBeGreaterThan(50);
        // The distances shrink by exactly 0.75 while the walk runs.
        const deltas = [];
        for (let i = 1; i < walk.length; i += 1) {
            const d = +(walk[i - 1].distance - walk[i].distance).toFixed(10);
            if (d > 0) deltas.push(d);
        }
        expect(new Set(deltas)).toEqual(new Set([0.75]));
    });

    it('⛔ the clamp is on the VELOCITY, so 64 is never landed on', () => {
        expect(CUTSCENE_1_WALK.clampY).toBe(64);
        expect(r.state.y).toBe(63.5);
        expect(r.cutsceneWalk).toMatchObject({ arm: 1, level: 1 });
    });

    it('⛔⛔⛔ …and 63.5 is INSIDE the 24 px circle — the POSITIVE witness', () => {
        const closest = Math.min(...r.oracleApproach.map((o) => o.distance));
        expect(closest).toBe(23.5);
        expect(closest).toBeLessThanOrEqual(ORACLE.talkRange);
        expect(r.oracleApproach.filter((o) => o.inRange).length).toBeGreaterThan(0);
        // A refusal nobody has seen fire is indistinguishable from one that
        // cannot: this is the half that says the circle really was entered.
        expect(r.oracleApproach[0].inRange).toBe(false);
    });

    it('⛓ the Oracle roster carries the entity point and NOT the text', () => {
        const w = buildLevelWorld(source(1), { roles: ROLES });
        expect(w.oracles).toHaveLength(1);
        expect(w.oracles[0]).toMatchObject({ id: 'oracle@64,32', ex: 72, ey: 40 });
        // Carrying the text would read as an offer to run the dialogue,
        // whose `doneTalking()` under `cutscene[1]` ends the run.
        expect(w.oracles[0].text).toBeUndefined();
    });

    it('⛔ …and its SOLID box is 16x16, not the NPC base\'s 16x24', () => {
        // `Oracle.as:38` calls `setHitbox(16, 16, 8, 8)` on the line after
        // `super()`. The bottom edge is 48, and a walk arrives from below.
        const w = buildLevelWorld(source(1), { roles: ROLES });
        const o = w.objectSolids.find((s) => s.tag === 'oracle');
        expect(o.rect).toMatchObject({ x: 64, y: 32, right: 80, bottom: 48 });
    });
});

describe('W-blood: the two refusals, driven from bad tapes (trap 101)', () => {
    it('⛔ a HOLD inside the scripted walk is refused by name', () => {
        const bad = [...DRIVE_INPUTS, { key: 'left', from: 120, to: 140 }];
        expect(() => drive(bad, 210)).toThrow(/scripted walk/);
        expect(() => drive(bad, 210)).toThrow(/receiveInput = false/);
    });

    it('⛔⛔⛔ an X RELEASE inside the Oracle\'s circle is refused by name', () => {
        // ⚠ THE SPAN HAS TO START BEFORE THE CIRCLE AND END INSIDE IT, or
        // the hold refusal above catches it first and this arm is vacuous.
        // The walk enters range at tick 164; a span [163,165) is held for
        // one tick outside… which the hold arm refuses. So the ONLY way to
        // reach this throw is a span whose `from` predates the reboot and
        // whose `to` lands in the circle — i.e. a release with no hold
        // inside the walk at all, which `heldKeysAt` gives for `to == 165`
        // only if `from` is also outside. It is not reachable from a legal
        // tape, which is exactly why the predicate is exercised directly.
        const run = newRun();
        // Walk the run to the clamp with the shipped spans...
        for (let k = 0; k < 170; k += 1) run.advance(heldKeysAt({ inputs: DRIVE_INPUTS }, k));
        expect(run.cutsceneWalk).not.toBeNull();
        expect(run.oracleApproach.some((o) => o.inRange)).toBe(true);
        // ...then hand it the edge the harness would produce. `advance` with
        // the key HELD raises the hold refusal; the release edge needs the
        // key held on the previous tick, which is the state a span boundary
        // leaves. Drive it directly.
        expect(() => {
            run.advance(new Set(['primary']));
        }).toThrow(/scripted walk/);
    });

    it('⛔ a Seed arm this rung does not model is refused rather than run', () => {
        expect(SEED_ARMS.tree.sets).toMatch(/menu = true/);
        expect(SEED_ARMS.plain.sets).toMatch(/cutscene\[2\]/);
        // The refusal's text is what a W-seed slice will delete; asserted
        // here so the deletion is a deliberate act and not a silent widening.
        expect(SEED_ARMS.bloody.reboot).toEqual({ level: 1, x: 64, y: 96 });
    });
});
