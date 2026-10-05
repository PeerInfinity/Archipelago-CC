#!/usr/bin/env node
/**
 * census-soft-locks — **THE RULE-AWARE STRAND CHECK.** For each sphere of AP's own sphere log, it lists the regions
 * a player holding that sphere's cumulative inventory can reach from the start but cannot walk back from. The pure
 * half is `softLockCensus.js`.
 *
 * Where the slot declares `exporter[p].return_to_menu` (`procgenCore/restartWarp.js`), those regions are
 * RESTART-ONLY: a diagnostic list, because the Restart always gets the player back. Where it does not, they are
 * SOFT-LOCKS. Report-only, exit 0, unless `--strict` is given and a slot without the flag has a soft-lock.
 *
 * Run:
 *   node scripts/procgen/census-soft-locks.mjs                       # the playthrough preset and its seed-1 log
 *   node scripts/procgen/census-soft-locks.mjs --rules=<rules.json> --log=<sphere_log.jsonl>
 *   node scripts/procgen/census-soft-locks.mjs --json=<out.json>
 *   node scripts/procgen/census-soft-locks.mjs --strict
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

import { argvHelp } from './argvHelp.js';
import { softLockCensus, sphereInventories } from './softLockCensus.js';

argvHelp(import.meta.url);
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argOf = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const PRESET = join(REPO, 'frontend', 'presets', 'seedling_playthrough');
const rulesPath = argOf('rules') ?? join(PRESET, 'AP_1', 'AP_1_rules.json');
const logPath = argOf('log') ?? (() => {
    const seed = readdirSync(PRESET).find((d) => /^AP_\d{6,}$/.test(d));
    return join(PRESET, seed, `${seed}_sphere_log.jsonl`);
})();

const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
const log = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const census = softLockCensus(rules, sphereInventories(log));

console.log(`soft-lock census — ${rulesPath.slice(REPO.length + 1)}`);
console.log(`  start ${census.start}; return_to_menu ${census.returnToMenu ? 'DECLARED: the list is RESTART-ONLY (a diagnostic)' : 'absent: the list is SOFT-LOCKS'}`);
let worst = 0;
for (const row of census.rows) {
    worst = Math.max(worst, row.stuck.length);
    console.log(`  sphere ${row.sphere.padStart(5)}  reach ${String(row.reachable).padStart(3)}  ${census.kind} ${String(row.stuck.length).padStart(3)}`
        + `${row.stuck.length ? `  ${row.stuck.join(' ')}` : ''}`);
}
console.log(`${census.kind === 'soft-lock' ? 'SOFT-LOCKS' : 'RESTART-ONLY'}: max ${worst} region(s) in one sphere, `
    + `${census.rows.filter((r) => r.stuck.length).length} of ${census.rows.length} sphere(s) with any`);
const json = argOf('json');
if (json) writeFileSync(json, `${JSON.stringify(census, null, 1)}\n`);
if (process.argv.includes('--strict') && census.kind === 'soft-lock' && worst > 0) process.exit(1);
