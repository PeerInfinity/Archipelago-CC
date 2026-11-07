// scratch (STAGED-HUNT-CHEAP): the arms' rows as one table: request × arm → verdict, ticks, work, wall ms, digest,
// the staged asks, and (for an arm "X+M") whether it answers X's digest. Usage: node table.cjs <dir>
const fs = require('fs');
const dir = process.argv[2];
const rows = [];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    for (const l of fs.readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean)) rows.push(JSON.parse(l));
}
const by = new Map(rows.map((r) => [`${r.id}/${r.i}|${r.arm}`, r]));
const reqs = [...new Set(rows.map((r) => `${r.id}/${r.i}`))].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
const arms = [...new Set(rows.map((r) => r.arm))].sort();
const v = (r) => (r.ok ? `SOLVED ${r.ticks}t hits ${r.gm?.hits?.length ?? '?'}` : 'REFUSED');
console.log(['req', 'arm', 'verdict', 'work', 'ms', 'digest', 'staged', 'vs base'].join('\t'));
for (const q of reqs) {
    for (const a of arms) {
        const r = by.get(`${q}|${a}`);
        if (!r) continue;
        const base = /\+M(-p|$)/.test(a) ? by.get(`${q}|${a.replace(/\+M(?=-p|$)/, '')}`) : null;
        const cmp = base ? (base.digest === r.digest ? `= ${base.arm} (work ${base.work} → ${r.work})`
            : `≠ ${base.arm} (${v(base)}, ${base.digest})`) : '';
        const st = (r.staged ?? []).map((s) => `(${s.cell.x},${s.cell.y})w${s.wait}:${s.verdict}`).join(' ');
        console.log([q, a, v(r), r.work, r.ms, r.digest, st || '-', cmp].join('\t'));
    }
}
