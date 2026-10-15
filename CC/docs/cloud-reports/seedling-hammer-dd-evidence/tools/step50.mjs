// SCRATCH (seedling-hammer-dd D2): survey step 50's staging, DD OFF/ON, lapse OFF/ON, keys md5 + verdict.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const R = process.env.REPO ?? process.cwd();
const { CONTACT_FIDELITY } = await import(join(R, 'frontend/modules/seedlingDemo/contactFidelity.js'));
const P = await import(join(R, 'scripts/procgen/plan-seedling-bobsoldier2.mjs'));
const D = await import(join(R, 'scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs'));
const md5 = (k) => createHash('md5').update(JSON.stringify(k.map((s) => [...s].sort()))).digest('hex');
const st = await P.bobsoldier2Staging();
for (const lapse of [false, true]) for (const on of [false, true]) {
  CONTACT_FIDELITY.strikeIframeLapse = lapse;
  const r = await D.walkKillSolve(st, on);
  console.log(`lapse=${+lapse} dd=${+on} ${r.message ? `REFUSED t${r.ticks} ${createHash('md5').update(r.message).digest('hex').slice(0, 8)}` : `SOLVED ${r.keys.length}`} keys=${md5(r.keys).slice(0, 8)} hits=${r.hits.length} walkKills=${r.records?.filter((x) => x.killedOnWalk).length ?? '-'}`);
}
