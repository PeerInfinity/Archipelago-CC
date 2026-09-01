#!/usr/bin/env node
/**
 * ci-gates — **THE GATES CI CAN RUN, RUN IN CI, ONE PARSEABLE LINE EACH**
 * (R9 slice P3b (g), ⚖ ruling 54 (6); standing-values CI arc S3, ⚖ ruling 72).
 *
 * ── ⛔⛔ THE MEASUREMENT THAT SHAPED THIS, AND WHAT S3 CHANGED ────────
 *
 * ⚖ 54 (6) reads *"more standing rows quoted from CI by SHA (every headless
 * gate; only Windows/GPU rows stay local)"*. P3b could only reach the HEADLESS
 * gates — six of the thirty-three the roster reads today (the header line
 * below is the measurement; this sentence is prose) — and said so rather than
 * pretending otherwise. ⛓ S3 reaches the rest of what a runner can answer:
 * `ubuntu-latest` has headless Chromium, and every one of the browser rows is
 * banked green from exactly that. What stays behind is the FOUR Windows rows,
 * which hold `/mnt/c/Windows/py.exe` as a literal and could not resolve their
 * driver on a runner at all (⚖ 72 (a): they stay box-measured).
 *
 * ⛔ THE PREDICATE IS `ciGatePlan.ciRunnable`, IN ONE PLACE. This file, the
 * workflow's job matrix and `ci-summary.mjs`'s refusal all read it. Three
 * copies of "can CI answer this?" is how a refusal outlives the thing it
 * refused.
 *
 * ── THE LINE, AND WHY IT IS SHAPED LIKE THIS ─────────────────────────
 *
 *   ## CI-GATE | <key> | <value> | exit=<n> | <the gate's own total line>
 *
 * Pipe-delimited because a standing KEY contains spaces and a colon, and a
 * whitespace-delimited format would need quoting rules nobody would get right
 * on the second reader. `ci-summary.mjs --gate=<key> <sha>` is that reader,
 * and since S3 it reads the lines across EVERY job of the run.
 *
 * ── ⛓⛓⛓ A BROWSER RUN IS A BATTERY, NOT A LIST OF INVOCATIONS ───────
 *
 * This file TAKES THE BOX for a browser selection and the gates it spawns
 * recognise the holder's token (`boxLock` rule 3) — which is what makes it
 * `gates.mjs`-equivalent machinery rather than twenty-four standalone runs.
 * ⛔ That is not ceremony: `check-procgen-demos` skips a `cli` row that
 * invokes a sibling roster gate ONLY under a battery (⚖ 71 (a), SG1), and a
 * standalone run pays those sibling drives again — measured at ~+187 s.
 * ⛓ On a runner the lock contends with nothing; it is the TOKEN the dedup
 * reads, and taking it is also correct on the box, where this file would
 * otherwise perturb a live measurement.
 *
 * ── ⛔ WHAT CI CANNOT ANSWER IS NAMED, NEVER SILENTLY GREEN ───────────
 *
 * `check-seedling-producer-boundaries.mjs` reads a MACHINE-GLOBAL latch cache
 * under `/mnt/c/playwright` that exists on exactly one box. Its VALUE here
 * would be `0 VERIFIED / 18 REFUSED` — measured, by pointing both cache
 * directories at paths that do not exist — which is §44.9 item 2's *"a row
 * that gates nothing"*. So it runs in `--structure` mode under the key
 * `structure: …`, which is a DIFFERENT KEY from its value row and can never
 * be quoted as one, and the value row stays the box's.
 *
 * ⛔ THIS STEP IS A STANDING-VALUE READER, NOT A MERGE GATE. It is wired with
 * `continue-on-error: true`, deliberately: `check-seedling-full-tier-owed` is
 * RED whenever a full tier is owed, which is a SCHEDULING fact and must not
 * block every push. The red is not hidden — it is in this step's own printed
 * line, and `ci-summary.mjs` reads the LINE, never the job conclusion (12g′'s
 * lesson: `continue-on-error` hides a red at the JOB level).
 *
 * Run:
 *   node scripts/procgen/ci-gates.mjs                    the headless gates
 *   node scripts/procgen/ci-gates.mjs --set=browser      every browser arm
 *   node scripts/procgen/ci-gates.mjs --set=browser --shard=1 --host=http://localhost:8000
 *   node scripts/procgen/ci-gates.mjs --plan [--json]    the shard partition
 *   --set=headless|browser|all   --json   --wait-for-box=<sec>
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { releaseBoxLock, takeBoxLock } from './boxLock.js';
import { CI_SHARD_BUDGET_MS, ciGatePlanFor, ciRunnable } from './ciGatePlan.js';
import { LOCAL_HOST, REPO, gateRoster } from './gateRoster.js';
import { headlineOf } from './standingValues.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const run = promisify(execFile);
const ARGV = process.argv.slice(2);
const flag = (name) => ARGV.includes(`--${name}`);
const arg = (name, fallback = null) => {
    const hit = ARGV.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};

const JSON_OUT = flag('json');
const SET = arg('set', 'headless');
const SHARD = arg('shard');
const HOST = arg('host', LOCAL_HOST);
const WAIT_FOR_BOX = Number(arg('wait-for-box', '0')) || 0;

/** ⛓ The marker every consumer greps for — ONE spelling, exported. */
export const CI_GATE_MARK = '## CI-GATE |';

const { arms, shards, budgetMs, measuredAt } = ciGatePlanFor({
    repo: REPO, host: HOST, set: SET, budgetMs: CI_SHARD_BUDGET_MS,
});

/* ── --plan: the matrix the workflow interpolates ────────────────────── */

/**
 * ⛔⛔ THE MATRIX IS PUBLISHED, NEVER TYPED (⚖ 17). `unittests_frontend.yml`'s
 * first job prints this and feeds it to `fromJSON`; each shard job recomputes
 * the same plan from the same tree and takes its slice by INDEX. A shard list
 * committed to the workflow would be stale the day a gate is added — and
 * stale in the direction that drops one silently.
 */
if (flag('plan')) {
    if (JSON_OUT) {
        console.log(JSON.stringify(shards.map((s) => ({
            id: s.id, name: s.name, arms: s.keys.length, ms: s.ms,
        }))));
        process.exit(0);
    }
    console.log(`# ci-gates --plan — ${arms.length} ${SET} arm(s) in ${shards.length} shard(s), `
        + `budget ${(budgetMs / 1000).toFixed(0)}s of BANKED (this-box) time per shard; `
        + `bank measured at ${measuredAt ? measuredAt.slice(0, 9) : '(no bank)'}`);
    for (const s of shards) {
        console.log(`\n## shard ${s.id} — ${(s.ms / 1000).toFixed(1)}s banked, `
            + `${s.keys.length} arm(s)${s.unpriced ? `, ${s.unpriced} UNPRICED (a row with no `
                + 'banked `ms` is priced at the whole budget, so it lands alone)' : ''}`);
        for (const k of s.keys) console.log(`     ${k}`);
    }
    process.exit(0);
}

/* ── which arms this invocation runs ─────────────────────────────────── */

let selected = arms;
let shardNote = null;
if (SHARD !== null) {
    const shard = shards[Number(SHARD)];
    if (!shard) {
        console.log(`FAIL: no shard ${JSON.stringify(SHARD)} — the plan has `
            + `${shards.length} (0..${shards.length - 1})`);
        process.exit(1);
    }
    const want = new Set(shard.keys);
    selected = arms.filter((a) => want.has(a.key));
    shardNote = `shard ${shard.id} of ${shards.length} — ${shard.name}; `
        + `${(shard.ms / 1000).toFixed(1)}s banked`;
}

const roster = gateRoster({ repo: REPO });
/** ⛔ The gates CI cannot run AT ALL — named in every job's own log, so no
 *  log is a partial picture and nothing reads as green that never ran. */
const unrunnable = roster.filter((g) => !ciRunnable(g));
/** ⛓ …and the arms this RUN answers that this JOB does not — a sibling
 *  shard's, not a skip. The distinction is the whole point of naming both. */
const elsewhereInRun = arms.filter((a) => !selected.includes(a));

console.log(`# ci-gates — the ${SET} procgen gates, on this pushed head\n`);
console.log(`## ${selected.length} arm(s) run here, out of ${arms.length} the `
    + `\`${SET}\` set holds and ${roster.length} gate(s) on the roster. `
    + `${unrunnable.length} need a Windows GPU and are SKIPPED BY NAME below — `
    + 'never counted, never implied green.');
if (shardNote) console.log(`## ${shardNote}`);

const SPENDS_BOX = selected.filter((a) => a.gate.browser);
if (SPENDS_BOX.length) {
    /**
     * ⛓⛓ THE RUNNER TAKES THE BOX ONCE FOR ALL ITS ARMS, and each gate's own
     * preamble recognises itself as the holder's CHILD (`boxLock` rule 3).
     * ⛔ On a runner nothing contends for it — what the token buys there is
     * SG1's demos dedup, which is licensed by `BOX.passthrough` alone.
     */
    try {
        takeBoxLock({
            name: `ci-gates ${SET}${shardNote ? ` (${shardNote})` : ''} — `
                + `${SPENDS_BOX.length} of ${selected.length} arm(s) spend the machine`,
            kind: 'browser', repo: REPO, waitSec: WAIT_FOR_BOX,
        });
    } catch (e) {
        console.log(e.message);
        process.exit(1);
    }
} else {
    console.log(`# box lock: NOT TAKEN — none of ${selected.length} selected arm(s) is a browser `
        + 'row, so this run does not contend for the machine');
}

/* ── the run ─────────────────────────────────────────────────────────── */

const rows = [];
for (const arm of selected) {
    const { gate, argv } = arm;
    let out = '';
    let exit = 0;
    const t0 = Date.now();
    try {
        const r = await run('node', [gate.path, ...argv], { cwd: REPO, maxBuffer: 1 << 26 });
        out = `${r.stdout}${r.stderr}`;
    } catch (e) {
        exit = typeof e.code === 'number' ? e.code : 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e);
    }
    const { value, total } = headlineOf('gate', out);
    const ms = Date.now() - t0;
    rows.push({ key: arm.key, file: gate.file, argv, value, exit, total, ms,
        face: gate.ciFace?.prefix ?? null });
    console.log(`${CI_GATE_MARK} ${arm.key} | ${value} | exit=${exit} | ${total ?? '(no total)'}`);
    /**
     * ⛓⛓ …AND WHAT IT COST HERE, BESIDE WHAT IT COSTS ON THE BOX. This is the
     * runner-headroom measurement S3 exists to take: `seedling-wasm-element`
     * is 934.7 banked seconds of headless SwiftShader and whether a shared
     * runner can carry that is a genuine open question. ⛔ It is a SEPARATE
     * line, never a sixth field: `parseGateLines` folds every field after
     * `exit=` into `total`, so widening the line would move a published value.
     */
    console.log(`##   ms | ${arm.key} | here=${(ms / 1000).toFixed(1)}s`);
    if (exit !== 0 || value.includes('/0/')) {
        /**
         * ⛔⛔ **A RED LINE WITH NO EVIDENCE IS A RED NOBODY CAN ACT ON.** The
         * first CI run of this step printed `gate: seedling-full-tier-owed |
         * 0/1` and nothing else, and the reason — a depth-1 clone with no
         * baseline commit — was nowhere in the log.
         */
        for (const line of out.split('\n')
            .filter((l) => l.startsWith('FAIL:') || l.startsWith('SKIP:')).slice(0, 8)) {
            console.log(`      ${line}`);
        }
    }
}

console.log('');
for (const g of unrunnable) {
    console.log(`## CI-SKIPPED | ${g.file} | needs a Windows GPU — not run here, and NOT green`);
}
for (const a of elsewhereInRun) {
    console.log(`## CI-ELSEWHERE | ${a.key} | a sibling shard of THIS run answers it — `
        + 'not skipped, and not green either until its own line says so');
}

/**
 * ⛔ THE STEP'S OWN EXIT IS 0 BY DESIGN. Its job is to PRINT; the reds live in
 * the lines above and are read by `ci-summary.mjs --gate=` at a SHA. An exit
 * code here would either block every push on an owed measurement or, wrapped
 * in `continue-on-error`, be the exact thing 12g′ found hiding a red.
 */
if (JSON_OUT) console.log(JSON.stringify({ set: SET, shard: SHARD, rows }, null, 2));
console.log(`\n${rows.length} ${SET} arm(s) reported; `
    + `${rows.filter((r) => r.exit !== 0).length} non-zero; `
    + `${unrunnable.length} skipped by name; ${elsewhereInRun.length} in sibling shard(s). `
    + `${(rows.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1)}s of arm time here.`);
releaseBoxLock();
process.exit(0);
