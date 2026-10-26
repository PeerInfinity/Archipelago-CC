/**
 * ⛓⛓ SEEDLING HAMMER-PHASE PKC — the press kill's step sees the chasers (`PRESS_KILL_CHASERS`, OFF).
 * ⛓ fidelity L40BK2 D3.
 *
 * The state is L40BK2's survey step 67 (`fixtures/l40bk2-witness/step67-boot.json`, L40 Boss Key 2, the wave-31
 * defaults), asked for the chest (880,816): the chest's stance needs `kill (spinner@880,848) by press`, and the kill
 * starts on tick 0. OFF the kill derives the strike (744,776) at t604, walks the x≈744 corridor into `bob@736,752`
 * (contacts t660, t749, t780) and `PRESS_KILL_REBOOT_GUARD` refuses the death. ON `safeStep` prefers a key set that
 * lands clear of the chasers one tick on: the keys are OFF's to t657, part at t658, and the kill takes no hit.
 * Both solves are capped (an `advance` sentinel at t800) so the ON arm stops inside the kill it survives.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { SolverRefusal, solveSegment } from './solverBot.js';
import {
    PRESS_KILL_CHASERS, PRESS_KILL_CHASERS_COUNTS, PRESS_KILL_CHASERS_DEFAULT, resetPressKillChasersCounts,
    withPressKillChasers,
} from './pressKillCost.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOOT = join(HERE, 'fixtures', 'l40bk2-witness', 'step67-boot.json');
const ENV = globalThis.process?.env ?? {};
const CAP = 800;
/** The last tick ON's keys equal OFF's (the first ON swap is the step that would have met the bob at t660). */
const SAME_THROUGH = 657;

/** `solveSegment` for the chest from step 67's boot, `advance` capped at `CAP`; every key and the counts once t657 is decided. */
function solveChest(on) {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(BOOT, 'utf8'))));
    const run = createRunForStaging(staging, atlasLevelSource());
    const keys = [];
    let countsAtSame = null;
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        if (run.ticksCompleted === SAME_THROUGH) countsAtSame = { ...PRESS_KILL_CHASERS_COUNTS };
        if (run.ticksCompleted >= CAP) throw Object.assign(new Error(`PKC sentinel: t${CAP}`), { sentinel: true });
        keys.push([...k].sort().join('+'));
        return advance(k);
    };
    resetPressKillChasersCounts();
    let error = null;
    try {
        withPressKillChasers(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement',
            placement: { x: 880, y: 816 } }], name: 'pkc', boot: staging.boot, dashMode: 'all' }));
    } catch (e) {
        error = e;
    }
    return { run, keys, error, counts: { ...PRESS_KILL_CHASERS_COUNTS }, countsAtSame,
        hits: run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`) };
}

describe('hammer-phase PKC — the press kill prices the chasers beside its walks', () => {
    it.skipIf(ENV.SEEDLING_PRESS_KILL_CHASERS !== undefined)('ships OFF', () => {
        expect(PRESS_KILL_CHASERS.enabled).toBe(false);
        expect(PRESS_KILL_CHASERS_DEFAULT).toBe(false);
    });

    it('step 67: OFF the kill walks into bob@736,752 and dies; ON it takes no hit, and the keys are OFF\'s until the '
        + 'step that met the bob', () => {
        const off = solveChest(false);
        expect(off.error).toBeInstanceOf(SolverRefusal);
        expect(off.error.message).toContain('kill (spinner@880,848) by press: the player died at t780 '
            + '(chaser bob@736,752)');
        expect(off.error.message).toContain('PRESS_KILL_REBOOT_GUARD');
        expect(off.hits).toEqual(['660:chaser:bob@736,752', '749:chaser:bob@736,752', '780:chaser:bob@736,752']);
        // ⛔ OFF never builds the step's forecast
        expect(off.counts).toEqual({ asked: 0, swapped: 0, unavoidable: 0, banded: 0 });

        const on = solveChest(true);
        expect(on.error?.sentinel).toBe(true);
        expect(on.run.ticksCompleted).toBe(CAP);
        expect(on.hits).toEqual([]);
        expect(on.counts.swapped).toBeGreaterThan(0);

        // ON with no chaser in reach is OFF: the forecast was asked on every tick to t657, swapped nothing there, and
        // the keys are OFF's tick for tick; t658 is the first step ON took differently.
        expect(on.countsAtSame.asked).toBeGreaterThan(0);
        expect(on.countsAtSame.swapped).toBe(0);
        expect(on.keys.slice(0, SAME_THROUGH + 1)).toEqual(off.keys.slice(0, SAME_THROUGH + 1));
        expect(on.keys[SAME_THROUGH + 1]).not.toBe(off.keys[SAME_THROUGH + 1]);
    }, 240_000);
});
