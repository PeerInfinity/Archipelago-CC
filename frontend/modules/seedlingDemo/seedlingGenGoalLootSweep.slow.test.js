/**
 * ⛓⛓ goal-loot-lift — **THE SWEEP**: pipeline worlds with every generated room asked for a goal chest
 * (`seedlingGenGoal: 'chest'`) AND a loot chest (`seedlingGenElements: 'chestloot'`), across the growth modes
 * (sphere leaf, sphere host, shuffled spiral, grid) × seeds 1–6. The pair was refused by name until hammer's
 * `CHEST_LEG_DELTA` shipped ON (rule 4 of goal-chest-pipeline, lifted). For each world, the build either succeeds or
 * is refused BY NAME (only where the opted-out world is refused too), and a built world:
 *   · reports `goalContainers` EQUAL to the tally of its own sidecars (the goal chest only — a loot chest is no goal);
 *   · names only declared reasons;
 *   · assembles every goal chest AND every loot chest as a kept chest (no apitem on its cell);
 *   · CERTIFIES every room holding both chests (`certifyGenRoom`, the editor's Save re-check).
 * The per-mode totals are printed (`GOAL-LOOT SWEEP`: rooms, goal chests, loot chests, BOTH, both certified), for
 * the packet.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import {
    SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_LEAF_STATE, SEEDLING_GENERATED_ROOM_STATE,
} from '../procgenPipeline/presetDefs.js';
import { GOAL_CONTAINER_NOT_PLACED_REASONS, goalContainerReport } from '../procgenCore/goalContainer.js';
import { GOAL_CHEST_REFUSALS } from './procgenSeedling.js';
import { CHEST_GOAL_KIND, goalContainerNoteOf } from './seedlingGenRoomPayload.js';
import { CHEST_LOOT_KIND, certifyGenRoom } from './seedlingGenRoom.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { SEEDLING_GEN_GOAL_KEY } from '../flashPanel/flashSeedlingGenLibrary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const GEN = 'flash_seedling_gen';
const SEEDS = [1, 2, 3, 4, 5, 6];
const REASONS = new Set([...GOAL_CHEST_REFUSALS, ...Object.values(GOAL_CONTAINER_NOT_PLACED_REASONS)]);

/** `state` for a mode and seed; `ask` adds the opt-in bag keys. */
const WORLDS = {
    'sphere-leaf': (seed, ask) => ({ ...SEEDLING_GENERATED_LEAF_STATE, params: { ...SEEDLING_GENERATED_LEAF_STATE.params, seed, ...ask } }),
    'sphere-host': (seed, ask) => ({ ...SEEDLING_GENERATED_HOST_STATE, params: { ...SEEDLING_GENERATED_HOST_STATE.params, seed, ...ask } }),
    spiral: (seed, ask) => ({ ...SEEDLING_GENERATED_ROOM_STATE, substrateQuotas: { maze: 1, [GEN]: 4 },
        params: { ...SEEDLING_GENERATED_ROOM_STATE.params, seed, ...ask } }),
    grid: (seed, ask) => ({ mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, ...ask },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 2 }, substrateMode: 'mix' }),
};
const ASK = { [SEEDLING_GEN_GOAL_KEY]: 'chest', seedlingGenElements: 'chestloot' };
const build = async (mode, seed, ask) => (await runPresetHeadless(buildRunFromState(structuredClone(WORLDS[mode](seed, ask))))).rulesJson;

const TOTALS = {};
afterAll(() => {
    // eslint-disable-next-line no-console
    console.log(`GOAL-LOOT SWEEP ${JSON.stringify(TOTALS)}`);
});

describe('the goal + loot sweep: report == tally, both chests kept, every two-chest room certified', () => {
    for (const mode of Object.keys(WORLDS)) {
        it.each(SEEDS)(`${mode} s%s`, async (seed) => {
            const t = (TOTALS[mode] ??= { worlds: 0, refusedWorlds: {}, rooms: 0, goalChests: 0, lootChests: 0, both: 0,
                bothCertified: 0, notPlaced: {} });
            let world;
            try {
                world = await build(mode, seed, ASK);
            } catch (e) {
                /** a world refused by name is allowed only when the opted-out world is refused too (not ours) */
                let plain = null;
                try { plain = await build(mode, seed, {}); } catch { /* the same refusal */ }
                expect(plain, `${mode} s${seed}: opted in THREW but opted out built — ${e.message}`).toBe(null);
                const key = String(e.message).split(':')[0].slice(0, 60);
                t.refusedWorlds[key] = (t.refusedWorlds[key] ?? 0) + 1;
                return;
            }
            t.worlds += 1;
            const gens = Object.entries(world.preset_sidecars['1']).filter(([, sc]) => sc.substrate === GEN);
            const notes = gens.map(([, sc]) => goalContainerNoteOf(sc.playable_payload));
            const report = world.procgen_metadata['1'].goalContainers;
            expect(report).toEqual(goalContainerReport(notes));
            for (const r of Object.keys(report.notPlaced)) expect(REASONS.has(r), r).toBe(true);

            const a = assembleGeneratedSeedlingSet(world, { selfPlayer: 1 });
            expect((a.report.goalChests ?? []).length).toBe(report.placed);
            const records = mountedRecordsOf(a.set);
            for (const c of [...(a.report.goalChests ?? []), ...(a.report.lootChests ?? [])]) {
                const at = records.get(c.room).entities.filter((e) => e.x === c.cell.tx * 16 && e.y === c.cell.ty * 16);
                expect(at.map((e) => e.type)).toEqual(['chest']);
            }
            let loot = 0;
            for (const [region, sc] of gens) {
                const p = sc.playable_payload;
                const hasGoal = p.locations[0]?.kind === CHEST_GOAL_KIND;
                const hasLoot = p.locations.some((l) => l.kind === CHEST_LOOT_KIND);
                t.rooms += 1;
                loot += hasLoot ? 1 : 0;
                if (hasGoal && hasLoot) {
                    t.both += 1;
                    const cert = certifyGenRoom(p, region);
                    expect(cert, `${mode} s${seed} ${region}`).toEqual({ certified: true, failures: [] });
                    t.bothCertified += 1;
                }
            }
            expect((a.report.lootChests ?? []).length).toBe(loot);
            t.goalChests += report.placed;
            t.lootChests += loot;
            for (const [r, n] of Object.entries(report.notPlaced)) t.notPlaced[r] = (t.notPlaced[r] ?? 0) + n;
        }, 300_000);
    }
});
