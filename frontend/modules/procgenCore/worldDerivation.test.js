// frontend/modules/procgenCore/worldDerivation.test.js
/**
 * procgenCore/worldDerivation — **THE MERGE, AND THE CROSSINGS.**
 *
 * EDITOR INTEGRATION slice W2.
 *
 * ⛔ **THE PARTS HERE ARE TOYS, DELIBERATELY.** The module under test may not
 * import a substrate and neither does this file: a toy atlas can be given
 * COLLIDING region ids on purpose (the namespace row), a `map_ref` no region
 * has (the dangling row) and two different `tile_size`s, none of which a real
 * pack would hand over. The REAL two-substrate merge — a generated Seedling set
 * and the committed maze pack, compiled and walked — is `seedlingDemo/
 * worldChain.test.js`, where importing both adapters is legal.
 *
 * ⛓ Every toy is built through `atlasOps` itself, so it is schema-shaped by
 * construction rather than by hand-typing what the schema wants.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import { applyAtlasOps } from './atlasOps.js';
import { loadAtlasSchema } from './jsonSchemaFiles.js';
import { emptyWorld } from './worldDocument.js';
import {
    WorldDerivationError, deriveWorldAtlas, deriveWorldAtlasOf, isWorldDerivationRefusal,
    partOfRegion, regionIdOfRoom, worldRulesJsonOf,
} from './worldDerivation.js';
import { REGION_ATLAS_SCHEMA_VERSION, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';

const ATLAS_SCHEMA = loadAtlasSchema();

/**
 * A toy part atlas: `rooms` regions on a 4×4 grid, each with a N and an S edge
 * exit, chained N→S, and every region carrying `substrate`.
 */
function toyAtlas({
    game = 'toy', ids = ['a', 'b'], substrate = 'toy_substrate', tileSize = 1,
    mapDocument = 'toy-doc', link = true,
} = {}) {
    const base = {
        schema_version: REGION_ATLAS_SCHEMA_VERSION,
        atlas_id: game,
        game,
        provenance: { generator: 'worldDerivation.test' },
        tile_space: { tile_size: tileSize, map_document: mapDocument },
        regions: [],
        vanilla_layout: { start_region: '', connections: [] },
    };
    const ops = [];
    ids.forEach((id, i) => {
        ops.push({
            op: 'add-region',
            region_id: id,
            bounds: { x: 0, y: i * 4, w: 4, h: 4 },
            map_ref: i,
            substrate,
        });
        ops.push({ op: 'add-exit', region: id, exit_id: `${id}_n`, tiles: [[1, i * 4]] });
        ops.push({ op: 'add-exit', region: id, exit_id: `${id}_s`, tiles: [[1, i * 4 + 3]] });
    });
    ops.push({ op: 'set-start', region: ids[0] });
    if (link) {
        for (let i = 0; i + 1 < ids.length; i += 1) {
            ops.push({
                op: 'connect',
                from: [ids[i], `${ids[i]}_s`],
                to: [ids[i + 1], `${ids[i + 1]}_n`],
                one_way: true,
            });
        }
    }
    const result = applyAtlasOps(base, ops);
    if (!result.ok) throw new Error(`the toy's own op was refused: ${result.error}`);
    return result.atlas;
}

const PART_A = () => ({ id: 'pa', atlas: toyAtlas({ game: 'game_a', substrate: 'sub_a' }) });
const PART_B = () => ({
    id: 'pb',
    atlas: toyAtlas({ game: 'game_b', substrate: 'sub_b', mapDocument: 'other-doc' }),
});
/** ⛓ The CROSSING the rows use: part A's room 1 south exit → part B's room 0 north exit. */
const CROSSING = (one_way = true) => ({
    from: { part: 'pa', room: 1, exit: 'b_s' },
    to: { part: 'pb', room: 0, exit: 'a_n' },
    one_way,
});

const merge = (links = [], parts = [PART_A(), PART_B()], deps = {}) =>
    deriveWorldAtlas({ parts, links }, deps);

/* ══════════════════════════════════════════════════════════════════════
 * THE MERGE
 * ══════════════════════════════════════════════════════════════════════ */

describe('deriveWorldAtlas — two atlases become one, namespaced', () => {
    it('every region id is `<part>.<region_id>`, and the connections came with them', () => {
        const { atlas, stats } = merge();
        expect(atlas.regions.map((r) => r.region_id)).toEqual(['pa.a', 'pa.b', 'pb.a', 'pb.b']);
        expect(atlas.vanilla_layout.connections).toEqual([
            { from: ['pa.a', 'a_s'], to: ['pa.b', 'b_n'], one_way: true },
            { from: ['pb.a', 'a_s'], to: ['pb.b', 'b_n'], one_way: true },
        ]);
        expect(atlas.vanilla_layout.start_region).toBe('pa.a');
        expect(stats).toMatchObject({ parts: 2, regions: 4, connections: 2, links: 0 });
        expect(partOfRegion('pa.a')).toBe('pa');
    });

    /**
     * ⛔⛔ **THE NAMESPACE MUTANT, WITH THE INSTANCE THAT MAKES IT BITE.** Drop
     * the namespace and two parts that share a region id COLLIDE — and not
     * loudly: `atlasOps.add-region` would refuse a duplicate, but a hand
     * concatenation would not, and the AP allocator dedupes by NAME, so two
     * regions would collapse into one with one of them silently losing its
     * exits. The toys share `a` and `b` on purpose.
     */
    it('two parts SHARING region ids do not collide — that is what the namespace is for', () => {
        const bare = new Set([...PART_A().atlas.regions, ...PART_B().atlas.regions]
            .map((r) => r.region_id));
        expect(bare.size).toBe(2); // ⛔ NOT VACUOUS — the ids really do collide
        const { atlas } = merge();
        expect(new Set(atlas.regions.map((r) => r.region_id)).size).toBe(4);
    });

    /**
     * ⛔ mutant: rebuild each region through `add-region` instead of carrying it.
     * `add-region` enumerates its params, so `substrate`, the exits and the
     * locations would all vanish ([[reference_seedling_arc_traps]] 823).
     */
    it('each region travels VERBATIM — `substrate`, `map_ref`, exits and key ORDER survive', () => {
        const { atlas, stats } = merge();
        expect(atlas.regions.map((r) => r.substrate)).toEqual(['sub_a', 'sub_a', 'sub_b', 'sub_b']);
        expect(stats.substrates).toEqual({ sub_a: 2, sub_b: 2 });
        // ⛓ `map_ref` is CARRIED VERBATIM — part B's room 0 is still map_ref 0.
        expect(atlas.regions.map((r) => r.map_ref)).toEqual([0, 1, 0, 1]);
        const before = PART_A().atlas.regions[0];
        const after = atlas.regions[0];
        expect(Object.keys(after)).toEqual(Object.keys(before));
        expect({ ...after, region_id: before.region_id }).toEqual(before);
    });

    it('the envelope is the START part\'s game, and the map document names the WORLD', () => {
        const { atlas } = merge();
        expect(atlas.game).toBe('game_a');
        expect(atlas.atlas_id).toBe('world-of-pa+pb');
        expect(atlas.tile_space.map_document).toBe('world-of-pa+pb');
        expect(atlas.provenance).toEqual({ generator: 'world-derivation' });
        // ⛔ DELIBERATELY UNSTAMPED, exactly as both part derivations leave theirs.
        expect(atlas.provenance.content_hash).toBeUndefined();
        // ⛓ the world's own naming wins when it has one
        const world = { ...emptyWorld([
            { id: 'pa', kind: 'level-set', overlay: {} },
            { id: 'pb', kind: 'region-library', overlay: {} },
        ]), world_id: 'world-abc12345', name: 'Two Toys' };
        const named = deriveWorldAtlas({ parts: [PART_A(), PART_B()], links: [], world });
        expect(named.atlas.atlas_id).toBe('world-abc12345');
        expect(named.atlas.name).toBe('Two Toys');
    });

    /**
     * ⛔ mutant: take the tile size silently (or take the LAST part's). The note
     * is the only thing that says one part's coordinates are not the merged
     * space's.
     */
    it('takes the START part\'s tile_size and NOTES a disagreement', () => {
        const parts = [PART_A(), { id: 'pb', atlas: toyAtlas({ game: 'game_b', substrate: 'sub_b', tileSize: 16 }) }];
        const { atlas, notes } = deriveWorldAtlas({ parts, links: [] });
        expect(atlas.tile_space.tile_size).toBe(1);
        expect(notes.join(' ')).toMatch(/disagree about `tile_space\.tile_size` \(pa: 1, pb: 16\)/);
        expect(notes.join(' ')).toMatch(/the START part "pa"'s 1/);
        // …and agreeing parts say nothing at all.
        expect(merge().notes).toEqual([]);
    });

    it('the merged atlas passes the UNCHANGED validator, schema and all', () => {
        const { atlas } = merge([CROSSING()]);
        const v = validateRegionAtlas(atlas, { schema: ATLAS_SCHEMA });
        expect(v.errors).toEqual([]);
        expect(v.ok).toBe(true);
    });

    it('refuses no parts, a duplicate part id and a part with no atlas', () => {
        expect(() => deriveWorldAtlas({ parts: [] })).toThrow(/non-empty `parts` array/);
        expect(() => deriveWorldAtlas({ parts: [PART_A(), PART_A()] })).toThrow(/two parts are called "pa"/);
        expect(() => deriveWorldAtlas({ parts: [{ id: 'pa', atlas: null }] }))
            .toThrow(/derivation runs first and hands its result in/);
        try {
            deriveWorldAtlas({ parts: [] });
        } catch (e) {
            expect(e).toBeInstanceOf(WorldDerivationError);
            expect(isWorldDerivationRefusal(e)).toBe(true);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE CROSSINGS
 * ══════════════════════════════════════════════════════════════════════ */

describe('the links — one connection each, and the displacement is NAMED', () => {
    it('a link becomes ONE connection with the `one_way` the author gave', () => {
        for (const oneWay of [true, false]) {
            const { atlas, stats } = merge([CROSSING(oneWay)]);
            const added = atlas.vanilla_layout.connections.find((c) => c.from[0] === 'pa.b');
            expect(added).toEqual({ from: ['pa.b', 'b_s'], to: ['pb.a', 'a_n'], one_way: oneWay });
            expect(stats.links).toBe(1);
        }
    });

    /**
     * ⛔⛔ **THE DISPLACEMENT, AND IT IS MEASURED RATHER THAN CHOSEN.** Part B's
     * room 0 north exit is already wired inside part B? No — its SOUTH is. Part
     * A's room 1 south exit is free in the toy, so the row below builds the real
     * case on purpose: a crossing onto an exit the part ALREADY wired.
     */
    it('a link onto an exit the part already wired UNWIRES it first and SAYS so', () => {
        // pa.a/a_s → pa.b/b_n is part A's own connection; cross from a_s instead.
        const onto = {
            from: { part: 'pa', room: 0, exit: 'a_s' },
            to: { part: 'pb', room: 0, exit: 'a_n' },
            one_way: true,
        };
        const { atlas, notes, displaced, stats } = merge([onto]);
        expect(displaced).toEqual([{ link: 0, region: 'pa.a', exit: 'a_s', was: ['pa.b', 'b_n'] }]);
        expect(stats.displaced).toBe(1);
        expect(notes.join(' ')).toMatch(/DISPLACED the part-internal connection pa\.a\/a_s → pa\.b\/b_n/);
        expect(notes.join(' ')).toMatch(/the WORLD says it crosses to the other part/);
        // the old connection is GONE and the new one is there — exactly one each
        expect(atlas.vanilla_layout.connections).toEqual([
            { from: ['pb.a', 'a_s'], to: ['pb.b', 'b_n'], one_way: true },
            { from: ['pa.a', 'a_s'], to: ['pb.a', 'a_n'], one_way: true },
        ]);
        // ⛓ and the far endpoint really is unwired now — the report's subject.
        const v = validateRegionAtlas(atlas, { schema: ATLAS_SCHEMA });
        expect(v.warnings.join(' ')).toMatch(/exit "b_n" of region "pa\.b" is not wired/);
        expect(v.errors).toEqual([]);
    });

    /**
     * ⛔ mutant: accept a dangling endpoint (skip the exit check, or resolve a
     * missing region to `undefined`). `atlasOps.connect` would refuse it too —
     * with a sentence about an ATLAS region id the author never typed, instead
     * of about the part and the room they did.
     */
    it('REFUSES a dangling endpoint, naming the PART and the ROOM', () => {
        expect(() => merge([{ ...CROSSING(), to: { part: 'pb', room: 7, exit: 'a_n' } }]))
            .toThrow(/part "pb" has no region for room 7 — its atlas holds map_ref 0, 1/);
        expect(() => merge([{ ...CROSSING(), to: { part: 'pb', room: 0, exit: 'nope' } }]))
            .toThrow(/names exit "nope" of room 0 in part "pb" \(region "pb\.a"\)/);
        expect(() => merge([{ ...CROSSING(), to: { part: 'pb', room: 0, exit: 'nope' } }]))
            .toThrow(/Its exits are a_n, a_s\./);
        expect(() => merge([{ ...CROSSING(), from: { part: 'ghost', room: 0, exit: 'a_n' } }]))
            .toThrow(/names part "ghost", and this world's parts are pa, pb/);
    });

    it('regionIdOfRoom is the `map_ref` join, and an injected one overrides it', () => {
        expect(regionIdOfRoom(PART_A().atlas, 1, 'pa')).toBe('b');
        const parts = [PART_A(), { ...PART_B(), regionIdOfRoom: () => 'b' }];
        const { atlas } = deriveWorldAtlas({
            parts,
            links: [{ ...CROSSING(), to: { part: 'pb', room: 0, exit: 'b_n' } }],
        });
        expect(atlas.vanilla_layout.connections.at(-1).to).toEqual(['pb.b', 'b_n']);
    });

    /**
     * ⛔⛔ **DISPLACEMENT IS FOR A PART-INTERNAL CONNECTION ONLY, AND THIS IS
     * THE ROW THAT FOUND IT.** The first spelling unwired ANY connection on the
     * endpoint, so a second world link on the same exit silently STOLE the
     * first's — the exact opposite of `world.links`' own "an exit crosses to
     * exactly one place" law, and invisible: the atlas stayed valid.
     * ⛔ mutant: drop the `partOfRegion(from) !== partOfRegion(to)` guard.
     */
    it('a SECOND world link on one endpoint refuses — it does not displace the first', () => {
        const second = { ...CROSSING(), to: { part: 'pb', room: 1, exit: 'b_n' } };
        expect(() => merge([CROSSING(), second])).toThrow(/already connected/);
        expect(() => merge([CROSSING(), second])).toThrow(/world\.links\[1\]/);
        // ⛓ …and the same endpoint on the FAR side too.
        const far = { ...CROSSING(), from: { part: 'pa', room: 0, exit: 'a_n' } };
        expect(() => merge([CROSSING(), far])).toThrow(/already connected/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FROM A RECORD
 * ══════════════════════════════════════════════════════════════════════ */

describe('deriveWorldAtlasOf / worldRulesJsonOf — the injected substrate halves', () => {
    const toyPart = (id, substrate, game) => ({
        id,
        recordOf: (doc, overlay) => ({ doc, overlay }),
        deriveAtlasOf: (rec) => ({ atlas: toyAtlas({ game, substrate, ids: rec.doc.ids }) }),
    });
    const RECORD = () => ({
        world: {
            ...emptyWorld([
                { id: 'pa', kind: 'level-set', overlay: { rooms: {} } },
                { id: 'pb', kind: 'region-library', overlay: { rooms: {} } },
            ]),
            links: [CROSSING()],
        },
        parts: { pa: { ids: ['a', 'b'] }, pb: { ids: ['a', 'b'] } },
    });

    it('derives each part through its OWN injected derivation, then merges', () => {
        const { atlas, stats } = deriveWorldAtlasOf(RECORD(), {
            parts: [toyPart('pa', 'sub_a', 'game_a'), toyPart('pb', 'sub_b', 'game_b')],
        });
        expect(atlas.regions.map((r) => r.region_id)).toEqual(['pa.a', 'pa.b', 'pb.a', 'pb.b']);
        expect(stats.substrates).toEqual({ sub_a: 2, sub_b: 2 });
    });

    /**
     * ⛔ mutant: match parts by SET rather than by ORDER. Part 0 is the start
     * and the `game`, so a world whose adapter was built in the other order
     * would compile with the wrong substrate keying the flash row.
     */
    it('refuses when the injected parts are not the world\'s parts IN ORDER', () => {
        const record = RECORD();
        expect(() => deriveWorldAtlasOf(record, { parts: [toyPart('pa', 's', 'g')] }))
            .toThrow(/declares parts pa, pb and the adapter was built over pa/);
        expect(() => deriveWorldAtlasOf(record, {
            parts: [toyPart('pb', 's', 'g'), toyPart('pa', 's', 'g')],
        })).toThrow(/The ORDER matters too: part 0 is the start/);
        expect(() => deriveWorldAtlasOf(record, { parts: [{ id: 'pa' }, { id: 'pb' }] }))
            .toThrow(/without a `deriveAtlasOf` and a `recordOf`/);
    });

    it('refuses a world whose declared part is not HELD — `assertWorld`\'s own sentence', () => {
        const record = RECORD();
        delete record.parts.pb;
        expect(() => deriveWorldAtlasOf(record, {
            parts: [toyPart('pa', 'sub_a', 'game_a'), toyPart('pb', 'sub_b', 'game_b')],
        })).toThrow(/part "pb" is DECLARED and not HELD/);
    });

    it('worldRulesJsonOf hands the merged atlas to the INJECTED compiler, options and all', () => {
        const seen = [];
        const fakeCompile = (atlas, options) => {
            seen.push({ atlas, options });
            return { rules: { ok: true }, report: { substrates: { sub_a: 2, sub_b: 2 } } };
        };
        const out = worldRulesJsonOf(RECORD(), {}, {
            compileRegionAtlas: fakeCompile,
            parts: [toyPart('pa', 'sub_a', 'game_a'), toyPart('pb', 'sub_b', 'game_b')],
            gameName: 'Toy World',
            compileOptions: { sidecarBuilders: { sub_a: () => ({}) } },
        });
        expect(seen).toHaveLength(1);
        expect(seen[0].options.gameName).toBe('Toy World');
        expect(Object.keys(seen[0].options.sidecarBuilders)).toEqual(['sub_a']);
        expect(seen[0].atlas.regions).toHaveLength(4);
        expect(out.report.substrates).toEqual({ sub_a: 2, sub_b: 2 });
        expect(out.stats.links).toBe(1);
        expect(() => worldRulesJsonOf(RECORD(), {}, { parts: [] })).toThrow(/needs `compileRegionAtlas` injected/);
    });

    /**
     * ⛓⛓⛓ DEDUP M10 — **THE PER-PART ATLASES COME BACK BESIDE THE MERGE**, so
     * a reader whose rows join on a part's LOCAL `map_ref` does not derive them
     * all a second time. ⛔ The merge renames every region (`pa.a`), and these
     * are the PRE-merge atlases — the row asserts that, not just that the field
     * is populated.
     */
    it('deriveWorldAtlasOf returns each part\'s OWN atlas beside the merged one', () => {
        const derived = deriveWorldAtlasOf(RECORD(), {
            parts: [toyPart('pa', 'sub_a', 'game_a'), toyPart('pb', 'sub_b', 'game_b')],
        });
        expect(derived.parts.map((p) => p.id)).toEqual(['pa', 'pb']);
        expect(derived.parts.map((p) => p.atlas.regions.map((r) => r.region_id)))
            .toEqual([['a', 'b'], ['a', 'b']]);
        expect(derived.atlas.regions.map((r) => r.region_id))
            .toEqual(['pa.a', 'pa.b', 'pb.a', 'pb.b']);
        // ⛓ …and one derivation per part, counted — not one per part per reader
        let derives = 0;
        const spy = (id, sub, game) => {
            const part = toyPart(id, sub, game);
            return { ...part, deriveAtlasOf: (r) => { derives++; return part.deriveAtlasOf(r); } };
        };
        deriveWorldAtlasOf(RECORD(), { parts: [spy('pa', 'sa', 'ga'), spy('pb', 'sb', 'gb')] });
        expect(derives).toBe(2);
    });

    /**
     * ⛓⛓⛓ DEDUP M9 — **`projectRegions` IS THE HOOK A SECOND `rules.json` PATH
     * NEEDED**, and it changes BOTH what the compiler is handed AND what this
     * function says it compiled. ⛔ That second half is why it is not a
     * `compileOptions` flag: the maze's own row reads `out.atlas` to assert the
     * projection was compile-time only.
     */
    it('worldRulesJsonOf projects every region through `projectRegions`, and SAYS so', () => {
        const seen = [];
        const fakeCompile = (atlas) => {
            seen.push(atlas);
            return { rules: { ok: true }, report: {} };
        };
        const parts = [toyPart('pa', 'sub_a', 'game_a'), toyPart('pb', 'sub_b', 'game_b')];
        const plain = worldRulesJsonOf(RECORD(), {}, { compileRegionAtlas: fakeCompile, parts });
        expect(plain.atlas.regions.every((r) => typeof r.substrate === 'string')).toBe(true);
        const projected = worldRulesJsonOf(RECORD(), {}, {
            compileRegionAtlas: fakeCompile,
            parts,
            projectRegions: ({ substrate: _dropped, ...region }) => region,
        });
        expect(seen[1].regions.every((r) => r.substrate === undefined)).toBe(true);
        expect(projected.atlas.regions.every((r) => r.substrate === undefined)).toBe(true);
        // ⛔ …and the UNPROJECTED path hands back the derivation's OWN atlas
        //   object, un-copied — which is why no existing row had to move.
        expect(seen[0].regions.map((r) => r.region_id))
            .toEqual(['pa.a', 'pa.b', 'pb.a', 'pb.b']);
        expect(plain.atlas).toBe(seen[0]);
        // ⛓ …and BOTH shapes are the FULL one: `stats` and `dropped` included.
        for (const out of [plain, projected]) {
            expect(Object.keys(out))
                .toEqual(['rules', 'report', 'atlas', 'notes', 'displaced', 'stats', 'dropped']);
        }
    });

    /** ⛔ The fence, stated locally as well as in `bindingContract`'s roster. */
    it('this module imports no substrate', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('./worldDerivation.js', import.meta.url), 'utf8');
        expect(src).not.toMatch(/from '\.\.\/(seedlingDemo|mazeRoom|flashPanel)\//);
    });
});
