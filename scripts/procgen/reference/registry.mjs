/**
 * reference/registry — **TABLE 4: THE SUBSTRATE-REGISTRY CAPABILITY MATRIX,
 * ASKED OF THE REGISTRY** (PROCGEN DOCS · P3b).
 *
 * ⛓ ONE COLUMN PER REGISTERED ENTRY, ONE ROW PER FIELD AN ENTRY CARRIES. The
 * hand-kept matrix in `substrate-registry.md` had thirteen rows chosen by a
 * human; this one has every field the code puts on an entry, because the code
 * already knows them:
 *
 *   `substrateRegistry.getAll()`  the columns, in REGISTRATION order
 *   `Object.keys(entry)`          the rows — a new field appears without an
 *                                 edit here, which is the whole point
 *
 * ⛔⛔ **THE REGISTRY IS IN THE `shared/` SUBMODULE AND THIS IS A READER.**
 * Nothing here imports it for anything but its answer, and no library is
 * edited to make a row nicer.
 *
 * ── ⛓ HOW AN ENTRY GETS INTO THE REGISTRY, HEADLESSLY ─────────────────
 *
 * Entries self-register as a SIDE EFFECT of importing their `*Library.js`
 * (`substrate-registry.md` § *Registry mechanics*: "that first bullet is
 * load-bearing"), which is how every `scripts/procgen/` CLI gets a populated
 * registry with no panel and no eventBus. This file imports the same eight
 * libraries the doc's own "Entry sources" line names, IN A DECLARED ORDER,
 * and the registry is a `Map` — so `getAll()` is insertion order and the
 * declared import order below IS the column order.
 *
 * ⛔ A library that cannot load headless is NOT guessed at: the import is
 * caught, the failure is recorded BY NAME, and its column says so rather than
 * quietly vanishing from a matrix that claims to be complete.
 *
 * ── ⛓ WHERE THE GROUPS COME FROM ──────────────────────────────────────
 *
 * The doc's own headings (Identity · Runtime · Playback · Loop mode ·
 * Cross-substrate sharing · Build-time …) group the rows, and the grouping is
 * SCANNED out of `substrate-registry.md` rather than retyped: a field is in
 * the group whose section documents it. The precedence is declared — a TABLE
 * row beats a BULLET, a bullet beats a PROSE mention, and the earliest
 * section wins a tie — because `spiralContentConfigKey` is documented in a
 * paragraph and `gateableItems` in a bullet, and a scan that only read tables
 * would have reported both as undocumented. ⛔ That is P3a's ternary lesson
 * (trap 395) in another spelling: a scan that cannot see one of the shapes
 * reports a FALSE finding about the code.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, src } from './lib.mjs';
import { M } from './sources.mjs';

/** ⛓ THE DOC THIS TABLE LIVES IN — its headings group the rows, and its
 *  "Capability matrix" section is the region the generator writes. */
export const REGISTRY_DOC = 'docs/json/developer/procgen/substrate-registry.md';

/** ⛓ THE OTHER PROCGEN DOCS — scanned only so a field the registry reference
 *  does not document can say where it IS documented. "Undocumented" and
 *  "documented one door down" are very different facts about a field. */
const DOC_DIR = 'docs/json/developer/procgen';

/**
 * ⛓⛓ THE LIBRARY IMPORT ORDER — DECLARED, and it IS the column order.
 *
 * These are the eight files `substrate-registry.md` names on its own "Entry
 * sources" line. ⚠ `flash` registers as a side effect of `bounceDemoLibrary`
 * (bounce's entry factory builds on the flash one), so `flash` lands in the
 * column order at bounce's position rather than at its own library's — which
 * is a fact about the code, and the table PRINTS which library each id
 * actually arrived with.
 */
export const REGISTRY_LIBRARIES = Object.freeze([
    'frontend/modules/mazeRoom/mazeRoomLibrary.js',
    'frontend/modules/bounceDemo/bounceDemoLibrary.js',
    'frontend/modules/runnerDemo/runnerDemoLibrary.js',
    'frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'frontend/modules/flashSubstrate/flashSubstrateLibrary.js',
    'frontend/modules/flashPanel/flashSeedlingLibrary.js',
    'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js',
    'frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js',
]);

/** ⛓ THE REGISTRY ITSELF — in the `shared/` submodule, imported read-only. */
const REGISTRY_MODULE = 'frontend/modules/shared/procgen/substrateRegistry.js';

/**
 * Import every library, recording which entries each one brought and which
 * ones REFUSED to load headless.
 */
async function loadRegistry() {
    const { substrateRegistry } = await import(join(REPO, REGISTRY_MODULE));
    const libraries = [];
    for (const rel of REGISTRY_LIBRARIES) {
        const before = substrateRegistry.getAll().map((e) => e.id);
        let error = null;
        if (!existsSync(join(REPO, rel))) {
            error = 'the file does not exist';
        } else {
            try {
                // eslint-disable-next-line no-await-in-loop
                await import(join(REPO, rel));
            } catch (e) {
                error = String(e.message).split('\n')[0];
            }
        }
        const after = substrateRegistry.getAll().map((e) => e.id);
        libraries.push({
            file: rel,
            registered: after.filter((id) => !before.includes(id)),
            loadable: error === null,
            error,
        });
    }
    return { entries: substrateRegistry.getAll(), libraries };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE DOC SCAN — the groups, and what the doc documents
 * ══════════════════════════════════════════════════════════════════════ */

/** The leading dotted identifier of a backticked cell — `extractZoneRules(z,
 *  ctx)` is the field `extractZoneRules`. */
const identOf = (s) => (/^([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*)/.exec(s) ?? [])[1]
    ?? null;

/**
 * ⛓ Every field name `substrate-registry.md` § *Entry contract* documents,
 * with the section that documents it and HOW (table / bullet / prose).
 */
export function documentedFields(text = src(REGISTRY_DOC)) {
    const out = new Map();
    let inContract = false;
    let section = null;
    let order = 0;
    const note = (name, how) => {
        if (!name || !section) return;
        const rank = { table: 0, bullet: 1, prose: 2 }[how];
        const have = out.get(name);
        if (have && (have.rank < rank || (have.rank === rank && have.order <= section.order))) return;
        out.set(name, { name, section: section.title, how, rank, order: section.order });
    };
    for (const line of text.split('\n')) {
        const h2 = /^## (.+)$/.exec(line);
        if (h2) { inContract = h2[1].trim() === 'Entry contract'; section = null; continue; }
        if (!inContract) continue;
        const h3 = /^### (.+)$/.exec(line);
        if (h3) { order += 1; section = { title: h3[1].trim(), order }; continue; }
        const cell = /^\|\s*`([^`]+)`\s*\|/.exec(line);
        if (cell) { note(identOf(cell[1]), 'table'); continue; }
        const how = /^\s*[-*]\s/.test(line) ? 'bullet' : 'prose';
        for (const m of line.matchAll(/`([^`]+)`/g)) note(identOf(m[1]), how);
    }
    return out;
}

/**
 * Which OTHER procgen doc mentions a field name, for the findings.
 *
 * ⛔ THE MATCH IS THE NAME INSIDE ANY BACKTICKED SPAN, NOT THE NAME AS THE
 * WHOLE SPAN — and the first cut was the narrower one, which reported
 * `applyPipelineConfig` as documented NOWHERE when `stepped-pipeline.md`
 * spells it `adapter.applyPipelineConfig`. A finding about somebody else's
 * prose is worth exactly as much care as a finding about their code.
 */
function mentionedElsewhere(name) {
    const re = new RegExp(`\`[^\`]*\\b${name}\\b[^\`]*\``);
    return readdirSync(join(REPO, DOC_DIR))
        .filter((f) => f.endsWith('.md') && `${DOC_DIR}/${f}` !== REGISTRY_DOC)
        .filter((f) => re.test(src(`${DOC_DIR}/${f}`)))
        .sort();
}

/* ══════════════════════════════════════════════════════════════════════
 * THE VALUES
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ What ONE entry says about ONE field — the TYPE always, the value where a
 *  value is a fact a reader can use. A function is a `function` and nothing
 *  more: its body is not this table's subject. */
function cellOf(value) {
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

const digTwo = (entry, path) => {
    let v = entry;
    for (const k of path.split('.')) {
        if (v === null || typeof v !== 'object' || !(k in v)) return undefined;
        v = v[k];
    }
    return v;
};

/**
 * ⛓ WHICH FIELDS GET EXPANDED into `parent.child` rows — DERIVED, not listed:
 * a field is expanded exactly when the doc documents a dotted name under it
 * (`loopSupport.record`, `sharing.mana.loopActionDelegation`). ⛔ That keeps
 * `libraryItems` — a bag of sixty item names — a single row, without this file
 * having to say so.
 */
function expandablePrefixes(documented) {
    const out = new Set();
    for (const name of documented.keys()) {
        const parts = name.split('.');
        for (let i = 1; i < parts.length; i += 1) out.add(parts.slice(0, i).join('.'));
    }
    return out;
}

/**
 * ⛓ THE GLOSSARY TERMS THIS TABLE IS ABOUT — declared here, CHECKED against
 * `procgenDocs/glossary.js` (a dead slug renders as a link a reader cannot
 * follow, so it is a hard error, exactly as it is for a URL parameter).
 */
export const REGISTRY_TERMS = Object.freeze([
    'substrate', 'substrate-registry', 'playback-controller', 'loop-mode', 'content-source',
    'zone',
]);

export async function buildRegistry() {
    for (const t of REGISTRY_TERMS) {
        if (!M.glossary.termById(t)) {
            throw new Error(`generate-procgen-reference: REGISTRY_TERMS names ${JSON.stringify(t)}`
                + ', which the GLOSSARY does not define');
        }
    }
    const { entries, libraries } = await loadRegistry();
    const documented = documentedFields();
    const expandable = expandablePrefixes(documented);

    /* ⛓ THE ROW UNIVERSE — the union of what the ENTRIES carry, plus the
     * dotted sub-fields of every expandable parent. ⛔ Never a hand list. */
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

    const UNDOCUMENTED = 'Not documented in the registry reference';
    const findings = [];
    const rows = [...names].sort().map((name) => {
        const doc = documented.get(name) ?? null;
        const cells = entries.map((e) => ({ id: e.id, ...cellOf(digTwo(e, name)) }));
        if (!doc) {
            const elsewhere = mentionedElsewhere(name.split('.')[0]);
            findings.push({
                name,
                severity: elsewhere.length
                    ? 'documented in another doc, not in the registry reference'
                    : 'documented NOWHERE in the procgen docs',
                what: `\`${name}\` is carried by [${cells.filter((c) => c.present)
                    .map((c) => c.id).join(', ')}] and \`${REGISTRY_DOC}\` § *Entry contract* `
                    + 'does not name it. '
                    + (elsewhere.length
                        ? `It IS named in [${elsewhere.join(', ')}] — so the field is `
                            + 'documented, one door down from the reference a reader of an '
                            + 'ENTRY would open.'
                        : 'No procgen doc names it at all.')
                    + ' ⛔ Reported, not fixed: the generator never edits the code or the '
                    + 'prose it reads.',
            });
        }
        return {
            name,
            group: doc?.section ?? UNDOCUMENTED,
            documentedHow: doc?.how ?? null,
            carriedBy: cells.filter((c) => c.present).map((c) => c.id),
            cells,
        };
    });

    /* ⛓ …and the other direction: a field the doc's own TABLES document that
     * NO entry carries. Only table rows, because a prose mention is often
     * about a consumer rather than about a field. */
    const carried = new Set(rows.filter((r) => r.carriedBy.length).map((r) => r.name));
    for (const [name, d] of [...documented].sort()) {
        if (d.how !== 'table' || carried.has(name)) continue;
        findings.push({
            name,
            severity: 'documented as a field, carried by no entry',
            what: `\`${name}\` has a row in \`${REGISTRY_DOC}\` § *${d.section}* and not one `
                + 'of the registered entries carries it. Either every substrate that had it '
                + 'has moved on, or the name in the doc is not the name in the code.',
        });
    }

    /* ⛓ THE GROUP ORDER IS THE DOC'S OWN — the order its `###` headings
     * appear, with the undocumented rows last. */
    const groupOrder = [...new Set([...documented.values()]
        .sort((a, b) => a.order - b.order).map((d) => d.section)), UNDOCUMENTED];

    return {
        terms: [...REGISTRY_TERMS].sort(),
        columns: entries.map((e) => {
            const lib = libraries.find((l) => l.registered.includes(e.id));
            return {
                id: e.id,
                label: e.label ?? null,
                registeredBy: lib?.file ?? null,
                fields: Object.keys(e).length,
            };
        }),
        groups: groupOrder.map((title) => ({
            title,
            rows: rows.filter((r) => r.group === title).map((r) => r.name),
        })).filter((g) => g.rows.length),
        rows,
        libraries,
        findings,
        columnOrder: 'the registry is a Map, so `getAll()` is INSERTION order; the generator '
            + 'imports the libraries in the order declared in `scripts/procgen/reference/'
            + 'registry.mjs` — the table at the end of this region prints it — and each entry '
            + 'lands when the library that registers it is imported',
        shortValueRule: 'a cell in the markdown region is SHORT: a function is `fn`, a '
            + 'boolean is yes/no, an array of at most 3 short values is the list and any '
            + 'longer one is its count, an object is its key set or its key count. The '
            + 'reference page prints the full value.',
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE MARKDOWN REGION — what `substrate-registry.md` § *Capability matrix*
 * carries between its two markers
 * ══════════════════════════════════════════════════════════════════════ */

const mdCell = (s) => String(s).replace(/\|/g, '\\|');

/**
 * ⛓ ONE TABLE PER GROUP, and the groups are the doc's own `###` headings —
 * rendered as BOLD LINES rather than headings so the region cannot rearrange
 * the document's own outline.
 */
export function registryMarkdown(v) {
    const head = `| Field | ${v.columns.map((c) => `\`${c.id}\``).join(' | ')} |`;
    const rule = `|---|${v.columns.map(() => '---').join('|')}|`;
    const out = [
        `**${v.columns.length} registered entries · ${v.rows.length} fields · `
        + `${v.groups.length} groups · ${v.findings.length} findings.** One column per `
        + 'entry the registry returns, one row per field an entry CARRIES — '
        + '`substrateRegistry.getAll()` for the columns and `Object.keys(entry)` for the '
        + 'rows, so a field a substrate grows appears here without anybody editing a table.',
        '',
        `Column order: ${v.columnOrder}.`,
        '',
        `Cell values: ${v.shortValueRule}`,
        '',
        'Groups are this document\'s own § headings, matched to a field by the section that '
        + 'documents it.',
        '',
    ];
    for (const g of v.groups) {
        out.push(`**${g.title}**`, '', head, rule);
        for (const name of g.rows) {
            const r = v.rows.find((x) => x.name === name);
            out.push(`| \`${mdCell(name)}\` | ${r.cells.map((c) => mdCell(c.short)).join(' | ')} |`);
        }
        out.push('');
    }
    out.push('**Which library registered which entry** — entries self-register on library '
        + 'import, and this is the order the generator imports them in.', '',
    '| Library | Registers | Loads headless |', '|---|---|---|');
    for (const l of v.libraries) {
        out.push(`| \`${mdCell(l.file)}\` | ${l.registered.length
            ? l.registered.map((id) => `\`${id}\``).join(', ')
            : '— (nothing new)'} | ${l.loadable ? 'yes' : `**NO — ${mdCell(l.error)}**`} |`);
    }
    out.push('');
    if (v.findings.length) {
        out.push(`**${v.findings.length} findings — where an ENTRY and this document `
            + 'disagree.** ⛔ Printed, never fixed: the generator does not edit the code or '
            + 'the prose it reads.', '', '| Field | What |', '|---|---|');
        for (const f of v.findings) {
            out.push(`| \`${mdCell(f.name)}\` | ${mdCell(f.what.replace(/\n/g, ' '))} |`);
        }
        out.push('');
    }
    return out.join('\n').replace(/\n+$/, '');
}
