// frontend/modules/procgenCore/regionGenerationForm.js
//
// ⛓⛓ APWORLD SUBSTRATE CHANGE slice R1 — **THE PER-REGION GENERATION FORM**,
// one module every host draws a region's generation settings from (plan §2.4,
// shape D, the LIFT route — ⚖ Q6 A).
//
// The Procgen Pipeline panel's Parameters section used to draw the per-REGION
// rows (region width / height, max items per region) inline beside the
// per-WORLD ones, and then each active substrate's `renderProcgenParams` node;
// the three hooks each carried their own copy of the field-row helper. This
// module is now where those live:
//
//   · `REGION_GENERATION_FIELDS` — the generic per-region rows, as DATA. A row
//     with `appliesTo` is drawn only for an entry whose `regionGeometry`
//     (`regionGeometry.js`) matches: a sides-only region has no tile size.
//   · `fieldRow` / `numberField` — the ONE labelled-row helper and the ONE
//     clamped number field the substrate hooks build with.
//   · `bagIntegerField` — the pipeline's own integer row (parseInt, no
//     clamping, the nullable "all" form), shared by its world rows and the
//     generic region rows so both keep exactly the behaviour they had.
//   · `renderRegionGenerationForm` — [seed row] + the generic rows + the
//     entry's `renderProcgenParams` node under its subheader.
//   · `bagFromPayload` — a fresh per-region bag: the entry's
//     `defaultProcgenParams`, overlaid by what its `procgenParamsFromPayload`
//     hook reads back off an existing payload (⚖ Q2 C-then-A).
//
// ⛔ It NAMES NO SUBSTRATE and imports no panel: every per-substrate fact is a
// registry-entry slot, and panels call this, never the other way round. The
// bag → realiser mapping (`buildRegionParams`, `effectiveHazardOpts`) is not
// UI and does not live here.
//
// ⛔ The bag is MUTATED IN PLACE and each control binds on the object handed
// in: a host that re-renders hands in the same bag (the pipeline's
// `this.params`) or, deliberately, a new one — the old controls keep writing
// the object they were drawn on.
//
// Pure logic + call-time DOM only (no top-level document access), so a
// headless driver can import the substrate libraries that import this.

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { geometryOf, REGION_GEOMETRY } from './regionGeometry.js';

/**
 * The generic per-region rows, in the order they are drawn. `appliesTo` names
 * the region geometry a row needs (absent = every geometry).
 */
export const REGION_GENERATION_FIELDS = Object.freeze([
    Object.freeze({ key: 'regionWidth', label: 'Region width', min: 2, max: 40, appliesTo: REGION_GEOMETRY.TILES }),
    Object.freeze({ key: 'regionHeight', label: 'Region height', min: 2, max: 40, appliesTo: REGION_GEOMETRY.TILES }),
    Object.freeze({ key: 'maxItemsPerRegion', label: 'Max items/region', min: 0, max: 10 }),
]);

/** The data attribute a form carries saying whether an entry hook drew a node. */
export const PROCGEN_PARAMS_ATTR = 'procgenParams';

/** One labelled `procgen-pipeline-field` row around `control`. */
export function fieldRow(labelText, title, control) {
    const row = document.createElement('div');
    row.className = 'procgen-pipeline-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    if (title != null) label.title = title;
    row.appendChild(label);
    row.appendChild(control);
    return row;
}

/**
 * A number row bound to `params[key]`, calling `onChange` once per edit.
 *
 * Two clamping rules, the two the hooks carried:
 *   · default — a non-finite or below-`min` entry falls back to `def`, `max`
 *     caps, and the box is rewritten to the stored value;
 *   · `integer: true` — floor, an empty / non-numeric entry reads as `min`, and
 *     below `min` clamps to `min`; the box is left as typed.
 * `def` is also what the box shows when the bag has no value.
 */
export function numberField(params, {
    key, label, title, def, min = 0, max = null, step = 1, integer = false,
} = {}, onChange = () => {}) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.step = String(step); // without this the browser rejects non-integers
    if (max != null) input.max = String(max);
    input.value = String(params[key] ?? def);
    input.addEventListener('change', () => {
        let v;
        if (integer) {
            v = Math.max(min, Math.floor(Number(input.value) || min));
        } else {
            v = Number(input.value);
            if (!Number.isFinite(v) || v < min) v = def;
            if (max != null) v = Math.min(v, max);
            input.value = String(v);
        }
        params[key] = v;
        onChange();
    });
    return fieldRow(label, title, input);
}

/**
 * The pipeline's integer row: `parseInt`, no clamping (min/max are the
 * spinner's bounds only), an empty box when the bag has no value. `nullable`
 * collapses an empty box, and a step down to 0, to `null` (shown as the
 * `placeholder`).
 */
export function bagIntegerField(params, f, onChange = () => {}) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = params[f.key] ?? '';
    if (f.min !== undefined) input.min = f.min;
    if (f.max !== undefined) input.max = f.max;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.title) input.title = f.title;
    input.addEventListener('change', () => {
        // Nullable fields collapse to null (shown as the placeholder)
        // both on an empty box AND when the spinner steps down to 0 —
        // so "Spheres/batch" toggles 1 ⇄ all from the up/down arrows.
        if (f.nullable && (input.value === '' || parseInt(input.value, 10) <= 0)) {
            params[f.key] = null;
            input.value = '';
        } else {
            const v = parseInt(input.value, 10);
            if (Number.isFinite(v)) params[f.key] = v;
        }
        onChange();
    });
    return fieldRow(f.label, f.title || null, input);
}

/** The generic rows `entry`'s region geometry takes, in draw order. */
export function regionGenerationFieldsFor(entry) {
    const geometry = geometryOf(entry);
    return REGION_GENERATION_FIELDS.filter((f) => f.appliesTo === undefined || f.appliesTo === geometry);
}

/**
 * The generation form for ONE substrate: an optional seed row, the generic
 * per-region rows (`generic: false` when the host already drew them), then the
 * entry's `renderProcgenParams` node under a "<id> parameters" subheader. An
 * entry without the hook (or whose hook draws nothing) gets no subheader;
 * `data-procgen-params` says which (`drawn` | `none`).
 *
 * @param {object} o
 * @param {string} o.substrateId the registry id of the region's substrate
 * @param {object} o.params the bag, mutated in place
 * @param {Function} [o.onChange] called once per edit
 * @param {object} [o.registry] the registry to resolve the entry in
 * @param {boolean} [o.generic] draw the generic per-region rows
 * @param {{key: string}|null} [o.seed] draw a seed row bound to `params[key]`
 * @param {string[]|null} [o.fields] draw only the generic rows whose `key` is
 *   listed (null = every row the geometry takes) — a host whose realiser reads
 *   no such knob draws no control that writes nothing
 * @returns {HTMLElement}
 */
export function renderRegionGenerationForm({
    substrateId, params, onChange = () => {}, registry = substrateRegistry, generic = true, seed = null,
    fields = null,
} = {}) {
    const entry = registry.get(substrateId);
    const wrap = document.createElement('div');
    wrap.className = 'procgen-region-generation-form';
    wrap.dataset.substrateId = substrateId;

    const rows = [
        ...(seed ? [{ key: seed.key, label: 'Seed', min: 0 }] : []),
        ...(generic ? regionGenerationFieldsFor(entry)
            .filter((f) => !Array.isArray(fields) || fields.includes(f.key)) : []),
    ];
    if (rows.length) {
        const grid = document.createElement('div');
        grid.className = 'procgen-pipeline-grid';
        for (const f of rows) grid.appendChild(bagIntegerField(params, f, onChange));
        wrap.appendChild(grid);
    }

    const hook = entry?.renderProcgenParams;
    const node = typeof hook === 'function' ? hook({ params, onChange }) : null;
    if (node) {
        const header = document.createElement('div');
        header.className = 'procgen-pipeline-scenario-subheader';
        header.textContent = `${substrateId} parameters`;
        wrap.appendChild(header);
        wrap.appendChild(node);
    }
    wrap.dataset[PROCGEN_PARAMS_ATTR] = node ? 'drawn' : 'none';
    return wrap;
}

/**
 * A fresh per-region bag for `entry`: its `defaultProcgenParams`, overlaid by
 * the knobs its `procgenParamsFromPayload(payload)` hook reads back off an
 * existing payload (so a form opens on what the region was built with, where
 * that is knowable). An entry without the hook, or no payload, gets the
 * defaults alone.
 */
export function bagFromPayload(entry, payload) {
    const hook = entry?.procgenParamsFromPayload;
    const read = typeof hook === 'function' && payload ? hook(payload) : null;
    return { ...(entry?.defaultProcgenParams ?? {}), ...(read ?? {}) };
}
