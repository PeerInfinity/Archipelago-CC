// frontend/modules/procgenCore/worldDocument.test.js
/**
 * procgenCore/worldDocument — **THE WORLD DOCUMENT'S OWN ROWS.**
 *
 * EDITOR INTEGRATION slice W2 (`NewDocs/plans/editor-integration.md` §2.2 #3).
 *
 * ⛔ THE OVERLAYS HERE ARE THE REAL SUBSTRATES' — `seedlingSetOverlay`'s
 * `emptyOverlay()` and the maze's `emptyMazeOverlay()`, both imported from the
 * substrate that owns them. A test may import both (the `bindingContract` fence
 * is over SHIPPING modules); the module under test holds them opaquely and
 * imports neither, which is the claim the last describe asks directly.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import {
    AP_SUBREGION_SEPARATOR, PART_ID_SEPARATOR, WORLD_PART_KINDS, WORLD_SCHEMA_VERSION,
    WorldDocumentError, assertWorld, emptyWorld, isWorldDocumentRefusal, linksErrors,
    namespacedRegionId, partIdsOf, renumberWorldLinks, splitNamespacedRegionId, worldErrors,
} from './worldDocument.js';
import { addRoomMapping, removeRoomMapping, reorderMapping } from './setEditorCore.js';
import { emptyOverlay as emptySeedlingOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import { emptyMazeOverlay } from '../mazeRoom/mazeAtlasDerivation.js';

const PARTS = () => [
    { id: 'seed', kind: 'level-set', overlay: emptySeedlingOverlay(), substrate: 'flash_seedling' },
    { id: 'mz', kind: 'region-library', overlay: emptyMazeOverlay(), substrate: 'maze' },
];

const LINK = () => ({
    from: { part: 'seed', room: 1, exit: 'out_teleporter_128_128' },
    to: { part: 'mz', room: 0, exit: 'exit_3' },
    one_way: true,
});

const worldWithLink = () => ({ ...emptyWorld(PARTS()), links: [LINK()] });
const IDS = ['seed', 'mz'];
const errsOf = (links, o = {}) => linksErrors(links, { partIds: IDS, ...o });

/* ══════════════════════════════════════════════════════════════════════
 * THE SHAPE
 * ══════════════════════════════════════════════════════════════════════ */

describe('emptyWorld — the manifest, the overlays and no links', () => {
    it('holds each part\'s OWN empty overlay, verbatim, keyed by part id', () => {
        const world = emptyWorld(PARTS());
        expect(world.schema_version).toBe(WORLD_SCHEMA_VERSION);
        expect(partIdsOf(world)).toEqual(IDS);
        expect(world.parts).toEqual({
            seed: { kind: 'level-set', substrate: 'flash_seedling' },
            mz: { kind: 'region-library', substrate: 'maze' },
        });
        expect(world.links).toEqual([]);
        // ⛔ VERBATIM — the two empties are DIFFERENT documents and both survive
        //   whole. The maze's carries `links`, Seedling's does not; a world that
        //   normalised them would lose the half the substrate needs.
        expect(world.overlays.seed).toEqual(emptySeedlingOverlay());
        expect(world.overlays.mz).toEqual(emptyMazeOverlay());
        expect(world.overlays.mz.links).toEqual([]);
        expect(world.overlays.seed.links).toBeUndefined();
    });

    it('DECLARATION ORDER is the part order — the composite grid concatenates in it', () => {
        expect(partIdsOf(emptyWorld([...PARTS()].reverse()))).toEqual(['mz', 'seed']);
    });

    it('refuses a part with no overlay, a duplicate id, an unknown kind and no parts at all', () => {
        // ⛔ mutant: default a missing overlay to `{}` — a part would open with
        //   every location and every authored rule silently gone.
        expect(() => emptyWorld([{ id: 'seed', kind: 'level-set' }]))
            .toThrow(/was given no overlay/);
        expect(() => emptyWorld([PARTS()[0], PARTS()[0]])).toThrow(/two parts are called "seed"/);
        expect(() => emptyWorld([{ id: 'seed', kind: 'atlas', overlay: {} }]))
            .toThrow(new RegExp(`the kinds are ${WORLD_PART_KINDS.join(', ')}`));
        expect(() => emptyWorld([])).toThrow(/at least one part/);
    });

    it('every refusal is a WorldDocumentError the class predicate recognises', () => {
        try {
            emptyWorld([]);
            throw new Error('expected a refusal');
        } catch (e) {
            expect(e).toBeInstanceOf(WorldDocumentError);
            expect(isWorldDocumentRefusal(e)).toBe(true);
        }
        expect(isWorldDocumentRefusal(new TypeError('x'))).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE NAMESPACE
 * ══════════════════════════════════════════════════════════════════════ */

describe('the namespace — `<part>.<region_id>`, and why the separator survives both bans', () => {
    it('joins and splits, and the split is on the FIRST separator', () => {
        expect(namespacedRegionId('seed', 'level_0')).toBe(`seed${PART_ID_SEPARATOR}level_0`);
        expect(splitNamespacedRegionId('seed.level_0')).toEqual({ part: 'seed', region: 'level_0' });
        // ⛓ a region id may itself contain a dot — the FIRST one is the seam.
        expect(splitNamespacedRegionId('seed.a.b')).toEqual({ part: 'seed', region: 'a.b' });
        // ⛔ a plain region id (single-part atlas) is not an error, it is `null`.
        expect(splitNamespacedRegionId('level_0')).toBeNull();
        expect(splitNamespacedRegionId('.leading')).toBeNull();
        expect(splitNamespacedRegionId('trailing.')).toBeNull();
    });

    /**
     * ⛓⛓ **THE `__` BAN IS THE ONLY CHARSET RULE A REGION ID HAS**, and the
     * merged id has to survive it. A part id that ends `_` beside a region id
     * that starts `_` is the straddle a naive separator would create — the dot
     * stands between them, so it cannot happen. ⛔ mutant: separator `'_'` —
     * this row goes red on the straddle.
     */
    it('a merged id NEVER contains the AP sub-region separator, even across the seam', () => {
        expect(namespacedRegionId('a_', '_b')).toBe('a_._b');
        expect(namespacedRegionId('a_', '_b').includes(AP_SUBREGION_SEPARATOR)).toBe(false);
        expect(namespacedRegionId('seed', 'level_0').includes(AP_SUBREGION_SEPARATOR)).toBe(false);
    });

    it('refuses a part id with a dot, with `__`, or empty — each by its own reason', () => {
        expect(() => namespacedRegionId('a.b', 'r')).toThrow(/may not carry one/);
        expect(() => namespacedRegionId('a__b', 'r')).toThrow(/AP\s+sub-region separator/);
        expect(() => namespacedRegionId('', 'r')).toThrow(/non-empty string/);
        expect(() => namespacedRegionId('ok', 'a__b')).toThrow(/sub-region separator/);
        expect(() => namespacedRegionId('ok', '')).toThrow(/non-empty string/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE LINKS
 * ══════════════════════════════════════════════════════════════════════ */

describe('linksErrors — a world link is a CROSSING, and every way it can be wrong', () => {
    it('accepts a well-formed crossing', () => {
        expect(errsOf([LINK()])).toEqual([]);
        expect(errsOf([LINK()], { roomCounts: { seed: 2, mz: 4 } })).toEqual([]);
    });

    /**
     * ⛔ **`one_way` IS REQUIRED, AND THE REFUSAL QUOTES BOTH DEFAULTS.** The
     * mutant is `one_way = link.one_way ?? false` (or `?? true`): either picks
     * one substrate's law for a crossing that is in neither.
     */
    it('REFUSES a link with no `one_way`, naming both substrates\' defaults', () => {
        const { one_way: _drop, ...noWay } = LINK();
        const errors = errsOf([noWay]);
        expect(errors.join(' ')).toMatch(/one_way must be a boolean and is REQUIRED/);
        expect(errors.join(' ')).toMatch(/Seedling derives every connection `one_way: true`/);
        expect(errors.join(' ')).toMatch(/a maze link defaults `false`/);
        expect(errsOf([{ ...LINK(), one_way: 'yes' }]).join(' ')).toMatch(/must be a boolean/);
    });

    it('REFUSES a DANGLING endpoint by name — an unknown part, and a room out of range', () => {
        const bad = { ...LINK(), to: { part: 'nope', room: 0, exit: 'exit_3' } };
        expect(errsOf([bad]).join(' ')).toMatch(/names "nope", which this world does not hold/);
        expect(errsOf([bad]).join(' ')).toMatch(/its parts are seed, mz/);
        const far = { ...LINK(), to: { part: 'mz', room: 9, exit: 'exit_3' } };
        expect(errsOf([far], { roomCounts: { seed: 2, mz: 4 } }).join(' '))
            .toMatch(/room is 9 and part "mz" holds 4 room\(s\)/);
        // ⛓ …and with no counts in hand only the SHAPE is checked, deliberately.
        expect(errsOf([far])).toEqual([]);
        expect(errsOf([{ ...LINK(), to: { part: 'mz', room: -1, exit: 'e' } }]).join(' '))
            .toMatch(/must be a non-negative room INDEX/);
        expect(errsOf([{ ...LINK(), to: { part: 'mz', room: 0, exit: '' } }]).join(' '))
            .toMatch(/must be the DERIVED atlas exit id/);
    });

    /**
     * ⛔ mutant: accept a same-part link. It would reach the merged atlas as a
     * SECOND connection on an exit the part already wired, and `atlasOps.connect`
     * would refuse it with a sentence about an atlas rather than about a link.
     */
    it('REFUSES a link whose two endpoints are in ONE part', () => {
        const inside = {
            from: { part: 'mz', room: 0, exit: 'exit_1' },
            to: { part: 'mz', room: 1, exit: 'exit_3' },
            one_way: false,
        };
        expect(errsOf([inside]).join(' ')).toMatch(/joins two rooms of part "mz"/);
        expect(errsOf([inside]).join(' ')).toMatch(/that part's own `connect`/);
    });

    it('REFUSES a second link on one endpoint — an exit crosses to exactly one place', () => {
        const second = { ...LINK(), to: { part: 'mz', room: 1, exit: 'exit_0' } };
        expect(errsOf([LINK(), second]).join(' '))
            .toMatch(/names seed\.1\/out_teleporter_128_128, which world\.links\[0\] already joins/);
        // ⛓ and the OTHER side too, not only `from`.
        const reversed = { ...LINK(), from: { part: 'seed', room: 0, exit: 'out_a' } };
        expect(errsOf([LINK(), reversed]).join(' ')).toMatch(/mz\.0\/exit_3, which world\.links\[0\]/);
    });

    it('REFUSES an undeclared field on a link and on an endpoint', () => {
        expect(errsOf([{ ...LINK(), sign: 'N' }]).join(' ')).toMatch(/\.sign is not a declared field/);
        expect(errsOf([{ ...LINK(), to: { part: 'mz', room: 0, exit: 'e', tile: [1, 2] } }]).join(' '))
            .toMatch(/\.to\.tile is not a declared field/);
        expect(linksErrors('nope', { partIds: IDS })).toEqual(['world.links must be an array']);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE RE-KEY
 * ══════════════════════════════════════════════════════════════════════ */

describe('renumberWorldLinks — the PART\'s own mapping, applied to the world', () => {
    const links = () => [
        LINK(),
        {
            from: { part: 'seed', room: 0, exit: 'out_a' },
            to: { part: 'mz', room: 2, exit: 'exit_2' },
            one_way: true,
        },
    ];

    it('a reorder in one part moves ONLY that part\'s endpoints', () => {
        // rooms_new[i] = rooms_old[order[i]] — room 1 becomes room 0 and vice versa
        const moved = renumberWorldLinks(links(), 'seed', reorderMapping([1, 0]));
        expect(moved.map((l) => l.from.room)).toEqual([0, 1]);
        // ⛔ the OTHER part is untouched — mutant: map every endpoint.
        expect(moved.map((l) => l.to.room)).toEqual([0, 2]);
    });

    it('an add-room in one part shifts the endpoints at or after it', () => {
        const moved = renumberWorldLinks(links(), 'seed', addRoomMapping(1));
        expect(moved.map((l) => l.from.room)).toEqual([2, 0]);
    });

    it('a removed room DROPS the link that touched it, and shifts the rest down', () => {
        const moved = renumberWorldLinks(links(), 'mz', removeRoomMapping(0));
        expect(moved).toHaveLength(1);
        expect(moved[0].to.room).toBe(1);
        expect(moved[0].from).toEqual({ part: 'seed', room: 0, exit: 'out_a' });
    });

    it('refuses without the part\'s own mapping — nothing here computes one', () => {
        expect(() => renumberWorldLinks(links(), 'seed', null)).toThrow(/the PART's own old→new mapping/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE WHOLE DOCUMENT
 * ══════════════════════════════════════════════════════════════════════ */

describe('worldErrors / assertWorld — the manifest, the overlays and the held documents', () => {
    it('a world with a link and both parts held is clean', () => {
        const world = worldWithLink();
        expect(worldErrors(world, { docs: { seed: {}, mz: {} } })).toEqual([]);
        expect(assertWorld(world)).toBe(world);
    });

    /**
     * ⛔ **A DANGLING PART REFUSES BY NAME** — the brief's own row. Declared and
     * not held is a `region-library` nobody can edit; held and not declared is a
     * document that would travel in a bundle and come back as nobody's.
     */
    it('names a DANGLING part and an ORPHAN document, each with what IS there', () => {
        const world = worldWithLink();
        const dangling = worldErrors(world, { docs: { seed: {} } });
        expect(dangling.join(' ')).toMatch(/part "mz" is DECLARED and not HELD/);
        expect(dangling.join(' ')).toMatch(/carries seed/);
        expect(dangling.join(' ')).toMatch(/no region-library to edit/);
        const orphan = worldErrors(world, { docs: { seed: {}, mz: {}, extra: {} } });
        expect(orphan.join(' ')).toMatch(/part "extra" is HELD and not DECLARED/);
        // ⛓ with no documents in hand the question is not asked at all.
        expect(worldErrors(world)).toEqual([]);
    });

    it('names a MISSING overlay and an overlay belonging to no part', () => {
        const world = worldWithLink();
        const { mz: _gone, ...rest } = world.overlays;
        expect(worldErrors({ ...world, overlays: rest }).join(' '))
            .toMatch(/world\.overlays\["mz"\] is missing/);
        expect(worldErrors({ ...world, overlays: { ...world.overlays, ghost: {} } }).join(' '))
            .toMatch(/world\.overlays\["ghost"\] belongs to no declared part/);
    });

    it('names a bad schema_version, a bad part row and a part id the namespace cannot carry', () => {
        const world = worldWithLink();
        expect(worldErrors({ ...world, schema_version: 2 }).join(' '))
            .toMatch(new RegExp(`schema_version must be ${WORLD_SCHEMA_VERSION}`));
        expect(worldErrors({ ...world, parts: { seed: { kind: 'nope' } }, overlays: { seed: {} }, links: [] })
            .join(' ')).toMatch(/\.kind is "nope"/);
        expect(worldErrors({
            ...world,
            parts: { 'a.b': { kind: 'level-set' } },
            overlays: { 'a.b': {} },
            links: [],
        }).join(' ')).toMatch(/may not carry one/);
        expect(worldErrors({ ...world, parts: {} }).join(' ')).toMatch(/must be a non-empty object/);
        expect(worldErrors(null)).toEqual(['a world is an object, got null']);
        expect(worldErrors({ ...world, name: 7 }).join(' ')).toMatch(/world\.name must be a string/);
    });

    it('assertWorld REFUSES, and the sentence carries every error at once', () => {
        const world = worldWithLink();
        const broken = { ...world, links: [{ ...LINK(), one_way: undefined }] };
        expect(() => assertWorld(broken)).toThrow(/not well formed/);
        expect(() => assertWorld(broken)).toThrow(/one_way must be a boolean/);
    });

    /**
     * ⛓⛓ **MEASUREMENT 1, AS A ROW: THE WORLD ONLY HOLDS THE OVERLAYS.** Each
     * part's own `assertOverlay` still validates its half in place, unchanged,
     * against that part's LOCAL room count — including the out-of-range refusal.
     * ⛔ mutant: have `worldErrors` walk the overlays itself; it would need to
     * know what a `locations[]` row means in two substrates, which is exactly
     * what the fence forbids.
     */
    it('holds each overlay OPAQUELY — the part\'s own validator is what runs on it', async () => {
        const world = emptyWorld(PARTS());
        const seedling = await import('../seedlingDemo/seedlingSetOverlay.js');
        const maze = await import('../mazeRoom/mazeAtlasDerivation.js');
        const held = { ...world.overlays.seed, rooms: { 1: { locations: [], rules: {} } } };
        expect(() => seedling.assertOverlay(held, { roomCount: 2 })).not.toThrow();
        expect(() => seedling.assertOverlay(held, { roomCount: 1 })).toThrow(/room 1 does not exist/);
        expect(() => maze.assertOverlay(world.overlays.mz, { roomCount: 4, entries: [] })).not.toThrow();
        // ⛔ and this module imports NEITHER — the roster row in
        //   `bindingContract.test.js` is the gate, this is the local statement.
        const src = await import('node:fs').then((fs) => fs.readFileSync(
            new URL('./worldDocument.js', import.meta.url), 'utf8'));
        expect(src).not.toMatch(/from '\.\.\/(seedlingDemo|mazeRoom|flashPanel)\//);
    });
});
