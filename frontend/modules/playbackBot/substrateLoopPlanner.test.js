/**
 * ⛓ The loop runner's seam (AN-3a): a substrate's own loop plan is asked ONLY for a world whose every region (but its
 * declared start regions) belongs to one substrate that declares `loopBot.planLoop`. Pinned over EVERY committed
 * preset: the ActionNodes example is the only one that gets a planner, so every other world's bot plan is unchanged
 * (the runner falls through to `planNextLoop`; `loopModeRunner.test.js` pins that a null planner is byte-for-byte the
 * old path).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { substrateLoopPlannerOf } from './substrateLoopPlanner.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { ACTION_NODES_SUBSTRATE_ID } from '../actionNodes/actionGraphCompiler.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '../../presets');

const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

function committedRules() {
    const out = [];
    for (const game of readdirSync(PRESETS, { withFileTypes: true })) {
        if (!game.isDirectory()) continue;
        for (const seed of readdirSync(join(PRESETS, game.name), { withFileTypes: true })) {
            if (!seed.isDirectory()) continue;
            const file = join(PRESETS, game.name, seed.name, `${seed.name}_rules.json`);
            if (existsSync(file)) out.push({ id: `${game.name}/${seed.name}`, file });
        }
    }
    return out;
}

describe('substrateLoopPlannerOf over every committed preset', () => {
    const rows = committedRules();

    it('finds presets to check', () => {
        expect(rows.length).toBeGreaterThan(1);
    });

    it('⛓ only ActionNodes worlds get a planner; every other world gets null (the runner plans as before)', () => {
        const withPlanner = [];
        for (const { id, file } of rows) {
            const rules = JSON.parse(readFileSync(file, 'utf8'));
            for (const p of Object.keys(rules.regions ?? {})) {
                const got = substrateLoopPlannerOf(rules, p, substrateRegistry);
                if (got) withPlanner.push({ id, p, substrateId: got.substrateId });
            }
        }
        expect(withPlanner.length).toBeGreaterThan(0);
        for (const row of withPlanner) expect(row, row.id).toMatchObject({ substrateId: ACTION_NODES_SUBSTRATE_ID });
        expect(withPlanner.every((r) => r.id.startsWith('action_nodes'))).toBe(true);
    });

    it('the registry: ActionNodes alone declares loopBot.planLoop', () => {
        const declaring = substrateRegistry.getAll().filter((e) => typeof e?.loopBot?.planLoop === 'function').map((e) => e.id);
        expect(declaring).toEqual([ACTION_NODES_SUBSTRATE_ID]);
    });
});

describe('substrateLoopPlannerOf — the rule', () => {
    const reg = { get: (id) => (id === 'a' ? { loopBot: { planLoop: () => ({}) } } : id === 'b' ? {} : undefined) };
    const world = (sidecars, regions = Object.keys(sidecars)) => ({
        regions: { 1: Object.fromEntries(['Menu', ...regions].map((r) => [r, {}])) },
        start_regions: { 1: { default: ['Menu'], available: [] } },
        preset_sidecars: { 1: Object.fromEntries(Object.entries(sidecars).map(([r, s]) => [r, { substrate: s }])) },
    });

    it('one declaring substrate on every region but the start: its planner', () => {
        expect(substrateLoopPlannerOf(world({ x: 'a', y: 'a' }), 1, reg)?.substrateId).toBe('a');
    });
    it('a region with no sidecar that is not a start region: null', () => {
        expect(substrateLoopPlannerOf(world({ x: 'a' }, ['x', 'plain']), 1, reg)).toBeNull();
    });
    it('a mixed world: null', () => {
        expect(substrateLoopPlannerOf(world({ x: 'a', y: 'b' }), 1, reg)).toBeNull();
    });
    it('a substrate without the hook: null', () => {
        expect(substrateLoopPlannerOf(world({ x: 'b' }), 1, reg)).toBeNull();
    });
    it('no world, or no sidecars at all: null', () => {
        expect(substrateLoopPlannerOf(null, 1, reg)).toBeNull();
        expect(substrateLoopPlannerOf(world({}), 1, reg)).toBeNull();
    });
});
