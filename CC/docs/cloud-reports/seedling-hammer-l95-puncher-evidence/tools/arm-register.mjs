// MEASUREMENT ONLY: `node --import ./arm-register.mjs replay.mjs …` — the chaser arm's candidates, one JSON line each
// on stderr when ARM_OUT is unset, else appended to $ARM_OUT. Per candidate: stance, verdict, and per sample the
// target's state (x, y, hits, hitsTimer, punch) with the player's position and phase.
import { register } from 'node:module';
import { appendFileSync } from 'node:fs';
register(new URL('./arm-loader.mjs', import.meta.url).href);
let ask = 0; let lastRun = null; let lastT = null;
globalThis.__armCand = ({ run, target, c, walk, danger, deathTick }) => {
    if (run !== lastRun || run.ticksCompleted !== lastT) { ask += 1; lastRun = run; lastT = run.ticksCompleted; }
    const row = { ask, t: run.ticksCompleted, from: [+run.state.x.toFixed(2), +run.state.y.toFixed(2)], target: target.id,
        stance: [c.x, c.y], why: danger ? danger.sources.map((x) => `${x.kind}:${x.id}: ${x.why ?? ''}`) : null, verdict: danger ? `${danger.phase}-hit@${danger.tick - walk.startTick}` : deathTick === null ? 'no-death' : `dies@${deathTick - walk.startTick}`,
        samples: walk.samples.map((sm) => { const b = (sm.chasers ?? []).find((x) => x.id === target.id);
            return [sm.tick - walk.startTick, sm.phase ?? 't', +sm.x.toFixed(1), +sm.y.toFixed(1),
                b ? [+b.x.toFixed(1), +b.y.toFixed(1), b.hits, b.hitsTimer, b.punch ? (b.punch.live ? (b.punch.hitsPlayer ? 'PUNCH-HIT' : 'punch-live') : 'punch-dead') : null] : 'gone']; }) };
    const line = JSON.stringify(row) + '\n';
    if (process.env.ARM_OUT) appendFileSync(process.env.ARM_OUT, line); else process.stderr.write(line);
};
