// MEASURE ONLY: does run.spinnerForecast (the walk preview's spinner rows) agree with what the model then steps?
// Replay plan-<seam> to each base tick B, take spinnerForecast(H), keep replaying, compare spinner@112,88 per tick.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [capFile, planFile, ...bases] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const cap = JSON.parse(readFileSync(capFile, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, plan.seam));
const levelSource = levelSourceFromAtlas(req.source.records);
const run = createRunForStaging(req.staging, levelSource, { scratchPersistence: req.scratchPersistence === true });
const equips = new Map(plan.equipsAt);
const B = bases.map(Number);
const fc = new Map();
const actual = new Map(); // tick → {id: [x,y]}
const ID = process.env.ID ?? 'spinner@112,88';
plan.solution.forEach((k, i) => {
    if (B.includes(i)) {
        const f = run.spinnerForecast(1525 - i + 4);
        const ids = run.entities('spinnerBodies').map((b) => b.id);
        fc.set(i, { f, ids });
    }
    if (equips.has(i)) run.equipNow(equips.get(i));
    run.advance(new Set(k));
    const row = {};
    for (const b of run.entities('spinnerBodies')) row[b.id] = [b.x, b.y, b.hitsTimer, b.destroy];
    actual.set(i + 1, row);
});
for (const [b, { f, ids }] of fc) {
    const j = ids.indexOf(ID);
    let first = null; const show = [];
    // forecast[n] = state at the top of tick ticksCompleted+1+n = after advance number (b+1+n) … compare with actual rows
    for (let n = 0; n < f.length; n++) {
        const t = b + 1 + n; const a = actual.get(t)?.[ID]; const r = f[n]?.[j];
        if (!a || !r) continue;
        const fx = r.x + 4, fy = r.y + 4; // rect → centre (+originX/Y = 4, the spinner's setHitbox(7,7,4,4))
        const d = Math.hypot(fx - a[0], fy - a[1]);
        if (d > 1e-6 && first === null) first = { t, forecast: [fx, fy], actual: a.slice(0, 2), d };
        if (t >= 1515 && t <= 1524) show.push(`t${t} f(${fx.toFixed(3)},${fy.toFixed(3)}) a(${a[0].toFixed(3)},${a[1].toFixed(3)})`);
    }
    console.log(`base ${b}: ${ID} first forecast≠step: ${JSON.stringify(first)}`);
    console.log('   ' + show.join(' | '));
}
