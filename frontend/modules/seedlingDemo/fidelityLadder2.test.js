/**
 * Seedling fidelity LADDER2: the combat ladder vs a placed grenade, a lava chain
 * and a beam tower.
 *
 *   · The game's rules, measured (`probe-seedling-ladder2-phase.mjs`, 12 arms on
 *     p4f, K = 0 for every class — the oracle is the evidence file below):
 *       - GRENADE: no contact at all; dormant until the player's entity point is
 *         within 32 px of `(x, endY)`, then a fall that ignores walls, a 60
 *         count and the `"explode"` anim — the 20 px blast lands 154 updates
 *         after the arming update (`placedGrenade.js`).
 *       - LAVA CHAIN: the 48x4 arm is out while `extend`/`hit` plays, which
 *         starts on the frames whose `Game.time % 90 < 1.5` (`hazards.stepLavaChain`).
 *       - BEAM TOWER: an int `10 · speed` fps Spritemap from the ctor, beaming on
 *         the second frame of each side's anim, the side turning by `rate`
 *         after each `sit`, at a y the `Game.time` bob moves (`hazards.stepBeamTower`).
 *   · The model before: the grenade was a `mover` contact (the census scan
 *     THREW on its box) and the danger map priced it as a static body; the
 *     chain and the beam were their census volumes at every tick.
 *   · Now: `levelRun.stepPlacedGrenadesNow` steps the grenade and bills its blast;
 *     `dangerMap` prices the blast off the walk's own forecast and the chain and
 *     beam at their exact update in TRANSIT; the DODGE rung's PHASE arm stalls.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createRunForStaging, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { contactPricing } from './combat.js';
import {
    beamAnimSpeed, beamRect, createBeamTower, createLavaChainState, lavaChainRect, rectTouchesBox,
    stepBeamTower, stepLavaChain,
} from './hazards.js';
import { createPlacedGrenade, placedGrenadeFuse, stepPlacedGrenade } from './placedGrenade.js';
import { axeVisitClock, dangerAt, grenadeDanger, phaseHazardCanReach } from './dangerMap.js';
import { DEADLINE_SITES, PHASE_DODGE_RUNG } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SRC = atlasLevelSource();
const ORACLE = JSON.parse(readFileSync(join(REPO, 'CC', 'docs', 'cloud-reports',
    'seedling-fidelity-ladder2-evidence', 'ladder2-phase-oracle.json'), 'utf8'));
const probe = () => import(join(REPO, 'scripts', 'procgen', 'probe-seedling-ladder2-phase.mjs'));
const armRun = async (name) => {
    const { LADDER2_ARMS, ladder2ArmTape } = await probe();
    const tape = await ladder2ArmTape(LADDER2_ARMS.find((a) => a.name === name));
    return createRunForStaging(solveStaging(stagingFromTape(tape)), SRC);
};

describe('fidelity LADDER2 D1 — the three clocks, as the game measured them', () => {
    it('every arm agrees on K = 0, and each class has a positive control', () => {
        expect(ORACLE.agreeingOffsets).toEqual({ grenade: [0], lavachain: [0], beamtower: [0] });
        expect(ORACLE.arms).toHaveLength(12);
        const firsts = Object.fromEntries(ORACLE.arms.map((a) => [a.arm, a.gameFirstMove]));
        expect(firsts).toEqual({
            'l2-grenade-l59-walled': 155, 'l2-grenade-l75': 155, 'l2-grenade-l75-armed-clear': -1,
            'l2-grenade-l63-walled': 155,
            'l2-chain-l79': 34, 'l2-chain-l72': 34, 'l2-chain-l75-c': 34, 'l2-chain-l75-a': 34,
            'l2-beam-l104': 5, 'l2-beam-l104-up': 19, 'l2-beam-l103-west': 79, 'l2-beam-l103-mid': 86,
        });
        expect(ORACLE.arms.every((a) => a.matches.includes(0))).toBe(true);
    });

    it('a placed grenade blasts 154 updates after its arming update — and a walled one too', () => {
        for (const [level, cx, cy] of [[59, 120, 120], [63, 136, 136], [75, 80, 176], [78, 240, 80]]) {
            const world = buildLevelWorld(SRC(level));
            expect(placedGrenadeFuse(cx, cy, { solidAt: (b) => !!world.collidesSolid(b) })).toBe(154);
        }
        // ⛔ the fall ignores walls (`collidable = false`): L59's column IS solid.
        const l59 = buildLevelWorld(SRC(59));
        expect(!!l59.collidesSolid({ x: 117, y: 69, right: 123, bottom: 75 })).toBe(true);
        // dormant beyond 32 px: never arms, never blasts.
        const g = createPlacedGrenade(120, 120);
        for (let i = 0; i < 400; i += 1) expect(stepPlacedGrenade(g, 120, 153)).toBeNull();
        expect(g.armedAt).toBeNull();
    });

    it('the model reproduces the game\'s blast knockback, 0 px over every row of three arms', async () => {
        const { LADDER2_ARMS, ladder2ArmTape } = await probe();
        for (const name of ['l2-grenade-l59-walled', 'l2-grenade-l75', 'l2-grenade-l75-armed-clear']) {
            const arm = ORACLE.arms.find((a) => a.arm === name);
            const replay = runTape(await ladder2ArmTape(LADDER2_ARMS.find((a) => a.name === name)),
                { levelSource: SRC });
            const worst = Math.max(...arm.gameStream.map(([, L, x, y], i) => (replay.ticks[i].level !== L
                ? Infinity : Math.max(Math.abs(replay.ticks[i].x - x), Math.abs(replay.ticks[i].y - y)))));
            expect([name, arm.gameStream.length, worst]).toEqual([name, 201, 0]);
        }
    });

    it('a beam tower\'s fps is an int, its side turns by rate, and its right beam ends at x 160', () => {
        expect([0.25, 0.5, 1].map(beamAnimSpeed)).toEqual([2, 5, 10]);
        const sides = (rate) => {
            const t = createBeamTower({ cx: 24, cy: 72, attrs: { direction: '0', rate: String(rate), speed: '1' } });
            const seen = [];
            for (let u = 0; u < 200; u += 1) if (stepBeamTower(t, null)) seen.push(t.direction);
            return [...new Set(seen)];
        };
        expect(sides(1)).toEqual([0, 1, 2, 3]);
        expect(sides(2)).toEqual([0, 2]);
        expect(sides(4)).toEqual([0]);
        // `getLine` ends at FP.width = 160, a screen size used as a world x.
        const east = createBeamTower({ cx: 216, cy: 264, attrs: { direction: '0', rate: '4', speed: '1' } });
        expect(beamRect(east, 0)).toEqual({ x: 160, y: 245, w: 62, h: 4 });
        expect(beamRect(east, 2)).toEqual({ x: 0, y: 245, w: 210, h: 4 });
    });

    it('a lava chain\'s arm is a 4 px rect, out from the frames whose Game.time % 90 < 1.5', () => {
        expect(lavaChainRect(136, 72, 3)).toEqual({ x: 134, y: 80, w: 4, h: 48 });
        expect(lavaChainRect(104, 40, 2)).toEqual({ x: 48, y: 38, w: 48, h: 4 });
        const st = createLavaChainState();
        const out = [];
        for (let time = 8607; time < 8607 + 200; time += 1) if (stepLavaChain(st, time)) out.push(time);
        expect(out[0] % 90).toBe(0);
        expect(out.length).toBeGreaterThan(30);
        expect(out.every((t) => t % 90 < 22)).toBe(true);
        // ⛔ inclusive, as `Entity.collideRect` is: a box whose right edge IS the rect's x touches.
        expect(rectTouchesBox({ x: 134, y: 80, w: 4, h: 48 }, { x: 130, y: 100, right: 134, bottom: 105 }))
            .toBe(true);
    });
});

describe('fidelity LADDER2 D2 — the pricing and the ladder', () => {
    it('a placed grenade has no contact: stepped, priced by its own stepper', () => {
        expect(contactPricing('grenade')).toMatchObject({ kind: 'stepped', pricedBy: 'stepPlacedGrenadesNow' });
    });

    it('the chain at L75, TRANSIT: its arm on frame 34 at the probe\'s box, clear before; WAIT keeps the volume', async () => {
        const run = await armRun('l2-chain-l75-c');
        expect(axeVisitClock(run)).toEqual({ v: 0, why: null });
        const box = playerBoxAt(64, 88);
        const at = (tick, mode) => dangerAt(run, tick, box, { mode }).sources
            .filter((s) => s.id === 'lavachain@80,80');
        expect(at(34, 'transit')).toMatchObject([{ kind: 'hazard', arm: 'chain', phase: { updates: 34 } }]);
        expect(at(33, 'transit')).toEqual([]);
        expect(at(60, 'transit')).toEqual([]);
        expect(at(60, 'wait')).toHaveLength(1);
        expect(at(60, 'wait')[0].arm).toBeUndefined();
    });

    it('the beam at L104, TRANSIT: frame 5 on its right side, frame 19 on its up side', async () => {
        const run = await armRun('l2-beam-l104');
        const hit = (x, y, tick) => dangerAt(run, tick, playerBoxAt(x, y), { mode: 'transit' }).sources
            .filter((s) => s.id === 'beamtower@16,56');
        expect(hit(120, 56, 5)).toMatchObject([{ arm: 'beam', phase: { updates: 5 } }]);
        expect(hit(120, 56, 4)).toEqual([]);
        expect(hit(24, 30, 19)).toMatchObject([{ arm: 'beam', phase: { updates: 19 } }]);
        expect(hit(24, 30, 18)).toEqual([]);
        // the doorstep test: the rate-1 tower reaches its up side, the far corner it never does
        const tower = run.world.combat.hazards.find((h) => h.tag === 'beamtower');
        expect(phaseHazardCanReach(tower, playerBoxAt(24, 30))).toBe(true);
    });

    it('the grenade, TRANSIT: the walk\'s own forecast decides; without one, no blast before updates + 1 + 154', async () => {
        const run = await armRun('l2-grenade-l75');
        const box = playerBoxAt(80, 188);
        expect(grenadeDanger(run, box, 100, 'transit')).toEqual([]);
        expect(grenadeDanger(run, box, 155, 'transit')).toHaveLength(1);
        // the walk's own blasts: none this update → clean, whatever the tick
        expect(grenadeDanger(run, box, 155, 'transit', [])).toEqual([]);
        expect(grenadeDanger(run, box, 155, 'transit',
            [{ id: 'grenade@72,168', x: 80, endY: 176, updates: 155, armedAt: 1 }])).toHaveLength(1);
        expect(grenadeDanger(run, playerBoxAt(80, 202), 155, 'transit',
            [{ id: 'grenade@72,168', x: 80, endY: 176, updates: 155, armedAt: 1 }])).toEqual([]);
    });

    it('the PHASE arm is bounded by the chain\'s period and has its own deadline site, last', () => {
        expect(PHASE_DODGE_RUNG).toMatchObject({ step: 4, offsets: 8, detourOffsets: 2, detourPreviews: 60,
            period: 90 });
        expect(DEADLINE_SITES.at(-1)).toBe('phase-dodge');
    });
});
