/**
 * ⛓⛓ SEEDLING FIDELITY LAPSECOST — what `CONTACT_FIDELITY.strikeIframeLapse` cost the solver on L40, repaired behind
 * the switch (OFF byte-identical).
 *
 * D1 (sweep legs `level_40__r23c29 <- … -> exit:out_pit_*`, 11 keys; CI ON 38329988241 / 38330006695 failed ×12):
 * the lapse WIDENS the walk's strike admissions, and the wider walk is a different walk. On leg 403's corridor its
 * lapse presses at t247 (`puncher@128,624`, lands nothing) and t507 (`bob@208,448`, kills at t512 after the body's
 * timer lapsed against the player at t511) leave the player beside a re-armed bob; the probe flags it, AVOID / TIME /
 * BAIT / KILL refuse, and DETOUR's L40 via lattice spends the whole 640-unit budget (2,542 of 2,562 asks at 2,560).
 * The same corridor walked with the pre-lapse admissions probes clean. `walkTo` now probes that NARROW policy once
 * before the ladder (`LAPSE_NARROW_RETRY`; `strikePolicyFor`'s `iframeLapse: false`), and walks it when clean: the
 * plan is OFF's plan, key for key, which CI's OFF sweep played to `done` on the game.
 *
 * The fixture is the page's own captured request (`probe-seedling-divergence-sweep --capture-requests`, the lapse ON,
 * seam time 5085), replayed as the worker replays it (`replay-seedling-solve-request.mjs`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { LAPSE_NARROW_RETRY } from './solverBot.js';
import { strikeCandidates } from './strikePolicy.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-fidelity-lapsecost-evidence');

const leg403 = () => {
    const line = JSON.parse(gunzipSync(readFileSync(join(EVIDENCE, 'd1', 'leg-403-requests.jsonl.gz')))
        .toString('utf8').split('\n')[0]);
    expect(line.key).toBe('level_40__r23c29 <- in_L43_176_464 -> exit:out_pit_13_20');
    return restoreRequest(line.requests[0].request);
};

const solve = (req, over = {}) => {
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    return solveAnytime({ ...tape, ...over, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
};

const keysOf = (answer) => answer.plan.solution.map((k) => [...k].sort().join('+'));

describe('LAPSECOST D1 — the narrow strike policy', () => {
    // a bob 10 px right of the player, its i-frame at reading 4: a lapse press's window reaches the lapse
    const player = { x: 100, y: 100 };
    const body = { id: 'bob@96,96', as3: 'Bob', enemyClass: 'Bob', hitsTimer: 4,
        rect: { x: 106, y: 96, w: 8, h: 8, right: 114, bottom: 104 } };
    const ask = (o = {}) => strikeCandidates(player, [body],
        { facingToward: () => 0, owed: new Map(), tick: 10, ...o });

    it('`strikeCandidates`\' `iframeLapse: false` asks the pre-lapse question with the switch ON; OFF it is inert', () => {
        withContactFidelity({ strikeIframeLapse: true }, () => {
            expect(ask().chosen.map((c) => c.id)).toEqual(['bob@96,96']);
            expect(ask().chosen[0].iframeLapse).toBeTruthy();
            const narrow = ask({ iframeLapse: false });
            expect(narrow.chosen).toEqual([]);
            expect(narrow.rejected[0].why).toMatch(/hitsTimer 4/);
        });
        withContactFidelity({ strikeIframeLapse: false }, () => {
            expect(ask()).toEqual(ask({ iframeLapse: false }));
            expect(ask().chosen).toEqual([]);
        });
    });

    it('the switch\'s companion is ON by default and named for a node A/B (`SEEDLING_LAPSE_NARROW_RETRY=0`)', () => {
        expect(LAPSE_NARROW_RETRY.enabled).toBe(true);
    });

    it('ON: leg 403 solves inside the page budget, with OFF\'s plan key for key (776 t)', () => {
        const req = leg403();
        expect(req.budgetWork).toBe(640);
        const off = withContactFidelity({ strikeIframeLapse: false }, () => solve(req));
        const on = withContactFidelity({ strikeIframeLapse: true }, () => solve(req));
        expect(off.ok).toBe(true);
        expect(on.ok).toBe(true);
        expect(on.plan.solution.length).toBe(776);
        expect(on.work).toBeLessThan(req.budgetWork);
        expect(keysOf(on)).toEqual(keysOf(off));
    }, 60000);

    it('MUTANT (the companion off): ON, the same request is refused at the DETOUR rung\'s budget', () => {
        const req = leg403();
        LAPSE_NARROW_RETRY.enabled = false;
        try {
            const on = withContactFidelity({ strikeIframeLapse: true }, () => solve(req, { budgetWork: 160 }));
            expect(on.ok).toBe(false);
            expect(on.passes[0]).toMatchObject({ pass: 'dashless', ok: false, deadline: 'detour', limit: 'budget' });
        } finally {
            LAPSE_NARROW_RETRY.enabled = true;
        }
    }, 60000);
});
