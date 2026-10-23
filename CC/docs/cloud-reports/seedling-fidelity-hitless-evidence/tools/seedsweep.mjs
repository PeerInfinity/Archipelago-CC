// Measure: the L57 Tentacled Beast solve across rng seeds, tentacleHitlessFirst OFF vs ON.
// usage: node seedsweep.mjs <tape.json> <seedFrom> <seedTo> [on|off|both]
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { solveSegment } = await import(M + 'solverBot.js');
const SRC = atlasLevelSource();
const [file, a, b, which = 'both'] = process.argv.slice(2);
let tape = JSON.parse(readFileSync(file, 'utf8'));
if (tape.tape) tape = tape.tape;
const goals = [
    { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
    { kind: 'reach-exit', exit: { x: 96, y: 64 } },
];
const arms = which === 'both' ? [false, true] : [which === 'on'];
for (let seed = Number(a); seed <= Number(b); seed += 1) {
    const row = { seed };
    for (const on of arms) {
        const staging = stagingFromTape(parseTape(JSON.stringify({ ...tape, rng: { ...tape.rng, seed }, inputs: [], tick_count: 0 })));
        const t0 = Date.now();
        try {
            withContactFidelity({ tentacleHitlessFirst: on }, () => {
                const run = createRunForStaging(staging, SRC);
                const out = solveSegment({ run, goals, name: 'seed', boot: staging.boot, forkRun: () => createRunForStaging(staging, SRC) });
                const hits = (run.ledger('playerHits') ?? []).map((h) => `${h.t}:${h.source}`);
                const verb = JSON.stringify(out).match(/"verb":"tentaclebeast".{0,0}/) ? null : null;
                const rec = (out.records ?? []).find((x) => x.verb === 'tentaclebeast');
                row[on ? 'on' : 'off'] = { ticks: out.perTick.length, level: run.level, hits, params: rec?.params,
                    tried: rec?.tried?.map((t) => `${t.ok ? 'ok' : 'X'}:${t.spent}${t.hits !== undefined ? `/h${t.hits}` : ''}`), choice: rec?.choice, ms: Date.now() - t0 };
            });
        } catch (e) {
            row[on ? 'on' : 'off'] = { error: String(e.message).slice(0, 200) };
        }
    }
    console.log(JSON.stringify(row));
}
function findVerb(o, seen = new Set()) {
    if (!o || typeof o !== 'object' || seen.has(o)) return null;
    seen.add(o);
    if (o.verb === 'tentaclebeast' || o.strategy === 'tentaclebeast' && o.tried) return o;
    for (const v of Object.values(o)) { const r = findVerb(v, seen); if (r) return r; }
    return null;
}
