/**
 * The bundled boot's test cases must be the unbundled boot's test cases.
 *
 * Unbundled, `testDiscovery.js` imports `TEST_CASE_FILES` at run time. Bundled,
 * esbuild cannot follow those dynamic imports, so `init-bundled.js` imports the
 * same files STATICALLY — a second, hand-kept list. Measured 2026-09-26: it had
 * fallen 14 files behind (runnerBlockModeTests … apworldEditorTests), so a
 * bundled run of a mode enabling those rows would find no function for them and
 * wait on a completion that never comes. This compares the two lists; the build
 * warns on drift and `bundledTestCases.test.js` fails on it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CASE_FILES } from '../../frontend/modules/tests/testDiscovery.js';

const FRONTEND = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend');

/** The testCases files init-bundled.js imports, as `testCases/<file>.js`. */
export function bundledTestCaseImports(src) {
  return [...src.matchAll(/^import\s+['"]\.\/modules\/tests\/(testCases\/[^'"]+)['"];?\s*$/gm)]
    .map((m) => m[1]);
}

/** @returns {{ missing: string[], extra: string[] }} relative to TEST_CASE_FILES */
export function bundledTestCaseDrift({ frontendDir = FRONTEND } = {}) {
  const src = fs.readFileSync(path.join(frontendDir, 'init-bundled.js'), 'utf8');
  const bundled = new Set(bundledTestCaseImports(src));
  const discovered = new Set(TEST_CASE_FILES.map((f) => f.replace(/^\.\//, '')));
  return {
    missing: [...discovered].filter((f) => !bundled.has(f)),
    extra: [...bundled].filter((f) => !discovered.has(f)),
  };
}
