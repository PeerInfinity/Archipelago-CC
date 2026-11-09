/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE L53-KILLLOCK — the L53 water-arena kill-lock (BK3) clears its chasers
 * (`solverBot.KILLLOCK_CHASER_REWIND`, OFF). ⚖ The user queued it on 2026-11-07 (ROUTE-WALLS-CENSUS W1).
 *
 * MEASURED at main `0d575b78ea` (`CC/docs/cloud-reports/seedling-hammer-l53-killlock.md`): the walk's L53 crossing
 * (`r2c2 → r9c10 → r14c9`, the census's hand-built legs 9001 from the L51 door and 9002 from the L48 door) meets
 * `lock@144,208`, which opens on `totalEnemies() == 0`; the kill-lock's chaser arm must kill three jellyfish and a
 * puncher one at a time. OFF, every stance `deriveKillByChaser` previews for this arm is refused *"the preview did not
 * settle"* (the arm asked at tolerance 0, the walk it drives arrives at `DEFAULT_TOLERANCE`), so the arm stands where
 * the walk stands and the dwell's bound runs out. ON, the arm asks at the walk's tolerance, a refused attempt is
 * rewound and the next scored stance tried, and a dying body's death window is stood out.
 *
 * The states are the page's own HELD-RETRY requests (budget 2560: the 640 first ask is deadline-bound both ways),
 * captured at `0d575b78ea`, their atlas records cut to levels 53 and 54 (byte-identical answers to the uncut capture,
 * OFF and ON). Each row runs the anytime solve's dashless pass, the pass every ON answer here comes from (the full
 * pass's upgrade window is cut, lossless); the worker's two passes are `hammerL53Killlock.train.test.js`.
 * ⚖ 30(c): each plan is replayed on a FRESH run of its staging and its hits read from that run.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    KILLLOCK_CHASER_REWIND, KILLLOCK_CHASER_REWIND_COUNTS, KILLLOCK_CHASER_REWIND_DEFAULT, KILLLOCK_CHASER_REWIND_TRIES,
    resetKillLockChaserRewindCounts, withKillLockChaserRewind,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-l53-killlock', name))).toString('utf8'));
const LEG_9001 = FIX('leg9001-l51-l53-retry2560-request.json.gz');
const LEG_9002 = FIX('leg9002-l48-l53-retry2560-request.json.gz');
const LEG_482 = FIX('leg482-l54-l53-request.json.gz');

/** A captured leg solved as the worker does, under the switch; the plan re-driven on a fresh run for its hits. */
function solveLeg(leg, { on, dashlessOnly = true }) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes: asked = ANYTIME_PASSES, source, ...tape } = req;
    const passes = dashlessOnly ? asked.filter((p) => p.pass === 'dashless') : asked;
    const levelSource = levelSourceFromAtlas(source.records);
    resetKillLockChaserRewindCounts();
    const answer = withKillLockChaserRewind(on, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    const tries = KILLLOCK_CHASER_REWIND_COUNTS.tries.map(({ id, t, stance, verdict }) => ({ id, t, stance, verdict }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? ''), tries };
    const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource, scratchPersistence: tape.scratchPersistence });
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    return { ok: true, ticks: answer.plan.solution.length, plan,
        planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12), verbs: answer.plan.verbs,
        level: fresh.level, hits: fresh.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
        deaths: fresh.ledger('playerDeaths').length, tries };
}

const J1 = 'jellyfish@144,192';
const J2 = 'jellyfish@152,168';
const J3 = 'jellyfish@184,160';
const P = 'puncher@136,96';

describe('hammer-phase L53-KILLLOCK — the L53 kill-lock\'s chaser arm (`KILLLOCK_CHASER_REWIND`)', () => {
    it('the switch ships OFF (`SEEDLING_KILLLOCK_CHASER_REWIND=1` turns it on in node; the page channel knows it)', () => {
        expect(KILLLOCK_CHASER_REWIND_DEFAULT).toBe(false);
        expect(KILLLOCK_CHASER_REWIND.enabled).toBe(ENV.SEEDLING_KILLLOCK_CHASER_REWIND === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILLLOCK_CHASER_REWIND');
        expect(KILLLOCK_CHASER_REWIND_TRIES).toBe(6);
    });

    it('9001 (from the L51 door): OFF the stand-here dwell runs out on the jellyfish; ON every body dies, 0 hits', () => {
        const off = solveLeg(LEG_9001, { on: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(new RegExp(`chaser kill \\(${J1}\\) by press: ${J1} is still in the world after `
            + 'the whole 174-tick bound \\(14 guard step\\(s\\)\\); it stands at \\(136\\.1,178\\.1\\), 22\\.5 px'));
        expect(off.tries).toEqual([]);
        const on = solveLeg(LEG_9001, { on: true });
        expect(on.ok).toBe(true);
        expect(on.ticks).toBe(933);
        expect(on.planSha).toBe('cc11c2c5a665');
        expect(on.verbs).toEqual(['break', 'kill', 'walk']);
        expect(on.level).toBe(54);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        // the arm's own first choice for J1 is hit in its wait and rewound; the next scored stance kills it. The
        // puncher's first stance is hit too; (136,120), on the corridor floor beside the Ice Wall corner, kills it.
        expect(on.tries).toEqual([
            { id: J1, t: 229, stance: { x: 120, y: 168 }, verdict: 'refused' },
            { id: J1, t: 229, stance: { x: 120, y: 152 }, verdict: 'killed' },
            { id: P, t: 424, stance: { x: 120, y: 136 }, verdict: 'refused' },
            { id: P, t: 424, stance: { x: 136, y: 120 }, verdict: 'killed' },
            { id: J3, t: 519, stance: expect.any(Object), verdict: 'killed' },
        ]);
    }, 120_000);

    it('9002 (from the L48 door): OFF the held retry is spent in the chaser scans; ON every body dies, 0 hits', () => {
        const off = solveLeg(LEG_9002, { on: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/⏱ DEADLINE: the caller's `shouldStop` tripped \(first at `kill-chaser`\)/);
        const on = solveLeg(LEG_9002, { on: true });
        expect(on.ok).toBe(true);
        expect(on.ticks).toBe(906);
        expect(on.planSha).toBe('bf6a54ee9d41');
        expect(on.level).toBe(54);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.tries.filter((r) => r.verdict === 'killed').map((r) => r.id)).toEqual([J2, J1, J3, P]);
        expect(on.tries.every((r) => r.verdict === 'killed' || r.verdict === 'refused')).toBe(true);
    }, 120_000);

    it('9001 at the page\'s FIRST budget (640): ON is deadline-bound and says so — the attempt the trip refused is '
        + 'raised as OFF raises it, not rewound', () => {
        const req = restoreRequest(LEG_9001.requests[0].request);
        const { passes: asked, source, ...tape } = req;
        resetKillLockChaserRewindCounts();
        const answer = withKillLockChaserRewind(true, () => solveAnytime(
            { ...tape, budgetWork: 640, source, levelSource: levelSourceFromAtlas(source.records) },
            { passes: asked.filter((p) => p.pass === 'dashless') }));
        expect(answer.ok).toBe(false);
        expect(String(answer.message)).toMatch(/^solverBot\(wasm-exit-53\): the caller's anytime deadline \(`shouldStop`\) was reached at the `walk` site/);
        expect(String(answer.message)).not.toMatch(/each rewound/);
        expect(KILLLOCK_CHASER_REWIND_COUNTS.tries.map((r) => r.verdict))
            .toEqual(['refused', 'killed', 'refused', 'killed', 'deadline']);
    }, 60_000);

    it('482 (L53 r14c9 from the L54 door, the control): ON answers OFF\'s plan byte for byte, the arm never asked', () => {
        const off = solveLeg(LEG_482, { on: false, dashlessOnly: false });
        const on = solveLeg(LEG_482, { on: true, dashlessOnly: false });
        expect(off.ok && on.ok).toBe(true);
        expect(off.ticks).toBe(5);
        expect(on.plan).toBe(off.plan);
        expect(on.hits).toEqual([]);
        expect(on.tries).toEqual([]);
    }, 60_000);
});
