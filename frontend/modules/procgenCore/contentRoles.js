/**
 * procgenCore/contentRoles — **WHAT CONTENT A SUBSTRATE CAN ACCEPT** (⛓
 * CONTENT SETS C2, ⚖ the user 2026-11-10: Q3, "the system knows what content
 * is available to work with in each substrate").
 *
 * `conceptRealisations` (`concepts.js`) names, by id, the MECHANIC concepts an
 * entry realises. It cannot name a character a pack brings. So an entry may
 * also declare ROLES: the kinds of content it can show, and the fields each
 * needs. A PACK concept (`packConcepts/packConcepts.js`) fills any role whose
 * needs it supplies.
 *
 *   contentRoles: {
 *       <role id>: {
 *           accepts: { kinds: [<pack concept kind>, …] }      ← exactly one of
 *                  | { presents: [<mechanic concept id>, …] }  ←   these two
 *           needs:   { look?: true, art?: true, text?: [<slot>, …] },  optional
 *           why:     '<one sentence>',                                 required
 *       },
 *   }
 *
 *   `kinds`    a non-empty subset of `PACK_CONCEPT_KINDS` — the pack layer owns
 *              that list, this file imports it.
 *   `presents` mechanic concept ids, each in the concept table AND realised by
 *              the same entry's `conceptRealisations`: a role that shows a
 *              mechanic concept the entry cannot realise would be a role
 *              nothing selects.
 *   `needs`    `name` is always required of a pack concept, so it is never
 *              listed (refused by name if it is). `look` (colour + symbol,
 *              both required by the pack layer) and `art` are booleans.
 *
 * ⛔ A ROLE IS PRESENTATION ONLY. It never changes logic: a pack concept that
 * presents `guardian` fills a gate role's presentation; the gate's logic is
 * still the realisation's `effect` + `needs`.
 *
 * Rule 4 of `concepts.js` holds here too: an entry with no `contentRoles` is
 * not an error, and a refusal is a value (`roleRefusal` returns a sentence).
 *
 * ⛔ BROWSER-SAFE AND NAMELESS: no `node:` import, no registry import, and no
 * registered substrate id anywhere in this file (asserted by
 * `contentRoles.test.js`, which reads this file's source).
 */

import { PACK_CONCEPT_KINDS } from '../packConcepts/packConcepts.js';
import { ConceptContractError, realisationsOf } from './concepts.js';

/** The fields a role declaration may carry. */
export const ROLE_FIELDS = Object.freeze(['accepts', 'needs', 'why']);
/** The two forms of `accepts`; a role declares exactly one. */
export const ACCEPTS_FORMS = Object.freeze(['kinds', 'presents']);
/** What `needs` may ask for (`name` is implied, never listed). */
export const NEED_FIELDS = Object.freeze(['look', 'art', 'text']);

const fail = (message) => { throw new ConceptContractError(message); };
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const quoteList = (xs) => xs.map((x) => `"${x}"`).join(', ');

/** A non-empty list of distinct non-empty strings, or a refusal naming `what`. */
function assertIdList(list, what) {
    if (!Array.isArray(list) || list.length === 0) fail(`${what} is not a non-empty list`);
    const seen = new Set();
    for (const x of list) {
        if (!nonEmptyString(x)) fail(`${what} holds ${JSON.stringify(x)}, not a non-empty string`);
        if (seen.has(x)) fail(`${what} lists "${x}" twice`);
        seen.add(x);
    }
}

/**
 * ⛓ **ONE ROLE, CHECKED.** `realised` is the set of concept ids the entry's
 * `conceptRealisations` realises.
 */
function assertContentRole(entryId, roleId, role, concepts, realised) {
    const who = `content roles: entry "${entryId}"'s role "${roleId}"`;
    if (!nonEmptyString(roleId)) fail(`content roles: entry "${entryId}" declares a role with an empty id`);
    if (!isPlainObject(role)) fail(`${who} is not an object { accepts, needs?, why }`);
    for (const field of Object.keys(role)) {
        if (!ROLE_FIELDS.includes(field)) fail(`${who}: unknown field "${field}" (${ROLE_FIELDS.join(', ')})`);
    }
    if (!nonEmptyString(role.why)) fail(`${who} has no \`why\``);

    const accepts = role.accepts;
    if (!isPlainObject(accepts)) fail(`${who}: \`accepts\` is not an object { kinds } or { presents }`);
    const forms = Object.keys(accepts);
    for (const f of forms) {
        if (!ACCEPTS_FORMS.includes(f)) fail(`${who}: \`accepts\` has unknown field "${f}" (${ACCEPTS_FORMS.join(', ')})`);
    }
    if (forms.length !== 1) fail(`${who}: \`accepts\` must declare exactly one of ${ACCEPTS_FORMS.join(', ')} (it declares ${forms.length ? forms.join(' and ') : 'neither'})`);
    if ('kinds' in accepts) {
        assertIdList(accepts.kinds, `${who}: \`accepts.kinds\``);
        for (const k of accepts.kinds) {
            if (!PACK_CONCEPT_KINDS.includes(k)) fail(`${who}: \`accepts.kinds\` names "${k}", not a pack concept kind (${PACK_CONCEPT_KINDS.join(', ')})`);
        }
    } else {
        assertIdList(accepts.presents, `${who}: \`accepts.presents\``);
        for (const id of accepts.presents) {
            if (!concepts?.[id]) fail(`${who}: \`accepts.presents\` names "${id}", which the concept table does not hold`);
            if (!realised.has(id)) fail(`${who}: \`accepts.presents\` names "${id}", which the entry's \`conceptRealisations\` does not realise`);
        }
    }

    const needs = role.needs ?? {};
    if (!isPlainObject(needs)) fail(`${who}: \`needs\` is not an object { look?, art?, text? }`);
    for (const field of Object.keys(needs)) {
        if (field === 'name') fail(`${who}: \`needs.name\` — every pack concept has a name, so a role never lists it`);
        if (!NEED_FIELDS.includes(field)) fail(`${who}: \`needs\` has unknown field "${field}" (${NEED_FIELDS.join(', ')})`);
    }
    for (const flag of ['look', 'art']) {
        if (flag in needs && typeof needs[flag] !== 'boolean') fail(`${who}: \`needs.${flag}\` is ${JSON.stringify(needs[flag])}, not a boolean`);
    }
    if ('text' in needs) assertIdList(needs.text, `${who}: \`needs.text\``);
}

/**
 * ⛓⛓ **A SUBSTRATE'S ROLES, CHECKED.** An entry with no `contentRoles` is not
 * an error (rule 4); a malformed one throws a `ConceptContractError` naming the
 * entry's role and what is wrong.
 *
 * @param {object} entry a registry entry (or a test double)
 * @param {Record<string, object>} concepts the mechanic concept table
 */
export function assertContentRoles(entry, concepts) {
    const roles = entry?.contentRoles;
    if (roles === undefined || roles === null) return;
    if (!isPlainObject(roles)) fail(`content roles: entry "${entry?.id}"'s \`contentRoles\` is not an object keyed by role id`);
    const realised = new Set(Object.keys(realisationsOf(entry)));
    for (const [roleId, role] of Object.entries(roles)) assertContentRole(entry?.id, roleId, role, concepts, realised);
}

/**
 * ⛓ **AN ENTRY'S ROLES, NORMALISED**, as `realisationsOf` does:
 *
 *   an object carrying `contentRoles` → that field (`{}` when null)
 *   a non-empty object every value of which is `{accepts, …}` → itself
 *   anything else (an entry that declares no role, null) → `{}`
 */
export function contentRolesOf(entryOrRoles) {
    const x = entryOrRoles;
    if (!isPlainObject(x)) return {};
    if (Object.prototype.hasOwnProperty.call(x, 'contentRoles')) {
        return isPlainObject(x.contentRoles) ? x.contentRoles : {};
    }
    const values = Object.values(x);
    if (values.length && values.every((r) => isPlainObject(r) && isPlainObject(r.accepts))) return x;
    return {};
}

/**
 * ⛓⛓ **DOES THIS PACK CONCEPT FILL THIS ROLE?** `null` when it does, else a
 * sentence naming the FIRST thing missing, checked in this order: no concept,
 * the wrong kind (or not presenting an accepted concept), no `look`, no `art`,
 * then each text slot in the role's order.
 *
 * ⚠ A text slot is checked for PRESENCE on the concept (its key), not for the
 * key resolving in a text library: the pack layer already holds every slot to a
 * namespaced key, and resolution is the consumer's, with its stack.
 *
 * @param {object} role one role declaration (already checked)
 * @param {object|null} packConcept a `createPackConcepts(...).get(key)` entry
 */
export function roleRefusal(role, packConcept) {
    if (!packConcept) return 'there is no such pack concept';
    const who = `"${packConcept.key ?? packConcept.name}"`;
    const accepts = role?.accepts ?? {};
    if (accepts.kinds) {
        if (!accepts.kinds.includes(packConcept.kind)) {
            return `${who} is a ${packConcept.kind}; the role accepts ${accepts.kinds.join(', ')}`;
        }
    } else if (accepts.presents) {
        if (!accepts.presents.includes(packConcept.presents)) {
            return `${who} does not present ${accepts.presents.length > 1 ? 'any of ' : ''}${quoteList(accepts.presents)}`;
        }
    }
    const needs = role?.needs ?? {};
    if (needs.look && !packConcept.look) return `${who} has no \`look\``;
    if (needs.art && !packConcept.art) return `${who} has no \`art\``;
    for (const slot of needs.text ?? []) {
        if (!packConcept.text || !Object.prototype.hasOwnProperty.call(packConcept.text, slot)) {
            return `${who} has no text slot "${slot}"`;
        }
    }
    return null;
}

function roleOf(entryOrRoles, roleId) {
    const roles = contentRolesOf(entryOrRoles);
    if (!Object.prototype.hasOwnProperty.call(roles, roleId)) {
        const known = Object.keys(roles);
        fail(`content roles: no role "${roleId}" (${known.length ? `declared: ${known.join(', ')}` : 'the entry declares none'})`);
    }
    return roles[roleId];
}

/**
 * ⛓ **THE PACK CONCEPTS THAT FILL ONE ROLE** — their keys, in the library's
 * order (`packConcepts.keys()`). An undeclared role is refused by name.
 *
 * @param {object} entryOrRoles an entry or its `contentRoles` object
 * @param {string} roleId
 * @param {object} packConcepts a `createPackConcepts(stack)` object
 */
export function candidatesForRole(entryOrRoles, roleId, packConcepts) {
    const role = roleOf(entryOrRoles, roleId);
    return packConcepts.keys().filter((key) => roleRefusal(role, packConcepts.get(key)) === null);
}

/**
 * ⛓ **EVERY `presents` IN A STACK NAMES A MECHANIC CONCEPT.** The pack layer
 * keeps `presents` opaque on purpose; this is the cross-check against the
 * table. Throws a `ConceptContractError` naming the pack, the key and the id.
 * Reads the WINNING entries (an override that drops `presents` is not checked
 * for the entry it replaced).
 *
 * @param {object} packConcepts a `createPackConcepts(stack)` object
 * @param {Record<string, object>} concepts the mechanic concept table
 */
export function assertPresents(packConcepts, concepts) {
    for (const key of packConcepts.keys()) {
        const c = packConcepts.get(key);
        if (c.presents !== undefined && !concepts?.[c.presents]) {
            fail(`content roles: pack "${c.pack}" concept "${key}" presents "${c.presents}", which the concept table does not hold`);
        }
    }
}

/**
 * ⛓ **WHICH PACK CONCEPTS FILL EACH OF AN ENTRY'S ROLES** —
 * `[{role, concepts: [keys]}]` in the entry's declared order. The input a later
 * chart statement reads; ⛔ this file adds no statement to
 * `CAPABILITY_STATEMENTS` (the sentence is the user's).
 */
export function rolesFilledBy(entryOrRoles, packConcepts) {
    const roles = contentRolesOf(entryOrRoles);
    return Object.keys(roles).map((role) => ({ role, concepts: candidatesForRole(roles, role, packConcepts) }));
}
