/**
 * seedlingDemo/watchEditor — **THE SEEDLING EDITOR'S DOM GLUE**, over
 * `procgenCore/editorView.js` (substrate-agnostic) and `watchEdit.js` (pure).
 * Plan `NewDocs/plans/seedling-editor-v3.md` §3.1, slice C1.
 *
 * ⛔ **WHAT IS HERE AND WHAT IS NOT.** Here: the CONTROLS — the entity
 * palette, the typed attribute form, the terrain picker, the brush-mode
 * selector, the two-oracle bound's readout. Not here: geometry (the page's
 * pixel→tile map), the record (the session's), the ops (`watchEdit`'s), the
 * tool machinery (`editorView`'s). This file's whole job is to turn a form
 * into an op AT THE PRESS and to turn a schema into a form.
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
    ENTITY_ROSTER_PROCGEN, entityRosterFrom, transcribeBoundText, untranscribedTypes,
} from './watchEdit.js';
import { TERRAIN_NAMES, columnOfSpec } from './procgenLevel.js';
import { TOOLS, UNDO_COMMAND_ID, mountEditorView } from '../procgenCore/editorView.js';
import { describeOps } from '../procgenCore/editCore.js';

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
    entityClasses = null, doc = globalThis.document,
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
     * *"did not find some options"* rather than failing a claim.
     *
     * ⚠ THE FOUR NAMES, NOT THE 45 COLUMNS. `TERRAIN_NAMES` is what the
     * GENERATOR reasons about and the `paint` op takes either; the full column
     * picker is a control, not an op, and it is slice C2's (§11.3).
     */
    $('genEditTerrain').innerHTML = TERRAIN_NAMES
        .map((t) => `<option value="${t}">${t}</option>`).join('');

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
        if (m === 'paint') return { op: 'paint', tx, ty, terrain: $('genEditTerrain').value };
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
            return { tile: { column: columnOfSpec($('genEditTerrain').value, 'tiles',
                'watchEditor: the FLOOD target') } };
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

    const pasteOptions = () => {
        const only = $('editPasteOnly')?.value ?? '';
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
    const toolBox = $('editTools');
    const buttons = new Map();
    if (toolBox) {
        toolBox.innerHTML = '';
        for (const row of view.commands) {
            if (!Object.values(TOOLS).includes(row.id)) continue;
            const b = doc.createElement('button');
            b.id = `editTool_${row.id}`;
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

    const clipNote = $('editClipNote');
    const renderClip = () => {
        if (!clipNote) return;
        clipNote.textContent = view.clip
            ? `clipboard: ${view.clip.w}x${view.clip.h} — ${seedlingClipWarnings(view.clip,
                host.record(), adapter).join(' ⚠ ') || 'nothing to warn about'}`
            : 'clipboard: EMPTY — arm RECT and click two opposite corners.';
    };

    /** ⛓ THE ONE PLACE the section's readouts are redrawn. */
    const render = () => {
        syncArmed();
        renderClip();
        if (entityClasses) {
            renderTranscribeBound($('genEditTranscribe'), host.record(), entityClasses);
        }
        const list = $('genEdits');
        if (list) list.dataset.summary = describeOps(host.ops());
    };

    render();

    return {
        view,
        palette,
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
