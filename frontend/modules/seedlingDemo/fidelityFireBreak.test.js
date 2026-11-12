/**
 * Seedling fidelity FIREBREAK (wave 40): the solver's `break` verb takes FIRE for a run that holds Fire and no Sword,
 * behind `CONTACT_FIDELITY.fireBreakArm` (OFF).
 *
 *   · W0: the game breaks an ordinary rock under a Fire press (`fireRockArm`, ROCKFIRE, witnessed) and the run steps
 *     it; `resolveBreakStrategy` refused every run whose selected slot was not the Sword or a modelled Ghost Sword.
 *   · D1 (the verb): `fireBreakAdmits` / `resolveFireBreak` / `execFireBreak` — the rock's own test first, a stance
 *     whose flame reaches the rock and nothing else, the Fire's slot selected and restored, one press, the leg's wait.
 *   · D2 (the game): `fixtures/firebreak-witness/` (`probe-seedling-fire-break.mjs --record`, p4g) — the solver's own
 *     plans played on the game, replayed here against the model at 0 px.
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   m1 `fireBreakAdmits` drops `!inv.hasSword` (Fire is admitted with the Sword held)
 *        -> "with the Sword held … ON plans what OFF plans" reds (a Fire order where the swing was).
 *   m2 `rockFireReach` reports no `others` (the stray rule dropped)
 *        -> "L40 … every stance also reaches a second rock" reds: the verb presses at three rocks at once.
 *   m3 `FIRE_BREAK_WAIT_TICKS` = `WAIT_AFTER_PRESS_TICKS` (the flame's later first test forgotten)
 *        -> the clock row reds (23), and the L0 rows' plan lengths with it.
 *   m4 `resolveFireBreak` skips `rockBreaksUnder`
 *        -> "a ghost rock … refused by name" reds: the press lands, does nothing, and the refusal is about a rock
 *           "NOT in the run's `brokenRocks`", not about the Ghost Sword.
 *   m5 `execFireBreak` does not restore the slot
 *        -> "the Wand selected and Fire held" reds: one equip, the wand's slot never selected again.
 *   m6 `fireBreakAdmits` ungated (`!CONTACT_FIDELITY.fireBreakArm` dropped)
 *        -> the OFF rows red (SOLVED where the sword refusal was).
 *   m8 `execFireBreak` skips its fork certificate
 *        -> "L73 … refused NAMING it" reds: SOLVED, with the bulb's hit at t115.
 *   m9 `rockHypothesis` does not admit a Fire run (`if (!swings) return [];`)
 *        -> "L53 … the prerequisite order" reds: "no REACHABLE stance for a Fire press at breakablerock@128,160".
 *   m10 `rockHypothesis` drops its clean-cell guard (`fireBreakStances(…).viable.length === 0`)
 *        -> "the hypothesis admits a rock … only where a flame can reach it alone" reds: L41's two are admitted.
 *   m7 `execBreak` loses its Fire dispatch (a Fire order runs the swing's aim-and-press loop)
 *        -> every ON SOLVED row reds.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity }
    from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { FIRE_BREAK_WAIT_TICKS, solveSegment, SolverRefusal, stanceHypothesisProbe } from './solverBot.js';
import { WAIT_AFTER_PRESS_TICKS } from './breakableRocks.js';
import { FIRE_WINDOW } from './fireVerb.js';
import { FIREBREAK_RULES_WITNESSES, FIREBREAK_WITNESS_DIR, FIREBREAK_WITNESSES, compareFireBreak, fireBreakModelSamples, fireBreakPlan }
    from './fidelityFireBreak.js';

const SRC = atlasLevelSource();
const rock = (level, tag, x, y, type = 'breakablerock') => Object.freeze({ kind: 'clear-tag', tag: { level, tag },
    at: { x, y }, obstacle: `${type}@${x},${y}` });
const L0_WEST = rock(0, 4, 80, 112);
const FROM_L13 = Object.freeze({ level: 0, x: 48, y: 192 });

const solve = (boot, goals, items) => {
    const run = createRunForStaging(arrivalStaging(boot, { items }), SRC);
    try {
        // `forkRun`: the segment's fork, as `twoPassSolve` and the JS worker hand one (the Fire break's certificate)
        return { run, out: solveSegment({ run, goals: goals.map((g) => ({ ...g })), name: `firebreak-${boot.level}`, boot,
            forkRun: () => createRunForStaging(arrivalStaging(boot, { items }), SRC) }), refusal: null };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e };
    }
};
const ON = (fn) => withContactFidelity({ fireBreakArm: true }, fn);
const OFF = (fn) => withContactFidelity({ fireBreakArm: false }, fn);
const breakRow = (out) => out.records.find((r) => r.strategy === 'break');
const keysOf = (out) => out.perTick.map((h) => [...h].join('+'));
const hitsOf = (run) => (run.ledger('playerHits') ?? []).length;

describe('fidelity FIREBREAK — the key', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FIRE_BREAK_ARM)(
        'ships ON (⚖ user 2026-11-11, the FIREBREAK flip), followed in the defaults only by FENCEPOST\'s key; its env name is a known worker env name', () => {
            expect(CONTACT_FIDELITY_KEYS).toContain('fireBreakArm');
            expect(CONTACT_FIDELITY_DEFAULTS.fireBreakArm).toBe(true);
            expect(CONTACT_FIDELITY.fireBreakArm).toBe(true);
            // ⛓ wave 40: FENCEPOST `spinnerRemoveRead` landed after it.
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf('fireBreakArm') + 1)).toEqual(['spinnerRemoveRead']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FIRE_BREAK_ARM');
        });
    it('the clock: the sword\'s wait moved by the flame\'s later first test (press + 4 against press + 1)', () => {
        expect(FIRE_WINDOW.firstHitTick).toBe(4);
        expect(FIRE_BREAK_WAIT_TICKS).toBe(WAIT_AFTER_PRESS_TICKS + FIRE_WINDOW.firstHitTick - 1);
        expect(FIRE_BREAK_WAIT_TICKS).toBe(23);
        // a second press inside the open fire window is a silent no-op: the wait outlasts it
        expect(FIRE_BREAK_WAIT_TICKS).toBeGreaterThan(FIRE_WINDOW.endTick);
    });
});

describe('fidelity FIREBREAK — OFF is the sword refusal, and the Sword keeps its path', () => {
    it('OFF: Fire alone refuses `cannot-act`, naming the sword (byte-identical)', () => OFF(() => {
        const { refusal } = solve(FROM_L13, [L0_WEST], ['hasFire']);
        expect(refusal.obstacle).toMatchObject({ kind: 'clear-tag', id: 'breakablerock@80,112', reason: 'cannot-act' });
        expect(refusal.message).toMatch(/fires `fire`, and only the plain SWORD breaks a rock in this model/);
    }));
    it.each([['selected alone', ['hasSword']], ['held with Fire', ['hasSword', 'hasFire']]])(
        'with the Sword %s, ON plans what OFF plans, tick for tick (a swing)', (_, items) => {
            const off = OFF(() => solve(FROM_L13, [L0_WEST], items));
            const on = ON(() => solve(FROM_L13, [L0_WEST], items));
            expect(on.out).not.toBeNull();
            expect(keysOf(on.out)).toEqual(keysOf(off.out));
            expect(breakRow(on.out)).toEqual(breakRow(off.out));
            expect(breakRow(on.out).weapon).toBeUndefined();
        });
    it('a Ghost Sword held WITHOUT the Sword is not admitted: ON refuses in `ghostSwingRefusal`\'s words, as OFF', () => {
        const off = OFF(() => solve(FROM_L13, [L0_WEST], ['hasGhostSword', 'hasFire']));
        const on = ON(() => solve(FROM_L13, [L0_WEST], ['hasGhostSword', 'hasFire']));
        expect(on.refusal.message).toBe(off.refusal.message);
        expect(on.refusal.message).toMatch(/holds the GHOST SWORD and not the sword/);
    });
    it('no Fire, no Sword: ON refuses what OFF refuses (nothing to press)', () => {
        const off = OFF(() => solve(FROM_L13, [L0_WEST], ['hasSpear']));
        const on = ON(() => solve(FROM_L13, [L0_WEST], ['hasSpear']));
        expect(on.refusal.message).toBe(off.refusal.message);
    });
});

describe('fidelity FIREBREAK — D1: the `break` verb with Fire and no Sword (the switch ON)', () => {
    it('L0 `breakablerock@80,112` from the L13 landing: stance (72,136), press t85, hit t89, gone t96, 108 t, no hit',
        () => ON(() => {
            const { run, out } = solve(FROM_L13, [L0_WEST], ['hasFire']);
            expect(breakRow(out)).toMatchObject({ verb: 'break', target: 'breakablerock@80,112', weapon: 'fire',
                stance: { x: 72, y: 136 }, lean: null, pressedAt: 85, ticks: FIRE_BREAK_WAIT_TICKS });
            expect(out.perTick.length).toBe(108);
            // ONE press, and nothing held for the wait
            expect(keysOf(out).filter((k) => k.includes('primary'))).toEqual(['primary']);
            expect(keysOf(out).slice(86)).toEqual(Array.from({ length: 22 }, () => ''));
            expect(run.rocksBroken).toMatchObject([{ id: 'breakablerock@80,112', hitTick: 89, goneAt: 96, tag: 4 }]);
            expect([...run.entities('brokenRocks')]).toEqual(['breakablerock@80,112']);
            expect(hitsOf(run)).toBe(0);
        }));
    it('the press is a Fire press whose flame reaches that rock alone: five hit ticks, the first breaking', () => ON(() => {
        const { run } = solve(FROM_L13, [L0_WEST], ['hasFire']);
        const fire = run.presses.filter((p) => p.weapon === 'fire');
        expect(fire.map((p) => p.fired)).toEqual([89, 90, 91, 92, 93]);
        expect(fire.map((p) => p.hits.map((h) => [h.as3, h.id, h.broke]))).toEqual([
            [['BreakableRock', 'breakablerock@80,112', true]], [['BreakableRock', 'breakablerock@80,112', false]],
            [['BreakableRock', 'breakablerock@80,112', false]], [['BreakableRock', 'breakablerock@80,112', false]],
            [['BreakableRock', 'breakablerock@80,112', false]]]);
    }));
    it('the Wand selected and Fire held: the plan selects the Fire\'s slot for the press and restores the wand\'s',
        async () => {
            const w = FIREBREAK_WITNESSES.find((x) => x.name === 'firebreak-l0-wand-fire');
            const { solved, tape } = await fireBreakPlan(w);
            const row = breakRow(solved.out);
            expect(row).toMatchObject({ weapon: 'fire', target: 'breakablerock@288,176', restoredSlot: 1 });
            expect(tape.equips).toEqual([{ t: 0, slot: 1 }, { t: row.pressedAt, slot: 0 },
                { t: row.pressedAt + FIRE_BREAK_WAIT_TICKS, slot: 1 }]);
        });
    it('L3\'s pocket from the L11 landing: OFF the latched door is `closed`; ON the rock breaks FROM the door (the '
        + 'step-off\'s `break`, press t0) and the run crosses to L11 in 36 t, no hit', () => {
        const POCKET = { level: 3, x: 96, y: 128 };
        const EXIT = { kind: 'reach-exit', exit: { x: 96, y: 128 } };
        const off = OFF(() => solve(POCKET, [EXIT], ['hasFire']));
        expect(off.refusal.obstacle).toMatchObject({ kind: 'closed', id: 'teleporter@96,128' });
        expect(off.refusal.message).toMatch(/only the plain SWORD breaks a rock in this model/);
        const on = ON(() => solve(POCKET, [EXIT], ['hasFire']));
        expect(breakRow(on.out)).toMatchObject({ target: 'breakablerock@96,112', weapon: 'fire', stance: null, pressedAt: 0 });
        expect(on.out.perTick.length).toBe(36);
        expect(on.run.level).toBe(11);
        expect(hitsOf(on.run)).toBe(0);
    });
    it('L30 from the L28 landing: the rock on the pit to L31 is broken from (40,216), press t75, and the run falls '
        + '(205 t, no hit); OFF the leg refuses naming the sword', () => {
        const FROM_L28 = { level: 30, x: 16, y: 128 };
        const PIT = { kind: 'reach-pit', pit: { tx: 3, ty: 14, x: 48, y: 224 } };
        const off = OFF(() => solve(FROM_L28, [PIT], ['hasFire']));
        expect(off.refusal.obstacle).toMatchObject({ kind: 'solid', id: 'breakablerock@48,224' });
        const on = ON(() => solve(FROM_L28, [PIT], ['hasFire']));
        expect(breakRow(on.out)).toMatchObject({ target: 'breakablerock@48,224', weapon: 'fire', stance: { x: 40, y: 216 },
            pressedAt: 75, ticks: FIRE_BREAK_WAIT_TICKS });
        expect(on.out.perTick.length).toBe(205);
        expect(on.run.level).toBe(31);
        expect(hitsOf(on.run)).toBe(0);
    });
    it('L73 from the L72 landing: `bulb@80,80` reaches the stance inside the wait, so the break is refused NAMING it '
        + 'on the fork certificate and nothing is pressed (uncertified, the plan takes that hit at t115)', () => ON(() => {
        const AUX = ['hasFire', 'canSwim', 'hasShield', 'hasTorch', 'hasFeather'];
        const { run, refusal } = solve({ level: 73, x: 32, y: 128 }, [rock(73, 0, 64, 48)], AUX);
        expect(refusal.obstacle).toMatchObject({ id: 'breakablerock@64,48' });
        expect(refusal.message).toMatch(/a Fire press at breakablerock@64,48 from \(72\.13,72\.00\) at tick 101 stands 23 ticks/);
        expect(refusal.message).toMatch(/HIT at tick 115 \(source chaser bulb@80,80\)/);
        expect(run.presses.filter((p) => p.weapon === 'fire')).toEqual([]);
        expect(hitsOf(run)).toBe(0);
    }));
    it('L53 from the L48 landing: `breakablerock@128,160`\'s stance is behind `breakablerock@112,128`, so that rock is '
        + 'the prerequisite order (`rockHypothesis` admits a rock for a Fire run) — and its walk meets the room\'s '
        + 'puncher, which a run with no Sword cannot fight', () => ON(() => {
        const { run, refusal } = solve({ level: 53, x: 192, y: 64 }, [rock(53, 1, 128, 160)],
            ['hasFire', 'canSwim', 'hasShield', 'hasTorch', 'hasFeather']);
        expect(refusal.message).toMatch(/breakablerock@128,160 -> break stance -> break stance \(breakablerock@112,128\): the combat ladder is EXHAUSTED/);
        expect(refusal.message).toMatch(/chaser:puncher@136,96/);
        expect(run.rocksBroken).toEqual([]);
    }));
    it('the hypothesis admits a rock for a Fire run only where a flame can reach it alone: L53\'s two, neither of '
        + 'L41\'s (OFF: none anywhere)', () => {
        const rocksIn = (h) => h.filter((r) => r.kind === 'rock').map((r) => r.id).sort();
        const probe = (boot) => stanceHypothesisProbe(createRunForStaging(arrivalStaging(boot, { items: ['hasFire'] }), SRC));
        const L53 = { level: 53, x: 192, y: 64 };
        const L41 = { level: 41, x: 16, y: 160 };
        expect(OFF(() => rocksIn(probe(L53)))).toEqual([]);
        expect(ON(() => rocksIn(probe(L53)))).toEqual(['breakablerock@112,128', 'breakablerock@128,160']);
        // L41's `@224,64` and `@224,80` stand one on the other: every cell beside either reaches both
        expect(ON(() => rocksIn(probe(L41)))).toEqual([]);
    });
    it('a ghost rock without the Ghost Sword is refused by name, with no press (L101 `breakablerockghost@224,96`)',
        () => ON(() => {
            const { run, refusal } = solve({ level: 101, x: 240, y: 96 }, [rock(101, 2, 224, 96, 'breakablerockghost')],
                ['hasFire']);
            expect(refusal.obstacle).toMatchObject({ id: 'breakablerockghost@224,96', reason: 'cannot-act' });
            expect(refusal.message).toMatch(/this rock is rockType 1 and the run holds NO ghost sword/);
            expect(refusal.message).toMatch(/THE WORK ORDER IS THE GHOST SWORD/);
            expect(run.presses).toEqual([]);
        }));
    it('L40 `breakablerock@176,128`: every stance also reaches a second rock, so the verb refuses and presses nothing',
        () => ON(() => {
            const { run, refusal } = solve({ level: 40, x: 192, y: 128 }, [rock(40, 22, 176, 128)], ['hasFire']);
            expect(refusal.obstacle).toMatchObject({ id: 'breakablerock@176,128', reason: 'unresolved' });
            expect(refusal.message).toMatch(/no REACHABLE stance for a Fire press at breakablerock@176,128/);
            expect(refusal.message).toMatch(/2 walkable cell\(s\) put `fireRect` on the rock; 0 were cut .* 2 also reached another fire responder/);
            expect(run.presses).toEqual([]);
            expect(run.rocksBroken).toEqual([]);
        }));
});

describe('fidelity FIREBREAK — D2: the solver\'s plans, played on the game (p4g), are the model at 0 px', () => {
    // ⛓ RULES rules-fire-breaks-rocks: the rule's own witnesses (`--set=rules`) are recorded and replayed the same way.
    const recorded = [...FIREBREAK_WITNESSES, ...FIREBREAK_RULES_WITNESSES]
        .map((w) => [w.name, w, join(FIREBREAK_WITNESS_DIR, `${w.name}.json`)]);
    it('every witness has its recording', () => {
        expect(recorded.filter(([, , path]) => !existsSync(path)).map(([name]) => name)).toEqual([]);
    });
    it.each(recorded)('%s: the game is the model on every sampled tick — the player, the hits, the rock flags',
        async (name, w, path) => {
            const rec = JSON.parse(readFileSync(path, 'utf8'));
            expect(rec.page).toBe('seedling_bot_ap_p4g');
            const model = await fireBreakModelSamples(rec.tape);
            expect(compareFireBreak(rec.samples, model.samples, w.rocks.map((r) => r.tag))).toEqual([]);
            // the game wrote each rock's flag on the observation after the model's `goneAt`, and took no hit
            for (const r of w.rocks) {
                const k = model.rocks.find((x) => x.id === r.id);
                expect(rec.samples.find((s) => s.cleared.includes(r.tag))?.t).toBe(k.goneAt + 1);
            }
            expect(rec.samples.every((s) => !s.hits)).toBe(true);
            expect(rec.end.level).toBe(w.to);
        });
    it.each(recorded)('%s: the recorded tape is the plan the solver makes today', async (name, w, path) => {
        const rec = JSON.parse(readFileSync(path, 'utf8'));
        const { tape } = await fireBreakPlan(w);
        expect(tape.inputs).toEqual(rec.tape.inputs);
        expect(tape.equips ?? []).toEqual(rec.tape.equips ?? []);
    });
});
