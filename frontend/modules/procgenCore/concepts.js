/**
 * procgenCore/concepts — **WHAT A CONCEPT IS, AND THE ONE TABLE OF THEM**
 * (concept library T0; plan `concept-library-plan.md` §2–§3, ⚖ the user
 * 2026-09-29).
 *
 * A CONCEPT is a thing a world can be about — a sword, a guardian, water, a
 * coloured door — said ONCE, in no substrate's words. It has two halves, and
 * they live in two places on purpose:
 *
 *   the NEUTRAL half  — this file's `CONCEPTS`: its kind, its item row (if it
 *                       is an item), its parameters, its presentation, and its
 *                       RELATIONS to other concepts (a guardian's weakness is
 *                       the sword). Nothing here says how any game shows it.
 *   a SUBSTRATE'S half — `conceptRealisations` on that substrate's own registry
 *                       entry: which of these concepts it can realise, at which
 *                       TIER, and in which PLACEMENTS, each placement declaring
 *                       the EFFECT it has on reachability and the concepts it
 *                       NEEDS. This file only CHECKS that half
 *                       (`assertRealisations`); it never holds one.
 *
 * ── ⚖ THE FOUR RULES ─────────────────────────────────────────────────
 *
 * 1. `effect` ∈ `requires | helps | none`, and each word is TIED to the law an
 *    element is adjudicated by and the grade its differential must earn — both
 *    IMPORTED (`EFFECT_LAW`, `EFFECT_GRADES`), never spelled again here:
 *      requires → the `cut` law,      graded STRONG or BOUND-DEPENDENT
 *      helps    → the `shortcut` law, graded SHORTENS
 *      none     → no law,             graded INERT
 * 2. Logic is `needs` + `effect`, never a free rule expression. A need is a
 *    concept id or `{concept, count}` (the feather is swim ×2).
 * 3. Placement dependence is two PLACEMENTS (a guardian as a gate, a guardian
 *    roaming), never logic computed from where it stands.
 * 4. A realisation is OPTIONAL and a refusal is a value: an entry that declares
 *    none, or a concept it does not realise, is not an error — the caller falls
 *    back to what it does today. A MALFORMED declaration throws.
 *
 * ⛓ THE DIRECTION (measured at `996080b006`): the planner fixes the rule and
 * hands it to the substrate. A realisation never invents a rule; it DECLARES
 * what it can enforce, the rule SELECTS (`procgenPipeline/conceptSelection.js`),
 * and the substrate's oracle CERTIFIES with the grade `EFFECT_GRADES` names.
 *
 * ⛓ `params` are checked by the ONE schema language (`templateContract.
 * assertParamSchema`) and enumerated by its `enumerateValues` — a concept's
 * colour is a parameter exactly as a template's length is.
 *
 * ⛔ BROWSER-SAFE AND NAMELESS: no `node:` import, no registry import, and no
 * registered substrate id anywhere in this file (asserted by
 * `concepts.test.js`, which reads this file's source).
 */

import { LAW_CUT, LAW_SHORTCUT } from './elements.js';
import { GRADES, REQUIRING_GRADES } from './differentialGrade.js';
import { assertParamSchema, enumerateValues } from './templateContract.js';

export class ConceptContractError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConceptContractError';
    }
}

function fail(message) {
    throw new ConceptContractError(message);
}

/** ⛓ What a concept can be. */
export const CONCEPT_KINDS = Object.freeze(['item', 'obstacle', 'enemy', 'hazard']);

/** ⛓ The three effects a placement may have on reachability (rule 1). */
export const EFFECTS = Object.freeze({ REQUIRES: 'requires', HELPS: 'helps', NONE: 'none' });
export const EFFECT_WORDS = Object.freeze(Object.values(EFFECTS));

/**
 * ⛓ How a substrate realises a concept: `mechanic` — it enforces what the
 * concept means; `skin` — it only shows it.
 */
export const TIERS = Object.freeze(['mechanic', 'skin']);

/**
 * ⛓⛓ **EFFECT → LAW** — the element law that adjudicates a placement of that
 * effect (`elements.ELEMENT_LAWS`). `none` has no law: nothing is walled.
 */
export const EFFECT_LAW = Object.freeze({
    [EFFECTS.REQUIRES]: LAW_CUT,
    [EFFECTS.HELPS]: LAW_SHORTCUT,
    [EFFECTS.NONE]: null,
});

/**
 * ⛓⛓ **EFFECT → THE GRADES THAT CERTIFY IT** (`differentialGrade.GRADES`). A
 * `requires` placement is met by exactly what a `require:[X]` directive is met
 * by (`REQUIRING_GRADES`); ⛔ SHORTENS never certifies `requires`.
 */
export const EFFECT_GRADES = Object.freeze({
    [EFFECTS.REQUIRES]: REQUIRING_GRADES,
    [EFFECTS.HELPS]: Object.freeze([GRADES.SHORTENS]),
    [EFFECTS.NONE]: Object.freeze([GRADES.INERT]),
});

/** ⛓ Does a differential's grade certify a placement of this effect? */
export const gradeCertifies = (effect, grade) => (EFFECT_GRADES[effect] ?? []).includes(grade);

/**
 * ⛓ The relation names a concept may declare, each a list of concept ids.
 *   weakness    — an enemy/hazard is beaten by these (a guardian by the sword)
 *   crossedWith — an obstacle is crossed with these (water with swim)
 *   openedBy    — an obstacle is opened by any ONE of these (a door by its key);
 *                 a parameterised target is the instance with the same values
 */
export const RELATIONS = Object.freeze(['weakness', 'crossedWith', 'openedBy']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/**
 * ⛓ EVERY INSTANCE of a concept, in schema order: `[{values, id}]`. An
 * unparameterised concept has one instance, `values: {}`, and its id is its
 * item's id (null for a non-item). A parameterised one has one per value
 * combination, its id `idFor(values)`.
 */
export function instancesOf(concept) {
    const params = concept?.params ?? [];
    if (!params.length) return [Object.freeze({ values: Object.freeze({}), id: concept?.item?.id ?? null })];
    return enumerateValues({ params }).map((values) => Object.freeze({
        values: Object.freeze(values), id: concept.idFor(values),
    }));
}

/**
 * ⛓⛓ **ONE CONCEPT'S NEUTRAL HALF, CHECKED** — everything that can be asked of
 * the concept alone (`assertConceptTable` asks what needs the others).
 *
 * @param {string} id the concept's key in its table
 * @param {object} concept
 */
export function assertConcept(id, concept) {
    const who = `concept "${id}"`;
    if (!nonEmptyString(id)) fail(`concepts: a concept needs a non-empty id (got ${JSON.stringify(id)}).`);
    if (!isPlainObject(concept)) fail(`concepts: ${who} is not an object.`);
    if (!CONCEPT_KINDS.includes(concept.kind)) {
        fail(`concepts: ${who} declares kind ${JSON.stringify(concept.kind)}; a kind is one of `
            + `[${CONCEPT_KINDS.join(', ')}].`);
    }
    const params = concept.params ?? [];
    let keys = new Set();
    try {
        keys = assertParamSchema(params, who);
    } catch (err) {
        fail(`concepts: ${err.message}`);
    }
    if (keys.size && typeof concept.idFor !== 'function') {
        fail(`concepts: ${who} is parameterised and declares no \`idFor(values)\`. Each instance `
            + 'is its own library row, so each needs its own id.');
    }
    if (!keys.size && concept.idFor !== undefined) {
        fail(`concepts: ${who} declares \`idFor\` and no \`params\` — an id per instance of nothing.`);
    }
    if (concept.feature !== undefined && !nonEmptyString(concept.feature)) {
        fail(`concepts: ${who} declares a \`feature\` that is not a non-empty string.`);
    }
    const instances = instancesOf(concept);
    if (keys.size) {
        const ids = instances.map((i) => i.id);
        const bad = ids.filter((x) => !nonEmptyString(x));
        if (bad.length) fail(`concepts: ${who}'s \`idFor\` returned a non-string id.`);
        if (new Set(ids).size !== ids.length) {
            fail(`concepts: ${who}'s \`idFor\` gives two instances one id — [${ids.join(', ')}].`);
        }
        /* ⛓ PER-INSTANCE PRESENTATION: exactly one row per instance id, each naming it. */
        if (!isPlainObject(concept.presentation)) {
            fail(`concepts: ${who} is parameterised and declares no \`presentation\` table keyed `
                + 'by instance id — a row per instance is what gives each its name and colour.');
        }
        const missing = ids.filter((x) => !isPlainObject(concept.presentation[x]));
        const extra = Object.keys(concept.presentation).filter((x) => !ids.includes(x));
        if (missing.length || extra.length) {
            fail(`concepts: ${who}'s \`presentation\` must hold exactly its instances — missing `
                + `[${missing.join(', ')}], extra [${extra.join(', ')}].`);
        }
        for (const x of ids) {
            if (!nonEmptyString(concept.presentation[x].name)) {
                fail(`concepts: ${who}'s presentation of "${x}" has no \`name\`.`);
            }
        }
    } else if (concept.presentation !== undefined && !isPlainObject(concept.presentation)) {
        fail(`concepts: ${who}'s \`presentation\` is not an object.`);
    }
    if (concept.kind === 'item') {
        const item = concept.item;
        if (!isPlainObject(item)) fail(`concepts: ${who} is an item and declares no \`item\` row.`);
        if (!nonEmptyString(item.classification)) {
            fail(`concepts: ${who}'s item row has no \`classification\` (progression / filler / …).`);
        }
        if (keys.size) {
            if (item.id !== undefined || item.name !== undefined) {
                fail(`concepts: ${who} is parameterised; its \`item\` row is the SHARED part and may `
                    + 'not carry an `id` or `name` — those are per instance (`idFor`, `presentation`).');
            }
        } else if (!nonEmptyString(item.id) || !nonEmptyString(item.name)) {
            fail(`concepts: ${who}'s item row needs a non-empty \`id\` (the name a rule's \`Has\` `
                + 'carries) and `name`.');
        }
    } else if (concept.item !== undefined) {
        fail(`concepts: ${who} is ${concept.kind === 'enemy' ? 'an' : 'a'} ${concept.kind} and carries `
            + 'an `item` row — only an item concept is held.');
    }
    if (concept.relations !== undefined) {
        if (!isPlainObject(concept.relations)) fail(`concepts: ${who}'s \`relations\` is not an object.`);
        for (const [rel, targets] of Object.entries(concept.relations)) {
            if (!RELATIONS.includes(rel)) {
                fail(`concepts: ${who} declares relation "${rel}"; a relation is one of `
                    + `[${RELATIONS.join(', ')}].`);
            }
            if (!Array.isArray(targets) || !targets.length || !targets.every(nonEmptyString)) {
                fail(`concepts: ${who}'s relation "${rel}" must be a non-empty list of concept ids.`);
            }
        }
    }
}

/** ⛓ An item concept's instances as `{id, name}` — the names a rule can carry. */
function itemInstanceNames(concept) {
    return instancesOf(concept).map((i) => ({
        id: i.id, name: concept.params?.length ? concept.presentation[i.id].name : concept.item.name,
    }));
}

/** The one instance of `target` a `source` instance's values select, or null. */
function relatedInstance(target, values) {
    const tparams = target.params ?? [];
    if (!tparams.length) return instancesOf(target)[0];
    const want = {};
    for (const p of tparams) {
        if (!Object.prototype.hasOwnProperty.call(values, p.key)) return null;
        if (!p.domain.includes(values[p.key])) return null;
        want[p.key] = values[p.key];
    }
    return { values: want, id: target.idFor(want) };
}

/**
 * ⛓⛓ **THE WHOLE TABLE, CHECKED** — every concept alone (`assertConcept`),
 * then what needs the others: every relation id resolves; a parameterised
 * relation target has an instance for every source instance; every item
 * instance's `id` AND `name` are unique across the table.
 *
 * @param {Record<string, object>} concepts
 * @returns {Record<string, object>} the table, for chaining
 */
export function assertConceptTable(concepts) {
    if (!isPlainObject(concepts)) fail('concepts: the concept table is not an object keyed by concept id.');
    for (const [id, c] of Object.entries(concepts)) assertConcept(id, c);
    for (const [id, c] of Object.entries(concepts)) {
        for (const [rel, targets] of Object.entries(c.relations ?? {})) {
            for (const t of targets) {
                const target = concepts[t];
                if (!target) fail(`concepts: concept "${id}"'s relation "${rel}" names "${t}", which no concept is.`);
                for (const inst of instancesOf(c)) {
                    if (!relatedInstance(target, inst.values)) {
                        fail(`concepts: concept "${id}" instance "${inst.id}" relates (${rel}) to "${t}", `
                            + `which has no instance for its values ${JSON.stringify(inst.values)}.`);
                    }
                }
            }
        }
    }
    const seenId = new Map();
    const seenName = new Map();
    for (const [id, c] of Object.entries(concepts)) {
        if (c.kind !== 'item') continue;
        for (const inst of itemInstanceNames(c)) {
            if (seenId.has(inst.id)) {
                fail(`concepts: item id "${inst.id}" is carried by both "${seenId.get(inst.id)}" and "${id}" — `
                    + 'a rule\'s `Has` names ONE item.');
            }
            if (seenName.has(inst.name)) {
                fail(`concepts: item name "${inst.name}" is carried by both "${seenName.get(inst.name)}" and "${id}".`);
            }
            seenId.set(inst.id, id);
            seenName.set(inst.name, id);
        }
    }
    return concepts;
}

/**
 * ⛓ A need, normalised: `'swim'` → `{concept: 'swim', count: 1}`. Malformed
 * shapes return null (the assertions name them).
 */
export function normaliseNeed(need) {
    if (nonEmptyString(need)) return { concept: need, count: 1 };
    if (isPlainObject(need) && nonEmptyString(need.concept)) {
        return { concept: need.concept, count: need.count ?? 1 };
    }
    return null;
}

/**
 * ⛓ The AP item a need names — the concept's item `id` (what a rule's `Has`
 * carries). ⛔ Only an UNPARAMETERISED item concept can be needed: a need of
 * "a key" names no one key.
 */
export function itemIdOfNeed(conceptId, concepts) {
    const c = concepts?.[conceptId];
    if (!c || c.kind !== 'item' || (c.params ?? []).length) return null;
    return c.item.id;
}

/**
 * ⛓ **THE REVERSE OF `itemIdOfNeed`** (T0b) — the concept whose item an AP
 * item name IS, or null. Like `itemIdOfNeed`, only an UNPARAMETERISED item
 * concept answers: `key_red` is an instance of `key`, never "the key".
 *
 * @param {string} apName the AP item name a placement or rule carries
 * @param {Record<string, object>} concepts the table
 * @returns {string|null} the concept id
 */
export function conceptOfItem(apName, concepts) {
    if (!nonEmptyString(apName)) return null;
    for (const [cid, c] of Object.entries(concepts ?? {})) {
        if (c?.kind === 'item' && !(c.params ?? []).length && c.item?.id === apName) return cid;
    }
    return null;
}

/**
 * ⛓⛓ **ONE SHAPE FOR "WHAT A SUBSTRATE REALISES"** (T0b) — the realisations
 * object, from EITHER a registry entry (or any `{conceptRealisations}` view of
 * one) OR the realisations object itself. A substrate's placer lives in a
 * module its entry imports, so it cannot hand over the entry; it hands over
 * the data module its entry declares, and every reader here takes both.
 *
 *   an object carrying `conceptRealisations` → that field (`{}` when null)
 *   a non-empty object every value of which is `{tier, …}` → itself
 *   anything else (an entry that realises nothing, null) → `{}`
 */
export function realisationsOf(entryOrRealisations) {
    const x = entryOrRealisations;
    if (!isPlainObject(x)) return {};
    if (Object.prototype.hasOwnProperty.call(x, 'conceptRealisations')) {
        return isPlainObject(x.conceptRealisations) ? x.conceptRealisations : {};
    }
    const values = Object.values(x);
    if (values.length && values.every((r) => isPlainObject(r) && nonEmptyString(r.tier))) return x;
    return {};
}

/**
 * ⛓ **THE CONCEPT-ROW MARKER** (T0b) — an item library row that a WORLD'S
 * concept list added (`presetRun.mergedItemLib`) carries `concept: '<id>'`, so
 * a reader can tell it from a row a library declares: a tile-grid serializer
 * carries a marked row into the payload even when its base library holds the
 * id, and the item picker groups it under the substrates that realise it.
 * ⛔ No library declares a marked row, so a world that names no concept holds
 * none.
 */
export const markConceptRow = (row, conceptId) => ({ ...row, concept: conceptId });
export const isConceptRow = (row) => isPlainObject(row) && nonEmptyString(row.concept);

/**
 * ⛓⛓ **ONE REALISATION, CHECKED** — a substrate's half for one concept.
 *
 *   `tier`       one of `TIERS`
 *   `art`        optional (null, a string, or an object)
 *   `placements` required for a non-item concept, forbidden on an item: a
 *                non-empty object keyed by placement name, each
 *                `{effect, needs?, mechanic?}` — `requires`/`helps` need ≥1
 *                need, `none` has none; every need an unparameterised item
 *                concept with a positive integer count.
 *
 * Any other field (an item's boot `flag`, …) is the substrate's own.
 */
export function assertRealisation(conceptId, realisation, concepts) {
    const who = `the realisation of "${conceptId}"`;
    const concept = concepts?.[conceptId];
    if (!concept) fail(`concepts: ${who} names a concept no table holds.`);
    if (!isPlainObject(realisation)) fail(`concepts: ${who} is not an object.`);
    if (!TIERS.includes(realisation.tier)) {
        fail(`concepts: ${who} declares tier ${JSON.stringify(realisation.tier)}; a tier is one of `
            + `[${TIERS.join(', ')}].`);
    }
    if (realisation.art !== undefined && realisation.art !== null
        && !nonEmptyString(realisation.art) && !isPlainObject(realisation.art)) {
        fail(`concepts: ${who}'s \`art\` must be null, a string or an object.`);
    }
    if (concept.kind === 'item') {
        if (realisation.placements !== undefined) {
            fail(`concepts: ${who} carries \`placements\` — an item is HELD, never placed as a gate.`);
        }
        return;
    }
    const placements = realisation.placements;
    if (!isPlainObject(placements) || !Object.keys(placements).length) {
        fail(`concepts: ${who} declares no \`placements\`; a ${concept.kind} is realised in ≥1 placement.`);
    }
    for (const [key, p] of Object.entries(placements)) {
        const where = `${who}, placement "${key}"`;
        if (!isPlainObject(p)) fail(`concepts: ${where} is not an object.`);
        if (!EFFECT_WORDS.includes(p.effect)) {
            fail(`concepts: ${where} declares effect ${JSON.stringify(p.effect)}; an effect is one of `
                + `[${EFFECT_WORDS.join(', ')}] — never a free rule expression.`);
        }
        if (p.rule !== undefined) {
            fail(`concepts: ${where} declares a \`rule\`. Logic is \`needs\` + \`effect\`; the PLANNER `
                + 'fixes the rule, a realisation never invents one.');
        }
        const needs = p.needs ?? [];
        if (!Array.isArray(needs)) fail(`concepts: ${where}'s \`needs\` is not a list.`);
        if (p.effect === EFFECTS.NONE && needs.length) {
            fail(`concepts: ${where} has effect "none" and declares needs — nothing is needed to pass `
                + 'what does not gate.');
        }
        if (p.effect !== EFFECTS.NONE && !needs.length) {
            fail(`concepts: ${where} has effect "${p.effect}" and needs nothing — what does it `
                + `${p.effect === EFFECTS.REQUIRES ? 'require' : 'help with'}?`);
        }
        const seen = new Set();
        for (const raw of needs) {
            const n = normaliseNeed(raw);
            if (!n) fail(`concepts: ${where} has a malformed need ${JSON.stringify(raw)}.`);
            if (!Number.isInteger(n.count) || n.count < 1) {
                fail(`concepts: ${where}'s need "${n.concept}" has count ${JSON.stringify(n.count)}; `
                    + 'a count is a positive integer.');
            }
            if (!itemIdOfNeed(n.concept, concepts)) {
                fail(`concepts: ${where} needs "${n.concept}", which is not an unparameterised item concept.`);
            }
            if (seen.has(n.concept)) fail(`concepts: ${where} names "${n.concept}" twice; say it once, with its count.`);
            seen.add(n.concept);
        }
        if (p.mechanic !== undefined && !isPlainObject(p.mechanic)) {
            fail(`concepts: ${where}'s \`mechanic\` is not an object.`);
        }
    }
}

/**
 * ⛓⛓ **AN ENTRY'S WHOLE HALF, CHECKED.** No `conceptRealisations` is not an
 * error (rule 4); a malformed one throws.
 *
 * @param {object} entry a registry entry (or a test double)
 * @param {Record<string, object>} concepts the table
 */
export function assertRealisations(entry, concepts) {
    const reals = entry?.conceptRealisations;
    if (reals === undefined || reals === null) return;
    if (!isPlainObject(reals)) {
        fail(`concepts: entry "${entry?.id}"'s \`conceptRealisations\` is not an object keyed by concept id.`);
    }
    for (const [cid, r] of Object.entries(reals)) assertRealisation(cid, r, concepts);
}

/**
 * ⛓ **AN ITEM CONCEPT'S LIBRARY ROWS** — one per instance, in the shared
 * item library's row shape and key order (`name, id, classification, color,
 * symbol, feature`; a field the concept does not carry is left out).
 */
export function itemRowsOf(concept) {
    if (concept?.kind !== 'item') return [];
    const parameterised = (concept.params ?? []).length > 0;
    return instancesOf(concept).map((inst) => {
        const pres = parameterised ? concept.presentation[inst.id] : concept.item;
        const row = { name: pres.name, id: inst.id, classification: concept.item.classification };
        const color = pres.color ?? concept.item.color;
        const symbol = pres.symbol ?? concept.item.symbol;
        if (color !== undefined) row.color = color;
        if (symbol !== undefined) row.symbol = symbol;
        if (concept.feature !== undefined) row.feature = concept.feature;
        return row;
    });
}

/**
 * ⛓ **AN OBSTACLE CONCEPT'S LIBRARY ROWS** — one per instance of an obstacle
 * that carries a `presentation`, in the shared obstacle library's row shape
 * and key order (`name, id, clear_set_type, clear_set, color, feature`). The
 * clear set is its `openedBy` relation: any ONE opener, each the instance
 * with the obstacle's own values.
 */
export function obstacleRowsOf(concept, concepts) {
    if (concept?.kind !== 'obstacle' || !isPlainObject(concept.presentation)) return [];
    const parameterised = (concept.params ?? []).length > 0;
    return instancesOf(concept).map((inst) => {
        const pres = parameterised ? concept.presentation[inst.id] : concept.presentation;
        const clearSet = (concept.relations?.openedBy ?? [])
            .map((t) => [relatedInstance(concepts[t], inst.values).id]);
        const row = {
            name: pres.name, id: inst.id ?? pres.id, clear_set_type: 'combo_list', clear_set: clearSet,
        };
        if (pres.color !== undefined) row.color = pres.color;
        if (concept.feature !== undefined) row.feature = concept.feature;
        return row;
    });
}

/* ────────────────────────────── the table ────────────────────────────── */

/**
 * ⛓ The `feature` every unparameterised item concept carries (T0b), so
 * `itemTagsImpliedBy` names it and its library row says it is a concept's. The
 * item picker does NOT need an entry to list it in `supportedFeatures`: a row
 * the world's concept list added is grouped under the entries that REALISE
 * that concept (`procgenPipelineUI.groupLibraryByFeature`).
 */
export const CONCEPT_ITEMS_FEATURE = 'concept_items';

/** ⛓ The six colours the shared coloured-door vocabulary uses, in its order. */
const COLOURS = Object.freeze(['red', 'green', 'blue', 'yellow', 'purple', 'orange']);
const COLOUR_WHY = 'the six colours of the shared coloured keys and doors — each colour is one '
    + 'independent lock group; the colour is cosmetic, the pairing key↔door is the logic';
const COLOUR_PARAM = Object.freeze({ key: 'colour', domain: COLOURS, default: 'red', why: COLOUR_WHY });
const COLOURED_DOORS_AND_KEYS = 'colored_doors_and_keys';

const perColour = (idOf, rows) => Object.freeze(Object.fromEntries(COLOURS.map((c) => [
    idOf({ colour: c }), Object.freeze(rows[c]),
])));

const keyIdFor = ({ colour }) => `key_${colour}`;
const doorIdFor = ({ colour }) => `door_${colour}`;

/**
 * ⛓⛓⛓ **THE CONCEPTS.** The item names are the AP names the rules carry
 * (`sword` / `swim` are the progressive items a generated room gates on; the
 * keys and doors are the shared coloured vocabulary, instance for instance).
 */
export const CONCEPTS = Object.freeze({
    sword: Object.freeze({
        kind: 'item',
        item: Object.freeze({
            id: 'Progressive Sword', name: 'Progressive Sword', classification: 'progression',
            color: '#c0a040', symbol: 'star',
        }),
        feature: CONCEPT_ITEMS_FEATURE,
    }),
    swim: Object.freeze({
        kind: 'item',
        item: Object.freeze({
            id: 'Progressive Swim', name: 'Progressive Swim', classification: 'progression',
            color: '#40b0c0', symbol: 'star',
        }),
        feature: CONCEPT_ITEMS_FEATURE,
    }),
    guardian: Object.freeze({
        kind: 'enemy',
        relations: Object.freeze({ weakness: Object.freeze(['sword']) }),
    }),
    water: Object.freeze({
        kind: 'obstacle',
        relations: Object.freeze({ crossedWith: Object.freeze(['swim']) }),
    }),
    key: Object.freeze({
        kind: 'item',
        params: Object.freeze([COLOUR_PARAM]),
        idFor: keyIdFor,
        item: Object.freeze({ classification: 'progression', symbol: 'key' }),
        feature: COLOURED_DOORS_AND_KEYS,
        presentation: perColour(keyIdFor, {
            red: { name: 'Red Key', color: '#d04040' },
            green: { name: 'Green Key', color: '#40c060' },
            blue: { name: 'Blue Key', color: '#4080d0' },
            yellow: { name: 'Yellow Key', color: '#d8b820' },
            purple: { name: 'Purple Key', color: '#a040c0' },
            orange: { name: 'Orange Key', color: '#d87830' },
        }),
    }),
    door: Object.freeze({
        kind: 'obstacle',
        params: Object.freeze([COLOUR_PARAM]),
        idFor: doorIdFor,
        relations: Object.freeze({ openedBy: Object.freeze(['key']) }),
        feature: COLOURED_DOORS_AND_KEYS,
        presentation: perColour(doorIdFor, {
            red: { name: 'Red Door', color: '#b84040' },
            green: { name: 'Green Door', color: '#408040' },
            blue: { name: 'Blue Door', color: '#404080' },
            yellow: { name: 'Yellow Door', color: '#a08018' },
            purple: { name: 'Purple Door', color: '#803090' },
            orange: { name: 'Orange Door', color: '#b06018' },
        }),
    }),
});

assertConceptTable(CONCEPTS);

/* ─────────────────────── the chart's input (D4) ─────────────────────── */

/**
 * ⛓ **WHAT AN ENTRY REALISES**, in its declared order (an entry or its
 * realisations object — `realisationsOf`) —
 * `[{concept, kind, tier, placements: [{key, effect}]}]` (an item's
 * `placements` is empty). The input a future chart row reads; ⛔ this file adds
 * no statement to `CAPABILITY_STATEMENTS`.
 */
export function conceptsRealisedBy(entry, concepts) {
    return Object.entries(realisationsOf(entry))
        .filter(([cid]) => concepts[cid])
        .map(([cid, r]) => ({
            concept: cid,
            kind: concepts[cid].kind,
            tier: r.tier,
            placements: Object.entries(r.placements ?? {}).map(([key, p]) => ({ key, effect: p.effect })),
        }));
}

/**
 * ⛓ **THE ITEM TAGS AN ENTRY'S REALISATIONS IMPLY** — the `feature` of every
 * item concept it realises or needs, first-seen order, no duplicates (the same
 * tag law `substrateCapabilities.itemTagFeatures` reads off its items).
 */
export function itemTagsImpliedBy(entry, concepts) {
    const tags = [];
    const add = (cid) => {
        const f = concepts[cid]?.kind === 'item' ? concepts[cid].feature : undefined;
        if (f && !tags.includes(f)) tags.push(f);
    };
    for (const [cid, r] of Object.entries(realisationsOf(entry))) {
        add(cid);
        for (const p of Object.values(r.placements ?? {})) {
            for (const n of p.needs ?? []) add(normaliseNeed(n)?.concept);
        }
    }
    return tags;
}
