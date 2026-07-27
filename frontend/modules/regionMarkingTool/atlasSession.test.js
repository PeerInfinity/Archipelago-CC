// Unit tests for the region-marking tool's editing model (region-atlas plan,
// Phase 2, Deliverable 2). The model is where the format's authoring rules are
// enforced BEFORE the validator sees a document — so what these tests care
// about most is that the slips the kickoff called out are impossible, not
// merely reported: '__' in ids, an entrance off its exit span, a sub_region on
// a region that has no subgraph (and a missing one on a region that does), and
// a defaulted `bidirectional`.
import { describe, it, expect } from 'vitest';

import {
    AtlasSession, createEmptyAtlas, deriveEdgeSide, lineTiles, rectBounds, boundsContains,
} from './atlasSession.js';
import { computeAtlasContentHash } from '../procgenPipeline/regionAtlasValidator.js';

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
