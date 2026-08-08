/**
 * shieldFight.test — THE WINDOW AND THE PAIR, REPLAYED FROM THE COMMITTED
 * TAPES.
 *
 * Region-atlas Phase 8, rung R6, slice 5. `shieldBossFight.test.js` tests
 * the transcription; this tests the CLAIM — what `r6-shield-kill` and
 * `r6-shield-control` actually do, driven through `runTape` (the same
 * entry point the 100-tape differential drives) rather than through a
 * hand-rolled loop.
 *
 * ── ⛓⛓⛓ WHAT THE PAIR CLAIMS ────────────────────────────────────────
 *
 * The two arms share ONE movement span, byte for byte, and differ in
 * exactly one primitive: the THIRD `primary` press. §12's amendment to
 * §3.2 is why that is possible here at all — the stance is a single held
 * key and the treatment is a press list, so the two really do come from
 * separate generators and deleting a press cannot delete a movement cycle
 * (which is how slice 4's first control died).
 *
 *   drive    3 presses -> 15 hit tests -> 3 landings -> `{19,0}` -> the
 *            corpse -> the removal -> the key. ZERO damage taken.
 *   control  2 presses -> 10 hit tests -> 2 landings. The third
 *            `startStab` fires on the SAME TICK, runs its chain to `"stab"`
 *            unaborted, and the stab's frames 5..8 land on a player who is
 *            still standing in the band. `{19,0}` never written.
 *
 * ⇒ the control does not show "nothing happened". It shows the DAMAGE the
 * drive's abort buys off, which is a strictly stronger statement than a
 * quiet room.
 */

import { describe, expect, it } from 'vitest';

import { runTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { R6_WINDOWS } from './r6Acceptance.js';
import { SLASH_HIT_TICKS } from './presses.js';
import {
    SHIELD_BOSS, shieldBossDeathSchedule, shieldBossWindowFor,
} from './shieldBossFight.js';

const source = atlasLevelSource();
const replay = (name) => runTape(loadTape(name), { levelSource: source });

const KILL = replay('r6-shield-kill');
const CONTROL = replay('r6-shield-control');

describe('the window — `r6-shield-kill`', () => {
    it('⛓ it is `R6_WINDOWS`\'s W-shield row, both arms', () => {
        const row = R6_WINDOWS.find((w) => w.name === 'W-shield');
        expect(row).toMatchObject({
            slice: 5, tape: 'r6-shield-kill', control: 'r6-shield-control',
        });
    });

    it('⛔ THE STANCE IS ONE HELD KEY, and it does four jobs', () => {
        const tape = loadTape('r6-shield-kill');
        const movement = tape.inputs.filter((s) => s.key !== 'primary');
        expect(movement).toHaveLength(1);
        expect(movement[0].key).toBe('up');
        expect(movement[0].from).toBe(0);
        // ⛓ Holding `up` is also what keeps `slashDirection` = 1 for every
        // latched press — §12.7's `direction` interleave, paid by geometry.
        expect(movement[0].to).toBe(tape.tick_count);
    });

    it('⛔⛔ THREE PRESSES, FIFTEEN HIT TESTS, THREE LANDINGS', () => {
        const presses = loadTape('r6-shield-kill').inputs
            .filter((s) => s.key === 'primary' && s.from < 450);
        expect(presses).toHaveLength(3);
        // Every press is one tick wide — `Input.pressed` is an edge.
        for (const p of presses) expect(p.to - p.from).toBe(1);
        expect(KILL.shieldBossHits).toHaveLength(3 * SLASH_HIT_TICKS);
        expect(KILL.shieldBossHits.filter((h) => h.landed)).toHaveLength(3);
    });

    /**
     * ⛔⛔⛔ THE FINDING THE GAME MADE, AND IT COST A RECORDING.
     *
     * The first cut of this window spent a separate ARMING press up front,
     * on the reasoning that the swallowed hit had to go somewhere. The
     * recording refuted it at tick 37: hit 1 of that press was swallowed
     * and **hit 2 of the SAME press** found him sitting, started a
     * retaliation stab, and shoved the player 50 px south.
     *
     * `slashDelayMax` is ZERO, so the test runs on every tick `slashing` is
     * up. The schedule that works absorbs the dispatch into the first
     * landing press, and the i-frame the landing sets is what shuts the
     * retaliation out of the three tests after it.
     */
    it('⛓⛓⛓ the swallowed dispatch is the FIRST PRESS\'s own first test', () => {
        const first = KILL.shieldBossHits.slice(0, SLASH_HIT_TICKS);
        expect(first[0].swallowed).toBe(true);
        expect(first[1].landed).toBe(true);
        expect(first[1].anim).toBe('movedShield');
        // ...and tests 3..5 are refused by the i-frame the landing set —
        // NOT by the animation, which is what makes the ordering matter.
        for (const h of first.slice(2)) {
            expect(h.landed).toBe(false);
            expect(h.refusedAt).toMatch(/hitsTimer/);
        }
    });

    it('⛓ every later press lands on its FIRST test, for the same reason', () => {
        const later = KILL.shieldBossHits.slice(SLASH_HIT_TICKS);
        for (let i = 0; i < later.length; i += SLASH_HIT_TICKS) {
            expect(later[i].landed, `press at ${later[i].t}`).toBe(true);
            for (const h of later.slice(i + 1, i + SLASH_HIT_TICKS)) {
                expect(h.refusedAt).toMatch(/hitsTimer/);
            }
        }
    });

    it('⛔ THREE STAND-UNDER STABS, and not one retaliation', () => {
        expect(KILL.shieldBossStabs).toHaveLength(3);
        for (const s of KILL.shieldBossStabs) expect(s.retaliation).toBe(false);
        expect(KILL.shieldBossHits.some((h) => h.retaliated)).toBe(false);
    });

    it('⛓⛓ the band counter is a 120-tick CONSECUTIVE run before every stab', () => {
        const band = KILL.shieldBossBand;
        for (const stab of KILL.shieldBossStabs) {
            const window = band.filter(
                (b) => b.t > stab.t - SHIELD_BOSS.swingTimeMax && b.t <= stab.t,
            );
            expect(window).toHaveLength(SHIELD_BOSS.swingTimeMax);
            // Every one of them occupied and sitting — except the LAST,
            // whose ledger row is written AFTER `startStab` has already
            // played `moveShield`. The row records the state the tick
            // ENDED in, which is the honest reading and is why the anim
            // check stops one short.
            for (let i = 0; i < window.length - 1; i += 1) {
                expect(window[i].inBand, `t${window[i].t}`).toBe(true);
                expect(window[i].anim, `t${window[i].t}`).toBe('sit');
            }
            expect(window[window.length - 1].anim).toBe('moveShield');
            // The last one is where the counter RESET — `swingTime = 0` is
            // written before `startStab`, so the ledger's own row is 0.
            expect(window[window.length - 1].swingTime).toBe(0);
            expect(window[window.length - 2].swingTime)
                .toBe(SHIELD_BOSS.swingTimeMax - 1);
        }
    });

    it('⛔ every landing is inside its stab\'s DERIVED window', () => {
        const landings = KILL.shieldBossHits.filter((h) => h.landed).map((h) => h.t);
        const windows = KILL.shieldBossStabs.map((s) => shieldBossWindowFor(s.t));
        expect(landings).toHaveLength(windows.length);
        for (let i = 0; i < landings.length; i += 1) {
            expect(landings[i]).toBeGreaterThanOrEqual(windows[i].windowFrom);
            expect(landings[i]).toBeLessThanOrEqual(windows[i].windowTo);
        }
    });

    it('⛔⛔⛔ THE DEATH IS FOUR INSTANTS, and they are 23, 11 and 1 apart', () => {
        const kill = KILL.shieldBossHits.find((h) => h.killed);
        const sched = shieldBossDeathSchedule(kill.t);
        const rows = Object.fromEntries(KILL.shieldBossKills.map((k) => [k.what, k.t]));
        expect(rows.tag).toBe(sched.tagTick);
        expect(rows.destroy).toBe(sched.destroyTick);
        expect(rows.removeRequested).toBe(sched.removeRequestedTick);
        expect(rows.removed).toBe(sched.removedTick);
        expect(rows.destroy - rows.tag).toBe(23);
        expect(rows.removeRequested - rows.destroy).toBe(11);
        expect(rows.removed - rows.removeRequested).toBe(1);
    });

    it('⛓⛓⛓ `{19,0}` is in the earned clears, written by `startDeath`', () => {
        expect(KILL.earnedClears).toContainEqual(
            expect.objectContaining({ level: 19, tag: 0 }),
        );
    });

    it('⛓⛓⛓ ZERO DAMAGE — and it is a claim about the STAB, not about luck', () => {
        expect(KILL.damage.hits).toBe(0);
        expect(KILL.playerHits).toEqual([]);
        // The stab NEVER reached its damaging frames on any of the three
        // cycles: `sit()` ran inside each landing, from `movedShield`.
        for (const h of KILL.shieldBossHits.filter((x) => x.landed)) {
            expect(h.anim).toBe('movedShield');
        }
    });

    it('⛓⛓ THE KEY, and only after the REMOVAL', () => {
        const took = KILL.collected.filter((c) => c.keyType === 0);
        expect(took).toHaveLength(1);
        const removed = KILL.shieldBossKills.find((k) => k.what === 'removed');
        expect(took[0].t).toBeGreaterThan(removed.t);
        // 34 ticks of wall between the kill witness and the walk.
        const tag = KILL.shieldBossKills.find((k) => k.what === 'tag');
        expect(removed.t - tag.t).toBe(35);
    });

    it('⛓ the ceremony is the keyType-0 one — 150 frozen frames and a dialogue', () => {
        const took = KILL.collected.find((c) => c.keyType === 0);
        // ⛔ `frames > 1` is the whole point: R4's `PICKUP_CEREMONY.bosskey`
        // was the TEXTLESS row, which would have resolved in ONE tick.
        // `BossKey`'s ctor gives a `text` only to keyType 0.
        expect(took.frames).toBeGreaterThan(1);
        expect(KILL.frozenFramesOwed).toBe(0);      // phase A is a lump, not ticks
    });
});

describe('the pair — `r6-shield-control`, one primitive fewer', () => {
    it('⛔ THE MOVEMENT SPANS ARE IDENTICAL, and the presses are a prefix', () => {
        const a = loadTape('r6-shield-kill');
        const c = loadTape('r6-shield-control');
        const mv = (t) => t.inputs.filter((s) => s.key !== 'primary');
        expect(mv(a)).toHaveLength(1);
        expect(mv(c)).toHaveLength(1);
        expect(mv(a)[0].key).toBe(mv(c)[0].key);
        expect(mv(a)[0].from).toBe(mv(c)[0].from);
        const pa = a.inputs.filter((s) => s.key === 'primary' && s.from < 450);
        const pc = c.inputs.filter((s) => s.key === 'primary');
        expect(pc).toEqual(pa.slice(0, 2));
        expect(c.tick_count).toBeLessThan(a.tick_count);
    });

    it('⛓ two of three land, and the boss survives at `hits` 2', () => {
        expect(CONTROL.shieldBossHits.filter((h) => h.landed)).toHaveLength(2);
        expect(CONTROL.shieldBossKills).toEqual([]);
    });

    it('⛔ …and the THIRD STAB FIRES ANYWAY, on the same tick as the drive\'s', () => {
        expect(CONTROL.shieldBossStabs.map((s) => s.t))
            .toEqual(KILL.shieldBossStabs.map((s) => s.t));
    });

    it('⛔⛔ `{19,0}` IS NEVER WRITTEN', () => {
        expect(CONTROL.earnedClears.some((c) => c.level === 19 && c.tag === 0))
            .toBe(false);
    });

    it('⛓⛓⛓ AND THE PLAYER TAKES THE HIT THE ABORT BUYS OFF', () => {
        expect(CONTROL.damage.hits).toBe(1);
        const hit = CONTROL.playerHits.find((h) => h.source === 'shieldBossStab');
        expect(hit).toBeTruthy();
        // `swingForce` 6, straight down — `knockback` is `atan2(y - p.y,
        // x - p.x)` about the boss's own point, which is directly above.
        expect(hit.knockback.dy).toBe(SHIELD_BOSS.swingForce);
        expect(hit.knockback.dx).toBe(0);
        // ⛓ §11.6: and the shake band opens by 5 and never closes.
        expect(hit.shake).toBe(5);
    });

    it('⛓ the two arms are position-identical until the deleted press lands', () => {
        const a = KILL.ticks ?? KILL.observations;
        const c = CONTROL.ticks ?? CONTROL.observations;
        let diff = -1;
        for (let i = 0; i < c.length; i += 1) {
            if (a[i].x !== c[i].x || a[i].y !== c[i].y) { diff = i; break; }
        }
        const third = KILL.shieldBossHits.filter((h) => h.landed)[2];
        expect(diff).toBeGreaterThan(third.t);
        // ⛓ …and the first difference is the CONTROL moving, not the drive:
        // the drive stands still and the control is knocked south.
        expect(c[diff].y).toBeGreaterThan(a[diff].y);
    });
});
