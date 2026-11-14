#!/usr/bin/env node
/**
 * js-model-writes.mjs — slice `rules-spinner-tag-alias`: run ONE committed tape through the JS model (`tapeRunner.runTape`
 * over the committed atlas) and print what the model records for its persistence writes: the `spinnerWrites` ledger
 * (where a tag −1 Spinner death is filed), `earnedClears`, and `jsRuntimeCore.liveClears(run)` — the exact list the JS
 * page's `reportClears` turns into `pendingCheck "<seq>|<level>|<tag>|0"` strings.
 *
 * Usage: node CC/docs/cloud-reports/rules-spinner-tag-alias-evidence/tools/js-model-writes.mjs [--tape=r8-l18-spinner-press]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const DEMO = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const { parseTape } = await import(join(DEMO, 'tapeFormat.js'));
const { runTape } = await import(join(DEMO, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(DEMO, 'levelSource.js'));
const { liveClears } = await import(join(DEMO, 'jsRuntimeCore.js'));
const name = arg('tape', 'r8-l18-spinner-press');
const tape = parseTape(JSON.parse(readFileSync(join(DEMO, 'fixtures/tapes', `${name}.json`), 'utf8')));
let lastRun = null;
const res = runTape(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, run) => { lastRun = run; } });
const run = lastRun;
const L = (n) => { try { return run.ledger(n) ?? null; } catch (e) { return `ERR ${e.message}`; } };
console.log(JSON.stringify({
    tape: name, ticks: res.ticks.length, finalLevel: res.final?.level ?? null,
    spinnerWrites: L('spinnerWrites'), earnedClears: L('earnedClears'), bankedClears: L('bankedClears'),
    liveClears: run ? liveClears(run) : null,
}, null, 1));
