// scratch (ICEST, from CPAIR's tools/solve.mjs): solve a staging boot tape for one goal under env switches; print records / refusal and kill rows.
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape, solveStaging } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const SB = await import(M + 'solverBot.js');
const { solveSegment } = SB;
const tape = parseTape(readFileSync(args.boot, 'utf8'));
const levelSource = atlasLevelSource();
const staging = solveStaging(stagingFromTape(tape));
const goal = args.goal ? JSON.parse(args.goal) : { kind: 'collect-placement', placement: { x: 656, y: 528 } };
const t0 = Date.now();
let res;
const run = createRunForStaging(staging, levelSource);
if (args.trace) {
    // TRACE: the main run's position every N ticks and on every hit / level change
    const every = Number(args.trace);
    const adv = run.advance.bind(run);
    let hits = 0;
    let lvl = run.level;
    run.advance = (k) => {
        const r = adv(k);
        const h = run.ledger('playerHits').length;
        if (run.ticksCompleted % every === 0 || h !== hits || run.level !== lvl) {
            console.log(`T t${run.ticksCompleted} L${run.level} (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) keys[${[...k].join(",")}] fz${run.progress("frozenTimer")} b${(run.blastsInFlight ?? []).length}${h !== hits ? ` HIT ${JSON.stringify(run.ledger("playerHits").at(-1)).slice(0, 600)} blasts=${JSON.stringify((run.blastsInFlight ?? []).map((b) => [Math.round(b.x), Math.round(b.y)]))}` : ''}`);
            hits = h; lvl = run.level;
        }
        return r;
    };
}
try {
    const out = solveSegment({ run, goals: [goal], name: args.name ?? 'cpair', boot: staging.boot, dashMode: args.dash ?? 'all',
        forkRun: () => createRunForStaging(staging, levelSource) });
    res = { ok: true, out };
} catch (e) { res = { ok: false, msg: e.message, obstacle: e.obstacle ?? null, perTick: e.perTick ?? [], equips: e.equips ?? [] }; }
console.log(`ms ${Date.now() - t0}`);
const hits = (run.playerHits ?? []).map((h) => `t${h.t}:${h.source}:${h.id}${h.died ? ':DIED' : ''}`);
console.log('playerHits', JSON.stringify(hits));
if (res.ok) {
    console.log(`SOLVED ${res.out.perTick.length}`);
    for (const r of res.out.records ?? []) if (r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 400));
    if (args.out) writeFileSync(args.out, JSON.stringify({ perTick: res.out.perTick.map((s) => [...s]), equips: res.out.equips, records: res.out.records }));
} else {
    console.log('REFUSED', res.msg.slice(0, +(args.msglen ?? 3000)));
    console.log('obstacle', JSON.stringify(res.obstacle), 'perTick', res.perTick.length);
    if (args.out) writeFileSync(args.out, JSON.stringify({ refused: res.msg, perTick: res.perTick.map((s) => [...s]), equips: res.equips }));
}
console.log('ICEST', JSON.stringify(SB.ICETURRET_STATIC_KILL_COUNTS ?? null));
console.log('CPAIR', JSON.stringify(SB.CHOOSER_PAIR_COUNTS ? { ...SB.CHOOSER_PAIR_COUNTS, gone: undefined } : null));
const tu = run.entities?.('turrets');
if (tu) for (const [id, t] of tu) console.log('TURRET', id, JSON.stringify({ dead: t.dead, removed: t.removed, x: t.x, y: t.y }));
if (args.probe) {
    // PROBE: what solid is on the column x=<probe> between y 560 and 440 in the run's final state
    const x = Number(args.probe);
    for (let y = 560; y >= 440; y -= 2) {
        const hit = run.collideLineSolid ? run.collideLineSolid(x, y, x, y - 2) : null;
        if (hit) { console.log('PROBE', y, JSON.stringify(hit).slice(0, 300)); break; }
    }
    console.log('PROBE state', JSON.stringify({ x: run.state.x, y: run.state.y }));
}
