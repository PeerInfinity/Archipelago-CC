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
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the bait re-entry guard removed (`solverBot.js`)
 *        -> both D1 rows red with "Maximum call stack size exceeded"
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
