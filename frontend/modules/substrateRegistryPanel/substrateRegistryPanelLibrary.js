/**
 * substrateRegistryPanel/substrateRegistryPanelLibrary — **THE VIEW-MODEL.**
 * Pure: `describeRegistry(entries, snapshot, { call })` turns the LIVE registry
 * entries and the checked-in snapshot (`procgenDocs/generated/registry.js`)
 * into what the panel draws. No DOM, no registry import, no eventBus — the UI
 * hands it `substrateRegistry.getAll()` and a test hands it fixtures.
 *
 * ⛔ THE PANEL RENDERS WHAT THE REGISTRY SAYS, NEVER WHAT A TABLE LISTS. The
 * rows are `Object.keys(entry)` plus the dotted expansions the SNAPSHOT made
 * (derived from its own dotted row names, so the two sides expand the same
 * parents); the groups are the snapshot's `groups`, in its order; a field the
 * snapshot has no row for lands in `UNSNAPSHOTTED_GROUP`, named for that fact.
 * There is no field, id or group list in this file, and the cells are shaped
 * by `procgenDocs/registryShape.js` — the SAME code that wrote the snapshot —
 * so a drift line is a difference in the registry, not between two shapers.
 */

import { cellOf, digTwo, fieldNamesOf, shapeRows } from '../procgenDocs/registryShape.js';

/** ⛓ The group a live field lands in when the snapshot has no row for it. */
export const UNSNAPSHOTTED_GROUP = 'Not in the snapshot — no row at its last regeneration';

/** ⛓ The prefix a callable's answer carries when calling it threw. */
export const THREW_PREFIX = 'threw: ';

/** The default `call`: invoke it. Injected so a test can fake the answer. */
const invoke = (fn) => fn();

/**
 * ⛓ WHICH PARENTS THE SNAPSHOT EXPANDED — every proper dotted prefix of every
 * dotted row name it carries. The generator derived these from the doc scan;
 * the panel has no doc, so it reads them back off the rows that scan produced.
 */
export function snapshotExpandable(snapshot) {
    const out = new Set();
    for (const r of snapshot?.rows ?? []) {
        const parts = r.name.split('.');
        for (let i = 1; i < parts.length; i += 1) out.add(parts.slice(0, i).join('.'));
    }
    return out;
}

const messageOf = (e) => String(e?.message ?? e).split('\n')[0];

/** ⛓ `getPlaybackController()` — the answer depends on what is MOUNTED. */
function playbackAnswer(entry, call) {
    if (typeof entry.getPlaybackController !== 'function') return 'absent';
    let v;
    try {
        v = call(() => entry.getPlaybackController());
    } catch (e) {
        return `${THREW_PREFIX}${messageOf(e)}`;
    }
    if (v === null) return 'null';
    if (v && typeof v === 'object') return 'controller';
    return `returned ${typeof v}`;
}

/** ⛓ `sharing.items` — a static `types` array, or a `getTypes()` provider. */
function itemTypesAnswer(entry, call) {
    const items = entry.sharing?.items;
    if (items && typeof items.getTypes === 'function') {
        let v;
        try {
            v = call(() => items.getTypes());
        } catch (e) {
            return `${THREW_PREFIX}${messageOf(e)}`;
        }
        return Array.isArray(v) ? v.map(String) : `returned ${v === null ? 'null' : typeof v}`;
    }
    if (items && Array.isArray(items.types)) return items.types.map(String);
    return 'absent';
}

/**
 * ⛓ THE FULL VALUE, as text — `reference.html`'s `registryValue` without the
 * HTML: a function is `function`, `null` is a VALUE (the registry doc gives
 * `null` meanings of its own), an empty array is "empty", an object is its
 * key set.
 *
 * @returns {{ text: string, note: boolean }} `note` marks a text that is a
 *   description rather than the value itself
 */
export function fullValueText(cell) {
    if (!cell.present) return { text: '—', note: true };
    if (cell.type === 'function') return { text: 'function', note: false };
    if (cell.type === 'null') return { text: 'null', note: false };
    if (cell.type === 'array') {
        return cell.value.length
            ? { text: cell.value.join(', '), note: false }
            : { text: 'empty', note: true };
    }
    if (cell.type === 'object') return { text: `{${cell.value.join(', ')}}`, note: false };
    return { text: JSON.stringify(cell.value), note: false };
}

/**
 * The view-model.
 *
 * @param {object[]} entries `substrateRegistry.getAll()`
 * @param {object} snapshot `REGISTRY` from `procgenDocs/generated/registry.js`
 * @param {{ call?: (fn: Function) => any }} [opts]
 */
export function describeRegistry(entries, snapshot, { call = invoke } = {}) {
    const snapColumns = snapshot?.columns ?? [];
    const snapRows = snapshot?.rows ?? [];
    const snapGroups = snapshot?.groups ?? [];
    const snapIds = snapColumns.map((c) => c.id);
    const liveIds = entries.map((e) => e.id);

    const names = fieldNamesOf(entries, snapshotExpandable(snapshot));
    /* ⛓ `cellOf` stringifies an array's elements, so whether they WERE strings
     * is only knowable here, off the raw value — the matrix's feature-row rule
     * needs it (`featureRowsOf`). Added beside the shaped cell, never in it. */
    const rows = shapeRows(entries, names).map((r) => ({
        ...r,
        cells: r.cells.map((c, i) => (c.type === 'array'
            ? { ...c, allStrings: digTwo(entries[i], r.name).every((v) => typeof v === 'string') }
            : c)),
    }));

    const groupOf = new Map();
    for (const g of snapGroups) for (const n of g.rows) groupOf.set(n, g.title);
    const groups = snapGroups
        .map((g) => ({ title: g.title, rows: names.filter((n) => groupOf.get(n) === g.title) }))
        .filter((g) => g.rows.length);
    const unsnapshotted = names.filter((n) => !groupOf.has(n));
    if (unsnapshotted.length) groups.push({ title: UNSNAPSHOTTED_GROUP, rows: unsnapshotted });

    const columns = entries.map((e) => ({
        id: e.id,
        label: e.label ?? null,
        fields: Object.keys(e).length,
        registeredBy: snapColumns.find((c) => c.id === e.id)?.registeredBy ?? null,
    }));

    const answers = {};
    for (const e of entries) {
        answers[e.id] = {
            playbackController: playbackAnswer(e, call),
            itemTypes: itemTypesAnswer(e, call),
        };
    }

    /* ⛓ DRIFT — both directions of ids, then per cell where BOTH sides have
     * the id, over the union of the two sides' field names, compared on the
     * SHORT string (the snapshot's stored value, the live one shaped by the
     * same `cellOf`). */
    const fields = [];
    const snapRowByName = new Map(snapRows.map((r) => [r.name, r]));
    const allNames = [...new Set([...names, ...snapRows.map((r) => r.name)])].sort();
    for (const e of entries) {
        if (!snapIds.includes(e.id)) continue;
        for (const name of allNames) {
            const live = cellOf(digTwo(e, name)).short;
            const snapCell = snapRowByName.get(name)?.cells.find((c) => c.id === e.id);
            const snap = snapCell ? snapCell.short : cellOf(undefined).short;
            if (live !== snap) fields.push({ name, id: e.id, snapshot: snap, live });
        }
    }

    return {
        columns,
        groups,
        rows,
        answers,
        snapshotCount: snapIds.length,
        drift: {
            liveOnly: liveIds.filter((id) => !snapIds.includes(id)),
            snapshotOnly: snapIds.filter((id) => !liveIds.includes(id)),
            fields,
        },
    };
}

/** Whether a drift says nothing at all — the UI turns that into a SENTENCE. */
export const driftIsEmpty = (drift) => !drift.liveOnly.length && !drift.snapshotOnly.length
    && !drift.fields.length;

/* ─── THE MATRIX MODE — features × substrates, ✓ / ✗ / a number ─────────── */

/** ⛓ The two glyphs a matrix cell can carry besides a number. */
export const GLYPH = Object.freeze({ yes: '✓', no: '✗' });

/** ⛓ What a matrix cell IS; the UI's class is `srp-<kind>`. */
export const MATRIX_KINDS = Object.freeze({ yes: 'yes', no: 'no', number: 'number', count: 'count' });

/** ⛓ What a matrix row IS: a registry field, or one element of a field's list. */
export const ROW_KINDS = Object.freeze({ field: 'field', feature: 'feature' });

/** ⛓ Between a feature row's parent field and its element. */
export const FEATURE_SEPARATOR = ': ';

/**
 * ⛓ THE CELL RULE — a function of the cell's TYPE (`registryShape.cellOf`),
 * never of the row: absent → ✗; boolean → ✓ / ✗; number → the number; array
 * → its COUNT; every other present type (function, string, object, `null`) →
 * ✓. The `title` is the full value, prefixed where the ✗ alone would not say
 * WHICH ✗ it is (absent, or declared `false`).
 *
 * @returns {{ kind: string, text: string, title: string }}
 */
export function matrixCell(cell) {
    const full = fullValueText(cell).text;
    if (!cell.present) return { kind: MATRIX_KINDS.no, text: GLYPH.no, title: 'absent — the entry does not carry it' };
    if (cell.type === 'boolean') {
        return cell.value
            ? { kind: MATRIX_KINDS.yes, text: GLYPH.yes, title: full }
            : { kind: MATRIX_KINDS.no, text: GLYPH.no, title: `false — declared ${full}` };
    }
    if (cell.type === 'number') return { kind: MATRIX_KINDS.number, text: String(cell.value), title: full };
    if (cell.type === 'array') {
        return { kind: MATRIX_KINDS.count, text: String(cell.value.length), title: full };
    }
    return { kind: MATRIX_KINDS.yes, text: GLYPH.yes, title: full };
}

/**
 * ⛓ THE FEATURE-ROW RULE — a row whose every present, non-`null` cell is an
 * array of STRINGS (and which has at least one such cell) expands into one
 * child row per element of the sorted union across the entries: ✓ where that
 * entry's array holds the element, ✗ otherwise. A `null` cell does not stop
 * the expansion (the registry doc gives `null` meanings of its own, e.g.
 * *null ⇒ full vocabulary*) — its children are ✗ and the title says why.
 * ⛔ No list of field names: the rule reads the cells.
 *
 * @returns {{ name: string, parent: string, cells: object[] }[]} `[]` when
 *   the rule does not apply
 */
export function featureRowsOf(row) {
    const declared = row.cells.filter((c) => c.present && c.type !== 'null');
    if (!declared.length || !declared.every((c) => c.type === 'array' && c.allStrings === true)) return [];
    const union = [...new Set(declared.flatMap((c) => c.value))].sort();
    return union.map((element) => ({
        name: `${row.name}${FEATURE_SEPARATOR}${element}`,
        parent: row.name,
        cells: row.cells.map((c) => {
            const has = c.type === 'array' && c.value.includes(element);
            let why = `${row.name} = ${fullValueText(c).text}`;
            if (!c.present) why = `absent — the entry has no ${row.name}`;
            else if (c.type === 'null') why = `${row.name} is null — see the registry doc for what null means`;
            return {
                id: c.id,
                kind: has ? MATRIX_KINDS.yes : MATRIX_KINDS.no,
                text: has ? GLYPH.yes : GLYPH.no,
                title: why,
            };
        }),
    }));
}

/**
 * The matrix over a view-model: `vm.columns` across, `vm.groups` down, each
 * field row followed directly by its feature rows.
 *
 * @param {ReturnType<typeof describeRegistry>} vm
 */
export function matrixOf(vm) {
    const byName = new Map(vm.rows.map((r) => [r.name, r]));
    return {
        columns: vm.columns,
        groups: vm.groups.map((g) => ({
            title: g.title,
            rows: g.rows.flatMap((name) => {
                const row = byName.get(name);
                return [
                    { name, kind: ROW_KINDS.field, cells: row.cells.map((c) => ({ id: c.id, ...matrixCell(c) })) },
                    ...featureRowsOf(row).map((f) => ({ ...f, kind: ROW_KINDS.feature })),
                ];
            }),
        })),
    };
}
