// MEASURE ONLY: replay the solved plan (plan-<seam>.json) on a fresh run from the captured staging (at that seam);
// per tick in [from,to]: player, hits, every body within 48 px, every new ledger row (playerHits, pulser*), contactsSuppressed.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [capFile, planFile, from = '1490', to = '1545'] = process.argv.slice(2);
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
const F = Number(from), T = Number(to);
const fams = ['spinnerBodies', 'armedPulsers', 'pushables', 'strikeBodies', 'staticBodies', 'chasers'];
const seen = { playerHits: 0, pulserPlayerHits: 0, pulserPushes: 0, pulserHits: 0, sup: 0 };
const r2 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
if (process.env.SHOW_KEYS) console.log('state keys', Object.keys(run.state ?? {}));
plan.solution.forEach((k, i) => {
    if (equips.has(i)) run.equipNow(equips.get(i));
    run.advance(new Set(k));
    const t = i + 1; // rows: expected[t] is after t advances
    for (const kind of ['playerHits', 'pulserPlayerHits', 'pulserPushes', 'pulserHits']) {
        const l = run.ledger(kind) ?? [];
        while (seen[kind] < l.length) { const h = l[seen[kind]++]; if (h.level === 39 || h.level == null) console.log(`  t${t} LEDGER ${kind}`, JSON.stringify(h).slice(0, 400)); }
    }
    const sup = run.contactsSuppressed;
    while (seen.sup < sup.length) { const c = sup[seen.sup++]; if (t >= F - 50) console.log(`  t${t} SUPPRESSED`, JSON.stringify(c).slice(0, 400)); }
    if (t < F || t > T) return;
    const s = run.state;
    const px = s.x, py = s.y;
    const near = [];
    for (const f of fams) {
        let es; try { es = run.entities(f) ?? []; } catch { es = []; }
        for (const b of (Array.isArray(es) ? es : [])) {
            const bx = b.x ?? b.pos?.x, by = b.y ?? b.pos?.y;
            if (typeof bx !== 'number') continue;
            const d = Math.hypot(bx - px, by - py);
            if (d <= 48) near.push(`${f}:${b.id ?? '?'}(${r2(bx)},${r2(by)}${b.vx != null ? ` v=${r2(b.vx)},${r2(b.vy)}` : ''}${b.v ? ` v=${r2(b.v.x)},${r2(b.v.y)}` : ''}${b.hammerAngle != null ? ` a=${r2(b.hammerAngle)}` : ''}${b.destroy ? ' DESTROY' : ''} d=${r2(d)})`);
        }
    }
    console.log(`t${t} key=[${k.join(',')}] p=(${r2(px)},${r2(py)}) v=(${r2(s.vx ?? s.v?.x)},${r2(s.vy ?? s.v?.y)}) hits=${s.hits} hitsTimer=${s.hitsTimer} gt=${run.gameTimeAt ? run.gameTimeAt(t) : '?'} ${near.join(' ')}`);
});
