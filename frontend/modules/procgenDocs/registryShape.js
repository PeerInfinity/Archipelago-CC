/**
 * procgenDocs/registryShape — **THE REGISTRY CELL SHAPER, ONE COPY.** What ONE
 * `substrateRegistry` entry says about ONE field, and which fields there are.
 *
 * ⛓ Lifted out of `scripts/procgen/reference/registry.mjs` (substrate registry
 * panel, R1) so the two readers of the registry shape it the SAME way: the
 * generator, which writes the checked-in snapshot `generated/registry.js`
 * headless, and the `substrateRegistryPanel`, which shapes the LIVE registry in
 * the running app and compares the two cell by cell. A drift readout whose two
 * sides were shaped by two copies of this code would report the copies'
 * difference as the registry's.
 *
 * ⛔ BROWSER-SAFE: no `node:` import, no `process`. The generator's doc scan,
 * findings, groups and markdown stay in `registry.mjs`; only the pure parts
 * live here.
 */

/** ⛓ What ONE entry says about ONE field — the TYPE always, the value where a
 *  value is a fact a reader can use. A function is a `function` and nothing
 *  more: its body is not this table's subject. */
export function cellOf(value) {
    if (value === undefined) return { present: false, type: 'absent', value: null, short: '—' };
    /** ⛔ `null` IS A VALUE HERE, not an absence: bounce declares
     *  `gateableItems: null`, and the doc's own bullet says what it means —
     *  *null ⇒ full vocabulary*. Reading it as an object crashed the page. */
    if (value === null) return { present: true, type: 'null', value: null, short: '`null`' };
    if (typeof value === 'function') {
        return { present: true, type: 'function', value: null, short: 'fn' };
    }
    if (Array.isArray(value)) {
        return {
            present: true,
            type: 'array',
            value: value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))),
            short: value.length <= 3 && value.join(', ').length <= 44
                ? value.join(', ') : `${value.length} items`,
        };
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return {
            present: true, type: 'object', value: keys,
            short: keys.join(', ').length <= 44 ? `{${keys.join(', ')}}` : `${keys.length} keys`,
        };
    }
    if (typeof value === 'boolean') {
        return { present: true, type: 'boolean', value, short: value ? 'yes' : 'no' };
    }
    return {
        present: true, type: typeof value, value,
        short: String(value).length <= 44 ? String(value) : `${String(value).length} chars`,
    };
}

/** The value at a dotted `path` of an entry, or `undefined` the moment a step
 *  is not an object carrying the next key (a `null` on the way included). */
export const digTwo = (entry, path) => {
    let v = entry;
    for (const k of path.split('.')) {
        if (v === null || typeof v !== 'object' || !(k in v)) return undefined;
        v = v[k];
    }
    return v;
};

/**
 * ⛓ THE ROW UNIVERSE — the union of what the ENTRIES carry, plus the dotted
 * sub-fields (two levels down) of every parent in `expandable`, SORTED. ⛔ Never
 * a hand list: a field a substrate grows is a row the moment it exists.
 *
 * @param {object[]} entries registry entries
 * @param {Set<string>} expandable the dotted prefixes to expand
 * @returns {string[]}
 */
export function fieldNamesOf(entries, expandable) {
    const names = new Set();
    for (const e of entries) {
        for (const k of Object.keys(e)) {
            names.add(k);
            if (!expandable.has(k)) continue;
            const child = e[k];
            if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
            for (const c of Object.keys(child)) {
                names.add(`${k}.${c}`);
                if (!expandable.has(`${k}.${c}`)) continue;
                const grand = child[c];
                if (!grand || typeof grand !== 'object' || Array.isArray(grand)) continue;
                for (const g of Object.keys(grand)) names.add(`${k}.${c}.${g}`);
            }
        }
    }
    return [...names].sort();
}

/** ⛓ One row per name, one cell per entry in the entries' own order. */
export function shapeRows(entries, names) {
    return names.map((name) => ({
        name,
        cells: entries.map((e) => ({ id: e.id, ...cellOf(digTwo(e, name)) })),
    }));
}
