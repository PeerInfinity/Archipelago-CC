// The off-grid blocker census row for L72's lavachain@240,152 (does its minor pocket still split a room?).
const R = process.argv[2] ?? '/home/user/Archipelago-CC/';
const { buildPlaythroughAtlas } = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const { censusOffGridBlockers } = await import(R + 'scripts/procgen/census-seedling-offgrid-blockers.mjs');
const rows = censusOffGridBlockers({ atlas: buildPlaythroughAtlas() });
for (const r of rows.filter((x) => x.level === 72)) console.log(JSON.stringify(r).slice(0, 1500));
