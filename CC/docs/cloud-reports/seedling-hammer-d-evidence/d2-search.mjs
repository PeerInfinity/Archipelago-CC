#!/usr/bin/env node
// SCRATCH (seedling-hammer-d D2): find a stance where a GHOST press lands on a spinner THROUGH a Solid — the first
// in-reach test's line from the player's point to the body's entity point crosses a wall — and verify it on the model
// run (the walk previewed with the solver's own `previewWalk`, then stand, aim, press, stand). Measure-only.
//   node d2-search.mjs --legs=… --dump=… --id=374 [--horizon=700] [--top=40] [--out=cands.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const leg = arg('boot', '') ? null : readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .find((l) => l.id === Number(arg('id')));
const H = Number(arg('horizon', 700));
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const { walkableCells, previewWalk, facingToward, FACING_KEYS } = await M('seedlingDemo/solverBot.js');
const { DEFAULT_TOLERANCE } = await M('seedlingDemo/botDriverV1.js');
const { distanceRectPoint, SLASH_REACH, slashRect } = await M('seedlingDemo/presses.js');
const { GHOST_SWORD_REACH, ghostSlashRect } = await M('seedlingDemo/ghostSword.js');
const { SPINNER } = await M('seedlingDemo/spinner.js');
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
const ITEMS = (arg('items', 'hasTorch,hasFire,hasShield,hasSword,hasGhostSword')).split(',');
export function stage(items = ITEMS) {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([...items.map((property) => ({ class: 'Main', property, value: true })),
        { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
    rt.tick(); rt.tick();
    const st = rt.session.staging;
    // the arrival's gating flags, as the sweep stages them (`Game.setPersistence(tag, false, level)`)
    const extra = (leg.stagedEvents ?? []).filter((f) => !f.otherLevel)
        .map((f) => ({ level: leg.level, tag: f.tag, note: '' }));
    return { ...st, persistence: [...st.persistence, ...extra] };
}
// --boot=level,x,y: C1's witness staging instead (`crusherStaging`: a committed tape's staging re-booted, items set)
let staging;
if (arg('boot', '')) {
    const [level, x, y] = arg('boot').split(',').map(Number);
    const { crusherStaging } = await import(join(REPO, 'scripts/procgen/plan-seedling-crusher-witness.mjs'));
    staging = await crusherStaging({ boot: { level, x, y }, keys: [], items: ITEMS });
    // --persist=39:8,…: the arrival's gating flags (leg 375's `flag:L39:8`, the wandlock the shaft passes)
    for (const f of arg('persist', '').split(',').filter(Boolean)) {
        const [l, t] = f.split(':').map(Number);
        staging.persistence = [...staging.persistence, { level: l, tag: t, note: '' }];
    }
} else staging = stage();
const run = createRunForStaging(staging, SRC);
const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
const entityPoint = (r) => ({ x: r.x + SPINNER.originX, y: r.y + SPINNER.originY });
const blocked = (c, r) => { const p = entityPoint(r); return run.collideLineSolid(c.x, c.y, p.x, p.y); };
const bodies = run.entities('spinnerBodies') ?? [];
const forecast = run.spinnerForecast(H);
const cells = walkableCells(run, new Set());
console.error(`cells ${cells.length}, bodies ${bodies.map((b) => b.id).join(' ')}, forecast ${forecast.length}`);
// geometry: the press at +i, its tests reading forecast[i .. i+7] (deriveStrike's pairing, one wider)
const cands = [];
for (let i = 2; i < H - 9; i += 1) {
    for (let b = 0; b < bodies.length; b += 1) {
        const mine = forecast[i + 1]?.[b];
        if (!mine) continue;
        for (const c of cells) {
            if (distanceRectPoint(c.x, c.y, mine) > GHOST_SWORD_REACH + 4) continue;
            const dir = facingToward(c, mine);
            const rect = ghostSlashRect(c.x, c.y, dir);
            let first = null;
            for (let k = 0; k <= 7; k += 1) {
                const r = forecast[i + k]?.[b];
                if (r && overlaps(rect, r) && distanceRectPoint(c.x, c.y, r) <= GHOST_SWORD_REACH) { first = { k, r }; break; }
            }
            if (!first) continue;
            const wall = blocked(c, first.r);
            if (!wall) continue;
            if (arg('wall', '') && !String(wall.tag).startsWith(arg('wall'))) continue;
            // the sword from the same cell: in its reach and rect at the same test? (it would be refused by the line)
            const swordIn = overlaps(slashRect(c.x, c.y, dir), first.r) && distanceRectPoint(c.x, c.y, first.r) <= SLASH_REACH;
            cands.push({ i, body: bodies[b].id, cell: { x: c.x, y: c.y }, dir, k: first.k,
                reach: distanceRectPoint(c.x, c.y, first.r), wall, swordIn });
        }
    }
}
console.error(`geometric candidates ${cands.length}`);
// verify the earliest reachable ones on the model run
// ⛓ the preview walker stops at 400 ticks; a held prefix (--prefix=up:300: hold 'up' until y <= 300) walks the shaft
const prefixKeys = [];
const pre = createRunForStaging(staging, SRC);
if (arg('prefix', '')) {
    // steps: `<key>:<y>` hold the key until y <= the bound; `press:<key>` aim then press toward the key; `wait:<n>` stand
    for (const step of arg('prefix').split(',')) {
        const [a, b] = step.split(':');
        const push = (k) => { prefixKeys.push(k); pre.advance(k); };
        if (a === 'press') { push(new Set([b])); push(new Set(['primary'])); }
        else if (a === 'wait') { for (let n = 0; n < Number(b); n += 1) push(new Set()); }
        else { let n = 0; while (pre.state.y > Number(b) && n < 1000) { push(new Set([a])); n += 1; } }
    }
    console.error(`prefix: ${prefixKeys.length} tick(s) to (${pre.state.x.toFixed(2)},${pre.state.y.toFixed(2)}), hits ${pre.playerHits?.length}, `
        + `ropes ${JSON.stringify(pre.pulledRopeIdsNow?.() ?? null)}`);
}
const byCell = new Map();
const skip = { truncated: 0, late: 0 };
const verified = [];
for (const cd of cands) {
    if (verified.length >= Number(arg('top', 10))) break;
    const ck = `${cd.cell.x},${cd.cell.y}`;
    if (!byCell.has(ck)) {
        const w = previewWalk(pre, [cd.cell], DEFAULT_TOLERANCE);
        byCell.set(ck, w.truncated ? null : [...prefixKeys, ...w.samples.map((s) => s.held ?? new Set())]);
    }
    const walk = byCell.get(ck);
    if (!walk) { skip.truncated += 1; continue; }
    if (walk.length > cd.i - 2) { skip.late += 1; continue; }
    // --late: stand at the boot first, so the walk arrives just before the aim (no dwell on the stance)
    const keys = [];
    if (arg('late', '') !== '') while (keys.length + walk.length < cd.i - 1 - Number(arg('late'))) keys.push(new Set());
    keys.push(...walk);
    while (keys.length < cd.i - 1) keys.push(new Set());
    keys.push(new Set([FACING_KEYS[cd.dir]]));
    keys.push(new Set(['primary']));
    for (let s = 0; s < 14; s += 1) keys.push(new Set());
    const r2 = createRunForStaging(staging, SRC);
    let err = null;
    const pts = [];
    try { for (const k of keys) { r2.advance(k); pts.push({ t: r2.ticksCompleted, x: r2.state.x, y: r2.state.y }); } }
    catch (e) { err = String(e.message).slice(0, 200); }
    const land = (r2.spinnerPressHits ?? []).filter((h) => h.landed);
    const row = { ...cd, ticks: keys.length, err, hits: r2.playerHits?.length ?? null,
        landings: land.map((h) => ({ t: h.t, id: h.id, reach: h.reach, hits: h.hits, weapon: h.weapon })) };
    if (land.length) {
        // the line AT the landing, from the run's own player point to the body's entity point at that test
        const h = land[0];
        const sp = r2.entities('spinnerBodies')?.find((x) => x.id === h.id);
        const at = pts.find((p) => p.t === h.t) ?? null;
        row.landingPoint = at;
        row.lineAtLanding = null;
        // re-run to the landing tick to read the body where the test met it
        const r3 = createRunForStaging(staging, SRC);
        for (let t = 0; t < keys.length && r3.ticksCompleted < h.t - 1; t += 1) r3.advance(keys[t]);
        const pre = r3.entities('spinnerBodies')?.find((x) => x.id === h.id);
        row.bodyBeforeLandingTick = pre ? { x: pre.x, y: pre.y, rect: pre.rect } : null;
        void sp;
    }
    if (land.length && !err && row.hits === 0) verified.push(row);
    console.error(JSON.stringify(row));
}
if (arg('out', '')) writeFileSync(arg('out'), JSON.stringify({ leg: leg?.id ?? arg('boot'), staging, cands: cands.length, verified }, null, 1));
console.error(JSON.stringify({ skip, cells: [...new Set(cands.map((c) => `${c.cell.x},${c.cell.y}`))].slice(0, 30), ticks: [cands[0]?.i, cands.at(-1)?.i] }));
console.log(JSON.stringify({ cands: cands.length, verified: verified.length, first: verified[0] ?? null }));
process.exit(0);
