/**
 * maskComments — **THE UNIT ROWS, OVER THE EXACT §30.8b SHAPE** (R9 slice
 * P4a, ⚖ ruling 47b (1); traps 579/580).
 *
 * ⛓ The calibration row is the one the kickoff describes literally: an
 * apostrophe in a `//` comment above a `describe(`, and a typed cardinality
 * far below it that the mis-parse made invisible.
 */
import { describe, expect, it } from 'vitest';

import { maskComments, regexAllowed } from './maskComments.js';

/** ⛓ Every row asserts the LENGTH too — the offsets are what the lint reports. */
const mask = (t) => {
    const m = maskComments(t);
    expect(m, 'a mask never changes the length — the lint reports file:line by '
        + 'counting newlines before an index').toHaveLength(t.length);
    for (let i = 0; i < t.length; i++) {
        if (t[i] !== m[i]) expect(m[i], `char ${i}`).toBe(' ');
    }
    return m;
};

describe('⛓ comments go, code stays, offsets do not move', () => {
    it('blanks a line comment and keeps its newline', () => {
        expect(mask('a; // gone\nb;')).toBe('a;        \nb;');
    });

    it('blanks a block comment across lines', () => {
        expect(mask('a;/* one\ntwo */b;')).toBe('a;      \n      b;');
    });

    /**
     * ⛔ THE FIXTURE CARRIES NO COUNT, AND THAT IS DELIBERATE. This file is IN
     * `lint-gate-labels`'s corpus (a `.js`/`.test.js` under `scripts/procgen`)
     * and it does not import the lint, so the exclusion rule there — *does the
     * file import this module* — does not reach it. A crafted label that FIRES
     * would land in the lint's own allowlist, which is the fixed point that
     * rule exists to prevent. The row's subject is that the string survives.
     */
    it('⛔ leaves STRINGS alone — the label is the lint\'s whole subject', () => {
        const t = "check(pane.toggles.length === n, 'a label with a // inside it');";
        expect(mask(t)).toBe(t);
    });

    it('⛔ leaves a regex holding a quote or a slash alone', () => {
        for (const t of ["const re = /['\"]/;", 'const re = /a\\/\\/b/;', 'x.split(/[,/]/);']) {
            expect(mask(t)).toBe(t);
        }
    });

    it('⛔ a `/` after a value is DIVISION, and the comment after it still goes', () => {
        expect(mask('const r = a.length / 2; // gone')).toBe(`const r = a.length / 2; ${' '.repeat(7)}`);
    });

    it('handles a template literal, its substitution, and a comment inside one', () => {
        expect(mask('`a${b(/* x */ c)}d`')).toBe(`\`a\${b(${' '.repeat(8)}c)}d\``);
        expect(mask("`it's fine // here`")).toBe("`it's fine // here`");
    });

    it('⛓ regexAllowed: a keyword wins over the last character', () => {
        expect(regexAllowed('n', 'return')).toBe(true);
        expect(regexAllowed('x', 'foo')).toBe(false);
        expect(regexAllowed(')', '')).toBe(false);
        expect(regexAllowed('=', '')).toBe(true);
    });

    /**
     * ⛔⛔ THE DEFECT THE POSITIVE CONTROL FOUND IN THIS MODULE'S FIRST CUT.
     * `Array.from` iterates code POINTS, so one astral character made the
     * masked text one UTF-16 unit shorter than the source and every offset
     * after it was wrong — `check-topdown-steps-ui.mjs`, 22564 → 22563.
     */
    it('⛔ an astral character does not move a single offset', () => {
        const t = 'const e = "🎯"; // gone\nconst n = 1;';
        const m = mask(t);
        expect(m).toHaveLength(t.length);
        expect(m.indexOf('const n')).toBe(t.indexOf('const n'));
    });
});

/**
 * ⛔⛔ THE §30.8b SHAPE ITSELF — one apostrophe in a `//` comment above a
 * `describe(`, and the typed cardinality below it that the fake string hid.
 * The row is written against the SCANNER's brace walk, because that is where
 * the damage was: the describe at 12c″'s head parsed as spanning the whole
 * file.
 */
describe('⛔⛔ the ~2,000-line dead zone (§30.8b, traps 579/580)', () => {
    const SOURCE = [
        "describe('the strategy catalog seam', () => {",
        "    // the gate's own row — one apostrophe, and the scan opened a string",
        "    it('walks', () => { expect(true).toBe(true); });",
        '});',
        '',
        "describe('a roster row far below', () => {",
        "    it('previews every prefix', () => {",
        '        expect(PREFIXES.length).toBe(4);',
        '    });',
        '});',
        '',
    ].join('\n');

    /** ⛓ the pre-fix scanner, copied verbatim, so the row measures the DEFECT. */
    const callsInUnmasked = (text, name) => {
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
            out.push(text.slice(m.index, i + 1));
            m = re.exec(text);
        }
        return out;
    };

    it('⛔ WITHOUT the mask the first describe swallows the rest of the source', () => {
        const first = callsInUnmasked(SOURCE, 'describe')[0];
        expect(first, 'the apostrophe in the comment opened a string that never closed')
            .toContain('a roster row far below');
    });

    it('⛓ WITH the mask it ends where it is written, and the roster row is its own', () => {
        const calls = callsInUnmasked(maskComments(SOURCE), 'describe');
        expect(calls).toHaveLength(2);
        expect(calls[0]).not.toContain('a roster row far below');
        expect(calls[1]).toContain('PREFIXES.length');
    });
});
