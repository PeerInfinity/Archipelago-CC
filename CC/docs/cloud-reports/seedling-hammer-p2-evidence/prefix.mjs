// D1 probe: the refuge's candidate previews from one state — how long do their key sequences agree?
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { previewWalk, walkableCells } = await import(M + 'solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/hammer-p1-l40-south-boot.json', 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
// stand at the refuge staging A waits at (727.7, 663.9) is not reachable without the kill; use the boot and the
// 12 nearest walkable cells (deriveRefuge's candidate rule without the hammer filter)
const cells = walkableCells(run, new Set()).map((c) => ({ ...c, d: Math.hypot(c.x - run.state.x, c.y - run.state.y) }))
    .sort((a, b) => a.d - b.d).slice(0, 12);
const seqs = cells.map((c) => previewWalk(run, [{ x: c.x, y: c.y }], 1.0).samples.map((s) => [...s.held].sort().join('+')));
const lens = seqs.map((s) => s.length);
let pairs = 0; let shared = 0; let total = 0;
for (let a = 0; a < seqs.length; a += 1) for (let b = a + 1; b < seqs.length; b += 1) {
    let k = 0; while (k < seqs[a].length && k < seqs[b].length && seqs[a][k] === seqs[b][k]) k += 1;
    pairs += 1; shared += k; total += Math.min(seqs[a].length, seqs[b].length);
}
const first = seqs.map((s) => s[0]);
console.log(JSON.stringify({ lens, firstKeys: first, pairs, meanSharedPrefix: shared / pairs, meanShorter: total / pairs }));
process.exit(0);
