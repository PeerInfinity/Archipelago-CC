/**
 * r5Acceptance — every input mutated, every matching check asserted RED.
 *
 * The claim itself runs once per twenty-minute sweep against a passing
 * replay; a check that has never failed is indistinguishable from one that
 * cannot. This is where each one is made to fail.
 */

import { describe, expect, it } from 'vitest';
// ⛓ R5 slice 22: the exit-criteria block re-derives its counts from the
// committed roster on disk, which is the only stratum that can catch a
// record drifting away from the tapes it describes.
import { readFileSync, readdirSync } from 'node:fs';

import {
    L60_CONTROL, L60_KILL, L60_LOCK, l60KillFindings,
    KEY_LEG_ARM, KEY_LEG_CONTROL, keyLegFindings,
    BOBBOSS_FIRE, BOBBOSS_CONTROL, bobBossFindings,
    KARLORE_FIRE, KARLORE_CONTROL, karloreFindings,
    D5_CONCH, D5_CONCH_FLAG, D5_REST_TILE, d5ConchFindings,
    SWIM_CROSS, SWIM_DROWN, SWIM_LATCH_NAME, SWIM_LATCH_TICKS, SWIM_BOOST,
    SWIM_STEADY_STEP, swimPairFindings, swimLatchFindings,
    WF_SHUT, WF_CLIMB, WF_START_Y, WF_FACE_ROW, WF_CLIMB_ROW, waterfallPairFindings,
    L42_PART4_PAIR, l42Part4Findings,
} from './r5Acceptance.js';
import { rectsOverlap } from './levelWorld.js';

const arm = ({ cleared = [], x = 150, level = 60, hits = 0 } = {}) => ({
    stream: { ticks: [{ t: 0, x: 112, y: 88, level }, { t: 1, x, y: 88, level }] },
    status: { persistence_cleared: cleared, hits },
});

const LOCK_FLAG = { level: L60_LOCK.level, tag: L60_LOCK.tag };

const pair = (killOver = {}, controlOver = {}) => new Map([
    [L60_KILL, arm({ cleared: [LOCK_FLAG], x: 150, ...killOver })],
    [L60_CONTROL, arm({ cleared: [], x: 126, ...controlOver })],
]);

const failing = (findings) => findings.filter((f) => !f.ok && !f.skipped).map((f) => f.name);

describe('the L60 kill pair', () => {
    it('holds for the pair the plan predicts', () => {
        expect(failing(l60KillFindings(pair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        // A pair asserted from one arm is not a pair. It must not read as
        // green — but it must not read as red either, because a partial
        // sweep is a legitimate thing to run.
        const one = new Map([[L60_KILL, arm({ cleared: [LOCK_FLAG] })]]);
        const f = l60KillFindings(one);
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
        expect(f[0].detail).toMatch(/r5-l60-kill\b/);
        expect(l60KillFindings(new Map())[0].skipped).toBe(true);
        expect(l60KillFindings(null)[0].skipped).toBe(true);
    });

    it('goes red when the kill arm did NOT earn the flag', () => {
        expect(failing(l60KillFindings(pair({ cleared: [] }))))
            .toContain('R5 L60: the kill arm EARNED the lock flag');
    });

    it('goes red when the CONTROL arm opened the lock', () => {
        // The failure that would make the whole pair worthless: if the lock
        // opens without presses, nothing here says anything about the sword.
        expect(failing(l60KillFindings(pair({}, { cleared: [LOCK_FLAG] }))))
            .toContain('R5 L60: the CONTROL arm did not');
    });

    it('goes red when the control arm did not stop at the lock face', () => {
        // Past it: the lock was never solid.
        expect(failing(l60KillFindings(pair({}, { x: 150 }))))
            .toContain('R5 L60: the control arm PINS at the lock face');
        // Nowhere near it: the walk stopped for some other reason, and a
        // pin that could be anything is not a pin.
        expect(failing(l60KillFindings(pair({}, { x: 100 }))))
            .toContain('R5 L60: the control arm PINS at the lock face');
    });

    it('goes red when the kill arm did not actually cross', () => {
        expect(failing(l60KillFindings(pair({ x: 126 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
        // 145 puts the player's centre past the face but its box still
        // inside — `x - 2 >= 144` is the test, so 145 is not a crossing.
        expect(failing(l60KillFindings(pair({ x: 145 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
    });

    it('goes red when a crossing is really a DOOR', () => {
        // The east teleporter is 16 px past the lock. A walk that left L60
        // satisfies any x-only test, so the level is checked too.
        expect(failing(l60KillFindings(pair({ level: 61 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
    });

    it('goes red when the pair differs by more than the lock flag', () => {
        expect(failing(l60KillFindings(pair({ cleared: [LOCK_FLAG, { level: 60, tag: 4 }] }))))
            .toContain('R5 L60: the two ledgers differ ONLY by the lock flag');
        // And in the other direction: a flag the control arm has and the
        // kill arm lost.
        expect(failing(l60KillFindings(pair({ cleared: [LOCK_FLAG] },
            { cleared: [{ level: 12, tag: 0 }] }))))
            .toContain('R5 L60: the two ledgers differ ONLY by the lock flag');
    });

    it('goes red when either arm took damage', () => {
        // `noDamage` is armed on both, so a hit means the guard missed a
        // path — and then the positions are a knockback, not a walk.
        expect(failing(l60KillFindings(pair({ hits: 1 }))))
            .toContain('R5 L60: the kill arm took no damage');
        expect(failing(l60KillFindings(pair({}, { hits: 2 }))))
            .toContain('R5 L60: the control arm took no damage');
        // ⚠ And a MISSING readout is red too, not green: a build without
        // the R5 batch reports no `hits` at all, and `undefined === 0` is
        // false by design here.
        const noReadout = pair();
        delete noReadout.get(L60_KILL).status.hits;
        expect(failing(l60KillFindings(noReadout)))
            .toContain('R5 L60: the kill arm took no damage');
    });

    it('names the lock by its census values, not by a literal in the check', () => {
        expect(L60_LOCK).toMatchObject({ level: 60, tag: 0 });
        expect(L60_LOCK.rect).toMatchObject({ x: 128, right: 144 });
    });

    // ⚠ R5 SLICE 8, STEP 0: THE ABSENCE IS THE CLAIM. `L60_LOCK.rect` is an
    // X BAND — six scalar comparisons of a player x against its two edges —
    // and it has no `y`/`bottom` because the lock spans its corridor. A
    // sweep for malformed rects has to be able to tell that apart from a
    // rect somebody half-built, so the y-lessness is asserted rather than
    // left to look like an oversight, and the `band` field says so in the
    // data. Handing this to `rectsOverlap` would answer "no" forever.
    it('⚠ is an X BAND and not a rect — and says so, in the data', () => {
        expect(L60_LOCK.rect.y).toBeUndefined();
        expect(L60_LOCK.rect.bottom).toBeUndefined();
        expect(L60_LOCK.rect.band).toMatch(/x-only/);
        expect(rectsOverlap(
            { x: 130, y: 0, right: 140, bottom: 999 },
            L60_LOCK.rect,
        )).toBe(false);
    });
});

// ── Slice 4 step 1: THE KEY LEG ───────────────────────────────────────

const legArm = ({
    cleared = [{ level: 31, tag: 0 }, { level: 30, tag: 2 }],
    y = 184.28, x = 232.19, level = 30, hits = 0,
    items = { hitsMax: 3 },
    transitions = [{ from_level: 29, to_level: 31 }, { from_level: 31, to_level: 30 }],
} = {}) => ({
    stream: { ticks: [{ t: 0, x: 104, y: 40, level: 29 }, { t: 1, x, y, level }], transitions },
    status: { persistence_cleared: cleared, hits, items },
});

const controlArm = ({
    cleared = [], y = 226.1, x = 232, level = 30, hits = 0, items = { hitsMax: 3 },
} = {}) => ({
    stream: { ticks: [{ t: 0, x: 232, y: 242, level }, { t: 1, x, y, level }], transitions: [] },
    status: { persistence_cleared: cleared, hits, items },
});

const keyPair = (legOver = {}, controlOver = {}) => new Map([
    [KEY_LEG_ARM, legArm(legOver)],
    [KEY_LEG_CONTROL, controlArm(controlOver)],
]);

describe('the key leg and its shut-before control', () => {
    it('holds for the pair the game recorded', () => {
        expect(failing(keyLegFindings(keyPair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        const f = keyLegFindings(new Map([[KEY_LEG_ARM, legArm()]]));
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
        expect(f[0].detail).toMatch(/shut-before control/);
    });

    it('⛔ goes red when only ONE of the two locks opened', () => {
        // The finding this rung made: §2.6.1 prices one lock and the extract
        // has two. A claim phrased as "contains {30,2}" would pass here.
        expect(failing(keyLegFindings(keyPair({ cleared: [{ level: 30, tag: 2 }] }))))
            .toContain('R5 key leg: the ledger is EXACTLY the two locks the key opens');
        expect(failing(keyLegFindings(keyPair({ cleared: [{ level: 31, tag: 0 }] }))))
            .toContain('R5 key leg: the ledger is EXACTLY the two locks the key opens');
    });

    it('goes red when a THIRD flag came off', () => {
        // A pickup the walk knocked loose, or a lock nobody aimed at.
        expect(failing(keyLegFindings(keyPair({
            cleared: [{ level: 31, tag: 0 }, { level: 30, tag: 2 }, { level: 30, tag: 4 }],
        })))).toContain('R5 key leg: the ledger is EXACTLY the two locks the key opens');
    });

    it('goes red when the CONTROL arm cleared anything', () => {
        expect(failing(keyLegFindings(keyPair({}, { cleared: [{ level: 30, tag: 2 }] }))))
            .toContain('R5 key leg: the CONTROL arm cleared nothing at all');
    });

    it('goes red when the control arm did not pin on the lock face', () => {
        // Through it: the lock was not solid, so the pair attributes nothing.
        expect(failing(keyLegFindings(keyPair({}, { y: 184 }))))
            .toContain('R5 key leg: the control arm PINS on the lock\'s south face');
        // Short of it: the walk stopped for some other reason.
        expect(failing(keyLegFindings(keyPair({}, { y: 240 }))))
            .toContain('R5 key leg: the control arm PINS on the lock\'s south face');
    });

    it('goes red when the key arm did not get through', () => {
        expect(failing(keyLegFindings(keyPair({ y: 226.1 }))))
            .toContain('R5 key leg: the key arm is THROUGH it, inside the chamber');
        // ...and when it got through into a different ROOM, which is a claim
        // about a door rather than about a lock.
        expect(failing(keyLegFindings(keyPair({ level: 32 }))))
            .toContain('R5 key leg: the key arm is THROUGH it, inside the chamber');
    });

    it('goes red when either arm picked up an item', () => {
        expect(failing(keyLegFindings(keyPair({ items: { hitsMax: 3, hasTorch: true } }))))
            .toContain('R5 key leg: the key arm holds no ITEM');
        expect(failing(keyLegFindings(keyPair({}, { items: { hitsMax: 3, hasSword: true } }))))
            .toContain('R5 key leg: the control arm holds no ITEM');
        // ⚠ hitsMax is checked on its own: health has no boolean, so an arm
        // that gained it would otherwise be green.
        expect(failing(keyLegFindings(keyPair({ items: { hitsMax: 4 } }))))
            .toContain('R5 key leg: the key arm holds no ITEM');
    });

    it('goes red when either arm took damage', () => {
        expect(failing(keyLegFindings(keyPair({ hits: 1 }))))
            .toContain('R5 key leg: the key arm took no damage');
        expect(failing(keyLegFindings(keyPair({}, { hits: 2 }))))
            .toContain('R5 key leg: the control arm took no damage');
    });

    it('goes red when the walk visited different rooms', () => {
        expect(failing(keyLegFindings(keyPair({
            transitions: [{ from_level: 29, to_level: 21 }],
        })))).toContain('R5 key leg: the walk really went L29 → L31 → L30');
    });
});

// ── Slice 4 step 2: BOBBOSS ───────────────────────────────────────────

const ROCK = { level: 32, tag: 1 };
const OOB = { level: 31, tag: 29 };

const bossArm = ({
    cleared = [ROCK, OOB], hasFire = true, refused = true, hits = 0, level = 32,
} = {}) => ({
    stream: { ticks: [{ t: 0, x: 80, y: 128, level }, { t: 1, x: 80, y: 80.7, level }] },
    status: {
        persistence_cleared: cleared, hits, saw_input_refused: refused,
        items: { hitsMax: 3, hasSword: true, hasFire },
    },
});

const bossControl = ({
    cleared = [ROCK], hasFire = false, refused = false, hits = 0, level = 32,
} = {}) => ({
    stream: { ticks: [{ t: 0, x: 80, y: 128, level }, { t: 1, x: 80, y: 115.5, level }] },
    status: {
        persistence_cleared: cleared, hits, saw_input_refused: refused,
        items: { hitsMax: 3, hasSword: false, hasFire },
    },
});

const bossPair = (fireOver = {}, controlOver = {}) => new Map([
    [BOBBOSS_FIRE, bossArm(fireOver)],
    [BOBBOSS_CONTROL, bossControl(controlOver)],
]);

describe('the BobBoss pair — `fire` as the first combat-earned boolean', () => {
    it('holds for the pair the game recorded', () => {
        expect(failing(bobBossFindings(bossPair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        const f = bobBossFindings(new Map([[BOBBOSS_FIRE, bossArm()]]));
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
    });

    it('goes red when the fight did not finish', () => {
        // ⚠ The failure mode that matters most: `BobBoss` is
        // ONE-VISIT-OR-RESTART, so a partial fight leaves NOTHING behind and
        // the next entry respawns form 0.
        const f = bobBossFindings(bossPair({ hasFire: false, cleared: [ROCK] }));
        expect(failing(f)).toContain('R5 BobBoss: the fire arm EARNED `hasFire`');
        expect(f.find((x) => x.name.includes('EARNED')).detail)
            .toMatch(/ONE-VISIT-OR-RESTART/);
    });

    it('goes red when the SWORDLESS arm somehow earned fire', () => {
        expect(failing(bobBossFindings(bossPair({}, { hasFire: true, cleared: [ROCK, OOB] }))))
            .toContain('R5 BobBoss: the CONTROL arm did not');
    });

    it('⛔ goes red when the OUT-OF-BAND write is missing', () => {
        // {31,29} is `Fire.removed()` calling `setPersistence(-1, false)` in
        // L32. A claim that only counted flags, or only checked L32, would
        // pass here — which is the whole reason it is named.
        expect(failing(bobBossFindings(bossPair({ cleared: [ROCK] }))))
            .toContain('R5 BobBoss: the fire arm\'s ledger is EXACTLY the rock and the '
                + 'out-of-band write');
    });

    it('goes red when the rock flag is missing, or a third flag appeared', () => {
        expect(failing(bobBossFindings(bossPair({ cleared: [OOB] }))))
            .toContain('R5 BobBoss: the fire arm\'s ledger is EXACTLY the rock and the '
                + 'out-of-band write');
        expect(failing(bobBossFindings(bossPair({
            cleared: [ROCK, OOB, { level: 32, tag: 0 }],
        })))).toContain('R5 BobBoss: the fire arm\'s ledger is EXACTLY the rock and the '
            + 'out-of-band write');
    });

    it('goes red when the control arm cleared anything but the rock', () => {
        expect(failing(bobBossFindings(bossPair({}, { cleared: [] }))))
            .toContain('R5 BobBoss: the control arm cleared ONLY the rock');
        expect(failing(bobBossFindings(bossPair({}, { cleared: [ROCK, OOB] }))))
            .toContain('R5 BobBoss: the control arm cleared ONLY the rock');
    });

    it('goes red when the take-over did not happen, and when it happened twice', () => {
        // A POSITIVE on one arm and its ABSENCE on the other: `BobBoss.death`
        // is the only thing in this room that refuses input, so the fire arm
        // must be taken over and the control arm must not.
        expect(failing(bobBossFindings(bossPair({ refused: false }))))
            .toContain('R5 BobBoss: the fire arm was TAKEN OVER by the form transitions');
        expect(failing(bobBossFindings(bossPair({}, { refused: true }))))
            .toContain('R5 BobBoss: the control arm was never taken over');
    });

    it('goes red when either arm was hit', () => {
        // ⚠ The reading a form transition would otherwise erase: it writes
        // `player.hits = 0`, so only the terminal value means anything.
        expect(failing(bobBossFindings(bossPair({ hits: 2 }))))
            .toContain('R5 BobBoss: the fire arm took no damage');
        expect(failing(bobBossFindings(bossPair({}, { hits: 1 }))))
            .toContain('R5 BobBoss: the control arm took no damage');
    });

    it('goes red when an arm left the sealed arena', () => {
        expect(failing(bobBossFindings(bossPair({ level: 30 }))))
            .toContain('R5 BobBoss: the fire arm is still in the arena');
        expect(failing(bobBossFindings(bossPair({}, { level: 30 }))))
            .toContain('R5 BobBoss: the control arm is still in the arena');
    });
});

// ── Slice 4 step 3: KARLORE, the headline pair ────────────────────────

const karArm = ({
    y = 261.45, level = 48, hasFire = true, cleared = [], hits = 0,
    transitions = [{ t: 14, from_level: 47, to_level: 48 }],
} = {}) => ({
    stream: {
        ticks: [{ t: 0, x: 216, y: 144, level: 47 }, { t: 1, x: 120, y, level }],
        transitions,
    },
    status: { persistence_cleared: cleared, hits, items: { hitsMax: 3, hasFire } },
});

const karPair = (fireOver = {}, controlOver = {}) => new Map([
    [KARLORE_FIRE, karArm(fireOver)],
    [KARLORE_CONTROL, karArm({ y: 290.05, hasFire: false, ...controlOver })],
]);

describe('the Karlore pair — `fire` doing something', () => {
    it('holds for the pair the game recorded', () => {
        expect(failing(karloreFindings(karPair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        const f = karloreFindings(new Map([[KARLORE_FIRE, karArm()]]));
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
    });

    it('⛔ goes red when the fire arm PINNED — the failure that cost two takes', () => {
        // Both earlier recordings of this pair ended exactly here, and the
        // detail names the cause rather than the symptom: `Karlore.added()`
        // runs inside `new Game(48, ...)` and a grant applied afterwards
        // cannot reach it.
        const f = karloreFindings(karPair({ y: 290.05 }));
        expect(failing(f)).toContain('R5 Karlore: the fire arm WALKS THROUGH');
        expect(f.find((x) => x.name.includes('WALKS THROUGH')).detail)
            .toMatch(/BEFORE `new Game\(48/);
    });

    it('goes red when the fire arm went TOO FAR — row 14 is water', () => {
        const f = karloreFindings(karPair({ y: 240 }));
        expect(failing(f)).toContain('R5 Karlore: the fire arm WALKS THROUGH');
        expect(f.find((x) => x.name.includes('WALKS THROUGH')).detail).toMatch(/water/);
    });

    it('goes red when the control arm did NOT pin', () => {
        expect(failing(karloreFindings(karPair({}, { y: 261.45 }))))
            .toContain('R5 Karlore: the control arm PINS on the plug');
        expect(failing(karloreFindings(karPair({}, { y: 300 }))))
            .toContain('R5 Karlore: the control arm PINS on the plug');
    });

    it('goes red when the arms do not differ by exactly `fire`', () => {
        expect(failing(karloreFindings(karPair({ hasFire: false }))))
            .toContain('R5 Karlore: the two arms differ by exactly `fire`');
        expect(failing(karloreFindings(karPair({}, { hasFire: true }))))
            .toContain('R5 Karlore: the two arms differ by exactly `fire`');
    });

    it('goes red when either arm cleared a flag or took a hit', () => {
        expect(failing(karloreFindings(karPair({ cleared: [{ level: 48, tag: 1 }] }))))
            .toContain('R5 Karlore: the fire arm cleared no flag');
        expect(failing(karloreFindings(karPair({}, { hits: 1 }))))
            .toContain('R5 Karlore: the control arm took no damage');
    });

    it('goes red when the arms took different doors', () => {
        expect(failing(karloreFindings(karPair({}, {
            transitions: [{ t: 20, from_level: 47, to_level: 48 }],
        })))).toContain('R5 Karlore: both arms cross L47 → L48 at the same tick');
        expect(failing(karloreFindings(karPair({ transitions: [] }, { transitions: [] }))))
            .toContain('R5 Karlore: both arms cross L47 → L48 at the same tick');
    });
});

// ── Slice 4 step 4: THE D5 WALK ───────────────────────────────────────

const D5_HOPS = [
    { from_level: 44, to_level: 45 }, { from_level: 45, to_level: 46 },
    { from_level: 46, to_level: 47 }, { from_level: 47, to_level: 48 },
    { from_level: 48, to_level: 49 },
];

const d5 = ({
    items = { hitsMax: 3, hasFire: true, canSwim: true },
    cleared = [D5_CONCH_FLAG], refused = true, drown = 0,
    x = D5_REST_TILE.tx * 16 + 13.95, y = D5_REST_TILE.ty * 16 + 0.01,
    level = 49, hops = D5_HOPS,
} = {}) => new Map([[D5_CONCH, {
    stream: { ticks: [{ t: 0, x: 24, y: 88, level: 44 }, { t: 1, x, y, level }], transitions: hops },
    status: {
        items, persistence_cleared: cleared, saw_input_refused: refused, drown_timer: drown,
    },
}]]);

describe('the D5 walk — a COLLECTION claim, not an opened-blocker one', () => {
    it('passes on the shape the recording really has', () => {
        expect(failing(d5ConchFindings(d5()))).toEqual([]);
    });

    it('SKIPS, loudly, when the sweep did not replay it', () => {
        const [f] = d5ConchFindings(new Map());
        expect(f.skipped).toBe(true);
        expect(f.ok).toBe(true);
    });

    it('⛔ RED when the conch was not taken', () => {
        expect(failing(d5ConchFindings(d5({
            items: { hitsMax: 3, hasFire: true, canSwim: false },
        })))).toContain('R5 D5: the walk ends holding EXACTLY fire and the conch');
    });

    it('⛔ RED when the boot grant never landed', () => {
        expect(failing(d5ConchFindings(d5({
            items: { hitsMax: 3, hasFire: false, canSwim: true },
        })))).toContain('R5 D5: the walk ends holding EXACTLY fire and the conch');
    });

    it('⛔ RED when the walk picked up something ELSE on the way', () => {
        // The negative half. Five doors of corridor is five doors of
        // chances to walk over a pickup, and only an exact-set check sees it.
        expect(failing(d5ConchFindings(d5({
            items: { hitsMax: 3, hasFire: true, canSwim: true, hasTorch: true },
        })))).toContain('R5 D5: the walk ends holding EXACTLY fire and the conch');
    });

    it('⛔ RED when the flag is missing, and when there is an EXTRA one', () => {
        expect(failing(d5ConchFindings(d5({ cleared: [] }))))
            .toContain('R5 D5: the conch\'s flag is off, and it is the ONLY one');
        expect(failing(d5ConchFindings(d5({
            cleared: [D5_CONCH_FLAG, { level: 48, tag: 1 }],
        })))).toContain('R5 D5: the conch\'s flag is off, and it is the ONLY one');
    });

    it('⛔ RED when it comes to rest somewhere other than the water tile', () => {
        // The swim leg's starting line. A different tile means the coast or
        // the ceremony left a different velocity.
        expect(failing(d5ConchFindings(d5({ y: D5_REST_TILE.ty * 16 - 4 }))))
            .toContain('R5 D5: it comes to rest on the WATER tile below the conch');
    });

    it('⛔ RED when a door is missing or the order is wrong', () => {
        expect(failing(d5ConchFindings(d5({ hops: D5_HOPS.slice(0, 4) }))))
            .toContain('R5 D5: five doors and a pit, in that order');
        expect(failing(d5ConchFindings(d5({ hops: [...D5_HOPS].reverse() }))))
            .toContain('R5 D5: five doors and a pit, in that order');
    });

    it('⛔ RED when the pit never refused input — L48 was left some other way', () => {
        expect(failing(d5ConchFindings(d5({ refused: false }))))
            .toContain('R5 D5: the game refused input for the pit transport');
    });

    it('⛔ RED when the coerced water started the timer anyway', () => {
        expect(failing(d5ConchFindings(d5({ drown: 9 }))))
            .toContain('R5 D5: the coerced water never started the timer');
    });
});

// ── Slice 4 step 4: ARMED WATER ───────────────────────────────────────

const swimStream = () => ({ ticks: [
    { t: 0, x: 216, y: 144, level: 47 }, { t: 1, x: 120, y: 296, level: 48 },
    { t: 2, x: 120, y: 270.25, level: 48 },
] });

const swimArm = ({ items, drown = 0, stream = swimStream() } = {}) => ({
    stream, status: { items, drown_timer: drown },
});

const swimPair = (crossOver = {}, drownOver = {}) => new Map([
    [SWIM_CROSS, swimArm({ items: { hitsMax: 3, hasFire: true, canSwim: true }, ...crossOver })],
    [SWIM_DROWN, swimArm({ items: { hitsMax: 3, hasFire: true }, drown: 4, ...drownOver })],
]);

describe('the armed-water pair — the evidence is a counter, not a stream', () => {
    it('passes on the shape the two recordings really have', () => {
        expect(failing(swimPairFindings(swimPair()))).toEqual([]);
    });

    it('SKIPS when only one arm was replayed', () => {
        const [f] = swimPairFindings(new Map([[SWIM_CROSS, swimArm({ items: {} })]]));
        expect(f.skipped).toBe(true);
    });

    it('⛔⛔ RED when the drowning arm did NOT drown', () => {
        // The two-sided half. A control that reports 0 has proved the water
        // was still coerced, or that the walk never reached it.
        expect(failing(swimPairFindings(swimPair({}, { drown: 0 }))))
            .toContain('R5 swim: the conch-less arm DROWNED — water is armed');
    });

    it('⛔ RED when the conch arm\'s timer moved', () => {
        expect(failing(swimPairFindings(swimPair({ drown: 6 }))))
            .toContain('R5 swim: the conch arm\'s timer never started');
    });

    it('⛔ RED when the arms do not differ by exactly the conch', () => {
        expect(failing(swimPairFindings(swimPair({}, {
            items: { hitsMax: 3, hasFire: true, canSwim: true },
        })))).toContain('R5 swim: the arms differ by exactly `conch`');
    });

    it('⛔ RED when the streams DIFFER — that would be a different experiment', () => {
        // Before `drowning` latches there is no positional effect at all, so
        // a difference means one arm latched and the pair is measuring a
        // death rather than a timer.
        const other = { ticks: [...swimStream().ticks.slice(0, 2), { t: 2, x: 121, y: 270.25, level: 48 }] };
        expect(failing(swimPairFindings(swimPair({}, { stream: other }))))
            .toContain('R5 swim: the two streams are BYTE-IDENTICAL');
    });
});

const latchStream = (steady, boosted) => {
    const ticks = [];
    // y DECREASES as the player swims north, so a step is `y[t] - y[t+1]`.
    let y = 400;
    for (let t = 0; t <= SWIM_LATCH_TICKS.latched + 2; t += 1) {
        ticks.push({ t, x: 120, y, level: 48 });
        y -= (t === SWIM_LATCH_TICKS.steady ? steady
            : t === SWIM_LATCH_TICKS.latched ? boosted : 0);
    }
    return { ticks };
};

const latchArm = (steady = SWIM_STEADY_STEP, boosted = SWIM_STEADY_STEP + SWIM_BOOST) =>
    new Map([[SWIM_LATCH_NAME, {
        stream: latchStream(steady, boosted),
        status: { drown_timer: 0, items: { canSwim: true, hasFire: true, hitsMax: 3 } },
    }]]);

describe('the swim term\'s latch — asserted from the MOVEMENT', () => {
    it('passes when the resumed step exceeds the mid-cycle one by exactly the addend', () => {
        expect(failing(swimLatchFindings(latchArm()))).toEqual([]);
    });

    it('SKIPS when the leg was not replayed', () => {
        expect(swimLatchFindings(new Map())[0].skipped).toBe(true);
    });

    it('⛔ RED when the mid-cycle baseline is not the plain water speed', () => {
        expect(failing(swimLatchFindings(latchArm(0.8))))
            .toContain('R5 swim latch: a mid-cycle swimming tick steps the plain water speed');
    });

    it('⛔⛔ RED when the resumed tick is NOT boosted — no latch', () => {
        // The failure this exists for: a model that replayed the channel
        // during the stop, or one that never completed it, would resume
        // mid-play and step the plain 0.450.
        expect(failing(swimLatchFindings(latchArm(SWIM_STEADY_STEP, SWIM_STEADY_STEP))))
            .toContain('⛓ R5 swim latch: the first tick after a 90-tick stop is BOOSTED');
    });

    it('⛔ RED when the boost is the wrong SIZE, not merely absent', () => {
        expect(failing(swimLatchFindings(latchArm(SWIM_STEADY_STEP, SWIM_STEADY_STEP + 0.5))))
            .toContain('⛓ R5 swim latch: the first tick after a 90-tick stop is BOOSTED');
    });

    it('⛔ RED when the stream is too short to read either tick', () => {
        const [f] = swimLatchFindings(new Map([[SWIM_LATCH_NAME, {
            stream: { ticks: [{ t: 0, x: 1, y: 1, level: 48 }] },
            status: { drown_timer: 0, items: {} },
        }]]));
        expect(f.ok).toBe(false);
    });

    it('⛔ RED when it drowned, or never held the conch', () => {
        const m = latchArm();
        m.get(SWIM_LATCH_NAME).status.drown_timer = 3;
        expect(failing(swimLatchFindings(m)))
            .toContain('R5 swim latch: it swam armed water for 310 ticks without drowning');
    });
});

// ── Slice 4 step 5: THE ARMED WATERFALL ───────────────────────────────

/**
 * A stream ending at `y` after `held` observations in the waterfall's row.
 *
 * ⚠ The y values are the RECORDING'S, not row centres: the pair's third
 * check is a RATIO (the exempting arm goes multiples further), and a
 * synthetic fixture built from tidy row centres would put 32 px against
 * 112 and fail a threshold the real 24.35 against 116.28 clears easily.
 */
const wfStream = (y, held = 0) => {
    const ticks = [{ t: 0, x: 216, y: WF_START_Y, level: 0 }];
    for (let i = 0; i < held; i += 1) {
        ticks.push({ t: ticks.length, x: 216, y: 127.3, level: 0 });
    }
    ticks.push({ t: ticks.length, x: 216, y, level: 0 });
    return { ticks };
};
/** Where each arm really ends. */
const WF_SHUT_Y = 127.65;
const WF_CLIMB_Y = 35.725;

const wfPair = (shutOver = {}, climbOver = {}) => new Map([
    [WF_SHUT, {
        stream: wfStream(WF_SHUT_Y, 40),
        status: { drown_timer: 0, items: { hitsMax: 3, canSwim: true } },
        ...shutOver,
    }],
    [WF_CLIMB, {
        stream: wfStream(WF_CLIMB_Y, 0),
        status: { drown_timer: 0, items: { hitsMax: 3, canSwim: true, hasFeather: true } },
        ...climbOver,
    }],
]);

describe('the armed waterfall — the rule is a refusal, so the evidence is one', () => {
    it('passes on the shape the two recordings really have', () => {
        expect(failing(waterfallPairFindings(wfPair()))).toEqual([]);
    });

    it('SKIPS when only one arm was replayed', () => {
        expect(waterfallPairFindings(new Map([[WF_CLIMB, { stream: wfStream(WF_CLIMB_Y), status: {} }]]))[0]
            .skipped).toBe(true);
    });

    it('⛔⛔ RED when the featherless arm CLIMBED — no refusal at all', () => {
        expect(failing(waterfallPairFindings(wfPair({ stream: wfStream(WF_CLIMB_Y, 0) }))))
            .toContain('⛓ R5 waterfall: the FEATHERLESS arm reaches the face and STALLS');
    });

    it('⛔ RED when the featherless arm never REACHED the face', () => {
        // The failure a "did not climb" check would miss: an arm that stopped
        // two rows short proves nothing about the waterfall.
        expect(failing(waterfallPairFindings(wfPair({ stream: wfStream((WF_FACE_ROW + 2) * 16 + 8, 0) }))))
            .toContain('⛓ R5 waterfall: the FEATHERLESS arm reaches the face and STALLS');
    });

    it('⛔ RED when the feather arm did NOT climb', () => {
        expect(failing(waterfallPairFindings(wfPair({}, { stream: wfStream(WF_SHUT_Y, 40) }))))
            .toContain('R5 waterfall: the FEATHER arm climbs through');
    });

    it('⛔ RED when the arms do not differ by exactly the feather', () => {
        expect(failing(waterfallPairFindings(wfPair({
            status: { drown_timer: 0, items: { hitsMax: 3, canSwim: true, hasFeather: true } },
        })))).toContain('R5 waterfall: the arms differ by exactly `feather`');
    });

    it('⛔ RED when either arm drowned — the water is UNCOERCED here', () => {
        expect(failing(waterfallPairFindings(wfPair({
            status: { drown_timer: 5, items: { hitsMax: 3, canSwim: true } },
        })))).toContain('R5 waterfall: the shut arm never drowned, on UNCOERCED water');
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 19 — THE FIFTH CEREMONY'S PRINTER, MUTATED. The pair itself
 * is asserted against the LIVE GAME by the differential; what is checked
 * here is that each of its four claims goes RED when the thing it claims is
 * false — otherwise a green sweep would mean "the checks ran", not "the
 * room was solved".
 */
describe('the L42 part 4 pair', () => {
    const inBoth = [
        { t: 0, x: 104, y: 152, level: 42 },   // crusher@96,144's ctor body
        { t: 1, x: 136, y: 152, level: 42 },   // crusher@128,144's ctor body
    ];
    const l42arm = ({
        dead = 191, cleared = [], levels = [42, 40], boxes = inBoth,
    } = {}) => ({
        stream: {
            ticks: [
                ...boxes,
                ...levels.map((level, i) => ({ t: 100 + i, x: 8, y: 8, level })),
            ],
        },
        status: { persistence_cleared: cleared, dead_frames: dead },
    });
    const l42pair = (driveOver = {}, controlOver = {}) => new Map([
        [L42_PART4_PAIR.drive, l42arm(driveOver)],
        [L42_PART4_PAIR.control, l42arm({
            dead: 21, levels: [42], boxes: [{ t: 0, x: 72, y: 184, level: 42 }], ...controlOver,
        })],
    ]);

    it('holds for the pair the recording produced', () => {
        expect(failing(l42Part4Findings(l42pair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        const one = new Map([[L42_PART4_PAIR.drive, l42arm()]]);
        const f = l42Part4Findings(one);
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
        expect(f[0].detail).toMatch(/r5-l42-part4\b/);
        expect(l42Part4Findings(new Map())[0].skipped).toBe(true);
        expect(l42Part4Findings(null)[0].skipped).toBe(true);
    });

    /**
     * ⛔ THE CEREMONY IS THE DIFFERENCE MINUS ONE LOAD'S FADE, so removing
     * the freeze has to go red — and so does adding a second one, which is
     * the side a one-sided check would miss.
     */
    it('goes red when the drive did not freeze for the ceremony — and when it froze twice', () => {
        const NAME = '⛓⛓⛓ R5 L42 part 4: the FIFTH ceremony — the difference between the '
            + 'arms is the freeze plus ONE LOAD';
        // ⛔ NO CEREMONY: the difference is one load's fade and nothing else.
        expect(failing(l42Part4Findings(l42pair({ dead: 21 + 20 })))).toContain(NAME);
        // ⛔ AND THE OTHER SIDE, which a one-sided check would miss: a
        // second freeze the model did not predict.
        expect(failing(l42Part4Findings(l42pair({ dead: 191 + 150 })))).toContain(NAME);
    });

    it('goes red when the drive never took the exit', () => {
        expect(failing(l42Part4Findings(l42pair({ levels: [42] }))))
            .toContain('⛓⛓⛓ R5 L42 part 4: the drive TAKES THE EXIT and the control never leaves');
    });

    it('goes red when the CONTROL leaves the room', () => {
        expect(failing(l42Part4Findings(l42pair({}, { levels: [42, 40] }))))
            .toContain('⛓⛓⛓ R5 L42 part 4: the drive TAKES THE EXIT and the control never leaves');
    });

    /**
     * ⛓⛓ THE DIPSTICKS ARE THE PARK'S ONLY WITNESS, so BOTH sides matter:
     * a drive that misses one, and a control that enters one.
     */
    it('goes red when the drive misses a constructor body', () => {
        expect(failing(l42Part4Findings(l42pair({ boxes: [inBoth[0]] }))))
            .toContain('⛓⛓⛓ R5 L42 part 4: the drive stands inside BOTH constructor bodies, the control inside neither');
    });

    it('goes red when the CONTROL enters one', () => {
        expect(failing(l42Part4Findings(l42pair({}, { boxes: inBoth }))))
            .toContain('⛓⛓⛓ R5 L42 part 4: the drive stands inside BOTH constructor bodies, the control inside neither');
    });

    it('goes red when either ledger is non-empty', () => {
        expect(failing(l42Part4Findings(l42pair({ cleared: [{ level: 42, tag: 0 }] }))))
            .toContain('⛔ R5 L42 part 4: BOTH ledgers are empty — the part writes save-file state');
        expect(failing(l42Part4Findings(l42pair({}, { cleared: [{ level: 42, tag: 0 }] }))))
            .toContain('⛔ R5 L42 part 4: BOTH ledgers are empty — the part writes save-file state');
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 22 — THE RUNG'S EXIT CRITERIA, ASSERTED FROM THE TAPES.
 *
 * The records these check are statements about §0's target, and the whole
 * risk in such a record is that it drifts from the roster it describes. So
 * every count is re-derived from the committed tapes here — a record that
 * said "36 of 42 declare grants" while the roster held 44 would be a
 * plausible-looking lie, and this is the stratum that catches it.
 */
describe('⛓ R5: the rung-closing itinerary and the exit criteria', () => {
    const tapeDir = new URL('./fixtures/tapes/', import.meta.url);
    const r5Tapes = () => readdirSync(tapeDir)
        .filter((f) => f.startsWith('r5-') && f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(new URL(f, tapeDir), 'utf8')));

    it('⛔⛔⛔ `noDamage` is NOT retired, and the count is re-derived', async () => {
        const { R5_NODAMAGE_STATUS } = await import('./r5Acceptance.js');
        const tapes = r5Tapes();
        const withFlag = tapes.filter((t) => t.noDamage === true);
        expect(R5_NODAMAGE_STATUS.retired).toBe(false);
        expect(withFlag).toHaveLength(R5_NODAMAGE_STATUS.tapesDeclaringIt);
        expect(tapes.length - withFlag.length).toBe(1);
        // ⛓ AND IT IS A MISSING MECHANIC NOW, not a policy — the blast is
        // what turned the flag from inert into load-bearing.
        expect(R5_NODAMAGE_STATUS.isNowAMissingMechanic).toBe(true);
        expect(R5_NODAMAGE_STATUS.blockers.length).toBe(3);
    });

    it('⛓ the item ledger\'s counts come from the roster, not from memory', async () => {
        const { R5_ITEM_LEDGER } = await import('./r5Acceptance.js');
        const tapes = r5Tapes();
        expect(tapes).toHaveLength(R5_ITEM_LEDGER.tapesTotal);
        const granting = tapes.filter((t) => (t.grants ?? []).some((g) => g.items.length > 0));
        expect(granting).toHaveLength(R5_ITEM_LEDGER.tapesDeclaringGrants);
        // ⛔ AND `fire` IS GRANTED AND NEVER EARNED, which is the one that
        // makes "every link is proved and the chain has never been run" a
        // measurement rather than a mood.
        expect(R5_ITEM_LEDGER.spawnedButNotCollected).toContain('fire');
    });

    it('⛔ the itinerary names a blocker for every window that has one', async () => {
        const { R5_ITINERARY } = await import('./r5Acceptance.js');
        expect(R5_ITINERARY.windows).toHaveLength(6);
        expect(R5_ITINERARY.wandIsLast).toBe(true);
        // ⛓ …and the LAST window is the wand's, which is not a preference:
        // the wand seals L43's only shaft on its publishing tick, and every
        // L40 pit is a one-way door into that room.
        const last = R5_ITINERARY.windows[R5_ITINERARY.windows.length - 1];
        expect(last.earns).toMatch(/wand/);
        // ⛓⛓ R5 SLICE 23: UNBLOCKED, and it names its tape now. The v6
        // `save` block turned the chain tail into a boot.
        expect(last.blocked).toBeNull();
        expect(last.tape).toBe('r5-l43-wand');
        expect(R5_ITINERARY.blockedOn).toHaveLength(2);
    });

    it('⛓⛓ the AS3 batch is THREE entries now, each with the wall it unblocks '
        + 'and what it shipped', async () => {
        const { R6_INHERITS } = await import('./r5Acceptance.js');
        // ⛓ R5 slice 23 brought the batch forward and expanded it; the third
        // entry is the one that was EVALUATED and deliberately NOT built.
        expect(R6_INHERITS.as3Batch).toHaveLength(3);
        expect(R6_INHERITS.as3Batch.filter((r) => r.asBuilt)).toHaveLength(2);
        expect(R6_INHERITS.as3Batch[2].shipped).toMatch(/NOT BUILT/);
        expect(R6_INHERITS.as3NotTaken.length).toBeGreaterThanOrEqual(5);
        // ⛔ And the one R6 route fact this slice was asked to settle.
        expect(R6_INHERITS.wandDoesNotOpenAWandLock.overrides).toBe(0);
        for (const row of R6_INHERITS.as3Batch) {
            // A batch entry with no reason is a batch that gets built and
            // then argued about.
            expect(row.why.length).toBeGreaterThan(80);
        }
        expect(R6_INHERITS.as3Batch.map((r) => r.what).join(' ')).toMatch(/hasTotemPart/);
        expect(R6_INHERITS.mechanics.length).toBeGreaterThanOrEqual(4);
    });
});

/**
 * ⛓⛓⛓ R5 SLICE 23 — THE `SAVE_FILE.data` AUDIT, CHECKED RATHER THAN READ.
 *
 * An audit record is prose until something re-derives it. The three claims
 * below are the ones a fixture roster or a level extract can answer, so
 * they are answered here instead of being believed:
 *
 *   - the slot counts the batch validates against are the audit's own;
 *   - "zero of the committed tapes press C" (the `secondary` skip);
 *   - "no `Game.time`-coupled entity stands in L43" (the `time` skip) —
 *     the one that decides whether the wand window is immune.
 *
 * ⚠ And every skip must carry a REASON, because an audit whose skip list
 * is bare and one that examined nothing print the same thing.
 * [[feedback_bounded_sweep_must_name_what_it_bounded]]
 */
describe('⛓ R5 slice 23: the SAVE_FILE.data audit', () => {
    const tapeDir = new URL('./fixtures/tapes/', import.meta.url);
    const allTapes = () => readdirSync(tapeDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(new URL(f, tapeDir), 'utf8')));

    it('closes THREE fields and its slot counts are the parser\'s own', async () => {
        const { SAVE_FILE_AUDIT } = await import('./r5Acceptance.js');
        const { SAVE_SLOTS } = await import('./tapeFormat.js');
        expect(SAVE_FILE_AUDIT.closed).toHaveLength(3);
        // A record whose slot counts drifted from the validator's would let
        // a tape declare a seal identity the game has no slot for.
        const byField = Object.fromEntries(
            SAVE_FILE_AUDIT.closed.map((c) => [c.field, c.slots]),
        );
        expect(byField.hasTotemPart).toBe(SAVE_SLOTS.totem_parts);
        expect(byField.hasKey).toBe(SAVE_SLOTS.keys);
        expect(byField.hasSealPart).toBe(SAVE_SLOTS.seal_parts);
        // ⛔ And the int one is flagged as such IN THE RECORD, because the
        // whole way to get this field wrong is to read it as a boolean.
        const seal = SAVE_FILE_AUDIT.closed.find((c) => c.field === 'hasSealPart');
        expect(seal.kind).toBe('int');
        expect(seal.shape).toMatch(/IDENTITY SLOTS/);
    });

    it('⛔ every skipped and evaluated field carries its own reason', async () => {
        const { SAVE_FILE_AUDIT } = await import('./r5Acceptance.js');
        expect(SAVE_FILE_AUDIT.skipped.length).toBe(6);
        for (const row of SAVE_FILE_AUDIT.skipped) {
            expect(row.why.length).toBeGreaterThan(30);
        }
        for (const row of SAVE_FILE_AUDIT.evaluated) {
            expect(row.verdict).toBe('NO FIELD');
            expect(row.why.length).toBeGreaterThan(60);
        }
        // 19 covered + 3 closed + 2 evaluated + 6 skipped = 30 fields, and
        // the covered list is grouped rather than one row per boolean.
        expect(SAVE_FILE_AUDIT.fields).toBe(30);
    });

    it('⛔ the `secondary` skip is re-derived: no committed tape presses C', async () => {
        const { SAVE_FILE_AUDIT } = await import('./r5Acceptance.js');
        const keys = new Set();
        for (const t of allTapes()) for (const s of t.inputs ?? []) keys.add(s.key);
        expect(keys.has('secondary')).toBe(false);
        // The positive control: the histogram is not empty, so the absence
        // above is a measurement rather than a mis-read fixture directory.
        expect(keys.has('primary')).toBe(true);
        const row = SAVE_FILE_AUDIT.evaluated.find((e) => e.field === 'secondary');
        // ⚠ The record's own sentence names 98 — the roster at the moment
        // the audit ran. What this test re-derives is the CLAIM (no tape
        // presses C), not the number in the prose.
        expect(row.why).toMatch(/ZERO of the \d+ committed tapes/);
        // ⛔ R6 SLICE 3: THIS WAS `toHaveLength(100)`, AND IT ROTTED THE
        // MOMENT THE ROSTER GREW — a hand-kept count in a test whose whole
        // subject is "a hand-kept count in the prose is not the claim".
        // Three new fixtures turned it red for the one reason that is not a
        // defect. What the line is actually for is a POSITIVE CONTROL on
        // `allTapes()` — that the directory read produced a roster at all —
        // so it asserts a floor and the r5-era size it was written at.
        expect(allTapes().length).toBeGreaterThanOrEqual(100);
    });

    it('⛔ the `time` skip is re-derived: L43 holds no worldFrame-coupled hazard',
        async () => {
            const { combatCensusOf } = await import('./levelWorld.js');
            const { atlasLevelSource } = await import('./levelSource.js');
            const source = atlasLevelSource();
            // `phaseUncertain` is levelWorld's own list of the instances
            // whose timing rides on Game.time. The wand window's immunity
            // is exactly this list being empty.
            expect(combatCensusOf(source(43)).phaseUncertain).toEqual([]);
            // Positive control: some level DOES hold one, so an empty list
            // at 43 cannot be an empty accessor.
            const coupled = [...Array(116).keys()]
                .filter((lv) => combatCensusOf(source(lv)).phaseUncertain.length > 0);
            expect(coupled.length).toBeGreaterThan(0);
            expect(coupled).not.toContain(43);
        });
});
