/**
 * combatVerbs — `swing` and `kill`, transcribed from `Player.as`.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 3. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.3.
 *
 * `combat.js` answers "what is standing here and what would killing it
 * cost". This module answers "what does a press actually HIT", which is a
 * different question with a different failure mode: a census that is wrong
 * declares a bill, a swing rect that is wrong makes a walk stand next to a
 * live enemy pressing X.
 *
 * ── THE FIVE THINGS THE SOURCE WILL MISLEAD YOU ABOUT ─────────────────
 *
 * 1. **A press does not hit on its own tick.** `Player.update` calls
 *    `slash()` at :560, and `super.update()` — which reaches
 *    `Mobile.input()` and therefore `Input.pressed(keys[4]) -> useItem ->
 *    slashing = true` — only at :575. So the press on tick T sets the flag
 *    AFTER that tick's hit test, and the first test that can hit is T+1.
 *
 * 2. **The hit test then runs EVERY tick, not once.** `slashDelayMax` is
 *    **0**, so `slashDelay` never guards anything and `slash()`'s `else if
 *    (slashing)` arm runs on every tick the flag is up. The flag is dropped
 *    by `slashEnd()`, the animation's own callback, after the 5-frame
 *    "slash" anim wraps. So a press is a WINDOW of hit tests, and what makes
 *    a second hit on the same enemy impossible inside it is the enemy's
 *    30-tick i-frame, not the press.
 *
 * 3. **The scale is ONE FRAME STALE, and it is not reset when the swing
 *    ends.** `slashingSprite.scaleX/scaleY` is written in `Player.render`
 *    (:1256-1266) — after `update` — and only `if (slashing)`. So tick T's
 *    rect uses the scale the previous frame's render computed, and when
 *    `slashEnd` drops the flag the last value is simply LEFT there. A model
 *    that recomputed the scale from the current tick's animation would size
 *    the first frame of every swing wrong, in the direction that matters
 *    (the dash rect is 24 wide and 20.8 tall against 16x32).
 *
 * 4. **The distance filter is not the rect.** After `collideRectInto`
 *    fills the candidate list, each candidate must ALSO satisfy
 *    `FP.distanceRectPoint(player.x, player.y, <its box>) <=
 *    slashingSprite.width * scaleX` — the player's CENTRE POINT to the
 *    target's BOX, against 16 (or 24 dashing). A rect-only model hits
 *    corners the game does not reach.
 *
 * 5. **The LOS test is on CENTRES and has four exemptions.**
 *    `!FP.world.collideLine("Solid", x, y, e.x, e.y) || hasGhostSword ||
 *    e.type == "Solid" || e.type == "Rope" || e is Flyer`. Reading it as
 *    "the sword does not cut through walls" and stopping there loses the
 *    ghost-sword arm — which is the whole point of the item — and would
 *    refuse every Flyer.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────
 * It does not decide WHERE to stand. Stances come from the world geometry
 * (`encounters.js`, the stance audits); this is the primitive they are
 * scored against.
 */

import { assertRect, rect, rectsOverlap } from './levelWorld.js';
import { ENEMY_CLASSES, ENEMY_IFRAMES, KILL_CADENCE_FLOOR, SLASH_TIMER_MAX } from './combat.js';
import { DEFAULT_FRICTION } from './playerPhysicsV1.js';
import { knockbackImpulse } from './playerPhysicsV2.js';
import { CHASERS, killWindowTicks } from './chasers.js';

export class CombatVerbError extends Error {
    constructor(message) { super(message); this.name = 'CombatVerbError'; }
}
const fail = (m) => { throw new CombatVerbError(m); };

/**
 * The three slash sprites, `Player.as:41-45`. `width`/`height` are the
 * Spritemap's FRAME size, which is what `getSlashRect` reads.
 */
export const SLASH_SPRITES = Object.freeze({
    sword: Object.freeze({ w: 16, h: 32, src: 'Player.as:41 Spritemap(imgSlash, 16, 32)' }),
    darksword: Object.freeze({ w: 16, h: 32, src: 'Player.as:43 Spritemap(imgSlashDark, 16, 32)' }),
    ghostsword: Object.freeze({ w: 24, h: 7, src: 'Player.as:45 Spritemap(imgGhostSword, 24, 7)' }),
});

/** `Player.render`'s two scales (`Player.as:1258-1265`). */
export const SLASH_SCALE_NORMAL = Object.freeze({ x: 1, y: 1 });
export const SLASH_SCALE_DASH = Object.freeze({ x: 1.5, y: 0.65 });

/**
 * `Player.slashTimerMax` — the double-press window that becomes a DASH.
 * ⛓ RE-EXPORTED from `combat.js`, which is its one home (⚖ ruling 17): this
 * module and `presses` both used to write the 20 out for themselves.
 */
export { SLASH_TIMER_MAX };

/** `Player.swordDamage` / `darkSwordDamage` / `ghostSwordDamage`. */
export const SWORD_DAMAGE = Object.freeze({ sword: 1, darksword: 2, ghostsword: 2 });

/** `Player.swordForce` — the knockback impulse a landed hit applies. */
export const SWORD_FORCE = 5;

/**
 * ⛓⛓⛓ R9 SLICE 12b, ⚖ ruling 31(b) — **THE GAP BETWEEN TWO PRESSES THAT BOTH
 * LAND ON ONE BODY, AND IT IS NOW THE RECEIVER'S NUMBER ALONE.**
 *
 * It used to be `max(KILL_CADENCE_FLOOR, ENEMY_IFRAMES + 1)` — 31 by way of a
 * MAX over two unrelated rules, one about the PRESSER (21: a second press
 * inside `slashTimer` is a dash that moves the player) and one about the
 * RECEIVER (31: `Enemy.hit` refuses while `hitsTimer > 0`). The presser's half
 * is RETIRED: a dash is transcribed, driven against the game and chosen on
 * purpose, so it is no longer a reason to refuse anything. The value is
 * unchanged and its DERIVATION is now one rule instead of two.
 *
 * ⚠ AND THE ±1 IS STILL A ±1, SAID PLAINLY. Whether the enemy's `hitUpdate`
 * runs before or after the player's `slash()` on the hit tick depends on
 * FlashPunk's update-list order, which is insertion order and not something a
 * transcription should assume. 31 is the conservative side. ⛓ `r9-l6-bob-press`
 * drove 31 against the real game and the three hits landed; nothing has ever
 * driven 30, so the head-room stays until something does.
 *
 * ⛔⛔ IT IS PER BODY, WHICH IS WHY IT IS NOT A SWING RATE. `hitsTimer` is a
 * field on the ENEMY. Two bodies in one rect each take a hit from the same
 * press, and a second body coming into reach may be struck the very next tick.
 * A schedule that treated this as "how often the player may press" would
 * refuse presses the game allows — see `ORDINARY_SWING_PERIOD` and
 * `DASH_CHAIN` for what actually bounds the player.
 */
export const KILL_PRESS_CADENCE = ENEMY_IFRAMES + 1;

// ─────────────────────────────────────────────────────────────────────
// ⛓⛓⛓ R9 SLICE 12b — `set slashing`, THE WHOLE SETTER
// ─────────────────────────────────────────────────────────────────────

/**
 * `Player.slashTimerMax`'s companion force — `set slashing`'s dash branch
 * calls `knockback(2, …)` (`Player.as:788`).
 */
export const SLASH_DASH_FORCE = 2;

/** The two animations `set slashing` can play (`Player.as:786`, `:794`). */
export const SLASH_ANIM_NORMAL = 'slash';
export const SLASH_ANIM_DASH = 'slashnarrow';

/**
 * ⛓⛓⛓ R9 SLICE 12b — **`slashEnd` IS AN ANIMATION CALLBACK, NOT A KEY
 * RELEASE**, and the whole maximum-swing-rate question is downstream of that.
 *
 * `sprSlash = new Spritemap(imgSlash, 16, 32, slashEnd)` (`Player.as:41`) —
 * the third argument is FlashPunk's `complete` callback, fired when a LOOPING
 * animation wraps. `slashEnd()` (`:1046`) is `slashing = false`, which takes
 * `set slashing`'s release arm and clears `slashDashed`. So the dash re-arms
 * itself at the END OF ITS OWN ANIMATION, on a clock that has nothing to do
 * with `slashTimer`.
 *
 * The two animations (`Player.as:392-393`):
 *   `slash`        frames [0,1,2,3,4]  at `swordSpeed`     30
 *   `slashnarrow`  frames [1,2,3]      at `swordSpeedDash` 20
 *
 * ⚠⚠ THE TWO RATES ARE DIFFERENT AND THE TWO PERIODS ARE THE SAME, WHICH IS
 * A COINCIDENCE OF THE ARITHMETIC AND MUST NOT BE WRITTEN AS A CONSTANT.
 * FlashPunk accumulates `frameRate / assignedFrameRate` per update and steps
 * a frame each time the accumulator passes 1: five frames at 30/30 wrap on
 * the 5th tick, and three frames at 20/30 ALSO wrap on the 5th — the 0.667
 * accumulator lands its three steps on ticks 2, 4 and 5. Change either the
 * frame list or the rate and they part company, so this is DERIVED.
 *
 * ⛓ AND THE GHOST SWORD IS NOT 5. Its lists are 7 frames at 30 and 4 at 20,
 * both of which wrap on the 7th tick. `levelRun` REFUSES a ghostsword press
 * for an unrelated reason (`genericHit`'s Spear arm), so nothing consumes
 * that number yet — it is derived here rather than assumed to be the sword's.
 */
export function animCompleteTicks(frameCount, frameRate, assignedFrameRate = 30) {
    let timer = 0;
    let index = 0;
    // The same bound `Spritemap.updateAnimation` has no need of, as a refusal
    // rather than an infinite loop: a rate of 0 never completes.
    for (let tick = 1; tick <= 1000; tick += 1) {
        timer += frameRate / assignedFrameRate;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === frameCount) return tick;
        }
    }
    return fail(`animCompleteTicks: ${frameCount} frame(s) at ${frameRate}/`
        + `${assignedFrameRate} does not wrap inside 1000 ticks`);
}

/** `Player.as:131-132` — `swordSpeed` and `swordSpeedDash`. */
export const SWORD_ANIM_RATE = 30;
export const SWORD_ANIM_RATE_DASH = 20;

/**
 * How many ticks after `play(anim, true)` the `slashEnd` callback fires, per
 * animation — DERIVED from `Player.as:392-393`'s own frame lists and rates.
 */
export const SLASH_ANIM_TICKS = Object.freeze({
    [SLASH_ANIM_NORMAL]: animCompleteTicks(5, SWORD_ANIM_RATE),
    [SLASH_ANIM_DASH]: animCompleteTicks(3, SWORD_ANIM_RATE_DASH),
});


/**
 * `Player`'s four slash fields at construction (`Player.as:119-121`, and
 * `_slashing` false).
 */
export const INITIAL_SLASH_STATE = Object.freeze({
    slashing: false,
    slashTimer: 0,
    slashDashed: false,
    anim: null,
});

/**
 * ⛓⛓⛓ **`set slashing(_s)` — `Player.as:779-804`, TRANSCRIBED WHOLE**, and
 * the reason it is one function rather than a branch bolted onto the press
 * is that the setter has FOUR outcomes and the ladder had modelled one.
 *
 * ```as3
 *   public function set slashing(_s:Boolean):void {
 *       if ((hasSword || hasGhostSword) && !wanding && !firing
 *            && !deathRaying && !spearing) {
 *           if (slashTimer > 0 && _s && !slashDashed) {          // (1) DASH
 *               slashDashed = true;
 *               slashingSprite.play("slashnarrow", true);
 *               knockback(2, new Point(x - v.x, y - v.y));
 *               slashDirection = direction;
 *               Music.playSound("Sword");
 *           } else if (!slashing && _s) {                        // (2) SLASH
 *               slashingSprite.play("slash", true);
 *               slashDirection = direction;
 *               slashTimer = slashTimerMax;
 *               Music.playSound("Sword");
 *           }
 *           if (!_s) { slashDashed = false; }                    // (3) RELEASE
 *           _slashing = _s;
 *       }
 *   }                                                            // (4) GATED
 * ```
 *
 * ── THE FIVE THINGS A PARAPHRASE GETS WRONG ──────────────────────────
 *
 * 1. **THE DASH BRANCH DOES NOT ASK WHETHER YOU ARE ALREADY SLASHING.**
 *    Its condition is `slashTimer > 0 && _s && !slashDashed` — no
 *    `!slashing` term, unlike the branch below it. So a press landing INSIDE
 *    an open swing dashes, and it re-plays the animation from frame 0 with
 *    `play(…, true)`, which restarts `slashEnd`'s clock.
 *
 * 2. **THE DASH DOES NOT REFRESH `slashTimer`.** Only the `else if` writes
 *    `slashTimerMax`. So the 20-tick window is measured from the FIRST press
 *    of a chain and never extended, and a chain of presses inside one window
 *    can dash more than once but cannot buy itself more time.
 *
 * 3. **`slashDashed` IS CLEARED ON RELEASE, NOT ON A TIMER.** `slashEnd()`
 *    — the animation's own callback — calls `slashing = false`, which takes
 *    arm (3). So after a swing ends, the next press inside the SAME
 *    `slashTimer` window dashes AGAIN. Two dashes from one 20-tick window is
 *    a legal sequence, not a modelling slip.
 *
 * 4. **A PRESS CAN BE SWALLOWED ENTIRELY.** With `slashDashed` up and
 *    `_slashing` still up, arm (1) is refused by `!slashDashed` and arm (2)
 *    by `!slashing` — and there is no else. The press plays no sound, moves
 *    nothing, opens no window and does not touch the timer. It is the only
 *    press in this model that costs a tick of input and buys nothing, and
 *    `r5-bobboss-arm`'s 71 sub-window pairs are where it lives.
 *
 * 5. **THE OUTER GATE ALSO GUARDS THE RELEASE.** `if (!_s) slashDashed =
 *    false` and `_slashing = _s` are INSIDE it. So a `slashEnd()` that
 *    arrives while the player is (say) spearing leaves `_slashing` up and
 *    `slashDashed` set. Reading the gate as "you cannot START a swing while
 *    spearing" loses that, and loses it in the direction that silently
 *    permits a later dash.
 *
 * @param {object} st  the four fields — see `INITIAL_SLASH_STATE`.
 * @param {object} opts
 *   `pressed`     `_s`; false is `slashEnd()`'s release.
 *   `hasSword` / `hasGhostSword` / `wanding` / `firing` / `deathRaying` /
 *   `spearing`    the outer gate's six terms, each named.
 *   `direction`   `Player.direction` — what `slashDirection` latches.
 *   `vx` / `vy`   the player's velocity, for the dash's `knockback` centre.
 * @returns {{state: object, outcome: string, slashDirection: ?number,
 *   impulse: ?{dvx: number, dvy: number}, why: string}}
 *   `outcome` is one of `dash` · `slash` · `swallowed` · `release` · `gated`.
 */
export function slashSet(st, {
    pressed,
    hasSword = false, hasGhostSword = false,
    wanding = false, firing = false, deathRaying = false, spearing = false,
    direction = null, vx = 0, vy = 0,
} = {}) {
    const gateOpen = (hasSword || hasGhostSword)
        && !wanding && !firing && !deathRaying && !spearing;
    if (!gateOpen) {
        return {
            state: st,
            outcome: 'gated',
            slashDirection: null,
            impulse: null,
            why: '`set slashing`\'s outer gate is closed — (hasSword || hasGhostSword) '
                + `is ${hasSword || hasGhostSword}, wanding ${wanding}, firing ${firing}, `
                + `deathRaying ${deathRaying}, spearing ${spearing}. The setter's whole `
                + 'body, INCLUDING the release and `_slashing = _s`, is inside it.',
        };
    }
    let { slashing, slashTimer, slashDashed, anim } = st;
    let outcome = null;
    let slashDirection = null;
    let impulse = null;
    let why = '';
    if (slashTimer > 0 && pressed && !slashDashed) {
        // (1) THE DASH. ⚠ No `!slashing` term — see note 1.
        slashDashed = true;
        anim = SLASH_ANIM_DASH;
        impulse = knockbackImpulse(vx, vy, SLASH_DASH_FORCE);
        slashDirection = direction;
        outcome = 'dash';
        why = `a second press with slashTimer ${slashTimer} still up and slashDashed `
            + 'false: `play("slashnarrow", true)` restarts the swing with the DASH rect '
            + `and \`knockback(${SLASH_DASH_FORCE}, Point(x - v.x, y - v.y))\` shoves the `
            + 'player along their own velocity. `slashTimer` is NOT refreshed.';
    } else if (!slashing && pressed) {
        // (2) THE ORDINARY SWING.
        anim = SLASH_ANIM_NORMAL;
        slashDirection = direction;
        slashTimer = SLASH_TIMER_MAX;
        outcome = 'slash';
        why = 'a press with no swing open: `play("slash", true)`, `slashDirection` '
            + `latched at ${direction}, and \`slashTimer\` set to ${SLASH_TIMER_MAX}.`;
    } else if (pressed) {
        // (4) SWALLOWED — both arms refused and there is no else. See note 4.
        outcome = 'swallowed';
        why = `a press with slashDashed ${slashDashed} and slashing ${slashing}: the dash `
            + 'arm is refused by `!slashDashed` and the swing arm by `!slashing`, and '
            + '`set slashing` has no else. Nothing is played, nothing is knocked back '
            + 'and `slashTimer` is untouched.';
    }
    if (!pressed) {
        // (3) THE RELEASE — `slashEnd()`. Inside the outer gate; see note 5.
        slashDashed = false;
        anim = null;
        outcome = 'release';
        why = '`slashEnd()` — the animation\'s own callback — sets `slashing = false`, '
            + 'which clears `slashDashed` and re-arms the dash for the next press inside '
            + 'the SAME `slashTimer` window.';
    }
    slashing = pressed;
    return {
        state: { slashing, slashTimer, slashDashed, anim },
        outcome,
        slashDirection,
        impulse,
        why,
    };
}

/**
 * `Player.slash()`'s FIRST TWO LINES — `if (slashTimer > 0) slashTimer--`
 * (`Player.as:892-897`), which run at the TOP of `Player.update`, above
 * `super.update()` and therefore above the press.
 *
 * ⛓ THE ORDER IS WHY THE WINDOW IS `gap <= 19` AND NOT `gap < 20`. A press
 * at tick T writes 20 at the END of T (inside `input()`); tick T+k has
 * already decremented k times when its own press is read, so the second
 * press sees `20 - k` and needs it `> 0`. A model that decremented after the
 * press would admit a dash at gap 20 that the game refuses.
 */
export function slashTimerTick(st) {
    if (st.slashTimer <= 0) return st;
    return { ...st, slashTimer: st.slashTimer - 1 };
}

/**
 * ⛓⛓⛓ R9 SLICE 12c — **WHAT A PRESS `ticksAhead` TICKS FROM NOW WILL DO,
 * COMPUTED WITH THE RUN'S OWN PRIMITIVES RATHER THAN GUESSED FROM A GAP.**
 *
 * ⚖ Ruling 35 asks the oracle and the planner to model the dash COMPLETELY.
 * The strike policy has to commit an AIM one tick before the press it earns,
 * and the two presses swing DIFFERENT RECTS — 16 x 32 at reach 16 for an
 * ordinary swing, 24 x 20.8 at reach 24 for a dash, and neither contains the
 * other. So "would this press dash" cannot be a gap arithmetic: 12b′'s
 * `(tick + 1) - lastPressAt < ORDINARY_SWING_PERIOD` is a SOUND REFUSAL and
 * not an answer — it says "it might dash", which is all a refusal needs.
 *
 * ⛔⛔ THE AGEING IS THE RUN'S OWN ORDER, NOT A PARAPHRASE OF IT. Per tick
 * `levelRun.advance` does `slashTimerTick` at the TOP (`:13020`, which is
 * `Player.slash()`'s first two lines, above `super.update()`), then the press
 * (`:13129`, inside `input()`), then `slashEnd()` (`:13362`, from `sprites()`,
 * BELOW `super.update()`). A forecast that released before the press would
 * re-arm the dash a tick early and a forecast that decremented after it would
 * admit a dash at gap 20 the game refuses — the two errors this ordering has
 * already cost the ladder once each.
 *
 * ⚠ THE INPUT IS THE STATE THE **PREVIOUS** TICK LEFT — `levelRun.slashInfo`
 * read before `advance`, or a preview's own threaded copy. `ticksAhead` is how
 * many WHOLE ticks run before the press's own: 0 = the press is on tick
 * `tick`, 1 = on tick `tick + 1`, which is the aim/press shape.
 *
 * @param {object} slash `{state, endsAt, gate}` — `levelRun.slashInfo`'s shape.
 * @param {object} opts `tick` (the tick `state` is entering), `ticksAhead`,
 *   and the press's own `direction`/`vx`/`vy`, which decide `slashDirection`
 *   and the impulse but never the OUTCOME.
 * @returns {object} `slashSet`'s own return, plus `scale` (the rect that press
 *   swings, via `slashScaleFor`) and `at` (the tick it lands on).
 */
export function slashPressForecast(slash, {
    tick, ticksAhead = 1, direction = null, vx = 0, vy = 0,
} = {}) {
    if (!slash || !slash.state || !slash.gate) {
        fail('slashPressForecast: needs `levelRun.slashInfo`\'s shape — {state, endsAt, '
            + 'gate}. A forecast built from a gap alone cannot tell a dash from a swing, '
            + 'and the two swing different rects.');
    }
    const { gate } = slash;
    let st = slash.state;
    let endsAt = slash.endsAt;
    for (let k = 0; k < ticksAhead; k += 1) {
        const t = tick + k;
        st = slashTimerTick(st);
        // ⛓ `slashEnd` fires BELOW the press, so on a tick with no press of
        // ours it is the tick's last act — and it is what RE-ARMS the dash.
        if (endsAt !== null && t >= endsAt) {
            st = slashSet(st, { pressed: false, ...gate }).state;
            endsAt = null;
        }
    }
    const at = tick + ticksAhead;
    st = slashTimerTick(st);
    const r = slashSet(st, { pressed: true, ...gate, direction, vx, vy });
    return { ...r, at, scale: slashScaleFor(r.state.anim) };
}

/**
 * ⛓⛓⛓ R9 SLICE 12c — **HOW LONG A DASH IS LIVE, AND HOW FAR IT CARRIES**,
 * derived from the two constants that decide it rather than quoted from the
 * measurement that confirmed it.
 *
 * `set slashing`'s dash arm adds `SLASH_DASH_FORCE` along the player's own
 * travel. The player is then ABOVE `moveSpeed`, so `Player.input`'s
 * `if (v.x < moveSpeed)` adds nothing and `Mobile.friction` alone runs the
 * surplus down by `DEFAULT_FRICTION` a tick until the floor catches it.
 *
 * ⇒ `ticks` = 2 / 0.25 = **8**, and the extra ground covered is the sum of
 * what survives on each of them — 2 + 1.75 + … + 0.25 = **9 px**. §23.11
 * measured exactly 9 on `r9-l0-sword-dash`'s GAME-recorded stream; this is
 * that number arrived at from the constants, and `plan-seedling-r9-l0-sword-
 * dash` already asserts the −0.25/tick decay it is made of.
 *
 * ⛔ `perTick` IS CUMULATIVE, not per-tick deltas: it is the OFFSET from where
 * an undashed walk would be after k ticks, which is the question a dash
 * certification asks.
 */
export const DASH_DISPLACEMENT = (() => {
    const ticks = Math.round(SLASH_DASH_FORCE / DEFAULT_FRICTION);
    const perTick = [];
    let carried = 0;
    for (let k = 1; k <= ticks; k += 1) {
        carried += SLASH_DASH_FORCE - (k - 1) * DEFAULT_FRICTION;
        perTick.push(Number(carried.toFixed(10)));
    }
    return Object.freeze({
        ticks,
        perTick: Object.freeze(perTick),
        total: perTick[perTick.length - 1],
    });
})();

/**
 * ⛓⛓⛓ **THE GAME'S MAXIMUM SWORD SWING RATE** (⚖ ruling 36), which is THREE
 * numbers and not one — and none of them is the 21 or the 31 the ladder has
 * been calling "the cadence" since R5.
 *
 * 1. **ORDINARY SWINGS: one per 20 ticks.** The `else if (!slashing && _s)`
 *    arm needs `slashTimer` at 0, because a press with the timer up takes the
 *    dash arm instead (or is swallowed). `slashTimer` is set to 20 at the
 *    swing and decremented once per `slash()`, which runs ABOVE the press —
 *    so the press `k` ticks later reads `20 - k`, and the first press that is
 *    an ordinary swing again is at **k = 20**, not 21. ⚠ THE ±1 FALLS ON THE
 *    LOW SIDE: at k = 19 the timer reads 1 and the press DASHES. So 20 is the
 *    period, and `KILL_CADENCE_FLOOR`'s 21 was one tick of head-room over it.
 *
 * 2. **DASHES: one per ANIMATION, not one per window.** `slashDashed` is
 *    cleared by `slashEnd`, so a chain is press → dash → (5 ticks) → dash →
 *    (5 ticks) → … for as long as `slashTimer` is still up. The first dash
 *    can land at k = 1, and each subsequent one 5 ticks later, so the window
 *    admits `DASH_CHAIN_MAX` of them — each a +2 impulse along travel. This
 *    is the mechanism behind ⚖ ruling 35's "dashing towards the exit".
 *
 * 3. **DAMAGE TO ONE BODY: one per 30 ticks, and it is the RECEIVER's.**
 *    `Enemy.hit` refuses while `hitsTimer > 0` and a landed hit sets 30. The
 *    swing rate does not bound damage; the i-frame does, PER BODY — so two
 *    bodies in one rect take a hit each from the same press, and one body
 *    takes at most one hit per 30 ticks however fast the player swings.
 *
 * ⇒ A PRESS IS REFUSED BY WHAT IT WOULD DO, NOT BY A FLOOR (⚖ ruling 31(b)).
 */
export const DASH_CHAIN = (() => {
    /**
     * ⛔⛔ DERIVED BY RUNNING THE TRANSCRIPTION UNDER THE RULES A CONTROLLER
     * ACTUALLY HAS, NOT BY DIVIDING. Two corrections, each worth one dash:
     *
     * 1. **`slashEnd` FIRES BELOW THE PRESS.** It is called from `sprites()`,
     *    which is under `super.update()` in `Player.update` — so a press ON
     *    the animation's last tick still sees `slashDashed` up and is
     *    SWALLOWED. The re-arm period is the animation PLUS ONE.
     * 2. **`Input.pressed` IS A RISING EDGE.** A press costs two ticks of the
     *    key — one down, one up — so two presses cannot be on consecutive
     *    ticks at all. The theoretical first dash at k = 1 is not expressible
     *    by any controller; the earliest is k = 2.
     *
     * A first cut that modelled neither gave 4 dashes at k = 1/6/11/16, and a
     * cut that modelled only the first gave 4 at 1/7/13/19. Both are ticks no
     * input stream can produce.
     *
     * The loop is `levelRun`'s own tick order — decrement, press, release —
     * pressing on every tick the key is FREE, which is the fastest a
     * controller can ask.
     */
    let st = INITIAL_SLASH_STATE;
    let endsAt = null;
    let keyHeld = false;
    const at = [];
    const swallowed = [];
    const opening = slashSet(st, { pressed: true, hasSword: true, direction: 0, vx: 1, vy: 0 });
    st = opening.state;
    endsAt = SLASH_ANIM_TICKS[opening.state.anim];
    keyHeld = true;
    for (let k = 1; k <= SLASH_TIMER_MAX; k += 1) {
        st = slashTimerTick(st);
        // The controller lets the key up for one tick, then presses again.
        const press = !keyHeld;
        keyHeld = press;
        if (press) {
            const r = slashSet(st, { pressed: true, hasSword: true, direction: 0, vx: 1, vy: 0 });
            st = r.state;
            if (r.outcome === 'dash') { at.push(k); endsAt = k + SLASH_ANIM_TICKS[st.anim]; }
            if (r.outcome === 'swallowed') swallowed.push(k);
        }
        if (endsAt !== null && k >= endsAt) {
            endsAt = null;
            st = slashSet(st, { pressed: false, hasSword: true }).state;
        }
    }
    return Object.freeze({ max: at.length, at: Object.freeze(at), swallowed: Object.freeze(swallowed) });
})();

/** The most dashes one `slashTimer` window admits — see `DASH_CHAIN`. */
export const DASH_CHAIN_MAX = DASH_CHAIN.max;

/** The ordinary swing's own period — see note 1. `KILL_CADENCE_FLOOR` was 21. */
export const ORDINARY_SWING_PERIOD = SLASH_TIMER_MAX;

/**
 * `Player.getSlashRect()` (`Player.as:929-950`), transcribed exactly.
 *
 * `direction` is FlashPunk's: 0 right, 1 up, 2 left, 3 down — and it is
 * `slashDirection`, LATCHED at the press (`slashing`'s setter writes
 * `slashDirection = direction`), not the facing at the moment of the test.
 * A walk that turns mid-swing still cuts where it started.
 *
 * ⚠ `h` is `hasGhostSword ? width*2 : height`. For the ghost sword that is
 * 48 from a 24-wide sprite — a TALLER rect than the plain sword's 32 out of
 * a sprite that is 7 pixels high. Reading `height` for both is the way to
 * transcribe this and be quietly wrong about the one item whose reach is
 * its reason to exist.
 */
export function slashRect(x, y, direction, {
    sword = 'sword', scale = SLASH_SCALE_NORMAL,
} = {}) {
    const spr = SLASH_SPRITES[sword];
    if (!spr) fail(`slashRect: unknown sword "${sword}"; know ${Object.keys(SLASH_SPRITES)}`);
    if (![0, 1, 2, 3].includes(direction)) {
        // `getSlashRect`'s `default:` arm returns a rect that is all zeros,
        // which as a rect is `(0,0,0,0)` at the world origin — an overlap
        // test against it is not "no hit", it is a hit test in the corner of
        // level 0. A model may not have that arm.
        fail(`slashRect: direction ${direction} is not 0..3. The AS3 default arm returns `
            + 'an all-zero Rectangle, which is a rect at the world origin rather than '
            + 'an absent one.');
    }
    const w = spr.w * scale.x;          // slashingSprite.width * scaleX
    const h = (sword === 'ghostsword' ? spr.w * 2 : spr.h) * scale.y;
    let r;
    switch (direction) {
        case 0: r = rect(x, y - h / 2, w, h); break;
        case 1: r = rect(x - h / 2, y - w, h, w); break;
        case 2: r = rect(x - w, y - h / 2, w, h); break;
        default: r = rect(x - h / 2, y, h, w); break;
    }
    return assertRect(r, `slashRect(${x},${y},dir ${direction})`);
}

/**
 * The scale tick `t`'s rect is computed with — see header note 3.
 *
 * @param {?string} prevAnim  the animation that was playing at the END of
 *   tick t-1 (`"slash"`, `"slashnarrow"`, or null for "not slashing"), and
 *   `lastScale` for the not-slashing case, because `render` LEAVES the
 *   previous value rather than resetting it.
 */
export function slashScaleFor(prevAnim, {
    lastScale = SLASH_SCALE_NORMAL, hasGhostSword = false,
} = {}) {
    if (prevAnim === null || prevAnim === undefined) return lastScale;
    // ⚠ The narrow arm is `currentAnim == "slashnarrow" && !hasGhostSword`.
    // The ghost sword dashes too — it just does not get the squash, because
    // its render arm rotates the sprite instead.
    if (prevAnim === 'slashnarrow' && !hasGhostSword) return SLASH_SCALE_DASH;
    return SLASH_SCALE_NORMAL;
}

/**
 * `FP.distanceRectPoint` (`FP.as`), transcribed — point to AABB, 0 inside.
 *
 * Written out rather than approximated by a centre-to-centre distance:
 * `slash()` calls it with the player's POINT and the target's BOX, and the
 * two differ by up to the box's half-diagonal, which for a 16x16 turret is
 * 11 px against a 16 px reach.
 */
export function distanceRectPoint(px, py, r) {
    assertRect(r, 'distanceRectPoint target');
    const insideX = px >= r.x && px <= r.right;
    const insideY = py >= r.y && py <= r.bottom;
    if (insideX) {
        if (insideY) return 0;
        return py > r.y ? py - r.bottom : r.y - py;
    }
    if (insideY) return px > r.x ? px - r.right : r.x - px;
    const cx = px > r.x ? r.right : r.x;
    const cy = py > r.y ? r.bottom : r.y;
    return Math.hypot(px - cx, py - cy);
}

/**
 * The `hitables` type list, `Player.as:99`, in its own order.
 *
 * ⚠ "Solid" is in it ON PURPOSE — the comment says "added so that you can
 * hit burnable trees". A model that filtered to enemies would silently drop
 * the bridge tile (`Tile.bridgeOpeningTimer`), `BreakableRock`, and the
 * `PushableBlock*` family, all of which R4 and R5 route through.
 */
export const HITABLE_TYPES = Object.freeze([
    'Enemy', 'Grass', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Solid',
    'LightPole', 'LavaBall', 'LavaBoss', 'Watcher',
]);

/**
 * One tick of `Player.slash()`'s hit test, over a declared candidate set.
 *
 * @param {object}   player  `{x, y}` — the CENTRE, which is what both the
 *   rect and the distance filter are built from.
 * @param {number}   direction  `slashDirection`, latched at the press.
 * @param {object[]} targets  `[{ id, box, type, isGrass, isFlyer, cx, cy }]`
 *   — `box` a `levelWorld.rect`, `cx`/`cy` the entity's own `x`/`y` (which
 *   is NOT the box centre for every class: `Entity.x` minus `originX` is
 *   the box, and several classes carry an asymmetric origin).
 * @param {function=} opts.blockedLine  `(x0,y0,x1,y1) => boolean`, the
 *   `collideLine("Solid", ...)` oracle. REQUIRED unless every target is
 *   exempt; there is no default, because a missing LOS oracle that defaulted
 *   to "clear" would turn every wall into a swing the walk can make.
 *
 * @returns {object[]} the targets `genericHit` would be called on, with the
 *   `t` string and damage the call would carry.
 */
export function swingHits(player, direction, targets, {
    sword = 'sword', scale = SLASH_SCALE_NORMAL, blockedLine = null,
} = {}) {
    const hasGhostSword = sword === 'ghostsword';
    const r = slashRect(player.x, player.y, direction, { sword, scale });
    const reach = SLASH_SPRITES[sword].w * scale.x;
    const out = [];
    for (const target of targets) {
        assertRect(target.box, `swingHits target ${target.id}`);
        if (!rectsOverlap(r, target.box)) continue;
        // ⚠ Grass is measured centre-to-CENTRE and everything else
        // point-to-BOX. Two different distances in one `if`, and the Grass
        // arm is the shorter one.
        const d = target.isGrass
            ? Math.hypot(player.x - target.cx, player.y - target.cy)
            : distanceRectPoint(player.x, player.y, target.box);
        if (d > reach) continue;
        const exempt = hasGhostSword || target.type === 'Solid'
            || target.type === 'Rope' || target.isFlyer === true;
        if (!exempt) {
            if (typeof blockedLine !== 'function') {
                fail(`swingHits: target ${target.id} needs the collideLine("Solid") test `
                    + 'and no `blockedLine` oracle was given. Defaulting it to "clear" '
                    + 'would make every wall a swing the walk can make.');
            }
            if (blockedLine(player.x, player.y, target.cx, target.cy)) continue;
        }
        out.push({
            id: target.id,
            t: hasGhostSword ? 'Spear' : 'Sword',
            force: SWORD_FORCE,
            damage: SWORD_DAMAGE[sword],
        });
    }
    return out;
}

/**
 * The press schedule for ONE swing, as a tape input span.
 *
 * `Input.pressed` is an EDGE, so a swing is one span and its LENGTH does
 * not change what it does — but a span that runs to `tick_count` never
 * dispatches its release, which is the R5 window contract's own trap
 * (`director.assertWindowEndsAtRest`). Two ticks, so the edge is
 * unambiguous on both consumers.
 */
export const SWING_SPAN_TICKS = 2;

/**
 * `swing` — a press with a DECLARED TARGET SET.
 *
 * The declaration is the point. A press that hits nothing is not an error
 * the game reports; it is a walk that stands next to a live enemy and
 * finishes green. So the verb carries what it expects to hit, and the
 * executor's job is to notice when it did not.
 *
 * @returns {object} `{ press, spans, expect, rect, reach }`
 */
export function swing(atTick, player, direction, targets, opts = {}) {
    if (!Number.isInteger(atTick) || atTick < 0) {
        fail(`swing: atTick must be a non-negative integer, got ${atTick}`);
    }
    const scale = opts.scale ?? SLASH_SCALE_NORMAL;
    const sword = opts.sword ?? 'sword';
    return {
        press: atTick,
        // ⚠ The hit test is at atTick + 1, never atTick — see header note 1.
        firstTestTick: atTick + 1,
        spans: [{ key: 'primary', from: atTick, to: atTick + SWING_SPAN_TICKS }],
        expect: swingHits(player, direction, targets, opts),
        rect: slashRect(player.x, player.y, direction, { sword, scale }),
        reach: SLASH_SPRITES[sword].w * scale.x,
    };
}

/**
 * `kill` — a swing SCHEDULE plus a WINDOW FLOOR.
 *
 * The R2 hold lesson, applied to combat: **the count is a floor and the
 * assertion is the EFFECT.** A kill is not "N presses landed"; it is "the
 * thing the death OPENS is open" — a kill-lock crossing, a `totalEnemies`
 * that reached zero, a `SlashHit` where the body was. The presses are how
 * you get there and the schedule is deliberately generous.
 *
 * @param {object} instance  a `combatCensus` row (`{tag, cx, cy, ...}`)
 * @param {number} startTick
 * @param {object} opts.hasDarkSword  halves the press count
 * @param {number} opts.slack  extra presses past the arithmetic floor.
 *   Default 1: an enemy that is knocked out of reach by the hit it took
 *   costs a press, and a schedule with no slack turns that into a walk that
 *   ends beside a live enemy.
 */
export function killSchedule(instance, startTick, {
    hasDarkSword = false, slack = 1, cadence = KILL_PRESS_CADENCE,
} = {}) {
    const row = ENEMY_CLASSES[instance.tag];
    if (!row) fail(`killSchedule: "${instance.tag}" has no combat row`);
    if (row.kill?.hits == null) {
        fail(`killSchedule: "${instance.tag}" has no hit count — a boss (or an unpriced `
            + 'class) is an ENCOUNTER SCRIPT, not a press schedule.');
    }
    /**
     * ⛓⛓ R9 SLICE 12b — REFUSED BY WHAT THE PRESS WOULD DO, NOT BY A FLOOR
     * (⚖ ruling 31(b)).
     *
     * The old refusal quoted two reasons and only one of them survives. A
     * cadence inside `SLASH_TIMER_MAX` is no longer an error: it is a DASH,
     * transcribed and driven against the game, and a schedule may want one.
     * What is still an error is a cadence that lands the second press inside
     * THIS BODY's own i-frame, because that press does not damage — it is a
     * schedule whose arithmetic says "N hits" and whose effect is fewer.
     *
     * ⚠ The refusal names the RECEIVER now, so a caller reading it is pointed
     * at `hitsTimer` rather than at a constant with a `max()` in it.
     */
    if (cadence < KILL_PRESS_CADENCE) {
        fail(`killSchedule: a cadence of ${cadence} lands the next press inside `
            + `"${instance.tag}"'s own ${ENEMY_IFRAMES}-tick i-frame, so it would NOT `
            + `damage — \`Enemy.hit\` refuses while \`hitsTimer > 0\`, and a landed hit `
            + `sets it to ${ENEMY_IFRAMES}. ${KILL_PRESS_CADENCE} is that plus the `
            + 'update-order ±1 this transcription does not resolve. ⛓ This is the '
            + 'RECEIVER\'s rule and it is per BODY: the player may press far faster '
            + `(an ordinary swing every ${SLASH_TIMER_MAX} ticks, plus up to `
            + `${DASH_CHAIN_MAX} dashes inside each of those windows), and a SECOND `
            + 'body in reach may be struck on the very next tick.');
    }
    // ⚠ A THROW, NOT A `?? 0`. The window floor has to run past the death
    // ANIMATION — both chasers override `startDeath` to play it without
    // setting `destroy`, so `Game.totalEnemies()` still counts the body and
    // the kill lock does not open on the killing blow. A default of zero
    // here would produce a schedule that reads complete and leaves the walk
    // standing at a shut lock.
    if (!CHASERS[instance.tag]) {
        fail(`killSchedule: "${instance.tag}" has no chaser transcription, so its death `
            + 'animation length is unknown — and the window floor is mostly that length. '
            + 'Transcribe the class in `chasers.js` before scheduling a kill on it.');
    }
    const damage = hasDarkSword ? SWORD_DAMAGE.darksword : SWORD_DAMAGE.sword;
    const landed = Math.ceil(row.kill.hits / damage);
    const presses = landed + slack;
    const ticks = [];
    for (let i = 0; i < presses; i += 1) ticks.push(startTick + i * cadence);
    // The LAST press that can still be the killing blow is the one at index
    // `landed - 1`; the slack presses after it are insurance, and the floor
    // has to cover the death animation from whichever of them lands.
    return {
        tag: instance.tag,
        landedNeeded: landed,
        presses,
        cadence,
        ticks,
        windowFloor: ticks[ticks.length - 1] + killWindowTicks(instance.tag),
        spans: ticks.flatMap((t) => [{ key: 'primary', from: t, to: t + SWING_SPAN_TICKS }]),
        // ⚠ NOT the assertion. Named here so a caller cannot mistake the
        // schedule for the claim.
        assertion: 'the EFFECT: the lock this instance gates is open, and '
            + '`persistence_cleared` gained its tag — never "N presses were sent".',
    };
}
