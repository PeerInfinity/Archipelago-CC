/**
 * Seedling fidelity RETURN: L15 → L14 on the way back from L16.
 *
 * The JS arc's live walk (route B, Sword) re-enters L15 (`Dungeon2_2`) from
 * L16 and asks for `level_15__r1c5 -> level_14`. The solver refused it with
 * *"no REACHABLE stance inside button@112,32"*.
 *
 *   · D1 (the game's state): the forward trip clears `{15,0}` (the lock's
 *     `turnOff()`) and both rocks, but `Lock.check()` removes a lock only when
 *     `tSet < 0` (`Puzzlements/Lock.as:39-46`), and `lock@128,48` is tSet 0. So
 *     the game rebuilds it CLOSED, the block is back at (64,64)
 *     (`PushableBlock.as:23-33` reads no persistence), and nothing holds the
 *     button. The game's own streams, `return-l15-reentry` (the forward clears)
 *     and `return-l15-reentry-unclear` (without them), are byte-identical, and
 *     both are held at x 146.5 by the lock. `return-l15-walkin` takes the door
 *     from L16. The model reproduces all three, so the BUILD is not the gap.
 *   · D2 (the solver): the arrival column is closed by the lock to the west and
 *     by Water to the south (`Player.as:1456`, no `canSwim`). Without the Conch
 *     the crossing does not exist in the game. The refusal was right, but it was
 *     named wrong ("NO block in this room can reach it" is asked from the
 *     walker's side). It now says the button is SEALED BEHIND ITS OWN LOCK, and
 *     carries `sealed`. With the Conch it solves (222 t), and the game reproduces
 *     the plan (`return-l15-conch`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { SolverRefusal, solveSegment } from './solverBot.js';
import { canCross } from './seedlingCanCross.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = parseTape(readFileSync(join(HERE, 'fixtures', 'witness-bases', 'r9-solve-32.f6.json'), 'utf8'));
const SRC = atlasLevelSource();
const expectation = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
/** The forward trip's clears in L15: the lock's tag 0 and both rocks. */
const CLEARS = [0, 2, 3];
const isL15Clear = (p) => p.level === 15 && CLEARS.includes(p.tag);
/** L16's `stairsup@16,64` lands the player here (`playerx/playery`). */
const L15_BACK = { level: 15, x: 144, y: 32 };
/** `wasmArrival.arrivalSolverGoal`'s shape for `level_15__r1c5 -> level_14` (L15's `stairsup@32,64`). */
const TO_L14 = { kind: 'reach-exit', exit: { x: 32, y: 64 } };
const back = ({ clears = true, swim = false } = {}) => createRunForStaging({
    ...BASE, boot: L15_BACK, equips: [], despawn: [], tick0: null,
    persistence: clears ? BASE.persistence : BASE.persistence.filter((p) => !isL15Clear(p)),
    seam: { ...BASE.seam, items: { ...BASE.seam.items, canSwim: swim } },
}, SRC, { scratchPersistence: true });
const refusalOf = (fn) => {
    try { fn(); } catch (e) { return e; }
    return null;
};
const SEALED = {
    wall: 'lock@128,48', presser: 'button@112,32', ownOpener: true, group: 0,
    from: { x: 152, y: 40 }, stance: { x: 120, y: 40 },
};

describe('fidelity RETURN — D1: the game rebuilds L15\'s lock CLOSED on the way back', () => {
    it('the chain-end staging carries the forward clears {15,0} {15,2} {15,3}, and no Conch', () => {
        expect(CLEARS.every((tag) => BASE.persistence.some((p) => p.level === 15 && p.tag === tag))).toBe(true);
        expect(BASE.seam.items.canSwim).toBe(false);
    });
    it('the model builds `lock@128,48` (tset 0) whatever its tag; the cleared rocks are gone', () => {
        const cleared = buildLevelWorld(SRC(15), { cleared: CLEARS });
        const fresh = buildLevelWorld(SRC(15));
        for (const w of [cleared, fresh]) {
            expect(w.activators.map((a) => [a.id, a.t, a.persistTag])).toEqual([['lock@128,48', 0, 0]]);
            expect(w.pushables.map((p) => [p.id, p.x, p.y])).toEqual([['pushableblock@64,64', 64, 64]]);
        }
        expect(cleared.solids.filter((s) => s.tag === 'breakablerock')).toEqual([]);
        expect(fresh.solids.filter((s) => s.tag === 'breakablerock')).toHaveLength(2);
    });
    it('the game: the cleared and uncleared re-entries are ONE stream, held at the lock', () => {
        const a = expectation('return-l15-reentry');
        const b = expectation('return-l15-reentry-unclear');
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a.ticks).toHaveLength(61);
        expect(a.transitions).toEqual([]);
        expect(Math.min(...a.ticks.map((t) => t.x))).toBeGreaterThan(146);
        expect(a.ticks.at(-1)).toMatchObject({ level: 15 });
    });
    it('the game: the walk-in from L16 lands at the arrival on t7 and stops at the lock', () => {
        const w = expectation('return-l15-walkin');
        expect(w.transitions).toEqual([{ t: 7, from_level: 16, to_level: 15 }]);
        const inL15 = w.ticks.filter((t) => t.level === 15);
        expect(Math.min(...inL15.map((t) => t.x))).toBeGreaterThan(146);
    });
});

describe('fidelity RETURN — D2: the refusal names the seal; the Conch solves', () => {
    it.each([['with', true], ['without', false]])(
        '%s the forward clears, `level_15 -> level_14` refuses: the button is SEALED BEHIND ITS OWN LOCK',
        (_, clears) => {
            const run = back({ clears });
            const e = refusalOf(() => solveSegment({ run, goals: [TO_L14], name: 'return-l15', boot: L15_BACK }));
            expect(e).toBeInstanceOf(SolverRefusal);
            expect(e.message).toMatch(/no REACHABLE stance inside button@112,32 in level 15/);
            expect(e.message).toMatch(/SEALED BEHIND ITS OWN LOCK: with lock@128,48 discharged a corridor from \(152,40\)/);
            expect(e.sealed).toEqual(SEALED);
        });
    it('with the Conch the same arrival SOLVES (the water is the way round)', () => {
        const run = back({ swim: true });
        const out = solveSegment({ run, goals: [TO_L14], name: 'return-l15-swim', boot: L15_BACK });
        expect(run.level).toBe(14);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(out.perTick.length).toBeGreaterThan(0);
    });
    it('canCross: Sword alone is `cannot` in both states, by the seal; Sword + Conch is `can`', () => {
        for (const persistence of [[15, 0, 15, 2, 15, 3], []]) {
            const p = [];
            for (let i = 0; i < persistence.length; i += 2) p.push({ level: persistence[i], tag: persistence[i + 1] });
            const r = canCross({ level: 15, exit: 14, arrival: { from: 16 }, inventory: ['sword'], persistence: p,
                witness: false });
            expect(r.verdict).toBe('cannot');
            expect(r.why).toMatch(/SEALED BEHIND ITS OWN LOCK/);
        }
        // ⛓ the committed witness is the DASHLESS plan (recorded while canCross defaulted to
        // `none`); DASHFLIP returned the default to the solver's `all` (193 t here), so this
        // row asks for `none` by name, as CANCROSS's own L16 witness row does.
        const r = canCross({ level: 15, exit: 14, arrival: { from: 16 }, inventory: ['sword', 'conch'],
            persistence: CLEARS.map((tag) => ({ level: 15, tag })), name: 'return-l15-conch',
            dashMode: 'none' });
        expect(r.verdict).toBe('can');
        expect(r.plan).toMatchObject({ ticks: 222, landed: 14, hits: 0 });
        const path = join(HERE, 'fixtures', 'tapes', 'return-l15-conch.json');
        expect(`${JSON.stringify(r.witness.tape, null, 4)}\n`).toBe(readFileSync(path, 'utf8'));
        expect(r.witness.replayed).toEqual({ observations: 223, landed: 14, agrees: true });
    });
    it('the game: the Conch witness lands in L14 (recorded, 223 observations)', () => {
        const c = expectation('return-l15-conch');
        expect(c.ticks).toHaveLength(223);
        expect(c.transitions).toEqual([{ t: expect.any(Number), from_level: 15, to_level: 14 }]);
    });
    it('CONTROL: the forward crossing `level_15 -> level_16` from the L14 door still solves', () => {
        const r = canCross({ level: 15, exit: 16, arrival: { from: 14 }, inventory: ['sword'], witness: false });
        expect(r.verdict).toBe('can');
    });
});

describe('fidelity RETURN — D3: the census of re-entered rooms (model only)', () => {
    /** The route survey's re-entries (L3, L2, L0: visit 2) carry clears that open no lock: none holds one. */
    it.each([[0, [1]], [2, [0]], [3, [0]]])('L%i, re-entered by the survey with its clears %j, builds with no activator',
        (level, cleared) => {
            const w = buildLevelWorld(SRC(level), { cleared });
            expect([w.activators, w.pressers]).toEqual([[], []]);
        });
    it('L16 from L18 with the chain\'s clears: `lock@320,112` (tset 1, tag 7) is rebuilt closed, and the button is sealed behind it', () => {
        const persistence = [0, 3, 4, 6, 7].map((tag) => ({ level: 16, tag }));
        const r = canCross({ level: 16, exit: 15, arrival: { from: 18 }, inventory: ['sword'], persistence,
            witness: false });
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(/SEALED BEHIND ITS OWN LOCK: with lock@320,112 discharged a corridor from \(360,104\)/);
        expect(buildLevelWorld(SRC(16), { cleared: [0, 3, 4, 6, 7] }).activators.map((a) => a.id))
            .toEqual(['lock@320,112']);
    });
});
