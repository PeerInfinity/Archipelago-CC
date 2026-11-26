/**
 * seedlingDemo/hammerPressKillStartWait.train.test — ⛓ hammer-phase STEP149 (`PRESS_KILL_START_WAIT`, OFF): the witness.
 *
 * The page worker's own request, re-measure-8's probe P1 32:10 (L40 Totem 64,144, the "continue on from the held room"
 * solve at 640): OFF it refuses on the spinner press kill as the page did (work 208; main's answer `3b4bc4163c9b`,
 * *"kill (spinner@192,128) by press: every key set … lands the player box on … the 13 px hammer line"*); ON the refused
 * kill is redone from its first tick as one fight search and the request SOLVES, and its keys replayed on a fresh run
 * after the request's own prefix bill no hit and no death. Train tier: two whole-request solves (~20 s).
 */
import { describe, expect, it } from 'vitest';

import { solveCapturedP1_32_10 } from './hammerPressKillStartWaitRows.js';
import {
    PRESS_KILL_START_WAIT_COUNTS, resetPressKillStartWaitCounts, withPressKillStartWait,
} from './solverBot.js';

describe('PRESS_KILL_START_WAIT — re-measure-8 P1 32:10 (L40 Totem 64,144)', () => {
    it('OFF: the page\'s refusal (main\'s wording), and the switch never asked', () => {
        resetPressKillStartWaitCounts();
        const off = withPressKillStartWait(false, () => solveCapturedP1_32_10());
        expect(off.ok).toBe(false);
        // main's answer (the page's was `dc09599d8d62` at re-measure-8's older base: the same work, the wording moved)
        expect(off.answer).toBe('3b4bc4163c9b');
        expect(off.work).toBe(208);
        expect(off.message).toContain('kill (spinner@192,128) by press: every key set');
        expect(PRESS_KILL_START_WAIT_COUNTS.rows).toEqual([]);
    }, 120000);

    it('ON: solved; the plan replayed on a fresh run bills no hit and no death; the redo with no idle kept', () => {
        resetPressKillStartWaitCounts();
        const on = withPressKillStartWait(true, () => solveCapturedP1_32_10());
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.end.level).toBe(40);
        for (const p of on.passes.filter((x) => x.ok)) expect(p.modelHits).toEqual({ hits: 0, deaths: 0 });
        const rows = PRESS_KILL_START_WAIT_COUNTS.rows;
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(r.refused).toBe('HAMMER_SAFETY');
            expect(r.verdict).toBe('solved');
            expect(r.tries.map((x) => `${x.wait}:${x.verdict}`)).toEqual(['0:solved']);
        }
    }, 120000);
});
