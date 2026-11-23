/**
 * ⛓⛓ CONTENT SETS GEN-1 — **THE "RANDOMLY PLACED TILES" BIOME, WORLD BY WORLD: THE LOGIC DOES NOT MOVE.**
 *
 * Every world is built headless through the panel's own assembly (`prepareRunFromState` → `runPresetHeadless`), with
 * the test-only fixture pack `ground` named under "what exists" (its rug and pillar say `generate: true`). Each
 * driver's shipped maze preset is built beside its control — the same state with no maze biome — and must:
 *   · compile the control's logic: `rules.json` minus `preset_sidecars` and the recorded settings is the control's,
 *     string for string (no location, rule, sphere or loop cost moves);
 *   · differ in each maze room only by the placed kinds: the payload is the control's except `tileKinds` and the walls
 *     under the blocked kinds, and the sidecar `biome` says `scattered`;
 *   · keep every thing where it was (the meta theme's characters);
 *   · place some of each kind across the world (so the equalities are not vacuous).
 * The per-room mix (⚖ Q8): a classic + scattered mix keeps the control's logic, picks each room by hash, and a
 * one-element list is the single id byte for byte. A rebuilt world picks every room as before.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { META_TRIAL_STATE, SHIPPED_PRESETS } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { rebuildRegionParams } from './procgenPipelineEngine.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY, normalizeMazeBiomeSetting, pickMazeBiome, regionBiomeOf } from '../mazeRoom/mazeRegionBiomes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const FIXTURE = 'ground';
const FIXTURE_DIR = join(ROOT, 'frontend/modules/packStructure/fixtures/packs', FIXTURE);
/** The committed packs, plus the test-only fixture `ground` served as if it sat under `frontend/packs/`. */
function io() {
    const disk = nodePackIo();
    return {
        base: disk.base,
        readJson: async (url) => {
            const at = String(url).split(`/packs/${FIXTURE}/`);
            if (at.length === 2) return JSON.parse(readFileSync(join(FIXTURE_DIR, at[1]), 'utf8'));
            return disk.readJson(url);
        },
    };
}

const TOPDOWN_SOURCE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const TOPDOWN_LOG = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl';
const ctxOf = (state) => (state.mode !== 'topDown' ? {} : {
    topDownSource: JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE), 'utf8')),
    sphereLog: readFileSync(join(ROOT, TOPDOWN_LOG), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)),
});
const stateOf = (id) => structuredClone(SHIPPED_PRESETS.find((p) => p.id === id).state);
const withParams = (state, extra) => ({ ...structuredClone(state), params: { ...state.params, exists: [FIXTURE], ...extra } });
const build = async (state) => runPresetHeadless(await prepareRunFromState(structuredClone(state), { ...ctxOf(state), io: io() }));

const SETTING_KEYS = [MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY];
/** The document minus the sidecars and the recorded maze settings: the logic. */
const logicOf = (rj) => {
    const out = structuredClone(rj);
    delete out.preset_sidecars;
    for (const m of Object.values(out.procgen_metadata ?? {})) for (const k of SETTING_KEYS) delete m[k];
    return JSON.stringify(out);
};
const mazeRooms = (rj) => Object.entries(rj.preset_sidecars ?? {})
    .flatMap(([p, regs]) => Object.entries(regs).map(([r, s]) => [`${p}/${r}`, s]))
    .filter(([, s]) => s.substrate === 'maze' && s.playable_payload && s.biome);
/** A room's payload with its placed kinds taken back out (the walls under the blocked ones floor again). */
const withoutKinds = (payload) => {
    const { tileKinds = [], ...rest } = structuredClone(payload);
    for (const k of tileKinds) if (k.pass === 'blocked') rest.tiles[k.y * rest.width + k.x] = 0;
    return rest;
};

/**
 * The four drivers' shipped maze presets, and whether a pillar lands in one (MEASURED: the grid and spiral demos'
 * rooms are small carved 8×6 corridors, 1–13 free cells, where a wall almost always changes the logic, so the law
 * keeps none; their rooms get rugs).
 */
const DRIVERS = [
    ['sphere growth', 'shipped:maze-sphere-demo', true],
    ['grid growth', 'shipped:grid-growth-demo', false],
    ['shuffled spiral', 'shipped:content-spiral-mix', false],
    ['top-down', 'shipped:topdown-maze-ta-demo', true],
];
const TIMEOUT = 240_000;

describe.each(DRIVERS)('GEN-1 — %s: the scattered world beside its control', (driver, presetId, pillars) => {
    it('the logic is the control\'s; each room differs only by its kinds; kinds are placed', async () => {
        const ctrl = await build(withParams(stateOf(presetId), {}));
        const world = await build(withParams(stateOf(presetId), { [MAZE_BIOME_KEY]: 'scattered' }));
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
        expect(world.rulesJson.procgen_metadata['1'][MAZE_BIOME_KEY]).toBe('scattered');
        expect(ctrl.rulesJson.procgen_metadata['1'][MAZE_BIOME_KEY]).toBeUndefined();
        const ctrlRooms = new Map(mazeRooms(ctrl.rulesJson));
        const rooms = mazeRooms(world.rulesJson);
        expect(rooms.map(([r]) => r)).toEqual([...ctrlRooms.keys()]);
        const placed = { walkable: 0, blocked: 0 };
        for (const [r, s] of rooms) {
            const c = ctrlRooms.get(r);
            expect(s.biome, r).toEqual({ id: 'scattered' });
            expect(c.biome, r).toEqual({ id: 'classic' });
            expect(withoutKinds(s.playable_payload), r).toEqual(c.playable_payload);
            for (const k of s.playable_payload.tileKinds ?? []) placed[k.pass ?? 'walkable']++;
        }
        console.log(`${driver}: ${rooms.length} maze rooms; placed ${JSON.stringify(placed)}`);
        expect(placed.walkable).toBeGreaterThan(0);
        if (pillars) expect(placed.blocked).toBeGreaterThan(0);
    }, TIMEOUT);
});

describe('GEN-1 — things do not move (the meta theme\'s characters)', () => {
    it('every maze room\'s things are the control\'s, and kinds avoid their cells', async () => {
        const ctrl = await build(withParams(META_TRIAL_STATE, {}));
        const world = await build(withParams(META_TRIAL_STATE, { [MAZE_BIOME_KEY]: 'scattered' }));
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
        const ctrlRooms = new Map(mazeRooms(ctrl.rulesJson));
        let things = 0;
        for (const [r, s] of mazeRooms(world.rulesJson)) {
            expect(s.playable_payload.things, r).toEqual(ctrlRooms.get(r).playable_payload.things);
            const thingCells = new Set((s.playable_payload.things ?? []).map((t) => `${t.x},${t.y}`));
            things += thingCells.size;
            for (const k of s.playable_payload.tileKinds ?? []) expect(thingCells.has(`${k.x},${k.y}`), r).toBe(false);
        }
        expect(things).toBeGreaterThan(0);
    }, TIMEOUT);
});

describe('GEN-1 — the per-room mix (⚖ Q8)', () => {
    const SPHERE = 'shipped:maze-sphere-demo';
    const MIX = [{ id: 'classic', weight: 1 }, { id: 'scattered', weight: 1 }];

    it('classic + scattered keeps the control\'s logic; each room is the hash pick, stamped; a rebuild picks the same', async () => {
        const state = stateOf(SPHERE);
        const ctrl = await build(withParams(state, {}));
        const world = await build(withParams(state, { [MAZE_BIOME_KEY]: MIX }));
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
        const meta = world.rulesJson.procgen_metadata['1'];
        expect(meta[MAZE_BIOME_KEY]).toEqual(MIX);
        expect(meta[MAZE_BIOME_SEED_KEY]).toBe(state.params.seed);
        const setting = normalizeMazeBiomeSetting(MIX);
        const ids = new Set();
        const rebuilt = rebuildRegionParams(meta, undefined);
        for (const [key, s] of mazeRooms(world.rulesJson)) {
            const region = key.split('/')[1];
            const want = pickMazeBiome(setting, state.params.seed, region)?.id ?? 'classic';
            expect(s.biome.id, region).toBe(want);
            // a rebuilt world (its regionParams read back off the record) picks the same room the same way
            expect(regionBiomeOf({ params: rebuilt, regionId: region })?.id ?? 'classic', region).toBe(want);
            ids.add(want);
        }
        expect([...ids].sort()).toEqual(['classic', 'scattered']);
    }, TIMEOUT);

    it('a one-element list IS the single id, byte for byte', async () => {
        const state = stateOf(SPHERE);
        const single = await build(withParams(state, { [MAZE_BIOME_KEY]: 'scattered' }));
        const list = await build(withParams(state, { [MAZE_BIOME_KEY]: [{ id: 'scattered', weight: 3 }] }));
        expect(JSON.stringify(list.rulesJson)).toBe(JSON.stringify(single.rulesJson));
    }, TIMEOUT);

    it('an unknown id in the list is refused by name, before anything is built', async () => {
        await expect(build(withParams(stateOf(SPHERE), { [MAZE_BIOME_KEY]: [{ id: 'classic' }, { id: 'lava' }] })))
            .rejects.toThrow(/mazeBiome\[1\] names "lava", which is not a maze biome/);
    }, TIMEOUT);
});
