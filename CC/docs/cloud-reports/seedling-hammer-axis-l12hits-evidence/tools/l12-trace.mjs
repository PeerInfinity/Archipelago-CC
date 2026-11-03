// MEASUREMENT ONLY. `node --import ./l12-trace.mjs axis-replay.mjs …`: every DRIVEN tick of the LAST run object that
// drove a tick (the answer's run) is a row: tick, the walk's `what`, axisAligned, the player, the keys, the strike's
// decision this tick, the bodies (position, the puncher's punch state) and the model's player-hit count. Written at exit
// to $L12_OUT (one JSON line per process: {tag, rows, playerHits, pressHits}).
import { register } from 'node:module';
register(new URL('./l12-trace-loader.mjs', import.meta.url).href);
let cur = null;
const runs = new WeakMap();
globalThis.__l12Tick = (run, target, strike, axisAligned, held) => {
    let R = runs.get(run);
    if (!R) { R = { run, rows: [] }; runs.set(run, R); }
    cur = R;
    const st = run.state;
    const last = strike?.trace?.at?.(-1) ?? null;
    const t = run.ticksCompleted;
    const bodies = (run.entities('chasers') ?? []).map((c) => ({ id: c.id, x: +c.x?.toFixed?.(2), y: +c.y?.toFixed?.(2),
        hits: c.hits ?? c.kill?.hits ?? null, dead: c.dead ?? false,
        anim: c.anim?.name ?? c.animName ?? c.sprite?.anim ?? null, cd: c.attackTimer ?? c.punchTimer ?? null }));
    R.rows.push({ t, what: globalThis.__l12What ?? null, axisAligned, strikeOn: Boolean(strike),
        x: +st.x.toFixed(2), y: +st.y.toFixed(2), vx: +st.vx.toFixed(2), vy: +st.vy.toFixed(2),
        held: [...held].sort().join('+') || '-', target: { x: target.x, y: target.y },
        strike: last && last.tick === t ? { d: last.decision, target: last.target ?? null, dir: last.direction ?? null } : null,
        bodies, hitsSoFar: (run.ledger?.('playerHits') ?? run.playerHits ?? []).length });
};
if (process.env.L12_OUT) {
    const { appendFileSync } = await import('node:fs');
    process.on('exit', () => {
        const run = cur?.run;
        appendFileSync(process.env.L12_OUT, JSON.stringify({ tag: process.env.L12_TAG ?? null,
            rows: cur?.rows ?? [],
            playerHits: run ? (run.ledger?.('playerHits') ?? []).map((h) => ({ ...h })) : [],
            pressHits: run ? (run.chaserPressHits ?? []).map((h) => ({ ...h })) : [] }) + '\n');
    });
}
