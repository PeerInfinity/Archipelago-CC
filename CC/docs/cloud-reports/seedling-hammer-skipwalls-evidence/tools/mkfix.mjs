import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest, captureRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atlasLevelSource } = await import(R + 'frontend/modules/seedlingDemo/levelSource.js');
const [file, id, i, keep, out] = process.argv.slice(2);
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === Number(id));
const c = leg.requests.find((r) => r.i === Number(i));
const recs = c.request.source.records.__map;
const base = atlasLevelSource();
const differ = [];
for (const [lvl, rec] of recs) {
  let theirs; try { theirs = JSON.stringify(captureRequest({ x: base(lvl) }).x); } catch (e) { theirs = 'ERR'; }
  if (JSON.stringify(rec) !== theirs) differ.push(lvl);
}
console.log('levels', recs.map(([l]) => l).join(','), 'differ from atlas:', differ.join(','));
const keepL = keep.split(',').map(Number);
const { source, ...request } = c.request;
if (out) writeFileSync(out, JSON.stringify({ capture: `seedling-whole-game-wasm-remeasure-7 P1.stop-requests.jsonl.gz (origin/claude/whole-game-wasm-remeasure-yl4bw0 @7ce198106c), row id ${id} (${leg.key}), request i=${i} (goal ${c.goal}): the page worker request with its source cut to the L${keepL.join('/L')} records (the rest is the committed atlas)`, env: 'SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1', levels: recs.filter(([l]) => keepL.includes(l)), request }) + '\n');
