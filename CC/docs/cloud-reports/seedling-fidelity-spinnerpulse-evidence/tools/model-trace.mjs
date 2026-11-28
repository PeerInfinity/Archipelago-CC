#!/usr/bin/env node
// wave 72 (SPINNERPULSE) D1: the model's per-tick spinner stream on a committed tape (row t = after t advances):
// every live spinner's x, y, hits, hitsTimer, destroy, alpha, plus the pulse hits and the enemy kills this tick.
// usage: OVER='{"k":true}' node model-trace.mjs --tape=r5-shaft-control [--json=out.json] [--from=a --to=b]
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(`${ROOT}frontend/modules/seedlingDemo/${p}`);
const { atlasLevelSource } = await M('levelSource.js');
const { withContactFidelity } = await M('contactFidelity.js');
const { heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const name = arg('tape', 'r5-shaft-control');
// `--source=atlas` (the default: the raw atlas, `runTape`'s committed-tape source) or `--source=set` (the witness's mounted
// `l25Sets().vanilla` record set, which carries `SEEDLING_SET_PATCHES` — in L39, no `fallrock@144,624`).
const SOURCE = arg('source', 'atlas');
const L25 = await M('fidelityL25ApItem.js');
const levelSource = SOURCE === 'set' ? L25.l25Sets(ROOT).vanillaSource : atlasLevelSource();
const tape = JSON.parse(readFileSync(`${ROOT}frontend/modules/seedlingDemo/fixtures/tapes/${name}.json`, 'utf8'));
const over = JSON.parse(process.env.OVER ?? '{}');
const rows = [];
let error = null; let run;
withContactFidelity(over, () => {
    try {
        run = createRunForStaging(stagingFromTape(tape), levelSource);
        let ph = 0; let pk = 0;
        for (let t = 0; t < tape.tick_count; t++) {
            run.advance(heldKeysAt(tape, t));
            const hits = run.pulserHits; const kills = run.pulserEnemyKills;
            rows.push({ t: t + 1, level: run.level, px: run.state.x, py: run.state.y,
                sp: (run.spinnerBodies ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y, hits: s.hits, ht: s.hitsTimer, d: s.destroy, a: s.alpha })),
                pulses: hits.slice(ph).map((h) => h.id), kills: kills.slice(pk).map((k) => k.enemy) });
            ph = hits.length; pk = kills.length;
        }
    } catch (e) { error = String(e?.stack ?? e).slice(0, 600); }
});
const writes = run?.spinnerWrites ?? [];
if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify({ tape: name, source: SOURCE, over, error, writes, rows }));
const from = Number(arg('from', 0)); const to = Number(arg('to', 1e9));
for (const r of rows) if (r.t >= from && r.t <= to && (r.sp.length || r.pulses.length)) console.log(r.t, r.level, JSON.stringify(r.sp), r.pulses.length ? `PULSE ${r.pulses}` : '', r.kills.length ? `KILL ${r.kills}` : '');
console.log('error', error, 'writes', JSON.stringify(writes));
