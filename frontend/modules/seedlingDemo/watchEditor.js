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
