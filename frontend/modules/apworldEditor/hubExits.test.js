/**
 * The HUB'S EXITS — download, the raw view's size guard, and the source name
 * Apply publishes under (APWORLD EDITOR HUB slice H2).
 *
 * ⛓ The three exits the ⚖ asked for share one property: each is a function of
 * the WORKING COPY plus one decision, and the decision is the thing worth
 * pinning. The DOM halves are the in-app rows' job (a Blob's bytes, a textarea
 * mounting); these are the decisions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rulesDownloadName, rulesDownloadText } from './downloadJson.js';
import {
    RAW_VIEW_LIMIT_BYTES,
    parseRawView,
    rawViewText,
    rawViewVerdict,
    utf8Bytes,
} from './rawView.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('rulesDownloadName', () => {
    /**
     * ⛓⛓ The brief asked for `<seed_name or game_name>_rules.json`. Measured
     * over the 205 committed presets that rule yields **24** distinct names
     * (112 share one seed) and, in **29** of them, `seed_name` is the EMPTY
     * STRING — so "prefer seed_name" names the download `_rules.json`. Both
     * identifiers together yield 162. These rows pin the empty-seed case, which
     * is the one real data produces.
     */
    it('uses both identifiers, in the on-disk order', () => {
        expect(rulesDownloadName({ game_name: 'Raft', seed_name: '14089154938208861744' }))
            .toBe('Raft_AP_14089154938208861744_rules.json');
    });

    it('drops an EMPTY seed_name rather than naming the file `_rules.json`', () => {
        expect(rulesDownloadName({ game_name: 'Raft', seed_name: '' }))
            .toBe('Raft_rules.json');
    });

    it('drops an absent game_name', () => {
        expect(rulesDownloadName({ seed_name: '7' })).toBe('AP_7_rules.json');
    });

    it('falls back to `rules.json` when the document names neither', () => {
        expect(rulesDownloadName({})).toBe('rules.json');
        expect(rulesDownloadName(null)).toBe('rules.json');
    });

    it('⛔ cannot emit a path separator or a run of underscores', () => {
        const name = rulesDownloadName({ game_name: '../../etc/pas swd', seed_name: 'a/b' });
        expect(name).not.toContain('/');
        expect(name).not.toContain('\\');
        expect(name).not.toMatch(/__/);
        expect(name.endsWith('_rules.json')).toBe(true);
    });
});

describe('rulesDownloadText / rawViewText', () => {
    /**
     * ⛔ The two writers must agree byte for byte: the raw view is what the
     * person looked at and the download is what they saved, and a difference
     * between them is a file that does not match the screen it came from.
     */
    it('the download and the raw view produce the SAME bytes', () => {
        const doc = { b: 1, a: { z: [1, 2], y: 'x' } };
        expect(rulesDownloadText(doc)).toBe(rawViewText(doc));
    });

    it('⛔ preserves key ORDER — it is content for this document, not decoration', () => {
        const text = rulesDownloadText({ b: 1, a: 2 });
        expect(text.indexOf('"b"')).toBeLessThan(text.indexOf('"a"'));
    });

    it('is two-space pretty-printed, which is what the committed presets are', () => {
        expect(rulesDownloadText({ a: { b: 1 } })).toBe('{\n  "a": {\n    "b": 1\n  }\n}');
    });
});

describe('utf8Bytes', () => {
    it('counts BYTES, not UTF-16 code units', () => {
        expect(utf8Bytes('abc')).toBe(3);
        // ⛓ A 3-byte character that `String.length` calls 1, and a 4-byte one
        //   `String.length` calls 2 — a document of item names in either is
        //   bigger than `text.length` says.
        expect(utf8Bytes('☃')).toBe(3);
        expect('☃'.length).toBe(1);
        expect(utf8Bytes('𝄞')).toBe(4);
        expect('𝄞'.length).toBe(2);
    });
});

describe('rawViewVerdict — the MEASURED size guard', () => {
    it('the limit is a positive byte count somebody measured', () => {
        expect(Number.isInteger(RAW_VIEW_LIMIT_BYTES)).toBe(true);
        expect(RAW_VIEW_LIMIT_BYTES).toBeGreaterThan(0);
    });

    /**
     * ⛓⛓⛓ **AN ANCHOR IN THE CORPUS, BECAUSE EVERY OTHER ROW HERE READS THE
     * CONSTANT ITSELF.** A guard whose whole test suite is expressed in terms
     * of its own default cannot see the default move: the rows below still pass
     * with the constant halved, which is exactly the mutant this slice was
     * asked to drive. ⚠ MEASURED, not assumed — the first version of this row
     * bounded the limit at the p90 preset (766,899 B) and the halved mutant
     * sailed through it, because 1,000,000 is *also* a measured-usable size.
     *
     * The bounds that DO discriminate are two real documents:
     *
     *   · **1,936,130 B** — `smz3`, the largest committed preset the instrument
     *     says is viewable (2,000,000 B measures at 1,504 ms to open and 279 ms
     *     per keystroke). A limit below it refuses a document that works, and
     *     halving the constant refuses **13 more presets** (17 of the 205
     *     exceed 1,000,000 pretty bytes; only 4 exceed 2,000,000).
     *   · **2,620,225 B** — `stardew_valley`, measured NOT usable (468–809 ms
     *     per keystroke over three runs). A limit above it admits a document
     *     the instrument says is not viewable.
     *
     * ⇒ `scripts/procgen/measure-apworld-raw-view.mjs` is what moves this row.
     */
    it('⛔ sits inside the MEASURED band — the largest viewable preset below it, '
        + 'the first unviewable one above', () => {
        expect(RAW_VIEW_LIMIT_BYTES).toBeGreaterThanOrEqual(1_936_130);
        expect(RAW_VIEW_LIMIT_BYTES).toBeLessThan(2_620_225);
    });

    /**
     * ⛓⛓ **THE DISCRIMINATOR FOR MUTANT (b)** — halve the constant and this
     * pair flips, because the two documents it names sit either side of the
     * measured limit rather than at arbitrary sizes.
     */
    it('a document at the limit is shown; one byte over it is not', () => {
        expect(rawViewVerdict(RAW_VIEW_LIMIT_BYTES).overLimit).toBe(false);
        expect(rawViewVerdict(RAW_VIEW_LIMIT_BYTES + 1).overLimit).toBe(true);
    });

    it('says the size either way, and names the limit only when it bites', () => {
        const under = rawViewVerdict(10);
        expect(under.message).toContain('10 bytes');
        expect(under.message).not.toContain('download instead');
        const over = rawViewVerdict(RAW_VIEW_LIMIT_BYTES + 1);
        expect(over.message).toContain('download instead');
        expect(over.message).toContain(RAW_VIEW_LIMIT_BYTES.toLocaleString());
    });

    it('takes an explicit limit, so a caller can ask about a different one', () => {
        expect(rawViewVerdict(100, 50).overLimit).toBe(true);
        expect(rawViewVerdict(100, 500).overLimit).toBe(false);
    });
});

describe('parseRawView', () => {
    it('accepts an object and hands back the parsed document', () => {
        const res = parseRawView('{"game_name":"X"}');
        expect(res.ok).toBe(true);
        expect(res.document).toEqual({ game_name: 'X' });
    });

    it('⛔ refuses invalid JSON, quoting the parser', () => {
        const res = parseRawView('{not json');
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Not valid JSON');
    });

    /**
     * ⛔ `typeof [] === 'object'`, so an array sails past the obvious test. A
     * rules.json is an object at the top level and nothing else.
     */
    it('⛔ refuses an array, a scalar and null BY SHAPE', () => {
        expect(parseRawView('[]').error).toContain('an array');
        expect(parseRawView('42').ok).toBe(false);
        expect(parseRawView('null').ok).toBe(false);
        expect(parseRawView('"a string"').ok).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * APPLY'S SOURCE NAME — read off the panel's own source
 * ══════════════════════════════════════════════════════════════════════ */

describe('Apply publishes the ORIGIN source name', () => {
    const panelSource = readFileSync(join(here, 'apworldEditorUI.js'), 'utf8');

    /**
     * ⛓⛓⛓ **THE SPHERE-LOG FIX, PINNED WHERE A NODE ROW CAN SEE IT.** Apply
     * used to publish the literal `apworldEditorApply`, which
     * `sphereState/index.js` cannot parse as a preset path and does not
     * recognise as one of its four named in-memory sources — so it reset the
     * sphere state and loaded nothing, for 199 of the 205 committed presets.
     * The fix is one expression, and this row is what keeps it.
     */
    it('publishes `_originSourceName` with APPLY_SOURCE only as the fallback', () => {
        expect(panelSource).toContain('this._originSourceName ?? APPLY_SOURCE');
        expect(panelSource).toContain('sourceName,');
        // ⛔ and NOT the old unconditional literal.
        expect(panelSource).not.toContain('sourceName: APPLY_SOURCE');
    });

    /**
     * ⛓ The fallback string is load-bearing OUTSIDE this module:
     * `scripts/procgen/verify-region-marking-tool.mjs` grabs the published
     * event by that exact literal, and its session is a hand-off (origin
     * `null`), so it lands on the fallback. A rename here would red a hand-run
     * browser gate; this row reds in two seconds instead.
     */
    it('⛓ the fallback literal is the one the marking-tool verifier grabs by', () => {
        expect(panelSource).toContain("const APPLY_SOURCE = 'apworldEditorApply';");
        const verifier = readFileSync(
            join(here, '../../../scripts/procgen/verify-region-marking-tool.mjs'), 'utf8');
        expect(verifier).toContain("sourceName === 'apworldEditorApply'");
    });

    /**
     * ⛓⛓ A HAND-OFF HAS NO ORIGIN, and that is what puts the verifier on the
     * fallback: the pipeline and the marking tool build their document in
     * memory, so there is no preset path whose sphere log belongs to it.
     */
    it('⛓ the hand-off boundary records origin: null', () => {
        expect(panelSource).toMatch(/source: 'hand-off', player: this\.playerId, origin: null/);
    });

    /**
     * ⛔ The echo of our own Apply can no longer be told apart by source name —
     * the source name is now the ORIGIN's, which is exactly what an incoming
     * preset load looks like. Identity is what tells them apart, and a panel
     * that got this wrong would discard the edits it had just published.
     */
    it('⛔ tells its own round-trip apart by OBJECT IDENTITY, not by source', () => {
        expect(panelSource).toContain('this._appliedDocs.has(eventData.rawJsonData)');
        expect(panelSource).toContain('this._appliedDocs.add(published)');
        expect(panelSource).not.toContain('pendingApply');
    });
});
