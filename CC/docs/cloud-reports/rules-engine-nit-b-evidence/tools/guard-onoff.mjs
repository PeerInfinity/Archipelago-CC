// rules-engine-nit-b: per level world with pulls (both presets' maze payloads, or the frozen nit fixture), derive every pair
// (deriveLevelWorldLogic) and every region's own targets (deriveEntryLogic) with the up-set guard ON and OFF (`upSetGuard: false`,
// the test-only revert), native engine, and print what moved plus the search counters.
// usage: node guard-onoff.mjs <worktree> [--fixture]
import path from 'node:path';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
const wt = path.resolve(process.argv[2]);
const FIXTURE = process.argv.includes('--fixture');
const ENG = await import(path.join(wt, 'frontend/modules/mazeRoom/mazeRoomEngine.js'));
const D = await import(path.join(wt, 'frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js'));
const HELPERS = JSON.parse(fs.readFileSync(path.join(wt, 'frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
const payloads = [];
if (FIXTURE) {
    const f = path.join(wt, 'frontend/modules/mazeRoom/tileSpike/fixtures/l78-k-sketch-pull-nit-payload.json.gz');
    payloads.push(['fixture l78-k-sketch (uncut disc)', JSON.parse(gunzipSync(fs.readFileSync(f))).payload]);
} else {
    for (const preset of ['seedling_playthrough_maze']) {
        const RULES = JSON.parse(fs.readFileSync(path.join(wt, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
        const seen = new Set();
        for (const [name, sc] of Object.entries(RULES.preset_sidecars['1'])) {
            const pl = sc.playable_payload;
            if (!pl?.pulls?.length) continue;
            const k = pl.shared_world ? pl.shared_world.key : name;
            if (seen.has(k)) continue;
            seen.add(k);
            payloads.push([`${preset} ${k}${pl.shared_world ? '' : ' (plain)'}`, pl, name]);
        }
    }
}
const fmt = (m) => JSON.stringify(m);
for (const [label, pl, name] of payloads) {
    const world = ENG.deserializeMazeWorld(pl);
    const regions = world.sharedWorld ? world.sharedWorld.regions : [name];
    const t0 = performance.now();
    const on = world.sharedWorld ? D.deriveLevelWorldLogic(world, HELPERS, { native: true }) : null;
    const t1 = performance.now();
    const off = world.sharedWorld ? D.deriveLevelWorldLogic(world, HELPERS, { native: true, upSetGuard: false }) : null;
    const t2 = performance.now();
    let moved = 0;
    if (on) {
        for (const [i, p] of on.pairs.entries()) {
            const q = off.pairs[i];
            if (fmt(p.minimal) !== fmt(q.minimal) || p.unreachable !== q.unreachable || fmt(p.witnesses) !== fmt(q.witnesses)) {
                moved += 1;
                console.log(`  MOVED pair ${p.from} -> ${p.to}: off ${q.unreachable ? 'unreachable' : fmt(q.minimal)} | on ${p.unreachable ? 'unreachable' : fmt(p.minimal)}`);
            }
        }
        console.log(`${label}: pairs ${on.pairs.length}, moved ${moved}; searched ${off.searched}->${on.searched}, states ${off.states}->${on.states}, engine.searches ${off.engine.searches}->${on.engine.searches}, engine.states ${off.engine.states}->${on.engine.states}, skipped ${off.engine.skipped}->${on.engine.skipped}, upSet refusals ${on.engine.upSet ?? '-'}; ms ${(t2 - t1).toFixed(0)}->${(t1 - t0).toFixed(0)}`);
    }
    let tm = 0; let tn = 0; let sOff = 0; let sOn = 0;
    for (const r of regions) {
        const a = D.deriveEntryLogic(world, r, HELPERS, { native: true });
        const b = D.deriveEntryLogic(world, r, HELPERS, { native: true, upSetGuard: false });
        sOn += a.engine.searches; sOff += b.engine.searches;
        for (const [i, t] of a.targets.entries()) {
            tn += 1;
            const u = b.targets[i];
            if (fmt(t.minimal) !== fmt(u.minimal) || t.unreachable !== u.unreachable) {
                tm += 1;
                console.log(`  MOVED target ${r} ${t.id}: off ${u.unreachable ? 'unreachable' : fmt(u.minimal)} | on ${t.unreachable ? 'unreachable' : fmt(t.minimal)}`);
            }
        }
    }
    console.log(`  entry targets ${tn}, moved ${tm}; engine.searches ${sOff}->${sOn}`);
}
