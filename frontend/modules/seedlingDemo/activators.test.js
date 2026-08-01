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
    RELAXED_ROLES,
    buildLevelWorld,
    rect,
} from './levelWorld.js';
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
            stepActivators(state, L71, onButton);
            expect(openActivatorIds(state).has(lock.id), `tick ${tick}`).toBe(false);
        }
        stepActivators(state, L71, onButton);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
    });

    it('and releasing the button re-solidifies it — but only once clear', () => {
        const state = createActivatorState(L71);
        const lock = L71.activators.find((a) => a.tag === 'lock' && a.t === 0);
        const onButton = playerBox(120, 184);
        for (let tick = 1; tick <= 101; tick++) stepActivators(state, L71, onButton);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        // Standing INSIDE the lock, off the button: `returnToNormal` is
        // guarded by `!collideTypes(hitables, x, y)`, so it stays open.
        const inLock = playerBox(120, 170);
        stepActivators(state, L71, inLock);
        expect(openActivatorIds(state).has(lock.id)).toBe(true);
        // Clear of both: it closes on the very next tick.
        const clearOfBoth = playerBox(120, 140);
        stepActivators(state, L71, clearOfBoth);
        expect(openActivatorIds(state).has(lock.id)).toBe(false);
        // ...and re-opening costs the full 101 again — the fade RESETS,
        // it does not resume, because the else-arm restores alpha to 1.
        for (let tick = 1; tick <= 100; tick++) stepActivators(state, L71, onButton);
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
        for (let tick = 1; tick <= 101; tick++) stepActivators(state, L71, onButton);
        const open = openActivatorIds(state);
        expect(L71.collidesSolid(inLock, { openActivators: open })).toBeNull();
        // ...and the OTHER lock in the same level is untouched by it.
        const other = L71.activators.find((a) => a.t === -1);
        expect(open.has(other.id)).toBe(false);
    });
});
