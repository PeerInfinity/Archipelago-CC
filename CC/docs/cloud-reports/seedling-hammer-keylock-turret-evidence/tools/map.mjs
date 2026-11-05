// scratch (KEYLOCK-TURRET W0): an ASCII map of L40 around bosslock@480,352 on the 16 px lattice, from a captured
// request's staging (optionally + persistence rows). '#' a planner solid, 'h' only the turret's disc, '.' free,
// 'T' the turret's live box, 'L' the lock, 'k' a cell whose pinned box touches the key line, '@' the player.
// Usage: node map.mjs <capture.jsonl> <id> [--persist=40:12] [x0 y0 x1 y1]
const R = '/home/user/Archipelago-CC/'; const M = R + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape } = await import(M + 'jsRuntimeSolver.js');
const { plannerObstacleAt } = await import(M + 'botDriverV2.js');
const SB = await import(M + 'solverBot.js');
const fs = await import('fs');
const a = process.argv.slice(2); const persist = a.find((s) => s.startsWith('--persist='));
const pos = a.filter((s) => !s.startsWith('--'));
const [file, id] = pos; const [x0, y0, x1, y1] = (pos.length > 2 ? pos.slice(2) : [376, 264, 616, 616]).map(Number);
for (const l of fs.readFileSync(file, 'utf8').trim().split('\n')) {
    const r = JSON.parse(l); if (String(r.id) !== id) continue;
    const q = restoreRequest(r.requests[0].request);
    const staging = { ...q.staging };
    if (persist) staging.persistence = [...(staging.persistence ?? []), ...persist.slice(10).split(',').map((s) => { const [level, tag] = s.split(':').map(Number); return { level, tag }; })];
    const run = replayTape({ staging, perTick: q.perTick ?? [], levelSource: levelSourceFromAtlas(q.source.records) });
    const t = [...run.entities('turrets')].map(([k, v]) => ({ id: k, x: v.x, y: v.y, dead: v.dead, rect: v.rect }));
    console.log('player', run.state.x, run.state.y, 'tick', run.ticksCompleted, 'turrets', JSON.stringify(t));
    const lock = run.world.activators.find((x) => x.id === 'bosslock@480,352');
    console.log('lock', JSON.stringify(lock.rect), 'keyLine', JSON.stringify(lock.keyLine), 'open', run.entities('openActivators').has(lock.id));
    const opts = SB.solverPlanOpts(run, new Set(), { nodeMargin: 0, triggerMargin: 0 });
    const optsX = SB.solverPlanOpts(run, new Set(t.map((q) => `proximity-hazard:${q.id}`)), { nodeMargin: 0, triggerMargin: 0 });
    let hdr = '     '; for (let x = x0; x <= x1; x += 16) hdr += String(x % 1000).padStart(4, ' ').slice(-1); console.log(hdr);
    for (let y = y0; y <= y1; y += 16) {
        let line = String(y).padStart(4) + ' ';
        for (let x = x0; x <= x1; x += 16) {
            const ob = plannerObstacleAt(run.world, x, y, null, opts);
            const obX = plannerObstacleAt(run.world, x, y, null, optsX);
            let c = ob === null ? '.' : (obX === null ? 'h' : '#');
            if (obX && obX.blocker?.id?.startsWith?.('wandlock')) c = 'W';
            if (obX && /lock/.test(obX.blocker?.id ?? obX.blocker?.tag ?? '')) c = 'L';
            if (t.some((q) => x >= q.rect.x && x < q.rect.right && y >= q.rect.y && y < q.rect.bottom)) c = 'T';
            if (Math.abs(run.state.x - x) < 8 && Math.abs(run.state.y - y) < 8) c = '@';
            line += c;
        }
        console.log(line);
    }
}
