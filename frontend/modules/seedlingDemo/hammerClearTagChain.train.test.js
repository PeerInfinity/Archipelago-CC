/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE CLEARTAG-CHAIN (train tier) — L40's flag 12 SOLVED from a tree-UNBURNT save with the
 * clear-tag arm's prerequisite chained (`CLEARTAG_CHAIN`, OFF) and the census's minimal set, replayed on a fresh run
 * (⚖ 30(c): the walk certified is the walk driven).
 *
 * The states are the page's own requests for legs 871 (`… <- in_L39_144_0 ~> …`, arrival (488,904)) and 872
 * (`… <- in_L43_176_464 ~> …`, arrival (328,600)), captured at `97739720dd`, atlas records cut to level 40
 * (`fixtures/hammer-cleartag-chain/`). Neither stages L40 tag 0: `burnabletree@872,784` stands at the arrival.
 *
 * The set: `CLEARTAG_CHAIN` + `STANCE_BURN` (the burn named) + `OPPORTUNISTIC_STRIKE` + `CHASER_STAGED_HUNT` (the SE
 * fight, census walls A1/A2) + `PRESS_ESCAPE_EXACT` + fidelity's `forecastShieldBump` (without either of the last
 * two, 872 takes one hit from `bob@736,800` at t800 — measured, `CC/docs/cloud-reports/seedling-hammer-cleartag-chain.md`).
 * Each solve is the dashless pass, uncapped: the work is reported against the page's 640/2560, not asserted under it.
 *
 * ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip + WALLSFLIP, ⚖ user 2026-11-11): `spinner@816,848` walls
 * `bob@736,752`'s first step, so the bob comes up the x≈744 corridor ~2 px behind and the first opportunistic strike
 * lands a tick or two later.
 *   - 872 still SOLVES hitless with the same chain (`kill, bait, kill, bait, kill, hold`): work 3467 → 3823, 2389 → 2385 t.
 *   - ⛔ 871 is a LOST SOLVE under the wall: the search REFUSES at t724 (`burn stance … the combat ladder is EXHAUSTED`,
 *     work 885), two ticks after its second bob takes hit 2. The pre-wall 1122-t plan is still a hitless walk: it replays
 *     row for row on the wall-ON model, and the GAME (p4g) played it with 0 hits, the model at 0 px on all 1122 ticks
 *     (`CC/docs/cloud-reports/seedling-fidelity-wallsflip-evidence/leg871-offplan-game.log`). So the gap is the SEARCH's
 *     (the hammer arc's: the combat ladder at t724), not the model's. The row pins all three facts; when the search finds
 *     a plan again its last block goes red, and that is the re-pin to make.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withChaserStagedHunt, withClearTagChain, withStanceBurn } from './solverBot.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-chain', name)))
    .toString('utf8'));
const TREE = 'burnabletree@872,784';

/** The census's minimal set around `fn`, `CLEARTAG_CHAIN` at `cc`. */
const withSet = (cc, fn, fidelity = {}) => withClearTagChain(cc, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, ...fidelity }, fn))))));
/** `chaserSpinnerWalls` at `walls` (`null` = the shipped default) around `fn`. */
const withWalls = (walls, fn) => (walls === null ? fn() : withContactFidelity({ chaserSpinnerWalls: walls }, fn));

/**
 * One leg's dashless pass under the set, uncapped; a plan is re-driven on a FRESH run of the staging, row by row.
 * `solveWalls` / `replayWalls`: `chaserSpinnerWalls` for the solve and for the re-drive (`null` = the shipped default).
 */
function solveLeg(name, cc, { solveWalls = null, replayWalls = null } = {}) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX(name).requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    expect((tape.staging.persistence ?? []).some((p) => p.level === 40 && p.tag === 0)).toBe(false);
    let work = 0;
    const answer = withSet(cc, () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return false; } })),
    solveWalls === null ? {} : { chaserSpinnerWalls: solveWalls });
    if (!answer.ok) return { ok: false, work, message: answer.message };
    const { plan } = answer;
    return withWalls(replayWalls, () => redrive(tape, levelSource, plan, work));
}

/** The plan driven on a fresh run of the staging: every expected row checked, then the run's ledgers. */
function redrive(tape, levelSource, plan, work) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    expect(row()).toEqual(plan.expected[0]);
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        if (plan.expected[k + 1]) expect(row()).toEqual(plan.expected[k + 1]);
    }
    return {
        ok: true, work, ticks: plan.solution.length,
        sha: createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(hits0).map((h) => [h.t, h.source, h.id]),
        deaths: run.playerDeaths.length,
        burned: [...(run.entities('burnedTrees') ?? [])],
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort(),
    };
}

describe('hammer-phase CLEARTAG-CHAIN (train) — flag 12 SOLVED from a tree-unburnt save, 30(c)', () => {
    it('leg 872 (from L43, (328,600)): OFF the set refuses at wall B; ON it SOLVES hitless — the tree burnt, {40,12} '
        + 'written', () => withL40Flip(false, () => {
        const off = solveLeg('leg872-l43-l40-request.json.gz', false);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/a clear-tag order does not chain openers$/);
        const on = solveLeg('leg872-l43-l40-request.json.gz', true);
        // ⛓ chaserSpinnerWalls ON: work 3467, 2389 t before the flip (the same chain; the first strike lands 2 ticks later)
        expect(on).toEqual({ ok: true, work: 3823, ticks: 2385, sha: expect.any(String), hits: [], deaths: 0,
            burned: [TREE], clears: ['40:0', '40:12'] });
    }), 600000);

    it('leg 871 (from L39, (488,904)): the pre-wall plan (chaserSpinnerWalls OFF) SOLVES hitless and is the same hitless '
        + 'walk on the wall-ON model; ⛔ under the wall the search REFUSES at the burn stance — a LOST SOLVE (hammer hand-over)',
    () => withL40Flip(false, () => {
        const SOLVED = { ok: true, work: 2772, ticks: 1122, sha: 'aa43b331902e', hits: [], deaths: 0,
            burned: [TREE], clears: ['40:0', '40:12'] };
        // the pin this row held before the flip, asked of the pre-wall model
        expect(solveLeg('leg871-l39-l40-request.json.gz', true, { solveWalls: false, replayWalls: false })).toEqual(SOLVED);
        // the same plan on the wall-ON model (the game's, 0 px on p4g): every expected row, no hit, the tree, both clears
        expect(solveLeg('leg871-l39-l40-request.json.gz', true, { solveWalls: false, replayWalls: true })).toEqual(SOLVED);
        // ⛔ LOST SOLVE at the shipped default (the wall ON): a hitless plan exists (above) and the search does not find it
        const on = solveLeg('leg871-l39-l40-request.json.gz', true);
        expect(on.ok).toBe(false);
        expect(on.work).toBe(885);
        expect(on.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        expect(on.message).toContain('chaser:bob@736,752');
    }), 600000);
});
