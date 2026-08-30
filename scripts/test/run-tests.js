#!/usr/bin/env node

/**
 * Test runner wrapper that accepts parameters via both npm config AND command-line args
 * Supports both syntaxes:
 *   npm test --mode=test-spoilers --game=adventure
 *   npm test -- --mode=test-spoilers --game=adventure
 */

import { spawn } from 'child_process';
import { parseArgs } from 'node:util';
import { listBatchNames } from '../../frontend/modules/tests/testBatches.js';

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
  testIds: values.test || process.env.npm_config_test || ''
};

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
  TEST_IDS: config.testIds
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

playwright.on('exit', (code) => {
  process.exit(code || 0);
});
