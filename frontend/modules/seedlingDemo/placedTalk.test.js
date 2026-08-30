/**
 * ⛓⛓⛓ R9 SLICE 12e‴ — **THE PLACED-NPC DIALOGUE, AGAINST THE GAME'S OWN
 * RECORDING AND AGAINST THE SOURCE.**
 *
 * `r8-d2-19`'s solver-authored 708-tick walk swings the sword next to L19's
 * sign and the GAME stops dead for 28 ticks. The model went straight on,
 * because `NPC.talk()`'s key had been read as V — it is `p.keys[6]`, and
 * `Player.as:59` puts `Key.X` at index 6 as well as index 4, so the SWORD
 * key is the talk key and every walk presses it constantly.
 *
 * ⛔ **28 IS NOT A CONSTANT AND THERE IS NONE IN THE AS3.** It is
 * `t_close − t_open` for one tape against one page. That is why the pin here
 * is the GAME'S OWN STREAM and not a number: a fixture that asserted "28"
 * would pass for a model that froze for 28 ticks starting anywhere.
 *
 * Two strata, deliberately:
 *   · `fixtures/r8-d2-19-freeze-oracle.json` — the game's 709 observations,
 *     recorded on the real Flash build. Catches the model disagreeing with
 *     the GAME.
 *   · the source rows — `PLACED_NPC_TALK` against `Game.as`/`NPCs/*.as`.
 *     Catches the model and the recording being wrong together.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    NPC_LINE_LENGTH_DEFAULT, PLACED_NPC_TALK, TALK_KEY, TALK_OWNED_ELSEWHERE,
} from './dialogue.js';
import { stepDialogue } from './dialogue.js';
import { TALK_RANGE, beginNpcDialogue, inTalkRange, stepNpcDialogue } from './endingChain.js';
import { ENTITY_CLASSES, ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import {
    MAX_MOVE_SPEED, createStrikePolicy, oneTickTravelBound, talkGuard,
} from './strikePolicy.js';
import { MOVE_SPEEDS } from './playerPhysicsV1.js';
import { FACING_KEYS, facingToward } from './solverBot.js';
import { SLASH_DASH_FORCE } from './combatVerbs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'r8-d2-19-freeze-oracle.json'), 'utf8'));
const levelSource = atlasLevelSource();

describe('the placed-NPC talk table is the AS3, not a guess', () => {
    it('⛔ the talk key is `keys[6]` = X = `primary`, NOT `keys[7]` = V', () => {
        // `Player.as:59` — [RIGHT, UP, LEFT, DOWN, X, C, X, V, I]. The index
        // that made this defect is 6, and the one the old comment named is 7.
        expect(TALK_KEY).toBe('primary');
    });

    it('every row names its `Game.as` spawn line and its class ctor', () => {
        for (const [type, row] of Object.entries(PLACED_NPC_TALK)) {
            expect(row.spawn, type).toMatch(/^Game\.as:\d+$/);
            expect(row.ctor, type).toMatch(/^NPCs\/\w+\.as:\d+/);
            expect(typeof row.as3, type).toBe('string');
        }
    });

    it('⛓ `Statue` is the ONE class with its own `_lineLength`, and it is 34', () => {
        // `NPCs/Statue.as:20` passes 34; `NPCs/NPC.as:46`'s default is 28.
        expect(PLACED_NPC_TALK.statue1.lineLength).toBe(34);
        expect(PLACED_NPC_TALK.statue2.lineLength).toBe(34);
        const others = Object.entries(PLACED_NPC_TALK)
            .filter(([t]) => !t.startsWith('statue'));
        for (const [type, row] of others) {
            expect(row.lineLength, type).toBe(NPC_LINE_LENGTH_DEFAULT);
        }
        expect(NPC_LINE_LENGTH_DEFAULT).toBe(28);
    });

    it('⛔ the three classes whose `doneTalking()` DOES something are REFUSED by name', () => {
        const refused = Object.entries(PLACED_NPC_TALK)
            .filter(([, r]) => r.doneTalking === 'REFUSED').map(([t]) => t).sort();
        expect(refused).toEqual(['oracle', 'witch', 'yeti']);
        for (const t of refused) expect(PLACED_NPC_TALK[t].why, t).toMatch(/NPCs\/\w+\.as:/);
    });

    it('⛓ the Watcher is absent BY NAME, not by omission', () => {
        expect(PLACED_NPC_TALK.watcher).toBeUndefined();
        expect(TALK_OWNED_ELSEWHERE.watcher).toMatch(/stepWatchersNow/);
    });

    it('⛓ every TEXTED entity type in the committed atlas is classified', () => {
        // The DATA decides the table's coverage, not a list somebody typed:
        // a `text` attribute on an unclassified type is a dialogue nobody
        // modelled. [[feedback_code_sweep_misses_the_data]]
        const atlas = JSON.parse(readFileSync(
            join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
        const texted = new Set();
        for (const l of atlas.levels) {
            for (const e of l.entities) {
                if ((e.attrs?.text ?? '') !== '') texted.add(e.type);
            }
        }
        // `seed` is a Pickup and is `dialogue.PICKUP_TEXT_FROM_ATTRIBUTE`'s.
        texted.delete('seed');
        const known = new Set([...Object.keys(PLACED_NPC_TALK),
            ...Object.keys(TALK_OWNED_ELSEWHERE)]);
        expect([...texted].filter((t) => !known.has(t))).toEqual([]);
        expect(texted.size).toBe(15);
    });
});

describe('the talker roster is built from the level, with a talk CIRCLE', () => {
    const l19 = buildLevelWorld(levelSource(19), { roles: ROLES });

    it('⛓ L19 declares one talker — the sign, with `frames` as its typing speed', () => {
        expect(l19.talkers).toHaveLength(1);
        const [s] = l19.talkers;
        expect(s.tag).toBe('sign');
        expect(s.text).toBe('Wait for your opening against the Shieldspire.');
        // `Game.as:2276` — `new Sign(x, y, tag, text, o.@frames)`, and the
        // FIFTH parameter is `_talkingSpeed`. The atlas says 4.
        expect(s.talkingSpeed).toBe(4);
        expect(s.lineLength).toBe(NPC_LINE_LENGTH_DEFAULT);
        // `NPCs/NPC.as:47` — the entity is at the stacked ctor offset.
        expect([s.ex, s.ey]).toEqual([72, 136]);
    });

    it('⛔⛔ THE CIRCLE REACHES WHERE THE SOLID BOX DOES NOT — this is why §35 could not fit it', () => {
        const [s] = l19.talkers;
        const player = { x: 66.00000000000001, y: 152 };
        // The sign's 16x16 SOLID spans y in [120, 136); the player is at 152,
        // sixteen pixels below its bottom edge and touching nothing.
        // The sign's SOLID rect, from the class row the blocking model uses:
        // entity at (x + dx, y + dy) with a `w` x `h` box about `originX/Y`.
        const cls = ENTITY_CLASSES.sign;
        const bottom = 128 + cls.dy - cls.originY + cls.h;
        expect(bottom).toBe(144);
        expect(player.y).toBeGreaterThan(bottom);
        // And it talks anyway: `NPC.as:190` is a DISTANCE on entity origins.
        expect(Math.hypot(s.ex - player.x, s.ey - player.y)).toBeCloseTo(17.088, 3);
        expect(inTalkRange({ x: s.ex, y: s.ey }, player)).toBe(true);
        expect(TALK_RANGE).toBe(24);
    });

    it('⛓ L114 has NO talker row — the Watcher is skipped by name', () => {
        expect(buildLevelWorld(levelSource(114), { roles: ROLES }).talkers).toEqual([]);
    });

    it('⛔ a texted entity type with no table row REFUSES BY NAME at build time', () => {
        const record = {
            ...levelSource(19),
            entities: [{ type: 'hermit', x: 64, y: 128, attrs: { text: 'hi', frames: '4' } }],
        };
        // `hermit` IS classified, so the control must build...
        expect(() => buildLevelWorld(record, { roles: ROLES })).not.toThrow();
        const rogue = {
            ...levelSource(19),
            entities: [{ type: 'oraclestatue', x: 64, y: 128, attrs: { text: 'hi' } }],
        };
        expect(() => buildLevelWorld(rogue, { roles: ROLES }))
            .toThrow(/carries a `text` attribute and no `dialogue.PLACED_NPC_TALK` row/);
    });
});

describe('⛓⛓⛓ THE GAME ORACLE — the model against the real Flash build, tick for tick', () => {
    const run = runTape(ORACLE.tape, { levelSource });

    /**
     * ⛓⛓⛓ **R9 SLICE 12e⁗: THE TAIL IS BIT-EXACT NOW — ALL 709 OBSERVATIONS,
     * maxAbsDeltaPx 0 — AND THE PARAGRAPH THAT USED TO STAND HERE WAS A TRUE
     * STATEMENT WITH A FALSE EXPLANATION.**
     *
     * It read: *"the game is a recompiled Flash build; after the freeze lifts,
     * its fractional drift and the model's differ in the last few bits (≤ 3
     * units in the last place) … pinning '0 differing' here would have been a
     * claim the arithmetic cannot support."* The MEASUREMENT was honest — 226
     * of 709 exact within 9.9e-14 at 12e‴'s head — but the drift was **not the
     * build's**. It was the model's own: `knockbackImpulse` was skipping
     * `Player.as:788`'s POSITION ROUND TRIP and spelling `Point.normalize` with
     * `Math.hypot` + `cx / length` where the runtime uses `sqrt(x*x + y*y)` and
     * a reciprocal multiply. Transcribe both and the drift is ZERO.
     *
     * ⚠ THE LESSON IS THE ATTRIBUTION, NOT THE NUMBER. A measured tolerance is
     * still better than a convenient one — that part stands — but "the last few
     * bits are the emulator's" is a CLAIM ABOUT A CAUSE, and this one was
     * wrong for two rungs while a correctly-measured bound made it look
     * settled. A bound records what you saw; it does not license a story about
     * why. [[feedback_header_warning_is_not_a_check]]
     *
     * ⛓ AND THIS IS AN INDEPENDENT WITNESS FOR THAT FIX: this tape is NOT one
     * of the thirteen 12e⁗ attributed the ULP against, it was recorded at a
     * different slice, and nothing was tuned to it. The bound is 0 now, so any
     * ULP regression reds here.
     */
    it('agrees with the game on every one of the 709 observations, BIT-EXACT', () => {
        const game = ORACLE.stream.ticks;
        const a = ORACLE.agreement;
        expect(run.ticks).toHaveLength(game.length);
        let exact = 0;
        let maxDelta = 0;
        let levelMismatches = 0;
        let firstBeyondBound = null;
        for (let i = 0; i < game.length; i++) {
            const m = run.ticks[i];
            const q = game[i];
            expect(m.t, `tick index ${i}`).toBe(q.t);
            if (m.level !== q.level) levelMismatches++;
            const d = Math.max(Math.abs(m.x - q.x), Math.abs(m.y - q.y));
            if (d === 0) exact++;
            if (d > maxDelta) maxDelta = d;
            if (d > a.maxAbsDeltaPx && firstBeyondBound === null) {
                firstBeyondBound = { t: q.t, model: m, game: q, delta: d };
            }
            // ⛔ THE PART THAT IS EXACT, and it is the part the defect was in.
            if (q.t <= a.exactThroughTick) {
                expect([m.x, m.y], `t=${q.t} must be EXACT`).toEqual([q.x, q.y]);
            }
        }
        // ⛔ NAMED, not counted: the first tick past the bound is the diagnosis.
        expect(firstBeyondBound).toBeNull();
        expect(levelMismatches).toBe(0);
        expect(exact).toBe(a.exactTicks);
        expect(maxDelta).toBeLessThanOrEqual(a.maxAbsDeltaPx);
    });

    it('⛓ ends where the GAME ends — L18, not L20', () => {
        const last = run.ticks[run.ticks.length - 1];
        expect(last.level).toBe(ORACLE.terminal.level);
        expect(last.x).toBe(ORACLE.terminal.x);
        expect(last.y).toBe(ORACLE.terminal.y);
    });

    it('⛔ the FREEZE WINDOW, and it is a window rather than a length', () => {
        const at = (t) => run.ticks.find((o) => o.t === t);
        const { heldStill, resumeTick, resumeAt } = ORACLE.freeze;
        for (let t = heldStill.from; t <= heldStill.to; t++) {
            expect([at(t).x, at(t).y], `t=${t}`).toEqual([heldStill.x, heldStill.y]);
        }
        // The tick BEFORE the window still moves: `NPC.talk()` raises the
        // freeze inside the `talking` block, which the OPENING frame has
        // already passed. And the tick after it moves again.
        expect(at(heldStill.from - 1).x).not.toBe(heldStill.x);
        expect([at(resumeTick).x, at(resumeTick).y]).toEqual([resumeAt.x, resumeAt.y]);
    });

    it('⛓ the 28 ticks are `t_close − t_open`, DERIVED by stepping the sign\'s own page', () => {
        const [sign] = buildLevelWorld(levelSource(19), { roles: ROLES }).talkers;
        const pos = new Map(ORACLE.stream.ticks.map((o) => [o.t, o]));
        const held = new Map();
        for (const r of ORACLE.tape.inputs) {
            for (let t = r.from; t < r.to; t++) {
                if (!held.has(t)) held.set(t, new Set());
                held.get(t).add(r.key);
            }
        }
        const released = (t) => (held.get(t - 1)?.has(TALK_KEY) ?? false)
            && !(held.get(t)?.has(TALK_KEY) ?? false);
        let d = null;
        let open = null;
        let close = null;
        for (let t = 0; t <= 120 && close === null; t++) {
            const p = pos.get(t);
            if (!p) break;
            const range = inTalkRange({ x: sign.ex, y: sign.ey }, p);
            if (d === null) {
                if (!released(t) || !range) continue;
                d = beginNpcDialogue(sign.text,
                    { talkingSpeed: sign.talkingSpeed, lineLength: sign.lineLength });
                open = t;
                stepDialogue(d, false);   // the opening frame still RENDERS
                continue;
            }
            stepNpcDialogue(d, released(t), range);
            if (d.done) close = t;
        }
        expect(open).toBe(ORACLE.freeze.openTick);
        expect(close).toBe(ORACLE.freeze.closeTick);
        expect(close - open).toBe(ORACLE.freeze.span);
        expect(ORACLE.freeze.span).toBe(28);
        // ⛔ And it is NOT the first three releases that open it: they are out
        // of range. The circle is load-bearing, not decorative.
        for (const t of [1, 3, 9]) {
            expect(released(t), `t=${t}`).toBe(true);
            expect(inTalkRange({ x: sign.ex, y: sign.ey }, pos.get(t)), `t=${t}`).toBe(false);
        }
    });
});

describe('⚖ RULING 53 — the planner REFUSES the press rather than pricing the freeze', () => {
    const circle = [{ id: 'sign@64,128', tag: 'sign', ex: 72, ey: 136 }];

    it('⛓ the guard radius is DERIVED from the physics, not typed', () => {
        expect(MAX_MOVE_SPEED).toBe(Math.max(...MOVE_SPEEDS));
        expect(oneTickTravelBound(0, 0))
            .toBeCloseTo(MAX_MOVE_SPEED * Math.SQRT2 + SLASH_DASH_FORCE, 10);
        // Velocity only ever ADDS to the bound.
        expect(oneTickTravelBound(3, 4)).toBeCloseTo(oneTickTravelBound(0, 0) + 5, 10);
    });

    it('names the circle a press would be released inside', () => {
        const g = talkGuard({ x: 66, y: 152, vx: 0, vy: 0 }, circle, 1);
        expect(g.id).toBe('sign@64,128');
        expect(g.distance).toBeCloseTo(17.09, 2);
        expect(g.guardRadius).toBeGreaterThan(TALK_RANGE);
    });

    it('⛓ and lets a press through far from any circle', () => {
        expect(talkGuard({ x: 300, y: 300, vx: 0, vy: 0 }, circle, 1)).toBeNull();
        expect(talkGuard({ x: 66, y: 152, vx: 0, vy: 0 }, [], 1)).toBeNull();
    });

    it('⛔⛔ THE POLICY REFUSES BEFORE IT EVEN SCANS — the ⚖ 53 mutant row', () => {
        // The player is 17.09 px from L19's sign, which is inside the circle,
        // and a body is in reach. ONE argument differs between the two calls.
        const body = [{ id: 'b1', as3: 'Bob', rect: { x: 60, y: 140, w: 12, h: 8 },
            hitsTimer: 0 }];
        const state = { x: 66, y: 152, vx: 0, vy: 0, direction: 1 };
        const make = (talkCircles) => createStrikePolicy({
            facingToward, facingKeys: FACING_KEYS, hasSword: true, talkCircles,
        });

        const control = make([]);
        control.decide(state, body, 10, new Set(['right']));
        // ⛓ THE CONTROL DID THE WORK: it scanned the bodies and wrote a
        // per-target row. That is what makes the guarded call's silence mean
        // something. [[feedback_fixture_must_discriminate_two_builds]]
        expect(control.talkRefusals).toHaveLength(0);
        expect(control.trace[0].saw).toBe(1);
        expect(control.trace[0].rejected ?? control.trace[0].decision).toBeTruthy();

        const guarded = make([{ id: 'sign@64,128', tag: 'sign', ex: 72, ey: 136 }]);
        const gd = guarded.decide(state, body, 10, new Set(['right']));
        expect(guarded.talkRefusals).toHaveLength(1);
        const row = guarded.talkRefusals[0];
        expect(row.talkRefused.id).toBe('sign@64,128');
        expect(row.talkRefused.distance).toBeCloseTo(17.09, 2);
        expect(row.talkRefused.aheadTicks).toBe(2);
        expect(row.why).toMatch(/would be RELEASED inside/);
        expect(row.why).toMatch(/⚖ ruling 53/);
        // ⛔ AND IT SPENDS NO DIRECTION KEY: the walk's own keys go back
        // untouched, which is the whole point of taking it at the AIM.
        expect([...gd.held]).toEqual(['right']);
        expect(gd.decision).toBe('none');
        // ⛔ The guarded call never reached the scan at all — no `rejected`.
        expect(row.rejected).toBeUndefined();
    });

    it('⛓ and a run far from every circle keeps the policy it always had', () => {
        const body = [{ id: 'b1', as3: 'Bob', rect: { x: 294, y: 288, w: 12, h: 8 },
            hitsTimer: 0 }];
        const state = { x: 300, y: 300, vx: 0, vy: 0, direction: 1 };
        const far = createStrikePolicy({
            facingToward, facingKeys: FACING_KEYS, hasSword: true,
            talkCircles: [{ id: 'sign@64,128', tag: 'sign', ex: 72, ey: 136 }],
        });
        far.decide(state, body, 10, new Set(['right']));
        expect(far.talkRefusals).toHaveLength(0);
        expect(far.trace[0].saw).toBe(1);
    });
});
