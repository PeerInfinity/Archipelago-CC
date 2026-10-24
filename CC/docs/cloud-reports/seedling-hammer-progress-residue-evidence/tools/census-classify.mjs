// Measure only: the D1 census (census-raw.jsonl) re-read through progressKind — every recorded payload rebuilt from
// its fields (name, code, bound, obstacle, undeclaredKillLock via `levelRun` + kill-lock text is NOT assumed: the
// recorder kept no field for it, so a `levelRun` Error is rebuilt with the field only when its text names a kill lock).
// node census-classify.mjs <census-raw.jsonl> <solveProgress.js>
import { readFileSync } from 'node:fs';
const [raw, mod] = process.argv.slice(2);
const { progressKind } = await import(mod);
const by = {};
for (const l of readFileSync(raw, 'utf8').trim().split('\n')) {
    const r = JSON.parse(l);
    let x;
    if (r.via === 'search') x = { ok: false, bound: r.bound, why: r.text };
    else if (r.via === 'row') x = { rung: r.rung, why: r.text };
    else {
        x = Object.assign(new Error(r.text), { name: r.name, code: r.code,
            obstacle: r.obstacle ? { kind: r.obstacle, reason: r.obstacleReason } : null });
        if (r.name === 'Error' && /^levelRun: .* OPENS \d+ kill lock/.test(r.text)) x.undeclaredKillLock = {};
    }
    const k = progressKind(x);
    const who = r.who.split('/').pop().split(' ')[0];
    by[k] ??= { n: 0, sites: new Set() };
    by[k].n += r.n;
    by[k].sites.add(`${r.via}${r.rung ? `:${r.rung}` : ''} ${(r.text ?? r.bound).slice(0, 60)}`);
}
for (const [k, v] of Object.entries(by)) console.log(k, v.n, [...v.sites].map((s) => s.replace(/\d+/g, '#')).filter((s, i, a) => a.indexOf(s) === i));
