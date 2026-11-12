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
    resetKillLockChaserRewindCounts, withKillLockChaserRewind, withKillLockLineStance,
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

/** A captured leg solved as the worker does, under the switch; the plan re-driven on a fresh run for its hits.
 *  `KILLLOCK_LINE_STANCE` is held OFF (since the kill-lock flip it ships ON): these rows pin REWIND alone. */
function solveLeg(leg, { on, dashlessOnly = true }) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes: asked = ANYTIME_PASSES, source, ...tape } = req;
    const passes = dashlessOnly ? asked.filter((p) => p.pass === 'dashless') : asked;
    const levelSource = levelSourceFromAtlas(source.records);
    resetKillLockChaserRewindCounts();
    const answer = withKillLockLineStance(false, () => withKillLockChaserRewind(on, () => solveAnytime({ ...tape, source, levelSource }, { passes })));
    const tries = KILLLOCK_CHASER_REWIND_COUNTS.tries.map(({ id, t, stance, verdict }) => ({ id, t, stance, verdict }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? ''), tries };
    const fresh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource, scratchPersistence: tape.scratchPersistence });
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    return { ok: true, ticks: answer.plan.solution.length, plan,
        planSha: createHash('sha1').update(plan).digest('hex').slice(0, 12), verbs: answer.plan.verbs,
        level: fresh.level, hits: fresh.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
        deaths: fresh.ledger('playerDeaths').length, tries,
        kills: fresh.chaserKills.map(({ t, id, by, weapon }) => ({ t, id, by, weapon })),
        terrainDeaths: fresh.chaserTerrainDeaths.length,
        lockOpenAt: fresh.ledger('chaserKillLockOpens').find((o) => o.opens.length > 0)?.t ?? null,
        crossedAt: fresh.transitions.find((x) => x.from_level === 53 && x.to_level === 54)?.t ?? null };
}

const J1 = 'jellyfish@144,192';
const J2 = 'jellyfish@152,168';
const J3 = 'jellyfish@184,160';
const P = 'puncher@136,96';

describe('hammer-phase L53-KILLLOCK — the L53 kill-lock\'s chaser arm (`KILLLOCK_CHASER_REWIND`)', () => {
    it('the switch ships ON since the kill-lock flip (`SEEDLING_KILLLOCK_CHASER_REWIND=0` turns it off in node; the page channel knows it)', () => {
        expect(KILLLOCK_CHASER_REWIND_DEFAULT).toBe(true);
        expect(KILLLOCK_CHASER_REWIND.enabled).toBe(ENV.SEEDLING_KILLLOCK_CHASER_REWIND !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILLLOCK_CHASER_REWIND');
        expect(KILLLOCK_CHASER_REWIND_TRIES).toBe(6);
    });

    it('9001 (from the L51 door): OFF the stand-here dwell is hit by the jellyfish; ON the count reaches 0 (all four '
        + 'die to sword presses, J2/J1 after the arm\'s refused attempts on them), 0 hits', () => {
        // ⛓ re-pinned at fidelity KNOCKBACK376's re-merge (train 55, `rockGoneFencepost` ON): L53's first chaser body is
        // now J2, and the dwell on it is hit by J1 (was: J1's 174-tick bound ran out).
        const off = solveLeg(LEG_9001, { on: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(new RegExp(`chaser kill \\(${J2}\\) by press: the dwell was HIT at dwell tick 145 `
            + `\\(run tick 374; source chaser ${J1}; 14 guard step\\(s\\) so far\\)`));
        expect(off.tries).toEqual([]);
        const on = solveLeg(LEG_9001, { on: true });
        expect(on.ok).toBe(true);
        expect(on.ticks).toBe(768);
        expect(on.planSha).toBe('c4360b3cadd1');
        expect(on.verbs).toEqual(['break', 'kill', 'walk']);
        expect(on.level).toBe(54);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        // the arm's stances for J2 and J1 are each hit in their wait and rewound; the puncher's second stance (136,120),
        // on the corridor floor beside the Ice Wall corner, kills it, and J3's second kills it. J2 and J1 then die to
        // sword presses on the fresh run (below) — the count reaches 0 though the arm logged no kill for either.
        expect(on.tries).toEqual([
            { id: J2, t: 229, stance: { x: 120, y: 152 }, verdict: 'refused' },
            { id: J2, t: 229, stance: { x: 136, y: 168 }, verdict: 'refused' },
            { id: J1, t: 229, stance: { x: 136, y: 168 }, verdict: 'refused' },
            { id: P, t: 229, stance: { x: 120, y: 136 }, verdict: 'refused' },
            { id: P, t: 229, stance: { x: 136, y: 120 }, verdict: 'killed' },
            { id: J3, t: 311, stance: { x: 184, y: 152 }, verdict: 'refused' },
            { id: J3, t: 311, stance: { x: 200, y: 152 }, verdict: 'killed' },
        ]);
        // ⚖ hammer-3's condition: every counted body is GONE before the L54 crossing, each by name and cause.
        expect(on.kills).toEqual([
            { t: 280, id: P, by: 'press', weapon: 'sword' },
            { t: 439, id: J2, by: 'press', weapon: 'sword' },
            { t: 501, id: J3, by: 'press', weapon: 'sword' },
            { t: 534, id: J1, by: 'press', weapon: 'sword' },
        ]);
        expect(on.terrainDeaths).toBe(0);
        expect(on.lockOpenAt).toBe(580);
        expect(on.crossedAt).toBe(768);
    }, 120_000);

    it('9002 (from the L48 door): OFF the chaser kill runs out its bound; ON every body dies, 0 hits', () => {
        // ⛓ re-pinned at fidelity KNOCKBACK376's re-merge (train 55): was the held retry spent in the chaser scans.
        const off = solveLeg(LEG_9002, { on: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(new RegExp(`chaser kill \\(${J2}\\) by press: ${J2} is still in the world after `
            + 'the whole 174-tick bound \\(6 guard step\\(s\\)\\); it stands at \\(145\\.3,167\\.4\\), 24\\.6 px'));
        const on = solveLeg(LEG_9002, { on: true });
        expect(on.ok).toBe(true);
        expect(on.ticks).toBe(959);
        expect(on.planSha).toBe('eccbf63f23e1');
        expect(on.level).toBe(54);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.tries.filter((r) => r.verdict === 'killed').map((r) => r.id)).toEqual([P, J2, J1, J3]);
        expect(on.tries.every((r) => r.verdict === 'killed' || r.verdict === 'refused')).toBe(true);
    }, 120_000);

    it('9001 at budget 960: ON is deadline-bound and says so — the attempt the trip refused is '
        + 'raised as OFF raises it, not rewound', () => {
        // ⛓ re-pinned at fidelity KNOCKBACK376's re-merge (train 55): at the page's first budget (640) no attempt trips
        // any more (both are refused and rewound, the trip lands in later scans), so the property is witnessed where an
        // attempt still carries the 'deadline' verdict — measured: 880–1120 all give this exact verdict list.
        const req = restoreRequest(LEG_9001.requests[0].request);
        const { passes: asked, source, ...tape } = req;
        resetKillLockChaserRewindCounts();
        const answer = withKillLockLineStance(false, () => withKillLockChaserRewind(true, () => solveAnytime(
            { ...tape, budgetWork: 960, source, levelSource: levelSourceFromAtlas(source.records) },
            { passes: asked.filter((p) => p.pass === 'dashless') })));
        expect(answer.ok).toBe(false);
        expect(String(answer.message)).toMatch(/^solverBot\(wasm-exit-53\): the caller's anytime deadline \(`shouldStop`\) was reached at the `walk` site/);
        expect(String(answer.message)).not.toMatch(/each rewound/);
        expect(KILLLOCK_CHASER_REWIND_COUNTS.tries.map((r) => r.verdict))
            .toEqual(['refused', 'refused', 'refused', 'refused', 'killed', 'deadline']);
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
