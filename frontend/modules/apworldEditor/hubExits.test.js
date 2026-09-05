/**
 * The HUB'S EXITS — download, the raw view, and the source name Apply publishes
 * under (APWORLD EDITOR HUB slices H2 and H2b).
 *
 * ⛓ The three exits the ⚖ asked for share one property: each is a function of
 * the WORKING COPY plus one decision, and the decision is the thing worth
 * pinning. The DOM halves are the in-app rows' job (a Blob's bytes, a
 * CodeMirror 6 view mounting); these are the decisions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rulesDownloadName, rulesDownloadText } from './downloadJson.js';
import {
    parseRawView,
    rawViewText,
    rawViewVerdict,
    utf8Bytes,
} from './rawView.js';
import * as rawViewModule from './rawView.js';

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

describe('rawViewVerdict — the size question, with no limit left to guard', () => {
    /**
     * ⛓⛓⛓ **THE H2 GUARD IS RETIRED, AND THIS IS THE ROW THAT SAYS SO.**
     *
     * H2 shipped `RAW_VIEW_LIMIT_BYTES = 2_000_000`, measured against a
     * `<textarea>` that took 12,942 ms to open the corpus maximum. H2b mounted
     * CodeMirror 6 in the tab and re-ran the same instrument with `--all`: the
     * raw tab opens EVERY committed preset, so there is no threshold left to
     * express.
     *
     * ⛔ A retirement is only real if something reds when it is undone. What
     * discriminates here is the verdict's SHAPE: reinstating a limit means
     * putting `limit`/`overLimit` back on the object, and this row names the
     * keys exhaustively rather than asserting one of them is false — an
     * `overLimit: false` that a reinstated constant could flip would sail
     * straight through a `toBe(false)`.
     */
    it('⛔ the module exports NO limit constant any more', () => {
        expect(rawViewModule.RAW_VIEW_LIMIT_BYTES).toBeUndefined();
        expect(Object.keys(rawViewModule)).not.toContain('RAW_VIEW_LIMIT_BYTES');
    });

    it('⛔ the verdict is a SIZE, not a decision — exactly two keys', () => {
        expect(Object.keys(rawViewVerdict(10)).sort()).toEqual(['bytes', 'message']);
    });

    it('says the size, and nothing about a limit or a download', () => {
        const v = rawViewVerdict(1234);
        expect(v.bytes).toBe(1234);
        expect(v.message).toContain('1,234 bytes');
        expect(v.message).not.toMatch(/limit|download instead|too big/i);
    });

    /**
     * ⛓⛓ **THE H2 ANCHOR, INVERTED — "BOTH VIEWABLE".** H2's discriminating
     * row named two real documents either side of its threshold: `smz3` at
     * 1,936,130 pretty bytes had to be viewable and `stardew_valley` at
     * 2,620,221 had to be refused. Those are still the sizes that matter, and
     * the claim about them is now the opposite one. The corpus maximum is in
     * here too, because a limit reinstated ABOVE stardew would leave the H2
     * pair green and still refuse the biggest document in the tree.
     *
     * ⇒ `scripts/procgen/measure-apworld-raw-view.mjs --all` is what moves this
     * row: it is the run that opened all 205.
     */
    it('⛔ every real document H2 measured is VIEWABLE now, the refused one included', () => {
        const sizes = [
            ['smz3 (H2: viewable)', 1_936_130],
            ['stardew_valley (H2: REFUSED)', 2_620_221],
            ['procgen_topdown/AP_8 (the corpus maximum)', 3_146_656],
        ];
        for (const [what, bytes] of sizes) {
            const v = rawViewVerdict(bytes);
            expect(Object.keys(v).sort(), what).toEqual(['bytes', 'message']);
            expect(v.message, what).not.toMatch(/limit|download instead|too big/i);
        }
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
        /**
         * ⛓ H4c — the tag's `source` now NAMES the door (`hand-off · <page>`)
         * because two more publishers joined this channel, but `origin` is
         * still `null` and for the unchanged reason: an in-memory compile has
         * no preset path whose sphere log belongs to it.
         */
        expect(panelSource).toContain("? `hand-off · ${handOffSource}`");
        expect(panelSource).toContain("player: this.playerId,");
        expect(panelSource).toMatch(/_adoptHandoffRules\([\s\S]{0,1400}?origin: null,/);
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
