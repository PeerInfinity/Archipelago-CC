#!/usr/bin/env node
// DEADFRAME2 D3: the runtime probe over every committed tape, all three keys ON (`--over=` adds keys); needs
// `probe2-scratch.py apply`. With `--preload` this file is a `node --import` preload for the acceptance batch instead.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
globalThis.__DFP2 = { c: {} };
if (process.env.DFP2_PRELOAD) {
    process.on('exit', () => process.stderr.write(`DEADFRAME2-PROBE ${JSON.stringify(globalThis.__DFP2.c)}\n`));
} else {
    const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
    const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
    const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
    const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
    const OVER = { freezeFramesStepResponders: true, pulserDeadFrameUpdate: true, blockPressesFallRockButtonSameFrame: true, ...JSON.parse(arg('over', '{}')) };
    const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
        ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
    let n = 0; let threw = 0;
    for (const p of files) {
        let tape;
        try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
        if (!tape?.inputs || !tape?.boot) continue;
        n += 1;
        try { withContactFidelity(OVER, () => runTape(tape, { levelSource: atlasLevelSource() })); } catch { threw += 1; }
    }
    console.log(`tapes ${n} (threw ${threw}); over ${JSON.stringify(OVER)}\n${JSON.stringify(globalThis.__DFP2.c)}`);
}
