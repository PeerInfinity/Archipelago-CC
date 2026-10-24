/**
 * `totemFight.test.js` — W-TOTEM, DRIVEN, AND THE NINE-FOR-TEN PAIR.
 *
 * R6 slice 4's window. Not a recording and not a unit stratum: this replays
 * the two COMMITTED tapes through the shipped `runTape` and asserts the
 * fight the plan claims. `bossTotemFight.test.js` owns the arithmetic; this
 * owns the claim.
 *
 * ⛔⛔ IT REPLAYS THE TAPES, IT DOES NOT REBUILD THEM. A test that
 * re-derived the spans would be checking the planner against itself, and
 * the spans are what the GAME is given — so the fixtures are the input here
 * exactly as they are for the differential.
 * [[feedback_record_run_is_a_self_comparison]]
 *
 * ── THE WINDOW, IN ONE PARAGRAPH ─────────────────────────────────────
 *
 * Boot L43's SOUTH chamber (the unwoken boss is an 80x32 `"Solid"` across
 * the whole arena, so a north boot cannot reach the wand at all), present
 * the five totem parts through the v6 save block, collect `wand@144,224`
 * through its 99-frame approach fade + 150-frame `specialTimer` + two-page
 * dialogue, and the tset-0 publish drops three fallrocks and takes
 * `classCount(Wand)` to 0 — the wake edge. 148 model ticks later the
 * machine walks, and the fight is ten wand shots at a 22-tick cadence from
 * a stance that stands west of the laser's fixed band and TRACKS the
 * 0.75 px/tick descent.
 *
 * ── ⛔⛔⛔ THE PAIR'S CONTROL IS NOT A DELETION OF THE LAST CYCLE ──────
 *
 * The first cut of `r6-totem-control` deleted the tenth press AND the
 * movement cycle it sat in, because the generator emitted them together.
 * The stance stopped tracking at tick 404, the offset fell through 46, and
 * the BODY killed the player at 467. That control would have "proved" the
 * tenth shot by dying without it — for a reason that has nothing to do with
 * the tenth shot. The movement spans are byte-identical in both arms and
 * outlast the presses by two cycles, and that is the whole shape of the
 * pair. [[feedback_pair_arms_share_the_input]]
 */

import { describe, expect, it } from 'vitest';

import { BOSS_TOTEM_DEATH_BLAST, BOSS_TOTEM_KILL } from './bossTotemFight.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const replay = (name) => runTape(loadTape(name), { levelSource });

const kill = replay('r6-totem-kill');
const control = replay('r6-totem-control');

/**
 * The offset the whole plan is about, per tick — `playerY - bossY`, measured
 * off the replay rather than declared. `null` on every tick before the wake.
 */
function offsets(name) {
    const out = [];
    // ⛔ THROUGH `runTape`'s `onTick`, not through `createTapeStepper`: the
    // stepper is TOOLING (its own docblock says a consumer that stops early
    // skips the end-of-loop checks), and this is a claim.
    runTape(loadTape(name), {
        levelSource,
        onTick: (t, state, held, run) => {
            const b = run?.bossesWoken?.[0];
            if (b) out.push({ t, D: state.y - b.y, x: state.x, boss: b });
        },
    });
    return out;
}
const killD = offsets('r6-totem-kill');

describe('the two arms differ by ONE primitive and nothing else', () => {
    it('every movement span is byte-identical', () => {
        const moves = (t) => t.inputs.filter((s) => s.key !== 'primary');
        expect(moves(loadTape('r6-totem-control')))
            .toEqual(moves(loadTape('r6-totem-kill')));
    });

    it('…and the presses differ by exactly the TENTH', () => {
        const presses = (t) => t.inputs.filter((s) => s.key === 'primary').map((s) => s.from);
        const k = presses(loadTape('r6-totem-kill'));
        const c = presses(loadTape('r6-totem-control'));
        // Five of them are the wand ceremony's dialogue releases; ten are
        // the schedule. The control drops the last one and keeps the rest.
        expect(k).toHaveLength(15);
        expect(c).toEqual(k.slice(0, 14));
        expect(k[14] - k[13]).toBe(22);
    });

    it('⛓ and the tracking cycles OUTLAST the presses on both arms', () => {
        // Two cycles past the tenth press — the reason the control does not
        // die of its own missing treatment.
        const downs = loadTape('r6-totem-control').inputs
            .filter((s) => s.key === 'down').map((s) => s.from);
        expect(downs).toHaveLength(12);
        expect(Math.max(...downs)).toBeGreaterThan(
            Math.max(...loadTape('r6-totem-control').inputs
                .filter((s) => s.key === 'primary').map((s) => s.from)),
        );
    });
});

describe('the kill arm', () => {
    it('wakes the boss and reaches the walk', () => {
        expect(kill.bossWalks).toEqual([
            { t: 212, level: 43, id: 'bosstotem@152,168' },
        ]);
    });

    it('⛓⛓⛓ lands TEN shots, every one of them clearing the 20-tick timer', () => {
        expect(kill.bossHits).toHaveLength(BOSS_TOTEM_KILL.shots);
        expect(kill.bossHits.every((h) => h.landed)).toBe(true);
        expect(kill.bossHits.map((h) => h.t))
            .toEqual([221, 244, 265, 287, 309, 331, 353, 377, 398, 419]);
        // ⛔ THE GAPS ARE THE CLAIM, not the count: the boss's own
        // `hitsTimer` is 20 and a shot that lands at 19 pays nothing.
        const gaps = kill.bossHits.slice(1).map((h, i) => h.t - kill.bossHits[i].t);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(BOSS_TOTEM_KILL.cadence);
        // 0.5 damage each, against `hitsMax` 5.
        expect(kill.bossHits.map((h) => h.hits))
            .toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    });

    it('⛓ the TENTH is the kill, and the ninth is not', () => {
        expect(kill.bossHits[8].killed).toBe(false);
        expect(kill.bossHits[9].killed).toBe(true);
        expect(kill.bossKills).toHaveLength(1);
        expect(kill.bossKills[0]).toMatchObject({
            level: 43, id: 'bosstotem@152,168', killTick: 419,
        });
    });

    it('⛔⛔ …and `{43,5}` lands 241 ticks LATER, not on the kill', () => {
        // 240 white-out RENDERS, then one `updateLists()`: `render()` asks
        // for the removal and `Engine.update` drains `_remove` on the next
        // frame. A ledger that read the kill tick as the flag tick would be
        // 241 ticks early.
        const k = kill.bossKills[0];
        expect(k.whiteOutRenders).toBe(240);
        expect(k.tagTick).toBe(660);
        expect(k.tagTick - k.killTick).toBe(241);
        expect(k.flag).toEqual({ level: 43, tag: 5 });
    });

    it('⛓⛓⛓ THE LEDGER GAINS ITS FIRST REAL ROW — an earned CLEAR', () => {
        // `removed()` runs `Game.setPersistence(tag, false)`, so a kill is a
        // CLEAR like a broken rock's. The polarity is the MagicalLock's
        // (§10.8) and the opposite of what "a kill sets a flag" suggests —
        // which is why the row belongs in `earnedClears` and not in a
        // ledger of its own.
        // ⛓ R7 slice 6: and a SECOND row, from the same walk and a different
        // mechanism — `Wand.removed()`'s own `Game.setPersistence(tag,
        // false)` (R6 debt 2, paid). The two are deliberately separate
        // families in `earnedClears`: the totem's row is a KILL that opened
        // a wall, the wand's is a PICKUP that stopped an item respawning,
        // and "which openers did this walk use" has to tell them apart.
        expect(kill.earnedClears.map((c) => [c.level, c.tag, c.by])).toEqual([
            [43, 5, 'bosstotem@152,168'],
            [43, 0, 'wand@144,224'],
        ]);
    });

    it('⛔ the laser FIRES and MISSES — which is the exactness claim', () => {
        expect(kill.bossLasers).toHaveLength(1);
        expect(kill.bossLasers[0]).toMatchObject({ t: 315, hitCalls: 0 });
        // ⛓⛓ AND THE SHAKE LANDED ANYWAY, which is §11.6's whole point:
        // `Game.shake = 30` is written beside the rect test and OUTSIDE it.
        // ⚠ The terminal `shake` is 0 — it decays one per engine frame and
        // the tape runs 120 ticks past `removed()`'s `= 60`. A window that
        // read the END value as evidence would conclude the room never
        // shook at all; the evidence is the WRITE, not the residue.
        expect(kill.shake).toBe(0);
        expect(kill.bossLasers[0].rects).toHaveLength(2);
        expect(kill.bossLasers[0].rects.map((r) => [r.x, r.right]))
            .toEqual([[135, 153], [151, 169]]);
    });

    it('⛓ the attack publishes two shots, and the stance is ABOVE both', () => {
        expect(kill.bossShotsFired).toHaveLength(2);
        expect(kill.bossShotsFired.map((s) => s.x)).toEqual([182, 122]);
        // Both explode at the room bottom and neither reaches the player.
        const shotBlasts = kill.bossBlasts.filter((b) => b.source === 'bossShotBlast');
        expect(shotBlasts).toHaveLength(2);
        expect(shotBlasts.every((b) => !b.hitPlayer && !b.inSquare)).toBe(true);
    });

    it('⛔⛔ the death blast MISSES, and the margin is stated', () => {
        const blast = kill.bossBlasts.find((b) => b.source === 'bossDeathBlast');
        expect(blast).toMatchObject({ radius: BOSS_TOTEM_DEATH_BLAST.radius, hitPlayer: false });
        // The disc is about the point he DIED at, which the descent moved:
        // y 268.8, not the spawn's 168.
        expect(blast.y).toBeCloseTo(268.8, 5);
        // ⛓ AND `added()` IS ONE TICK LATE — the disc is tested against
        // where the player ENDED the kill tick.
        expect(blast.t).toBe(kill.bossKills[0].killTick + 2);
    });

    it('⛓⛓⛓ THE PLAYER TAKES NOTHING — 780 ticks, `noDamage` OFF', () => {
        expect(loadTape('r6-totem-kill').noDamage).toBe(false);
        expect(kill.playerHits).toEqual([]);
        expect(kill.playerDeaths).toEqual([]);
        expect(kill.damage.hits).toBe(0);
    });

    it('…and it ends at rest, having never left L43', () => {
        expect(kill.transitions).toEqual([]);
        expect(kill.final.vx).toBeCloseTo(0, 6);
        expect(kill.final.vy).toBeCloseTo(0, 6);
    });
});

describe('the control arm — nine shots for ten', () => {
    it('lands NINE, and the boss survives at 4.5 of 5', () => {
        expect(control.bossHits).toHaveLength(BOSS_TOTEM_KILL.shots - 1);
        expect(control.bossHits.every((h) => h.landed)).toBe(true);
        expect(control.bossHits[8].hits).toBe(4.5);
        expect(control.bossHits.every((h) => !h.killed)).toBe(true);
    });

    it('⛓⛓ and the nine are the kill arm\'s OWN first nine, tick for tick', () => {
        expect(control.bossHits.map((h) => [h.t, h.hits]))
            .toEqual(kill.bossHits.slice(0, 9).map((h) => [h.t, h.hits]));
    });

    it('⛔⛔⛔ `{43,5}` is NEVER cleared — no kill, no blast, no white-out', () => {
        expect(control.bossKills).toEqual([]);
        expect(control.bossBlasts.some((b) => b.source === 'bossDeathBlast')).toBe(false);
        // ⛓ THE FLAG, ASSERTED SHUT — the arm's whole point. The kill arm's
        // own ledger carries the row and this one carries nothing.
        expect(control.earnedClears.some((c) => c.level === 43 && c.tag === 5))
            .toBe(false);
    });

    it('⛔ the player survives THIS arm too — the control is not a death', () => {
        expect(control.playerHits).toEqual([]);
        expect(control.playerDeaths).toEqual([]);
    });

    it('⛓ the boss is still walking when the tape stops', () => {
        expect(control.transitions).toEqual([]);
        expect(control.bossWalks).toEqual(kill.bossWalks);
    });
});

describe('the stance, measured rather than declared', () => {
    it('⛔⛔⛔ THE CLAMP NEVER FIRES, and that is the PLAN and not a vacuity', () => {
        // §11.7's law says a readout asserted without a tape that makes it
        // non-zero is a green vacuity. This one is empty ON PURPOSE and the
        // measurement below is what makes the emptiness a CLAIM: the stance
        // stays AHEAD of the descending floor for every tick of the fight,
        // so `if (p.y < y + 44)` is never true. The clamp is witnessed by
        // R5's own wand window, which stands still and takes it.
        expect(kill.bossClamps).toEqual([]);
        expect(Math.min(...killD.map((r) => r.D))).toBeGreaterThan(44);
        expect(control.bossClamps).toEqual([]);
    });

    it('⛓⛓⛓ the offset stays inside the corridor the plan derived', () => {
        const Ds = killD.filter((r) => r.t >= kill.bossWalks[0].t).map((r) => r.D);
        // >= 46 clears the 80x32 body (a 4x5 player box at origin (2,2)
        // against `[y+12, y+44)`); < 110 keeps the boss inside the wand's
        // 16 px spawn plus 48 px of flight. The plan's own margins.
        expect(Math.min(...Ds)).toBeCloseTo(48.55, 2);
        expect(Math.max(...Ds)).toBeCloseTo(97.6, 2);
        expect(Math.min(...Ds)).toBeGreaterThanOrEqual(46);
        expect(Math.max(...Ds)).toBeLessThan(110);
    });

    it('⛓⛓ the stance never enters the laser band, and never leaves the arena', () => {
        // ⚠ FROM THE WALK ON. Before it the player is still walking west
        // out of the band, and 21 distinct columns is what that looks like
        // — a set taken over the whole run would measure the shuffle.
        const held = killD.filter((r) => r.t >= kill.bossWalks[0].t);
        const xs = held.map((r) => r.x);
        expect(new Set(xs).size).toBe(1);          // it holds ONE column
        const px = xs[0];
        expect(px).toBeCloseTo(131.5, 5);
        expect(px + 2).toBeLessThanOrEqual(135);   // west of [135, 169)
        expect(px - 2).toBeGreaterThanOrEqual(112);
        // ⛓ …and the shuffle itself never crosses into the band either.
        expect(Math.max(...killD.map((r) => r.x)) + 2).toBeLessThanOrEqual(155);
    });

    it('⛔ the body is COLLIDABLE for most of the fight — the stance is the guard', () => {
        // Not a vacuity either way: if `collidable` were false throughout,
        // "the player took nothing" would be a claim about a boss who could
        // not have hit them.
        const live = killD.filter((r) => r.t <= 419 && r.boss.collidable);
        expect(live.length).toBeGreaterThan(150);
    });

    it('⛓ no shot\'s cull was ever a band question on either arm', () => {
        // ⚠ AN EMPTY LIST IS THE WEAKER RESULT and it is stated as such: it
        // means the stance never put a shot near the screen edge while the
        // shake band was open, not that the band cannot bite. The refusal
        // that would fire if it did is in `levelRun`, with its own message.
        expect(kill.bossShotCullBand).toEqual([]);
        expect(control.bossShotCullBand).toEqual([]);
    });
});
