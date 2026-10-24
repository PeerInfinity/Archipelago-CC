// LB D2 (measure) — HO1 at its state: 414's atlas boot (ghost) replayed by its own keys to t2439, then the press kill's
// own derivation (`deriveStrike(run, 'spinner@880,848', new Set(), notBefore)`) asked OFF and ON.
//   node ho1-probe.mjs <keylog.json> [--write-tape=<out>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { deriveStrike } = await M('solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const { parseTape } = await M('tapeFormat.js');
const { withPressKillShakeGuard } = await M('pressKillGuards.js');
const view = join(REPO, 'CC/docs/cloud-reports/seedling-fidelity-l40contact-evidence/d4/boot-414.json');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(view, 'utf8'))));
staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
const keys = JSON.parse(readFileSync(process.argv[2], 'utf8')).perTick;
const T = Number(process.argv.find((a) => a.startsWith('--t='))?.slice(4) ?? 2439);
const run = createRunForStaging(staging, atlasLevelSource());
for (let t = 0; t < T; t += 1) run.advance(new Set(keys[t] ?? []));
const body = run.entities('spinnerBodies').find((b) => b.id === 'spinner@880,848');
const nb = body.hitsTimer > 0 ? body.hitsTimer : 0;
console.log('t', run.ticksCompleted, 'deaths', run.ledger('playerDeaths').map((d) => d.t), 'body hits', body.hits, 'timer', body.hitsTimer);
for (const on of [false, true]) {
    try {
        const r = withPressKillShakeGuard(on, () => deriveStrike(run, 'spinner@880,848', new Set(), nb));
        console.log(on ? 'ON ' : 'OFF', 'cell', r.cell, 'considered', r.considered, 'shakeRows',
            r.rejected.filter((x) => /shake band/.test(x.why)).length, '| first:', r.rejected[0]?.why.slice(0, 200));
    } catch (e) { console.log(on ? 'ON ' : 'OFF', 'THREW', e.message.slice(0, 120)); }
}
const out = process.argv.find((a) => a.startsWith('--write-tape='))?.slice(13);
if (out) writeFileSync(out, JSON.stringify({ view: 'boot-414.json', ghost: true, ticks: T, keys: keys.slice(0, T).map((k) => k ?? []) }));
