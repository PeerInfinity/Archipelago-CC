/**
 * storageModel — the Storage panel's pure half: validate the modules'
 * `moduleInfo.storage` declarations, match keys to them, and build the view
 * (sections → owner groups → rows). No DOM, no localStorage: the UI passes the
 * key sizes in, so vitest drives every rule here.
 *
 * Plan: NewDocs/plans/quick-launch-panel-plan.md §37 (the survey), §38 (the ruling).
 */
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';

const MATCHERS = ['key', 'prefix', 'pattern'];
const KINDS = new Set(Object.values(STORAGE_KINDS));

/** The view's sections, in the order they are drawn: what no module owns FIRST. */
export const SECTIONS = Object.freeze([
    {
        id: 'unknown',
        title: 'Unknown — no owner declared',
        blurb: 'Keys no module says it writes: left by old versions of the app, by pages outside the app, '
            + 'or by a game this app does not know. Nothing here is read by the app as it is now.',
        sectionClear: 'Clear all unknown keys',
    },
    {
        id: STORAGE_KINDS.user,
        title: 'Your data',
        blurb: 'Things you made: game saves, saved queues, presets, captured regions. '
            + 'Cleared one row at a time only — download a row first if you may want it back.',
        sectionClear: null,
    },
    {
        id: STORAGE_KINDS.state,
        title: 'Settings and panel state',
        blurb: 'Settings and panel state the app can rebuild: clearing one returns it to its default.',
        sectionClear: 'Clear all state',
    },
    {
        id: STORAGE_KINDS.cache,
        title: 'Caches',
        blurb: 'Results the app can compute or fetch again.',
        sectionClear: 'Clear all caches',
    },
]);

/**
 * Why a declaration is malformed, or null. `where` names it in the message.
 * Shape: exactly one of key / prefix / pattern (a non-empty string; a pattern
 * must compile), `kind` one of STORAGE_KINDS, a non-empty `label`; optional
 * `clearAll` (a family button's text, prefix/pattern only) and `clearsWith`
 * (extra keys that family's button also removes).
 */
export function declarationError(decl, where = 'declaration') {
    if (!decl || typeof decl !== 'object') return `${where}: not an object`;
    const matchers = MATCHERS.filter((m) => decl[m] !== undefined);
    if (matchers.length !== 1) return `${where}: needs exactly one of key / prefix / pattern (has ${matchers.length})`;
    const m = matchers[0];
    if (typeof decl[m] !== 'string' || decl[m] === '') return `${where}: ${m} must be a non-empty string`;
    if (m === 'pattern') {
        try { new RegExp(decl.pattern); } catch (e) { return `${where}: pattern does not compile (${e.message})`; }
    }
    if (!KINDS.has(decl.kind)) return `${where}: kind must be one of ${[...KINDS].join(', ')} (is ${JSON.stringify(decl.kind)})`;
    if (typeof decl.label !== 'string' || !decl.label.trim()) return `${where}: label must be a non-empty string`;
    if (decl.clearAll !== undefined) {
        if (m === 'key') return `${where}: clearAll is for a key family (prefix / pattern)`;
        if (typeof decl.clearAll !== 'string' || !decl.clearAll.trim()) return `${where}: clearAll must be a non-empty string`;
    }
    if (decl.clearsWith !== undefined
        && (!Array.isArray(decl.clearsWith) || decl.clearsWith.some((k) => typeof k !== 'string' || !k))) {
        return `${where}: clearsWith must be an array of keys`;
    }
    const extra = Object.keys(decl).filter((k) => ![...MATCHERS, 'kind', 'label', 'clearAll', 'clearsWith'].includes(k));
    if (extra.length) return `${where}: unknown field(s) ${extra.join(', ')}`;
    return null;
}

/**
 * Flatten `[{ moduleId, owner, storage }]` into matchable declarations.
 * Returns { declarations, errors } — a malformed entry is reported and skipped,
 * so one bad module cannot empty the view.
 */
export function normalizeDeclarations(modules) {
    const declarations = [];
    const errors = [];
    for (const { moduleId, owner, storage } of modules) {
        if (storage === undefined) continue;
        if (!Array.isArray(storage)) {
            errors.push(`${moduleId}: moduleInfo.storage must be an array`);
            continue;
        }
        storage.forEach((decl, i) => {
            const err = declarationError(decl, `${moduleId}.storage[${i}]`);
            if (err) { errors.push(err); return; }
            const match = MATCHERS.find((m) => decl[m] !== undefined);
            declarations.push({
                moduleId,
                owner: owner || moduleId,
                match,
                value: decl[match],
                regex: match === 'pattern' ? new RegExp(decl.pattern) : null,
                kind: decl.kind,
                label: decl.label,
                clearAll: decl.clearAll ?? null,
                clearsWith: decl.clearsWith ?? [],
            });
        });
    }
    return { declarations, errors };
}

/**
 * The declaration that owns `key`, or null. An exact `key` wins, then the
 * longest `prefix`, then the first `pattern` — so a module can declare one key
 * of another's family more precisely.
 */
export function ownerOf(key, declarations) {
    let prefix = null;
    let pattern = null;
    for (const d of declarations) {
        if (d.match === 'key') {
            if (d.value === key) return d;
        } else if (d.match === 'prefix') {
            if (key.startsWith(d.value) && (!prefix || d.value.length > prefix.value.length)) prefix = d;
        } else if (!pattern && d.regex.test(key)) {
            pattern = d;
        }
    }
    return prefix || pattern;
}

/**
 * Build the view from `[{ key, chars }]` (chars = key + value length, the unit
 * the quota counts). Sections follow SECTIONS; inside one, owner groups sort by
 * size, rows by size. Every section is present (possibly empty) so the layout
 * does not jump.
 */
export function buildView(entries, declarations, quotaChars) {
    const sections = SECTIONS.map((s) => ({ ...s, groups: [], chars: 0, count: 0 }));
    const byId = new Map(sections.map((s) => [s.id, s]));
    let totalChars = 0;
    for (const { key, chars } of entries) {
        totalChars += chars;
        const decl = ownerOf(key, declarations);
        const section = byId.get(decl ? decl.kind : 'unknown');
        const groupId = decl ? decl.moduleId : 'unknown';
        let group = section.groups.find((g) => g.id === groupId);
        if (!group) {
            group = { id: groupId, owner: decl ? decl.owner : 'No owner declared', rows: [], chars: 0, families: [] };
            section.groups.push(group);
        }
        group.rows.push({ key, chars, label: decl ? decl.label : null, declaration: decl, pctOfQuota: pct(chars, quotaChars) });
        group.chars += chars;
        section.chars += chars;
        section.count += 1;
        if (decl?.clearAll && !group.families.includes(decl)) group.families.push(decl);
    }
    for (const s of sections) {
        s.groups.sort((a, b) => b.chars - a.chars);
        for (const g of s.groups) g.rows.sort((a, b) => b.chars - a.chars);
    }
    return { sections, totalChars, keys: entries.length, quotaChars, pctOfQuota: pct(totalChars, quotaChars) };
}

/** The keys a section's Clear removes (all of its rows). */
export function sectionKeys(section) {
    return section.groups.flatMap((g) => g.rows.map((r) => r.key));
}

/** The keys a family button removes: the family's rows present now, plus its `clearsWith` keys present now. */
export function familyKeys(family, entries, declarations) {
    const present = new Set(entries.map((e) => e.key));
    const keys = entries.filter((e) => ownerOf(e.key, declarations) === family).map((e) => e.key);
    for (const k of family.clearsWith) if (present.has(k) && !keys.includes(k)) keys.push(k);
    return keys;
}

/** "12.3 %" of the quota (one decimal; "<0.1 %" for a small non-zero share). */
export function pct(chars, quotaChars) {
    if (!quotaChars) return '';
    const p = (100 * chars) / quotaChars;
    if (p > 0 && p < 0.1) return '<0.1 %';
    return `${p.toFixed(1)} %`;
}

/** "1,234,567" */
export function formatChars(n) {
    return Number(n).toLocaleString('en-US');
}

/** The one-line header: "N keys · X of Q chars (Y %)". */
export function headerText(view) {
    return `${view.keys} key${view.keys === 1 ? '' : 's'} · ${formatChars(view.totalChars)} of `
        + `${formatChars(view.quotaChars)} chars (${pct(view.totalChars, view.quotaChars) || '0.0 %'})`;
}

/**
 * A clear's confirmation text: how many keys, how many chars, and — when one of
 * them is the current mode's saved settings — that the page keeps what it loaded
 * until a reload.
 */
export function confirmText(what, keys, sizeOf, currentModeKey) {
    const chars = keys.reduce((sum, k) => sum + (sizeOf(k) ?? 0), 0);
    let text = `${what}: remove ${keys.length} key${keys.length === 1 ? '' : 's'} `
        + `(${formatChars(chars)} chars) from this site's browser storage? This cannot be undone.`;
    if (currentModeKey && keys.includes(currentModeKey)) {
        text += ' It includes the current mode\'s saved settings: this page keeps the settings it already '
            + 'loaded (and saves the next one you change); the removal takes effect on reload.';
    }
    return text;
}
