/**
 * THE CONTACT PAIR v2 — the damage model's own driven witness, and the
 * first tape on this ladder that DIES.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 3. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §3.4 parts 1+2, §8.8.
 *
 * ── WHY A SECOND PAIR, WHEN R5 ALREADY HAD ONE ────────────────────────
 *
 * R5's pair (`contactControl.test.js`) does now replay byte-exact through
 * the damage model, and that is the strongest kind of witness there is: the
 * recording predates the model by a whole rung. But measuring it turned up
 * what it CANNOT witness, and the list is most of the mechanism:
 *
 *   · **the i-frame window**, either half. The knockback carries the player
 *     clear of the 16x16 body in one tick, so `hitPlayer` never fires again
 *     and nothing is ever suppressed;
 *   · **the steering loss**. The tape's last RIGHT is at tick 46 and the
 *     hit lands at 50 — there is no held key left to lose (R5's own note
 *     says so);
 *   · **a second hit**, **a death**, **a respawn**, and **`hitsMax` as a
 *     run value** rather than a constant.
 *
 * A slice that had taken the green R5 pair as covering `playerDamage.js`
 * would have shipped the i-frame gate, the death fork and the world reboot
 * untested. So this pair is built to walk into all of them.
 *
 * ── THE FOUR ARMS, AND WHAT EACH ONE IS FOR ───────────────────────────
 *
 * Booted at (32,128) — spawn (40,136) — level with `sandtrap@96,128`'s
 * ENTITY CENTRE (104,136), with RIGHT held for all 130 ticks. Level with
 * the centre, `center.y` is 0, so `Player.knockback`'s y branch
 * (`Math.abs(center.y) > 0.5`) drops the impulse while the x branch (`>=`)
 * keeps it: every shove is a pure -3.00 px/tick west, and the held RIGHT
 * walks straight back in. That is what turns one graze into a repeatable
 * cycle, and the cycle's PERIOD is the i-frame window made visible.
 *
 *   `live`    `noDamage: false` — 3 hits, a death, a respawn
 *   `control` `noDamage: true`  — ONE FIELD apart; walks straight through
 *   `heart`   `noDamage: false` + a `health` grant — 4 hearts, so the same
 *             three hits leave it standing
 *   `standing` the live arm's 90-tick PREFIX — the only arm that ends
 *             MID-WINDOW, and the one that makes the game's own `hits`
 *             readout non-vacuous
 *
 * ⛔⛔ AND THE PREFIX ARM EARNED ITS PLACE BY FINDING SOMETHING. The other
 * three all finish with `hits` back at 0 — two because the death reset it,
 * one because it never took any — so the differential's new "the game's own
 * `hits` matches the model" check was comparing 0 to 0 on every one of
 * them. The prefix ends at `hits: 2`, and on its first run it also showed
 * that `hits_timer` is NOT drain-stable: the model said 1, the game said 0,
 * and all 91 observations were byte-identical. `hitUpdate()` keeps running
 * after the tape's last observation, so a COUNTDOWN cannot be compared for
 * equality across the drain — the harness compares it as a bound and says
 * so. A readout added and asserted without a tape that exercises it would
 * have shipped as a green vacuity.
 */

import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { runTape } from './tapeRunner.js';
import { PLAYER_DAMAGE } from './playerDamage.js';
import { spawnFromBoot } from './playerPhysicsV1.js';

const levelSource = atlasLevelSource();
const LIVE = 'r6-contact-pair-live';
const CONTROL = 'r6-contact-pair-control';
const HEART = 'r6-contact-pair-heart';
const STANDING = 'r6-contact-pair-standing';

const modelOf = (name) => runTape(loadTape(name), { levelSource });
const streamOf = (name) => loadExpectation(name).stream.ticks;

describe('the pair is one field apart, and nothing else', () => {
    it('`live` and `control` differ in `noDamage` alone', () => {
        const live = loadTape(LIVE);
        const control = loadTape(CONTROL);
        expect(live.noDamage).toBe(false);
        expect(control.noDamage).toBe(true);
        for (const field of ['boot', 'noclip', 'noHazards', 'grants', 'persistence',
            'tick_count', 'inputs']) {
            expect(control[field], field).toEqual(live[field]);
        }
    });

    it('`live` and `heart` differ in the GRANT alone', () => {
        const live = loadTape(LIVE);
        const heart = loadTape(HEART);
        expect(live.grants).toEqual([]);
        expect(heart.grants).toEqual([{ level: 8, items: ['health'] }]);
        for (const field of ['boot', 'noclip', 'noDamage', 'noHazards', 'persistence',
            'tick_count', 'inputs']) {
            expect(heart[field], field).toEqual(live[field]);
        }
    });

    it('the key really is held across every hit, which R5\'s tape could not do', () => {
        const t = loadTape(LIVE);
        expect(t.inputs).toEqual([{ key: 'right', from: 1, to: 130 }]);
    });
});

describe('⛓⛓⛓ the LIVE arm, against the game', () => {
    it('is byte-identical to the model for all 131 observations', () => {
        const model = modelOf(LIVE).ticks;
        const game = streamOf(LIVE);
        expect(game).toHaveLength(131);
        for (let t = 0; t < game.length; t += 1) {
            expect({ t, x: model[t].x, y: model[t].y, level: model[t].level })
                .toEqual({ t, x: game[t].x, y: game[t].y, level: game[t].level });
        }
    });

    it('three hits, at the ticks the i-frame window spaces them by', () => {
        const run = modelOf(LIVE);
        expect(run.playerHits.map((h) => h.t)).toEqual([48, 72, 100]);
        expect(run.playerHits.map((h) => h.hits)).toEqual([1, 2, 3]);
        // ⛓ THE GAP IS THE STEERING LOSS, MEASURED. 20 of the 24 ticks
        // between hit 1 and hit 2 are the window (`Player.input`'s four
        // arrow branches sit inside `if (hitsTimer <= 0)`); the other 4 are
        // the re-acceleration back into the body. A model that dropped the
        // gate would put hit 2 four ticks after hit 1.
        expect(run.playerHits[1].t - run.playerHits[0].t)
            .toBeGreaterThan(PLAYER_DAMAGE.hitsTimerMax);
    });

    it('⛔ every shove is PURE x — the y comparator drops its impulse', () => {
        // The stance is level with the body's centre, so `center.y` is
        // exactly 0 and `Math.abs(0) > 0.5` is false. `Math.abs(0) >= 0.5`
        // is false too, so this arm does not distinguish the comparators —
        // what it pins is the magnitude, which is the force undivided.
        const run = modelOf(LIVE);
        for (const h of run.playerHits.filter((x) => !x.died)) {
            expect(h.knockback.dy).toBe(0);
            expect(h.knockback.dx).toBeCloseTo(-PLAYER_DAMAGE.contactForce, 12);
            expect(h.knockback.landed).toEqual({ x: true, y: false });
        }
    });

    it('⛔⛔⛔ the third hit KILLS, and the death is a WORLD REBOOT', () => {
        const run = modelOf(LIVE);
        const death = run.playerDeaths;
        expect(death).toHaveLength(1);
        expect(death[0].t).toBe(100);
        expect(death[0].hits).toBe(3);
        // The respawn is the CURRENT `Game`'s constructor args plus the
        // Player ctor's half tile — NOT where the player died, and not a
        // level change either.
        expect(death[0].respawn).toEqual(spawnFromBoot(loadTape(LIVE).boot));
        // ⛔ AND THERE IS NO TRANSITION. `restartLevel()` rebuilds the SAME
        // level, so the level field never moves and the shared
        // `deriveTransitions` reports nothing — the stream's only witness is
        // the position jump. A model that pushed a transition record here
        // would fail the differential's element-wise comparison against a
        // game that reports none.
        expect(run.transitions).toEqual([]);
    });

    it('⛓ THERE IS NO OBSERVATION OF THE DEATH — the swap lands inside its tick', () => {
        // `Player.update` calls `super.update()` under `if (!dying)` and
        // `die()` has already set it, so the death tick runs no physics at
        // all — and then `Engine.checkWorld` swaps the world at the END of
        // that same tick. ⇒ the stance the hit found is never observed: the
        // last live observation is 99, and observation 100 is ALREADY the
        // rebuilt world. Exactly the shape a teleporter has ("no
        // intermediate observation on a crossing tick"), reached by a
        // completely different route.
        //
        // ⚠ Written the other way first — "100 is the stance, 101 is the
        // respawn" — and the recording says otherwise on both counts.
        const model = modelOf(LIVE).ticks;
        const game = streamOf(LIVE);
        const respawn = spawnFromBoot(loadTape(LIVE).boot);
        expect({ x: model[100].x, y: model[100].y }).toEqual(respawn);
        expect({ x: game[100].x, y: game[100].y }).toEqual(respawn);
        // ...and 99 is a long way east of it, so the jump is the witness.
        expect(model[99].x).toBeGreaterThan(respawn.x + 50);
    });

    it('...and the rebuilt player has taken nothing', () => {
        const run = modelOf(LIVE);
        // 30 ticks of walking after the respawn, and the fourth hit is at
        // 147 — outside the tape on purpose, so the arm's claim is exactly
        // one death.
        expect(run.damage.hits).toBe(0);
        expect(run.damage.hitsTimer).toBe(0);
        expect(run.playerHits.filter((h) => h.t > 100)).toEqual([]);
    });

    it('⛓ `Game.shake` took three ADDITIONS and drained across the load', () => {
        const run = modelOf(LIVE);
        // +5 per landed hit (`Player.as:1389`), -1 per `view()`. The hits
        // are 24+ ticks apart, so each one is spent before the next lands
        // and the peak is 5 rather than 15 — which is exactly the reading a
        // model that took the writer for an `=` would ALSO produce, so the
        // arithmetic is checked in `camera.test.js` and the value here.
        expect(run.playerHits.map((h) => h.shake)).toEqual([5, 5, 5]);
        // 5 dies inside the shortest fade (17), so the reboot's shake is
        // certainly 0 — `camera.shakeAcrossLoad`'s certain arm, driven.
        expect(run.shake).toBe(0);
    });
});

describe('the CONTROL arm: the guard on, and nothing happens', () => {
    it('is byte-identical to the model, and takes no damage at all', () => {
        const model = modelOf(CONTROL).ticks;
        const game = streamOf(CONTROL);
        expect(game).toHaveLength(131);
        for (let t = 0; t < game.length; t += 1) {
            expect({ t, x: model[t].x, y: model[t].y, level: model[t].level })
                .toEqual({ t, x: game[t].x, y: game[t].y, level: game[t].level });
        }
        const run = modelOf(CONTROL);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        expect(run.damage.hits).toBe(0);
    });

    it('⛓ ...and it really does walk THROUGH the body, or it proves nothing', () => {
        // A control that stopped at a wall short of the trap would be green
        // for the wrong reason. It ends 98 px east of where the live arm's
        // respawn left it, having crossed the body without noticing.
        const control = modelOf(CONTROL).ticks.at(-1);
        const live = modelOf(LIVE).ticks.at(-1);
        expect(control.x).toBeGreaterThan(live.x + 90);
        expect(control.x).toBeGreaterThan(112);
    });
});

describe('⛔ the HEART arm: `hitsMax` is a RUN VALUE, and it flips the claim', () => {
    it('is byte-identical to the model for all 131 observations', () => {
        const model = modelOf(HEART).ticks;
        const game = streamOf(HEART);
        expect(game).toHaveLength(131);
        for (let t = 0; t < game.length; t += 1) {
            expect({ t, x: model[t].x, y: model[t].y, level: model[t].level })
                .toEqual({ t, x: game[t].x, y: game[t].y, level: game[t].level });
        }
    });

    it('takes the SAME three hits at the SAME ticks and does not die', () => {
        const live = modelOf(LIVE);
        const heart = modelOf(HEART);
        expect(heart.playerHits.slice(0, 3).map((h) => h.t))
            .toEqual(live.playerHits.map((h) => h.t));
        expect(live.playerHits[2].died).toBe(true);
        expect(heart.playerHits[2].died).toBe(false);
        // The grant is what moved: `health` ADDS to `Main.hitsMax`.
        expect(heart.playerHits[0].hitsMax).toBe(PLAYER_DAMAGE.hitsMaxDef + 1);
        expect(live.playerHits[0].hitsMax).toBe(PLAYER_DAMAGE.hitsMaxDef);
    });

    it('dies on the FOURTH hit instead, 23 ticks later', () => {
        const heart = modelOf(HEART);
        expect(heart.playerHits.map((h) => h.hits)).toEqual([1, 2, 3, 4]);
        expect(heart.playerDeaths).toHaveLength(1);
        expect(heart.playerDeaths[0].t).toBe(123);
    });

    it('⛓ and it is the ONE arm that witnesses the i-frame SUPPRESSION', () => {
        // One tick of overlap inside an open window, paying nothing. The
        // live arm never produces one — its knockback ejects the player
        // before the next tick every time — so without this arm the
        // `hitsTimer` gate would have no driven witness at all, only a unit
        // case.
        const heart = modelOf(HEART);
        expect(heart.contactsSuppressed).toHaveLength(1);
        expect(heart.contactsSuppressed[0]).toMatchObject({
            why: 'hitsTimer', id: 'sandtrap@96,128', source: 'enemy',
        });
    });
});

describe('⛔⛔ the STANDING arm: a PREFIX, and the only one that ends mid-window', () => {
    it('is byte-identical to the model for all 91 observations', () => {
        const model = modelOf(STANDING).ticks;
        const game = streamOf(STANDING);
        expect(game).toHaveLength(91);
        for (let t = 0; t < game.length; t += 1) {
            expect({ t, x: model[t].x, y: model[t].y, level: model[t].level })
                .toEqual({ t, x: game[t].x, y: game[t].y, level: game[t].level });
        }
    });

    it('⛓ IS the live arm, stopped early — same tape to the tick it stops at', () => {
        // The prefix-control shape: every byte the same except the stop, so
        // the two arms cannot differ for any reason but the length. And its
        // stream really is the live arm's own first 91 observations, which
        // is a second check on the live arm's first 91 for free.
        const live = loadTape(LIVE);
        const standing = loadTape(STANDING);
        expect(standing.tick_count).toBe(90);
        for (const field of ['boot', 'noclip', 'noDamage', 'noHazards', 'grants',
            'persistence']) {
            expect(standing[field], field).toEqual(live[field]);
        }
        const liveStream = streamOf(LIVE);
        const standingStream = streamOf(STANDING);
        for (let t = 0; t <= 90; t += 1) {
            expect({ t, ...standingStream[t] }, `t${t}`).toEqual({ t, ...liveStream[t] });
        }
    });

    it('⛓⛓ ends with TWO hearts gone and a window still draining', () => {
        // The readout the game reports here is `hits: 2` — the first
        // non-zero one on the roster, and what turns the differential's
        // `hits` check from 0 == 0 into evidence.
        const run = modelOf(STANDING);
        expect(run.playerHits.map((h) => h.t)).toEqual([48, 72]);
        expect(run.damage.hits).toBe(2);
        expect(run.damage.hitsTimer).toBe(1);
        expect(run.playerDeaths).toEqual([]);
        // ⚠ AND THE FACING IS PARKED. `knockback` writes `directionFace` on
        // every landed hit and `hitUpdate` only hands it back when the
        // window closes — which this tape stops one tick short of.
        expect(run.damage.directionFace).toBe(0);
    });
});
