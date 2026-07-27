// Unit tests for the region-atlas validator + content-hash identity
// (CC/docs/plans/region-atlas-plan.md, Phase 1).
//
// The anchor is the committed hand-written Seedling fixture — the tests read it
// off disk rather than rebuilding it inline, so a fixture that stops validating
// fails here instead of silently drifting from the format it documents.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { compactJsonFile } from './compactJson.js';
import {
    validateRegionAtlas,
    stampAtlasIdentity,
    computeAtlasContentHash,
    apRegionName,
    derivedRulesSource,
    internalExitSource,
    AP_SUBREGION_SEPARATOR,
    DEFAULT_EXIT_SOURCE,
    REGION_ATLAS_SCHEMA_VERSION,
    indexMapDocument,
} from './regionAtlasValidator.js';

const FIXTURE_PATH = fileURLToPath(
    new URL('../flashPanel/atlases/seedling-fixture.json', import.meta.url),
);

const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const clone = (v) => JSON.parse(JSON.stringify(v));
const makeAtlas = () => clone(FIXTURE);

// Most mutations change the hashed content, so restamp before validating —
// otherwise every test would also trip the identity check.
function mutated(fn) {
    const atlas = makeAtlas();
    fn(atlas);
    stampAtlasIdentity(atlas);
    return validateRegionAtlas(atlas);
}

const hasError = (result, re) => result.errors.some((e) => re.test(e));
const hasWarning = (result, re) => result.warnings.some((w) => re.test(w));

const regionOf = (atlas, id) => atlas.regions.find((r) => r.region_id === id);

describe('the Seedling atlas fixture', () => {
    it('validates clean, with no warnings', () => {
        const r = validateRegionAtlas(makeAtlas());
        expect(r.errors).toEqual([]);
        expect(r.warnings).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it('reports the shape it exercises', () => {
        const r = validateRegionAtlas(makeAtlas());
        expect(r.stats).toEqual({
            regions: 3, sub_regions: 5, exits: 6, locations: 6, connections: 3,
        });
    });

    it('covers every format feature at least once', () => {
        const atlas = makeAtlas();
        const exits = atlas.regions.flatMap((r) => r.exits);
        // multi-tile edge span with a single entrance spawn tile
        expect(exits.some((e) => e.kind === 'edge' && e.exit_tiles.length > 1)).toBe(true);
        // teleporter exits
        expect(exits.filter((e) => e.kind === 'teleporter').length).toBeGreaterThan(0);
        // intrinsic gate on a boundary exit
        expect(exits.some((e) => e.access_rule)).toBe(true);
        // a region with no subgraph, and regions with one
        expect(atlas.regions.some((r) => r.subgraph === undefined)).toBe(true);
        expect(atlas.regions.some((r) => r.subgraph?.sub_regions.length > 1)).toBe(true);
        // item-gated and one-way internal exits
        const internal = atlas.regions.flatMap((r) => r.subgraph?.internal_exits ?? []);
        expect(internal.some((e) => e.bidirectional && e.access_rule)).toBe(true);
        expect(internal.some((e) => e.bidirectional === false)).toBe(true);
        // locations with vanilla items, and both rules_source flavours
        expect(atlas.regions.flatMap((r) => r.locations).every((l) => l.vanilla_item)).toBe(true);
        const sources = new Set(atlas.regions.map((r) => r.annotations.rules_source));
        expect(sources.has('analyzer')).toBe(true);
        expect(sources.has('manual')).toBe(true);
    });
});

describe('content-hash identity', () => {
    it('is stable under key reordering', () => {
        // Serialization order must not move the hash: the canonical form sorts
        // keys, so a re-keyed document is the same document.
        const reorder = (v) => {
            if (Array.isArray(v)) return v.map(reorder);
            if (v === null || typeof v !== 'object') return v;
            const out = {};
            for (const k of Object.keys(v).reverse()) out[k] = reorder(v[k]);
            return out;
        };
        const shuffled = reorder(makeAtlas());
        expect(computeAtlasContentHash(shuffled)).toBe(computeAtlasContentHash(makeAtlas()));
        expect(validateRegionAtlas(shuffled).ok).toBe(true);
    });

    it('ignores provenance and atlas_id themselves', () => {
        const atlas = makeAtlas();
        const before = computeAtlasContentHash(atlas);
        atlas.provenance.generator = 'region-marking-tool';
        atlas.atlas_id = 'renamed-fixture';
        expect(computeAtlasContentHash(atlas)).toBe(before);
    });

    it('rejects a stale atlas_id after an edit (no restamp)', () => {
        const atlas = makeAtlas();
        regionOf(atlas, 'owls_nest').locations[0].vanilla_item = 'Wand';
        const r = validateRegionAtlas(atlas);
        expect(r.ok).toBe(false);
        expect(hasError(r, /content_hash .* does not match/)).toBe(true);
    });

    it('rejects an atlas_id that does not carry the current hash suffix', () => {
        const atlas = makeAtlas();
        atlas.atlas_id = 'seedling-fixture';
        const r = validateRegionAtlas(atlas);
        expect(r.ok).toBe(false);
        expect(hasError(r, /atlas_id must end with the content-hash suffix/)).toBe(true);
    });

    it('restamps round-trip: edit -> stamp -> valid, with the base id preserved', () => {
        const atlas = makeAtlas();
        const originalId = atlas.atlas_id;
        regionOf(atlas, 'owls_nest').locations[0].vanilla_item = 'Wand';
        expect(validateRegionAtlas(atlas).ok).toBe(false);

        stampAtlasIdentity(atlas);
        expect(validateRegionAtlas(atlas).ok).toBe(true);
        expect(atlas.atlas_id).not.toBe(originalId);
        expect(atlas.atlas_id).toMatch(/^seedling-fixture-[0-9a-f]{8}$/);
        expect(atlas.atlas_id.endsWith(`-${atlas.provenance.content_hash}`)).toBe(true);

        // Idempotent: stamping an unchanged document does not stack suffixes.
        const stampedId = atlas.atlas_id;
        stampAtlasIdentity(atlas);
        expect(atlas.atlas_id).toBe(stampedId);

        // And reverting the edit restores the original identity exactly.
        regionOf(atlas, 'owls_nest').locations[0].vanilla_item = 'Progressive Sword';
        stampAtlasIdentity(atlas);
        expect(atlas.atlas_id).toBe(originalId);
    });

    it('warns (not errors) on an unstamped hand-authored document', () => {
        const atlas = makeAtlas();
        delete atlas.provenance;
        const r = validateRegionAtlas(atlas);
        expect(r.ok).toBe(true);
        expect(hasWarning(r, /provenance missing/)).toBe(true);
    });
});

describe('AP sub-region naming (open question 1)', () => {
    it('compounds region and sub-region with the __ separator', () => {
        expect(AP_SUBREGION_SEPARATOR).toBe('__');
        expect(apRegionName('overworld_south', 'shore')).toBe('overworld_south__shore');
    });

    it('leaves a region with no subgraph unqualified', () => {
        expect(apRegionName('owls_nest')).toBe('owls_nest');
        expect(apRegionName('owls_nest', null)).toBe('owls_nest');
    });

    it('rejects ids that would make the compound name ambiguous', () => {
        const bad = mutated((a) => { regionOf(a, 'owls_nest').region_id = 'owls__nest'; });
        expect(hasError(bad, /region_id must not contain "__"/)).toBe(true);

        const badSub = mutated((a) => {
            regionOf(a, 'gundernourd').subgraph.sub_regions[1] = 'deep__water';
        });
        expect(hasError(badSub, /must not contain "__"/)).toBe(true);
    });
});

describe('envelope', () => {
    it('rejects a wrong schema_version', () => {
        const r = mutated((a) => { a.schema_version = REGION_ATLAS_SCHEMA_VERSION + 1; });
        expect(hasError(r, /schema_version must be 1/)).toBe(true);
    });

    it('requires tile_space.tile_size', () => {
        const r = mutated((a) => { a.tile_space.tile_size = 0; });
        expect(hasError(r, /tile_size must be a positive integer/)).toBe(true);
    });

    it('rejects a non-object', () => {
        expect(validateRegionAtlas(null).ok).toBe(false);
        expect(validateRegionAtlas([]).errors).toEqual(['atlas is not an object']);
    });
});

describe('sub-region referential integrity', () => {
    it('rejects a dangling sub_region on an exit', () => {
        const r = mutated((a) => {
            regionOf(a, 'overworld_south').exits[0].sub_region = 'nowhere';
        });
        expect(r.ok).toBe(false);
        expect(hasError(r, /exit "north_pass".*sub_region "nowhere" is not declared/)).toBe(true);
    });

    it('rejects a dangling sub_region on a location', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').locations[0].sub_region = 'nowhere';
        });
        expect(hasError(r, /location "Shield".*sub_region "nowhere" is not declared/)).toBe(true);
    });

    it('rejects a dangling endpoint on an internal exit', () => {
        const r = mutated((a) => {
            regionOf(a, 'overworld_south').subgraph.internal_exits[0].to = 'nowhere';
        });
        expect(hasError(r, /internal_exits\[0\]\.to references unknown sub_region "nowhere"/)).toBe(true);
    });

    it('requires sub_region on every exit and location once a subgraph exists', () => {
        const r = mutated((a) => {
            delete regionOf(a, 'overworld_south').exits[0].sub_region;
            delete regionOf(a, 'overworld_south').locations[0].sub_region;
        });
        expect(r.errors.filter((e) => /sub_region is required/.test(e))).toHaveLength(2);
    });

    it('forbids sub_region on a region with no subgraph', () => {
        // A region without traversal obstacles is ONE implicit sub-region and
        // needs no boilerplate — naming one is an authoring error, not a no-op.
        const r = mutated((a) => { regionOf(a, 'owls_nest').exits[0].sub_region = 'main'; });
        expect(hasError(r, /sub_region is set but region "owls_nest" has no subgraph/)).toBe(true);
    });

    it('warns that a single-entry subgraph is boilerplate', () => {
        const r = mutated((a) => {
            const reg = regionOf(a, 'owls_nest');
            reg.subgraph = { sub_regions: ['main'], internal_exits: [] };
            reg.exits.forEach((e) => { e.sub_region = 'main'; });
            reg.locations.forEach((l) => { l.sub_region = 'main'; });
        });
        expect(r.ok).toBe(true);
        expect(hasWarning(r, /declares a single sub_region — omit the subgraph/)).toBe(true);
    });

    it('requires an explicit bidirectional flag', () => {
        const r = mutated((a) => {
            delete regionOf(a, 'overworld_south').subgraph.internal_exits[1].bidirectional;
        });
        expect(hasError(r, /bidirectional must be a boolean/)).toBe(true);
    });

    it('rejects a self-connected internal exit', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').subgraph.internal_exits[0].to = 'entry';
        });
        expect(hasError(r, /connects sub_region "entry" to itself/)).toBe(true);
    });
});

describe('sub-region reachability', () => {
    it('rejects a sub_region no entry point can reach', () => {
        const r = mutated((a) => {
            regionOf(a, 'overworld_south').subgraph.sub_regions.push('cave');
        });
        expect(r.ok).toBe(false);
        expect(hasError(r, /sub_region "cave" is unreachable from any entry point/)).toBe(true);
    });

    it('rejects a sub_region reachable only against a one-way edge', () => {
        // The drop into the pit is one-way: with the eastern exit moved off the
        // pit, nothing enters `pit` except the drop — which is fine — but flip
        // the drop's direction and the pit becomes unreachable.
        const r = mutated((a) => {
            const sg = regionOf(a, 'overworld_south').subgraph;
            sg.internal_exits[1] = { from: 'pit', to: 'shore', bidirectional: false };
            regionOf(a, 'overworld_south').exits[1].sub_region = 'shore';
        });
        expect(hasError(r, /sub_region "pit" is unreachable/)).toBe(true);
    });

    it('warns when a sub_region cannot reach any boundary exit', () => {
        const r = mutated((a) => {
            regionOf(a, 'overworld_south').exits[1].sub_region = 'shore';
        });
        expect(r.ok).toBe(true);
        expect(hasWarning(r, /sub_region "pit" cannot reach any boundary exit/)).toBe(true);
    });

    it('treats the start sub-region as an entry point', () => {
        // `shore` is only reachable as the start; strip the north pass and the
        // start declaration is what keeps the region valid.
        const withStart = mutated((a) => {
            const reg = regionOf(a, 'overworld_south');
            reg.exits[0].sub_region = 'pit';
            reg.subgraph.internal_exits[1] = { from: 'shore', to: 'pit', bidirectional: false };
        });
        expect(hasError(withStart, /unreachable/)).toBe(false);

        const withoutStart = mutated((a) => {
            const reg = regionOf(a, 'overworld_south');
            reg.exits[0].sub_region = 'pit';
            reg.subgraph.internal_exits[1] = { from: 'shore', to: 'pit', bidirectional: false };
            a.vanilla_layout.start_region = 'owls_nest';
            delete a.vanilla_layout.start_sub_region;
        });
        expect(hasError(withoutStart, /sub_region "shore" is unreachable/)).toBe(true);
    });

    it('rejects a region nothing can enter', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').exits = [];
            a.vanilla_layout.connections = a.vanilla_layout.connections.filter(
                (c) => c.from[0] !== 'owls_nest' && c.to[0] !== 'owls_nest',
            );
        });
        expect(hasError(r, /region "owls_nest" has no entry point/)).toBe(true);
    });
});

describe('exit geometry', () => {
    it('rejects an edge run that is not on the named side', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').exits[0].exit_tiles = [[8, 13], [9, 13], [10, 13]];
            regionOf(a, 'owls_nest').exits[0].entrance_tile = [9, 13];
        });
        expect(hasError(r, /side S lies at y=14 for these bounds, but exit_tiles sit at 13/)).toBe(true);
    });

    it('rejects an edge run that is not a straight line', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').exits[0].exit_tiles = [[8, 14], [9, 13], [10, 14]];
        });
        expect(hasError(r, /must be a straight horizontal line/)).toBe(true);
    });

    it('rejects a gap in an edge run', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').exits[0].exit_tiles = [[8, 14], [10, 14], [12, 14]];
        });
        expect(hasError(r, /must be a contiguous run \(gap between x=8 and 10\)/)).toBe(true);
    });

    it('rejects tiles outside the region bounds', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').locations[0].tile = [2, 2];
        });
        expect(hasError(r, /location "Shield"\.tile \[2,2\] lies outside the region bounds/)).toBe(true);
    });

    it('requires the entrance tile to sit on the exit span', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').exits[0].entrance_tile = [9, 12];
        });
        expect(hasError(r, /entrance_tile \[9,12\] must be one of exit_tiles/)).toBe(true);
    });

    it('requires a side on an edge exit and forbids one on a teleporter', () => {
        const noSide = mutated((a) => { delete regionOf(a, 'owls_nest').exits[0].side; });
        expect(hasError(noSide, /side must be one of N\/E\/S\/W for an edge exit/)).toBe(true);

        const teleSide = mutated((a) => { regionOf(a, 'owls_nest').exits[1].side = 'N'; });
        expect(hasError(teleSide, /side must be absent for a teleporter exit/)).toBe(true);
    });

    it('accepts a teleporter whose partner is not a grid neighbour', () => {
        // The fixture's ladder already crosses from owls_nest (y 0..14) into
        // gundernourd (x 20..35) — no adjacency, no complaint.
        const r = validateRegionAtlas(makeAtlas());
        expect(hasWarning(r, /pairs side/)).toBe(false);
        expect(r.ok).toBe(true);
    });

    it('rejects duplicate ids', () => {
        const dupExit = mutated((a) => {
            regionOf(a, 'owls_nest').exits[1].exit_id = 'south_stair';
        });
        expect(hasError(dupExit, /duplicate exit_id "south_stair"/)).toBe(true);

        const dupRegion = mutated((a) => { a.regions[1].region_id = 'owls_nest'; });
        expect(hasError(dupRegion, /duplicate region_id "owls_nest"/)).toBe(true);

        const dupLoc = mutated((a) => {
            regionOf(a, 'gundernourd').locations[0].name = 'Sword';
        });
        expect(hasError(dupLoc, /duplicate location name "Sword"/)).toBe(true);
    });

    it('warns about a location with no vanilla item', () => {
        const r = mutated((a) => { delete regionOf(a, 'owls_nest').locations[0].vanilla_item; });
        expect(r.ok).toBe(true);
        expect(hasWarning(r, /location "Sword" has no vanilla_item/)).toBe(true);
    });
});

describe('access rules', () => {
    it('rejects a rule node with no rule name', () => {
        const r = mutated((a) => {
            regionOf(a, 'overworld_south').subgraph.internal_exits[0].access_rule = { args: {} };
        });
        expect(hasError(r, /access_rule\.rule must be a non-empty string/)).toBe(true);
    });

    it('rejects a non-object rule', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').exits[0].access_rule = 'Has Red Key';
        });
        expect(hasError(r, /access_rule must be a Rule Builder rule object/)).toBe(true);
    });

    it('descends into children', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').subgraph.internal_exits[0]
                .access_rule.children[1].children[0] = { item: 'Light' };
        });
        expect(hasError(r, /access_rule\.children\[1\]\.children\[0\]\.rule must be a non-empty string/)).toBe(true);
    });

    it('descends into rule-shaped named args (Compare left/right)', () => {
        const r = mutated((a) => {
            regionOf(a, 'owls_nest').locations[1].access_rule.args.left = { rule: '' };
        });
        expect(hasError(r, /access_rule\.args\.left\.rule must be a non-empty string/)).toBe(true);
    });

    it('rejects malformed args', () => {
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').exits[0].access_rule.args = 'Red Key';
        });
        expect(hasError(r, /access_rule\.args must be an object .* or an array/)).toBe(true);
    });

    it('accepts positional args carrying nested rules', () => {
        // The AST->Rule Builder converter emits helper calls this way.
        const r = mutated((a) => {
            regionOf(a, 'gundernourd').exits[0].access_rule = {
                rule: 'has_item',
                args: [{ rule: 'Constant', args: { value: 'Red Key' } }],
            };
        });
        expect(r.ok).toBe(true);
    });
});

describe('annotations', () => {
    it('rejects an unknown rules_source', () => {
        const r = mutated((a) => { regionOf(a, 'owls_nest').annotations.rules_source = 'guessed'; });
        expect(hasError(r, /rules_source must be one of analyzer\/manual\/mixed/)).toBe(true);
    });

    it('warns when a region is unannotated', () => {
        const r = mutated((a) => { delete regionOf(a, 'owls_nest').annotations; });
        expect(r.ok).toBe(true);
        expect(hasWarning(r, /region "owls_nest" has no annotations\.rules_source/)).toBe(true);
    });
});

describe('internal-exit provenance (Phase 5a, ruling 2)', () => {
    const internalExits = (a, id) => regionOf(a, id).subgraph.internal_exits;

    it('reads an absent source as manual, so every pre-5a atlas is unchanged', () => {
        // The committed fixture's rows were hand-written and carry no `source`.
        for (const region of FIXTURE.regions) {
            for (const e of region.subgraph?.internal_exits ?? []) {
                expect(e.source).toBeUndefined();
                expect(internalExitSource(e)).toBe(DEFAULT_EXIT_SOURCE);
            }
        }
        expect(validateRegionAtlas(makeAtlas()).ok).toBe(true);
    });

    it('accepts the two declared sources and rejects anything else', () => {
        for (const source of ['analyzer', 'manual']) {
            const r = mutated((a) => { internalExits(a, 'overworld_south')[0].source = source; });
            expect(hasError(r, /\.source must be one of/)).toBe(false);
        }
        const bad = mutated((a) => { internalExits(a, 'overworld_south')[0].source = 'guessed'; });
        expect(hasError(bad, /\.source must be one of analyzer\/manual/)).toBe(true);
    });

    it('derives rules_source only once a row is analyzer-written', () => {
        // No analyzer rows: the author's declaration stands, whatever it is.
        expect(derivedRulesSource(regionOf(makeAtlas(), 'overworld_south'))).toBeNull();
        expect(derivedRulesSource(regionOf(makeAtlas(), 'owls_nest'))).toBeNull();

        const allAnalyzer = makeAtlas();
        for (const e of internalExits(allAnalyzer, 'overworld_south')) e.source = 'analyzer';
        expect(derivedRulesSource(regionOf(allAnalyzer, 'overworld_south'))).toBe('analyzer');

        const mixed = makeAtlas();
        internalExits(mixed, 'overworld_south')[0].source = 'analyzer';
        internalExits(mixed, 'overworld_south')[1].source = 'manual';
        expect(derivedRulesSource(regionOf(mixed, 'overworld_south'))).toBe('mixed');
    });

    it('errors when a region\'s label disagrees with its own rows', () => {
        // overworld_south is annotated "analyzer"; a hand-authored row in it
        // makes that a lie, and the lie is what a reviewer would act on.
        const r = mutated((a) => {
            const [first, second] = internalExits(a, 'overworld_south');
            first.source = 'analyzer';
            second.source = 'manual';
        });
        expect(hasError(r, /rules_source is "analyzer" but its internal exits say "mixed"/)).toBe(true);

        const consistent = mutated((a) => {
            for (const e of internalExits(a, 'overworld_south')) e.source = 'analyzer';
        });
        expect(consistent.ok).toBe(true);
    });

    it('leaves a region with no subgraph out of the derivation entirely', () => {
        expect(derivedRulesSource(regionOf(makeAtlas(), 'owls_nest'))).toBeNull();
        expect(derivedRulesSource({})).toBeNull();
        expect(derivedRulesSource({ subgraph: { internal_exits: [] } })).toBeNull();
    });
});

describe('vanilla_layout', () => {
    it('rejects an unknown start region', () => {
        const r = mutated((a) => { a.vanilla_layout.start_region = 'atlantis'; });
        expect(hasError(r, /start_region "atlantis" is not a region in this atlas/)).toBe(true);
    });

    it('requires a start sub-region when the start region has a subgraph', () => {
        const r = mutated((a) => { delete a.vanilla_layout.start_sub_region; });
        expect(hasError(r, /start_sub_region is required/)).toBe(true);
    });

    it('forbids a start sub-region when the start region has none', () => {
        const r = mutated((a) => {
            a.vanilla_layout.start_region = 'owls_nest';
            a.vanilla_layout.start_sub_region = 'main';
        });
        expect(hasError(r, /start_sub_region is set but start region "owls_nest" has no subgraph/)).toBe(true);
    });

    it('rejects connections to unknown regions and exits', () => {
        const badRegion = mutated((a) => { a.vanilla_layout.connections[0].from[0] = 'atlantis'; });
        expect(hasError(badRegion, /references unknown region "atlantis"/)).toBe(true);

        const badExit = mutated((a) => { a.vanilla_layout.connections[0].from[1] = 'trapdoor'; });
        expect(hasError(badExit, /references unknown exit "trapdoor" in region "owls_nest"/)).toBe(true);
    });

    it('rejects an exit wired twice', () => {
        const r = mutated((a) => {
            a.vanilla_layout.connections[1].from = ['owls_nest', 'south_stair'];
        });
        expect(hasError(r, /is already connected by/)).toBe(true);
    });

    it('warns about an edge pair that is not opposite sides', () => {
        const r = mutated((a) => { regionOf(a, 'gundernourd').exits[0].side = 'E'; });
        expect(hasWarning(r, /pairs side E with side E/)).toBe(true);
    });

    it('warns about an exit the vanilla layout leaves unwired', () => {
        const r = mutated((a) => { a.vanilla_layout.connections.pop(); });
        expect(hasWarning(r, /exit "nest_ladder" of region "owls_nest" is not wired/)).toBe(true);
        expect(hasWarning(r, /exit "pit_mouth" of region "gundernourd" is not wired/)).toBe(true);
    });
});

// --- Phase 2 delta: multi-level coordinate spaces ---------------------------
//
// Seedling's map is not one tile space but 116 of them, one per level, each
// with its own origin. `map_ref` names which one a region lives in. The whole
// point of the delta is that it is ADDITIVE: the Phase-1 fixture, which has no
// map_ref anywhere, must keep validating byte-for-byte as it did.
describe('map_ref (multi-level coordinate spaces)', () => {
    // Two levels, shaped like the committed Seedling extract.
    const MAP_DOC = { levels: [{ level: 0, width: 40, height: 30 }, { level: 12, width: 10, height: 10 }] };

    // Put every region in level 0 and widen it enough to hold their bounds.
    const withMapRef = (fn = () => {}) => {
        const atlas = makeAtlas();
        atlas.tile_space.map_document = 'seedling-map.json';
        const span = atlas.regions.reduce((m, r) => ({
            w: Math.max(m.w, r.bounds.x + r.bounds.w),
            h: Math.max(m.h, r.bounds.y + r.bounds.h),
        }), { w: 0, h: 0 });
        MAP_DOC.levels[0].width = span.w;
        MAP_DOC.levels[0].height = span.h;
        for (const r of atlas.regions) r.map_ref = 0;
        fn(atlas);
        stampAtlasIdentity(atlas);
        return atlas;
    };

    it('leaves the Phase-1 fixture untouched — no map_ref, no new complaints', () => {
        const r = validateRegionAtlas(makeAtlas());
        expect(r.errors).toEqual([]);
        expect(r.warnings).toEqual([]);
        // Passing a map document changes nothing when nothing references one.
        expect(validateRegionAtlas(makeAtlas(), { mapDoc: MAP_DOC }).warnings).toEqual([]);
    });

    it('validates clean with map_ref set and the map document supplied', () => {
        const r = validateRegionAtlas(withMapRef(), { mapDoc: MAP_DOC });
        expect(r.errors).toEqual([]);
        expect(r.warnings).toEqual([]);
    });

    it('checks only the shape when no map document is available', () => {
        const r = validateRegionAtlas(withMapRef());
        expect(r.errors).toEqual([]);
        const bogus = validateRegionAtlas(withMapRef((a) => { a.regions[0].map_ref = 9999; }));
        expect(bogus.errors).toEqual([]);
    });

    it('rejects a map_ref that names no level in the document', () => {
        const r = validateRegionAtlas(withMapRef((a) => { a.regions[0].map_ref = 9999; }), { mapDoc: MAP_DOC });
        expect(hasError(r, /map_ref 9999 is not a level in seedling-map\.json/)).toBe(true);
    });

    it('rejects bounds that do not fit the level they name', () => {
        const r = validateRegionAtlas(withMapRef((a) => { a.regions[0].map_ref = 12; }), { mapDoc: MAP_DOC });
        expect(hasError(r, /does not fit level 12, which is 10x10 tiles/)).toBe(true);
    });

    it('accepts a string level id as readily as an integer', () => {
        const doc = { levels: [{ level: 'overworld', width: 200, height: 200 }] };
        const atlas = withMapRef((a) => { for (const r of a.regions) r.map_ref = 'overworld'; });
        expect(validateRegionAtlas(atlas, { mapDoc: doc }).errors).toEqual([]);
    });

    it('rejects a map_ref that is neither an integer nor a string', () => {
        const r = validateRegionAtlas(withMapRef((a) => { a.regions[0].map_ref = [0]; }), { mapDoc: MAP_DOC });
        expect(hasError(r, /map_ref must be an integer or non-empty string level id/)).toBe(true);
    });

    it('requires tile_space.map_document once any region uses map_ref', () => {
        const r = validateRegionAtlas(withMapRef((a) => { delete a.tile_space.map_document; }));
        expect(hasError(r, /tile_space\.map_document is required/)).toBe(true);
    });

    it('rejects a non-string map_document', () => {
        const r = validateRegionAtlas(withMapRef((a) => { a.tile_space.map_document = 7; }));
        expect(hasError(r, /map_document must be a non-empty string/)).toBe(true);
    });

    it('warns when only some regions name a space — the rest are ambiguous', () => {
        const r = validateRegionAtlas(withMapRef((a) => { delete a.regions[1].map_ref; }), { mapDoc: MAP_DOC });
        expect(hasWarning(r, /has no map_ref, but other regions in this atlas do/)).toBe(true);
    });

    it('indexes both map-document shapes', () => {
        expect([...indexMapDocument(MAP_DOC).keys()]).toEqual(['0', '12']);
        expect([...indexMapDocument({ a: { width: 1 }, b: { width: 2 } }).keys()]).toEqual(['a', 'b']);
        expect(indexMapDocument(null).size).toBe(0);
    });
});

// --- the committed Seedling starter atlas (Phase 2, Deliverable 5) ----------
//
// The real map, unlike the invented fixture above: three regions around the
// game start whose geometry is DERIVED from the committed map extract. It is
// regenerated here rather than merely read, which is the gate that keeps it and
// the extract from drifting apart — everything the builder needs is committed,
// so no Seedling checkout is involved.
describe('the Seedling starter atlas', () => {
    const MAP = JSON.parse(readFileSync(
        fileURLToPath(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8',
    ));
    const PATH = fileURLToPath(new URL('../flashPanel/atlases/seedling.json', import.meta.url));
    const TEXT = readFileSync(PATH, 'utf8');
    const ATLAS = JSON.parse(TEXT);

    it('validates with zero errors, map_ref resolved against the map extract', () => {
        const r = validateRegionAtlas(ATLAS, { mapDoc: MAP });
        expect(r.errors).toEqual([]);
        expect(r.stats).toEqual({ regions: 3, sub_regions: 0, exits: 10, locations: 1, connections: 2 });
    });

    it('warns only about the exits this partial atlas has not grown into yet', () => {
        const r = validateRegionAtlas(ATLAS, { mapDoc: MAP });
        expect(r.warnings.every((w) => /is not wired by vanilla_layout/.test(w))).toBe(true);
        expect(r.warnings).toHaveLength(6);
    });

    it('regenerates byte-identically from the committed map extract', async () => {
        const { buildStarterAtlas } = await import('../../../scripts/procgen/make-seedling-starter-atlas.mjs');
        expect(compactJsonFile(buildStarterAtlas())).toBe(TEXT);
    });

    it('places every exit tile on a real level-link entity', () => {
        // The claim the builder makes: nothing here is a hand-typed coordinate.
        const tile = (e) => [Math.floor(e.x / MAP.tile_size), Math.floor(e.y / MAP.tile_size)].join(',');
        for (const region of ATLAS.regions) {
            const level = MAP.levels.find((l) => l.level === region.map_ref);
            const links = new Set(level.entities
                .filter((e) => ['teleporter', 'stairsdown', 'stairsup'].includes(e.type))
                .map(tile));
            for (const exit of region.exits) {
                for (const t of exit.exit_tiles) {
                    expect(links, `${region.region_id}/${exit.exit_id} [${t}]`).toContain(t.join(','));
                }
            }
        }
    });

    it('places its one location on the real chest', () => {
        const level = MAP.levels.find((l) => l.level === 86);
        const chest = level.entities.find((e) => e.type === 'chest');
        const loc = ATLAS.regions.find((r) => r.region_id === 'starting_house').locations[0];
        expect(loc.tile).toEqual([Math.floor(chest.x / 16), Math.floor(chest.y / 16)]);
        expect(loc.vanilla_item).toBe('Seal');
    });
});
