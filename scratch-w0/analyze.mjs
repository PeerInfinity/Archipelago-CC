// SCRATCH (W0): per AP element, the derived rule(s) vs today's seedling_playthrough rule. Usage: node analyze.mjs <w0-emit.json> [--list]
import { readFileSync } from 'node:fs';
const E = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const LIST = process.argv.includes('--list');
const R = JSON.parse(readFileSync(new URL('../frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8')).regions['1'];
const rec = E.parts.flatMap((p) => p.rec);
const exits = E.parts.flatMap((p) => p.exits);
const levels = new Set(E.levels);
const lv = (n) => n.split('__')[0];
const items = (r, out = new Map()) => {
  if (r?.rule === 'Has') { const i = r.args.item_name; const c = r.args.count ?? 1; if (!out.has(i)) out.set(i, new Set()); out.get(i).add(c); }
  for (const c of r?.children ?? []) items(c, out); return out;
};
const ev = (r, inv) => { switch (r?.rule) { case undefined: case 'True_': return true; case 'False_': return false;
  case 'Has': return (inv.get(r.args.item_name) ?? 0) >= (r.args.count ?? 1);
  case 'And': return r.children.every((c) => ev(c, inv)); case 'Or': return r.children.some((c) => ev(c, inv));
  default: throw new Error('kind ' + r.rule); } };
const points = (rules) => { const m = new Map(); for (const r of rules) for (const [i, cs] of items(r)) { if (!m.has(i)) m.set(i, new Set([0])); for (const c of cs) m.get(i).add(c); }
  let pts = [new Map()]; for (const [i, cs] of m) pts = pts.flatMap((p) => [...cs].map((c) => new Map([...p, [i, c]]))); return pts; };
const cmp = (d, a) => { let looser = false, stricter = false; for (const p of points([d, a])) { const x = ev(d, p), y = ev(a, p); if (x && !y) looser = true; if (!x && y) stricter = true; }
  return looser && stricter ? 'incomparable' : looser ? 'looser' : stricter ? 'stricter' : 'equal'; };
const same = (a, b) => cmp(a, b) === 'equal';
const fromMin = (min) => (min.length === 0 ? { rule: 'False_' } : { rule: 'Or', children: min.map((s) => ({ rule: 'And', children: countify(s) })) });
function countify(s) { const c = new Map(); for (const i of s) c.set(i, (c.get(i) ?? 0) + 1); return [...c].map(([i, n]) => ({ rule: 'Has', args: n > 1 ? { item_name: i, count: n } : { item_name: i } })); }
const tally = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const out = { boundary: {}, location: {}, inworld: {}, cert: {} };
const lists = { boundary: [], location: [] };
// arrival tag of a label
const tagOf = (label) => label.match(/\((landing [\d,]+|from [^)]+)\)$/)?.[1] ?? 'entrance';
for (const [name, reg] of Object.entries(R)) {
  if (!levels.has(lv(name))) continue;
  for (const e of reg.exits) {
    if (lv(e.connected_region) === lv(name)) tally(out.boundary, 'of which same-level (separate worlds)');
    const mine = exits.filter((x) => x.region === name && x.exit === e.name);
    if (mine.length === 0 && lv(e.connected_region) === lv(name)) continue; // an in-world pair: below
    // an internal-only member is priced from each inbound root ("from X"); otherwise per arrival
    const k = 'exits';
    tally(out.boundary, k);
    if (mine.length === 0) { tally(out.boundary, 'UNPRICED'); lists.boundary.push(`UNPRICED ${e.name}`); continue; }
    const rules = mine.map((x) => fromMin(x.minimal));
    const distinct = rules.filter((r, i) => rules.findIndex((q) => same(q, r)) === i);
    tally(out.boundary, `arrivals=${mine.length}`);
    if (distinct.length > 1) tally(out.boundary, 'ARRIVAL-DEPENDENT');
    const a = e.access_rule ?? { rule: 'True_' };
    const verdicts = rules.map((d) => cmp(d, a));
    const v = distinct.length === 1 ? verdicts[0] : `mixed:${[...new Set(verdicts)].sort().join('+')}`;
    tally(out.boundary, v);
    if (v !== 'equal') lists.boundary.push(`${v} ${e.name}: today ${JSON.stringify(a)} | derived ${mine.map((x) => `${tagOf(x.label)}=${JSON.stringify(x.minimal)}`).join(' ; ')}`);
  }
  for (const l of reg.locations ?? []) {
    tally(out.location, l.event ? 'events' : 'locations');
    const mine = rec.filter((r) => !r.closure && (r.label === `${name} @ ${l.name}` || r.label.startsWith(`${name} @ ${l.name} (`)));
    if (mine.length === 0) { tally(out.location, 'UNPRICED'); lists.location.push(`UNPRICED ${name} @ ${l.name}`); continue; }
    const a = l.access_rule ?? { rule: 'True_' };
    const rules = mine.map((r) => r.derived);
    const distinct = rules.filter((r, i) => rules.findIndex((q) => same(q, r)) === i);
    if (distinct.length > 1) tally(out.location, 'ARRIVAL-DEPENDENT');
    const verdicts = rules.map((d) => cmp(d, a));
    const v = distinct.length === 1 ? verdicts[0] : `mixed:${[...new Set(verdicts)].sort().join('+')}`;
    tally(out.location, v);
    if (v !== 'equal') lists.location.push(`${v} ${name} @ ${l.name}: today ${JSON.stringify(a)} | derived ${mine.map((r) => `${tagOf(r.label)}=${JSON.stringify(r.derived)}`).join(' ; ')}`);
  }
}
for (const r of rec) {
  const kind = r.closure ? 'inworld' : 'cert';
  tally(out[kind], 'rows');
  tally(out[kind], r.problem ? 'PROBLEM' : r.accepted.length ? 'accepted' : 'agrees');
}
// in-world direct edges: AP internal exits vs the derived pair rule from their source
for (const [name, reg] of Object.entries(R)) {
  if (!levels.has(lv(name))) continue;
  for (const e of reg.exits) {
    if (lv(e.connected_region) !== lv(name)) continue;
    if (exits.some((x) => x.region === name && x.exit === e.name)) continue; // priced as a world exit above
    tally(out.inworld, 'AP internal exits');
    const pair = rec.find((r) => r.closure && r.label === `${name} → ${e.connected_region}`);
    if (!pair) { tally(out.inworld, 'edge: no pair row (internal-only source or not a shared world)'); continue; }
    tally(out.inworld, `edge vs pair: ${cmp(pair.derived, e.access_rule ?? { rule: 'True_' })}`);
  }
}
const cost = E.parts.flatMap((p) => p.cost);
console.log(JSON.stringify({ levels: E.levels.length, wall: E.wall, searches: cost.reduce((a, c) => a + c.searched, 0), states: cost.reduce((a, c) => a + c.states, 0), ...out }, null, 1));
if (LIST) { for (const s of lists.boundary) console.log('B', s); for (const s of lists.location) console.log('L', s); }
