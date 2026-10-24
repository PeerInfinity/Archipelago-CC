import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readModeRows, resolveTestIdsWebgpu, runNeedsWebgpu } from './testWebgpu.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WASM_ROW = 'seedling-wasm-runtime-loop-play-clock-drains-mana';
const APWORLD_ROW = 'apworld-document-tab-lists-every-schema-key';

describe('runNeedsWebgpu — a --test row takes WebGPU from its batch', () => {
    it('a Seedling wasm row resolves to seedling-js and asks for WebGPU (the 0/8 of run 38202293385)', () => {
        const d = runNeedsWebgpu({ mode: 'test-substrates', testIds: WASM_ROW });
        expect(d.batches).toEqual([{ id: WASM_ROW, batch: 'seedling-js', webgpu: true }]);
        expect(d.webgpu).toBe(true);
    });

    it('a row of a batch without WebGPU keeps --disable-gpu', () => {
        const d = runNeedsWebgpu({ mode: 'test-substrates', testIds: APWORLD_ROW });
        expect(d.batches).toEqual([{ id: APWORLD_ROW, batch: 'apworld', webgpu: false }]);
        expect(d.webgpu).toBe(false);
    });

    it('a mixed list asks for WebGPU when ANY of its rows needs it', () => {
        expect(runNeedsWebgpu({ mode: 'test-substrates', testIds: `${APWORLD_ROW}, ${WASM_ROW}` }).webgpu).toBe(true);
    });

    it('a regression-mode row resolves too (default batch, no WebGPU)', () => {
        expect(runNeedsWebgpu({ mode: 'test-regression', testIds: 'test_core_super_quick' }))
            .toEqual({ webgpu: false, batches: [{ id: 'test_core_super_quick', batch: 'fast', webgpu: false }] });
    });

    it('the batch path and the explicit flag are unchanged', () => {
        expect(runNeedsWebgpu({ mode: 'test-substrates', batch: 'seedling-js' }).webgpu).toBe(true);
        expect(runNeedsWebgpu({ mode: 'test-substrates', batch: 'apworld' }).webgpu).toBe(false);
        expect(runNeedsWebgpu({ mode: 'test-substrates' }).webgpu).toBe(false);
        // --webgpu skips the lookup, so even an id no config knows does not refuse.
        expect(runNeedsWebgpu({ explicit: true, mode: 'test-substrates', testIds: 'nope' }).webgpu).toBe(true);
    });

    it('every substrate row resolves to a batch (none would be refused)', () => {
        const { rows, file } = readModeRows('test-substrates');
        const ids = rows.map((r) => r.id).join(',');
        const { batches } = resolveTestIdsWebgpu(ids, rows, file);
        expect(batches).toHaveLength(rows.length);
    });
});

describe('the smoke override decides the row\'s batch', () => {
    it('a WebGPU batch\'s row moved to fast runs as fast does', () => {
        const rows = [{ id: 's', category: 'Tutorial walks: seedling', batch: 'fast' },
            { id: 't', category: 'Tutorial walks: seedling' }];
        expect(resolveTestIdsWebgpu('s', rows).batches).toEqual([{ id: 's', batch: 'fast', webgpu: false }]);
        expect(resolveTestIdsWebgpu('t', rows).batches)
            .toEqual([{ id: 't', batch: 'tutorials-seedling', webgpu: true }]);
    });
});

describe('a row whose batch cannot be resolved is REFUSED by name', () => {
    it('an id not in the mode\'s config', () => {
        expect(() => runNeedsWebgpu({ mode: 'test-substrates', testIds: `${WASM_ROW},no-such-row` }))
            .toThrow(/no row 'no-such-row' in frontend\/test-configs\/playwright_tests_config-substrates\.json/);
    });

    it('a row with no category', () => {
        expect(() => resolveTestIdsWebgpu('x', [{ id: 'x' }], 'cfg'))
            .toThrow(/row 'x' has no category in cfg/);
    });

    it('a mode with no tests config', () => {
        expect(() => runNeedsWebgpu({ mode: 'no-such-mode', testIds: WASM_ROW }))
            .toThrow(/mode 'no-such-mode' has no testsConfig/);
    });

    it('a refused smoke override', () => {
        expect(() => resolveTestIdsWebgpu('x', [{ id: 'x', category: 'apworldEditor', batch: 'fast' }]))
            .toThrow(/row 'x' overrides its batch/);
    });

    it('run-tests.js exits 2 naming the id, before the box lock', () => {
        const r = spawnSync(process.execPath, ['scripts/test/run-tests.js', '--mode=test-substrates', '--test=no-such-row'],
            { cwd: REPO, encoding: 'utf8', env: { ...process.env, npm_config_webgpu: '' } });
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/no row 'no-such-row'/);
    });
});
