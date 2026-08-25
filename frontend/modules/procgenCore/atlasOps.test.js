/**
 * procgenCore/atlasOps — the PURE atlas ops (EDITOR v3 slice D0b, §15 gaps 4–5).
 *
 * ⛔ WHAT IS **NOT** RE-TESTED HERE. `atlasSession.test.js`'s 42 rows already
 * pin every refusal and every reference rewrite the sixteen moved bodies do,
 * and they pass UNCHANGED against the wrapper — which is the strongest
 * statement available that the move was a move. Repeating them here would be a
 * second copy of the same claim that decays independently. This file pins what
 * is NEW: purity, structural sharing, key-order exactness, the vocabulary
 * itself, and the three ops the session never had.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ATLAS_OP_KINDS, applyAtlasOp, applyAtlasOps, unwiredExits } from './atlasOps.js';
import { AtlasSession, createEmptyAtlas } from '../regionMarkingTool/atlasSession.js';

const PLAYTHROUGH = new URL('../flashPanel/atlases/seedling-playthrough.json', import.meta.url);

/** A small but complete atlas: two regions, four exits, one connection, a subgraph. */
function fixture() {
    const s = new AtlasSession(createEmptyAtlas({ game: 'demo', tileSize: 16 }));
    s.addRegion({ region_id: 'hall', name: 'Hall', bounds: { x: 0, y: 0, w: 10, h: 8 } });
    s.addRegion({ region_id: 'cave', bounds: { x: 10, y: 0, w: 6, h: 8 } });
    s.addExit('hall', { exit_id: 'east', tiles: [[9, 3], [9, 4]] });
    s.addExit('hall', { exit_id: 'warp', tiles: [[4, 4]], kind: 'teleporter' });
    s.addExit('cave', { exit_id: 'west', tiles: [[10, 3], [10, 4]] });
    s.addExit('cave', { exit_id: 'deep', tiles: [[15, 3]], kind: 'teleporter' });
    s.addLocation('hall', { name: 'Hall Chest', tile: [2, 2], vanilla_item: 'Sword' });
    s.addLocation('cave', { name: 'Cave Chest', tile: [12, 2] });
    s.connect(['hall', 'east'], ['cave', 'west']);
    s.setStart('hall');
    return s.atlas;
}

/** Freeze a document all the way down, so ANY in-place write throws. */
function deepFreeze(v) {
    if (v == null || typeof v !== 'object' || Object.isFrozen(v)) return v;
    Object.freeze(v);
    for (const child of Object.values(v)) deepFreeze(child);
    return v;
}

const ok = (atlas, op) => {
    const r = applyAtlasOp(atlas, op);
    if (!r.ok) throw new Error(`expected ${op.op} to succeed, got: ${r.error}`);
    return r;
};

// ── the vocabulary ────────────────────────────────────────────────────────

describe('the op vocabulary', () => {
    /**
     * ⛓ DERIVED FROM THE CLASS, NOT TYPED. `AtlasSession`'s own mutating
     * methods are the subject: every one of them must be a delegation, so a
     * seventeenth method added without an op would red here rather than
     * quietly reintroduce a hand-written mutation beside the layer that exists
     * to hold them all.
     */
    it('every mutating AtlasSession method delegates to an op', () => {
        const src = readFileSync(new URL('../regionMarkingTool/atlasSession.js', import.meta.url), 'utf8');
        const declared = [...src.matchAll(/^\s{4}(\w+)\(/gm)].map((m) => m[1])
            .filter((n) => !n.startsWith('_'));
        const LOOKUPS = ['constructor', 'apply', 'regions', 'region', 'exit', 'subRegions',
            'unwiredExits', 'toDocument', 'validate', 'contentHash'];
        const mutators = declared.filter((n) => !LOOKUPS.includes(n));
        expect(mutators.length).toBeGreaterThanOrEqual(16);
        for (const name of mutators) {
            expect(src, `AtlasSession.${name} must delegate through this.apply({op: ...})`)
                .toMatch(new RegExp(`${name}\\([^)]*\\)\\s*\\{[\\s\\S]{0,240}?this\\.apply\\(\\{\\s*op:`));
        }
    });

    /**
     * ⛓ The COUNT is interpolated, never typed: the roster is derived from the
     * op table, so its length is a property of that table and pinning it here
     * would be a second declaration of the same fact
     * ([[feedback_deriving_a_roster_arms_a_dormant_lint]]). What IS asserted is
     * what the roster must CONTAIN and that it is a well-formed vocabulary.
     */
    it(`names ${ATLAS_OP_KINDS.length} kinds, sorted and unique, including the three the session never had`, () => {
        expect(new Set(ATLAS_OP_KINDS).size).toBe(ATLAS_OP_KINDS.length);
        expect([...ATLAS_OP_KINDS].sort()).toEqual(ATLAS_OP_KINDS);
        for (const kind of ['rename-region', 'connect', 'unwire']) {
            expect(ATLAS_OP_KINDS).toContain(kind);
        }
        // ⛔ every kind really resolves — a name in the list with no op behind
        //   it would refuse as "no op", which is the vacuity this catches.
        for (const kind of ATLAS_OP_KINDS) {
            expect(applyAtlasOp(fixture(), { op: kind }).error ?? '').not.toMatch(/no op "/);
        }
    });

    it('an unknown kind refuses BY NAME and prints the vocabulary', () => {
        const r = applyAtlasOp(fixture(), { op: 'teleport-region' });
        expect(r.ok).toBe(false);
        expect(r.error).toContain('no op "teleport-region"');
        expect(r.error).toContain('rename-region');
    });

    it('a non-atlas first argument refuses by name', () => {
        expect(applyAtlasOp(null, { op: 'disconnect', index: 0 }).error).toMatch(/must be a region atlas/);
        expect(applyAtlasOp({ regions: [] }, { op: 'disconnect', index: 0 }).error)
            .toMatch(/must be a region atlas/);
    });

    it('every op carries a description', () => {
        const atlas = fixture();
        expect(ok(atlas, { op: 'add-region', region_id: 'pit', bounds: { x: 0, y: 8, w: 4, h: 4 } }).description)
            .toBe('add region "pit"');
        expect(ok(atlas, { op: 'unwire', region: 'hall', exit: 'east' }).description)
            .toBe('unwire hall/east');
        expect(ok(atlas, { op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: true }).description)
            .toBe('connect hall/warp -> cave/deep');
    });
});

// ── purity and structural sharing ────────────────────────────────────────

describe('⛔ the input document is NEVER mutated', () => {
    /**
     * ⛓⛓ THE FROZEN INPUT IS THE ONLY HONEST WITNESS. A row that compared the
     * input against a copy taken beforehand would pass on an op that mutated
     * and then restored, and — worse — a row that only compared the RESULT
     * would pass on an op that mutated the input and returned it. Freezing
     * makes the write itself throw, which is a statement about the op and not
     * about a snapshot ([[feedback_leak_witness_snapshot_cannot_see_leak]]).
     */
    const CASES = [
        ['add-region', { op: 'add-region', region_id: 'pit', bounds: { x: 0, y: 8, w: 4, h: 4 } }],
        ['remove-region', { op: 'remove-region', region: 'cave' }],
        ['rename-region', { op: 'rename-region', from: 'cave', to: 'grotto' }],
        // ⚠ h only: widening w would move the east boundary line out from under
        //   exit "east", which `set-bounds` correctly refuses.
        ['set-bounds', { op: 'set-bounds', region: 'hall', bounds: { x: 0, y: 0, w: 10, h: 9 } }],
        ['add-exit', { op: 'add-exit', region: 'hall', exit_id: 'north', tiles: [[3, 0]] }],
        ['set-entrance-tile', { op: 'set-entrance-tile', region: 'hall', exit: 'east', tile: [9, 4] }],
        ['remove-exit', { op: 'remove-exit', region: 'hall', exit: 'east' }],
        ['add-location', { op: 'add-location', region: 'hall', name: 'New', tile: [1, 1] }],
        ['remove-location', { op: 'remove-location', region: 'hall', name: 'Hall Chest' }],
        ['set-sub-regions', { op: 'set-sub-regions', region: 'hall', sub_regions: ['a', 'b'] }],
        ['set-start', { op: 'set-start', region: 'cave' }],
        ['connect', { op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: true }],
        ['disconnect', { op: 'disconnect', index: 0 }],
        ['unwire', { op: 'unwire', region: 'cave', exit: 'west' }],
    ];

    it.each(CASES)('%s writes nothing into a deep-frozen atlas', (_name, op) => {
        const atlas = deepFreeze(fixture());
        const r = applyAtlasOp(atlas, op);
        expect(r.ok, r.error).toBe(true);
        expect(r.atlas).not.toBe(atlas);
    });

    it('the three subgraph ops write nothing either (they need a subgraph first)', () => {
        const withSubs = ok(fixture(), { op: 'set-sub-regions', region: 'hall', sub_regions: ['a', 'b'] }).atlas;
        const seeded = ok(withSubs, {
            op: 'add-internal-exit', region: 'hall', from: 'a', to: 'b', bidirectional: false,
        }).atlas;
        const frozen = deepFreeze(seeded);
        for (const op of [
            { op: 'add-internal-exit', region: 'hall', from: 'b', to: 'a', bidirectional: true },
            { op: 'set-internal-exit-rule', region: 'hall', index: 0, source: 'analyzer' },
            { op: 'remove-internal-exit', region: 'hall', index: 0 },
            { op: 'assign-sub-region', region: 'hall', kind: 'exit', id: 'east', sub_region: 'b' },
        ]) {
            const r = applyAtlasOp(frozen, op);
            expect(r.ok, `${op.op}: ${r.error}`).toBe(true);
        }
    });

    it('a REFUSAL returns the input itself, untouched', () => {
        const atlas = deepFreeze(fixture());
        const r = applyAtlasOp(atlas, { op: 'add-region', region_id: 'hall', bounds: { x: 0, y: 0, w: 1, h: 1 } });
        expect(r.ok).toBe(false);
        expect(r.atlas).toBe(atlas);
    });
});

describe('⛓ copy-on-write means STRUCTURAL SHARING', () => {
    /**
     * ⛔ NOT A MICRO-OPTIMISATION. The playthrough atlas is 271 KB and its
     * build applies ~1,100 ops; a whole-document clone per op is quadratic in
     * a `--check` gate that has to stay runnable. This row is what tells
     * "pure" apart from "cloned".
     */
    it('an untouched region is the SAME object in the result', () => {
        const atlas = fixture();
        const cave = atlas.regions[1];
        const r = ok(atlas, { op: 'add-location', region: 'hall', name: 'Another', tile: [1, 1] });
        expect(r.atlas.regions[1]).toBe(cave);
        expect(r.atlas.regions[0]).not.toBe(atlas.regions[0]);
        // and an untouched sibling ARRAY inside the touched region is shared too
        expect(r.atlas.regions[0].exits).toBe(atlas.regions[0].exits);
    });

    it('a layout-only op shares every region', () => {
        const atlas = fixture();
        const r = ok(atlas, { op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'] });
        expect(r.atlas.regions).toBe(atlas.regions);
        expect(r.atlas.vanilla_layout).not.toBe(atlas.vanilla_layout);
    });

    it('the real 113-region atlas rebuilds ONE region and shares the other 112', () => {
        const doc = JSON.parse(readFileSync(PLAYTHROUGH, 'utf8'));
        expect(doc.regions.length).toBe(113);
        const region = doc.regions[0];
        const exit = region.exits[0];
        const r = ok(doc, {
            op: 'set-entrance-tile',
            region: region.region_id,
            exit: exit.exit_id,
            tile: exit.entrance_tile,
        });
        expect(r.atlas.regions[0]).not.toBe(region);
        for (let i = 1; i < doc.regions.length; i += 1) {
            expect(r.atlas.regions[i]).toBe(doc.regions[i]);
        }
        // a layout-only op shares the regions ARRAY itself
        expect(ok(doc, { op: 'disconnect', index: 0 }).atlas.regions).toBe(doc.regions);
    });
});

// ── key order: the byte gates depend on it ───────────────────────────────

describe('⛔ KEY ORDER is preserved exactly — the atlases are byte-gated', () => {
    /**
     * ⛓ `{...obj, key: v}` overwrites an EXISTING key in place and appends a
     * NEW one at the end, which is exactly what the in-place assignments the
     * ops replaced did. If that were not true, every committed atlas would
     * regenerate with different bytes and `verify-region-marking-tool` and the
     * playthrough `--check` would both go red — so the property is asserted
     * here, where the failure names the key rather than the file.
     */
    it('an overwritten key keeps its position; a new key lands at the end', () => {
        const atlas = fixture();
        const before = Object.keys(atlas.regions[0].exits[0]);
        const r = ok(atlas, { op: 'set-entrance-tile', region: 'hall', exit: 'east', tile: [9, 3] });
        expect(Object.keys(r.atlas.regions[0].exits[0])).toEqual(before);

        const subbed = ok(atlas, { op: 'set-sub-regions', region: 'hall', sub_regions: ['a', 'b'] }).atlas;
        // `sub_region` did not exist on these exits, so it appends.
        expect(Object.keys(subbed.regions[0].exits[0]))
            .toEqual([...before, 'sub_region']);
        // and `subgraph` appends after `annotations`, where the assignment put it
        expect(Object.keys(subbed.regions[0]).at(-1)).toBe('subgraph');
    });

    /**
     * ⛓ THE SUB-REGION SLOT'S POSITION, which the `set-sub-regions` row above
     * does NOT cover: that one rewrites exits through `keep()`, while
     * `add-exit` / `add-location` / `assign-sub-region` go through
     * `withSubRegion`. A mutant that prepended the key there passed every other
     * row in this file — a fixture only gates a change it can DISTINGUISH.
     */
    it('withSubRegion writes `sub_region` where the format has always put it', () => {
        const subbed = ok(fixture(), { op: 'set-sub-regions', region: 'hall', sub_regions: ['a', 'b'] }).atlas;
        const withExit = ok(subbed, {
            op: 'add-exit', region: 'hall', exit_id: 'north', tiles: [[3, 0]],
            sub_region: 'b', access_rule: { rule: 'True_' },
        }).atlas;
        expect(Object.keys(withExit.regions[0].exits.at(-1)))
            .toEqual(['exit_id', 'kind', 'side', 'exit_tiles', 'entrance_tile', 'sub_region', 'access_rule']);
        const withLoc = ok(subbed, {
            op: 'add-location', region: 'hall', name: 'New', tile: [1, 1],
            sub_region: 'a', vanilla_item: 'Wand',
        }).atlas;
        expect(Object.keys(withLoc.regions[0].locations.at(-1)))
            .toEqual(['name', 'sub_region', 'tile', 'vanilla_item']);
        // and re-assigning an EXISTING slot keeps its position
        const moved = ok(withLoc, {
            op: 'assign-sub-region', region: 'hall', kind: 'location', id: 'New', sub_region: 'b',
        }).atlas;
        expect(Object.keys(moved.regions[0].locations.at(-1)))
            .toEqual(['name', 'sub_region', 'tile', 'vanilla_item']);
    });

    it('dropping a subgraph removes the key rather than setting it undefined', () => {
        const subbed = ok(fixture(), { op: 'set-sub-regions', region: 'hall', sub_regions: ['a'] }).atlas;
        const bare = ok(subbed, { op: 'set-sub-regions', region: 'hall', sub_regions: [] }).atlas;
        expect(Object.keys(bare.regions[0])).not.toContain('subgraph');
        expect(Object.keys(bare.regions[0].exits[0])).not.toContain('sub_region');
        expect(JSON.stringify(bare.regions[0])).not.toContain('sub_region');
    });

    it('start_sub_region is DELETED, not left as undefined, when the start has no subgraph', () => {
        const atlas = ok(fixture(), { op: 'set-sub-regions', region: 'hall', sub_regions: ['a'] }).atlas;
        const started = ok(atlas, { op: 'set-start', region: 'hall', sub_region: 'a' }).atlas;
        expect(started.vanilla_layout.start_sub_region).toBe('a');
        const moved = ok(started, { op: 'set-start', region: 'cave' }).atlas;
        expect(Object.keys(moved.vanilla_layout)).not.toContain('start_sub_region');
    });
});

// ── rename-region ────────────────────────────────────────────────────────

describe('rename-region — the op the session never had', () => {
    it('rewrites the region, the connections and the start', () => {
        const atlas = fixture();
        const r = ok(atlas, { op: 'rename-region', from: 'hall', to: 'atrium' });
        expect(r.atlas.regions.map((x) => x.region_id)).toEqual(['atrium', 'cave']);
        expect(r.atlas.vanilla_layout.connections[0].from).toEqual(['atrium', 'east']);
        expect(r.atlas.vanilla_layout.start_region).toBe('atrium');
        // the endpoint that did NOT move is the same array object
        expect(r.atlas.vanilla_layout.connections[0].to).toBe(atlas.vanilla_layout.connections[0].to);
    });

    it('rewrites a `to` endpoint as well as a `from` one', () => {
        const r = ok(fixture(), { op: 'rename-region', from: 'cave', to: 'grotto' });
        expect(r.atlas.vanilla_layout.connections[0].to).toEqual(['grotto', 'west']);
        expect(r.atlas.vanilla_layout.start_region).toBe('hall');
    });

    /**
     * ⛓⛓ THE COLLISION IS THE POINT. `allocateIdsBySortedName` DEDUPES (D0a
     * §18.9 hard #1), so two atlas regions sharing an id do not collide in the
     * compiled rules.json — they COLLAPSE into one AP region, and the second
     * one's exits and locations are quietly attached to the first. A refusal
     * here is the only place that can be noticed.
     */
    it('REFUSES a collision, naming the dedupe as the reason', () => {
        const r = applyAtlasOp(fixture(), { op: 'rename-region', from: 'hall', to: 'cave' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/a region with that id already exists/);
        expect(r.error).toMatch(/dedup/);
    });

    it('REFUSES "__", an empty id, an unknown region and a no-op rename', () => {
        const atlas = fixture();
        expect(applyAtlasOp(atlas, { op: 'rename-region', from: 'hall', to: 'a__b' }).error)
            .toMatch(/must not contain "__"/);
        expect(applyAtlasOp(atlas, { op: 'rename-region', from: 'hall', to: '' }).error)
            .toMatch(/must be a non-empty string/);
        expect(applyAtlasOp(atlas, { op: 'rename-region', from: 'nowhere', to: 'x' }).error)
            .toMatch(/no region "nowhere"/);
        expect(applyAtlasOp(atlas, { op: 'rename-region', from: 'hall', to: 'hall' }).error)
            .toMatch(/already has that id/);
    });

    /**
     * ⛓⛓ **A BRIEF PREMISE THAT MEASUREMENT DID NOT BEAR OUT, KEPT HONEST.**
     * D0a §18.9 predicted `rename-region` would be "the first thing that can
     * produce a duplicate LOCATION name in memory". MEASURED: it cannot —
     * `regionAtlasCompiler.js:376` allocates location ids from `loc.name`
     * alone, so a region rename moves no location name at all. The
     * post-condition is kept for the rename-with-relabel that will want it, and
     * THIS row is what stops it being a check nobody knows is broken: it hands
     * the op an atlas that already violates the invariant and shows the refusal
     * firing. A guard no input can reach is a guard that has never run.
     */
    it('the location post-condition is REAL — it fires on an atlas that already violates it', () => {
        const atlas = fixture();
        const twinned = {
            ...atlas,
            regions: atlas.regions.map((r) => ({
                ...r, locations: r.locations.map((l) => ({ ...l, name: 'Same Chest' })),
            })),
        };
        const r = applyAtlasOp(twinned, { op: 'rename-region', from: 'hall', to: 'atrium' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/two locations named "Same Chest"/);
        // ⛔ and it is a POST-condition: the same atlas renamed the other way
        //   refuses for the same reason, because the fault is in the document.
        expect(applyAtlasOp(twinned, { op: 'rename-region', from: 'cave', to: 'grotto' }).ok).toBe(false);
    });
});

// ── connect { one_way } and unwire ───────────────────────────────────────

describe('connect carries one_way, and unwire works by endpoint', () => {
    it('one_way is written when given and ABSENT when not', () => {
        const atlas = fixture();
        const undirected = ok(atlas, { op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'] });
        expect(Object.keys(undirected.atlas.vanilla_layout.connections.at(-1))).toEqual(['from', 'to']);
        const directed = ok(atlas, {
            op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: true,
        });
        expect(directed.atlas.vanilla_layout.connections.at(-1))
            .toEqual({ from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: true });
    });

    it('one_way: false is written explicitly — it is not the same as absent', () => {
        const r = ok(fixture(), {
            op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: false,
        });
        expect(r.atlas.vanilla_layout.connections.at(-1).one_way).toBe(false);
    });

    it('a non-boolean one_way refuses by name', () => {
        const r = applyAtlasOp(fixture(), {
            op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: 'yes',
        });
        expect(r.error).toMatch(/one_way must be a boolean/);
    });

    /**
     * ⛔ THE EACH-ENDPOINT-ONCE LAW SURVIVES THE WIDENING — and it is not
     * hypothetical: `make-seedling-playthrough-rules.mjs` used to BYPASS this
     * layer to get `one_way`, which meant its 312 connections were never asked
     * this question. They are now, and they pass.
     */
    it('a one-way connection still claims both endpoints', () => {
        const once = ok(fixture(), {
            op: 'connect', from: ['hall', 'warp'], to: ['cave', 'deep'], one_way: true,
        }).atlas;
        expect(applyAtlasOp(once, {
            op: 'connect', from: ['hall', 'warp'], to: ['cave', 'west'], one_way: true,
        }).error).toMatch(/exit "warp" of region "hall" is already connected/);
        expect(applyAtlasOp(once, {
            op: 'connect', from: ['cave', 'deep'], to: ['hall', 'east'], one_way: true,
        }).error).toMatch(/exit "deep" of region "cave" is already connected/);
    });

    it('unwire removes the connection naming EITHER endpoint', () => {
        const atlas = fixture();
        expect(unwiredExits(atlas).map((e) => e.exit_id).sort()).toEqual(['deep', 'warp']);
        const byFrom = ok(atlas, { op: 'unwire', region: 'hall', exit: 'east' });
        expect(byFrom.atlas.vanilla_layout.connections).toEqual([]);
        expect(unwiredExits(byFrom.atlas)).toHaveLength(4);
        const byTo = ok(atlas, { op: 'unwire', region: 'cave', exit: 'west' });
        expect(byTo.atlas.vanilla_layout.connections).toEqual([]);
        // it hands back the connection it removed
        expect(byTo.value).toEqual({ from: ['hall', 'east'], to: ['cave', 'west'] });
    });

    it('unwiring an exit that is not wired REFUSES rather than shrugging', () => {
        const r = applyAtlasOp(fixture(), { op: 'unwire', region: 'hall', exit: 'warp' });
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/is not wired by vanilla_layout\.connections/);
    });
});

// ── the list form ────────────────────────────────────────────────────────

describe('applyAtlasOps', () => {
    it('threads the document through and collects the descriptions', () => {
        const r = applyAtlasOps(fixture(), [
            { op: 'rename-region', from: 'hall', to: 'atrium' },
            { op: 'connect', from: ['atrium', 'warp'], to: ['cave', 'deep'], one_way: true },
        ]);
        expect(r.ok).toBe(true);
        expect(r.atlas.vanilla_layout.connections).toHaveLength(2);
        expect(r.descriptions).toEqual([
            'rename region "hall" to "atrium"',
            'connect atrium/warp -> cave/deep',
        ]);
    });

    /**
     * ⛔ ALL OR NOTHING, and the index is named. A partially-applied list would
     * leave a document nobody authored — the caller asked for a sequence, not
     * for a prefix of one.
     */
    it('stops at the first refusal and returns the ORIGINAL document', () => {
        const atlas = deepFreeze(fixture());
        const r = applyAtlasOps(atlas, [
            { op: 'rename-region', from: 'hall', to: 'atrium' },
            { op: 'rename-region', from: 'atrium', to: 'cave' },
            { op: 'disconnect', index: 0 },
        ]);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/^op #1 \(rename-region\):/);
        expect(r.atlas).toBe(atlas);
    });
});
