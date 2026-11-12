/**
 * ⛓ hammer-phase L43-BOSSTOTEM — `AWAKE_BOSS_FIRST` (`SEEDLING_AWAKE_BOSS_FIRST`, OFF): a walk that an awake boss bars
 * (the aim past its clamp, or the line to the aim through its body) fights the boss first with its own verb.
 *
 * The witness is the vanilla route survey's step 150 (level 43: collect the Wand, then reach the north exit), staged
 * from the survey's own 0-tick boot view (`fixtures/awake-boss-first/survey-step-150-boot.json`, written by
 * `survey-seedling-route.mjs --through=end`). The pickup wakes `bosstotem@152,168`; OFF the wand-stance walk aims
 * through the woken body, dies to its contact and stalls after the respawn; ON the Totem is fought first and the
 * step solves hitless.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { levelSourceFromAtlas } from './atlasSource.js';
import { AWAKE_BOSS_FIRST, awakeBossBarring, withAwakeBossFirst } from './solverBot.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const BOOT = readFileSync(join(HERE, 'fixtures', 'awake-boss-first', 'survey-step-150-boot.json'), 'utf8');
/** The survey's own room set: the map with `SEEDLING_SET_PATCHES` applied (L43's fallrock among them). */
const SOURCE = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'))));
const GOALS = [
    { kind: 'collect-placement', placement: { x: 144, y: 224 } },
    { kind: 'reach-exit', exit: { x: 144, y: 64 } },
];

function solveStep150() {
    const staging = solveStaging(stagingFromTape(parseTape(BOOT)));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, SOURCE);
    return twoPassSolve({ makeRun, goals: GOALS, name: 'awake-boss-first-step-150', boot: staging.boot,
        persistence: staging.persistence, log: () => {} });
}

afterEach(() => {
    AWAKE_BOSS_FIRST.fought.length = 0;
});

describe('hammer-phase L43-BOSSTOTEM — AWAKE_BOSS_FIRST, the switch', () => {
    it('ships OFF, `SEEDLING_AWAKE_BOSS_FIRST=1` turns it on, and the channel carries the name', () => {
        expect(AWAKE_BOSS_FIRST.enabled).toBe(ENV.SEEDLING_AWAKE_BOSS_FIRST === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_AWAKE_BOSS_FIRST');
    });

    it('`awakeBossBarring` reads only a live, woken body (a run with no `bosses` answers null)', () => {
        const none = { entities: () => new Map() };
        expect(awakeBossBarring(none, { x: 0, y: 0 }, { x: 10, y: 10 })).toBeNull();
        const body = (over) => ({ entities: () => new Map([['boss@50,50', {
            activated: true, removed: false, destroy: false, clampY: null,
            bodyRect: { x: 40, y: 40, w: 20, h: 20 }, ...over }]]) });
        // the line crosses the body
        expect(awakeBossBarring(body({}), { x: 50, y: 100 }, { x: 50, y: 0 }))
            .toEqual({ id: 'boss@50,50', tag: 'boss', past: false, crosses: true });
        // the line misses it
        expect(awakeBossBarring(body({}), { x: 0, y: 100 }, { x: 0, y: 0 })).toBeNull();
        // past the clamp, though the line misses the body
        expect(awakeBossBarring(body({ clampY: 60 }), { x: 0, y: 100 }, { x: 0, y: 0 }))
            .toMatchObject({ past: true, crosses: false });
        // asleep, removed or destroyed: never asked
        for (const over of [{ activated: false }, { removed: true }, { destroy: true }]) {
            expect(awakeBossBarring(body(over), { x: 50, y: 100 }, { x: 50, y: 0 })).toBeNull();
        }
    });
});

describe('hammer-phase L43-BOSSTOTEM — survey step 150 (L43, the Wand then the north exit), OFF and ON', () => {
    it('OFF: the wand-stance walk dies to the woken Totem and refuses as a stall', async () => {
        await expect(withAwakeBossFirst(false, solveStep150))
            .rejects.toThrow(/wand stance \(magicallock@144,112\): the re-planned corridor failed too/);
        expect(AWAKE_BOSS_FIRST.fought).toEqual([]);
    });

    it('ON: the Totem is fought first, and the step solves to L37 with no hit and no death', async () => {
        const solved = await withAwakeBossFirst(true, solveStep150);
        expect(AWAKE_BOSS_FIRST.fought).toHaveLength(1);
        expect(AWAKE_BOSS_FIRST.fought[0]).toMatchObject({ id: 'bosstotem@152,168', strategy: 'totem', hits: 0 });
        expect(AWAKE_BOSS_FIRST.fought[0].refused).toBeUndefined();
        expect(solved.out.perTick.length).toBeGreaterThan(0);
        expect(solved.passes).toHaveLength(1);
    });
});
