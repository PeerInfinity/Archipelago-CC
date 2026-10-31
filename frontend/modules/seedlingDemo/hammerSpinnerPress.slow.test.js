/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SPIN — `PRESS_ESCAPE_SHIELD_CLAIM` on leg 860 (the slow rows; the fast ones are
 * `hammerSpinnerPress.test.js`). Leg 860 = `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> Boss Key 2`, its
 * captured request 860/1 at L40C's seam 5950 under L40C's arm A5 (CPAIR-3, ICEST, OPP, LWF, `orbitFreeAim`, SBD), the
 * anytime deadline lifted to 10240 work units (`L40C_BUDGET_WORK`): the arm and budget at which L40C ranked
 * `spinner@816,848`'s press kill the FIRST wall.
 *
 * ⚖ 30(c): ON's kill is the walk driven — its keys, handed out by `PRESS_KILL_DONE_TRACE` when the last counted body
 * goes, are replayed on a FRESH run from the request's staging, and the body is gone there too.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { levelSourceFromAtlas } from './atlasSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import {
    PRESS_ESCAPE_SHIELD_CLAIM_COUNTS, PRESS_KILL_DONE_TRACE, resetPressEscapeShieldClaimCounts,
    withPressEscapeShieldClaim,
} from './pressKillGuards.js';
import { CHOOSER_PAIR, withChooserPair, withIceTurretStaticKill, withLatchWeighFirst } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPIN_BODY = 'spinner@816,848';
const BUDGET = 10240;

/** Leg 860's captured request 860/1, its seam re-stamped to L40C's 5950 (the fast file's loader, one copy each). */
function leg860Request(seam = 5950) {
    const row = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'spin-witness', 'leg860-request.json.gz')))
        .toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: seam } } });
}

/** L40C's arm A5, inside the switches' own scopes (CHOOSER_PAIR's size 3 is its measurement arm, restored after). */
function underA5(fn, { icest = true } = {}) {
    const size = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = 3;
    try {
        return withChooserPair(true, () => withIceTurretStaticKill(icest, () => withOpportunisticStrike(true,
            () => withLatchWeighFirst(true, () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true },
                fn)))));
    } finally {
        CHOOSER_PAIR.size = size;
    }
}

/** Solve 860/1 (seam 5950, `BUDGET`) and keep every press kill that completed. */
function solve860(on, opts) {
    const { passes = ANYTIME_PASSES, source, ...tape } = leg860Request();
    const kills = [];
    PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
    resetPressEscapeShieldClaimCounts();
    try {
        const answer = underA5(() => withPressEscapeShieldClaim(on, () => solveAnytime({ ...tape, budgetWork: BUDGET,
            source, levelSource: levelSourceFromAtlas(source.records) }, { passes })), opts);
        return { answer, kills, counts: { ...PRESS_ESCAPE_SHIELD_CLAIM_COUNTS }, tape, source };
    } finally {
        PRESS_KILL_DONE_TRACE.sink = null;
    }
}

describe('hammer-phase SPIN — leg 860, A5, deadline 10240, seam 5950', () => {
    it('OFF: the press kill of spinner@816,848 corners at (770.96,860.99), 19 t after the landing at t2744 (L40C\'s wall)', () => {
        const { answer, kills } = solve860(false);
        expect(answer.ok).toBe(false);
        expect(answer.message).toMatch(/kill \(spinner@816,848\) by press: every key set — the plan's own and 5 alternative\(s\) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at \(770\.96,860\.99\) in level 40\. There is no step out\. The corner formed 19 tick\(s\) after the press on spinner@816,848 LANDED at t2744/);
        expect(kills.some((k) => k.bodies.includes(SPIN_BODY))).toBe(false);
    }, 900_000);

    it('ON: the kill completes (three landings), and its keys replayed on a fresh run kill the body with no death', () => {
        const { kills, counts, tape, source } = solve860(true);
        const mine = kills.filter((k) => k.bodies.includes(SPIN_BODY));
        expect(mine.length).toBeGreaterThan(0);
        expect(counts.certified).toBeGreaterThan(0);
        expect(counts.exhausted).toBeGreaterThan(0);
        const k = mine[0];
        expect(k.landings.filter((l) => l.id === SPIN_BODY).length).toBe(3);
        const run = replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records),
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        // the segment's slot selections ride beside the keys (a tape's `equips`): applied where the live run fired them
        const fired = (t) => (run.equipsFired ?? []).some((e) => e.t === t);
        for (let i = 0; i < k.perTick.length; i += 1) {
            for (const e of k.equips.filter((q) => q.t === i)) if (!fired(i)) run.equipNow(e.slot);
            run.advance(k.perTick[i]);
        }
        expect(run.level).toBe(40);
        expect((run.entities('spinnerBodies') ?? []).some((b) => b.id === SPIN_BODY)).toBe(false);
        expect(run.playerDeaths.length).toBe(0);
        expect((run.ledger('spinnerPressHits') ?? []).filter((h) => h.landed && h.id === SPIN_BODY).map((h) => h.t))
            .toEqual(k.landings.filter((l) => l.id === SPIN_BODY).map((l) => l.t));
    }, 900_000);
});
