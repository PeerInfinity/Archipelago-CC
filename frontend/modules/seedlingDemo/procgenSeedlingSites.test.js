/**
 * seedlingDemo/procgenSeedlingSites — THE SITE CLASSES ON A SEEDLING ROOM, and
 * the two identities ⚖ arc-3 Q1 rests on.
 *
 * PROCGEN ELEMENTS arc 3, slice 1. `procgenCore/sites.test.js` grades the
 * derivation on hand-drawn grids; this file grades what the BINDING does with
 * it — which list `anchorsFor` shuffles, and the two places where "the same
 * cells in the same ORDER" is the whole claim.
 *
 * ⛔ THE ORDER IS THE CLAIM, NOT THE SET. `rng.shuffle` is Fisher-Yates over
 * the list AS GIVEN and spends `n - 1` draws, so a class that is the same SET
 * in a different ORDER produces a different level from the same seed, and one
 * of a different LENGTH shifts every draw after it. A set-equality assertion
 * here would be inert against exactly the mutant this file exists to catch
 * (`feedback_grouping_reorders_so_assert_the_set`, from the other side).
 */
import { describe, expect, it } from 'vitest';

import {
    EXCLUDED_TEMPLATES, POST_SWORD_PALETTE, POST_SWORD_TEMPLATES, PRE_SWORD_PALETTE,
    PRE_SWORD_TEMPLATES, assertPalette,
} from './procgenPalette.js';
import { interiorCells, seedlingModel } from './procgenSeedling.js';
import { rngFor } from './procgenRng.js';
import { SITE_CLASSES } from '../procgenCore/sites.js';
import { defineTemplate } from '../procgenCore/templateContract.js';

const byName = (name, list = PRE_SWORD_TEMPLATES) => list.find((t) => t.name === name);
const instanceOf = (name, values = {}) => byName(name).instantiate(null, values);
/** A 1x1 template that writes one wall cell — legal almost everywhere. */
const probe = (site) => defineTemplate({
    name: 'probe',
    family: 'probe',
    site,
    params: [],
    why: 'a fixture: one cell, so the ANCHOR LIST is the only thing under test',
    build: () => ({
        footprint: [{ dx: 0, dy: 0 }],
        clearance: [],
        terrain: [],
        entities: [{ dx: 0, dy: 0, type: 'arrowtrap', attrs: {} }],
        pins: [],
    }),
}).instantiate(null, {});

describe('⚖ Q1 — the OPEN room is ONE chamber, and it IS the interior', () => {
    const m = seedlingModel({ seed: 1 });
    const rec = m.skeleton();

    it('⛓⛓⛓ `sites.chamber` is `interiorCells` — cell for cell AND IN ORDER', () => {
        expect(m.sites.chamber).toEqual(interiorCells(rec));
        // ⛔ and the ORDER, said separately, because `toEqual` on arrays is
        // already ordered but a reader must not have to know that to see the
        // claim: the two lists agree position by position.
        expect(m.sites.chamber.map((c) => `${c.tx},${c.ty}`).join(' '))
            .toBe(interiorCells(rec).map((c) => `${c.tx},${c.ty}`).join(' '));
    });

    it('there is exactly ONE chamber and NO corridor cell', () => {
        expect(m.sites.chambers).toHaveLength(1);
        expect(m.sites.chambers[0].cells).toHaveLength(64);
        expect(m.sites.corridor).toEqual([]);
        expect(m.sites.tip).toEqual([]);
        expect(m.sites.branch).toEqual([]);
    });

    it('⛓ THIS is why an area template declaring `chamber` moves no `empty` pair', () => {
        const asAny = m.anchorsFor(rec, probe('any'), rngFor(11), 64);
        const asChamber = m.anchorsFor(rec, probe('chamber'), rngFor(11), 64);
        expect(asChamber).toEqual(asAny);
        // ⛔ …and the palette really does declare it, or the claim is about
        // a template nobody ships.
        for (const name of ['wall-segment', 'water-pool', 'pit-patch']) {
            expect(byName(name).site, name).toBe('chamber');
        }
    });
});

describe('`any` IS the whole interior, and it is the SAME CALL it has always been', () => {
    /**
     * ⛔ THE CARVED ARM IS THE DISCRIMINATING ONE. On `empty` the chamber list
     * and the interior list are the same list (above), so a mutant that made
     * `any` site-derived would be INERT there by arithmetic. `winding` carves
     * about a quarter of the room, so the two differ in both length and order.
     */
    for (const [kind, seed] of [['empty', 1], ['winding', 1]]) {
        it(`${kind}: the anchors are \`rng.shuffle(interiorCells)\`, filtered by \`legalAt\``,
            () => {
                const m = seedlingModel({ seed, skeleton: { kind } });
                const rec = m.skeleton();
                const t = probe('any');
                const expected = rngFor(5).shuffle(interiorCells(rec))
                    .filter((c) => m.legalAt(rec, t, c.tx, c.ty))
                    .slice(0, 40)
                    .map((c) => ({ tx: c.tx, ty: c.ty }));
                expect(m.anchorsFor(rec, t, rngFor(5), 40)).toEqual(expected);
            });
    }

    it('a template that declares NO site is treated as `any` — the shipped default', () => {
        const m = seedlingModel({ seed: 1 });
        const rec = m.skeleton();
        const undeclared = { ...probe('any') };
        delete undeclared.site;
        expect(m.anchorsFor(rec, undeclared, rngFor(9), 20))
            .toEqual(m.anchorsFor(rec, probe('any'), rngFor(9), 20));
    });

    it('⛓ on a CARVED room a `chamber` template is offered a STRICTLY SMALLER list', () => {
        const m = seedlingModel({ seed: 1, skeleton: { kind: 'winding' } });
        const rec = m.skeleton();
        const anyAnchors = m.anchorsFor(rec, probe('any'), rngFor(3), 200);
        const chamberAnchors = m.anchorsFor(rec, probe('chamber'), rngFor(3), 200);
        expect(chamberAnchors.length).toBeLessThan(anyAnchors.length);
        // every chamber anchor really is a chamber cell
        const chamberKeys = new Set(m.sites.chamber.map((c) => `${c.tx},${c.ty}`));
        for (const a of chamberAnchors) expect(chamberKeys.has(`${a.tx},${a.ty}`)).toBe(true);
    });

    it('⛔ a class that is EMPTY on this skeleton is NO_ANCHOR at zero cost', () => {
        const m = seedlingModel({ seed: 1 });
        // the open room has no corridor cell at all (above)
        expect(m.anchorsFor(m.skeleton(), probe('corridor'), rngFor(1), 5)).toEqual([]);
    });
});

describe('the site vocabulary is enforced where a template declares it', () => {
    it('⛔ `assertPalette` refuses an unknown site class BY NAME', () => {
        const bad = defineTemplate({
            name: 'g',
            family: 'g',
            site: 'nook',
            params: [],
            why: 'a fixture',
            build: () => ({ footprint: [{ dx: 0, dy: 0 }], terrain: [], entities: [] }),
        });
        expect(() => assertPalette({ name: 'p', templates: [bad] }))
            .toThrow(/declares site "nook"/);
    });

    it('every shipped template declares a site in the closed vocabulary', () => {
        for (const t of POST_SWORD_TEMPLATES) {
            expect(SITE_CLASSES, t.name).toContain(t.site);
        }
    });

    /**
     * ⛓⛓⛓ **NO FALLBACK — ⚖ THE USER'S RULING, AND THIS IS THE ROW THAT SAYS SO.**
     *
     * `winding` seed 1 has ZERO chambers (the census: a bare tree kind has none
     * on 10 of 12 seeds), so an area template is NO_ANCHOR there and the loop
     * places nothing. A `'chamber, else anywhere'` fallback was proposed and
     * OVERRULED: things that need AREA are placed FIRST, and a fallback to
     * "anywhere" would re-create the open-room assumption this arc removes.
     *
     * ⛔ SO ≈0 KEPT ON A CORRIDOR-ONLY SKELETON IS THE TRUTH ABOUT THAT ROOM,
     * and this test asserts the refusal rather than working around it.
     */
    it('⛔ a class this skeleton has NONE of is an honest NO_ANCHOR — no fallback', () => {
        const m = seedlingModel({ seed: 1, skeleton: { kind: 'winding' } });
        const rec = m.skeleton();
        expect(m.sites.chamber).toEqual([]);
        expect(m.anchorsFor(rec, probe('chamber'), rngFor(2), 20)).toEqual([]);
        // ⛔ …and it really is the SITE doing it, not legality: the same cells
        // are still legal, and `any` offers plenty of them.
        expect(m.anchorsFor(rec, probe('any'), rngFor(2), 20).length).toBeGreaterThan(0);
    });

    /**
     * ⛓ AND WHERE PASS 1 MADE AREA, THE CLASS IS NON-EMPTY AND THE ROW PLACES.
     * `chambers=k` is what a corridor-only skeleton needs, and it is the arm
     * the yield table publishes beside the bare one (as-built §8.4).
     */
    it('⛓ …and a STAMPED chamber gives the same row somewhere to go', () => {
        const m = seedlingModel({ seed: 1, skeleton: { kind: 'winding', params: { chambers: 1 } } });
        const rec = m.skeleton();
        expect(m.sites.chamber.length).toBeGreaterThan(0);
        const anchors = m.anchorsFor(rec, probe('chamber'), rngFor(2), 20);
        expect(anchors.length).toBeGreaterThan(0);
        const chamberKeys = new Set(m.sites.chamber.map((c) => `${c.tx},${c.ty}`));
        for (const a of anchors) expect(chamberKeys.has(`${a.tx},${a.ty}`)).toBe(true);
    });

    it('⛓ THIS SLICE\'S SCOPE, SAID OUT LOUD: the door families stay `any`', () => {
        expect(Object.fromEntries(POST_SWORD_TEMPLATES.map((t) => [t.name, t.site])))
            .toEqual({
                'wall-segment': 'chamber',
                'water-pool': 'chamber',
                'pit-patch': 'chamber',
                'wall-gap-block': 'any',
                'wall-gap-lock-weigh': 'any',
                'wall-gap-spinner-killlock': 'any',
            });
    });
});

describe('⚖ arrow-lane is OUT of the generator (design ruling 9)', () => {
    it('it is in NEITHER roster, under either spelling', () => {
        for (const list of [PRE_SWORD_TEMPLATES, POST_SWORD_TEMPLATES]) {
            expect(list.some((t) => t.name === 'arrow-lane')).toBe(false);
            expect(list.some((t) => t.family === 'arrow-lane')).toBe(false);
        }
    });

    it('⛓ and it is RECORDED in EXCLUDED_TEMPLATES with the ruling as its cause', () => {
        const row = EXCLUDED_TEMPLATES.find((r) => r.name === 'arrow-lane');
        expect(row).toBeTruthy();
        expect(row.cause).toMatch(/RULED OUT \(user, 2026-08-15\)/);
        // ⛔ the row carries the MEASUREMENT the removal was bought with, not
        // just the ruling — every other excluded row does (`§3.3`'s contract).
        expect(row.measured).toMatch(/77\.8 s|77,818/);
        expect(row.measured).toMatch(/21 of the 23/);
        expect(row.wouldNeed).toMatch(/pre-sword puzzle as an ELEMENT/);
    });

    it('⛔ the model no longer carries `laneClear` — the rule left with the row', () => {
        const m = seedlingModel({ seed: 1 });
        expect(m.laneClear).toBeUndefined();
    });

    it('the excluded list is the WHOLE answer to "what is not in the palette"', () => {
        // built FROM the roster, trap 199
        const excluded = EXCLUDED_TEMPLATES.map((r) => r.name);
        expect(new Set(excluded).size).toBe(excluded.length);
        for (const name of excluded) {
            expect(PRE_SWORD_PALETTE.templates.some((t) => t.name === name)).toBe(false);
            expect(POST_SWORD_PALETTE.templates.some((t) => t.name === name)).toBe(false);
        }
    });
});

describe('the site summary is COUNTS, and the census reads it', () => {
    it('reports counts for every class and never a cell list', () => {
        const m = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        const s = m.siteSummary;
        expect(Object.keys(s).sort()).toEqual(['bend', 'branch', 'branchCells', 'branchLengths',
            'chamber', 'chamberSizes', 'chambers', 'corridor', 'main', 'tip'].sort());
        for (const k of ['main', 'bend', 'branch', 'tip', 'chamber', 'chambers', 'corridor']) {
            expect(typeof s[k], k).toBe('number');
        }
        expect(s.main).toBe(m.sites.main.length);
        expect(s.chambers).toBe(m.sites.chambers.length);
    });
});
