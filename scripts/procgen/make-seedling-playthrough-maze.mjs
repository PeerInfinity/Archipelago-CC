#!/usr/bin/env node
/**
 * The `seedling_playthrough_maze` preset: Seedling's PLAYTHROUGH atlas, restricted to a growing list of
 * levels, projected into the MAZE substrate (tile-primitives Stage 2, session tile-primitives-stage2-l15).
 *
 * ⚖ The user, 2026-10-21: "New tiny preset. I'll want to gradually expand it to include all of Seedling."
 * So the preset is named for that growth, and `LEVELS` below is the one place it grows: add a region id,
 * regenerate, and every level with an INTERACTION (a block, a button, a rock — derived from the semantics
 * tables, never listed by hand) plays as one shared level world; the rest project as they always have.
 *
 * The restricted atlas is the playthrough atlas with:
 *   - only the listed regions, each played in the maze (their `substrate: flash_seedling` dropped — the
 *     compile's maze flavour is the default);
 *   - only the vanilla connections between listed regions (the others are UNWIRED and omitted, which the
 *     compile report names);
 *   - the playthrough's start when its region is listed, else `START_LEVEL` (else the first listed region),
 *     at its first sub-region;
 *   - its identity restamped (a different document must not keep the source's content hash).
 * The shared-world ownership comes from the playthrough atlas's OWN persisted partition
 * (`atlases/seedling-subregion-partition.json`, keyed by the SOURCE atlas id).
 *
 * ⛓ THE GRID IS THE ATLAS'S OWN (session tile-primitives-levels-gap3; ⚖ the user, 2026-10-21: "Atlas's own
 * grid"). The playthrough atlas was analysed on its generator's OVERLAY grid over the DELIVERED (set-patched)
 * rooms, so the projection recomputes on exactly that (`playthroughGridFor` + `playthroughAnalyzerOptions`,
 * the pair the partition generator re-runs) and reads the entity rows off the delivered rooms too. On the
 * raw transcription 45 of the 115 regions disagreed with their own atlas (overlay cells, pruned pockets).
 * The grid is the hand-ruled one (`playthroughHandRuledGridFor`, session tile-primitives-sphere-order-6): it moves only the
 * conditions of L40's Fire cells, never which cells are gated, so the partition still holds.
 *
 * Deterministic, so `--check` is an exact byte gate.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-playthrough-maze.mjs [--check] [--quiet]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRegionAtlas, formatCompileReport } from '../../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import { stampAtlasIdentity } from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';
import { seedlingMazeProjectionDeps } from '../../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';
import { apRegionName } from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { SHARED_WORLD_ALPHABET } from '../../frontend/modules/procgenPipeline/regionAtlasMazeProjection.js';
import { SEEDLING_TILE_SIZE } from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { crossRoomButtonsOf, persistenceEffect, IN_ROOM_POLE_GATE_KIND } from '../../frontend/modules/flashPanel/seedlingObstacleEvents.js';
import { PERSISTENCE_RESPONSE } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import {
    PLAYTHROUGH_MAP, playthroughHandRuledGridFor, playthroughAnalyzerOptions, playthroughRopeEvents,
    setPlaythroughLandingAtlas, playthroughLandingGates, buildPlaythroughAtlas, playthroughEventLayer, permissiveBindings,
} from './make-seedling-playthrough-rules.mjs';
import { itemNamesInRule } from '../../frontend/modules/procgenCore/ruleItemNames.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS_DIR = resolve(REPO, 'frontend/modules/flashPanel/atlases');
export const OUT_FILE = resolve(REPO, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json');

/**
 * ⚖ The levels this preset carries, in atlas order. It GROWS (the user's ruling above) — since session
 * tile-primitives-sphere-order-1 in the FIRST-REACH order of the `seedling_playthrough` seed-1 sphere log (⚖ 2026-10-25:
 * "Start adding levels, and the features they require, in the order of the other playthrough's sphere log"): sphere 0's
 * L2–L11 + L94 joined L0 + L13–L20; L86, the last of sphere 0, once its landing under L0's building1 was floor (the
 * playthrough grid takes a building's footprint from its Pixelmask, session tile-primitives-pixelmask-l86). Sphere 0.1 (session
 * tile-primitives-sphere-order-2, ⚖ 2026-10-26 "All 14"): L1 L12 L33 L35 L36 L44 L59 L60 L67 L87 L88 L89 L92 L95 — L12's touched event locks
 * and L67's struck block were built for them. Sphere 2.2 (session tile-primitives-sphere-order-3, ⚖ 2026-10-27 "All 12"): L21–L31 + L37,
 * which needed no new feature (L28's rope holds its fallrock on the grass lock's button — a minted rope, like L16's). Spheres 3.5 + 3.7
 * (session tile-primitives-sphere-order-4, ⚖ 2026-10-27 "L34 + L32"): L34 and L32 — L32's two locations on one tile spill one to the
 * nearest free floor cell (the projection's `location_stacked`); its boss fight stays the rules' static weapon gate. Sphere 4.5
 * (session tile-primitives-sphere-order-5, ⚖ 2026-10-27 "All 6"): L38 L45 L46 L47 L48 L49 — L38's ButtonRoom, which opens L39's wand lock,
 * is a location on its own cell (⚖ "Location on the cell"); the lock's side waits for L39. Sphere 5.3 (session
 * tile-primitives-sphere-order-6, ⚖ 2026-10-28 "All 3"): L39 L40 L43 — L39's wand lock is laid on its own cell, opened by that press
 * (⚖ "Lock cell opened by event"), and the pocket it seals has its doors gated on it (⚖ "Lay the producer's door gates"); L40's
 * Fire cells carry the rules' corpse ruling, Fire AND a weapon (`playthroughHandRuledGridFor`, ⚖ "Static now, mechanism later").
 * Sphere 5.6 (session tile-primitives-sphere-order-7, ⚖ 2026-10-28 "All 13"): L50–L56 L61–L63 L90 L91 L93 — L61's and L63's ButtonRooms light
 * L63's and L62's poles (press locations, as L38's); L63's two in-room poles, lit by a Spear thrust from a stance that is not the faced
 * cell, gate only the L65 landings, so they are not carried here (⚖ "5.6 now, footprints next, then poles"). Sphere 6.1 (session
 * tile-primitives-lightpoles, ⚖ 2026-10-28 "L64 + every pole"): L64 — and every LightPole whose light kills a DarkTrap is laid in its
 * level's world (⚖ "Rope-shaped, stances"): the DarkTraps are one obstacle, opened by a Spear thrust from one of the pole's stances or by
 * the event that lights it (L62's: L63's ButtonRoom press; L63's: their own in-room events, now produced and carried). Spheres 6.5, 6.10
 * and 7.8 (session tile-primitives-sphere-order-8, ⚖ 2026-10-29 "All 7"): L41 L42 (off L40), L57 L58 and L65 L66 L68 — L58's Yeti talk is
 * a location on its talk circle and its portal's cell carries the producer's gate (⚖ "Talk location + portal door"); L65's landings in
 * L63's two pole pockets carry the producer's in-room-pole gates on their exit cells in both worlds (⚖ "World doors + framing").
 */
export const LEVELS = Object.freeze([
    'level_0', 'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8', 'level_9', 'level_10', 'level_11',
    'level_12', 'level_13', 'level_14', 'level_15', 'level_16', 'level_17', 'level_18', 'level_19', 'level_20', 'level_21', 'level_22',
    'level_23', 'level_24', 'level_25', 'level_26', 'level_27', 'level_28', 'level_29', 'level_30', 'level_31', 'level_32', 'level_33', 'level_34',
    'level_35', 'level_36', 'level_37', 'level_38', 'level_39', 'level_40', 'level_41', 'level_42', 'level_43', 'level_44', 'level_45', 'level_46',
    'level_47', 'level_48', 'level_49', 'level_50', 'level_51', 'level_52', 'level_53', 'level_54', 'level_55', 'level_56', 'level_57', 'level_58',
    'level_59', 'level_60', 'level_61', 'level_62', 'level_63', 'level_64', 'level_65', 'level_66', 'level_67', 'level_68', 'level_86', 'level_87',
    'level_88', 'level_89', 'level_90', 'level_91', 'level_92', 'level_93', 'level_94',
    'level_95',
]);

/**
 * Where the preset starts while the playthrough's own start (level_0) is not listed. Pinned rather than "the
 * first listed": growing LEVELS outward (⚖ "L13 + L17", session tile-primitives-grow-levels) put L13 first in
 * atlas order, and the start is what the in-app row and the sphere log are measured from. With level_0 listed
 * (ring 2, ⚖ "level_0, row walks in", session tile-primitives-grow-ring2) the preset starts where the game does
 * and this is only the fallback for a batch without it.
 */
export const START_LEVEL = 'level_14';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** The playthrough atlas cut down to `levels`, restamped. Pure. */
export function restrictAtlas(atlas, levels, { start: fallback } = {}) {
    const keep = new Set(levels);
    const missing = levels.filter((id) => !atlas.regions.some((r) => r.region_id === id));
    if (missing.length > 0) throw new Error(`the playthrough atlas has no region(s) ${missing.join(', ')}`);
    const regions = atlas.regions.filter((r) => keep.has(r.region_id))
        // eslint-disable-next-line no-unused-vars
        .map(({ substrate, ...rest }) => rest);
    const layout = atlas.vanilla_layout ?? {};
    const startKept = keep.has(layout.start_region);
    const startRegion = regions.find((r) => r.region_id === fallback) ?? regions[0];
    const start = startKept ? layout.start_region : startRegion.region_id;
    const startSub = startKept ? layout.start_sub_region : startRegion.subgraph?.sub_regions?.[0];
    const restricted = {
        ...atlas,
        regions,
        vanilla_layout: {
            ...layout,
            start_region: start,
            ...(startSub !== undefined ? { start_sub_region: startSub } : {}),
            connections: (layout.connections ?? []).filter((c) => keep.has(c.from[0]) && keep.has(c.to[0])),
        },
    };
    if (startSub === undefined) delete restricted.vanilla_layout.start_sub_region;
    return stampAtlasIdentity(restricted, 'seedling');
}

/**
 * ⛓ ARROW TRAPS + ROPES (session tile-primitives-arrow-rope, ⚖ 2026-10-22 "Both: this visit + event item") — the
 * playthrough rules' ROPE EVENTS for `levels`: each minted rope's event location (cut in the sub-region its tile
 * borders) and the exit gates of the game landings in its lane (L17's stairs land in L16's lane: that departure
 * costs the cut). Derived by the rules producer (`playthroughRopeEvents`); PLACE is read off the atlas's persisted
 * partition, the same rule, since this compile does not run the producer's analysis pass. A gate or event whose
 * ends are not all in `levels` is left out (its exit is not wired here).
 */
export function ropeEventsFor(atlas, partition, levels) {
    const keep = new Set(levels);
    const place = (row) => {
        const region = atlas.regions.find((r) => r.map_ref === row.level);
        const part = partition.regions?.[region?.region_id];
        if (!region?.subgraph?.sub_regions) return { region_id: region.region_id, side: apRegionName(region.region_id) };
        if (!part) throw new Error(`rope events: the partition has no entry for ${region.region_id}`);
        const [x, y] = [Math.floor(row.x / SEEDLING_TILE_SIZE), Math.floor(row.y / SEEDLING_TILE_SIZE)];
        const [px, py] = part.origin ?? [0, 0];
        const beside = new Set([[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]
            .map(([nx, ny]) => part.rows[ny - py]?.[nx - px]).filter((ch) => ch && ch !== '.')
            .map((ch) => part.sub_regions[SHARED_WORLD_ALPHABET.indexOf(ch)]));
        if (beside.size !== 1) {
            throw new Error(`rope events: L${row.level} rope@${row.x},${row.y} borders sub-regions [${[...beside].join(', ')}] — one was expected`);
        }
        const [sub] = beside;
        return { region_id: region.region_id, sub_region: sub, side: apRegionName(region.region_id, sub) };
    };
    const { events, exitGates } = playthroughRopeEvents(atlas, { place });
    const conns = atlas.vanilla_layout?.connections ?? [];
    return {
        events: events.filter((e) => keep.has(e.region_id)),
        exitGates: exitGates.filter((g) => keep.has(g.region_id) && conns.some((c) => c.from[0] === g.region_id
            && c.from[1] === g.exit_id && keep.has(c.to[0]))),
    };
}

/**
 * ⛓ LANDING GATES (session tile-primitives-gated-tiles, ⚖ 2026-10-22 "Landing gates now") — the playthrough rules'
 * `exitGates` for a landing on LETHAL terrain (L49 → L50 lands in water: the departure costs the Swim), for `levels`.
 * Derived by the rules producer (`playthroughLandingGates`) over the WHOLE atlas, never hand-coded: the maze world
 * already gates that water, and without these the preset's AP layer was looser than its own world (the whole-game
 * certifier: 17 exits). A gate whose crossing is not wired inside `levels` is left out, as `ropeEventsFor` does.
 */
export function landingGatesFor(atlas, levels) {
    const keep = new Set(levels);
    setPlaythroughLandingAtlas(atlas);
    const conns = atlas.vanilla_layout?.connections ?? [];
    return playthroughLandingGates(atlas).filter((g) => keep.has(g.region_id) && conns.some((c) => (
        (c.from[0] === g.region_id && c.from[1] === g.exit_id && keep.has(c.to[0]))
        || (c.one_way !== true && c.to[0] === g.region_id && c.to[1] === g.exit_id && keep.has(c.from[0])))));
}

/** The rule kinds whose args name items (`item_name`, `item_names`/`items` lists, `item_counts`/`items` maps), and those naming none. */
const ITEM_RULE_KINDS = new Set(['Has', 'HasAll', 'HasAny', 'HasAllCounts', 'HasAnyCount', 'HasFromList', 'HasFromListUnique', 'CountItem']);
const ITEMLESS_RULE_KINDS = new Set(['True_', 'False_', 'Constant', 'And', 'Or', 'Not', 'Compare', 'CanReachRegion', 'CanReachLocation', 'CanReachEntrance']);

/**
 * ⛓ An event no world can produce is carried only while a kept rule NEEDS it (session tile-primitives-sphere-order-7, ⚖ 2026-10-28
 * "5.6 now, footprints next, then poles"): L63's in-room LIGHTPOLES are lit by a Spear thrust from a stance that is not the faced
 * cell, which the maze cannot do yet, and their light kills only the darktraps over L63's L65 landings — with L65 unlisted the
 * events gate nothing, and carrying them would only add locations no world prices. Dropping one can leave another unneeded, so
 * to a fixpoint. The whole-game compile, where L65 is listed, still carries and names them. A rule names an item through any
 * item-bearing kind (a multi-item node naming an event keeps it, designer review); a kind whose items cannot be read is refused by
 * name rather than read as naming none. Pure: returns the kept `layer.events`.
 * @param {{events:object[], internalExitRules:object[], exitGates:object[]}} layer
 * @param {(name:string) => boolean} produced does a maze world produce this event
 */
export function neededEvents(layer, produced) {
    // The names: `itemNamesInRule` (keyed on the ARG, walking every nesting — children, args.rules, Not's condition, Compare's
    // sides), plus the count kinds' item MAPS, which it does not read; every nested rule node's kind must be one we know.
    const ruleNames = (rule, acc) => {
        for (const n of itemNamesInRule(rule)) acc.add(n);
        (function walk(v) {
            if (Array.isArray(v)) { for (const x of v) walk(x); return; }
            if (!v || typeof v !== 'object') return;
            if (typeof v.rule === 'string') {
                if (!ITEM_RULE_KINDS.has(v.rule) && !ITEMLESS_RULE_KINDS.has(v.rule)) {
                    throw new Error(`events: a kept rule has a "${v.rule}" node, whose items this layer cannot read — ${JSON.stringify(v)}`);
                }
                for (const map of [v.args?.item_counts, v.args?.items]) {
                    if (map && typeof map === 'object' && !Array.isArray(map)) for (const n of Object.keys(map)) acc.add(n);
                }
            }
            for (const x of Object.values(v)) walk(x);
        })(rule);
        return acc;
    };
    let events = layer.events;
    for (let dropped = true; dropped;) {
        const needed = new Set();
        for (const e of events) ruleNames(e.access_rule, needed);
        for (const r of layer.internalExitRules) ruleNames(r.rule, needed);
        for (const g of layer.internalExitGates ?? []) ruleNames(g.rule, needed);
        for (const g of layer.exitGates) ruleNames(g.rule, needed);
        const before = events.length;
        events = events.filter((e) => produced(e.name) || needed.has(e.name));
        dropped = events.length < before;
    }
    return events;
}

/** The rules producer's event layer over the WHOLE playthrough atlas, built once per process (its analysis pass). */
let producerLayer = null;
function wholeEventLayer(atlas) {
    if (!producerLayer) {
        const doc = buildPlaythroughAtlas();
        if (JSON.stringify(doc) !== JSON.stringify(atlas)) {
            throw new Error('the playthrough atlas is stale against its producer — run make-seedling-playthrough-rules.mjs');
        }
        setPlaythroughLandingAtlas(doc);
        producerLayer = playthroughEventLayer(doc);
    }
    return producerLayer;
}

/**
 * ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations, ⚖ 2026-10-23 "All AP; world rocks+locks" +
 * "Carry + name") — the playthrough rules' OBSTACLE, LOCK, BUTTON and TALK events for `levels`, with the exit gates
 * and the latched locks' internal exit rules they bring. Derived by the rules producer (`playthroughEventLayer`, the
 * one function its own compile calls), never hand-coded: without them the preset's AP layer was looser than the game
 * wherever a crossing depends on an event (whole game: 24 event locations, 18 gated exits, 10 lock returns). An event
 * the maze world cannot produce (a cross-room button, a talk) is carried all the same, so the AP layer is never looser
 * than the game; the certifier names it. A row whose region (or, for a gate, whose crossing) is not in `levels` is
 * left out, as `ropeEventsFor` does; a kept rule naming an event this compile does not mint throws by name.
 */
export function eventLayerFor(atlas, levels, { minted = [] } = {}) {
    const keep = new Set(levels);
    const layer = wholeEventLayer(atlas);
    const conns = atlas.vanilla_layout?.connections ?? [];
    const out = {
        events: layer.events.filter((e) => keep.has(e.region_id)),
        internalExitRules: layer.internalExitRules.filter((r) => keep.has(r.region_id)),
        internalExitGates: (layer.internalExitGates ?? []).filter((g) => keep.has(g.region_id)),
        exitGates: layer.exitGates.filter((g) => keep.has(g.region_id) && conns.some((c) => c.from[0] === g.region_id
            && c.from[1] === g.exit_id && keep.has(c.to[0]))),
    };
    // The events the maze WORLD models (⚖ "All AP; world rocks+locks"): an obstacle's opens it once carried, a latched
    // lock's is what its far side's crossing costs. A cross-room press or a talk has no world mechanism (⚖ "Carry + name").
    // ⛓ A cross-room PRESS (session tile-primitives-sphere-order-5, ⚖ 2026-10-27 "Location on the cell") is produced in its
    // PRESSER's world: the event is a location on the ButtonRoom's own cell (`ButtonRoom.update`: a body standing on it presses
    // it, and the press latches). Its far side — the target the event opens in another level — is not modelled yet (⚖ "Later, with L39").
    // ⛓ An IN-ROOM POLE's event (session tile-primitives-lightpoles, ⚖ 2026-10-28 "Rope-shaped, stances") is produced in its
    // own level's world: a Spear thrust from one of the pole's stances lights it, and the cut IS the event (mode 'pole').
    const mode = new Map([
        ...layer.obstacle.events.map((e) => [e.name, 'open']), ...layer.locks.events.map((e) => [e.name, 'latch']),
        ...layer.buttons.events.filter((e) => e.fields.action?.presser).map((e) => [e.name, 'press']),
        ...layer.poles.events.map((e) => [e.name, 'pole']),
        // ⛓ A TALK (session tile-primitives-sphere-order-8, ⚖ 2026-10-29 "Talk location + portal door") is produced in its
        // writer's world: a location on a tile inside the NPC's talk circle (the L58 Yeti; the L114 Watcher).
        ...layer.talks.events.map((e) => [e.name, 'talk']),
    ]);
    out.events = neededEvents(out, (name) => mode.has(name));
    // `rule` = the event's own location rule: a sub-region world lays a touched lock no crossing uses by it (⚖ "Lay
    // touched event cells", session tile-primitives-sphere-order-2).
    out.world = out.events.filter((e) => mode.has(e.name)).map((e) => ({
        name: e.name, side: e.fields.side, mode: mode.get(e.name), obstacle: e.fields.obstacle, rule: e.access_rule ?? null,
        ...(mode.get(e.name) === 'press' ? { presser: e.fields.action.presser } : {}),
    }));
    // ⛓ A press's FAR side (session tile-primitives-sphere-order-6, ⚖ 2026-10-28 "Lock cell opened by event"): a target the press
    // REMOVES — the producer's own `persistenceEffect` says 'opens' (L39's wand lock, `tSet < 0`: built gone once {39,8} is in
    // `persistence_cleared`) — stands on its own cell in its own level's world (mode 'target'), opened by the event alone, when that
    // level is listed. A target the press does NOT remove is not laid: a cross-room LIGHTPOLE is lit, not gone (its light kills the
    // DarkTraps it reaches): its level's world takes the press as the pole's `opened_by` instead (mode 'lit', session
    // tile-primitives-lightpoles) — the pole's bodies open by the press, or by a thrust from one of its stances.
    const targets = crossRoomButtonsOf(PLAYTHROUGH_MAP).flatMap((b) => b.targets);
    const opens = (o) => {
        const t = targets.find((x) => x.level === o.level && x.type === o.class && x.x === o.x && x.y === o.y);
        if (!t) throw new Error(`press target ${o.class}@${o.x},${o.y} in L${o.level} is no cross-room button's target`);
        return persistenceEffect(t, PERSISTENCE_RESPONSE[t.type]).effect === 'opens';
    };
    const opened = new Set();
    for (const e of out.world.filter((w) => w.mode === 'press')) {
        if (!atlas.regions.some((r) => r.map_ref === e.obstacle.level && keep.has(r.region_id))) continue;
        if (e.obstacle.class === 'lightpole') {
            out.world.push({ name: e.name, side: null, mode: 'lit', obstacle: e.obstacle, rule: null });
            continue;
        }
        if (!opens(e.obstacle)) continue;
        out.world.push({ name: e.name, side: null, mode: 'target', obstacle: e.obstacle, rule: null });
        opened.add(e.name);
    }
    // ⛓ ... and the pocket it seals (⚖ 2026-10-28 "Lay the producer's door gates"): each of the producer's cross-room-press
    // gates on a kept, wired door of a laid target is laid on that exit's cell in its world (mode 'door'), on the press's event.
    const all = new Set(layer.events.map((e) => e.name));
    const pressNames = new Set(layer.buttons.events.filter((e) => e.fields.action?.presser).map((e) => e.name));
    for (const g of out.exitGates.filter((x) => x.kind === 'cross-room-press')) {
        const named = [];
        (function walk(r) { if (r?.rule === 'Has' && pressNames.has(r.args.item_name)) named.push(r.args.item_name); for (const c of r?.children ?? []) walk(c); })(g.rule);
        if (named.length === 0) throw new Error(`${g.region_id}/${g.exit_id}: a cross-room-press gate on ${JSON.stringify(g.rule)} names no press`);
        if (!named.some((n) => opened.has(n))) continue;
        if (g.rule.rule !== 'Has') {
            throw new Error(`${g.region_id}/${g.exit_id}: the door of a laid press target is gated on ${JSON.stringify(g.rule)}, not on the press alone`);
        }
        const level = atlas.regions.find((r) => r.region_id === g.region_id).map_ref;
        out.world.push({ name: g.rule.args.item_name, side: null, mode: 'door', door: { level, exit_id: g.exit_id }, rule: null });
    }
    // ⛓ ... and the producer's IN-ROOM POLE and TALK gates (session tile-primitives-sphere-order-8, ⚖ 2026-10-29 "World doors +
    // framing", "Talk location + portal door"): a kept, wired exit the producer gates on a pole's light (the L63/L65 pocket
    // landings: no round trip into the dead end below a dark trap) or on a talk (the L58 Yeti's portal) carries that gate on its
    // cell in its world, the producer's rule as it stands (`gate`), once every event it names is produced here — a gate on an
    // event no world makes would only shut a door the certifier already names.
    const talkNames = new Set(layer.talks.events.map((e) => e.name));
    for (const g of out.exitGates) {
        const talk = (() => { const n = []; (function walk(r) { if (r?.rule === 'Has' && talkNames.has(r.args.item_name)) n.push(r.args.item_name); for (const c of r?.children ?? []) walk(c); })(g.rule); return n; })();
        if (g.kind !== IN_ROOM_POLE_GATE_KIND && talk.length === 0) continue;
        const events = [...itemNamesInRule(g.rule)].filter((n) => all.has(n));
        if (events.length === 0) throw new Error(`${g.region_id}/${g.exit_id}: a ${g.kind ?? 'talk'} gate on ${JSON.stringify(g.rule)} names no event`);
        if (!events.every((n) => out.world.some((w) => w.name === n && w.mode !== 'door'))) continue;
        const level = atlas.regions.find((r) => r.region_id === g.region_id).map_ref;
        out.world.push({ name: events.join(' + '), side: null, mode: 'door', door: { level, exit_id: g.exit_id }, rule: null, gate: g.rule });
    }
    const have = new Set([...out.events.map((e) => e.name), ...minted]);
    const named = (rule, acc = []) => {
        if (rule?.rule === 'Has' && all.has(rule.args.item_name)) acc.push(rule.args.item_name);
        for (const c of rule?.children ?? []) named(c, acc);
        return acc;
    };
    for (const [what, rule] of [
        ...out.events.map((e) => [`event "${e.name}"`, e.access_rule]),
        ...out.internalExitRules.map((r) => [`${r.region_id} ${r.from} -> ${r.to}`, r.rule]),
        ...out.internalExitGates.map((g) => [`${g.region_id} ${g.from} -> ${g.to} (gate)`, g.rule]),
        ...out.exitGates.map((g) => [`${g.region_id}/${g.exit_id}`, g.rule]),
    ]) {
        const stray = named(rule).filter((n) => !have.has(n));
        if (stray.length) throw new Error(`events: ${what} needs ${stray.join(', ')}, whose region is not in the levels`);
    }
    return out;
}

/**
 * ⛓ The rules producer's OWN permissive bound (`permissiveBindings`, `"<atlas region>/<binding>"`: what its analysis
 * pass leaves uncharged on purpose, e.g. L89's Feather), read from its run — never copied — for the certifier's
 * `permissive` option (session tile-primitives-sphere-order-2, ⚖ 2026-10-26: a STRICTER maze row there is accepted by name).
 */
export function playthroughPermissiveLocations() {
    wholeEventLayer(readJson(resolve(ATLAS_DIR, 'seedling-playthrough.json')));
    return [...permissiveBindings];
}

/** Compile the preset (or, for a measurement, the playthrough restricted to `levels`). Returns `{text, report}`. */
export function buildPlaythroughMaze({ levels = LEVELS } = {}) {
    const atlas = readJson(resolve(ATLAS_DIR, 'seedling-playthrough.json'));
    const mapDoc = readJson(resolve(ATLAS_DIR, atlas.tile_space.map_document));
    const gameConfig = readJson(resolve(REPO, 'frontend/modules/flashPanel/games/seedling.json'));
    const partitionDoc = readJson(resolve(ATLAS_DIR, 'seedling-subregion-partition.json'));
    const partition = partitionDoc.atlases?.[atlas.atlas_id];
    if (!partition) {
        throw new Error(`the sub-region partition has no entry for "${atlas.atlas_id}" — run make-seedling-subregion-partition.mjs`);
    }
    const ropes = ropeEventsFor(atlas, partition, levels);
    const layer = eventLayerFor(atlas, levels, { minted: ropes.events.map((e) => e.name) });
    const mazeProjection = seedlingMazeProjectionDeps({
        mapDoc: PLAYTHROUGH_MAP,
        events: layer.world,
        gameConfig,
        levelWorlds: { partition },
        analysis: {
            gridForLevel: (level) => playthroughHandRuledGridFor(level),
            conditionKey: playthroughAnalyzerOptions.conditionKey,
            resolveCondition: playthroughAnalyzerOptions.resolveCondition,
        },
    });
    const { rules, report } = compileRegionAtlas(restrictAtlas(atlas, levels, { start: START_LEVEL }), {
        mapDoc,
        embedSphereLog: true,
        sidecarFlavor: 'maze',
        mazeProjection,
        events: [...layer.events, ...ropes.events],
        internalExitRules: layer.internalExitRules,
        internalExitGates: layer.internalExitGates,
        exitGates: [...layer.exitGates, ...landingGatesFor(atlas, levels), ...ropes.exitGates],
    });
    return { text: `${stringifyRulesJson(rules)}\n`, report, unresolved: mazeProjection.unresolved ?? [] };
}

if (isEntryPoint(import.meta.url)) {
    const check = process.argv.includes('--check');
    const quiet = process.argv.includes('--quiet');
    let built;
    try {
        built = buildPlaythroughMaze();
    } catch (e) {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    }
    if (!quiet) for (const line of formatCompileReport(built.report)) console.log(line);
    const rel = OUT_FILE.slice(REPO.length + 1);
    if (check) {
        if (!existsSync(OUT_FILE)) {
            console.error(`FAIL: ${rel} does not exist — run without --check to write it`);
            process.exit(1);
        }
        if (readFileSync(OUT_FILE, 'utf8') !== built.text) {
            console.error(`FAIL: ${rel} is not what the playthrough atlas compiles to — regenerate it`);
            process.exit(1);
        }
        console.log(`OK: ${rel} is byte-identical to the compiled atlas`);
        process.exit(0);
    }
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, built.text);
    if (!quiet) console.log(`wrote ${rel} (${built.text.length} bytes)`);
}
