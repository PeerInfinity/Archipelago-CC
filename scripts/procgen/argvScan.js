/**
 * argvScan — **WHAT ONE INSTRUMENT ACCEPTS, DERIVED FROM ITS OWN TEXT** (R9
 * slice P4a, ⚖ ruling 47b (4); ⚖ ruling 38 (6): read out of the file, never a
 * hand list).
 *
 * ⛔⛔ WHY THIS IS A MODULE OF ITS OWN, AND IT IS THE SAME ARGUMENT
 * `gateRoster.js` MAKES ABOUT ITS CLASSIFIER: **there is one scanner because
 * there is one question.** These scans were written for
 * `reference/instruments.mjs`, which asks them of all 260 files at once and
 * pays for a full document sweep to do it. `argvHelp()` asks the identical
 * question of ONE file on the startup path of every instrument that prints
 * `--help`, and `reference/sources.mjs` — which `instruments.mjs` imports —
 * dynamically imports EIGHTEEN frontend modules at module scope. A `--help`
 * that loaded the whole procgen core to find out what its own flags are would
 * be the very side effect ⚖ 47b (4) exists to remove. So the scan lives here,
 * with no dependency beyond `node:` builtins, and the index imports it.
 *
 * ⛓ THE PROSE BELOW IS THE ORIGINAL's, MOVED NOT REWRITTEN — every ⛔ in it
 * records a measurement that killed an earlier cut of the same scan, and a
 * paraphrase would quietly drop the evidence.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

import { maskComments } from './maskComments.js';

/**
 * ⛓⛓ THE FLAG PATTERNS — PUBLISHED, because a table of "what this accepts" is
 * only as good as the regex behind it. Each one is a script READING ARGV
 * DIRECTLY.
 */
export const FLAG_PATTERNS = Object.freeze([
    Object.freeze({ id: 'includes', re: /\bincludes\(\s*'--([a-zA-Z][a-zA-Z0-9-]*)'/g }),
    Object.freeze({ id: 'startsWith', re: /startsWith\(\s*[`']--([a-zA-Z][a-zA-Z0-9-]*)=/g }),
]);

/**
 * ⛓⛓⛓ …AND THE HELPERS EACH FILE DEFINES FOR ITSELF, FOUND RATHER THAN
 * LISTED.
 *
 * ⛔ THE FIRST CUT LISTED THREE NAMES — `arg`, `flag`, `num` — and the
 * SPOT-CHECK killed it: `generate-seedling-level.mjs` also defines `has()` and
 * `list()`, so the table said it does not accept `--families=`, `--templates=`,
 * `--json` or `--cost`, four flags its own `Run:` block shows a reader typing.
 * A hand list of helper names is the same defect as a hand list of anything
 * else in this directory.
 *
 * So a helper is DISCOVERED: a top-level `const <name> = (<param>…) =>` whose
 * next few lines mention both `argv` and a `--${…}` template. Then every
 * `<name>('x')` call in the file is a flag.
 */
export const HELPER_DECL_RE = /^\s*(?:export )?const ([a-zA-Z][a-zA-Z0-9]*) = (?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>)/gm;

/** ⛓ The local name a file gives `process.argv` — `args`, `argv`, … A helper
 *  written over one of these never mentions `argv` itself. */
export const ARGV_ALIAS_RE = /const ([a-zA-Z][a-zA-Z0-9]*) = process\.argv\b/g;
export const HELPER_WINDOW = 400;

/** ⛓ `import { arg, flag } from './reference/lib.mjs'` — a named import from a
 *  RELATIVE module. */
const RELATIVE_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*'(\.[^']*)'/g;

export function argvHelpersIn(text, { file = null } = {}) {
    const decls = allOf2(text, HELPER_DECL_RE)
        .map((m) => ({ name: m[1], window: text.slice(m.index, m.index + HELPER_WINDOW) }));
    const aliases = allOf2(text, ARGV_ALIAS_RE).map((m) => m[1]);
    const readsArgv = new RegExp(`\\bargv\\b${aliases.map((a) => `|\\b${a}\\b`).join('')}`);
    /** ⛓ …and LOOKS one up: a `--` literal, or one of the four ways this tree
     *  searches an argument list. `const has = (flag) => argv.includes(flag);`
     *  names no `--` at all — the caller supplies it. */
    const looksUp = /--\$\{|--'|--"|\.includes\(|\.indexOf\(|\.find\(|startsWith\(/;
    const found = new Set();
    for (const d of decls) {
        if (readsArgv.test(d.window) && looksUp.test(d.window)) found.add(d.name);
    }
    /**
     * ⛓⛓⛓ …TO A FIXED POINT, which is P3a's projection lesson in this file's
     * spelling. `const num = (name, fallback) => Number(arg(name, fallback));`
     * never mentions `argv` — it delegates — so the first cut lost every
     * numeric flag in the directory (`--count=`, `--seed=`, `--tries=`,
     * `--k=`, `--cellbudget=`). A helper that CALLS a helper IS one.
     */
    /**
     * ⛓⛓ …AND ONE LEVEL ACROSS FILES. `generate-procgen-reference.mjs` reads
     * `--check` and `--out=` through `arg`/`flag` IMPORTED from
     * `reference/lib.mjs`, so nothing in its own text declares a helper and
     * the table said it takes no flags — about the very file that writes the
     * table. A named import from a RELATIVE module counts as a helper when
     * that module declares it as one. ⛔ One level, deliberately: a helper
     * imported through two modules is not a shape this directory has.
     */
    if (file) {
        for (const m of allOf2(text, RELATIVE_IMPORT_RE)) {
            const target = resolvePath(dirname(file), m[2]);
            if (!existsSync(target)) continue;
            const theirs = new Set(argvHelpersIn(readFileSync(target, 'utf8')));
            for (const name of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop())) {
                if (theirs.has(name)) found.add(name);
            }
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const d of decls) {
            if (found.has(d.name)) continue;
            for (const h of found) {
                if (!new RegExp(`\\b${h}\\(`).test(d.window)) continue;
                found.add(d.name);
                changed = true;
                break;
            }
        }
    }
    return [...found].sort();
}

export const allOf2 = (text, re) => {
    const out = [];
    const r = new RegExp(re.source, re.flags);
    let m = r.exec(text);
    while (m) { out.push(m); m = r.exec(text); }
    return out;
};

/**
 * ⛓ What the file's own `Run:` / `Usage:` block SHOWS a reader typing.
 *
 * ⛔⛔ THE TRAILING DELIMITER IS A LOOKAHEAD, AND IT HAS TO BE (R9 slice 10).
 * It used to be a consuming `[=\s]`, which requires a character AFTER the flag
 * name — and the LAST flag in a usage block has none: the captured text ends
 * where the docblock does. ⇒ every instrument whose usage block's final line
 * ended in a bare flag reported that flag as UNDOCUMENTED, silently, in the
 * generated index. Measured by swapping two usage lines in
 * `census-seedling-campaign.mjs` and watching which of the two disappeared: the
 * one that moved to the end, both times. `(?=[=\s]|$)` consumes nothing and
 * accepts end-of-text, so a flag is documented wherever it is written.
 */
export const DOCUMENTED_FLAG_RE = /--([a-zA-Z][a-zA-Z0-9-]*)(?=[=\s]|$)/g;

const allOf = (text, re) => {
    const out = [];
    const r = new RegExp(re.source, re.flags);
    let m = r.exec(text);
    while (m) { out.push(m[1]); m = r.exec(text); }
    return out;
};

/* ══════════════════════════════════════════════════════════════════════
 * THE HEADER AND ITS DOCBLOCK
 * ══════════════════════════════════════════════════════════════════════ */

/** Everything before the first EXECUTABLE line. */
export function headerOf(text) {
    const out = [];
    let inBlock = false;
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (inBlock) { out.push(line); if (t.includes('*/')) inBlock = false; continue; }
        if (t === '' || t.startsWith('#!') || t.startsWith('//')) { out.push(line); continue; }
        if (t.startsWith('/*')) { out.push(line); if (!t.includes('*/')) inBlock = true; continue; }
        if (/^(import|export)\b/.test(t) || /^[)}\]];?$/.test(t) || /^['"]/.test(t)) {
            out.push(line);
            continue;
        }
        break;
    }
    return out.join('\n');
}

/** The first comment block in a header, as plain text, with its style. */
export function docblockOf(header) {
    const block = /\/\*\*?([\s\S]*?)\*\//.exec(header);
    if (block) {
        return {
            style: 'block',
            text: block[1].split('\n').map((l) => l.replace(/^\s*\*ims?/, '')
                .replace(/^\s*\*\s?/, '')).join('\n').trim(),
        };
    }
    const line = /(?:^|\n)((?:[ \t]*\/\/[^\n]*\n)+)/.exec(header);
    if (line) {
        return {
            style: 'line',
            text: line[1].split('\n').map((l) => l.replace(/^\s*\/\/\s?/, '')).join('\n').trim(),
        };
    }
    return null;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE TWO QUESTIONS A CALLER ACTUALLY ASKS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ Every flag a file READS OUT OF ITS OWN ARGV, with how each was found —
 * the loop `reference/instruments.mjs` has always run, lifted verbatim so
 * `argvHelp()` and the index cannot drift apart.
 *
 * @param {string} text  the file's source
 * @param {object} [o]
 * @param {string} [o.file]  its absolute path, for the one-hop helper import
 * @returns {{name: string, how: string[]}[]}
 */
export function flagsIn(text, { file = null } = {}) {
    const flags = new Set();
    const how = new Map();
    /**
     * ⛔⛔ R9 SLICE P4a — **A FLAG CALL MUST BE CODE; A HELPER'S EVIDENCE MAY
     * BE PROSE.** The scan below reads the MASKED text, because
     * `reference/instruments.mjs`'s own docblock writes
     * `process.argv.includes('--x')` to explain the pattern and every
     * instrument that imports that module was credited with a flag called
     * `--x`. But `argvHelpersIn` keeps the RAW text on purpose: it discovers a
     * helper by asking whether the 400 characters after its declaration
     * mention `argv` and a `--` at all, and for `generate-seedling-level.mjs`'s
     * `list()` that evidence is in the comment beside it. Masking there loses
     * `--families=` and `--templates=` — two flags the file's own `Run:` block
     * shows a reader typing, which is the exact false report the helper
     * discovery was written to end. Discovery is a heuristic about intent;
     * a CALL is a fact about code. Measured: one file moves either way, and
     * this split is the one where neither moves wrongly.
     */
    const code = maskComments(text);
    const helpers = argvHelpersIn(text, file ? { file } : {});
    const patterns = [
        ...FLAG_PATTERNS,
        ...helpers.map((h) => ({
            id: h,
            /** ⛓ `--` OPTIONAL: `flag('source')` and `flag('--source')` are
             *  both this directory's spelling, and the second one is how
             *  every `indexOf(name)` helper is called. */
            re: new RegExp(`\\b${h}\\(\\s*'(?:--)?([a-zA-Z][a-zA-Z0-9-]*)'`, 'g'),
        })),
    ];
    for (const p of patterns) {
        for (const name of allOf(code, p.re)) {
            if (name === 'name' || name === 'n') continue;
            flags.add(name);
            if (!how.has(name)) how.set(name, []);
            if (!how.get(name).includes(p.id)) how.get(name).push(p.id);
        }
    }
    return [...flags].sort().map((name) => ({ name, how: how.get(name).sort() }));
}

/** ⛓ What the file's own `Run:` / `Usage:` block SHOWS a reader typing. */
export function documentedFlagsIn(docText) {
    const runBlock = docText
        ? (/(?:^|\n)\s*(?:Run|Usage|USAGE|RUN):([\s\S]*?)(?:\n\s*\n|$)/.exec(docText)
            ?? [])[1] ?? ''
        : '';
    return [...new Set(allOf(runBlock, DOCUMENTED_FLAG_RE))].sort();
}

/**
 * ⛓⛓⛓ R9 SLICE P4a — **AN INHERITED FLAG, ATTRIBUTED TO THE FILE THAT
 * ACCEPTS IT AND CREDITED TO THE FILE THAT PARSES IT** (§48.13 item 2 /
 * §50.11 item 2).
 *
 * ⛔ THE DEFECT: the scan above attributes a flag to whoever READS ARGV for
 * it, which is a true statement about where the parse lives and a MISLEADING
 * one about what a file accepts. `--wait-for-box=<sec>` is parsed inside
 * `boxLock.js`'s `takeBoxLockOrExit`, so ninety-six instruments accept it and
 * the table said none of them did. Same for `--help` once `argvHelp.js` owns
 * that parse.
 *
 * ⛓ ONE HOP, AND THE SPELLING IS THE DETECTOR — the module-path law
 * `gateRoster.js` states for `SIBLING_RE` and R9 slice 12j paid for twice:
 * `'./boxLock.js'` in an import RESOLVES; `scripts/procgen/boxLock.js` in a
 * docblock READS. Only a real relative import counts, and only the flags that
 * module reads out of ITS own argv are passed on — a flag the importer also
 * reads itself stays the importer's own.
 *
 * @returns {{name: string, from: string}[]}
 */
export function inheritedFlagsIn(text, { file }) {
    if (!file) return [];
    const own = new Set(flagsIn(text, { file }).map((f) => f.name));
    const out = new Map();
    /* ⛓ …and an import written inside a comment is not an import. */
    for (const m of allOf2(maskComments(text), RELATIVE_IMPORT_RE)) {
        const target = resolvePath(dirname(file), m[2]);
        if (!existsSync(target)) continue;
        let theirs;
        try { theirs = readFileSync(target, 'utf8'); } catch { continue; }
        for (const f of flagsIn(theirs, { file: target })) {
            if (own.has(f.name) || out.has(f.name)) continue;
            out.set(f.name, { name: f.name, from: target.split('/').pop() });
        }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * ⛓⛓⛓ R9 SLICE P4a — **WHERE A FILE'S BODY BEGINS**, which is the only place
 * a guard can be inserted and still preempt the file's own module scope.
 *
 * ⛔⛔ AND IT IS NOT `headerOf`'s END. `headerOf` walks LINE BY LINE and stops
 * at the first line that is not blank, `#!`, a comment or a line STARTING with
 * `import`/`export` — so a multi-line import stops it on its second line. That
 * is harmless for the docblock, which is what `headerOf` is for. As an
 * INSERTION ANCHOR it is a defect: measured on this directory, splicing at
 * `headerOf`'s end broke **33 of 260** files by landing inside an import's
 * brace list, every one caught by `node --check`.
 *
 * ⛔ AND IT IS NOT "AFTER THE LAST IMPORT" EITHER — trap 906. Three `verify-*`
 * files keep their header docblock BELOW their imports, and a bulk insert
 * after the last import landed above it, so the instruments index took the
 * inserted lines as those files' `oneLiner`.
 *
 * ⛓ SO THE RULE IS STATED POSITIVELY AND HAS NO EXCEPTIONS: the body starts at
 * the first line of the MASKED source that is not blank, not a `#!`, and not
 * part of an `import`/`export … from` statement. Comments are already blank in
 * the masked text, so a docblock keeps its place wherever it sits; a
 * multi-line import is followed to its terminator by brace depth; and a file
 * whose first statement is `export const SITES = Object.freeze([` gets the
 * anchor ABOVE it — which `headerOf` did not, because its line rule accepts a
 * bare `export` as header. Measured on this directory: the `headerOf` anchor
 * broke 33 of 260 files, the last-import anchor broke 2, this one breaks 0,
 * and `node --check` over all 262 is the control that says so.
 *
 * @param {string} text
 * @returns {number} a 0-based LINE index to splice at
 */
export function bodyStartLine(text) {
    const code = maskComments(text).split('\n');
    let depth = 0;
    let inImport = false;
    for (let i = 0; i < code.length; i++) {
        const l = code[i];
        if (inImport) {
            for (const c of l) {
                if ('([{'.includes(c)) depth++;
                else if (')]}'.includes(c)) depth--;
            }
            if (depth === 0 && /;\s*$|['"]\s*$/.test(l)) inImport = false;
            continue;
        }
        /* ⛓ a comment is already blank here, so a docblock BELOW the imports
         *   costs nothing — which is exactly trap 906's three `verify-*` files. */
        if (l.trim() === '' || l.startsWith('#!')) continue;
        if (/^\s*import\s/.test(l) || /^\s*export\s[^=]*\bfrom\s*['"]/.test(l)) {
            for (const c of l) {
                if ('([{'.includes(c)) depth++;
                else if (')]}'.includes(c)) depth--;
            }
            if (!(depth === 0 && /;\s*$|['"]\s*$/.test(l))) inImport = true;
            continue;
        }
        return i;
    }
    return code.length;
}
