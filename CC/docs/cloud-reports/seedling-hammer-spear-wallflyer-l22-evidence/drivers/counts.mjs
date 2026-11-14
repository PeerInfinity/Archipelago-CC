// node counts.mjs <request.json> [variant] — replay.mjs plus the arms' counts (BODY_FAMILY_KILL_COUNTS, SPEAR_ARM counts).
const WT = process.env.WT || '/home/user/Archipelago-CC';
const sb = await import(`${WT}/frontend/modules/seedlingDemo/solverBot.js`);
const sa = await import(`${WT}/frontend/modules/seedlingDemo/spearArm.js`);
sb.resetBodyFamilyKillCounts();
const origLog = console.log; let out = '';
console.log = (s) => { out += s; };
await import('./replay.mjs');
console.log = origLog;
const o = JSON.parse(out);
o.bodyFamily = JSON.parse(JSON.stringify(sb.BODY_FAMILY_KILL_COUNTS));
o.spearArm = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(sa).filter(([k, v]) => /COUNT/.test(k)))));
console.log(JSON.stringify(o, null, 1));
