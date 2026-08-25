/**
 * seedlingDemo/watchEditor — **THE SEEDLING EDITOR'S DOM GLUE**, over
 * `procgenCore/editorView.js` (substrate-agnostic) and `watchEdit.js` (pure).
 * Plan `NewDocs/plans/seedling-editor-v3.md` §3.1, slices C1 and C2.
 *
 * ⛔ **WHAT IS HERE AND WHAT IS NOT.** Here: the CONTROLS — the entity
 * palette, the typed attribute form, the layer and 45-column tile picker, the
 * brush-mode selector, the ROOM-FLAGS form, the RESIZE form, the hovered-cell
 * readout and the two-oracle bound's readout. Not here: geometry (the page's
 * pixel→tile map), the record (the session's), the ops (`watchEdit`'s), the
 * tool machinery (`editorView`'s). This file's whole job is to turn a form
 * into an op AT THE PRESS and to turn a schema into a form.
 *
 * ── ⛓ THE ID RULE (EDITOR v3 C2) ──────────────────────────────────────
 *
 * `genEdit*` is a control BOTH ARMS mount (the `gen` prefix is history — free
 * editing was a `<details>` inside `#generatePanel` before the split, and
 * `check-seedling-editor-edit.mjs` drives eleven claims through those ids).
 * `edit*` is a control ONLY THE EDIT ARM has, i.e. one inside `#editOnly` —
 * the base identity line, the LOAD box, the downloads, the level-set picker.
 * ⛔ Everything this file touches is therefore `genEdit*`, and
 * `check-seedling-editor-arm.mjs` asserts the rule over the LIVE DOM.
 *
 * ── ⛓⛓⛓ THE DEFAULT PLACE TYPE HAS A NAME NOW ────────────────────────
 *
 * §11.5 item 4's ⛔: `watchViewer` read `ENTITY_ROSTER[0].type` as the page's
 * default, so the list and the default were the same fact and widening one
 * silently moved the other. They are two facts and they are separated here.
 *
 * ── ⛓ THE SCHEMA DRIVES THE OFFER, NEVER THE GATE ─────────────────────
 *
 * ⛔ `normalizeEdit` is called WITHOUT a schema on this page's ops, on
 * purpose. Law (b) — *the WORLD is the adjudicator* — is the reason the type
 * field is a free `<input>` with a `<datalist>` rather than a `<select>`, and
 * a schema handed to the op builder would turn the page's own stated law into
 * a dropdown that never let you ask. What the schema buys is the OFFER (144
 * types instead of 5, grouped by the folder the `.oep` files them under) and
 * the typed attribute FORM. A type outside it still reaches `buildLevelWorld`
 * and still refuses from the engine with its construction site, which is what
 * `check-seedling-editor-edit.mjs` claim 10 asserts and what keeps this page's
 * comment true.
 */

import {
    ENTITY_ROSTER_PROCGEN, ROOM_FLAG_CELL, ROOM_FLAG_TAGS, entityRosterFrom, flagModelReach,
    flagReachText, resizeWarnings, roomFlagOpRefusal, roomFlagRoster, roomFlagsIn,
    transcribeBoundText, untranscribedTypes,
} from './watchEdit.js';
import {
    LAYER_COLUMNS, RESIZE_ANCHORS, ROOM_TILES_MAX, ROOM_TILES_MIN, TERRAIN, TERRAIN_NAMES,
    TILE_LAYERS, columnOfSpec,
} from './procgenLevel.js';
/**
 * ⛓ EDITOR v3 C2 — the SEMANTICS table, for the column picker's GROUPS and for
 * a swatch's fallback. ⛔ It is the same table `procgenLevel` reads to build a
 * paint op, so the picker cannot group columns one way and paint them another.
 */
import {
    CLIFFSIDE_FRAME_FACES, TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES, tileSemantics,
} from '../flashPanel/seedlingSemantics.js';
import { TOOLS, UNDO_COMMAND_ID, mountEditorView } from '../procgenCore/editorView.js';
import { describeOps, descriptorFieldsOf } from '../procgenCore/editCore.js';

export class WatchEditorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WatchEditorError';
    }
}

const fail = (message) => { throw new WatchEditorError(message); };

/**
 * ⛓⛓⛓ **THE PAGE'S DEFAULT PLACE TYPE — A NAME, WITH ITS PROVENANCE.**
 *
 * ⛔ NOT `[0]` OF WHATEVER LIST THE DATALIST HOLDS. That spelling is what tied
 * the page's default to the roster's ORDER, so `entityRosterFrom(schema)`
 * (whose first key is `bob`, the `.oep`'s own first `<object>`) would have
 * silently changed what `check-seedling-editor-edit.mjs`'s `place` gesture
 * places — a browser gate moved by a data file, with nothing naming the tie.
 *
 * ⚠ PROVENANCE: it is **the first body `procgenPalette` places** — the head of
 * `ENTITY_ROSTER_PROCGEN`, the five-type roster slice 11 measured out of that
 * file — so this page opens on the type the generator itself builds, solves and
 * certifies in this exact room. The tie to that roster is ASSERTED below rather
 * than left as a coincidence, so the day the palette's first body changes this
 * constant fails loudly instead of drifting.
 */
export const DEFAULT_PLACE_TYPE = 'pushableblock';

/**
 * ⛓ …and the assertion that the literal above is the fact it claims to be.
 * ⛔ A literal WITH PROVENANCE is only that while something checks the
 * provenance; unchecked it is a literal with a story attached.
 */
export const DEFAULT_PLACE_ATTRS = (() => {
    const row = ENTITY_ROSTER_PROCGEN[0];
    if (!row || row.type !== DEFAULT_PLACE_TYPE) {
        fail(`watchEditor: DEFAULT_PLACE_TYPE is ${JSON.stringify(DEFAULT_PLACE_TYPE)} `
            + '"the first body `procgenPalette` places", but `ENTITY_ROSTER_PROCGEN[0]` is '
            + `${JSON.stringify(row?.type ?? null)}. ⛔ The provenance is the whole licence `
            + 'for the literal — fix one or the other, do not let them part.');
    }
    return row.attrs;
})();

/** ⛓ The label the "no folder filter" option carries — one spelling. */
export const ALL_FOLDERS = '(all)';

/**
 * ⛓⛓ **THE OFFERED VOCABULARY** — the wide one when the schema reached the
 * page, the frozen five when it did not.
 *
 * ⚠ **THE FALLBACK IS NOT A SILENT ONE.** A page whose schema fetch failed
 * offers slice 11's five types and SAYS which list it is showing, because
 * "the type I wanted is not in the list" and "the list is the small one" are
 * the same symptom with different cures.
 */
export function rosterFor(schema) {
    return schema ? entityRosterFrom(schema) : ENTITY_ROSTER_PROCGEN;
}

/** ⛓ The folders a roster spans, DERIVED and in first-appearance order. */
export function foldersOf(roster) {
    const out = [];
    for (const r of roster) {
        if (r.folder && !out.includes(r.folder)) out.push(r.folder);
    }
    return Object.freeze(out);
}

/**
 * ⛓⛓⛓ **ONE ENTITY'S ATTRIBUTE FORM, AS DATA** — one row per value the
 * `.oep` declares for that type, with the input kind the declaration implies.
 *
 * ⛔ **AN UNKNOWN TYPE GETS NO ROWS AND THAT IS AN ANSWER, NOT AN ERROR.** The
 * type field is free (law (b)); a type the schema does not declare simply has
 * nothing to generate a form from, and the raw JSON box below the form is
 * where it is spelled. Refusing here would refuse the page's own law.
 *
 * ⚠ `min`/`max`/`maxChars` RIDE ALONG so the input can carry them as
 * attributes — the SAME numbers `coerceAttrValue` enforces, read from the same
 * declaration, so the control cannot advertise a range the op refuses.
 */
export function attrFormRows(schema, type) {
    const decl = schema?.entities?.[type];
    if (!decl) return Object.freeze([]);
    return Object.freeze(decl.values.map((v) => Object.freeze({
        name: v.name,
        type: v.type,
        // ⚠ `null` is a REAL answer — three of the 166 declared values have no
        // default (§11.5) and inventing one would write an attribute the
        // author never gave a value for.
        default: v.default ?? null,
        min: v.min ?? null,
        max: v.max ?? null,
        maxChars: v.maxChars ?? null,
        // ⛓ Ogmo's four value types → the two input kinds a browser has for
        // them. DERIVED from the declaration, never from the value's name.
        control: v.type === 'boolean' ? 'checkbox'
            : (v.type === 'integer' || v.type === 'number' ? 'number' : 'text'),
        step: v.type === 'integer' ? '1' : (v.type === 'number' ? 'any' : null),
    })));
}

/**
 * ⛓⛓ **THE FORM'S VALUES → THE ATTRS OBJECT.** ⛔ **EMPTY MEANS OMITTED**, and
 * that is `fillDefaults` OFF as a control: §11.5 item 2 measured that 183 of
 * the atlas's 2,461 entity instances legitimately carry no value for an
 * attribute that HAS a declared default, so a form that wrote every default
 * would make every hand placement carry attributes the corpus itself does not.
 *
 * ⚠ A CHECKBOX IS NEVER EMPTY, so a `boolean` row always contributes — there
 * is no third state in an `<input type=checkbox>` to spell "omitted" with, and
 * inventing one (a tri-state select) would be a control this format has no
 * word for.
 */
export function attrsFromRows(rows, read) {
    const out = {};
    for (const row of rows) {
        const raw = read(row);
        if (row.control === 'checkbox') {
            out[row.name] = raw ? 'true' : 'false';
            continue;
        }
        const text = String(raw ?? '').trim();
        if (text === '') continue;
        out[row.name] = text;
    }
    return out;
}

/**
 * ⛓⛓⛓ **THE ENTITY PALETTE, MOUNTED ON THE PAGE'S OWN IDS.**
 *
 * ⛔ **THE JSON BOX STAYS THE ONE VALUE THE OP READS.** The typed form WRITES
 * it and re-reads it; nothing else does. Two stores for one value is the
 * `armed` mistake in another costume, and this way a type the schema does not
 * declare — which has no form — still has somewhere to spell its attributes,
 * and every existing driver of `#genEditAttrs` (the 59-check row fills it
 * twice) keeps working unchanged.
 *
 * @param {object} o
 * @param {HTMLElement} o.typeInput   the free `<input>` (`#genEditType`)
 * @param {HTMLElement} o.typeList    its `<datalist>` (`#genEditTypes`)
 * @param {HTMLElement} o.folderSel   the folder filter `<select>`
 * @param {HTMLElement} o.attrsInput  the raw JSON `<input>` (`#genEditAttrs`)
 * @param {HTMLElement} o.attrsForm   the container the typed rows go in
 * @param {HTMLElement} o.rosterNote  where the "which list is this" line goes
 * @param {object|null} o.schema      the `.oep` extract, or `null`
 * @param {object} o.lifetime         the arm's lifetime (every listener rides it)
 */
export function mountEntityPalette({
    typeInput, typeList, folderSel, attrsInput, attrsForm, rosterNote,
    schema = null, lifetime, doc = globalThis.document,
} = {}) {
    for (const [name, v] of [
        ['typeInput', typeInput], ['typeList', typeList], ['folderSel', folderSel],
        ['attrsInput', attrsInput], ['attrsForm', attrsForm], ['lifetime', lifetime],
    ]) {
        if (!v) {
            fail(`watchEditor: \`${name}\` is required — ⛔ refused by name rather than `
                + 'skipped, so a half-wired palette cannot boot looking whole.');
        }
    }
    const roster = rosterFor(schema);
    const folders = foldersOf(roster);

    /* ── THE DATALIST, AND THE FOLDER FILTER OVER IT ───────────────── */

    /**
     * ⛓ **WHY A FILTER AND NOT AN `<optgroup>`.** A `<datalist>` has no group
     * rendering in any engine — `<optgroup>` inside one is inert — so the only
     * place a folder can show is the option's own `label`, which browsers put
     * beside the value. 144 undivided suggestions is a list nobody can walk,
     * so the folder is BOTH: it is in every option's label AND it is a
     * `<select>` that narrows the list to one folder. ⛔ The free input is
     * untouched by the filter — narrowing what is SUGGESTED must never narrow
     * what can be TYPED, which is law (b).
     */
    folderSel.innerHTML = '';
    for (const f of [ALL_FOLDERS, ...folders]) {
        const o = doc.createElement('option');
        o.value = f;
        o.textContent = f === ALL_FOLDERS ? `${ALL_FOLDERS} — ${roster.length} type(s)` : f;
        folderSel.appendChild(o);
    }
    folderSel.value = ALL_FOLDERS;
    folderSel.hidden = folders.length === 0;

    const fillList = () => {
        const pick = folderSel.value;
        typeList.innerHTML = '';
        for (const e of roster) {
            if (pick !== ALL_FOLDERS && e.folder !== pick) continue;
            const o = doc.createElement('option');
            o.value = e.type;
            o.label = e.why;
            typeList.appendChild(o);
        }
    };

    /* ── THE TYPED ATTRIBUTE FORM ──────────────────────────────────── */

    let rows = [];
    const inputs = new Map();

    /** ⛓ The form → the JSON box. ONE direction, one writer. */
    const formToJson = () => {
        const attrs = attrsFromRows(rows, (row) => {
            const el = inputs.get(row.name);
            return row.control === 'checkbox' ? el.checked : el.value;
        });
        attrsInput.value = JSON.stringify(attrs);
    };

    /**
     * ⛓ …and the JSON box → the form, which is how a hand-typed box (or a
     * gate's `page.fill`) stays the truth. ⛔ AN UNPARSEABLE BOX LEAVES THE
     * FORM ALONE rather than clearing it: the box is what the op reads, so a
     * form that emptied itself would look like the attributes had been
     * deleted when in fact they are being typed.
     */
    const jsonToForm = () => {
        let attrs = null;
        try {
            const raw = attrsInput.value.trim();
            attrs = raw === '' ? {} : JSON.parse(raw);
        } catch { return; }
        if (!attrs || typeof attrs !== 'object') return;
        for (const row of rows) {
            const el = inputs.get(row.name);
            const has = Object.prototype.hasOwnProperty.call(attrs, row.name);
            if (row.control === 'checkbox') el.checked = has && String(attrs[row.name]) === 'true';
            else el.value = has ? String(attrs[row.name]) : '';
        }
    };

    const buildForm = (type) => {
        rows = attrFormRows(schema, type);
        inputs.clear();
        attrsForm.innerHTML = '';
        if (rows.length === 0) {
            attrsForm.textContent = schema
                ? `${JSON.stringify(type)}: ${schema.entities[type] ? 'no declared values'
                    : 'not declared by Shrum.oep — the box below is the only spelling, and '
                        + 'the ENGINE is what adjudicates it (law (b))'}`
                : '';
            return;
        }
        for (const row of rows) {
            const label = doc.createElement('label');
            label.className = 'attrRow';
            label.textContent = `${row.name} `;
            label.title = `${row.type}`
                + (row.default === null ? ' · no declared default' : ` · default ${row.default}`)
                + (row.min === null ? '' : ` · min ${row.min}`)
                + (row.max === null ? '' : ` · max ${row.max}`)
                + (row.maxChars === null ? '' : ` · ≤${row.maxChars} chars`);
            const el = doc.createElement('input');
            el.dataset.attr = row.name;
            if (row.control === 'checkbox') {
                el.type = 'checkbox';
            } else {
                el.type = row.control;
                el.style.width = row.control === 'number' ? '5em' : '8em';
                if (row.step) el.step = row.step;
                if (row.min !== null) el.min = String(row.min);
                if (row.max !== null) el.max = String(row.max);
                if (row.maxChars !== null) el.maxLength = row.maxChars;
                el.placeholder = row.default === null ? '(no default)' : String(row.default);
            }
            inputs.set(row.name, el);
            label.appendChild(el);
            attrsForm.appendChild(label);
            lifetime.on(el, 'input', formToJson);
            lifetime.on(el, 'change', formToJson);
        }
        jsonToForm();
    };

    /**
     * ⛓ THE TYPE CHANGED: rebuild the form, and SUGGEST the roster's starting
     * attributes. ⚠ A suggestion, not a rewrite — the page's own pre-existing
     * rule, kept: a type the roster does not know leaves whatever you had typed
     * standing, because the page has nothing to suggest for it.
     */
    const onType = () => {
        const type = typeInput.value.trim();
        const row = roster.find((e) => e.type === type);
        if (row) attrsInput.value = JSON.stringify(row.attrs);
        buildForm(type);
    };

    fillList();
    lifetime.on(folderSel, 'change', fillList);
    lifetime.on(typeInput, 'change', onType);
    lifetime.on(attrsInput, 'input', jsonToForm);

    if (rosterNote) {
        rosterNote.textContent = schema
            ? `${roster.length} type(s) from Shrum.oep across ${folders.length} folder(s) — `
                + 'the folder box narrows the SUGGESTIONS only; any type is still typeable, '
                + 'and the ENGINE is the adjudicator.'
            : `⚠ the Ogmo schema did not load — showing the ${roster.length} type(s) `
                + '`procgenPalette` itself places. Any type is still typeable.';
    }

    return {
        roster,
        folders,
        /** ⛓ Set the type AND bring the form and the box with it. */
        setType(type) {
            typeInput.value = type;
            onType();
        },
        rows: () => rows,
        refresh: onType,
    };
}

/**
 * ⛓⛓ **THE TWO-ORACLE BOUND'S READOUT** — the sentence `watchEdit` builds,
 * put where a reader sees it, or the box emptied when there is nothing to say.
 *
 * ⛔ ONE WRITER, called from the page's one draw, exactly like
 * `renderCertification` beside it.
 */
export function renderTranscribeBound(box, record, entityClasses) {
    if (!box) return null;
    const types = untranscribedTypes(record ?? { entities: [] }, entityClasses);
    const text = transcribeBoundText(types);
    box.textContent = text ?? '';
    box.className = text ? 'note bad' : 'note';
    box.hidden = !text;
    return types;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE TILE PICKER — EDITOR v3 SLICE C2
 *
 * §3.3 Tier A's *"all 45 tile columns, grouped by `TILE_COLUMN_TO_TYPE`"*.
 * `paint {layer, column}` has reached both layers and all 45 columns since
 * slice B; what the page had was four names, which is the vocabulary the
 * GENERATOR reasons about and not the one a person editing a vanilla room is
 * looking at.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **A PAINT OPTION'S VALUE, AND WHY IT IS TWO SPELLINGS.**
 *
 * ⛔ THE FOUR TERRAIN NAMES KEEP SPELLING THEMSELVES (`value="ground"`). They
 * are what `procgenPalette` writes, what every committed `?gen=` payload
 * carries and what three browser rows drive by `selectOption('ground')` — and
 * `{terrain:'ground'}` and `{column:0}` are two DIFFERENT ops that fold to the
 * same record, so respelling them would have moved bytes in payloads this
 * slice must leave inert. The other 41 columns have no name and spell
 * `column:N`, which is the op `Game.as`'s own 45-case switch reads.
 */
export const COLUMN_VALUE = (column) => `column:${column}`;

/** ⛓ …and its inverse: an option's value → the `paint` op's spec fields. */
export function paintSpecOf(value) {
    const text = String(value ?? '');
    if (!text.startsWith('column:')) return { terrain: text };
    const column = Number(text.slice('column:'.length));
    if (!Number.isInteger(column)) {
        fail(`watchEditor: ${JSON.stringify(text)} is not a paint option — they are either `
            + `one of the four terrain NAMES [${TERRAIN_NAMES.join(', ')}] or `
            + '`column:N`, and nothing else can reach this `<select>`.');
    }
    return { column };
}

/**
 * ⛓⛓⛓ **THE OPTION GROUPS OF ONE LAYER, DERIVED — never a typed table.**
 *
 * `tiles` — the four TERRAIN names first (the group a generator reader is
 * looking for), then every column of `TILE_COLUMN_TO_TYPE` grouped by what the
 * ENGINE does with the type it builds. ⛔ The grouping key is
 * `tileSemantics(type).kind` and NOT the type NAME: 45 columns carry 38
 * distinct type names, so grouping by name is 38 groups of one and is no
 * grouping at all, while `CELL_KINDS` is the six-way answer
 * `seedlingSemantics` already computes for the analyzer — walkable, wall,
 * gated, one-way, a pit that leaves the room, and the one whose cost no static
 * rule expresses. That is plan §3.3's *"walkable / solid / lethal / pit"* as
 * the table actually spells it.
 *
 * `cliffsides` — the five pixelmasks `CliffSide.as:19-32` switches over,
 * grouped by which FACE each one blocks (`CLIFFSIDE_FRAME_FACES`, with frames
 * ≥ 4 falling into the default arm's N). ⛔ No terrain names: `columnOfSpec`
 * refuses one on this layer BY NAME, because the four are (column, TILE type)
 * pairs and this layer's columns are masks.
 */
export function paintOptionGroups(layer) {
    const columns = LAYER_COLUMNS[layer];
    if (columns === undefined) {
        fail(`watchEditor: ${JSON.stringify(layer)} is not one of this game's tile layers `
            + `[${TILE_LAYERS.join(', ')}].`);
    }
    const groups = [];
    const into = (label, row) => {
        const g = groups.find((x) => x.label === label);
        if (g) g.options.push(row);
        else groups.push({ label, options: [row] });
    };
    if (layer === 'tiles') {
        groups.push({
            label: `the GENERATOR's ${TERRAIN_NAMES.length} terrain names`,
            options: TERRAIN_NAMES.map((name) => ({
                value: name,
                label: `${name} — column ${TERRAIN[name].column}`,
                column: TERRAIN[name].column,
                type: TERRAIN[name].type,
            })),
        });
        for (let column = 0; column < columns; column += 1) {
            const type = TILE_COLUMN_TO_TYPE[column];
            const kind = tileSemantics(type).kind;
            into(`${kind}`, {
                value: COLUMN_VALUE(column),
                label: `${column} · ${TILE_TYPE_NAMES[type] ?? `type ${type}`}`,
                column,
                type,
            });
        }
        return Object.freeze(groups.map((g) => Object.freeze({
            label: g.label, options: Object.freeze(g.options.map(Object.freeze)),
        })));
    }
    for (let column = 0; column < columns; column += 1) {
        const faces = Object.keys(CLIFFSIDE_FRAME_FACES[column] ?? { N: null }).join('');
        into(`blocks the ${faces} face(s)`, {
            value: COLUMN_VALUE(column),
            label: `${column} · pixelmask ${faces}`,
            column,
            type: null,
        });
    }
    return Object.freeze(groups.map((g) => Object.freeze({
        label: g.label, options: Object.freeze(g.options.map(Object.freeze)),
    })));
}

/**
 * ⛓⛓ **THE SWATCH IS THE CANVAS'S OWN COLOUR, HANDED IN.**
 *
 * ⚠ **THERE IS NO TILESET IMAGE TO SHOW, MEASURED.** The brief asked for the
 * tile IMAGE *"if the tileset PNG is served"*: it is not — there is not one
 * `.png` under `frontend/modules/flashPanel/` at all, and the art lives inside
 * the recompiled `.wasm` (`seedling_bot_ap_p4b.wasm`), which is where the SWF
 * put it. ⇒ a colour swatch, and it is the SAME table `previewLevel` paints the
 * canvas with, INJECTED rather than copied: a picker with its own palette would
 * show a reader one colour and paint them another.
 *
 * ⚠ AND THE FALLBACK IS THE CANVAS'S TOO — anything the table does not name is
 * floor, unless the semantics call the type a wall.
 */
export function swatchColour(type, { tileColours = null, solidColour = null, floorColour = null } = {}) {
    if (type === null || type === undefined) return floorColour;
    if (tileColours && tileColours[type]) return tileColours[type];
    return tileSemantics(type).kind === 'wall' ? solidColour : floorColour;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ROOM-FLAGS FORM — EDITOR v3 SLICE C2
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **ONE FLAG'S CONTROLS, AS DATA** — a presence CHECKBOX always, plus one
 * typed input per value `Shrum.oep` declares for that tag. ⛔ It reuses
 * `attrFormRows` rather than growing a second typed-form builder: a flag's
 * values are declared exactly the way a body's are, and two builders would be
 * two answers to *"what input does an Ogmo `boolean` get"*.
 */
export function flagFormRows(schema, tag) {
    return attrFormRows(schema, tag);
}

/**
 * ⛓⛓⛓ **MOUNT THE ROOM-FLAGS FORM.**
 *
 * ⛔ **IT WRITES THROUGH THE SESSION, NEVER THE RECORD.** Every change is a
 * `place` / `remove` / `attrs` op applied through `view.apply`, so UNDO, the
 * payload, the identity line and the certification drop all see a flag change
 * exactly as they see a brush stroke. A form that reached for the record would
 * be a second writer and the op list would stop being the level's identity.
 *
 * ⛔⛔ **AND TWO OF ITS THREE OPS CAN BE INEXPRESSIBLE.** `remove` and `attrs`
 * address *the last entity in the cell*; a flag that is not the last body in
 * its own cell cannot be named by either (`watchEdit.roomFlagOpRefusal`, and
 * MEASURED: 2 of the committed atlas's 155 flag instances sit that way). The
 * form REFUSES those by name and reverts the control rather than editing
 * somebody else's body — a checkbox that silently deleted a `<rock>` would be
 * the worst kind of working.
 */
export function mountRoomFlags({
    box, noteEl, reachEl, host, view, schema, lifetime, buildWorld = null,
    doc = globalThis.document,
} = {}) {
    for (const [name, v] of [['box', box], ['host', host], ['view', view], ['lifetime', lifetime]]) {
        if (!v) fail(`watchEditor: mountRoomFlags \`${name}\` is required — refused by name.`);
    }
    if (!schema) {
        box.textContent = '⚠ the Ogmo schema did not load, so there is no declaration to build '
            + 'the flag form from. The flags are still `place`/`attrs`/`remove` ops on the '
            + 'brush palette above; what is missing here is the typed form.';
        return { rows: () => [], render: () => {}, roster: [] };
    }
    const roster = roomFlagRoster(schema);
    /**
     * ⛓ THE TAGS `Game.as` CALLS A LEVEL PROPERTY AND `Shrum.oep` DOES NOT
     * DECLARE — said out loud rather than silently dropped. The two lists come
     * from two files and a tag in one and not the other is worth seeing.
     */
    const undeclared = ROOM_FLAG_TAGS.filter((t) => !schema.entities[t]);

    const inputs = new Map();      // `${tag}:${valueName}` -> element
    const boxes = new Map();       // tag -> the presence checkbox
    const notes = new Map();       // tag -> that row's own note span

    /* ── THE FORM, BUILT ONCE ─────────────────────────────────────── */

    box.innerHTML = '';
    for (const row of roster) {
        const line = doc.createElement('div');
        line.className = 'line';
        line.dataset.flag = row.tag;
        const label = doc.createElement('label');
        const cb = doc.createElement('input');
        cb.type = 'checkbox';
        cb.id = `genEditFlag_${row.tag}`;
        cb.dataset.flag = row.tag;
        label.appendChild(cb);
        label.appendChild(doc.createTextNode(` ${row.tag}`));
        line.appendChild(label);
        boxes.set(row.tag, cb);
        for (const v of flagFormRows(schema, row.tag)) {
            const l = doc.createElement('label');
            l.textContent = ` ${v.name} `;
            l.title = `${v.type}`
                + (v.default === null ? ' · no declared default' : ` · default ${v.default}`)
                + (v.min === null ? '' : ` · min ${v.min}`)
                + (v.max === null ? '' : ` · max ${v.max}`);
            const el = doc.createElement('input');
            el.id = `genEditFlag_${row.tag}_${v.name}`;
            el.dataset.flag = row.tag;
            el.dataset.attr = v.name;
            if (v.control === 'checkbox') {
                el.type = 'checkbox';
            } else {
                el.type = v.control;
                el.style.width = v.control === 'number' ? '5em' : '7em';
                if (v.step) el.step = v.step;
                if (v.min !== null) el.min = String(v.min);
                if (v.max !== null) el.max = String(v.max);
                if (v.maxChars !== null) el.maxLength = v.maxChars;
                el.placeholder = v.default === null ? '(no default)' : String(v.default);
            }
            inputs.set(`${row.tag}:${v.name}`, el);
            l.appendChild(el);
            line.appendChild(l);
        }
        const n = doc.createElement('span');
        n.className = 'note';
        n.id = `genEditFlagNote_${row.tag}`;
        notes.set(row.tag, n);
        line.appendChild(n);
        box.appendChild(line);
    }

    /* ── READING THE RECORD ───────────────────────────────────────── */

    const say = (text, bad = false) => {
        if (!noteEl) return;
        noteEl.textContent = text;
        noteEl.className = bad ? 'note bad' : 'note';
    };

    const present = () => {
        const map = new Map();
        for (const f of roomFlagsIn(host.record())) map.set(f.tag, f);
        return map;
    };

    /** ⛓ The typed inputs of one row → an attrs object. EMPTY MEANS OMITTED —
     *  `attrsFromRows`' own rule, and the same reason (§11.5 item 2). */
    const attrsOf = (tag) => attrsFromRows(flagFormRows(schema, tag), (r) => {
        const el = inputs.get(`${tag}:${r.name}`);
        return r.control === 'checkbox' ? el.checked : el.value;
    });

    /* ── ⛓⛓ THE REACH READOUT, MEASURED AND MEMOISED BY RECORD ────── */

    let reachFor = null;
    let reachOf = null;
    const reachNow = () => {
        const record = host.record();
        if (!buildWorld || !record) return null;
        if (reachFor === record) return reachOf;
        reachOf = flagModelReach(record, buildWorld, {
            tags: roster.map((r) => r.tag),
            attrsFor: (t) => Object.fromEntries((schema.entities[t]?.values ?? [])
                .filter((v) => v.default !== null && v.default !== undefined)
                .map((v) => [v.name, v.default])),
        });
        reachFor = record;
        return reachOf;
    };

    const render = () => {
        const here = present();
        for (const row of roster) {
            const f = here.get(row.tag);
            boxes.get(row.tag).checked = Boolean(f);
            for (const v of flagFormRows(schema, row.tag)) {
                const el = inputs.get(`${row.tag}:${v.name}`);
                const has = f && Object.prototype.hasOwnProperty.call(f.attrs, v.name);
                if (v.control === 'checkbox') el.checked = Boolean(has) && String(f.attrs[v.name]) === 'true';
                else el.value = has ? String(f.attrs[v.name]) : '';
            }
            const n = notes.get(row.tag);
            if (!f) n.textContent = '';
            else if (!f.last) {
                n.textContent = `⛔ at (${f.tx},${f.ty}) and NOT the last body there — `
                    + 'this row cannot be changed (see the note below)';
                n.className = 'note bad';
            } else {
                n.textContent = `at (${f.tx},${f.ty})`;
                n.className = 'note';
            }
        }
        if (reachEl) {
            const text = flagReachText(reachNow());
            reachEl.textContent = text ?? '';
            reachEl.hidden = !text;
        }
        if (noteEl && !noteEl.textContent) {
            say(`${here.size} of ${roster.length} flag(s) set in this room. A NEW flag is `
                + `placed at (${ROOM_FLAG_CELL.tx},${ROOM_FLAG_CELL.ty}) — the origin, which `
                + 'is where the committed 116 rooms put theirs; an existing one is read, '
                + 'written and removed AT ITS OWN CELL.'
                + (undeclared.length
                    ? ` ⚠ ${undeclared.join(', ')} is a level property \`Game.as\` reads and `
                        + '`Shrum.oep` does not declare, so it has no row here.'
                    : ''));
        }
    };

    /* ── THE THREE OPS ────────────────────────────────────────────── */

    const guard = (tag, what) => {
        const f = present().get(tag);
        const why = roomFlagOpRefusal(host.record(), f, what);
        if (why) {
            say(why, true);
            render();
            return null;
        }
        return f;
    };

    for (const row of roster) {
        lifetime.on(boxes.get(row.tag), 'change', () => {
            say('');
            const want = boxes.get(row.tag).checked;
            const f = present().get(row.tag);
            if (want && !f) {
                view.apply({
                    op: 'place',
                    tx: ROOM_FLAG_CELL.tx,
                    ty: ROOM_FLAG_CELL.ty,
                    type: row.tag,
                    attrs: attrsOf(row.tag),
                });
                return;
            }
            if (!want && f) {
                if (guard(row.tag, 'remove') === null) return;
                view.apply({ op: 'remove', tx: f.tx, ty: f.ty });
                return;
            }
            render();
        });
        for (const v of flagFormRows(schema, row.tag)) {
            lifetime.on(inputs.get(`${row.tag}:${v.name}`), 'change', () => {
                say('');
                const f = present().get(row.tag);
                if (!f) {
                    say(`⛓ <${row.tag}> is not in this room — tick the box to place it, and `
                        + 'the values you have typed go on with it.');
                    return;
                }
                if (guard(row.tag, 'attrs') === null) return;
                view.apply({ op: 'attrs', tx: f.tx, ty: f.ty, attrs: attrsOf(row.tag) });
            });
        }
    }

    render();
    return { roster, render, reach: reachNow, undeclared };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE RESIZE CONTROL — ⚖ RULING 5, EDITOR v3 SLICE C2
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **MOUNT THE RESIZE FORM.**
 *
 * ⛔ **⚖ RULING 5's WARNING IS SHOWN BEFORE THE OP, AND AGAIN AFTER IT.**
 * Before: `resizeWarnings(record, op)` on the values in the boxes, redrawn as
 * they are typed — a preview line with no confirm behind it, because ruling 5
 * says the edit is never blocked and a modal would be a block wearing a
 * question's clothes. After: the same sentences, from `foldEdits().steps` via
 * the adapter's own `describeApplied`, so the readout and the preview cannot
 * disagree about a room they are both describing.
 *
 * ⛔ **A CROP THAT WOULD DROP SOMETHING IS REFUSED BY THE OP AND PRINTED
 * VERBATIM.** `procgenLevel.resizeRoom` names the tiles and the bodies that
 * lie outside the new rectangle; a page that paraphrased it would be a second
 * opinion about which cells are in danger, and the reader would have to guess
 * which to believe.
 */
export function mountResizeControl({
    widthEl, heightEl, anchorEl, goEl, noteEl, host, adapter, view, lifetime,
    doc = globalThis.document,
} = {}) {
    for (const [name, v] of [
        ['widthEl', widthEl], ['heightEl', heightEl], ['anchorEl', anchorEl],
        ['goEl', goEl], ['host', host], ['adapter', adapter], ['view', view],
        ['lifetime', lifetime],
    ]) {
        if (!v) fail(`watchEditor: mountResizeControl \`${name}\` is required — refused by name.`);
    }
    /** ⛓ THE ANCHORS ARE `procgenLevel`'s OWN LIST — one today (§11.9 bound 5),
     *  and a second one arrives here as an option rather than as an edit. */
    anchorEl.innerHTML = RESIZE_ANCHORS
        .map((a) => `<option value="${a}">${a}</option>`).join('');
    anchorEl.value = RESIZE_ANCHORS[0];
    for (const el of [widthEl, heightEl]) {
        el.min = String(ROOM_TILES_MIN);
        el.max = String(ROOM_TILES_MAX);
        el.step = '1';
    }

    const opNow = () => ({
        op: 'resize',
        width: Number(widthEl.value),
        height: Number(heightEl.value),
        anchor: anchorEl.value,
    });

    /**
     * ⛓ THE PREVIEW. ⛔ It says the SIZE LIMITS itself rather than letting the
     * op refuse them silently through an `<input min>` the browser may or may
     * not enforce — `assertRoomSize` is the authority and this quotes its
     * bounds from the same constants.
     */
    const preview = () => {
        const record = host.record();
        if (!record) return;
        const op = opNow();
        if (!Number.isInteger(op.width) || !Number.isInteger(op.height)) {
            noteEl.textContent = 'width and height are whole numbers of TILES.';
            noteEl.className = 'note';
            return;
        }
        const bad = [op.width, op.height]
            .some((v) => v < ROOM_TILES_MIN || v > ROOM_TILES_MAX);
        const warnings = resizeWarnings(record, op);
        const same = op.width === record.width && op.height === record.height;
        noteEl.className = bad ? 'note bad' : 'note';
        noteEl.textContent = (bad
            ? `⛔ ${ROOM_TILES_MIN}..${ROOM_TILES_MAX} tiles per axis — `
                + `${ROOM_TILES_MAX} is the VANILLA MAXIMUM measured over the 116 rooms. `
            : '')
            + (same ? `the room is already ${op.width}x${op.height} — a resize to its own `
                + 'size changes no bytes and is not an edit (law: a click that changed '
                + 'nothing is not an edit). ' : '')
            + `${record.width}x${record.height} → ${op.width}x${op.height} (${op.anchor}). `
            + (warnings.length
                ? `⚠ BEFORE YOU PRESS: ${warnings.join(' · ')}`
                : '⚠ nothing to warn about for THIS room — no compiled-in boss geometry, and '
                    + 'no new cells (⚖ ruling 5\'s warning is about what the room HOLDS).');
    };

    const reset = () => {
        const record = host.record();
        if (!record) return;
        widthEl.value = String(record.width);
        heightEl.value = String(record.height);
        preview();
    };

    lifetime.on(widthEl, 'input', preview);
    lifetime.on(heightEl, 'input', preview);
    lifetime.on(anchorEl, 'change', preview);
    lifetime.on(goEl, 'click', () => {
        const res = view.apply(opNow());
        /**
         * ⛔ THE REFUSAL IS PRINTED VERBATIM, and it is the OP's own sentence —
         * `resizeRoom` names the tiles and bodies that would be dropped.
         */
        if (!res.ok) {
            noteEl.className = 'note bad';
            noteEl.textContent = res.description;
            return;
        }
        noteEl.className = 'note';
        noteEl.textContent = res.applied
            ? res.description
            : `${res.description} — and it changed no bytes, so it is not in the edit list.`;
    });

    return { preview, reset, opNow };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ **THE MOUNT — ONE EDIT IMPLEMENTATION, TWO HOSTS** (plan §3.1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ **THE BRUSH MODES** — what a brush STROKE writes. ⛔ These are the page's
 * five `<select>` options and they are NOT `editorView`'s tools: a TOOL is a
 * GESTURE (brush · rect · paste · flood · the AT… template arm) and a MODE is
 * what the brush gesture puts down. They were one control before this slice
 * because there was only one gesture.
 */
export const BRUSH_MODES = Object.freeze(['off', 'paint', 'place', 'attrs', 'remove']);

/**
 * ⛓ The sentence the edit section shows — it says what a click will DO before
 * it is clicked. ⛔ MOVED VERBATIM from `runGenerate`: the words are slice 11's
 * and this slice is a relocation, so changing them here would have hidden a
 * behaviour change inside a refactor's diff.
 */
export const brushNoteText = (mode) => ({
    off: 'no edit tool — clicks on the level do nothing (AT… still arms a template).',
    paint: '⛓ PAINT ARMED: the clicked tile becomes the selected terrain. ⛔ The border '
        + 'ring is editable too, and NOTHING here checks legality — free means free, and '
        + 'the ORACLE is the guard (press SOLVE). Escape cancels.',
    place: '⛓ PLACE ARMED: the entity type below is placed at the clicked tile\'s OEL '
        + 'corner with the attributes in the box, LITERALLY (no activator-group '
        + 'derivation — a hand placement has no anchor to derive from). Escape cancels.',
    attrs: '⛓ ATTRS ARMED: the clicked tile\'s LAST entity has its attributes REPLACED by '
        + 'the box (not merged — clearing a field is spelled by leaving it out). '
        + 'Escape cancels.',
    remove: '⛓ REMOVE ARMED: the clicked tile\'s LAST entity is deleted. A tile holding '
        + 'none refuses BY NAME rather than doing nothing. Escape cancels.',
}[mode] ?? '');

/**
 * ⛓⛓ **§11.9 BOUND 1, SAID BEFORE A PASTE LANDS.** A Seedling paste does not
 * CLEAR the destination's bodies — `writeOps` sees a DESCRIPTOR and cannot know
 * how many `remove`s to emit — so a paste onto an occupied cell ACCUMULATES.
 *
 * ⛔ THE PAGE SUPPLIES THE SENTENCE AND `editorView` GUARANTEES IT IS PRINTED
 * BEFORE rather than after (A2 §10.2 departure 2). A substrate-agnostic file
 * cannot count bodies; this can, and it counts them in the CLIP, which is what
 * the reader is about to put down.
 */
export function seedlingClipWarnings(clip, record, adapter) {
    const out = [];
    const bodies = (clip?.cells ?? [])
        .flat().reduce((n, c) => n + (c?.entities?.length ?? 0), 0);
    if (bodies > 0) {
        out.push(`the clip carries ${bodies} body/bodies and a paste ADDS them — it does NOT `
            + 'clear the destination, so a cell that already holds one will hold both '
            + '(§11.9 bound 1)');
    }
    if (record && adapter) {
        let occupied = 0;
        const b = adapter.bounds(record);
        for (let y = 0; y < b.h; y += 1) {
            for (let x = 0; x < b.w; x += 1) {
                if (adapter.readCell(record, x, y).entities.length > 0) occupied += 1;
            }
        }
        if (occupied > 0 && bodies > 0) {
            out.push(`${occupied} cell(s) of this room already hold a body`);
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **MOUNT THE EDITING SECTION OVER A HOST.**
 *
 * ⛔ **THE HOST IS THE SEAM, AND IT IS WHY THERE ARE TWO ARMS AND ONE
 * IMPLEMENTATION.** `editorView` needs `{apply, ops, record}` — the shape
 * `editCore.createEditSession` returns. The EDIT arm hands it exactly that. The
 * GENERATE arm hands it a thin object over its own `generateStep` state, which
 * folds through `watchEdit.editState` — so the GENERATE payload, the `?gen=`
 * replay and every committed fixture stay byte-identical BY CONSTRUCTION rather
 * than by a comparison somebody has to remember to make.
 *
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {object} o.host      `{apply, undo, ops, record, certified, setCertified}`
 * @param {object} o.adapter   `createSeedlingEditAdapter(...)`
 * @param {Function} o.cellAt  the page's pixel→tile map, as an event handler
 * @param {object[]} o.commands the HOST's command rows (undo, solve, download…)
 * @param {object[]} o.tools    the HOST's own gestures (GENERATE's AT… arm)
 * @param {object} o.lifetime
 */
export function mountWatchEditor({
    canvas, host, adapter, cellAt, lifetime, schema = null,
    commands = [], tools = [], say = () => {}, onChange = null, onDisarm = null,
    entityClasses = null,
    /**
     * ⛓ EDITOR v3 C2 — the MODEL's builder, for the room-flags reach readout.
     * ⛔ A PARAMETER for the same reason `entityClasses` is one: which model is
     * being asked is the host's fact, and a module that imported one would be a
     * second opinion about it. Absent, the reach line simply does not appear.
     */
    buildWorld = null,
    /**
     * ⛓ …and the CANVAS's own tile palette, injected. ⚠ There is no tileset PNG
     * in this repo (measured: not one `.png` under `frontend/modules/flashPanel/`
     * — the art is inside the recompiled `.wasm`), so the column picker shows a
     * SWATCH, and it must be the colour the canvas actually paints or the picker
     * would show one thing and the room another.
     */
    tileColours = null, solidColour = null, floorColour = null,
    doc = globalThis.document,
} = {}) {
    const $ = (id) => doc.getElementById(id);
    for (const [name, v] of [
        ['canvas', canvas], ['host', host], ['adapter', adapter], ['cellAt', cellAt],
        ['lifetime', lifetime],
    ]) {
        if (!v) fail(`watchEditor: \`${name}\` is required — refused by name.`);
    }

    /**
     * ⛓ **THE TERRAIN PICKER, FROM `procgenLevel`'s OWN VOCABULARY** — moved
     * here from `runGenerate` with the section it belongs to. ⛔ It has to be
     * here and not in the GENERATE arm: the EDIT arm mounts the same DOM, and a
     * picker filled by only one of the two hosts is an empty `<select>` on the
     * other — measured, by the browser driver, which timed out on
     * *"did not find some options"* rather than failing a claim (trap 609).
     *
     * ⛓ **AND IT IS ALL 45 COLUMNS NOW, ON EITHER LAYER** (C2). The four
     * `TERRAIN` names stay the first group and keep spelling themselves,
     * because that is the op the generator writes and every committed payload
     * carries; the rest address a COLUMN, which is what the game reads.
     */
    /* ── ⛓⛓⛓ THE LAYER, AND THE PICKER THAT FOLLOWS IT (C2) ────────── */

    const layerSel = $('genEditLayer');
    const terrainSel = $('genEditTerrain');
    const layerNow = () => layerSel?.value ?? 'tiles';
    const swatchOf = (type) => swatchColour(type, { tileColours, solidColour, floorColour });

    if (layerSel) {
        layerSel.innerHTML = TILE_LAYERS
            .map((l) => `<option value="${l}">${l} — ${LAYER_COLUMNS[l]} column(s)</option>`)
            .join('');
        layerSel.value = TILE_LAYERS[0];
    }

    /**
     * ⛓⛓ THE PICKER IS REFILLED PER LAYER, and the selection is kept when the
     * new layer still offers it. ⛔ It cannot always be kept: a terrain NAME is
     * refused on `cliffsides` by `columnOfSpec`, so switching layers with
     * `ground` selected has to fall back to that layer's first column rather
     * than arm a brush whose every click would refuse.
     */
    const fillTerrain = () => {
        const want = terrainSel.value;
        const groups = paintOptionGroups(layerNow());
        terrainSel.innerHTML = '';
        for (const g of groups) {
            const og = doc.createElement('optgroup');
            og.label = `${g.label} (${g.options.length})`;
            for (const o of g.options) {
                const el = doc.createElement('option');
                el.value = o.value;
                el.textContent = o.label;
                const colour = swatchOf(o.type);
                if (colour) {
                    el.style.backgroundColor = colour;
                    el.title = `${o.label} — swatch ${colour} (the canvas's own colour for `
                        + 'this tile TYPE; there is no tileset image in this repo)';
                }
                og.appendChild(el);
            }
            terrainSel.appendChild(og);
        }
        const has = [...terrainSel.options].some((o) => o.value === want);
        terrainSel.value = has ? want : terrainSel.options[0].value;
        const sel = groups.flatMap((g) => g.options).find((o) => o.value === terrainSel.value);
        terrainSel.style.backgroundColor = swatchOf(sel?.type ?? null) ?? '';
    };
    fillTerrain();
    if (layerSel) lifetime.on(layerSel, 'change', fillTerrain);
    lifetime.on(terrainSel, 'change', fillTerrain);

    const palette = mountEntityPalette({
        typeInput: $('genEditType'),
        typeList: $('genEditTypes'),
        folderSel: $('genEditFolder'),
        attrsInput: $('genEditAttrs'),
        attrsForm: $('genEditAttrForm'),
        rosterNote: $('genEditRoster'),
        schema,
        lifetime,
        doc,
    });

    /* ── THE BRUSH MODE, READ AT THE PRESS ────────────────────────── */

    const mode = () => $('genEditTool').value;

    /**
     * ⛔ **THE ATTRS BOX IS PARSED HERE AND ITS REFUSAL IS THE READER'S OWN
     * TEXT**, because a page that silently treated unparseable attributes as
     * `{}` would place an entity nobody asked for. ⛓ MOVED VERBATIM from
     * `runGenerate.editOpFor`.
     */
    const ATTRS_REFUSAL = (e) => `the attributes box does not parse as JSON (${e.message}). `
        + 'It is a literal OEL attribute set — e.g. {"tset":"0","tag":"-1"} — and nothing '
        + 'here derives an activator group for you.';
    const attrsFromBox = () => {
        const raw = $('genEditAttrs').value.trim();
        return raw === '' ? {} : JSON.parse(raw);
    };

    /**
     * ⛓⛓⛓ **THE OP, BUILT AT THE PRESS AND NOT AT ARMING TIME** — A2 §10.2
     * departure 1's law, which this page needs for the same reason the maze
     * does: the palette moves without re-arming the brush, and a template
     * captured at arming time would go stale the moment it did.
     */
    const brushOp = (tx, ty) => {
        const m = mode();
        if (!BRUSH_MODES.includes(m) || m === 'off') return null;
        /**
         * ⛓⛓ C2 — THE PAINT OP CARRIES THE LAYER AND EITHER SPELLING.
         * ⛔ `normalizePaint` OMITS a `layer: 'tiles'` from the canonical op, so
         * passing it is BYTE-INERT: every committed `?gen=` payload's paint ops
         * are unchanged, which is what lets a layer picker exist at all.
         */
        if (m === 'paint') {
            return { op: 'paint', tx, ty, layer: layerNow(), ...paintSpecOf(terrainSel.value) };
        }
        if (m === 'remove') return { op: 'remove', tx, ty };
        /**
         * ⛔ `{refused}` AND NOT `null` — `editorView`'s third answer. An
         * unparseable attributes box is not "no brush is armed", and reporting
         * it as one would send the reader to the tool selector instead of to
         * the box they just typed in.
         */
        let attrs;
        try { attrs = attrsFromBox(); } catch (e) { return { refused: ATTRS_REFUSAL(e) }; }
        if (m === 'attrs') return { op: 'attrs', tx, ty, attrs };
        return { op: 'place', tx, ty, type: $('genEditType').value.trim(), attrs };
    };

    /**
     * ⛓⛓ **THE FLOOD'S TARGET IS THE BRUSH MODE'S, PROJECTED ONTO A
     * DESCRIPTOR.** ⛔ `writeOps` emits ops only for the fields a descriptor
     * PRESENTS, so a PAINT flood carries `{tile}` alone and leaves the bodies
     * and the cliffsides of every cell it fills untouched — which is what a
     * reader means by "flood this terrain".
     *
     * ⚠ `attrs` AND `remove` HAVE NO FLOOD, and that is a refusal rather than a
     * silence: neither is expressible as *"make this cell look like X"* (they
     * are both *"do this to whatever is already here"*), and `editorView` says
     * so by name when the target is `null`.
     */
    const floodTarget = () => {
        const m = mode();
        if (m === 'paint') {
            /**
             * ⛓ C2 — THE FLOOD FILLS THE LAYER THE BRUSH IS ON, and it names
             * that layer's DESCRIPTOR FIELD. ⛔ `writeOps` emits ops only for
             * the fields a descriptor presents, so a `cliffsides` flood carries
             * `{cliff}` alone and leaves the terrain and the bodies of every
             * cell it fills untouched — which is what a reader means by
             * "flood this cliffside".
             */
            const layer = layerNow();
            const column = columnOfSpec(paintSpecOf(terrainSel.value), layer,
                'watchEditor: the FLOOD target');
            return layer === 'cliffsides' ? { cliff: { column } } : { tile: { column } };
        }
        if (m === 'place') {
            try {
                return {
                    entities: [{ type: $('genEditType').value.trim(), attrs: attrsFromBox() }],
                };
            } catch { return null; }
        }
        return null;
    };

    /**
     * ⛓⛓⛓ **THE PASTE FILTER'S OPTIONS ARE THE DESCRIPTOR'S OWN FIELDS** —
     * §12.10's *"the last typed roster in this panel"*, closed. The core takes
     * a FIELD name, so the offer is `Object.keys(adapter.readCell(...))` and a
     * fourth field arrives as an `<option>` with no edit here.
     *
     * ⛔ THE PROBE CELL IS THE ORIGIN and it is only sound because a
     * descriptor's field set is FIXED — slice B's bound 2 made that promise on
     * purpose (*"`cliff` IS ALWAYS A FIELD, even in a room with no cliffsides
     * layer"*), so that a filter could not come and go with the room.
     */
    const pasteSel = $('genEditPasteOnly');
    const fillPasteFilter = () => {
        if (!pasteSel) return;
        const record = host.record();
        if (!record) return;
        const fields = descriptorFieldsOf(adapter, record);
        const want = pasteSel.value;
        pasteSel.innerHTML = '';
        const all = doc.createElement('option');
        all.value = '';
        all.textContent = `everything the clip holds (${fields.length} field(s))`;
        pasteSel.appendChild(all);
        for (const f of fields) {
            const o = doc.createElement('option');
            o.value = f;
            o.textContent = `${f} only`;
            o.title = `keeps the \`${f}\` field of every copied cell — the name is the `
                + `${adapter.name} descriptor's own, not a list this page holds`;
            pasteSel.appendChild(o);
        }
        if ([...pasteSel.options].some((o) => o.value === want)) pasteSel.value = want;
    };
    fillPasteFilter();

    const pasteOptions = () => {
        const only = pasteSel?.value ?? '';
        return only === '' ? {} : { only };
    };

    const clipWarnings = (clip) => seedlingClipWarnings(clip, host.record(), adapter);

    /* ── THE VIEW ─────────────────────────────────────────────────── */

    /**
     * ⛓⛓ **ONE HOOK, AND THIS FILE IS ITS FIRST READER.** Every gesture and
     * every `setTool` lands here, so the section's own readouts (the armed
     * buttons, the clipboard note, the transcribe bound) are redrawn from ONE
     * place — and the HOST's `onChange` runs after, with the section already
     * describing what it holds.
     */
    const afterChange = (c) => {
        render();
        if (onChange) onChange(c);
    };

    const view = mountEditorView({
        canvas,
        session: host,
        adapter,
        cellAt,
        commands,
        tools,
        brushOp,
        floodTarget,
        pasteOptions,
        clipWarnings,
        say,
        onChange: afterChange,
        lifetime,
        doc,
        offRoom: (tool) => `the ${tool} click landed outside the level`,
    });

    /* ── THE CONTROLS, EACH A VIEW OF THE ONE TABLE ───────────────── */

    /**
     * ⛔ **THE GESTURE BUTTONS ARE BUILT FROM `view.commands`**, never typed.
     * The command table is `editorView`'s one writer of the key map, and a
     * hand-written row of buttons would be a second list that drifts from it —
     * the very shape §11.7's linter fires on one level up.
     */
    const toolBox = $('genEditGestures');
    const buttons = new Map();
    if (toolBox) {
        toolBox.innerHTML = '';
        for (const row of view.commands) {
            if (!Object.values(TOOLS).includes(row.id)) continue;
            const b = doc.createElement('button');
            b.id = `genEditGesture_${row.id}`;
            b.textContent = row.key ? `${row.label} (${row.key})` : row.label;
            b.title = `arms the ${row.id} gesture`;
            lifetime.on(b, 'click', () => { view.run(row.id); });
            toolBox.appendChild(b);
            buttons.set(row.id, b);
        }
    }

    /**
     * ⛓⛓ **THE MODE SELECT IS A VIEW OF THE ARMED TOOL, AND ARMS IT.** Picking
     * a mode arms the BRUSH; `off` disarms whatever is armed. ⛔ A2 §10.8's
     * first defect, prevented rather than repeated: *a page's PALETTE and its
     * armed TOOL are two questions*, and a control that changed one while
     * assuming the other followed ran a different gesture and failed like a
     * defect in the code under test (trap 598).
     */
    /**
     * ⛓ THE TOOL AS IT WAS AT THE LAST DRAW — so a DISARM can be reported with
     * the name of what was disarmed. ⛔ `editorView`'s Escape row clears the
     * tool and says a generic sentence; the page's own vocabulary (*"the
     * pit-patch arm was CANCELLED — no attempt was made, and no solve was
     * spent"*) is a fact about what was ARMED, which is gone by the time the
     * clear is visible. Kept here, one draw behind, which is the only place it
     * still exists.
     */
    let lastTool = null;
    const syncArmed = () => {
        const armed = view.tool;
        if (lastTool !== null && armed === null && onDisarm) onDisarm(lastTool);
        lastTool = armed;
        for (const [id, b] of buttons) b.className = armed === id ? 'armedTool' : '';
        // ⛓ …and the MODE select follows the TOOL: leaving the brush for RECT
        // must not leave a select claiming a brush is armed.
        if (armed !== TOOLS.BRUSH && mode() !== 'off') $('genEditTool').value = 'off';
        const note = $('genEditNote');
        if (note) {
            note.textContent = armed === TOOLS.BRUSH || armed === null
                ? brushNoteText(armed === null ? 'off' : mode())
                : `⛓ ${armed.toUpperCase()} ARMED — click the level. Escape cancels.`;
        }
    };

    lifetime.on($('genEditTool'), 'change', () => {
        view.setTool(mode() === 'off' ? null : TOOLS.BRUSH);
        syncArmed();
    });

    const clipNote = $('genEditClipNote');
    const renderClip = () => {
        if (!clipNote) return;
        clipNote.textContent = view.clip
            ? `clipboard: ${view.clip.w}x${view.clip.h} — ${seedlingClipWarnings(view.clip,
                host.record(), adapter).join(' ⚠ ') || 'nothing to warn about'}`
            : 'clipboard: EMPTY — arm RECT and click two opposite corners.';
    };

    /* ── ⛓⛓⛓ THE TWO FORMS THAT ARE NOT GESTURES (C2) ─────────────── */

    /**
     * ⛓ Both go through `view.apply` — `editorView`'s own op path — so a flag
     * toggled and a corridor painted reach the host by the same road and are
     * reported by the same sentence.
     */
    const flags = $('genEditFlags') ? mountRoomFlags({
        box: $('genEditFlags'),
        noteEl: $('genEditFlagNote'),
        reachEl: $('genEditFlagReach'),
        host,
        view,
        schema,
        lifetime,
        buildWorld,
        doc,
    }) : null;

    const resize = $('genEditResizeGo') ? mountResizeControl({
        widthEl: $('genEditResizeW'),
        heightEl: $('genEditResizeH'),
        anchorEl: $('genEditResizeAnchor'),
        goEl: $('genEditResizeGo'),
        noteEl: $('genEditResizeNote'),
        host,
        adapter,
        view,
        lifetime,
        doc,
    }) : null;

    /* ── ⛓⛓ WHAT A CELL **IS** — the HUD `readCell` never had (C2) ── */

    /**
     * ⛔ IT IS A READ AND NOTHING ELSE. A hover is not a gesture: no op is
     * built, no tool is consulted and nothing is applied, which is why it does
     * not go through `editorView` — that file owns what a CLICK means.
     */
    const cellNote = $('genEditCellNote');
    const describeCell = (at) => {
        const record = host.record();
        if (!record || !at) return '';
        const c = adapter.readCell(record, at.tx, at.ty);
        const tile = c.tile
            ? `column ${c.tile.column} · ${c.tile.typeName ?? `type ${c.tile.type}`}`
                + `${c.tile.terrain ? ` · the terrain name "${c.tile.terrain}"` : ''}`
            : 'NO TILE — and an absent cell is not a wall';
        const cliff = c.cliff ? `cliffside column ${c.cliff.column}` : 'no cliffside';
        const bodies = c.entities.length === 0
            ? 'no bodies'
            : `${c.entities.length} body/bodies: ${c.entities.map((e) => `<${e.type}>`).join(' ')}`
                + ' (the LAST one is what `attrs` and `remove` address)';
        return `(${at.tx},${at.ty}) — ${tile} · ${cliff} · ${bodies}`;
    };
    if (cellNote) {
        lifetime.on(canvas, 'mousemove', (ev) => {
            cellNote.textContent = describeCell(cellAt(ev));
        });
        lifetime.on(canvas, 'mouseleave', () => { cellNote.textContent = ''; });
    }

    /** ⛓ THE ONE PLACE the section's readouts are redrawn. */
    let lastRecord = null;
    const render = () => {
        syncArmed();
        renderClip();
        if (entityClasses) {
            renderTranscribeBound($('genEditTranscribe'), host.record(), entityClasses);
        }
        const list = $('genEdits');
        if (list) list.dataset.summary = describeOps(host.ops());
        flags?.render();
        /**
         * ⛓⛓ THE SIZE BOXES FOLLOW THE **RECORD**, NOT EVERY DRAW. ⛔ Resetting
         * them on each render would erase a width being typed the moment any
         * other readout moved — and a control the page keeps overwriting is a
         * control nobody can use. They are rewritten exactly when the room
         * changes, which is when they became wrong.
         */
        const record = host.record();
        if (resize && record && record !== lastRecord) {
            resize.reset();
            fillPasteFilter();
        }
        lastRecord = record;
    };

    render();

    return {
        view,
        palette,
        flags,
        resize,
        render,
        /** ⛓ The mode, for a host that has to write it (a reset, a replay). */
        setMode(m) {
            $('genEditTool').value = m;
            view.setTool(m === 'off' ? null : TOOLS.BRUSH);
            syncArmed();
        },
        mode,
        brushOp,
        undoCommandId: UNDO_COMMAND_ID,
        destroy() { view.destroy(); },
    };
}
