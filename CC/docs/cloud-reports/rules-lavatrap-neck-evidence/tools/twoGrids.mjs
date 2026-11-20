// rules-lavatrap-neck, designer term 1: the two-grid split. For every level, gridFor(level) (the player's walk, rule T
// stamped) against gridFor(level, {guards: false}) (the block push model / rock Fire narrowings / pit census grid): the
// cells that differ, and whether any lies on a block path (a pushable entity in the level) or a rock's cell.
//   node twoGrids.mjs
const R = new URL('../../../../../', import.meta.url).pathname;
const P = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const { PUSHABLE_KINDS } = await import(R + 'frontend/modules/flashPanel/seedlingBlockPaths.js');
let total = 0;
for (const level of P.PLAYTHROUGH_MAP.levels) {
    const a = P.playthroughGridFor(level);
    const b = P.playthroughGridFor(level, { guards: false });
    const diff = [];
    a.cells.forEach((c, i) => { if (JSON.stringify(c) !== JSON.stringify(b.cells[i])) diff.push(i); });
    if (!diff.length) continue;
    total += diff.length;
    const xy = (i) => [i % a.width, Math.floor(i / a.width)];
    const pushables = (level.entities ?? []).filter((e) => PUSHABLE_KINDS[e.type]);
    const rocks = (level.entities ?? []).filter((e) => /rock/i.test(e.type));
    const kinds = [...new Set(diff.map((i) => `${b.cells[i].kind}->${a.cells[i].kind}`))];
    const conds = [...new Set(diff.map((i) => JSON.stringify(a.cells[i].conditions.slice(b.cells[i].conditions?.length ?? 0))))];
    console.log(`L${level.level}: ${diff.length} cell(s) differ (${kinds.join(', ')}), added ${conds.join(' | ')}; pushables ${pushables.length}, rocks ${rocks.length}`);
    console.log(`  cells ${diff.map((i) => xy(i).join(',')).join(' ')}`);
    const tt = P.playthroughTrapTongues.get(level.level);
    const tcells = new Set((tt?.traps ?? []).flatMap((t) => t.cells.map((c) => c.join(','))));
    console.log(`  every differing cell is a rule-T disc cell: ${diff.every((i) => tcells.has(xy(i).join(',')))}`);
}
console.log(`levels scanned ${P.PLAYTHROUGH_MAP.levels.length}; cells differing in all ${total}`);
