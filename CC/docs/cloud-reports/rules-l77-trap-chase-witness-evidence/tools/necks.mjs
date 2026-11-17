// rules-l77-trap-chase-witness: which T discs sit on a room's ONLY neck. Pure grid reachability on the producer's
// playthrough grid (`playthroughGridFor`), no wiring patch needed: the T discs are read from the prior slice's
// `runs/guards-tip.txt` (rules-chaser-arrival-killarm, producer-wiring.patch applied there).
//   node necks.mjs
// A cell is passable when it is `open`, or `gated` by anything but the Dark Suit (every other item assumed held: the
// question is the Dark Suit's own reach). Lava (gated hasDarkSuit) is impassable. The anchors are the room's door
// tiles and its chest/item entities. Per level: the anchor pairs connected at base, and which pairs each disc (and
// all discs together) disconnects when its cells become impassable.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../../../../..');
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const guards = readFileSync(path.join(here, '../../rules-chaser-arrival-killarm-evidence/runs/guards-tip.txt'), 'utf8');
const discs = new Map();
for (const m of guards.matchAll(/^L(\d+) T lavatrap tile (\d+,\d+): \d+ cells (.*)$/gm)) {
    const n = Number(m[1]); if (!discs.has(n)) discs.set(n, []);
    discs.get(n).push({ trap: m[2], cells: m[3].trim().split(' ') });
}
const isSuitOnly = (c) => JSON.stringify(c.conditions ?? []) === '[{"flag":"hasDarkSuit"}]';
for (const [n, ds] of discs) {
    const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
    const g = P.playthroughGridFor(level);
    const pass = (x, y, blocked) => x >= 0 && y >= 0 && x < g.width && y < g.height && !blocked.has(`${x},${y}`)
        && (g.cells[y * g.width + x].kind === 'open' || (g.cells[y * g.width + x].kind === 'gated' && !isSuitOnly(g.cells[y * g.width + x])));
    const anchors = (level.entities ?? []).filter((e) => /teleporter|chest|stairs|item/i.test(e.type))
        .map((e) => ({ name: `${e.type}@${e.x},${e.y}${e.attrs?.to ? '->' + e.attrs.to : ''}`, t: `${Math.min(g.width - 1, Math.floor(e.x / 16))},${Math.min(g.height - 1, Math.floor(e.y / 16))}` }));
    const comp = (blocked) => { const lab = new Map(); let k = 0;
        for (const a of anchors) { if (lab.has(a.t)) continue; const [sx, sy] = a.t.split(',').map(Number); if (!pass(sx, sy, blocked)) continue;
            const q = [a.t]; lab.set(a.t, k); while (q.length) { const [x, y] = q.shift().split(',').map(Number);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = `${x + dx},${y + dy}`; if (!lab.has(t) && pass(x + dx, y + dy, blocked)) { lab.set(t, k); q.push(t); } } } k++; }
        return lab; };
    const pairs = (lab) => { const out = []; for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
        const a = lab.get(anchors[i].t); if (a !== undefined && a === lab.get(anchors[j].t)) out.push(`${anchors[i].name} ~ ${anchors[j].name}`); } return out; };
    const base = pairs(comp(new Set()));
    console.log(`L${n}: anchors ${anchors.map((a) => `${a.name}[${a.t}]`).join(' ')}; connected at base (Dark Suit off): ${base.length ? base.join('; ') : 'none'}`);
    const all = new Set(ds.flatMap((d) => d.cells.filter((c) => c !== d.trap)));
    const lostAll = base.filter((p) => !pairs(comp(all)).includes(p));
    for (const d of ds) {
        const lost = base.filter((p) => !pairs(comp(new Set(d.cells.filter((c) => c !== d.trap)))).includes(p));
        console.log(`  T ${d.trap}: alone seals ${lost.length ? lost.join('; ') : 'nothing'}`);
    }
    if (ds.length > 1) console.log(`  all ${ds.length} discs together seal ${lostAll.length ? lostAll.join('; ') : 'nothing'}`);
}
