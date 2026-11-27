/**
 * The mystery clue game as a procgen substrate (`mystery`): one region is one CASE, "the office".
 *
 * The case is content, not something this file generates: its questions are the region's
 * locations and its papers are items, with the access rules the case's own export wrote. A world
 * gets a mystery region by the top-down driver, which realises a source world's regions (the
 * case's own GENERATED world, or a world that holds its region beside others) and hands this
 * entry the region's locations by their SOURCE names. The source is a filled world (its
 * locations carry their items): top-down keeps placements, it does not make them. The entry answers with the region's
 * payload: what the page needs to play the case and what the host needs to translate.
 *
 * Which case is being realised is module state, installed with `applyPipelineConfig({caseDoc})`
 * before the run (`mysteryConfigFromSource` reads it off the source world). Nothing here names a
 * case: the document is the case's `slot_data.mystery` block as the game exports it
 * (`{story, version, case, goal, answers?, locations: {<location name>: <question id>},
 * items: {<item name>: <paper id>}}`).
 *
 * A region whose locations are not exactly the installed case's questions is refused by name
 * (`MYSTERY_SUBSTRATE_REFUSALS`): a maze room cannot be given to this substrate, and a case
 * cannot lose a question on the way.
 *
 * Node-importable (no DOM): the panel and the bridge are in the module's other files.
 */
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REQUIRED_ENVELOPE_FIELD, envelopeExitNames, nameMapValues } from '../procgenCore/sidecarFields.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { SIDE_AGNOSTIC_EXIT_SIDES } from '../procgenCore/exitSides.js';
import { GOAL_ITEM } from '../procgenCore/goalItem.js';

export const MYSTERY_SUBSTRATE_ID = 'mystery';
export const MYSTERY_PANEL_COMPONENT_TYPE = 'mysteryPanel';
export const MYSTERY_LOAD_REGION_EVENT = 'mystery:loadRegion';
export const MYSTERY_IFRAME_ID = 'mystery';

/**
 * What is locked while the player is NOT in the case's region (⚖ Robert 2026-11-25). It is the
 * WORLD's rule, written into the region's payload, never a client setting. The logic is the same
 * under all three: the questions are the region's checks either way.
 */
export const MYSTERY_LOCKS = Object.freeze({
    /**
     * Everything can be read anywhere; every player ACTION is locked away from the region: linking,
     * trust, and with them answering (⚖ Robert 2026-11-26: a link whose effect is held back would
     * confuse; in a case whose answers are marked from the evidence, linking IS answering).
     */
    ACTIONS: 'actions',
    /** As `actions`, and reading that is new (paragraphs, arrived papers) opens only in the region. */
    NEW_READING: 'new-reading',
    /** The game is shown only in the region. */
    EVERYTHING: 'everything',
});
export const DEFAULT_MYSTERY_LOCK = MYSTERY_LOCKS.ACTIONS;
const LOCK_VALUES = Object.freeze(Object.values(MYSTERY_LOCKS));

/** Every reason this entry refuses, by name. A test asserts the name, never a sentence. */
export const MYSTERY_SUBSTRATE_REFUSALS = Object.freeze({
    NO_CASE: 'mystery-no-case-installed',
    BAD_CASE: 'mystery-case-document-malformed',
    BAD_LOCK: 'mystery-lock-unknown',
    NOT_A_QUESTION: 'mystery-location-is-not-a-question-of-the-case',
    QUESTION_MISSING: 'mystery-question-of-the-case-has-no-location',
    BAD_PAYLOAD: 'mystery-payload-malformed',
    BAD_CASE_WORLD: 'mystery-case-world-malformed',
    NO_CASE_WORLD: 'mystery-no-case-world-installed',
    NO_SUCH_ZONE: 'mystery-has-one-case',
    TOO_MANY_ITEMS: 'mystery-more-items-than-spare-questions',
});

/** A refusal: an Error whose `reason` is one of the names above. */
function refuse(reason, detail) {
    const error = new Error(`${reason}${detail ? `: ${detail}` : ''}`);
    error.reason = reason;
    return error;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStringMap = (v) => isObject(v) && Object.values(v).every((x) => typeof x === 'string');

/** The case document, checked: the refusal's detail, or null when it is well formed. */
export function caseDocError(doc) {
    if (!isObject(doc)) return 'not an object';
    if (typeof doc.story !== 'string' || !doc.story) return '`story` is not a name';
    if (!isStringMap(doc.locations) || Object.keys(doc.locations).length === 0) return '`locations` is not a map of names';
    if (!isStringMap(doc.items)) return '`items` is not a map of names';
    const questions = Object.values(doc.locations);
    if (new Set(questions).size !== questions.length) return 'two locations name one question';
    return null;
}

/**
 * The mystery block of a source world, for `applyPipelineConfig`: `{caseDoc}` when the source's
 * player carries one, else `{}` (which installs no case).
 */
export function mysteryConfigFromSource(rulesJson, playerId = '1') {
    const block = rulesJson?.world?.[String(playerId)]?.slot_data?.mystery;
    return isObject(block) ? { caseDoc: block } : {};
}

/**
 * The same, with the case as a filled region (`caseWorld`), for a layout that places the office
 * whole: `{caseDoc, caseWorld}`, or `{}` when the source has no case or no placement to keep.
 */
export function mysteryPlacedConfigFromSource(rulesJson, playerId = '1') {
    const { caseDoc } = mysteryConfigFromSource(rulesJson, playerId);
    const caseWorld = caseDoc ? caseWorldOfSource(rulesJson, playerId, caseDoc) : null;
    return caseWorld ? { caseDoc, caseWorld } : {};
}

/**
 * The case as a FILLED region, for the layouts that place the office whole (the shuffled spiral):
 * each question's location with the source's own access rule and the item the source's fill put on
 * it, and the class of each of those items. Read off the source region whose locations are the
 * case's; null when the source has no such region, or one of its locations holds no item (a bare
 * export: nothing was placed, so there is no placement to keep).
 * `{locations: [{name, access_rule, item}], items: {<item name>: {classification}}}`
 */
export function caseWorldOfSource(rulesJson, playerId, caseDoc) {
    if (caseDocError(caseDoc)) return null;
    const p = String(playerId);
    const wanted = Object.keys(caseDoc.locations).sort().join('\u0000');
    const region = Object.values(rulesJson?.regions?.[p] ?? {})
        .find((r) => (r?.locations ?? []).map((l) => l?.name).sort().join('\u0000') === wanted);
    if (!region || region.locations.some((l) => typeof l?.item?.name !== 'string')) return null;
    const items = {};
    for (const l of region.locations) {
        const classification = rulesJson?.items?.[p]?.[l.item.name]?.classification;
        items[l.item.name] = { classification: typeof classification === 'string' ? classification : (l.item.advancement ? 'progression' : 'filler') };
    }
    return {
        locations: region.locations.map((l) => ({
            name: l.name,
            ...(l.access_rule !== undefined ? { access_rule: JSON.parse(JSON.stringify(l.access_rule)) } : {}),
            item: l.item.name,
        })),
        items,
    };
}

/** The filled case, checked against its document: the refusal's detail, or null when it is well formed. */
export function caseWorldError(caseWorld, caseDoc) {
    if (!isObject(caseWorld) || !Array.isArray(caseWorld.locations) || !isObject(caseWorld.items)) return 'not {locations, items}';
    const names = caseWorld.locations.map((l) => l?.name);
    if (names.slice().sort().join('\u0000') !== Object.keys(caseDoc?.locations ?? {}).sort().join('\u0000')) {
        return 'its locations are not the case\'s questions';
    }
    for (const l of caseWorld.locations) {
        if (typeof l.item !== 'string' || !isObject(caseWorld.items[l.item])) return `location "${l.name}" holds no known item`;
    }
    return null;
}

/**
 * Which regions of a source world ARE its case, for the top-down driver's `substrateByRegion`:
 * each region whose location names are exactly the case's. `{}` for a source with no case.
 * Found by the data, so a caller never names a region.
 */
export function mysteryRegionsOfSource(rulesJson, playerId = '1') {
    const { caseDoc } = mysteryConfigFromSource(rulesJson, playerId);
    if (!caseDoc || caseDocError(caseDoc)) return {};
    const wanted = Object.keys(caseDoc.locations).sort().join('\u0000');
    const out = {};
    for (const [name, region] of Object.entries(rulesJson?.regions?.[String(playerId)] ?? {})) {
        const have = (region?.locations ?? []).map((l) => l?.name).sort().join('\u0000');
        if (have === wanted) out[name] = MYSTERY_SUBSTRATE_ID;
    }
    return out;
}

// --- the installed config (module state, as every zone source's is) ---------------------------
/** ⛓ every key `applyPipelineConfig` reads (the registry's `pipelineConfigKeys`). */
export const MYSTERY_PIPELINE_CONFIG_KEYS = Object.freeze(['caseDoc', 'caseWorld', 'lock']);
let installed = { caseDoc: null, caseWorld: null, lock: DEFAULT_MYSTERY_LOCK };

function applyPipelineConfig(cfg = {}) {
    const caseDoc = cfg?.caseDoc ?? null;
    if (caseDoc !== null) {
        const error = caseDocError(caseDoc);
        if (error) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.BAD_CASE, error);
    }
    const lock = cfg?.lock ?? DEFAULT_MYSTERY_LOCK;
    if (!LOCK_VALUES.includes(lock)) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.BAD_LOCK, String(lock));
    const caseWorld = cfg?.caseWorld ?? null;
    if (caseWorld !== null) {
        if (caseDoc === null) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.BAD_CASE_WORLD, 'a filled case with no case document');
        const error = caseWorldError(caseWorld, caseDoc);
        if (error) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.BAD_CASE_WORLD, error);
    }
    const copy = (v) => (v === null ? null : JSON.parse(JSON.stringify(v)));
    installed = { caseDoc: copy(caseDoc), caseWorld: copy(caseWorld), lock };
}

/** What a document records of the installed config: the whole of it (the case block is small). */
function recordablePipelineConfig() {
    return {
        ...(installed.caseDoc ? { caseDoc: JSON.parse(JSON.stringify(installed.caseDoc)) } : {}),
        ...(installed.caseWorld ? { caseWorld: JSON.parse(JSON.stringify(installed.caseWorld)) } : {}),
        lock: installed.lock,
    };
}

/**
 * One region built to the driver's locations. Each location spec's `id` is a location NAME of
 * the installed case; the set must be the case's whole set. The region's rules are the source's
 * (top-down keeps them), so nothing is authored here.
 */
export function mysteryZoneForSpecs(config, zoneSpecs) {
    const caseDoc = config?.caseDoc;
    if (!caseDoc) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.NO_CASE, `region ${zoneSpecs?.region_id}`);
    const specs = zoneSpecs?.locationSpecs ?? [];
    const asked = new Set(specs.map((s) => s.id));
    for (const id of asked) {
        if (!Object.prototype.hasOwnProperty.call(caseDoc.locations, id)) {
            throw refuse(MYSTERY_SUBSTRATE_REFUSALS.NOT_A_QUESTION, `"${id}" in region ${zoneSpecs?.region_id} (case ${caseDoc.story})`);
        }
    }
    for (const name of Object.keys(caseDoc.locations)) {
        if (!asked.has(name)) {
            throw refuse(MYSTERY_SUBSTRATE_REFUSALS.QUESTION_MISSING, `"${name}" (${caseDoc.locations[name]}) in region ${zoneSpecs?.region_id}`);
        }
    }
    return {
        locations: specs.map((s) => ({ id: s.id, item: s.item ?? null, position: null })),
        payload: payloadOf(config, specs.map((s) => s.id)),
    };
}

/** The region's payload for the case of `config`, its questions under the location names given. */
function payloadOf(config, locationNames) {
    const { caseDoc } = config;
    return {
        story: caseDoc.story,
        ...(typeof caseDoc.version === 'string' ? { version: caseDoc.version } : {}),
        case: typeof caseDoc.case === 'string' && caseDoc.case ? caseDoc.case : `cases/${caseDoc.story}`,
        ...(caseDoc.goal !== undefined ? { goal: caseDoc.goal } : {}),
        ...(caseDoc.answers !== undefined ? { answers: caseDoc.answers } : {}),
        lock: config.lock ?? DEFAULT_MYSTERY_LOCK,
        // question id → AP location name. The value is the source's own name, which the driver
        // keeps as the compiled name, so the engine's reconciliation leaves it as it is.
        ap_locations: Object.fromEntries(locationNames.map((name) => [caseDoc.locations[name], name])),
        // AP item name → paper id: which of the world's items are this case's papers.
        papers: { ...caseDoc.items },
    };
}

// --- the office placed whole (the shuffled spiral's content-source channel) --------------------
const isFiller = (caseWorld, itemName) => caseWorld.items[itemName]?.classification === 'filler';
/** The case's own filler item (what a spare question gives), or null when it has none. */
export function mysteryFillerItem(config) {
    const world = config?.caseWorld;
    return world ? (world.locations.map((l) => l.item).find((item) => isFiller(world, item)) ?? null) : null;
}
/** How many of the world's items the office can hold: its spare questions (the ones that give its filler). */
export function mysterySpareQuestions(config) {
    const world = config?.caseWorld;
    return world ? world.locations.filter((l) => isFiller(world, l.item)).length : 0;
}

/**
 * The office as ONE self-contained region (⚖ Robert 2026-11-27: papers stay inside the office).
 * Every question keeps the source's access rule and the item the source's fill gave it, so the
 * case's papers stand on its own questions in an order its rules allow, and nothing outside the
 * office matters to it. The world's dealt items (`ctx.itemsToPlace`) take the spare questions, in
 * the case's order. The goal: dealt here it stands where the case's own goal stood; when the
 * engine places the goal elsewhere (`ctx.goalOwned`) the case's own becomes its filler.
 */
export function mysteryZoneRules(config, zoneIdx, ctx = {}) {
    if (!config?.caseDoc || !config.caseWorld) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.NO_CASE_WORLD, `region ${ctx.region_id}`);
    if (zoneIdx !== 0) throw refuse(MYSTERY_SUBSTRATE_REFUSALS.NO_SUCH_ZONE, `zone ${zoneIdx}`);
    const world = config.caseWorld;
    const filler = mysteryFillerItem(config);
    const dealt = [...(ctx.itemsToPlace ?? [])];
    const goalDealt = dealt.includes(GOAL_ITEM);
    const others = dealt.filter((item) => item !== GOAL_ITEM);
    const goalAt = world.locations.findIndex((l) => l.item === GOAL_ITEM);
    // The goal dealt to an office with no goal of its own takes a spare question like any item.
    if (goalDealt && goalAt < 0) others.push(GOAL_ITEM);
    const spare = world.locations.map((l, i) => (isFiller(world, l.item) ? i : -1)).filter((i) => i >= 0);
    if (others.length > spare.length) {
        throw refuse(MYSTERY_SUBSTRATE_REFUSALS.TOO_MANY_ITEMS, `${others.length} dealt, ${spare.length} spare in region ${ctx.region_id}`);
    }
    const itemAt = world.locations.map((l) => l.item);
    others.forEach((item, k) => { itemAt[spare[k]] = item; });
    if (goalAt >= 0 && !goalDealt && ctx.goalOwned && filler) itemAt[goalAt] = filler;
    return {
        locations: world.locations.map((l, i) => ({
            id: l.name,
            global_name: l.name,
            item: itemAt[i],
            position: null,
            ...(l.access_rule !== undefined ? { access_rule: JSON.parse(JSON.stringify(l.access_rule)) } : {}),
        })),
        payload: payloadOf(config, world.locations.map((l) => l.name)),
    };
}

/** The item-library rows of the installed case's own items (papers, its filler, its goal). */
function libraryItemsOf(config) {
    const out = {};
    for (const [name, row] of Object.entries(config?.caseWorld?.items ?? {})) {
        out[name] = { classification: row.classification, ...(name === GOAL_ITEM ? { is_victory: true } : {}) };
    }
    return out;
}

/**
 * procgenPlayer passes the sidecar's `playable_payload`. Exits become a Map keyed by exit name
 * (`procgenPlayer.handleRegionMove` calls `world.exits.has(exitName)`). Throws on a payload that
 * is no case, and the warehouse then skips the region (`procgenCore/deserializeRefusal.js`).
 */
function deserializeWorld(payload) {
    const p = payload ?? {};
    if (typeof p.story !== 'string' || !isStringMap(p.ap_locations) || !isStringMap(p.papers)) {
        throw refuse(MYSTERY_SUBSTRATE_REFUSALS.BAD_PAYLOAD, 'story, ap_locations or papers');
    }
    const exits = new Map();
    for (const e of Array.isArray(p.exits) ? p.exits : []) {
        const key = e?.exitName ?? e?.exit_id;
        if (key) exits.set(key, e);
    }
    return { ...p, exits };
}

/** Inverse for write-to-disk: exits back to an array. */
function serializeWorld(world) {
    const w = { ...(world ?? {}) };
    const exits = w.exits instanceof Map ? [...w.exits.values()] : (Array.isArray(w.exits) ? w.exits : []);
    return { ...w, exits };
}

const WRITER = '`mysteryZoneForSpecs` (`mysterySubstrateLibrary.js`), from the installed case document';
const NAME_MAP = Object.freeze({ additionalProperties: Object.freeze({ type: 'string' }) });

/** The payload, declared (the registry's `sidecarFields` slot; vocabulary in `procgenCore/sidecarFields.js`). */
export const MYSTERY_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    story: Object.freeze({
        type: 'string', required: true, derived: true,
        description: `The case's story id, by ${WRITER}. The page is asked for this story and refuses another.`,
    }),
    version: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `The version of the case the region was made from (absent when the case names none), by ${WRITER}. `
            + 'The page refuses a region of another version of its case.',
    }),
    case: Object.freeze({
        type: 'string', required: true, derived: true,
        description: `The case's directory as the page's \`?case=\` wants it, by ${WRITER} (\`cases/<story>\` when the case names none).`,
    }),
    goal: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `The question id that closes the case, by ${WRITER}. Its check is an ordinary check.`,
    }),
    answers: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `How the case's questions are answered, as the case's export says it (\`evidence\`), by ${WRITER}.`,
    }),
    lock: Object.freeze({
        type: 'string', required: true, derived: true, enum: LOCK_VALUES,
        description: 'What is locked while the player is not in this region: `actions` (every player action: linking, trust, answering; reading stays), `new-reading` '
            + '(the actions and reading that is new) or `everything` (the game is shown only here). The world\'s rule, from the '
            + `installed config, by ${WRITER}.`,
    }),
    ap_locations: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `Each question id → its AP location name, by ${WRITER}. The host turns the page's solved question into a `
            + 'check through it; a question with no entry sends nothing.',
        schema: NAME_MAP,
    }),
    papers: Object.freeze({
        type: 'object', required: true, derived: true,
        description: `Each AP item name that is one of this case's papers → its paper id, by ${WRITER}. An item of the world that `
            + 'is not a key here is not a paper of this case (another case\'s, or another substrate\'s).',
        schema: NAME_MAP,
    }),
});

// The Playback Bot's controller, installed by the panel module (index.js); null headless.
let _playbackController = null;
/** @param {Object|null} controller - see `mysteryPlaybackController.js` */
export function setPlaybackController(controller) { _playbackController = controller ?? null; }

export const substrateRegistryEntry = Object.freeze({
    id: MYSTERY_SUBSTRATE_ID,
    label: 'Mystery case',
    panelComponentType: MYSTERY_PANEL_COMPONENT_TYPE,
    loadRegionEvent: MYSTERY_LOAD_REGION_EVENT,
    // procgenPlayer re-publishes the active region's load event when this iframe announces appReady.
    iframeId: MYSTERY_IFRAME_ID,
    supportedFeatures: Object.freeze(['arbitrary_ap_locations']),
    deserializeWorld,
    serializeWorld,
    sidecarFields: MYSTERY_SIDECAR_FIELDS,
    apLocationNamesOf: nameMapValues('ap_locations'),
    apExitNamesOf: envelopeExitNames,
    // An exit is a way out of the office and nothing more; nothing in the payload is keyed by a side.
    regionGeometry: REGION_GEOMETRY.SIDES,
    exitSides: SIDE_AGNOSTIC_EXIT_SIDES,

    // The Bot drives the page (`mysteryPlaybackController.js`, ⚖ Robert 2026-11-27): a question's location asks
    // the page's careful reader for that question, in one burst under Instant; an exit is taken through the host.
    getPlaybackController: () => _playbackController,

    // Loop mode: a COARSE substrate (no recorder, no summary). Its queue entries are the recording: a move, and a
    // check per question, each priced by `loop_costs` and run by the generic executor. `record` + `playback` arm the
    // strict action gate, so in loop mode a question is answered only while the queue is parked on the office.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck']),
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        instant: true,
        // A Bot block hands each queued move and check to the controller's `perform`, which asks the page for the
        // question in one burst (a block is paid for in mana, not time), so the Bot has nothing for Instant to skip.
        executeVia: 'solver',
        botActsAtOnce: true,
    }),

    // Top-down, for the region a caller names: the installed case. `ownContentOnly`: no driver or
    // editor offers this entry as a target for a planned region (`substratePredicates.js`), since
    // any region that is not the case is refused.
    ownContentOnly: true,
    generateZoneForSpecs: (zoneSpecs) => mysteryZoneForSpecs(installed, zoneSpecs),

    // The shuffled spiral: the installed case placed whole, as one content cell (`mysteryZoneRules`). These read
    // the installed config, so with no filled case installed the entry brings no zone, no item and no goal.
    get zoneCount() { return installed.caseWorld ? 1 : 0; },
    extractZoneRules: (zoneIdx, ctx) => mysteryZoneRules(installed, zoneIdx, ctx),
    spiralItemCapacity: () => mysterySpareQuestions(installed),
    get fillerItem() { return mysteryFillerItem(installed) ?? undefined; },
    get libraryItems() { return libraryItemsOf(installed); },
    get victoryItem() { return installed.caseWorld?.items?.[GOAL_ITEM] ? GOAL_ITEM : undefined; },
    applyPipelineConfig,
    pipelineConfigKeys: MYSTERY_PIPELINE_CONFIG_KEYS,
    recordablePipelineConfig,
});

// Side-effect on import: register, so headless scripts and the pipeline resolve the substrate without the
// panel module (idempotent: index.js's register() guards too).
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
