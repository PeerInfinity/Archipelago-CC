#!/usr/bin/env node
/**
 * refresh-seedling-derived-rules — **THE DERIVED-RULE TABLE'S REFRESH, AS ONE COMMAND: DISPATCH → FETCH → COPY → CHAIN →
 * COUNT CHECK** (slice rule-table-doc-command; ⚖ Robert 2026-11-17 "Rule-table doc + command (Recommended)").
 *
 * `frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json` is made on CI by
 * `probe-seedling-derived-rules.mjs` (through `seedling-probe.yml`, manual dispatch only) and only READ by the producers
 * (`seedlingDerivedRuleTable.js`, `REGEN_RECIPE`). Until this file its refresh was four steps by hand. The doc page is
 * `docs/json/developer/procgen/seedling-derived-rules.md`.
 *
 * Usage:
 *   node scripts/procgen/refresh-seedling-derived-rules.mjs --check             # the default mode (no flag = --check)
 *   node scripts/procgen/refresh-seedling-derived-rules.mjs --dispatch [--ref=<branch>] [--wait-max=<min>]
 *   node scripts/procgen/refresh-seedling-derived-rules.mjs --run=<id> [--allow-sha-mismatch=<reason>]
 *   … either of the last two with --no-chain  (copy and count-check only; no regen-seedling.mjs --write)
 *
 *   --check     (default; offline, no `gh`) the COMMITTED table against its inputs (`tableStaleness`: payloadMd5,
 *               engineMd5, witnessMd5) and its counts against `seedling-derived-rules-expected.json` `summary.table`.
 *               Exit 1 when stale or off-count, naming the md5 that moved and printing the exact refresh command.
 *   --dispatch  `gh workflow run seedling-probe.yml --ref <ref> -f probes=probe-seedling-derived-rules.mjs`, then finds
 *               THAT run (the branch's remote head SHA + created after the dispatch, never "the newest"), waits for it and
 *               goes on as `--run`. `--ref` defaults to the current branch, whose remote head must be the local HEAD.
 *   --run=<id>  downloads that run's `probe-seedling-derived-rules-log` artifact; refuses unless the run's headSha is the
 *               local HEAD (`--allow-sha-mismatch=<reason>` only for a measured reason, printed); copies the artifact's
 *               `seedling-playthrough-derived-rules.json` over the committed table; runs the producer chain
 *               (`regen-seedling.mjs --write`, skipped by `--no-chain`); then the artifact's `derived-rules.json`
 *               SUMMARY against the pinned counts and the new table's staleness. ONE summary at the end: rows, counts vs
 *               expected, every moved verdict (element → old → new), staleness OK/STALE.
 *
 * ⛔ It never commits and never pushes. A moved VERDICT (a row added, removed or re-ruled; an exclusion moved) is printed in
 * capitals with REGEN_RECIPE's rule: the packet owes a tile-primitives designer review before the planner slots it.
 * `gh` is always `-R PeerInfinity/Archipelago-CC`; no run id is written down here.
 *
 * Exit codes: 0 all OK · 1 stale / drifted / a chain step failed · 2 refused (bad argv, SHA mismatch, no such run or
 * artifact, a `gh` error).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

// ⛓ Loaded, not `import {…}`ed: the instruments index credits a file with every flag a statically imported module parses,
// and this command accepts none of the probe's (`--shards`, `--levels`, `--out`) or the table's (`--print-engine-closure`).
// Both modules are inert on import (`check-procgen-help.mjs`).
const { MAZE_PRESET, TABLE_FILE, readDerivedRuleTable, tableStaleness } = await import('./seedlingDerivedRuleTable.js');
const { EXPECTED_FILE, expectedMismatches } = await import('./probe-seedling-derived-rules.mjs');

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const GH_REPO = 'PeerInfinity/Archipelago-CC';
export const WORKFLOW = 'seedling-probe.yml';
export const PROBE = 'probe-seedling-derived-rules.mjs';
/** The workflow uploads each probe's `test-results/seedling-probe/` as `<matrix.id>-log` (seedling-probe.yml). */
export const ARTIFACT = 'probe-seedling-derived-rules-log';
export const ARTIFACT_TABLE = 'seedling-playthrough-derived-rules.json';
export const ARTIFACT_ROWS = 'derived-rules.json';
const SELF = 'scripts/procgen/refresh-seedling-derived-rules.mjs';

/** The refresh command a stale report prints. */
export function refreshCommand(branch) {
    return `node ${SELF} --dispatch --ref=${branch || '<branch>'}`;
}

/** The flags. Throws on anything it does not know, or on two modes at once. Exported for the unit rows. */
export function parseArgs(argv) {
    const o = { mode: null, ref: null, runId: null, allowShaMismatch: null, chain: true, waitMaxMin: 90 };
    const setMode = (m) => {
        if (o.mode && o.mode !== m) throw new Error(`--${o.mode} and --${m} are two modes; pick one`);
        o.mode = m;
    };
    const value = (a) => a.slice(a.indexOf('=') + 1);
    for (const a of argv) {
        switch (a) {
            case '--check': setMode('check'); continue;
            case '--dispatch': setMode('dispatch'); continue;
            case '--no-chain': o.chain = false; continue;
            default: break;
        }
        if (a.startsWith('--run=')) {
            if (!/^\d+$/.test(value(a))) throw new Error(`--run takes a numeric run id, got ${JSON.stringify(value(a))}`);
            setMode('run'); o.runId = value(a);
        } else if (a.startsWith('--ref=')) {
            if (!value(a)) throw new Error('--ref takes a branch name');
            o.ref = value(a);
        } else if (a.startsWith('--allow-sha-mismatch=')) {
            if (!value(a).trim()) throw new Error('--allow-sha-mismatch takes the measured reason: --allow-sha-mismatch=<reason>');
            o.allowShaMismatch = value(a).trim();
        } else if (a.startsWith('--wait-max=')) {
            const n = Number(value(a));
            if (!value(a) || !Number.isFinite(n) || n <= 0) throw new Error(`--wait-max takes minutes, got ${JSON.stringify(value(a))}`);
            o.waitMaxMin = n;
        } else throw new Error(`unknown argument ${a}`);
    }
    o.mode ??= 'check';
    if (o.ref && o.mode !== 'dispatch') throw new Error('--ref goes with --dispatch only');
    if (o.mode === 'check' && (o.allowShaMismatch || !o.chain)) throw new Error('--check is offline: it takes no other flag');
    return o;
}

/**
 * THE run a dispatch made: a `workflow_dispatch` run at `headSha` created at or after `after` (ISO; a few seconds of clock
 * skew are allowed). None yet → null (keep polling); two → a refusal naming both, never a guess. Exported for the unit rows.
 */
export function selectDispatchedRun(runs, { headSha, after, skewMs = 5000 }) {
    const t = Date.parse(after) - skewMs;
    const hit = runs.filter((r) => r.headSha === headSha && (r.event ?? 'workflow_dispatch') === 'workflow_dispatch'
        && Date.parse(r.createdAt) >= t);
    if (hit.length > 1) {
        throw new Error(`${hit.length} ${WORKFLOW} runs at ${headSha.slice(0, 10)} were created after the dispatch `
            + `(${hit.map((r) => r.databaseId).join(', ')}): which one is ours is not decidable; pass --run=<id>`);
    }
    return hit[0] ?? null;
}

/** The run's SHA against the local HEAD. Exported for the unit rows. */
export function shaGate(runSha, localHead, reason) {
    if (runSha === localHead) return { ok: true, line: `run headSha ${runSha.slice(0, 10)} = local HEAD` };
    if (reason) {
        return { ok: true, line: `⚠ run headSha ${runSha.slice(0, 10)} ≠ local HEAD ${localHead.slice(0, 10)}: ALLOWED, reason: ${reason}` };
    }
    return {
        ok: false,
        line: `REFUSED: SHA MISMATCH — the run measured ${runSha.slice(0, 10)}, the local HEAD is ${localHead.slice(0, 10)}. A table `
            + 'measured at another tree is not this tree\'s table. Dispatch at HEAD, or pass --allow-sha-mismatch=<the measured reason>.',
    };
}

/** An element's state in a table: its rule, its exclusion, or absent. */
function elementStates(table) {
    const m = new Map();
    for (const r of table.rows ?? []) m.set(r.key, `rule ${JSON.stringify(r.rule)}`);
    for (const x of table.excluded ?? []) m.set(x.key, `excluded (${x.why})`);
    return m;
}

/**
 * Every element whose verdict moved between two tables — `{key, was, now}`, `absent` where the table does not hold it —
 * and every `inputs` field that moved. A row whose other fields moved but whose rule did not is not a verdict move.
 * Exported for the unit rows.
 */
export function tableDiff(was, now) {
    const a = elementStates(was);
    const b = elementStates(now);
    const moved = [];
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
        const x = a.get(key) ?? 'absent';
        const y = b.get(key) ?? 'absent';
        if (x !== y) moved.push({ key, was: x, now: y });
    }
    const inputs = [];
    for (const f of [...new Set([...Object.keys(was.inputs ?? {}), ...Object.keys(now.inputs ?? {})])].sort()) {
        const x = was.inputs?.[f] ?? null;
        const y = now.inputs?.[f] ?? null;
        if (x !== y) inputs.push({ field: f, was: x, now: y });
    }
    return { moved, inputs };
}

/** `tableStaleness`'s lines without the recipe each one repeats (the summary prints the command once). */
export function stalenessReasons(lines) {
    return lines.map((l) => l.replace(/^STALE derived-rule table: /, '').split(' — regenerate: ')[0]);
}

/** The table's own counts against `expected.summary.table`, one `name a=b` per count. */
function tableCountLines(table, expectedTable) {
    const got = { rows: table.rows?.length ?? 0, regions: new Set((table.rows ?? []).map((r) => r.region)).size, excluded: table.excluded?.length ?? 0 };
    const out = [];
    for (const k of ['rows', 'regions', 'excluded']) {
        const want = expectedTable?.[k];
        out.push({ k, got: got[k], want, ok: got[k] === want, declared: table.counts?.[k] });
    }
    return out;
}

/**
 * `--check`'s report on the committed table. `stale` = `tableStaleness`'s lines. Exported for the unit rows.
 * @returns {{ok: boolean, lines: string[]}}
 */
export function checkReport({ table, expectedTable, stale, branch }) {
    const lines = [];
    const counts = tableCountLines(table, expectedTable);
    const off = counts.filter((c) => !c.ok || (c.declared !== undefined && c.declared !== c.got));
    lines.push(`table ${relative(REPO, TABLE_FILE)}: measuredAt ${table.measuredAt ?? '?'}; `
        + `${counts.map((c) => `${c.k} ${c.got}`).join(' / ')}`);
    lines.push(`inputs: ${JSON.stringify(table.inputs)}`);
    lines.push(`counts vs ${relative(REPO, EXPECTED_FILE)} summary.table: `
        + `${counts.map((c) => `${c.k} ${c.got}${c.ok ? '=' : '≠'}${c.want}${c.declared !== undefined && c.declared !== c.got ? ` (the table's own counts block says ${c.declared})` : ''}`).join(', ')} `
        + `${off.length ? 'DRIFT' : 'OK'}`);
    if (stale.length) for (const r of stalenessReasons(stale)) lines.push(`staleness: STALE — ${r}`);
    else lines.push('staleness: OK (payloadMd5, engineMd5 and witnessMd5 match the tree)');
    const ok = !stale.length && !off.length;
    lines.push(ok ? 'OK: the committed derived-rule table is fresh and on count'
        : `${stale.length ? 'STALE' : 'DRIFT'}: refresh it — ${refreshCommand(branch)} (then commit the table in the same packet as the change that staled it)`);
    return { ok, lines };
}

/**
 * The one summary a `--run` prints. Exported for the unit rows.
 * @returns {{ok: boolean, verdictsMoved: boolean, lines: string[]}}
 */
export function runSummary({ runId, newTable, identical, expectedTable, drift, diff, stale, chain }) {
    const lines = [`SUMMARY (run ${runId}):`];
    const counts = tableCountLines(newTable, expectedTable);
    lines.push(`  table: ${identical ? 'BYTE-IDENTICAL to the committed table' : 'differs from the committed table (copied over it)'}; `
        + `measuredAt ${newTable.measuredAt}; ${counts.map((c) => `${c.k} ${c.got}${c.ok ? '=' : '≠'}${c.want}`).join(', ')} (vs expected summary.table)`);
    lines.push(`  pinned counts (derived-rules.json SUMMARY vs ${relative(REPO, EXPECTED_FILE)}): ${drift.length ? `${drift.length} DRIFT(S)` : 'every pinned count matches'}`);
    for (const d of drift) lines.push(`    DRIFT ${d}`);
    for (const i of diff.inputs) lines.push(`  inputs.${i.field}: ${i.was} → ${i.now}`);
    if (diff.moved.length) {
        lines.push(`  ${diff.moved.length} VERDICT(S) MOVED:`);
        for (const m of diff.moved) lines.push(`    ${m.key}: ${m.was} → ${m.now}`);
    } else lines.push('  verdicts moved: none');
    lines.push(`  chain (regen-seedling.mjs --write): ${chain}`);
    if (stale.length) for (const r of stalenessReasons(stale)) lines.push(`  staleness: STALE — ${r}`);
    else lines.push('  staleness: OK');
    const verdictsMoved = diff.moved.length > 0;
    if (verdictsMoved) {
        lines.push('  ⚠⚠ THE TABLE\'S VERDICTS MOVED. Per REGEN_RECIPE: if the regenerated table\'s VERDICTS move (its rows or exclusions, '
            + 'not only its `inputs` hashes), the packet owes a tile-primitives designer review before the planner slots it.');
    }
    const ok = !drift.length && !stale.length && !counts.some((c) => !c.ok) && !/FAILED|exit [1-9]/.test(chain);
    lines.push(ok ? '  RESULT: OK — nothing committed or pushed; commit the table in the same packet as the change that staled it'
        : '  RESULT: NOT OK — see the lines above; nothing committed or pushed');
    return { ok, verdictsMoved, lines };
}

// ── the side-effecting half (gh, git, the chain) ─────────────────────────────────────────────────────────────────────

function sh(cmd, args, { allowFail = false } = {}) {
    const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status !== 0 && !allowFail) throw new Refusal(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout || String(r.error)).trim()}`);
    return r;
}
const gh = (...args) => sh('gh', [...args, '-R', GH_REPO]);
const git = (...args) => sh('git', args).stdout.trim();
class Refusal extends Error {}
const sleep = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

/** The workflow's display name (its `name:` line), which `gh run view` reports. */
function workflowName() {
    return /^name:\s*(.+)$/m.exec(readFileSync(join(REPO, '.github/workflows', WORKFLOW), 'utf8'))[1].trim();
}

async function waitForRun(id, waitMaxMin) {
    const until = Date.now() + waitMaxMin * 60_000;
    for (;;) {
        const v = JSON.parse(gh('run', 'view', id, '--json', 'status,conclusion').stdout);
        if (v.status === 'completed') return v;
        if (Date.now() > until) throw new Refusal(`run ${id} still ${v.status} after ${waitMaxMin} min: re-run with --run=${id} once it completes`);
        console.log(`  … run ${id} ${v.status}`);
        await sleep(30_000);
    }
}

async function dispatch(opts) {
    const branch = opts.ref ?? git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch === 'HEAD') throw new Refusal('detached HEAD: pass --ref=<branch>');
    const head = git('rev-parse', 'HEAD');
    const remote = (sh('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).stdout.split(/\s+/)[0] || '');
    if (!remote) throw new Refusal(`origin has no branch ${branch}: push it first`);
    if (remote !== head && !opts.allowShaMismatch) {
        throw new Refusal(`origin/${branch} is ${remote.slice(0, 10)}, the local HEAD is ${head.slice(0, 10)}: the run would measure `
            + 'another tree. Push first (or pass --allow-sha-mismatch=<reason>).');
    }
    const after = new Date().toISOString();
    console.log(`dispatch: ${WORKFLOW} --ref ${branch} -f probes=${PROBE} (expect headSha ${remote.slice(0, 10)}, created ≥ ${after})`);
    gh('workflow', 'run', WORKFLOW, '--ref', branch, '-f', `probes=${PROBE}`);
    let run = null;
    for (let i = 0; i < 24 && !run; i += 1) {
        await sleep(5000);
        const runs = JSON.parse(gh('run', 'list', '--workflow', WORKFLOW, '--branch', branch, '--event', 'workflow_dispatch',
            '--json', 'databaseId,headSha,createdAt,event,status', '-L', '30').stdout);
        run = selectDispatchedRun(runs, { headSha: remote, after });
    }
    if (!run) throw new Refusal(`no ${WORKFLOW} run at ${remote.slice(0, 10)} appeared within 2 min of the dispatch`);
    console.log(`dispatched run: ${run.databaseId} (https://github.com/${GH_REPO}/actions/runs/${run.databaseId})`);
    await waitForRun(String(run.databaseId), opts.waitMaxMin);
    return String(run.databaseId);
}

async function fromRun(runId, opts) {
    const v = JSON.parse(gh('run', 'view', runId, '--json', 'headSha,headBranch,status,conclusion,workflowName,createdAt').stdout);
    if (v.workflowName !== workflowName()) throw new Refusal(`run ${runId} is "${v.workflowName}", not ${WORKFLOW} ("${workflowName()}")`);
    if (v.status !== 'completed') throw new Refusal(`run ${runId} is ${v.status}: wait for it`);
    console.log(`run ${runId}: ${v.workflowName} on ${v.headBranch} at ${v.headSha.slice(0, 10)}, ${v.conclusion} (a probe FAILS when the table it emits `
        + 'differs from the committed one, so a red run is the normal shape of a refresh)');
    const gate = shaGate(v.headSha, git('rev-parse', 'HEAD'), opts.allowShaMismatch);
    console.log(gate.line);
    if (!gate.ok) throw new Refusal(gate.line.replace(/^REFUSED: /, ''));
    const dir = mkdtempSync(join(tmpdir(), 'refresh-derived-rules-'));
    gh('run', 'download', runId, '-n', ARTIFACT, '-D', dir);
    const src = join(dir, ARTIFACT_TABLE);
    const rowsFile = join(dir, ARTIFACT_ROWS);
    for (const f of [src, rowsFile]) if (!existsSync(f)) throw new Refusal(`run ${runId}'s ${ARTIFACT} has no ${relative(dir, f)} (a dead shard?)`);
    const newTable = JSON.parse(readFileSync(src, 'utf8'));
    if (!newTable.inputs) throw new Refusal(`run ${runId}'s table has no \`inputs\` block: a --levels run, not a whole-game one`);
    const oldBytes = existsSync(TABLE_FILE) ? readFileSync(TABLE_FILE) : Buffer.alloc(0);
    const oldTable = readDerivedRuleTable();
    const identical = Buffer.compare(oldBytes, readFileSync(src)) === 0;
    copyFileSync(src, TABLE_FILE);
    console.log(`copied ${ARTIFACT}/${ARTIFACT_TABLE} → ${relative(REPO, TABLE_FILE)} (${identical ? 'byte-identical' : 'CHANGED'}; artifact kept in ${dir})`);
    let chain = 'skipped (--no-chain)';
    if (opts.chain) {
        console.log('chain: node scripts/procgen/regen-seedling.mjs --write');
        const r = spawnSync('node', ['scripts/procgen/regen-seedling.mjs', '--write'], { cwd: REPO, stdio: 'inherit' });
        chain = r.status === 0 ? 'every step OK' : `FAILED (exit ${r.status}; its lines above name the step)`;
    }
    const expected = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'));
    const drift = expectedMismatches(JSON.parse(readFileSync(rowsFile, 'utf8')).summary, expected.summary);
    const stale = tableStaleness(newTable, JSON.parse(readFileSync(MAZE_PRESET, 'utf8')));
    const s = runSummary({ runId, newTable, identical, expectedTable: expected.summary.table, drift, diff: tableDiff(oldTable, newTable), stale, chain });
    for (const l of s.lines) console.log(l);
    return s.ok ? 0 : 1;
}

function check() {
    const expected = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'));
    const table = readDerivedRuleTable();
    const stale = tableStaleness(table, JSON.parse(readFileSync(MAZE_PRESET, 'utf8')));
    const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }).stdout?.trim();
    const r = checkReport({ table, expectedTable: expected.summary.table, stale, branch: branch === 'HEAD' ? null : branch });
    for (const l of r.lines) console.log(l);
    return r.ok ? 0 : 1;
}

async function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (e) {
        console.error(`refresh-seedling-derived-rules: ${e.message}. See --help.`);
        process.exit(2);
    }
    try {
        if (opts.mode === 'check') process.exit(check());
        const runId = opts.mode === 'dispatch' ? await dispatch(opts) : opts.runId;
        process.exit(await fromRun(runId, opts));
    } catch (e) {
        if (!(e instanceof Refusal)) throw e;
        console.error(`REFUSED: ${e.message}`);
        process.exit(2);
    }
}

if (isEntryPoint(import.meta.url)) await main();
