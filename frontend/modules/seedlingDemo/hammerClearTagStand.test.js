/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE CLEARTAG-STAND — the clear-tag arm's keylock hold, priced at the defaults
 * (`CLEARTAG_STAND`, OFF). ⚖ The user queued this on 2026-11-02 (planner `seedling-hammer-phase-planning-2`), from
 * AXIS-L12HITS's residue: `execClearTag` walks to a keylock's stance certified in TRANSIT only, then `execKeylock`
 * stands for the hold (110 ticks on L12's bosslocks). Only the frontier arm carried the hold as the walk's tail
 * (`keylockStandWalk`, L30KEYLOCK); AXIS-L12HITS gave this arm the tail under `AXIS_STRIKE` alone (`axisClearTagStand`).
 *
 * MEASURED at main `31ce3077a1` (`CC/docs/cloud-reports/seedling-hammer-cleartag-stand.md`): all 14 L12 bosslock legs
 * walk the same last corridor (344,184) → (376,264) → (424|440,264). On 8 of them (from L0/L33/L36/L88) the transit is
 * punched at x≈401, so the ladder climbs and the kill rung clears `puncher@416,256` first. On the 6 from L35/L95 the
 * transit passes between punches, no rung climbs, and the puncher punches the standing player twice in the hold —
 * billed by the model at the game's own ticks (`exact: true`), never certified (⚖ 30(c)).
 *
 * The state is the page's own request: leg 127 (`level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 4:
 * bosslock@416,240 cleared`) and leg 105 (`… <- in_L0_304_176 -> … flag 4 …`), captured at `31ce3077a1`, their atlas
 * records cut to level 12 (byte-identical answers to the uncut captures, OFF and ON). OFF leg 127 takes the two punches
 * (t433, t474); ON its walk's probe meets the punch, the kill runs first, and it takes none. Leg 105 is OFF's either way.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import {
    axisClearTagStand, CLEARTAG_STAND, CLEARTAG_STAND_DEFAULT, clearTagKeylockStand, clearTagStandWalk,
    KEYLOCK_WAIT_PRICED, withClearTagStand, withKeylockWaitPriced,
} from './solverBot.js';
import { withAxisStrike } from './pressKillCost.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-stand', name)))
    .toString('utf8'));
const LEG_L35 = FIX('leg127-l35-l12-request.json.gz');
const LEG_L0 = FIX('leg105-l0-l12-request.json.gz');
const PUNCHER = 'puncher@416,256';
/** The defaults' hits on leg 127, measured (the page sweep's `exact` rows at t433 / t474 = the model's). */
const L35_OFF_HITS = [[433, 'punch', PUNCHER], [474, 'punch', PUNCHER]];

/** A captured leg solved as the worker does, the switch at `on`; the model's hits re-driven from the plan. */
function solveLeg(leg, on) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource12 = levelSourceFromAtlas(source.records);
    const answer = withClearTagStand(on, () => solveAnytime({ ...tape, source, levelSource: levelSource12 }, { passes }));
    expect(answer.ok).toBe(true);
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource: levelSource12, scratchPersistence: tape.scratchPersistence });
    return { ticks: answer.plan.solution.length, plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
        hits: shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]) };
}

const l12 = () => createLevelRun({
    levelSource: atlasLevelSource(), boot: { level: 12, x: 376, y: 264 }, noclip: false, noHazards: [], noDamage: false,
    grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
});
/** The clear-tag resolution of L12's `bosslock@416,240` (its key line `{x0: 418, x1: 427, y: 257}`), as measured. */
const RESOLVED = { lock: 'bosslock@416,240', hold: { ticks: 110 }, target: { x: 416, y: 240 }, stance: { x: 424, y: 264 } };

describe('hammer-phase CLEARTAG-STAND — the clear-tag keylock hold priced at the defaults (`CLEARTAG_STAND`)', () => {
    it('ships OFF (`SEEDLING_CLEARTAG_STAND=1` turns it on in node; the page channel knows the name)', () => {
        expect(CLEARTAG_STAND_DEFAULT).toBe(false);
        expect(CLEARTAG_STAND.enabled).toBe(ENV.SEEDLING_CLEARTAG_STAND === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CLEARTAG_STAND');
        expect(withClearTagStand(true, () => CLEARTAG_STAND.enabled)).toBe(true);
        expect(CLEARTAG_STAND.enabled).toBe(ENV.SEEDLING_CLEARTAG_STAND === '1');
    });

    it('the clear-tag site\'s options: OFF `axisClearTagStand`\'s (`{}` unless AXIS), ON the hold\'s 110-tick tail', () => {
        const run = l12();
        const site = (cleartag, axis, verb = 'keylock') => withClearTagStand(cleartag,
            () => withAxisStrike(axis, () => clearTagStandWalk(run, verb, RESOLVED)));
        // OFF both: nothing is handed to the walk (OFF byte-identical).
        expect(site(false, false)).toEqual({});
        // ON: the one helper's tail, the hold's own length, stood as `execKeylock` stands.
        const on = site(true, false);
        expect(on.stand?.ticks).toBe(110);
        expect(typeof on.stand.keys).toBe('function');
        // AXIS's behaviour is unchanged: `axisClearTagStand` is the same helper behind `AXIS_STRIKE`.
        expect(site(false, true).stand?.ticks).toBe(110);
        expect(withAxisStrike(false, () => axisClearTagStand(run, 'keylock', RESOLVED))).toEqual({});
        expect(withAxisStrike(true, () => axisClearTagStand(run, 'keylock', RESOLVED)).stand?.ticks).toBe(110);
        // another verb, or the tail's own instrument off: nothing, ON or not.
        expect(site(true, false, 'kill')).toEqual({});
        expect(withKeylockWaitPriced(false, () => site(true, false))).toEqual({});
        expect(withKeylockWaitPriced(false, () => clearTagKeylockStand(run, 'keylock', RESOLVED))).toEqual({});
        expect(KEYLOCK_WAIT_PRICED.enabled).toBe(ENV.SEEDLING_KEYLOCK_WAIT_PRICED !== '0');
    });

    it('L35 leg 127: OFF the hold is punched twice; ON the kill runs first and it takes 0 hits', () => {
        const off = solveLeg(LEG_L35, false);
        expect(off.hits).toEqual(L35_OFF_HITS);
        expect(off.ticks).toBe(494);
        const on = solveLeg(LEG_L35, true);
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBe(643);
        // the non-vacuity arm: ON with the tail's instrument off is OFF's answer, plan and hits alike.
        const untailed = withKeylockWaitPriced(false, () => solveLeg(LEG_L35, true));
        expect(untailed.plan).toBe(off.plan);
        expect(untailed.hits).toEqual(L35_OFF_HITS);
    }, 120_000);

    it('L0 leg 105: ON answers OFF\'s plan byte for byte (its transit is punched, so the kill already ran first)', () => {
        const off = solveLeg(LEG_L0, false);
        expect(off.hits).toEqual([]);
        expect(off.ticks).toBe(771);
        const on = solveLeg(LEG_L0, true);
        expect(on.plan).toBe(off.plan);
        expect(on.hits).toEqual([]);
    }, 120_000);
});
