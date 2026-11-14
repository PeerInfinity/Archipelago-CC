#!/usr/bin/env node
// rules-l99-l6-witness: replay a committed hand tape on the JS MODEL with its own staging (bodies NOT despawned) and
// print where it ends, the hits, and the bodies alive — or the model's refusal. Usage: node model-replay.mjs <tape.json>...
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const { parseTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { createRunForStaging, stagingFromTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
for (const f of process.argv.slice(2)) {
    const tape = parseTape(readFileSync(f, 'utf8'));
    const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource(), { scratchPersistence: true });
    const keysAt = Array.from({ length: tape.tick_count }, () => new Set());
    for (const i of tape.inputs) for (let t = i.from; t < i.to; t++) keysAt[t].add(i.key);
    let t = 0; let err = null;
    try { for (; t < tape.tick_count; t++) run.advance(keysAt[t]); } catch (e) { err = String(e.message).split('\n')[0].slice(0, 300); }
    console.log('MODEL-REPLAY', JSON.stringify({ tape: f.split('/').pop(), ticks: t, of: tape.tick_count, level: run.level,
        x: +run.state.x.toFixed(1), y: +run.state.y.toFixed(1), hits: run.playerHits.length,
        clears: [...(run.scratchClears ?? [])].map((c) => typeof c === 'string' ? c : `${c.level}:${c.tag}`), refusal: err }));
}
