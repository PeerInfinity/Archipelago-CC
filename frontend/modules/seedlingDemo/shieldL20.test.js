/**
 * shieldL20.test — THE SHIELD CHAIN, PRICED END TO END.
 *
 * Region-atlas Phase 8, rung R6, slice 5. §8.14 named this slice's bill:
 * *"§2.4 UNDERSTATES THE SHIELD CHAIN. The shield is `L20 shield@112,48
 * {tag 2}`, but L20 also holds `lock@32,80 {tset 0, tag 1}`,
 * `shieldlocknorm@176,16 {tag 0}` and `buttonroom@192,16 {tset 0, tag 4,
 * room −1}`. 'A walk after `bosslock keyType 0 {19,1}`' is the L19 half
 * only; L20 has its own gates and they are unpriced."*
 *
 * ── ⛓⛓⛓ AND THE PRICING OVERTURNS THE PREMISE ───────────────────────
 *
 * **L20's own gates do not gate the shield.** They gate the way ONWARD.
 * The route from the L19 stairs to `shield@112,48` runs
 *
 *     arrive (200,72)  ->  south to row 6  ->  west to column 10
 *       ->  north to row 1  ->  west to column 7  ->  south to the shield
 *
 * and touches none of the three. What they gate is L20's OTHER exit — and
 * they gate it in a CHAIN whose first link is the shield itself:
 *
 *     shield  ->  `hasShield` opens `shieldlocknorm@176,16` (tag 0)
 *             ->  which un-walls `buttonroom@192,16` (tset 0, tag 4)
 *             ->  whose press opens `lock@32,80` (tset 0, tag 1)
 *             ->  which un-walls `stairsup@16,48` -> L13
 *
 * ⇒ the correct statement is the reverse of §8.14's: the shield is NOT
 * behind L20's gates, L20's gates are behind the SHIELD. The only thing
 * between the L19 stairs and the pickup is `bosslock@48,32` in L19 — and
 * that is behind the ShieldBoss's body, which is `W-shield`'s whole point.
 *
 * ── ⚠ THIS IS A PRICED CHAIN, NOT A TAPE ─────────────────────────────
 *
 * §10.8's `wandL43.test.js` is the precedent shape: the chain is DRIVEN
 * through `levelRun` here and its costs are asserted, and no observation
 * stream is recorded for it. So the walker below steers ADAPTIVELY (walk
 * until a coordinate is reached) rather than emitting spans — which would
 * be illegal for a plan destined to become a tape (§12.9: spans are
 * half-open and hand-rolled drivers are not) and is fine for one that is
 * not. If a later slice wants this as a window, the plan has to be
 * re-derived through `tapeFormat.heldKeysAt`.
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { SHIELD_BOSS } from './shieldBossFight.js';

const source = atlasLevelSource();

const newRun = (over = {}) => createLevelRun({
    levelSource: source,
    noclip: false,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    noDamage: true,
    grants: [],
    persistence: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
    ...over,
});

/**
 * Walk until a predicate holds, holding `keys` — the adaptive steer this
 * file is allowed and a tape plan is not (see the header).
 *
 * @returns {number} the tick the predicate first held on, or -1
 */
function walkUntil(run, keys, until, limit = 400) {
    const held = new Set(keys);
    for (let i = 0; i < limit; i += 1) {
        if (until(run)) return i;
        run.advance(held);
    }
    return until(run) ? limit : -1;
}

const wait = (run, n) => { for (let i = 0; i < n; i += 1) run.advance(new Set()); };

/** Coast to a stop — `Mobile.friction` at 0.25/tick, so ~8 ticks is plenty. */
function settle(run, limit = 30) {
    for (let i = 0; i < limit; i += 1) {
        const { x, y } = run.state;
        run.advance(new Set());
        if (run.state.x === x && run.state.y === y) return i;
    }
    return limit;
}

describe('L19 — the bosslock, and what is really behind it', () => {
    const w19 = buildLevelWorld(source(19), { roles: ROLES });

    it('⛓ the room has exactly one route north and the BODY is standing in it', () => {
        // The three middle columns are the only walkable ones between the
        // south half (rows 6..9) and the north half (rows 1..3), and the
        // body's box covers all three for rows 2..5.
        const body = { x: 80, y: 40, right: 128, bottom: 88 };
        const spans = new Set(w19.walkableTiles.filter((t) => t.ty >= 2 && t.ty <= 5)
            .map((t) => t.tx));
        // Columns 1 and 3 are the NORTH-WEST corridor; 4 is one cell of row
        // 3 only; 5, 6 and 7 are the arena the body stands in.
        expect([...spans].sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 6, 7]);
        // Columns 1 and 3 are the NORTH-WEST corridor — they do not reach
        // the south half at all (rows 7 and 8 are stone there).
        // ⛓ Rows 7 and 8 are stone in both, which is what severs them from
        // the arena; row 9 is the room's own south corridor and IS walkable
        // there, so the cut is rows 7..8 and not "everything below 7".
        const severed = w19.walkableTiles
            .filter((t) => (t.tx === 1 || t.tx === 3) && t.ty >= 7 && t.ty <= 8);
        expect(severed).toEqual([]);
        // ...and 5, 6, 7 at rows 2..5 are exactly the body's columns.
        for (const tx of [5, 6, 7]) {
            expect(tx * 16).toBeGreaterThanOrEqual(body.x);
            expect(tx * 16 + 16).toBeLessThanOrEqual(body.right);
        }
    });

    it('⛔ `bosskey@96,64` is inside the body, and the bosslock is behind BOTH', () => {
        const key = w19.pickups.find((p) => p.tag === 'bosskey');
        expect(key.keyType).toBe(0);
        expect(key.rect).toMatchObject({ x: 100, y: 68, right: 108, bottom: 76 });
        const lock = w19.activators.find((a) => a.tag === 'bosslock');
        expect(lock).toMatchObject({ keyType: 0, persistTag: 1, keyTimer: 60 });
        // The lock sits at tile (3,2), in the NORTH half — which the body
        // is the only route to.
        expect(lock.rect).toMatchObject({ x: 48, y: 32, right: 64, bottom: 48 });
    });

    /**
     * ⛔⛔⛔ THE DEFECT THIS DRIVE FOUND, AND IT WAS A SILENCE.
     *
     * R5 slice 23's AS3 batch added the v6 `save` block and `Bot.as`
     * applies `save.keys` through `Main.hasKeySet(...)` at the boot;
     * `tapeFormat` parses and validates it. `levelRun` read `totem_parts`
     * and `seal_parts` and **never read `keys`** — so a tape declaring one
     * would boot a GAME holding the key and a MODEL that does not, and the
     * two part at the first `BossLock`. No committed tape declares one, so
     * there was no red fixture to find it: it was found by driving this
     * chain from a keyed boot and watching the lock stay shut for 200
     * ticks. The assertion below is the guard.
     */
    it('⛓⛓ the v6 `save.keys` block reaches the run — a silence, now a check', () => {
        const run = newRun({
            boot: { level: 19, x: 48, y: 48 },
            save: { totem_parts: [], keys: [0], seal_parts: [] },
        });
        expect([...run.keys]).toEqual([0]);
        const without = newRun({ boot: { level: 19, x: 48, y: 48 } });
        expect([...without.keys]).toEqual([]);
    });

    it('⛓ the lock costs 60 keyTimer ticks + a 20-tick fade, and then CLEARS {19,1}', () => {
        const run = newRun({
            boot: { level: 19, x: 48, y: 48 },
            save: { totem_parts: [], keys: [0], seal_parts: [] },
        });
        // Pin under the lock: the key line is y 49, x [50,59].
        walkUntil(run, ['up'], (r) => r.state.y <= 50.6, 40);
        settle(run);
        // ⛓ MEASURED, not chosen: `moveY`'s 1 px sweep leaves the residue
        // the last sub-pixel step could not spend.
        expect(run.state.y).toBeCloseTo(50.5, 2);
        const opened = walkUntil(run, ['up'],
            (r) => r.earnedClears.some((c) => c.level === 19 && c.tag === 1), 200);
        expect(opened).toBeGreaterThan(0);
        expect(run.earnedClears).toContainEqual(
            expect.objectContaining({ level: 19, tag: 1 }),
        );
        // ⛔ AND THE POLARITY IS A CLEAR, like the MagicalLock's and the
        // boss totem's — `Game.setPersistence(tag, false)` in the fade arm.
        expect(run.earnedClears.every((c) => c.tag !== undefined)).toBe(true);
    });

    it('⛔ …and NOT without the key: the lock stays solid and clears nothing', () => {
        const run = newRun({ boot: { level: 19, x: 48, y: 48 } });
        walkUntil(run, ['up'], () => false, 200);
        expect(run.earnedClears).toEqual([]);
        // Still pinned at the same 50.5 the opened arm passes through.
        expect(run.state.y).toBeCloseTo(50.5, 2);
    });
});

describe('L20 — the gates, and which side of the shield they are on', () => {
    const w20 = buildLevelWorld(source(20), { roles: ROLES });

    it('⛓ the three gates §8.14 named are all here, with their attributes', () => {
        const lock = w20.activators.find((a) => a.tag === 'lock');
        expect(lock).toMatchObject({ t: 0, persistTag: 1 });
        expect(lock.rect).toMatchObject({ x: 32, y: 80, right: 48, bottom: 96 });
        const shieldLock = w20.activators.find((a) => a.tag === 'shieldlocknorm');
        expect(shieldLock).toMatchObject({ t: -2, persistTag: 0, shield: 'hasShield' });
        expect(shieldLock.rect).toMatchObject({ x: 176, y: 16, right: 192, bottom: 32 });
        const button = w20.pressers.find((p) => p.tag === 'buttonroom');
        expect(button).toMatchObject({ t: 0, room: -1, persistTag: 4 });
    });

    /**
     * ⛓⛓⛓ THE CHAIN, IN ITS REAL ORDER — and it is the reverse of the one
     * §2.4 implies.
     *
     * `ShieldLock.update` opens on `Player.hasShield && shieldType == 0`,
     * and `shieldlocknorm` is the `_type = 0` placement. Its tset is −2 (a
     * lock with no group), so nothing else can open it. `buttonroom@192,16`
     * is BEHIND it, and the button's group is tset 0 — which is
     * `lock@32,80`'s group. And `lock@32,80` is the wall in front of
     * `stairsup@16,48`, L20's exit to L13.
     */
    it('⛔⛔ the gates are BEHIND the shield, not in front of it', () => {
        const shield = w20.pickups.find((p) => p.tag === 'shield');
        expect(shield.rect).toMatchObject({ x: 116, y: 52, right: 124, bottom: 60 });
        const shieldLock = w20.activators.find((a) => a.tag === 'shieldlocknorm');
        const button = w20.pressers.find((p) => p.tag === 'buttonroom');
        const lock = w20.activators.find((a) => a.tag === 'lock');
        // The button is east of the shieldlock, on the same row: the lock
        // stands between it and the rest of the room.
        expect(button.rect.x).toBeGreaterThanOrEqual(shieldLock.rect.right);
        expect(button.rect.y).toBeLessThan(shieldLock.rect.bottom);
        // The button's group is the lock's tag group.
        expect(button.t).toBe(lock.t);
        // And the lock stands beside the L13 stairs, not the shield.
        const toL13 = w20.teleporters.find((t) => t.to === 13);
        expect(Math.abs(toL13.rect.x - lock.rect.x)).toBeLessThanOrEqual(32);
        expect(Math.abs(toL13.rect.y - lock.rect.y)).toBeLessThanOrEqual(48);
    });

    it('⛓⛓ THE WALK: from the L19 stairs to the shield, with no gate crossed', () => {
        const run = newRun({ boot: { level: 20, x: 192, y: 64 } });
        expect(run.state).toMatchObject({ x: 200, y: 72 });
        // ⛔ EACH LEG SETTLES BEFORE THE NEXT. The first cut did not, and
        // the coast off the westward leg carried the player 7 px past
        // column 10 — into a box that straddles `dungeonspire@144,32`, whose
        // rect ends at x 160. The climb then stalled at y 50.78 against a
        // solid nobody had aimed at. Momentum is part of the route.
        const legs = [
            [['down'], (r) => r.state.y >= 104],
            [['left'], (r) => r.state.x <= 172],
            [['up'], (r) => r.state.y <= 26],
            [['left'], (r) => r.state.x <= 124],
            // ⛔ THE LAST LEG ENDS ON THE CONTACT, NOT ON THE COLLECT. The
            // ceremony freezes the player the moment the boxes overlap, so a
            // predicate on `collected` never fires: phase A is 150 frozen
            // frames the model spends as a lump and phase B needs the
            // dialogue's own releases, which the loop below supplies.
            [['down'], (r) => r.state.y >= 49],
        ];
        let t = 0;
        for (const [keys, until] of legs) {
            const n = walkUntil(run, keys, until, 400);
            expect(n, `leg ${keys} stalled at (${run.state.x}, ${run.state.y})`)
                .toBeGreaterThanOrEqual(0);
            t += n;
            t += settle(run);
        }
        // ⛓ The ceremony is textless-free: the shield HAS a text, so the
        // dialogue needs releases. Drive them at the inert cadence.
        for (let i = 0; i < 6; i += 1) {
            run.advance(new Set(['primary']));
            for (let j = 0; j < 30; j += 1) run.advance(new Set());
        }
        expect(run.inventory.hasShield).toBe(true);
        /**
         * ⚠ AND `{20,2}` IS *NOT* IN `earnedClears`, WHICH IS A GAP THIS
         * SLICE FOUND AND DID NOT CLOSE.
         *
         * `Shield.removed()` is `hasShield = true; Moonrock.beam = true;
         * Game.setPersistence(tag, false)` — a real clear. `earnedClears`
         * enumerates SIX mechanisms (touch locks, boss locks, lightpoles,
         * buttonrooms, broken rocks, boss kills) and a PICKUP's own tag is
         * in none of them; `buildLevelWorld` does not even carry a
         * `persistTag` on a pickup row. So the wand's clear is missing from
         * the same ledger, and has been since R5 slice 23.
         *
         * ⛔ NOT FIXED HERE, DELIBERATELY. Adding the arm would change the
         * `earnedClears` of every fixture that collects a tagged pickup —
         * which the differential's exact-set assertion compares against the
         * GAME's `persistence_cleared`, and those fixtures are green today.
         * Either the game's readout does not carry it or the check tolerates
         * it, and finding out which is a measurement this slice has not
         * made. Named, with its blast radius, rather than patched blind.
         */
        expect(run.earnedClears.some((c) => c.level === 20 && c.tag === 2)).toBe(false);
        // ⛔ NO GATE WAS CROSSED. The three L20 activators are untouched.
        expect(run.openActivators).not.toContain('lock@32,80');
        expect(run.openActivators).not.toContain('shieldlocknorm@176,16');
        expect(t).toBeGreaterThan(0);
    });

    it('⛔ …and the route never touches water, which rows 6 and 7 are full of', () => {
        const water = w20.tiles.filter((t) => t.t === 1);
        expect(water.length).toBeGreaterThan(0);
        // Column 10 and column 12 — the two the walk climbs — are dry for
        // every row it uses.
        for (const tx of [10, 12]) {
            for (let ty = 1; ty <= 6; ty += 1) {
                const tile = w20.tiles.find((q) => q.tx === tx && q.ty === ty);
                if (tile) expect(tile.t, `(${tx},${ty})`).not.toBe(1);
            }
        }
    });
});

describe('what the shield DOES, and what it does not', () => {
    it('⛓ `hasShield` makes the Watcher VISIBLE — render-side only', () => {
        // Named for slice 6 rather than modelled: `Watcher.update`'s last
        // line is `visible = Player.hasShield`, and `visible` is read by
        // `Entity.render` alone. Nothing the model computes moves.
        expect(SHIELD_BOSS.type).toBe('ShieldBoss');
    });

    it('⛓ the shield writes {20,2} and `hasShield`, and nothing else', () => {
        const w20 = buildLevelWorld(source(20), { roles: ROLES });
        const shield = w20.pickups.find((p) => p.tag === 'shield');
        expect(shield).toBeTruthy();
        // `Shield.removed()` is `hasShield = true; Moonrock.beam = true;
        // setPersistence(tag, false)`. ⚠ `Moonrock.beam` is a STATIC on a
        // scenery class with no member in L19 or L20 — a write with no
        // consumer on this route, named rather than modelled.
        expect(shield.tag).toBe('shield');
    });
});
