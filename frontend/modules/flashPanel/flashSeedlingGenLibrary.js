/**
 * `flash_seedling_gen` — **A GENERATED SEEDLING ROOM AS A PIPELINE REGION**
 * (seedling generated levels G1; `NewDocs/plans/seedling-generated-plan.md` §0,
 * §2.2; ⚖ the user 2026-09-23, Q1–Q7 as recommended).
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

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';
import {
    FLASH_SEEDLING_LOAD_REGION_EVENT, FLASH_SEEDLING_PANEL_COMPONENT_TYPE, substrateRegistryEntry as FLASH_SEEDLING_ENTRY,
    seedlingFlashPanelBlock,
} from './flashSeedlingLibrary.js';
import {
    GEN_ROOM_DEFAULTS, deserializeGenRoom, genRoomApLocationNames,
} from '../seedlingDemo/seedlingGenRoomPayload.js';

export const FLASH_SEEDLING_GEN_SUBSTRATE_ID = 'flash_seedling_gen';

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
        description: `The room's size in tiles, written by ${WRITER} (the record's own width/height).`,
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
            + '`procgenParamsFromPayload` opens the per-region form on them.',
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
 * The regionParams the room reads (`params.seedlingGen`), from the panel bag —
 * sphere and top-down (`assembleRegionParams`). ⚠ The spiral and grid growth
 * hand every core `{}`, so a room there is built at the defaults.
 */
export function buildSeedlingGenRegionParams({ params = {} } = {}) {
    const seedlingGen = {};
    for (const [bagKey, knob] of Object.entries(KNOB_OF)) {
        seedlingGen[knob] = params[bagKey] ?? DEFAULT_SEEDLING_GEN_PROCGEN_PARAMS[bagKey];
    }
    return { seedlingGen };
}

/** The bag a payload's `generation` reads back as (`bagFromPayload`). */
export function seedlingGenProcgenParamsFromPayload(payload) {
    const g = payload?.generation;
    if (!g || typeof g !== 'object') return {};
    const out = {};
    for (const [bagKey, knob] of Object.entries(KNOB_OF)) if (knob in g) out[bagKey] = g[knob];
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
        'The boot inventory the room is built and certified for', ['pre-sword', 'post-sword'], onChange));
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
    wrap.appendChild(selectRow(params, 'seedlingGenFill', 'Fill',
        'dense keeps every wall; shell strips walls no floor touches', ['dense', 'shell'], onChange));
    return wrap;
}

// ── the entry ──────────────────────────────────────────────────────────────

const base = createFlashSubstrateEntry({
    id: FLASH_SEEDLING_GEN_SUBSTRATE_ID,
    label: 'Seedling (generated room)',
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

    // ── build time: delegated to the installed room module ──
    generateRegionCore: (input) => roomFor('generateRegionCore').generateGenRoom(input),
    placeFromItems: (world, input) => roomFor('placeFromItems').placeGenItems(world, input),
    placeFromRules: (world, input) => roomFor('placeFromRules').placeGenRules(world, input),
    extractPathsAndObstacles: (world, opts) => roomFor('extractPathsAndObstacles').extractGenRules(world, opts),
    serializeWorld: (world, extracted, obstacleLib, itemLib, context) => roomFor('serializeWorld')
        .serializeGenRoom(world, extracted, obstacleLib, itemLib, context),

    // ── play time: light ──
    deserializeWorld: deserializeGenRoom,

    /** A generated room's exits are SIDES — labels; the door stands where the flood put it. */
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,
    /** ⛓ A LEAF (T3's law, ⚖ Q4): no child gate on a generated door; the back door is ungated. */
    canHostExitGates: () => false,
    backPortalGated: () => false,

    /** `flash_panel` only — the installed atlas compile's own block. NO `region_atlas`: a generated world has no map. */
    rulesJsonBlocks: () => ({ flash_panel: seedlingFlashPanelBlock() }),

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
