/**
 * Seedling fidelity L14: the SWORDLESS crossing of L14 — six chasing bobs, no
 * trap, no pit, no weapon — and the DETOUR rung that finds it.
 *
 * ⚖ The user, 2026-10-04: *"Make an attempt to find a swordless strategy that
 * gets through … We should derive the requirements from what the solver can
 * do."* At main `a2d10de28` the solver declined this arrival: *"the combat
 * ladder is EXHAUSTED"*. `solverBot.deriveChaserDetour` is asked only after
 * KILL refused; it bends the corridor through via cells over the pack, each
 * candidate previewed with the chasers stepped against it.
 *
 * The game's side: `l14-swordless-detour` (`plan-seedling-l14-swordless.mjs`,
 * recorded by `check-seedling-bot-differential --record`; tapeRunner holds the
 * model to it).
 */

import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import { createRunForStaging, runTapeToStream, stagingFromTape } from './tapeRunner.js';
import { DETOUR_RUNG, deriveChaserDetour, solveSegment } from './solverBot.js';
import { R8_STRATEGY_EXECUTORS, assertEscalationIsOrdered } from './r8Acceptance.js';

const SRC = atlasLevelSource();
const NAME = 'l14-swordless-detour';
const GOAL = { kind: 'reach-exit', exit: { x: 32, y: 64 } };
const staging = () => stagingFromTape(loadTape(NAME));
const solve = (patch = (s) => s) => {
    const st = patch(staging());
    const run = createRunForStaging(st, SRC, { scratchPersistence: true });
    const out = solveSegment({ run, goals: [{ ...GOAL }], name: 'fidelity-l14', boot: st.boot,
        prefix: [], dashMode: 'none' });
    return { run, out };
};
const keysOf = (perTick) => perTick.map((h) => [...h].sort().join('+'));

describe('fidelity L14 — the swordless arrival, solved by the DETOUR rung', () => {
    it('the arrival holds no weapon and six bobs', () => {
        const run = createRunForStaging(staging(), SRC, { scratchPersistence: true });
        expect(run.primaryWeapon).toBe(null);
        expect(run.chasers.map((c) => c.id)).toEqual(['bob@32,32', 'bob@64,64', 'bob@96,48',
            'bob@96,80', 'bob@128,64', 'bob@176,112']);
    });

    it('it solves through KILL\'s refusal: 173 ticks, no hit, onto L15', () => {
        const { run, out } = solve();
        const rungs = out.trace.rows.map((r) => r.strategy?.rung).filter(Boolean);
        expect(rungs).toEqual(['detour']);
        const row = out.trace.rows.find((r) => r.strategy?.rung === 'detour');
        expect(row.strategy.vias).toEqual([{ x: 120, y: 40 }, { x: 104, y: 24 }]);
        expect(row.rejected.map((r) => r.option)).toEqual(['avoid', 'time', 'bait', 'kill']);
        expect(out.perTick.length).toBe(173);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        expect(run.transitions.map((x) => x.to_level)).toEqual([15]);
    });

    it('the committed witness IS the solve, and the model replays the game\'s recording', () => {
        const { out } = solve();
        const tape = loadTape(NAME);
        expect(tape.tick_count).toBe(out.perTick.length);
        const held = Array.from({ length: tape.tick_count }, () => []);
        for (const i of tape.inputs) for (let t = i.from; t < i.to; t += 1) held[t].push(i.key);
        expect(held.map((h) => h.sort().join('+'))).toEqual(keysOf(out.perTick));
        const e = loadExpectation(NAME);
        expect(runTapeToStream(tape, { levelSource: SRC })).toEqual(e.stream ?? e);
    });

    it('the ladder lists DETOUR last, and an escalation to it must name KILL', () => {
        expect(R8_STRATEGY_EXECUTORS.ladder.at(-1).rung).toBe('detour');
        expect(assertEscalationIsOrdered([{ rung: 'avoid' },
            { rung: 'time', refused: { rung: 'avoid', why: 'x' } },
            { rung: 'bait', refused: { rung: 'time', why: 'x' } },
            { rung: 'kill', refused: { rung: 'bait', why: 'x' } },
            { rung: 'detour', refused: { rung: 'kill', why: 'x' } }]).deepest).toBe('detour');
        expect(() => assertEscalationIsOrdered([{ rung: 'avoid' },
            { rung: 'detour', refused: { rung: 'avoid', why: 'x' } }])).toThrow(/does not name/);
    });
});

describe('fidelity L14 — the DETOUR search, refusing by name', () => {
    const run = () => createRunForStaging(staging(), SRC, { scratchPersistence: true });
    const planOpts = (r) => ({ liveBag: r.liveGeometryOpts(), avoidVolumes: true, keys: r.progress('keys'),
        contacts: new Set(), lattice: 16, inventory: r.progress('inventory'), noHazards: r.noHazards });

    it('a certify that never clears spends exactly the preview bound and says so', () => {
        const r = run();
        let asked = 0;
        const d = deriveChaserDetour(r, { aim: GOAL.exit, allowTeleporter: null, planOpts: planOpts(r),
            certify: () => { asked += 1; return { hit: { x: 0, y: 0 }, truncated: null, ticks: 1 }; },
            maxPreviews: 40 });
        expect(d.wps).toBe(null);
        expect(asked).toBe(40);
        expect(d.why).toMatch(/40 preview\(s\) of the 40 bound spent/);
    });

    it('the bounds are search bounds, named', () => {
        expect(DETOUR_RUNG).toEqual({ maxVias: 2, maxPreviews: 300, maxPlanned: 500 });
    });
});
