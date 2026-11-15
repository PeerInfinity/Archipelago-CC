/**
 * ⛓⛓ SEEDLING HAMMER-PHASE OPP-DASH-DEFERS — `OPP_DASH_DEFERS` (OFF): with `allowDash` false (every dashless pass) a
 * body-gated press is refused when the run's own slash state (`slashPressForecast` at `tick + 1`) says it would DASH,
 * whoever pressed last — not only when THIS policy's own `lastPressAt` is inside the double-tap window.
 *
 * The witness is leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560
 * cleared` (the hammerClearTagChain train row's request and set): its first branch, recorded by SPINNER-CORNER
 * (`fixtures/hammer-spinner-corner/leg871-branch724.json.gz`, 724 keys). There the press kill pressed, then an
 * opportunistic aim was offered and its press dashed. Every row reads the run: a fresh `strikePolicyFor` (the one
 * construction site, `dashMode: 'none'`) is asked on every tick of the branch, OFF and ON. The train row is
 * `hammerOppDashDefers.train.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { strikePolicyFor } from './solverBot.js';
import {
    OPP_DASH_DEFERS, OPP_DASH_DEFERS_COUNTS, STRIKE_AIM, STRIKE_NONE, withOppDashDefers,
} from './strikePolicy.js';
import { slashPressForecast } from './combatVerbs.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const gz = (...p) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', ...p))).toString('utf8'));

/**
 * Walks the branch tape on a fresh run of the 871 request's staging; on every tick with a strikeable body asks a fresh
 * policy OFF and ON with the run's slash state and an empty walk, and records each press's outcome and velocity.
 */
function walkBranch() {
    const { source, ...tape } = restoreRequest(gz('hammer-cleartag-chain', 'leg871-l39-l40-request.json.gz').requests[0].request);
    const branch = gz('hammer-spinner-corner', 'leg871-branch724.json.gz');
    return withContactFidelity({ forecastShieldBump: true }, () => {
        const run = replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records),
            scratchPersistence: tape.scratchPersistence === true,
            equips: branch.equips.length ? new Map(branch.equips) : null, holds: tape.holds ?? null });
        const asks = [];
        const presses = [];
        for (let k = 0; k < branch.keys.length; k += 1) {
            const bodies = run.entities('strikeBodies') ?? [];
            if (bodies.length > 0) {
                const slash = run.progress('slashInfo');
                const [off, on] = [false, true].map((enabled) => withOppDashDefers(enabled, () => {
                    const policy = strikePolicyFor(run, { dashMode: 'none' });
                    const d = policy.decide(run.state, bodies, run.ticksCompleted, new Set(), { slash });
                    return { decision: d.decision, target: d.target ?? null, row: policy.trace.at(-1) ?? null };
                }));
                const outcome = slashPressForecast(slash, { tick: k, ticksAhead: 1, direction: run.state.direction ?? 0 })
                    .outcome;
                if (off.decision !== STRIKE_NONE || on.decision !== STRIKE_NONE) asks.push({ k, off, on, outcome });
            }
            const keys = new Set(branch.keys[k]);
            const vy = run.state.vy;
            run.advance(keys);
            if (keys.has('primary')) {
                presses.push({ k, dashed: run.progress('slashInfo').state.slashDashed, vyBefore: vy, vyAfter: run.state.vy });
            }
        }
        return { asks, presses };
    });
}

describe('OPP_DASH_DEFERS — the switch', () => {
    it('ships OFF, is a solver env name, and the wrapper restores on throw', () => {
        expect(OPP_DASH_DEFERS.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_OPP_DASH_DEFERS');
        expect(() => withOppDashDefers(true, () => { throw new Error('x'); })).toThrow('x');
        expect(OPP_DASH_DEFERS.enabled).toBe(false);
        expect(withOppDashDefers(true, () => OPP_DASH_DEFERS.enabled)).toBe(true);
    });
});

describe('OPP_DASH_DEFERS — leg 871\'s branch (the kill pressed; the opportunistic press after it dashed)', () => {
    const { asks, presses } = walkBranch();

    it('the branch\'s one dashing press is the opportunistic one: the press after the kill\'s, inside its window', () => {
        const dashed = presses.filter((p) => p.dashed);
        expect(dashed).toHaveLength(1);
        const [d] = dashed;
        // the press before it is the kill's, and the window is the run's own (`slashTimer`, re-armed by its end)
        const prior = presses.filter((p) => p.k < d.k).at(-1);
        expect(d.k - prior.k).toBeLessThan(20);
        expect(prior.dashed).toBe(false);
        expect(d.vyAfter - d.vyBefore).toBeGreaterThan(1.5);
        // it was the aim a fresh policy takes OFF two ticks before (aim, aim key, press)
        const aim = asks.find((a) => a.k === d.k - 1);
        expect(aim.off.decision).toBe(STRIKE_AIM);
        expect(aim.outcome).toBe('dash');
    });

    it('OFF the policy aims on every in-window tick (its own `lastPressAt` is empty); ON it refuses every one, by name',
        () => {
            const inWindow = asks.filter((a) => a.outcome === 'dash');
            expect(inWindow.length).toBeGreaterThan(0);
            for (const a of inWindow) {
                expect(a.off.decision).toBe(STRIKE_AIM);
                expect(a.on.decision).toBe(STRIKE_NONE);
                expect(a.on.row.dashRefused.anyVerb).toBe(true);
                expect(a.on.row.dashRefused.inReach).toContain(a.off.target);
                expect(a.off.row.dashRefused).toBeUndefined();
            }
        });

    it('control: every aim whose press would be a plain swing is the same aim OFF and ON, row for row', () => {
        const plain = asks.filter((a) => a.outcome !== 'dash');
        expect(plain.length).toBeGreaterThan(0);
        for (const a of plain) {
            expect(a.on).toEqual(a.off);
            expect(a.off.decision).toBe(STRIKE_AIM);
        }
    });

    it('the instrument counts OFF without refusing, and ON refuses exactly what it counted', () => {
        for (const c of Object.keys(OPP_DASH_DEFERS_COUNTS)) OPP_DASH_DEFERS_COUNTS[c] = 0;
        const again = walkBranch();
        const inWindow = again.asks.filter((a) => a.outcome === 'dash').length;
        // every tick is asked once OFF and once ON: both arms count the in-window ask, only ON refuses it
        expect(OPP_DASH_DEFERS_COUNTS.inWindow).toBe(2 * inWindow);
        expect(OPP_DASH_DEFERS_COUNTS.deferred).toBe(inWindow);
    });
});
