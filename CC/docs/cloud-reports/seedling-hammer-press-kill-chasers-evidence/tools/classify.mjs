// scratch: classify a seam census jsonl (replay rows) by where the answer ends
import { readFileSync } from 'node:fs';
const cls = (r) => {
    if (r.ok) return 'PLAN';
    const m = String(r.message ?? r.error ?? '');
    const death = m.match(/kill \((spinner@[0-9,]+)\) by press: the player died at t(\d+) \((\w+) ([^)]+)\)/);
    if (death) return `press-kill DEATH (${death[3]} ${death[4]})`;
    if (/by press:/.test(m)) return 'press-kill refusal: ' + m.split('by press:')[1].trim().slice(0, 60);
    if (/shouldStop/.test(m)) return 'deadline';
    const chain = m.split(' -> ');
    const last = chain.at(-1).split(':')[0].replace(/\(.*$/, '').trim();
    const danger = m.match(/danger at \([^)]*\) — (chaser:[^ ]+|[a-z]+:[^ ]+)/)?.[1] ?? '';
    return `refused at ${last} ${danger}`.trim();
};
for (const p of process.argv.slice(2)) {
    const rows = readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse);
    const by = {};
    for (const r of rows) (by[cls(r)] ??= []).push(r.seamTime);
    console.log(`== ${p.split('/').at(-1)} (${rows.length} seams)`);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(2)}  ${k}   [${v.sort((a, b) => a - b).join(' ')}]`);
}
