// rules-l99-sided-killlock: the encounter-lock census, every kill-lock's sides (verdict, size, nearest, steps, beyond, across). Run from a repo root.
const M = await import(new URL("scripts/procgen/make-seedling-playthrough-rules.mjs", `file://${process.cwd()}/`).href);
for (const r of M.playthroughEncounterLocks()) console.log(`L${r.level} ${r.at} tag ${r.tag} fires ${r.fires} latch ${r.latch} through ${JSON.stringify(r.through)} why ${r.why}\n  ` + r.sides.map(s=>`${s.verdict} size ${s.size} near ${JSON.stringify(s.nearest)} steps ${JSON.stringify(s.steps)} beyond [${s.beyond}] across [${s.across}]`).join('\n  '));
for (const n of [99,71,60]) console.log(n, JSON.stringify([...M.playthroughEncounterLockOpeners(n)]));
