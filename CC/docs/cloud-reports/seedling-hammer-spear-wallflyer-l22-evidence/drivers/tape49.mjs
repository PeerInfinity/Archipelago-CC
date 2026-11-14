// node tape49.mjs <request.json> <out tape.json> — solve the captured request as the worker does (replay.mjs), write the
// plan (prefix + solution, equips {t, slot}) as a v4+ walk tape on the request's own staging, then replay the TAPE on the
// model (parseTape → createRunForStaging) and print its hits / level, so the tape is checked before the game sees it.
import { readFileSync, writeFileSync } from 'node:fs';
const WT = process.env.WT || '/home/user/Archipelago-CC';
const M = (p) => import(`${WT}/frontend/modules/seedlingDemo/${p}`);
const { restoreRequest } = await import(`${WT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas, indexLevels } = await M('atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await M('jsRuntimeSolver.js');
const { parseTape, heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { loadAtlas } = await M('levelSource.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const [file, out] = process.argv.slice(2);
const req = restoreRequest(JSON.parse(readFileSync(file, 'utf8')).request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
if (!(source.records instanceof Map) || source.records.size === 0) source.records = indexLevels(patchedMapDocument(loadAtlas()));
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
if (!a.ok) { console.log(JSON.stringify({ ok: false, message: String(a.message).slice(0, 300) })); process.exit(1); }
const perTick = [...tape.perTick, ...a.plan.solution];
const open = new Map(); const inputs = [];
perTick.forEach((held, t) => {
  for (const k of held) if (!open.has(k)) open.set(k, t);
  for (const [k, from] of [...open]) if (!held.has(k)) { inputs.push({ key: k, from, to: t }); open.delete(k); }
});
for (const [k, from] of open) inputs.push({ key: k, from, to: perTick.length });
inputs.sort((x, y) => x.from - y.from || x.to - y.to || x.key.localeCompare(y.key));
const equips = [...(tape.equips ?? [])].map(([t, slot]) => ({ t, slot }));
for (const [i, slot] of a.plan.equipsAt ?? []) equips.push({ t: tape.perTick.length + i, slot });
const st = JSON.parse(JSON.stringify(tape.staging));
if (st.seam?.items && 'hitsMax' in st.seam.items) { st.seam.hits_max = st.seam.items.hitsMax; delete st.seam.items.hitsMax; }
const walk = { game: 'seedling', tape_version: 8, name: process.env.NAME || 'r49', ...st, equips, tick_count: perTick.length, inputs };
writeFileSync(out, JSON.stringify(walk, null, 1));
const t2 = parseTape(JSON.stringify(walk));
const r = createRunForStaging(solveStaging(stagingFromTape(t2)), levelSource);
let crossed = null;
for (let t = 0; t < t2.tick_count; t += 1) { const { transition } = r.advance(heldKeysAt(t2, t)); if (transition && !crossed) crossed = { t, to: transition.to_level }; }
console.log(JSON.stringify({ ok: true, ticks: perTick.length, equips, presses: perTick.map((k, i) => (k.has('primary') ? i : -1)).filter((i) => i >= 0),
  same: perTick.every((h, t) => [...h].sort().join() === [...heldKeysAt(t2, t)].sort().join()),
  crossed, hits: r.ledger('playerHits').map((h) => `t${h.t} ${h.id}`), deaths: r.ledger('playerDeaths').length, level: r.level, x: r.state.x, y: r.state.y }));
