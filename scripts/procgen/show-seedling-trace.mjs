#!/usr/bin/env node
/**
 * show-seedling-trace — read a solver DECISION TRACE sidecar and print it.
 *
 * The minimal renderer R8 slice 0 ships with the schema, per kickoff §3.4
 * and ⚖ ruling 4: the trace lands WITH the loop rather than after it,
 * because the JS-UI panel the user wants renders traces that already exist,
 * and retrofitting is the expensive path (the Cloudberry interview's
 * footnote-3 lesson — step-through visualisation is what made the design AI
 * debuggable).
 *
 * ⛔ A TRACE IS A SIDECAR, NEVER A TAPE FIELD. It lives beside the tape it
 * explains and is keyed to it by name; `decisionTrace.assertTraceIsSidecarOnly`
 * asserts the tape format never grew one.
 *
 * ── Usage ─────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/show-seedling-trace.mjs <name|path>            # summary
 *   node scripts/procgen/show-seedling-trace.mjs <name|path> --dump     # every row
 *   node scripts/procgen/show-seedling-trace.mjs <name|path> --json     # the summary as JSON
 *   node scripts/procgen/show-seedling-trace.mjs <name|path> --check    # against its tape
 *
 * `<name>` resolves to `frontend/modules/seedlingDemo/fixtures/traces/<name>.trace.json`;
 * anything containing a `/` or ending in `.json` is taken as a path.
 *
 * ⛓ `--check` is the row that makes a trace a MEASUREMENT rather than a log:
 * every row's `keys` must be exactly what `heldKeysAt` says the tape held on
 * that tick, plus the trap-142 silent-death query. It needs the tape to be a
 * committed fixture; without one it says so and exits 0 rather than passing
 * quietly (a check that cannot run is not a check that passed).
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
    parseDecisionTrace, summarizeTrace, formatTraceRow,
    traceTapeAgreementFindings, deathJumpFindings, traceSidecarName,
} from '../../frontend/modules/seedlingDemo/decisionTrace.js';
import { fixtureNames, loadTape } from '../../frontend/modules/seedlingDemo/fixtures/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACES_DIR = resolve(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo',
    'fixtures', 'traces');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
    process.stderr.write('usage: show-seedling-trace <name|path> '
        + '[--dump] [--json] [--check]\n');
    process.exit(2);
}

const path = (target.includes('/') || target.endsWith('.json'))
    ? resolve(target)
    : join(TRACES_DIR, traceSidecarName(target));

if (!existsSync(path)) {
    process.stderr.write(`show-seedling-trace: no trace at ${path}\n`);
    process.exit(2);
}

const trace = parseDecisionTrace(readFileSync(path, 'utf8'), path);
const summary = summarizeTrace(trace);

if (flags.has('--json')) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
    const line = (k, v) => process.stdout.write(`  ${k.padEnd(22)}${v}\n`);
    process.stdout.write(`\nTRACE ${summary.tape}  (${path})\n`);
    line('rows', `${summary.rows} decision(s) over ${summary.tickCount} tick(s)`);
    line('ticks', summary.rows ? `${summary.firstTick}..${summary.lastTick}` : '(none)');
    line('boot', `L${trace.boot.level} (${trace.boot.x},${trace.boot.y})`);
    line('goals', Object.entries(summary.goals).map(([k, n]) => `${k} x${n}`).join(', ') || '(none)');
    line('strategies', Object.entries(summary.verbs).map(([k, n]) => `${k} x${n}`).join(', ') || '(none)');
    line('obstacles', Object.entries(summary.obstacles).map(([k, n]) => `${k} x${n}`).join(', ') || '(none)');
    line('rejections', `${summary.rejections} across ${summary.rows} row(s)`);
    line('rows with a path', summary.rowsWithPath);
    // ⚠ REPORTED, never refused: the vocabulary lists are as of slice 0 and
    // the first producer is slice 2's solver. A new verb should be VISIBLE
    // the first time it runs, and a typo should be visible the same way.
    if (summary.unknownGoalKinds.length || summary.unknownStrategyVerbs.length) {
        line('⚠ outside the vocabulary',
            [...summary.unknownGoalKinds.map((k) => `goal:${k}`),
                ...summary.unknownStrategyVerbs.map((v) => `verb:${v}`)].join(', '));
    }
}

if (flags.has('--dump')) {
    process.stdout.write('\n');
    for (const row of trace.rows) process.stdout.write(`${formatTraceRow(row)}\n`);
}

if (flags.has('--check')) {
    process.stdout.write('\n');
    const findings = [...deathJumpFindings(trace)];
    if (fixtureNames().includes(trace.tape)) {
        findings.unshift(...traceTapeAgreementFindings(trace, loadTape(trace.tape)));
    } else {
        process.stdout.write(`  SKIP  "${trace.tape}" is not a committed fixture, so the `
            + 'key-agreement rows cannot run.\n        A check that cannot run is not a '
            + 'check that passed — the trap-142 query below still does.\n');
    }
    let bad = 0;
    for (const f of findings) {
        if (!f.ok) bad += 1;
        process.stdout.write(`  ${f.ok ? 'PASS' : 'FAIL'}  ${f.name}\n          ${f.detail}\n`);
    }
    process.stdout.write(`\n  ${findings.length - bad} pass, ${bad} fail\n`);
    if (bad) process.exit(1);
}

process.stdout.write('\n');
