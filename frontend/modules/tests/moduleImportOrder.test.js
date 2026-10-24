/**
 * Every module file that imports its OWN index.js evaluates in EITHER import
 * order (slice C6; the generic form of quickLaunchImportOrder.test.js, P9).
 *
 * Those imports close a cycle — the index imports its UI, the UI imports the
 * index. A cycle is harmless until the index READS one of the UI's exports at
 * evaluation (a `moduleInfo` field, a constant): then whichever file is
 * imported first decides whether that read lands in the temporal dead zone.
 * The module loader imports index.js first, but test discovery imports a test
 * file → the UI → the index whether or not the module is enabled, so the UI can
 * come first in any mode that disables the module. P9 met exactly that in
 * `test-spoilers` (`Cannot access 'MODULE_ID' before initialization`).
 *
 * The file set is DERIVED from the tree, so a module added tomorrow is covered:
 * every non-test `.js` under `frontend/modules/<module>/` whose static imports
 * resolve to `frontend/modules/<module>/index.js`. The import statements are
 * PARSED (es-module-lexer, vitest's own dependency) — a line regex misses the
 * multi-line `} from './index.js'` form and subdirectory `../index.js`
 * importers, and grep silently skips NUL-bearing files (regionMarkingToolUI.js).
 *
 * The probe is NATIVE Node ESM, one fresh process per (file, order): vitest's
 * module runner does not model the TDZ (the read gives `undefined`, no throw),
 * so it cannot see this defect at all. The positive control
 * (importOrderFixture/) is a live cycle that MUST throw, so a probe that stops
 * seeing errors fails here instead of passing everything.
 */
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init, parse } from 'es-module-lexer';
import { beforeAll, describe, expect, it } from 'vitest';

const MODULES_ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_ROOT = fileURLToPath(new URL('./importOrderFixture/modules', import.meta.url));
const REPO_ROOT = path.resolve(MODULES_ROOT, '../..');

/**
 * Globals a module needs at EVALUATION in bare Node. Two modules need them:
 * `dungeons` and `helpers` construct their module instance at evaluation and
 * its log() reads bare `window` (→ `window`); once `window` exists,
 * `shared/profiler.js`'s `typeof window` branch reads `window.location.search`
 * (→ `location`). Nothing else is shimmed — a module that needs more fails
 * here and says which global.
 */
export const IMPORT_ORDER_SHIM =
  "globalThis.window = globalThis; globalThis.location = new URL('http://localhost/');";

const TEST_FILE = /\.(test|bench)\.js$/;

function jsFilesUnder(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...jsFilesUnder(p));
    else if (entry.isFile() && p.endsWith('.js') && !TEST_FILE.test(p)) files.push(p);
  }
  return files;
}

/**
 * Every non-test `.js` under `<root>/<module>/` with a STATIC import that
 * resolves to `<root>/<module>/index.js`, sorted. Reads each file (never greps).
 */
export function ownIndexImporters(root) {
  const found = [];
  for (const mod of readdirSync(root, { withFileTypes: true })) {
    if (!mod.isDirectory()) continue;
    const index = path.join(root, mod.name, 'index.js');
    for (const file of jsFilesUnder(path.join(root, mod.name))) {
      if (file === index) continue;
      const [imports] = parse(readFileSync(file, 'utf8'), file);
      // d === -1: a static import/export-from (dynamic imports are not cycle edges).
      if (imports.some((i) => i.d === -1 && i.n?.startsWith('.')
          && path.resolve(path.dirname(file), i.n) === index)) {
        found.push({ file, index });
      }
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}

/** Import `first` then `second` in a fresh Node process; `{ ok }` or `{ ok: false, error }`. */
export async function probeImportOrder(first, second) {
  const script = `${IMPORT_ORDER_SHIM}
    try {
      await import(${JSON.stringify(pathToFileURL(first).href)});
      await import(${JSON.stringify(pathToFileURL(second).href)});
      console.log('IMPORT-ORDER ' + JSON.stringify({ ok: true }));
    } catch (e) {
      console.log('IMPORT-ORDER ' + JSON.stringify({ ok: false, error: e?.constructor?.name + ': ' + e?.message }));
    }
    process.exit(0);`;
  // The rest of stdout/stderr is the modules' own logging; only the report line counts.
  const stdout = await new Promise((resolve) => {
    execFile(process.execPath, ['--input-type=module', '-e', script],
      { timeout: 60000, maxBuffer: 64 * 1024 * 1024 },
      (error, out) => resolve(error && !out ? `(process failed: ${error.message})` : out));
  });
  const line = stdout.split('\n').find((l) => l.startsWith('IMPORT-ORDER '));
  return line ? JSON.parse(line.slice('IMPORT-ORDER '.length))
    : { ok: false, error: `no report line: ${stdout.slice(0, 500)}` };
}

/** Both orders for every importer, `availableParallelism()` processes at a time. */
async function probeAll(importers) {
  const jobs = importers.flatMap(({ file, index }) => [
    { file, order: 'importer first', first: file, second: index },
    { file, order: 'index first', first: index, second: file },
  ]);
  const results = new Map();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      results.set(`${job.file}|${job.order}`, await probeImportOrder(job.first, job.second));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, availableParallelism()) }, worker));
  return results;
}

await init;
const rel = (file) => path.relative(REPO_ROOT, file);
const importers = ownIndexImporters(MODULES_ROOT);

describe('module import order — the positive control (a live cycle)', () => {
  const fixture = ownIndexImporters(FIXTURE_ROOT);
  const ui = path.join(FIXTURE_ROOT, 'cyclic', 'cycleUI.js');
  const index = path.join(FIXTURE_ROOT, 'cyclic', 'index.js');

  it('the enumerator finds the multi-line and subdirectory importers, not a comment, string or dynamic import', () => {
    expect(fixture.map(({ file }) => path.relative(FIXTURE_ROOT, file)))
      .toEqual(['cyclic/cycleUI.js', 'cyclic/sub/deepUI.js']);
  });

  it('the probe SEES the TDZ: the UI imported first throws', async () => {
    const result = await probeImportOrder(ui, index);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^ReferenceError: Cannot access 'FIXTURE_ID' before initialization/);
  });

  it('the same cycle evaluates with index.js imported first', async () => {
    expect(await probeImportOrder(index, ui)).toEqual({ ok: true });
  });
});

describe('module import order — every module file that imports its own index.js', () => {
  let results;
  beforeAll(async () => {
    results = await probeAll(importers);
  }, 600000);

  it('the derived set is not empty (the walk found the tree)', () => {
    expect(importers.length).toBeGreaterThan(0);
  });

  it.each(importers.map(({ file }) => [rel(file)]))('%s evaluates in both orders', (relFile) => {
    const file = path.join(REPO_ROOT, relFile);
    expect({
      'importer first': results.get(`${file}|importer first`),
      'index first': results.get(`${file}|index first`),
    }).toEqual({ 'importer first': { ok: true }, 'index first': { ok: true } });
  });
});
