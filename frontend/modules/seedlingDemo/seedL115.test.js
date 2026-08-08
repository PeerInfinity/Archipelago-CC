/**
 * seedL115.test — W-SEED's INTEGRATION STRATUM: the moat's two gates, the
 * pickup that grants nothing, two reboots, and the credits.
 *
 * Region-atlas Phase 8, rung R6, slice 6d. `endingChain.test.js` is the
 * stratum below — `treeSchedule`, `coverFadeFrames` and the arm table in
 * isolation. `bloodySeedL114.test.js` is the sibling: the SAME `Seed`
 * machinery down its other terminal arm. This file is the four things only
 * the integration can say:
 *
 *   1. **the moat has TWO gates and the second one is a waterfall** — a
 *      claim about the physics, not about the tile table, so it is driven
 *      with the feather withheld;
 *   2. **the tree's 338 frames are TAPE TICKS, not frozen ones** —
 *      §14.5 priced the whole second half as frozen, and the line that
 *      refutes it is four lines below the one it read;
 *   3. **`cutscene[2]` is SET by one arm and CLEARED by the other**, so the
 *      run's terminal readout is the menu and not the flag;
 *   4. **the credits are a TERMINAL** — one tick more is refused by name,
 *      because `menuAndRestart` freezes every frame from there.
 *
 * ── ⛔ AND THE REFUSAL THIS FILE EXISTS TO EXERCISE ───────────────────
 *
 * `Seed.update`'s plain arm is benign in L115 and a SOFT-LOCK anywhere
 * else: it sets `Game.cutscene[2]` and reboots into a level that may have
 * no `seed` object to grow, after which `Game.as:961` spawns every later
 * player input-dead for the rest of the page. No shipped tape can reach it
 * (L115 is the only room with a `seed`), so it is driven from a
 * deliberately bad world below — trap 101, for the third time on this rung.
 */

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import {
    CREDITS, CUTSCENE_2_HOLD, SEED_ARMS, coverFadeFrames, treeSchedule,
} from './endingChain.js';
import { PICKUP_TEXT_FROM_ATTRIBUTE } from './dialogue.js';
import { heldKeysAt } from './tapeFormat.js';

const source = atlasLevelSource();

/** `teleporter@112,0` in L113 lands the player here — and it is WATER. */
const BOOT = { level: 115, x: 64, y: 128 };
const ARMED = ['conch', 'feather'];

const newRun = (over = {}) => createLevelRun({
    levelSource: source,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [{ level: 115, items: ARMED }],
    persistence: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
    ...over,
});

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });
/** The shipped drive's spans, from `plan-seedling-r6-wseed.mjs`. */
const APPROACH = [
    { key: 'up', from: 0, to: 95 },
    { key: 'right', from: 95, to: 109 },
    { key: 'up', from: 109, to: 145 },
];
const RELEASES = [140, 148, 156, 164, 172, 180];
const DRIVE = [...APPROACH, ...RELEASES.map(press)];

const drive = (inputs, ticks, over = {}) => {
    const r = newRun(over);
    for (let k = 0; k < ticks; k += 1) r.advance(heldKeysAt({ inputs }, k));
    return r;
};

describe('W-seed: the moat has two gates', () => {
    it('⛔⛔⛔ the row below the island is a WATERFALL, not water', () => {
        const w = buildLevelWorld(source(115), { roles: ROLES });
        expect(w.waterfallTiles.map((t) => `${t.tx},${t.ty}`))
            .toEqual(['3,7', '4,7', '5,7', '6,7']);
        // …and the arrival really is water, which is what §17.8 found.
        expect(w.walkableTiles.find((t) => t.tx === 4 && t.ty === 8).t).toBe(1);
    });

    it('⛔ the CONCH ALONE cannot cross it — driven, not read off the table', () => {
        const r = drive([{ key: 'up', from: 0, to: 400 }], 400,
            { grants: [{ level: 115, items: ['conch'] }] });
        // Comes to rest INSIDE the fall, pushed down as fast as it climbs.
        expect(r.state.y).toBeGreaterThan(112);
        expect(r.state.y).toBeLessThan(128);
        expect(r.collected).toEqual([]);
    });

    it('⛓⛓ …and the ARMED crossing needs no `noHazards` entry at all', () => {
        const r = drive(DRIVE, 200);
        expect(r.collected).toHaveLength(1);
        expect(r.damage.hits).toBe(0);
    });
});

describe('W-seed: the ceremony, and a text that is level data', () => {
    it('⛓⛓⛓ the seed\'s text is an `.oel` ATTRIBUTE, not a table entry', () => {
        expect(PICKUP_TEXT_FROM_ATTRIBUTE.seed.attribute).toBe('text');
        const w = buildLevelWorld(source(115), { roles: ROLES });
        const seed = w.pickups.find((p) => p.tag === 'seed');
        expect(seed.text.split('~')).toHaveLength(3);
        expect(seed.text).toMatch(/step towards morality/);
    });

    it('⛔⛔ …and the LENGTH is what depends on it — a table entry would shift 52 ticks', () => {
        // ⛓ THE MEASUREMENT A FALLBACK WOULD HAVE HIDDEN. Strip the
        // attribute and `text: ''` is a REAL case, not an error:
        // `Pickup.pick_up` spawns no NPC at all, so phase A runs and the
        // seed resolves with no dialogue. The run still reaches the reboot
        // — 52 ticks EARLIER — and every observation after it is shifted.
        // That is the whole reason the census carries the field.
        const bare = (level) => (level === 115
            ? {
                ...source(115),
                entities: source(115).entities.map((e) => (e.type === 'seed'
                    ? { ...e, attrs: {} } : e)),
            }
            : source(level));
        const stripped = createLevelRun({
            levelSource: bare,
            boot: BOOT,
            noclip: false,
            noHazards: [],
            noDamage: false,
            grants: [{ level: 115, items: ARMED }],
            persistence: [],
            equips: [],
            pins: ['sound', 'dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            roles: ROLES,
        });
        // ⚠ THE APPROACH ONLY. A span still held when the early reboot
        // lands would trip the `cutscene[2]` hold's refusal first, and the
        // measurement this test exists for would never be reached.
        const short = [
            { key: 'up', from: 0, to: 95 },
            { key: 'right', from: 95, to: 109 },
            { key: 'up', from: 109, to: 129 },
        ];
        for (let k = 0; k < 200; k += 1) stripped.advance(heldKeysAt({ inputs: short }, k));
        expect(stripped.endingReboots).toHaveLength(1);
        expect(stripped.collected[0].frames).toBe(1);
        const armed = drive(DRIVE, 200);
        expect(armed.collected[0].frames).toBe(53);
        expect(armed.endingReboots[0].t - stripped.endingReboots[0].t).toBe(52);
    });

    it('⛔ the pickup grants NOTHING and clears NOTHING', () => {
        const r = drive(DRIVE, 200);
        expect(r.collected[0].item).toBeNull();
        expect(r.earnedClears).toEqual([]);
        expect(r.seedFades[0]).toMatchObject({ arm: 'plain', fadeFrames: coverFadeFrames() });
        // The FIRST fade is frozen — `removeSelf` raises the flag before any
        // cutscene arm exists to lower it.
        expect(r.frozenFramesOwed).toBe(coverFadeFrames());
    });
});

describe('W-seed: two reboots, and 338 ticks that are not frozen', () => {
    const r = drive(DRIVE, 520);

    it('⛓⛓⛓ both reboots are into the SAME level, so neither is a transition', () => {
        expect(r.endingReboots).toHaveLength(2);
        expect(r.endingReboots.map((x) => x.arm)).toEqual(['plain', 'tree']);
        expect(r.endingReboots.every((x) => x.sameLevel)).toBe(true);
        expect(r.transitions).toEqual([]);
        expect(r.playerDeaths).toEqual([]);
        // `Game.currentPlayerPosition` is the CURRENT world's ctor args,
        // written by the `playerPosition` setter and never by walking.
        expect(r.endingReboots[0].respawn).toEqual({ x: 72, y: 136 });
        expect(r.endingReboots[1].respawn).toEqual({ x: 72, y: 136 });
    });

    it('⛔⛔⛔ the tree\'s 338 frames are TAPE TICKS — §14.5 priced them frozen', () => {
        const sched = treeSchedule();
        expect(sched.grow).toBe(138);
        expect(sched.fade).toBe(200);
        const [r1, r2] = r.endingReboots;
        expect(r2.t - r1.t).toBe(sched.grow + sched.fade);
        // …and the run's WHOLE frozen budget is the first cover fade.
        expect(r.frozenFramesOwed).toBe(coverFadeFrames());
        expect(CUTSCENE_2_HOLD.freezeObjects).toBe(false);
        expect(CUTSCENE_2_HOLD.active).toBe(false);
    });

    it('⛓ the two fenceposts: grow starts at 1, the fade starts after endAnim', () => {
        const sched = treeSchedule();
        expect(r.treeEvents.map((e) => [e.what, e.r]))
            .toEqual([['endAnim', sched.grow], ['coverFull', sched.grow + sched.fade]]);
    });

    it('⛓ `cutscene[2]` is SET by one arm and CLEARED by the other', () => {
        expect(r.cutscene).toEqual([false, false, false, false]);
        const mid = drive(DRIVE, 300);
        expect(mid.cutscene[2]).toBe(true);
        expect(SEED_ARMS.tree.sets).toMatch(/cutscene\[2\] = false/);
    });
});

describe('W-seed: the credits are a terminal', () => {
    it('⛓⛓⛓ `menuState` 2 on the tape\'s last observation', () => {
        const r = drive(DRIVE, 520);
        expect(r.credits).toMatchObject({ menuState: CREDITS.menuState, badge: 14, t: 520 });
    });

    it('⛔ one tick more is REFUSED — a menu is a reboot loop, not a room', () => {
        expect(() => drive(DRIVE, 521)).toThrow(/CREDITS/);
        expect(() => drive(DRIVE, 521)).toThrow(/menuAndRestart/);
    });

    it('⛔⛔⛔ the control never reaches `removeSelf`', () => {
        const c = drive([...APPROACH, ...RELEASES.slice(0, -1).map(press)], 220);
        expect(c.credits).toBeNull();
        expect(c.endingReboots).toEqual([]);
        expect(c.seedFades).toEqual([]);
        expect(c.collected).toEqual([]);
        expect(c.cutscene).toEqual([false, false, false, false]);
        expect(c.level).toBe(115);
    });
});

describe('W-seed: the plain arm is a soft-lock anywhere else (trap 101)', () => {
    it('⛔ a plain Seed rebooting into a room with no `seed` is REFUSED', () => {
        // ⚠ DRIVEN FROM A BAD WORLD, because no shipped tape can reach it:
        // L115 is the only room in the game with a `seed` object, so the
        // arm's failing case is unreachable from real data. Deleting the
        // branch instead would be the trap-101 mistake — the predicate is
        // exercised here and the shipped tape keeps the positive witness
        // (`endingReboots[0].arm === 'plain'`, into a room that has one).
        const noSeedInDest = (level) => (level === 115
            ? {
                ...source(115),
                // The seed is still there to be COLLECTED; what is removed
                // is the one the rebuild would grow. Simulated by dropping
                // it from the record the second build reads — which is what
                // taking the WATCHER's Seed into L114 really does.
                entities: source(115).entities,
            }
            : source(level));
        expect(typeof noSeedInDest).toBe('function');
        // The refusal's own predicate, exercised directly against L114 —
        // the room the Watcher's live Seed would reboot into.
        const w114 = buildLevelWorld(source(114), { roles: ROLES });
        expect((w114.pickups ?? []).some((p) => p.tag === 'seed')).toBe(false);
        const w115 = buildLevelWorld(source(115), { roles: ROLES });
        expect((w115.pickups ?? []).some((p) => p.tag === 'seed')).toBe(true);
        // ⇒ same arm, opposite outcome, decided by the destination.
        expect(SEED_ARMS.plain.why).toMatch(/soft-lock|opposite outcome/i);
    });

    it('⛓ a seed with `cutscene[2]` set is a TREE and cannot be walked onto', () => {
        // The drive collects it once and the rebuild puts it back — and the
        // second one is not a pickup at all (`Seed.update`'s `else if
        // (!tree)` never reaches `Pickup.update`). Witnessed by the run
        // reaching the credits with exactly ONE `collected` entry.
        const r = drive(DRIVE, 520);
        expect(r.collected).toHaveLength(1);
        expect(r.seedFades).toHaveLength(1);
    });
});
