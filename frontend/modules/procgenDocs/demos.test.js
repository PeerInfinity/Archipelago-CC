/**
 * procgenDocs/demos — **THE CATALOGUE IS DATA, SO IT CAN BE GATED WITHOUT A
 * BROWSER.** (PROCGEN DOCS slice P1, D5.)
 *
 * ⛓ `check-procgen-demos.mjs` is the expensive gate: it LOADS every URL and
 * asserts every claim off the live page. This file is the cheap one that runs
 * in every unit sweep — the entry shape, the claim grammar, and the ONE
 * spelling of the Pages mapping. A malformed entry should red here in a
 * second rather than 4 minutes into a Playwright row.
 *
 * ⛔ The Pages rows below are LITERAL, not `pagesHref` applied twice: a test
 * that computed its expectation with the function under test would pass with
 * the `/frontend` strip deleted (trap 367 — a gate phrased against the
 * constant it tests is an ECHO).
 */

import { describe, expect, it } from 'vitest';

import {
    CLAIM_OPS, DEMOS, PAGES_BASE, READOUTS, REPO_URL, docHref, localHref, pagesHref, parseClaim,
} from './demos.js';

describe('the catalogue as data', () => {
    it('is FROZEN, entries and all — a reader cannot edit the source of truth', () => {
        expect(Object.isFrozen(DEMOS)).toBe(true);
        for (const e of DEMOS) expect(Object.isFrozen(e)).toBe(true);
    });

    it('numbers its entries 1..N with no gaps, in order', () => {
        expect(DEMOS.map((e) => e.n)).toEqual(DEMOS.map((_, i) => i + 1));
    });

    it('gives every entry a UNIQUE slug — it is the anchor AND the --only= key', () => {
        const ids = DEMOS.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it('⛓ names GLOSSARY terms on every entry — P2 filled the field P1 reserved', () => {
        /** ⛔ The slugs are RESOLVED against `glossary.js` in
         *  `glossary.test.js`, not here: this file gates the catalogue's own
         *  shape and must not need the other module to say whether an entry is
         *  well-formed. What it does assert is that the field is a frozen flat
         *  array of slug-shaped strings with no repeats. */
        for (const e of DEMOS) {
            expect(Object.isFrozen(e.terms), e.id).toBe(true);
            expect(e.terms.length, e.id).toBeGreaterThan(0);
            expect(new Set(e.terms).size, e.id).toBe(e.terms.length);
            for (const slug of e.terms) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it('keeps the prose free of HTML — the renderer handles markdown, the data holds none', () => {
        for (const e of DEMOS) {
            for (const p of [e.demonstrates, e.howToRun, e.whatIsHappening, ...e.notes]) {
                if (p) expect(p).not.toMatch(/<\/?[a-zA-Z][^>]*>/);
            }
        }
    });
});

describe('every non-prose entry is loadable by the row', () => {
    const real = DEMOS.filter((e) => !e.prose);

    /** ⛓ 13 → **19** at PROCGEN ELEMENTS arc 5 slice 6b: the arc's close pays the
     *  per-slice demo debt every slice from 1 on left behind (the room contract,
     *  the oriented site pick, `chamber`, `arena`, the maze SHORTENS witness and
     *  the density block beside the default's new shape). ⛓ 19 → **20** at
     *  SEEDLING BOT R9 slice 0: the FORM CONTROLS, claiming `elementsAsked ==
     *  null` on a URL that names no element — the LOAD half of the element
     *  control's third state. ⚠ Its reach is measured and bounded: the row
     *  never presses a ladder button, so the PRESS half is CLAIM 5R's. */
    it('has 20 of them, and exactly one PROSE entry', () => {
        expect(real).toHaveLength(20);
        expect(DEMOS.filter((e) => e.prose)).toHaveLength(1);
    });

    it.each(real.map((e) => [e.n, e.id, e]))('%i %s — page, url and claim', (_n, _id, e) => {
        expect(READOUTS.has(e.page)).toBe(true);
        expect(e.url.length).toBeGreaterThan(0);
        expect(e.url.startsWith('?')).toBe(false);
        const claim = parseClaim(e.claim);
        expect(CLAIM_OPS).toContain(claim.op);
        expect(claim.path.length).toBeGreaterThan(0);
        if (e.also) expect(e.also.startsWith('?')).toBe(false);
        if (e.layer) expect(['off', 'sites', 'elements', 'areas', 'all']).toContain(e.layer);
        // ⛓ A control is a SELECTOR, because the row queries the page with it —
        // a prose label ("the load button") would resolve to nothing and the
        // row would report a missing control that is right there.
        if (e.control) expect(e.control).toMatch(/^[#.]/);
        /**
         * ⛓⛓ R9 slice 1 (E1) — `cli` is `{command, exit[, skip]}` and the
         * BROWSER ROW RUNS IT. ⛔ The shape is pinned here because the row
         * spawns whatever this field holds: a bare string would become
         * `bash -c undefined`, and a missing `exit` would compare against
         * `undefined` and pass for any command that crashed.
         */
        if (e.cli) {
            expect(typeof e.cli.command).toBe('string');
            expect(e.cli.command.length).toBeGreaterThan(0);
            expect(Number.isInteger(e.cli.exit)).toBe(true);
            // ⛔ a skip is a REASON, never a bare flag
            if ('skip' in e.cli) expect(e.cli.skip.length).toBeGreaterThan(20);
        }
    });

    /**
     * ⛓⛓⛓ **THE ONE ENTRY THAT DECLARES A NON-ZERO EXIT, AS A LITERAL.** A
     * refused directive is the catalogue's only headless twin that must FAIL,
     * and its exit code is the refusal's own vocabulary (`generate-seedling-
     * level.mjs` exits 6 on a refused `--require=`). ⛔ Pinned because the
     * command carried a `; echo $?` tail until R9 slice 1 — which made the
     * SHELL exit 0 and would have let the row assert a 0 forever.
     */
    it('⛔ `refused-directive` is the ONE entry that expects a NON-ZERO exit — 6', () => {
        const refused = DEMOS.find((e) => e.id === 'refused-directive');
        expect(refused.cli.exit).toBe(6);
        expect(refused.cli.command).not.toMatch(/echo \$\?/);
        expect(real.filter((e) => e.cli && e.cli.exit !== 0).map((e) => e.id))
            .toEqual(['refused-directive']);
    });

    /** ⛓ …and the ONE entry the row declines to run names WHY. */
    it('⛓ exactly one CLI is SKIPPED, and it says why', () => {
        const skipped = real.filter((e) => e.cli?.skip);
        expect(skipped.map((e) => e.id)).toEqual(['load-in-wasm']);
        expect(skipped[0].cli.skip).toMatch(/WINDOWS/);
    });

    it('⛔ the PROSE entry names no URL and points somewhere instead', () => {
        const [p] = DEMOS.filter((e) => e.prose);
        expect(p.page).toBeNull();
        expect(p.url).toBeNull();
        expect(p.claim).toBeNull();
        expect(p.pointsAt.length).toBeGreaterThan(0);
        for (const t of p.pointsAt) expect(t.doc).toMatch(/^docs\/.*\.md$/);
    });
});

describe('the claim grammar', () => {
    it('splits path / op / value and JSON-parses the value where it can', () => {
        expect(parseClaim('overlays.counts.sites >= 10'))
            .toEqual({ path: 'overlays.counts.sites', op: '>=', value: 10 });
        expect(parseClaim('elements.certified == true'))
            .toEqual({ path: 'elements.certified', op: '==', value: true });
        expect(parseClaim('require.grade == "STRONG"'))
            .toEqual({ path: 'require.grade', op: '==', value: 'STRONG' });
    });

    it('keeps a BARE word as a string — `matches the-biome` is a regex, not JSON', () => {
        expect(parseClaim('require.refused.reason matches the-biome'))
            .toEqual({ path: 'require.refused.reason', op: 'matches', value: 'the-biome' });
    });

    it('THROWS on a claim with no operator rather than passing it through', () => {
        expect(() => parseClaim('elements.certified')).toThrow(/no operator/);
    });
});

describe('the two hrefs — ONE spelling of the Pages mapping', () => {
    const sites = DEMOS.find((e) => e.id === 'sites');
    const maze = DEMOS.find((e) => e.id === 'maze-area-graph');

    it('local = origin + the REPO path + ? + url', () => {
        expect(localHref(sites, { origin: 'http://localhost:8000' })).toBe(
            'http://localhost:8000/frontend/modules/seedlingDemo/watch.html'
            + '?source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1');
    });

    it('⛓⛓ Pages STRIPS /frontend — the workflow publishes it AS the root', () => {
        expect(pagesHref(sites)).toBe(
            'https://peerinfinity.github.io/Archipelago-CC/modules/seedlingDemo/watch.html'
            + '?source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1');
        expect(pagesHref(maze)).toBe(
            'https://peerinfinity.github.io/Archipelago-CC/modules/mazeRoom/lab.html'
            + '?source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3'
            + '&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000&run=1');
    });

    it('⛔ strips ONE leading /frontend and never a nested one', () => {
        expect(pagesHref({ page: '/frontend/modules/frontend/x.html', url: 'a=1' }))
            .toBe(`${PAGES_BASE}/modules/frontend/x.html?a=1`);
    });

    it('takes an alternate base (the row\'s --pages=) and drops its trailing slash', () => {
        expect(pagesHref(sites, { base: 'http://example.test/' }))
            .toMatch(/^http:\/\/example\.test\/modules\/seedlingDemo\/watch\.html\?/);
    });

    it('spells the ALSO url through the same two functions', () => {
        const carve = DEMOS.find((e) => e.id === 'the-carve');
        expect(pagesHref(carve, { url: carve.also })).toContain('chambers%3D1');
        expect(pagesHref(carve)).toContain('chambers%3D0');
        expect(localHref(carve, { origin: '', url: carve.also }))
            .toBe(`${carve.page}?${carve.also}`);
    });

    it('every entry\'s Pages href is under the deployed base and carries its url', () => {
        for (const e of DEMOS) {
            if (e.prose) continue;
            const href = pagesHref(e);
            expect(href.startsWith(`${PAGES_BASE}/modules/`)).toBe(true);
            expect(href).not.toContain('/frontend/');
            expect(href.endsWith(`?${e.url}`)).toBe(true);
        }
    });

    it('docHref points a prose entry\'s target at the repo on GitHub', () => {
        expect(docHref('docs/json/developer/procgen/seedling-bot.md'))
            .toBe(`${REPO_URL}/docs/json/developer/procgen/seedling-bot.md`);
    });
});
