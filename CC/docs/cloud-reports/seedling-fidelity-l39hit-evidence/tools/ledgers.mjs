import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [capFile, planFile, from, to] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const cap = JSON.parse(readFileSync(capFile, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, plan.seam));
const run = createRunForStaging(req.staging, levelSourceFromAtlas(req.source.records), { scratchPersistence: req.scratchPersistence === true });
const equips = new Map(plan.equipsAt);
plan.solution.forEach((k, i) => { if (equips.has(i)) run.equipNow(equips.get(i)); run.advance(new Set(k)); });
for (const kind of ['spinnerPressHits', 'pulserPushes', 'pulserPlayerHits', 'spinnerWrites', 'playerHits', 'shieldBumps', 'staticBodyDeaths', 'presses']) {
    let rows = []; try { rows = run.ledger(kind) ?? []; } catch (e) { console.log(kind, 'ERR', e.message.slice(0, 80)); continue; }
    for (const r of rows) if (r.t >= Number(from) && r.t <= Number(to)) console.log(kind, JSON.stringify(r).slice(0, 400));
}
