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
    GENERATED_TILE_KIND_PASSES, TILE_KIND_LAW, TILE_KIND_PLAN_FIELD, generatedTileKinds, placeTileKinds,
    tileKindLawBase, tileKindLawRefusal, tileKindSlotCount, tileKindsRegionCore, tileKindsSerializer,
} from './mazeTileKindsGen.js';
import { deserializeMazeWorld, extractPathsAndObstacles, getTile, TILE_WALL } from './mazeRoomEngine.js';
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
        expect(GENERATED_TILE_KIND_PASSES).toEqual(['walkable', 'blocked']);
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
        expect(after.rules).toBe(before.rules);
        expect(after.lsp).toBe(before.lsp);
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
