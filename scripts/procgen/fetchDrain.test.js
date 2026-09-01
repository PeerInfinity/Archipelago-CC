/**
 * fetchDrain — **EVERY `fetch` IN `scripts/` READS ITS BODY, AND THE ELEVENTH
 * PROBE WRITTEN NEXT MONTH IS HELD TO IT TOO** (S4b (3); trap 1057).
 *
 * ── ⛔⛔ THE DEFECT, MEASURED ─────────────────────────────────────────
 *
 * `await fetch(URL).then((r) => r.ok)` leaves the response body UNREAD. Under
 * Node 22's bundled undici the socket then ends while the parser is paused and
 * the process dies on an internal `assert(!this.paused)` — an `ERR_ASSERTION`
 * thrown from a socket callback, so NO `try`/`catch` at the call site can see
 * it and the gate's stdout goes with the process. `check-seedling-wasm-element`
 * carries the numbers: on node **v22.23.2**, 40 runs each, **5/40 crashed**
 * undrained · **0/40** drained · **0/40** with `{ method: 'HEAD' }`; 0/25 on
 * node 18 and 23.11.
 *
 * ⛓ THE BOX'S NODE HID IT FOR MONTHS. That is exactly why the sweep needs a
 * ROW and not a memory: this repository's own node is 18, so a reintroduced
 * probe is green here and dies on the runner.
 *
 * ── ⛓ WHY A ROW AND NOT A `check-*.mjs` REPORT ───────────────────────
 *
 * [[feedback_lint_report_is_not_the_gate]] — a report anybody must remember to
 * run gates nothing. This runs in the bounded vitest every touched-file slice
 * already runs, and in CI's suite.
 *
 * ── ⛔ THE RULE, AND THE BOUND IT IS STATED WITH ──────────────────────
 *
 * *Every `fetch(` call in `scripts/` either drains its body or asks for no
 * body.* ⛓ The rule deliberately does NOT except a `page.evaluate` callback
 * (whose `fetch` is the BROWSER's and cannot hit this): every one of those
 * reads `.json()` already, because a fetch inside a page is there for its
 * data. Excepting them would need brace tracking through masked strings for a
 * population that is empty — a bound bought with complexity.
 *
 * ⚠ AND THE FALSE POSITIVE IS NAMED: a `fetch(` at the START of a string
 * literal would be read as a call. The prose that made this necessary
 * (`sphere-log fetch(es)` in a template) is excluded because an identifier
 * cannot precede a call expression in valid JS, which is the test below; a
 * string opening on the word itself would not be. None exists today, and the
 * fix if one is written is to word the message differently.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGEX_AFTER_KEYWORD, maskComments } from './maskComments.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = join(REPO, 'scripts');

/** ⛓ The two forms the wasm-element measurement found safe, plus the other
 *  three body readers — anything that consumes the stream is a drain. */
const DRAINS = /\.(arrayBuffer|json|text|blob|bytes|formData)\(\)/;
const NO_BODY = /method:\s*['"]HEAD['"]/;
/** ⛓ A drain may sit a few lines below the call; three is the widest form in
 *  the tree (`.then(async (r) => {` / `await r.arrayBuffer();` / `})`). */
const WINDOW = 4;

function jsFiles(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (!/^(node_modules|__pycache__)$/.test(e.name)) out.push(...jsFiles(p)); }
        else if (/\.(mjs|js)$/.test(e.name) && !/\.test\.js$/.test(e.name)) out.push(p);
    }
    return out;
}

/**
 * ⛔ A CALL, NOT THE WORD. In valid JS an IDENTIFIER cannot directly precede a
 * call expression, so `sphere-log fetch(es)` (prose, in a template) is not one
 * — while `await fetch(`, `= fetch(` and `=> fetch(` are. The word that MAY
 * precede one is a keyword, and `maskComments` already publishes that set for
 * the same reason (it is where a `/` is a regex rather than a division), so
 * this reads it rather than keeping a second copy.
 * ⛓ `x.fetch(` is somebody else's method and the lookbehind drops it.
 */
function fetchSites(src) {
    const masked = maskComments(src);
    const lines = masked.split('\n');
    const sites = [];
    for (const m of masked.matchAll(/(?<![\w$.])fetch\s*\(/g)) {
        const before = masked.slice(0, m.index).replace(/\s+$/, '');
        const word = (/[\w$]+$/.exec(before) ?? [null])[0];
        if (word && !REGEX_AFTER_KEYWORD.has(word)) continue;
        const line = masked.slice(0, m.index).split('\n').length;
        sites.push({ line, window: lines.slice(line - 1, line - 1 + WINDOW).join('\n') });
    }
    return sites;
}

const FILES = jsFiles(ROOT);

describe('⛔ trap 1057 — every `fetch` in `scripts/` drains its body or asks for none', () => {
    it('the scan has a population to be about', () => {
        expect(FILES.length).toBeGreaterThan(0);
        expect(FILES.flatMap((f) => fetchSites(readFileSync(f, 'utf8'))).length).toBeGreaterThan(0);
    });

    it('⛔ NOT ONE undrained `fetch` — the finding names file, line and the call', () => {
        const findings = [];
        for (const f of FILES) {
            const src = readFileSync(f, 'utf8');
            for (const s of fetchSites(src)) {
                if (DRAINS.test(s.window) || NO_BODY.test(s.window)) continue;
                findings.push(`${relative(REPO, f)}:${s.line}  ${s.window.split('\n')[0].trim()}`);
            }
        }
        expect(findings).toEqual([]);
    });

    it('⛓ the detector really can see an undrained call — the control', () => {
        const bad = 'const alive = await fetch(`${HOST}/x.json`).then((r) => r.ok);\n';
        const good = 'const alive = await fetch(`${HOST}/x.json`)\n'
            + '    .then(async (r) => { await r.arrayBuffer(); return r.ok; });\n';
        const undrained = (src) => fetchSites(src)
            .filter((s) => !DRAINS.test(s.window) && !NO_BODY.test(s.window));
        expect(undrained(bad)).toHaveLength(1);
        expect(undrained(good)).toHaveLength(0);
        expect(undrained("const r = await fetch(u, { method: 'HEAD' });\n")).toHaveLength(0);
    });

    it('⛔ …and it does NOT see the word inside prose — the other control', () => {
        expect(fetchSites('const m = `cancelled sphere-log fetch(es) over 5 loads`;\n')).toHaveLength(0);
        expect(fetchSites('const r = await api.fetch(u);\n')).toHaveLength(0);
    });
});
