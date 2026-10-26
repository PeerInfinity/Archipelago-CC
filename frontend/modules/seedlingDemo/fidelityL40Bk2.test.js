/**
 * seedling-fidelity-l40bk2 (wave 31) — L40's Boss Key 2 chain (D1, `weighHypothesisChain`) and leg 368's hit-aware
 * dash certificate (D2, `dashSpinnerForecast`, ⛓ hammer hand-over 368). Both ship OFF.
 *
 * ⛓ D1 (survey step 67; legs 869/870 = 859/860 at this base). OFF the arrival refuses at `button@816,400`'s stance with
 * all three of the chain's weigh locks walled by guard (iii). ON they are admitted under the rest of the hypothesis,
 * and the walk to the stance passes its unbindable nearest order (`pushableblockfire@576,576`) to the next door: the
 * chain then walks the south door's links and ends in the hammer arc's `kill (spinner@880,848) by press` (D3).
 * From inside the lock room the solver builds links 4–9 itself; `fixtures/l40bk2-witness/l40bk2-pocket-chain.json` is
 * those ticks played on p4g (`probe-seedling-l40bk2.mjs --record`).
 *
 * ⛓ D2 (leg 368 at seam 5290, the L40RES hit). The request (`leg368-request.jsonl.gz`: the sweep's capture at 89da08f355,
 * L40's records only — the answer is byte-identical to the full set's) plans 1600 t OFF and the model replay takes
 * `spinner@192,144`'s hammer at t1222. ON the walk's own spinner rows price the struck spinner where the dash left it:
 * that plan is refused, and a seam where OFF's plan is hitless answers the same plan ON.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import { stanceHypothesisProbe } from './solverBot.js';
import { compareCorpseBumpWitness, corpseBumpModelSamples } from './fidelityCorpseBump.js';
import { L40BK2_D1_SWITCHES, L40BK2_D2_SWITCHES, L40BK2_WITNESS_DIR, l40Bk2PocketChecks, l40Bk2Solve,
    l40Bk2Step67Boot, unpackL40Bk2Sample } from './fidelityL40Bk2.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const STEP67_REFUSAL = 'solverBot: no REACHABLE stance inside button@816,400 in level 40 — 1 cell(s) land the player '
    + 'box in the button and none of them plans a corridor from (488,904).';

describe('L40BK2 — the switches', () => {
    // ⛓ planning-13's wave-31 flip: D1 ships ON (⚖ user 2026-10-25).
    // ⛓ and D2 after the L18 wall-time check (⚖ user "Chain ON; forecast after L18"; hammer-2 signed its re-pins).
    it('both ship ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.weighHypothesisChain).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.dashSpinnerForecast).toBe(true);
    });
});

describe('L40BK2 D1 — a weigh\'s holder derived under the rest of the stance hypothesis', () => {
    const run = async (over) => {
        const boot = await l40Bk2Step67Boot();
        return withContactFidelity(over, () => createRunForStaging(
            solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource()));
    };

    it('OFF: none of the chain\'s three weigh locks is in the hypothesis at the arrival (guard iii walls them)', async () => {
        const r = await run({ weighHypothesisChain: false });
        const ids = withContactFidelity({ weighHypothesisChain: false }, () => stanceHypothesisProbe(r)).map((h) => h.id);
        expect(ids).toContain('wandlock@480,560');
        for (const id of ['wandlock@448,432', 'wandlock@512,480', 'wandlock@800,400']) expect(ids).not.toContain(id);
    });

    it('ON: t2\'s two locks (the corpse, behind the south door) and t5\'s (the fire block\'s route, across t2) join it', async () => {
        const r = await run(L40BK2_D1_SWITCHES);
        const h = withContactFidelity(L40BK2_D1_SWITCHES, () => stanceHypothesisProbe(r));
        for (const id of ['wandlock@448,432', 'wandlock@512,480', 'wandlock@800,400']) {
            expect(h).toContainEqual({ id, kind: 'activator', strategy: 'weigh' });
        }
        expect(h).toContainEqual({ id: 'wandlock@480,560', kind: 'activator', strategy: 'hold' });
    }, 60_000);

    it('OFF: survey step 67 refuses at button@816,400 with the three locks walled — the sweep\'s text', async () => {
        const { out, refusal } = await l40Bk2Solve(await l40Bk2Step67Boot(), { weighHypothesisChain: false });
        expect(out).toBeNull();
        expect(refusal.message.startsWith(STEP67_REFUSAL)).toBe(true);
        for (const id of ['wandlock@448,432', 'wandlock@512,480', 'wandlock@800,400']) {
            expect(refusal.message).toContain(`${id} — its group t=`);
        }
    }, 60_000);

    it('ON: the chain walks the south door\'s links and ends in the hammer arc\'s press kill (D3\'s hand-over)', async () => {
        const { out, refusal } = await l40Bk2Solve(await l40Bk2Step67Boot(), L40BK2_D1_SWITCHES);
        expect(out).toBeNull();
        expect(refusal.message).not.toContain('no REACHABLE stance inside button@816,400');
        expect(refusal.message).toContain('-> shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432) '
            + '-> chest stance (chest@880,816) -> kill (spinner@880,848) by press: the player died at t780 '
            + '(chaser bob@736,752)');
        expect(refusal.message).toContain('PRESS_KILL_REBOOT_GUARD');
    }, 300_000);
});

describe('L40BK2 D1 — the solver\'s own chain from inside the lock room, on the game (p4g, 0 px)', () => {
    const w = JSON.parse(readFileSync(join(L40BK2_WITNESS_DIR, 'l40bk2-pocket-chain.json'), 'utf8'));
    const game = w.samples.map(unpackL40Bk2Sample);

    it('the recording: p4g, every sampled tick, the game\'s chain checks', () => {
        expect(w.page).toBe('seedling_bot_ap_p4g');
        // the poll reads the game as it runs, so a few ticks fall between reads (2643 of 2650 recorded)
        expect(w.tape.tick_count).toBe(2650);
        expect(game.length).toBeGreaterThan(2600);
        expect(game.at(-1).t).toBe(2649);
        for (const c of l40Bk2PocketChecks(game)) expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
    });

    it('the model (D1 ON) reproduces the game at 0 px — the player, every block, every chaser and the turret', async () => {
        const model = await corpseBumpModelSamples(w.tape, L40BK2_D1_SWITCHES);
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(game, model.samples).slice(0, 3)).toEqual([]);
    }, 180_000);

    it('the model at the shipped defaults (D1 OFF) reproduces it too: D1 is solver-only', async () => {
        const model = await corpseBumpModelSamples(w.tape, { weighHypothesisChain: false });
        expect(compareCorpseBumpWitness(game, model.samples).slice(0, 3)).toEqual([]);
    }, 180_000);
});

describe('L40BK2 D2 — leg 368: a struck spinner priced where the walk\'s own strike left it', () => {
    const line = JSON.parse(gunzipSync(readFileSync(join(L40BK2_WITNESS_DIR, 'leg368-request.jsonl.gz'))).toString('utf8'));
    const solveAt = (time, over) => withContactFidelity(over, () => {
        const c = line.requests[0].request;
        const req = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time } } });
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
        if (!answer.ok) return { ok: false, message: answer.message };
        const sol = answer.plan.solution.map((k) => [...k]);
        const st = buildStagedTape({ staging: { ...tape.staging, inventory_slots: undefined },
            perTick: sol.map((k) => new Set(k)), name: 'l40bk2-368' });
        const res = runTape(parseTape(JSON.stringify(st)), { levelSource: atlasLevelSource() });
        return { ok: true, ticks: sol.length, plan: createHash('sha1').update(JSON.stringify(sol)).digest('hex').slice(0, 12),
            hits: res.playerHits.map((h) => [h.t, h.source, h.id]) };
    });

    it('the capture: leg 368, captured at seam 5280 (the sweep\'s), L40\'s records only', () => {
        expect(line.key).toBe('level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144');
        expect(line.requests[0].request.staging.seam.time).toBe(5280);
    });

    it('OFF, seam 5290: the 1600 t plan, and the model takes spinner@192,144\'s hammer at t1222 (L40RES\'s hit)', () => {
        const a = solveAt(5290, { dashSpinnerForecast: false });
        expect([a.ok, a.ticks, a.plan]).toEqual([true, 1600, '1da60bcb4c0d']);
        expect(a.hits).toEqual([[1222, 'spinner-hammer', 'spinner@192,144']]);
    }, 120_000);

    it('ON, seam 5290: that plan is not certified — the answer is the bomb-pusher hold\'s refusal, no hit plan', () => {
        const a = solveAt(5290, L40BK2_D2_SWITCHES);
        expect(a.ok).toBe(false);
        expect(a.message).toMatch(/-> hold: the hold stands still .* inside bombpusher@112,128's 256 px reach/);
    }, 120_000);

    it('ON, seam 5280: OFF\'s hitless 1558 t plan, the same plan byte for byte', () => {
        const off = solveAt(5280, { dashSpinnerForecast: false });
        const on = solveAt(5280, L40BK2_D2_SWITCHES);
        expect([off.ok, off.ticks, off.plan, off.hits]).toEqual([true, 1558, '32f29414cd8e', []]);
        expect(on).toEqual(off);
    }, 240_000);
});
