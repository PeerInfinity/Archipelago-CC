/**
 * Zone-locations channel for the runner substrate (plan §4.6) — the
 * hook the phase-7 registry entry hands the procgen pipeline
 * (`extractZoneRules(zoneIdx, { region_id, exitSides })`, the
 * zone-based-substrate contract in procgenPipelineEngine's
 * synthesizeZoneRegion). Bounce's makeExtractZoneRules shape.
 *
 * Exit sides -> strip portals: a runner level is a horizontal L→R
 * strip with one main exit at the right end (exit_main) plus elevated
 * branch-tip portals (exit_brN) for surplus exits. The side facing
 * 'E' (the strip's natural direction) gets exit_main when present,
 * otherwise the first requested side does; remaining sides map to
 * branch tips in request order. When branches are needed the level is
 * re-generated from the zone's stamped generation spec with the
 * matching branchCount — generateLevel guarantees every exit (main +
 * branch tips) derives EXACTLY the zone's requirement, so all sides
 * of a zone share one gate. Hand-built zone tables without a spec
 * only support a single exit side.
 *
 * Throws on verifier defects — a zone set that emits broken rules
 * should fail generation loudly, not produce a bad seed.
 */

import { DEFAULT_PROFILE_ID } from './physics.js';
import { generateLevel, deriveGeneratedRules, resolveGenPhysics } from './generator.js';
import { validateLevel } from './level.js';
import {
    RUNNER_LIBRARY_OBSTACLES, minimalSetsToRule, emitObstaclePaths,
    composeAuthoredRule, authoredTermsToRule,
} from './apRules.js';
import { verifyObstacleGating } from './verifyObstacles.js';

/** Requested grid sides -> runner portal ids ('E' or first side ->
 *  exit_main, the rest -> exit_br0..N in request order). */
export function assignSidePortals(exitSides) {
    const sides = [...(exitSides ?? [])];
    if (sides.length === 0) return {};
    const mainSide = sides.includes('E') ? 'E' : sides[0];
    const sidePortals = { [mainSide]: 'exit_main' };
    let br = 0;
    for (const side of sides) {
        if (side !== mainSide) sidePortals[side] = `exit_br${br++}`;
    }
    return sidePortals;
}

/**
 * Payload shaped for the flashSubstrate bridge's configure() contract
 * (runnerDemo/game/main.js): level geometry rides `params` (the
 * bridge forwards only world.params, ap_items, ap_locations,
 * flashCapabilities, gameId, regionId — not arbitrary payload
 * fields). The physics stamp is ALWAYS embedded (physics.js stamp
 * contract: constants are logic-affecting, the world must replay
 * under the C its rules were derived with). ap_locations maps the
 * game's pickup ids to AP location names (compileRegionGraph's
 * `<region>__<id>` convention).
 */
export function buildZonePayload(region_id, level, sidePortals, physics = DEFAULT_PROFILE_ID) {
    const { profileId, C } = resolveGenPhysics(physics);
    return {
        gameId: 'runnerDemo',
        params: {
            runnerLevel: level,      // explicit geometry the game replays
            sidePortals,             // side -> portal id (the game inverts)
            physics: { profile: profileId, constants: C },
        },
        ap_locations: Object.fromEntries(
            (level.pickups ?? []).map((pk) => [pk.id, `${region_id}__${pk.id}`])),
        flashCapabilities: {
            locations: 'cooperative',
            items: 'pull',
            start: 'auto',           // no click needed; the game runs on load
        },
    };
}

/**
 * The rule-emission tail shared by the zone-table hook below and the
 * spec-driven path (runnerDemoLibrary's generateZoneForSpecsGen) —
 * bounce's assembleBounceRegionFromLevel shape. Given a verified level
 * + the side→portal map + per-goal specs, validate, derive (or reuse
 * `derived` — the generator's cached derivation, kept so the spec path
 * stays byte-identical and skips the expensive re-verify), and emit
 * each goal in BOTH the legacy rule form (exitRules /
 * location.access_rule) and the shared paths-and-obstacles form
 * (exitPaths / location.paths + obstacleDefs), gated by
 * verifyObstacleGating — all throws, the fail-loudly doctrine.
 *
 * Authored terms (foreign items, count > 1 — anything the physics
 * can't realise) AND onto the emitted rules (composeAuthoredRule),
 * ride the paths as per-instance logic_gate obstacles
 * (emitObstaclePaths), and additionally ride the payload as
 * `gate_rules` so the flash bridge evaluates them at runtime against
 * live inventory (locked portal/pickup — setGateStates). Zone tables
 * carry no authored terms, so their payloads stay byte-identical
 * (no gate_rules key).
 *
 * @param {object} level — verified runner level
 * @param {object} opts
 * @param {string} opts.region_id
 * @param {Object<string,string>} opts.sidePortals — side → portal id
 * @param {Array<{id: string, item: string|null,
 *   authored?: Array<{item, count}>}>} opts.locationSpecs — one per
 *   level pickup (ids must match level.pickups)
 * @param {Object<string, Array>} [opts.exitAuthored] — side → authored
 *   terms for that exit
 * @param {string} [opts.physicsProfile]
 * @param {object} [opts.derived] — cached deriveGeneratedRules result
 * @param {string} [opts.what] — error-message context
 */
export function assembleRunnerRegion(level, {
    region_id,
    sidePortals,
    locationSpecs = [],
    exitAuthored = {},
    physicsProfile = DEFAULT_PROFILE_ID,
    derived = null,
    what = 'runner region',
} = {}) {
    const { C } = resolveGenPhysics(physicsProfile);
    const modelErrors = validateLevel(level, C);
    if (modelErrors.length > 0) {
        throw new Error(`${what} (${level.id}) invalid: ${modelErrors.join('; ')}`);
    }
    if (!derived) derived = deriveGeneratedRules(level, C);
    if (derived.defects.length > 0) {
        throw new Error(`${what} (${level.id}) has rule defects: `
            + derived.defects.join('; '));
    }

    const obstacleDefs = {};
    const goals = [];
    const referencedPhysics = new Set();
    const gateRules = { portals: {}, pickups: {} };
    const recordPaths = (paths, authoredDefs) => {
        Object.assign(obstacleDefs, authoredDefs);
        for (const p of paths) {
            for (const o of p.obstacles) {
                if (RUNNER_LIBRARY_OBSTACLES[o]) referencedPhysics.add(o);
            }
        }
    };

    const specById = new Map(locationSpecs.map((s) => [s.id, s]));
    const locations = (level.pickups ?? []).map((pk) => {
        const spec = specById.get(pk.id);
        if (!spec) {
            throw new Error(`${what} (${level.id}): pickup '${pk.id}' `
                + 'has no location spec');
        }
        const authored = spec.authored ?? [];
        const sets = derived.pickups[pk.id].minimalSets;
        const rule = composeAuthoredRule(minimalSetsToRule(sets), authored);
        const { paths, authoredDefs } = emitObstaclePaths(sets, authored);
        recordPaths(paths, authoredDefs);
        if (authored.length > 0) gateRules.pickups[pk.id] = authoredTermsToRule(authored);
        goals.push({ kind: 'pickup', id: pk.id, minimalSets: sets, paths, rule });
        return {
            id: pk.id,
            item: spec.item ?? null,
            access_rule: rule,
            paths,
            position: null, // level-local units would be misread as tile coords
        };
    });

    const exitRules = {};
    const exitPaths = {};
    for (const [side, portalId] of Object.entries(sidePortals)) {
        const goal = derived.exits[portalId];
        if (!goal) {
            throw new Error(`${what} (${level.id}): no portal `
                + `'${portalId}' for exit side ${side}`);
        }
        const authored = exitAuthored[side] ?? [];
        const sets = goal.minimalSets;
        const rule = composeAuthoredRule(minimalSetsToRule(sets), authored);
        exitRules[side] = rule;
        const { paths, authoredDefs } = emitObstaclePaths(sets, authored);
        exitPaths[side] = paths;
        recordPaths(paths, authoredDefs);
        if (authored.length > 0) gateRules.portals[portalId] = authoredTermsToRule(authored);
        goals.push({ kind: 'exit', id: portalId, minimalSets: sets, paths, rule });
    }
    for (const id of referencedPhysics) obstacleDefs[id] = RUNNER_LIBRARY_OBSTACLES[id];
    verifyObstacleGating(goals, obstacleDefs);

    const payload = buildZonePayload(region_id, level, sidePortals, physicsProfile);
    if (Object.keys(gateRules.portals).length > 0
            || Object.keys(gateRules.pickups).length > 0) {
        payload.gate_rules = gateRules;
    }
    return { locations, exitRules, exitPaths, obstacleDefs, payload };
}

/**
 * The zone-locations channel hook. `zones` is the generateZoneSet
 * table ([{ level, items, spec }]); `physics` is the fallback profile
 * for zones without a stamped spec.
 */
export function makeExtractZoneRules(zones, { physics } = {}) {
    return function extractZoneRules(zoneIdx, { region_id, exitSides }) {
        const zone = zones[zoneIdx];
        if (!zone) {
            throw new Error(`runner: zone index ${zoneIdx} out of range (${zones.length} zones)`);
        }
        const profile = zone.spec?.physics ?? physics ?? DEFAULT_PROFILE_ID;
        const sidePortals = assignSidePortals(exitSides);
        const branchCount = Math.max(0, (exitSides?.length ?? 0) - 1);

        let level = zone.level;
        if (branchCount > 0) {
            if (!zone.spec) {
                throw new Error(`runner zone ${zoneIdx} (${level.id}) needs ${branchCount} `
                    + 'branch exit(s) but carries no generation spec '
                    + '(generateZoneSet stamps one)');
            }
            level = generateLevel({
                ...zone.spec, id: level.id, branchCount, physics: profile,
            });
        }

        const locationSpecs = (level.pickups ?? []).map((pk) => {
            const item = zone.items[pk.id];
            if (!item) {
                throw new Error(`runner zone ${zoneIdx} (${level.id}): pickup '${pk.id}' `
                    + 'has no canonical item assignment');
            }
            return { id: pk.id, item };
        });
        return assembleRunnerRegion(level, {
            region_id, sidePortals, locationSpecs,
            physicsProfile: profile, what: `runner zone ${zoneIdx}`,
        });
    };
}
