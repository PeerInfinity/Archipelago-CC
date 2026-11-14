// census: per committed preset, which goals gain route events (routeEventsPlan), and a cross-check vs the sweep's carry
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.argv[2];
const LEGS = process.argv[3];
const { gameStateEventsOf } = await import(join(REPO, 'frontend/modules/procgenCore/eventRoute.js'));
const { generateSphereLog } = await import(join(REPO, 'frontend/modules/shared/procgen/forwardSimulator.js'));
const { routeEventsPlan, routeEventsBefore, routeCollectionRows, scopeReads, regionScopeOf } = await import(join(REPO, 'frontend/modules/playbackBot/routeEvents.js'));
const sphereDataOf = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((e) => e.type === 'state_update').map((e) => ({ locations: e.player_data?.['1']?.sphere_locations ?? [] }));
const rows = [];
const plans = {};
for (const preset of readdirSync(join(REPO, 'frontend/presets')).sort()) {
    const dir = join(REPO, 'frontend/presets', preset);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const seed of readdirSync(dir).filter((d) => d.startsWith('AP_'))) {
        const rp = join(dir, seed, `${seed}_rules.json`);
        const sp = join(dir, seed, `${seed}_sphere_log.jsonl`);
        if (!existsSync(rp)) continue;
        const rules = JSON.parse(readFileSync(rp, 'utf8'));
        const events = gameStateEventsOf(rules, '1');
        if (!events.length) continue;
        let sphereData = existsSync(sp) ? sphereDataOf(sp) : [];
        let src = sphereData.length ? 'jsonl' : 'forwardSimulator';
        if (!sphereData.length) sphereData = generateSphereLog(rules).filter((e) => e.type === 'state_update').map((e) => ({ locations: e.player_data?.['1']?.sphere_locations ?? [] }));
        const plan = routeEventsPlan({ rules, sphereData, events });
        const distinct = new Set([...plan.values()].flat().map((e) => e.name));
        const totalGoals = sphereData.flatMap((r) => r.locations).filter((n) => !events.some((e) => e.name === n)).length;
        rows.push({ preset: `${preset}/${seed}`, src, events: events.length, goals: totalGoals, goalsWithRouteEvents: plan.size, distinctEvents: distinct.size,
            bk2: plan.get('Level 040 - Boss Key 2')?.map((e) => e.eventId) ?? null });
        plans[`${preset}/${seed}`] = { plan, rules, sphereData, events };
    }
}
console.table(rows);
// cross-check vs the sweep's carriedFlags (location legs) on seedling_playthrough/AP_1: the sweep's carry ⊆ ours
if (LEGS) {
    const P = plans['seedling_playthrough/AP_1']; const rr = routeCollectionRows(P.sphereData); const scopeOf = regionScopeOf(P.rules); const regs = P.rules.regions['1'];
    let n = 0, same = 0, sub = 0; const diffs = [];
    for (const l of readFileSync(LEGS, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))) {
        if (l.goal?.kind !== 'location' || l.skip) continue;
        n += 1;
        const ours = routeEventsBefore({ goal: l.goal.name, rows: rr, events: P.events, reads: scopeReads(scopeOf(l.region), { events: P.events, regions: regs, scopeOf }) }).map((e) => e.eventId);
        // the sweep's full carry list = its routeCarry (carriedFlags = only those staging did not already hold)
        const theirs = (l.carriedFlags ?? []).map((f) => f.eventId);
        const missing = theirs.filter((x) => !ours.includes(x));
        if (missing.length) diffs.push({ key: l.key, ours, theirs });
        else if (ours.length === theirs.length) same += 1; else sub += 1;
    }
    console.log(JSON.stringify({ locationLegs: n, equal: same, sweepCarrySubsetOfOurs: sub, sweepCarryNotInOurs: diffs.length }));
    for (const d of diffs.slice(0, 10)) console.log('DIFF', JSON.stringify(d));
}
if (process.env.LIST) for (const k of process.env.LIST.split(',')) {
    console.log(`## ${k}`);
    const rr = routeCollectionRows(plans[k].sphereData);
    for (const [g, l] of plans[k].plan) console.log(`row ${rr.get(g)} ${g}: ${l.map((e) => `${e.eventId}@${rr.get(e.name)}`).join(', ')}`);
}
