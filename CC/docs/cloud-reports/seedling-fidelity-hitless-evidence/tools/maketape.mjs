// Solve L57 (clear-tag {57,0} + the mouth) from a staging tape with tentacleHitlessFirst ON|OFF; write the solve as a tape.
// usage: node maketape.mjs <staging.json> <name> <out.json> [on|off] [seed]
import { readFileSync, writeFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const SRC = atlasLevelSource();
const [file, name, outFile, arm = 'on', seedArg] = process.argv.slice(2);
let tape = JSON.parse(readFileSync(file, 'utf8')); if (tape.tape) tape = tape.tape;
if (seedArg !== undefined) tape = { ...tape, rng: { ...tape.rng, seed: Number(seedArg) } };
const goals = [{ kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' }, { kind: 'reach-exit', exit: { x: 96, y: 64 } }];
const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, inputs: [], tick_count: 0 })));
withContactFidelity({ tentacleHitlessFirst: arm === 'on' }, () => {
    const run = createRunForStaging(staging, SRC);
    const out = solveSegment({ run, goals, name, boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
    const per = out.perTick;
    const inputs = [];
    const open = new Map();
    for (let t = 0; t <= per.length; t += 1) {
        const keys = t < per.length ? per[t] : new Set();
        for (const [k, from] of [...open]) if (!keys.has(k)) { inputs.push({ key: k, from, to: t }); open.delete(k); }
        for (const k of keys) if (!open.has(k)) open.set(k, t);
    }
    inputs.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
    const rec = out.records.find((r) => r.verb === 'tentaclebeast');
    // one tick past the solve, so the probe's dropped last tick is not a solve tick
    const t2 = { ...tape, name, inputs, tick_count: per.length + 1 };
    writeFileSync(outFile, JSON.stringify(t2, null, 1));
    console.log(JSON.stringify({ name, ticks: per.length, level: run.level, hits: (run.ledger('playerHits') ?? []).map((h) => `${h.t}:${h.source}`),
        choice: rec?.choice ?? null, params: rec?.params, seed: tape.rng.seed }));
});
