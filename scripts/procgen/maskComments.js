/**
 * maskComments — **A COMMENT IS NOT CODE, AND A SCANNER THAT CANNOT TELL THEM
 * APART READS AN APOSTROPHE AS A STRING** (R9 slice P4a, ⚖ ruling 47b (1);
 * traps 579/580, kickoff §30.8b).
 *
 * ── ⛔⛔ THE DEFECT THIS EXISTS FOR, MEASURED ──────────────────────────
 *
 * `lint-gate-labels.mjs`'s `callsIn` walks braces and tracks `'`/`"`/`` ` ``
 * so a paren inside a string does not end a call. It does NOT skip comments.
 * So one apostrophe in a `//` line — *"slice 3 extends, never restructures"*
 * has none, but `// the gate's own row` does — opens a fake string that never
 * closes, and the enclosing `describe(` swallows the rest of the file. At
 * 12c″'s head `solverBot.test.js`'s describe at line 711 parsed as spanning
 * **711 → 2675 of 2675**: a ~2,000-line DEAD ZONE where a typed cardinality
 * was invisible, and where a prose name 1,900 lines away was read as a
 * cardinality derived from somebody else's roster.
 *
 * ── ⛓ WHAT THIS RETURNS, AND WHY IT IS A MASK RATHER THAN A STRIP ─────
 *
 * A string of **exactly the same length**, with every comment character
 * replaced by a space and every newline kept. ⛔ That is the whole design:
 * the lint reports `file:line` by counting newlines before a match's index,
 * and its allowlist is keyed on the LABEL rather than the line precisely
 * because line numbers churn. A stripper that shortened the text would move
 * every offset after the first comment and the report would name the wrong
 * lines — a fix that makes the output quieter and wronger.
 *
 * ⛓ STRINGS ARE PRESERVED, deliberately. The lint's whole subject is the
 * LABEL — a string literal — beside a condition. Blanking strings would blank
 * the finding.
 *
 * ── ⛔ THE `/` PROBLEM, WHICH IS THE ONLY HARD PART ───────────────────
 *
 * A comment scanner that does not know regex literals is the same defect one
 * character over: `/['"]/` holds a quote and `/a\/\/b/` holds a `//`, so
 * reading either as code re-opens the fake string this module closes. A `/`
 * begins a REGEX unless the last significant token says otherwise — an
 * identifier, a number, `)`, `]` or `}` means DIVISION; one of the keywords
 * below means regex whatever the last character was (`return /x/` ends in
 * `n`).
 *
 * ⚠ AND THE BOUND IS NAMED. `if (x) /re/.test(s)` — a regex directly after a
 * closing paren — is read as division here, and `a++ / 2` after an increment
 * as a regex. Both are absent from this repository's two corpus roots
 * (measured: the masked text of all 1,000+ scanned files parses to the same
 * call set as the unmasked one everywhere the two can disagree, §51). A full
 * parser would settle them; this tree does not have one — `acorn`/`espree`
 * are not installed and `@babel/parser` is present only transitively, so a
 * lint built on it would break the day `jsdoc` moves.
 */

/** ⛓ After one of these a `/` is a REGEX, whatever the last character was. */
export const REGEX_AFTER_KEYWORD = Object.freeze(new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else',
    'case', 'yield', 'await', 'throw',
]));

const IDENT_RE = /[A-Za-z0-9_$]/;
/** ⛓ After one of these a `/` is DIVISION — a value just ended. */
const VALUE_END_RE = /[)\]}]/;

/** Whether a `/` at this point opens a regex literal. */
export function regexAllowed(lastSig, lastWord) {
    if (REGEX_AFTER_KEYWORD.has(lastWord)) return true;
    if (lastSig === '') return true;
    return !(IDENT_RE.test(lastSig) || VALUE_END_RE.test(lastSig));
}

/**
 * Every `//` and `/* *\/` comment blanked to spaces, newlines kept, offsets
 * and length unchanged. Strings, template literals and regex literals are
 * returned verbatim.
 *
 * @param {string} text
 * @returns {string}
 */
export function maskComments(text) {
    /** ⛔ SPLIT BY UTF-16 UNIT, NOT BY CODE POINT. `Array.from` iterates code
     *  POINTS, so one astral character (an emoji outside the BMP) makes the
     *  array SHORTER than `text.length` and every offset after it is wrong by
     *  one — measured on `check-topdown-steps-ui.mjs`, whose masked length
     *  came back 22563 for a 22564-character file. Every other index in this
     *  module (`indexOf`, `text[i]`) is a UTF-16 index. */
    const out = text.split('');
    const blank = (a, b) => {
        for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
    };
    /** ⛓ The brace depths a template substitution suspended — `${` opens a
     *  CODE region inside a template, and it can hold another template. */
    const tpl = [];
    let state = 'code';
    let depth = 0;
    let lastSig = '';
    let lastWord = '';
    let prevIdent = false;
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (state === 'code') {
            if (c === '/' && text[i + 1] === '/') {
                let j = text.indexOf('\n', i);
                if (j < 0) j = text.length;
                blank(i, j);
                i = j;
                continue;
            }
            if (c === '/' && text[i + 1] === '*') {
                const k = text.indexOf('*/', i + 2);
                const j = k < 0 ? text.length : k + 2;
                blank(i, j);
                i = j;
                continue;
            }
            if (c === "'" || c === '"') { state = c; i++; lastSig = c; prevIdent = false; continue; }
            if (c === '`') { state = '`'; i++; lastSig = c; prevIdent = false; continue; }
            if (c === '/' && regexAllowed(lastSig, lastWord)) {
                state = 'regex'; i++; prevIdent = false; continue;
            }
            if (/\s/.test(c)) { prevIdent = false; i++; continue; }
            if (c === '{') depth++;
            else if (c === '}') {
                if (depth === 0 && tpl.length) {
                    depth = tpl.pop(); state = '`'; i++; lastSig = '}'; prevIdent = false; continue;
                }
                depth--;
            }
            if (IDENT_RE.test(c)) { lastWord = prevIdent ? lastWord + c : c; prevIdent = true; } else {
                lastWord = ''; prevIdent = false;
            }
            lastSig = c;
            i++;
            continue;
        }
        if (state === "'" || state === '"') {
            if (c === '\\') { i += 2; continue; }
            if (c === state) state = 'code';
            i++;
            continue;
        }
        if (state === '`') {
            if (c === '\\') { i += 2; continue; }
            if (c === '`') { state = 'code'; lastSig = '`'; i++; continue; }
            if (c === '$' && text[i + 1] === '{') {
                tpl.push(depth); depth = 0; state = 'code'; lastSig = '{'; prevIdent = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }
        if (state === 'regex') {
            if (c === '\\') { i += 2; continue; }
            if (c === '[') { state = 'rclass'; i++; continue; }
            /** ⛓ A regex literal cannot span a line. An unterminated one is a
             *  `/` this heuristic called wrong; recovering at the newline
             *  bounds the damage to that line instead of the file. */
            if (c === '\n') { state = 'code'; i++; continue; }
            if (c === '/') { state = 'code'; lastSig = '/'; lastWord = ''; i++; continue; }
            i++;
            continue;
        }
        /* state === 'rclass' — inside a regex character class, where `/` is literal */
        if (c === '\\') { i += 2; continue; }
        if (c === ']') state = 'regex';
        i++;
    }
    return out.join('');
}
