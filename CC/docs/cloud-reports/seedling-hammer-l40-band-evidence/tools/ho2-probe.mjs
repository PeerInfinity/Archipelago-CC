// LB D2 (measure) — HO2 bounded: 414's atlas boot (ghost, defaults unless env) solved by `solveSegment` with a tick
// sentinel at --cap (default 1300): OFF the kill passes its first death and the sentinel fires; ON it refuses at the death.
//   node ho2-probe.mjs [--cap=1300] [--on]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { solveSegment } = await M('solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const { parseTape } = await M('tapeFormat.js');
const { withPressKillRebootGuard } = await M('pressKillGuards.js');
const view = join(REPO, 'CC/docs/cloud-reports/seedling-fidelity-l40contact-evidence/d4/boot-414.json');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(view, 'utf8'))));
staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
const cap = Number(process.argv.find((a) => a.startsWith('--cap='))?.slice(6) ?? 1300);
const run = createRunForStaging(staging, atlasLevelSource());
const adv = run.advance.bind(run);
run.advance = (k) => { if (run.ticksCompleted >= cap) throw Object.assign(new Error('SENTINEL'), { sentinel: true }); return adv(k); };
const t0 = Date.now();
try {
    withPressKillRebootGuard(process.argv.includes('--on'), () => solveSegment({ run, goals: [{ kind: 'collect-placement',
        placement: { x: 880, y: 816 } }], name: 'lb-ho2', boot: staging.boot, dashMode: 'all' }));
    console.log('SOLVED?');
} catch (e) {
    console.log(e.sentinel ? 'SENTINEL' : e.name, 't', run.ticksCompleted, 'deaths', run.ledger('playerDeaths').map((d) => d.t),
        'perTick', e.perTick?.length ?? null, 'obstacle', JSON.stringify(e.obstacle ?? null), String(e.message).slice(0, 160));
}
console.log('s', (Date.now() - t0) / 1000);
