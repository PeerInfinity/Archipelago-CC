// MEASUREMENT ONLY (L53-KILLLOCK): the ON radius over a page capture (`--capture-requests` jsonl). Every captured
// request (each leg's every ask: the 640 first ask, the 2560 held retry, …) is solved as the worker solves it
// (`solveAnytime`, the request's own budget and passes) with `KILLLOCK_CHASER_REWIND` OFF and ON, and each answer's plan
// replayed on a FRESH run for its hits (⚖ 30(c)). One jsonl row per request: ok, ticks, digest (the plan's keys or the
// refusal's text), hits, the switch's tries; `moved` = the ON digest differs from OFF's.
// Usage: node radius.mjs --capture=<jsonl> --out=<jsonl> [--shard=i/n] [--skip=<done jsonl>]
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const SB = await import(M + 'solverBot.js');
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const [si, sn] = (args.shard ?? '0/1').split('/').map(Number);
const done = new Set(args.skip && existsSync(args.skip)
    ? readFileSync(args.skip, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.id}/${r.i}`; }) : []);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
function solve(req, on) {
    const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    SB.resetKillLockChaserRewindCounts();
    const t0 = Date.now();
    let answer;
    try { answer = SB.withKillLockChaserRewind(on, () => JR.solveAnytime({ ...tape, source, levelSource }, { passes })); } catch (e) {
        return { ok: false, threw: true, digest: sha(`THREW ${e?.message}`), head: `THREW ${String(e?.message).slice(0, 300)}`, ms: Date.now() - t0 };
    }
    const ms = Date.now() - t0;
    const tries = SB.KILLLOCK_CHASER_REWIND_COUNTS.tries.map((r) => `${r.id}@${r.stance.x.toFixed?.(0)},${r.stance.y.toFixed?.(0)}:${r.verdict}`);
    if (!answer.ok) return { ok: false, digest: sha(String(answer.message)), head: String(answer.message).slice(0, 300), tries, ms };
    const plan = JSON.stringify(answer.plan.solution.map((k) => [...k]));
    let hits = null;
    try {
        const fresh = JR.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource,
            scratchPersistence: tape.scratchPersistence });
        hits = fresh.ledger('playerHits').length;
    } catch (e) { hits = `THREW ${String(e?.message).slice(0, 80)}`; }
    return { ok: true, ticks: answer.plan.solution.length, digest: sha(plan), hits, tries, ms };
}
let n = 0;
const rl = createInterface({ input: createReadStream(args.capture), crlfDelay: Infinity });
for await (const line of rl) {
    if (!line.trim()) continue;
    n += 1;
    if ((n - 1) % sn !== si) continue;
    const row = JSON.parse(line);
    for (const c of row.requests) {
        if (done.has(`${row.id}/${c.i}`)) continue;
        const req = restoreRequest(c.request);
        const off = solve(req, false);
        const on = solve(req, true);
        const out = { id: row.id, key: row.key, i: c.i, budget: req.budgetWork ?? null, off, on, moved: off.digest !== on.digest };
        appendFileSync(args.out, JSON.stringify(out) + '\n');
        console.log(`${row.id}/${c.i} ${out.moved ? 'MOVED' : 'same '} off ${off.ok ? `SOLVED ${off.ticks}` : 'REFUSED'} on ${on.ok ? `SOLVED ${on.ticks} hits ${on.hits}` : 'REFUSED'} tries ${on.tries?.length ?? 0} (${off.ms}+${on.ms} ms)`);
    }
}
