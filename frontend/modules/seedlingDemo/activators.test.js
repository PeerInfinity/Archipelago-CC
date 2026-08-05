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
    KEY_RESPONDERS,
    PRESSERS,
    RESPONDERS,
    TOUCH_RESPONDERS,
    createActivatorState,
    keyLineTouches,
    openActivatorIds,
    opensOnKeyTick,
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
        //
        // ⚠ THREE FAMILIES NOW, not one. `RESPONDERS` opens on a button
        // group, `KEY_RESPONDERS` on a save-file key — and a tag in neither
        // would be geometry with no semantics, which is exactly what this
        // assertion exists to catch. The union is the membership.
        expect([...ACTIVATOR_RESPONDERS].sort())
            .toEqual([...Object.keys(RESPONDERS), ...Object.keys(KEY_RESPONDERS)].sort());
        expect([...ACTIVATOR_PRESSERS].sort()).toEqual(Object.keys(PRESSERS).sort());
    });

    it('the three families are DISJOINT', () => {
        // A tag in both would be stepped by two arms of `stepActivators`,
        // and the first one to `continue` would decide which — an ordering
        // question nobody would have reviewed.
        for (const tag of Object.keys(KEY_RESPONDERS)) {
            expect(RESPONDERS[tag], tag).toBeUndefined();
            expect(TOUCH_RESPONDERS[tag], tag).toBeUndefined();
        }
    });

    it('RockLock and Pulser are deliberately NOT responders', () => {
        // They ARE `Activators` and they DO carry a `t`, but their
        // `set activate` overrides only play a sound and store the flag —
        // RockLock opens on an ITEM, which is R5. Pulser is
        // `type = "Solid"` unconditionally and `activate` drives only its
        // radius animation. Naming them here stops "it is an Activators"
        // being read as "it opens".
        //
        // ⚠ `bosslock` LEFT this list at R4 and that is the rung: it is the
        // first walk that can hold a `BossKey`, so its opening stopped being
        // hypothetical. It is in `KEY_RESPONDERS` now.
        for (const tag of ['rocklock', 'pulser']) {
            expect(ACTIVATOR_RESPONDERS.has(tag), tag).toBe(false);
        }
        expect(ACTIVATOR_RESPONDERS.has('bosslock')).toBe(true);
    });
});

describe('the BossLock, whose gate is a key and whose probe is a LINE (R4)', () => {
    const L68 = buildLevelWorld(levelRecord(68), { cleared: [1] });
    const lock = L68.activators.find((a) => a.tag === 'bosslock');
    const keyStep = (state, box, keys) =>
        stepActivators(state, L68, box, { inventory: NO_ITEMS, keys });

    it('the census carried the key type and the line, placement-relative', () => {
        // `bosslock@16,32` with keyType 4. `x - originX + m` is oel.x + 2 and
        // the raycast's `while (x < toX)` never tests `toX`, so the last
        // probe is oel.x + width - 2m - 1 = oel.x + 11. The line sits at
        // `y - originY + height + 1` = oel.y + 17.
        expect(lock.keyType).toBe(4);
        expect(lock.keyLine).toEqual({ x0: 18, x1: 27, y: 49 });
    });

    it('the line is an INTEGER probe test, not a rect overlap', () => {
        // A box whose left edge is past the last probe overlaps the line's
        // bounding rect and contains none of its points. Half a pixel of
        // over-permission, in the one mechanic whose false positive writes
        // persistence in another level.
        expect(keyLineTouches(playerBox(24, 50), lock.keyLine)).toBe(true);
        expect(keyLineTouches({ x: 27.5, right: 31.5, y: 48, bottom: 53 },
            lock.keyLine)).toBe(false);
        expect(keyLineTouches({ x: 27, right: 31, y: 48, bottom: 53 },
            lock.keyLine)).toBe(true);
    });

    it('the stance is the PIN against the lock, and the lattice has no cell for it', () => {
        // The player box is [x-2,x+2) x [y-2,y+3). To contain y = 49 it needs
        // 46 < y <= 51; to stay out of the lock's [32,48) it needs y >= 50.
        // The pitch-8 lattice offers 44 (inside the lock) and 52 (below the
        // line) and nothing between — so the leg's target is a PIXEL, and the
        // wall is what stops it. Named here because a route that aimed at a
        // node centre would press nothing and say nothing.
        expect(keyLineTouches(playerBox(24, 52), lock.keyLine)).toBe(false);
        expect(keyLineTouches(playerBox(24, 50), lock.keyLine)).toBe(true);
        expect(keyLineTouches(playerBox(24, 51), lock.keyLine)).toBe(true);
    });

    it('no key means no opening, ever', () => {
        const state = createActivatorState(L68);
        for (let tick = 1; tick <= 200; tick++) keyStep(state, playerBox(24, 50), new Set());
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
    });

    it('with the key it opens on tick 80 and writes the flag ONCE', () => {
        const state = createActivatorState(L68);
        const keys = new Set([4]);
        let opens = [];
        for (let tick = 1; tick <= 79; tick++) {
            opens = opens.concat(keyStep(state, playerBox(24, 50), keys));
            expect(openActivatorIds(state).has(lock.id), `tick ${tick}`).toBe(false);
        }
        const events = keyStep(state, playerBox(24, 50), keys);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        expect(events).toEqual([{ kind: 'keyopen', id: lock.id, persistTag: 0 }]);
        expect(opens).toEqual([]);
        // ...and the write does not repeat: the AS3 guard is `type != ""`.
        for (let tick = 1; tick <= 40; tick++) {
            expect(keyStep(state, playerBox(24, 50), keys)).toEqual([]);
        }
    });

    it('⚠ it LATCHES — walking away does not stop the fade', () => {
        // `tSet` is forced to -1 by the ctor's `super(..., -1)`, so no
        // `Button.activateAll` republishes the flag, and nothing else in the
        // extract writes it. The `else if (type != normType)` re-close arm is
        // therefore unreachable after the first touch — which is what makes
        // this class NOT a `Lock`, whose occupancy-guarded `returnToNormal`
        // really does shut on a player who leaves.
        const state = createActivatorState(L68);
        const keys = new Set([4]);
        keyStep(state, playerBox(24, 50), keys);
        const away = playerBox(24, 100);
        for (let tick = 2; tick <= 79; tick++) keyStep(state, away, keys);
        const events = keyStep(state, away, keys);
        expect(events).toEqual([{ kind: 'keyopen', id: lock.id, persistTag: 0 }]);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
    });

    it('and it refuses to answer at all when the run did not say which keys it holds', () => {
        const state = createActivatorState(L68);
        expect(() => stepActivators(state, L68, playerBox(24, 50), { inventory: NO_ITEMS }))
            .toThrow(/no key set/);
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

    it('a BossLock opens on tick 80, and NOT on 81', () => {
        // ⚠ A DIFFERENT NUMBER AND A DIFFERENT REASON. `BossLock` runs
        // `keyTimer` down from 60 FIRST — and the frame that latches
        // `activate` is also the frame of the first decrement, because the
        // assignment sits above `if (activate)` in the same `update()`. Then
        // `alpha -= 0.05` on a bare `Number`, with NO `Image.alpha` clamp:
        // the twentieth subtraction lands on -3.19e-16, which is `<= 0`. A
        // model that clamped, or that read `1 / 0.05`, answers 81 and 20.
        expect(opensOnKeyTick(60, 0.05)).toBe(80);
        expect(60 + 20).toBe(80);
        expect(KEY_RESPONDERS.bosslock.keyTimer).toBe(60);
        expect(KEY_RESPONDERS.bosslock.fade).toBe(0.05);
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

    it('forces the ctor value, whatever the .oel says — and there are THREE', () => {
        // ⛔⛔ R5 slice 10: `bosslock` joined this table late, and the
        // docblock that used to say "nothing else in `Puzzlements/`
        // hardcodes one (checked every `super(` call)" was wrong when it was
        // written. `BossLock.as:31` puts the literal in the FOURTH argument
        // with `_t` — the key type — in the third, which is the shape the
        // sweep was looking for.
        expect(FORCED_TSET).toEqual({ shieldlock: -2, shieldlocknorm: -2, bosslock: -1 });
        for (const [tag, want] of Object.entries(FORCED_TSET)) {
            expect(tSetOf(tag, {})).toBe(want);
            expect(tSetOf(tag, { tset: '0' })).toBe(want);
            expect(tSetOf(tag, { tset: '7' })).toBe(want);
        }
        // …and the key type is NOT the group, which is the whole confusion.
        expect(tSetOf('bosslock', { keyType: '2' })).toBe(-1);
    });

    it('⛔⛔ keeps L40\'s bosslock OUT of `buttonroom@272,208`\'s group — §20.6 REFUTED', () => {
        // §20.6 argued the bosslock is "an `Activators` in group t = 0", so
        // the `room = -1` buttonroom's latch would open it WITH NO KEY, and
        // concluded the walk should not collect `bosskey@656,528`. With the
        // group hard-wired to -1 no publication can reach it at all:
        // `BossLock.update`'s own probe line plus `Player.hasKey(2)` is its
        // only opener. The model had it in the UNSAFE direction — a wall it
        // opened that the game keeps shut.
        const w = buildLevelWorld(levelSource(40));
        const boss = w.activators.find((a) => a.tag === 'bosslock');
        expect(boss.id).toBe('bosslock@480,352');
        expect(boss.t).toBe(-1);
        expect(boss.keyType).toBe(2);
        // The buttonroom really is in group 0 and really does latch — so the
        // refutation is about the LOCK's group and not about the presser.
        const room = w.pressers.find((p) => p.tag === 'buttonroom' && p.x === 272);
        expect(room.t).toBe(0);
        expect(room.room).toBe(-1);
        expect(room.t).not.toBe(boss.t);
        // …and the three wandlocks in group 0 ARE reachable by it, which is
        // what makes this a correction rather than a blanket "nothing opens".
        const inGroup0 = w.activators.filter((a) => a.t === 0).map((a) => a.id).sort();
        expect(inGroup0).toEqual(['wandlock@208,128', 'wandlock@208,144', 'wandlock@208,160']);
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

/**
 * ── R5 SLICE 6: THE SECOND PRESSER ────────────────────────────────────
 *
 * `Button.update`'s `hitables` has been `["Player", "Enemy", "Solid"]`
 * since R2 and this model has pressed on the player alone since R2. L39's
 * shaft is the room the docblock has been promising: three blocks, three
 * lock-buttons, and a cover that latches itself open under whatever is
 * standing on it.
 *
 * L39 is the fixture because it is the room the claim is about — the
 * geometry is the game's, not a constructed one, and the tiles below come
 * out of `buildLevelWorld` rather than out of this file.
 */
describe('R5 slice 6 — a BLOCK presses a button and latches a door', () => {
    const L39 = buildLevelWorld(levelRecord(39));
    const tileBox = (tx, ty) => rect(tx * 16, ty * 16, 16, 16);
    /** Far from every button and every door in this room. */
    const AWAY = playerBox(24, 24);
    const solid = (tx, ty) => ({ id: `b@${tx},${ty}`, rect: tileBox(tx, ty) });
    const doorState = (state, id) => state.byId.get(id);

    it('the room is the one the plan describes', () => {
        // Guard rather than decoration: every claim below indexes these.
        expect(L39.pressers.map((p) => p.t).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(L39.pushables).toHaveLength(3);
        expect(L39.activators.filter((a) => a.tag === 'cover')).toHaveLength(3);
    });

    it('a block on `button t1` presses it and the player does not have to', () => {
        // (9,8) is `button t1`. Nobody is standing on it.
        expect([...pressedGroups(L39, AWAY)]).toEqual([]);
        expect([...pressedGroups(L39, AWAY, [solid(9, 8)])]).toEqual([1]);
    });

    it('and the group it presses has TWO responders — the cover and a wandlock', () => {
        const state = createActivatorState(L39);
        const blocks = [solid(9, 8)];
        // 101 ticks opens a Lock; 11 opens a Cover. Run past both.
        for (let i = 0; i < 120; i += 1) {
            stepActivators(state, L39, AWAY, { inventory: {}, movingSolids: blocks });
        }
        expect(doorState(state, 'cover@176,144').open).toBe(true);
        expect(doorState(state, 'wandlock@48,160').open).toBe(true);
        // And nothing in another group moved.
        expect(doorState(state, 'cover@144,112').open).toBe(false);
    });

    it('⛓ THE LATCH: the block that opened a cover can leave if another stands in it', () => {
        const state = createActivatorState(L39);
        const opener = solid(9, 8);          // button t1 -> cover t1 @ (11,9)
        for (let i = 0; i < 20; i += 1) {
            stepActivators(state, L39, AWAY, { inventory: {}, movingSolids: [opener] });
        }
        expect(doorState(state, 'cover@176,144').open).toBe(true);
        // The opener leaves and NOTHING is in the cover: it re-solidifies.
        const gone = createActivatorState(L39);
        for (let i = 0; i < 20; i += 1) {
            stepActivators(gone, L39, AWAY, { inventory: {}, movingSolids: [opener] });
        }
        stepActivators(gone, L39, AWAY, { inventory: {}, movingSolids: [] });
        expect(doorState(gone, 'cover@176,144').open).toBe(false);
        // Same tick, but a block is standing in the cover: it stays open.
        stepActivators(state, L39, AWAY, { inventory: {}, movingSolids: [solid(11, 9)] });
        expect(doorState(state, 'cover@176,144').open).toBe(true);
        // ⛓ AND THE BLOCK IN IT IS ALSO ON `button t5`, so the wandlock the
        // shaft needs opens from the same stone. That double duty is why
        // three blocks can cover four holds.
        for (let i = 0; i < 120; i += 1) {
            stepActivators(state, L39, AWAY, { inventory: {}, movingSolids: [solid(11, 9)] });
        }
        expect(doorState(state, 'wandlock@144,32').open).toBe(true);
    });

    it('the PLAYER latches a door the same way — the guard reads both', () => {
        const state = createActivatorState(L39);
        for (let i = 0; i < 20; i += 1) {
            stepActivators(state, L39, AWAY, { inventory: {}, movingSolids: [solid(9, 8)] });
        }
        // Player standing in `cover t1` at (11,9), block gone.
        stepActivators(state, L39, playerBox(184, 152), { inventory: {}, movingSolids: [] });
        expect(doorState(state, 'cover@176,144').open).toBe(true);
    });

    it('⚠ a cover does NOT press the button under it — the game excludes its own class', () => {
        // `cover@144,112` sits exactly on `button t4` at (9,7). If covers
        // pressed, group 4 would be held from the first frame and
        // `wandlock@144,48` would never be a gate at all.
        expect([...pressedGroups(L39, AWAY)]).toEqual([]);
        expect(staticPressesIn(L39)).toEqual([]);
    });

    it('and `movingSolids` defaults to none, so every pre-R5 caller is unchanged', () => {
        const before = [...pressedGroups(L71, playerBox(120, 184))];
        expect([...pressedGroups(L71, playerBox(120, 184), [])]).toEqual(before);
    });
});
