/**
 * ⛓ CONTENT SETS GEN-1 — the generator's placement of declared tile kinds (`mazeTileKindsGen.js`), unit by unit:
 * which kinds qualify (⚖ Q3 generate: true, Q4 "what exists" packs only, Q6 walkable + blocked), the slot count, the
 * law (each of its three refusals, on committed rooms), the two wrappers (a pass-through for every other biome), and
 * the closure (none of these files in it). The whole-world proof is `procgenPipeline/scatteredBiomeWorld.slow.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    GENERATED_TILE_KIND_PASSES, RULES_COMPARE, TILE_KIND_LAW, TILE_KIND_PASS_LAWS, TILE_KIND_PLAN_FIELD, arrivalTiles,
    equivalentRule, equivalentRules, generatedTileKinds, placeTileKinds, realisableTileKinds, tileKindLawBase,
    tileKindLawRefusal, tileKindSlotCount, tileKindWalk, tileKindWalkLength, tileKindsRegionCore, tileKindsSerializer,
} from './mazeTileKindsGen.js';
import { computeLongestShortestPath } from './mazeGeometry.js';
import { deserializeMazeWorldWithKinds, lowerTileKind } from './mazeTileKinds.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { createState, deserializeMazeWorld, extractPathsAndObstacles, getTile, step, TILE_WALL } from './mazeRoomEngine.js';
import { serializeMazeWorld } from './mazeSerializer.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { createStructure } from '../packStructure/packStructure.js';
import { loadPackStack } from '../contentPacks/contentPacks.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURES = new URL('../packStructure/fixtures/packs/', import.meta.url).href;
const sidecarOf = (rel, region) => {
    const doc = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    for (const regs of Object.values(doc.preset_sidecars)) if (regs[region]) return regs[region];
    throw new Error(`${rel}: no ${region}`);
};
const LIGHT_WORLD = ['frontend/presets/procgen_topdown/AP_7/AP_7_rules.json', 'Light World'];
const CARVED = ['frontend/presets/procgen_maze/AP_1/AP_1_rules.json', 'region_1_0'];
const RUG = { kind: 'ground:terrain/rug', pass: 'walkable' };
const PILLAR = { kind: 'ground:terrain/pillar', pass: 'blocked' };

/** A content set shaped as `loadContentSet` builds it: the fixture `ground` named under `exists`. */
async function groundSet({ exists = ['ground'] } = {}) {
    const io = nodePackIo({ base: FIXTURES });
    const stack = await loadPackStack(['ground'], { ...io, only: ['concepts'] });
    const structure = exists.length ? createStructure(await loadPackStack(exists, { ...io, only: ['structure'] })) : null;
    return { ids: ['ground'], concepts: createPackConcepts(stack), structure, structureIds: exists };
}

describe('GEN-1 — which kinds qualify', () => {
    it('only generate: true terrain from a "what exists" pack, walkable or blocked, honest looks', async () => {
        // ground: rug (walkable, generate), pillar (blocked, wall look, generate), pool (needs, generate: false),
        // ledge (one-way, no generate), lamp (an object, no terrain)
        expect(generatedTileKinds(await groundSet())).toEqual([RUG, PILLAR]);
        expect(GENERATED_TILE_KIND_PASSES).toEqual(['walkable', 'blocked', 'needs', 'one-way']);
    });

    it('⛔ a theme cannot place a kind: no "what exists" pack ⇒ no structure ⇒ none (⚖ Q4)', async () => {
        expect(generatedTileKinds(await groundSet({ exists: [] }))).toEqual([]);
        expect(generatedTileKinds(null)).toEqual([]);
        // the concept rows are loaded (as a theme's would be), but not from a pack the world names under exists
        const set = await groundSet();
        expect(generatedTileKinds({ ...set, structureIds: ['meta'] })).toEqual([]);
    });
});

describe('GEN-1 — how many', () => {
    it('min(cap, max(min, round(percent × free / 100))), and 0 with no free cell', () => {
        const n = { percent: 5, cap: 8, min: 1 };
        expect(tileKindSlotCount(0, n)).toBe(0);
        expect(tileKindSlotCount(3, n)).toBe(1); // a small room still gets its one
        expect(tileKindSlotCount(30, n)).toBe(2);
        expect(tileKindSlotCount(437, n)).toBe(8); // the cap (22 uncapped)
        expect(tileKindSlotCount(437, { percent: 0, cap: 8, min: 0 })).toBe(0);
    });
});

describe('GEN-1 — the law, cell by cell, on committed rooms', () => {
    it('(b) a pillar on Light World (2,1) cuts off no floor and keeps the walk, but kills an exit: refused as changes-rules', () => {
        const w = deserializeMazeWorld(sidecarOf(...LIGHT_WORLD).playable_payload);
        const base = tileKindLawBase(w, LIGHT_WORLD[1]);
        expect(tileKindLawRefusal(w, 2, 1, PILLAR, LIGHT_WORLD[1], base)).toBe(TILE_KIND_LAW.changesRules);
        expect(getTile(w, 2, 1)).toBe(TILE_WALL); // left lowered: the caller lifts it
    });

    it('(a) a pillar in a carved corridor cuts off floor: refused as cuts-off-floor', () => {
        const w = deserializeMazeWorld(sidecarOf(...CARVED).playable_payload);
        const base = tileKindLawBase(w, CARVED[1]);
        // (1,3) is the corridor cell the (0,2)/(1,2) dead end hangs off (GEN-D picture s8)
        expect(tileKindLawRefusal(w, 1, 3, PILLAR, CARVED[1], base)).toBe(TILE_KIND_LAW.cutsOffFloor);
    });

    it('a pillar at the tip of that dead end holds the law', () => {
        const w = deserializeMazeWorld(sidecarOf(...CARVED).playable_payload);
        const base = tileKindLawBase(w, CARVED[1]);
        expect(tileKindLawRefusal(w, 0, 2, PILLAR, CARVED[1], base)).toBeNull();
    });

    it('placeTileKinds keeps the compiled rules, the walk length and every reachable floor cell, and is deterministic', () => {
        const payload = sidecarOf(...LIGHT_WORLD).playable_payload;
        const plan = { seedKey: 7, kinds: [RUG, PILLAR], numbers: { percent: 5, cap: 8, min: 1 } };
        const run = () => {
            const w = deserializeMazeWorld(payload);
            const before = tileKindLawBase(w, LIGHT_WORLD[1]);
            const stats = placeTileKinds(w, plan, LIGHT_WORLD[1]);
            return { w, before, stats };
        };
        const { w, before, stats } = run();
        expect(stats.slots).toBe(8);
        expect(stats.placed).toBe(8);
        const after = tileKindLawBase(w, LIGHT_WORLD[1]);
        expect(after.rules).toEqual(before.rules);
        expect(after.walk).toEqual(before.walk);
        for (const c of before.reach) expect(after.reach.has(c) || w.tileKinds.has(c), c).toBe(true);
        expect([...run().w.tileKinds]).toEqual([...w.tileKinds]);
    });
});

describe('GEN-1 — the wrappers', () => {
    const fakeCore = (input) => ({ world: { biome: input.biome, marker: 1 }, biome: input.biome, seen: input.biome });

    it('any biome that is not a region biome passes through untouched (every committed world)', () => {
        const core = tileKindsRegionCore(fakeCore);
        for (const biome of [null, undefined, { id: 'classic' }, { id: 'rooms', paramsOverride: { x: 1 } }]) {
            const out = core({ biome, params: {} });
            expect(out.seen).toBe(biome);
            expect(TILE_KIND_PLAN_FIELD in out.world).toBe(false);
        }
    });

    it('scattered: the engine gets classic; the world and result carry the stamp and the plan (rng state read, not advanced)', async () => {
        let draws = 0;
        const rng = { getState: () => 42, next: () => { draws++; return 0; } };
        const out = tileKindsRegionCore(fakeCore)({ biome: { id: 'scattered' }, rng, params: { contentSet: await groundSet() }, region_id: 'r' });
        expect(out.seen).toEqual({ id: 'classic' });
        expect(out.world.biome).toEqual({ id: 'scattered' });
        expect(out.biome).toEqual({ id: 'scattered' });
        expect(out.world[TILE_KIND_PLAN_FIELD]).toEqual({ seedKey: 42, kinds: [RUG, PILLAR], numbers: { percent: 5, cap: 8, min: 1 } });
        expect(draws).toBe(0);
        const custom = tileKindsRegionCore(fakeCore)({
            biome: { id: 'scattered' }, rng, params: { contentSet: await groundSet(), tileKinds: { cap: 2 } },
        });
        expect(custom.world.biome).toEqual({ id: 'scattered', tileKinds: { cap: 2 } });
    });

    it('scattered with no kind to place is refused by name', async () => {
        const core = tileKindsRegionCore(fakeCore);
        expect(() => core({ biome: { id: 'scattered' }, params: {} }))
            .toThrow(/maze biome "scattered" places tile kinds, but the world names no pack under "what exists"/);
        const empty = { ...(await groundSet()), structureIds: ['ground'], structure: createStructure([]) };
        expect(() => core({ biome: { id: 'scattered' }, params: { contentSet: empty } }))
            .toThrow(/none of its "what exists" packs \(ground\) offers a kind with generate: true/);
    });

    it('the serializer: no plan ⇒ the inner serializer\'s own output; a plan ⇒ kinds placed, the world itself untouched', () => {
        const payload = sidecarOf(...LIGHT_WORLD).playable_payload;
        const w = deserializeMazeWorld(payload);
        const rules = { ...extractPathsAndObstacles(w, { regionId: LIGHT_WORLD[1] }), region_id: LIGHT_WORLD[1] };
        const inner = (world, r) => serializeMazeWorld(world, r);
        const plain = serializeMazeWorld(w, rules);
        expect(tileKindsSerializer(inner)(w, rules)).toEqual(plain);
        const tilesBefore = w.tiles.slice();
        w[TILE_KIND_PLAN_FIELD] = { seedKey: 3, kinds: [RUG, PILLAR], numbers: { percent: 5, cap: 8, min: 1 } };
        const out = tileKindsSerializer(inner)(w, rules);
        expect(out.tileKinds).toHaveLength(8);
        expect(TILE_KIND_PLAN_FIELD in out).toBe(false);
        expect([...w.tiles]).toEqual([...tilesBefore]);
        expect(w.tileKinds).toBeUndefined();
        // the payload loads back with its kinds, and is the plain one except them and the walls under the pillars
        const { tileKinds, ...rest } = out;
        const tiles = [...rest.tiles];
        for (const k of tileKinds) if (k.pass === 'blocked') tiles[k.y * out.width + k.x] = 0;
        expect({ ...rest, tiles }).toEqual(plain);
    });
});

describe('GEN-1 — outside the engine closure', () => {
    it('no GEN-1 file is in the Seedling derived-rule table\'s closure', () => {
        const closure = importClosure();
        for (const f of ['mazeRoom/mazeTileKindsGen.js', 'mazeRoom/mazeRegionBiomes.js', 'mazeRoom/mazeLocationCapacity.js',
            'mazeRoom/mazeRoomLibrary.js', 'procgenPipeline/procgenPipelineEngine.js', 'procgenPipeline/worldContent.js',
            'packStructure/packStructure.js']) {
            expect(closure.some((p) => p.endsWith(f)), f).toBe(false);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ CONTENT SETS GEN-3 — `needs` kinds: the qualify check, the equivalence (law b), law (d) from every arrival tile.
 * ══════════════════════════════════════════════════════════════════════ */

const POOL = { kind: 'wet:terrain/pool', pass: 'needs', needs: 'swim' };
const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
const META_SWIM_ROOM = ['frontend/presets/meta_trial/AP_1/AP_1_rules.json', 'region_2_3'];

/** The fixture `wet` (a pool: needs swim, generate: true) named under "what exists". */
async function wetSet() {
    const io = nodePackIo({ base: FIXTURES });
    const stack = await loadPackStack(['wet'], { ...io, only: ['concepts'] });
    const structure = createStructure(await loadPackStack(['wet'], { ...io, only: ['structure'] }));
    return { ids: ['wet'], concepts: createPackConcepts(stack), structure, structureIds: ['wet'] };
}

/**
 * THE POCKET ROOM (a fixture, 6×3): the entrance (0,1) on a corridor east; a Swim gate on (2,1) guards the pocket
 * (3..5,1), whose end holds a location (Victory at (5,1)) and no exit. Off the corridor's first cell, a free location
 * (Progressive Sword at (1,0)), and a linked exit on (0,0): an arrival tile.
 *
 *     y0:  X S # # # #        X exit (arrival)   S free location   G Swim gate   V the pocket's location
 *     y1:  E . G . . V        E entrance
 *     y2:  # # # # # #
 */
const POCKET = () => ({
    width: 6,
    height: 3,
    tiles: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    entrance: { x: 0, y: 1 },
    exits: [{ exit_id: 'back', x: 0, y: 0, side: 'N', exitName: 'back', targetRegion: 'elsewhere', targetExitId: 'pocket', isBackExit: true, isTeleporter: false }],
    obstacles: [{ x: 2, y: 1, id: 'water_gate_0' }],
    items: [{ x: 5, y: 1, id: 'Victory', locationName: 'pocket__V' }, { x: 1, y: 0, id: 'Progressive Sword', locationName: 'pocket__S' }],
    obstacleLib: { water_gate_0: { name: 'Water', id: 'water_gate_0', clear_set_type: 'rule', clear_rule: SWIM, feature: 'logic_gate', concept: 'water' } },
    itemLib: {
        'Progressive Swim': { name: 'Progressive Swim', id: 'Progressive Swim', classification: 'progression' },
        'Progressive Sword': { name: 'Progressive Sword', id: 'Progressive Sword', classification: 'progression' },
    },
});

describe('GEN-3 — which needs kinds qualify', () => {
    it('a generate: true needs kind from a "what exists" pack qualifies, carrying its concept', async () => {
        expect(generatedTileKinds(await wetSet())).toEqual([POOL]);
        // ground's pool says generate: false: still out (GEN-1's row)
        expect(generatedTileKinds(await groundSet())).toEqual([RUG, PILLAR]);
    });

    it('only where this world realises the item (needsRealisationRefusal on its item library)', async () => {
        const kinds = [RUG, POOL];
        expect(realisableTileKinds(kinds, deserializeMazeWorld(POCKET()))).toEqual(kinds);
        const dry = POCKET();
        delete dry.itemLib['Progressive Swim'];
        expect(realisableTileKinds(kinds, deserializeMazeWorld(dry))).toEqual([RUG]);
    });

    it('the region core records only the kinds its world realises', async () => {
        const set = await wetSet();
        const coreOf = (itemLib) => tileKindsRegionCore(() => ({ world: { itemLib }, biome: null }));
        const rng = { getState: () => 9 };
        expect(coreOf({ 'Progressive Swim': {} })({ biome: { id: 'scattered' }, rng, params: { contentSet: set } })
            .world[TILE_KIND_PLAN_FIELD].kinds).toEqual([POOL]);
        expect(coreOf({})({ biome: { id: 'scattered' }, rng, params: { contentSet: set } })
            .world[TILE_KIND_PLAN_FIELD].kinds).toEqual([]);
    });

    it('the passes set is data: each placed pass has its law row', () => {
        expect(Object.keys(TILE_KIND_PASS_LAWS)).toEqual(GENERATED_TILE_KIND_PASSES);
        expect(TILE_KIND_PASS_LAWS.needs).toMatchObject({ lowers: true, rules: RULES_COMPARE.equivalent, fromArrivals: true });
        expect(TILE_KIND_PASS_LAWS.blocked).toMatchObject({ lowers: true, rules: RULES_COMPARE.bytes, fromArrivals: false });
    });
});

describe('GEN-3 — the equivalence form', () => {
    const A = { rule: 'Has', args: { item_name: 'A' } };
    it('And(Swim, Swim) is Swim; nesting, order, duplicates and True_ in an And do not count', () => {
        expect(equivalentRule({ rule: 'And', children: [SWIM, SWIM] })).toEqual(SWIM);
        expect(equivalentRule({ rule: 'And', children: [A, { rule: 'And', children: [SWIM, A] }, { rule: 'True_' }] }))
            .toEqual(equivalentRule({ rule: 'And', children: [SWIM, A] }));
        expect(equivalentRule({ rule: 'Or', children: [{ rule: 'And', children: [SWIM, SWIM] }, A] }))
            .toEqual(equivalentRule({ rule: 'Or', children: [A, SWIM] }));
        expect(equivalentRule({ rule: 'And', children: [{ rule: 'True_' }] })).toEqual({ rule: 'True_' });
    });
    it('a different requirement stays different', () => {
        expect(equivalentRule({ rule: 'And', children: [SWIM, A] })).not.toEqual(equivalentRule(SWIM));
        expect(equivalentRule({ rule: 'Or', children: [SWIM, A] })).not.toEqual(equivalentRule({ rule: 'And', children: [SWIM, A] }));
    });
});

describe('GEN-3 — the law for a needs kind', () => {
    it('arrival tiles: the linked exits, the entrance left out; a zone room has none', () => {
        const w = deserializeMazeWorld(sidecarOf(...META_SWIM_ROOM).playable_payload);
        // exit `exit` (0,1) is linked; exit region_2_2 sits on the entrance (4,0)
        expect(arrivalTiles(w)).toEqual([{ x: 0, y: 1 }]);
        expect(arrivalTiles({ ...w, arrival: 'zone' })).toEqual([]);
        expect(arrivalTiles(deserializeMazeWorld(POCKET()))).toEqual([{ x: 0, y: 0 }]);
    });

    it('✅ the pool on the approach to the Swim gate\'s pocket is ACCEPTED: (b) equivalent, (d) from the back exit too', () => {
        const w = deserializeMazeWorld(POCKET());
        const base = tileKindLawBase(w, 'pocket');
        expect(tileKindLawRefusal(w, 4, 1, POOL, 'pocket', base)).toBeNull();
        // not vacuous: the pool's rule does reach the compile, as a second Has Swim
        const raw = JSON.stringify(compileRegion(extractPathsAndObstacles(w, { regionId: 'pocket' }), { obstacleLib: w.obstacleLib }));
        expect(raw).toContain(JSON.stringify({ rule: 'And', children: [SWIM, SWIM] }));
        expect(raw).not.toBe(base.rules[RULES_COMPARE.bytes]); // byte-equality alone would refuse it
    });

    it('⛔ a pool that adds Swim to a free location is REJECTED by (b)', () => {
        const w = deserializeMazeWorld(POCKET());
        const base = tileKindLawBase(w, 'pocket');
        // (1,1) is the only way to the Sword at (1,0)
        expect(tileKindLawRefusal(w, 1, 1, POOL, 'pocket', base)).toBe(TILE_KIND_LAW.changesRules);
    });

    it('⛔ s5-swim-pool (meta_trial region_2_3 (3,2)): (b) accepts it, (d) REJECTS it — it strands an arrival on exit `exit`', () => {
        const w = deserializeMazeWorld(sidecarOf(...META_SWIM_ROOM).playable_payload);
        const base = tileKindLawBase(w, META_SWIM_ROOM[1]);
        expect(tileKindLawRefusal(w, 3, 2, POOL, META_SWIM_ROOM[1], base)).toBe(TILE_KIND_LAW.strandsArrival);
        // with no arrival measured, (b) alone keeps it: from the entrance the pool sits behind the gate
        const w2 = deserializeMazeWorld(sidecarOf(...META_SWIM_ROOM).playable_payload);
        const bOnly = { ...tileKindLawBase(w2, META_SWIM_ROOM[1]), arrivals: { [RULES_COMPARE.equivalent]: [] } };
        expect(tileKindLawRefusal(w2, 3, 2, POOL, META_SWIM_ROOM[1], bOnly)).toBeNull();
    });

    it('placeTileKinds puts the pool on a legal cell; the serializer ships the pre-placement rules and the owned gate', () => {
        const w = deserializeMazeWorld(POCKET());
        const rules = { ...extractPathsAndObstacles(w, { regionId: 'pocket' }), region_id: 'pocket' };
        const plain = serializeMazeWorld(w, rules);
        w[TILE_KIND_PLAN_FIELD] = { seedKey: 1, kinds: [POOL], numbers: { percent: 25, cap: 4, min: 1 } };
        const obstaclesBefore = [...w.obstacles];
        const out = tileKindsSerializer((world, r) => serializeMazeWorld(world, r))(w, rules);
        expect(out.tileKinds.length).toBeGreaterThan(0);
        for (const k of out.tileKinds) {
            expect(k).toMatchObject({ kind: POOL.kind, pass: 'needs', needs: 'swim' });
            expect([[3, 1], [4, 1]]).toContainEqual([k.x, k.y]); // the pocket's approach, never (1,1)
            expect(out.obstacles).toContainEqual({ x: k.x, y: k.y, id: `tilekind_gate_${k.x}_${k.y}` });
        }
        expect([...w.obstacles]).toEqual(obstaclesBefore); // the world itself untouched
        // the payload loads back with its kinds (the ownership check), and its re-derived rules are equivalent
        const back = deserializeMazeWorldWithKinds(out);
        expect(back.tileKinds.size).toBe(out.tileKinds.length);
        const eq = (x) => JSON.stringify(equivalentRules(compileRegion(extractPathsAndObstacles(x, { regionId: 'pocket' }), { obstacleLib: x.obstacleLib })));
        expect(eq(back)).toBe(eq(deserializeMazeWorld(plain)));
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ CONTENT SETS GEN-4 — `one-way` kinds: the row, law (a) and (c) through entry gates, law (d) from every arrival.
 * ══════════════════════════════════════════════════════════════════════ */

const LEDGE_S = { kind: 'slope:terrain/ledge', pass: 'one-way', dirs: ['S'] };
const WALK_SAMPLE = ['frontend/presets/procgen_topdown/AP_7/AP_7_rules.json', 'frontend/presets/procgen_topdown/AP_4/AP_4_rules.json',
    'frontend/presets/procgen_maze/AP_1/AP_1_rules.json', 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'];
const AP4_REGION_3 = ['frontend/presets/procgen_topdown/AP_4/AP_4_rules.json', 'Region 3'];
const ledge = (dir) => ({ kind: 'slope:terrain/ledge', pass: 'one-way', dirs: [dir] });

/** The fixture `slope` (a ledge: one-way S, generate: true) named under "what exists". */
async function slopeSet() {
    const io = nodePackIo({ base: FIXTURES });
    const stack = await loadPackStack(['slope'], { ...io, only: ['concepts'] });
    const structure = createStructure(await loadPackStack(['slope'], { ...io, only: ['structure'] }));
    return { ids: ['slope'], concepts: createPackConcepts(stack), structure, structureIds: ['slope'] };
}

/**
 * THE RING (a fixture, 3×3): the entrance (0,0) and a linked exit (2,0), an arrival tile, joined directly along the top
 * row (2 steps) and the long way round the wall at (1,1) (6 steps).
 *
 *     y0:  E . X        E entrance    X exit (arrival)
 *     y1:  . # .
 *     y2:  . . .
 */
const RING = () => ({
    width: 3,
    height: 3,
    tiles: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    entrance: { x: 0, y: 0 },
    exits: [{ exit_id: 'east', x: 2, y: 0, side: 'E', exitName: 'east', targetRegion: 'elsewhere', targetExitId: 'ring', isBackExit: true, isTeleporter: false }],
    obstacles: [],
    items: [],
    obstacleLib: {},
    itemLib: {},
});

/**
 * THE LINE (a fixture, 5×2, its second row wall): a linked exit (0,0), an arrival tile; a location (2,0); the
 * entrance (4,0).
 *
 *     y0:  X . L . E
 *     y1:  # # # # #
 */
const LINE = () => ({
    width: 5,
    height: 2,
    tiles: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    entrance: { x: 4, y: 0 },
    exits: [{ exit_id: 'west', x: 0, y: 0, side: 'W', exitName: 'west', targetRegion: 'elsewhere', targetExitId: 'line', isBackExit: true, isTeleporter: false }],
    obstacles: [],
    items: [{ x: 2, y: 0, id: 'Progressive Sword', locationName: 'line__L' }],
    obstacleLib: {},
    itemLib: { 'Progressive Sword': { name: 'Progressive Sword', id: 'Progressive Sword', classification: 'progression' } },
});

/**
 * THE STUB (a fixture, 4×3): a corridor from the entrance (0,0) to a linked exit (3,0), and an empty dead-end stub
 * (1,1)–(1,2) off it.
 *
 *     y0:  E . . X
 *     y1:  # . # #
 *     y2:  # . # #
 */
const STUB = () => ({
    width: 4,
    height: 3,
    tiles: [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1],
    entrance: { x: 0, y: 0 },
    exits: [{ exit_id: 'east', x: 3, y: 0, side: 'E', exitName: 'east', targetRegion: 'elsewhere', targetExitId: 'stub', isBackExit: true, isTeleporter: false }],
    obstacles: [],
    items: [],
    obstacleLib: {},
    itemLib: {},
});

describe('GEN-4 — which one-way kinds qualify, and the row', () => {
    it('a generate: true one-way kind from a "what exists" pack qualifies, carrying its dirs', async () => {
        expect(generatedTileKinds(await slopeSet())).toEqual([LEDGE_S]);
        // ground's ledge says no generate: still out (GEN-1's row)
        expect(generatedTileKinds(await groundSet())).toEqual([RUG, PILLAR]);
    });

    it('the row is data: lowers, byte-equal rules (it adds no requirement), law (d) from every arrival', () => {
        expect(TILE_KIND_PASS_LAWS['one-way']).toEqual({ lowers: true, rules: RULES_COMPARE.bytes, fromArrivals: true });
    });
});

describe('GEN-4 — the law for a one-way kind', () => {
    it('the walk length (c): GEN-1\'s measure with no entry gate, through the gates with them', () => {
        const w = deserializeMazeWorld(RING());
        expect(tileKindWalkLength(w)).toBe(computeLongestShortestPath(w));
        expect(tileKindWalkLength(w)).toBe(2);
        lowerTileKind(w, 1, 0, ledge('E'));
        // X → E must now go round: 6. GEN-1's undirected measure cannot see the ledge.
        expect(tileKindWalkLength(w)).toBe(6);
        expect(computeLongestShortestPath(w)).toBe(2);
    });

    it('with no one-way gate, the gate-aware walk IS GEN-1\'s measure, on a sample of committed rooms', () => {
        // The directed branch is forced by an entry gate keyed off the grid (no move ever enters it, so it shuts
        // nothing): its length must be `computeLongestShortestPath`'s, with no one-way pair, room for room.
        let rooms = 0;
        for (const rel of WALK_SAMPLE) {
            const doc = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
            for (const regs of Object.values(doc.preset_sidecars)) {
                for (const [r, sc] of Object.entries(regs).slice(0, 12)) {
                    if (sc.substrate !== 'maze' || !sc.playable_payload || !sc.biome) continue;
                    const w = deserializeMazeWorld(sc.playable_payload);
                    const forced = { ...w, entryGates: new Map([['-1,-1,N', null]]) };
                    expect(tileKindWalk(forced), `${rel} ${r}`).toEqual({ length: computeLongestShortestPath(w), oneWayPairs: 0 });
                    rooms++;
                }
            }
        }
        expect(rooms).toBeGreaterThan(20);
    });

    it('✅ ACCEPTED: a ledge on the ring\'s long way round (entered moving E): every way in still reaches what it reached', () => {
        const w = deserializeMazeWorld(RING());
        const base = tileKindLawBase(w, 'ring', ['one-way']);
        expect(base.arrivals[RULES_COMPARE.bytes].map((a) => a.at)).toEqual([{ x: 2, y: 0 }]);
        expect(tileKindLawRefusal(w, 1, 2, ledge('E'), 'ring', base)).toBeNull();
        // not vacuous: the ledge owns its gates and shuts the move west onto it
        expect([...w.entryGates.keys()].sort()).toEqual(['1,2,N', '1,2,S', '1,2,W']);
        const at = { ...createState(w), player_pos: { x: 2, y: 2 } };
        expect(step(w, at, 'W')).toBeNull();
        expect(step(w, { ...at, player_pos: { x: 0, y: 2 } }, 'E')?.player_pos).toEqual({ x: 1, y: 2 });
    });

    it('⛔ REJECTED by (a): a ledge entered moving N only, at the mouth of an empty stub, cuts the stub off', () => {
        // nothing in the stub is a target, so (b), (c) and (d) see no change: only the flood through the gates does
        const w = deserializeMazeWorld(STUB());
        const base = tileKindLawBase(w, 'stub', ['one-way']);
        expect(tileKindLawRefusal(w, 1, 1, ledge('N'), 'stub', base)).toBe(TILE_KIND_LAW.cutsOffFloor);
        // entered moving S (the way in from the corridor) it holds the law
        const w2 = deserializeMazeWorld(STUB());
        expect(tileKindLawRefusal(w2, 1, 1, ledge('S'), 'stub', tileKindLawBase(w2, 'stub', ['one-way']))).toBeNull();
    });

    it('⛔ REJECTED by (a): a ledge no move can enter (the ring\'s (1,2), entered moving S, under the wall) — a wall that looks like a ledge', () => {
        const w = deserializeMazeWorld(RING());
        const base = tileKindLawBase(w, 'ring', ['one-way']);
        expect(tileKindLawRefusal(w, 1, 2, ledge('S'), 'ring', base)).toBe(TILE_KIND_LAW.cutsOffFloor);
    });

    it('⛔ REJECTED by (c): a ledge on the ring\'s short way makes the walk from the exit back 6, not 2', () => {
        const w = deserializeMazeWorld(RING());
        const base = tileKindLawBase(w, 'ring', ['one-way']);
        expect(tileKindLawRefusal(w, 1, 0, ledge('E'), 'ring', base)).toBe(TILE_KIND_LAW.movesWalkLength);
    });

    it('⛔ REJECTED by (c): a ledge that makes a pair one-way (the exit can no longer walk back) — the length alone skips it', () => {
        const w = deserializeMazeWorld(LINE());
        const base = tileKindLawBase(w, 'line', ['one-way']);
        expect(tileKindLawRefusal(w, 1, 0, ledge('W'), 'line', base)).toBe(TILE_KIND_LAW.movesWalkLength);
        // the longest walk is still 4 (E → X); only the one-way pair moved
        expect(tileKindWalk(w)).toEqual({ length: base.walk.length, oneWayPairs: 1 });
    });

    it('⛔ REJECTED by (d), on real data: procgen_topdown AP_4 Region 3, a ledge (S) on (6,2) strands the arrival on exit (7,2)', () => {
        // (7,2)'s only floor neighbour that is not an exit is (6,2), entered moving W: shut. The walk (c) passes
        // through the neighbouring exit tiles (7,1)/(7,3), so it holds; the extractor treats an exit as a dead end,
        // so from (7,2) every target goes False_. From the entrance (4,0) nothing changes.
        const w = deserializeMazeWorld(sidecarOf(...AP4_REGION_3).playable_payload);
        const base = tileKindLawBase(w, AP4_REGION_3[1], ['one-way']);
        expect(base.arrivals[RULES_COMPARE.bytes].map((x) => x.at)).toContainEqual({ x: 7, y: 2 });
        expect(tileKindLawRefusal(w, 6, 2, LEDGE_S, AP4_REGION_3[1], base)).toBe(TILE_KIND_LAW.strandsArrival);
        const w2 = deserializeMazeWorld(sidecarOf(...AP4_REGION_3).playable_payload);
        const bOnly = { ...tileKindLawBase(w2, AP4_REGION_3[1], ['one-way']), arrivals: { [RULES_COMPARE.bytes]: [] } };
        expect(tileKindLawRefusal(w2, 6, 2, LEDGE_S, AP4_REGION_3[1], bOnly)).toBeNull();
    });

    it('placeTileKinds + the serializer: ledges never on the short way; the payload owns its entry gates and ships the same rules', () => {
        const w = deserializeMazeWorld(RING());
        const rules = { ...extractPathsAndObstacles(w, { regionId: 'ring' }), region_id: 'ring' };
        const plain = serializeMazeWorld(w, rules);
        w[TILE_KIND_PLAN_FIELD] = { seedKey: 1, kinds: [ledge('E')], numbers: { percent: 100, cap: 8, min: 1 } };
        const out = tileKindsSerializer((world, r) => serializeMazeWorld(world, r))(w, rules);
        expect(out.tileKinds.length).toBeGreaterThan(0);
        for (const k of out.tileKinds) {
            expect(k).toMatchObject({ kind: 'slope:terrain/ledge', pass: 'one-way', dirs: ['E'] });
            expect([k.x, k.y]).not.toEqual([1, 0]);
            for (const dir of ['N', 'S', 'W']) expect(out.entry_gates).toContainEqual({ x: k.x, y: k.y, dir, gate: null });
        }
        expect(out.entry_gates).toHaveLength(3 * out.tileKinds.length);
        expect(w.entryGates).toBeUndefined(); // the world itself untouched
        expect(out.longestShortestPath).toBe(plain.longestShortestPath);
        // the payload loads back with its kinds (the ownership check), and re-derives the same rules from every way in
        const back = deserializeMazeWorldWithKinds(out);
        expect(back.tileKinds.size).toBe(out.tileKinds.length);
        const from = (x) => [null, ...arrivalTiles(x)].map((at) => JSON.stringify(compileRegion(
            extractPathsAndObstacles(at ? { ...x, entrance: at } : x, { regionId: 'ring' }), { obstacleLib: x.obstacleLib })));
        expect(from(back)).toEqual(from(deserializeMazeWorld(plain)));
        expect(tileKindWalkLength(back)).toBe(2);
    });
});
