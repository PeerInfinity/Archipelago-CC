/**
 * ⛓⛓ SEEDLING FIDELITY LAPSECOST — what `CONTACT_FIDELITY.strikeIframeLapse` cost the solver on L40, repaired behind
 * the switch (OFF byte-identical).
 *
 * D1 (sweep legs `level_40__r23c29 <- … -> exit:out_pit_*`, 11 keys; CI ON 38329988241 / 38330006695 failed ×12):
 * the lapse WIDENS the walk's strike admissions, and the wider walk is a different walk. On leg 403's corridor its
 * lapse presses at t247 (`puncher@128,624`, lands nothing) and t507 (`bob@208,448`, kills at t512 after the body's
 * timer lapsed against the player at t511) leave the player beside a re-armed bob; the probe flags it, AVOID / TIME /
 * BAIT / KILL refuse, and DETOUR's L40 via lattice spends the whole 640-unit budget (2,542 of 2,562 asks at 2,560).
 * The same corridor walked with the pre-lapse admissions probes clean. The ladder now asks that NARROW policy as a
 * rung between KILL and DETOUR (`LAPSE_NARROW_RETRY`; `strikePolicyFor`'s `iframeLapse: false`, certified only if its
 * preview arrives), and walks it when clean: the plan is OFF's plan, key for key, which CI's OFF sweep played to `done`
 * on the game. ⛔ Not BEFORE the ladder: as a pre-ladder candidate it shadowed the cheap rungs on leg 265 (L22), where
 * ON's corridor crosses and the narrow walk is OFF's failing one.
 *
 * D2 (sweep leg 773, `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144`; ON the game left the plan at t103 twice):
 * NOT the lapse — a MODEL GAP the lapse's different plan walked into. `flyer@104,8` hovers over the walk from t96, its
 * "fall" reaches frame 10 at t103 and DROPS on the player (game `hits` 0 → 2, Δy +0.82); the model never stepped a
 * Flyer (it priced one as a static body at its placement). `contactFidelity.flyerLive` steps it (`CHASERS.flyer`): Bob's
 * chase to the player + (0,-10) through no solids, the "fall" and its drop, an empty `hitPlayer`; the danger map prices
 * the drop. OFF by default.
 *
 * The fixture is the page's own captured request (`probe-seedling-divergence-sweep --capture-requests`, the lapse ON,
 * seam time 5085), replayed as the worker replays it (`replay-seedling-solve-request.mjs`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, liveOf, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { animTicks, CHASERS, deathTicks, dropPointCovered, isBridgedChaser } from './chasers.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { chaserDanger } from './dangerMap.js';
import { playerBoxAt } from './playerPhysicsV2.js';
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

const leg265 = () => {
    const line = JSON.parse(gunzipSync(readFileSync(join(EVIDENCE, 'd1', 'leg-265-requests.jsonl.gz')))
        .toString('utf8').split('\n')[0]);
    expect(line.key).toBe('level_22 <- in_L29_0_224 -> exit:out_teleporter_96_192');
    return restoreRequest(line.requests[0].request);
};

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

    it('ON: a corridor the cheap rungs cross is not shadowed — leg 265 (L22) solves with or without the rung (215 t)', () => {
        const req = leg265();
        const on = withContactFidelity({ strikeIframeLapse: true }, () => solve(req));
        LAPSE_NARROW_RETRY.enabled = false;
        let base;
        try {
            base = withContactFidelity({ strikeIframeLapse: true }, () => solve(req));
        } finally {
            LAPSE_NARROW_RETRY.enabled = true;
        }
        expect(on.ok).toBe(true);
        expect(on.plan.solution.length).toBe(215);
        expect(keysOf(on)).toEqual(keysOf(base));
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

const leg773 = () => {
    const line = JSON.parse(gunzipSync(readFileSync(join(EVIDENCE, 'd2', 'leg-773-requests.jsonl.gz')))
        .toString('utf8').split('\n')[0]);
    expect(line.key).toBe('level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144');
    return restoreRequest(line.requests[0].request);
};
const TAPE_773_ON = () => parseTape(readFileSync(join(EVIDENCE, 'd2', 'tape-773-on.json'), 'utf8'));
const FLYER = 'flyer@104,8';
/** ⛓ The GAME witness (p4f, `probe-seedling-chaser-mobiles --class=Flyer --player-hits --record`): the ON plan, t0–t381. */
const W773 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'lapsecost-l105-773-on-flyer.json'), 'utf8'));
/** The sampled ticks where the model's player is not the game's, to the bit. */
const parted = (w, on) => withContactFidelity({ flyerLive: on, strikeIframeLapse: true }, () => {
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: atlasLevelSource() });
    const col = [];
    let r = st.next();
    while (!r.done) {
        col[r.value.observation.t] = r.value.observation;
        r = st.next();
    }
    return w.samples.filter((sm) => !col[sm.t] || col[sm.t].x !== sm.player.x || col[sm.t].y !== sm.player.y
        || col[sm.t].level !== sm.level).map((sm) => sm.t);
});

describe('LAPSECOST D2 — the Flyer, stepped (`flyerLive`)', () => {
    it('ships ON (⚖ MEASUREMENT ONLY (planning-8, NEVER MERGE), with BEAMTOWER\'s drift); bridged only ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.flyerLive).toBe(true);
        withContactFidelity({ flyerLive: false }, () => expect(isBridgedChaser('flyer')).toBe(false));
        withContactFidelity({ flyerLive: true }, () => expect(isBridgedChaser('flyer')).toBe(true));
    });

    it('the row: the drop on "fall"\'s index 6 (frame 10 of [4..22]), 20 updates of "fall", 13 of "die"; the drop point is (x, y+10) in the half-open player box', () => {
        expect(CHASERS.flyer.drop).toMatchObject({ anim: { frames: 19, rate: 30 }, hitIndex: 6, force: 1 });
        expect(CHASERS.flyer.targetOffset).toEqual({ x: 0, y: -10 });
        expect(animTicks(19, 30)).toBe(20);
        expect(deathTicks('flyer')).toBe(13);
        const box = playerBoxAt(100, 100); // x 98..102, y 98..103 (half-open)
        expect(dropPointCovered('flyer', { x: 98, y: 88 }, box)).toBe(true);
        expect(dropPointCovered('flyer', { x: 102, y: 88 }, box)).toBe(false);
        expect(dropPointCovered('flyer', { x: 100, y: 93 }, box)).toBe(false);
    });

    it('the GAME witness: one sample per tick of the ON plan (to its crossing); the game\'s player takes the drop at t103 (hits 0 -> 2)', () => {
        expect(W773.samples.map((sm) => sm.t)).toEqual([...Array(W773.tape.tick_count + 1).keys()]);
        const at = (t) => W773.samples.find((sm) => sm.t === t);
        expect(at(102).player.hits).toBe(0);
        expect(at(103).player).toMatchObject({ hits: 2, x: 132.39769889127305, y: 57.25733636454828 });
    });

    it('ON: the model reproduces every sample at 0 px; OFF parts first at t103', () => {
        expect(parted(W773, true)).toEqual([]);
        expect(parted(W773, false)[0]).toBe(103);
    });

    it('ON: the model\'s Flyers are the game\'s at every sample (position and velocity, to the bit)', () => {
        withContactFidelity({ flyerLive: true, strikeIframeLapse: true }, () => {
            const tape = parseTape(JSON.stringify(W773.tape));
            const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
            const key = (b) => `${b.x},${b.y},${b.vx},${b.vy}`;
            const bad = [];
            for (let t = 0; t <= tape.tick_count; t += 1) {
                if (t > 0) run.advance(heldKeysAt(tape, t - 1));
                const sm = W773.samples.find((x) => x.t === t);
                if (!sm || run.level !== 105) continue;
                const model = [...(run.entities('chasers') ?? [])].filter((c) => c.tag === 'flyer')
                    .map((c) => key({ x: c.x, y: c.y, vx: c.vx, vy: c.vy })).sort();
                const game = sm.bodies.map(key).sort();
                if (model.join('|') !== game.join('|')) bad.push(t);
            }
            expect(bad).toEqual([]);
        });
    });

    it('ON: the run bills the drop at t103 (hits 2, from (135.10, 47.02)) and leaves the player where the game did; OFF bills nothing', () => {
        const run773 = (on) => withContactFidelity({ flyerLive: on, strikeIframeLapse: true }, () => {
            const tape = TAPE_773_ON();
            const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
            let at103 = null;
            for (let t = 0; t < 103; t += 1) run.advance(heldKeysAt(tape, t));
            at103 = { x: run.state.x, y: run.state.y };
            return { hits: run.playerHits, at103 };
        });
        const on = run773(true);
        expect(on.hits).toHaveLength(1);
        expect(on.hits[0]).toMatchObject({ t: 103, source: 'drop', id: FLYER, hits: 2 });
        // the game's row at t103 (sweep leg 773, `divs`): x 132.39769889127305, y 57.25733636454828
        expect(on.at103.x).toBeCloseTo(132.39769889127305, 9);
        expect(on.at103.y).toBeCloseTo(57.25733636454828, 9);
        const off = run773(false);
        expect(off.hits).toEqual([]);
        expect(off.at103).toEqual({ x: 132.46123909214995, y: 56.44143273057935 });
    });

    it('ON: the chaser forecast reports the drop on the same tick and the transit danger arm prices it', () => {
        withContactFidelity({ flyerLive: true, strikeIframeLapse: true }, () => {
            const tape = TAPE_773_ON();
            const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
            for (let t = 0; t < 95; t += 1) run.advance(heldKeysAt(tape, t));
            const fc = run.chaserForecast();
            const priced = [];
            for (let t = 95; t < 107; t += 1) {
                const p = { ...run.state };
                const bodies = fc.step(p);
                const f = bodies.find((b) => b.id === FLYER);
                if (f?.drop) {
                    expect(f.drop.hitsPlayer).toBe(true);
                    const d = chaserDanger(run, playerBoxAt(p.x, p.y), 0, bodies, { perTick: true });
                    priced.push([t + 1, d.some((x) => x.id === FLYER && /the drop/.test(x.why))]);
                }
                run.advance(heldKeysAt(tape, t));
            }
            expect(priced).toEqual([[103, true]]);
        });
    });

    // ⚠ A MODEL row, not a game one: played on p4f this plan parts at t205 (the game's player is blocked at x 66.04 by
    // `beamtower@48,40`, whose Solid drifts in y — `BeamTower.update`'s `y += 0.3 sin(…)`, not modelled; the report's D2).
    // ⛓ fidelity BEAMTOWER D2: with the defaults flipped the drift is ON too, and the 381-t plan is the one the risen
    // tower blocks at t205 on the game — the solve now takes 426 t (the model row; the game check is the keyed sweep).
    it('ON: leg 773\'s request (its live digest re-derived ON, as a page with the switch sends it) solves in 426 t with no hit', () => {
        const req = leg773();
        const out = withContactFidelity({ flyerLive: true, strikeIframeLapse: true }, () => {
            const { passes = ANYTIME_PASSES, source, ...tape } = req;
            const levelSource = levelSourceFromAtlas(source.records);
            const live = liveOf(replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource }));
            return solveAnytime({ ...tape, live, source, levelSource }, { passes });
        });
        expect(out.ok).toBe(true);
        expect(out.plan.solution.length).toBe(426);
    }, 60000);
});
