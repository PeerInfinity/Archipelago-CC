/**
 * fidelitySealDoor.test — ⛓⛓⛓ fidelity SEALDOOR (wave 18): THE SOLVER STEPS THE FINAL DOOR
 * (`CONTACT_FIDELITY.sealDoorApproach`, OFF by default).
 *
 * Sweep 38926058850 failed nine L113 legs on `finaldoor@112,0` (exits: *"no corridor … ITEM-GATE"*; the
 * location's clear-tag: *"no-verb"*). The RUN has stepped the door since R6 slice 6c (`finalDoorL113.test.js`,
 * game-recorded as `r6-final-door` + control); what was missing was the solver's verb.
 *
 *   1. OFF is the base: the same two refusals, word for word.
 *   2. ON, with both predicates held (16 seal slots, {114,0} cleared), every one of the nine goals solves by
 *      `approach`, and the door's events land on the R6 witness's spacing (ceremony, "open" one tick later,
 *      removed 56 later, wall one later). `sealdoor-l113-clear` / `-exit` are those plans, game-recorded.
 *   3. ON, with either predicate missing, the solver refuses BY NAME before a tick is spent, saying which —
 *      the game would play the ceremony and stay shut (`sealdoor-l113-noseal-control`, game-recorded: the sweep's
 *      own state, where an AP `Seal` writes no slot).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { parseTape } from './tapeFormat.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { KNOWN_STRATEGY_VERBS } from './decisionTrace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const SEALS = Array.from({ length: 16 }, (_, i) => i);
const DOOR = 'finaldoor@112,0';

/** The sweep's three L113 arrivals (from L112, and the two from L114). */
const ARRIVALS = Object.freeze({
    L112: { level: 113, x: 64, y: 128 },
    L114a: { level: 113, x: 16, y: 16 },
    L114b: { level: 113, x: 32, y: 16 },
});
const GOALS = Object.freeze({
    exit112: { kind: 'reach-exit', exit: { x: 112, y: 0 } },
    exit128: { kind: 'reach-exit', exit: { x: 128, y: 0 } },
    clear: { kind: 'clear-tag', tag: { level: 113, tag: 0 }, at: { x: 112, y: 0 }, obstacle: DOOR },
});

const staged = (boot, { seals = SEALS, talked = true } = {}) => ({
    ...arrivalStaging(boot),
    persistence: talked ? [{ level: 114, tag: 0 }] : [],
    save: { totem_parts: [], keys: [], seal_parts: seals },
});
const solve = (on, boot, goal, state) => withContactFidelity({ sealDoorApproach: on }, () => solveSegment({
    run: createRunForStaging(staged(boot, state), SRC), goals: [goal], name: 'sealdoor', boot,
}));
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

describe('fidelity SEALDOOR — the switch and its vocabulary', () => {
    it('ships OFF, and `approach` is a known verb', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.sealDoorApproach).toBe(false);
        expect(KNOWN_STRATEGY_VERBS).toContain('approach');
        expect(KNOWN_STRATEGY_VERBS.at(-1)).toBe('pace');
    });
});

describe('OFF — the base\'s two refusals, unchanged', () => {
    it('an exit refuses on the door as an ITEM gate', () => {
        const e = refusalOf(() => solve(false, ARRIVALS.L112, GOALS.exit112));
        expect(e).not.toBeNull();
        expect(e.message).toContain(`Obstacle: solid:finaldoor (${DOOR})`);
        expect(e.message).toContain(`ITEM-GATE (${DOOR})`);
    });
    it('the clear-tag refuses `no-verb`', () => {
        const e = refusalOf(() => solve(false, ARRIVALS.L114a, GOALS.clear));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'no-verb', id: DOOR });
        expect(e.message).toContain('no strategy row exists for solid:finaldoor');
    });
});

describe('ON, both predicates held — the nine goals solve by `approach`', () => {
    for (const [an, boot] of Object.entries(ARRIVALS)) {
        for (const [gn, goal] of Object.entries(GOALS)) {
            it(`${an} → ${gn}`, () => {
                const out = solve(true, boot, goal);
                const rec = out.records.find((r) => r.verb === 'approach');
                expect(rec).toMatchObject({ target: DOOR, deadFrames: 181 });
                expect(rec.openedAt - 1).toBe(rec.ceremonyAt + 1); // "open" is the tick after the ceremony's
                expect(rec.removedAt - (rec.ceremonyAt + 1)).toBe(56);
                expect(rec.wallOpensAt).toBe(rec.removedAt + 1);
                if (goal.kind === 'reach-exit') expect(out.records.at(-1)).toMatchObject({ to: 115 });
                else expect(rec).toMatchObject({ arm: 'verb', flag: { level: 113, tag: 0 } });
            });
        }
    }
});

describe('ON, a predicate missing — refused by name, before a tick is spent', () => {
    const cases = [
        ['no Watcher talk', { talked: false }, ['{114,0} is SET'], ['seal slot']],
        ['no seal slots (the sweep\'s AP state)', { seals: [] }, ['0 of 16 seal slot(s)'], ['{114,0} is SET']],
        ['fifteen seals: the LAST slot is what counts', { seals: SEALS.slice(0, 15) }, ['15 of 16 seal slot(s)'], []],
        ['neither', { seals: [], talked: false }, ['0 of 16 seal slot(s)', '{114,0} is SET'], []],
    ];
    for (const [what, state, has, hasNot] of cases) {
        it(`${what}: the exit`, () => {
            const e = refusalOf(() => solve(true, ARRIVALS.L112, GOALS.exit112, state));
            expect(e?.message).toContain(`approach ${DOOR} in level 113 — the door cannot open in this state`);
            for (const s of has) expect(e.message).toContain(s);
            for (const s of hasNot) expect(e.message).not.toContain(s);
            expect(e.perTick).toEqual([]);
        });
    }
    it('the clear-tag names the same reason, as `unresolved`', () => {
        const e = refusalOf(() => solve(true, ARRIVALS.L114b, GOALS.clear, { talked: false }));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'unresolved', id: DOOR });
        expect(e.message).toContain('{114,0} is SET');
    });
});

describe('the witnesses — the committed tapes are the solver\'s plans, and the door does what the game did', () => {
    const replay = (t) => {
        const run = createRunForStaging(stagingFromTape(t), SRC);
        for (let i = 0; i < t.tick_count && run.level === t.boot.level; i += 1) {
            run.advance(new Set(t.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        }
        return run;
    };
    it('`sealdoor-l113-clear`: ceremony t89, open t90, removed t146, {113,0} earned', () => {
        const t = tape('sealdoor-l113-clear');
        const out = withContactFidelity({ sealDoorApproach: true },
            () => solveSegment({ run: createRunForStaging(stagingFromTape(t), SRC), goals: [GOALS.clear],
                name: 'sealdoor-l113-clear', boot: t.boot }));
        // The plan IS the committed, game-recorded tape, key for key.
        expect(out.perTick).toHaveLength(t.tick_count);
        const keysAt = (i) => t.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key).sort();
        expect(out.perTick.map((k) => [...k].sort())).toEqual(out.perTick.map((_, i) => keysAt(i)));
        const run = replay(t);
        expect(run.doorCeremonies.map((c) => [c.t, c.frames])).toEqual([[89, 181]]);
        expect(run.doorEvents.map((e) => [e.what, e.t])).toEqual([['open', 90], ['removed', 146]]);
        expect(run.earnedClears.map((c) => [c.level, c.tag, c.by])).toEqual([[113, 0, DOOR]]);
    });
    it('`sealdoor-l113-exit`: the same verb, then through the doorway into L115', () => {
        const run = replay(tape('sealdoor-l113-exit'));
        expect(run.level).toBe(115);
    });
    it('`sealdoor-l113-noseal-control`: the same inputs, no seal slot — the ceremony, and nothing else', () => {
        const t = tape('sealdoor-l113-noseal-control');
        expect(t.inputs).toEqual(tape('sealdoor-l113-clear').inputs);
        expect(t.save.seal_parts).toEqual([]);
        const run = replay(t);
        expect(run.doorCeremonies.map((c) => [c.t, c.frames])).toEqual([[89, 181]]);
        expect(run.doorEvents).toEqual([]);
        expect(run.earnedClears).toEqual([]);
        expect(run.finalDoorGate).toMatchObject({ hasAllSealParts: false, talkedToWatcher: true, sealSlotsFilled: 0 });
    });
});
