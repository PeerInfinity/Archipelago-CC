// victim.mjs <tape.json> [askFrom] : replay a survey tape on the model (switch from env: SEEDLING_LIGHTS_BOSS_FIGHT=1),
// list the L69 fight's hits on the player and the shot that hit; then replay again and, at tick `askFrom` (default
// the kill's end), ask `dangerAt(transit)` about the player's ACTUAL box at every later L69 tick.
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const { parseTape } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeFormat.js`);
const { createTapeStepper } = await import(`${REPO}/frontend/modules/seedlingDemo/tapeRunner.js`);
const { atlasLevelSource } = await import(`${REPO}/frontend/modules/seedlingDemo/levelSource.js`);
const { dangerAt } = await import(`${REPO}/frontend/modules/seedlingDemo/dangerMap.js`);
const { playerBoxAt } = await import(`${REPO}/frontend/modules/seedlingDemo/solverView.js`);
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
function replay(onObs) {
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) onObs(r.value.observation, run);
}
const obs = [];
let last = null;
let hits = 0;
replay((o, run) => {
    const f = run?.entities('lightsFight')?.[0] ?? null;
    if (f) last = f;
    const h = run?.damage.hits ?? 0;
    obs[o.t] = { x: o.x, y: o.y, level: o.level, hits: h };
});
const ev = last?.events ?? [];
const hitEv = ev.filter((e) => e.what === 'shot-hit' || e.what === 'contact');
const fired = ev.filter((e) => e.what === 'shot' && hitEv.some((x) => x.id === e.id));
console.log(JSON.stringify({ ticks: obs.length - 1, endedAt: last?.endedAt ?? null, hitEvents: hitEv, fired,
    hitTicks: obs.map((o, t) => (t > 0 && o && obs[t - 1] && o.hits !== obs[t - 1].hits ? [t, obs[t - 1].hits, o.hits] : null)).filter(Boolean) }));
const askFrom = process.argv[3] ? Number(process.argv[3]) : last?.endedAt;
if (askFrom == null) process.exit(0);
replay((o, run) => {
    if (o.t !== askFrom || !run) return;
    const rows = [];
    for (let t = askFrom; t < obs.length && obs[t]?.level === 69; t += 1) {
        const d = dangerAt(run, t, playerBoxAt(obs[t].x, obs[t].y), { mode: 'transit' });
        if (d.danger) rows.push([t, +obs[t].x.toFixed(2), +obs[t].y.toFixed(2), d.sources.map((s) => `${s.kind}:${s.id}`).join(' ')]);
    }
    console.log(JSON.stringify({ askedAt: askFrom, ticksCompleted: run.ticksCompleted, dangerRows: rows }));
});
