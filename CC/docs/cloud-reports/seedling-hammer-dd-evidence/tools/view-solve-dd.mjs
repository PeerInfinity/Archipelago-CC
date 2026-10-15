// CEREMONYSHOVE D3 (scratch, measure-only): the hammer arc's view-solve.mjs (seedling-hammer-bw-evidence) with CS_RUN=1 printing the run's chasers, ceremonies, lumps and shield bumps at the end.
// SCRATCH (seedling-hammer-c1; P1's copy; hammer-d adds --ghost=1: seam.items.hasGhostSword, the sword kept, and the
// spinner landings/weapons of the run): one solveSegment from a survey boot view, the whole refusal printed, the kill
// records and the trace's ladder rows summarised. Measure-only.
//   node view-solve.mjs --view=step-61-boot.json --goal=collect:880,816 [--at=x,y] [--dash=all] [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const MODULE = `${process.env.REPO ?? '/home/user/Archipelago-CC'}/frontend/modules/seedlingDemo`;
globalThis.__BW_DBG = process.env.BW_DBG ? ((r) => { (globalThis.__BW_ROWS ??= []).push(r); }) : null;
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const goalOf = (spec) => {
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(spec);
    const p = { x: Number(m[2]), y: Number(m[3]) };
    return m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p };
};
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(arg('view'), 'utf8'))));
const at = arg('at', null);
if (arg('ghost', '0') === '1') staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
if (at) { const [x, y] = at.split(',').map(Number); staging.boot = { ...staging.boot, x, y }; }
const run = createRunForStaging(staging, atlasLevelSource());
const TGT = arg('target', null); const TL = []; const ADV = run.advance.bind(run);
run.advance = (held) => { const o = ADV(held); if (TGT) { const c = (run.entities('chasers') ?? []).find((b) => b.id === TGT); const inSB = (run.entities('strikeBodies') ?? []).some((b) => b.id === TGT);
  TL.push({ t: run.ticksCompleted, inSB, ch: c ? { x: +c.x.toFixed(2), y: +c.y.toFixed(2), hits: c.hits, dying: !!c.dying, destroy: !!c.destroy } : null, keys: [...held].sort().join('+') }); } return o; };
const goals = arg('goal').split(';').map(goalOf);
const t0 = Date.now(); const STOP = Number(arg('stop-tick', '0')); const SITES = {};
const res = { view: arg('view'), boot: staging.boot, goals: arg('goal'), env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_'))) };
try {
    const out = solveSegment({ run, goals, name: 'c1', boot: staging.boot, dashMode: arg('dash', 'all'), ...(STOP > 0 ? { shouldStop: (site) => { SITES[site] = (SITES[site] ?? 0) + 1; return run.ticksCompleted >= STOP; } } : {}) });
    res.verdict = 'SOLVED';
    res.ticks = out.perTick.length; res.keysMd5 = (await import('node:crypto')).createHash('md5').update(JSON.stringify(out.perTick.map((k) => [...k].sort()))).digest('hex');
    res.records = (out.records ?? []).filter((r) => r.strategy === 'kill').map((r) => ({ arm: r.arm ?? null, target: r.target, ledger: r.ledger ?? null }));
    res.hits = run.ledger('playerHits').length;
    res.deaths = run.ledger('playerDeaths').length; res.staticDeaths = (run.ledger('staticBodyDeaths') ?? []).map((d) => `${d.id}@${d.killedAt}->${d.removedAt}`);
    res.end = { level: run.level, x: run.state.x, y: run.state.y };
    if (arg('tape', null)) writeFileSync(arg('tape'), JSON.stringify(out.perTick.map((s) => [...s])));
} catch (e) {
    res.verdict = 'REFUSED';
    res.name = e.name;
    res.message = String(e.message);
    res.refusalTicks = e.perTick?.length ?? null; res.keysMd5 = e.perTick ? (await import('node:crypto')).createHash('md5').update(JSON.stringify(e.perTick.map((k) => [...k].sort()))).digest('hex') : null;
    res.at = { level: run.level, t: run.ticksCompleted, x: run.state.x, y: run.state.y, vx: run.state.vx, vy: run.state.vy };
    res.rows = (e.rows ?? []).filter((r) => r.strategy?.rung === 'kill' || r.strategy?.verb === 'kill').map((r) => ({ tick: r.tick, strategy: r.strategy }));
    if (arg('tape', null) && e.perTick) writeFileSync(arg('tape'), JSON.stringify(e.perTick.map((s) => [...s])));
}
if (process.env.CS_RUN) console.error('RUN', JSON.stringify({ t: run.ticksCompleted, chasers: (run.entities('chasers') ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, ht: c.hitsTimer, dying: c.dying, removed: c.removed })), cer: run.ceremonyStarts, lumps: run.ceremonyLumps, bumps: (run.shieldBumps ?? []).slice(-6), hits: run.ledger('playerHits') }));
res.hits = run.ledger('playerHits'); res.bombEvents = (run.ledger('bombEvents') ?? []).length; if (process.env.BW_DBG) res.dbg = globalThis.__BW_ROWS ?? [];
if (TGT) { const ch = TL.filter((r, i) => i === 0 || JSON.stringify([r.inSB, r.ch?.hits, r.ch?.dying, r.ch?.destroy, r.ch === null]) !== JSON.stringify([TL[i-1].inSB, TL[i-1].ch?.hits, TL[i-1].ch?.dying, TL[i-1].ch?.destroy, TL[i-1].ch === null])); res.targetTimeline = ch;
  res.targetPresses = (run.presses ?? []).filter((p) => p.hits.some((h) => h.id === TGT)).map((p) => ({ t: p.t, fired: p.fired, weapon: p.weapon, direction: p.direction, hits: p.hits.filter((h) => h.id === TGT) }));
  console.log('TIMELINE', JSON.stringify(ch)); console.log('PRESSES', JSON.stringify(res.targetPresses)); }
res.ghost = arg('ghost', '0') === '1'; res.primary = run.progress?.('primaryWeapon') ?? null;
res.landings = (run.spinnerPressHits ?? []).filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, weapon: h.weapon, hits: h.hits, reach: Number(h.reach.toFixed(3)) }));
res.weapons = [...new Set((run.presses ?? []).map((p) => p.weapon))];
res.ms = Date.now() - t0; res.sites = SITES; res.msgMd5 = (await import('node:crypto')).createHash('md5').update(String(res.message ?? '') + JSON.stringify(res.at ?? null) + JSON.stringify(res.rows ?? null) + String(res.refusalTicks)).digest('hex');
console.log(`${res.verdict} ${res.ticks ?? ''} ${res.ms} ms keys=${res.keysMd5 ?? '-'} msg=${res.msgMd5} sites=${JSON.stringify(res.sites)}`);
console.log(res.message ?? JSON.stringify(res.records));
if (res.at) console.log('AT', JSON.stringify(res.at), 'refusalTicks', res.refusalTicks, 'killRows', JSON.stringify(res.rows));
if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(res, null, 1));
process.exit(0);
