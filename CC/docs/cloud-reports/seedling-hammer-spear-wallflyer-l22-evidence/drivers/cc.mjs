// node cc.mjs <inventory csv> — canCross L22 (from L25's door) → L29, dashMode none; prints verdict + the arms' counts.
const WT = process.env.WT || '/home/user/Archipelago-CC';
const M = (p) => import(`${WT}/frontend/modules/seedlingDemo/${p}`);
const { canCross } = await M('seedlingCanCross.js');
const sb = await M('solverBot.js'); const sa = await M('spearArm.js');
sb.resetBodyFamilyKillCounts(); sa.resetSpearArmCounts();
const inventory = (process.argv[2] || 'spear').split(',');
const r = canCross({ level: 22, exit: 29, arrival: { from: 25 }, dashMode: process.env.DASH || 'none', witness: false, inventory });
const { ms, ...rest } = r;
console.log(JSON.stringify({ inventory, verdict: r.verdict, ticks: r.ticks ?? r.plan?.ticks ?? null, hits: r.hits ?? null, keys: Object.keys(rest),
  why: String(r.why ?? '').slice(0, 260), kills: sb.BODY_FAMILY_KILL_COUNTS.kills.map((k) => [k.id, k.t, k.ticks, k.forks]),
  asked: sb.BODY_FAMILY_KILL_COUNTS.asked, spear: sa.SPEAR_ARM_COUNTS }));
