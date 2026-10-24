/**
 * The divergence sweep's MERGE verdict (`.github/workflows/seedling-divergence-sweep.yml`, the merge job): the
 * shards' rows against the plan job's partition. Pure (no browser; its one import, `seedlingHitTicks.js`, is pure
 * too), so the merge job runs it off a sparse checkout and a unit test drives it.
 *
 * A row is not asserted about the MODEL (a refusal or a divergence is a row); the merge goes red only when the SWEEP
 * is incomplete, BY NAME:
 *   · `harness-hang`   a leg whose page hung in a harness step (H1: the probe's bound expired, the browser was
 *                      SIGKILLed and the shard moved on) — named with its step;
 *   · never reported   a plan id with no row at all (a shard cancelled / timed out / crashed) — listed per shard, and
 *                      the union printed as one `REDISPATCH ids=` line, the re-dispatch input as is;
 *   · `stage-failed`, `dirty-start`, `page-boot-failed`, and a distinct-leg count short of the plan (as before);
 *   · a MIXED-BUDGET merge (S5-1): rows whose `legBudgetMs` stamp (absent = the default) differs from another row's or
 *                      from the plan's — a 90 s timeout and a 300 s one are not the same row, so they never merge silently.
 *   · a MIXED-WINDOW merge (slice `seedling-js-dash-window`): rows whose solver-knob stamp (`upgradeWindowWork`,
 *                      `dashOnlyWindow`, `dashShape`; absent = today's) differs from the plan's — a plan cut at
 *                      another window, or solved under another dash shape (slice `seedling-js-dash-shape-stamp`), is
 *                      another plan.
 * Informational, never a fail (S5-2, `seedlingHitTicks.js`): one `UNBILLED-HIT:` line per leg whose game took more
 * hits than its plans billed (hit ticks vs billed ticks vs the first divergence, and whether the hit IS it), a count
 * of rows with no hit ticks (`UNBILLED-HIT-UNKNOWN`, rows from before S5-2 — unknown, never 0), and the
 * `UNBILLED-GATE` refusal count (fidelity's `unbilled-damage` obstacle kind).
 * Each row's `seamTime` (the arrival game clock its first solve was staged at) prints on one `SEAM-TIME:` line, `id@time:end`.
 * A `HANG:` line in a shard log with no row behind it (a teardown that hung AFTER its legs reported) is a WARNING:
 * the rows are complete.
 * RUNNER SPEED (slice `seedling-js-runner-stamp`), informational, never a fail: one `RUNNER:` line per shard, its
 * median page boot (the logs' `booted in` lines) and its play rate (ticks drained per second of play, from the rows),
 * each also as a fraction of the run's median shard; a shard below `SLOW_RUNNER_FRACTION` on either is
 * `SLOW-RUNNER`, and each `timeout` row prints on a `TIMEOUT:` line with its shard and that tag — so a timeout on a
 * degraded runner (§5.102: run 38994029714 shard 9, play ~4x slow) reads as one at a glance. Read from what the shard
 * already did: no extra game work, and nothing a solve is asked or answers moves.
 *
 * CLI (the merge job): node scripts/procgen/seedlingDivergenceMerge.js <rows.jsonl> <plan.json> [<shard.log>…]
 * Prints the verdict lines; exit 1 when any line is a `MERGE-FAIL`.
 * CLI (a shard's summary): node scripts/procgen/seedlingDivergenceMerge.js --shard-stamp <rows-i.jsonl> <shard.log>
 * Prints that shard's `RUNNER:` line (no run median: one shard alone has nothing to compare against).
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { unbilledHitCensus } from './seedlingHitTicks.js';

/** ⛓ The probe's `LEG_BUDGET_MS_DEFAULT` (this module imports only the pure `seedlingHitTicks.js`: the merge job runs
 *  both off a sparse checkout). */
export const LEG_BUDGET_MS_DEFAULT = 90000;

/** ⛓ The probe's `SOLVER_KNOB_KEYS` (restated for the sparse checkout; a unit test holds the two equal). */
export const SOLVER_KNOB_KEYS = Object.freeze(['upgradeWindowWork', 'dashOnlyWindow', 'dashShape']);

/** A row's / the plan's leg budget: its `legBudgetMs` stamp, the default when absent. */
export const legBudgetOf = (x) => x?.legBudgetMs ?? LEG_BUDGET_MS_DEFAULT;

/**
 * ⛓ RUNNER SPEED — a shard is flagged `SLOW-RUNNER` when its boot speed or its play rate is below this fraction of
 * the run's median shard. MEASURED over the 11 full 851-row sweeps of §5.102 (38994029714, 39070804748 …
 * 39153418159; 110 shards): every healthy shard sat at ≥ 0.72 (boot) and ≥ 0.91 (play); the one degraded runner
 * (38994029714 shard 9) at 0.19 and 0.35.
 */
export const SLOW_RUNNER_FRACTION = 0.5;

const median = (xs) => {
    const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** A shard log's number (its `SHARD i/n:` line) and its page boots in s (its `INFO: page N booted in X s` lines). */
export function bootsOfLog(text) {
    const shard = /^SHARD (\d+)\//m.exec(text);
    const boots = [...text.matchAll(/^INFO: page \d+ booted in (\d+) s/gm)].map((m) => Number(m[1]));
    return { shard: shard ? Number(shard[1]) : null, boots };
}

/**
 * A row's PLAY: the ticks it drained, and the wall ms of its leg minus its solves (`history[].solvedMs`) and its
 * latch waits (`latchWaits[].waitedMs`; absent on rows before §5.89 = 0). What is left still carries the ship and the
 * tail, the same on every shard, so a ratio between shards cancels it. `null` for a row that drained nothing.
 */
export function playOfRow(r) {
    const drained = Number(r?.rowsDrained) || 0;
    if (drained <= 0 || !Number.isFinite(r?.ms)) return null;
    const sum = (xs, k) => (xs ?? []).reduce((a, x) => a + (Number(x?.[k]) || 0), 0);
    const playMs = r.ms - sum(r.history, 'solvedMs') - sum(r.latchWaits, 'waitedMs');
    return playMs > 0 ? { drained, playMs } : null;
}

/** A shard's play rate, pooled over its rows (Σ drained / Σ play s): long legs weigh more. `null` with no play. */
export function playRate(rows) {
    let drained = 0;
    let playMs = 0;
    for (const r of rows) {
        const p = playOfRow(r);
        if (p) { drained += p.drained; playMs += p.playMs; }
    }
    return playMs > 0 ? { ticksPerSec: (drained * 1000) / playMs, legs: rows.filter((r) => playOfRow(r)).length } : null;
}

/** One shard's stamp: `{ shard, bootS (median), boots, ticksPerSec, playLegs }` (null where it has no data). */
export function shardStamp({ shard, rows = [], boots = [] }) {
    const p = playRate(rows);
    return { shard, bootS: median(boots), boots: boots.length, ticksPerSec: p?.ticksPerSec ?? null, playLegs: p?.legs ?? 0 };
}

const fmt = (x, d = 1) => (x === null ? '-' : x.toFixed(d));

/** A shard's `RUNNER:` line (with `of` = the run's fractions when there is a run to compare against). */
export function runnerLine(st, of) {
    const boot = st.bootS === null ? 'boot -' : `boot ${fmt(st.bootS)} s (${st.boots} page(s))`;
    const play = st.ticksPerSec === null ? 'play -' : `play ${fmt(st.ticksPerSec)} ticks/s (${st.playLegs} leg(s))`;
    if (!of) return `RUNNER: shard ${st.shard} ${boot}, ${play}`;
    const x = (f) => (f === null ? '' : ` x${fmt(f, 2)}`);
    return `RUNNER: shard ${st.shard} ${boot}${x(of.boot)}, ${play}${x(of.play)}${of.slow ? ' SLOW-RUNNER' : ''}`;
}

/**
 * The run's stamp: each shard's speed as a fraction of the median shard (boot: median s / the shard's s, so higher is
 * faster on both), `slow` when either is below `fraction`. Returns `{ stamps, medians, slow: Set<shard>, lines }`.
 */
export function runnerStamp(stamps, fraction = SLOW_RUNNER_FRACTION) {
    const medians = { bootS: median(stamps.map((s) => s.bootS)), ticksPerSec: median(stamps.map((s) => s.ticksPerSec)) };
    const slow = new Set();
    const lines = [];
    if (!stamps.some((s) => s.bootS !== null || s.ticksPerSec !== null)) return { stamps, medians, slow, lines };
    lines.push(`RUNNER-MEDIAN: boot ${fmt(medians.bootS)} s, play ${fmt(medians.ticksPerSec)} ticks/s; SLOW-RUNNER below x${fraction} of either`);
    for (const st of [...stamps].sort((a, b) => a.shard - b.shard)) {
        const boot = st.bootS > 0 && medians.bootS !== null ? medians.bootS / st.bootS : null;
        const play = st.ticksPerSec !== null && medians.ticksPerSec > 0 ? st.ticksPerSec / medians.ticksPerSec : null;
        const isSlow = (boot !== null && boot < fraction) || (play !== null && play < fraction);
        if (isSlow) slow.add(st.shard);
        lines.push(runnerLine(st, { boot, play, slow: isSlow }));
    }
    return { stamps, medians, slow, lines };
}

/**
 * The verdict. `plan` is `--shard-plan=<n> --json` (`{ legs, shards: [{ shard, ids }] }`); `hangLines` the `HANG:`
 * lines of the shard logs. Returns the lines to print, whether the merge fails, the never-reported ids per shard and
 * their union (sorted).
 */
export function mergeVerdict({ rows, plan, hangLines = [], shardLogs = [] }) {
    const lines = [];
    const fail = (msg) => lines.push(`MERGE-FAIL: ${msg}`);
    const ids = new Set(rows.map((r) => r.id));
    const ends = {};
    for (const r of rows) ends[r.end] = (ends[r.end] || 0) + 1;
    const count = (end) => rows.filter((r) => r.end === end).length;
    if (count('stage-failed')) fail(`${count('stage-failed')} leg(s) whose staged event flags never reached the game (stage-failed)`);
    if (count('dirty-start')) fail(`${count('dirty-start')} leg(s) started on a game already holding items (dirty-start)`);
    const hung = rows.filter((r) => r.end === 'harness-hang');
    if (hung.length) {
        fail(`${hung.length} leg(s) on a page that HUNG in a harness step (harness-hang): ${hung
            .map((r) => `${r.id} (page ${r.page}, ${r.hang?.step ?? '?'}${r.hang?.started ? ', leg started' : ''})`).join(', ')}`);
    }
    // ⛓ THE LEG BUDGET — one budget per merge, and it is the plan's
    const budgets = new Map();
    for (const r of rows) {
        const b = legBudgetOf(r);
        if (!budgets.has(b)) budgets.set(b, []);
        budgets.get(b).push(r.id);
    }
    const planBudget = legBudgetOf(plan);
    const off = [...budgets.keys()].filter((b) => b !== planBudget);
    if (off.length) {
        fail(`a MIXED-BUDGET merge: the plan's leg budget is ${planBudget} ms, and ${off.map((b) => `${budgets.get(b).length} row(s) `
            + `ran at ${b} ms (ids ${budgets.get(b).join(',')})`).join('; ')}`);
    }
    // ⛓ THE SOLVER KNOBS — one value per knob per merge, and it is the plan's (absent = today's, on both sides)
    for (const k of SOLVER_KNOB_KEYS) {
        const show = (v) => (v === null ? 'unset' : String(v));
        const want = plan?.[k] ?? null;
        const offRows = new Map();
        for (const r of rows) {
            const v = r?.[k] ?? null;
            if (v === want) continue;
            if (!offRows.has(v)) offRows.set(v, []);
            offRows.get(v).push(r.id);
        }
        if (offRows.size) {
            fail(`a MIXED-WINDOW merge: the plan's ${k} is ${show(want)}, and ${[...offRows].map(([v, idsOff]) => `${idsOff.length} row(s) `
                + `ran at ${show(v)} (ids ${idsOff.join(',')})`).join('; ')}`);
        }
        if (want !== null) lines.push(`SOLVER-KNOB: ${k} ${want} (off today's)`);
    }
    if (planBudget !== LEG_BUDGET_MS_DEFAULT) lines.push(`LEG-BUDGET: ${planBudget} ms per leg (off the ${LEG_BUDGET_MS_DEFAULT} ms default)`);
    lines.push(`MERGE: ${rows.length} rows, ${ids.size} distinct legs of ${plan.legs}; ends ${JSON.stringify(ends)}`);
    // ⛓ SEAM TIME — each leg's arrival game clock beside its end: the same leg at another seam time is another request
    const timed = rows.filter((r) => r.seamTime !== undefined);
    if (timed.length) lines.push(`SEAM-TIME: ${timed.map((r) => `${r.id}@${r.seamTime ?? '-'}:${r.end}`).join(' ')}`);
    if (ids.size !== Number(plan.legs)) fail(`${ids.size} distinct legs, the plan holds ${plan.legs}`);
    if (count('page-boot-failed')) fail(`${count('page-boot-failed')} leg(s) on a page that never booted`);
    // ⛓ the plan against the rows, per shard: the ids a shard never reported (today's hand derivation, H1)
    const missing = {};
    for (const s of plan.shards ?? []) {
        const gone = s.ids.filter((id) => !ids.has(id));
        if (gone.length) {
            missing[s.shard] = gone;
            fail(`shard ${s.shard} never reported ${gone.length} of its ${s.ids.length} leg(s): ${gone.join(',')}`);
        }
    }
    // a hung leg and a never-reported one are both re-run
    const redispatch = [...new Set([...Object.values(missing).flat(), ...hung.map((r) => r.id)])].sort((a, b) => a - b);
    if (redispatch.length) lines.push(`REDISPATCH ids=${redispatch.join(',')}`);
    // ⛓ the probe's HANG line ends `lost=<ids>` (the legs it emitted as harness-hang) or `lost=none`
    for (const h of hangLines) if (/\blost=none\b/.test(h)) lines.push(`MERGE-WARN: ${h.trim()} (every leg of that page had reported)`);
    // ⛓ HIT TICKS (S5-2) — information about the model, so never a MERGE-FAIL
    const hitCensus = unbilledHitCensus(rows);
    lines.push(...hitCensus.lines);
    // ⛓ RUNNER SPEED — information about the runner, so never a MERGE-FAIL
    const shardOf = new Map((plan.shards ?? []).flatMap((s) => s.ids.map((id) => [id, s.shard])));
    const boots = new Map();
    for (const text of shardLogs) {
        const b = bootsOfLog(text);
        if (b.shard !== null) boots.set(b.shard, b.boots);
    }
    const stamps = (plan.shards ?? []).map((s) => shardStamp({ shard: s.shard, rows: rows.filter((r) => shardOf.get(r.id) === s.shard), boots: boots.get(s.shard) ?? [] }));
    const runner = runnerStamp(stamps);
    lines.push(...runner.lines);
    for (const r of rows.filter((x) => x.end === 'timeout')) {
        const s = shardOf.get(r.id);
        lines.push(`TIMEOUT: ${r.id} L${r.level ?? '?'} shard ${s ?? '?'}${runner.slow.has(s) ? ' SLOW-RUNNER' : ''}`);
    }
    return { lines, failed: lines.some((l) => l.startsWith('MERGE-FAIL')), missing, redispatch, slowShards: [...runner.slow].sort((a, b) => a - b) };
}

const readRows = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const readText = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--shard-stamp') {
    // ⛓ a shard's own stamp (its summary step): rows and log may be missing on a red shard — the line says `-`
    const [rowsPath, logPath] = process.argv.slice(3);
    const text = readText(logPath) ?? '';
    const b = bootsOfLog(text);
    const rows = readText(rowsPath) === null ? [] : readRows(rowsPath);
    console.log(runnerLine(shardStamp({ shard: b.shard ?? '?', rows, boots: b.boots })));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [rowsPath, planPath, ...logs] = process.argv.slice(2);
    const shardLogs = logs.map(readText).filter((t) => t !== null);
    const hangLines = shardLogs.flatMap((t) => t.split('\n').filter((l) => l.startsWith('HANG:')));
    const v = mergeVerdict({ rows: readRows(rowsPath), plan: JSON.parse(readFileSync(planPath, 'utf8')), hangLines, shardLogs });
    for (const l of v.lines) console.log(l);
    process.exitCode = v.failed ? 1 : 0;
}
