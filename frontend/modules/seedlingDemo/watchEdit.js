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
    LAYER_COLUMNS, RESIZE_ANCHORS, TERRAIN_NAMES, TILE_LAYERS, columnOfSpec, oelAtTile,
    resizeRoom, tileAtOel, withEntities, withEntitiesReplaced, withLayerTiles,
} from './procgenLevel.js';
/**
 * ⛓ THE GROUP TAG, IMPORTED RATHER THAN RE-SPELLED. `editCore` owns the shape
 * (A1); this file has to be able to FOLD one because a payload's edit list can
 * carry a grouped stroke and `applyEdits` is the Seedling side's one
 * reconstruction of that list. ⛔ Importing the core from a substrate module is
 * the direction that is allowed — the core imports no substrate, which is what
 * `bindingContract.test.js` pins.
 */
import { GROUP_OP, isGroup } from '../procgenCore/editCore.js';

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
export const EDIT_OPS = Object.freeze([
    'paint', 'place', 'attrs', 'remove', 'nodes', 'resize',
]);

/**
 * ⛓ THE OPS THAT ADDRESS A CELL — every one but `resize`, which is about the
 * ROOM. DERIVED, so the day a seventh op arrives it declares which it is here
 * and `normalizeEdit`'s `tx`/`ty` demand follows, rather than the demand being
 * a chain of `op.op !== …` that a new op joins by being forgotten.
 */
export const ROOM_OPS = Object.freeze(['resize']);
export const CELL_OPS = Object.freeze(EDIT_OPS.filter((o) => !ROOM_OPS.includes(o)));

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

/**
 * ⛓ THE SAME FIVE, UNDER THE NAME SLICE B's BRIEF ASKS FOR — the SAME frozen
 * array, not a copy, so the two names cannot come to mean different lists.
 *
 * ⛔⛔ **AND `ENTITY_ROSTER` ITSELF DID NOT BECOME THE 144.** The brief asked
 * for that and it is REFUSED HERE for a measured reason: `watchViewer.js:8013`
 * reads `ENTITY_ROSTER[0].type` and `[0].attrs` as the page's DEFAULT place
 * type, `check-seedling-editor-edit.mjs` drives a `place` gesture through that
 * default and compares the result against a node-side `pushableblock` place —
 * so widening this array silently changes what the browser gate places. That
 * file is outside this slice's set and its gate is a page row this slice does
 * not own. ⇒ the wide vocabulary is `entityRosterFrom(schema)`, a DERIVATION
 * with no page wired to it; giving it a control is slice C's, where the DOM is.
 */
export const ENTITY_ROSTER_PROCGEN = ENTITY_ROSTER;

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE OGMO SCHEMA — INJECTED, NEVER READ
 *
 * `fixtures/seedling-ogmo-schema.json` is `Shrum.oep` as data
 * (`scripts/procgen/extract-seedling-ogmo-schema.py`). ⛔ THIS FILE DOES NOT
 * LOAD IT: it is on the page's graph and one `node:fs` in that graph makes the
 * whole graph unloadable in a browser (`levelSource.js`'s own note, learned the
 * hard way). The schema arrives as an ARGUMENT — the same seam `atlasSource`
 * uses for level records — so node reads it from disk, the page fetches it, and
 * neither answer is baked in here.
 *
 * ⚠ AND EVERY SCHEMA PARAMETER DEFAULTS TO `null`, WHICH IS TODAY'S BEHAVIOUR
 * EXACTLY. A caller with no schema gets slice 11's ops unchanged, byte for
 * byte — which is what keeps `check-seedling-editor-edit.mjs`, the `?gen=`
 * replay and every committed payload inert across this slice.
 * ══════════════════════════════════════════════════════════════════════ */

/** The four Ogmo 1 value types, refused from the schema's own declaration. */
export function assertOgmoSchema(schema) {
    if (!isPlainObject(schema) || !isPlainObject(schema.entities)
        || !Array.isArray(schema.value_types)) {
        fail('watchEdit: an Ogmo schema is the extract of `Shrum.oep` — '
            + '`{schema_version, provenance, value_types, tilesets, layers, entities}`, as '
            + '`scripts/procgen/extract-seedling-ogmo-schema.py` writes it. Got '
            + `${JSON.stringify(schema)?.slice(0, 120)}.`);
    }
    return schema;
}

/**
 * ⛓ ONE ENTITY'S DECLARATION, refusing an UNDECLARED type BY NAME.
 *
 * ⚠ THIS DOES NOT CONTRADICT LAW (b). Law (b) is about LEGALITY — whether a
 * room built from this record works — and it stays the oracle's. This is about
 * VOCABULARY: `Shrum.oep` is the list of elements the game's own editor can
 * write, so a type it does not declare is not a body the format has, and
 * offering it would be offering an element `loadLevelXML` has no arm for. ⛔
 * The refusal only exists on the SCHEMA-BEARING path; `normalizeEdit` with no
 * schema still takes any string and still lets `buildLevelWorld` adjudicate.
 */
export function entityDecl(schema, type) {
    assertOgmoSchema(schema);
    const decl = schema.entities[type];
    if (!decl) {
        fail(`watchEdit: ${JSON.stringify(type)} is not one of the `
            + `${Object.keys(schema.entities).length} entity types \`Shrum.oep\` declares. `
            + 'The project file is what the game\'s own level editor can place, so a type '
            + 'outside it is an element `Game.loadLevelXML` has no construction arm for.');
    }
    return decl;
}

/**
 * ⛓ THE WHOLE OFFERED VOCABULARY, DERIVED — one row per declared entity, each
 * carrying the attrs a fresh placement starts from (every declared value that
 * HAS a default) and the folder the `.oep` files it under, which is the only
 * grouping the format itself supplies.
 *
 * ⚠ A VALUE WITH NO DECLARED DEFAULT IS ABSENT FROM `attrs`, not zero: three of
 * the 166 declared values (`flip` on bonetorch / bonetorch2 / planttorch) have
 * none, and inventing one would write an attribute the author never gave a
 * value for.
 */
export function entityRosterFrom(schema) {
    assertOgmoSchema(schema);
    return Object.freeze(Object.entries(schema.entities).map(([type, decl]) => Object.freeze({
        type,
        folder: decl.folder,
        attrs: Object.freeze(Object.fromEntries(decl.values
            .filter((v) => v.default !== null && v.default !== undefined)
            .map((v) => [v.name, v.default]))),
        nodes: Boolean(decl.nodes),
        why: `${decl.folder} · ${decl.width}x${decl.height}`
            + (decl.values.length ? ` · ${decl.values.map((v) => v.name).join(' ')}` : ''),
    })));
}

/**
 * ⛓⛓ **ONE ATTRIBUTE, COERCED TO THE TEXT AN OEL WOULD HOLD, AND RANGE-CHECKED.**
 *
 * ⛔ THE OUTPUT IS ALWAYS A STRING, and that is canonicalisation rather than
 * taste: an OEL attribute IS an XML attribute, `recordToOel` writes
 * `String(value)`, and the engine coerces (`tagOf` is `Number(attrs.tag)`). So
 * `{tset: 0}` and `{tset: '0'}` are the same level and must not be two payloads
 * — the same argument the sorted key order in `normalizeAttrs` makes.
 *
 * ⚠ `min`/`max`/`maxChars` ARE ENFORCED, AND THEY DO NOT REFUSE THE REAL DATA:
 * measured over all 2,461 entity instances of the committed 116-room atlas,
 * ZERO carry a value outside its declared type or range. That calibration is a
 * row in `watchEdit.test.js` — a hardening rule whose first duty is to accept
 * the corpus it is about.
 */
export function coerceAttrValue(decl, value, where) {
    const text = String(value);
    if (decl.type === 'integer' || decl.type === 'number') {
        const n = Number(text);
        if (text.trim() === '' || !Number.isFinite(n)) {
            fail(`${where}: ${JSON.stringify(decl.name)} is declared \`${decl.type}\` and `
                + `${JSON.stringify(value)} is not a number.`);
        }
        if (decl.type === 'integer' && !Number.isInteger(n)) {
            fail(`${where}: ${JSON.stringify(decl.name)} is declared \`integer\` and `
                + `${JSON.stringify(value)} is not a whole number.`);
        }
        if (decl.min !== undefined && n < decl.min) {
            fail(`${where}: ${JSON.stringify(decl.name)}=${n} is below the declared `
                + `minimum ${decl.min} (\`Shrum.oep\`).`);
        }
        if (decl.max !== undefined && n > decl.max) {
            fail(`${where}: ${JSON.stringify(decl.name)}=${n} is above the declared `
                + `maximum ${decl.max} (\`Shrum.oep\`).`);
        }
        return String(n);
    }
    if (decl.type === 'boolean') {
        if (text !== 'true' && text !== 'false') {
            fail(`${where}: ${JSON.stringify(decl.name)} is declared \`boolean\` and `
                + `${JSON.stringify(value)} is neither "true" nor "false".`);
        }
        return text;
    }
    if (decl.maxChars !== undefined && text.length > decl.maxChars) {
        fail(`${where}: ${JSON.stringify(decl.name)} is ${text.length} characters and `
            + `\`Shrum.oep\` declares maxChars=${decl.maxChars}.`);
    }
    return text;
}

/**
 * ⛓⛓⛓ **AN ATTRS OBJECT, AGAINST ONE ENTITY'S DECLARATION.** Unknown attribute
 * refused BY NAME; every declared one coerced and range-checked.
 *
 * ── ⛔⛔ `fillDefaults` IS **OFF** BY DEFAULT, AND THE BRIEF SAID OTHERWISE ──
 *
 * The brief's reason for filling was *"that is what Ogmo does — an entity
 * written by Ogmo carries every declared value"*. **MEASURED AND FALSE.** Over
 * the 2,461 entity instances of the committed 116-room atlas, 2,278 carry every
 * declared value and **183 do not**: 137 `teleporter` without `sign`, 21
 * `stairsup` and 18 `stairsdown` without `sign`, 9 `teleporter` each without
 * `show` / `invert` / `tag`, 6 `control` without `sign`, 1 `watcher` without
 * `text1`. Every one of those values HAS a declared default, and every one of
 * them is a value added to the project file after those rooms were last saved.
 *
 * ⇒ "Ogmo fills every value" is not a property of the FORMAT; it is a property
 * of a room saved SINCE the value was declared. Filling is therefore an editor
 * CONVENIENCE and it is asked for by name — which also makes it byte-inert by
 * construction for every payload this slice inherited, rather than inert
 * because a scan happened to find no `place` op with an omitted attr.
 */
export function normalizeAttrsAgainst(schema, type, attrs, { fillDefaults = false } = {}) {
    const decl = entityDecl(schema, type);
    const byName = new Map(decl.values.map((v) => [v.name, v]));
    const where = `watchEdit: <${type}>`;
    const out = {};
    for (const key of Object.keys(attrs ?? {}).sort()) {
        const v = byName.get(key);
        if (!v) {
            fail(`${where} has no attribute ${JSON.stringify(key)}. \`Shrum.oep\` declares `
                + `[${decl.values.map((d) => d.name).join(', ') || '(none)'}] for it, and an `
                + 'attribute outside that list is one the game reads nowhere — it would ride '
                + 'in the payload and the OEL and mean nothing.');
        }
        out[key] = coerceAttrValue(v, attrs[key], where);
    }
    if (fillDefaults) {
        for (const v of decl.values) {
            if (out[v.name] === undefined && v.default !== null && v.default !== undefined) {
                out[v.name] = coerceAttrValue(v, v.default, where);
            }
        }
    }
    // ⛓ SORTED, exactly as `normalizeAttrs` sorts — one canonical key order.
    return Object.freeze(Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]])));
}

/**
 * ⛓ **THE FIVE BOSS CLASSES WHOSE ROOM GEOMETRY IS COMPILED IN** — ⚖ plan §5
 * #1 and ruling 5, a LITERAL **WITH PROVENANCE** because there is nothing in
 * this repo to derive it from: the constants live in five AS3 classes and
 * nothing has transcribed them.
 *
 * ⛔ Each name is PINNED against the schema's `enemies` folder in
 * `watchEdit.test.js`, so a typo or a rename in the project file reddens rather
 * than silently emptying the warning.
 */
export const ROOM_GEOMETRY_BOSSES = Object.freeze({
    bosstotem: 'BossTotemShot.roomBottom / BossTotem.maxYPosition',
    lavaboss: 'LavaBoss.playerPosition',
    finalboss: 'FinalBoss.podPositions / RockFall',
    tentaclebeast: 'TentacleBeast.spawnRect',
    shieldboss: 'ShieldBoss room geometry',
});

/**
 * ⛓ WHAT A RESIZE OF **THIS** RECORD IS WORTH WARNING ABOUT — a list of
 * sentences, never a refusal (⚖ ruling 5: the warning is displayed until plan
 * §5 #1 lands, and the edit is never blocked).
 */
export function resizeWarnings(record, op) {
    const out = [];
    const bosses = (record.entities ?? [])
        .map((e) => e.type)
        .filter((t) => Object.prototype.hasOwnProperty.call(ROOM_GEOMETRY_BOSSES, t));
    if (bosses.length > 0) {
        out.push(`⚠ this room holds ${[...new Set(bosses)].map((t) => `<${t}>`).join(', ')}, `
            + 'whose fight geometry is COMPILED IN, not read from the room — '
            + `${[...new Set(bosses)].map((t) => ROOM_GEOMETRY_BOSSES[t]).join('; ')}. `
            + 'Resizing the room does not move it, and the fight will use the vanilla '
            + 'rectangle (plan §5 #1 is the AS3 slice that would).');
    }
    if (op.width > record.width || op.height > record.height) {
        out.push(`the ${op.width}x${op.height} rectangle's new cells hold NO TILE — an `
            + 'absent cell is not a wall, so paint them before the oracle is asked '
            + '(`assertClosed` refuses a floor cell 4-adjacent to an absent one).');
    }
    return Object.freeze(out);
}

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
export function normalizeEdit(op, { schema = null, fillDefaults = false } = {}) {
    if (!isPlainObject(op)) {
        fail(`watchEdit: an edit must be an object, got ${JSON.stringify(op)}. `
            + `The ops are [${EDIT_OPS.join(', ')}].`);
    }
    if (!EDIT_OPS.includes(op.op)) {
        fail(`watchEdit: ${JSON.stringify(op.op)} is not one of the ${EDIT_OPS.length} edit `
            + `ops [${EDIT_OPS.join(', ')}]. The set is closed: the tool selector, this `
            + 'dispatch and the pane\'s row formatter all read it, so a new op cannot arrive '
            + 'in one of them and not the others.');
    }
    if (op.op === 'resize') return normalizeResize(op);
    const cell = ['tx', 'ty'].map((k) => {
        if (!Number.isInteger(op[k])) {
            fail(`watchEdit: a ${op.op} edit needs an integer ${k}, got `
                + `${JSON.stringify(op[k])} — an edit addresses a CELL, because the edit list `
                + 'travels in a payload a person reads.');
        }
        return op[k];
    });
    const base = { op: op.op, tx: cell[0], ty: cell[1] };
    if (op.op === 'paint') return normalizePaint(op, base);
    if (op.op === 'remove') return Object.freeze(base);
    if (op.op === 'nodes') return Object.freeze({ ...base, nodes: normalizeNodes(op, schema) });
    // place / attrs — both carry an attrs object; place also carries a type.
    if (op.op === 'attrs') {
        /**
         * ⚠ AN `attrs` OP CANNOT BE SCHEMA-CHECKED FROM THE OP ALONE, and that
         * is a fact about the op rather than a gap: it addresses *the last
         * entity in this cell*, whose TYPE is a fact about the RECORD. The
         * check therefore lives at `applyEdit`, which has one.
         */
        return Object.freeze({ ...base, attrs: normalizeAttrs(op.op, op.attrs) });
    }
    if (typeof op.type !== 'string' || op.type === '') {
        fail(`watchEdit: a place edit needs a non-empty entity type, got `
            + `${JSON.stringify(op.type)}. The page OFFERS [${ENTITY_ROSTER_TYPES.join(', ')}] `
            + 'and accepts any string: `buildLevelWorld` is the adjudicator and refuses an '
            + 'untranscribed tag BY NAME.');
    }
    const attrs = schema
        ? normalizeAttrsAgainst(schema, op.type, op.attrs, { fillDefaults })
        : normalizeAttrs(op.op, op.attrs);
    const placed = { ...base, type: op.type, attrs };
    if (op.nodes !== undefined) placed.nodes = normalizeNodes({ ...op, type: op.type }, schema);
    return Object.freeze(placed);
}

/**
 * ⛓ CANONICAL FORM FOR EITHER SHAPE AN EDIT LIST HOLDS — an atomic op, or a
 * GROUP whose members are each canonical. ⛔ The members go through
 * `normalizeEdit` too: a payload's byte comparison is over the WHOLE list, so a
 * group whose members kept the key order the page happened to build them in
 * would be the one place the canonical form did not reach.
 */
export function normalizeGroupOrEdit(rawOp, options = {}) {
    if (!isGroup(rawOp)) return normalizeEdit(rawOp, options);
    if (!Array.isArray(rawOp.ops) || rawOp.ops.length === 0) {
        fail(`watchEdit: group ${JSON.stringify(rawOp.label)} carries no ops.`);
    }
    return Object.freeze({
        op: GROUP_OP,
        label: rawOp.label,
        ops: Object.freeze(rawOp.ops.map((m) => normalizeGroupOrEdit(m, options))),
    });
}

/**
 * ⛓⛓ A PAINT SPEC, CANONICAL — and **BYTE-INERT FOR EVERY EXISTING PAYLOAD**.
 *
 * ⛔ `layer` IS OMITTED WHEN IT IS `tiles` AND `column` WHEN A NAME WAS GIVEN,
 * deliberately: the normalized op is compared BYTE FOR BYTE between a payload
 * and a page (`agreementWithPayload`), so a `layer: "tiles"` written into every
 * op would make every level generated before this slice disagree with itself.
 * The default is the absence, exactly as `nodes` and `attrs` are absent when
 * they carry nothing.
 */
function normalizePaint(op, base) {
    const layer = op.layer ?? 'tiles';
    if (!TILE_LAYERS.includes(layer)) {
        fail(`watchEdit: a paint edit's layer must be one of [${TILE_LAYERS.join(', ')}], got `
            + `${JSON.stringify(op.layer)}. Those are the two \`loadlevel\` builds — `
            + `"tiles" is the ${LAYER_COLUMNS.tiles}-column terrain and "cliffsides" is the `
            + `${LAYER_COLUMNS.cliffsides} pixelmask decorations.`);
    }
    const withLayer = layer === 'tiles' ? base : { ...base, layer };
    if (op.terrain !== undefined && op.column !== undefined) {
        fail('watchEdit: a paint edit carries a `terrain` NAME and a `column` at once — '
            + 'they are two spellings of one choice and the op must not hold both, or a '
            + 'reader cannot tell which the page meant.');
    }
    if (op.terrain !== undefined) {
        if (!TERRAIN_NAMES.includes(op.terrain)) {
            fail(`watchEdit: a paint edit's terrain NAME must be one of the four `
                + `[${TERRAIN_NAMES.join(', ')}], got ${JSON.stringify(op.terrain)} — or `
                + `name a \`column\` instead, which reaches all ${LAYER_COLUMNS.tiles}.`);
        }
        // ⛓ `columnOfSpec` refuses a NAME on the cliffsides layer, by name.
        columnOfSpec(op.terrain, layer, 'watchEdit');
        return Object.freeze({ ...withLayer, terrain: op.terrain });
    }
    return Object.freeze({
        ...withLayer, column: columnOfSpec({ column: op.column }, layer, 'watchEdit'),
    });
}

/**
 * ⛓ A NODE LIST — `[{x, y}]` in OEL PIXELS, the shape `parseOelLevel` reads and
 * `recordToOel` writes.
 *
 * ⛔ REFUSED FOR A TYPE THE SCHEMA SAYS HAS NO `<nodes>`, when a schema is
 * present. One object in `Shrum.oep` declares it (`rope`), `Game.as:2201-2210`
 * is the only reader, and a node list on anything else is data the game drops —
 * which would ride in the payload looking like an edit that did something.
 */
function normalizeNodes(op, schema) {
    if (!Array.isArray(op.nodes)) {
        fail(`watchEdit: a nodes edit needs an array of {x, y}, got `
            + `${JSON.stringify(op.nodes)}.`);
    }
    if (schema && typeof op.type === 'string' && !entityDecl(schema, op.type).nodes) {
        fail(`watchEdit: <${op.type}> does not declare <nodes> in \`Shrum.oep\`, so a node `
            + 'list on it is data the game never reads (`Game.as:2201-2210` sizes a RopeStart '
            + 'from them and nothing else looks). Refused rather than carried.');
    }
    return Object.freeze(op.nodes.map((n, i) => {
        if (!isPlainObject(n) || !Number.isInteger(n.x) || !Number.isInteger(n.y)) {
            fail(`watchEdit: node #${i + 1} is ${JSON.stringify(n)} — a node is `
                + '`{x, y}` in OEL PIXELS (`<node x= y=/>`), not tile coordinates.');
        }
        return Object.freeze({ x: n.x, y: n.y });
    }));
}

/**
 * ⛓ A RESIZE OP — the ONE op that is about the ROOM and therefore carries no
 * cell. ⚖ Plan ruling 5.
 */
function normalizeResize(op) {
    for (const k of ['width', 'height']) {
        if (!Number.isInteger(op[k])) {
            fail(`watchEdit: a resize edit needs an integer ${k}, got `
                + `${JSON.stringify(op[k])}.`);
        }
    }
    const anchor = op.anchor ?? RESIZE_ANCHORS[0];
    if (!RESIZE_ANCHORS.includes(anchor)) {
        fail(`watchEdit: a resize anchor must be one of [${RESIZE_ANCHORS.join(', ')}], got `
            + `${JSON.stringify(op.anchor)}.`);
    }
    return Object.freeze({
        op: 'resize', width: op.width, height: op.height, anchor,
    });
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

/**
 * ONE op, applied. PURE — a new frozen record out, the old one untouched.
 *
 * ⚠ `options` REACHES `normalizeEdit`, and with no options this is slice 11's
 * function unchanged. The one thing it can do that normalisation cannot is
 * check an `attrs` op against the entity's declaration, because the TYPE that
 * op is about is a fact about the RECORD.
 */
export function applyEdit(record, rawOp, { schema = null, fillDefaults = false } = {}) {
    /**
     * ⛓⛓ **A GROUP IS FOLDED HERE SO THE TWO FOLDS AGREE ON ONE PAYLOAD.**
     *
     * ⚠ The ADAPTER's `apply` never sees one — `editCore.applyOne` intercepts a
     * group before it dispatches, exactly as the maze's adapter docblock says.
     * But `applyEdits` is the SEEDLING side's own reconstruction (the `?gen=`
     * replay, `generateWithDirectives({edits})`, UNDO), and an edit list
     * carrying a grouped stroke has to mean the same level through either fold
     * or the payload means two things.
     *
     * ⛔ ALL-OR-NOTHING, by construction rather than by a catch: the members run
     * on a chain of records and the caller's is replaced only by the return, so
     * a refusal throws out of here with nothing written — the same promise
     * `editCore`'s group arm makes with `ok:false`.
     */
    if (isGroup(rawOp)) {
        if (!Array.isArray(rawOp.ops) || rawOp.ops.length === 0) {
            fail(`watchEdit: group ${JSON.stringify(rawOp.label)} carries no ops.`);
        }
        return rawOp.ops.reduce((r, member) => {
            if (isGroup(member)) {
                fail(`watchEdit: group ${JSON.stringify(rawOp.label)} contains a NESTED `
                    + 'group. A stroke is FLAT — `editCore` refuses the same shape, and one '
                    + 'fold accepting what the other refuses is the disagreement this arm '
                    + 'exists to prevent.');
            }
            return applyEdit(r, member, { schema, fillDefaults });
        }, record);
    }
    const op = normalizeEdit(rawOp, { schema, fillDefaults });
    if (op.op === 'paint') {
        return withLayerTiles(record, op.layer ?? 'tiles', [op.terrain !== undefined
            ? { tx: op.tx, ty: op.ty, terrain: op.terrain }
            : { tx: op.tx, ty: op.ty, column: op.column }]);
    }
    if (op.op === 'resize') {
        return resizeRoom(record, { width: op.width, height: op.height, anchor: op.anchor });
    }
    if (op.op === 'place') {
        const body = { type: op.type, ...oelAtTile(op.tx, op.ty), attrs: { ...op.attrs } };
        if (op.nodes) body.nodes = op.nodes.map((n) => ({ ...n }));
        return withEntities(record, [body]);
    }
    if (op.op === 'remove') {
        const i = requireEntityAt(record, op);
        return withEntitiesReplaced(record, record.entities.filter((_, k) => k !== i));
    }
    if (op.op === 'nodes') {
        const i = requireEntityAt(record, op);
        const subject = record.entities[i];
        if (schema && !entityDecl(schema, subject.type).nodes) {
            fail(`watchEdit: a nodes edit names cell (${op.tx},${op.ty}), whose last entity `
                + `is <${subject.type}> — and \`Shrum.oep\` does not declare <nodes> for it. `
                + 'The node list would be written into the OEL and read by nothing.');
        }
        /**
         * ⚠ REPLACED, and an EMPTY list REMOVES the field rather than writing
         * `nodes: []`. `recordToOel` emits a self-closing element when there are
         * no nodes and `parseOelLevel` gives the field back only when there were
         * some, so `nodes: []` is a record shape the round trip cannot preserve.
         */
        return withEntitiesReplaced(record, record.entities.map((e, k) => {
            if (k !== i) return e;
            const { nodes, ...rest } = e;
            return op.nodes.length === 0
                ? rest : { ...rest, nodes: op.nodes.map((n) => ({ ...n })) };
        }));
    }
    const i = requireEntityAt(record, op);
    // ⚠ REPLACED, not merged. "attrs literal" is the rule: what the box holds
    // IS the entity's attribute set, so clearing a field is spelled by leaving
    // it out. A merge would make an attribute impossible to remove.
    const attrs = schema
        ? normalizeAttrsAgainst(schema, record.entities[i].type, op.attrs, { fillDefaults })
        : { ...op.attrs };
    return withEntitiesReplaced(record,
        record.entities.map((e, k) => (k === i ? { ...e, attrs: { ...attrs } } : e)));
}

/**
 * ⛓⛓⛓ **THE ONE RECONSTRUCTION** — the recipe's record, then the edits in
 * order. Every reader of an edited level goes through this: the page's UNDO,
 * the `?gen=`/host-load replay, `generateWithDirectives({edits})` on the node
 * side, and the tests. ⛔ A second fold would be a second answer to *"what
 * does this payload mean"*.
 */
export function applyEdits(record, edits, options = {}) {
    return (edits ?? []).reduce((r, op) => applyEdit(r, op, options), record);
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
export function editState(state, rawOp, options = {}) {
    const op = normalizeGroupOrEdit(rawOp, options);
    const base = state.baseRecord ?? state.record;
    const record = applyEdit(state.record, op, options);
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
    if (recordsEqual(record, state.record)) return state;
    return Object.freeze({
        ...state,
        baseRecord: base,
        record,
        edits: Object.freeze([...(state.edits ?? []), op]),
    });
}

/**
 * ⛓⛓ **THE RECORD EQUALITY, EXTRACTED — ONE SPELLING.**
 *
 * `editState`'s "did the record change" test is the same question `editCore`'s
 * fold asks through `adapter.equal`, and until slice B they were two
 * expressions of it: an inline `JSON.stringify` here, and whatever the adapter
 * chose. ⛔ Two spellings of an equality is the drift that makes a no-op an edit
 * on one path and not on the other, and the identity line then depends on which
 * path a click took.
 *
 * ⚠ `JSON.stringify` IS ENOUGH HERE and is not enough in general: a level record
 * is plain JSON built by this directory's own frozen constructors, so its key
 * ORDER is fixed by construction (`freezeRecord` spreads a literal, `tileEntry`
 * builds an array). `editCore.canonicalJson` exists for the descriptors, which
 * an ADAPTER assembles and whose order is therefore not fixed.
 */
export const recordsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
export function undoEdit(state, options = {}) {
    const edits = state.edits ?? [];
    if (edits.length === 0) return state;
    const rest = edits.slice(0, -1);
    const base = state.baseRecord ?? state.record;
    return Object.freeze({
        ...state,
        baseRecord: base,
        record: applyEdits(base, rest, options),
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
export function editStates(state, edits, options = {}) {
    return (edits ?? []).reduce((s, op) => editState(s, op, options), state);
}

/**
 * The pane's row text for one edit — ⚖ the brief's own spelling,
 * *"EDIT paint (3,4) → wall"*.
 */
export function describeEdit(op) {
    if (isGroup(op)) {
        return `EDIT ${GROUP_OP} ${JSON.stringify(op.label)} (${op.ops?.length ?? 0} op(s))`;
    }
    if (op.op === 'resize') {
        return `EDIT resize → ${op.width}x${op.height} (${op.anchor})`;
    }
    const at = `(${op.tx},${op.ty})`;
    if (op.op === 'nodes') {
        return `EDIT nodes ${at} → ${op.nodes.length === 0 ? 'none'
            : op.nodes.map((n) => `${n.x},${n.y}`).join(' ')}`;
    }
    if (op.op === 'paint') {
        const what = op.terrain !== undefined ? op.terrain : `column ${op.column}`;
        return `EDIT paint ${at}${op.layer ? ` [${op.layer}]` : ''} → ${what}`;
    }
    if (op.op === 'place') {
        const keys = Object.keys(op.attrs ?? {});
        return `EDIT place ${at} → ${op.type}`
            + (keys.length ? ` {${keys.map((k) => `${k}=${op.attrs[k]}`).join(' ')}}` : '');
    }
    if (op.op === 'remove') return `EDIT remove ${at} → the entity there is gone`;
    const keys = Object.keys(op.attrs ?? {});
    return `EDIT attrs ${at} → {${keys.map((k) => `${k}=${op.attrs[k]}`).join(' ')}}`;
}
