/**
 * Step 6 of braid Regime 2 (NewDocs/plans/procedural-generation/braid-regime2.md):
 * SPHERE GROWTH emits gated braids, and the playback bot finishes them with no
 * soft-locks.
 *
 * This is the headless analogue of scripts/procgen/verify-bot-playthrough.mjs
 * (which drives a COLUMN preset in the browser): build a braid bounce sphere
 * world via growSpheres with regionParams.bounceMode='braid', then
 *   1. assert it is WINNABLE — the realised item spheres match the source plan
 *      (compareSpheresToPlan, the same oracle the column path passes);
 *   2. assert every bounce region is a braid (width 240, carries teleport hosts);
 *   3. drive the real botDriver through each region and assert it reaches every
 *      goal with NO soft-lock — and that a player MISSING the gating arrow parks
 *      gracefully (never errors, never loops) rather than getting stuck, the
 *      teleport-recovery contract that replaced the column descend fall-off.
 *
 * Slow because growSpheres runs the per-region generate-and-test verifier (the
 * row-aware deriveBraidAccessRules) and the bot drive runs real physics frames.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import '../mazeRoom/mazeRoomLibrary.js'; // registers maze + bounce substrates
import { GATEABLE_ITEMS } from '../bounceDemo/bounceDemoLibrary.js';
import {
    growSpheres, buildRulesJson,
} from './procgenPipelineEngine.js';
import { planSpheres, computeItemSpheres, compareSpheresToPlan } from './spherePlanner.js';
import { createBotDriver } from '../bounceDemo/botDriver.js';
import { step as physicsStep, spawnState } from '../bounceDemo/physics.js';
import { noAbilities } from '../bounceDemo/suppression.js';

const FULL = { left: true, right: true, springs: true, jetpacks: true, blue: true, brown: true };

// One arrow only (gates ∈ {[], [left]}) keeps every region braid-buildable
// (≤1 distinct arrow, nested), plus a filler region. dj physics, width 240.
function buildBraidWorld(seed) {
    const plan = planSpheres({
        itemPool: { 'Left arrow': 1, Victory: 1 }, sphereCount: 2,
        exclusiveSpheres: { 1: ['Left arrow'] },
        victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed,
    });
    const { grid, startCell } = growSpheres({
        regionSize: { width: 8, height: 6 }, seed,
        regionParams: {
            fallBehavior: 'current', physicsProfile: 'dj',
            bounceMode: 'braid', braidWidth: 240,
        },
        growthParams: {
            spherePlan: plan, substrateQuotas: { bounce: 99 },
            startSubstrate: 'bounce', maxItemsPerRegion: 2, fillerCount: 1,
        },
    });
    const rulesJson = buildRulesJson(grid, {
        startCell, seed, embedSphereLog: false,
        completionConditionItem: 'Victory', lockedCanonicalItems: ['Left arrow'],
    });
    return { grid, plan, rulesJson };
}

// Reach `goal` ({kind,id}) from the entrance with `abilities`. Returns
// { reached, falls, teleports, frames } — mirrors the runDriver loop in
// botDriver.test.js (and gameCore: a fall OR a teleport-host landing respawns).
function driveTo(level, abilities, goal, maxFrames = 12000) {
    const driver = createBotDriver();
    driver.setTarget(goal);
    const teleportHosts = new Set((level.teleports ?? []).map((t) => t.on));
    let state = spawnState(level);
    let falls = 0; let teleports = 0;
    const hostOf = goal.kind === 'portal'
        ? (level.portals ?? []).find((p) => p.id === goal.id)?.on
        : (level.pickups ?? []).find((p) => p.id === goal.id)?.on;
    for (let f = 0; f < maxFrames; f++) {
        const input = driver.nextInput(state, level, abilities, { isPortalOpen: () => true });
        state = physicsStep(state, input, level, abilities);
        if (state.fallen) { falls += 1; driver.notifyFell(); state = spawnState(level); continue; }
        if (state.landedOn) {
            if (teleportHosts.has(state.landedOn)) {
                teleports += 1; driver.notifyFell(); state = spawnState(level); continue;
            }
            if (state.landedOn === hostOf) return { reached: true, falls, teleports, frames: f + 1 };
        }
    }
    return { reached: false, falls, teleports, frames: maxFrames };
}

const bounceRegions = (grid) => grid.allRegions().filter((r) => r.substrate === 'bounce');
const levelOf = (region) => region.playable_payload?.params?.bounceLevel;

describe('braid Regime 2 — sphere growth round-trip + bot finishes (no soft-locks)', () => {
    let world;
    beforeAll(() => { world = buildBraidWorld(1); });

    it('the realised item spheres match the source plan (winnable)', () => {
        expect(compareSpheresToPlan(computeItemSpheres(world.rulesJson), world.plan)).toEqual([]);
    });

    it('every bounce region is a braid (width 240) carrying teleport hosts', () => {
        const regions = bounceRegions(world.grid);
        expect(regions.length).toBeGreaterThan(0);
        for (const r of regions) {
            const level = levelOf(r);
            expect(level, `${r.region_id} level`).toBeTruthy();
            expect(level.size.width, `${r.region_id} width`).toBe(240);
            expect((level.teleports ?? []).length, `${r.region_id} teleports`).toBeGreaterThan(0);
        }
    });

    it('the bot reaches every goal in every region with full abilities', () => {
        for (const r of bounceRegions(world.grid)) {
            const level = levelOf(r);
            const goals = [
                ...(level.portals ?? []).map((p) => ({ kind: 'portal', id: p.id })),
                ...(level.pickups ?? []).map((p) => ({ kind: 'pickup', id: p.id })),
            ];
            for (const goal of goals) {
                const res = driveTo(level, FULL, goal);
                expect(res.reached, `${r.region_id} ${goal.kind} ${goal.id} (frames ${res.frames})`).toBe(true);
            }
        }
    });

    it('a springs/blue pool generates a winnable MIXED braid+column world (no abort)', () => {
        // The grower's veto only guarantees column-compatibility, so braid mode
        // gets handed regions it can't realise (a springs gate aborted an early
        // browser run). Those must FALL BACK to a column instead of aborting the
        // whole world — the braid-incompatible regions render as columns, the
        // rest stay braids, and the world is still winnable.
        const plan = planSpheres({
            itemPool: { 'Left arrow': 1, 'Right arrow': 1, Springs: 1, 'Blue platforms': 1, Victory: 1 },
            sphereCount: 4, victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 7,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 }, seed: 7,
            regionParams: {
                fallBehavior: 'current', physicsProfile: 'dj',
                bounceMode: 'braid', braidWidth: 240,
            },
            growthParams: {
                spherePlan: plan, substrateQuotas: { bounce: 99 },
                startSubstrate: 'bounce', maxItemsPerRegion: 2,
            },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 7, embedSphereLog: false, completionConditionItem: 'Victory',
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
        const widths = bounceRegions(grid).map((r) => levelOf(r).size.width);
        expect(widths.some((w) => w === 240), 'at least one braid region').toBe(true);
        expect(widths.some((w) => w !== 240), 'at least one column fallback').toBe(true);
    });

    it('a player missing the gating arrow parks gracefully (no error, no fall-off loop)', () => {
        // Find a region with an arrow-gated exit (its host is off the spawn
        // column, so it's wrong-arrow unreachable). Drive toward it with NO
        // arrows: the bot runs the full frame budget WITHOUT throwing, never
        // reaches the gated host, and PARKS — it must NOT deliberately fall off
        // the level (the old column descend fall-off is gone; with no arrows
        // there's no route, so parking is the correct graceful outcome).
        let droveGated = false;
        for (const r of bounceRegions(world.grid)) {
            const level = levelOf(r);
            for (const pt of level.portals ?? []) {
                const host = level.platforms.find((p) => p.id === pt.on);
                if (!host || host.x === level.size.width / 2) continue;
                droveGated = true;
                const res = driveTo(level, noAbilities(), { kind: 'portal', id: pt.id }, 3000);
                expect(res.reached, `gated ${pt.id} reachable with no arrows`).toBe(false);
                expect(res.falls, `gated ${pt.id} fall-off loop`).toBe(0);
            }
        }
        expect(droveGated, 'world had an arrow-gated exit to test').toBe(true);
    });
});
