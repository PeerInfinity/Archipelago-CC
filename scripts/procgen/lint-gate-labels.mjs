#!/usr/bin/env node
/**
 * lint-gate-labels — **A CHECK'S LABEL, OR A TEST'S NAME, THAT CARRIES A
 * NUMBER THE SAME CHECK ALREADY COMPUTES** (R9 slice 12e, ⚖ ruling 38 item
 * (4b); traps 572 and 573).
 *
 * ── THE TWO SHAPES, AND WHY THEY ARE ONE FAMILY ───────────────────────
 *
 * A gate has two halves that can disagree: the CONDITION, which reds when it
 * is wrong, and the LABEL, which cannot red at all. R9 found three of these
 * in a fortnight and all three had been false for slices:
 *
 *   · `check-seedling-editor-manual.mjs` announced *"the FIFTEEN layer
 *     toggles"* on a row that had just gone green with SIXTEEN (trap 573);
 *   · `check-seedling-editor-sequence.mjs` typed *"THE FIFTEEN WINDOWS"*
 *     three lines under the derivation that already answered it;
 *   · `reachClosure.test.js` pinned `toBe(22)` over a set that grows by
 *     design (trap 572);
 *   · and `docsRender.test.js`'s own test NAMES read *"renders 442 headings"*
 *     and *"655 headings, one answer"* beside pins saying 481 and 694 — which
 *     is why a test NAME is scanned here exactly like a gate label.
 *
 * ── ⛔ WHAT IS *NOT* THIS FAMILY ──────────────────────────────────────
 *
 * A number in a check is not automatically a defect. The distinction this
 * scan is built on — and the reason it is a scan rather than a grep:
 *
 *   an INPUT the row CHOSE          `const ARROW_TICK = 171;` — the tick where
 *                                   sixteen arrow bodies are in flight, picked
 *                                   so the row is about arrows at all. Nothing
 *                                   computes it; it is an argument.
 *   a FIXTURE's own shape           `expect(lvl.layers[0].tiles).toHaveLength(15)`
 *                                   — fifteen tiles are what that `.oel` file
 *                                   HAS. The fixture is the subject.
 *   a configured QUOTA              `jtaBundle.substrateQuotas.jta === 15` —
 *                                   the number was PUT there by the preset.
 *
 * versus
 *
 *   a DERIVED CARDINALITY, typed    `pane.toggles.length === 15`, where the
 *                                   fifteen is a property of a ROSTER that
 *                                   grows when somebody adds a layer.
 *   a LABEL that states one         *"FIFTEEN layer toggles, generated from
 *                                   the roster"* beside a condition that
 *                                   derives the count and never interpolates
 *                                   it.
 *
 * ⛓ The three "not this family" sites above are in the scan's own corpus and
 * the calibration is that they come back CLEAN — not that they were excluded
 * from the scan.
 *
 * ── Run ───────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/lint-gate-labels.mjs            the findings, exit 0
 *   node scripts/procgen/lint-gate-labels.mjs --json
 *   node scripts/procgen/lint-gate-labels.mjs --root=<tree>
 *
 * ⛔ EXIT 0 ALWAYS. This is a REPORT, not a gate — the gate is the allowlist
 * row in `lintGateLabels.test.js`, which pins today's findings with their
 * provenance so a NEW typed count reds and an old one is named.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(name.length + 3);
export const REPO = arg('root', join(HERE, '..', '..'));

/**
 * ⛓ THE CORPUS — the GATES, the helpers they share, and every `*.test.js`
 * under the two module roots. Derived by walking, so a gate added tomorrow is
 * scanned without being listed.
 *
 * ⛓⛓ A GATE IS `check-*` OR `verify-*` — `reachClosure.js`'s own `isGateName`,
 * reused rather than re-invented. ⛔ And the boundary is a MEASUREMENT, not a
 * preference: scanning the `plan-`/`probe-` instruments too took the report
 * from 27 findings to 107, and every one of the extra eighty was a
 * one-shot investigative row whose number IS its finding — *"all THREE rocks
 * came down on TWO SWINGS"* beside `rocks.length === 3`. Those labels are not
 * maintained against a growing roster; they are the result. A list that long
 * is a list nobody reads, which is the same as no list.
 */
const ROOTS = ['scripts/procgen', 'frontend/modules'];
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', 'fixtures',
    'generated', 'wasm', 'vendor']);
const isGateFile = (name) => /^(?:check|verify)-[^/]+\.mjs$/.test(name);

export function corpus({ repo = REPO } = {}) {
    const out = [];
    const walk = (rel) => {
        let entries;
        try { entries = readdirSync(join(repo, rel), { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (SKIP_DIR.has(e.name)) continue;
            const next = `${rel}/${e.name}`;
            if (e.isDirectory()) { walk(next); continue; }
            const isTest = /\.test\.js$/.test(e.name);
            /* ⛓ a gate, or one of the `.js` helpers the gates import. */
            const isGate = rel === 'scripts/procgen'
                && (isGateFile(e.name) || /\.js$/.test(e.name));
            if (!(isTest || isGate)) continue;
            /**
             * ⛔⛔ A FILE THAT IMPORTS THIS SCAN HOLDS ITS TEST DATA. The gate
             * over this report crafts sources like `check(x.length === 15,
             * 'FIFTEEN toggles')` to prove the scan can FIRE — and a scan that
             * reads its own fixtures reports them as findings and puts them in
             * its own allowlist, which is a fixed point with extra steps. The
             * rule is DERIVED (does the file import this module) rather than a
             * file name, so a second gate over the same scan is covered too.
             */
            try {
                if (/from '\.\/lint-gate-labels\.mjs'/.test(readFileSync(join(repo, next), 'utf8'))) {
                    continue;
                }
            } catch { /* unreadable — scan it and let the read fail loudly */ }
            out.push(next);
        }
    };
    for (const r of ROOTS) walk(r);
    return out.sort();
}

/* ══════════════════════════════════════════════════════════════════════
 * THE COUNT TOKENS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ Spelled numbers from TWO up. ⛔ `one` is deliberately absent: "exactly ONE
 * damage marker" is the overwhelming shape in this corpus and it is a claim
 * about a SINGLETON, not about a roster that grows. Including it took the
 * finding count from a list somebody reads to a list nobody does — the
 * measurement is in the as-built.
 */
export const WORDS = Object.freeze({
    two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
});

/**
 * The counts a LABEL states.
 *
 * ⛔ A DIGIT ONLY COUNTS IN A COUNTING POSITION. `jta demo quota jta=15` names
 * a configured value, not a cardinality; `15 windows` and `the 16` name one.
 * Without this rule the scan flags every label that mentions a key=value pair
 * or a tick number, which is most of them.
 */
export function countsIn(label) {
    const found = new Set();
    for (const m of label.matchAll(/\b([a-z]+)\b/gi)) {
        const v = WORDS[m[1].toLowerCase()];
        if (v !== undefined) found.add(v);
    }
    for (const m of label.matchAll(/(?:^|\s|\bthe\s)(\d{1,4})\s+[a-z]/gi)) found.add(Number(m[1]));
    for (const m of label.matchAll(/\bthe\s+(\d{1,4})\b/gi)) found.add(Number(m[1]));
    return [...found];
}

/**
 * The cardinalities a CONDITION types as literals — a `.length`/`.size`
 * compared to an integer, either way round, plus vitest's `toHaveLength`.
 * ⛔ Adjacency is the rule: `substrateQuotas.jta === 15` is not one of these,
 * and that is the difference between a quota and a count.
 */
export function typedCardinalities(code) {
    const out = new Set();
    for (const m of code.matchAll(/\.(?:length|size)\s*(?:===|==|>=|<=|>|<)\s*(\d{1,5})\b/g)) {
        out.add(Number(m[1]));
    }
    for (const m of code.matchAll(/\b(\d{1,5})\s*(?:===|==|>=|<=|>|<)\s*[\w.[\]()]*\.(?:length|size)\b/g)) {
        out.add(Number(m[1]));
    }
    /**
     * ⛔ ZERO AND ONE ARE NOT CARDINALITIES OF A GROWING SET. `damage.length
     * === 0` is *empty* and `markers.length === 1` is *exactly one* — claims
     * about a singleton or an absence, which is what most of this corpus
     * asserts and none of what this lint is about. Keeping them took the
     * report from 490 findings to a list nobody would read; the measurement is
     * in the as-built.
     */
    return [...out].filter((n) => n >= 2);
}

/** ⛓ …and whether it DERIVES one at all — a `.length`/`.size` of anything. */
const DERIVES_RE = /\.(?:length|size)\b|\btoHaveLength\(/;

/**
 * ⛓ A DECLARED ROSTER — an ALL-CAPS constant. `LAYER_IDS`, `OVERLAY_LAYERS`,
 * `README_ORDER`. Pinning a length over one of those is trap 572; pinning a
 * length over `lvl.layers[0].tiles` is a fixture assertion, and the two are
 * told apart HERE and nowhere else in the scan.
 */
const ROSTER_LENGTH_RE = /\b([A-Z][A-Z0-9_]{2,})\s*(?:\.[a-zA-Z]+\([^)]*\))*\s*\.(?:length|size)\b/;
const EXPECT_ROSTER_LEN_RE = /expect\(\s*([A-Z][A-Z0-9_]{2,})[^)]*\)\s*\.\s*toHaveLength\(\s*(\d+)/;

/* ══════════════════════════════════════════════════════════════════════
 * THE SCAN
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ One CALL, from its opening paren to the matching close — a real brace walk
 * rather than a line regex, because every one of the measured sites spans
 * three to six lines and a line-oriented scan sees the label without its
 * condition, which is exactly the pairing this lint is about.
 */
function callsIn(text, name) {
    const out = [];
    const re = new RegExp(`\\b${name}\\(`, 'g');
    let m = re.exec(text);
    while (m !== null) {
        let depth = 0;
        let i = m.index + m[0].length - 1;
        let inStr = null;
        for (; i < text.length; i++) {
            const c = text[i];
            if (inStr) {
                if (c === '\\') { i++; continue; }
                if (c === inStr) inStr = null;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
            if (c === '(') depth++;
            else if (c === ')') { depth--; if (depth === 0) break; }
        }
        out.push({ start: m.index, body: text.slice(m.index, i + 1) });
        m = re.exec(text);
    }
    return out;
}

/** Every plain (non-template) string literal in a fragment, in order. */
const STRINGS_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
const stringsIn = (code) => [...code.matchAll(STRINGS_RE)]
    .map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));

/**
 * ⛓ THE CALL'S ARGUMENTS, split at TOP-LEVEL commas.
 *
 * ⛔ The first cut took "the first string literal anywhere in the call" as the
 * label and reported `", "` — a separator inside the CONDITION — as the label
 * of nineteen rows. A label is the SECOND argument of `check(…)` and the FIRST
 * of `it(…)`; anything else is reading the wrong half of the very pairing this
 * scan is about.
 */
function argsOf(call) {
    const inner = call.slice(call.indexOf('(') + 1, -1);
    const out = [];
    let depth = 0;
    let start = 0;
    let inStr = null;
    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (inStr) {
            if (c === '\\') { i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (c === ',' && depth === 0) { out.push(inner.slice(start, i)); start = i + 1; }
    }
    out.push(inner.slice(start));
    return out.map((a) => a.trim());
}

/**
 * A label as WRITTEN: adjacent string literals concatenated; `null` when the
 * argument is a TEMPLATE LITERAL, which is already the interpolated form this
 * lint is asking for and so is never a finding.
 *
 * ⛔ THE TEST IS "DOES THE ARGUMENT *START* WITH A BACKTICK", not "does a
 * backtick appear". Half the labels in this corpus quote an identifier —
 * *"⛓ `lanes` has a toggle, generated from the roster — FIFTEEN now"* — and a
 * contains-test read that as interpolated and skipped it. Measured: it hid
 * THREE of the seven sites the calibration commit is supposed to produce,
 * including the `-lanes` one, and it hid them by looking like precision.
 */
function labelOf(fragment) {
    const t = fragment.trim();
    if (t.startsWith('`') || /\$\{/.test(t)) return null;
    const parts = stringsIn(fragment);
    return parts.length ? parts.join('') : null;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

export function scanFile(rel, text) {
    const findings = [];
    const add = (index, rule, label, detail) => findings.push({
        file: rel, line: lineOf(text, index), rule, label: label.slice(0, 90), detail,
    });

    /* ── gate labels: `check(<condition>, '<label>', …)` ───────────────── */
    for (const c of callsIn(text, 'check')) {
        const args = argsOf(c.body);
        const label = labelOf(args[1] ?? '');
        if (label === null) continue;
        const counts = countsIn(label);
        if (!counts.length) continue;
        const cond = args[0] ?? '';
        const typed = typedCardinalities(cond);
        const hit = counts.find((n) => typed.includes(n));
        if (hit !== undefined) {
            add(c.start, 'label-and-literal', label,
                `the label says ${hit} and the condition TYPES ${hit} against a .length`);
        } else if (ROSTER_LENGTH_RE.test(cond)) {
            add(c.start, 'label-over-a-roster', label,
                `the label states ${counts.join(', ')}; the condition DERIVES it from `
                + `${ROSTER_LENGTH_RE.exec(cond)[1]} and never interpolates it`);
        }
    }

    /* ── test names: `it('<name>', …)` / `describe('<name>', …)` ───────── */
    for (const name of ['it', 'describe']) {
        for (const c of callsIn(text, name)) {
            const args = argsOf(c.body);
            const label = labelOf(args[0] ?? '');
            if (label === null) continue;
            const counts = countsIn(label);
            if (!counts.length) continue;
            const body = args.slice(1).join(',');
            const typed = typedCardinalities(body);
            const hit = counts.find((n) => typed.includes(n));
            if (hit !== undefined) {
                add(c.start, 'name-and-literal', label,
                    `the name says ${hit} and the body TYPES ${hit} against a .length`);
            } else if (ROSTER_LENGTH_RE.test(body) || EXPECT_ROSTER_LEN_RE.test(body)) {
                add(c.start, 'name-over-a-roster', label,
                    'the name states a count the body derives from '
                    + `${(ROSTER_LENGTH_RE.exec(body) ?? EXPECT_ROSTER_LEN_RE.exec(body))[1]}`);
            }
        }
    }

    /* ── a cardinality pinned over a DECLARED ROSTER, with no label at all ── */
    for (const m of text.matchAll(new RegExp(EXPECT_ROSTER_LEN_RE.source, 'g'))) {
        add(m.index, 'roster-length-pinned', `${m[1]} → toHaveLength(${m[2]})`,
            `${m[1]} is a declared roster; its length is a property of the roster, not a pin`);
    }
    return findings;
}

export function lint({ repo = REPO } = {}) {
    const out = [];
    for (const rel of corpus({ repo })) {
        let text;
        try { text = readFileSync(join(repo, rel), 'utf8'); } catch { continue; }
        out.push(...scanFile(rel, text));
    }
    return out;
}

/**
 * ⛓ THE IDENTITY OF A FINDING — file, rule and LABEL, deliberately NOT the
 * line. A line number moves every time somebody adds a paragraph above it, and
 * an allowlist that churns on unrelated edits is one nobody keeps honest.
 */
export const findingKey = (f) => `${f.file}::${f.rule}::${f.label}`;

export const ALLOW_FILE = 'scripts/procgen/lint-gate-labels.allow.json';
export const isGateFinding = (f) => /^scripts\/procgen\/(?:check|verify)-/.test(f.file);

/* ── the report ───────────────────────────────────────────────────────── */

if (import.meta.url === `file://${process.argv[1]}`) {
    const findings = lint();
    if (argv.includes('--write-allow')) {
        /**
         * ⛓ THE ALLOWLIST IS GENERATED, and its own note says what it is: not
         * a set of approved typed counts, a set of KNOWN ones. The gate is
         * that nothing NEW joins it without somebody deciding to.
         */
        const gates = findings.filter(isGateFinding);
        const head = execFileSync('git', ['rev-parse', 'HEAD'],
            { cwd: REPO, encoding: 'utf8' }).trim();
        const out = {
            note: 'GENERATED by `node scripts/procgen/lint-gate-labels.mjs --write-allow` '
                + '(R9 slice 12e). These are the label/name-carries-a-count findings that '
                + 'ALREADY EXISTED when the lint was written. ⛔ An entry here is NOT an '
                + 'approved typed count — it is a KNOWN one. The list exists so a NEW one '
                + 'reds in `lintGateLabels.test.js` and an old one is named. Keyed by '
                + 'file::rule::label, never by LINE: a line number moves when somebody adds '
                + 'a paragraph above it, and an allowlist that churns on unrelated edits is '
                + 'one nobody keeps honest.',
            measuredAt: head,
            counts: {
                all: findings.length,
                gates: gates.length,
                tests: findings.length - gates.length,
            },
            allow: [...new Set(findings.map(findingKey))].sort(),
        };
        writeFileSync(join(REPO, ALLOW_FILE), `${JSON.stringify(out, null, 2)}\n`);
        console.log(`wrote ${ALLOW_FILE} — ${out.allow.length} entr(ies) `
            + `(${out.counts.gates} in gates, ${out.counts.tests} in tests) at ${head}`);
        process.exit(0);
    }
    if (argv.includes('--json')) {
        console.log(JSON.stringify(findings, null, 2));
    } else {
        console.log(`# lint-gate-labels — ${corpus().length} file(s) scanned at `
            + `${relative(process.cwd(), REPO) || '.'}\n`);
        for (const f of findings) {
            console.log(`${f.file}:${f.line}  [${f.rule}]`);
            console.log(`    "${f.label}"`);
            console.log(`    ⛓ ${f.detail}`);
        }
        console.log(`\n${findings.length} finding(s). ⛔ This is a REPORT — exit 0 always; `
            + 'the allowlist row in `lintGateLabels.test.js` is the gate.');
    }
    process.exit(0);
}
