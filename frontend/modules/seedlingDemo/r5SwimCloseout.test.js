/**
 * r5SwimCloseout — the swim arc's close-out rows (swim R5, plan §18.30).
 *
 * D1: the mid-room solver STACK OVERFLOW. From L6 (`in_L5_48_112` →
 * `out_stairsup_224_32`) after 70 J2-walker ticks, the danger probe on the
 * walk to `bob@96,16`'s bait stance climbed the ladder again, picked the same
 * bait at the same tick, and walked to the same stance — `walkTo` →
 * `climbLadder` → `walkTo` … until the JS stack ran out. The JS page saw it as
 * a decline reading *"Maximum call stack size exceeded"*. The re-entry is now
 * refused by name (`BAIT_REENTRY`) and the ladder goes on to KILL. The staging
 * is the JS runtime's own (imported read-only); the solve is `solveSegment`'s
 * `prefix` admission, the path the page's solver takes.
 *
 * D4: a key's flip is its own placement witness (`GOAL_PLACEMENT_WITNESS`).
 *
 * D5: the dead-frame budget's terms have ONE implementation, which both the
 * differential and the band's probe call.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the bait re-entry guard removed (`solverBot.js`)
 *        -> both D1 rows red with "Maximum call stack size exceeded"
 *   m2 `GOAL_PLACEMENT_WITNESS.key` back to true
 *        -> 'a key that flips with NO clear in its level is EARNED' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJsRuntime } from './jsRuntimeCore.js';
import { replayTape } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';
import { solveSegment } from './solverBot.js';
import { R7_GOAL_LEDGER, GOAL_PLACEMENT_WITNESS, goalEarnedWitness } from './r7Acceptance.js';
import { deadFrameBudget } from './deadFrameBand.js';
import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

describe('R5-swim D1: the bait walk may not re-enter itself (the mid-room stack overflow)', () => {
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const SRC = levelSourceFromAtlas(indexLevels(MAP));
    const L6 = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json')
        .preset_sidecars['1'].level_6.playable_payload;
    const RETURNS = returnSpawnTable(MAP);
    /** The JS page's own state: arrived through L5's door, then `walkTicks` J2-walker ticks. */
    const midRoom = (walkTicks) => {
        const from = L6.exits.find((e) => e.exit_id === 'in_L5_48_112');
        const spawn = RETURNS.get(returnKey(L6.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
        const to = L6.exits.find((e) => e.exit_id === 'out_stairsup_224_32');
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [L6.level, spawn.x, spawn.y] }]);
        rt.tick();
        rt.playback.walkTo({ kind: 'exit', level: L6.level, tiles: to.exit_tiles });
        rt.playback.play();
        for (let t = 0; t < walkTicks; t += 1) rt.tick();
        return rt;
    };

    it('W=70 through `solveSegment({prefix})` refuses BY NAME, not by the stack', () => {
        const rt = midRoom(70);
        const { staging, perTick } = rt.session;
        const shadow = replayTape({ staging, perTick, levelSource: SRC, scratchPersistence: rt.run.scratchPersistence === true });
        let err = null;
        try {
            solveSegment({ run: shadow, goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }],
                name: 'r5-d1', boot: staging.boot, prefix: perTick });
        } catch (e) {
            err = e;
        }
        expect(err).not.toBeNull();
        expect(err).not.toBeInstanceOf(RangeError);
        expect(err.message).toMatch(/-> bait \(bob@96,16\) stance: the combat ladder is EXHAUSTED/);
        expect(err.message).toMatch(/bait: bob@96,16: the walk to its bait stance \(104,56\) is itself a corridor that needs bob@96,16 baited — the ladder re-entered the same bait at tick 71 .*\(BAIT_REENTRY\)/);
    }, 60_000);

    it('W=70 on the JS page declines by the exhausted ladder\'s name, not "Maximum call stack size exceeded"', () => {
        const rt = midRoom(70);
        rt.playback.setSolverWalk(true);
        for (let t = 0; t < 20 && rt.playback.solverStats.declines === 0; t += 1) rt.tick();
        const s = rt.playback.solverStats;
        expect(s).toMatchObject({ solves: 0, declines: 1 });
        expect(s.lastDecline).not.toMatch(/Maximum call stack/);
        // The page keeps the refusal's first line; the climb (with BAIT_REENTRY) is the row above.
        expect(s.lastDecline).toMatch(/^solverBot\(js-runtime-L6-exit\) reach-exit \(224,32\)->L7 -> bait \(bob@96,16\) stance: the combat ladder is EXHAUSTED/);
    }, 60_000);
});

describe('R5-swim D4: a key\'s flip is its own placement witness', () => {
    const KEY1 = R7_GOAL_LEDGER.find((r) => r.id === 'bosskey1@L29');
    const fields = (keys, clears = []) => ({
        'save.hasKey': [0, 1, 2, 3, 4].map((i) => keys.includes(i)),
        'save.levelPersistence': clears,
    });

    it('the ruling is stated: `key` owes no clear', () => {
        expect(GOAL_PLACEMENT_WITNESS.key).toBe(false);
    });

    it('a key that flips with NO clear in its level is EARNED (L29\'s Green Key, `bosskey@112,64` tag -1)', () => {
        expect(goalEarnedWitness(KEY1, fields([0]), fields([0, 1]))).toBe('hasKey[1] 0 -> 1');
    });

    it('a DECLARED key does not flip, so a boot block still cannot earn one', () => {
        expect(goalEarnedWitness(KEY1, fields([0, 1]), fields([0, 1]))).toBe(null);
    });

    it('a key that flips beside a clear in its level still names the clear (L19\'s witness sentence is unchanged)', () => {
        const KEY0 = R7_GOAL_LEDGER.find((r) => r.id === 'bosskey0@L19');
        expect(goalEarnedWitness(KEY0, fields([]), fields([0], [{ level: 19, tag: 0 }, { level: 19, tag: 1 }])))
            .toBe('hasKey[0] 0 -> 1, and levelPersistence gains {19,0} {19,1} in level 19');
    });
});

describe('R5-swim D5: the dead-frame budget has one implementation', () => {
    const P = CEREMONY_DEAD_FRAMES.pickup;

    it('a death and a non-terminal same-level reboot are loads; the terminal reboot is not', () => {
        const b = deadFrameBudget({
            tape: { tick_count: 100 },
            expected: {
                playerDeaths: [{ t: 10 }],
                endingReboots: [{ sameLevel: true, t: 50 }, { sameLevel: true, t: 100 }, { sameLevel: false, t: 60 }],
            },
            transitions: 2,
            exempt: null,
        });
        expect(b).toMatchObject({ loads: 2 + 1 + 1 + 1, deaths: 1, sameLevelReboots: 1, modelled: 0 });
    });

    it('a ceremony STARTED is paid even when it never completes, and an exemption adds its own', () => {
        const b = deadFrameBudget({
            tape: { tick_count: 10 },
            expected: { ceremonyStarts: [{}, {}], collected: [{}], frozenFramesOwed: 7, sealCollections: [{ deadFrames: 3 }] },
            transitions: 0,
            exempt: { earned: ['fire'], freezeFrames: 174 },
        });
        expect(b).toMatchObject({
            loads: 1, runFreeze: 7, sealFrames: 3, pickupFrames: 2 * P, spawnedFrames: P, declaredFreeze: 174,
            modelled: 7 + 3 + 2 * P + P + 174,
        });
    });

    it('the gate and the probe both CALL it, and neither carries its own copy of the terms', () => {
        for (const rel of ['scripts/procgen/check-seedling-bot-differential.mjs',
            'scripts/procgen/probe-seedling-deadframe-band.mjs']) {
            const src = readFileSync(join(ROOT, rel), 'utf8');
            expect(src, rel).toMatch(/deadFrameBudget\(\{/);
            expect(src, rel).not.toMatch(/r\.sameLevel && r\.t < tape\.tick_count/);
            expect(src, rel).not.toMatch(/\.length \* CEREMONY_DEAD_FRAMES\.pickup/);
        }
    });
});
