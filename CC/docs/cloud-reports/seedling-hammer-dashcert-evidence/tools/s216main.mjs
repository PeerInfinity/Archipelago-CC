// DASHCERT: step 216's boot at this tree's defaults; prints verdict, ticks, hits, DASH_CERT_SIGHT counts
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const sb = await import(M + 'solverBot.js');
const tape = parseTape(JSON.parse(readFileSync(process.argv[3], 'utf8')));
const run = createRunForStaging(solveStaging(stagingFromTape(tape)), atlasLevelSource());
const t0 = Date.now();
let out;
try { const r = sb.solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: tape.boot });
    out = `SOLVED ${r.perTick.length} t hits ${run.playerHits.length} L${run.level} keysmd5 ${(await import('node:crypto')).createHash('md5').update(JSON.stringify(r.perTick.map((k) => [...k].sort()))).digest('hex').slice(0, 8)}`; }
catch (e) { out = 'REFUSED ' + e.message.slice(0, 160); }
console.log(out, '| ms', Date.now() - t0, '| counts', JSON.stringify(sb.DASH_CERT_SIGHT?.counts ?? null));
