// L40-CORNER: two `--through=end` surveys of one route (OFF, ON) step by step: the verdict tally each way, every step
// whose verdict, ticks, hit count or refusal text moved, and every step that GAINED a hit ON.
//   node survey-diff.mjs <off.json> <on.json>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const load = (p) => new Map(JSON.parse(readFileSync(p, 'utf8')).rows.map((r) => [r.step, r]));
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
const tally = (m) => { const t = {}; for (const r of m.values()) t[r.verdict] = (t[r.verdict] ?? 0) + 1; return t; };
console.log('OFF', JSON.stringify(tally(a)), '| ON', JSON.stringify(tally(b)));
const md5 = (s) => createHash('md5').update(String(s ?? '')).digest('hex').slice(0, 10);
const goal = (r) => (r.goals ?? []).map((g) => g.location ?? g.kind).join(' + ');
let moved = 0;
const gained = [];
for (const [step, x] of a) {
    const y = b.get(step);
    if (!y) { console.log(`step ${step}: missing ON`); continue; }
    const hx = x.replay?.hits ?? null;
    const hy = y.replay?.hits ?? null;
    if ((hy ?? 0) > (hx ?? 0)) gained.push(step);
    const same = x.verdict === y.verdict && x.ticks === y.ticks && hx === hy && md5(x.refusal) === md5(y.refusal);
    if (same) continue;
    moved += 1;
    console.log(`step ${step} L${x.level} [${goal(x)}]: ${x.verdict}${x.ticks ? ` ${x.ticks}t` : ''}${hx !== null ? ` ${hx}hit` : ''}`
        + ` -> ${y.verdict}${y.ticks ? ` ${y.ticks}t` : ''}${hy !== null ? ` ${hy}hit` : ''}`
        + (x.verdict === 'SOLVED' && y.verdict === 'SOLVED' ? '' : ` | OFF ${md5(x.refusal)} ${String(x.refusal ?? '').slice(0, 140)} | ON ${md5(y.refusal)} ${String(y.refusal ?? '').slice(0, 140)}`));
}
console.log(`${moved} step(s) moved; steps that GAINED a hit ON: ${gained.length ? gained.join(', ') : 'none'}`);
