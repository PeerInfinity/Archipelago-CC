/**
 * procgenCore/substrateCapabilities — **WHAT A PERSON CAN DO WITH EACH
 * SUBSTRATE, IN THEIR WORDS** (substrate chart S1; plan
 * `substrate-chart-plan.md` §1, ⚖ the user 2026-09-27).
 *
 * The developer matrix (`substrate-registry.md` § *Capability matrix*) has one
 * row per FIELD, in the code's words. This module is the other vocabulary: one
 * STATEMENT per question a person asks about a substrate, each answered by a
 * predicate over the entry's declared fields. The statements are registry-WIDE
 * — keyed by the fields they read, never by a substrate — so a new substrate
 * gets a column without an edit here, and no entry carries a "user-facing"
 * block of its own.
 *
 * ⚖ **A CHECKMARK MEANS A FEATURE, NEVER A LIMITATION** (the user,
 * 2026-09-27). Every statement is phrased so that *yes* is something the
 * substrate CAN do; a restriction is inverted (L8, G3, G7) and its detail rides
 * on the *no* cell's text, read off the declaration. A statement may declare
 * `requires: '<id>'`: where the prerequisite answers *no*, the cell reads
 * **n/a** rather than a vacuous ✓; a statement's own answer may also be n/a
 * where the question has no answer for that substrate (G2, L7, G8).
 *
 * ⛓ The predicates are the app's own where the app has one
 * (`substratePredicates.js`, `startingInventory.js`, `exitSides.js`), so a chart
 * cell and the control it describes are answered by ONE function.
 *
 * ⛔ BROWSER-SAFE AND NAMELESS: no `node:` import, no registry import, no panel,
 * no event, and no registered substrate id anywhere in this file (asserted by
 * `substrateCapabilities.test.js`, which reads this file's source). The generator
 * (`scripts/procgen/reference/capabilities.mjs`) and the live panel both pass
 * the entries in.
 */

import { cellOf, digTwo } from '../procgenDocs/registryShape.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    CAPTURE_SHAPES, GENERATION_COST, REALISER_KINDS, SOLVER_KINDS,
    botHonorsInstant, captureShapeOf, generationCostOf, regionRealiserKind, solverKindOf,
} from './substratePredicates.js';
import { declaredStartingNeeds } from './startingInventory.js';
import { LOCATION_CAPACITY_KINDS, locationCapacityKind, locationCeiling } from './locationCapacity.js';
import { SIDE_SHARING, sideMayHoldAnotherExit } from './exitSides.js';
import { CONCEPTS, conceptsRealisedBy } from './concepts.js';

/** ⛓ The four groups, in reading order. */
export const CAPABILITY_GROUPS = Object.freeze([
    Object.freeze({ id: 'play', label: 'Play' }),
    Object.freeze({ id: 'loop', label: 'Loop mode' }),
    Object.freeze({ id: 'generate', label: 'Generate' }),
    Object.freeze({ id: 'edit', label: 'Edit' }),
]);

/** ⛓ What a cell can say. */
export const CELL_KINDS = Object.freeze({ YES: 'yes', NO: 'no', PARTIAL: 'partial', NA: 'na' });

/**
 * ⛓ THE MARK EACH KIND PRINTS, keyed by the `CELL_KINDS` values — ONE rendering
 * rule for both renderers (the generated page's `capabilitiesMarkdown` and the
 * Substrate Registry panel's Plain mode). A partial is ◐ followed by its degree.
 */
export const CELL_MARKS = Object.freeze({
    [CELL_KINDS.YES]: '✓', [CELL_KINDS.NO]: '✗', [CELL_KINDS.PARTIAL]: '◐', [CELL_KINDS.NA]: 'n/a',
});

/**
 * ⛓ THE LIVE ANSWERS a statement may declare (`live: LIVE_ANSWERS.x`) where its
 * headless answer is a stand-in for what only a running app can say. The values
 * ARE keys of the Substrate Registry panel's `vm.answers[id]`
 * (`substrateRegistryPanelLibrary.js` `describeRegistry`), so the panel overlays
 * a cell by `answers[entry.id][statement.live]` — by declaration, never by
 * statement id. The generated page has no running app and prints the stand-in.
 * (P2 declared `playbackController` until substrate chart S3: every declared
 * controller answered *mounted* in every layout measured, so the overlay said
 * what the ✓ already said — ⚖ the user, 2026-09-28, plan §6′.1 item 7.)
 */
export const LIVE_ANSWERS = Object.freeze({ itemTypes: 'itemTypes' });

/** ⛓ How many item-type names a cell shows before `…`; the full list rides on the cell's `list`. */
export const LIST_PREVIEW = 3;

/** ⛓ The feature id of an item-locked gate — the shared obstacle library's own. */
export const LOGIC_GATE_FEATURE = DEFAULT_OBSTACLES.logic_gate.feature;

/**
 * ⛓ The `supportedFeatures` ids in words (P5). A missing id renders as the id
 * itself — `featureWords` — and the vitest names it as a warning, so a new
 * feature id cannot red CI by existing. An id that is an ITEM TAG
 * (`itemTagFeatures`) never reaches P5 — P4 names its items instead.
 */
export const FEATURE_WORDING = Object.freeze({
    [LOGIC_GATE_FEATURE]: 'item-locked gates',
    colored_doors_and_keys: 'coloured keys and doors',
    nesw_exits: 'exits on the four sides',
    region_topology_from_source: 'its own map becomes the region graph',
    arbitrary_ap_locations: 'locations placed anywhere',
    arbitrary_location_rules: 'any rule on a location',
    arbitrary_exit_rules: 'any rule on an exit',
});

/** ⛓ The loops queue action types in words (L2); a missing one renders as itself. */
export const QUEUE_ACTION_WORDING = Object.freeze({
    regionMove: 'moves between regions',
    locationCheck: 'location checks',
    explore: 'exploring',
});

/** ⛓ The capture shapes in words (L4) — how a replay of a recorded visit works. */
export const CAPTURE_SHAPE_WORDING = Object.freeze({
    [CAPTURE_SHAPES.SUMMARY]: 'applies the result instantly',
    [CAPTURE_SHAPES.FINE]: 'replays your exact moves',
    [CAPTURE_SHAPES.COARSE]: 're-runs the queued actions',
});

/** ⛓ The Bot-block solvers in words (L6). */
export const SOLVER_WORDING = Object.freeze({
    [SOLVER_KINDS.WALK_TO]: "the game's own automation walks it",
    [SOLVER_KINDS.DELEGATION]: 'the substrate walks it itself',
});

/** ⛓ The realiser kinds in words (G1). */
export const REALISER_WORDING = Object.freeze({
    [REALISER_KINDS.PROCEDURAL]: 'grown to order',
    [REALISER_KINDS.ZONE]: 'picked from its own levels to fit the plan',
});

/** ⛓ The `roomEditor.kind` values in words (E1); a missing kind renders as itself. */
export const ROOM_EDITOR_WORDING = Object.freeze({
    panel: 'in a panel',
    lab: 'on a lab page',
});

/** ⛓ The words a `no` or a degree cell uses that are the STATEMENT's, not an entry's. */
export const CELL_WORDING = Object.freeze({
    instantAlways: 'always — a replay is already instant',
    instantToggle: 'a per-block toggle',
    itemCount: (n) => `${n} item${n === 1 ? '' : 's'}`,
    itemTypes: (n) => `${n} item type${n === 1 ? '' : 's'}`,
    itemTypesPreview: (types) => `${CELL_WORDING.itemTypes(types.length)}${types.length
        ? `: ${types.slice(0, LIST_PREVIEW).join(', ')}${types.length > LIST_PREVIEW ? ', …' : ''}` : ''}`,
    itemTypesLive: 'its list comes from the running game — see the Substrate Registry panel',
    concepts: (n) => `${n} concept${n === 1 ? '' : 's'}`,
    conceptTier: (concept, tier) => `${concept} (${tier})`,
    conceptsPreview: (names) => `${CELL_WORDING.concepts(names.length)}: ${names.slice(0, LIST_PREVIEW).join(', ')}${
        names.length > LIST_PREVIEW ? ', …' : ''}`,
    loopModeOnly: (field) => `loop mode stays on — it declares \`${field}\``,
    realiserNone: 'only as content from its own game',
    generationCost: (cost) => `its generation cost is declared \`${cost}\``,
    startingNeed: (anyOf, reason) => `a world starts with one of ${anyOf.join(' / ')} — ${reason}`,
    onePerSide: 'one exit per side',
    sideSharing: 'and a side can hold more than one',
    malformedSides: (m) => `its exit-side declaration is malformed: ${m}`,
    capacityTiles: 'a room holds `capacityAt(size)` of them — the room grows to hold more',
    capacityCeiling: (c) => `a room holds \`capacityAt(size)\` of them — the room grows to hold more, up to `
        + `${c.locations}${c.why ? ` (${c.why})` : ''}, which no size lifts`,
});

/** ⛓ G9 — the room G8 asks a `tiles` declaration about its ceiling: the pipeline's default size, nothing in it. */
const CEILING_PROBE_SIZE = Object.freeze({ width: 8, height: 6 });
const CEILING_PROBE_DEMAND = Object.freeze({ locations: 0, gated: 0, exits: 0, listed: 0 });

/** ⛓ How many item names P4 lists before it gives the count alone. */
export const ITEM_NAME_LIMIT = 8;

/** ⛓ The field whose `true` keeps loop mode on (L8). */
export const REQUIRES_LOOP_MODE_FIELD = 'loopSupport.requiresLoopMode';

/** ⛓ A `supportedFeatures` id in words, or the id itself. */
export const featureWords = (id) => FEATURE_WORDING[id] ?? id;

const isFn = (v) => typeof v === 'function';

/**
 * ⛓ **AN ENTRY'S PROGRESSION ITEMS** (P4) — its own `libraryItems` (the name is
 * the value's `name`, else its key) and then every shared library item whose
 * `feature` the entry lists in `supportedFeatures` (so a substrate that supports
 * the coloured keys gets the shared keys). `{name, feature}` each, own first.
 */
export function progressionItemsOf(entry, sharedItems = DEFAULT_ITEMS) {
    const features = Array.isArray(entry?.supportedFeatures) ? entry.supportedFeatures : [];
    const own = Object.entries(entry?.libraryItems ?? {})
        .map(([key, item]) => ({ name: item?.name ?? key, feature: item?.feature ?? null }));
    const shared = Object.values(sharedItems ?? {})
        .filter((item) => features.includes(item.feature))
        .map((item) => ({ name: item.name ?? item.id, feature: item.feature }));
    return [...own, ...shared];
}

/**
 * ⛓ **THE ITEM TAGS, DERIVED** — the feature ids carried by ≥1 of the entry's
 * progression items (`progressionItemsOf`), in first-seen order. These are the
 * `supportedFeatures` ids P5 leaves out: the items themselves say which ids are
 * tags, so no list of tag ids is kept here.
 */
export function itemTagFeatures(entry, sharedItems = DEFAULT_ITEMS) {
    return [...new Set(progressionItemsOf(entry, sharedItems).map((i) => i.feature).filter(Boolean))];
}
const cell = (kind, text = null) => ({ kind, text });
/** ⛓ An item-type list as a cell: the count and the first `LIST_PREVIEW` names, the whole list as `list`. */
const itemTypesCell = (types) => ({ ...cell(CELL_KINDS.YES, CELL_WORDING.itemTypesPreview(types)), list: types });
const yesNo = (b, noText = null) => (b ? cell(CELL_KINDS.YES) : cell(CELL_KINDS.NO, noText));
/**
 * ⛓ P6 — the concepts an entry realises (`concepts.conceptsRealisedBy`, in its
 * declared order) as `name (tier)`: the count and the first `LIST_PREVIEW`, the
 * whole list as `list` (the `itemTypesCell` idiom). ✗ where it realises none.
 */
const conceptsCell = (e) => {
    const names = conceptsRealisedBy(e, CONCEPTS).map((r) => CELL_WORDING.conceptTier(r.concept, r.tier));
    if (!names.length) return cell(CELL_KINDS.NO);
    return { ...cell(CELL_KINDS.YES, CELL_WORDING.conceptsPreview(names)), list: names };
};

/**
 * ⛓⛓ **THE STATEMENTS** — one per row of plan §1, in group then row order.
 * `answer(entry)` → `{kind, text}`; `capabilityRows` adds `why` (the value of
 * every field in `fields`, shaped by `registryShape.cellOf`) and applies
 * `requires`. ⚖ The sentences are the user's (approved 2026-09-27).
 */
export const CAPABILITY_STATEMENTS = Object.freeze([
    {
        id: 'P1', group: 'play', universal: true,
        statement: 'You can play its regions by hand',
        fields: ['panelComponentType', 'deserializeWorld'],
        answer: (e) => yesNo(typeof e.panelComponentType === 'string' && isFn(e.deserializeWorld)),
    },
    {
        id: 'P2', group: 'play',
        statement: "The Playback Bot can walk it (replaying a world's solution)",
        fields: ['getPlaybackController', 'playbackScope'],
        /* ⛓ SEEDLING JS J2: a controller that walks only under a condition
         * declares the condition (`playbackScope`), and the cell is ◐ with it
         * as the degree — the generated Seedling rooms walk only on the JS runtime. */
        answer: (e) => {
            if (!isFn(e.getPlaybackController)) return cell(CELL_KINDS.NO);
            return typeof e.playbackScope === 'string' && e.playbackScope
                ? cell(CELL_KINDS.PARTIAL, e.playbackScope) : cell(CELL_KINDS.YES);
        },
    },
    {
        id: 'P3', group: 'play',
        statement: 'It draws its own picture on the composite map (else a labelled box)',
        fields: ['compositeMap.drawRegion'],
        answer: (e) => yesNo(isFn(e.compositeMap?.drawRegion)),
    },
    {
        id: 'P4', group: 'play',
        statement: 'It brings progression items of its own',
        fields: ['libraryItems', 'supportedFeatures'],
        answer: (e) => {
            const names = progressionItemsOf(e).map((i) => i.name);
            if (!names.length) return cell(CELL_KINDS.NO);
            return cell(CELL_KINDS.YES, names.length <= ITEM_NAME_LIMIT
                ? names.join(', ') : CELL_WORDING.itemCount(names.length));
        },
    },
    {
        id: 'P5', group: 'play', universal: true,
        statement: 'What the generator may do with it',
        fields: ['supportedFeatures'],
        answer: (e) => {
            const tags = new Set(itemTagFeatures(e));
            const words = (e.supportedFeatures ?? []).filter((id) => !tags.has(id)).map(featureWords);
            return words.length ? cell(CELL_KINDS.YES, words.join(', ')) : cell(CELL_KINDS.NO);
        },
    },
    {
        /* ⛓ CONCEPT LIBRARY T0b (⚖ the user, 2026-09-29): the sentence is the
         * user's. A ✓ is the FEATURE — the library's concepts, each at the tier
         * the entry realises it (`mechanic` enforces it, `skin` shows it). */
        id: 'P6', group: 'play',
        statement: "It can show the library's concepts in its own way",
        fields: ['conceptRealisations'],
        answer: conceptsCell,
    },
    {
        id: 'L1', group: 'loop', universal: true,
        statement: 'You can play it in loop mode',
        fields: ['loopSupport.manual'],
        answer: (e) => yesNo(e.loopSupport?.manual === true),
    },
    {
        id: 'L2', group: 'loop', universal: true,
        statement: 'What you can queue for it',
        fields: ['loopSupport.queueActions'],
        answer: (e) => {
            const acts = e.loopSupport?.queueActions ?? [];
            return acts.length
                ? cell(CELL_KINDS.YES, acts.map((a) => QUEUE_ACTION_WORDING[a] ?? a).join(', '))
                : cell(CELL_KINDS.NO);
        },
    },
    {
        id: 'L3', group: 'loop',
        statement: 'You can record a visit and replay it',
        fields: ['loopSupport.record', 'loopSupport.playback'],
        answer: (e) => yesNo(e.loopSupport?.record === true && e.loopSupport?.playback === true),
    },
    {
        id: 'L4', group: 'loop', universal: true, requires: 'L3',
        statement: 'How a replay works',
        fields: ['takeLastRecording', 'loopSupport.summaryRecording'],
        answer: (e) => cell(CELL_KINDS.YES, CAPTURE_SHAPE_WORDING[captureShapeOf(e)]),
    },
    {
        id: 'L5', group: 'loop',
        statement: 'Instant fast-forward',
        fields: ['loopSupport.instant', 'loopSupport.summaryRecording'],
        answer: (e) => {
            if (!e.loopSupport?.instant) return cell(CELL_KINDS.NO);
            return cell(CELL_KINDS.YES, captureShapeOf(e) === CAPTURE_SHAPES.SUMMARY
                ? CELL_WORDING.instantAlways : CELL_WORDING.instantToggle);
        },
    },
    {
        id: 'L6', group: 'loop',
        statement: 'A Bot block can play it for you',
        fields: ['loopSupport.executeVia', 'sharing.mana.loopActionDelegation'],
        answer: (e) => {
            const kind = solverKindOf(e);
            return kind ? cell(CELL_KINDS.YES, SOLVER_WORDING[kind] ?? kind) : cell(CELL_KINDS.NO);
        },
    },
    {
        id: 'L7', group: 'loop', requires: 'L6',
        statement: 'The Bot honours Instant',
        fields: ['loopSupport.instant', 'loopSupport.executeVia', 'takeLastRecording', 'loopSupport.summaryRecording'],
        /* ⛓ n/a where a replay is a summary: its Instant is *always* (L5
         * says so), so there is no toggle for the Bot to honour. */
        answer: (e) => (captureShapeOf(e) === CAPTURE_SHAPES.SUMMARY
            ? cell(CELL_KINDS.NA) : yesNo(botHonorsInstant(e))),
    },
    {
        id: 'L8', group: 'loop',
        statement: 'You can play it outside loop mode',
        fields: [REQUIRES_LOOP_MODE_FIELD],
        answer: (e) => yesNo(!digTwo(e, REQUIRES_LOOP_MODE_FIELD), CELL_WORDING.loopModeOnly(REQUIRES_LOOP_MODE_FIELD)),
    },
    {
        id: 'L9', group: 'loop',
        statement: 'It shares the loop-mode mana pool',
        fields: ['sharing.mana'],
        answer: (e) => yesNo(!!e.sharing?.mana && typeof e.sharing.mana === 'object'),
    },
    {
        id: 'L10', group: 'loop', live: LIVE_ANSWERS.itemTypes,
        statement: 'It shares consumable items with other substrates',
        fields: ['sharing.items'],
        answer: (e) => {
            const items = e.sharing?.items;
            if (!items || typeof items !== 'object') return cell(CELL_KINDS.NO);
            if (Array.isArray(items.types)) return itemTypesCell(items.types.map(String));
            return cell(CELL_KINDS.YES, CELL_WORDING.itemTypesLive);
        },
    },
    {
        id: 'L11', group: 'loop',
        statement: "Recorded actions are named in the game's own words",
        fields: ['describeAction'],
        answer: (e) => yesNo(isFn(e.describeAction)),
    },
    {
        id: 'G1', group: 'generate',
        statement: 'The pipeline can build regions of it',
        fields: ['generateRegionCore', 'generateZoneForSpecs', 'generateZoneForSpecsGen'],
        answer: (e) => {
            const kind = regionRealiserKind(e);
            return kind ? cell(CELL_KINDS.YES, REALISER_WORDING[kind] ?? kind)
                : cell(CELL_KINDS.NO, CELL_WORDING.realiserNone);
        },
    },
    {
        id: 'G2', group: 'generate',
        statement: 'How many ready-made rooms / levels it brings',
        fields: ['zoneCount', 'zoneSourceLabel', 'generateRegionCore'],
        /* ⛓ n/a where the pipeline grows its rooms to order (G1): there is no
         * ready-made set to count. ✗ only where nothing is declared. */
        answer: (e) => {
            if (regionRealiserKind(e) === REALISER_KINDS.PROCEDURAL) return cell(CELL_KINDS.NA);
            const n = e.zoneCount;
            if (typeof n !== 'number' || n <= 0) return cell(CELL_KINDS.NO);
            const noun = typeof e.zoneSourceLabel === 'string' ? ` ${e.zoneSourceLabel}${n === 1 ? '' : 's'}` : '';
            return cell(CELL_KINDS.YES, `${n}${noun}`);
        },
    },
    {
        id: 'G3', group: 'generate', requires: 'G1',
        statement: 'Generates quickly',
        fields: ['generationCost'],
        answer: (e) => {
            let cost;
            try {
                cost = generationCostOf(e);
            } catch (err) {
                return cell(CELL_KINDS.NO, err.message);
            }
            return yesNo(cost !== GENERATION_COST.HEAVY, CELL_WORDING.generationCost(cost));
        },
    },
    {
        id: 'G4', group: 'generate',
        statement: 'Its rooms can be captured into a library and reused',
        fields: ['captureLibraryEntry', 'instantiateLibraryEntry'],
        answer: (e) => yesNo(isFn(e.captureLibraryEntry) && isFn(e.instantiateLibraryEntry)),
    },
    {
        id: 'G5', group: 'generate',
        statement: 'Exits can be locked behind items',
        fields: ['canHostExitGates', 'supportedFeatures'],
        answer: (e) => yesNo(isFn(e.canHostExitGates)
            || (Array.isArray(e.supportedFeatures) && e.supportedFeatures.includes(LOGIC_GATE_FEATURE))),
    },
    {
        id: 'G6', group: 'generate',
        statement: 'It has its own settings in the generation form',
        fields: ['renderProcgenParams'],
        answer: (e) => yesNo(isFn(e.renderProcgenParams)),
    },
    {
        id: 'G7', group: 'generate',
        statement: 'A world of it can start with an empty inventory',
        fields: ['startingInventory'],
        answer: (e) => {
            const needs = declaredStartingNeeds(e);
            if (!needs.length) return cell(CELL_KINDS.YES);
            return cell(CELL_KINDS.NO, needs.map((n) => CELL_WORDING.startingNeed(n.anyOf, n.reason)).join('; '));
        },
    },
    {
        id: 'G8', group: 'generate',
        statement: 'Any number of locations fits in one room',
        fields: ['locationCapacity'],
        /* ⛓ APWORLD SUBSTRATE CHANGE H1 (⚖ the user, 2026-09-29 — the wording
         * C2 proposed, plan §45 ⚖ #1). The declaration's kind answers
         * (`locationCapacity.js`): unbounded ✓; tiles ✗, naming its
         * `capacityAt` and that the room grows; n/a where the substrate declares
         * no capacity — the question has no answer there, not a "no". */
        answer: (e) => {
            const kind = locationCapacityKind(e);
            if (kind === LOCATION_CAPACITY_KINDS.UNBOUNDED) return cell(CELL_KINDS.YES);
            if (kind !== LOCATION_CAPACITY_KINDS.TILES) return cell(CELL_KINDS.NA);
            /* ⛓ G9 — a declared CEILING (a budget no size lifts) is named, asked at
             * the probe room: the default size, no params, an empty demand. */
            const ceiling = locationCeiling(e, CEILING_PROBE_SIZE, {}, CEILING_PROBE_DEMAND);
            return cell(CELL_KINDS.NO, ceiling ? CELL_WORDING.capacityCeiling(ceiling) : CELL_WORDING.capacityTiles);
        },
    },
    {
        id: 'E1', group: 'edit',
        statement: 'Its rooms can be edited',
        fields: ['roomEditor'],
        answer: (e) => {
            const kind = e.roomEditor?.kind;
            return typeof kind === 'string'
                ? cell(CELL_KINDS.YES, ROOM_EDITOR_WORDING[kind] ?? kind) : cell(CELL_KINDS.NO);
        },
    },
    {
        id: 'E2', group: 'edit',
        statement: 'A region of a saved world can be opened in an editor and saved back',
        fields: ['regionRoundTrip'],
        answer: (e) => {
            const rt = e.regionRoundTrip;
            if (isFn(rt?.open) && isFn(rt?.save)) return cell(CELL_KINDS.YES);
            if (typeof rt?.refused === 'string') return cell(CELL_KINDS.NO, rt.refused);
            return cell(CELL_KINDS.NO);
        },
    },
    {
        id: 'E3', group: 'edit',
        statement: 'An exit can be moved to another side (and a side can hold more than one)',
        fields: ['exitSides'],
        answer: (e) => {
            const s = sideMayHoldAnotherExit(e);
            if (s.may) return cell(CELL_KINDS.YES, CELL_WORDING.sideSharing);
            if (s.reason === SIDE_SHARING.KEYED) return cell(CELL_KINDS.PARTIAL, CELL_WORDING.onePerSide);
            if (s.reason === SIDE_SHARING.MALFORMED) return cell(CELL_KINDS.NO, CELL_WORDING.malformedSides(s.malformed));
            return cell(CELL_KINDS.NO);
        },
    },
    {
        id: 'E4', group: 'edit',
        statement: "The editor's validity report checks its location and exit names",
        fields: ['apLocationNamesOf', 'apExitNamesOf'],
        answer: (e) => yesNo(isFn(e.apLocationNamesOf) && isFn(e.apExitNamesOf)),
    },
].map((s) => Object.freeze({ ...s, fields: Object.freeze([...s.fields]) })));

/**
 * ⛓ **A LIVE ANSWER OVER A CELL** — pure: a NEW cell, the input untouched. The
 * KIND is the declaration's; the live answer refines only the TEXT (and the
 * `list`), and the new cell carries `live: {key, value}` so a renderer can show
 * the raw answer.
 * - `itemTypes`: an array → the same cell a static `types` list makes
 *   (`itemTypesCell`: *<n> item types: a, b, c, …*, the whole list as `list`)
 *   on a ✓ cell; anything else a `describeRegistry` produces (`'absent'`, a
 *   `threw: …`) → unchanged.
 * An `n/a` cell, an undeclared statement and a missing answer are unchanged.
 *
 * @param {{kind: string, text: string|null}} cell
 * @param {{live?: string}} statement
 * @param {*} answer `vm.answers[entry.id][statement.live]`
 */
export function applyLiveAnswer(cell, statement, answer) {
    const key = statement?.live;
    if (!key || answer === undefined || cell.kind === CELL_KINDS.NA) return cell;
    const value = Array.isArray(answer) ? answer.join(', ') : String(answer);
    if (key === LIVE_ANSWERS.itemTypes) {
        if (!Array.isArray(answer) || cell.kind !== CELL_KINDS.YES) return cell;
        return { ...cell, ...itemTypesCell(answer.map(String)), live: { key, value } };
    }
    return cell;
}

/** ⛓ The value of each named field, in the code's short words. */
const whyOf = (entry, fields) => fields.map((field) => ({ field, value: cellOf(digTwo(entry, field)).short }));

/**
 * ⛓⛓ **THE CHART** — one row per statement (group order, then declared
 * order), one cell per entry in the entries' own order. A statement whose
 * `requires` answered *no* (or *n/a*) for an entry reads `na` there.
 *
 * @param {object[]} entries registry entries
 * @returns {{group: string, id: string, statement: string, fields: string[],
 *   cells: {id: string, kind: string, text: string|null, why: {field: string, value: string}[], list?: string[]}[]}[]}
 */
export function capabilityRows(entries) {
    const order = CAPABILITY_GROUPS.map((g) => g.id);
    const statements = [...CAPABILITY_STATEMENTS]
        .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
    const byId = new Map();
    const rows = [];
    for (const s of statements) {
        const cells = entries.map((entry) => {
            const why = whyOf(entry, s.fields);
            const pre = s.requires ? byId.get(s.requires)?.cells.find((c) => c.id === entry.id) : null;
            if (pre && (pre.kind === CELL_KINDS.NO || pre.kind === CELL_KINDS.NA)) {
                return { id: entry.id, kind: CELL_KINDS.NA, text: null, why };
            }
            const a = s.answer(entry);
            const out = { id: entry.id, kind: a.kind, text: a.text ?? null, why };
            if (a.list) out.list = [...a.list];
            return out;
        });
        const row = { group: s.group, id: s.id, statement: s.statement, fields: [...s.fields], cells };
        byId.set(s.id, row);
        rows.push(row);
    }
    return rows;
}

/**
 * ⛓ **ONE SUBSTRATE'S CARD** — the rows it answers *yes* or *partial* to, in
 * group order: what a person can do with it, and nothing it cannot.
 */
export function cardOf(entry, rows) {
    const lines = [];
    for (const r of rows) {
        const c = r.cells.find((x) => x.id === entry.id);
        if (!c || (c.kind !== CELL_KINDS.YES && c.kind !== CELL_KINDS.PARTIAL)) continue;
        lines.push({ group: r.group, statement: r.statement, text: c.text });
    }
    return { id: entry.id, label: entry.label ?? entry.id, lines };
}

/**
 * ⛓⛓ **A CARD AS PLAIN TEXT** — the ONE card-to-text rule every host's hover
 * uses (the Substrate Registry panel's column headers, the pipeline's
 * substrate rows, the hub's substrate pickers): the label, then one line per
 * card line, *"Group — statement: degree"* (the degree only where the cell has
 * one). No host builds its own wording.
 *
 * @param {ReturnType<typeof cardOf>} card
 * @returns {string}
 */
export function cardText(card) {
    const groupLabel = new Map(CAPABILITY_GROUPS.map((g) => [g.id, g.label]));
    return [card.label, ...card.lines.map((l) => `${groupLabel.get(l.group)} — ${l.statement}`
        + `${l.text ? `: ${l.text}` : ''}`)].join('\n');
}

/**
 * ⛓ **EVERY ENTRY'S LABEL AND CARD TEXT**, the rows computed ONCE — what a
 * picker asks per render. Keyed by id, in the entries' order.
 *
 * @param {object[]} entries registry entries
 * @returns {Map<string, {label: string, text: string}>}
 */
export function substrateCards(entries) {
    const rows = capabilityRows(entries);
    return new Map(entries.map((entry) => {
        const card = cardOf(entry, rows);
        return [entry.id, { label: card.label, text: cardText(card) }];
    }));
}

/**
 * ⛓ The row-universe names (`registryShape.fieldNamesOf`) that NO statement
 * reads, sorted — printed under the chart as a finding, so a new capability
 * surfaces as *not yet in plain words* instead of silently missing. A parent
 * counts as read when a statement reads one of its dotted children, and a
 * child when a statement reads its parent.
 */
export function uncoveredFields(names, rows) {
    const read = new Set(rows.flatMap((r) => r.fields));
    const covered = (n) => read.has(n)
        || [...read].some((f) => f.startsWith(`${n}.`) || n.startsWith(`${f}.`));
    return names.filter((n) => !covered(n)).sort();
}
