/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SPINNER-CORNER — `HAMMER_BODY_GATE` (OFF): `safeStep`'s landing test and `stepToward`'s
 * survival bill a spinner's 7x7 BODY only where the run bills it (`!destroy && hitsTimer <= 0`), and a press-kill tick
 * with no aim still looks for a step out (`holdStepOut`). The slow solve rows are `hammerBodyGate.train.test.js`.
 *
 * The witness is leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560
 * cleared` (the hammerClearTagChain train row's request and set): its first branch, switch OFF, recorded on the observed
 * run up to where `HAMMER_SAFETY` refused it (`fixtures/hammer-spinner-corner/leg871-branch724.json.gz`, 724 keys,
 * `CC/docs/cloud-reports/seedling-hammer-spinner-corner-evidence/tools/branch724.mjs`). The rows read the run, never a
 * coordinate as logic: the corner's numbers are the witness's own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    HAMMER_BODY_GATE, clearOfBilledHammersAt, clearOfHammersAt, hammerBodyBilled, withHammerBodyGate,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape } from './jsRuntimeSolver.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { SPINNER, hammerHitsPlayer } from './spinner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const gz = (...p) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', ...p))).toString('utf8'));
const SETS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'],
    ['down', 'right']];

/** The branch tape on a fresh run of the 871 request's staging, under the set it was recorded in. */
function branchRun(extra = []) {
    const { source, ...tape } = restoreRequest(gz('hammer-cleartag-chain', 'leg871-l39-l40-request.json.gz').requests[0].request);
    const branch = gz('hammer-spinner-corner', 'leg871-branch724.json.gz');
    return withContactFidelity({ forecastShieldBump: true }, () => replayTape({ staging: tape.staging,
        perTick: [...branch.keys, ...extra].map((k) => new Set(k)), levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: branch.equips.length ? new Map(branch.equips) : (tape.equips ?? null), holds: tape.holds ?? null }));
}

/** Every key set stepped once from the run's state, asked of forecast row 1 by `pred`, and what its box meets there. */
function corner(run, pred) {
    const f = run.spinnerForecast(2);
    const step = run.previewStepper();
    return SETS.map((s) => {
        const next = step({ ...run.state }, new Set(s));
        const box = playerBoxAt(next.x, next.y);
        const meets = f[1].map((r) => {
            const body = box.right > r.x && box.x < r.right && box.bottom > r.y && box.y < r.bottom;
            const line = Boolean(hammerHitsPlayer({ x: r.x + SPINNER.originX, y: r.y + SPINNER.originY },
                run.gameTimeAt(1), box));
            return body || line ? `${body ? 'body' : ''}${line ? 'line' : ''}` : null;
        }).filter(Boolean);
        return { keys: s.join('+') || 'stand', clear: pred(run, box, f, 1), meets };
    });
}

describe('HAMMER_BODY_GATE — the switch', () => {
    it('ships OFF, is a solver env name, and the wrapper restores', () => {
        expect(HAMMER_BODY_GATE.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_HAMMER_BODY_GATE');
        expect(withHammerBodyGate(true, () => HAMMER_BODY_GATE.enabled)).toBe(true);
        expect(HAMMER_BODY_GATE.enabled).toBe(false);
        expect(() => withHammerBodyGate(true, () => { throw new Error('x'); })).toThrow('x');
        expect(HAMMER_BODY_GATE.enabled).toBe(false);
    });

    it('hammerBodyBilled: a destroyed body never bills, an i-frame bills from the row it is spent, a view or a row of other bodies is null', () => {
        const run = { advance() {}, entities: () => [{ destroy: true, hitsTimer: 30 }, { destroy: false, hitsTimer: 2 },
            { destroy: false, hitsTimer: 0 }] };
        expect(hammerBodyBilled(run, [{}, {}, {}], 0)).toEqual([false, false, true]);
        expect(hammerBodyBilled(run, [{}, {}, {}], 1)).toEqual([false, true, true]);
        expect(hammerBodyBilled(run, [{}, {}], 1)).toBe(null);
        expect(hammerBodyBilled({ entities: run.entities }, [{}, {}, {}], 1)).toBe(null);
    });
});

describe('HAMMER_BODY_GATE — leg 871\'s first branch at its t724 corner', () => {
    it('the corner is a CORPSE\'s body: the press of t719 was the killing hit, and no key set meets a line', () => {
        const run = branchRun();
        expect(run.ticksCompleted).toBe(724);
        const landed = (run.ledger('spinnerPressHits') ?? []).filter((h) => h.landed);
        expect(landed.at(-1)).toMatchObject({ t: 719, hits: SPINNER.hitsMax });
        const body = (run.entities('spinnerBodies') ?? []).find((b) => b.id === landed.at(-1).id);
        expect(body).toMatchObject({ destroy: true, hitsTimer: SPINNER.hitsTimerMax });
        expect(run.playerHits).toEqual([]);
        const off = corner(run, clearOfHammersAt);
        expect(off.every((r) => !r.clear)).toBe(true);
        expect(off.every((r) => r.meets.join() === 'body')).toBe(true);
        // OFF, the gated predicate IS clearOfHammersAt
        expect(corner(run, clearOfBilledHammersAt).map((r) => r.clear)).toEqual(off.map((r) => r.clear));
    });

    it('ON: every key set is a step out there (the body is not billed, the line misses)', () => {
        const run = branchRun();
        const on = withHammerBodyGate(true, () => corner(run, clearOfBilledHammersAt));
        expect(on.every((r) => r.clear)).toBe(true);
    });

    it('ON, but standing: the dash\'s slide puts the box on the hammer\'s origin two ticks on, and the line corners it (why a no-aim tick needs `holdStepOut`)', () => {
        const run = branchRun([[], []]);
        expect(run.ticksCompleted).toBe(726);
        const on = withHammerBodyGate(true, () => corner(run, clearOfBilledHammersAt));
        expect(on.every((r) => !r.clear && r.meets.join().includes('line'))).toBe(true);
    });
});
