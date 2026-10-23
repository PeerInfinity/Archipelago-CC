// rule-node F3 — A TOP-DOWN COMPILE CARRIES THE BLOCKS ITS SOURCE'S RULES READ.
//
// `topDownFromRulesJson` copies the source's exit/location rules verbatim, and
// alttp's name helpers (`can_lift_rocks`), which read the source's options and
// world attributes (`option_value`, `world_attribute`), its progression mapping
// (`Progressive Glove` → `Power Glove`) and its dungeons (GT Moldorm's
// `parent_region.dungeon.bosses[...]`). `buildRulesJson` started from a bare
// scaffold, so with the whole pool the compiled alttp world reached 111 of 268
// locations (I1). It now carries `TOPDOWN_SOURCE_CARRY` from its `source`.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import '../mazeRoom/mazeRoomLibrary.js';
import { buildRulesJson, TOPDOWN_SOURCE_CARRY } from './procgenPipelineEngine.js';
import { buildTopDownEnvelope, runTopDownToStep } from './topDownSteps.js';
import { StateManager } from '../stateManager/stateManager.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { workerLoggerInstance } from '../../app/core/universalLogger.js';

const preset = (game, id = 'AP_14089154938208861744') => JSON.parse(readFileSync(new URL(
    `../../presets/${game}/${id}/${id}_rules.json`, import.meta.url,
), 'utf8'));

/** Run `fn` with the console silenced (the rule engine logs every unresolved helper). */
async function quietly(fn) {
    const saved = ['log', 'info', 'debug', 'warn'].map((k) => [k, console[k]]);
    for (const [k] of saved) console[k] = () => {};
    try {
        return await fn();
    } finally {
        for (const [k, f] of saved) console[k] = f;
    }
}

async function compiled(source, side) {
    const env = buildTopDownEnvelope({
        source, seed: 7, gridDims: { width: side, height: side },
        regionSizeBase: { width: 8, height: 6 }, substrateMix: { maze: 1 },
    });
    await quietly(() => runTopDownToStep(env, 'compile'));
    return env;
}

/** ④'s own buildRulesJson call re-issued over ③'s output, no log — `extra` overrides. */
function recompile(env, extra = {}) {
    const c = env.compileIn;
    return buildRulesJson(env.finalize.grid, {
        startCell: env.finalize.startCell, seed: c.seed, embedSphereLog: false,
        assumeBidirectional: c.assumeBidirectional, startingItems: c.startingItems,
        sourceItems: c.sourceItemDefs, menuRegion: env.finalize.menuRegion,
        source: env.source, ...extra,
    });
}

/** Locations accessible with every pool item held (the real StateManager). */
function reachableWithWholePool(doc) {
    const saved = ['log', 'info', 'debug', 'warn'].map((k) => [k, console[k]]);
    for (const [k] of saved) console[k] = () => {};
    try {
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(structuredClone(doc), '1');
        for (const [item, n] of Object.entries(doc.itempool_counts['1'])) {
            for (let i = 0; i < n; i++) sm.addItemToInventory(item);
        }
        sm.computeReachableRegions();
        const locs = [...sm.locations.values()];
        return { accessible: locs.filter((l) => sm.isLocationAccessible(l)).length, total: locs.length };
    } finally {
        for (const [k, f] of saved) console[k] = f;
    }
}

describe('F3 — a top-down compile of an alttp source carries its blocks', () => {
    const source = preset('alttp');
    let env;
    let doc;
    beforeAll(async () => {
        // procgen_topdown AP_7's recipe: this source, a 23×23 grid.
        env = await compiled(source, 23);
        doc = env.compile.rulesJson;
    }, 120_000);

    for (const key of TOPDOWN_SOURCE_CARRY.slotBlocks) {
        it(`carries ${key}[1] verbatim`, () => {
            expect(Object.keys(source[key]['1']).length).toBeGreaterThan(0);
            expect(doc[key]['1']).toEqual(source[key]['1']);
        });
    }

    it('carries world[1] but its identity keys', () => {
        const world = doc.world['1'];
        for (const [key, value] of Object.entries(source.world['1'])) {
            if (TOPDOWN_SOURCE_CARRY.worldIdentityKeys.includes(key)) continue;
            expect(world[key], key).toEqual(value);
        }
        expect(world.game).toBe('Procgen Maze');
        expect(world.world_class_name).toBe('ProcgenMazeWorld');
        expect(world).not.toHaveProperty('world_directory');
    });

    it('carries each region field the compile does not set itself', () => {
        const srcRegions = source.regions['1'];
        let carried = 0;
        for (const [name, region] of Object.entries(doc.regions['1'])) {
            for (const [key, value] of Object.entries(srcRegions[name] ?? {})) {
                if (TOPDOWN_SOURCE_CARRY.regionGraphKeys.includes(key)) continue;
                expect(region[key], `${name}.${key}`).toEqual(value);
                carried++;
            }
        }
        expect(carried).toBeGreaterThan(0);
        // GT Moldorm's rule reaches its region's dungeon through `parent_region.dungeon`.
        expect(Object.values(doc.regions['1']).some((r) => r.dungeon)).toBe(true);
    });

    it('with the whole pool reaches every location the source reaches', () => {
        const ours = reachableWithWholePool(doc);
        const theirs = reachableWithWholePool(source);
        expect(theirs).toEqual({ accessible: 268, total: 268 });
        expect(ours).toEqual(theirs);
    }, 60_000);

    it('without its source the same layout falls short (the defect this pins)', () => {
        const bare = recompile(env, { source: null });
        expect(bare.helpers).toEqual({});
        expect(bare.dungeons).toBeUndefined();
        expect(reachableWithWholePool(bare).accessible).toBeLessThan(268);
    }, 60_000);
});

describe('F3 — what a source without a block carries', () => {
    it('an empty source block is not written (adventure: no helpers, no mapping, no dungeons)', async () => {
        const source = preset('adventure');
        const env = await compiled(source, 5);
        const doc = recompile(env);
        expect(doc.helpers).toEqual({});
        expect(doc.progression_mapping).toEqual({ 1: {} });
        expect(doc).not.toHaveProperty('dungeons');
        expect(doc.world['1'].dragon_rooms).toEqual(source.world['1'].dragon_rooms);
    }, 60_000);
});
