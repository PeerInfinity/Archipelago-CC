import fs from 'node:fs';
const dir = process.argv[2];
const cls = (r) => {
    if (r.ok) return 'SOLVE';
    const m = r.message ?? '';
    let x;
    if ((x = m.match(/by press: the player died at t\d+ \(chaser ([^)]+)\)/))) return `press-kill DEATH (chaser ${x[1]})`;
    if (/every key set — the plan's own and/.test(m)) return 'press-kill refusal: every key set lands';
    if ((x = m.match(/(\w+) stance \([^)]*\): the combat ladder is EXHAUSTED.*?— ((?:chaser|spinner):[^ ]+)/))) return `refused at ${x[1]} stance ${x[2]}`;
    if ((x = m.match(/(contact): the combat ladder is EXHAUSTED.*?— (chaser:[^ ]+)/))) return `refused at the contact corridor ${x[2]}`;
    if (/deadline/.test(m)) return 'deadline';
    return `other: ${m.slice(0, 120)}`;
};
for (const id of ['848', '847']) for (const arm of ['off', 'on']) {
    const rows = fs.readdirSync(dir).filter((f) => f.startsWith(`census-${id}-${arm}-`) && f.endsWith('.jsonl'))
        .flatMap((f) => fs.readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
    if (!rows.length) continue;
    const g = new Map();
    for (const r of rows) { const k = cls(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r.seamTime); }
    console.log(`== leg ${id} request 1, ${arm.toUpperCase()} (${rows.length} seams)`);
    for (const [k, v] of [...g].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(3)}  ${k}   [${v.sort((a, b) => a - b).join(' ')}]`);
}
