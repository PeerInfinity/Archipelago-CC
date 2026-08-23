/**
 * combatVerbs — every case here is read off `Player.as`, not produced by
 * the module under test.
 *
 * ⚠ The §14 law: a mutation table is not an independent stratum when the
 * fixture and the check share a derivation. So the numbers below are
 * hand-computed from the source lines named in each comment, and the
 * module's OTHER stratum is the live game — the first kill pair, where the
 * lock either opens or does not.
 */

import { describe, expect, it } from 'vitest';

import { ENEMY_IFRAMES, KILL_CADENCE_FLOOR } from './combat.js';
import { rect } from './levelWorld.js';
import {
    distanceRectPoint,
    HITABLE_TYPES,
    killSchedule,
    KILL_PRESS_CADENCE,
    slashRect,
    slashScaleFor,
    slashSet,
    slashTimerTick,
    INITIAL_SLASH_STATE,
    SLASH_DASH_FORCE,
    SLASH_ANIM_DASH,
    SLASH_ANIM_NORMAL,
    SLASH_TIMER_MAX,
    SLASH_SCALE_DASH,
    SLASH_SCALE_NORMAL,
    SLASH_SPRITES,
    SLASH_TIMER_MAX,
    swing,
    swingHits,
    SWORD_DAMAGE,
} from './combatVerbs.js';

/** A clear line of sight, named so a test that needs a wall says so. */
const clear = () => false;
const walled = () => true;

const enemyAt = (id, cx, cy, half = 6) => ({
    id, cx, cy, type: 'Enemy',
    box: rect(cx - half, cy - half, half * 2, half * 2),
});

describe('the slash rect is getSlashRect, transcribed', () => {
    it('right (0): 16 wide from the player, 32 tall centred on them', () => {
        // `case 0: rect.x = x; rect.y = y - h/2*scaleY;
        //          rect.width = width*scaleX; rect.height = h*scaleY`
        // with width 16, h = height = 32, scale 1.
        expect(slashRect(100, 100, 0)).toEqual(rect(100, 84, 16, 32));
    });

    it('up (1), left (2), down (3) — the axes swap, and w/h swap with them', () => {
        expect(slashRect(100, 100, 1)).toEqual(rect(84, 84, 32, 16));
        expect(slashRect(100, 100, 2)).toEqual(rect(84, 84, 16, 32));
        expect(slashRect(100, 100, 3)).toEqual(rect(84, 100, 32, 16));
    });

    it('the DASH rect is 24 x 20.8, not 16 x 32', () => {
        // scaleX 1.5, scaleY 0.65 (`Player.as:1260-1261`): w = 16*1.5 = 24,
        // h = 32*0.65 = 20.8, and the y offset halves with it.
        const r = slashRect(100, 100, 0, { scale: SLASH_SCALE_DASH });
        expect(r.x).toBe(100);
        expect(r.y).toBeCloseTo(100 - 10.4, 10);
        expect(r.right - r.x).toBe(24);
        expect(r.bottom - r.y).toBeCloseTo(20.8, 10);
    });

    it('⛔ the GHOST SWORD is width*2 tall, from a 7-pixel sprite', () => {
        // `const h:int = hasGhostSword ? slashingSprite.width*2 : ...`
        // The sprite is 24x7, so h is 48 — reading `height` would give 7
        // and shrink the one item whose reach is its reason to exist by 7x.
        expect(SLASH_SPRITES.ghostsword).toMatchObject({ w: 24, h: 7 });
        expect(slashRect(100, 100, 0, { sword: 'ghostsword' }))
            .toEqual(rect(100, 76, 24, 48));
    });

    it('refuses a direction outside 0..3 instead of returning the zero rect', () => {
        // `getSlashRect`'s `default:` arm leaves the Rectangle all zeros,
        // which is a hit test at the world origin rather than an absent one.
        expect(() => slashRect(100, 100, -1)).toThrow(/is not 0\.\.3/);
        expect(() => slashRect(100, 100, 4)).toThrow(/all-zero Rectangle/);
    });

    it('every rect it builds carries right/bottom', () => {
        for (const d of [0, 1, 2, 3]) {
            const r = slashRect(50, 60, d);
            expect(Number.isFinite(r.right)).toBe(true);
            expect(Number.isFinite(r.bottom)).toBe(true);
        }
    });
});

describe('the scale is ONE FRAME STALE', () => {
    it('reads the PREVIOUS tick\'s animation', () => {
        expect(slashScaleFor('slash')).toEqual(SLASH_SCALE_NORMAL);
        expect(slashScaleFor('slashnarrow')).toEqual(SLASH_SCALE_DASH);
    });

    it('⛔ and is LEFT where it was when the swing ended', () => {
        // `Player.render`'s scale write is inside `if (slashing)`. When
        // `slashEnd` drops the flag nothing resets it, so the value survives
        // into whatever reads it next.
        expect(slashScaleFor(null, { lastScale: SLASH_SCALE_DASH }))
            .toEqual(SLASH_SCALE_DASH);
        expect(slashScaleFor(undefined, { lastScale: SLASH_SCALE_NORMAL }))
            .toEqual(SLASH_SCALE_NORMAL);
    });

    it('the ghost sword does NOT get the squash even when dashing', () => {
        // `currentAnim == "slashnarrow" && !hasGhostSword` — the ghost arm
        // rotates the sprite instead.
        expect(slashScaleFor('slashnarrow', { hasGhostSword: true }))
            .toEqual(SLASH_SCALE_NORMAL);
    });
});

describe('FP.distanceRectPoint', () => {
    const r = rect(10, 10, 20, 20);   // [10,30) x [10,30)
    it('is 0 inside', () => expect(distanceRectPoint(20, 20, r)).toBe(0));
    it('is axis-aligned beside a face', () => {
        expect(distanceRectPoint(35, 20, r)).toBe(5);
        expect(distanceRectPoint(5, 20, r)).toBe(5);
        expect(distanceRectPoint(20, 35, r)).toBe(5);
        expect(distanceRectPoint(20, 5, r)).toBe(5);
    });
    it('is the corner distance diagonally', () => {
        expect(distanceRectPoint(33, 34, r)).toBeCloseTo(Math.hypot(3, 4), 10);
    });
});

describe('the swing hit test', () => {
    it('⛔ needs the rect AND the distance filter — the CORNER is the gap', () => {
        // The rect for direction 0 at (100,100) is [100,116) x [84,116),
        // and the reach is 16. Those are not the same region: the rect's
        // own corners are 16.97 px from the player, so a body sitting in
        // one OVERLAPS THE RECT AND IS STILL NOT HIT. A rect-only model
        // reaches into all four corners the game does not.
        const inside = enemyAt('near', 114, 86);
        expect(swingHits({ x: 100, y: 100 }, 0, [inside], { blockedLine: clear }))
            .toHaveLength(1);
        const corner = { ...enemyAt('corner', 114, 114), box: rect(112, 112, 4, 4) };
        expect(distanceRectPoint(100, 100, corner.box))
            .toBeCloseTo(Math.hypot(12, 12), 10);      // 16.97 > 16
        expect(swingHits({ x: 100, y: 100 }, 0, [corner], { blockedLine: clear }))
            .toHaveLength(0);
        // Slide the same body onto the rect's axis and it lands: the
        // distance is then 12, not 16.97.
        const axis = { ...corner, box: rect(112, 98, 4, 4) };
        expect(distanceRectPoint(100, 100, axis.box)).toBe(12);
        expect(swingHits({ x: 100, y: 100 }, 0, [axis], { blockedLine: clear }))
            .toHaveLength(1);
    });

    it('the DASH rect is WIDER and SHORTER, and both halves matter', () => {
        // [100,124) x [89.6,110.4) against the normal [100,116) x [84,116).
        // A body at [118,122) x [100,104) is outside the normal rect
        // entirely (right 116 does not reach 118) and inside the dash one,
        // at distance 18 — past the normal reach of 16, inside the dash
        // reach of 24.
        const e = { ...enemyAt('e', 120, 102), box: rect(118, 100, 4, 4) };
        expect(distanceRectPoint(100, 100, e.box)).toBe(18);
        expect(swingHits({ x: 100, y: 100 }, 0, [e], { blockedLine: clear }))
            .toHaveLength(0);
        expect(swingHits({ x: 100, y: 100 }, 0, [e],
            { blockedLine: clear, scale: SLASH_SCALE_DASH })).toHaveLength(1);
        // And the SHORTER half: a body the normal rect reaches at the top
        // of its 32 px span is outside the dash rect's 20.8.
        const high = { ...enemyAt('h', 108, 86), box: rect(104, 84, 8, 4) };
        expect(swingHits({ x: 100, y: 100 }, 0, [high], { blockedLine: clear }))
            .toHaveLength(1);
        expect(swingHits({ x: 100, y: 100 }, 0, [high],
            { blockedLine: clear, scale: SLASH_SCALE_DASH })).toHaveLength(0);
    });

    it('a wall between the CENTRES refuses the hit', () => {
        const e = enemyAt('e', 108, 100);
        expect(swingHits({ x: 100, y: 100 }, 0, [e], { blockedLine: clear }))
            .toHaveLength(1);
        expect(swingHits({ x: 100, y: 100 }, 0, [e], { blockedLine: walled }))
            .toHaveLength(0);
    });

    it('and the FOUR exemptions ignore the wall', () => {
        // `|| hasGhostSword || e.type == "Solid" || e.type == "Rope" || e is Flyer`
        const e = enemyAt('e', 108, 100);
        expect(swingHits({ x: 100, y: 100 }, 0, [e],
            { blockedLine: walled, sword: 'ghostsword' })).toHaveLength(1);
        expect(swingHits({ x: 100, y: 100 }, 0, [{ ...e, type: 'Solid' }],
            { blockedLine: walled })).toHaveLength(1);
        expect(swingHits({ x: 100, y: 100 }, 0, [{ ...e, type: 'Rope' }],
            { blockedLine: walled })).toHaveLength(1);
        expect(swingHits({ x: 100, y: 100 }, 0, [{ ...e, isFlyer: true }],
            { blockedLine: walled })).toHaveLength(1);
    });

    it('THROWS rather than defaulting a missing LOS oracle to "clear"', () => {
        // A default of "no wall" would make every wall a swing the walk can
        // make, and it would do it silently — the check that cannot fail.
        expect(() => swingHits({ x: 100, y: 100 }, 0, [enemyAt('e', 108, 100)]))
            .toThrow(/Defaulting it to "clear"/);
    });

    it('measures Grass centre-to-centre and everything else point-to-box', () => {
        // Two different distances in one `if` (`Player.as:913-914`), and the
        // Grass arm is the shorter one: a 12x12 body at (114,100) is 8 px
        // away box-wise and 14 px away centre-wise.
        const g = { ...enemyAt('g', 114, 100), type: 'Grass', isGrass: true };
        expect(swingHits({ x: 100, y: 100 }, 0, [g], { blockedLine: clear }))
            .toHaveLength(1);
        const gFar = { ...enemyAt('g', 100, 100), cx: 100, cy: 118, isGrass: true,
            type: 'Grass', box: rect(98, 110, 4, 4) };
        // box distance is 10 (inside 16) but centre distance is 18 (outside).
        expect(distanceRectPoint(100, 100, gFar.box)).toBeLessThan(16);
        expect(swingHits({ x: 100, y: 100 }, 3, [gFar], { blockedLine: clear }))
            .toHaveLength(0);
    });

    it('reports the `t` string and the damage genericHit would carry', () => {
        const e = enemyAt('e', 108, 100);
        expect(swingHits({ x: 100, y: 100 }, 0, [e], { blockedLine: clear })[0])
            .toMatchObject({ t: 'Sword', damage: SWORD_DAMAGE.sword });
        expect(swingHits({ x: 100, y: 100 }, 0, [e],
            { blockedLine: clear, sword: 'darksword' })[0])
            .toMatchObject({ t: 'Sword', damage: 2 });
        // ⚠ The ghost sword hits as "Spear", not "Sword" — which is what
        // makes it work on a LightPole and on the bridge tile.
        expect(swingHits({ x: 100, y: 100 }, 0, [e],
            { blockedLine: clear, sword: 'ghostsword' })[0])
            .toMatchObject({ t: 'Spear', damage: 2 });
    });

    it('carries the hitables list in its own order, Solid included', () => {
        expect(HITABLE_TYPES).toContain('Solid');
        expect(HITABLE_TYPES[0]).toBe('Enemy');
        expect(HITABLE_TYPES).toHaveLength(11);
    });
});

describe('a press does not hit on its own tick', () => {
    it('the first hit test is atTick + 1', () => {
        // `Player.update` calls `slash()` at :560 and `super.update()` — the
        // path to `input()` and `useItem` — at :575.
        const s = swing(40, { x: 100, y: 100 }, 0, [enemyAt('e', 108, 100)],
            { blockedLine: clear });
        expect(s.press).toBe(40);
        expect(s.firstTestTick).toBe(41);
        expect(s.expect).toHaveLength(1);
    });

    it('the span has a release edge inside the tape', () => {
        const s = swing(40, { x: 100, y: 100 }, 0, [], { blockedLine: clear });
        expect(s.spans).toEqual([{ key: 'primary', from: 40, to: 42 }]);
    });
});

describe('the kill schedule', () => {
    const jelly = { tag: 'jellyfish', cx: 100, cy: 100 };

    it('the cadence floor is the I-FRAME one, not the dash one', () => {
        // 21 is about the PLAYER (a second press inside slashTimer 20 is a
        // dash); 31 is about the ENEMY (hitsTimerMax 30). They are different
        // facts and the larger wins.
        expect(SLASH_TIMER_MAX).toBe(20);
        expect(KILL_CADENCE_FLOOR).toBe(21);
        expect(ENEMY_IFRAMES).toBe(30);
        expect(KILL_PRESS_CADENCE).toBe(31);
    });

    it('refuses a cadence under the floor, by name', () => {
        expect(() => killSchedule(jelly, 0, { cadence: 30 }))
            .toThrow(/is under the 31-tick floor/);
    });

    it('three plain-sword presses for a jellyfish, two with the darksword', () => {
        expect(killSchedule(jelly, 100, { slack: 0 }).ticks)
            .toEqual([100, 131, 162]);
        expect(killSchedule(jelly, 100, { slack: 0, hasDarkSword: true }).ticks)
            .toEqual([100, 131]);
    });

    it('carries a slack press by default, and says the count is a FLOOR', () => {
        const s = killSchedule(jelly, 0);
        expect(s.landedNeeded).toBe(3);
        expect(s.presses).toBe(4);
        expect(s.assertion).toMatch(/the EFFECT/);
    });

    it('⛔ the window floor runs past the DEATH ANIMATION', () => {
        // Both chasers play "die" without setting `destroy`; `endAnim` does
        // that when the animation completes, and `Game.totalEnemies()`
        // counts the body until then. A jellyfish's 8 frames at rate 7 step
        // 7*0.0333 = 0.2331 per tick, so ceil(8/0.2331) = 35 ticks, plus the
        // press's own one-tick lag.
        const s = killSchedule(jelly, 0, { slack: 0 });
        expect(s.ticks[s.ticks.length - 1]).toBe(62);
        expect(s.windowFloor).toBe(62 + 36);
    });

    it('refuses a class with no chaser transcription instead of assuming 0', () => {
        // `bulb` has a census row (1 hit) but no `chasers.js` entry, so its
        // death length is unknown — and the window floor is mostly that
        // length.
        expect(() => killSchedule({ tag: 'bulb', cx: 0, cy: 0 }, 0))
            .toThrow(/no chaser transcription/);
    });

    it('refuses a boss — an encounter script is not a press schedule', () => {
        // `lavaboss` carries `kill: { hits: null }`: the census KNOWS it is
        // a kill target and refuses to price it, which is a different
        // statement from "no row".
        expect(() => killSchedule({ tag: 'lavaboss', cx: 0, cy: 0 }, 0))
            .toThrow(/ENCOUNTER SCRIPT/);
        expect(() => killSchedule({ tag: 'nosuchtag', cx: 0, cy: 0 }, 0))
            .toThrow(/no combat row/);
    });
});

describe('R9 slice 12b: `set slashing` (Player.as:779-804), the whole setter', () => {
    /** A press with the sword in hand, facing right, at the given velocity. */
    const press = (st, opts = {}) => slashSet(st, {
        pressed: true, hasSword: true, direction: 0, vx: 0, vy: 0, ...opts,
    });
    /** `slashEnd()` — the animation's own callback. */
    const release = (st, opts = {}) => slashSet(st, {
        pressed: false, hasSword: true, direction: 0, ...opts,
    });
    /** Advance `n` ticks of `slash()`'s decrement, which runs ABOVE the press. */
    const ticks = (st, n) => {
        let s = st;
        for (let i = 0; i < n; i += 1) s = slashTimerTick(s);
        return s;
    };

    it('starts with all four fields at their construction values', () => {
        expect(INITIAL_SLASH_STATE).toEqual({
            slashing: false, slashTimer: 0, slashDashed: false, anim: null,
        });
    });

    it('a first press plays "slash", latches the direction and arms the 20-tick timer', () => {
        const r = press(INITIAL_SLASH_STATE, { direction: 2 });
        expect(r.outcome).toBe('slash');
        expect(r.slashDirection).toBe(2);
        expect(r.impulse).toBeNull();
        expect(r.state).toEqual({
            slashing: true, slashTimer: SLASH_TIMER_MAX, slashDashed: false,
            anim: SLASH_ANIM_NORMAL,
        });
    });

    /**
     * ⛓⛓ THE WINDOW IS `gap <= 19`, AND THE DECREMENT'S PLACE IS WHY.
     * `slash()` runs at the top of `Player.update`, above `super.update()` and
     * therefore above the press, so a press `k` ticks later reads `20 - k`.
     */
    it('dashes at gap 19 and takes an ordinary swing at gap 20', () => {
        const first = press(INITIAL_SLASH_STATE).state;
        // The swing has long since ended by then, so `slashing` is down for both.
        const ended = release(first).state;

        const at19 = press(ticks(ended, 19));
        expect(at19.state.slashTimer).toBe(1);          // still up when read
        expect(at19.outcome).toBe('dash');

        const at20 = press(ticks(ended, 20));
        expect(at20.outcome).toBe('slash');             // the timer ran out
        expect(at20.state.slashTimer).toBe(SLASH_TIMER_MAX);
    });

    it('the dash does NOT refresh `slashTimer` — note 2', () => {
        const first = press(INITIAL_SLASH_STATE).state;
        const later = ticks(first, 5);
        const dash = press(later);
        expect(dash.outcome).toBe('dash');
        expect(dash.state.slashTimer).toBe(SLASH_TIMER_MAX - 5);
        expect(dash.state.anim).toBe(SLASH_ANIM_DASH);
    });

    it('the dash branch does not ask whether a swing is open — note 1', () => {
        // Pressed one tick into an OPEN swing: `slashing` is still true.
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        expect(open.slashing).toBe(true);
        expect(press(open).outcome).toBe('dash');
    });

    it('shoves along the player\'s own velocity, and is inert at rest', () => {
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        expect(press(open, { vx: 2, vy: 0 }).impulse)
            .toEqual({ dvx: SLASH_DASH_FORCE, dvy: 0 });
        // ⛓ Four of the eight roster tapes that reach the dash press at rest,
        // and this is why they are blind to the knockback half.
        expect(press(open, { vx: 0, vy: 0 }).impulse).toEqual({ dvx: 0, dvy: 0 });
    });

    it('SWALLOWS a third press whole — note 4', () => {
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        const dashed = press(open).state;
        const third = press(ticks(dashed, 1));
        expect(third.outcome).toBe('swallowed');
        expect(third.impulse).toBeNull();
        // Nothing moved: the timer kept counting down and the anim stayed put.
        expect(third.state).toEqual({
            slashing: true, slashTimer: SLASH_TIMER_MAX - 2, slashDashed: true,
            anim: SLASH_ANIM_DASH,
        });
    });

    it('the RELEASE re-arms the dash inside the same timer window — note 3', () => {
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        const dashed = press(open).state;
        expect(dashed.slashDashed).toBe(true);
        const ended = release(ticks(dashed, 4));
        expect(ended.outcome).toBe('release');
        expect(ended.state.slashDashed).toBe(false);
        expect(ended.state.slashing).toBe(false);
        // Still inside the ORIGINAL 20 — so the next press dashes AGAIN.
        expect(ended.state.slashTimer).toBeGreaterThan(0);
        expect(press(ended.state).outcome).toBe('dash');
    });

    it('the outer gate guards the RELEASE too — note 5', () => {
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        const dashed = press(open).state;
        const blocked = release(dashed, { spearing: true });
        expect(blocked.outcome).toBe('gated');
        // `_slashing` stays UP and `slashDashed` stays SET — the whole body,
        // release included, is inside the `if`.
        expect(blocked.state).toBe(dashed);
        expect(blocked.state.slashDashed).toBe(true);
    });

    it('each of the outer gate\'s six terms closes it, and the ghost sword opens it', () => {
        for (const flag of ['wanding', 'firing', 'deathRaying', 'spearing']) {
            expect(press(INITIAL_SLASH_STATE, { [flag]: true }).outcome).toBe('gated');
        }
        expect(press(INITIAL_SLASH_STATE, { hasSword: false }).outcome).toBe('gated');
        expect(press(INITIAL_SLASH_STATE, { hasSword: false, hasGhostSword: true }).outcome)
            .toBe('slash');
    });

    it('`slashTimerTick` floors at zero and never goes negative', () => {
        expect(slashTimerTick({ ...INITIAL_SLASH_STATE, slashTimer: 1 }).slashTimer).toBe(0);
        expect(slashTimerTick({ ...INITIAL_SLASH_STATE, slashTimer: 0 }).slashTimer).toBe(0);
        expect(slashTimerTick(INITIAL_SLASH_STATE)).toBe(INITIAL_SLASH_STATE);
    });

    /**
     * ⛓ THE DASH'S RECT IS THE ONE `slashScaleFor` HAS ALWAYS RETURNED AND
     * NOTHING EVER ASKED FOR. Before this slice `SLASH_SCALE_DASH` had no
     * production caller at all — every reference outside `combatVerbs.js` was
     * in this file. `slashSet`'s `anim` is what finally selects it.
     */
    it('the dash\'s anim is what selects the 1.5x0.65 rect', () => {
        const open = ticks(press(INITIAL_SLASH_STATE).state, 1);
        expect(slashScaleFor(press(open).state.anim)).toEqual(SLASH_SCALE_DASH);
        expect(slashScaleFor(press(INITIAL_SLASH_STATE).state.anim))
            .toEqual(SLASH_SCALE_NORMAL);
    });
});
