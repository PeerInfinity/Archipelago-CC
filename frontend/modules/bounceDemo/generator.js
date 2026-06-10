/**
 * Bounce Demo level generator — build-order step 7, the first shipped
 * milestone (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * Generate-and-test (Cloudberry-style): `generateLevel` PROPOSES a
 * platform arrangement for a target requirement ("this level needs
 * ability set S") and VERIFIES it with the same derive-rules verifier
 * the pipeline uses — every pickup and the top exit must derive
 * minimal sets of exactly [S], with no defects. Failed proposals are
 * retried with a perturbed seed; geometry is stored explicitly (the
 * no-RNG-determinism principle: the seed only drives generation,
 * nothing at runtime replays it).
 *
 * Construction is a vertical climb from the entrance column with one
 * GATE SEGMENT per required ability, separated by plain bounce steps:
 *   springs  — a 380-440px gap above a spring (plain apex 169 fails,
 *              spring apex 484 clears; overshoot < 120 so the next
 *              step is never intercepted)
 *   jetpacks — a 1180-1240px gap above a jetpack (spring 484 fails,
 *              jetpack apex 1296 clears; overshoot <= 116 < 120)
 *   blue/brown — a colored stepping stone mid-gap (240px total: plain
 *              bounce can't skip it; with the item it's two 120 steps)
 *   left/right — a 140px column shift (catch span is 42px, so the
 *              matching arrow is required; column tracking keeps the
 *              shift inside the walls)
 * Pickups land on dedicated platforms after all gates; the exit
 * platform tops the climb. Plain steps jitter around the column
 * NON-cumulatively (a no-arrows player's x never moves, so the column
 * itself must stay fixed between arrow gates).
 *
 * `generateZoneSet` builds a whole winnable zone table for the
 * substrate factory: zone 0 grants both arrows with no requirement
 * (side exits derive arrow gates, and a no-arrows player exits at the
 * first exit platform on the forced path), each later non-filler zone
 * requires a subset of already-granted abilities and grants the next
 * item, fillers grant nothing, and the final zone's pickup is Victory.
 */

import { createRng } from '../shared/rng.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './apRules.js';

const WIDTH = 400;
const COLUMN = WIDTH / 2;
const PLAIN_DY = 120;

function sameSets(minimalSets, want) {
    if (minimalSets.length !== 1) return false;
    const got = minimalSets[0];
    return got.length === want.length && want.every((a) => got.includes(a));
}

/** One proposal. Returns a level (bottom margin/height computed last). */
function proposeLevel({ id, requirement, pickupCount, rng, stepsBetween, jitter = 0 }) {
    // steps grow upward as deltas; realized into platforms afterwards.
    // Plain-step x-jitter (opts.jitter, px amplitude) DEFAULTS TO 0: a
    // no-arrows player's x never changes, so an arrowless chain must
    // be exactly aligned — ANY jitter delta fails the solver's
    // ∀-launch-position check (the span-edge launch can't correct).
    // One held arrow only corrects one direction, so single-arrow
    // requirements fail too. Jitter only verifies when the requirement
    // includes BOTH arrows; the verify loop is the gatekeeper either
    // way — a jittered proposal that fails verification is rejected,
    // never emitted.
    const steps = [];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) steps.push({ dy: PLAIN_DY, jitter: true });
    };

    const gates = rng.shuffle([...requirement]);
    for (const ability of gates) {
        plains();
        switch (ability) {
            case 'springs':
                steps.push({ dy: 380 + rng.next() * 60, spring: true });
                break;
            case 'jetpacks':
                steps.push({ dy: 1180 + rng.next() * 60, jetpack: true });
                break;
            case 'blue':
            case 'brown':
                steps.push({ dy: PLAIN_DY, type: ability });
                steps.push({ dy: PLAIN_DY });
                break;
            case 'left':
                steps.push({ dy: PLAIN_DY, dx: -140 });
                break;
            case 'right':
                steps.push({ dy: PLAIN_DY, dx: +140 });
                break;
            default:
                throw new Error(`generateLevel: no gate builder for '${ability}'`);
        }
    }
    plains();
    for (let i = 0; i < pickupCount; i++) steps.push({ dy: PLAIN_DY, pickup: true });
    steps.push({ dy: PLAIN_DY, exit: true });

    // realize: walk the steps upward from the entrance platform
    const totalRise = steps.reduce((sum, s) => sum + s.dy, 0);
    const height = Math.ceil(totalRise + 220);
    const platforms = [];
    const springs = [];
    const jetpacks = [];
    const pickups = [];
    const portals = [];
    let x = COLUMN;
    let y = height - 100;
    let n = 0;
    let pickupN = 0;
    const place = (px, py, type = 'green') => {
        const platform = { id: `p${n++}`, x: px, y: py, type };
        platforms.push(platform);
        return platform;
    };
    let prev = place(x, y); // entrance platform under the spawn column
    for (const s of steps) {
        if (s.spring) springs.push({ id: `s${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        if (s.jetpack) jetpacks.push({ id: `j${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        x += s.dx ?? 0;
        y -= s.dy;
        // non-cumulative: jitter offsets the platform, not the column
        const dx = (s.jitter && jitter > 0) ? (rng.next() - 0.5) * 2 * jitter : 0;
        prev = place(x + dx, y, s.type ?? 'green');
        if (s.pickup) {
            pickups.push({ id: `loc_${pickupN++}`, x: prev.x, y: prev.y - 20, on: prev.id });
        }
        if (s.exit) {
            portals.push({
                id: 'exit_up', x: prev.x, y: prev.y - 20, on: prev.id,
                target_region: null, direction: 'up',
            });
        }
    }
    return {
        id, size: { width: WIDTH, height },
        platforms, springs, jetpacks, pickups, portals,
    };
}

/**
 * Generate one level whose pickups and top exit require EXACTLY
 * `requirement` (an ability-name array). Throws if no proposal
 * verifies within `attempts`.
 */
export function generateLevel({
    id,
    requirement = [],
    pickupCount = 1,
    stepsBetween = 2,
    seed = 1,
    attempts = 8,
    jitter = 0,
} = {}) {
    const want = [...requirement].sort();
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevel({ id, requirement, pickupCount, rng, stepsBetween, jitter });
        const modelErrors = validateLevel(level);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveAccessRules(level);
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => derived.pickups[pk.id]),
            derived.exits.exit_up,
        ];
        if (goals.every((g) => sameSets(g.minimalSets, want))) return level;
        rejected.push(`attempt ${attempt}: derived rules != [${want.join('+')}]`);
    }
    throw new Error(`generateLevel('${id}'): no valid proposal in ${attempts} attempts`
        + ` (requirement [${want.join('+')}]): ${rejected.join('; ')}`);
}

/**
 * Generate a complete winnable zone table (ZONES shape: [{level,
 * items}]) for createBounceSubstrateEntry. `count` >= 6: zone 0
 * (two-arrow starter) + 4 feature zones + the Victory zone; anything
 * beyond is filler.
 *
 * `jitter` (px): when > 0, every non-starter zone adds BOTH arrows to
 * its requirement — jitter only verifies under two-way correction, and
 * the arrows are granted in zone 0, so the set stays winnable. The
 * starter stays exactly aligned (it must be playable with nothing).
 */
export function generateZoneSet({ count = 7, seed = 1, jitter = 0 } = {}) {
    if (count < 6) throw new Error('generateZoneSet: count must be >= 6');
    const rng = createRng(seed);
    const featureGrants = rng.shuffle(['springs', 'blue', 'brown', 'jetpacks']);
    const fillerCount = count - 6;

    // zone plans: starter, features (+fillers interleaved), victory
    const plans = [{ requirement: [], grants: ['right', 'left'] }];
    const middle = featureGrants.map((g) => ({ grants: [g] }));
    for (let i = 0; i < fillerCount; i++) {
        middle.splice(1 + Math.floor(rng.next() * middle.length), 0, { filler: true });
    }
    plans.push(...middle, { victory: true });

    const granted = [];
    const zones = [];
    plans.forEach((plan, i) => {
        const isStarter = i === 0;
        let requirement = [];
        if (!isStarter && !plan.filler) {
            // require 1-2 already-granted abilities (features preferred)
            const pool = granted.filter((a) => a !== 'left' && a !== 'right');
            const pick = (from) => from[Math.floor(rng.next() * from.length)];
            requirement = [pick(pool.length ? pool : granted)];
            if (rng.next() < 0.5) {
                const more = granted.filter((a) => !requirement.includes(a));
                if (more.length) requirement.push(pick(more));
            }
        }
        if (jitter > 0 && !isStarter) {
            for (const arrow of ['left', 'right']) {
                if (!requirement.includes(arrow)) requirement.push(arrow);
            }
        }
        const grants = plan.victory ? [] : (plan.grants ?? []);
        const pickupCount = plan.victory ? 1 : grants.length;
        const level = generateLevel({
            id: `gen_z${i}`,
            requirement,
            pickupCount: plan.filler ? 0 : pickupCount,
            seed: (seed * 31 + i) | 0,
            jitter: isStarter ? 0 : jitter,
        });
        const items = {};
        level.pickups.forEach((pk, idx) => {
            items[pk.id] = plan.victory
                ? VICTORY_ITEM_NAME
                : ABILITY_ITEM_NAMES[grants[idx]];
        });
        granted.push(...grants);
        zones.push({ level, items });
    });
    return zones;
}
