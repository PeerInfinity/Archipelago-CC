/**
 * mazeRoom/mazeContent — **THE MAZE'S CONTENT ROLES AND ITS PRESENTATION PASS** (⛓ CONTENT SETS R2).
 *
 * A concept gate's name, colour and symbol, and an item concept's colour and symbol, are CONTENT: they live in the
 * maze's default content pack (`frontend/packs/maze/`, the entry's `defaultContentPack`), one pack concept per
 * realised mechanic that `presents` it and carries a `look`. They resolve at GENERATION (⚖ Q8) and are written into
 * the world document, as before.
 *
 * ⛔ OUTSIDE THE ENGINE CLOSURE (R2 rework, ⚖ tile-primitives-design-4 via the planner, 2026-11-11). The maze engine
 * (`mazeRoomEngine.js`, `mazeConcepts.js`) is in the import closure of `tileSpike/certifyPlaythroughMaze.js`, whose
 * md5 the Seedling derived-rule table pins: that closure holds LOGIC only. So the engine keeps writing its own built-in
 * looks (`MAZE_CONCEPT_REALISATIONS[c].art` for a gate, the concept table's row for an item: the INERT FALLBACK), and
 * this file applies the world's content set as a PRESENTATION PASS after the engine returns, from the registry entry's
 * hooks (`mazeRoomLibrary.js`). ⛔ Import this file only from outside the closure (the library, a panel), never from
 * the engine, `mazeConcepts.js` or `tileSpike/` — `mazeContent.test.js` reads the closure and pins that.
 *
 * With the default pack the values written equal the fallback values (pinned), so every world is byte-equal; a theme
 * changes them. Which fields a role writes is behaviour (⚖ Q6) and is code: `ROLE_WRITES`.
 */

import { candidatesForRole } from '../procgenCore/contentRoles.js';
import { isConceptGate } from './mazeConcepts.js';

/** The pack whose looks a world gets when it names no theme (the entry's `defaultContentPack`). */
export const MAZE_DEFAULT_CONTENT_PACK = 'maze';

/**
 * **WHAT THE MAZE CAN SHOW FROM A PACK** (the entry's `contentRoles`; contract `procgenCore/contentRoles.js`). Two
 * roles, split by what the pass WRITES (`ROLE_WRITES`): a gate takes the concept's name and look; an item takes its
 * look only, because an item row's name is the AP item name, which is logic.
 */
export const MAZE_CONTENT_ROLES = Object.freeze({
    gate: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['guardian', 'water']) }),
        needs: Object.freeze({ look: true }),
        why: 'A rule gate the planner selected a concept for is named and painted as that concept.',
    }),
    item: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['sword', 'swim']) }),
        needs: Object.freeze({ look: true }),
        why: 'An item concept the world names is drawn on its tile in the concept\'s colour and symbol.',
    }),
});

/** Which fields of a resolved pack concept each role writes into its row. */
export const ROLE_WRITES = Object.freeze({
    gate: Object.freeze(['name', 'color', 'symbol']),
    item: Object.freeze(['color', 'symbol']),
});

/** The maze's refusals for content, by name. */
export const MAZE_CONTENT_REFUSALS = Object.freeze({
    noContentSet: (what, conceptId) => `maze ${what}: the world offers "${conceptId}", and no content set was `
        + 'handed in (params.contentSet): its look lives in a content pack, so the caller loads one (the region '
        + 'seam does: assertContentLoaded)',
    noPresenter: (what, conceptId, roleId, ids) => `maze ${what}: no pack in the content set [${ids.join(', ')}] `
        + `presents "${conceptId}" with what the "${roleId}" role needs (a look)`,
});

/**
 * **A MECHANIC'S LOOK, FROM THE WORLD'S CONTENT SET.** The pack concepts that fill `roleId` (`candidatesForRole`:
 * right `presents`, a `look`) and present `conceptId`, latest pack in the stack first; the first gives
 * `{name, color, symbol}`. So a later pack that presents the mechanic with a look wins, and one that presents it
 * WITHOUT a look (the text adventure's default pack does) falls through — in the end to the maze's own. ⚠ Not
 * `concepts.presenting(id)` alone: that returns the last presenter whether or not it fills the role. `null` when no
 * pack in the set fills the role for it.
 *
 * @param {{ids: string[], concepts: object}} contentSet
 * @param {string} roleId a role of `MAZE_CONTENT_ROLES`
 * @param {string} conceptId a mechanic concept id
 * @returns {{name: string, color: string, symbol: string}|null}
 */
export function presentedLook(contentSet, roleId, conceptId) {
    const { ids, concepts } = contentSet;
    const rank = (key) => ids.indexOf(concepts.get(key).pack);
    const key = candidatesForRole(MAZE_CONTENT_ROLES, roleId, concepts)
        .filter((k) => concepts.get(k).presents === conceptId)
        .sort((a, b) => rank(b) - rank(a))[0];
    if (!key) return null;
    const c = concepts.get(key);
    return { name: c.name, color: c.look.color, symbol: c.look.symbol };
}

/** `presentedLook` reduced to the fields `roleId` writes, refused by name when the set is absent or fills nothing. */
function lookFor(contentSet, what, roleId, conceptId) {
    if (!contentSet) throw new Error(MAZE_CONTENT_REFUSALS.noContentSet(what, conceptId));
    const look = presentedLook(contentSet, roleId, conceptId);
    if (!look) throw new Error(MAZE_CONTENT_REFUSALS.noPresenter(what, conceptId, roleId, contentSet.ids));
    return Object.fromEntries(ROLE_WRITES[roleId].map((f) => [f, look[f]]));
}

/** A row with `fields` overwritten in place of the row's own (key order kept: an existing key keeps its slot). */
const withFields = (row, fields) => ({ ...row, ...fields });

/**
 * **THE ITEM LIBRARY, PRESENTED.** Every row the world's concept list added (`presetRun.mergedItemLib` marks it
 * `concept: '<id>'`) whose concept the `item` role accepts gets the role's fields from the content set. Returns the
 * SAME object when no row is marked (nothing is read, and no set is needed); otherwise a new object, so a library
 * shared between regions is never mutated.
 *
 * @param {Record<string, object>} itemLib
 * @param {object|null|undefined} contentSet
 */
export function presentItemLib(itemLib, contentSet) {
    const accepts = MAZE_CONTENT_ROLES.item.accepts.presents;
    const marked = Object.entries(itemLib ?? {}).filter(([, def]) => accepts.includes(def?.concept));
    if (!marked.length) return itemLib;
    const out = { ...itemLib };
    for (const [id, def] of marked) out[id] = withFields(def, lookFor(contentSet, `item "${id}"`, 'item', def.concept));
    return out;
}

/**
 * **THE OBSTACLE LIBRARY, PRESENTED.** Every concept gate (`isConceptGate`: a `rule` gate naming its `concept`) whose
 * concept the `gate` role accepts gets the role's fields from the content set. Same object when there is none.
 */
export function presentObstacleLib(obstacleLib, contentSet) {
    const accepts = MAZE_CONTENT_ROLES.gate.accepts.presents;
    const gates = Object.entries(obstacleLib ?? {}).filter(([, def]) => isConceptGate(def) && accepts.includes(def.concept));
    if (!gates.length) return obstacleLib;
    const out = { ...obstacleLib };
    for (const [id, def] of gates) out[id] = withFields(def, lookFor(contentSet, `gate "${id}"`, 'gate', def.concept));
    return out;
}

/**
 * **THE PASS** over a maze world the engine returned: its item and obstacle libraries presented from `contentSet`
 * (in place on `world`, which the hook owns; the libraries themselves are replaced, never mutated). A world with no
 * concept row is untouched and needs no set.
 */
export function presentMazeWorld(world, contentSet) {
    if (!world) return world;
    world.itemLib = presentItemLib(world.itemLib, contentSet);
    world.obstacleLib = presentObstacleLib(world.obstacleLib, contentSet);
    return world;
}

/**
 * The registry entry's hooks: the engine's `generateRegionCore` / `placeFromRules`, then the pass over the world
 * with the region's `params.contentSet`. The engine's return value is passed through unchanged.
 */
export const presentingRegionCore = (core) => (input = {}) => {
    const out = core(input);
    presentMazeWorld(out?.world, input.params?.contentSet);
    return out;
};
export const presentingPlaceFromRules = (place) => (world, input = {}) => {
    const out = place(world, input);
    presentMazeWorld(world, input.params?.contentSet);
    return out;
};
