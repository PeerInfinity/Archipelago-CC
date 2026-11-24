// FACE 1: one row per clock of a sweep jsonl: verdict, work, ticks/hits, and each rung's refusal reduced to its shape
// (the chaser arm's forecast tick and body, narrow's hammer phase, whether the goal is covered).
//   node sweep-table.mjs <sweep.jsonl>
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.seam - b.seam);
const tally = {};
for (const r of rows) {
    const m = r.message ?? '';
    const shape = r.ok ? `SOLVED ${r.ticks}t hits=${r.hits.length}${r.hits.length ? `(${r.hits.join(',')})` : ''}`
        : [
            /EXHAUSTED/.test(m) ? 'EXHAUSTED' : (r.kind ?? '?'),
            (/^solverBot\([^)]*\) (.*?): the combat/.exec(m)?.[1] ?? '').replace(/^clear-tag \{40,12\} wandlock@480,560/, 'ct'),
            `first=${/— (chaser:\S+|spinner:\S+)/.exec(m)?.[1] ?? '-'}`,
            `armfc=${/refused by the forecast \[\([^)]*\): the APPROACH is (?:dangerous|hit) at tick (\d+) — (\S+);/.exec(m)?.slice(1).join('@') ?? '-'}`,
            `narrow=${/narrow: .*?— (\S+) \(a live Spinner's HAMMER.*?\(phase (\d+)\/45/.exec(m)?.slice(1).join('@ph') ?? (/narrow: ([^\n]{0,60})/.exec(m)?.[1] ?? '-')}`,
            /COVERED GOAL/.test(m) ? 'covered' : 'uncovered',
        ].join(' ');
    const key = shape.replace(/armfc=\d+@/, 'armfc=@').replace(/@ph\d+/, '@ph*');
    tally[key] = (tally[key] ?? 0) + 1;
    console.log(String(r.d).padStart(4), r.seam, String(r.work).padStart(5), `${String(r.ms).padStart(6)}ms`, shape);
}
console.log('\nTALLY (phase and forecast tick folded):');
for (const [k, n] of Object.entries(tally)) console.log(String(n).padStart(4), k);
