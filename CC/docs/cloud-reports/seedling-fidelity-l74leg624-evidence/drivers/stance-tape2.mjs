// scratch: run leg 624 (lab, C4_ARM=1 C4_APPEND=1), capture the chaser arm's preview held sets for one stance,
// and write a v8 tape of that preview from the leg's own staging.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const want = process.env.STANCE ?? '264,120';
let cap = null; let staging = null;
globalThis.__C4 = (r) => { if (r.at === 'chaserArm' && !cap && `${r.c.x},${r.c.y}` === want && r.target === (process.env.TARGET ?? 'lavarunner@208,96')) cap = r; };
const origLog = console.log; let out = null;
console.log = (s) => { out = s; };
process.argv.push('--staging');
await import('./leg.mjs');
console.log = origLog;
staging = JSON.parse(out).staging;
const REPO = process.env.REPO;
const { buildStagedTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const perTick = cap.samples.map((s) => new Set(s[5] ? s[5].split('+') : []));
const tape = buildStagedTape({ staging: { ...staging, equips: [] }, perTick, name: process.env.TAPE_NAME ?? `l74leg624-stance-${want.replace(',', '-')}` });
writeFileSync(process.env.OUT, typeof tape === 'string' ? tape : JSON.stringify(tape, null, 1));
console.log('wrote', process.env.OUT, perTick.length, 'ticks; danger', JSON.stringify(cap.danger), 'death', cap.deathTick);
