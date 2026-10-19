// Preload (measure only): registers census-loader.mjs, installs a silent progress hook for the whole process (as
// seedling-solve-progress-hook.mjs does) and appends every recorded rejection to $RK_CENSUS_OUT at exit (JSON lines).
import { register } from 'node:module';
import { appendFileSync } from 'node:fs';
register(new URL('./census-loader.mjs', import.meta.url));
const out = process.env.RK_CENSUS_OUT;
const recs = new Map();
globalThis.__rkRec = (via, x, keys) => {
    const o = typeof x === 'object' && x !== null ? x : { why: x };
    const row = {
        via, name: o.name ?? null, code: o.code ?? null, bound: o.bound ?? null, rung: o.rung ?? null,
        obstacle: o.obstacle?.kind ?? null, obstacleReason: o.obstacle?.reason ?? null,
        deadline: o.deadline ? (o.deadline.first ?? true) : null,
        considered: Array.isArray(o.considered) && o.considered.length ? o.considered.at(-1) : null,
        text: typeof o.message === 'string' ? o.message : (typeof o.why === 'string' ? o.why : null),
        keys: keys.map((k) => k.replace(/^.*?\/goal#\d+\//, '…/')),
    };
    const sig = JSON.stringify(row);
    recs.set(sig, (recs.get(sig) ?? 0) + 1);
};
const { installSolveProgress } = await import('../../../../../frontend/modules/seedlingDemo/solveProgress.js');
installSolveProgress(() => {});
process.on('exit', () => {
    if (!out) return;
    const who = (process.argv.slice(1).join(' ')).replace(/^.*\/scripts\//, 'scripts/');
    for (const [sig, n] of recs) appendFileSync(out, `${JSON.stringify({ who, n, ...JSON.parse(sig) })}\n`);
});
