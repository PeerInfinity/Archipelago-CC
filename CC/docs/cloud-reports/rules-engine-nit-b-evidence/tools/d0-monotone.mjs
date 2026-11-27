// D0 (rules-engine-nit-b brief § What 1): per level world with pulls, count the pairs (deriveLevelWorldLogic's) and the
// targets (deriveEntryLogic's, from each region's own arrival) where
//   (a) the FULL lattice point misses but some point reaches, and
//   (b) some point S reaches but a superset S' ⊋ S misses (an event target: supersets that do not add its own event).
// Ground truth by brute force: the native reach (`nativeReachUnder`) at EVERY lattice point, independent of the engine's
// full-point prune and `covered` skip. ⚠ Targets ignore the certifier's `arrivalBlocked` (a landing-lane judgement made in the
// TARGET world, not reach in this one).
// usage: node d0-monotone.mjs <worktree> [--fixture]   (--fixture: the frozen pullDiscNit payload, read-only, as the control)
import path from 'node:path';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
const wt = path.resolve(process.argv[2]);
const FIXTURE = process.argv.includes('--fixture');
const ENG = await import(path.join(wt, 'frontend/modules/mazeRoom/mazeRoomEngine.js'));
const D = await import(path.join(wt, 'frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js'));
const L = await import(path.join(wt, 'frontend/modules/mazeRoom/tileSpike/deriveTileLogic.js'));

let payloads = [];
if (FIXTURE) {
    const f = path.join(wt, 'frontend/modules/mazeRoom/tileSpike/fixtures/l78-k-sketch-pull-nit-payload.json.gz');
    payloads.push(['fixture l78-k-sketch (uncut disc)', JSON.parse(gunzipSync(fs.readFileSync(f))).payload]);
} else {
    const RULES = JSON.parse(fs.readFileSync(path.join(wt, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
    const seen = new Set();
    for (const [name, sc] of Object.entries(RULES.preset_sidecars['1'])) {
        const pl = sc.playable_payload;
        if (!pl?.shared_world || !pl.pulls?.length) continue;
        const lv = /level_(\d+)/.exec(pl.atlas_region ?? name)?.[1];
        if (seen.has(lv)) continue;
        seen.add(lv);
        payloads.push([`L${lv}`, pl]);
    }
}
const key = (p) => [...p].sort().join('+') || '∅';
for (const [label, pl] of payloads) {
    const world = ENG.deserializeMazeWorld(pl);
    const sw = world.sharedWorld;
    const items = L.regionItems(world);
    const axis = L.latticeAxis(items, L.regionLevels(world));
    const points = [...L.latticePoints(axis)];
    const top = L.fullPoint(axis);
    const gates = [...new Set(pl.pulls.map((p) => p.gate ?? p.item ?? JSON.stringify(p.rule ?? null)))];
    console.log(`${label}: ${sw.regions.length} regions, axis [${items.join(', ')}] = ${points.length} points; pulls ${pl.pulls.length} (gate ${gates.join(' | ')})`);
    const strict = (a, b) => b.length > a.length && L.pointCovers(b, a); // b ⊋ a
    let A = 0, B = 0, nPairs = 0, nTargets = 0;
    const report = [];
    const check = (what, ok, own = null) => {
        // ok: Map pointKey → boolean, over `points` (an event target: only points without its own event)
        const pts = points.filter((p) => !own || !p.includes(own));
        const topOwn = own ? top.filter((i) => i !== own) : top;
        const any = pts.some((p) => ok.get(key(p)));
        const a = any && !ok.get(key(topOwn));
        const bad = [];
        for (const s of pts) {
            if (!ok.get(key(s))) continue;
            for (const t of pts) if (strict(s, t) && !ok.get(key(t))) bad.push(`${key(s)} ✓ ⊂ ${key(t)} ✗`);
        }
        if (a) { A += 1; report.push(`  (a) ${what}: full ✗, reaches at ${pts.filter((p) => ok.get(key(p))).map(key).slice(0, 4).join(' / ')}`); }
        if (bad.length) { B += 1; report.push(`  (b) ${what}: ${bad.length} S⊂S' flip(s), e.g. ${bad.slice(0, 3).join('; ')}`); }
    };
    for (const from of sw.regions) {
        const entered = D.enteredAt(world, from);
        const reach = new Map(points.map((p) => [key(p), D.nativeReachUnder(entered, p)]));
        // pairs
        for (const to of sw.regions) {
            if (to === from) continue;
            nPairs += 1;
            const ok = new Map();
            for (const [k, r] of reach) {
                let hit = false;
                for (const c of r.cells?.keys?.() ?? []) { const [x, y] = c.split(',').map(Number); if (ENG.sharedWorldOwnerAt(world, x, y) === to) { hit = true; break; } }
                ok.set(k, hit);
            }
            check(`pair ${from} → ${to}`, ok);
        }
        // targets this region owns, from its own arrival
        const owns = (t) => (t.side ? t.side === from : ENG.sharedWorldOwnerAt(world, t.x, t.y) === from);
        const exitAt = new Map([...world.exits.values()].map((e) => [`${e.x},${e.y}`, e]));
        for (const t of L.regionTargets(world).filter(owns)) {
            if (t.kind === 'exit' && !exitAt.get(`${t.x},${t.y}`)?.targetRegion) continue;
            nTargets += 1;
            const ok = new Map(points.map((p) => [key(p), L.reachedTarget(reach.get(key(p)), t, p, entered)]));
            check(`target ${from} ${t.id}`, ok, t.event ?? null);
        }
    }
    console.log(`  pairs ${nPairs}, targets ${nTargets}: (a) ${A}, (b) ${B}`);
    report.forEach((r) => console.log(r));
}
