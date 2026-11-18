import { readFileSync } from 'node:fs';
const R = process.cwd() + '/'; const M = (p) => import(R + 'frontend/modules/seedlingDemo/' + p);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('atlasSource.js'); const { createRunForStaging } = await M('tapeRunner.js');
const [file, kf, ...extra] = process.argv.slice(2);
let req; for (const line of readFileSync(file, 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (o.id === 906) { req = restoreRequest(o.requests[0].request); break; } }
const run = createRunForStaging({ ...req.staging }, levelSourceFromAtlas(req.source.records), { scratchPersistence: true });
const keys = JSON.parse(readFileSync(kf, 'utf8')).map((s) => new Set(s ? s.split('+') : []));
for (const k of keys) run.advance(k);
const slots = run.progress('inventorySlots'); console.log('slots', JSON.stringify(slots), 'primary', run.progress('primary'));
const pole = () => (run.entities('darkTraps').find((b) => b.id === 'darktrap@128,272'));
const show = (w) => { const b = pole(); console.log(w, 't', run.ticks ?? '', run.level, run.state.x.toFixed(2), run.state.y.toFixed(2), 'dir', run.state.direction, 'hits', run.playerHits.length, 'dt', b ? JSON.stringify({ dying: b.startDying, removed: b.removed, poles: b.poles.map((p) => [p.id, p.lit]) }) : 'gone'); };
show("after98"); console.log("STATE", JSON.stringify(run.state).slice(0, 900));
for (const spec of extra) { const [k, n] = spec.split('*'); for (let i = 0; i < Number(n ?? 1); i++) { if (k.startsWith('eq')) { run.equipNow(Number(k.slice(2))); continue; } const r = run.advance(new Set(k === '_' ? [] : k.split('+'))); if (r.transition) { console.log('TRANSITION', JSON.stringify(r.transition)); process.exit(0); } } show(spec); }
