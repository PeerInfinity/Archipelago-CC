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
import { rect, ROLES } from './levelWorld.js';
import { knockbackImpulse } from './playerPhysicsV2.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
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
    animCompleteTicks,
    SLASH_ANIM_TICKS,
    SWORD_ANIM_RATE,
    SWORD_ANIM_RATE_DASH,
    DASH_CHAIN,
    DASH_CHAIN_MAX,
    ORDINARY_SWING_PERIOD,
    KILL_PRESS_CADENCE,
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

    /**
     * ⛓⛓ R9 SLICE 12b — THE REFUSAL SURVIVES AND ITS REASON DOES NOT.
     *
     * `killSchedule` schedules presses at ONE body, so the RECEIVER's i-frame
     * binds it whatever the presser can do — the behaviour is unchanged. What
     * changed is that the throw no longer cites the dash: a press inside
     * `SLASH_TIMER_MAX` is refused here because it would not DAMAGE, not
     * because it would move the player (⚖ ruling 31(b)).
     */
    it('refuses a cadence that lands inside the TARGET\'s i-frame, and says whose rule it is', () => {
        expect(() => killSchedule(jelly, 0, { cadence: 30 }))
            .toThrow(/lands the next press inside "jellyfish"'s own 30-tick i-frame/);
        expect(() => killSchedule(jelly, 0, { cadence: 30 })).toThrow(/would NOT damage/);
        // ⛔ and a sub-`SLASH_TIMER_MAX` cadence must not be refused for BEING
        // a dash any more. It is still refused — one body, one i-frame — but
        // the old reason ("a dash that MOVES the player", "under the N-tick
        // floor") is gone, and the message now names the chain as something
        // the PLAYER may do rather than as an error.
        expect(() => killSchedule(jelly, 0, { cadence: 15 }))
            .not.toThrow(/under the \d+-tick floor|a dash that MOVES the player/);
        expect(() => killSchedule(jelly, 0, { cadence: 15 }))
            .toThrow(/the player may press far faster/);
    });

    it('…and the cadence is derived from the RECEIVER alone now, not a max() over two rules', () => {
        expect(KILL_PRESS_CADENCE).toBe(31);
        expect(KILL_PRESS_CADENCE).toBe(ENEMY_IFRAMES + 1);
        // The presser's old half is retired: the swing period is 20, and 21
        // was one tick of head-room over it rather than a rule about damage.
        expect(KILL_CADENCE_FLOOR).toBe(ORDINARY_SWING_PERIOD + 1);
        expect(KILL_PRESS_CADENCE).not.toBe(KILL_CADENCE_FLOOR);
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

    /**
     * ⛔⛔⛔ R9 SLICE 12e′ — **THE DASH IMPULSE IS READ FROM A ONE-TICK-STALE
     * VELOCITY, AND THIS ROW PINS THE WRONG ANSWER ON PURPOSE.**
     *
     * `levelRun.js` calls this setter with `vx: state.vx, vy: state.vy` — the
     * velocity the player had ENTERING the tick. The GAME reaches
     * `useItem(Main.primary)` from inside `input()`, whose movement keys have
     * ALREADY written `v` this tick (`mobileUpdate` = friction -> input ->
     * moveX/moveY, `useItem` input's last act). The two agree whenever the
     * player was already moving, which is every dash on the committed roster —
     * and they part exactly when a dash press lands AT REST with a direction
     * key starting the same tick, because `knockbackImpulse`'s faithful
     * `point_normalize` no-op at zero length then pays NOTHING.
     *
     * ⛓ MEASURED, 2026-08-25, against the real game on `r9-solve-3`'s 151-tick
     * re-solve (R9 kickoff §33): over 22 presses in three driven tapes the
     * model and the game agree to 0.01 px on every one EXCEPT the two dashes
     * taken from rest with the direction key starting that tick.
     *
     * ⛔ THE EXPECTATION BELOW IS TODAY'S ANSWER AND IT IS THE DEFECT. It is
     * pinned rather than left red so that the tree stays green and the fix
     * flips it BY NAME: the slice that hands `set slashing` the post-key
     * velocity re-states this row, and this row is that slice's mutant.
     */
    it('⛔ a dash taken AT REST pays NOTHING — the model reads the PRE-KEY velocity', () => {
        // The 111-112 press opens the swing; two ticks later the 113 press is
        // the DASH arm, and `right` starts on that same tick from a standstill.
        const open = ticks(press(INITIAL_SLASH_STATE).state, 2);
        const dash = press(open, { direction: 0, vx: 0, vy: 0 });
        expect(dash.outcome).toBe('dash');
        expect(dash.state.anim).toBe(SLASH_ANIM_DASH);
        // ⛔ WRONG, and pinned as such: at rest the impulse is the zero vector.
        expect(dash.impulse).toEqual({ dvx: 0, dvy: 0 });
        // ⛓ What the POST-key velocity gives, which is what the game paid: the
        // direction key has already written v = (+moveSpeed, 0) by the time
        // `useItem` runs, so the unit vector is (1, 0) and the guard passes.
        expect(knockbackImpulse(1, 0, SLASH_DASH_FORCE))
            .toEqual({ dvx: SLASH_DASH_FORCE, dvy: 0 });
    });

    /**
     * ⛓⛓ THE SAME DEFECT AS DISPLACEMENT, IN THE GAME'S OWN DIGITS.
     *
     * Literals with provenance: both pairs are the first tick after the dash
     * press, model from `tapeRunner.runTape` and game from the Windows-Chrome
     * replay of the same game-visible bytes, `r9-solve-3` @151 t, 2026-08-25.
     * ⛔ The x-axis pair is the clean one — the deficit is `SLASH_DASH_FORCE`
     * EXACTLY. The y-axis pair has room geometry in it and is carried as a
     * SECOND witness rather than a second mechanism, which is why only the
     * first is asserted against the constant.
     */
    it('⛓ the displacement the game paid and the model did not — the measured pair', () => {
        const AT_REST_DASHES = Object.freeze([
            // t=113, `right` starting, L3 (39.65, 40.45)
            Object.freeze({ tick: 113, key: 'right', model: 0.80, game: 2.80 }),
            // t=137, `up` starting, same room, geometry in the y sweep
            Object.freeze({ tick: 137, key: 'up', model: 0.80, game: 2.45 }),
        ]);
        for (const row of AT_REST_DASHES) expect(row.game).toBeGreaterThan(row.model);
        const [x] = AT_REST_DASHES;
        expect(x.game - x.model).toBeCloseTo(SLASH_DASH_FORCE, 10);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 12e′ — **THE ROW THAT DISCRIMINATES, AND WHY THE UNIT ROW
     * ABOVE DOES NOT.**
     *
     * The `slashSet` row above pins the SETTER's answer, and a fix that moves
     * the impulse computation downstream to the spend site leaves that answer
     * `{0, 0}` and the row GREEN. Measured: the 12e″ prototype reddens it only
     * through the marker field the prototype happens to carry, which is a
     * fixture discriminating two builds by their scaffolding rather than by
     * the number that matters. So the mechanism is pinned HERE, through a real
     * `levelRun` tick, where the only thing under test is displacement.
     *
     * ⛔ THE DEFECT, STATED AS AN EQUALITY: a dash pressed AT REST with the
     * direction key starting that same tick moves the player EXACTLY as far as
     * pressing nothing at all. `knockbackImpulse(0, 0, 2)` is
     * `point_normalize`'s faithful no-op, and the run hands `set slashing` the
     * velocity from BEFORE this tick's `applyInput`, so the dash buys nothing.
     *
     * ⛓ AND THE POSITIVE CONTROL IS WHAT KEEPS THAT FROM BEING A TRUE SENTENCE
     * ABOUT THE WRONG SUBJECT (trap 566's shape): "the dash bought nothing"
     * and "no dash was taken" predict the same equality. The MOVING pair shows
     * the arm firing and paying `SLASH_DASH_FORCE` **exactly**, on the same
     * boot, the same room and the same key — so the at-rest zero is a dash
     * that paid nothing rather than a dash that never happened.
     *
     * ⛓ THE GAME'S OWN ANSWER, measured 2026-08-25 on `r9-solve-3` @151 t
     * (R9 kickoff §33): on the dash tick the game moved **2.80 px** where this
     * model moves **0.80** — the deficit is `SLASH_DASH_FORCE` to the digit.
     * ⛔ The row is GREEN on purpose: it states today's WRONG answer so the
     * tree stays green, and any fix that makes the dash pay flips the equality
     * BY NAME. This row is that fix's mutant.
     */
    describe('R9 12e′: the dash impulse, through a real tick', () => {
        const source = atlasLevelSource();
        /**
         * ⛔ The boot block is in PLACEMENT coordinates and the entity centre
         * is placement + 8 on both axes (12d″'s trap), so the pixel this row
         * means is named once and the offset is undone here. It is
         * `r9-solve-3`'s own t=113 pixel in L3, at rest, with the sword.
         */
        const REST = Object.freeze({ x: 39.65, y: 40.45 });
        const at = () => createLevelRun({
            levelSource: source, boot: { level: 3, x: REST.x - 8, y: REST.y - 8 },
            noclip: false, noHazards: [], noDamage: false, grants: [], persistence: [],
            despawn: [], equips: [], pins: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        /** The per-tick x displacement of a key sequence, from that boot. */
        const walk = (seq) => {
            const run = at();
            const xs = [run.state.x];
            for (const keys of seq) { run.advance(new Set(keys)); xs.push(run.state.x); }
            return xs.slice(1).map((v, i) => Number((v - xs[i]).toFixed(3)));
        };

        it('⛔ AT REST the dash buys NOTHING — it walks exactly like no press at all', () => {
            // press (opens the swing) · release · press + `right` STARTING
            // this tick, from a standstill · `right`.
            const dashed = walk([['primary'], [], ['primary', 'right'], ['right']]);
            const control = walk([[], [], ['right'], ['right']]);
            expect(dashed).toEqual(control);
            // ⛓ And these are the model's own digits, which are `r9-solve-3`'s
            // t=114 and t=115 to the hundredth. The GAME moved 2.80 on the
            // first of them.
            expect(dashed).toEqual([0, 0, 0.8, 1.35]);
        });

        it('⛓ MOVING, the same arm fires and pays SLASH_DASH_FORCE exactly', () => {
            const dashed = walk([['right'], ['right', 'primary'], ['right'],
                ['right', 'primary'], ['right']]);
            const control = walk([['right'], ['right'], ['right'], ['right'], ['right']]);
            // The first three ticks are the plain walk in both.
            expect(dashed.slice(0, 3)).toEqual(control.slice(0, 3));
            // The fourth is the dash, and the difference is the constant.
            expect(dashed[3] - control[3]).toBeCloseTo(SLASH_DASH_FORCE, 10);
            expect(dashed[3]).toBeCloseTo(2.85, 10);
            expect(control[3]).toBeCloseTo(0.85, 10);
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

describe('R9 slice 12b: the ANIMATION clock, and the maximum swing rate (⚖ ruling 36)', () => {
    /**
     * `slashEnd` is `sprSlash`'s COMPLETE CALLBACK (`Player.as:41`), not a key
     * release — so the dash's re-arm runs on FlashPunk's frame accumulator.
     */
    it('wraps a looping animation when its accumulator has stepped every frame', () => {
        // `slash` — [0,1,2,3,4] at swordSpeed 30, i.e. exactly one frame a tick.
        expect(animCompleteTicks(5, SWORD_ANIM_RATE)).toBe(5);
        // `slashnarrow` — [1,2,3] at swordSpeedDash 20, i.e. 0.667 a tick.
        expect(animCompleteTicks(3, SWORD_ANIM_RATE_DASH)).toBe(5);
    });

    /**
     * ⚠ THE EQUALITY ABOVE IS A COINCIDENCE OF THE ARITHMETIC, and this row is
     * what stops it being written down as a shared constant: the GHOST sword's
     * two lists (7 at 30, 4 at 20) also agree with each other and NOT with the
     * plain sword's. Same shape, different number.
     */
    it('does NOT give the same answer for the ghost sword', () => {
        expect(animCompleteTicks(7, SWORD_ANIM_RATE)).toBe(7);
        expect(animCompleteTicks(4, SWORD_ANIM_RATE_DASH)).toBe(7);
    });

    it('refuses a rate that never wraps rather than looping forever', () => {
        expect(() => animCompleteTicks(3, 0)).toThrow(/does not wrap/);
    });

    it('exposes the plain sword\'s two periods by name', () => {
        expect(SLASH_ANIM_TICKS.slash).toBe(5);
        expect(SLASH_ANIM_TICKS.slashnarrow).toBe(5);
    });

    /**
     * ⛓⛓⛓ THE MAXIMUM SWING RATE, ⚖ ruling 36 — three numbers, none of them
     * the 21 or the 31 the ladder called "the cadence".
     */
    it('ORDINARY swings are one per 20 ticks, and the ±1 falls on the LOW side', () => {
        expect(ORDINARY_SWING_PERIOD).toBe(SLASH_TIMER_MAX);
        expect(ORDINARY_SWING_PERIOD).toBe(20);
        // At k = 19 the timer reads 1 and the press DASHES; at k = 20 it reads
        // 0 and the press is a swing. So 20 is the period — 21 was head-room.
        const press = (st) => slashSet(st, { pressed: true, hasSword: true, direction: 0 });
        const ticks = (st, n) => {
            let s = st;
            for (let i = 0; i < n; i += 1) s = slashTimerTick(s);
            return s;
        };
        const ended = slashSet(press(INITIAL_SLASH_STATE).state,
            { pressed: false, hasSword: true }).state;
        expect(press(ticks(ended, 19)).outcome).toBe('dash');
        expect(press(ticks(ended, 20)).outcome).toBe('slash');
    });

    /**
     * ⛔⛔ DASHES ARE ONE PER ANIMATION, NOT ONE PER WINDOW — and the offsets
     * are what two wrong derivations disagreed about.
     *
     * Dividing 20 by the animation's 5 gives four dashes at k = 1/6/11/16.
     * Modelling `slashEnd` firing BELOW the press (it is called from
     * `sprites()`, under `super.update()`) moves them to 1/7/13/19 — still
     * four. Modelling `Input.pressed` as the RISING EDGE it is — a press costs
     * two ticks of the key, so k = 1 is not expressible by any controller —
     * gives THREE, at 2/8/14. The last is the only one a tape can drive.
     */
    it('admits exactly three dashes per window, at k = 2 / 8 / 14', () => {
        expect(DASH_CHAIN_MAX).toBe(3);
        expect([...DASH_CHAIN.at]).toEqual([2, 8, 14]);
        expect(DASH_CHAIN.max).toBe(DASH_CHAIN.at.length);
    });

    it('…and every press in between is SWALLOWED, which is what bounds the chain', () => {
        expect([...DASH_CHAIN.swallowed]).toEqual([4, 6, 10, 12, 16, 18]);
        // Every offset in the window is either a dash, a swallow, or a tick the
        // key had to be up on — nothing is unaccounted for.
        const used = new Set([...DASH_CHAIN.at, ...DASH_CHAIN.swallowed]);
        for (const k of used) expect(k % 2).toBe(0);
    });
});
