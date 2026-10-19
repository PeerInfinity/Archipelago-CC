/**
 * pipelineRoomEdit — the pipeline's door into a LAB-edited room.
 *
 * ⛓ The claims: (1) every maze region of a grown world opens as a one-entry
 * region library and an UNEDITED save recompiles to the same rules.json byte
 * for byte; (2) an edit (the room's obstacles taken out) reaches the compiled
 * world; (3) a lab substrate with no usable round trip REFUSES with a sentence
 * rather than opening nothing; (4) `roomEditorKindOf` answers the declared
 * kind off the registry.
 *
 * ⛔ The roster is DERIVED: which regions are maze, and which substrates
 * declare a lab door, are read off the world and the registry.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const PRESET = 'shipped:maze-sphere-demo';

let presetRun;
let presetDefs;
let steps;
let mod;
let editors;

beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
    presetRun = await import('./presetRun.js');
    presetDefs = await import('./presetDefs.js');
    steps = await import('./sphereSteps.js');
    mod = await import('./pipelineRoomEdit.js');
    editors = await import('./regionEditors.js');
});

async function grownWorld(id = PRESET) {
    const preset = presetDefs.SHIPPED_PRESETS.find((p) => p.id === id);
    const { run } = presetRun.buildRunFromState(preset.state);
    return steps.runToStep(steps.newEnvelope(run.config), 'compile');
}

async function recompile(env) {
    env.compile = null;
    env.completed = 4;
    await steps.runStep('compile', env);
    return JSON.stringify(env.compile.rulesJson);
}

async function roundTrip(grid, region, edit = null) {
    const opened = await mod.openPipelineRoom(region);
    expect(opened.ok, opened.why).toBe(true);
    const saved = JSON.parse(JSON.stringify({ library: opened.session.record, overlay: {} }));
    expect(saved.library.entries).toHaveLength(1);
    expect(saved.library.entries[0].entry_id).toBe(region.region_id);
    edit?.(saved.library.entries[0].payload);
    const out = await mod.regionFromPipelineSave(opened, saved);
    expect(out.error).toBeUndefined();
    grid.replaceRegion(region.cell, out.region);
    return out.region;
}

describe('pipelineRoomEdit', () => {
    it('an unedited save of EVERY maze region recompiles to the same rules.json', async () => {
        const env = await grownWorld();
        const before = JSON.stringify(env.compile.rulesJson);
        const grid = env.grow.grid;
        const maze = [...grid.allRegions()].filter((r) => r.substrate === 'maze');
        expect(maze.length).toBeGreaterThan(0);
        for (const region of maze) {
            // eslint-disable-next-line no-await-in-loop
            await roundTrip(grid, region);
        }
        expect(await recompile(env)).toBe(before);
    });

    it('an edit reaches the compiled world', async () => {
        const env = await grownWorld();
        const before = JSON.stringify(env.compile.rulesJson);
        const grid = env.grow.grid;
        const region = [...grid.allRegions()]
            .find((r) => r.substrate === 'maze' && r.playable_payload.obstacles.size > 0);
        expect(region).toBeTruthy();
        const edited = await roundTrip(grid, region, (payload) => { payload.obstacles = []; });
        expect(edited.playable_payload.obstacles.size).toBe(0);
        const after = await recompile(env);
        expect(after).not.toBe(before);
        expect(JSON.parse(after).preset_sidecars['1'][region.region_id].playable_payload.obstacles)
            .toEqual([]);
    });

    it('a substrate whose round trip is refused answers the refusal sentence', async () => {
        const refused = substrateRegistry.getAll()
            .filter((e) => e.roomEditor?.kind === 'lab' && typeof e.regionRoundTrip?.refused === 'string');
        expect(refused.length).toBeGreaterThan(0);
        for (const entry of refused) {
            // eslint-disable-next-line no-await-in-loop
            const out = await mod.openPipelineRoom({ substrate: entry.id, region_id: 'r' });
            expect(out).toEqual({ ok: false, why: entry.regionRoundTrip.refused });
        }
    });

    it('roomEditorKindOf answers the declared kind, and null without one', () => {
        for (const entry of substrateRegistry.getAll()) {
            expect(editors.roomEditorKindOf(entry.id)).toBe(entry.roomEditor?.kind ?? null);
        }
        expect(editors.roomEditorKindOf('__no_such_substrate__')).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⚖ region-editor-launch S2 — GENERATED SEEDLING ROOMS (`flash_seedling_gen`)
 * ══════════════════════════════════════════════════════════════════════ */

const GEN_PRESETS = ['shipped:seedling-generated-host-demo', 'shipped:seedling-generated-leaf-demo',
    'shipped:seedling-generated-swim-demo'];

/** The Seedling lab's save of room 0 of the set it was handed, with `edit` applied to its record. */
async function genRoundTrip(grid, region, edit = null) {
    const opened = await mod.openPipelineRoom(region);
    expect(opened.ok, opened.why).toBe(true);
    const saved = JSON.parse(JSON.stringify({ set: opened.session.record, overlay: {} }));
    expect(saved.set.rooms).toHaveLength(1);
    edit?.(saved.set.rooms[0].source.record);
    const out = await mod.regionFromPipelineSave(opened, saved);
    return out;
}

describe('pipelineRoomEdit — generated Seedling rooms', () => {
    it('an unedited save of EVERY generated room recompiles to the same rules.json', async () => {
        for (const id of GEN_PRESETS) {
            // eslint-disable-next-line no-await-in-loop
            const env = await grownWorld(id);
            const before = JSON.stringify(env.compile.rulesJson);
            const grid = env.grow.grid;
            const gen = [...grid.allRegions()].filter((r) => r.substrate === 'flash_seedling_gen');
            expect(gen.length, id).toBeGreaterThan(0);
            for (const region of gen) {
                // eslint-disable-next-line no-await-in-loop
                const out = await genRoundTrip(grid, region);
                expect(out.error, `${id} ${region.region_id}`).toBeUndefined();
                grid.replaceRegion(region.cell, out.region);
            }
            // eslint-disable-next-line no-await-in-loop
            expect(await recompile(env), id).toBe(before);
        }
    }, 240_000);

    it('a tile edit lands, is re-certified, and its flag reaches the compiled sidecar', async () => {
        const env = await grownWorld(GEN_PRESETS[0]);
        const grid = env.grow.grid;
        const region = [...grid.allRegions()].find((r) => r.substrate === 'flash_seedling_gen');
        const goal = region.playable_payload.goalCell;
        const near = new Set([[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => `${goal.tx + dx},${goal.ty + dy}`));
        const out = await genRoundTrip(grid, region, (record) => {
            const wall = record.layers[0].tiles.find(([x, y]) => x === 0 && y === 0)[2];
            record.layers = record.layers.map((l) => (Array.isArray(l.tiles) ? { ...l,
                tiles: l.tiles.map((t) => (near.has(`${t[0]},${t[1]}`) ? [t[0], t[1], wall, ...t.slice(3)] : t)) } : l));
        });
        expect(out.error).toBeUndefined();
        expect(out.region.playable_payload.generation.edited.certified).toBe(false);
        grid.replaceRegion(region.cell, out.region);
        const rules = JSON.parse(await recompile(env));
        const sidecar = rules.preset_sidecars['1'][region.region_id];
        expect(sidecar.playable_payload.generation.edited.certified).toBe(false);
        const status = substrateRegistry.get('flash_seedling_gen').regionEditStatus(sidecar.playable_payload);
        expect(status.flagged).toBe(true);
        expect(status.text).toContain('the goal');
    }, 240_000);

    it('⛔ a moved door is REFUSED by name, not saved', async () => {
        const env = await grownWorld(GEN_PRESETS[0]);
        const grid = env.grow.grid;
        const region = [...grid.allRegions()].find((r) => r.substrate === 'flash_seedling_gen'
            && r.playable_payload.exits.size > 0);
        const out = await genRoundTrip(grid, region, (record) => {
            record.entities.find((e) => e.type === 'teleporter').x += 16;
        });
        expect(out.error).toContain('Doors and AP item locations are the world\'s');
    }, 240_000);
});

