#!/usr/bin/env node
/**
 * harvest-procgen-terms — **THE CANDIDATE SET FOR THE PROCGEN GLOSSARY,
 * MEASURED RATHER THAN REMEMBERED** (PROCGEN DOCS slice P2, D1).
 *
 * ⚖ The user, 2026-08-18: *"demos.md and the demo pages are dense with
 * technical jargon — a new document that defines each of the technical
 * terms"*. A glossary written from memory would define the words its author
 * happened to think of; this script names the words the CORPUS actually uses,
 * so the choice of what to define is a CHOICE FROM A MEASURED SET and the
 * words left undefined can be published beside it.
 *
 * ⛔⛔ **A BOUNDED SWEEP MUST NAME WHAT IT BOUNDED.** The output is the whole
 * candidate table — every term, its count and every source that uses it — and
 * `frontend/modules/procgenDocs/glossary.js` defines a SUBSET of it. The
 * as-built publishes both halves: the chosen list and the rejected one with a
 * reason per rejection class. Re-run this after a docs change to see what
 * arrived.
 *
 * ── WHAT IT SCANS ──────────────────────────────────────────────────────
 *
 *   docs/json/developer/procgen/*.md   the 17 tracked procgen docs
 *   frontend/modules/procgenDocs/demos.js       the catalogue's PROSE fields
 *   frontend/modules/seedlingDemo/watch.html    the Seedling lab page's strings
 *   frontend/modules/mazeRoom/lab.html          the maze lab page's strings
 *   frontend/modules/seedlingDemo/watchGenOverlay.js   the GENERATE legend rows
 *   frontend/modules/mazeRoom/mazeLabView.js           the maze lab's legends
 *
 * ── THE FOUR CANDIDATE CLASSES ─────────────────────────────────────────
 *
 *   code     a backticked identifier (`procgenCore/sites.js`, `chambers=1`)
 *   caps     an ALL-CAPS phrase the arc uses as a NAME (KEEP, STRONG, THE CARVE)
 *   phrase   a Capitalised multi-word phrase (Area Graph, Sphere Growth)
 *   plain    a hand list of ordinary English words that are JARGON here
 *
 * ⚠ The classes overlap on purpose — `site` is a plain word AND appears
 * backticked — and a term's `classes` names every one it was found by. The
 * count is the number of OCCURRENCES; `where` is the set of sources.
 *
 * Run: node scripts/procgen/harvest-procgen-terms.mjs
 *      node scripts/procgen/harvest-procgen-terms.mjs --min=2
 *      node scripts/procgen/harvest-procgen-terms.mjs --out=<path>
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const DOCS_DIR = join(ROOT, 'docs/json/developer/procgen');
const OUT = arg('out', join(ROOT, 'NewDocs/plans/procgen-docs-P2-term-candidates.json'));
const MIN = Number(arg('min', 1));

/**
 * ⛓ The PLAIN list — ordinary English words that mean something SPECIFIC in
 * this system and would mislead a reader who took the everyday sense. It is a
 * HAND list by construction: no scan can tell "site" the jargon from "site"
 * the noun. ⛔ It is not the glossary; it is a fishing net, and a word here
 * that the corpus never uses reports a count of 0 and is dropped.
 */
const PLAIN = Object.freeze([
    'site', 'chamber', 'connector', 'carve', 'cut', 'clearer', 'demand', 'guard',
    'ledger', 'phase', 'paintable', 'tape', 'scrub', 'rung', 'biome', 'palette',
    'roster', 'oracle', 'solver', 'sphere', 'region', 'entrance', 'driver',
    'envelope', 'substrate', 'braid', 'gate', 'requirement', 'obstacle', 'anchor',
    'template', 'skeleton', 'element', 'realisation', 'partition', 'vestibule',
    'flood', 'mouth', 'pocket', 'stance', 'lock', 'flag', 'key', 'symbol',
    'certification', 'refusal', 'directive', 'differential', 'grade', 'draw',
    'stream', 'seed', 'warehouse', 'sidecar', 'payload', 'zone', 'wave',
    'stratification', 'quota', 'victory', 'corridor', 'branch', 'tip', 'bend',
    'main', 'door', 'overlay', 'legend', 'layer', 'row', 'claim', 'readout',
    'mutant', 'inert', 'saturation', 'instantiation', 'family', 'yield',
    'acceptance', 'census', 'sweep', 'probe', 'trace', 'replay', 'playback',
    'step', 'tick', 'budget', 'expansion', 'reachability', 'component',
    'transcription', 'binding', 'codec', 'spec', 'default', 'goal', 'start',
    'walkable', 'terrain', 'entity', 'grid', 'tile', 'hazard', 'block',
    'button', 'spinner', 'billiard', 'plan', 'route', 'walk', 'bot', 'lab',
    'catalogue', 'pass', 'core', 'model', 'run', 'level', 'world', 'item',
    'mana', 'loop', 'queue', 'record', 'controller', 'bridge', 'registry',
    'pipeline', 'compile', 'realise', 'prune', 'boundary', 'edge', 'node',
]);

/** ⛔ Words that pass the CAPS/PHRASE shapes but are not procgen vocabulary —
 *  markup artefacts, English sentence starts, and the arc's own bookkeeping
 *  nouns. Kept explicit so the exclusion is reviewable. */
const STOP = new Set([
    'THE', 'A', 'AN', 'AND', 'OR', 'NOT', 'BUT', 'IS', 'IT', 'ITS', 'ONE', 'TWO',
    'THREE', 'FOUR', 'FIVE', 'SIX', 'ALL', 'NO', 'ONLY', 'NOW', 'SO', 'IF',
    'WHAT', 'WHY', 'HOW', 'WHEN', 'WHERE', 'WHICH', 'THAT', 'THIS', 'THESE',
    'THOSE', 'BY', 'FOR', 'OF', 'ON', 'IN', 'TO', 'AT', 'AS', 'WITH', 'FROM',
    'HTTP', 'HTTPS', 'HTML', 'JSON', 'JS', 'CSS', 'URL', 'CLI', 'UI', 'ID',
    'OK', 'TODO', 'NOTE', 'PASS', 'FAIL', 'YES', 'DO', 'BE', 'CAN', 'MAY',
    'WAS', 'WERE', 'ARE', 'HAS', 'HAVE', 'HAD', 'DID', 'DOES', 'WILL', 'WOULD',
    'EVERY', 'EACH', 'ANY', 'SOME', 'BOTH', 'NEVER', 'ALWAYS', 'STILL', 'JUST',
    'THEN', 'THAN', 'ALSO', 'AFTER', 'BEFORE', 'ONCE', 'AGAIN', 'MORE', 'MOST',
    'THEIR', 'THEY', 'YOU', 'YOUR', 'WE', 'OUR', 'HERE', 'THERE', 'OUT', 'UP',
    'MUST', 'SHOULD', 'CANNOT', 'WITHOUT', 'INTO', 'OVER', 'UNDER', 'ABOUT',
]);

/* ══════════ THE SOURCES ═════════════════════════════════════════════ */

function sources() {
    const out = [];
    for (const f of readdirSync(DOCS_DIR).filter((n) => n.endsWith('.md')).sort()) {
        out.push({ name: `docs:${f}`, path: join(DOCS_DIR, f), kind: 'doc' });
    }
    const pages = [
        ['demos.js', 'frontend/modules/procgenDocs/demos.js', 'prose'],
        ['watch.html', 'frontend/modules/seedlingDemo/watch.html', 'page'],
        ['lab.html', 'frontend/modules/mazeRoom/lab.html', 'page'],
        ['watchGenOverlay.js', 'frontend/modules/seedlingDemo/watchGenOverlay.js', 'page'],
        ['mazeLabView.js', 'frontend/modules/mazeRoom/mazeLabView.js', 'page'],
    ];
    for (const [name, rel, kind] of pages) {
        out.push({ name: `page:${name}`, path: join(ROOT, rel), kind });
    }
    return out;
}

/**
 * ⛓ A PAGE is scanned as its VISIBLE STRINGS, not as its whole source: a
 * reader meets `<summary>the RUN</summary>` and the legend row's label, not
 * the CSS selector that styles them. Tags, style and comment blocks come out
 * first; for the JS legend files only the quoted string literals stay.
 */
function textOf(src) {
    const raw = readFileSync(src.path, 'utf8');
    if (src.kind === 'doc') return raw;
    if (src.kind === 'prose') return raw;
    if (src.path.endsWith('.html')) {
        return raw
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ');
    }
    /* a legend module: its STRING LITERALS are what a reader sees */
    return [...raw.matchAll(/'([^'\\\n]{2,})'|"([^"\\\n]{2,})"|`([^`\\\n]{2,})`/g)]
        .map((m) => m[1] ?? m[2] ?? m[3]).join('\n');
}

/* ══════════ THE FOUR EXTRACTORS ═════════════════════════════════════ */

const norm = (s) => String(s).trim().replace(/\s+/g, ' ');

function extractCode(text) {
    return [...text.matchAll(/`([^`\n]{2,60})`/g)].map((m) => norm(m[1]));
}

function extractCaps(text) {
    /* two or more capitals, optionally several such words in a row */
    return [...text.matchAll(/\b([A-Z][A-Z0-9-]{1,}(?:[ -][A-Z][A-Z0-9-]{1,}){0,3})\b/g)]
        .map((m) => norm(m[1]))
        .filter((t) => !t.split(/[ -]/).every((w) => STOP.has(w)));
}

function extractPhrase(text) {
    /* Capitalised multi-word phrases mid-sentence — "the Area Graph" */
    return [...text.matchAll(/\b([A-Z][a-z]{2,}(?: [A-Z][a-z]{2,}){1,3})\b/g)]
        .map((m) => norm(m[1]));
}

function extractPlain(text) {
    const lower = text.toLowerCase();
    const found = [];
    for (const w of PLAIN) {
        const re = new RegExp(`\\b${w}s?\\b`, 'g');
        const n = (lower.match(re) ?? []).length;
        for (let i = 0; i < n; i++) found.push(w);
    }
    return found;
}

/* ══════════ THE RUN ═════════════════════════════════════════════════ */

const table = new Map();   // key → {term, classes:Set, count, where:Map<src,count>}
const add = (term, cls, src) => {
    const key = `${cls === 'code' ? 'code:' : ''}${term.toLowerCase()}`;
    if (!table.has(key)) {
        table.set(key, { term, classes: new Set(), count: 0, where: new Map() });
    }
    const row = table.get(key);
    row.classes.add(cls);
    row.count++;
    row.where.set(src, (row.where.get(src) ?? 0) + 1);
};

const srcs = sources();
const perSource = [];
for (const src of srcs) {
    const text = textOf(src);
    let n = 0;
    for (const t of extractCode(text)) { add(t, 'code', src.name); n++; }
    for (const t of extractCaps(text)) { add(t, 'caps', src.name); n++; }
    for (const t of extractPhrase(text)) { add(t, 'phrase', src.name); n++; }
    for (const t of extractPlain(text)) { add(t, 'plain', src.name); n++; }
    perSource.push({ source: src.name, chars: text.length, hits: n });
}

const rows = [...table.values()]
    .map((r) => ({
        term: r.term,
        classes: [...r.classes].sort(),
        count: r.count,
        sources: r.where.size,
        where: [...r.where.entries()].sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}×${c}`),
    }))
    .filter((r) => r.count >= MIN)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

const byClass = {};
for (const r of rows) for (const c of r.classes) byClass[c] = (byClass[c] ?? 0) + 1;

const report = {
    generatedBy: 'scripts/procgen/harvest-procgen-terms.mjs',
    note: 'PROCGEN DOCS P2 — the CANDIDATE set. frontend/modules/procgenDocs/glossary.js '
        + 'defines a SUBSET of this; the as-built (arc-3 kickoff §18.8) publishes both halves.',
    min: MIN,
    sources: perSource,
    totals: {
        candidates: rows.length,
        occurrences: rows.reduce((a, r) => a + r.count, 0),
        byClass,
        inTwoOrMoreSources: rows.filter((r) => r.sources >= 2).length,
        inFiveOrMoreSources: rows.filter((r) => r.sources >= 5).length,
    },
    candidates: rows,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`sources: ${perSource.length}`);
for (const s of perSource) console.log(`  ${s.source.padEnd(34)} ${String(s.chars).padStart(7)} chars  ${s.hits} hits`);
console.log(`\ncandidates (count >= ${MIN}): ${rows.length}`);
console.log(`  by class: ${Object.entries(byClass).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
console.log(`  in >=2 sources: ${report.totals.inTwoOrMoreSources} · in >=5: ${report.totals.inFiveOrMoreSources}`);
console.log(`\ntop 40 by count:`);
for (const r of rows.slice(0, 40)) {
    console.log(`  ${String(r.count).padStart(5)}  ${r.sources}src  [${r.classes.join(',')}] ${r.term}`);
}
console.log(`\nwritten: ${OUT}`);
