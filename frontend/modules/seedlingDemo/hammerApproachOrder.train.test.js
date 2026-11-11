/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BK2-APPROACH-ORDER (train tier) — L40's Boss Key 2 inside the page's held-retry budget,
 * with `approachKillForCorpse`'s tries asked in the volley's order (`TURRET_APPROACH_VOLLEY_ORDER`, OFF).
 *
 * The states are the page's own held-retry requests (budget 2,560) for the two Boss Key 2 legs, captured on the p4g
 * page at `1f8fc08ec3` (the L40 flip's defaults) with the route's door carried (`--carry-route-flags`: {40,12} staged),
 * atlas records cut to level 40 (`fixtures/hammer-bk2-approach-order/`):
 *   - `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` (arrival (488,904));
 *   - `level_40__r32c36 <- in_L43_176_464 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` (arrival (328,600)).
 *
 * From L39 the approach to `iceturret@472,400` is asked from (488,579): OFF its hitless try is the 276th (the right
 * side's corridor, wait 29) and the solve costs 3,236 work units, so the page's `solveAnytime` refuses at 2,560 on the
 * `crusher-fork` site. ON the same try is the 70th (12 probes, then rank 5 off the anchor 32) and the same plan costs
 * 1,382. From L43 OFF solves inside the budget on another side (its 27th try); ON finds the right side's corridor at
 * its anchor first (rank 0) — another plan, hitless too. Each plan is re-driven on a FRESH run (⚖ 30(c)).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape, settleSolve, solveAnytime, solveFromTape } from './jsRuntimeSolver.js';
import { TURRET_APPROACH_COUNTS, resetTurretApproachCounts, withTurretApproachVolleyOrder } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-bk2-approach-order', name)))
    .toString('utf8'));
const L39 = 'leg873-l39-l40-bk2-request.json.gz';
const L43 = 'leg874-l43-l40-bk2-request.json.gz';
const FLAG8 = 'leg398-l39-l40-flag8-request.json.gz';
const TURRET = 'iceturret@472,400';
const TIMEOUT = 600_000;
const BUDGET = 2560;

const digest = (plan) => createHash('sha1').update(JSON.stringify(plan.solution.map((k) => [...k])))
    .digest('hex').slice(0, 12);

/**
 * The page's own solve of the fixture's request (`solveAnytime` at its captured budget), the switch at `on`.
 * `approaches` is every pass's (`TURRET_APPROACH_COUNTS`): `[0]` is the dashless pass's, the one the rows pin; the full
 * pass, run inside its upgrade window with a plan in hand, asks its own approach from its own arrival tick.
 */
function pageSolve(name, on) {
    const req = restoreRequest(FIX(name).requests[0].request);
    expect(req.budgetWork).toBe(BUDGET);
    const { passes, source, ...tape } = req;
    resetTurretApproachCounts();
    const answer = withTurretApproachVolleyOrder(on, () => solveAnytime({ ...tape,
        levelSource: levelSourceFromAtlas(source.records) }, { passes }));
    return { answer, approaches: [...TURRET_APPROACH_COUNTS.approaches], tape, source };
}

/** The request's dashless pass with the budget lifted, the switch at `on`: the work it takes, counted. */
function uncapped(name, on) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX(name).requests[0].request);
    let work = 0;
    resetTurretApproachCounts();
    const answer = withTurretApproachVolleyOrder(on, () => settleSolve(() => solveFromTape({ ...tape,
        levelSource: levelSourceFromAtlas(source.records), dashMode: 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return false; } })));
    return { answer, work, approaches: [...TURRET_APPROACH_COUNTS.approaches], tape, source };
}

/** A plan re-driven on a FRESH run of the staging (⚖ 30(c)): its rows (the last one the goal's), its hits and deaths, the turret. */
function drive({ answer, tape, source }, clears = false) {
    const { plan } = answer;
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
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
    if (clears) return { hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length,
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() };
    return { hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length,
        turretDead: run.entities('turrets').get(TURRET)?.dead === true, kills: run.ledger('turretKills').length };
}

describe('hammer-phase BK2-APPROACH-ORDER — L40 Boss Key 2 from L39 (the page\'s held retry, 2,560 units)', () => {
    let offDigest = null;

    it('OFF: the page\'s solve runs out of its 2,560 units at the `crusher-fork` site, inside the approach\'s tries', () => {
        const s = pageSolve(L39, false);
        expect(s.answer.ok).toBe(false);
        expect(s.answer.kind).toBe('refusal');
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: false, deadline: 'crusher-fork', limit: 'budget' });
        expect(s.answer.passes[0].work).toBe(BUDGET + 1);
        expect(s.approaches).toEqual([]); // no try had won when the budget ended
    }, TIMEOUT);

    it('OFF with the budget lifted: 3,236 units — the hitless try is the 276th (right, the corridor, wait 29)', () => {
        const s = uncapped(L39, false);
        expect(s.answer.ok).toBe(true);
        expect(s.work).toBe(3235);
        expect(s.answer.plan.solution.length).toBe(4491);
        expect(s.approaches).toEqual([{ turret: TURRET, t: 563, side: 'right', via: null, wait: 29, forks: 276 }]);
        offDigest = digest(s.answer.plan);
    }, TIMEOUT);

    it('ON: SOLVED inside the budget — the same try, the 70th (anchor 32, rank 5); OFF\'s plan; hitless on a fresh run', () => {
        const s = pageSolve(L39, true);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: true, ticks: 4491 });
        expect(s.answer.passes[0].work).toBe(1381);
        expect(s.answer.passes[0].work).toBeLessThan(BUDGET);
        expect(s.answer.plan.verbs).toEqual(['shove', 'walk', 'weigh']);
        expect(s.approaches[0]).toEqual({ turret: TURRET, t: 563, side: 'right', via: null, wait: 29, forks: 70,
            order: 'volley', anchor: 32, rank: 5 });
        expect(s.approaches.every((a) => a.order === 'volley')).toBe(true);
        expect(s.answer.pass).toBe('dashless'); // the plan the page plays
        expect(digest(s.answer.plan)).toBe(offDigest);
        expect(drive(s)).toEqual({ hits: 0, deaths: 0, turretDead: true, kills: 1 });
    }, TIMEOUT);
});

describe('hammer-phase BK2-APPROACH-ORDER — L40 Boss Key 2 from L43: the ON radius\'s "another plan, same verdict" row', () => {
    it('OFF: solved inside the budget on the push side\'s via, wait 25 (its 27th try), 4,519 ticks, hitless', () => {
        const s = pageSolve(L43, false);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: true, ticks: 4519, work: 1020 });
        expect(s.approaches[0]).toEqual({ turret: TURRET, t: expect.any(Number), side: 'up', via: { x: 466, y: 445 },
            wait: 25, forks: 27 });
        expect([s.answer.pass, s.answer.plan.solution.length]).toEqual(['full', 4306]); // the plan the page plays
        expect(drive(s)).toEqual({ hits: 0, deaths: 0, turretDead: true, kills: 1 });
    }, TIMEOUT);

    it('ON: the right side\'s corridor at its anchor (wait 35, rank 0, the 8th fork), 4,527 ticks, fewer units, hitless', () => {
        const s = pageSolve(L43, true);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: true, ticks: 4527, work: 834 });
        expect(s.approaches[0]).toEqual({ turret: TURRET, t: expect.any(Number), side: 'right', via: null, wait: 35,
            forks: 8, order: 'volley', anchor: 35, rank: 0 });
        expect([s.answer.pass, s.answer.plan.solution.length]).toEqual(['full', 4308]); // the plan the page plays
        expect(drive(s)).toEqual({ hits: 0, deaths: 0, turretDead: true, kills: 1 });
    }, TIMEOUT);
});

describe('hammer-phase BK2-APPROACH-ORDER — L40 flag 8 (`bosslock@480,352`) from L39: the same approach under the keylock', () => {
    let offDigest = null;

    it('OFF: solved 26 units inside the budget — the approach\'s 276th try again (right, the corridor, wait 29)', () => {
        const s = pageSolve(FLAG8, false);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: true, ticks: 718, work: 2533 });
        expect(s.approaches[0]).toEqual({ turret: TURRET, t: expect.any(Number), side: 'right', via: null, wait: 29,
            forks: 276 });
        offDigest = digest(s.answer.plan);
    }, TIMEOUT);

    it('ON: the same plan at about a quarter of the units (anchor 32, rank 5, the 70th fork), hitless on a fresh run', () => {
        const s = pageSolve(FLAG8, true);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.passes[0]).toMatchObject({ pass: 'dashless', ok: true, ticks: 718, work: 679 });
        expect(s.approaches[0]).toEqual({ turret: TURRET, t: expect.any(Number), side: 'right', via: null, wait: 29,
            forks: 70, order: 'volley', anchor: 32, rank: 5 });
        expect(digest(s.answer.plan)).toBe(offDigest);
        expect(drive(s, true)).toEqual({ hits: 0, deaths: 0, clears: ['40:8'] });
    }, TIMEOUT);
});
