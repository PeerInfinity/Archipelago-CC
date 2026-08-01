/**
 * activators — the button/lock/cover state machine.
 *
 * Two strata, as everywhere in this module:
 *
 * 1. **The fade counts, derived from the AS3 and then hand-checked.** They
 *    are float questions with knife-edges (`Image.alpha` clamps, and the
 *    Lock tests before decrementing while the Cover tests after), and the
 *    R1 pit fall already cost a rung's worth of attention to exactly this
 *    shape of arithmetic.
 * 2. **The claim the rung turns on**: that a player can leave L71's button
 *    and enter its lock in one tick, and that the lock then holds itself
 *    open because they are standing in it. Asserted here against the
 *    committed geometry; answered by the game in the `l71-button-lock`
 *    oracle fixture, which is what actually decides R2's claim.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ACTIVATOR_PRESSERS,
    ACTIVATOR_RESPONDERS,
    FORCED_TSET,
    RELAXED_ROLES,
    buildLevelWorld,
    rect,
    tSetOf,
} from './levelWorld.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { runTapeToStream } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import {
    PRESSERS,
    RESPONDERS,
    createActivatorState,
    openActivatorIds,
    opensOnTick,
    pressedGroups,
    staticPressesIn,
    stepActivators,
} from './activators.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)),
    'utf8',
));
const levelRecord = (id) => MAP.levels.find((l) => l.level === id);
const playerBox = (x, y) => rect(x - 2, y - 2, 4, 5);

const L71 = buildLevelWorld(levelRecord(71));

/**
 * The item mirror `stepActivators` now needs, because L71 holds a touch
 * responder. Empty means "no shields": every button/lock assertion below is
 * about a mechanic that consults no item, so they all run with the shields
 * OFF and the ShieldLock inert — which is also what R2's recordings were
 * made under.
 */
const NO_ITEMS = Object.freeze({ hasShield: false, hasDarkShield: false });
const DARK_SHIELD = Object.freeze({ hasShield: false, hasDarkShield: true });
const step = (state, world, box, inventory = NO_ITEMS) =>
    stepActivators(state, world, box, { inventory });

describe('the membership lists agree', () => {
    it('every tag levelWorld treats as a responder has semantics here', () => {
        // Two lists in two modules is how a class ends up with geometry and
        // no behaviour, or behaviour and no geometry.
        expect([...ACTIVATOR_RESPONDERS].sort()).toEqual(Object.keys(RESPONDERS).sort());
        expect([...ACTIVATOR_PRESSERS].sort()).toEqual(Object.keys(PRESSERS).sort());
    });

    it('BossLock, RockLock and Pulser are deliberately NOT responders', () => {
        // They ARE `Activators` and they DO carry a `t`, but their
        // `set activate` overrides only play a sound and store the flag —
        // they open on a key or an item, which is R3. Pulser is
        // `type = "Solid"` unconditionally and `activate` drives only its
        // radius animation. Naming them here stops "it is an Activators"
        // being read as "it opens".
        for (const tag of ['bosslock', 'rocklock', 'pulser']) {
            expect(ACTIVATOR_RESPONDERS.has(tag), tag).toBe(false);
        }
    });
});

describe('the fades, which are float questions', () => {
    it('a lock opens on tick 101 and a cover on tick 11', () => {
        // ⚠ NOT 100 and 10. `Image.alpha`'s setter clamps to [0,1]
        // (graphics/Image.as:155-158), so the fade lands exactly on 0 rather
        // than going slightly negative; and `Lock.activationStep` tests
        // `alpha > 0` BEFORE decrementing, so `turnOff()` happens on the
        // tick after the hundredth decrement, while `Cover.update`
        // decrements and tests in the same tick.
        expect(opensOnTick(0.01)).toBe(101);
        expect(opensOnTick(0.1)).toBe(11);
    });

    it('and the model really takes that many ticks', () => {
        const state = createActivatorState(L71);
        const lock = L71.activators.find((a) => a.tag === 'lock' && a.t === 0);
        expect(lock).toBeTruthy();
        const onButton = playerBox(120, 184);
        expect(pressedGroups(L71, onButton).has(0)).toBe(true);
        for (let tick = 1; tick <= 100; tick++) {
            step(state, L71, onButton);
            expect(openActivatorIds(state).has(lock.id), `tick ${tick}`).toBe(false);
        }
        step(state, L71, onButton);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
    });

    it('and releasing the button re-solidifies it — but only once clear', () => {
        const state = createActivatorState(L71);
        const lock = L71.activators.find((a) => a.tag === 'lock' && a.t === 0);
        const onButton = playerBox(120, 184);
        for (let tick = 1; tick <= 101; tick++) step(state, L71, onButton);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        // Standing INSIDE the lock, off the button: `returnToNormal` is
        // guarded by `!collideTypes(hitables, x, y)`, so it stays open.
        const inLock = playerBox(120, 170);
        step(state, L71, inLock);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        // Clear of both: it closes on the very next tick.
        const clearOfBoth = playerBox(120, 140);
        step(state, L71, clearOfBoth);
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
        // ...and re-opening costs the full 101 again — the fade RESETS,
        // it does not resume, because the else-arm restores alpha to 1.
        for (let tick = 1; tick <= 100; tick++) step(state, L71, onButton);
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
    });
});

describe('L71: the crossing R2\'s claim rests on', () => {
    it('the button and the lock volumes are DISJOINT, by one pixel of y', () => {
        // This is why the crossing is a question at all. If they overlapped,
        // the player could stand on both and walk out at leisure.
        const lock = L71.activators.find((a) => a.tag === 'lock' && a.t === 0);
        const button = L71.pressers.find((p) => p.t === 0);
        expect(lock.rect).toMatchObject({ x: 112, y: 160, right: 128, bottom: 176 });
        expect(button.rect).toMatchObject({ x: 116, y: 181, right: 124, bottom: 187 });
        // No player position touches both: the lock needs y < 178 and the
        // button needs y > 178.
        for (let y = 150; y <= 200; y += 1) {
            const box = playerBox(120, y);
            const both = pressedGroups(L71, box).has(0)
                && box.y < lock.rect.bottom && box.bottom > lock.rect.y;
            expect(both, `y=${y}`).toBe(false);
        }
    });

    it('...so the model says the crossing needs ONE tick of travel, and names it', () => {
        const lock = L71.activators.find((a) => a.tag === 'lock' && a.t === 0);
        // The last y that presses the button, and the first that is inside
        // the lock. A tape has to get from one to the other in a single
        // tick, which at walk speed it can — and y = 178 exactly touches
        // NEITHER, so a tape that lands there closes the lock in its face.
        const presses = [];
        const inside = [];
        for (let y = 150; y <= 200; y += 1) {
            const box = playerBox(120, y);
            if (pressedGroups(L71, box).has(0)) presses.push(y);
            if (box.y < lock.rect.bottom && box.bottom > lock.rect.y) inside.push(y);
        }
        expect(Math.min(...presses)).toBe(179);
        expect(Math.max(...inside)).toBe(177);
    });

    it('L71\'s OTHER lock is tset -1 and answers to no button', () => {
        // `lock@112,192` has tset -1, so it is not in group 0 and the
        // button does not touch it. It is the one the persistence clear
        // removes. Two locks in one level answering differently is exactly
        // the case a per-level "is the lock open" flag would get wrong.
        const tagged = L71.activators.filter((a) => a.tag === 'lock');
        expect(tagged.map((a) => a.t).sort()).toEqual([-1, 0]);
    });
});

/**
 * ── R3: THE TOUCH LOCK ────────────────────────────────────────────────
 *
 * Hand-computed from `Puzzlements/ShieldLock.as:30-51` and `Lock.as:25-37`,
 * not read off this module's output. The chain, once:
 *
 *   placement (288,256) -> entity (296,264)   `Lock.as:31`, +Tile.w/2
 *   setHitbox(16,16,8,8)                      `Lock.as:33`
 *     -> solid rect [288,304) x [256,272)
 *   collide("Player", x - 1, y)               `ShieldLock.as:32`
 *     -> touch rect [287,303) x [256,272)
 *   p.y = y - originY + 7 = 264 - 8 + 7       `ShieldLock.as:35`
 *     -> 263
 *
 * The game answers all of it in `l71-shieldlock-open` / `-shut`.
 */
describe('R3: the lock that presses itself', () => {
    const shieldLock = () => L71.activators.find((a) => a.tag === 'shieldlock');
    /** The last x the sweep can rest at, pressed against the lock's west face. */
    const AGAINST = 286;

    it('the touch rect is the solid rect shifted ONE pixel west', () => {
        const lock = shieldLock();
        expect(lock.rect).toMatchObject({ x: 288, y: 256, right: 304, bottom: 272 });
        expect(lock.touchRect).toMatchObject({ x: 287, y: 256, right: 303, bottom: 272 });
        expect(lock.snapY).toBe(263);
        expect(lock.shield).toBe('hasDarkShield');
        // What `Lock.turnOff()` writes false — L71's own tag 2, the flag R2
        // used to hand over as a persistence clear.
        expect(lock.persistTag).toBe(2);
    });

    it('...which leaves exactly ONE pixel column a player can touch it from', () => {
        // The shifted rect is 15 px of solid and 1 px of air. That single
        // column is the whole approach: everything else the sweep refuses.
        // (The mirror of the button/lock "DISJOINT by one pixel of y" claim
        // — here the geometry hands the mechanic a 1 px window in x.)
        const lock = shieldLock();
        const touchable = [];
        for (let x = 280; x <= 292; x += 0.5) {
            const box = playerBox(x, 264);
            const inSolid = box.x < lock.rect.right && box.right > lock.rect.x;
            const inTouch = box.x < lock.touchRect.right && box.right > lock.touchRect.x;
            if (inTouch && !inSolid) touchable.push(x);
        }
        expect(Math.min(...touchable)).toBe(285.5);
        expect(Math.max(...touchable)).toBe(AGAINST);
        // And a sweep pressing east stops at the largest such x, because
        // `sweepAxis` steps by at most 1 and stops before the collision:
        // any resting position is in (285, 286].
        expect(touchable.every((x) => x > 285 && x <= AGAINST)).toBe(true);
    });

    it('snaps, then opens on tick 101 — the same fade as any Lock', () => {
        const state = createActivatorState(L71);
        const lock = shieldLock();
        const box = playerBox(AGAINST, 264);
        const first = step(state, L71, box, DARK_SHIELD);
        expect(first).toEqual([{
            kind: 'snap', id: lock.id, y: 263, persistTag: 2,
        }]);
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
        // Ticks 2..100 are the rest of the fade: no events, still solid.
        const snapped = playerBox(AGAINST, 263);
        for (let tick = 2; tick <= 100; tick++) {
            expect(step(state, L71, snapped, DARK_SHIELD), `tick ${tick}`).toEqual([]);
            expect(openActivatorIds(state).has(lock.id), `tick ${tick}`).toBe(false);
        }
        // ⚠ 101, exactly as `opensOnTick(0.01)` says — the tick the touch
        // itself decremented on counts as the first.
        expect(step(state, L71, snapped, DARK_SHIELD)).toEqual([{
            kind: 'turnoff', id: lock.id, touching: true, persistTag: 2,
        }]);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
    });

    it('without the shield it never activates at all', () => {
        // The other arm of `ShieldLock.as:33`. Not "opens later" — the
        // condition is simply false, so the lock is an ordinary wall.
        const state = createActivatorState(L71);
        const lock = shieldLock();
        const box = playerBox(AGAINST, 264);
        for (let tick = 1; tick <= 200; tick++) {
            expect(step(state, L71, box, NO_ITEMS), `tick ${tick}`).toEqual([]);
        }
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
        // ...and the plain-shield spelling is a DIFFERENT item: reading the
        // fourth ctor argument as a sprite choice would open this one on it.
        expect(lock.shield).not.toBe('hasShield');
        for (let tick = 1; tick <= 200; tick++) {
            step(state, L71, box, { hasShield: true, hasDarkShield: false });
        }
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
    });

    it('LATCHES: walking away does not close it, which a button-lock does', () => {
        // The behavioural consequence of FORCED_TSET = -2. Nothing
        // republishes `activate`, so the occupancy restore that closes
        // `lock@112,160` the moment the player steps off has no counterpart
        // here. The contrast is the assertion: same module, same fade, two
        // different answers to "then walk away".
        const state = createActivatorState(L71);
        const lock = shieldLock();
        const box = playerBox(AGAINST, 264);
        step(state, L71, box, DARK_SHIELD);
        const faraway = playerBox(200, 100);
        for (let tick = 2; tick <= 101; tick++) step(state, L71, faraway, DARK_SHIELD);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        for (let tick = 1; tick <= 10; tick++) step(state, L71, faraway, DARK_SHIELD);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
    });

    it('...and reports `touching: false` when turnOff finds no player', () => {
        // ⚠ THE TERMINAL CASE, and the reason the event carries the collide
        // at all. `ShieldLock.turnOff()` restores `receiveInput` only
        // `if (p)`, so a player carried out of the rect never gets input
        // back. `levelRun` turns this flag into a named throw; here it is
        // just the fact.
        const state = createActivatorState(L71);
        const lock = shieldLock();
        step(state, L71, playerBox(AGAINST, 264), DARK_SHIELD);
        const faraway = playerBox(200, 100);
        let last = [];
        for (let tick = 2; tick <= 101; tick++) last = step(state, L71, faraway, DARK_SHIELD);
        expect(last).toEqual([{
            kind: 'turnoff', id: lock.id, touching: false, persistTag: 2,
        }]);
        // ...and it goes true again the moment the player is back, because
        // `activate` is still set and `activationStep` calls `turnOff` every
        // tick from here on.
        expect(step(state, L71, playerBox(AGAINST, 263), DARK_SHIELD)).toEqual([{
            kind: 'turnoff', id: lock.id, touching: true, persistTag: 2,
        }]);
    });

    it('refuses to run at all without an inventory', () => {
        // Defaulting the item to false would model a lock that can never
        // open — silently, in the one level where opening it is the errand.
        const state = createActivatorState(L71);
        expect(() => stepActivators(state, L71, playerBox(AGAINST, 264)))
            .toThrow(/no inventory/);
    });
});

describe('the guard the model cannot derive', () => {
    it('NO static solid rests on a button, in any level', () => {
        // ⚠ THE ASSUMPTION THE WHOLE MODEL LEANS ON. `Button.update`
        // presses on any `["Player","Enemy","Solid"]` overlap that is not a
        // Cover; this model presses only on the player. That is exact only
        // while no wall, pole or rock sits inside a button's volume — one
        // that did would hold its group open from the first frame, and the
        // model would report the lock shut for the whole run.
        //
        // Checked over every level that builds, not asserted in prose.
        const offenders = [];
        for (const level of MAP.levels) {
            let world;
            try { world = buildLevelWorld(level, { roles: RELAXED_ROLES }); } catch { continue; }
            for (const hit of staticPressesIn(world)) {
                offenders.push(`L${level.level} ${hit.solid}@${hit.at.x},${hit.at.y} `
                    + `on ${hit.presser.tag} t=${hit.presser.t}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('...and the guard is not vacuous — it CAN report', () => {
        // A negative assertion with no positive control beside it is the
        // failure mode this arc keeps meeting. Build a level with a pole
        // standing on a button and require the guard to name it.
        const world = buildLevelWorld({
            level: 999, width: 4, height: 4, layers: [],
            entities: [
                { type: 'button', x: 0, y: 0, attrs: { tset: '0' } },
                { type: 'pole', x: 0, y: 0 },
            ],
        }, { roles: RELAXED_ROLES });
        const hits = staticPressesIn(world);
        expect(hits).toHaveLength(1);
        expect(hits[0].solid).toBe('pole');
    });

    it('a Cover on a button does NOT press it, which the game says explicitly', () => {
        // `Button.update`'s loop is `if (c && !(c is Cover))` — the one
        // exclusion the class makes, and the reason the v2 census called a
        // Cover "a tile overlay". It is an exclusion from PRESSING, not
        // from BLOCKING.
        const world = buildLevelWorld({
            level: 999, width: 4, height: 4, layers: [],
            entities: [
                { type: 'button', x: 0, y: 0, attrs: { tset: '0' } },
                { type: 'cover', x: 0, y: 0, attrs: { tset: '1' } },
            ],
        }, { roles: RELAXED_ROLES });
        expect(staticPressesIn(world)).toEqual([]);
    });
});

describe('collidesSolid honours an open activator', () => {
    it('the lock stops the player until its group opens it', () => {
        const state = createActivatorState(L71);
        const inLock = playerBox(120, 168);
        expect(L71.collidesSolid(inLock)?.tag).toBe('lock');
        const onButton = playerBox(120, 184);
        for (let tick = 1; tick <= 101; tick++) step(state, L71, onButton);
        const open = openActivatorIds(state);
        expect(L71.collidesSolid(inLock, { openActivators: open })).toBeNull();
        // ...and the OTHER lock in the same level is untouched by it.
        const other = L71.activators.find((a) => a.t === -1);
        expect(open.has(other.id)).toBe(false);
    });
});

describe('the ORACLE: what the game did, not what the model believes', () => {
    // ⚠ THE PAIR IS THE POINT. `l71-button-lock` on its own is satisfied by
    // a lock that was never shut; `l71-lock-shut` on its own is satisfied by
    // a player who never moves. Together they are a claim.
    const levelSource = atlasLevelSource();

    it('the game lets the player through ONLY after the button is held', () => {
        const open = loadExpectation('l71-button-lock');
        const shut = loadExpectation('l71-lock-shut');
        expect(open.provisional, 'l71-button-lock is a real recording').toBe(false);
        expect(shut.provisional, 'l71-lock-shut is a real recording').toBe(false);

        const minY = (e) => Math.min(...e.stream.ticks.map((o) => o.y));
        // Both boot at y = 184, standing on the button. The lock's south
        // face pins the player at 178.5 — one sweep step short of overlap.
        expect(shut.stream.ticks[0].y).toBe(184);
        expect(open.stream.ticks[0].y).toBe(184);
        expect(minY(shut)).toBe(178.5);
        // ...and with the hold, the game walks THROUGH it and keeps going,
        // well north of the lock's [160,176).
        expect(minY(open)).toBeLessThan(120);
    });

    /**
     * ⚠ THE KNIFE-EDGE, PUT TO THE GAME. The pair above proves a hold
     * opens the lock; it says nothing about WHEN, and "101" is a number
     * derived by running a float loop in `opensOnTick`. These two tapes
     * differ in exactly one field — `tick_count`, 101 against 102 — and the
     * game answers them differently. That is what makes a hold one tick
     * short a red on the ORACLE stratum and not only in the executor.
     *
     * Both walk into the lock immediately and are pinned on its south face,
     * pressing the button from there because the box still overlaps it. So
     * the 101st tick is the one `Lock.turnOff()` runs on and the 102nd is
     * the first on which the player can move.
     */
    it('answers 101 ticks and 102 ticks DIFFERENTLY', () => {
        const shut = loadExpectation('l71-hold-101-shut');
        const open = loadExpectation('l71-hold-102-open');
        expect(shut.provisional, 'l71-hold-101-shut is a real recording').toBe(false);
        expect(open.provisional, 'l71-hold-102-open is a real recording').toBe(false);

        const shutTicks = shut.stream.ticks;
        const openTicks = open.stream.ticks;
        // One tick of tape, and nothing else, separates them: every
        // observation the shorter tape has, the longer one has identically.
        expect(openTicks.length).toBe(shutTicks.length + 1);
        shutTicks.forEach((o, i) => expect(openTicks[i], `tick ${i}`).toEqual(o));

        // Pinned for the whole of the shorter tape, from the tick it
        // first reaches the lock's south face onwards.
        const pinnedFrom = shutTicks.findIndex((o) => o.y === 178.5);
        expect(pinnedFrom).toBeGreaterThan(0);
        expect(new Set(shutTicks.slice(pinnedFrom).map((o) => o.y)))
            .toEqual(new Set([178.5]));
        // ...and moved on the one tick the longer tape adds.
        expect(openTicks[openTicks.length - 1].y).toBeLessThan(178.5);
    });

    it('and the MODEL reproduces both, tick for tick', () => {
        // The differential in miniature: the same two tapes through the JS
        // engine must give the game's own streams. This is what makes the
        // 101-tick fade, the clamped alpha and the occupancy guard claims
        // about the GAME rather than about this file.
        for (const name of ['l71-button-lock', 'l71-lock-shut',
            'l71-hold-101-shut', 'l71-hold-102-open']) {
            const oracle = loadExpectation(name).stream;
            const model = runTapeToStream(loadTape(name), { levelSource });
            expect(model.ticks.length, name).toBe(oracle.ticks.length);
            for (let i = 0; i < oracle.ticks.length; i++) {
                expect(model.ticks[i], `${name} tick ${i}`).toMatchObject({
                    x: oracle.ticks[i].x, y: oracle.ticks[i].y, level: oracle.ticks[i].level,
                });
            }
        }
    });
});

/**
 * ── The group a CONSTRUCTOR decides ───────────────────────────────────
 *
 * R2 slice 3 shipped `t: intAttr(e.attrs, 'tset', 0)` for every responder
 * and presser, and the `shieldlock` entry's own comment already said
 * "ShieldLock.as:26 is a bare super with tSet forced to -2". The code did
 * not act on the citation, and it was wrong TWICE over in the same place:
 *
 *   - a `shieldlock` joined group 0, so any `button` with no `tset` — i.e.
 *     the default — "opened" it from anywhere in the level. L71's button is
 *     176 px away from its shieldlock and was opening it.
 *   - `Lock.check()` needs `tSet < 0` to despawn on a cleared flag, and
 *     `int("")` is 0, so a shieldlock stopped responding to its own clear.
 *
 * Neither was caught by the suite as it stood, which is the whole reason
 * this block exists: the fix landed green.
 */
describe('FORCED_TSET: the group the ctor decides, not the .oel', () => {
    const levelSource = atlasLevelSource();

    it('reads `tset` off the attributes for everything else', () => {
        expect(tSetOf('lock', { tset: '3' })).toBe(3);
        expect(tSetOf('lock', { tset: '-1' })).toBe(-1);
        // ⚠ `int("")` is 0: a MISSING attribute is group 0, not "no group".
        expect(tSetOf('lock', {})).toBe(0);
        expect(tSetOf('button', {})).toBe(0);
    });

    it('forces -2 for both ShieldLock spellings, whatever the .oel says', () => {
        expect(FORCED_TSET).toEqual({ shieldlock: -2, shieldlocknorm: -2 });
        for (const tag of Object.keys(FORCED_TSET)) {
            expect(tSetOf(tag, {})).toBe(-2);
            expect(tSetOf(tag, { tset: '0' })).toBe(-2);
            expect(tSetOf(tag, { tset: '7' })).toBe(-2);
        }
    });

    it('keeps L71\'s shieldlock OUT of the button\'s group', () => {
        // `Game.as:2144-2145` builds it as `new ShieldLock(o.@x, o.@y,
        // o.@tag, 0|1)` — the group is never passed, so no attribute can
        // reach it. L71 is the level where it mattered: `button@112,176`
        // (t = 0) and `shieldlock@288,256` are 176 px apart.
        const w = buildLevelWorld(levelSource(71));
        const shield = w.activators.find((a) => a.tag === 'shieldlock');
        const button = w.pressers.find((p) => p.tag === 'button');
        expect(shield.t).toBe(-2);
        expect(button.t).toBe(0);
        expect(w.activators.filter((a) => a.t === button.t).map((a) => a.id))
            .toEqual(['lock@112,160']);
    });

    it('lets a cleared flag despawn a shieldlock, which tset 0 would not', () => {
        // `Lock.check()` is `tag >= 0 && tSet < 0 && !checkPersistence(tag)`.
        const shut = buildLevelWorld(levelSource(71));
        expect(shut.activators.some((a) => a.tag === 'shieldlock')).toBe(true);
        const cleared = buildLevelWorld(levelSource(71), { cleared: [2] });
        expect(cleared.activators.some((a) => a.tag === 'shieldlock')).toBe(false);
        expect(cleared.solids.some((s) => s.tag === 'shieldlock')).toBe(false);
    });

    it('leaves the tset-0 locks standing, which is the other half', () => {
        // The contrast pair. L71's `lock@112,160` carries `tset 0` and
        // `tag 3`, so clearing 3 does NOT remove it — it is the lock the
        // hold exists to open, and a model that despawned it would make the
        // whole R2 crossing vacuous.
        const cleared = buildLevelWorld(levelSource(71), { cleared: [0, 1, 2, 3] });
        expect(cleared.activators.map((a) => a.id)).toEqual(['lock@112,160']);
    });
});
