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
import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set (fidelity-18's request)
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
import { stanceHypothesisProbe, withApproachDoor, withBombPhaseWait, withLatchWeighFirst } from './solverBot.js';
import { compareCorpseBumpWitness, corpseBumpModelSamples } from './fidelityCorpseBump.js';
import { L40BK2_D1_SWITCHES, L40BK2_D2_SWITCHES, L40BK2_WITNESS_DIR, l40Bk2PocketChecks, l40Bk2PocketShippedChecks, l40Bk2Solve,
    l40Bk2Step67Boot, unpackL40Bk2Sample } from './fidelityL40Bk2.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { afterWitness, afterWitnessReplay, sortedInputs } from './fidelityAfterRows.js';
import { l40LatchModelSamples } from './fidelityL40Latch.js';

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

    it('ON: the chain walks the south door\'s links and ends in the hammer arc\'s press kill (D3\'s hand-over)', () => withL40Flip(false, async () => {
        // ⛓ L40-FLIP-BUILD: pinned without the flip set (a BEFORE pin). With the flip ON this door-shut solve stops earlier, at
        // `buttonroom@880,768` (APPROACH_DOOR/LATCH_WEIGH_FIRST try the south door first); the route never reaches this state —
        // the walk carries the door (DOOR-CARRY).
        const { out, refusal } = await l40Bk2Solve(await l40Bk2Step67Boot(), L40BK2_D1_SWITCHES);
        expect(out).toBeNull();
        expect(refusal.message).not.toContain('no REACHABLE stance inside button@816,400');
        expect(refusal.message).toContain('-> shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432) '
            + '-> chest stance (chest@880,816) -> kill (spinner@880,848) by press: the player died at t767 '
            // ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip, ⚖ user 2026-11-11): spinner@816,848 walls bob@736,752's first step (t544), so the bob reaches the press 13 ticks sooner (t780 before).
            + '(chaser bob@736,752)');
        expect(refusal.message).toContain('PRESS_KILL_REBOOT_GUARD');
    }), 300_000);

    // ⛓⛓ seedling-fidelity-afterrows (wave 41): the AFTER of the row above, at the SHIPPED defaults. As its comment says,
    // the door-shut solve now stops before a tick at `buttonroom@880,768` (the south door's latch, tried first): the
    // chain's links from the arrival are NOT walked here at the defaults (COVERAGE MOVED — the shipped chain is the
    // pocket boot's SOLVE, `l40bk2-pocket-shipped` in the train tier, and the latch boot's, `l40latch-orbit-shipped`).
    it('AFTER (the shipped defaults): the door-shut arrival refuses before a tick — no REACHABLE stance inside buttonroom@880,768, the three weigh locks walled', async () => {
        const { out, refusal } = await l40Bk2Solve(await l40Bk2Step67Boot(), L40BK2_D1_SWITCHES);
        expect(out).toBeNull();
        expect(refusal.message.startsWith('solverBot: no REACHABLE stance inside buttonroom@880,768 in level 40 — 1 cell(s) '
            + 'land the player box in the button and none of them plans a corridor from (488,578.0000000000008).')).toBe(true);
        for (const id of ['wandlock@448,432', 'wandlock@512,480', 'wandlock@800,400']) {
            expect(refusal.message).toContain(`${id} — its group t=`);
        }
        expect(refusal.perTick.length).toBe(0);
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

describe('L40BK2 AFTER — the pocket boot\'s SOLVE at the shipped defaults, on the game (`l40bk2-pocket-shipped`)', () => {
    // ⛓⛓ seedling-fidelity-afterrows (wave 41): at the SHIPPED defaults (the L40 flip set ON) the pocket solve SOLVES
    // Boss Key 2 in 4692 t (the BEFORE, `l40bk2-pocket-chain`, refused at 2650 t). The plan, played on p4g
    // (`probe-seedling-l40bk2.mjs --only=l40bk2-pocket-shipped --record`); the train tier pins it as the solve.
    const w = JSON.parse(readFileSync(join(L40BK2_WITNESS_DIR, 'l40bk2-pocket-shipped.json'), 'utf8'));
    const game = w.samples.map(unpackL40Bk2Sample);

    it('the recording: p4g, never hit, the player ends on the key', () => {
        expect(w.page).toBe('seedling_bot_ap_p4g');
        expect(w.tape.tick_count).toBe(4692);
        expect(game.length).toBeGreaterThan(4600);
        for (const c of l40Bk2PocketShippedChecks(game)) expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
    });

    it('the model at the shipped defaults reproduces it at 0 px, never hit', async () => {
        const model = await l40LatchModelSamples(w.tape, L40BK2_D1_SWITCHES);
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(game, model.samples)).toEqual([]);
        expect(model.hits).toEqual([]);
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

    it('OFF, seam 5290: the 1600 t plan, and the model takes spinner@192,144\'s hammer at t1222 (L40RES\'s hit)', () => withL40Flip(false, () => {
        const a = solveAt(5290, { dashSpinnerForecast: false });
        // ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip, ⚖ user 2026-11-11): spinner@816,848 walls bob@736,752's first step (t544), so the plan is 1567 t (1600 t, `1da60bcb4c0d`, before).
        expect([a.ok, a.ticks, a.plan]).toEqual([true, 1567, 'abf1e13c3bf7']);
        expect(a.hits).toEqual([[1222, 'spinner-hammer', 'spinner@192,144']]);
    }), 120_000);

    it('ON, seam 5290: that plan is not certified — the answer is the bomb-pusher hold\'s refusal, no hit plan', () => withL40Flip(false, () => {
        const a = solveAt(5290, L40BK2_D2_SWITCHES);
        expect(a.ok).toBe(false);
        expect(a.message).toMatch(/-> hold: the hold stands still .* inside bombpusher@112,128's 256 px reach/);
    }), 120_000);

    it('ON, seam 5280: OFF\'s hitless 1558 t plan, the same plan byte for byte', () => withL40Flip(false, () => {
        const off = solveAt(5280, { dashSpinnerForecast: false });
        const on = solveAt(5280, L40BK2_D2_SWITCHES);
        // ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip, ⚖ user 2026-11-11): spinner@816,848 walls bob@736,752's first step (t544), so the plan is 1555 t (1558 t, `32f29414cd8e`, before), still hitless.
        expect([off.ok, off.ticks, off.plan, off.hits]).toEqual([true, 1555, '2c4b20d9853c', []]);
        expect(on).toEqual(off);
    }), 240_000);

    // ⛓⛓ seedling-fidelity-afterrows (wave 41): the three rows above are BEFORE pins (`withL40Flip(false)`). At the
    // SHIPPED defaults leg 368 plans ONE hitless 1714 t plan at both seams and in both arms: the t1222 hammer hit is
    // gone (so D2's refusal has nothing to refuse — that property is not exercised at the defaults), and the plan is a
    // game witness (`afterrows-l40-368-s5290`, p4g, 0 px, 0 hits). A GAIN: the 1567 t BEFORE plan took a hit.
    it('AFTER (the shipped defaults) of the three: seams 5290 and 5280, OFF and ON — one hitless 1714 t plan, `b142543aace2`', () => {
        const want = { ok: true, ticks: 1714, plan: 'b142543aace2', hits: [] };
        expect(solveAt(5290, { dashSpinnerForecast: false })).toEqual(want);
        expect(solveAt(5290, L40BK2_D2_SWITCHES)).toEqual(want);
        expect(solveAt(5280, { dashSpinnerForecast: false })).toEqual(want);
        expect(solveAt(5280, L40BK2_D2_SWITCHES)).toEqual(want);
    }, 300_000);

    it('AFTER control: the shipped defaults MINUS `BOMB_PHASE_WAIT` alone keep all three BEFORE pins (measured: each of the twelve flip switches OFF alone; only it moves leg 368)', () => withBombPhaseWait(false, () => {
        expect(solveAt(5290, { dashSpinnerForecast: false })).toEqual({ ok: true, ticks: 1567, plan: 'abf1e13c3bf7',
            hits: [[1222, 'spinner-hammer', 'spinner@192,144']] });
        const on = solveAt(5290, L40BK2_D2_SWITCHES);
        expect(on.ok).toBe(false);
        expect(on.message).toMatch(/-> hold: the hold stands still .* inside bombpusher@112,128's 256 px reach/);
        const off80 = solveAt(5280, { dashSpinnerForecast: false });
        expect([off80.ok, off80.ticks, off80.plan, off80.hits]).toEqual([true, 1555, '2c4b20d9853c', []]);
        expect(solveAt(5280, L40BK2_D2_SWITCHES)).toEqual(off80);
    }), 300_000);

    it('AFTER: the 1714 t plan at seam 5290 is the game witness `afterrows-l40-368-s5290` (through t1702) — never hit, the model at 0 px', () => {
        const w = afterWitness('afterrows-l40-368-s5290');
        const c = line.requests[0].request;
        const req = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: 5290 } } });
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
        const st = buildStagedTape({ staging: { ...tape.staging, inventory_slots: undefined },
            perTick: answer.plan.solution.map((k) => new Set(k)), name: w.tape.name });
        expect(sortedInputs(st.inputs)).toEqual(sortedInputs(w.tape.inputs));
        expect(w.page).toBe('seedling_bot_ap_p4g');
        // ⚠ recorded through t1702: from t1703 the model's bombpusher@112,128 fires its last Bomb 3 ticks before the game's
        // (the player and the hits still agree there) — a model gap named in the afterrows report, not pinned here.
        expect(w.upto).toBe(1702);
        expect(w.samples.length).toBeGreaterThan(1680);
        expect(w.samples.every((s) => s.hits === 0)).toBe(true);
        const m = afterWitnessReplay(w);
        expect([m.parted, m.hits]).toEqual([[], []]);
    }, 180_000);
});
