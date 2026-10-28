// scratch: replay step67 boot + a prefix, print the bodies, the player and an ASCII map around a box
import { readFileSync } from 'node:fs';
const D = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const boot = args.boot ?? D + 'fixtures/l40bk2-witness/step67-boot.json';
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const ks = args.prefix ? JSON.parse(readFileSync(args.prefix, 'utf8')) : [];
const upto = Number(args.t ?? ks.length);
for (const k of ks.slice(0, upto)) run.advance(new Set(k));
const s = run.state;
console.log(`t${run.ticksCompleted} player (${s.x.toFixed(1)},${s.y.toFixed(1)}) hp? ${JSON.stringify(run.progress('inventory'))?.slice(0,200)}`);
for (const c of run.entities('chasers') ?? []) if (Math.abs(c.x - s.x) < 260 && Math.abs(c.y - s.y) < 260) console.log(`chaser ${c.id} (${c.x.toFixed(1)},${c.y.toFixed(1)}) hits ${c.hits} spin ${c.swordSpin?.toFixed?.(2)} spinning ${c.swordSpinning} reset ${c.swordSpinResetTimer} hitsTimer ${c.hitsTimer} destroy ${c.destroy}`);
for (const c of run.entities('spinnerBodies') ?? []) if (Math.abs(c.x - s.x) < 260) console.log(`spinner ${c.id} (${c.x.toFixed(1)},${c.y.toFixed(1)})`);
console.log('persistence', JSON.stringify(run.progress('persistence'))?.slice(0, 400));
