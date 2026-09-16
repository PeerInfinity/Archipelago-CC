/**
 * buildRulesJson's `loop_costs` block carries NO wall clock.
 *
 * ⛓ PROCGEN PIPELINE PRESETS P0 (⚖ user, 2026-09-16: "Unless you know of a
 * reason to keep generatedAt, I would prefer to remove it."). A loop-mode world
 * used to differ between two compiles in exactly one field,
 * `loop_costs.generatedAt` — so a generated preset could not be held
 * byte-identical across runs. `buildRulesJson` now drops it, the way
 * `scripts/test/presetLoopCosts.mjs` already does for the committed corpus.
 *
 * ⛔ The two compiles are a full simulated SECOND apart (fake system time): two
 * real compiles can land in the same millisecond, and a timestamp that happens
 * to agree would make the identity row pass with the field still written.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { growMaze, buildRulesJson } from './procgenPipelineEngine.js';

function smallGrid() {
    return growMaze({
        gridDims: { width: 3, height: 3 },
        regionSize: { width: 6, height: 6 },
        itemPool: { key_red: 2 },
        obstaclePool: { door_red: 2 },
        seed: 5,
        regionParams: {},
    });
}

/** Every JSON path at which two plain documents differ. */
function differingPaths(a, b, path = '', out = []) {
    if (JSON.stringify(a) === JSON.stringify(b)) return out;
    if (a && b && typeof a === 'object' && typeof b === 'object'
        && Array.isArray(a) === Array.isArray(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            differingPaths(a[k], b[k], `${path}/${k}`, out);
        }
    } else {
        out.push(path);
    }
    return out;
}

afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('../shared/procgen/loopCostGenerator.js');
    vi.resetModules();
});

describe('buildRulesJson — loop_costs is deterministic', () => {
    it('a loop-mode world compiled twice, a second apart, is byte-identical', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));
        const first = smallGrid();
        const a = JSON.parse(JSON.stringify(
            buildRulesJson(first.grid, { startCell: first.startCell, enableLoopMode: true })));
        vi.setSystemTime(new Date('2026-09-16T12:00:01.000Z'));
        const second = smallGrid();
        const b = JSON.parse(JSON.stringify(
            buildRulesJson(second.grid, { startCell: second.startCell, enableLoopMode: true })));
        expect(differingPaths(a, b)).toEqual([]);
        expect(a.loop_costs.version).toBe('1.0');
        expect(a.loop_costs.generatedFrom).toBeTruthy();
        expect(a.loop_costs).not.toHaveProperty('generatedAt');
    });

    it('the failure marker written when the generator throws carries no generatedAt either', async () => {
        vi.resetModules();
        vi.doMock('../shared/procgen/loopCostGenerator.js', async (importOriginal) => ({
            ...(await importOriginal()),
            generateLoopCosts: () => { throw new Error('probe'); },
        }));
        await import('../mazeRoom/mazeRoomLibrary.js');
        const engine = await import('./procgenPipelineEngine.js');
        const { grid, startCell } = engine.growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 5,
            regionParams: {},
        });
        const out = engine.buildRulesJson(grid, { startCell, enableLoopMode: true });
        expect(out.loop_costs.error).toBe('loopCostGenerator failed: probe');
        expect(out.loop_costs.version).toBe('1.0');
        expect(out.loop_costs).not.toHaveProperty('generatedAt');
    });
});
