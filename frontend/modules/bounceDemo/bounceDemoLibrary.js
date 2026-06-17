/**
 * Substrate registry entry for the Bounce Demo (DJ-Metroidvania) —
 * build-order step 5 + the embed phase
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * The entry is a MERGE: flash runtime plumbing (de/serializeWorld,
 * playback stub — via createFlashSubstrateEntry) + bounce's own panel
 * identity + the build-time zone hooks. Bounce rides flashSubstrate's
 * bridge and panel CLASS (see index.js) but registers its own panel
 * component + loadRegion event, because the flash panel instance shows
 * one hardcoded page and host activation keys on panelComponentType.
 *
 * Each zone is a fixture level plus its CANONICAL item assignment
 * (the "original" placement rules.json records; AP re-randomizes).
 * Zone order is chosen winnable through a spiral chain — zone 0 must
 * grant an arrow before anything needs one, because a no-arrows
 * player bounces a deterministic center column and exits at the first
 * exit platform on it. The canonical-vs-rules distinction matters:
 * what AP randomizes over is the RULE structure; this table is just
 * one valid assignment, replaced by the step-7 generator.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { physicsStampFor } from './physics.js';
import { deriveAccessRules } from './deriveRules.js';
import { attachSideExits } from './sideExits.js';
import { generateLevelFromSpecsGen } from './generator.js';
import {
    ABILITY_ITEM_NAMES, minimalSetsToRule, composeAuthoredRule,
    authoredTermsToRule, VICTORY_ITEM_NAME,
    BOUNCE_OBSTACLE_ID_BY_ABILITY, emitObstaclePaths,
} from './apRules.js';
import { validateLevel } from './level.js';
import { verifyObstacleGating } from './verifyObstacles.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { easyTower } from './fixtures/easyTower.js';
import { fillerClimb } from './fixtures/fillerClimb.js';
import { springGap } from './fixtures/springGap.js';
import { fork } from './fixtures/fork.js';

// Canonical assignment constraints (checked by the e2e winnability
// test): the spiral chain hops E,S,W,W with derived side rules, so
// Right arrow must land in zone 0, Left arrow + Springs by zone 1
// (S/W exits derive as arrow-gated; springGap's own pickup needs
// Springs before zone 3).
export const ZONES = Object.freeze([
    { level: bounceStack, items: { loc_arrow: 'Right arrow' } },
    { level: easyTower, items: { loc_easy: 'Left arrow', loc_easy2: 'Springs' } },
    { level: fillerClimb, items: {} },
    { level: springGap, items: { loc_spring: 'Jetpacks' } },
    { level: fork, items: { loc_right: 'Blue platforms', loc_left: VICTORY_ITEM_NAME } },
]);

/**
 * Payload shaped for the flashSubstrate bridge's configure() contract:
 * level geometry rides `params` (the bridge forwards only world.params,
 * ap_items, ap_locations, flashCapabilities, gameId, regionId — not
 * arbitrary payload fields). ap_locations maps the game's pickup ids to
 * AP location names (compileRegionGraph's `<region>__<id>` convention).
 */
function buildZonePayload(region_id, level, sidePortals, physicsProfile = 'classic') {
    // Physics profile stamp: { profile, constants } for non-classic
    // profiles, OMITTED for classic (physicsStampFor returns null) so
    // existing payloads stay byte-identical. Constants are embedded
    // because they're logic-affecting: the world must replay under the
    // C its rules were derived with, even if the profile is retuned.
    const physics = physicsStampFor(physicsProfile);
    return {
        gameId: 'bounceDemo',
        params: {
            bounceLevel: level, // transformed geometry the renderer draws
            sidePortals,        // side -> portal id (exit arrows)
            ...(physics ? { physics } : {}),
        },
        ap_locations: Object.fromEntries(
            (level.pickups ?? []).map((pk) => [pk.id, `${region_id}__${pk.id}`])),
        flashCapabilities: {
            locations: 'cooperative',
            items: 'pull',
            start: 'auto',      // no click needed; the game runs on load
        },
    };
}

/**
 * The zone-locations channel hook (see synthesizeZoneRegion). Attaches
 * per-side exit platforms to the zone's level, derives access rules on
 * the TRANSFORMED level, and emits Rule Builder rules + the canonical
 * item per pickup. Throws on verifier defects — a zone set that emits
 * broken rules should fail generation loudly, not produce a bad seed.
 */
function makeExtractZoneRules(zones, { portalPlacement = 'directional' } = {}) {
    return function extractZoneRules(zoneIdx, { region_id, exitSides }) {
        const zone = zones[zoneIdx];
        if (!zone) throw new Error(`bounce: zone index ${zoneIdx} out of range (${zones.length} zones)`);

        const { level, sidePortals } = attachSideExits(zone.level, exitSides, {
            placement: portalPlacement,
        });
        const modelErrors = validateLevel(level);
        if (modelErrors.length > 0) {
            throw new Error(`bounce zone ${zoneIdx} (${level.id}) invalid after side-exit `
                + `transform: ${modelErrors.join('; ')}`);
        }

        const derived = deriveAccessRules(level);
        if (derived.defects.length > 0) {
            throw new Error(`bounce zone ${zoneIdx} (${level.id}) has rule defects: `
                + derived.defects.join('; '));
        }

        // Emit each goal in BOTH the legacy rule form (exitRules /
        // location.access_rule) and the shared paths-and-obstacles form
        // (exitPaths / location.paths + obstacleDefs), mirroring
        // generateZoneForSpecsGen — so the spiral path rides the obstacle
        // emission too (Phase 4a). Fixtures carry no authored terms, so
        // every path is physics-only.
        const obstacleDefs = {};
        const goals = [];
        const referencedPhysics = new Set();
        const recordPaths = (paths) => {
            for (const p of paths) {
                for (const o of p.obstacles) {
                    if (BOUNCE_LIBRARY_OBSTACLES[o]) referencedPhysics.add(o);
                }
            }
        };

        const locations = (level.pickups ?? []).map((pk) => {
            const item = zone.items[pk.id];
            if (!item) {
                throw new Error(`bounce zone ${zoneIdx} (${level.id}): pickup '${pk.id}' `
                    + 'has no canonical item assignment');
            }
            const sets = derived.pickups[pk.id].minimalSets;
            const rule = minimalSetsToRule(sets);
            const { paths } = emitObstaclePaths(sets, []);
            recordPaths(paths);
            goals.push({ kind: 'pickup', id: pk.id, minimalSets: sets, paths, rule });
            return {
                id: pk.id,
                item,
                access_rule: rule,
                paths,
                position: null, // level-local px would be misread as tile coords
            };
        });

        const exitRules = {};
        const exitPaths = {};
        for (const side of exitSides) {
            const portalId = sidePortals[side];
            const sets = derived.exits[portalId].minimalSets;
            const rule = minimalSetsToRule(sets);
            exitRules[side] = rule;
            const { paths } = emitObstaclePaths(sets, []);
            exitPaths[side] = paths;
            recordPaths(paths);
            goals.push({ kind: 'exit', id: portalId, minimalSets: sets, paths, rule });
        }
        for (const id of referencedPhysics) obstacleDefs[id] = BOUNCE_LIBRARY_OBSTACLES[id];
        verifyObstacleGating(goals, obstacleDefs);

        return {
            locations,
            exitRules,
            exitPaths,
            obstacleDefs,
            payload: buildZonePayload(region_id, level, sidePortals),
        };
    };
}

// ── Sphere-driven growth hook (generateZoneForSpecs, step 2 + the
//    rule-gated portals/pickups extension, priority #2) ───────────────
//
// Requirement-targeted region realization for the sphere grower
// (NewDocs/plans/procedural-generation/sphere-driven-growth.md): the
// driver specifies per-exit and per-location target requirements in AP
// item names (plus optional per-item counts). Bounce SPLITS each
// requirement at this boundary:
//
//   - PHYSICS part — ability items with required count 1, realised as
//     gate geometry by the verified prefix-graded chain generator.
//   - AUTHORED part — everything else (non-ability items like keys,
//     and count > 1 instances of anything, incl. abilities). These
//     impose NO geometry: they ride the payload as `gate_rules`, the
//     host bridge evaluates them against live inventory, and the game
//     renders the portal/pickup locked until they're satisfied (the
//     metroidvania tease). The EMITTED rule is the composition:
//     physics AND authored.
//
// Unsatisfiable specs THROW — that is the "adapter declines" channel
// (non-nested physics requirements, more than one physics-arrowless
// exit). There is no gate vocabulary anymore: any AP item gates any
// portal/pickup via the authored channel.

const SIDE_DIRECTIONS = { N: 'up', S: 'down', E: 'right', W: 'left' };

const ABILITY_BY_ITEM_NAME = Object.freeze(Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, name]) => [name, ability])));

/** AP item names bounce realizes as PHYSICS gate geometry. No longer a
 *  vocabulary limit (the registry declares `gateableItems: null` —
 *  authored gate terms cover everything else); still meaningful to the
 *  planner as "items every substrate can gate on physically". */
export const GATEABLE_ITEMS = Object.freeze(Object.values(ABILITY_ITEM_NAMES));

/**
 * Split a driver requirement (AP item names + optional counts) into
 * the physics part (ability ids for the chain generator) and the
 * authored part ([{ item, count }] for the bridge-evaluated lock).
 */
function splitRequirement(requirement, counts = {}) {
    const physics = [];
    const authored = [];
    for (const name of requirement ?? []) {
        const count = counts?.[name] ?? 1;
        const ability = ABILITY_BY_ITEM_NAME[name];
        if (ability && count === 1) physics.push(ability);
        else authored.push({ item: name, count });
    }
    return { physics, authored };
}

/**
 * Registry-declared item library: bounce's ability items + Victory in
 * the shared-library entry shape, so the procgen pipeline panel can
 * offer them in its scenario pool (merged with DEFAULT_ITEMS by the
 * UI — declared here instead of the shared submodule). Ids ARE the AP
 * item names; rules.json item names come out verbatim.
 */
export const BOUNCE_LIBRARY_ITEMS = Object.freeze(Object.fromEntries([
    ['Right arrow', '#e0a030'],
    ['Left arrow', '#e0c030'],
    ['Springs', '#40c060'],
    ['Jetpacks', '#d04040'],
    ['Blue platforms', '#4080d0'],
    ['Brown platforms', '#a06a40'],
].map(([name, color]) => [name, {
    id: name,
    name,
    classification: 'progression',
    color,
    symbol: 'star',
    feature: 'bounce_abilities',
}]).concat([[VICTORY_ITEM_NAME, {
    id: VICTORY_ITEM_NAME,
    name: VICTORY_ITEM_NAME,
    classification: 'progression',
    color: '#f5d020',
    symbol: 'star',
    feature: 'bounce_abilities',
    is_victory: true,
}]])));

/**
 * Registry-declared OBSTACLE library — the bounce side of the
 * obstacles-along-paths refactor
 * (NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md,
 * Phase 1). One obstacle per ability: "this path crosses the
 * blue-platform gap" compiles (via shared/procgen/pathsAndObstaclesCompiler.js)
 * to has("Blue platforms"). Declared here (NOT in the shared submodule)
 * alongside BOUNCE_LIBRARY_ITEMS; merged with DEFAULT_OBSTACLES by the
 * consumer, exactly as libraryItems is merged with DEFAULT_ITEMS.
 *
 * These are the PHYSICS obstacles: each is a combo_list cleared by its
 * single ability item ([[itemName]]). Non-physics gates (foreign items,
 * count > 1) are NOT in this table — they become per-instance
 * `logic_gate` obstacles with an arbitrary clear_rule, created the way
 * maze creates them, so physics-first / gate-fallback is one mechanism.
 *
 * Obstacle ids are stable identifiers (`bounce_gate_<ability>`), NOT AP
 * item names; each clear_set references the AP item name (bounce item
 * ids === AP item names). `bounce_ability` back-references the ability
 * id so the paths-and-obstacles producer (Phase 2) maps a required
 * ability -> its obstacle id. Derived from ABILITY_ITEM_NAMES so the
 * vocabulary can't drift out of sync with the ability set.
 */
const BOUNCE_OBSTACLE_PRESENTATION = Object.freeze({
    right: { name: 'Right Arrow Gate', color: '#e0a030' },
    left: { name: 'Left Arrow Gate', color: '#e0c030' },
    springs: { name: 'Spring Gap', color: '#40c060' },
    jetpacks: { name: 'Jetpack Gap', color: '#d04040' },
    blue: { name: 'Blue Platform Gap', color: '#4080d0' },
    brown: { name: 'Brown Platform Gap', color: '#a06a40' },
});

/** ability id -> obstacle id. Defined in apRules.js (the rule-emission
 *  home, so the emitter can reference it cycle-free); re-exported here for
 *  the registry-facing consumers (and the Phase 1 vocabulary test). */
export { BOUNCE_OBSTACLE_ID_BY_ABILITY };

export const BOUNCE_LIBRARY_OBSTACLES = Object.freeze(Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, itemName]) => {
        const id = BOUNCE_OBSTACLE_ID_BY_ABILITY[ability];
        const pres = BOUNCE_OBSTACLE_PRESENTATION[ability] ?? {};
        return [id, {
            id,
            name: pres.name ?? `${itemName} Gate`,
            clear_set_type: 'combo_list',
            clear_set: [[itemName]],
            color: pres.color ?? '#b06eb8',
            feature: 'bounce_abilities',
            bounce_ability: ability,
        }];
    })));

/**
 * Driver-side structural veto for the sphere grower: can a bounce
 * region host one more exit gate alongside the gates it already
 * hosts? Mirrors generateLevelFromSpecs' spec constraints, applied to
 * each gate's PHYSICS PART (authored terms impose no geometry):
 *
 *   - A physics-arrowless gate's portal sits on the forced column, so
 *     it must be the on-column TOP: while LOCKED it doesn't block (a
 *     locked portal swallows nothing), but once its authored terms are
 *     satisfied it swallows every climb past it — and AP rules are
 *     monotone, so "reachable only while still locked" is not
 *     emittable. Hence at most ONE physics-arrowless gate per region,
 *     wholly-authored gates included.
 *   - The non-arrow physics cores of all gates must form a nested
 *     chain the column can realise, all fitting below the arrowless
 *     top when one exists.
 *
 * Conservative: a true here can still be declined by the generator,
 * but only for geometry dead-ends (retried), not structure.
 *
 * Gates arrive in the driver's vocabulary: arrays of AP item names
 * (count 1) or { item, count } terms.
 */
export function canHostExitGates(existingGates, newGate) {
    // Physics part per gate: ability items with required count 1.
    // Everything else is an authored term — structurally free.
    const physicsParts = [...existingGates, newGate].map((gate) =>
        gate.map((term) => (typeof term === 'string' ? { item: term, count: 1 } : term))
            .filter(({ item, count }) => ABILITY_BY_ITEM_NAME[item] && (count ?? 1) === 1)
            .map(({ item }) => item));
    const isArrowItem = (name) => name === ABILITY_ITEM_NAMES.left
        || name === ABILITY_ITEM_NAMES.right;

    const arrowless = physicsParts.filter((g) => !g.some(isArrowItem));
    if (arrowless.length > 1) return false;

    // Non-arrow cores must nest (drift arrows ride branch tips, the
    // column realises the cores).
    const cores = physicsParts.map((g) => g.filter((item) => !isArrowItem(item)).sort())
        .sort((a, b) => a.length - b.length);
    for (let i = 1; i < cores.length; i++) {
        if (!cores[i - 1].every((x) => cores[i].includes(x))) return false;
    }
    // An arrowless gate is the column top: every core must fit below it.
    if (arrowless.length === 1) {
        const top = arrowless[0].filter((item) => !isArrowItem(item));
        if (!cores.every((c) => c.every((x) => top.includes(x)))) return false;
    }
    return true;
}

/**
 * Braid-mode structural veto (sphere grower). A braid region realises its gates
 * as one fork-free NESTED chain. The grower hands each forward exit a SINGLE
 * physics item, and single-item requirements nest only when they're identical —
 * so a braid region can host at most ONE distinct forward physics gate item
 * (plus any number of authored / ungated exits). The back portal is ungated in
 * braid mode (generateRegionZoneGen), so it isn't in `existingGates` and imposes
 * no constraint.
 *
 * BROWN is exempt from the single-item limit: a brown goal rides its OWN offset
 * TIP beside the green spine (suppression gates it on the brown item), so any
 * number of brown goals coexist at any chain level — brown is a per-goal host
 * colour, not a spine rung. The braid CAN therefore host e.g. {[Brown], [Left]}
 * (brown tip at the bottom level, arrow gate + tip above) and two [Brown] gates.
 * So the constraint is: at most ONE distinct NON-brown physics gate item (the
 * grower composes single-item gates, and single-item non-brown reqs nest only
 * when identical → one climbable spine). Still stricter than canHostExitGates.
 */
export function canHostExitGatesBraid(existingGates, newGate) {
    const nonBrown = new Set();
    for (const gate of [...existingGates, newGate]) {
        for (const term of gate) {
            const { item, count } = typeof term === 'string' ? { item: term, count: 1 } : term;
            if (ABILITY_BY_ITEM_NAME[item] && (count ?? 1) === 1
                && ABILITY_BY_ITEM_NAME[item] !== 'brown') nonBrown.add(item);
        }
    }
    return nonBrown.size <= 1;
}

/**
 * @param {object} specs
 * @param {string} specs.region_id
 * @param {Array<{side: string, requirement: string[],
 *   counts?: Object<string, number>}>} specs.exitSpecs — requirement in
 *   AP item names (any items; `counts` gives per-item required counts,
 *   default 1); one exit platform per side.
 * @param {Array<{id: string, item: string|null, requirement: string[],
 *   counts?: Object<string, number>}>} [specs.locationSpecs] — pickups;
 *   `item` is the canonical placement.
 * @param {number} [specs.seed]
 * @param {number} [specs.stepsBetween]
 * @param {number} [specs.jitter]
 * @param {string} [specs.physicsProfile] — physics.js PROFILES id
 *   (default 'classic'); generation, verification and the emitted
 *   payload stamp all ride the same profile.
 * @returns {{locations: Array, exitRules: Object, payload: Object}}
 */
export function generateZoneForSpecs(specs = {}) {
    const gen = generateZoneForSpecsGen(specs);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

/**
 * Generator form of generateZoneForSpecs: forwards the level
 * generator's per-attempt progress events ({ type: 'attempt', ... })
 * and returns the zone-rules result. The sync wrapper above drains it
 * with no pauses — identical behavior and output. The sphere driver
 * prefers this hook when present so the panel's progress indicator
 * can show generate-and-test attempts live.
 */
export function* generateZoneForSpecsGen({
    region_id,
    exitSpecs = [],
    locationSpecs = [],
    seed = 1,
    stepsBetween = 2,
    jitter = 0,
    physicsProfile = 'classic',
    // 'column' (default) or 'braid' (Regime-1 2-wide braid, free arrows).
    // braidWidth overrides the level width under braid mode; decorChance is
    // { blue, brown, spring, jetpack } per-eligible-platform probabilities.
    mode = 'column',
    braidWidth,
    decorChance = {},
    // The free starting arrow ('left'|'right') the player always holds — gated
    // braid portals ride tips toward it, and the verifier treats it as free.
    freeArrow = 'right',
} = {}) {
    const exits = exitSpecs.map((s) => {
        if (!SIDE_DIRECTIONS[s.side]) {
            throw new Error(`bounce zone '${region_id}': unknown exit side '${s.side}'`);
        }
        const { physics, authored } = splitRequirement(s.requirement, s.counts);
        return {
            id: `side_exit_${s.side}`,
            side: s.side,
            direction: SIDE_DIRECTIONS[s.side],
            requirement: physics,
            authored,
        };
    });
    const pickups = locationSpecs.map((s) => {
        const { physics, authored } = splitRequirement(s.requirement, s.counts);
        return { id: s.id, requirement: physics, authored };
    });

    // The winning attempt's derivation is reused for rule emission —
    // re-deriving here would re-run the verifier (the most expensive
    // step for dj mover levels) on the identical level and constants.
    const { level, derived } = yield* generateLevelFromSpecsGen({
        id: region_id,
        exitSpecs: exits,
        pickupSpecs: pickups,
        seed,
        stepsBetween,
        jitter,
        physics: physicsProfile,
        mode,
        braidWidth,
        decorChance,
        freeArrow,
    });
    const sidePortals = {};
    for (const e of exits) sidePortals[e.side] = e.id;
    // Emit each goal's access in TWO faithful forms (Phase 3):
    //   - exitRules / location.access_rule: the legacy composed rule
    //     (derived physics AND authored), kept for back-compat consumers
    //     and tests.
    //   - exitPaths / location.paths + obstacleDefs: the shared
    //     paths-and-obstacles representation, which the engine prefers as
    //     the CANONICAL emission for sphere-growth (it compiles to the
    //     same rule). The obstacle defs (physics referenced + per-instance
    //     logic gates) ride a region-level channel the engine merges into
    //     the compile lib — NOT the serialized payload.
    // The authored terms alone also ride the payload as gate_rules so the
    // host bridge can evaluate them at runtime (locked portal/pickup).
    const gateRules = { portals: {}, pickups: {} };
    const exitRules = {};
    const exitPaths = {};
    const obstacleDefs = {};
    const goals = []; // for the per-obstacle gating verifier
    const referencedPhysics = new Set();
    const recordPaths = (paths, authoredDefs) => {
        Object.assign(obstacleDefs, authoredDefs);
        for (const p of paths) {
            for (const o of p.obstacles) {
                if (BOUNCE_LIBRARY_OBSTACLES[o]) referencedPhysics.add(o);
            }
        }
    };
    for (const e of exits) {
        const sets = derived.exits[e.id].minimalSets;
        const rule = composeAuthoredRule(minimalSetsToRule(sets), e.authored);
        exitRules[e.side] = rule;
        const { paths, authoredDefs } = emitObstaclePaths(sets, e.authored);
        exitPaths[e.side] = paths;
        recordPaths(paths, authoredDefs);
        goals.push({ kind: 'exit', id: e.id, minimalSets: sets, paths, rule });
        if (e.authored.length > 0) {
            gateRules.portals[e.id] = authoredTermsToRule(e.authored);
        }
    }
    const authoredByLocation = Object.fromEntries(
        pickups.map((p) => [p.id, p.authored]));
    const locations = locationSpecs.map((s) => {
        const authored = authoredByLocation[s.id];
        const sets = derived.pickups[s.id].minimalSets;
        if (authored.length > 0) {
            gateRules.pickups[s.id] = authoredTermsToRule(authored);
        }
        const rule = composeAuthoredRule(minimalSetsToRule(sets), authored);
        const { paths, authoredDefs } = emitObstaclePaths(sets, authored);
        recordPaths(paths, authoredDefs);
        goals.push({ kind: 'pickup', id: s.id, minimalSets: sets, paths, rule });
        return {
            id: s.id,
            item: s.item ?? null,
            access_rule: rule,
            paths,
            position: null, // level-local px would be misread as tile coords
        };
    });
    // The physics obstacle defs the emitted paths reference (authored defs
    // were collected by recordPaths). Together these are the region's lib
    // additions, merged into the compile lib by the engine.
    for (const id of referencedPhysics) obstacleDefs[id] = BOUNCE_LIBRARY_OBSTACLES[id];
    // Hard gate: the emitted obstacle paths must recompile to exactly the
    // proven rule, and each physics obstacle must gate a necessary ability
    // (verifyObstacles.js). A defect here means the obstacle encoding
    // drifted from the verified geometry — fail loudly, never ship it.
    verifyObstacleGating(goals, obstacleDefs);
    const payload = buildZonePayload(region_id, level, sidePortals, physicsProfile);
    if (Object.keys(gateRules.portals).length > 0
            || Object.keys(gateRules.pickups).length > 0) {
        payload.gate_rules = gateRules;
    }
    return { locations, exitRules, exitPaths, obstacleDefs, payload };
}

// Shared across every bounce entry — same Shape-1 reasoning as flash's
// FLASH_PANEL_COMPONENT_TYPE/FLASH_LOAD_REGION_EVENT: all bounce zone-set
// ids resolve to the ONE bounce panel + load event. Bounce gets its OWN
// event (not flash:loadRegion) so the flash placeholder's bridge isn't
// configured by bounce region loads and host activation brings the right
// panel forward.
export const BOUNCE_PANEL_COMPONENT_TYPE = 'bounceDemoPanel';
export const BOUNCE_LOAD_REGION_EVENT = 'bounce:loadRegion';
export const BOUNCE_IFRAME_ID = 'bounceDemo';
// Published by the host module (index.js) after the renderer setting
// changes; the single bounceDemoPanel subscribes (via the panel factory's
// reloadEvent) and swaps its iframe between the JS and real-DJ pages. The
// real-DJ page (modules/bounceDemo/djReal/) loads under the SAME iframeId
// and loadRegionEvent — only the page URL differs — so the registry
// identity above stays constant across renderers.
export const BOUNCE_RENDERER_CHANGED_EVENT = 'bounce:rendererChanged';

// Which renderer bounce region loads route to: 'js' (the canvas
// renderer, default) or one of the real-DJ page's player tiers —
// 'ruffle', 'swfrecomp' (browser-WASM), 'flash' (native NPAPI), or
// the legacy 'dj' (auto: swfrecomp when runtime/ artifacts exist,
// else ruffle). Everything non-'js' routes to the dj panel; the tier
// itself is consumed by the dj page (host module relays it via
// localStorage — see index.js). Host module wires this to the
// moduleSettings.bounceDemo.renderer setting; the library default
// keeps headless imports on 'js'. Unknown values fall back to 'js'.
export const BOUNCE_DJ_RENDERERS = Object.freeze(['dj', 'ruffle', 'swfrecomp', 'flash']);
let _renderer = 'js';
export function setBounceRenderer(renderer) {
    _renderer = BOUNCE_DJ_RENDERERS.includes(renderer) ? renderer : 'js';
}
export function getBounceRenderer() { return _renderer; }
export function isDjRenderer() { return _renderer !== 'js'; }
// Playback-bot control channel: the host-side PlaybackProxy publishes
// controller commands here; the shared flash bridge subscribes (it
// learns the event name from the iframe URL's playbackControlEvent
// param, same pattern as loadRegionEvent).
export const BOUNCE_PLAYBACK_CONTROL_EVENT = 'bounce:playbackControl';

// Host-side PlaybackProxy, injected by bounceDemo/index.js at
// initialize() (the library stays dependency-free so headless CLI
// drivers can import it without pulling in panel/eventBus code).
// Before injection — and headless — getPlaybackController returns
// null and the playback bot no-ops on bounce regions.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

/**
 * Build a bounce substrate registry entry for a zone set — the same
 * per-entry factory pattern flashSubstrate uses per game, and literally
 * built on it: createFlashSubstrateEntry supplies the runtime plumbing
 * (exits-Map de/serializeWorld for the sidecar round-trip, playback
 * stub), then bounce overrides the panel identity and adds the
 * zone-based build-time hooks. `zones` is a ZONES-shaped table
 * (fixtures or generator.generateZoneSet output); `portalPlacement` is
 * 'directional' | 'arbitrary' (sideExits.js).
 */
export function createBounceSubstrateEntry({
    id = 'bounce',
    label = 'Bounce Demo',
    zones = ZONES,
    portalPlacement = 'directional',
} = {}) {
    return Object.freeze({
        ...createFlashSubstrateEntry({ id, label, iframeId: BOUNCE_IFRAME_ID }),

        // Bounce's single panel identity (one component / event / iframeId
        // for BOTH renderers). The renderer setting no longer switches the
        // routing identity — the one bounceDemoPanel swaps its own iframe
        // src between the JS and real-DJ pages (both speak the same
        // __swfBridge contract under this iframeId), so procgenPlayer reads
        // a constant identity here and the renderer choice is a panel-local
        // concern. See index.js (getIframeSrc + reloadEvent).
        panelComponentType: BOUNCE_PANEL_COMPONENT_TYPE,
        loadRegionEvent: BOUNCE_LOAD_REGION_EVENT,
        iframeId: BOUNCE_IFRAME_ID,

        // Playback bot: overrides the flash entry's `() => null` stub.
        // The proxy publishes controller commands on
        // BOUNCE_PLAYBACK_CONTROL_EVENT; the in-iframe flash bridge
        // translates walkTo targets and the game's botDriver plays the
        // real physics (input synthesis, not event dispatch).
        getPlaybackController: () => _playbackProxy,

        // Loop-mode capabilities: regionMove + locationCheck queue
        // actions map to the playback bot's implementations (walkTo an
        // exit portal / a location on real physics) via
        // executeVia: 'playbackBot' — the loops queue parks and the
        // bot plays; loops charges the loop_costs value on completion
        // (bounce tracks no mana natively, v1). NO explore action
        // exists for bounce. Manual play yes; custom queues judged not
        // worthwhile (user decision, 2026-06-12).
        loopSupport: Object.freeze({
            queueActions: Object.freeze(['regionMove', 'locationCheck']),
            executeVia: 'playbackBot',
            manual: true,
            customQueues: false,
        }),

        // The substrate's zone table places this item itself (fork's
        // loc_left in the fixture set; generateZoneSet's last zone).
        // Emission paths use it as the completion-condition item when
        // the scenario pool contributes no is_victory item — without
        // it the AP world gets NO goal and AP defaults to trivially
        // true (BaseClasses.set_player_attr), which makes the seed
        // "beaten" at sphere 0.
        victoryItem: VICTORY_ITEM_NAME,

        // Zone-based substrate metadata (read by layout drivers)
        zoneCount: zones.length,
        // All payload content comes from extractZoneRules (which knows
        // the exit sides); no separate synthesizeZonePayload needed.
        extractZoneRules: makeExtractZoneRules(zones, { portalPlacement }),

        // Sphere-driven growth: requirement-targeted generation + the
        // structural veto for gate combinations + the panel-facing
        // item library (abilities + Victory). gateableItems is null —
        // FULL vocabulary: non-ability (and count > 1) gate terms are
        // realised as authored bridge-evaluated locks, not geometry
        // (rule-gated portals/pickups, priority #2).
        generateZoneForSpecs,
        generateZoneForSpecsGen,
        gateableItems: null,
        canHostExitGates,
        canHostExitGatesBraid,
        // Items a layout driver may attach to a surplus arrowless exit as
        // an off-column DRIFT so the level realiser can place it (a zone
        // hosts at most one arrowless "column top" exit). The driver only
        // does this when the item is free (granted as a starting item), so
        // the realised logic is unchanged — see generateRegionZoneGen.
        driftItems: [ABILITY_ITEM_NAMES.left, ABILITY_ITEM_NAMES.right],
        libraryItems: BOUNCE_LIBRARY_ITEMS,
        // Physics obstacle vocabulary (obstacles-along-paths refactor,
        // Phase 1). Merged with DEFAULT_OBSTACLES by the consumer, like
        // libraryItems. The producer + engine merge land in Phase 2.
        libraryObstacles: BOUNCE_LIBRARY_OBSTACLES,
        supportedFeatures: Object.freeze(['arbitrary_ap_locations', 'bounce_abilities']),
    });
}

export const substrateRegistryEntry = createBounceSubstrateEntry();

/** The default entry's hook, bound to the fixture ZONES (tests). */
export const extractZoneRules = substrateRegistryEntry.extractZoneRules;

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
