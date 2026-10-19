// SCRATCH (seedling-fidelity-digest D2/D3): every committed tape replayed on TWO fresh runs in lockstep; the digest
// every tick on both (they must agree: determinism, no identities), its cost, `fresh` vs memo at the end, and (with
// the debug hook) the paths where a function sits in a non-world component.
//   REPO=<tree> node replay-scan.mjs [--tapes=a,b] [--fn] > out.jsonl
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO; const M = join(R, 'frontend/modules/seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { loadTape } = await import(join(M, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { heldKeysAt, parseTape } = await import(join(M, 'tapeFormat.js'));
const idx = JSON.parse(readFileSync(join(M, 'fixtures/tapes/index.json'), 'utf8'));
const names = arg('tapes', '') ? arg('tapes').split(',') : idx.tapes.map((t) => t.file.replace(/\.json$/, ''));
const found = new Map();
if (process.argv.includes('--fn')) {
    const walkFn = (v, path, seen) => {
        if (typeof v === 'function') { found.set(path, (found.get(path) ?? 0) + 1); return; }
        if (v === null || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
        if (v instanceof Map) { for (const [k, x] of v) walkFn(x, `${path}.${typeof k === 'number' ? '#' : 'k'}`, seen); return; }
        if (v instanceof Set) { for (const x of v) walkFn(x, `${path}{}`, seen); return; }
        if (Array.isArray(v)) { v.forEach((x) => walkFn(x, `${path}[]`, seen)); return; }
        for (const k of Reflect.ownKeys(v)) { const d = Object.getOwnPropertyDescriptor(v, k); if ('value' in d) walkFn(d.value, `${path}.${String(k)}`, seen); }
    };
    globalThis.__DIGEST_DEBUG = (v) => { if (v && 'worlds' in v) return; walkFn(v, '', new Set()); };
}
for (const name of names) {
    const row = { name };
    try {
        const tape = parseTape(loadTape(name));
        const st = stagingFromTape(tape);
        const a = createRunForStaging(st, atlasLevelSource());
        const b = createRunForStaging(st, atlasLevelSource());
        const ms = []; let differ = 0; let distinct = new Set(); let ticks = 0;
        for (let t = 0; t < tape.tick_count; t += 1) {
            const t0 = performance.now(); const da = a.stateDigest(); ms.push(performance.now() - t0);
            if (da !== b.stateDigest()) differ += 1;
            distinct.add(da); ticks += 1;
            const h = heldKeysAt(tape, t); a.advance(h); b.advance(h);
        }
        ms.sort((x, y) => x - y);
        Object.assign(row, { level: tape.boot.level, ticks, differ, distinct: distinct.size,
            medMs: +ms[ms.length >> 1]?.toFixed(4), p90Ms: +ms[Math.floor(ms.length * 0.9)]?.toFixed(4), maxMs: +ms[ms.length - 1]?.toFixed(3),
            freshEqualsMemo: a.stateDigest({ fresh: true }) === a.stateDigest() });
    } catch (e) { row.error = String(e.message).split('\n')[0].slice(0, 200); }
    console.log(JSON.stringify(row));
}
if (found.size) console.log(JSON.stringify({ fnPaths: Object.fromEntries([...found].sort()) }));
