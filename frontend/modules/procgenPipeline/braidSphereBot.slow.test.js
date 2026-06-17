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
import { step as physicsStep, spawnState, resolvePhysicsStamp } from '../bounceDemo/physics.js';
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
        // The player holds Right free (the gated arrow is Left), so portals ride
        // tips toward Right; bounceFreeArrow tells the generator + verifier.
        regionParams: {
            fallBehavior: 'current', physicsProfile: 'dj',
            bounceMode: 'braid', braidWidth: 240, bounceFreeArrow: 'right',
        },
        growthParams: {
            spherePlan: plan, substrateQuotas: { bounce: 99 },
            startSubstrate: 'bounce', maxItemsPerRegion: 2, fillerCount: 1,
        },
    });
    const rulesJson = buildRulesJson(grid, {
        startCell, seed, embedSphereLog: false, startingItems: ['Right arrow'],
        completionConditionItem: 'Victory', lockedCanonicalItems: ['Left arrow'],
    });
    return { grid, plan, rulesJson };
}

// Reach `goal` ({kind,id}) from the entrance with `abilities`, under the level's
// own physics constants `C`. Returns { reached, falls, teleports, frames } —
// mirrors the runDriver loop in botDriver.test.js (and gameCore: a fall OR a
// teleport-host landing respawns). CRITICAL: `C` must be the level's resolved dj
// constants and must be passed to BOTH createBotDriver (the planner — it builds
// the platform graph + simulates steering policies under these constants) AND
// step/spawnState (the simulation). The browser does exactly this
// (game/main.js: createBotDriver({constants}) resolved from params.physics).
// Defaulting either to classic on a dj-geometry level makes the bot plan/clear
// under the wrong physics and spuriously miss spring/jetpack gates and offset
// portal tips — the artifact that once looked like a "bot can't clear springs"
// bug but was just a mis-configured harness.
function driveTo(level, abilities, goal, C, maxFrames = 12000) {
    const driver = createBotDriver({ constants: C });
    driver.setTarget(goal);
    const teleportHosts = new Set((level.teleports ?? []).map((t) => t.on));
    let state = spawnState(level, C);
    let falls = 0; let teleports = 0;
    const hostOf = goal.kind === 'portal'
        ? (level.portals ?? []).find((p) => p.id === goal.id)?.on
        : (level.pickups ?? []).find((p) => p.id === goal.id)?.on;
    for (let f = 0; f < maxFrames; f++) {
        const input = driver.nextInput(state, level, abilities, { isPortalOpen: () => true });
        state = physicsStep(state, input, level, abilities, C);
        if (state.fallen) { falls += 1; driver.notifyFell(); state = spawnState(level, C); continue; }
        if (state.landedOn) {
            if (teleportHosts.has(state.landedOn)) {
                teleports += 1; driver.notifyFell(); state = spawnState(level, C); continue;
            }
            if (state.landedOn === hostOf) return { reached: true, falls, teleports, frames: f + 1 };
        }
    }
    return { reached: false, falls, teleports, frames: maxFrames };
}

const bounceRegions = (grid) => grid.allRegions().filter((r) => r.substrate === 'bounce');
const levelOf = (region) => region.playable_payload?.params?.bounceLevel;
// The level's runtime physics constants — resolved from the embedded stamp the
// generator stamps onto the payload (params.physics), exactly as the browser
// runtime resolves them. dj levels carry dj constants; absent stamp = classic.
const constantsOf = (region) => resolvePhysicsStamp(region.playable_payload?.params?.physics);

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
            const C = constantsOf(r);
            const goals = [
                ...(level.portals ?? []).map((p) => ({ kind: 'portal', id: p.id })),
                ...(level.pickups ?? []).map((p) => ({ kind: 'pickup', id: p.id })),
            ];
            for (const goal of goals) {
                const res = driveTo(level, FULL, goal, C);
                expect(res.reached, `${r.region_id} ${goal.kind} ${goal.id} (frames ${res.frames})`).toBe(true);
            }
        }
    });

    it('back portal is ungated → an arrow+blue world is ALL braid (no incomparable fallback)', () => {
        // Every non-root region's back portal used to be gated on the item you
        // ENTERED with, which differs from its forward gates → incomparable →
        // column fallback on nearly every region. With the back portal ungated
        // (braid mode) the region is a single nested chain of its forward gates,
        // so an arrow+blue world comes out fully braid.
        const plan = planSpheres({
            itemPool: { 'Left arrow': 1, 'Blue platforms': 1, Victory: 1 },
            sphereCount: 3, victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 1,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 }, seed: 1,
            regionParams: {
                fallBehavior: 'current', physicsProfile: 'dj',
                bounceMode: 'braid', braidWidth: 240, bounceJitter: 40, bounceFreeArrow: 'right',
            },
            growthParams: {
                spherePlan: plan, substrateQuotas: { bounce: 99 },
                startSubstrate: 'bounce', maxItemsPerRegion: 2,
            },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 1, embedSphereLog: false,
            completionConditionItem: 'Victory', startingItems: ['Right arrow'],
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
        const widths = bounceRegions(grid).map((r) => levelOf(r).size.width);
        expect(widths.length).toBeGreaterThan(1);
        expect(widths.every((w) => w === 240), `all braid (got ${widths})`).toBe(true);
    });

    it('a FULL bounce pool (all six items) generates an all-braid winnable world', () => {
        // The braid-aware grower veto (canHostExitGatesBraid) keeps each bounce
        // region to ≤1 distinct forward gate, so the whole world is braid — no
        // column fallback, no abort — even when every ability is a gate. One
        // arrow is free (Right granted as a starting item), so only Left ever
        // gates among arrows.
        const plan = planSpheres({
            itemPool: {
                'Left arrow': 1, Springs: 1, Jetpacks: 1,
                'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
            },
            sphereCount: 5, victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 3,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 }, seed: 3,
            regionParams: {
                fallBehavior: 'current', physicsProfile: 'dj',
                bounceMode: 'braid', braidWidth: 240, bounceJitter: 40, bounceFreeArrow: 'right',
            },
            growthParams: {
                spherePlan: plan, substrateQuotas: { bounce: 99 },
                startSubstrate: 'bounce', maxItemsPerRegion: 2,
            },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 3, embedSphereLog: false,
            completionConditionItem: 'Victory', startingItems: ['Right arrow'],
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
        const widths = bounceRegions(grid).map((r) => levelOf(r).size.width);
        expect(widths.length).toBeGreaterThan(1);
        expect(widths.every((w) => w === 240), `all braid (got ${widths})`).toBe(true);
    });

    it('the bot clears SPRING and JETPACK gates in a full-pool world (matched dj physics)', () => {
        // Regression guard for the headless/browser parity bug: driveTo must run
        // the bot under the level's OWN dj constants (planner + simulation), not
        // classic defaults — otherwise spring/jetpack gates and offset portal
        // tips spuriously miss (the "13/14" artifact). With matched constants the
        // bot reaches every goal, INCLUDING ones behind a spring or jetpack gate.
        // Full pool, seed 1 — produces both a spring gate and a jetpack gate.
        const plan = planSpheres({
            itemPool: {
                'Left arrow': 1, Springs: 1, Jetpacks: 1,
                'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
            },
            sphereCount: 5, victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 1,
        });
        const { grid } = growSpheres({
            regionSize: { width: 8, height: 6 }, seed: 1,
            regionParams: {
                fallBehavior: 'current', physicsProfile: 'dj',
                bounceMode: 'braid', braidWidth: 240, bounceJitter: 40, bounceFreeArrow: 'right',
            },
            growthParams: {
                spherePlan: plan, substrateQuotas: { bounce: 99 },
                startSubstrate: 'bounce', maxItemsPerRegion: 2,
            },
        });
        // The test is only meaningful if the world actually contains both gate
        // types — assert that up front so a future generation change that drops
        // them fails loudly instead of silently testing nothing.
        const regions = bounceRegions(grid);
        const totalSprings = regions.reduce((n, r) => n + (levelOf(r).springs ?? []).length, 0);
        const totalJetpacks = regions.reduce((n, r) => n + (levelOf(r).jetpacks ?? []).length, 0);
        expect(totalSprings, 'world has a spring gate').toBeGreaterThan(0);
        expect(totalJetpacks, 'world has a jetpack gate').toBeGreaterThan(0);
        for (const r of regions) {
            const level = levelOf(r);
            const C = constantsOf(r);
            const goals = [
                ...(level.portals ?? []).map((p) => ({ kind: 'portal', id: p.id })),
                ...(level.pickups ?? []).map((p) => ({ kind: 'pickup', id: p.id })),
            ];
            for (const goal of goals) {
                const res = driveTo(level, FULL, goal, C);
                expect(res.reached, `${r.region_id} ${goal.kind} ${goal.id} (frames ${res.frames})`).toBe(true);
            }
        }
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
            const C = constantsOf(r);
            for (const pt of level.portals ?? []) {
                const host = level.platforms.find((p) => p.id === pt.on);
                if (!host || host.x === level.size.width / 2) continue;
                droveGated = true;
                const res = driveTo(level, noAbilities(), { kind: 'portal', id: pt.id }, C, 3000);
                expect(res.reached, `gated ${pt.id} reachable with no arrows`).toBe(false);
                expect(res.falls, `gated ${pt.id} fall-off loop`).toBe(0);
            }
        }
        expect(droveGated, 'world had an arrow-gated exit to test').toBe(true);
    });
});
