// re-solve a contact capture's request in node (produce service, as the page's solver) and print the plan's length + unbilled hits
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const { untag } = await import(join(REPO, 'scripts/procgen/replay-seedling-contact-capture.mjs'));
const sb = await import(join(REPO, 'frontend/modules/seedlingDemo/solverBot.js'));
const { createInPlaceProduceService } = await import(join(REPO, 'frontend/modules/seedlingDemo/wasmWalkTape.js'));
const { levelSourceFromAtlas } = await import(join(REPO, 'frontend/modules/seedlingDemo/atlasSource.js'));
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const req = untag(cap.request);
const seen = [];
sb.UNBILLED_DAMAGE_TRACE.sink = (r) => seen.push(r);
const recs = untag(cap.records);
const r = createInPlaceProduceService().start({ ...req, levelSource: levelSourceFromAtlas(recs), records: recs }).result;
const plan = untag(cap.plan);
const same = r.ok && JSON.stringify(r.plan.solution.map((s) => [...s].sort())) === JSON.stringify(plan.solution.map((s) => [...s].sort()));
console.log(JSON.stringify({ ok: r.ok, ticks: r.ok ? r.plan.solution.length : null, capturedTicks: plan.solution.length, samePlan: same,
  unbilled: seen.map((x) => (x.unbilled ?? []).map((h) => `t${h.t} ${h.id}`)), msg: r.ok ? null : String(r.message).slice(0, 200) }));
