/**
 * THE CONTACT-CONTROL PAIR — the positive control that arms every
 * contact-freedom negative R5 makes.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §3.2, §4 slice 2.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────
 *
 * R0's bounded-vacuity table listed `noDamage` on the JS side with the
 * witness "R5", because every fixture through R4 was recorded with the guard
 * ON. Nothing had ever driven the player into something that damages, so
 * "the walk was contact-free" and "the guard swallowed every contact"
 * produced identical streams and the model was never asked which it was.
 * R5's whole claim is the first of those, and per the silent-watcher law a
 * negative needs a positive control: the same walk, ONE FIELD APART, where
 * the thing the claim denies actually happens.
 *
 * ── WHAT THE GAME SAID, AND WHAT IT COST TO ASK ───────────────────────
 *
 * ⛔ THE PAIR CAUGHT A REAL DEFECT ON ITS FIRST RUN, which is the best
 * possible outcome for a control. The model predicted the boxes meeting at
 * t44 and the game hit at t49, and the five ticks were TWO independent
 * off-by-eight errors in the brand-new census:
 *
 *   1. `combatCensus` took an INJECTED placement table from
 *      `levelWorld.ENTITY_CLASSES`, which only carries `dx`/`dy` for entries
 *      that answer the BLOCKING role. Seventeen of the thirty-two combat
 *      tags are `notSolid`/`cheapOnly` entries with none, so the lookup
 *      returned `{dx: 0, dy: 0}` — and every one of them is `+8/+8`.
 *   2. `encounters.js` had re-transcribed the PLAYER's own hitbox as
 *      `{w:2, h:2, ox:4, oy:5}`, from reading
 *      `normalHitbox = new Rectangle(2, 2, 4, 5)` as (w,h,ox,oy) when
 *      `Rectangle` is (x,y,width,height) and `setHitbox` takes
 *      (width, height, x, y). The real box is 4x5 at origin (2,2).
 *
 * With both fixed the model predicts the overlap at t49 and the game's
 * divergence begins at t50 — one tick, which is RECORD-THEN-ACT: the enemies
 * update before the player, so an impulse written during tick 50 first
 * appears in observation 50.
 */

import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { runTape } from './tapeRunner.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ENEMY_CLASSES } from './combat.js';

const levelSource = atlasLevelSource();
const OFF = 'r5-contact-control-off';
const ON = 'r5-contact-control-on';

const streamOf = (name) => loadExpectation(name).stream.ticks;
const modelOf = (name) => runTape(loadTape(name), { levelSource }).ticks;

/** The trap the pair walks into, from the census — not from a constant. */
const trap = (() => {
    const world = buildLevelWorld(levelSource(8), { roles: ROLES });
    const row = world.combat.enemies.find((e) => e.tag === 'sandtrap' && e.x === 96 && e.y === 128);
    const box = ENEMY_CLASSES.sandtrap.hitbox;
    return {
        row,
        box: {
            x: row.cx - box.ox,
            y: row.cy - box.oy,
            right: row.cx - box.ox + box.w,
            bottom: row.cy - box.oy + box.h,
        },
    };
})();

/** The first observation whose player box overlaps the trap's. */
function predictedContactTick(ticks) {
    for (const o of ticks) {
        const p = playerBoxAt(o.x, o.y);
        if (p.right > trap.box.x && p.x < trap.box.right
            && p.bottom > trap.box.y && p.y < trap.box.bottom) return o.t;
    }
    return null;
}

describe('the pair is one field apart, and nothing else', () => {
    it('differs in `noDamage` and in NOTHING a stream could see', () => {
        const off = loadTape(OFF);
        const on = loadTape(ON);
        expect(off.noDamage).toBe(true);
        expect(on.noDamage).toBe(false);
        for (const field of ['boot', 'noclip', 'noHazards', 'grants', 'persistence',
            'tick_count', 'inputs']) {
            expect(on[field], field).toEqual(off[field]);
        }
    });
});

describe('the SHUT-BEFORE arm: the guard on, the model exact', () => {
    it('is byte-identical to the contact-free model for all 81 observations', () => {
        // With `noDamage` on, `Player.hit` returns at :1361 before sound,
        // shake, knockback and the i-frame window — so the walk continues
        // straight through a body it is standing inside, and the JS engine
        // (which models no damage at all) must reproduce it exactly.
        const model = modelOf(OFF);
        const game = streamOf(OFF);
        expect(game).toHaveLength(81);
        expect(model).toHaveLength(81);
        for (let t = 0; t < game.length; t += 1) {
            expect({ t, x: model[t].x, y: model[t].y, level: model[t].level })
                .toEqual({ t, x: game[t].x, y: game[t].y, level: game[t].level });
        }
    });

    it('...and it really does end up INSIDE the trap, or it proves nothing', () => {
        // A control arm that never reached the trap would be green for the
        // wrong reason. The walk finishes standing in the body.
        const game = streamOf(OFF);
        const last = playerBoxAt(game.at(-1).x, game.at(-1).y);
        expect(last.right).toBeGreaterThan(trap.box.x);
        expect(last.x).toBeLessThan(trap.box.right);
        expect(last.bottom).toBeGreaterThan(trap.box.y);
        expect(last.y).toBeLessThan(trap.box.bottom);
    });
});

describe('the LIVE arm: the guard off, the game diverges', () => {
    it('⛓ diverges at the tick the model predicts, plus RECORD-THEN-ACT\'s one', () => {
        const model = modelOf(ON);
        const game = streamOf(ON);
        let first = null;
        for (let t = 0; t < game.length && first === null; t += 1) {
            if (model[t].x !== game[t].x || model[t].y !== game[t].y) first = t;
        }
        const predicted = predictedContactTick(model);
        expect(predicted).toBe(49);
        // Observation `t` is the state after `t` completed ticks. The overlap
        // first EXISTS in observation 49; the enemy sees it on the next tick
        // (enemies update before the player), writes the impulse, and the
        // player's own friction and sweep integrate it — so the first
        // observation that MOVED is 50.
        expect(first).toBe(predicted + 1);
    });

    it('and the divergence has the KNOCKBACK signature, not merely a difference', () => {
        // `Player.hit` → `knockback(3, Point(x, y))`: `center` is the
        // normalized vector AWAY from the attacker and `v += f * center`.
        // The trap is down-and-right of the player, so the impulse is up and
        // LEFT — and the player had been walking RIGHT.
        const game = streamOf(ON);
        const before = game[49];
        const after = game[50];
        expect(after.x).toBeLessThan(before.x);
        expect(after.y).toBeLessThan(before.y);
        // Away from the trap in both axes, and the enemy is where the census
        // says it is: the impulse direction is evidence for the PLACEMENT.
        expect(trap.row.cx).toBeGreaterThan(before.x);
        expect(trap.row.cy).toBeGreaterThan(before.y);
        // Friction is SUBTRACTIVE (0.25/tick off the length), so the impulse
        // decays monotonically rather than stopping dead.
        const step = (t) => Math.hypot(game[t + 1].x - game[t].x, game[t + 1].y - game[t].y);
        for (let t = 50; t < 60; t += 1) {
            expect(step(t), `t${t}`).toBeLessThan(step(t - 1));
        }
    });

    it('...and it costs 20 ticks of STEERING, not just an impulse', () => {
        // `Player.input()` wraps the four arrow branches in
        // `if (hitsTimer <= 0)` (:1506) and `hit()` sets `hitsTimer = 20`.
        // The tape holds RIGHT until tick 46 and the hit lands at 50, so
        // there is no held key left to prove that with directly — what the
        // stream shows instead is that the player never re-accelerates east
        // for the rest of the tape, ending 10 px WEST of where the
        // contact-free arm ended.
        const on = streamOf(ON).at(-1);
        const off = streamOf(OFF).at(-1);
        expect(off.x - on.x).toBeGreaterThan(10);
        expect(off.y - on.y).toBeGreaterThan(9);
    });

    it('the two arms are identical up to the contact, which is what makes it a PAIR', () => {
        const on = streamOf(ON);
        const off = streamOf(OFF);
        for (let t = 0; t <= 49; t += 1) {
            expect({ t, ...on[t] }, `t${t}`).toEqual({ t, ...off[t] });
        }
        expect(on[50]).not.toEqual(off[50]);
    });
});
