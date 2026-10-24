/**
 * procgenDocs/markdownLite — the six forms, and the two things a first cut got
 * wrong. ⛓ It became a module in P2 because BOTH doc pages render prose now;
 * a second copy would be a second answer to what a link in this prose is.
 */

import { describe, expect, it } from 'vitest';

import { DEMOS } from './demos.js';
import { TERMS } from './glossary.js';
import { esc, inline, prose } from './markdownLite.js';

const NUL = String.fromCharCode(0);

describe('the six forms', () => {
    it('escapes first — the data cannot inject a tag', () => {
        expect(inline('<script>alert(1)</script>'))
            .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(esc('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    });

    it('renders code, bold, italic, a link and a bare URL', () => {
        expect(inline('`x`')).toBe('<code>x</code>');
        expect(inline('**b**')).toBe('<strong>b</strong>');
        expect(inline('*i*')).toBe('<em>i</em>');
        expect(inline('[t](http://e.test)')).toBe('<a href="http://e.test">t</a>');
        expect(inline('<https://e.test/a>')).toBe('<a href="https://e.test/a">https://e.test/a</a>');
    });

    it('⛓ a GLOSSARY cross-reference needs no seventh form', () => {
        expect(inline('see [the door law](#door-law) for it'))
            .toBe('see <a href="#door-law">the door law</a> for it');
    });

    it('⛔ a `**` INSIDE a code span is not bold — spans come out first', () => {
        expect(inline('`a ** b`')).toBe('<code>a ** b</code>');
    });

    it('⛔ the NUL placeholder does not eat bare numbers (P1 read this off the render)', () => {
        expect(inline('`x` arc 3, slice 1 and 19 ground cells'))
            .toBe('<code>x</code> arc 3, slice 1 and 19 ground cells');
    });

    it('splits blank-line paragraphs and keeps a soft wrap as a space', () => {
        expect(prose('one\ntwo\n\nthree')).toBe('<p>one two</p><p>three</p>');
        expect(prose('')).toBe('');
    });

    it('renders a fenced block verbatim and strips its language tag', () => {
        expect(prose('a\n\n```bash\nls -l\n```')).toBe('<p>a</p><pre><code>ls -l\n</code></pre>');
    });
});

describe('every string the two catalogues hold survives it', () => {
    const all = [
        ...DEMOS.flatMap((e) => [e.demonstrates, e.howToRun, e.whatIsHappening, ...e.notes]),
        ...TERMS.flatMap((e) => [e.plain, e.detail]),
    ].filter(Boolean);

    it('renders without throwing and never leaves a placeholder behind', () => {
        expect(all.length).toBeGreaterThan(300);
        for (const s of all) expect(prose(s)).not.toContain(NUL);
    });

    it('⛔ leaves no UNBALANCED code span — an odd backtick count would eat the rest', () => {
        for (const s of all) {
            expect((String(s).match(/`/g) ?? []).length % 2, s.slice(0, 60)).toBe(0);
        }
    });
});
