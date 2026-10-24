/**
 * procgenCore/substrateLibraries — the ONE list of substrate libraries: every
 * headless caller derives from it, and every file that registers an entry is
 * reached by it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SUBSTRATE_LIBRARIES } from './substrateLibraries.js';
import { REGENERATE_WORKER_LIBRARIES } from '../apworldEditor/regionGenerationRun.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';

const MODULES = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = 'substrateRegistry.register(';

/** A `register(` CALL, not a mention in a comment. */
const callsRegister = (text) => text.split('\n')
    .some((line) => line.includes(REGISTER) && !/^\s*(\*|\/\/|\/\*)/.test(line));

/**
 * Non-test .js files under frontend/modules that call `register(`. Excluded:
 * the shared submodule's registry itself, and `tests/` — the in-app test
 * cases register throwaway entries (`flash_demo2`) on the live page.
 */
function registeringFiles() {
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) {
                if (!['node_modules', 'wasm', 'generated'].includes(name) && p !== join(MODULES, 'tests')) walk(p);
            } else if (name.endsWith('.js') && !name.includes('.test.') && !name.includes('.slow.')
                && callsRegister(readFileSync(p, 'latin1'))) {
                out.push(relative(MODULES, p).split('\\').join('/'));
            }
        }
    };
    walk(MODULES);
    return out.filter((f) => f !== 'shared/procgen/substrateRegistry.js');
}

describe('substrateLibraries', () => {
    it('every entry exists, once', () => {
        expect(new Set(SUBSTRATE_LIBRARIES).size).toBe(SUBSTRATE_LIBRARIES.length);
        for (const rel of SUBSTRATE_LIBRARIES) expect(existsSync(join(MODULES, rel)), rel).toBe(true);
    });

    it('the worker and the docs generator read this list, not a copy', () => {
        expect(REGENERATE_WORKER_LIBRARIES).toBe(SUBSTRATE_LIBRARIES);
        expect([...REGISTRY_LIBRARIES]).toEqual(SUBSTRATE_LIBRARIES.map((rel) => `frontend/modules/${rel}`));
    });

    it('every file that registers an entry is reached by the list', () => {
        const files = registeringFiles();
        expect(files.length).toBeGreaterThan(SUBSTRATE_LIBRARIES.length);
        const listedDirs = new Set(SUBSTRATE_LIBRARIES.map((rel) => dirname(rel)));
        const importedByList = (file) => SUBSTRATE_LIBRARIES.some((lib) => dirname(lib) === dirname(file)
            && readFileSync(join(MODULES, lib), 'latin1').includes(`'./${basename(file)}'`));
        const unreached = files.filter((f) => !SUBSTRATE_LIBRARIES.includes(f)
            // ⛓ a panel's index.js registers in the browser; its headless twin is a listed library beside it
            && !(basename(f) === 'index.js' && listedDirs.has(dirname(f)))
            && !importedByList(f));
        expect(unreached, `register() callers no listed library reaches — add them to substrateLibraries.js`).toEqual([]);
    });
});
