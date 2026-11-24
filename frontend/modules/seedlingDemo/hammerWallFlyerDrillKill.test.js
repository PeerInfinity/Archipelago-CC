/**
 * ⛓ hammer-phase WALLFLYER-DRILL-KILL — `WALLFLYER_KILL_ARM` (`SEEDLING_WALLFLYER_KILL_ARM`) and `DRILL_KILL_ARM`
 * (`SEEDLING_DRILL_KILL_ARM`), both OFF: the kill rung's arms for a live wallflyer / drill among the probe's hit
 * sources, each kill played on a fork and replayed on the live run.
 *
 * The cheap witness is the sweep leg `level_27 <- in_L28_128_304 -> exit:out_teleporter_32_0`, staged as the route
 * survey's step-35 boot view moved to that leg's arrival (`fixtures/wallflyer-drill-kill/l27-from-l28-boot.json`:
 * the survey's inventory, persistence and seam, `boot` = the leg's `arrive`). With `corridorBodyPricing` ON (the
 * corridor flip) the walk to the north door crosses `wallflyer@192,48`'s ray and the ladder EXHAUSTS on it; ON the
 * flyer is struck where it rests and the leg solves hitless. The survey steps themselves (35: L22, two flyers; 84:
 * L88, a drill) are the train tier's (`hammerWallFlyerDrillKill.train.test.js`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';
import {
    BODY_FAMILY_KILL_COUNTS, DRILL_KILL_ARM, DRILL_KILL_ARM_DEFAULT, WALLFLYER_KILL_ARM, WALLFLYER_KILL_ARM_DEFAULT,
    resetBodyFamilyKillCounts, withDrillKillArm, withWallFlyerKillArm,
} from './solverBot.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const WDK_SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));

/** `twoPassSolve` (the survey's own solve) of a committed boot fixture toward `goals`, and the plan replayed. */
async function solveWdkFixture(file, goals, name) {
    const boot = readFileSync(join(HERE, 'fixtures', 'wallflyer-drill-kill', file), 'utf8');
    const staging = solveStaging(stagingFromTape(parseTape(boot)));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, WDK_SOURCE);
    const res = await twoPassSolve({ makeRun, goals, name, boot: staging.boot, persistence: staging.persistence,
        log: () => {} });
    const run = makeRun(staging.persistence);
    for (const held of res.out.perTick) run.advance(held);
    return { res, run };
}

const L27_GOALS = [{ kind: 'reach-exit', exit: { x: 32, y: 0 } }];
const solveL27 = () => solveWdkFixture('l27-from-l28-boot.json', L27_GOALS, 'wdk-l27');

afterEach(() => resetBodyFamilyKillCounts());

describe('hammer-phase WALLFLYER-DRILL-KILL — the switches', () => {
    it('the wallflyer arm ships ON (`=0` opts out), the drill arm OFF (`=1` turns it on), and the channel carries both names', () => {
        expect(WALLFLYER_KILL_ARM_DEFAULT).toBe(true);
        expect(DRILL_KILL_ARM_DEFAULT).toBe(false);
        expect(WALLFLYER_KILL_ARM.enabled).toBe(ENV.SEEDLING_WALLFLYER_KILL_ARM !== '0');
        expect(DRILL_KILL_ARM.enabled).toBe(ENV.SEEDLING_DRILL_KILL_ARM === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WALLFLYER_KILL_ARM');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DRILL_KILL_ARM');
    });

    it('the wrappers restore the previous value, also on a throw', () => {
        const was = WALLFLYER_KILL_ARM.enabled;
        expect(() => withWallFlyerKillArm(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(WALLFLYER_KILL_ARM.enabled).toBe(was);
        const wasD = DRILL_KILL_ARM.enabled;
        expect(withDrillKillArm(true, () => DRILL_KILL_ARM.enabled)).toBe(true);
        expect(DRILL_KILL_ARM.enabled).toBe(wasD);
    });
});

describe('hammer-phase WALLFLYER-DRILL-KILL — L27 from the L28 arrival to (32,0), the corridor flip ON', () => {
    it('the witness needs the flip: `corridorBodyPricing` is ON at this base', () => {
        expect(CONTACT_FIDELITY.corridorBodyPricing).toBe(true);
    });

    it('OFF: the ladder EXHAUSTS on wallflyer@192,48 (no arm is asked)', async () => {
        await expect(withWallFlyerKillArm(false, () => withDrillKillArm(false, solveL27)))
            .rejects.toThrow(/combat ladder is EXHAUSTED[\s\S]*wallflyer@192,48/);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(0);
    });

    it('ON: the wallflyer arm kills wallflyer@192,48 where it rests (one fork) and the leg solves hitless', async () => {
        const { res, run } = await withWallFlyerKillArm(true, () => withDrillKillArm(false, solveL27));
        expect(BODY_FAMILY_KILL_COUNTS.kills).toEqual([
            expect.objectContaining({ id: 'wallflyer@192,48', family: 'wallflyer', forks: 1 })]);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(run.level).toBe(26);
        expect(res.out.perTick.length).toBe(203);
        expect(run.wallFlyers.bodies.find((w) => w.id === 'wallflyer@192,48')).toBeUndefined();
    });

    it('ON with only the DRILL arm: a wallflyer is not its body, so the refusal stands word for word', async () => {
        const off = await withWallFlyerKillArm(false, () => withDrillKillArm(false, solveL27)).catch((e) => e.message);
        const on = await withWallFlyerKillArm(false, () => withDrillKillArm(true, solveL27)).catch((e) => e.message);
        expect(typeof off).toBe('string');
        expect(on).toBe(off);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(0);
    });
});

