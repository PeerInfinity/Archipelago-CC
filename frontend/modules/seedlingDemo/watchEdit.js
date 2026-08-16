/**
 * seedlingDemo/watchEdit — **FREE TILE / OBJECT EDITING, AS A CLOSED SET OF
 * PURE OPS.** ⚖ Kickoff §3.8, ruling 8; CONSTRUCTIVE-MODE arc slice 11
 * (`NewDocs/plans/seedling-constructive-mode-kickoff.md`).
 *
 * Four ops — `paint`, `place`, `attrs`, `remove` — each a `record → record`
 * function on top of `procgenLevel`'s writers, plus the ONE fold
 * (`applyEdits`) that reconstructs an edited level from the recipe's output.
 * ⛔ NO DOM, NO NODE: unit-tested in node, imported by the page, and by
 * `scripts/procgen/check-seedling-editor-edit.mjs` on the node side of its
 * cross-runtime claim.
 *
 * ── ⛔⛔ THE TWO LAWS THIS FILE EXISTS TO KEEP ─────────────────────────
 *
 * **(a) IDENTITY.** An edited level's identity is the PAYLOAD, never the URL
 * (⚖ ruling 9). So an edit is not a mutation of a record — it is a RECORDED
 * OP appended to `state.edits`, and the level is *the ladder to step k, then
 * the directives, then the edits, in order*. `applyEdits` is the one
 * reconstruction of that third leg: the page replays it, the payload check
 * compares through it, `generateWithDirectives({edits})` runs it for node, and
 * UNDO is a pop of the list and a re-fold from `baseRecord`. ⛔ There is no
 * second history mechanism — no undo stack of records, no inverse ops.
 *
 * **(b) CERTIFICATION.** Editing never bypasses the oracle. Nothing in this
 * file adjudicates legality: a wall painted across the only corridor, a wall
 * ring painted to ground, an entity the world has never heard of — all of them
 * APPLY. **Free means free; certification is the guard**, and the page's
 * SOLVE is where the oracle answers (`watchViewer`'s `certifying` pass, which
 * catches a `LevelWorldError` on an EDITED record and shows it as UNCERTIFIED
 * with the engine's own name and text). ⛔ A legality rule here would be a
 * second adjudicator beside `model.refusalAt`, disagreeing with it the day one
 * of the two moved.
 *
 * ── ⛓ WHY THE OPS ADDRESS CELLS AND NOT LIST INDICES ──────────────────
 *
 * The brief offered `remove {entityIndex}` / `setAttrs {entityIndex, attrs}`.
 * They are addressed by TILE instead, and the forcing line is law (a): the
 * edit list is IDENTITY and it travels in a payload a person reads. An index
 * is a coordinate into a list nobody can see from the payload, whose meaning
 * depends on how many bodies the templates before it happened to place — so
 * two payloads with the same visible edit would carry different numbers, and a
 * reader could not tell what `{op:'remove', entityIndex: 7}` removed.
 *
 * ⚠ THE RULE WHEN A CELL HOLDS MORE THAN ONE BODY IS **THE LAST ONE**, stated
 * rather than left to `find`: the last is the most recently placed, which is
 * the one drawn on top and the one a click means. The fold is ordered, so the
 * answer is deterministic on every runtime.
 *
 * ── ⚠ WHAT IS **NOT** HERE ────────────────────────────────────────────
 *
 * No `PLACEMENT_GROUP`/`PLACEMENT_TAG` slots (`procgenPalette`'s per-anchor
 * activator allocator). A template's attrs are DERIVED from its anchor so that
 * two placements of one template cannot share a group; a hand-placed entity has
 * no template and no anchor derivation, so its attrs are LITERAL — what you
 * typed is what the record carries. ⛔ Deriving them here would be a second
 * allocator with no anchor to derive from.
 */

import {
    TERRAIN_NAMES, oelAtTile, tileAtOel, withEntities, withEntitiesReplaced, withTerrain,
} from './procgenLevel.js';

export class WatchEditError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WatchEditError';
    }
}

const fail = (message) => { throw new WatchEditError(message); };

/**
 * ⛓ THE FOUR OPS, AS A CLOSED SET — the page's tool selector, the pane's row
 * formatter and `applyEdit`'s dispatch all read THIS, so a fifth op cannot
 * arrive in one of them and not the others.
 */
export const EDIT_OPS = Object.freeze(['paint', 'place', 'attrs', 'remove']);

/**
 * ⛓⛓⛓ THE ENTITY ROSTER THE PAGE **OFFERS** — and it is a SUGGESTION, not a
 * gate. The type field is free text with this list behind it (`<datalist>`),
 * because law (b) says the world is the adjudicator: a type `ENTITY_CLASSES`
 * does not hold reaches `buildLevelWorld` and refuses BY NAME with the
 * construction site it wants, which is a better answer than any list here.
 *
 * ⛔ WHICH FIVE, AND WHY THESE: they are **the types `procgenPalette`'s own
 * templates place** — `pushableblock`, `button`, `lock`, `spinner`,
 * `arrowtrap` — measured out of that file rather than chosen. The brief
 * offered a wider guess (`bob`, `torchpickup`, `chest`, `key`, `keylock`,
 * `shieldboss`); the narrower set is the one with EVIDENCE behind it, since
 * every one of the five is a body the generator already builds, solves and
 * certifies in this exact room. `watchEdit.test.js` asserts all five are in
 * `levelWorld.ENTITY_CLASSES` — *"the roster is what the WORLD builds"* — so
 * the list cannot drift into naming something the engine would refuse.
 *
 * ⚠ `torchpickup` IS DELIBERATELY ABSENT even though every level holds one: it
 * is the GOAL class, the model names exactly one goal (`collectGoal(goalOel)`),
 * and a second one placed by hand would be a body the oracle is not looking
 * for. Removing the goal, on the other hand, is allowed — the oracle then
 * refuses, loudly, which is the mode working.
 */
export const ENTITY_ROSTER = Object.freeze([
    Object.freeze({
        type: 'pushableblock',
        attrs: Object.freeze({}),
        why: 'the block the reverse-pull gadget pushes — no attributes at all',
    }),
    Object.freeze({
        type: 'button',
        attrs: Object.freeze({ tset: '0' }),
        why: '`tset` is the ACTIVATOR GROUP: this button opens the locks sharing it',
    }),
    Object.freeze({
        type: 'lock',
        attrs: Object.freeze({ tset: '0', tag: '-1' }),
        why: '`tset` is the group a button opens it with; `tag` is its persistence flag '
            + '(-1 = none)',
    }),
    Object.freeze({
        type: 'spinner',
        attrs: Object.freeze({ tag: '-1' }),
        why: 'the kill-door\'s enemy — `tag` is its persistence flag (-1 = none)',
    }),
    Object.freeze({
        type: 'arrowtrap',
        attrs: Object.freeze({ shoot: '1', tset: '0' }),
        why: '`shoot` is the firing direction and `tset` its group',
    }),
]);

export const ENTITY_ROSTER_TYPES = Object.freeze(ENTITY_ROSTER.map((e) => e.type));

/* ══════════════════════════════════════════════════════════════════════
 * THE OPS
 * ══════════════════════════════════════════════════════════════════════ */

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * ⛓ CANONICAL FORM, BEFORE ANYTHING IS APPLIED — and this is what makes the
 * cross-runtime claim possible at all. The edit list is compared BYTE for BYTE
 * between a payload and a page (`agreementWithPayload`), so `{ty:4, tx:3,
 * op:'paint', terrain:'wall'}` and `{op:'paint', tx:3, ty:4, terrain:'wall'}`
 * must not be two different edits. Key order is fixed here, once.
 *
 * ⛔ IT VALIDATES SHAPE, NEVER LEGALITY (law b): an integer cell, a known op, a
 * terrain name the four-terrain vocabulary holds, an attrs object of scalars.
 * Whether the cell is inside the room, whether the wall seals the goal and
 * whether the world can build the type are all somebody else's questions —
 * `withTerrain` refuses an out-of-rectangle cell with its own sentence and
 * `buildLevelWorld` refuses an unknown tag with its own.
 */
export function normalizeEdit(op) {
    if (!isPlainObject(op)) {
        fail(`watchEdit: an edit must be an object, got ${JSON.stringify(op)}. `
            + `The ops are [${EDIT_OPS.join(', ')}].`);
    }
    if (!EDIT_OPS.includes(op.op)) {
        fail(`watchEdit: ${JSON.stringify(op.op)} is not one of the four edit ops `
            + `[${EDIT_OPS.join(', ')}]. The set is closed: the tool selector, this dispatch `
            + 'and the pane\'s row formatter all read it, so a fifth op cannot arrive in one '
            + 'of them and not the others.');
    }
    const cell = ['tx', 'ty'].map((k) => {
        if (!Number.isInteger(op[k])) {
            fail(`watchEdit: a ${op.op} edit needs an integer ${k}, got `
                + `${JSON.stringify(op[k])} — an edit addresses a CELL, because the edit list `
                + 'travels in a payload a person reads.');
        }
        return op[k];
    });
    const base = { op: op.op, tx: cell[0], ty: cell[1] };
    if (op.op === 'paint') {
        if (!TERRAIN_NAMES.includes(op.terrain)) {
            fail(`watchEdit: a paint edit needs one of the four terrains `
                + `[${TERRAIN_NAMES.join(', ')}], got ${JSON.stringify(op.terrain)}.`);
        }
        return Object.freeze({ ...base, terrain: op.terrain });
    }
    if (op.op === 'remove') return Object.freeze(base);
    // place / attrs — both carry an attrs object; place also carries a type.
    const attrs = normalizeAttrs(op.op, op.attrs);
    if (op.op === 'attrs') return Object.freeze({ ...base, attrs });
    if (typeof op.type !== 'string' || op.type === '') {
        fail(`watchEdit: a place edit needs a non-empty entity type, got `
            + `${JSON.stringify(op.type)}. The page OFFERS [${ENTITY_ROSTER_TYPES.join(', ')}] `
            + 'and accepts any string: `buildLevelWorld` is the adjudicator and refuses an '
            + 'untranscribed tag BY NAME.');
    }
    return Object.freeze({ ...base, type: op.type, attrs });
}

/**
 * ⚠ SCALARS ONLY, and the reason is the extract's own shape: an OEL attribute
 * is an XML attribute, so it is a string (`tset: '0'`) and the engine coerces
 * it (`tagOf` is `Number(attrs.tag)`). A nested object or an array is not an
 * attribute — an entity's `<node>` children are a SEPARATE field — so one here
 * would be a shape the record cannot mean, silently carried into a payload.
 */
function normalizeAttrs(what, attrs) {
    if (attrs === undefined || attrs === null) return Object.freeze({});
    if (!isPlainObject(attrs)) {
        fail(`watchEdit: a ${what} edit's attrs must be an object, got `
            + `${JSON.stringify(attrs)}.`);
    }
    const out = {};
    // ⛓ SORTED, for the same reason the whole op is key-ordered: two pages that
    // typed the same attributes in a different order must produce one payload.
    for (const key of Object.keys(attrs).sort()) {
        const v = attrs[key];
        if (v !== null && typeof v === 'object') {
            fail(`watchEdit: attribute ${JSON.stringify(key)} is ${JSON.stringify(v)}, and an `
                + 'OEL attribute is a scalar — the extract writes XML attributes, and an '
                + 'entity\'s <node> children are a separate field, not an attribute.');
        }
        out[key] = v;
    }
    return Object.freeze(out);
}

/**
 * ⛓ THE LAST ENTITY WHOSE OEL POINT LANDS IN THIS CELL, or `-1`.
 *
 * ⛔ `tileAtOel` is `procgenLevel`'s own inverse of `oelAtTile`, so this asks
 * the same question the placement answered. LAST wins — see the docblock.
 */
export function entityIndexAt(record, tx, ty) {
    let found = -1;
    (record.entities ?? []).forEach((e, i) => {
        const at = tileAtOel(e.x, e.y);
        if (at.tx === tx && at.ty === ty) found = i;
    });
    return found;
}

const requireEntityAt = (record, op) => {
    const i = entityIndexAt(record, op.tx, op.ty);
    if (i < 0) {
        fail(`watchEdit: a ${op.op} edit names cell (${op.tx},${op.ty}), which holds no `
            + 'entity. ⛔ It refuses rather than doing nothing: an op recorded in the edit '
            + 'list is part of the level\'s IDENTITY, and one that quietly did nothing would '
            + 'reconstruct a different level on the day the cell did hold something.');
    }
    return i;
};

/** ONE op, applied. PURE — a new frozen record out, the old one untouched. */
export function applyEdit(record, rawOp) {
    const op = normalizeEdit(rawOp);
    if (op.op === 'paint') {
        return withTerrain(record, [{ tx: op.tx, ty: op.ty, terrain: op.terrain }]);
    }
    if (op.op === 'place') {
        return withEntities(record, [{
            type: op.type, ...oelAtTile(op.tx, op.ty), attrs: { ...op.attrs },
        }]);
    }
    if (op.op === 'remove') {
        const i = requireEntityAt(record, op);
        return withEntitiesReplaced(record, record.entities.filter((_, k) => k !== i));
    }
    const i = requireEntityAt(record, op);
    // ⚠ REPLACED, not merged. "attrs literal" is the rule: what the box holds
    // IS the entity's attribute set, so clearing a field is spelled by leaving
    // it out. A merge would make an attribute impossible to remove.
    return withEntitiesReplaced(record,
        record.entities.map((e, k) => (k === i ? { ...e, attrs: { ...op.attrs } } : e)));
}

/**
 * ⛓⛓⛓ **THE ONE RECONSTRUCTION** — the recipe's record, then the edits in
 * order. Every reader of an edited level goes through this: the page's UNDO,
 * the `?gen=`/host-load replay, `generateWithDirectives({edits})` on the node
 * side, and the tests. ⛔ A second fold would be a second answer to *"what
 * does this payload mean"*.
 */
export function applyEdits(record, edits) {
    return (edits ?? []).reduce((r, op) => applyEdit(r, op), record);
}

/* ══════════════════════════════════════════════════════════════════════
 * THE STATE TRANSITIONS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ ONE EDIT ON A GENERATE-ARM STATE.
 *
 * ⛔ `baseRecord` IS SET ON THE FIRST EDIT AND NEVER MOVED: it is the RECIPE's
 * output (ladder + directives), which is exactly the record `applyEdits` folds
 * from and exactly what `agreementWithPayload`'s mutant-visible comparison
 * needs. Records are frozen, so keeping it costs a reference.
 *
 * ⚠ AND THE STATE'S OTHER FIELDS ARE UNTOUCHED — `summary`, `trace`,
 * `directives`, `keptTemplates`. A hand edit is not part of the run that
 * produced the prefix, and rewriting `summary.keptCount` for it would make the
 * payload claim a loop kept something no loop drew (the same argument
 * `applyDirective` makes one field over). ⛓ `keptTemplates` in particular
 * STAYS the KEPT TEMPLATES' — it is what the oracle's pin union is taken over,
 * and a hand-placed entity has no template and therefore no pins.
 */
export function editState(state, rawOp) {
    const op = normalizeEdit(rawOp);
    const base = state.baseRecord ?? state.record;
    const record = applyEdit(state.record, op);
    /**
     * ── ⛓⛓⛓ **THE TEST IS "DID THE RECORD CHANGE"**, AND IT IS THE MAZE
     * ── PAGE'S OWN DEFECT PAID FORWARD (§10.6 defect 2, trap 263) ─────────
     *
     * `mazeLab.applyEdit` had to stop trusting its editor's descriptor because
     * `_setTile` returns `ok: true, type: 'tile'` for a click that changed
     * NOTHING (*"Tile (3,3) already floor."*) — so a no-op click bumped the
     * count, dropped the CERTIFICATION and made the identity line announce that
     * the URL had stopped being a reproduction, all for a click that did
     * nothing. ⚖ §3.8 is a law about CHANGES.
     *
     * ⛔ THE SAME SHAPE EXISTS HERE WITHOUT AN EDITOR TO BLAME: painting
     * `ground` onto a ground cell, or replacing an entity's attrs with the ones
     * it already has, are perfectly legal ops that move no bytes. So the
     * question is asked of the RECORD — the thing this state's identity is
     * about — rather than of the op.
     *
     * ⛔ AND IT LIVES HERE, ON THE **STATE** TRANSITION, NOT ON `applyEdit`.
     * `applyEdit` is the pure writer and must stay total (the fold calls it for
     * every op in a payload); it is the edit LIST that is the identity, and an
     * op that changed nothing does not belong in it. ⚠ The consequence for a
     * replay is stated: a payload carrying a no-op op reconstructs the same
     * RECORD and a SHORTER list, so `agreementWithPayload` reports `edits` by
     * name — which is the honest reading, not a false alarm.
     *
     * ⚠ `state === out` IS THE PAGE'S SIGNAL, deliberately identity rather than
     * a flag: a caller that forgot to check gets the old state and cannot
     * accidentally announce an edit.
     */
    if (JSON.stringify(record) === JSON.stringify(state.record)) return state;
    return Object.freeze({
        ...state,
        baseRecord: base,
        record,
        edits: Object.freeze([...(state.edits ?? []), op]),
    });
}

/**
 * ⛓ UNDO — pop the list and RE-FOLD from `baseRecord`. ⛔ Not an inverse op
 * and not a stack of records: there is ONE reconstruction (`applyEdits`) and
 * undo is that reconstruction over a shorter list, so a level reached by
 * undoing is byte-identical to a level that never had the popped edit.
 *
 * ⚠ AT ZERO EDITS IT RETURNS THE STATE UNCHANGED — including its identity, so
 * a page can call it unconditionally and a readout cannot claim an undo that
 * did not happen.
 */
export function undoEdit(state) {
    const edits = state.edits ?? [];
    if (edits.length === 0) return state;
    const rest = edits.slice(0, -1);
    const base = state.baseRecord ?? state.record;
    return Object.freeze({
        ...state,
        baseRecord: base,
        record: applyEdits(base, rest),
        edits: Object.freeze(rest),
    });
}

/**
 * ⛓ APPLY A WHOLE EDIT LIST TO A STATE — the `?gen=` / host-load replay, and
 * `generateWithDirectives`' third leg. ⛔ Through `editState` one op at a time
 * rather than through `applyEdits` on the record, so a replayed level and a
 * hand-edited one carry the SAME `edits` list and the same `baseRecord`, and
 * `agreementWithPayload` compares like with like.
 */
export function editStates(state, edits) {
    return (edits ?? []).reduce((s, op) => editState(s, op), state);
}

/**
 * The pane's row text for one edit — ⚖ the brief's own spelling,
 * *"EDIT paint (3,4) → wall"*.
 */
export function describeEdit(op) {
    const at = `(${op.tx},${op.ty})`;
    if (op.op === 'paint') return `EDIT paint ${at} → ${op.terrain}`;
    if (op.op === 'place') {
        const keys = Object.keys(op.attrs ?? {});
        return `EDIT place ${at} → ${op.type}`
            + (keys.length ? ` {${keys.map((k) => `${k}=${op.attrs[k]}`).join(' ')}}` : '');
    }
    if (op.op === 'remove') return `EDIT remove ${at} → the entity there is gone`;
    const keys = Object.keys(op.attrs ?? {});
    return `EDIT attrs ${at} → {${keys.map((k) => `${k}=${op.attrs[k]}`).join(' ')}}`;
}
