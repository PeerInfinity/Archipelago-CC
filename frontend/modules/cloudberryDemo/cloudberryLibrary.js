/**
 * Substrate registry entry for Cloudberry Kingdom (substrate id `cloudberry`) — a
 * region is one Cloudberry level, played by the game page of the Cloudberry repo
 * (`cloudberry-kingdom-wasm`, embedded mode) inside the flash-substrate panel.
 *
 * Built like runner's entry on the flash substrate factory: flash's runtime
 * plumbing (exits-Map de/serializeWorld, the shared bridge) + Cloudberry's own
 * panel identity (component type, load event, iframe id, playback event).
 *
 * P2a scope: content comes from PRE-GENERATED regions (a region-library pack,
 * `scripts/procgen/make-demo-cloudberry-pack.mjs`); there is no build-time
 * generation hook yet (P2b: a hidden Cloudberry iframe answers `generate`).
 * So the entry declares the region-library hooks and no zone table.
 *
 * The rules come from the generated document's facts (`cloudberryRules.js`).
 * A library entry carries those facts AND the rules emitted from them
 * (`carried_rules`, runner's shape); `validateLibraryEntry` re-emits and refuses
 * any drift between the two.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry, FLASH_SIDECAR_FIELDS, flashZoneExitSides } from '../flashSubstrate/flashSubstrateLibrary.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { REQUIRED_ENVELOPE_FIELD } from '../procgenCore/sidecarFields.js';
import { assembleZoneRegion } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    CLOUDBERRY_GAME_ID, CLOUDBERRY_PAYLOAD_VERSION, CLOUDBERRY_LIBRARY_ITEMS, CLOUDBERRY_ITEM_NAMES,
    CLOUDBERRY_VICTORY_ITEM, PAGE_SIDE, buildCloudberryPayload, emitCloudberryRules, pageParamsForWorld,
} from './cloudberryRules.js';

export const CLOUDBERRY_SUBSTRATE_ID = 'cloudberry';
export const CLOUDBERRY_PANEL_COMPONENT_TYPE = 'cloudberryDemoPanel';
export const CLOUDBERRY_LOAD_REGION_EVENT = 'cloudberry:loadRegion';
export const CLOUDBERRY_IFRAME_ID = 'cloudberryDemo';
export const CLOUDBERRY_PLAYBACK_CONTROL_EVENT = 'cloudberry:playbackControl';

/** AP item names a Cloudberry region realises as level geometry (the ten items). */
export const GATEABLE_ITEMS = Object.freeze(Object.values(CLOUDBERRY_ITEM_NAMES));

// Host-side PlaybackProxy, injected by index.js (null headless: the bot no-ops).
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

// ── The payload, declared (the registry's `sidecarFields` slot) ──
const PAGE_DERIVED_PARAMS = Object.freeze(['exits', 'sidePortals', 'entrySide']);

export const CLOUDBERRY_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    fogEnabled: REQUIRED_ENVELOPE_FIELD,
    gameId: Object.freeze({
        ...FLASH_SIDECAR_FIELDS.gameId, derived: true, enum: Object.freeze([CLOUDBERRY_GAME_ID]),
        description: 'The game id, a constant `buildCloudberryPayload` (`cloudberryDemo/cloudberryRules.js`) stamps.',
    }),
    params: Object.freeze({
        type: 'object', required: true,
        description: `The Cloudberry page's region payload (\`${CLOUDBERRY_PAYLOAD_VERSION}\`): the RESOLVED generator `
            + 'request, the document hash the page refuses a mismatch of, the check coins and the AP-name → game-item '
            + 'map, plus the engine\'s back-portal route (`backExitSide`, `fallBehavior`). The page\'s `exits`, '
            + '`sidePortals` and `entrySide` are derived from the world at load (`deserializeWorld`) and never written.',
        schema: Object.freeze({
            required: Object.freeze(['payload', 'generate', 'docSha256', 'checks', 'items']),
            additionalProperties: false,
            properties: Object.freeze({
                payload: Object.freeze({ enum: Object.freeze([CLOUDBERRY_PAYLOAD_VERSION]) }),
                generate: Object.freeze({ type: 'object' }),
                docSha256: Object.freeze({ type: 'string' }),
                checks: Object.freeze({ type: 'object', additionalProperties: Object.freeze({ type: 'integer' }) }),
                items: Object.freeze({ type: 'object', additionalProperties: Object.freeze({ type: 'string' }) }),
                backExitSide: Object.freeze({ enum: Object.freeze(Object.keys(PAGE_SIDE)) }),
                fallBehavior: Object.freeze({ type: 'string' }),
            }),
        }),
    }),
    ap_locations: Object.freeze({
        ...FLASH_SIDECAR_FIELDS.ap_locations, required: true, derived: true,
        description: 'Check name (`coin<id>`) → AP location name `<region>__<check>`, derived by `buildCloudberryPayload`.',
    }),
    flashCapabilities: Object.freeze({
        ...FLASH_SIDECAR_FIELDS.flashCapabilities, required: true, derived: true,
        description: 'A constant `buildCloudberryPayload` stamps (`cooperative` locations, `pull` items, `auto` start).',
    }),
    gate_rules: Object.freeze({
        ...FLASH_SIDECAR_FIELDS.gate_rules, derived: true,
        description: 'Authored locks (foreign items, counts above 1) the bridge evaluates at run time, derived by '
            + '`emitCloudberryRules` (`cloudberryDemo/cloudberryRules.js`); portals keyed by the page\'s side name. '
            + 'OMITTED when nothing is authored.',
    }),
});

// ── Region-library hooks ──

const SIDES = Object.freeze(['N', 'E', 'S', 'W']);

/** Re-emit an entry's rules from its facts (the slots' items as carried). */
function emitFromEntry(entry, exitSides = entry.exit_sides) {
    const p = entry.payload ?? {};
    const items = Object.fromEntries((entry.carried_rules?.locations ?? []).map((l) => [l.id, l.item ?? null]));
    return emitCloudberryRules(p.facts, { checks: p.checks, items, exitSides });
}

/**
 * Capability-vs-payload revalidation (the region-library validator's entryCapabilityCheck):
 * the payload is a resolved request + hash + facts, and the carried rules are exactly
 * what the facts emit.
 */
export function validateCloudberryLibraryEntry(entry) {
    const errors = [];
    const p = entry?.payload ?? {};
    if (!p.generate || typeof p.generate !== 'object') errors.push('payload.generate missing');
    else if (p.generate.reroll !== undefined) errors.push('payload.generate is a reroll search, not the resolved request');
    if (!/^[0-9a-f]{64}$/.test(p.docSha256 ?? '')) errors.push('payload.docSha256 is not 64 hex');
    if (!Array.isArray(p.facts?.pieceItems)) errors.push('payload.facts.pieceItems missing');
    if (!Array.isArray(p.checks) || p.checks.length === 0) errors.push('payload.checks missing or empty');
    for (const s of entry?.exit_sides ?? []) if (!SIDES.includes(s)) errors.push(`exit side '${s}' is not a grid side`);
    if (errors.length) return { errors };
    const cr = entry.carried_rules;
    if (!cr || typeof cr !== 'object') return { errors: ['carried_rules must be present'] };
    if ((cr.locations?.length ?? 0) !== entry.location_slots) {
        errors.push(`location_slots ${entry.location_slots} != carried_rules.locations count ${cr.locations?.length ?? 0}`);
    }
    let emitted;
    try { emitted = emitFromEntry(entry); } catch (err) { return { errors: [`facts do not emit: ${err.message}`] }; }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!same(emitted.locations, cr.locations)) errors.push('carried_rules.locations differ from the rules the facts emit');
    if (!same(emitted.exitPaths, cr.exitPaths)) errors.push('carried_rules.exitPaths differ from the rules the facts emit');
    if (!same(emitted.obstacleDefs, cr.obstacleDefs)) errors.push('carried_rules.obstacleDefs differ from the rules the facts emit');
    return { errors };
}

/** Capture a live Cloudberry region descriptor into a library entry. */
export function captureCloudberryLibraryEntry(region, meta = {}) {
    const pp = region?.playable_payload ?? {};
    const lib = region?.cloudberry ?? null;
    if (!pp.params?.generate || !lib?.facts) {
        throw new Error('captureLibraryEntry(cloudberry): region lacks params.generate / the cloudberry facts');
    }
    const exit_sides = [...region.exits.values()].map((e) => e.side).filter((s) => SIDES.includes(s));
    const entry = {
        entry_id: meta.entry_id ?? region.region_id,
        ...(meta.name ? { name: meta.name } : {}),
        substrate: CLOUDBERRY_SUBSTRATE_ID,
        exit_sides,
        payload: {
            ...(lib.args ? { args: lib.args } : {}),
            generate: pp.params.generate,
            docSha256: pp.params.docSha256,
            facts: lib.facts,
            checks: lib.checks,
        },
        carried_rules: null,
        location_slots: lib.checks.length,
    };
    const items = Object.fromEntries((region.extracted_rules?.locations ?? []).map((l) => [l.id, l.item ?? null]));
    const { locations, exitPaths, obstacleDefs } = emitCloudberryRules(lib.facts, { checks: lib.checks, items, exitSides: exit_sides });
    entry.carried_rules = { locations, exitPaths, obstacleDefs };
    return entry;
}

/** Zone rules for an entry placed on `exitSides` (items: per slot, in slot order). */
function zoneRulesFor(entry, region_id, exitSides, slotItems) {
    const p = entry.payload;
    const items = Object.fromEntries(p.checks.map((c, k) => [c.name, slotItems[k] ?? null]));
    const { locations, exitPaths, obstacleDefs, gateRules } = emitCloudberryRules(p.facts, { checks: p.checks, items, exitSides });
    const payload = buildCloudberryPayload(region_id, { generate: p.generate, docSha256: p.docSha256, checks: p.checks, gateRules });
    return { locations, exitPaths, obstacleDefs, payload };
}

function requireSides(entry, exitSides, what) {
    const offered = new Set(entry.exit_sides ?? []);
    for (const s of exitSides) {
        if (!offered.has(s)) {
            throw new Error(`${what}(cloudberry): slot needs side '${s}' but entry '${entry.entry_id}' `
                + `only offers [${(entry.exit_sides ?? []).join(',')}]`);
        }
    }
}

/**
 * Spiral content-source hook: the entry on the slot's sides (⊆ its own — every exit
 * leaves by the end door, so any side set works), its carried items kept. Draws no rng.
 */
export function instantiateCloudberryLibraryEntry(entry, ctx = {}) {
    const region_id = ctx.region_id ?? entry.entry_id;
    const exitSides = ctx.exitSides ?? entry.exit_sides;
    requireSides(entry, exitSides, 'instantiateLibraryEntry');
    const slotItems = (entry.carried_rules?.locations ?? []).map((l) => l.item ?? null);
    const zoneRules = zoneRulesFor(entry, region_id, exitSides, slotItems);
    const region = assembleZoneRegion({
        substrate: CLOUDBERRY_SUBSTRATE_ID, region_id, regionSize: ctx.regionSize, exitSides, zoneRules, zonePayload: {},
    });
    // What `captureLibraryEntry` needs back (the payload alone cannot say which piece a
    // check is in): a descriptor-only field, never serialized into a sidecar.
    region.cloudberry = {
        ...(entry.payload.args ? { args: entry.payload.args } : {}),
        facts: entry.payload.facts, checks: entry.payload.checks,
    };
    return region;
}

/**
 * Sphere content-source hook (requirement-aware): the node's items onto the check
 * slots in order (engine filler on the surplus), and the end door's REAL requirement
 * as exit paths — the engine ANDs its own gate onto them (buildSphereLibraryRegion),
 * so the level's S_last is never dropped for the overlay. Draws no rng.
 */
export function instantiateCloudberryLibraryEntryForSpecs(entry, ctx = {}) {
    const region_id = ctx.region_id ?? entry.entry_id;
    const exitSides = ctx.exitSides ?? [];
    const locationSpecs = ctx.locationSpecs ?? [];
    requireSides(entry, exitSides, 'instantiateLibraryEntryForSpecs');
    const slots = entry.payload?.checks ?? [];
    if (locationSpecs.length > slots.length) {
        throw new Error(`instantiateLibraryEntryForSpecs(cloudberry): entry '${entry.entry_id}' has `
            + `${slots.length} check slot(s) but the node needs ${locationSpecs.length}`);
    }
    const slotItems = slots.map((_, k) => (k < locationSpecs.length ? locationSpecs[k].item : (ctx.fillerItem ?? null)));
    const { locations, exitPaths, obstacleDefs, payload } = zoneRulesFor(entry, region_id, exitSides, slotItems);
    return { locations, exitPaths, obstacleDefs, payload };
}

/**
 * Build the Cloudberry registry entry.
 */
export function createCloudberrySubstrateEntry({ id = CLOUDBERRY_SUBSTRATE_ID, label = 'Cloudberry Kingdom' } = {}) {
    const base = createFlashSubstrateEntry({
        id, label, iframeId: CLOUDBERRY_IFRAME_ID, sidecarFields: CLOUDBERRY_SIDECAR_FIELDS,
    });
    return Object.freeze({
        ...base,
        panelComponentType: CLOUDBERRY_PANEL_COMPONENT_TYPE,
        loadRegionEvent: CLOUDBERRY_LOAD_REGION_EVENT,
        iframeId: CLOUDBERRY_IFRAME_ID,

        // Exits are routed by side (the page's exit menu is a cross of the four sides);
        // the engine mints no tile for them.
        regionGeometry: REGION_GEOMETRY.SIDES,
        exitSides: flashZoneExitSides(),

        // Flash's exits-Map world + the page's own vocabulary (exits by page side,
        // side portals, entrySide), derived at load and stripped again on save.
        deserializeWorld(payload) {
            const world = base.deserializeWorld(payload);
            world.params = pageParamsForWorld(world);
            return world;
        },
        serializeWorld(world, ...rest) {
            const out = base.serializeWorld(world, ...rest);
            if (out.params) {
                const params = { ...out.params };
                for (const k of PAGE_DERIVED_PARAMS) delete params[k];
                out.params = params;
            }
            return out;
        },

        getPlaybackController: () => _playbackProxy,

        // Manual play + queued region moves and checks walked by the page's bot.
        // Record/playback and loop-mode summaries are P3.
        loopSupport: Object.freeze({
            queueActions: Object.freeze(['regionMove', 'locationCheck']),
            executeVia: 'solver',
            manual: true,
            customQueues: false,
        }),

        victoryItem: CLOUDBERRY_VICTORY_ITEM,

        captureLibraryEntry: captureCloudberryLibraryEntry,
        instantiateLibraryEntry: instantiateCloudberryLibraryEntry,
        instantiateLibraryEntryForSpecs: instantiateCloudberryLibraryEntryForSpecs,
        validateLibraryEntry: validateCloudberryLibraryEntry,

        libraryItems: CLOUDBERRY_LIBRARY_ITEMS,
        supportedFeatures: Object.freeze(['arbitrary_ap_locations', 'cloudberry_items']),
        gateableItems: GATEABLE_ITEMS,
        // Every exit leaves by the end door after S_last; the entrance side's way
        // back (the start door) is free.
        backPortalGated: () => false,
        hostsSurplusExitsNatively: () => true,

        // Generating a region is a page boot + a reroll search (seconds): heavy.
        generationCost: 'heavy',
    });
}

export const substrateRegistryEntry = createCloudberrySubstrateEntry();

if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
