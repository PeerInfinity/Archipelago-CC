#!/usr/bin/env node
/**
 * Scratch instrument (seedling-hammer-carry-drop): each captured leg's FIRST solve request (the sweep's
 * `--capture-requests`, carry arm) replayed in node twice, in a fresh process each:
 *   carry   — as captured (staging.persistence holds the carried flags);
 *   nocarry — staging.persistence MINUS the leg's carriedFlags (read from --legs), nothing else moved.
 * One jsonl row per (leg, arm): {id, key, arm, ok, kind, ticks, message, work, ms}.
 * Run: node <this> --requests=<req.jsonl> --legs=<legs-carry.jsonl> --out=<rows.jsonl> [--jobs=2] [--keys=k1|k2]
 */
import { readFileSync, appendFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const REPO = new URL('../../../../../', import.meta.url);

if (arg('child', '')) {
    // the replay's own dispatch (`replay-seedling-solve-request.mjs` replayOnce), returning the plan's tick count too
    const { restoreRequest } = await import(new URL('scripts/procgen/seedlingSolveRequestCodec.js', REPO));
    const { levelSourceFromAtlas } = await import(new URL('frontend/modules/seedlingDemo/atlasSource.js', REPO));
    const { solveAnytime, ANYTIME_PASSES } = await import(new URL('frontend/modules/seedlingDemo/jsRuntimeSolver.js', REPO));
    const { createHash } = await import('node:crypto');
    const req = restoreRequest(JSON.parse(readFileSync(arg('child', ''), 'utf8')));
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const t0 = Date.now();
    const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
    const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
    console.log('RESULT ' + JSON.stringify({ ok: a.ok, kind: a.kind ?? null, work: a.work ?? null, ticks: a.ok ? a.plan.solution.length : null,
        answer: createHash('sha1').update(text).digest('hex').slice(0, 12), message: a.ok ? null : text.slice(0, 300), ms: Date.now() - t0 }));
    process.exit(0);
}

const legs = new Map(readFileSync(arg('legs', ''), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((l) => [l.key, l]));
const want = arg('keys', '') ? new Set(arg('keys', '').split('|')) : null;
const tasks = [];
const tmp = arg('tmp', '/tmp');
const { writeFileSync } = await import('node:fs');
const rl = createInterface({ input: createReadStream(arg('requests', '')), crlfDelay: Infinity });
for await (const line of rl) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (want && !want.has(row.key)) continue;
    const leg = legs.get(row.key);
    const req0 = row.requests?.[0]?.request;
    if (!leg || !req0) { appendFileSync(arg('out', '/dev/stdout'), JSON.stringify({ id: row.id, key: row.key, arm: 'none', error: 'no request' }) + '\n'); continue; }
    const drop = new Set((leg.carriedFlags ?? []).map((f) => `${f.level}:${f.tag}`));
    const persist = req0.staging?.persistence ?? [];
    const arms = {
        carry: req0,
        nocarry: { ...req0, staging: { ...req0.staging, persistence: persist.filter((p) => !drop.has(`${p.level}:${p.tag}`)) } },
    };
    for (const [arm, req] of Object.entries(arms)) {
        const f = `${tmp}/carry-replay-${row.id}-${arm}.json`;
        writeFileSync(f, JSON.stringify(req));
        tasks.push({ id: row.id, key: row.key, arm, f, persistence: (req.staging?.persistence ?? []).map((p) => `${p.level}:${p.tag}`) });
    }
}
const self = fileURLToPath(import.meta.url);
let next = 0;
await Promise.all(Array.from({ length: Number(arg('jobs', '2')) }, async () => {
    while (next < tasks.length) {
        const t = tasks[next++];
        // eslint-disable-next-line no-await-in-loop
        const res = await new Promise((done) => {
            const c = spawn(process.execPath, [self, `--child=${t.f}`], { stdio: ['ignore', 'pipe', 'pipe'] });
            let out = ''; let err = '';
            c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
            c.on('close', (code) => {
                const l = out.split('\n').find((x) => x.startsWith('RESULT '));
                done(l ? JSON.parse(l.slice(7)) : { error: `exit ${code}: ${err.split('\n').slice(-3).join(' | ')}` });
            });
        });
        const row = { id: t.id, key: t.key, arm: t.arm, persistence: t.persistence, ok: res.ok ?? null, kind: res.kind ?? null,
            ticks: res.ticks ?? null, answer: res.answer ?? null, work: res.work ?? null, message: res.message ?? res.error ?? null, ms: res.ms ?? null };
        appendFileSync(arg('out', '/dev/stdout'), JSON.stringify(row) + '\n');
        console.log(`ROW ${t.id} ${t.arm} ${row.ok ? `PLAN ${row.ticks}t ${row.answer}` : 'REFUSED ' + (row.kind ?? '') + ' ' + String(row.message ?? '').slice(0, 100)}`);
    }
}));
