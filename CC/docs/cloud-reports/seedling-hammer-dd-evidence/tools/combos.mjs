// SCRATCH (seedling-hammer-dd D1): survey step 50's staging (`bobsoldier2Staging`) under every combination of the
// kill arm's neighbouring switches, looking for a kill-rung press-arm dwell that starts with its target gone.
//   REPO=<tree> DD_CENSUS_FILE=x.jsonl node combos.mjs
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const CEN = () => (existsSync(process.env.DD_CENSUS_FILE) ? readFileSync(process.env.DD_CENSUS_FILE, 'utf8').split('\n').filter(Boolean) : []);
const REPO = process.env.REPO;
const M = (p) => import(join(REPO, p));
const sb = await M('frontend/modules/seedlingDemo/solverBot.js');
const { CONTACT_FIDELITY } = await M('frontend/modules/seedlingDemo/contactFidelity.js');
const { createRunForStaging } = await M('frontend/modules/seedlingDemo/tapeRunner.js');
const { atlasLevelSource } = await M('frontend/modules/seedlingDemo/levelSource.js');
const { BOBSOLDIER2_STEP50, bobsoldier2Staging } = await M('scripts/procgen/plan-seedling-bobsoldier2.mjs');
const SW = [
    ['stanceAsForecast', sb.KILL_STANCE_AS_FORECAST],
    ['gateTimed', sb.SWORD_GATE_TIMED],
    ['targetRescan', sb.KILL_STANCE_TARGET_RESCAN],
    ['keylockWait', sb.KEYLOCK_WAIT_PRICED],
];
const staging = await bobsoldier2Staging();
const xs = (process.env.XS ?? '176').split(',').map(Number);
for (let mask = 0; mask < 1 << (SW.length + 1); mask += 1) for (const bx of xs) {
    SW.forEach(([, s], i) => { s.enabled = (mask & (1 << i)) !== 0; });
    CONTACT_FIDELITY.strikeIframeLapse = (mask & (1 << SW.length)) !== 0;
    const tag = SW.map(([n], i) => `${n}=${(mask >> i) & 1}`).join(' ') + ` lapse=${(mask >> SW.length) & 1} bx=${bx}`;
    process.env.DD_TAG = tag;
    const st = { ...staging, boot: { ...staging.boot, x: bx } };
    const run = createRunForStaging(st, atlasLevelSource());
    let v; const c0 = CEN().length;
    try {
        const r = sb.solveSegment({ run, goals: BOBSOLDIER2_STEP50.goals, name: 'combo', boot: st.boot, dashMode: 'all' });
        v = `SOLVED ${r.perTick.length}`;
    } catch (e) { v = `REFUSED t${run.ticksCompleted} ${String(e.message).slice(0, 120).replace(/\n/g, ' ')}`; }
    const ev = CEN().slice(c0).map((l) => JSON.parse(l)).map((r) => `${r.ev}${r.gone !== undefined ? `(gone=${r.gone} t${r.t})` : ''}`);
    console.log(`${tag} :: ${v} :: ${ev.join(' ')}`);
}
