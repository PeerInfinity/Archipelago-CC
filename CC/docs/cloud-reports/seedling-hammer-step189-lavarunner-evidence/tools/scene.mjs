// MEASUREMENT-ONLY: replay a captured request's prefix and print the room (tiles), the counted bodies and the player.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [file, id, i] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = gunzipSync(readFileSync(file)).toString();
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const { replayTape } = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { passes, source, ...tape } = restoreRequest(req.request);
const levelSource = levelSourceFromAtlas(source.records);
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
console.log('keys', Object.keys(tape), 'goal', JSON.stringify(tape.goal ?? tape.target ?? null));
console.log('t', tape.perTick.length, 'player', run.state.x.toFixed(1), run.state.y.toFixed(1), 'level', run.level ?? run.world.level);
const w = run.world;
console.log('size', w.width, w.height);
const ents = run.entities('strikeBodies') ?? [];
for (const b of ents) console.log('body', b.id, b.tag, b.x.toFixed(1), b.y.toFixed(1));
for (const c of (run.entities('chasers') ?? [])) console.log('chaser', c.id, c.x?.toFixed?.(1), c.y?.toFixed?.(1), c.dying ? 'dying' : '', c.hits ?? '');
console.log(Object.keys(w).slice(0,40));
const t = w.tiles;
console.log('tiles type', Array.isArray(t), typeof t, t && (t.length ?? t.size), JSON.stringify(Array.isArray(t)? t[0]: [...(t.entries?.()??[])].slice(0,3))?.slice(0,300));
console.log('solids sample', JSON.stringify(w.solids?.slice?.(0,3) ?? [...(w.solids?.values?.() ?? [])].slice(0,3)).slice(0,400));
console.log('locks', JSON.stringify(w.locks ?? w.kill ?? null)?.slice(0,600));
for (const k of Object.keys(w)) { const v=w[k]; const n = Array.isArray(v)? v.length : (v?.size ?? ''); if (n) console.log(' ',k,n); }
const names = new Map(); let nx = 0; const ch = 'abcdefghijklmnop';
const grid = [];
for (let y = 0; y < w.height; y++) grid.push(Array(w.width).fill('?'));
const solidSet = new Set(w.solids.map((s) => `${s.rect.x/16},${s.rect.y/16}`));
for (const tt of t) { let c; if (solidSet.has(`${tt.tx},${tt.ty}`)) c = '#'; else if (tt.name==='Lava') c='~'; else { if (!names.has(tt.name)) names.set(tt.name, ch[nx++]); c = names.get(tt.name);} grid[tt.ty][tt.tx]=c; }
const solidNames = new Set(w.solids.map(s=>s.tag)); console.log('solid tags', [...solidNames]);
console.log('legend', JSON.stringify([...names]));
console.log('    ' + [...Array(w.width).keys()].map(i=>String(i%10)).join(''));
grid.forEach((r,y)=>console.log(String(y*16).padStart(3)+' '+r.join('')));
for (const k of ['roles','objectSolids','teleporters','apItems','activators','pressers','pressEnemies','proximityHazards','pitTiles']) console.log(k, JSON.stringify(w[k]).slice(0,700));
