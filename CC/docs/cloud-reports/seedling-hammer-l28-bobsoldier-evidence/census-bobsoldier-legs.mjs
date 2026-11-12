#!/usr/bin/env node
// EVIDENCE (slice seedling-hammer-l28-bobsoldier). Nothing tracked is edited. An APPROXIMATE node A/B of
// `KILL_STANCE_SIGHT` over the seed-1 divergence-sweep EXIT legs of the levels whose atlas record holds a BobSoldier:
// each leg is booted by `fidelityArrival.arrivalStaging` at its resolved arrival, with the route inventory's tools
// (sword / shield / swim / light / fire, by name) and its level's own route flags cleared, and solved by
// `solveSegment` to the exit tile, OFF and ON. ⚠ Not the sweep's staging (no keys, no other levels' flags, no seam
// readback; a pit exit is not mapped): a mover here is a leg the switch CAN move, not a measured sweep row.
//   node .../census-bobsoldier-legs.mjs --legs=<legs.jsonl> [--levels=28,30,40] [--timeout=150] [--jobs=3]
//   node .../census-bobsoldier-legs.mjs --one='<leg json>' --sight=0|1
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ARCHCC_ROOT ?? '/home/user/Archipelago-CC';
const M = join(ROOT, 'frontend/modules/seedlingDemo');
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ITEM = { 'Progressive Sword': 'hasSword', 'Progressive Shield': 'hasShield', 'Progressive Swim': 'canSwim',
    Light: 'hasTorch', Fire: 'hasFire' };

if (arg('one')) {
    const leg = JSON.parse(arg('one'));
    const sight = arg('sight') === '1';
    const SB = await import(join(M, 'solverBot.js'));
    const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
    const { createRunForStaging } = await import(join(M, 'tapeRunner.js'));
    const { arrivalStaging } = await import(join(M, 'fidelityArrival.js'));
    const inv = leg.sphere?.inventory ?? [];
    const items = [...new Set(inv.map((i) => ITEM[i]).filter(Boolean))];
    const cleared = inv.map((i) => new RegExp(`^L${leg.level} flag (\\d+):`).exec(i)?.[1]).filter(Boolean).map(Number);
    // a teleporter / stair exit names its OEL point (`out_<kind>_<x>_<y>`); a pit is not a `reach-exit` goal here
    const m = /^out_(?:teleporter|stairsup|stairsdown)_(\d+)_(\d+)$/.exec(leg.goal.exit_id ?? '');
    const row = { id: leg.id, key: leg.key, sight, items, cleared };
    if (!m) { console.log(JSON.stringify({ ...row, outcome: 'not-mapped', err: `${leg.goal.exit_id}: not a teleporter goal` })); process.exit(0); }
    const [tx, ty] = [Number(m[1]) / 16, Number(m[2]) / 16];
    const t0 = Date.now();
    try {
        const run = createRunForStaging(arrivalStaging({ level: leg.level, x: leg.arrive.x, y: leg.arrive.y },
            { items, cleared }), atlasLevelSource());
        const keys = [];
        const adv = run.advance.bind(run);
        run.advance = (...a) => { keys.push([...a[0]].sort().join('+')); return adv(...a); };
        try {
            SB.withKillStanceSight(sight, () => SB.solveSegment({ run, goals: [{ kind: 'reach-exit',
                exit: { x: tx * 16, y: ty * 16 } }], name: `leg-${leg.id}`, boot: { level: leg.level, ...leg.arrive } }));
            row.outcome = 'solved';
        } catch (e) { row.outcome = 'failed'; row.err = `${e.constructor.name}: ${e.message.split('\n')[0].slice(0, 200)}`; }
        row.t = run.ticksCompleted;
        row.hits = run.ledger('playerHits').map((h) => [h.t, h.source, h.id]);
        row.keysSha = (await import('node:crypto')).createHash('sha1').update(keys.join(',')).digest('hex').slice(0, 12);
        row.counts = { ...SB.KILL_STANCE_SIGHT.counts };
    } catch (e) { row.outcome = 'boot-failed'; row.err = e.message.slice(0, 200); }
    row.ms = Date.now() - t0;
    console.log(JSON.stringify(row));
    process.exit(0);
}

const levels = arg('levels', '28,30,40').split(',').map(Number);
const legs = readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((l) => levels.includes(l.level) && l.goal.kind === 'exit' && !l.skip);
const jobs = Number(arg('jobs', '3'));
const timeoutS = Number(arg('timeout', '150'));
const self = fileURLToPath(import.meta.url);
const tasks = legs.flatMap((leg) => [0, 1].map((s) => ({ leg, s })));
let next = 0;
const one = ({ leg, s }) => new Promise((resolve) => {
    const p = spawn(process.execPath, [self, `--one=${JSON.stringify(leg)}`, `--sight=${s}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let so = '';
    p.stdout.on('data', (d) => { so += d; });
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutS * 1000);
    p.on('close', () => {
        clearTimeout(timer);
        const line = so.split('\n').find((l) => l.startsWith('{'));
        resolve(line ?? JSON.stringify({ id: leg.id, key: leg.key, sight: s === 1, outcome: 'timeout', s: timeoutS }));
    });
});
await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < tasks.length) { const t = tasks[next++]; console.log(await one(t)); }
}));
