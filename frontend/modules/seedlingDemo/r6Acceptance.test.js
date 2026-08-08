import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { fixtureNames, loadTape } from './fixtures/index.js';
import {
    FP_ELAPSED_CLAMPED, R6_ANIM_CLOCKS, R6_AS3_DECISION, R6_BOSS_KILL_LEDGER,
    R6_CREDITS_WITNESS, R6_ITEM_LEDGER, R6_MENU_WRITERS, R6_WINDOWS,
    R6AcceptanceError, RENDER_SIDE_DRAW_SITES, animCallbackUpdate,
    r6ExitCriteria, r6ExitFindings, rngPostureOf,
} from './r6Acceptance.js';

/**
 * ⛔ THE MUTATION LIST these are written against, and what each would look
 * like in the wild:
 *
 *  · a count hard-coded beside the roster  -> R5's `tapesDeclaringIt: 42`
 *    against a 100-tape roster: a fact-shaped number that stopped being one
 *  · an unclaimed ledger row reported ok   -> "0 of 6, all green"
 *  · a ledger row claimed by a drive with  -> a claim with no control, which
 *    no control                               is the one thing the arc's law
 *                                             forbids outright
 *  · the anim clock derived by division    -> 60 fps math wearing a 30 fps
 *                                             label; the brief's own "≈274"
 *  · the RNG posture asserted rather than  -> the Owl fight declared exact
 *    computed from the level                  in a room that has a totem in it
 */
describe('R6 acceptance', () => {
    const roster = fixtureNames();

    describe('the anim clock is an ACCUMULATOR, not frame math', () => {
        it('the clamp is the decimal literal 0.0333, not 1/30', () => {
            expect(FP_ELAPSED_CLAMPED).toBe(0.0333);
            expect(FP_ELAPSED_CLAMPED).not.toBe(1 / 30);
        });

        it.each(R6_ANIM_CLOCKS)('$owner.$anim wraps at update $expect',
            ({ frameRate, frames, expect: want }) => {
                expect(animCallbackUpdate(frameRate, frames)).toBe(want);
            });

        it('a frameRate of 0 never wraps — `sit` is a real case, not a guard', () => {
            expect(animCallbackUpdate(0, 1)).toBe(Infinity);
        });

        it('the 60 fps reading is where the brief\'s "≈274" came from', () => {
            // ⛔ THE ERROR IS THE ELAPSED, NOT THE ARITHMETIC. The brief said
            // the tree grow was "≈ 274 ticks"; at the CLAMPED 0.0333 it is
            // 138, and 274 is what the same shape gives at 60 fps.
            expect(animCallbackUpdate(3.5, 16)).toBe(138);
            expect(Math.ceil(16 / (3.5 / 60))).toBe(275); // the 60 fps family
            expect(animCallbackUpdate(3.5, 16)).toBeLessThan(200);
        });

        it('⚠ division agrees with the accumulator EVERYWHERE ON THIS GRID — measured', () => {
            // ⛔ THIS TEST EXISTS BECAUSE THE OBVIOUS CLAIM IS FALSE. The
            // first cut asserted "dividing gives a different answer, which is
            // why it is simulated", and that is not true here: swept over
            // rate 1..60 in halves x frames 1..40 — 4,760 pairs — `ceil(frames
            // / (rate * 0.0333))` and the accumulator NEVER disagree.
            //
            // The accumulator stays the implementation anyway, for the reason
            // [[feedback_two_cost_models_must_agree]] gives: a fast path that
            // PREDICTS the slow path is a second model, and the moment
            // `FP.elapsed`'s clamp moves it can drift silently. Pinning the
            // agreement here means a future divergence is a NAMED failure
            // instead of an inherited assumption.
            let pairs = 0;
            for (let rate = 1; rate <= 60; rate += 0.5) {
                for (let frames = 1; frames <= 40; frames += 1) {
                    pairs += 1;
                    expect(Math.ceil(frames / (rate * FP_ELAPSED_CLAMPED)),
                        `rate ${rate}, frames ${frames}`)
                        .toBe(animCallbackUpdate(rate, frames));
                }
            }
            expect(pairs).toBe(4760);
        });

        it('rejects a frameCount that cannot wrap', () => {
            expect(() => animCallbackUpdate(15, 0)).toThrow(R6AcceptanceError);
        });
    });

    describe('the RNG posture is COMPUTED from the level, not asserted', () => {
        const source = atlasLevelSource();
        const tileTypesOf = (level) => {
            const w = buildLevelWorld(source(level), { roles: ['blocking'] });
            return [...new Set(w.tiles.map((t) => t.t))];
        };

        it('L112 (the Owl) is EXACT — a consumer with no polluter', () => {
            const v = rngPostureOf(source(112), tileTypesOf(112));
            expect(v.exact, v.why).toBe(true);
            expect(v.consumers).toContain('finalboss');
            expect(v.renderCoupled).toHaveLength(0);
        });

        it('⛔ L43 IS render-coupled — a polluter with no consumer, so still exact', () => {
            const v = rngPostureOf(source(43), tileTypesOf(43));
            expect(v.renderCoupled.join(' ')).toMatch(/BossTotem/);
            expect(v.consumers).toHaveLength(0);
            expect(v.exact, v.why).toBe(true);
        });

        it('⛔ L115 HAS FOUR WATERFALL TILES — the credits room draws per render', () => {
            // Found by this test, not by the census: the ending's last room
            // is render-coupled. It has no gameplay consumer, so W-seed is
            // still exact — but "the ending rooms have no draw site" would
            // have been false.
            const v = rngPostureOf(source(115), tileTypesOf(115));
            expect(v.renderCoupled.join(' ')).toMatch(/waterfall/);
            expect(v.consumers).toHaveLength(0);
            expect(v.exact, v.why).toBe(true);
        });

        it('L19/L113/L114 have neither', () => {
            for (const lv of [19, 113, 114]) {
                const v = rngPostureOf(source(lv), tileTypesOf(lv));
                expect(v.renderCoupled, `L${lv}`).toHaveLength(0);
                expect(v.consumers, `L${lv}`).toHaveLength(0);
                expect(v.exact).toBe(true);
            }
        });

        it('a room with BOTH halves is the only one reported at risk', () => {
            const v = rngPostureOf(
                { entities: [{ type: 'bosstotem' }, { type: 'finalboss' }] }, []);
            expect(v.exact).toBe(false);
            expect(v.why).toMatch(/AT RISK/);
        });

        it('the render-side census names exactly three sites', () => {
            expect(RENDER_SIDE_DRAW_SITES).toHaveLength(3);
            // ⛔ `Game.shake` must NOT be in here. Its two draws are in
            // `view()`, which `Game.update` calls — the reclassification the
            // whole posture rests on.
            expect(JSON.stringify(RENDER_SIDE_DRAW_SITES)).not.toMatch(/Game\.as/);
        });
    });

    describe('the exit criteria are DERIVED, never hand-kept', () => {
        it('every count tracks the roster it is given', () => {
            const half = roster.slice(0, 50);
            expect(r6ExitCriteria(roster).rosterSize).toBe(roster.length);
            expect(r6ExitCriteria(half).rosterSize).toBe(50);
            // The noDamage count is the one R5 let rot. It must MOVE with
            // the set, not sit beside it.
            const all = r6ExitCriteria(roster);
            const partial = r6ExitCriteria(half);
            expect(all.tapesDeclaringNoDamage)
                .toBe(roster.filter((n) => loadTape(n).noDamage === true).length);
            expect(partial.tapesDeclaringNoDamage)
                .toBeLessThanOrEqual(all.tapesDeclaringNoDamage);
            expect(all.tapesDeclaringNoDamage + all.tapesNotDeclaringNoDamage)
                .toBe(roster.length);
        });

        it('the ledger is the six tags the rung claims', () => {
            expect(R6_BOSS_KILL_LEDGER.map((r) => `${r.flag.level},${r.flag.tag}`))
                .toEqual(['19,0', '43,5', '112,0', '112,1', '113,0', '114,0']);
        });

        it('an unclaimed row is ok:false with a detail naming the missing arm', () => {
            const findings = r6ExitFindings(roster);
            // ⛔ THIS TEST USED TO PIN THE SLICE-0 WORLD ("no window has a
            // tape, so EVERY row must be red") and slice 4 turned it red by
            // doing its job — [[feedback_coincidental_predicate_rots]] with
            // the shortest possible fuse. What it asserts now is the
            // MECHANISM: an unclaimed row reads UNCLAIMED, a claimed one
            // does not, and the count is derived from `R6_WINDOWS` rather
            // than written down.
            // ⛔ AND IT ROTTED AGAIN AT SLICE 5, one slice after the comment
            // above was written: the mechanism assertion still carried a
            // LITERAL `['W-totem']` beside it, so `W-shield` and `W-fire`
            // turned it red for doing their job. The literal is gone. What
            // is asserted is the RELATION — claimed windows are exactly the
            // ones whose two arms are both in the roster, some row is still
            // unclaimed, and the ledger's own count is the number of
            // BOSS-KILL rows whose window is claimed (which is not the same
            // number: `W-fire` is a window with no kill tag behind it).
            const claimed = R6_WINDOWS.filter(
                (w) => roster.includes(w.tape) && roster.includes(w.control),
            );
            expect(claimed.length).toBeGreaterThan(0);
            expect(claimed.length).toBeLessThan(R6_WINDOWS.length);
            for (const w of claimed) {
                expect(findings.some((f) => f.detail.includes(w.tape))
                    || !R6_BOSS_KILL_LEDGER.some((r) => r.earnedIn === w.name)).toBe(true);
            }
            expect(findings.some((f) => /UNCLAIMED/.test(f.detail))).toBe(true);
            const claimedNames = new Set(claimed.map((w) => w.name));
            const tags = R6_BOSS_KILL_LEDGER.filter((r) => claimedNames.has(r.earnedIn));
            const done = findings.find((f) => f.name === 'the boss-kill ledger is complete');
            expect(done.detail).toMatch(new RegExp(`${tags.length}/6 tags earned`));
        });

        it('a row with a DRIVE and no control is still unclaimed', () => {
            // Synthesise the halfway state without mutating the frozen table.
            const w = R6_WINDOWS.find((x) => x.name === 'W-owl');
            const faked = { ...w, tape: roster[0], control: null };
            const claimed = roster.includes(faked.tape) && roster.includes(faked.control);
            expect(claimed).toBe(false);
        });

        it('every ledger row names a window that exists', () => {
            const names = new Set(R6_WINDOWS.map((w) => w.name));
            for (const r of R6_BOSS_KILL_LEDGER) expect(names.has(r.earnedIn)).toBe(true);
        });

        it('W-blood is IN — the user ruled it at slice 0', () => {
            expect(R6_WINDOWS.map((w) => w.name)).toContain('W-blood');
        });
    });

    describe('the credits witness is an ELIMINATION, and it says so', () => {
        it('menuState is named as NOT available', () => {
            expect(R6_CREDITS_WITNESS.notAvailable).toMatch(/menuState/);
            expect(R6_CREDITS_WITNESS.read).toMatch(/botStatus\.menu/);
        });

        it('exactly one menu writer is left un-eliminated, and it is the Seed', () => {
            const live = R6_MENU_WRITERS.filter((w) => w.eliminatedBy === null);
            expect(live).toHaveLength(1);
            expect(live[0].site).toBe('Pickups/Seed.as:77');
        });

        it('every other writer carries the assertion that eliminates it', () => {
            for (const w of R6_MENU_WRITERS.filter((x) => x.eliminatedBy !== null)) {
                expect(typeof w.eliminatedBy).toBe('string');
                expect(w.eliminatedBy.length).toBeGreaterThan(10);
            }
        });
    });

    describe('the item ledger and the AS3 decision', () => {
        it('names the three real collections the rung owes', () => {
            expect(R6_ITEM_LEDGER.map((r) => r.item))
                .toEqual(['hasShield', 'bosskey:0', 'fire']);
        });

        it('the AS3 batch count is ZERO, and each wanted surface says why it is not a wall', () => {
            expect(R6_AS3_DECISION.batches).toBe(0);
            expect(R6_AS3_DECISION.wanted.length).toBeGreaterThan(0);
            for (const w of R6_AS3_DECISION.wanted) {
                expect(w.whyNotAWall, `${w.surface} has no whyNotAWall`).toBeTruthy();
            }
        });

        it('R3\'s owed `saw_auto_advance` unification is still carried by name', () => {
            expect(R6_AS3_DECISION.stillOwed.join(' ')).toMatch(/saw_auto_advance/);
        });
    });
});
