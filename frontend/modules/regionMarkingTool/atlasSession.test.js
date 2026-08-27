// Unit tests for the region-marking tool's editing model (region-atlas plan,
// Phase 2, Deliverable 2). The model is where the format's authoring rules are
// enforced BEFORE the validator sees a document — so what these tests care
// about most is that the slips the kickoff called out are impossible, not
// merely reported: '__' in ids, an entrance off its exit span, a sub_region on
// a region that has no subgraph (and a missing one on a region that does), and
// a defaulted `bidirectional`.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    AtlasSession, createEmptyAtlas, deriveEdgeSide, lineTiles, rectBounds, boundsContains,
} from './atlasSession.js';
import {
    computeAtlasContentHash, stampAtlasIdentity,
} from '../procgenPipeline/regionAtlasValidator.js';
import { applyAtlasOp } from '../procgenCore/atlasOps.js';
import { compactJsonFile } from '../procgenPipeline/compactJson.js';

const BOUNDS = { x: 0, y: 0, w: 10, h: 8 };
const RULE = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
const OTHER_RULE = { rule: 'Has', args: { item_name: 'Ghost Spear' } };

function session() {
    const s = new AtlasSession(createEmptyAtlas({ game: 'seedling', mapDocument: 'seedling-map.json' }));
    s.addRegion({ region_id: 'hall', name: 'Hall', bounds: BOUNDS, map_ref: 0 });
    return s;
}

describe('geometry helpers', () => {
    it('derives the side from which bounds line a run sits on (y grows down)', () => {
        expect(deriveEdgeSide(BOUNDS, [[3, 0], [4, 0]])).toBe('N');
        expect(deriveEdgeSide(BOUNDS, [[3, 7], [4, 7]])).toBe('S');
        expect(deriveEdgeSide(BOUNDS, [[0, 2], [0, 3]])).toBe('W');
        expect(deriveEdgeSide(BOUNDS, [[9, 2], [9, 3]])).toBe('E');
    });

    it('reads a SINGLE tile in both orientations', () => {
        // A one-tile run is a valid horizontal AND vertical span. Trying only
        // the horizontal reading reported "not on a boundary" for a one-tile
        // exit on the east edge — which is what most of Seedling's real map
        // crossings are.
        expect(deriveEdgeSide(BOUNDS, [[9, 4]])).toBe('E');
        expect(deriveEdgeSide(BOUNDS, [[0, 4]])).toBe('W');
        expect(deriveEdgeSide(BOUNDS, [[4, 0]])).toBe('N');
        expect(deriveEdgeSide(BOUNDS, [[4, 7]])).toBe('S');
    });

    it('refuses runs that are not a straight contiguous line on a boundary', () => {
        expect(deriveEdgeSide(BOUNDS, [[3, 3]])).toBeNull();          // interior
        expect(deriveEdgeSide(BOUNDS, [[3, 0], [5, 0]])).toBeNull();  // gap
        expect(deriveEdgeSide(BOUNDS, [[3, 0], [4, 1]])).toBeNull();  // diagonal
        expect(deriveEdgeSide(BOUNDS, [[3, 0], [3, 20]])).toBeNull(); // outside
        expect(deriveEdgeSide(BOUNDS, [])).toBeNull();
    });

    it('builds line and rectangle spans from two dragged corners', () => {
        expect(lineTiles([2, 5], [5, 5])).toEqual([[2, 5], [3, 5], [4, 5], [5, 5]]);
        expect(lineTiles([2, 5], [2, 3])).toEqual([[2, 3], [2, 4], [2, 5]]);
        expect(lineTiles([2, 5], [3, 6])).toBeNull();
        expect(rectBounds([5, 5], [2, 3])).toEqual({ x: 2, y: 3, w: 4, h: 3 });
        expect(boundsContains(BOUNDS, [9, 7])).toBe(true);
        expect(boundsContains(BOUNDS, [10, 7])).toBe(false);
    });
});

describe('region ids', () => {
    it('rejects the AP compound separator at authoring time', () => {
        expect(() => session().addRegion({ region_id: 'a__b', bounds: BOUNDS }))
            .toThrow(/must not contain "__"/);
        expect(() => session().setSubRegions('hall', ['west__side']))
            .toThrow(/must not contain "__"/);
    });

    it('rejects duplicates and empty ids', () => {
        const s = session();
        expect(() => s.addRegion({ region_id: 'hall', bounds: BOUNDS })).toThrow(/already exists/);
        expect(() => s.addRegion({ region_id: '', bounds: BOUNDS })).toThrow(/non-empty/);
    });

    it('rejects malformed bounds', () => {
        expect(() => session().addRegion({ region_id: 'x', bounds: { x: 0, y: 0, w: 0, h: 4 } }))
            .toThrow(/w, h positive integers/);
    });
});

describe('region.substrate — the op-level passthrough (EDITOR INTEGRATION W1)', () => {
    // ⛔ `atlasOps.addRegion` rebuilds the region from a FIXED param set rather
    // than spreading the spec, so a key it does not name is silently DROPPED.
    // Both atlas derivations write `substrate` through this op, so the op has to
    // carry it — and this row is what says so: it is the whole reason the field
    // reaches a derived atlas at all.
    it('carries `substrate` when the caller names one', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1, substrate: 'maze' });
        expect(s.atlas.regions.find((r) => r.region_id === 'cave').substrate).toBe('maze');
    });

    it('OMITS the key when the caller does not — which is why no committed atlas moved', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        const region = s.atlas.regions.find((r) => r.region_id === 'cave');
        expect('substrate' in region).toBe(false);
        expect(Object.keys(region)).toEqual(['region_id', 'bounds', 'map_ref', 'exits', 'locations', 'annotations']);
    });

    it('places it immediately after `map_ref` — the compact writer emits INSERTION order', () => {
        // The key's position IS the committed bytes of any atlas carrying it,
        // and it must match `region-atlas.schema.json`'s `$defs.region.properties`
        // order. Named here so a later writer cannot move it quietly.
        const s = session();
        s.addRegion({ region_id: 'cave', name: 'Cave', bounds: BOUNDS, map_ref: 1, substrate: 'maze' });
        expect(Object.keys(s.atlas.regions.find((r) => r.region_id === 'cave')))
            .toEqual(['region_id', 'name', 'bounds', 'map_ref', 'substrate', 'exits', 'locations', 'annotations']);
    });
});

describe('exits', () => {
    it('derives kind and side from geometry rather than asking', () => {
        const s = session();
        const edge = s.addExit('hall', { exit_id: 'north', tiles: [[3, 0], [4, 0], [5, 0]] });
        expect(edge.kind).toBe('edge');
        expect(edge.side).toBe('N');

        const warp = s.addExit('hall', { exit_id: 'stairs', tiles: [[5, 4]] });
        expect(warp.kind).toBe('teleporter');
        expect(warp.side).toBeUndefined();
    });

    it('refuses an interior run declared as an edge exit', () => {
        expect(() => session().addExit('hall', { exit_id: 'x', tiles: [[3, 3], [4, 3]], kind: 'edge' }))
            .toThrow(/straight contiguous run along one of the region's bounds lines/);
    });

    it('defaults the entrance to the middle of the span and keeps it on the span', () => {
        const s = session();
        const exit = s.addExit('hall', { exit_id: 'north', tiles: [[3, 0], [4, 0], [5, 0]] });
        expect(exit.entrance_tile).toEqual([4, 0]);

        expect(() => s.setEntranceTile('hall', 'north', [9, 0])).toThrow(/must be one of exit "north"'s tiles/);
        expect(s.setEntranceTile('hall', 'north', [5, 0]).entrance_tile).toEqual([5, 0]);
    });

    it('refuses an entrance that is not one of the exit tiles at creation', () => {
        expect(() => session().addExit('hall', { exit_id: 'n', tiles: [[3, 0]], entrance_tile: [4, 0] }))
            .toThrow(/must be one of the exit's tiles/);
    });

    it('refuses tiles outside the region', () => {
        expect(() => session().addExit('hall', { exit_id: 'n', tiles: [[30, 0]] }))
            .toThrow(/lies outside region "hall"/);
    });

    it('drops the vanilla-layout wiring when an exit is removed', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3]] });
        s.addExit('cave', { exit_id: 'west', tiles: [[0, 3]] });
        s.connect(['hall', 'east'], ['cave', 'west']);
        expect(s.atlas.vanilla_layout.connections).toHaveLength(1);
        s.removeExit('hall', 'east');
        expect(s.atlas.vanilla_layout.connections).toHaveLength(0);
    });
});

describe('bounds edits', () => {
    it('refuses bounds that would strand a marked tile', () => {
        const s = session();
        s.addLocation('hall', { name: 'Hall - Chest', tile: [8, 6] });
        expect(() => s.setBounds('hall', { x: 0, y: 0, w: 4, h: 4 }))
            .toThrow(/would leave 1 marked tile\(s\) outside/);
    });

    it('refuses bounds that would take an edge exit off its line, and re-derives sides otherwise', () => {
        const s = session();
        s.addExit('hall', { exit_id: 'south', tiles: [[3, 7], [4, 7]] });
        expect(() => s.setBounds('hall', { x: 0, y: 0, w: 10, h: 12 }))
            .toThrow(/off its boundary line/);
        // Shifting the region so the same tiles become its NORTH edge re-labels
        // the exit rather than leaving a stale side behind.
        s.setBounds('hall', { x: 0, y: 7, w: 10, h: 8 });
        expect(s.exit('hall', 'south').side).toBe('N');
    });
});

describe('subgraphs', () => {
    it('carries no boilerplate until there is a subgraph', () => {
        const s = session();
        const exit = s.addExit('hall', { exit_id: 'n', tiles: [[3, 0]] });
        expect(exit.sub_region).toBeUndefined();
        expect(s.region('hall').subgraph).toBeUndefined();
        expect(() => s.addExit('hall', { exit_id: 'e', tiles: [[9, 3]], sub_region: 'west' }))
            .toThrow(/has no subgraph, so it takes no sub_region/);
    });

    it('assigns every existing exit and location when a subgraph appears', () => {
        const s = session();
        s.addExit('hall', { exit_id: 'n', tiles: [[3, 0]] });
        s.addLocation('hall', { name: 'Hall - Chest', tile: [5, 5] });
        s.setSubRegions('hall', ['west', 'east']);
        expect(s.exit('hall', 'n').sub_region).toBe('west');
        expect(s.region('hall').locations[0].sub_region).toBe('west');
        expect(s.region('hall').subgraph.internal_exits).toEqual([]);
    });

    it('requires a sub_region once a subgraph exists', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        expect(() => s.addExit('hall', { exit_id: 'n', tiles: [[3, 0]] }))
            .toThrow(/has a subgraph, so a sub_region is required/);
        expect(() => s.addExit('hall', { exit_id: 'n', tiles: [[3, 0]], sub_region: 'nowhere' }))
            .toThrow(/"nowhere" is not a sub-region/);
    });

    it('strips every sub_region when the subgraph is dropped', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        s.addExit('hall', { exit_id: 'n', tiles: [[3, 0]], sub_region: 'east' });
        s.addLocation('hall', { name: 'Hall - Chest', tile: [5, 5], sub_region: 'east' });
        s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: true });

        s.setSubRegions('hall', []);
        expect(s.region('hall').subgraph).toBeUndefined();
        expect(s.exit('hall', 'n').sub_region).toBeUndefined();
        expect(s.region('hall').locations[0].sub_region).toBeUndefined();
    });

    it('drops internal exits whose endpoint disappeared, and keeps the rest', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'mid', 'east']);
        s.addInternalExit('hall', { from: 'west', to: 'mid', bidirectional: true });
        s.addInternalExit('hall', { from: 'mid', to: 'east', bidirectional: false });
        s.setSubRegions('hall', ['west', 'mid']);
        expect(s.region('hall').subgraph.internal_exits).toEqual([
            { from: 'west', to: 'mid', bidirectional: true },
        ]);
    });

    it('never defaults bidirectional', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        expect(() => s.addInternalExit('hall', { from: 'west', to: 'east' }))
            .toThrow(/must be given explicitly/);
        expect(() => s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: 'yes' }))
            .toThrow(/must be given explicitly/);
        expect(s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: false }))
            .toEqual({ from: 'west', to: 'east', bidirectional: false });
    });

    it('rejects a self-loop and an unknown endpoint', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        expect(() => s.addInternalExit('hall', { from: 'west', to: 'west', bidirectional: true }))
            .toThrow(/cannot connect a sub-region to itself/);
        expect(() => s.addInternalExit('hall', { from: 'west', to: 'nowhere', bidirectional: true }))
            .toThrow(/is not a sub-region/);
        expect(() => s.addInternalExit('hall', { from: 'a', to: 'b', bidirectional: true }))
            .toThrow(/is not a sub-region/);
    });

    it('refuses internal exits on a region with no subgraph', () => {
        expect(() => session().addInternalExit('hall', { from: 'a', to: 'b', bidirectional: true }))
            .toThrow(/declare its sub-regions first/);
    });
});

describe('internal-exit provenance (Phase 5a, ruling 2)', () => {
    const split = () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        return s;
    };
    const edges = (s) => s.region('hall').subgraph.internal_exits;

    it('writes no source by default, which reads as hand-authored', () => {
        const s = split();
        expect(s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: true }))
            .toEqual({ from: 'west', to: 'east', bidirectional: true });
        expect(s.region('hall').annotations.rules_source).toBe('manual');
    });

    it('rejects an unknown source rather than storing it', () => {
        expect(() => split().addInternalExit('hall', {
            from: 'west', to: 'east', bidirectional: true, source: 'guessed',
        })).toThrow(/source must be one of/);
    });

    it('derives rules_source from the mix of rows', () => {
        const s = split();
        s.addInternalExit('hall', {
            from: 'west', to: 'east', bidirectional: true, source: 'analyzer', access_rule: RULE,
        });
        expect(s.region('hall').annotations.rules_source).toBe('analyzer');

        s.addInternalExit('hall', { from: 'east', to: 'west', bidirectional: false, source: 'manual' });
        expect(s.region('hall').annotations.rules_source).toBe('mixed');

        s.removeInternalExit('hall', 1);
        expect(s.region('hall').annotations.rules_source).toBe('analyzer');
    });

    it('edits an existing row\'s rule and provenance in place', () => {
        const s = split();
        s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: true, source: 'analyzer', access_rule: RULE });
        // The review step: the author disagrees with the computed rule and
        // takes the row over.
        s.setInternalExitRule('hall', 0, { access_rule: OTHER_RULE, source: 'manual' });
        expect(edges(s)[0]).toEqual({
            from: 'west', to: 'east', bidirectional: true, source: 'manual', access_rule: OTHER_RULE,
        });
        expect(s.region('hall').annotations.rules_source).toBe('manual');
    });

    it('clears a rule when handed null, and leaves it alone when omitted', () => {
        const s = split();
        s.addInternalExit('hall', { from: 'west', to: 'east', bidirectional: true, access_rule: RULE });
        s.setInternalExitRule('hall', 0, { bidirectional: false });
        expect(edges(s)[0].access_rule).toEqual(RULE);
        expect(edges(s)[0].bidirectional).toBe(false);
        s.setInternalExitRule('hall', 0, { access_rule: null });
        expect(edges(s)[0].access_rule).toBeUndefined();
    });

    it('refuses to edit a row that is not there', () => {
        const s = split();
        expect(() => s.setInternalExitRule('hall', 0, { source: 'manual' }))
            .toThrow(/has no internal exit #0/);
    });

    it('keeps a row\'s source when a sub-region list edit rewrites the subgraph', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'mid', 'east']);
        s.addInternalExit('hall', { from: 'west', to: 'mid', bidirectional: true, source: 'analyzer', access_rule: RULE });
        s.addInternalExit('hall', { from: 'mid', to: 'east', bidirectional: false, source: 'manual' });
        s.setSubRegions('hall', ['west', 'mid']);
        expect(edges(s)).toEqual([
            { from: 'west', to: 'mid', bidirectional: true, source: 'analyzer', access_rule: RULE },
        ]);
        expect(s.region('hall').annotations.rules_source).toBe('analyzer');
    });
});

describe('locations', () => {
    it('keeps AP location names globally unique', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        s.addLocation('hall', { name: 'Chest', tile: [1, 1] });
        expect(() => s.addLocation('cave', { name: 'Chest', tile: [1, 1] }))
            .toThrow(/already used — AP location names are global/);
    });

    it('refuses a tile outside the region', () => {
        expect(() => session().addLocation('hall', { name: 'C', tile: [40, 1] }))
            .toThrow(/lies outside region "hall"/);
    });
});

describe('vanilla layout', () => {
    it('requires a start sub-region exactly when the start region has a subgraph', () => {
        const s = session();
        expect(() => s.setStart('hall', 'west')).toThrow(/has no subgraph, so it takes no start_sub_region/);
        s.setStart('hall');
        expect(s.atlas.vanilla_layout.start_sub_region).toBeUndefined();

        s.setSubRegions('hall', ['west', 'east']);
        expect(() => s.setStart('hall', null)).toThrow(/is not a sub-region/);
        s.setStart('hall', 'east');
        expect(s.atlas.vanilla_layout.start_sub_region).toBe('east');
    });

    it('follows a subgraph edit that removed the start sub-region', () => {
        const s = session();
        s.setSubRegions('hall', ['west', 'east']);
        s.setStart('hall', 'east');
        s.setSubRegions('hall', ['west']);
        expect(s.atlas.vanilla_layout.start_sub_region).toBe('west');
    });

    it('refuses to wire an exit twice, or to itself', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3]] });
        s.addExit('cave', { exit_id: 'west', tiles: [[0, 3]] });
        s.addExit('cave', { exit_id: 'north', tiles: [[3, 0]] });
        s.connect(['hall', 'east'], ['cave', 'west']);
        expect(() => s.connect(['hall', 'east'], ['cave', 'north'])).toThrow(/already connected/);
        expect(() => s.connect(['hall', 'east'], ['hall', 'east'])).toThrow(/cannot connect to itself/);
        expect(() => s.connect(['hall', 'nope'], ['cave', 'north'])).toThrow(/has no exit "nope"/);
    });

    it('reports what is still unwired', () => {
        const s = session();
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3]] });
        expect(s.unwiredExits()).toEqual([{ region_id: 'hall', exit_id: 'east' }]);
    });

    it('forgets a removed region everywhere', () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3]] });
        s.addExit('cave', { exit_id: 'west', tiles: [[0, 3]] });
        s.connect(['hall', 'east'], ['cave', 'west']);
        s.setStart('cave');
        s.removeRegion('cave');
        expect(s.atlas.vanilla_layout.connections).toEqual([]);
        expect(s.atlas.vanilla_layout.start_region).toBe('');
        expect(s.atlas.vanilla_layout.start_sub_region).toBeUndefined();
    });
});

describe('saving', () => {
    const complete = () => {
        const s = session();
        s.addRegion({ region_id: 'cave', bounds: BOUNDS, map_ref: 1 });
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3], [9, 4]] });
        s.addExit('cave', { exit_id: 'west', tiles: [[0, 3], [0, 4]] });
        s.addLocation('hall', { name: 'Hall - Chest', tile: [5, 5], vanilla_item: 'Red Key' });
        s.addLocation('cave', { name: 'Cave - Chest', tile: [5, 5], vanilla_item: 'Fire' });
        s.connect(['hall', 'east'], ['cave', 'west']);
        s.setStart('hall');
        return s;
    };

    it('produces a document that validates clean', () => {
        const result = complete().validate();
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('resolves map_ref against a map document when one is supplied', () => {
        const mapDoc = { levels: [{ level: 0, width: 10, height: 8 }, { level: 1, width: 10, height: 8 }] };
        expect(complete().validate({ mapDoc }).errors).toEqual([]);

        const tooSmall = { levels: [{ level: 0, width: 4, height: 4 }, { level: 1, width: 10, height: 8 }] };
        expect(complete().validate({ mapDoc: tooSmall }).errors.join(' ')).toMatch(/does not fit level 0/);
    });

    it('stamps through the validator, and stamps the same way twice', () => {
        const s = complete();
        const first = s.toDocument();
        const second = s.toDocument();
        expect(first.atlas_id).toBe(second.atlas_id);
        expect(first.atlas_id).toBe(`seedling-${computeAtlasContentHash(s.atlas)}`);
        expect(first.provenance.content_hash).toBe(computeAtlasContentHash(s.atlas));
        // Stamping must not mutate the live session, or the id would grow a
        // second suffix on the next save.
        expect(s.atlas.atlas_id).toBe('seedling');
    });

    it('reloading a saved document does not chain hash suffixes', () => {
        const doc = complete().toDocument();
        const reloaded = new AtlasSession(JSON.parse(JSON.stringify(doc)));
        expect(reloaded.baseId).toBe('seedling');
        expect(reloaded.toDocument().atlas_id).toBe(doc.atlas_id);
    });

    it('moves the hash when the content changes', () => {
        const s = complete();
        const before = s.toDocument().atlas_id;
        s.addLocation('hall', { name: 'Hall - Second', tile: [6, 5], vanilla_item: 'Health' });
        expect(s.toDocument().atlas_id).not.toBe(before);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E3b — `game` IS REQUIRED, AND EVERY CALLER PASSES ONE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔⛔ `createEmptyAtlas` REFUSES a nameless `game`, and the repo has no such caller', () => {
    it('⛔ the refusal names the parameter and the landmine it replaces', () => {
        expect(() => createEmptyAtlas()).toThrow(/`game` is REQUIRED/);
        expect(() => createEmptyAtlas({})).toThrow(/`game` is REQUIRED/);
        expect(() => createEmptyAtlas({ tileSize: 16 })).toThrow(/used to default to "seedling"/);
        expect(() => createEmptyAtlas({ game: '' })).toThrow(/`game` is REQUIRED/);
        // ⛓ …and a named one still builds the same document, `atlas_id` included
        const atlas = createEmptyAtlas({ game: 'maze', tileSize: 8 });
        expect(atlas.game).toBe('maze');
        expect(atlas.atlas_id).toBe('maze');
    });

    /**
     * ⛓ An EMPTY session used to build a `seedling`-labelled atlas silently.
     * It now refuses and names the constructor the caller has to reach for —
     * a default here would be the same landmine one layer up.
     */
    it('⛔ `new AtlasSession()` with no document refuses rather than inventing one', () => {
        expect(() => new AtlasSession()).toThrow(/no atlas was given/);
        expect(() => new AtlasSession(null)).toThrow(/no atlas was given/);
        expect(new AtlasSession(createEmptyAtlas({ game: 'maze' })).atlas.game).toBe('maze');
    });

    /**
     * ⛔⛔⛔ **THE SWEEP — AND IT IS THE PIN THAT MATTERS, because a caller
     * missed is a CRASH in a page no node row can see.** Every
     * `createEmptyAtlas(` call site in the repo must pass a `game`, and every
     * `new AtlasSession(` must be handed something. The row LISTS the sites it
     * found, so a scan that silently stopped matching would be visible as a
     * count rather than as a pass.
     *
     * ⛓ The DEFINITION in `atlasSession.js` is excluded by the `function`
     * prefix; everything else is a call. The argument text is taken by
     * BALANCING PARENTHESES rather than by a regex to the next `)`, because
     * every real call nests one.
     *
     * ⛔ **WHAT THE SWEEP DOES NOT COVER, SAID OUT LOUD:** THIS FILE. It is the
     * one that DRIVES the refusal, so it deliberately holds calls with no
     * `game` (`createEmptyAtlas()`, `new AtlasSession()`) that the sweep would
     * have to flag. Its own real construction is covered by every other row
     * here. ⛓ The pattern is also assembled from pieces so the scan cannot
     * match the scanner.
     */
    it('⛔ every `createEmptyAtlas(` / `new AtlasSession(` site in the repo passes a substrate', () => {
        const root = fileURLToPath(new URL('../../..', import.meta.url));
        const files = [];
        const walk = (dir) => {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                const full = join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(js|mjs|html)$/.test(e.name)) files.push(full);
            }
        };
        for (const top of ['frontend', 'scripts']) walk(join(root, top));
        expect(files.length).toBeGreaterThan(100);

        /** The text between the balanced parentheses that start at `open`. */
        const argsAt = (src, open) => {
            let depth = 0;
            for (let i = open; i < src.length; i += 1) {
                if (src[i] === '(') depth += 1;
                else if (src[i] === ')') {
                    depth -= 1;
                    if (depth === 0) return src.slice(open + 1, i);
                }
            }
            return null;
        };

        // ⛓ assembled, so the scanner is not one of its own findings
        const SITE_RE = new RegExp(
            `(function\\s+)?createEmpty${'Atlas'}\\s*\\(|new\\s+Atlas${'Session'}\\s*\\(`, 'g',
        );
        const SELF = 'regionMarkingTool/atlasSession.test.js';
        /**
         * ⛓ Comments and string literals are BLANKED (length preserved, so line
         * numbers survive) before matching. A docblock that mentions the call,
         * or a refusal message that spells the fix, is prose about the call and
         * not a call — and this file's own refusal message spells exactly that.
         */
        const codeOnly = (src) => {
            let out = '';
            let i = 0;
            while (i < src.length) {
                const c = src[i];
                const two = src.slice(i, i + 2);
                const blankTo = (end) => {
                    const chunk = src.slice(i, end);
                    out += chunk.replace(/[^\n]/g, ' ');
                    i = end;
                };
                if (two === '/*') {
                    const end = src.indexOf('*/', i + 2);
                    blankTo(end === -1 ? src.length : end + 2);
                } else if (two === '//') {
                    const end = src.indexOf('\n', i);
                    blankTo(end === -1 ? src.length : end);
                } else if (c === '"' || c === "'" || c === '`') {
                    let j = i + 1;
                    while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
                    blankTo(Math.min(j + 1, src.length));
                } else {
                    out += c;
                    i += 1;
                }
            }
            return out;
        };
        const sites = [];
        for (const file of files) {
            const rel = relative(root, file);
            if (rel.endsWith(SELF)) continue;
            // ⛔ READ AS TEXT, NOT THROUGH `grep` — see `NUL_BEARING` below.
            const raw = readFileSync(file, 'utf8');
            // ⛓ cheap prefilter: only the handful of files that mention the
            //   names at all are worth tokenising (1,480 files → 10).
            if (!raw.includes(`createEmpty${'Atlas'}`) && !raw.includes(`Atlas${'Session'}`)) continue;
            const src = codeOnly(raw);
            for (const m of src.matchAll(SITE_RE)) {
                if (m[1]) continue;                       // the DEFINITION, not a call
                const line = src.slice(0, m.index).split('\n').length;
                const args = argsAt(src, m.index + m[0].length - 1);
                expect(args, `${rel}:${line} — unbalanced parentheses`).not.toBe(null);
                const kind = m[0].startsWith('new') ? 'AtlasSession' : 'createEmptyAtlas';
                const ok = kind === 'createEmptyAtlas'
                    ? /\bgame\b/.test(args)
                    : args.trim() !== '';
                sites.push({ rel, line, kind, ok, args: args.trim().slice(0, 60) });
            }
        }

        const bad = sites.filter((x) => !x.ok);
        expect(bad.map((x) => `${x.rel}:${x.line} ${x.kind}(${x.args})`)).toEqual([]);
        // ⛔ NOT VACUOUS: both kinds are present and the count is real. If this
        //   number moves, a call site was added or removed — read the list.
        expect(sites.filter((x) => x.kind === 'createEmptyAtlas').length).toBeGreaterThanOrEqual(6);
        expect(sites.filter((x) => x.kind === 'AtlasSession').length).toBeGreaterThanOrEqual(7);
        expect(sites.some((x) => x.rel.includes('mazeRoom'))).toBe(true);
        expect(sites.some((x) => x.rel.includes('seedlingDemo'))).toBe(true);
        expect(sites.some((x) => x.rel.startsWith('scripts/'))).toBe(true);
    });

    /**
     * ⛔⛔⛔ **WHY THE SWEEP ABOVE READS FILES INSTEAD OF ASKING `grep` — AND
     * THE MEASUREMENT THAT MADE IT NECESSARY.**
     *
     * `regionMarkingToolUI.js` — the region-marking tool's own panel, tracked
     * and not ignored — held TWO `createEmptyAtlas` calls with no `game`, and
     * E3b's first sweep of the repo reported the file CLEAN. Twice. The file
     * carries **3 stray NUL bytes**, so `grep` classifies it as BINARY, and a
     * `grep -I` (which this repo's tooling passes) then SKIPS THE WHOLE FILE
     * SILENTLY — zero hits, exit 1, no warning. `grep -a` finds it.
     *
     * ⇒ The sweep row is `readFileSync`-based on purpose, and this row PINS the
     * hazard so it is a fact under test rather than a comment: these files exist,
     * and any future census that shells out to `grep` without `-a` will miss
     * them. ⚠ The LIST is not pinned — files gain and lose stray bytes — but
     * that it is NOT EMPTY is, because an empty list would mean the hazard had
     * been fixed and this row could retire.
     */
    it('⛔ tracked sources carrying NUL bytes exist, and `grep` skips them SILENTLY', () => {
        const root = fileURLToPath(new URL('../../..', import.meta.url));
        const nulBearing = [];
        const walk = (dir) => {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
                if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
                const full = join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(js|mjs)$/.test(e.name)) {
                    const buf = readFileSync(full);
                    if (buf.includes(0)) nulBearing.push(relative(root, full));
                }
            }
        };
        for (const top of ['frontend', 'scripts']) walk(join(root, top));
        expect(nulBearing.length).toBeGreaterThan(0);
        // ⛓ the one this slice was bitten by is among them
        expect(nulBearing).toContain('frontend/modules/regionMarkingTool/regionMarkingToolUI.js');
        // ⛓ …and it is a HANDFUL, not the corpus — so "grep is unreliable here"
        //   is a named exception rather than a reason to distrust every scan.
        expect(nulBearing.length).toBeLessThan(20);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION B-a — THE SESSION UNDERNEATH
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE REFERENCE PATH — the class as it was BEFORE B-a**, kept here and
 * nowhere else. It is the fixture the byte pin is scored against: the sixteen
 * delegations used to be `this.atlas = applyAtlasOp(this.atlas, op).atlas` and
 * `toDocument()` a stamped clone of that field. If the core's session ever
 * reconstructs a different document from the same op list, this row says so in
 * BYTES rather than in a hash.
 *
 * ⛔ It is deliberately NOT imported from anywhere: a reference path that
 * shared code with the path under test would agree with it by construction.
 */
function legacyToDocument(baseAtlas, ops) {
    let atlas = baseAtlas;
    for (const op of ops) {
        const r = applyAtlasOp(atlas, op);
        if (!r.ok) throw new Error(r.error);
        atlas = r.atlas;
    }
    const id = baseAtlas.atlas_id ?? baseAtlas.game ?? 'atlas';
    const prior = baseAtlas.provenance?.content_hash;
    const baseId = typeof prior === 'string' && id.endsWith(`-${prior}`)
        ? id.slice(0, -(prior.length + 1)) : id;
    return stampAtlasIdentity(JSON.parse(JSON.stringify(atlas)), baseId);
}

/** The nine ops the byte pin replays — one per shape the panel can produce. */
const PIN_OPS = [
    { op: 'add-region', region_id: 'hall', name: 'Hall', bounds: BOUNDS, map_ref: 0 },
    { op: 'add-exit', region: 'hall', exit_id: 'north', tiles: [[3, 0], [4, 0], [5, 0]] },
    { op: 'add-exit', region: 'hall', exit_id: 'east', tiles: [[9, 3]] },
    { op: 'set-entrance-tile', region: 'hall', exit: 'north', tile: [5, 0] },
    { op: 'add-location', region: 'hall', name: 'Hall - Chest', tile: [2, 2], vanilla_item: 'Conch' },
    { op: 'add-region', region_id: 'cave', bounds: { x: 0, y: 0, w: 4, h: 4 }, map_ref: 1 },
    { op: 'add-exit', region: 'cave', exit_id: 'up', tiles: [[1, 0]] },
    { op: 'connect', from: ['hall', 'north'], to: ['cave', 'up'] },
    { op: 'set-start', region: 'hall' },
];

const emptyAtlas = () => createEmptyAtlas({ game: 'seedling', mapDocument: 'seedling-map.json' });

describe('AtlasSession over editCore — the byte pin', () => {
    /**
     * ⛔ **THE HEADLINE OF THIS SLICE.** `verify-region-marking-tool` Phases
     * D/E/G compare the panel's SAVED BYTES against this class plus the compact
     * writer, and `atlasOps` says key ORDER is part of them. So the claim is
     * byte identity, not equality of content.
     */
    it('N ops through the session produce the OLD path\'s bytes, exactly', () => {
        const base = emptyAtlas();
        const s = new AtlasSession(emptyAtlas());
        for (const op of PIN_OPS) s.apply(op);
        expect(compactJsonFile(s.toDocument()))
            .toBe(compactJsonFile(legacyToDocument(base, PIN_OPS)));
    });

    it('…and so does the SAME list reached through the sixteen delegations', () => {
        const s = new AtlasSession(emptyAtlas());
        s.addRegion({ region_id: 'hall', name: 'Hall', bounds: BOUNDS, map_ref: 0 });
        s.addExit('hall', { exit_id: 'north', tiles: [[3, 0], [4, 0], [5, 0]] });
        s.addExit('hall', { exit_id: 'east', tiles: [[9, 3]] });
        s.setEntranceTile('hall', 'north', [5, 0]);
        s.addLocation('hall', { name: 'Hall - Chest', tile: [2, 2], vanilla_item: 'Conch' });
        s.addRegion({ region_id: 'cave', bounds: { x: 0, y: 0, w: 4, h: 4 }, map_ref: 1 });
        s.addExit('cave', { exit_id: 'up', tiles: [[1, 0]] });
        s.connect(['hall', 'north'], ['cave', 'up']);
        s.setStart('hall');
        expect(compactJsonFile(s.toDocument()))
            .toBe(compactJsonFile(legacyToDocument(emptyAtlas(), PIN_OPS)));
    });

    /**
     * ⛔ THE RECORD IS NEVER STAMPED — the D-arc law. A `toDocument()` that
     * stamped in place would make the fold's base carry a `content_hash`
     * suffix, so the NEXT save would stamp a document that already claimed an
     * identity, and an undo would replay from a base that is not the one the
     * session opened.
     */
    it('toDocument() stamps a CLONE — twice in a row gives the same bytes', () => {
        const s = new AtlasSession(emptyAtlas());
        for (const op of PIN_OPS) s.apply(op);
        const first = compactJsonFile(s.toDocument());
        expect(compactJsonFile(s.toDocument())).toBe(first);
        expect(s.atlas.provenance.content_hash).toBeUndefined();
        expect(s.atlas.atlas_id).toBe('seedling');
        expect(s.baseId).toBe('seedling');
    });
});

describe('AtlasSession over editCore — undo, edits, payload', () => {
    it('records one edit per applied op, and undo is the fold over a shorter list', () => {
        const base = emptyAtlas();
        const s = new AtlasSession(emptyAtlas());
        for (const op of PIN_OPS) s.apply(op);
        expect(s.edits()).toHaveLength(PIN_OPS.length);

        const afterEight = compactJsonFile(legacyToDocument(base, PIN_OPS.slice(0, -1)));
        expect(s.undo()).toBe(true);
        expect(s.edits()).toHaveLength(PIN_OPS.length - 1);
        // MUTANT: undo by an INVERSE op instead of the shorter fold — an atlas
        // whose `set-start` is undone by `set-start ''` differs in BYTES from
        // one that never had it.
        expect(compactJsonFile(s.toDocument())).toBe(afterEight);
    });

    it('undo to ZERO returns the document the session OPENED, byte for byte', () => {
        const s = new AtlasSession(emptyAtlas());
        const opened = compactJsonFile(s.toDocument());
        for (const op of PIN_OPS) s.apply(op);
        for (let i = 0; i < PIN_OPS.length; i += 1) expect(s.undo()).toBe(true);
        expect(s.undo()).toBe(false);          // and it says so rather than throwing
        expect(s.edits()).toHaveLength(0);
        expect(compactJsonFile(s.toDocument())).toBe(opened);
    });

    it('payload() names the document it opened', () => {
        const doc = emptyAtlas();
        const s = new AtlasSession(doc);
        s.apply(PIN_OPS[0]);
        const p = s.payload();
        expect(p.base).toEqual({ kind: 'atlas', atlas_id: doc.atlas_id });
        expect(p.edits).toEqual(s.edits());
        expect(p.certified).toBe(null);
        s.setCertified(true);
        expect(s.payload().certified).toBe(true);
        // ⛓ An edit puts certification back to "nobody has asked".
        s.apply(PIN_OPS[1]);
        expect(s.certified).toBe(null);
    });

    /**
     * ⛔ **EQUALS, NOT `toThrow(substring)`.** `expect(...).toThrow('…')` is a
     * SUBSTRING match, so the row this replaces stayed green under a mutant
     * that prefixed every refusal — which is the one thing the pin exists to
     * catch, because the panel's status line and eleven rows above print the
     * op module's sentence verbatim.
     */
    it('a REFUSED op throws the op module\'s own sentence VERBATIM, and records nothing', () => {
        const s = new AtlasSession(emptyAtlas());
        s.apply(PIN_OPS[0]);
        const op = { op: 'add-location', region: 'nope', name: 'X', tile: [1, 1] };
        const direct = applyAtlasOp(s.atlas, op);
        expect(direct.ok).toBe(false);
        expect(direct.error).toBe('no region "nope" in this atlas');
        let thrown = null;
        try { s.apply(op); } catch (e) { thrown = e; }
        expect(thrown).not.toBe(null);
        expect(thrown.message).toBe(direct.error);
        expect(s.edits()).toHaveLength(1);
    });

    /**
     * ⛓ `baseId` is the SAVE ID'S STEM, not a document field: the committed
     * `seedling-fixture.json` carries `game: "seedling"` under the stem
     * `seedling-fixture`, so a `set-game` that moved `atlas_id` too would
     * RENAME the starter atlas. It stays a field a page may move, and
     * `deriveBaseId()` re-reads what the document now says — which is what a
     * page calls after undoing that op.
     */
    it('deriveBaseId() re-reads the CURRENT document, and set-game does not move atlas_id', () => {
        const s = new AtlasSession(emptyAtlas());
        expect(s.deriveBaseId()).toBe('seedling');
        s.setGame('maze');
        expect(s.atlas.game).toBe('maze');
        expect(s.atlas.atlas_id).toBe('seedling');       // ⛔ unmoved, by measurement
        s.baseId = 'maze';                                // what the panel does
        expect(compactJsonFile(s.toDocument())).toMatch(/"atlas_id": "maze-/);
        s.undo();
        s.baseId = s.deriveBaseId();                      // what the panel does on undo
        expect(s.baseId).toBe('seedling');
        expect(compactJsonFile(s.toDocument()))
            .toBe(compactJsonFile(new AtlasSession(emptyAtlas()).toDocument()));
    });

    /**
     * ⛔ THE DISCRIMINATING INSTANCE IS COMMITTED, not invented: without a
     * document whose stem DIFFERS from its `game`, a `deriveBaseId` that read
     * `game` first would agree on every row above and the mutant would be
     * vacuous.
     */
    it('the STARTER atlas is the case that separates the stem from the game', () => {
        const starter = JSON.parse(readFileSync(new URL(
            '../flashPanel/atlases/seedling-fixture.json', import.meta.url,
        ), 'utf8'));
        expect(starter.game).toBe('seedling');
        expect(starter.atlas_id).toMatch(/^seedling-fixture-/);
        const s = new AtlasSession(starter);
        expect(s.baseId).toBe('seedling-fixture');
        expect(s.deriveBaseId()).toBe('seedling-fixture');
        // ⛓ …and a save does NOT grow a second hash suffix.
        expect(s.toDocument().atlas_id).toBe(starter.atlas_id);
    });

    it('the DOCUMENT is the fold — there is no setter', () => {
        const s = new AtlasSession(emptyAtlas());
        expect(() => { s.atlas = emptyAtlas(); }).toThrow();
    });

    /**
     * ⛓ The nine headless callers open a session with no level. `bounds` and
     * `readCell` are the only members that need one, and they refuse BY NAME
     * rather than answering a rectangle that does not exist.
     */
    it('a session opened with no levelView refuses the CELL half by name', () => {
        const s = new AtlasSession(emptyAtlas());
        expect(() => s.adapter.bounds(s.atlas)).toThrow(/map document is not loaded yet/);
        const withLevel = new AtlasSession(emptyAtlas(), {
            levelView: () => ({ level: 0, width: 20, height: 20 }),
        });
        expect(withLevel.adapter.bounds(withLevel.atlas)).toEqual({ w: 20, h: 20 });
    });
});
