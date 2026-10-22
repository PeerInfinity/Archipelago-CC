#!/usr/bin/env node
/**
 * ci-expected-red — **A GATE BATTERY'S RED ARMS, JUDGED AGAINST THE NAMED
 * TABLE OF EXPECTED REDS; EVERY OTHER RED FAILS THE JOB** (Seedling fidelity,
 * slice GATESUBJ — D4).
 *
 * The gate step itself stays `continue-on-error` (a standing-value reader — see
 * `ci-gates.mjs`). This step reads that step's `## CI-GATE |` lines and exits 1
 * when an arm printed a non-zero exit and is NOT in `CI_GATE_EXPECTED_RED`
 * (`ciExpectedRed.js`), when a listed arm is now GREEN (drop its entry), or
 * when a listed key names no CI arm at all (stale). One parseable line per
 * judged row: `## EXPECTED-RED | <verdict> | <key> | …`, then
 * `## EXPECTED-RED-DONE | …`.
 *
 * Run: node scripts/procgen/ci-expected-red.mjs /tmp/gates.log
 *      node scripts/procgen/ci-expected-red.mjs --table     # print the table, and exit
 */
import { readFileSync } from 'node:fs';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { CI_GATE_EXPECTED_RED, formatJudgement, judgeExpectedRed } from './ciExpectedRed.js';
import { ciGateArms } from './ciGatePlan.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT — `check-procgen-help.mjs` imports every instrument
 * here and reds one whose import DOES something (this file's first CI run did:
 * `procgen-help 448/1`, `IMPORT SIDE EFFECT`).
 */
function main() {
    const ARGV = process.argv.slice(2);
    if (ARGV.includes('--table')) {
        for (const [key, e] of Object.entries(CI_GATE_EXPECTED_RED)) {
            console.log(`${key}\n  owner: ${e.owner}\n  since: ${e.since}\n  why:   ${e.why}`);
        }
        process.exit(0);
    }
    const path = ARGV.find((a) => !a.startsWith('--'));
    if (!path) {
        console.log('FAIL: name the battery log to judge (e.g. /tmp/gates.log)');
        process.exit(1);
    }
    let log;
    try {
        log = readFileSync(path, 'utf8');
    } catch (e) {
        console.log(`FAIL: cannot read ${path} — ${e.message}`);
        process.exit(1);
    }
    const known = ciGateArms({ set: 'all' }).map((a) => a.key);
    const judged = judgeExpectedRed(log, CI_GATE_EXPECTED_RED, known);
    console.log(formatJudgement(judged));
    for (const r of judged.rows.filter((x) => !x.ok)) {
        console.log(`::error title=gate arm ${r.verdict}::${r.key}`);
    }
    process.exit(judged.red > 0 ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) main();
