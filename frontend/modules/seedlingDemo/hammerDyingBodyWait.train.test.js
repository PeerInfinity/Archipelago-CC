/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE DYING-BODY-WAIT (train tier) — the leg's OWN refusal is untouched by the arm: its blocker
 * is a LIVE body. Report: `CC/docs/cloud-reports/seedling-hammer-dying-body-wait.md` § 3 and § 8.
 *
 * The page's request for L40 flag 12 from L39 (`hammer-cleartag-chain/leg871-l39-l40-request.json.gz`, key
 * `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`), solved as
 * `hammerClearTagChain.train` solves it (the census's minimal set, the dashless pass, uncapped). Measured: the first
 * branch's spinner press refuses `HAMMER_SAFETY` at t724 ("no step out"), `OPP_PRESS_FALLBACK` rewinds it to t0 and
 * redoes the kill with OPP off (826 ticks), and the burn stance's ladder then refuses naming `bob@736,752` ALIVE (no hit
 * taken in that branch). So the arm is never asked and the refusal is the same string, ON and OFF.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { DYING_BODY_WAIT_COUNTS, withChaserStagedHunt, withClearTagChain, withDyingBodyWait, withStanceBurn } from './solverBot.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-chain',
    'leg871-l39-l40-request.json.gz'))).toString('utf8'));

/** The leg's dashless pass under the train row's set, uncapped, the arm at `on`: `{ok, work, message, asked}`. */
function solveLeg(on) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    DYING_BODY_WAIT_COUNTS.asked = 0;
    let work = 0;
    const answer = withL40Flip(false, () => withClearTagChain(true, () => withStanceBurn(true,
        () => withOpportunisticStrike(true, () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
            () => withContactFidelity({ forecastShieldBump: true }, () => withDyingBodyWait(on,
                () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
                    fineCheckpoints: true, shouldStop: () => { work += 1; return false; } }))))))))));
    return { ok: answer.ok, work, message: answer.message ?? null, asked: DYING_BODY_WAIT_COUNTS.asked };
}

describe('hammer-phase DYING-BODY-WAIT (train) — leg 871\'s own refusal names a LIVE body', () => {
    it('OFF and ON refuse alike at work 885, the arm never asked (the blocker is not dying)', () => {
        const off = solveLeg(false);
        expect(off.ok).toBe(false);
        expect(off.work).toBe(885);
        expect(off.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        expect(off.message).toContain('chaser:bob@736,752');
        const on = solveLeg(true);
        expect(on).toEqual({ ...off, asked: 0 });
    }, 600000);
});
