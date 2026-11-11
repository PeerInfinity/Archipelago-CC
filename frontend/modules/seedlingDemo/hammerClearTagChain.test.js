/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE CLEARTAG-CHAIN — the clear-tag verb runs its stance prerequisite first (`CLEARTAG_CHAIN`,
 * OFF). ⚖ The user queued this on 2026-11-05 (planner `seedling-hammer-phase-planning-3`, the L40 census's step 3).
 *
 * L40-CENSUS wall B: L40's flag 12 (`hold(wandlock@480,560)`) has its stance `buttonroom@880,768` shut by
 * `burnabletree@872,784`. `STANCE_BURN` (OFF) names the burn as the stance's prerequisite, and `execClearTag`'s solid
 * arm then refused *"a clear-tag order does not chain openers"*: only the frontier consumed a prerequisite. ON, the arm
 * runs the order `prerequisiteOrder` builds (`clearTagPrerequisite`) and re-derives its hold from where it left the
 * player.
 *
 * The state is the page's own request for leg 872 (`level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 ->
 * location:L40 flag 12: wandlock@480,560 cleared`), captured at `97739720dd`, its atlas records cut to level 40
 * (byte-identical answers to the uncut capture). Each row is ONE dashless pass of the solve, uncapped (the work clock
 * never stops it), so the rows pin the search, not the page's budget. The solves to the end are the train tier's
 * (`hammerClearTagChain.train.test.js`).
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { CLEARTAG_CHAIN, CLEARTAG_CHAIN_DEFAULT, withClearTagChain, withStanceBurn } from './solverBot.js';
import { withDisabledScope } from './strategySwitch.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-chain', name)))
    .toString('utf8'));
const LEG_872 = FIX('leg872-l43-l40-request.json.gz');
const CT = 'solverBot(wasm-location-40) clear-tag {40,12} wandlock@480,560';
const TREE = 'burnabletree@872,784';
/** The message's sha256, cut to 12 (the refusal texts are long; the head is asserted beside it). */
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/** Leg 872's dashless pass, uncapped, `STANCE_BURN` at `sb` and `CLEARTAG_CHAIN` at `cc`. */
function dashless872({ sb, cc }) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(LEG_872.requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    let work = 0;
    const answer = withStanceBurn(sb, () => withClearTagChain(cc, () => settleSolve(() => solveFromTape({
        ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return false; } }))));
    return { ok: answer.ok, message: answer.ok ? null : answer.message, work };
}

/** The strategy switch's per-solve scope with `burn` disabled (the shape `parseDisable` builds). */
const NO_BURN = () => ({ asked: ['burn'], key: 'burn', verbs: new Set(['burn']), rungs: new Set(), absent: [],
    hits: {}, first: null });

describe('hammer-phase CLEARTAG-CHAIN — the clear-tag verb runs its stance prerequisite (`CLEARTAG_CHAIN`)', () => {
    it('ships OFF (`SEEDLING_CLEARTAG_CHAIN=1` turns it on in node; the page channel knows the name)', () => {
        expect(CLEARTAG_CHAIN_DEFAULT).toBe(true); // ⚖ ON in the L40 flip (hammer L40-FLIP-BUILD)
        expect(CLEARTAG_CHAIN.enabled).toBe(ENV.SEEDLING_CLEARTAG_CHAIN !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CLEARTAG_CHAIN');
        expect(withClearTagChain(true, () => CLEARTAG_CHAIN.enabled)).toBe(true);
        expect(withClearTagChain(false, () => CLEARTAG_CHAIN.enabled)).toBe(false);
        expect(CLEARTAG_CHAIN.enabled).toBe(ENV.SEEDLING_CLEARTAG_CHAIN !== '0');
    });

    it('OFF (`STANCE_BURN` ON): wall B — the burn is named and the clear-tag arm refuses to chain it', () => {
        const off = dashless872({ sb: true, cc: false });
        expect(off.ok).toBe(false);
        expect(off.message).toBe(`${CT}: 'hold''s stance is reachable only once ${TREE} is discharged (burn: the stance `
            + `is reachable once ${TREE} is burnt: the run holds Fire, and a burnt tree is gone for the visit (\`burnEnd `
            + '-> die()`), so the corridor it shut stays open); a clear-tag order does not chain openers');
        expect(off.work).toBe(182);
    }, 120000);

    it('ON (`STANCE_BURN` ON): the burn runs first, and the refusal moves to the burn walk\'s SE fight (wall A1)', () => withL40Flip(false, () => {
        const on = dashless872({ sb: true, cc: true });
        expect(on.ok).toBe(false);
        expect(on.message.startsWith(`${CT} -> burn stance (${TREE}) -> kill (spinner@880,848) by press: the player `
            + 'died at t817 (chaser bob@736,752) while pressing spinner@880,848')).toBe(true);
        expect(on.message).not.toContain('does not chain openers');
        // ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip, ⚖ user 2026-11-11): spinner@816,848 walls bob@736,752's first step (t544), so the burn still runs first; the press-kill death is t817 after 2 landings (t799, work 232, before).
        expect([on.work, sha(on.message)]).toEqual([233, ON_SB_SHA]);
    }), 120000);

    it('ON without `STANCE_BURN` = OFF byte for byte (no prerequisite is named, so nothing is chained)', () => {
        const off = dashless872({ sb: false, cc: false });
        expect(off.message.startsWith(`${CT}: 'hold' could not be resolved from (328,600): solverBot: no REACHABLE stance `
            + 'inside buttonroom@880,768 in level 40')).toBe(true);
        expect([off.work, sha(off.message)]).toEqual([182, DEFAULTS_SHA]);
        expect(dashless872({ sb: false, cc: true })).toEqual(off);
    }, 120000);

    it('ON with `burn` disabled by the strategy switch = OFF with it disabled (the burn is behind the gate)', () => {
        const off = withDisabledScope(NO_BURN(), () => dashless872({ sb: true, cc: false }));
        expect(off.message).not.toContain(TREE);
        expect(withDisabledScope(NO_BURN(), () => dashless872({ sb: true, cc: true }))).toEqual(off);
    }, 120000);
});

/** Measured at `97739720dd` (main, the slice's start) and this slice's head: the dashless messages' sha256 heads. */
const DEFAULTS_SHA = 'cd5f0db75f2a';
const ON_SB_SHA = '7f0b11e8dd92';
