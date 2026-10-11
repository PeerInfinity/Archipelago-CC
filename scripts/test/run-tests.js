#!/usr/bin/env node

/**
 * Test runner wrapper that accepts parameters via both npm config AND command-line args
 * Supports both syntaxes:
 *   npm test --mode=test-spoilers --game=adventure
 *   npm test -- --mode=test-spoilers --game=adventure
 */

import { spawn, spawnSync } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { batchNeedsWebgpu, listBatchNames } from '../../frontend/modules/tests/testBatches.js';
import { resolveTestPort } from './testServer.js';
import {
  WAIT_FOR_BOX_FLAG, endTreeState, resultsFiles, runLockName, stampResults, takeRunBox,
  trackChild, waitSecFrom
} from './testRunBox.js';

// Parse command-line arguments
const { values } = parseArgs({
  options: {
    mode: { type: 'string' },
    game: { type: 'string' },
    seed: { type: 'string' },
    player: { type: 'string' },
    rules: { type: 'string' },
    layout: { type: 'string' },
    testOrderSeed: { type: 'string' },
    batch: { type: 'string' },
    test: { type: 'string' },
    port: { type: 'string' },
    bundled: { type: 'boolean' },
    webgpu: { type: 'boolean' },
    'no-build': { type: 'boolean' },
    headed: { type: 'boolean' },
    debug: { type: 'boolean' },
    ui: { type: 'boolean' }
  },
  strict: false,
  allowPositionals: true
});

// Merge npm config with command-line args (command-line takes precedence)
const config = {
  mode: values.mode || process.env.npm_config_mode || 'test',
  game: values.game || process.env.npm_config_game || '',
  seed: values.seed || process.env.npm_config_seed || '',
  player: values.player || process.env.npm_config_player || '',
  rules: values.rules || process.env.npm_config_rules || '',
  layout: values.layout || process.env.npm_config_layout || '',
  testOrderSeed: values.testOrderSeed || process.env.npm_config_testOrderSeed || process.env.TEST_ORDER_SEED || '',
  // Named subset of the in-app roster (frontend/modules/tests/testBatches.js).
  // Empty = the whole roster, so every existing invocation is unchanged.
  batch: values.batch || process.env.npm_config_batch || '',
  // One or more test ids (comma-separated) to run INSTEAD of the rest of the
  // roster — the "run it alone 8x and count" protocol for triaging a flake.
  // Empty = no narrowing, so every existing invocation is unchanged.
  testIds: values.test || process.env.npm_config_test || '',
  // The dev server's port (scripts/test/testServer.js). Empty = whatever
  // TEST_PORT already says, or the module's default — so every existing
  // invocation is unchanged. A worktree serving itself on another port passes
  // `--port=NNNN` and the whole run, page URL and web-server probe alike,
  // drives THAT tree.
  port: values.port || process.env.npm_config_port || '',
  // Drive the BUNDLED frontend (frontend/dist/bundle.js, `?bundled=true`)
  // instead of the ES modules. It is rebuilt first, from this tree, unless
  // --no-build: a stale bundle would measure somebody else's code.
  bundled: !!(values.bundled || process.env.npm_config_bundled),
  noBuild: !!(values['no-build'] || process.env.npm_config_no_build)
};

if (config.port) {
  try {
    resolveTestPort({ TEST_PORT: config.port });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}

// Build environment variables
const env = {
  ...process.env,
  TEST_MODE: config.mode,
  TEST_GAME: config.game,
  TEST_SEED: config.seed,
  TEST_PLAYER: config.player,
  RULES_OVERRIDE: config.rules,
  TEST_LAYOUT: config.layout,
  TEST_ORDER_SEED: config.testOrderSeed,
  TEST_BATCH: config.batch,
  TEST_IDS: config.testIds,
  TEST_BUNDLED: config.bundled ? '1' : '0',
  // A browser WITH WebGPU (playwright.config.js): `--webgpu`, or a batch that
  // declares `webgpu: true` (its rows boot the Seedling wasm game).
  TEST_WEBGPU: (values.webgpu || process.env.npm_config_webgpu || batchNeedsWebgpu(config.batch)) ? '1' : '0',
  ...(config.port ? { TEST_PORT: config.port } : {})
};

// Validate the batch name HERE rather than letting the in-app filter throw.
// That throw happens inside applyLoadedState, which breaks init badly enough
// that the tests never start — Playwright then reports "page may have failed
// to load" 30 s later, which points at the wrong thing entirely. A typo
// should cost a second and name itself.
if (config.batch && !listBatchNames().includes(config.batch)) {
  console.error(
    `Unknown --batch '${config.batch}'. Known batches: ${listBatchNames().join(', ')}`
  );
  process.exit(2);
}

// The in-app budget override (TEST_AUTO_START_TIMEOUT_MS, ms; testLogic.js
// AUTO_START_TIMEOUT_MS). The page falls back to the default on a bad value,
// which would silently run a ten-minute budget the caller meant to shrink —
// so a bad value is refused here, before the lock, like a bad --batch.
if (process.env.TEST_AUTO_START_TIMEOUT_MS !== undefined
    && !/^[1-9][0-9]*$/.test(process.env.TEST_AUTO_START_TIMEOUT_MS)) {
  console.error(
    `TEST_AUTO_START_TIMEOUT_MS must be a positive integer (milliseconds); got '${process.env.TEST_AUTO_START_TIMEOUT_MS}'`
  );
  process.exit(2);
}

// Take the box BEFORE Playwright starts (scripts/test/testRunBox.js): a run
// must never start into another session's live measurement. Refuses by name
// (exit 1) unless --wait-for-box=<sec> queues; a holder's own child passes
// through on the token. Validation above runs first, so a typo costs no lock.
let waitSec;
try {
  waitSec = waitSecFrom(process.argv.slice(2));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
const { frozen } = await takeRunBox({
  name: runLockName({
    mode: config.mode, batch: config.batch, testIds: config.testIds,
    flavour: config.bundled ? 'bundled' : 'unbundled'
  }),
  waitSec
});

// Build the bundle UNDER the box (it is CPU the box's holder measures against),
// and before Playwright, so the page loads what this tree says.
if (config.bundled && !config.noBuild) {
  console.log('# --bundled: building frontend/dist/bundle.js (npm run build; --no-build skips)');
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const build = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'build', 'bundle-frontend.js')],
    { stdio: 'inherit', cwd: repoRoot });
  if (build.status !== 0) {
    console.error(`--bundled: the build failed (exit ${build.status}); not running the tests against a stale bundle.`);
    process.exit(build.status || 1);
  }
}
const resultsBefore = resultsFiles();

// Build Playwright command
const playwrightArgs = ['test', 'test_json/e2e/app.spec.js'];

// Add Playwright-specific flags if present
if (values.headed) playwrightArgs.push('--headed');
if (values.debug) playwrightArgs.push('--debug');
if (values.ui) playwrightArgs.push('--ui');

// Pass through any remaining arguments that weren't parsed
const additionalArgs = process.argv.slice(2).filter(arg =>
  !arg.startsWith('--mode=') &&
  !arg.startsWith('--game=') &&
  !arg.startsWith('--seed=') &&
  !arg.startsWith('--player=') &&
  !arg.startsWith('--rules=') &&
  !arg.startsWith('--layout=') &&
  !arg.startsWith('--testOrderSeed=') &&
  !arg.startsWith('--batch=') &&
  !arg.startsWith('--test=') &&
  !arg.startsWith('--port=') &&
  arg !== '--bundled' &&
  arg !== '--webgpu' &&
  arg !== '--no-build' &&
  !arg.startsWith(WAIT_FOR_BOX_FLAG) &&
  arg !== '--headed' &&
  arg !== '--debug' &&
  arg !== '--ui'
);
playwrightArgs.push(...additionalArgs);

// Run Playwright
const playwright = spawn('playwright', playwrightArgs, {
  env,
  stdio: 'inherit',
  shell: false
});

trackChild(playwright);

playwright.on('exit', async (code) => {
  // Record the head this run froze and whether the tree moved under it.
  stampResults({ before: resultsBefore, frozen, now: await endTreeState() });
  process.exit(code || 0);
});
