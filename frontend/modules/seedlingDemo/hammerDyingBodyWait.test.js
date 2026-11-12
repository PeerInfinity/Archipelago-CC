/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE DYING-BODY-WAIT — a walk whose only danger is a DYING body waits out its "die" by the run's
 * own forecast (`DYING_BODY_WAIT`, OFF). Report: `CC/docs/cloud-reports/seedling-hammer-dying-body-wait.md`.
 *
 * The witness state is real but is NOT the leg's lost solve (the report's § 8): the page's request for L40 flag 12 from
 * L39 (`hammer-cleartag-chain/leg871-l39-l40-request.json.gz`, key `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13
 * -> location:L40 flag 12: wandlock@480,560 cleared`), solved under the train row's set, first takes a branch that
 * `OPP_PRESS_FALLBACK` later rewinds to t0. That branch's 724 keys (`fixtures/hammer-dying-body-wait/`, recorded by
 * `evidence/tools/witness724.mjs`) leave `bob@736,752` DYING (three hits, the last at t700) 6.8 px from the player, its
 * "die" ending at t725. The gate rows (a segment solved from there) are `hammerDyingBodyWait.slow.test.js`; the leg's own
 * refusal, ON = OFF, is `hammerDyingBodyWait.train.test.js`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    DYING_BODY_WAIT, dyingBodyLeavesAt, withChaserStagedHunt, withClearTagChain, withDyingBodyWait, withStanceBurn,
} from './solverBot.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const gz = (...p) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', ...p))).toString('utf8'));
const ENV = globalThis.process?.env ?? {};
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

describe('hammer-phase DYING-BODY-WAIT — the switch', () => {
    it('ships OFF, read from SEEDLING_DYING_BODY_WAIT, and is a name the solver-env channel carries', () => {
        expect(DYING_BODY_WAIT.enabled).toBe(ENV.SEEDLING_DYING_BODY_WAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DYING_BODY_WAIT');
        expect(withDyingBodyWait(true, () => DYING_BODY_WAIT.enabled)).toBe(true);
        expect(withDyingBodyWait(false, () => DYING_BODY_WAIT.enabled)).toBe(false);
    });
});

describe('hammer-phase DYING-BODY-WAIT — the forecast end (`dyingBodyLeavesAt`), on the branch state at t724', () => {
    it('the run\'s chaser forecast drops the dying body at forecast tick 1, the tick the live run sets `destroy`; a live '
        + 'body is still there at the bound', () => withSet(() => {
        const { args, keys } = branch();
        const run = replayTape({ ...args, perTick: keys });
        expect(run.ticksCompleted).toBe(724);
        const body = (r, id) => (r.entities('chasers') ?? []).find((c) => c.id === id);
        expect(body(run, DYING)).toMatchObject({ hits: 3, dying: true, destroy: false });
        expect(dyingBodyLeavesAt(run, [DYING], 60)).toEqual({ k: 1 });
        // a live body (two hits, not dying) never leaves a still forecast
        expect(body(run, 'bob@736,800')).toMatchObject({ hits: 2, dying: false });
        expect(dyingBodyLeavesAt(run, ['bob@736,800'], 60).k).toBe(null);
        // the live run agrees: one still tick and the "die" has ended
        run.advance(new Set());
        expect(body(run, DYING)).toMatchObject({ dying: true, destroy: true });
    }), 120000);
});
