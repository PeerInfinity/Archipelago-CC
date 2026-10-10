/**
 * ⛓⛓ SEEDLING FIDELITY ENCOUNTERS — the encounter goal from ANY arrival.
 *
 * D2: L32's Bob Boss. The survey stages the fight once (the rock unarmed, the
 * player on the L30 door). The executor reads the arena's state off the run,
 * so every state the game can hand it is solved here, each from
 * `r5-bobboss-fire`'s boot with one field changed:
 *
 *   fresh            the rock unarmed: arm, forms, drop, burn, pit
 *   rock fallen      {32,1} cleared at build (the state after a death
 *                    mid-fight): the door arrival is snapped onto the rock and
 *                    the boss re-added on the first frame — no arm leg
 *   respawn          the same flag, at `ARENA.respawn` (a death's reboot)
 *   Fire held        the boss's ctor removes itself: no fight, no drop; the
 *                    burn (if the tree stands) and the pit
 *   mid-fight        a continuation (`prefix`) cut anywhere in a fresh solve
 *
 * The game witnesses are `enc-l32-fallen-door` and `enc-l32-fire-return`
 * (`plan-seedling-encounters.mjs`, recorded on p4f; `tapeRunner` matches them).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveSegment } from './solverBot.js';
import { arenaRockOf, buildLevelWorld } from './levelWorld.js';

const TAPE = JSON.parse(readFileSync(
    new URL('./fixtures/tapes/r5-bobboss-fire.json', import.meta.url), 'utf8'));
const GOAL = Object.freeze({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });
const BASE = solveStaging(stagingFromTape(parseTape(TAPE)));
const FIRE = { seam: { items: { hasSword: true, hasFire: true } }, grants: [] };
const clears = (...pairs) => pairs.map(([level, tag]) => ({ level, tag }));

function solveFrom(over, prefix = []) {
    const staging = { ...BASE, ...over };
    const run = createRunForStaging(staging, atlasLevelSource());
    for (const h of prefix) run.advance(h);
    const out = solveSegment({ run, goals: [{ ...GOAL }], name: 'enc', boot: staging.boot, prefix });
    return { run, out, legs: out.records.map((r) => r.leg ?? r.goal) };
}

describe('levelWorld — the arena rock is the one `arm` rock a build may fell', () => {
    it('`arenaRockOf` is L32\'s bossrock+thirdboss and nothing else', () => {
        expect(arenaRockOf({ type: 'fallrocklarge', attrs: { bossrock: '1', thirdboss: '1' } })).toBe(true);
        expect(arenaRockOf({ type: 'fallrocklarge', attrs: { bossrock: '1', thirdboss: '0' } })).toBe(false);
        expect(arenaRockOf({ type: 'fallrock', attrs: { bossrock: '1', thirdboss: '1' } })).toBe(false);
    });

    it('a clear of {32,1} builds the rock FALLEN (`fallenAtBuild`); without it the row is unchanged', () => {
        const rec = atlasLevelSource()(32);
        const fresh = buildLevelWorld(rec);
        const felled = buildLevelWorld(rec, { cleared: [1] });
        const row = (w) => w.fallRocks.find((r) => r.thirdBoss);
        expect(row(fresh).fallenAtBuild).toBeUndefined();
        expect(row(felled).fallenAtBuild).toBe(true);
    });
});

describe('the Bob Boss encounter from every arena state (D2)', () => {
    it('fresh (the survey\'s state): arm, seven landings, drop, burn, pit — 1042 t', () => {
        const { run, out, legs } = solveFrom({});
        expect(out.perTick.length).toBe(1042);
        expect(legs[0]).toBe('arm');
        expect(run.level).toBe(30);
    }, 120_000);

    it('rock fallen at the door: snapped onto the rock, no arm leg, untouched — 1041 t', () => {
        const { run, out, legs } = solveFrom({ persistence: clears([32, 1]) });
        expect(run.ledger('bobBossEvents').find((r) => r.what === 'rock-snap'))
            .toMatchObject({ t: 0, from: 128, to: 125 });
        expect(legs).not.toContain('arm');
        expect(legs.filter((l) => l === 'strike')).toHaveLength(7);
        expect(out.perTick.length).toBe(1041);
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.level).toBe(30);
    }, 120_000);

    it('rock fallen at the respawn (72,104): no snap, the fight — 1034 t', () => {
        const { run, out } = solveFrom({ boot: { level: 32, x: 72, y: 104 }, persistence: clears([32, 1]) });
        expect(run.ledger('bobBossEvents').some((r) => r.what === 'rock-snap')).toBe(false);
        expect(out.perTick.length).toBe(1034);
        expect(run.level).toBe(30);
    }, 120_000);

    it('Fire held, rock fallen, tree burned: `already`, then the pit — 142 t', () => {
        const { run, out, legs } = solveFrom({ ...FIRE, persistence: clears([32, 0], [32, 1]) });
        expect(legs).toEqual(['drop', 'reach-pit']);
        expect(out.records.find((r) => r.leg === 'drop').already).toBe(true);
        expect(run.ledger('bobBossEvents').some((r) => r.what === 'boss-added')).toBe(false);
        expect(out.perTick.length).toBe(142);
    });

    it('Fire held, rock unarmed: the arm first (its frozen frame would eat the burn press), no boss', () => {
        const { run, legs } = solveFrom({ ...FIRE });
        expect(legs).toEqual(['arm', 'drop', 'burn', 'reach-pit']);
        expect(run.ledger('bobBossEvents').some((r) => r.what === 'boss-added')).toBe(false);
        expect(run.level).toBe(30);
    });

    it('mid-fight continuations solve from wherever the prefix stops', () => {
        const { out } = solveFrom({});
        for (const k of [13, 300, 700]) {
            const { run, legs } = solveFrom({}, out.perTick.slice(0, k).map((h) => new Set(h)));
            expect(run.level).toBe(30);
            expect(legs).not.toContain('arm');
        }
    }, 240_000);
});
