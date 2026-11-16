#!/usr/bin/env node
// rules-arrival-chase-witness: replay a tape on the JS model; print hits, level, end position and chest opens.
import { readFileSync } from 'node:fs'; import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { SEEDLING_SET_PATCHES, patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const MAP = JSON.parse(readFileSync(join(R, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const levelSource = levelSourceFromAtlas(patchedMapDocument(MAP, [...SEEDLING_SET_PATCHES]));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const run = createRunForStaging(tape, levelSource, { scratchPersistence: true });
const keysAt = (t) => new Set(tape.inputs.filter((i) => i.from <= t && t < i.to).map((i) => i.key));
let err = null;
for (let t = 0; t < tape.tick_count; t++) { try { run.advance(keysAt(t)); } catch (e) { err = `t${t}: ${String(e.message).slice(0, 200)}`; break; }
    if (t % 10 === 0 && process.argv.includes('--trace')) console.log(t, run.level, run.state.x.toFixed(1), run.state.y.toFixed(1), run.playerHits.length); }
console.log('MODEL', JSON.stringify({ level: run.level, x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1), hits: run.playerHits.map((h) => `${h.id ?? h.source}@${h.t}`),
    chestOpens: run.chestOpens, openChests: [...(run.openChests ?? [])], collected: [...(run.collected ?? [])].slice(0, 10), err }));
