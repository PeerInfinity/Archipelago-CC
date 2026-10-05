/**
 * `flash_seedling_gen` — **A GENERATED SEEDLING ROOM AS A PIPELINE REGION**
 * (seedling generated levels G1; ⚖ the user 2026-09-23, Q1–Q7 as recommended).
 *
 * `flash_seedling` places a REAL room of the installed atlas; this entry asks
 * the Seedling GENERATOR for a new one, built to the pipeline's spec — its size,
 * one door per exit the driver asks for, the AP locations it must hold — and
 * carries the room's own record in the sidecar. The level set is ASSEMBLED AT
 * PLAY from the rules.json (G2), so nothing here writes a set.
 *
 * ── ⛔ A SECOND ENTRY, NOT A MODE OF `flash_seedling` (⚖ Q1) ───────────────
 *
 * The engine picks a realiser by hook precedence: `generateRegionCore` SHADOWS
 * `generateZoneForSpecs` in `generateRegionGen` and in the sphere realise
 * (`procgenPipelineEngine.js`), so one entry declaring both would stop placing
 * real rooms. Two entries keep T1–T3 byte-unmoved. They share the panel, the
 * LOAD EVENT (imported — one spelling: `procgenPlayer` dispatches by the entry's
 * event, so the same glue serves both) and the `flash_panel` block.
 *
 * This entry is PROCEDURAL in the text adventure's SIDES shape
 * (`textAdventureRoom.js`): `generateRegionCore` + `placeFromItems` +
 * `placeFromRules` + `extractPathsAndObstacles` + `serializeWorld`, exits on
 * sides that are only labels. It is a LEAF (T3's law): a generated door cannot
 * enforce an AP gate yet (⚖ Q4 — host-enforced gates at the replan), so it hosts
 * no child gate and its back door is ungated; the gate stays on the maze parent.
 *
 * ── ⛓⛓ THE ENTRY IS LIGHT; THE GENERATOR IS INSTALLED ─────────────────────
 *
 * MEASURED (G1 W0, the F6 static-closure walker): `flashPanel/index.js` reaches
 * 61 files / 993,873 B; a static path to `procgenSeedling.js` makes it 155 /
 * 5,952,574 B. The build hooks need the generator SYNCHRONOUSLY (the engine's
 * `generateRegionCore` contract), so they cannot import it lazily either — and
 * `seedlingRandomizerWiring.js`'s header measured that esbuild INLINES a literal
 * dynamic import. ⇒ (⚖ planner, G1, design B) this module imports nothing
 * heavy: everything play-time is here, and the five BUILD hooks delegate to a
 * room module handed to `installSeedlingGenRoom`. Two doors install it:
 *
 *   · headless — `flashSeedlingGenBuild.js` (imports the room and installs it),
 *     which `REGISTRY_LIBRARIES` and the regenerate worker's list name;
 *   · the live app — `flashPanel/index.js` loads `seedlingGenRoom.js` through a
 *     COMPUTED specifier (the bundle cannot see it) and installs it into THIS
 *     module instance (a raw-module copy of this file would be a second registry).
 *
 * A build hook called before either door ran REFUSES by name
 * (`FLASH_SEEDLING_GEN_NOT_INSTALLED`).
 */

import { RESTART_WARP } from '../procgenCore/restartWarp.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { GENERATION_COST } from '../procgenCore/substratePredicates.js';
import { LOCATION_CAPACITY_KINDS } from '../procgenCore/locationCapacity.js';
import { genRoomCapacityAt } from '../seedlingDemo/seedlingGenCapacity.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';
import { SEEDLING_ITEMS_FEATURE, SEEDLING_LIBRARY_ITEMS } from '../seedlingDemo/itemLabels.js';
import {
    FLASH_SEEDLING_LOAD_REGION_EVENT, FLASH_SEEDLING_PANEL_COMPONENT_TYPE, substrateRegistryEntry as FLASH_SEEDLING_ENTRY,
    seedlingFlashPanelBlock,
} from './flashSeedlingLibrary.js';
import {
    GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS, GEN_ROOM_SUBSTRATE_ID, deserializeGenRoom, genRoomApLocationNames,
} from '../seedlingDemo/seedlingGenRoomPayload.js';

/** ⛓ Spelled ONCE, in the light payload module — the play-time assembler reads it there (G2). */
export const FLASH_SEEDLING_GEN_SUBSTRATE_ID = GEN_ROOM_SUBSTRATE_ID;

/** The room module's build functions this entry delegates to — the install seam's contract. */
export const SEEDLING_GEN_ROOM_EXPORTS = Object.freeze([
    'generateGenRoom', 'placeGenItems', 'placeGenRules', 'extractGenRules', 'serializeGenRoom',
]);

/** Where the live app loads the room module from (relative to the document) — a computed specifier. */
export const SEEDLING_GEN_ROOM_MODULE_PATH = 'modules/seedlingDemo/seedlingGenRoom.js';

/** ⛓ The refusal of a build hook called before the generator is installed. */
export const FLASH_SEEDLING_GEN_NOT_INSTALLED = (hook) => `${FLASH_SEEDLING_GEN_SUBSTRATE_ID}: `
    + `${hook} needs the Seedling generator, and its module is not loaded yet — the flash panel loads it `
    + `(\`${SEEDLING_GEN_ROOM_MODULE_PATH}\`) when the app starts. Wait for the page to finish loading and `
    + 'generate again, or reload the page if it failed (the console names why); a headless caller '
    + 'imports `flashPanel/flashSeedlingGenBuild.js` (it is in REGISTRY_LIBRARIES).';

let installedRoom = null;

/**
 * ⛓ THE INSTALL SEAM. `room` is `seedlingDemo/seedlingGenRoom.js` (its module
 * namespace). Refused by name when it lacks a build function; idempotent.
 */
export function installSeedlingGenRoom(room) {
    const missing = SEEDLING_GEN_ROOM_EXPORTS.filter((k) => typeof room?.[k] !== 'function');
    if (missing.length) {
        throw new Error(`${FLASH_SEEDLING_GEN_SUBSTRATE_ID}: the module handed to installSeedlingGenRoom is `
            + `not the generated-room module — it lacks ${missing.map((k) => `\`${k}\``).join(', ')} `
            + `(install \`${SEEDLING_GEN_ROOM_MODULE_PATH}\`).`);
    }
    installedRoom = room;
    return room;
}

/** True once a room module is installed. */
export function seedlingGenRoomInstalled() {
    return installedRoom !== null;
}

function roomFor(hook) {
    if (!installedRoom) throw new Error(FLASH_SEEDLING_GEN_NOT_INSTALLED(hook));
    return installedRoom;
}

/** The one writer of this payload. */
const WRITER = '`serializeGenRoom` (`seedlingDemo/seedlingGenRoom.js`)';
const CELL = Object.freeze({
    required: Object.freeze(['tx', 'ty']),
    additionalProperties: false,
    properties: Object.freeze({ tx: Object.freeze({ type: 'integer' }), ty: Object.freeze({ type: 'integer' }) }),
});

/**
 * ⛓⛓ THE GENERATED ROOM'S PAYLOAD, DECLARED (the registry's `sidecarFields`
 * slot; vocabulary in `procgenCore/sidecarFields.js`). Every field is DERIVED:
 * the room's serializer is its one writer. The envelope's `exits` carries the
 * doors (T1's Seedling item keys — `kind`, `exit_tiles`, `entrance_tile`,
 * `entrance_spawn`, `external`, `target_level`, `target_spawn`,
 * `target_substrate` — through the envelope's open item schema).
 */
export const FLASH_SEEDLING_GEN_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    fogEnabled: REQUIRED_ENVELOPE_FIELD,
    gameId: Object.freeze({
        type: 'string', required: true, derived: true, enum: Object.freeze(['seedling']),
        description: `Always \`seedling\`, written by ${WRITER}. Ignored at play.`,
    }),
    generated: Object.freeze({
        type: 'boolean', required: true, derived: true, enum: Object.freeze([true]),
        description: `Always \`true\`, written by ${WRITER}: this sidecar CARRIES its room (\`record\`) — `
            + 'the mark G2\'s assembly and the eligibility branch on.',
    }),
    seed: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The generator seed the room was built from, written by ${WRITER} (drawn from the `
            + 'pipeline rng, never 0 — Seedling refuses seed 0). Provenance: the same seed, size and '
            + '`generation` rebuild the same `record`.',
    }),
    size: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The room's size in tiles, written by ${WRITER} (the record's own width/height) — the `
            + 'FINAL size: a room that grew (G8) records the size it was asked for as `generation.grownFrom`.',
        schema: Object.freeze({
            required: Object.freeze(['width', 'height']),
            additionalProperties: false,
            properties: Object.freeze({
                width: Object.freeze({ type: 'integer' }), height: Object.freeze({ type: 'integer' }),
            }),
        }),
    }),
    record: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The BARE generated level record \`{width, height, layers, entities}\` — the `
            + `generator's own output for \`seed\`, written by ${WRITER}, byte-equal to what `
            + '`export-seedling-level-set.mjs --exits=none` emits at that seed and knobs. No door entity '
            + 'and no `apitem`: the assembler (G2) emits both from `exits` and `locations`.',
        schema: Object.freeze({ required: Object.freeze(['width', 'height', 'layers', 'entities']) }),
    }),
    start: Object.freeze({
        type: 'object', required: true, derived: true, schema: CELL,
        description: `The room's start cell (the generator's \`startCell\`), written by ${WRITER} — the `
            + 'origin of the door and location flood.',
    }),
    goal_cell: Object.freeze({
        type: 'object', required: true, derived: true, schema: CELL,
        description: `The certified reach (the goal pickup's cell), written by ${WRITER}; location 0 `
            + 'stands here.',
    }),
    generation: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The knobs the room was built with (\`biome\`, \`obstacleTarget\`, \`triesPerStep\`, `
            + `\`saturationK\`, \`skeleton\`, \`elements\`, \`areas\`, \`fill\`), written by ${WRITER}; `
            + '`procgenParamsFromPayload` opens the per-region form on them. `rerolls` (G2, G5) is how many times '
            + 'the room was re-rolled — to seat its doors without sealing an approach, an engine-added door, or '
            + 'its locations (0 = the first draw; `seed` is the one used) — and `rerollCause` (only when '
            + '`rerolls` > 0) which case caused the last one (`doors`, `engine-added door`, `locations`); and '
            + '`grownFrom` (G8, only when the room GREW: `{width, height}`, the size the pipeline asked for — '
            + '`size` is the final one; `rerolls` counts across the sizes): a record, not a knob.',
    }),
    locations: Object.freeze({
        type: 'array', required: true, derived: true,
        description: `The room's AP locations \`{name, item?, cell, tag, access_rule?}\`, written by ${WRITER}: `
            + '`name` the AP location name, `cell` where its `apitem` stands (location 0 on `goal_cell`), '
            + '`tag` its persistence tag (`procgenSeedling.placementTagId`, allocated against the record '
            + 'without its goal pickup).',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['name', 'cell', 'tag']),
                additionalProperties: false,
                properties: Object.freeze({
                    name: Object.freeze({ type: 'string', minLength: 1 }),
                    item: Object.freeze({ type: 'string' }),
                    cell: CELL,
                    tag: Object.freeze({ type: 'integer' }),
                    access_rule: Object.freeze({ type: 'object' }),
                }),
            }),
        }),
    }),
    level: Object.freeze({
        type: 'integer', required: true, derived: true,
        description: `The level this room is in the ASSEMBLED set — the region's ordinal among `
            + `${FLASH_SEEDLING_GEN_SUBSTRATE_ID} regions in sidecar order, written by ${WRITER} from `
            + '`buildPresetSidecars`\' `ordinalOfRegion`; G2\'s assembler verifies it, and the binding '
            + 'teleports with it.',
    }),
    tile_size: Object.freeze({
        type: 'integer', required: true, derived: true, enum: Object.freeze([16]),
        description: `The game's tile size, written by ${WRITER} (\`entrance_spawn\` is in pixels).`,
    }),
    exitGates: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `The rules RECORDED on the room's exits, \`{exitName: rule}\` (gated exits only), written `
            + `by ${WRITER}. Logic only — no generated door enforces a gate yet (⚖ Q4).`,
    }),
});

// ── the per-region generation form ─────────────────────────────────────────

/**
 * The knobs in the pipeline's shared params bag (prefixed: the bag is one
 * object across substrates). Defaults = the room's (`GEN_ROOM_DEFAULTS`).
 */
export const DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS = Object.freeze({
    seedlingGenBiome: GEN_ROOM_DEFAULTS.biome,
    seedlingGenObstacleTarget: GEN_ROOM_DEFAULTS.obstacleTarget,
    seedlingGenTriesPerStep: GEN_ROOM_DEFAULTS.triesPerStep,
    seedlingGenSkeleton: GEN_ROOM_DEFAULTS.skeleton,
    seedlingGenElements: GEN_ROOM_DEFAULTS.elements,
    seedlingGenAreas: GEN_ROOM_DEFAULTS.areas,
    seedlingGenFill: GEN_ROOM_DEFAULTS.fill,
});

/** Bag key → the room's knob. */
const KNOB_OF = Object.freeze({
    seedlingGenBiome: 'biome',
    seedlingGenObstacleTarget: 'obstacleTarget',
    seedlingGenTriesPerStep: 'triesPerStep',
    seedlingGenSkeleton: 'skeleton',
    seedlingGenElements: 'elements',
    seedlingGenAreas: 'areas',
    seedlingGenFill: 'fill',
});

/**
 * ⛓⛓ SEEDLING GENERATED G4 — **DOES THE ROOM HOST CHILDREN?** A bag key that is
 * NOT a room knob: it steers sphere growth's tree (the two hooks below), not the
 * generator, so it is read here and never reaches `generation` (the room's
 * `knobsOf` picks its own keys). Default TRUE — the host enforces a generated
 * door's gate (`seedlingDoorGate.js`); a state that wants a LEAF says `false`
 * (the committed `seedling_generated_leaf` does, which is what keeps its bytes).
 */
export const SEEDLING_GEN_HOST_CHILDREN_KEY = 'seedlingGenHostChildren';

/** ⛓ S1, D4 — the bag key of the room's `require` directive (`--require=`'s grammar). */
export const SEEDLING_GEN_REQUIRE_KEY = 'seedlingGenRequire';
export const hostsChildren = (regionParams) => regionParams?.seedlingGen?.hostChildren !== false;

/**
 * The regionParams the room reads (`params.seedlingGen`), from the panel bag
 * (`assembleRegionParams`) — in every pipeline mode and the APWorld editor's
 * Generate (the spiral and grid growth handed every core `{}` until seedling
 * generated G3).
 */
export function buildSeedlingGenRegionParams({ params = {} } = {}) {
    const seedlingGen = {};
    for (const [bagKey, knob] of Object.entries(KNOB_OF)) {
        seedlingGen[knob] = params[bagKey] ?? DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS[bagKey];
    }
    seedlingGen.hostChildren = params[SEEDLING_GEN_HOST_CHILDREN_KEY] !== false;
    /** ⛓ S1, D4 — the `require` directive, ONLY WHEN GIVEN: it is not in
     *  `KNOB_OF`'s every-knob loop, so a bag without it builds the regionParams
     *  it always built. */
    if (String(params[SEEDLING_GEN_REQUIRE_KEY] ?? '').trim() !== '') {
        seedlingGen.require = String(params[SEEDLING_GEN_REQUIRE_KEY]).trim();
    }
    return { seedlingGen };
}

/** The bag a payload's `generation` reads back as (`bagFromPayload`). */
export function seedlingGenProcgenParamsFromPayload(payload) {
    const g = payload?.generation;
    if (!g || typeof g !== 'object') return {};
    const out = {};
    for (const [bagKey, knob] of Object.entries(KNOB_OF)) if (knob in g) out[bagKey] = g[knob];
    if ('require' in g) out[SEEDLING_GEN_REQUIRE_KEY] = g.require;
    return out;
}

function selectRow(params, key, label, title, options, onChange) {
    const select = document.createElement('select');
    for (const value of options) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = value;
        select.appendChild(o);
    }
    select.value = params[key] ?? DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS[key];
    select.addEventListener('change', () => { params[key] = select.value; onChange(); });
    return fieldRow(label, title, select);
}

function textRow(params, key, label, title, onChange) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = params[key] ?? '';
    input.placeholder = 'the generator\'s default';
    input.addEventListener('change', () => { params[key] = input.value.trim(); onChange(); });
    return fieldRow(label, title, input);
}

/** The per-substrate controls (drawn by the shared per-region form). Call-time DOM only. */
export function renderSeedlingGenProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    wrap.appendChild(selectRow(params, 'seedlingGenBiome', 'Biome',
        'The boot inventory the room is built and certified for', GEN_ROOM_BIOME_NAMES, onChange));
    wrap.appendChild(numberField(params, {
        key: 'seedlingGenObstacleTarget', label: 'Obstacle target', def: GEN_ROOM_DEFAULTS.obstacleTarget,
        min: 0, integer: true, title: 'How many palette obstacles the generator tries to keep',
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'seedlingGenTriesPerStep', label: 'Tries per step', def: GEN_ROOM_DEFAULTS.triesPerStep,
        min: 1, integer: true, title: 'Candidate placements the generator tries before a step gives up',
    }, onChange));
    wrap.appendChild(textRow(params, 'seedlingGenSkeleton', 'Skeleton',
        'The lab page\'s `?skeleton=` grammar (`<kind>[;key=value]…`); empty = the default', onChange));
    wrap.appendChild(textRow(params, 'seedlingGenElements', 'Elements',
        'The lab page\'s `?elements=` grammar; empty = the biome default', onChange));
    wrap.appendChild(textRow(params, 'seedlingGenAreas', 'Areas',
        'The lab page\'s `?areas=` grammar (`<keys>[;key=value]…`); empty = no area graph', onChange));
    wrap.appendChild(textRow(params, SEEDLING_GEN_REQUIRE_KEY, 'Require',
        'The `?require=` grammar (`hasSword`, `hasShield`): a room the differential grades that item '
        + 'REQUIRED; empty = no directive', onChange));
    wrap.appendChild(selectRow(params, 'seedlingGenFill', 'Fill',
        'dense keeps every wall; shell strips walls no floor touches', ['dense', 'shell'], onChange));
    return wrap;
}

// ── the playback controller (Seedling JS J2) ──────────────────────────────

/**
 * ⛓ J2 — the Playback Bot's controller, INJECTED by `flashPanel/index.js` at
 * `initialize` (bounce's `setPlaybackProxy` precedent: the library stays
 * import-light, and headless — or before the module initializes — the entry
 * answers null, which the bot reads as "panel still mounting"). The controller
 * itself (`seedlingPlaybackController.js`) refuses BY NAME under any runtime
 * but the JS one (⛓ WG: and the wasm one), so declaring the field does not re-open P0's silent wait.
 */
let _playbackController = null;
export function setSeedlingPlaybackController(controller) { _playbackController = controller ?? null; }

/**
 * ⛓ The chart's P2 degree (`substrateCapabilities.js`): the bot walks these
 * rooms on the JS runtime, and ⛓ since solver-walk WG on the WASM runtime too
 * (the engine stages the MOUNTED set; the J2 walker produces the tapes —
 * `seedlingDemo/wasmWalkTape.js`; a tile target is refused by name). The
 * witness: `scripts/procgen/probe-seedling-wasm-generated-playback.mjs`.
 */
export const SEEDLING_PLAYBACK_SCOPE = "with the Flash Panel's JS runtime, or its wasm runtime";

// ── the entry ──────────────────────────────────────────────────────────────

const base = createFlashSubstrateEntry({
    id: FLASH_SEEDLING_GEN_SUBSTRATE_ID,
    label: 'Seedling (generated room)',
    /** ⛓ `seedling_items` is the ITEM TAG of `libraryItems` below (the chart's
     *  P4 names the items; the pipeline's item picker groups an item under the
     *  substrates whose `supportedFeatures` carry its `feature`). */
    supportedFeatures: ['arbitrary_ap_locations', SEEDLING_ITEMS_FEATURE],
    sidecarFields: FLASH_SEEDLING_GEN_SIDECAR_FIELDS,
    apLocationNamesOf: genRoomApLocationNames,
});
// The flashPanel embed is a plain <iframe> (flash_seedling's reasoning): no
// `iframeId`. The factory's pass-through (de)serializers are REPLACED below.
const {
    iframeId: _unusedIframeId,
    serializeWorld: _passThroughSerialize,
    deserializeWorld: _passThroughDeserialize,
    ...runtime
} = base;

export const substrateRegistryEntry = Object.freeze({
    ...runtime,
    panelComponentType: FLASH_SEEDLING_PANEL_COMPONENT_TYPE,
    loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
    // ⛓ RESTART WARP: the Menu panel's Restart re-takes the start hop and warps the game to seedlingStartSpawn
    //   (seedlingRegionGlue), so a world with this room declares exporter[p].return_to_menu (procgenCore/restartWarp.js).
    restartWarp: RESTART_WARP,

    // ── build time: delegated to the installed room module ──
    generateRegionCore: (input) => roomFor('generateRegionCore').generateGenRoom(input),
    placeFromItems: (world, input) => roomFor('placeFromItems').placeGenItems(world, input),
    placeFromRules: (world, input) => roomFor('placeFromRules').placeGenRules(world, input),
    extractPathsAndObstacles: (world, opts) => roomFor('extractPathsAndObstacles').extractGenRules(world, opts),
    serializeWorld: (world, extracted, obstacleLib, itemLib, context) => roomFor('serializeWorld')
        .serializeGenRoom(world, extracted, obstacleLib, itemLib, context),

    // ── play time: light ──
    deserializeWorld: deserializeGenRoom,
    getPlaybackController: () => _playbackController,
    playbackScope: SEEDLING_PLAYBACK_SCOPE,

    /** A generated room's exits are SIDES — labels; the door stands where the flood put it. */
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,
    /**
     * ⛓⛓ G4 — A HOST (⚖ Q4 option C, ruled R1 2026-09-26). The game cannot hold
     * a pipeline item, so the HOST enforces a generated door's gate
     * (`seedlingDoorGate.js`: a refused door bounces the player back onto its
     * approach) — any item can gate any generated door, so the room hosts any
     * child gate. Its back door is gated on the entry gate (the default) —
     * sound: you are only inside if you held it. Both read
     * `regionParams.seedlingGen.hostChildren` (`hostsChildren`): a state that
     * says `false` keeps G1–G3's LEAF (no child; the back door takes no gate slot).
     */
    /**
     * ⛓ THE ITEMS A GENERATED ROOM CAN GATE ON PHYSICALLY — one per distinct
     * AP name in `ITEM_LABELS` (sword, shield, swim), so a shipped world may
     * name them in its scenario (`seedling_generated_swim` names `Progressive
     * Swim`) and `presetDefs.generate.slow.test.js`'s "unknown scenario item"
     * row can tell a declared gate item from a typo. Derived, never typed here.
     */
    libraryItems: SEEDLING_LIBRARY_ITEMS,
    canHostExitGates: () => true,
    exitGateVeto: (regionParams) => (hostsChildren(regionParams) ? () => true : () => false),
    backPortalGated: (regionParams) => hostsChildren(regionParams),

    /** `flash_panel` only — the installed atlas compile's own block. NO `region_atlas`: a generated world has no map. */
    rulesJsonBlocks: () => ({ flash_panel: seedlingFlashPanelBlock() }),

    /**
     * ⛓ G9 — Headless generation cost, DECLARED rather than left to the absent
     * default (`substratePredicates.generationCostOf`; one reader,
     * `procgenPipeline/presetRun.js`). A room is one generator draw plus its
     * re-rolls: 0.1–1.5 s at 10×10 (G1 §5.5; G8 measured 0.2–2.4 s on a loaded
     * box, and a grown room's draw at 10×8 costs the same), the heaviest
     * measured world — top-down over `seedling_atlas`, ten rooms — 5.2 s against
     * the 30 s preset budget, and the committed generated presets build in
     * 0.3–0.7 s (`make-seedling-spiral-room-preset.mjs --check`, G9 base). So a
     * preset naming it stays in CI's slow battery, where the shipped generated
     * presets already run.
     */
    generationCost: GENERATION_COST.LIGHT,

    /**
     * ⛓ G9 — Location capacity (`procgenCore/locationCapacity.js`): TILES, the
     * smaller of the room's FLOOR (its interior less the start and the doors —
     * growth lifts it) and the game's 30 persistence TAGS, one per location's
     * pickup, which no size lifts and so is declared as the answer's `ceiling`:
     * the Initialise form and the engine refuse a room past it by name before
     * any build. `gated` = `locations` — a rule is logic only here (the host
     * enforces doors, not pickups). The bounds and why the ceiling is the
     * CERTAIN one, not the worst case: `seedlingDemo/seedlingGenCapacity.js`.
     */
    locationCapacity: Object.freeze({ kind: LOCATION_CAPACITY_KINDS.TILES, capacityAt: genRoomCapacityAt }),

    defaultProcgenParams: DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS,
    buildRegionParams: buildSeedlingGenRegionParams,
    renderProcgenParams: renderSeedlingGenProcgenParams,
    procgenParamsFromPayload: seedlingGenProcgenParamsFromPayload,

    /** The same lab page as `flash_seedling` — Seedling's room editor is `watch.html`'s edit arm. */
    roomEditor: FLASH_SEEDLING_ENTRY.roomEditor,
});

// Side-effect on import — the standing convention (substrate-registry.md).
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
