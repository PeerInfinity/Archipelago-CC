// FACE 1: at the burn resolution (BURN_STANCE_AVOID's sink, run attached), each candidate stance: is its own tile
// covered by a live body (`coveredGoalOf` under the danger volumes)? does the AVOID plan reach it with all the volumes,
// and with each single volume set aside? Prints the live bodies too.
//   SEEDLING_BURN_STANCE_AVOID=1 node stances.mjs --req=<file.json.gz> [--seam=<clock>]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const SB = await M('solverBot.js');
const DM = await M('dangerMap.js');
const BD = await M('botDriverV2.js');
let once = false;
SB.BURN_STANCE_AVOID_TRACE.sink = (x, run) => {
    if (once) return; once = true;
    console.log('AT t', x.t, 'player', run.state.x, run.state.y, 'level', run.level);
    for (const c of (run.entities('chasers') ?? [])) if (!c.destroy && !c.removed) console.log('  body', c.id, c.x?.toFixed?.(1), c.y?.toFixed?.(1), c.tag);
    const vols = DM.dangerVolumes(run, 0);
    if (process.argv.includes('--map')) try {
        // 16 px tiles x 560..960, y 704..912: '.' walkable (static), '#' not, 'v' walkable statically but inside a
        // danger volume; letters mark bodies (b bob, S bobsoldier, P player, X spinner), T the tree.
        const opts = SB.solverPlanOpts(run, new Set());
        const optsV = SB.solverPlanOpts(run, new Set(), { extraVolumes: vols });
        const marks = new Map();
        for (const c of (run.entities('chasers') ?? [])) if (!c.destroy && !c.removed) marks.set(`${Math.floor(c.x / 16)},${Math.floor(c.y / 16)}`, c.tag === 'bobsoldier' ? 'S' : 'b');
        for (const sp of (run.entities('spinnerBodies') ?? [])) marks.set(`${Math.floor(sp.x / 16)},${Math.floor(sp.y / 16)}`, 'X');
        for (const t of (run.world.burnableTrees ?? [])) marks.set(`${Math.floor(t.x / 16)},${Math.floor(t.y / 16)}`, 'T');
        marks.set(`${Math.floor(run.state.x / 16)},${Math.floor(run.state.y / 16)}`, 'P');
        let hdr = '      '; for (let tx = 35; tx < 60; tx += 1) hdr += String(tx % 10); console.log(hdr);
        for (let ty = 44; ty < 58; ty += 1) {
            let line = `${String(ty * 16).padStart(4)}  `;
            for (let tx = 35; tx < 60; tx += 1) {
                const m = marks.get(`${tx},${ty}`);
                const w = BD.isWalkableTile(run.world, tx, ty, null, opts);
                const wv = BD.isWalkableTile(run.world, tx, ty, null, optsV);
                line += m ?? (w ? (wv ? '.' : 'v') : '#');
            }
            console.log(line);
        }
        console.log('spinners', JSON.stringify((run.entities('spinnerBodies') ?? []).map((s) => [s.id, +s.x.toFixed(1), +s.y.toFixed(1)])));
    } catch (e) { console.log('MAP ERROR', e.stack.slice(0, 400)); }
    console.log('  vols', vols.map((v) => `${v.id}[${v.rect.x},${v.rect.y},${v.rect.w ?? (v.rect.right - v.rect.x)}x${v.rect.h ?? (v.rect.bottom - v.rect.y)}]`).join(' '));
    const plan = (c, vs) => { try { const w = BD.planWaypoints(run.world, run.state, c, null, SB.solverPlanOpts(run, new Set(), { extraVolumes: vs })); return `ok(${w.length}wp)`; } catch (e) { return `NO: ${e.message.slice(0, 160)}`; } };
    for (const c of x.order) {
        const cov = SB.coveredGoalOf(run, c, null, SB.solverPlanOpts(run, new Set(), { extraVolumes: vols }));
        console.log(` stance (${c.x},${c.y}) covered=${cov?.id ?? 'no'}`);
        console.log(`   plan static: ${plan(c, [])}`);
        console.log(`   plan all vols: ${plan(c, vols)}`);
        for (const v of vols) console.log(`   plan without ${v.id}: ${plan(c, vols.filter((u) => u !== v))}`);
    }
};
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { passes = JR.ANYTIME_PASSES, source, ...tape } = restoreRequest({ ...c0, staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const ans = JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
console.log('ANSWER', ans.ok, ans.kind ?? '', ans.work);
