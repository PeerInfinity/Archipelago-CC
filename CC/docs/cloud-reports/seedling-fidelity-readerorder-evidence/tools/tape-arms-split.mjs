#!/usr/bin/env node
// Follow-up to `tape-arms.mjs` (wave 64): for each MOVER it listed, say WHAT moved under each arm — the observation
// stream (`ticks` / `transitions`: the player's positions, the thing a game witness compares) or only the ledgers
// (which top-level keys of the `runTape` result differ), and the first divergent tick with its px. Needs the scratch.
// usage: node tape-arms-split.mjs [--json=out.json]   (reads ../d4/tape-arms.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const HERE = new URL('.', import.meta.url).pathname;
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const T = JSON.parse(readFileSync(join(HERE, '../d4/tape-arms.json'), 'utf8'));
const ARMS = { ii: { arm: 'before' }, iv: { pressLag: true }, 'ii+iv': { arm: 'before', pressLag: true }, occ: { occ: true }, v: { arm: 'before', pressLag: true, occ: true } };
const run = (tape, ro) => { globalThis.__RO = { ...ro, hits: [] }; try { return runTape(tape, { levelSource: atlasLevelSource() }); } catch (e) { return { THROW: String(e?.message ?? e) }; } };
const out = [];
const names = [...new Set(Object.values(T.movers).flat())].sort();
for (const name of names) {
    const tape = JSON.parse(readFileSync(join(ROOT, name), 'utf8'));
    const base = run(tape, {});
    const row = { tape: name, arms: {} };
    for (const [k, ro] of Object.entries(ARMS)) {
        if (!T.movers[k].includes(name)) { row.arms[k] = 'same'; continue; }
        const r = run(tape, ro);
        const keys = [...new Set([...Object.keys(base), ...Object.keys(r)])].filter((x) => JSON.stringify(base[x]) !== JSON.stringify(r[x]));
        let first = null;
        const bt = base.ticks ?? [];
        const rt = r.ticks ?? [];
        for (let i = 0; i < Math.max(bt.length, rt.length); i++) {
            const a = bt[i];
            const b = rt[i];
            if (JSON.stringify(a) !== JSON.stringify(b)) {
                const px = a && b && a.level === b.level ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : null;
                first = { t: i, px: px === null ? null : +px.toFixed(4), base: a && { level: a.level, x: a.x, y: a.y }, arm: b && { level: b.level, x: b.x, y: b.y } };
                break;
            }
        }
        row.arms[k] = { stream: keys.includes('ticks') || keys.includes('transitions') ? 'MOVES' : 'same', keys, first };
    }
    delete globalThis.__RO;
    out.push(row);
    console.log(`${name}: ${Object.entries(row.arms).map(([k, v]) => `${k} ${v === 'same' ? 'same' : `${v.stream === 'MOVES' ? `STREAM MOVES t${v.first?.t} (${v.first?.px} px)` : 'stream same'} [${v.keys.join(',')}]`}`).join(' · ')}`);
}
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify(out, null, 1)}\n`);
