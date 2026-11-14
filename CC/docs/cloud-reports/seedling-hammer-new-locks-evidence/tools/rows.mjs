// scratch: one line per sweep row (end, roomHits, plans' verdict/ticks, the failure text cut).
import { readFileSync } from 'node:fs';
const cut = Number(process.argv[3] ?? 700);
for (const line of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
    const r = JSON.parse(line);
    console.log(`${r.id} ${r.end} roomHits=${r.roomHits?.max ?? '-'} ms=${r.ms} cleared=${JSON.stringify(r.cleared ?? null).slice(0, 80)} eventFlag=${JSON.stringify(r.eventFlag ?? null)} plans=${(r.plans ?? []).map((p) => `${p.ok ? 'ok' : p.kind}:${p.ticks ?? ''}:${(p.verbs ?? []).join?.('+') ?? ''}`).join(',')} divs=${(r.divs ?? []).length} env=${JSON.stringify(r.solverEnv ?? null)}`);
    if (r.failed) console.log(`    FAILED: ${String(r.failed).slice(0, cut)}`);
    for (const d of r.divs ?? []) console.log(`    DIV: ${JSON.stringify(d).slice(0, 400)}`);
}
