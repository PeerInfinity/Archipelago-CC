/**
 * fidelityF1b — Seedling fidelity F1b: L5's kill-lock LEDGER reads the
 * REMOVAL, and the declaration is the removal plus the game's fade.
 *
 * F1 measured it on the game (`f1-l5-lock-removal`, recorded twice): the
 * third bob dies on t166, `endAnim` destroys it on t190, `FP.world.remove`
 * takes it on t201, and the game crosses `lock@48,112` on t303 under the
 * game-sourced `{5,0}@301`. `Lock.checkEnemies` reads `totalEnemies()`, which
 * drops only at the removal (`Lock.as:64-97`). The model's ledger ran at the
 * KILL (`stageChaserKill`), so `chaserKillLockOpens[].t` was 166 and
 * `twoPassSolve` declared 166 + 101 = 267.
 *
 * F1b: every chaser death arms `removalLedger` (R2-swim D3(c)'s latch for a
 * terrain death), so ONE rule runs the ledger at the removal. The declaration
 * is in the v9 `at` spelling, `removal + opensOnTick(0.01) - 1`: the
 * scratch layer's own `declaredAt`. The witness settles that fencepost, not
 * arithmetic: `@301` replays to the game's t303, and `@302` to t304.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 `stageChaserKill` runs `assertChaserRemovalIsDeclared` at the kill
 *      again (the kill-tick reading)
 *        -> the ledger row, the scratch-clear row and the solver row red
 *           (166 / 266 / 267), and `fidelityF1`'s kills row
 *   m2 the solver declares `removal + opensOnTick` (no v9 spelling)
 *        -> the solver row red (302 against the game's 301)
 */
import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { PENDING_AT, solveSegment } from './solverBot.js';
import { RESPONDERS, opensOnTick } from './activators.js';

const WITNESS = 'f1-l5-lock-removal';
const GAME_AT = loadTape(WITNESS).persistence.find((p) => p.level === 5 && p.tag === 0).at;
const GAME_CROSSING = loadExpectation(WITNESS).stream.transitions.map((x) => x.t);
const DECLARED_FADE = opensOnTick(RESPONDERS.lock.fade) - 1;

/** Replay a tape's own keys under a persistence block; the run, and the tick L5's last body left. */
function replay(name, persistence, opts = {}) {
    const tape = loadTape(name);
    const run = createRunForStaging({ ...stagingFromTape(tape), persistence }, atlasLevelSource(), opts);
    let lastRemoval = null;
    for (let t = 0; t < tape.tick_count; t += 1) {
        const before = (run.entities('chasers') ?? []).length;
        run.advance(heldKeysAt(tape, t));
        if (run.level === 5 && before > 0 && (run.entities('chasers') ?? []).length < before) {
            lastRemoval = run.ticksCompleted;
        }
    }
    return { run, lastRemoval };
}

const untimed = (name) => stagingFromTape(loadTape(name)).persistence.filter((p) => p.at === undefined);

describe('F1b D1 — L5\'s kill-lock ledger reads the REMOVAL (witness f1-l5-lock-removal)', () => {
    it('⛓ the ledger\'s tick is the tick the last body leaves the model\'s world, not its kill', () => {
        const { run, lastRemoval } = replay(WITNESS, stagingFromTape(loadTape(WITNESS)).persistence);
        const kill = run.chaserKills.filter((k) => k.level === 5).at(-1);
        const opens = run.chaserKillLockOpens.filter((o) => !o.nil);
        expect(opens.map((o) => [o.t, o.id])).toEqual([[lastRemoval, kill.id]]);
        expect(opens[0].t).toBeGreaterThan(kill.t);
        expect(lastRemoval + DECLARED_FADE).toBe(GAME_AT);
    });

    it('⛓⛓ with the declaration REMOVED, the scratch layer computes the game\'s tick and crosses when the game did', () => {
        const { run, lastRemoval } = replay(WITNESS, untimed(WITNESS), { scratchPersistence: true });
        expect(run.scratchClears.map((c) => [c.level, c.tag, c.removedAt, c.declaredAt]))
            .toEqual([[5, 0, lastRemoval, GAME_AT]]);
        expect(run.transitions.map((x) => x.t)).toEqual(GAME_CROSSING);
    });

    it('⛓⛓ the SOLVER declares the game\'s tick: removal + the v9-spelled fade', () => {
        const tape = loadTape('r8-solve-5');
        const st = stagingFromTape(tape);
        const persistence = st.persistence.map((p) => (p.at !== undefined ? { ...p, at: PENDING_AT } : p));
        const run = createRunForStaging({ ...st, persistence }, atlasLevelSource());
        let raised = null;
        try {
            solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 112 } }],
                name: 'f1b-l5', boot: st.boot });
        } catch (e) { raised = e; }
        expect(raised?.name).toBe('PendingDeclaration');
        expect(raised.pending).toMatchObject({ level: 5, tag: 0, source: 'model', fade: DECLARED_FADE });
        expect(raised.pending.removedAt + raised.pending.fade).toBe(raised.pending.at);
        expect(raised.pending.at).toBe(GAME_AT);
        expect(raised.pending.why).toMatch(/the last body leaves the world/);
    });

    it('⛓ the fencepost is the witness\'s: one tick later and the model crosses one tick late', () => {
        const late = untimed(WITNESS).concat([{ level: 5, tag: 0, at: GAME_AT + 1 }]);
        const { run } = replay(WITNESS, late);
        expect(run.transitions.map((x) => x.t)).toEqual(GAME_CROSSING.map((t) => t + 1));
    });
});
