// DASHCERT W0: step 216's solve; the t0 certificate's preview samples vs the drive (replayed keys), first tick they part.
// Usage: node part216.mjs <repo> <boot.json>   (env picks the arm; needs the __CERT scratch patch)
import { readFileSync } from 'node:fs';
const REPO = process.argv[2] + '/';
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveSegment } = await import(M + 'solverBot.js');
const atlas = JSON.parse(readFileSync(REPO + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[3], 'utf8'));
const mk = () => createRunForStaging(solveStaging(stagingFromTape(tape)), levelSourceFromAtlas(atlas));
const run = mk();
let perTick;
try { perTick = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100', boot: solveStaging(stagingFromTape(tape)).boot }).perTick; }
catch (e) { console.log('REFUSED', e.message.slice(0, 160)); perTick = e.perTick ?? null; }
const certs = globalThis.__CERT ?? [];
console.log('certificates asked', certs.length);
for (const c of certs) console.log(' cert wps', JSON.stringify(c.wps), 'start', c.startTick, 'n', c.samples.length, 'probe', JSON.stringify(c.probe), 'trunc', JSON.stringify(c.truncated), 'except', JSON.stringify(c.except));
if (!perTick) process.exit(0);
const r2 = mk();
const drive = [{ t: 0, x: r2.state.x, y: r2.state.y, hits: 0, ch: [] }];
for (let t = 0; t < 200; t += 1) { r2.advance(perTick[t] instanceof Set ? perTick[t] : new Set(perTick[t])); drive.push({ t: t + 1, x: r2.state.x, y: r2.state.y, hits: r2.playerHits.length, ch: (r2.entities('chasers') ?? []).filter((c) => c.id === 'jellyfish@80,112').map((c) => [+c.x.toFixed(2), +c.y.toFixed(2), c.removed ?? null, c.hitsTimer ?? c.iframe ?? null]) }); }
const c0 = certs[0];
let parted = null;
for (const s of c0.samples) {
    const d = drive.find((q) => q.t === s.tick - (+process.env.OFF || 0));
    if (!d) continue;
    const dd = Math.max(Math.abs(d.x - s.x), Math.abs(d.y - s.y));
    if (dd > 1e-9 && !parted) parted = s.tick;
    if ((s.tick >= +process.env.LO && s.tick <= +process.env.HI) || s.tick === parted) {
        const jch = (s.chasers ?? []).filter((c) => (c.id ?? '').startsWith('jellyfish@80,112'));
        console.log(`t${s.tick} preview (${s.x.toFixed(2)},${s.y.toFixed(2)}) drive (${d.x.toFixed(2)},${d.y.toFixed(2)}) Δ${dd.toFixed(3)} hits ${d.hits} | prev jelly ${JSON.stringify(jch.map((c) => [c.x?.toFixed?.(2), c.y?.toFixed?.(2), c.dead ?? c.removed ?? null]))} | drive jelly ${JSON.stringify(d.ch)} keys ${JSON.stringify([...(perTick[s.tick - 1] ?? [])])} held ${JSON.stringify(s.held ? [...s.held] : null)} wp ${s.wp}`);
    }
}
let jp = null; for (const s of c0.samples) { const d = drive.find((q) => q.t === s.tick - 1); const j = (s.chasers ?? []).find((c) => (c.id ?? '') === 'jellyfish@80,112'); if (d && j && d.ch[0] && Math.max(Math.abs(j.x - d.ch[0][0]), Math.abs(j.y - d.ch[0][1])) > 0.01) { jp = s.tick; break; } }
console.log('first jelly parting', jp);
console.log('first parting tick', parted, 'sample keys', Object.keys(c0.samples[0]).join(','));
const pk = []; perTick.forEach((k, i) => { const a = [...k]; if (a.some((x) => !['left','right','up','down'].includes(x))) pk.push([i, a.join('+')]); });
console.log('drive non-move keys (perTick index):', JSON.stringify(pk.filter(([i]) => i < 220)));
const hk = c0.samples.filter((s) => s.held && [...s.held].some((x) => !['left','right','up','down'].includes(x))).map((s) => [s.tick, [...s.held].join('+')]);
console.log('preview non-move held (sample tick):', JSON.stringify(hk));
