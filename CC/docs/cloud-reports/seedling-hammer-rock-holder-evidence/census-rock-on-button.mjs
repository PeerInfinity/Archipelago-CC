// Census for slice ROCK-HOLDER (measure-only): which levels hold a FallRock whose landed cell overlaps a presser's
// (button / buttonroom) rect — the "a fallen rock rests on a button" geometry — and which divergence-sweep legs
// (seed 1, `seedling-divergence-legs.mjs`'s jsonl) arrive in such a level with the rock's tag cleared, either by the
// AP route's inventory at the leg's sphere (the true game state) or by the sweep's own staging.
//   node scripts/procgen/seedling-divergence-legs.mjs --out=<legs.jsonl>
//   node CC/docs/cloud-reports/seedling-hammer-rock-holder-evidence/census-rock-on-button.mjs <legs.jsonl>
import { readFileSync } from 'node:fs';
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging } from '../../../../frontend/modules/seedlingDemo/fidelityArrival.js';

const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const levels = [...new Set(legs.map((l) => l.level))].sort((a, b) => a - b);
const run = createRunForStaging(arrivalStaging({ level: 28, x: 128, y: 288 }, { items: [], cleared: [] }), atlasLevelSource());
const overlap = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
const rockRect = (r) => ({ x: r.x, y: r.y, right: r.x + 16, bottom: r.y + 16 });
const pairs = [];
for (const n of levels) {
    let w;
    try { w = run.worldFor(n); } catch (e) { console.log(`level ${n}: world refused (${e.message.slice(0, 120)})`); continue; }
    for (const r of w.fallRocks ?? []) {
        for (const p of w.pressers ?? []) {
            if (overlap(rockRect(r), p.rect)) pairs.push({ level: n, rock: r.id, rockGroup: r.t, rockTag: r.persistTag,
                presser: `${p.tag}@${p.x},${p.y}`, presserGroup: p.t });
        }
    }
}
console.log('ROCK-ON-BUTTON GEOMETRY:', JSON.stringify(pairs));
// the flags that drop each rock: any rope/presser in the rock's group whose tag the route clears; matched by the
// inventory's "L<n> flag <tag>: <what> cleared" rows naming that level
for (const pr of pairs) {
    const here = legs.filter((l) => l.level === pr.level);
    console.log(`\nL${pr.level} ${pr.rock} (group ${pr.rockGroup}, tag ${pr.rockTag}) on ${pr.presser} (group ${pr.presserGroup}): ${here.length} leg(s)`);
    for (const l of here) {
        const inv = (l.sphere?.inventory ?? []).filter((i) => i.startsWith(`L${pr.level} flag `));
        const staged = (l.stagedEvents ?? []).filter((e) => e.level === pr.level).map((e) => `flag:L${e.level}:${e.tag}`);
        console.log(`  ${l.key} | sphere ${l.sphere?.label ?? '-'} | route holds ${JSON.stringify(inv)} | sweep stages ${JSON.stringify(staged)}`);
    }
}
