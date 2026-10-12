/**
 * Does a `--test=<id>[,<id>…]` run need a browser WITH WebGPU?
 *
 * WHY: WebGPU is opted into per BATCH (testBatches.js `webgpu: true`), and
 * run-tests.js only knew the batch when one was named. A solo row run with
 * `--test=` and no `--batch` launched with --disable-gpu, so a wasm row
 * (`seedling-wasm-runtime-loop-*`) could never boot the recompiled game: the
 * repeat workflow ran one 0/8 that was the harness, not the row (run
 * 38202293385). The answer now comes from the row itself — the batch its
 * category (or smoke override) puts it in, i.e. the batch that runs it on push
 * — so neither a caller nor a workflow input has to know which rows are wasm.
 *
 * The row's category is read off the mode's tests config (frontend/modes.json
 * → testsConfig.path), the same file testBatches.test.js reads. Every way the
 * batch cannot be resolved is REFUSED by name rather than guessed: a guess of
 * "no WebGPU" is exactly the silent 0/N this module exists to remove.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchNeedsWebgpu, batchOfTest } from '../../frontend/modules/tests/testBatches.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The `{id, category, batch?}` rows of a mode's tests config. Throws naming the mode. */
export function readModeRows(mode, repo = REPO) {
  const modes = JSON.parse(readFileSync(path.join(repo, 'frontend/modes.json'), 'utf8'));
  const rel = modes[mode]?.testsConfig?.path;
  if (!rel) {
    throw new Error(`--test: mode '${mode}' has no testsConfig in frontend/modes.json, so its rows' batches cannot be resolved`);
  }
  const file = path.join(repo, 'frontend', rel);
  const config = JSON.parse(readFileSync(file, 'utf8'));
  return { rows: Array.isArray(config.tests) ? config.tests : [], file: path.relative(repo, file) };
}

/**
 * Resolve each id to its batch and whether that batch launches with WebGPU.
 * Returns `{ webgpu, batches: [{id, batch, webgpu}] }`; `webgpu` is true when
 * ANY named row's batch needs it (a mixed list must still boot the wasm row).
 * Throws, naming the id, when an id is not in the config, its row carries no
 * category, or its batch override is refused by batchOfTest().
 */
export function resolveTestIdsWebgpu(testIds, rows, source = 'the tests config') {
  const ids = String(testIds).split(',').map((s) => s.trim()).filter(Boolean);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const batches = ids.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new Error(`--test: no row '${id}' in ${source}, so its batch (and whether it needs WebGPU) cannot be resolved`);
    }
    if (!row.category) {
      throw new Error(`--test: row '${id}' has no category in ${source}, so its batch (and whether it needs WebGPU) cannot be resolved`);
    }
    const batch = batchOfTest(row);
    return { id, batch, webgpu: batchNeedsWebgpu(batch) };
  });
  return { webgpu: batches.some((b) => b.webgpu), batches };
}

/**
 * The run's whole WebGPU decision (run-tests.js → TEST_WEBGPU): an explicit
 * `--webgpu`, a named batch that declares `webgpu: true`, or — for `--test=` —
 * a named row whose batch does. Returns `{ webgpu, batches }` (`batches` lists
 * each resolved `--test` row; empty when no lookup ran). Throws as
 * resolveTestIdsWebgpu() does; an explicit `--webgpu` skips the lookup.
 */
export function runNeedsWebgpu({ explicit = false, batch = '', testIds = '', mode = 'test' }, repo = REPO) {
  if (explicit) return { webgpu: true, batches: [] };
  let resolved = { webgpu: false, batches: [] };
  if (testIds) {
    const { rows, file } = readModeRows(mode, repo);
    resolved = resolveTestIdsWebgpu(testIds, rows, file);
  }
  return { webgpu: batchNeedsWebgpu(batch) || resolved.webgpu, batches: resolved.batches };
}
