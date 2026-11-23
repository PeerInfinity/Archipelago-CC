/**
 * ⛓ hammer-phase L26-KILL — `KILLLOCK_STANCE_AS_FORECAST` (`SEEDLING_KILLLOCK_STANCE_AS_FORECAST`, OFF): the kill-lock
 * chaser arm's attempt walks its stance undashed, the walk its stance was forecast on.
 *
 * The witness is the chest route's survey step 35 (L26 from the L25 teleporter's arrival (8,2), `reach-exit (144,208)`
 * → L28, behind `rocklock@112,208`, which counts `puncher@80,168` and `puncher@32,208`), staged from the survey's own
 * 0-tick boot view (`fixtures/hammer-l26-kill/survey-step-35-boot.json`, written by `survey-seedling-route.mjs
 * --through=4.2` at the chest-solid latch + the hammer stack flip) on the survey's own rooms (the patched map with the
 * AP chests delivered). Each plan's hits and deaths are read off a REPLAY of its inputs on a fresh run (⚖ 30(c)).
 *   OFF: every one of the arm's 5 rewound attempts is HIT in its dwell (the dashed stance walk arrives ~120 ticks
 *        before the forecast, and the other puncher closes in the same dwell);
 *   `dashMode: 'none'` (the control): the same arm solves hitless, so the hitless line is the model's own;
 *   ON: the stance walk is the forecast's, and the arm kills both punchers hitless at the default dash mode.
 * `CC/docs/cloud-reports/seedling-hammer-l26-kill.md`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deliveredChestDocument } from './apChestDelivery.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';
import {
    KILLLOCK_CHASER_REWIND_COUNTS, KILLLOCK_STANCE_AS_FORECAST, KILLLOCK_STANCE_AS_FORECAST_DEFAULT,
    resetKillLockChaserRewindCounts, withKillLockStanceAsForecast,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const ENV = globalThis.process?.env ?? {};
const HERE = dirname(fileURLToPath(import.meta.url));
const BOOT = readFileSync(join(HERE, 'fixtures', 'hammer-l26-kill', 'survey-step-35-boot.json'), 'utf8');
const MAP = patchedMapDocument(JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8')));
/** The survey's MODEL rooms: the AP chest delivered as its `apitem` while `apChestItem` is on (its default). */
const SOURCE = levelSourceFromAtlas(CONTACT_FIDELITY.apChestItem ? deliveredChestDocument(MAP) : MAP);
const GOALS = [{ kind: 'reach-exit', exit: { x: 144, y: 208 } }];

/** Step 35 solved as the survey does (`twoPassSolve`), the switch as named; the plan replayed on a fresh run. */
async function solveStep35({ asForecast, dashMode } = {}) {
    const staging = solveStaging(stagingFromTape(parseTape(BOOT)));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, SOURCE);
    resetKillLockChaserRewindCounts();
    let solved;
    try {
        solved = await withKillLockStanceAsForecast(asForecast, () => twoPassSolve({ makeRun, goals: GOALS,
            name: 'hammer-l26-kill-step-35', boot: staging.boot, persistence: staging.persistence, log: () => {},
            ...(dashMode ? { dashMode } : {}) }));
    } catch (e) {
        return { ok: false, message: String(e.message), tries: [...KILLLOCK_CHASER_REWIND_COUNTS.tries] };
    }
    const run = makeRun(solved.persistence);
    const equipsAt = new Map((solved.out.equips ?? []).map((e) => [e.t, e.slot]));
    solved.out.perTick.forEach((held, t) => {
        if (equipsAt.has(t)) run.equipNow(equipsAt.get(t));
        run.advance(held);
    });
    return { ok: true, ticks: solved.out.perTick.length, hits: run.playerHits.length, deaths: run.playerDeaths.length,
        level: run.level, tries: [...KILLLOCK_CHASER_REWIND_COUNTS.tries] };
}

describe('hammer-phase L26-KILL — the switch', () => {
    it('ships OFF (=1 turns it on); the page channel carries the name', () => {
        expect(KILLLOCK_STANCE_AS_FORECAST_DEFAULT).toBe(false);
        expect(KILLLOCK_STANCE_AS_FORECAST.enabled).toBe(ENV.SEEDLING_KILLLOCK_STANCE_AS_FORECAST === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILLLOCK_STANCE_AS_FORECAST');
    });

    it('`withKillLockStanceAsForecast` sets the switch for `fn` and puts it back, thrown or not', () => {
        const was = KILLLOCK_STANCE_AS_FORECAST.enabled;
        expect(withKillLockStanceAsForecast(true, () => KILLLOCK_STANCE_AS_FORECAST.enabled)).toBe(true);
        expect(withKillLockStanceAsForecast(false, () => KILLLOCK_STANCE_AS_FORECAST.enabled)).toBe(false);
        expect(KILLLOCK_STANCE_AS_FORECAST.enabled).toBe(was);
        expect(() => withKillLockStanceAsForecast(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(KILLLOCK_STANCE_AS_FORECAST.enabled).toBe(was);
    });
});

describe('hammer-phase L26-KILL — survey step 35 (L26 (8,2) → L28 behind `rocklock@112,208`, Sword + Shield)', () => {
    it('OFF: all 5 rewound kill-lock attempts are HIT in their dwell, and the step refuses at the kill', async () => {
        const off = await solveStep35({ asForecast: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/kill: the count is still waiting on \[puncher@80,168, puncher@32,208\] and no stance kills one of them in 5 attempt\(s\), each rewound/);
        expect(off.tries.map((t) => `${t.id}@${t.stance.x},${t.stance.y}:${t.verdict}`)).toEqual([
            'puncher@80,168@120,232:refused', 'puncher@80,168@104,248:refused', 'puncher@80,168@120,248:refused',
            'puncher@32,208@104,248:refused', 'puncher@32,208@104,264:refused',
        ]);
        expect(off.tries.every((t) => /the dwell was HIT/.test(t.why))).toBe(true);
    }, 60000);

    it('the control — `dashMode: none`, switch OFF: the same arm kills both hitless, so the line is the model\'s', async () => {
        const none = await solveStep35({ asForecast: false, dashMode: 'none' });
        expect(none).toMatchObject({ ok: true, ticks: 474, hits: 0, deaths: 0, level: 28 });
    }, 60000);

    it('ON, the default dash mode: the stance walked as forecast kills both punchers, 0 hits, the walk crosses to L28', async () => {
        const on = await solveStep35({ asForecast: true });
        expect(on).toMatchObject({ ok: true, ticks: 508, hits: 0, deaths: 0, level: 28 });
        expect(on.tries.some((t) => t.verdict === 'killed')).toBe(true);
    }, 60000);
});
