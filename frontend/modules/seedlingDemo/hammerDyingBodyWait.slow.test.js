/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE DYING-BODY-WAIT — a walk whose only danger is a DYING body waits out its "die" by the run's
 * own forecast (`DYING_BODY_WAIT`, OFF). Report: `CC/docs/cloud-reports/seedling-hammer-dying-body-wait.md`.
 *
 * The witness state is real but is NOT the leg's lost solve (the report's § 8): the page's request for L40 flag 12 from
 * L39 (`hammer-cleartag-chain/leg871-l39-l40-request.json.gz`, key `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13
 * -> location:L40 flag 12: wandlock@480,560 cleared`), solved under the train row's set, first takes a branch that
 * `OPP_PRESS_FALLBACK` later rewinds to t0. That branch's 724 keys (`fixtures/hammer-dying-body-wait/`, recorded by
 * `evidence/tools/witness724.mjs`) leave `bob@736,752` DYING (three hits, the last at t700) 6.8 px from the player, its
 * "die" ending at t725. A segment solved from there meets the walk's start gate first — the site these rows witness (slow
 * tier: ~20 s, serial).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    DYING_BODY_WAIT_COUNTS, solveSegment, withChaserStagedHunt, withClearTagChain, withDyingBodyWait, withStanceBurn,
} from './solverBot.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { forkRunFor, replayTape, solverGoalsOf } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const gz = (...p) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', ...p))).toString('utf8'));
const DYING = 'bob@736,752';

/** The train row's set (hammerClearTagChain.train) around `fn`, under `withL40Flip(false)`. */
const withSet = (fn) => withL40Flip(false, () => withClearTagChain(true, () => withStanceBurn(true,
    () => withOpportunisticStrike(true, () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, fn)))))));

/** The request's staging and the recorded branch: `{args, keys, tape, levelSource}`. */
function branch() {
    const { source, ...tape } = restoreRequest(gz('hammer-cleartag-chain', 'leg871-l39-l40-request.json.gz').requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    const keys = gz('hammer-dying-body-wait', 'leg871-branch724-keys.json.gz').keys.map((k) => new Set(k));
    const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: null,
        holds: null };
    return { args, keys, tape };
}

const resetCounts = () => {
    DYING_BODY_WAIT_COUNTS.asked = 0;
    DYING_BODY_WAIT_COUNTS.kept.length = 0;
    DYING_BODY_WAIT_COUNTS.refused.length = 0;
};

/** A segment solved from the branch's state with the arm at `on`: `{message, work, counts}` (it refuses both ways). */
function solveFromBranch(on) {
    const { args, keys, tape } = branch();
    const run = replayTape({ ...args, perTick: keys });
    resetCounts();
    let work = 0;
    let err = null;
    withSet(() => withDyingBodyWait(on, () => {
        try {
            solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'w724', boot: tape.staging.boot, prefix: keys,
                dashMode: 'none', forkRun: forkRunFor({ ...args, prefixLength: keys.length }),
                shouldStop: () => { work += 1; return false; }, fineCheckpoints: true });
        } catch (e) { err = e; }
    }));
    return { message: err ? String(err.message).split('\n')[0] : null, work,
        counts: JSON.parse(JSON.stringify(DYING_BODY_WAIT_COUNTS)) };
}

describe('hammer-phase DYING-BODY-WAIT — the walk\'s start gate, from the branch state', () => {
    it('OFF: the gate refuses naming the dying body; ON: one still tick (the forecast\'s), the body gone, and the gate '
        + 'asked again names what is left — spinner@880,848\'s live body', () => {
        const off = solveFromBranch(false);
        expect(off.work).toBe(193);
        expect(off.message).toContain('-> burn stance (burnabletree@872,784): the danger map forbids '
            + '(743.9387479985102,799.0456514925321) — chaser:bob@736,752 (inside leash 80 (d=6.8)');
        expect(off.message).not.toContain('DYING_BODY_WAIT');
        expect(off.counts).toEqual({ asked: 0, kept: [], refused: [] });

        const on = solveFromBranch(true);
        expect(on.work).toBe(194);
        expect(on.message).toContain('-> burn stance (burnabletree@872,784): the danger map forbids '
            + '(743.9387479985102,801.095651492532) — spinner:spinner@880,848 (a live Spinner BODY at (743.3,806.2)');
        expect(on.message).not.toContain(DYING);
        expect(on.counts.asked).toBe(1);
        expect(on.counts.refused).toEqual([]);
        expect(on.counts.kept).toEqual([expect.objectContaining({ site: 'gate', ids: [DYING], ticks: 1, from: 724,
            clean: false })]);
    }, 300000);
});
