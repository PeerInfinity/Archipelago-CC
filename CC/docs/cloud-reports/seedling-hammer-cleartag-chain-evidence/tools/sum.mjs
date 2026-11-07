// scratch (CLEARTAG-CHAIN): chain.mjs rows (jsonl) → one line per run: id arm end ticks work digest verbs fresh-run hits/deaths, the refusal head.
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    .sort((a, b) => a.id - b.id || a.arm.localeCompare(b.arm));
const head = Number(process.argv[3] ?? 360);
for (const r of rows) {
    const end = r.ok ? `SOLVED ${r.ticks} t` : 'REFUSED';
    const gm = r.gm ? ` fresh-run: modelled=${r.gm.gm} hits=${r.gm.hits?.length ?? '?'} deaths=${r.gm.deaths ?? '?'}` : '';
    const passes = r.passes.map((p) => `${p.pass}:${p.ok ? 'ok' : p.kind}/${p.work}u/${Math.round(p.ms / 1000)}s`).join(' ');
    console.log(`${r.id}/${r.i} ${r.arm.padEnd(18)} ${end.padEnd(14)} work=${r.work} digest=${r.digest} [${passes}]${gm}`
        + (r.verbs ? ` verbs=${JSON.stringify(r.verbs)}` : ''));
    if (!r.ok) console.log(`    ${r.head.slice(0, head).replace(/\n/g, ' ')}`);
}
