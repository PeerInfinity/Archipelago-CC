// Measure-only (seedling-hammer-walk-walls): field-by-field diff of two captured solve requests (the walk's and the
// sweep leg's). Reads either a capture jsonl row ({id,key,requests:[{i,request}]}) or a .json.gz fixture.
// Usage: node diff-requests.mjs <A file>[#id[:i]] <B file>[#id[:i]]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

function load(spec) {
    const [file, sel = ''] = spec.split('#');
    const [id, i] = sel.split(':');
    const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString('utf8') : readFileSync(file, 'utf8');
    const rows = file.endsWith('.gz') ? [JSON.parse(raw)] : raw.trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.requests);
    const row = id ? rows.find((r) => String(r.id) === id) : rows.at(-1);
    const c = i !== undefined ? row.requests.find((x) => String(x.i) === i) : row.requests.at(-1);
    return { key: row.key, id: row.id, request: c.request };
}

const A = load(process.argv[2]);
const B = load(process.argv[3]);
const out = [];
const J = (v) => JSON.stringify(v);
function walk(a, b, path) {
    if (J(a) === J(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`);
        return;
    }
    out.push([path, a, b]);
}
const strip = ({ source, ...r }) => r;
const ra = strip(A.request); const rb = strip(B.request);
const la = ra.live?.digest ? JSON.parse(ra.live.digest) : null;
const lb = rb.live?.digest ? JSON.parse(rb.live.digest) : null;
walk({ ...ra, live: undefined }, { ...rb, live: undefined }, 'req');
console.log(`A = ${A.key} (id ${A.id})\nB = ${B.key} (id ${B.id})`);
console.log(`source records equal: ${J(A.request.source) === J(B.request.source)}`);
for (const [p, a, b] of out) console.log(`DIFF ${p}\n   A: ${J(a)?.slice(0, 400)}\n   B: ${J(b)?.slice(0, 400)}`);
if (la && lb) {
    const lo = [];
    const { c: ca = [], ...ha } = la; const { c: cb = [], ...hb } = lb;
    const o2 = out.length;
    walk(ha, hb, 'live');
    for (const [p, a, b] of out.slice(o2)) console.log(`DIFF ${p}\n   A: ${J(a)?.slice(0, 400)}\n   B: ${J(b)?.slice(0, 400)}`);
    const ma = new Map(ca.map((x) => [x.id, x])); const mb = new Map(cb.map((x) => [x.id, x]));
    console.log(`live bodies: A ${ca.length}, B ${cb.length}`);
    for (const id of new Set([...ma.keys(), ...mb.keys()])) {
        const a = ma.get(id); const b = mb.get(id);
        if (J(a) === J(b)) continue;
        if (!a || !b) { console.log(`BODY ${id}: ${a ? 'only in A' : 'only in B'} ${J(a ?? b)}`); continue; }
        const d = Object.keys({ ...a, ...b }).filter((k) => J(a[k]) !== J(b[k])).map((k) => `${k} ${J(a[k])}→${J(b[k])}`);
        console.log(`BODY ${id}: ${d.join(', ')}`);
    }
    void lo;
}
