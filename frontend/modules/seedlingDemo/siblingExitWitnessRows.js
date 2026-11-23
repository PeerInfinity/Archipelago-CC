/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SIBLING-EXIT — THE L16 PIT WITNESS ROWS (test support: `siblingExitWitness.slow.test.js` runs the
 * `in_L17_32_48` arrival, ~10 s; `siblingExitWitness.train.test.js` the `in_L15_144_16` one, ~70 s). Both runtimes' solve
 * paths (js-22 items 4–5, the model half; the game half is the report's wasm witness). The legs:
 * `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2` and its `in_L15_144_16 ~> level_16__r1c1` twin,
 * at sphere 1.3 (Sword, the rope flag {16,0} cleared: the divergence-sweep list's staging). The user's witness: *"the
 * leftmost pit tile in the top row lands too close to the bob, but the two pit tiles to the right of it give a safe landing."*
 *
 *   · the WASM path in node — `resolveSeedlingAtlasGoal` → `wasmArrival.arrivalSolverGoal` → `arrivalSolveRequest` →
 *     `solveAnytime` (what the wasm engine hands its worker), the shipped plan replayed on a shadow;
 *   · the JS page — `createJsRuntime` with the solver mode on (the walker → `createRuntimeSolver.keysFor` → the in-place
 *     service → `solveAnytime`), ticked through the fall.
 * OFF both ship the named exit and take `bob@96,32` on the landing; ON both ship `#3` (tile 14,3) hitless.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { ANYTIME_PASSES, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from './wasmArrival.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { apSiblingExitsOf, withSiblingExitChoice } from './siblingExitChoice.js';
import { resolveSeedlingAtlasGoal } from '../flashPanel/seedlingPlaybackController.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const VANILLA = JSON.parse(readFileSync(abs('../flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(VANILLA));
const SRC = levelSourceFromAtlas(RECS);
const RULES = JSON.parse(readFileSync(abs('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));
const REGIONS = new Map(Object.entries(RULES.preset_sidecars['1']).map(([r, s]) => [r, s.playable_payload]));
const ATLAS = { regions: REGIONS, siblingExits: apSiblingExitsOf(RULES, '1', REGIONS) };
const PIT = 'level_16__r1c9 -> level_17';
/** The two L16 arrivals of the witness legs (the sweep list's `arrive`). */
export const SIBLING_WITNESS_ARRIVALS = Object.freeze({
    L17: { via: 'in_L17_32_48 ~> level_16__r3c7', at: [112, 48] },
    L15: { via: 'in_L15_144_16 ~> level_16__r1c1', at: [32, 64] },
});
const ROPE = [16, 0];
const goalOf = (on) => withSiblingExitChoice(on, () => resolveSeedlingAtlasGoal({ kind: 'exit', name: PIT }, ATLAS,
    { region: 'level_16__r1c9' }).goal);

/** The rows, for the arrivals given (`{describe, expect, it}` from the caller's vitest). */
export function siblingExitWitnessRows({ describe, expect, it }, ARRIVALS) {
/** A JS page booted at `[16, x, y]` holding the Sword, the rope flag restored through the page's own save path. */
function page([x, y]) {
    const rt = createJsRuntime();
    rt.setVanilla(VANILLA);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [16, x, y] }]);
    rt.tick();
    const save = rt.exportSave();
    expect(rt.restoreSave({ ...save, carried: [...save.carried, ROPE] })).toEqual({ ok: true });
    rt.tick();
    rt.playback.setSolverWalk(true);
    return rt;
}

describe('⛓ SIBLING-EXIT — the L16 pit, the wasm solve path (node)', () => {
    for (const a of ARRIVALS) {
        it(`${a.via}: OFF the named exit takes the landing hit; ON "#3" ships hitless`, () => {
            const rt = page(a.at);
            const staging = rt.session.staging;
            const verdicts = {};
            for (const on of [false, true]) {
                const goal = goalOf(on);
                const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(16) });
                expect(mapped.goal.kind).toBe('reach-pit');
                expect((mapped.goal.siblings ?? []).length).toBe(on ? 6 : 0);
                const req = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true });
                const res = solveAnytime({ ...req, levelSource: SRC, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK },
                    { passes: ANYTIME_PASSES });
                expect(res.ok).toBe(true);
                const shadow = replayTape({ staging: req.staging, perTick: req.perTick, levelSource: SRC, scratchPersistence: true });
                res.plan.solution.forEach((h) => shadow.advance(h));
                verdicts[on] = { hits: shadow.ledger('playerHits').map((h) => `${h.level}:${h.id}`), ctor: { ...shadow.worldCtor },
                    level: shadow.level, chosen: res.plan.siblingExit?.chosen ?? null };
            }
            expect(verdicts.false).toEqual({ hits: ['17:bob@96,32'], ctor: { x: 112, y: 32 }, level: 17, chosen: null });
            expect(verdicts.true).toEqual({ hits: [], ctor: { x: 144, y: 32 }, level: 17, chosen: `${PIT} #3` });
        }, 300000);
    }
});

describe('⛓ SIBLING-EXIT — the L16 pit, the JS page (walker → keysFor → in-place solve)', () => {
    for (const a of ARRIVALS) {
        it(`${a.via}: the page lands where the solve chose, and the note names the sibling`, () => {
            const out = {};
            for (const on of [false, true]) {
                const rt = page(a.at);
                expect(rt.playback.walkTo(goalOf(on))).toEqual({ ok: true });
                rt.playback.play();
                for (let t = 0; t < 3000 && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state); t += 1) rt.tick();
                expect(rt.playback.state).toBe(WALK_STATES.DONE);
                for (let k = 0; k < 80; k += 1) rt.tick(); // through the fall: the landing is where the bob is
                const solved = rt.events.filter((e) => e.type === 'solver' && /solved reach-pit/.test(e.message)).map((e) => e.message);
                out[on] = { level: rt.session.run.level, ctor: { ...rt.session.run.worldCtor },
                    hits: rt.session.run.ledger('playerHits').map((h) => `${h.level}:${h.id}`),
                    note: solved.some((m) => m.includes(`sibling exit "${PIT} #3" in place of "${PIT}"`)) };
            }
            expect(out.false).toEqual({ level: 17, ctor: { x: 112, y: 32 }, hits: ['17:bob@96,32'], note: false });
            expect(out.true).toEqual({ level: 17, ctor: { x: 144, y: 32 }, hits: [], note: true });
        }, 300000);
    }
});
}
