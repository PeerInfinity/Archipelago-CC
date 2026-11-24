/**
 * ⛓⛓ CONTENT SETS GEN-3 — **A `needs` KIND, PLACED BY THE GENERATOR, WORLD BY WORLD: THE LOGIC DOES NOT MOVE.**
 *
 * The world is `CONCEPT_TRIAL_STATE` (two maze rooms that hold Progressive Swim in their item library, one of them
 * behind the painted water gate), built headless through the panel's own assembly (`prepareRunFromState` →
 * `runPresetHeadless`) with the test-only fixture pack `wet` named under "what exists" (its pool: needs swim,
 * `generate: true`) and the maze biome `scattered`. Beside its control (the same state, no biome), it must:
 *   · compile the control's logic: `rules.json` minus `preset_sidecars` and the recorded settings is the control's,
 *     string for string (no location, rule, sphere or loop cost; the sphere log and the spoiler are written from it);
 *   · differ in each maze room only by the placed pools: the payload is the control's except `tileKinds`, the owned
 *     gates `tilekind_gate_<x>_<y>` in `obstacles` and `obstacleLib`;
 *   · load back with its kinds (the ownership check), and re-derive, from the entrance and from every arrival tile,
 *     rules EQUIVALENT to the control's (`equivalentRules`);
 *   · place at least one pool (so the equalities are not vacuous);
 *   · PLAY each pool through PASS-2's readers (`step`, `whyBlocked`, the autopather's `findPath`): shut without
 *     Progressive Swim, open with it; and DRAW it in both views (the panel's `drawWorld` + `drawMazeTileKinds`, and the
 *     composite cell), as the kind's marker base (no pack art loaded: the base painter).
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
import { arrivalTiles, equivalentRules } from '../mazeRoom/mazeTileKindsGen.js';
import { deserializeMazeWorldWithKinds, tileKindGateId } from '../mazeRoom/mazeTileKinds.js';
import { deserializeMazeWorld, extractPathsAndObstacles } from '../mazeRoom/mazeRoomEngine.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { TILE_FLOOR, createState, getTile, step, whyBlocked } from '../mazeRoom/mazeRoomEngine.js';
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

const FIXTURE = 'wet';
const FIXTURE_DIR = join(ROOT, 'frontend/modules/packStructure/fixtures/packs', FIXTURE);
/** The committed packs, plus the test-only fixture `wet` served as if it sat under `frontend/packs/`. */
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
/** A room's payload with its placed pools taken back out (their owned gates with them). */
const withoutKinds = (payload) => {
    const { tileKinds = [], ...rest } = structuredClone(payload);
    const owned = new Set(tileKinds.map((k) => tileKindGateId(k.x, k.y)));
    rest.obstacles = (rest.obstacles ?? []).filter((o) => !owned.has(o.id));
    if (rest.obstacleLib) for (const id of owned) delete rest.obstacleLib[id];
    return rest;
};
/** The room's rules in equivalence form, from its entrance and from each arrival tile. */
const equivalentFromEveryWayIn = (w, regionId) => [null, ...arrivalTiles(w)].map((at) => JSON.stringify(equivalentRules(
    compileRegion(extractPathsAndObstacles(at ? { ...w, entrance: at } : w, { regionId }), { obstacleLib: w.obstacleLib }))));

const SWIM = 'Progressive Swim';
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

/** A placed pool plays shut without the item and open with it, and draws in both views. */
function playsAndDraws(payload, k, r) {
    const w = substrateRegistryEntry.deserializeWorld(structuredClone(payload));
    const bare = cloneWorld(w);
    bare.items = new Map();
    const dir = Object.keys(DELTA).find((d) => {
        const [x, y] = [k.x - DELTA[d][0], k.y - DELTA[d][1]];
        return x >= 0 && y >= 0 && x < w.width && y < w.height && getTile(w, x, y) === TILE_FLOOR && !(bare.obstacles?.has(`${x},${y}`));
    });
    expect(dir, `${r}: a floor neighbour of the pool at (${k.x},${k.y})`).toBeTruthy();
    const from = { x: k.x - DELTA[dir][0], y: k.y - DELTA[dir][1] };
    const at = (inv) => ({ ...createState(bare), player_pos: { ...from }, inventory: new Set(inv) });
    expect(step(bare, at([]), dir), r).toBeNull();
    expect(step(bare, at([SWIM]), dir)?.player_pos, r).toEqual({ x: k.x, y: k.y });
    expect(whyBlocked(bare, at([]), dir), r).toMatch(new RegExp(`${tileKindGateId(k.x, k.y)}|${SWIM}`));
    expect(findPath(bare, from, { kind: 'tile', x: k.x, y: k.y }, { inventory: new Set() }), r).toBeNull();
    expect(findPath(bare, from, { kind: 'tile', x: k.x, y: k.y }, { inventory: new Set([SWIM]) }), r).not.toBeNull();
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
const DECLARED = Object.freeze({ 'wet:terrain/pool': Object.freeze({ base: 'marker', pass: 'needs', needs: 'swim', pack: 'wet' }) });

describe('GEN-3 — the scattered concept trial with a needs kind, beside its control', () => {
    it('the logic is the control\'s; each room differs only by its pools; the pools load back and re-derive equivalently', async () => {
        const ctrl = await build(withParams(CONCEPT_TRIAL_STATE, {}));
        const world = await build(withParams(CONCEPT_TRIAL_STATE, { [MAZE_BIOME_KEY]: 'scattered' }));
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(logicOf(world.rulesJson)).toBe(logicOf(ctrl.rulesJson));
        expect(world.stats).toEqual(ctrl.stats);
        const ctrlRooms = new Map(mazeRooms(ctrl.rulesJson));
        const rooms = mazeRooms(world.rulesJson);
        expect(rooms.map(([r]) => r)).toEqual([...ctrlRooms.keys()]);
        let pools = 0;
        for (const [r, s] of rooms) {
            const c = ctrlRooms.get(r);
            expect(s.biome, r).toEqual({ id: 'scattered' });
            expect(withoutKinds(s.playable_payload), r).toEqual(c.playable_payload);
            const kinds = s.playable_payload.tileKinds ?? [];
            for (const k of kinds) {
                expect(k, r).toMatchObject({ kind: 'wet:terrain/pool', pass: 'needs', needs: 'swim' });
                expect(s.playable_payload.obstacleLib[tileKindGateId(k.x, k.y)].clear_rule, r)
                    .toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
            }
            for (const k of kinds) playsAndDraws(s.playable_payload, k, r);
            pools += kinds.length;
            console.log(r, JSON.stringify(kinds.map((k) => [k.x, k.y])));
            const regionId = r.split('/')[1];
            const back = deserializeMazeWorldWithKinds(s.playable_payload);
            expect(back.tileKinds?.size ?? 0, r).toBe(kinds.length);
            expect(equivalentFromEveryWayIn(back, regionId), r)
                .toEqual(equivalentFromEveryWayIn(deserializeMazeWorld(c.playable_payload), regionId));
        }
        console.log(`concept trial: ${rooms.length} maze rooms; placed ${pools} pool(s)`);
        expect(pools).toBeGreaterThan(0);
    }, 240_000);
});
