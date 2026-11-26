/**
 * ⛓⛓ CONTENT SETS GEN-4 — **A `one-way` KIND, PLACED BY THE GENERATOR, WORLD BY WORLD: THE LOGIC DOES NOT MOVE.**
 *
 * The world is `CONCEPT_TRIAL_STATE` (GEN-3's world), built headless through the panel's own assembly
 * (`prepareRunFromState` → `runPresetHeadless`) with the test-only fixture pack `slope` named under "what exists" (its
 * ledge: one-way, entered moving S only, `generate: true`) and the maze biome `scattered`. Beside its control (the same
 * state, no biome), it must:
 *   · compile the control's logic: `rules.json` minus `preset_sidecars` and the recorded settings is the control's,
 *     string for string (no location, rule, sphere or loop cost; the sphere log and the spoiler are written from it);
 *   · differ in each maze room only by the placed ledges: the payload is the control's except `tileKinds` and the
 *     owned `entry_gates` (a `gate: null` entry for every direction but S); `longestShortestPath` is the control's;
 *   · load back with its kinds (the ownership check), and re-derive, from the entrance and from every arrival tile,
 *     rules BYTE-EQUAL to the control's; its gate-aware walk (law c) is the control's;
 *   · place at least one ledge (so the equalities are not vacuous);
 *   · PLAY each ledge through PASS-3's readers (`step`, the autopather's `findPath`): entered moving S, never another
 *     way; and DRAW it in both views (the panel's `drawWorld` + `drawMazeTileKinds`, and the composite cell), as the
 *     kind's marker base (no pack art loaded: the base painter).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { CONCEPT_TRIAL_STATE } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY } from '../mazeRoom/mazeRegionBiomes.js';
import { arrivalTiles, tileKindWalk } from '../mazeRoom/mazeTileKindsGen.js';
import { deserializeMazeWorldWithKinds } from '../mazeRoom/mazeTileKinds.js';
import { deserializeMazeWorld, extractPathsAndObstacles } from '../mazeRoom/mazeRoomEngine.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { TILE_FLOOR, createState, getTile, step } from '../mazeRoom/mazeRoomEngine.js';
import { findPath } from '../mazeRoom/mazeAutopather.js';
import { substrateRegistryEntry } from '../mazeRoom/mazeRoomLibrary.js';
import { cloneWorld } from '../mazeRoom/procgenMaze.js';
import { recordingContext } from '../mazeRoom/drawOpRecorder.js';
import { drawWorld, plainView } from '../mazeRoom/mazeRoomRender.js';
import { drawMazeTileKinds } from '../mazeRoom/mazeTileKindOverlay.js';
import { drawMazeCompositeRegion } from '../mazeRoom/mazeCompositeMap.js';
import { paintMazeTileBase } from '../mazeRoom/mazeTileArt.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const FIXTURE = 'slope';
const FIXTURE_DIR = join(ROOT, 'frontend/modules/packStructure/fixtures/packs', FIXTURE);
/** The committed packs, plus the test-only fixture `slope` served as if it sat under `frontend/packs/`. */
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

const withParams = (state, extra) => ({ ...structuredClone(state), params: { ...state.params, exists: [FIXTURE], ...extra } });
const build = async (state) => runPresetHeadless(await prepareRunFromState(structuredClone(state), { io: io() }));

const SETTING_KEYS = [MAZE_BIOME_KEY, MAZE_BIOME_SEED_KEY, TILE_KINDS_KEY];
const logicOf = (rj) => {
    const out = structuredClone(rj);
    delete out.preset_sidecars;
    for (const m of Object.values(out.procgen_metadata ?? {})) for (const k of SETTING_KEYS) delete m[k];
    return JSON.stringify(out);
};
const mazeRooms = (rj) => Object.entries(rj.preset_sidecars ?? {})
    .flatMap(([p, regs]) => Object.entries(regs).map(([r, s]) => [`${p}/${r}`, s]))
    .filter(([, s]) => s.substrate === 'maze' && s.playable_payload && s.biome);
/** A room's payload with its placed ledges taken back out (their owned entry gates with them). */
const withoutKinds = (payload) => {
    const { tileKinds = [], entry_gates: gates = [], ...rest } = structuredClone(payload);
    const owned = new Set(tileKinds.map((k) => `${k.x},${k.y}`));
    const kept = gates.filter((g) => !owned.has(`${g.x},${g.y}`));
    return kept.length ? { ...rest, entry_gates: kept } : rest;
};
/** The room's rules, byte for byte, from its entrance and from each arrival tile. */
const rulesFromEveryWayIn = (w, regionId) => [null, ...arrivalTiles(w)].map((at) => JSON.stringify(
    compileRegion(extractPathsAndObstacles(at ? { ...w, entrance: at } : w, { regionId }), { obstacleLib: w.obstacleLib })));

const PX = 16;
const DELTA = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });
const ops = (fn) => {
    const ctx = recordingContext();
    fn(ctx);
    return ctx.__log;
};
const containsRun = (log, run) => {
    for (let i = 0; i + run.length <= log.length; i++) if (run.every((op, j) => log[i + j] === op)) return true;
    return false;
};

/** A placed ledge plays one way only (entered moving one of its `dirs`, never another way), and draws in both views. */
function playsAndDraws(payload, k, r) {
    const w = substrateRegistryEntry.deserializeWorld(structuredClone(payload));
    const bare = cloneWorld(w);
    bare.items = new Map();
    let shut = 0;
    let opened = 0;
    for (const dir of Object.keys(DELTA)) {
        const from = { x: k.x - DELTA[dir][0], y: k.y - DELTA[dir][1] };
        if (from.x < 0 || from.y < 0 || from.x >= w.width || from.y >= w.height || getTile(w, from.x, from.y) !== TILE_FLOOR) continue;
        if (bare.obstacles?.has(`${from.x},${from.y}`)) continue;
        const at = { ...createState(bare), player_pos: { ...from }, inventory: new Set() };
        const open = k.dirs.includes(dir);
        if (open) {
            expect(step(bare, at, dir)?.player_pos, `${r} ${dir}`).toEqual({ x: k.x, y: k.y });
            opened++;
        }
        else {
            expect(step(bare, at, dir), `${r} ${dir}`).toBeNull();
            // the autopather's one-step route the shut way is refused (a route round, if any, is longer than 1)
            expect(findPath(bare, from, { kind: 'tile', x: k.x, y: k.y }, { inventory: new Set() })?.length ?? Infinity, `${r} ${dir}`)
                .not.toBe(1);
            shut++;
        }
    }
    expect(shut, `${r}: some way onto the ledge at (${k.x},${k.y}) is shut`).toBeGreaterThan(0);
    expect(opened, `${r}: some way onto the ledge at (${k.x},${k.y}) is open`).toBeGreaterThan(0);
    const single = ops((ctx) => {
        drawWorld(ctx, w, plainView({ tilePx: PX, tileArt: null }));
        expect(drawMazeTileKinds(ctx, w, {
            tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt: null, tileKinds: DECLARED,
        }).filter((d) => d.x === k.x && d.y === k.y), r).toEqual([{ x: k.x, y: k.y, kind: k.kind, as: 'base' }]);
    });
    expect(containsRun(single, ops((ctx) => paintMazeTileBase(ctx, 'marker', k.x * PX, k.y * PX, PX))), r).toBe(true);
    const [offX, offY] = [48, 32];
    const composite = ops((ctx) => drawMazeCompositeRegion(ctx, { playable_payload: w }, { offX, offY, tilePx: PX, tileArt: null, tileKinds: DECLARED }));
    expect(containsRun(composite, ops((ctx) => paintMazeTileBase(ctx, 'marker', offX + k.x * PX, offY + k.y * PX, PX))), r).toBe(true);
}
/** The fixture's declaration, as `mazeTileArt.tileKindKeys` gives it. */
const DECLARED = Object.freeze({ 'slope:terrain/ledge': Object.freeze({ base: 'marker', pass: 'one-way', dirs: ['S'], pack: 'slope' }) });

describe('GEN-4 — the scattered concept trial with a one-way kind, beside its control', () => {
    it('the logic is the control\'s; each room differs only by its ledges; they load back and re-derive byte-equal rules', async () => {
        const ctrl = await build(withParams(CONCEPT_TRIAL_STATE, {}));
        const world = await build(withParams(CONCEPT_TRIAL_STATE, { [MAZE_BIOME_KEY]: 'scattered' }));
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
        expect(world.stats).toEqual(ctrl.stats);
        const ctrlRooms = new Map(mazeRooms(ctrl.rulesJson));
        const rooms = mazeRooms(world.rulesJson);
        expect(rooms.map(([r]) => r)).toEqual([...ctrlRooms.keys()]);
        let ledges = 0;
        for (const [r, s] of rooms) {
            const c = ctrlRooms.get(r);
            expect(s.biome, r).toEqual({ id: 'scattered' });
            expect(withoutKinds(s.playable_payload), r).toEqual(c.playable_payload);
            const kinds = s.playable_payload.tileKinds ?? [];
            for (const k of kinds) {
                expect(k, r).toMatchObject({ kind: 'slope:terrain/ledge', pass: 'one-way', dirs: ['S'] });
                const owned = (s.playable_payload.entry_gates ?? []).filter((g) => g.x === k.x && g.y === k.y);
                expect(owned.map((g) => [g.dir, g.gate]).sort(), r).toEqual([['E', null], ['N', null], ['W', null]]);
            }
            for (const k of kinds) playsAndDraws(s.playable_payload, k, r);
            ledges += kinds.length;
            console.log(r, JSON.stringify(kinds.map((k) => [k.x, k.y])));
            const regionId = r.split('/')[1];
            const back = deserializeMazeWorldWithKinds(s.playable_payload);
            const plain = deserializeMazeWorld(c.playable_payload);
            expect(back.tileKinds?.size ?? 0, r).toBe(kinds.length);
            expect(rulesFromEveryWayIn(back, regionId), r).toEqual(rulesFromEveryWayIn(plain, regionId));
            expect(tileKindWalk(back), r).toEqual(tileKindWalk(plain));
        }
        console.log(`concept trial: ${rooms.length} maze rooms; placed ${ledges} ledge(s)`);
        expect(ledges).toBeGreaterThan(0);
    }, 240_000);
});
