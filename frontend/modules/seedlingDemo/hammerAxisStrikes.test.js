/**
 * ⛓⛓ SEEDLING HAMMER-PHASE AXIS — strikes on axis-aligned walks, aimed only along the walk's own axis (`AXIS_STRIKE`,
 * OFF). ⚖ The user queued this on 2026-10-31 from OPP's hand-over: *"A grid-preserving strike (aim only along the held
 * axis …) would be a new policy row, needing its own measurement against the skirted-lane rows."*
 *
 * `walkToUnder`'s axis-aligned walks (Swim U2's skirt approach, PROXIMITY's `skirtGridKept`, RULESREF's puncher exit)
 * are strike-free OFF because the policy's aim key toward a body off the walk's axis adds the second axis back. ON they
 * are handed `strikePolicyFor(run, {axisAlong: true})` (`axisStrikeFor`): the one policy, offered on each aim tick only
 * the bodies whose facing lies on the walk's axis (`walkAxisOf`).
 *
 * The scene is L6's `bob@112,48` (the room `r9-l6-bob-press` drives, `solverBot.test.js`'s strike rows): an
 * axis-aligned walk east along y = 56 from (88,56), with the bob dead ahead on the lane. OFF the walk holds `right` into
 * it and is hit at t20. ON the policy aims `right` (the walk's own key) at t10, presses at t11, and the hit lands in the
 * model at t12; y is 56 on every tick and x stays on the 0.05 grid. The preview spends the same keys (⚖ 30(c)).
 *
 * ⛓⛓ AXIS-L12HITS (⚖ the user queued it on 2026-11-02, from the divergence sweep: ON, the 8 L12 legs to
 * `bosslock@416,240` / `@432,240` pass with 2 hits). The state is the page's own request: leg 149 (`level_12__r0c19 <-
 * in_L88_96_304 -> location:L12 flag 4: bosslock@416,240 cleared`), captured at main `6d9f9917`, its atlas records cut to
 * level 12 (byte-identical answers to the uncut capture, OFF, ON and at the base). ON without the clear-tag hold's tail
 * (what the base did; reproduced here with `KEYLOCK_WAIT_PRICED` off, the tail's own instrument) the axis strikes keep
 * the transit to the keylock stance clean, so the aligned walk is adopted, the puncher is left alive on its first hits,
 * and it punches the standing player at t375 and t415 — the game's own ticks (the sweep's `exact` rows). With the tail
 * (`axisClearTagStand`) the walk's probe meets the punch, the kill runs first, and the answer is OFF's byte for byte.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import { drive } from './botDriverV2.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import {
    axisClearTagStand, axisStrikeFor, KEYLOCK_WAIT_PRICED, previewWalk, solveSegment, strikePolicyFor, walkAxisOf,
    withKeylockWaitPriced,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import {
    AXIS_STRIKE, AXIS_STRIKE_COUNTS, AXIS_STRIKE_DEFAULT, resetAxisStrikeCounts, withAxisStrike,
} from './pressKillCost.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const levelSource = atlasLevelSource();
const BOB = 'bob@112,48';
const LANE_Y = 56;
const AIM = { x: 160, y: LANE_Y };
/** Filled from the first measured run below. */
const EXPECT_LANDED = [[12, BOB, 1]];
const key = (h) => [...h].sort().join('+') || '-';

const l6 = () => createLevelRun({
    levelSource, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [], noDamage: false,
    grants: [], persistence: [], despawn: [], equips: [], pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
});

/** The axis-aligned drive east along the lane, `strike` the walk's policy, capped at `cap` ticks. */
function driveLane(on, cap = 40) {
    const run = l6();
    resetAxisStrikeCounts();
    const strike = withAxisStrike(on, () => axisStrikeFor(run));
    const perTick = [];
    const pos = [];
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        if (run.ticksCompleted >= cap) throw Object.assign(new Error(`AXIS sentinel: t${cap}`), { sentinel: true });
        const out = advance(k);
        pos.push({ x: run.state.x, y: run.state.y, vy: run.state.vy });
        return out;
    };
    try {
        drive(run, AIM, perTick, { until: 'arrival', tolerance: 0, maxTicks: 400, what: 'the AXIS lane',
            avoidVolumes: false, strike, axisAligned: true });
    } catch (e) {
        if (!e.sentinel) throw e;
    }
    return { run, strike, keys: perTick.map(key), pos, counts: { ...AXIS_STRIKE_COUNTS } };
}

const L12_LEG = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-axis-l12',
    'leg149-l12-request.json.gz'))).toString('utf8'));
const PUNCHER = 'puncher@416,256';
/** The regression's hits, measured (the base tree ON, the sweep's game rows): the puncher's punches in the hold. */
const L12_REGRESSED_HITS = [[375, 'punch', PUNCHER], [415, 'punch', PUNCHER]];

/** Leg 149's captured request solved as the worker does, the switch at `on`; the model's hits re-driven from the plan. */
function solveL12(on) {
    const req = restoreRequest(L12_LEG.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource12 = levelSourceFromAtlas(source.records);
    const answer = withAxisStrike(on, () => solveAnytime({ ...tape, source, levelSource: levelSource12 }, { passes }));
    expect(answer.ok).toBe(true);
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource: levelSource12, scratchPersistence: tape.scratchPersistence });
    return { ticks: answer.plan.solution.length, plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
        hits: shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]) };
}

/** A body of L6's room and a state beside it, for the policy's own question (`decide`), asked once. */
function sceneBeside(dx, dy, { vx = 0, vy = 0 } = {}) {
    const run = l6();
    const bodies = run.strikeBodies;
    const bob = bodies.find((b) => b.id === BOB);
    const cx = (bob.rect.x + bob.rect.right) / 2;
    const cy = (bob.rect.y + bob.rect.bottom) / 2;
    return { run, bodies, state: { ...run.state, x: cx - dx, y: cy - dy, vx, vy } };
}

describe('hammer-phase AXIS — strikes on axis-aligned walks, aimed along the walk\'s axis (`AXIS_STRIKE`)', () => {
    it('ships OFF (`SEEDLING_AXIS_STRIKE=1` turns it on in node; the page channel knows the name)', () => {
        expect(AXIS_STRIKE_DEFAULT).toBe(false);
        expect(AXIS_STRIKE.enabled).toBe(ENV.SEEDLING_AXIS_STRIKE === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_AXIS_STRIKE');
        const run = l6();
        // OFF the axis-aligned walk keeps its strike-free policy; ON it gets the axis-along row.
        expect(withAxisStrike(false, () => axisStrikeFor(run))).toBeNull();
        expect(withAxisStrike(true, () => axisStrikeFor(run))).not.toBeNull();
        expect(AXIS_STRIKE.enabled).toBe(ENV.SEEDLING_AXIS_STRIKE === '1');
    });

    it('the census tick: OFF walks the lane into the bob, ON strikes it ALONG the axis with the lane exact', () => {
        const off = driveLane(false);
        const on = driveLane(true);
        // OFF: no press, the bob's contact lands at t20.
        expect(off.strike).toBeNull();
        expect(off.keys.some((k) => k.includes('primary'))).toBe(false);
        expect(off.run.playerHits.map((h) => [h.t, h.id])).toEqual([[20, BOB]]);
        // ON: the aim at t10 is the walk's own key (`right`, the x axis), the press at t11 holds `primary` alone; the
        // knocked-back bob is struck again at t37, aimed `left` — BACK along the same axis.
        expect(on.strike.trace.filter((t) => t.decision !== 'none').map((t) => [t.tick, t.decision, t.direction ?? null]))
            .toEqual([[10, 'aim', 0], [11, 'press', null], [37, 'aim', 2], [38, 'press', null]]);
        expect([on.keys[10], on.keys[11], on.keys[37], on.keys[38]]).toEqual(['right', 'primary', 'left', 'primary']);
        expect(on.counts).toMatchObject({ policies: 1, aimed: 2, pressed: 2 });
        // the kill's first hit is game-modelled: `enemyHit` lands on the bob at t12, and the player is not hit by t40.
        expect(on.run.chaserPressHits.filter((h) => h.landed).map((h) => [h.t, h.id, h.hits])).toEqual(EXPECT_LANDED);
        expect(on.run.playerHits).toEqual([]);
        // the lane: y is the lane's on every tick of both arms (no y velocity ever). ON, x also stays on the walk's
        // 0.05 grid for all 40 ticks; OFF leaves it at t20, the bob's contact knockback (dx −2.998).
        for (const arm of [off, on]) {
            expect(arm.pos.length).toBe(40);
            expect(arm.pos.every((p) => p.y === LANE_Y && p.vy === 0)).toBe(true);
        }
        const onGrid = (p) => Math.abs(p.x * 20 - Math.round(p.x * 20)) < 1e-9;
        expect(on.pos.every(onGrid)).toBe(true);
        expect(off.pos.findIndex((p) => !onGrid(p))).toBe(19);
        // ⚖ 30(c): the preview of the same walk with the same row spends the same keys, the strike included.
        const pv = previewWalk(l6(), [AIM], 0, { strike: withAxisStrike(true, () => axisStrikeFor(l6())), axisAligned: true });
        expect(pv.samples.slice(0, 19).map((x) => key(x.held ?? new Set()))).toEqual(on.keys.slice(0, 19));
    });

    it('a body reachable only OFF the walk\'s axis is not aimed at (the plain policy would aim across the lane)', () => {
        // moving east (the x axis), the bob 14 px BELOW: in reach, facing DOWN.
        const moving = sceneBeside(0, 14, { vx: 1 });
        const plain = strikePolicyFor(moving.run).decide(moving.state, moving.bodies, 0, new Set(['right']));
        expect(plain.decision).toBe('aim');
        expect([...plain.held]).toEqual(['down']);
        const along = strikePolicyFor(moving.run, { axisAlong: true })
            .decide(moving.state, moving.bodies, 0, new Set(['right']));
        expect(along.decision).toBe('none');
        expect([...along.held]).toEqual(['right']);
        // at rest, the walk's own key names the axis: the same.
        const rest = sceneBeside(0, 14);
        expect(strikePolicyFor(rest.run, { axisAlong: true }).decide(rest.state, rest.bodies, 0, new Set(['right'])).decision)
            .toBe('none');
        // …and the same body AHEAD on that axis is aimed at, with the walk's own key.
        const ahead = sceneBeside(14, 0, { vx: 1 });
        const hit = strikePolicyFor(ahead.run, { axisAlong: true }).decide(ahead.state, ahead.bodies, 0, new Set(['right']));
        expect(hit.decision).toBe('aim');
        expect([...hit.held]).toEqual(['right']);
        // no single axis (at rest, a two-axis or an empty held set; a diagonal velocity): nothing is offered.
        expect(walkAxisOf({ vx: 0, vy: 0 }, new Set(['right', 'down']))).toBeNull();
        expect(walkAxisOf({ vx: 0, vy: 0 }, new Set())).toBeNull();
        expect(walkAxisOf({ vx: 0.5, vy: -0.5 }, new Set(['right']))).toBeNull();
        expect(walkAxisOf({ vx: 0, vy: 0.4 }, new Set(['right']))).toBe('y');
        const corner = sceneBeside(14, 0);
        expect(strikePolicyFor(corner.run, { axisAlong: true })
            .decide(corner.state, corner.bodies, 0, new Set(['right', 'down'])).decision).toBe('none');
    });

    it('a non-axis walk is OFF\'s, switch or no switch (the drive and a solve)', () => {
        const walk = (on) => {
            const run = l6();
            const perTick = [];
            withAxisStrike(on, () => drive(run, { x: 128, y: 56 }, perTick, { until: 'arrival', tolerance: DEFAULT_TOLERANCE,
                maxTicks: 200, what: 'the non-axis walk', avoidVolumes: false, strike: strikePolicyFor(run) }));
            return perTick.map(key);
        };
        const offKeys = walk(false);
        expect(offKeys.some((k) => k.includes('primary'))).toBe(true);
        expect(walk(true)).toEqual(offKeys);
        // a whole segment with no axis-aligned walk: ON builds no axis-along policy and answers OFF's keys.
        const raw = readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-l6-bob-press.json'), 'utf8');
        const exit = levelSource(6).entities.find((x) => x.type === 'teleporter');
        const solve = (on) => withAxisStrike(on, () => {
            resetAxisStrikeCounts();
            const staging = solveStaging(stagingFromTape(parseTape(raw)));
            const run = createRunForStaging(staging, levelSource);
            return solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }], name: 'axis-l6',
                boot: staging.boot, dashMode: 'all' }).perTick.map(key);
        });
        const segOff = solve(false);
        const segOn = solve(true);
        expect(segOn).toEqual(segOff);
        expect(AXIS_STRIKE_COUNTS.policies).toBe(0);
    });

    it('AXIS-L12HITS: the clear-tag keylock stance walk is certified with its hold (`axisClearTagStand`)', () => {
        const run = l6();
        const resolved = { lock: 'none', hold: { ticks: 10 }, target: { x: 0, y: 0 } };
        // OFF, another verb, or the tail's own instrument off: nothing is handed to the walk (OFF byte-identical).
        expect(withAxisStrike(false, () => axisClearTagStand(run, 'keylock', resolved))).toEqual({});
        expect(withAxisStrike(true, () => axisClearTagStand(run, 'kill', resolved))).toEqual({});
        expect(withKeylockWaitPriced(false, () => withAxisStrike(true,
            () => axisClearTagStand(run, 'keylock', resolved)))).toEqual({});
        expect(KEYLOCK_WAIT_PRICED.enabled).toBe(ENV.SEEDLING_KEYLOCK_WAIT_PRICED !== '0');
    });

    it('AXIS-L12HITS: L12 leg 149 ON takes 0 hits and answers OFF\'s plan; without the hold\'s tail it is punched', () => {
        const off = solveL12(false);
        expect(off.hits).toEqual([]);
        expect(off.ticks).toBe(444);
        const on = solveL12(true);
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBe(off.ticks);
        expect(on.plan).toBe(off.plan);
        // the non-vacuity arm: ON with the stance walk's hold unpriced is the regression, at its measured ticks.
        const regressed = withKeylockWaitPriced(false, () => solveL12(true));
        expect(regressed.hits).toEqual(L12_REGRESSED_HITS);
        expect(regressed.ticks).toBe(430);
    }, 120_000);
});
