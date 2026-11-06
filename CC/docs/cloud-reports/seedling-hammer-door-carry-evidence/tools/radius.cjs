// scratch: the carry's radius — the same legs' page rows, OFF (natural) vs ON (carried); one line per leg, movers flagged
const fs = require('fs');
const rd = (f) => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).map((r) => [r.id, r]));
const off = rd(process.argv[2]), on = rd(process.argv[3]);
const pass = (r) => r && (r.end === 'done' || r.end === 'crossed');
const v = (r) => !r ? 'missing' : `${r.end}${r.roomHits?.max ? ` h${r.roomHits.max}` : ''}`;
const cls = {};
const out = ['id\tlevel\tcarried\tOFF\tON\tclass\tkey'];
for (const [id, b] of on) {
    const a = off.get(id);
    const c = pass(a) === pass(b) ? ((a?.roomHits?.max ?? 0) === (b?.roomHits?.max ?? 0) ? (a?.end === b?.end ? 'same' : 'same-verdict-other-end') : 'hits-moved')
        : pass(b) ? 'GAINED' : 'LOST';
    cls[c] = (cls[c] ?? 0) + 1;
    out.push([id, b.level, (b.carriedFlags ?? []).map((f) => f.eventId).join('+'), v(a), v(b), c, b.key].join('\t'));
}
console.log(out.join('\n'));
console.error(JSON.stringify(cls));
