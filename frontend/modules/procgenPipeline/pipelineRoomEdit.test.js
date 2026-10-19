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

async function grownWorld() {
    const preset = presetDefs.SHIPPED_PRESETS.find((p) => p.id === PRESET);
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
