/**
 * The divergence sweep's MERGE verdict (`.github/workflows/seedling-divergence-sweep.yml`, the merge job): the
 * shards' rows against the plan job's partition. Pure (no browser, no repo imports), so the merge job runs it off a
 * sparse checkout and a unit test drives it.
 *
 * A row is not asserted about the MODEL (a refusal or a divergence is a row); the merge goes red only when the SWEEP
 * is incomplete, BY NAME:
 *   · `harness-hang`   a leg whose page hung in a harness step (H1: the probe's bound expired, the browser was
 *                      SIGKILLed and the shard moved on) — named with its step;
 *   · never reported   a plan id with no row at all (a shard cancelled / timed out / crashed) — listed per shard, and
 *                      the union printed as one `REDISPATCH ids=` line, the re-dispatch input as is;
 *   · `stage-failed`, `dirty-start`, `page-boot-failed`, and a distinct-leg count short of the plan (as before).
 * A `HANG:` line in a shard log with no row behind it (a teardown that hung AFTER its legs reported) is a WARNING:
 * the rows are complete.
 *
 * CLI (the merge job): node scripts/procgen/seedlingDivergenceMerge.js <rows.jsonl> <plan.json> [<shard.log>…]
 * Prints the verdict lines; exit 1 when any line is a `MERGE-FAIL`.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The verdict. `plan` is `--shard-plan=<n> --json` (`{ legs, shards: [{ shard, ids }] }`); `hangLines` the `HANG:`
 * lines of the shard logs. Returns the lines to print, whether the merge fails, the never-reported ids per shard and
 * their union (sorted).
 */
export function mergeVerdict({ rows, plan, hangLines = [] }) {
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
    lines.push(`MERGE: ${rows.length} rows, ${ids.size} distinct legs of ${plan.legs}; ends ${JSON.stringify(ends)}`);
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
    return { lines, failed: lines.some((l) => l.startsWith('MERGE-FAIL')), missing, redispatch };
}

const readRows = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [rowsPath, planPath, ...logs] = process.argv.slice(2);
    const hangLines = logs.flatMap((f) => {
        try { return readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('HANG:')); } catch { return []; }
    });
    const v = mergeVerdict({ rows: readRows(rowsPath), plan: JSON.parse(readFileSync(planPath, 'utf8')), hangLines });
    for (const l of v.lines) console.log(l);
    process.exitCode = v.failed ? 1 : 0;
}
