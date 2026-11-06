// W0 (scratch, measurement only): for every leg of the committed playthrough's leg list, the game_state flags the AP
// route has ALREADY collected before the leg (in the route's own collection order: the sphere log's `sphere_locations`
// row), restricted to the persistence the leg's room reads (its own level's table, plus the one cross-level read in the
// AS3: FinalDoor.as:50 reads L114 tag 0 from L113). An INDEPENDENT derivation from the implementation (it reads the
// rules and the sphere log itself), so the implementation's carry can be compared against it row for row.
//   node w0-carry.mjs <legs.jsonl> [--json=<out>]
import fs from 'node:fs';
const REPO = new URL('../../../../../', import.meta.url).pathname;
const { generateSphereLog } = await import(REPO + 'frontend/modules/shared/procgen/forwardSimulator.js');
const rules = JSON.parse(fs.readFileSync(REPO + 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', 'utf8'));
const legs = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const log = generateSphereLog(rules).filter((e) => e.type === 'state_update');
const collectedAt = new Map();
log.forEach((e, i) => { for (const l of e.player_data['1'].sphere_locations ?? []) if (!collectedAt.has(l)) collectedAt.set(l, i); });
const flags = [];
for (const reg of Object.values(rules.regions['1'])) for (const l of reg.locations ?? []) {
    if (l.event_kind !== 'game_state') continue;
    flags.push({ name: l.name, eventId: l.event_id, level: l.obstacle.level, tag: l.obstacle.tag, at: collectedAt.get(l.name) ?? null });
}
const CROSS = { 113: ['flag:L114:0'] };
const rows = [];
for (const leg of legs) {
    // the leg's place in the route: a location = the row the route collects it; an exit = just after the row its rule first holds
    const step = leg.goal.kind === 'location' ? collectedAt.get(leg.goal.name) ?? null : leg.sphere?.index ?? null;
    const strictly = leg.goal.kind === 'location' ? (a) => a < step : (a) => a <= step;
    const carry = step === null ? [] : flags.filter((f) => f.at !== null && strictly(f.at) && f.name !== leg.goal.name
        && (f.level === leg.level || (CROSS[leg.level] ?? []).includes(f.eventId)));
    const staged = new Set((leg.stagedEvents ?? []).map((e) => e.eventId));
    const add = carry.filter((f) => !staged.has(f.eventId));
    rows.push({ id: leg.id, key: leg.key, level: leg.level, kind: leg.goal.kind, skip: !!leg.skip, step,
        carry: carry.map((f) => f.eventId), add: add.map((f) => f.eventId) });
}
const touched = rows.filter((r) => r.add.length && !r.skip);
const byLevel = {};
for (const r of touched) byLevel[r.level] = (byLevel[r.level] ?? 0) + 1;
console.log(`game_state flags: ${flags.length} (${flags.filter((f) => f.at === null).length} never collected by the route)`);
console.log(`legs: ${legs.length}; skipped: ${rows.filter((r) => r.skip).length}; legs whose carry ADDS a flag beyond their staging: ${touched.length} `
    + `(exit ${touched.filter((r) => r.kind === 'exit').length}, location ${touched.filter((r) => r.kind === 'location').length}); `
    + `carry fully covered by existing staging: ${rows.filter((r) => r.carry.length && !r.add.length && !r.skip).length}`);
console.log(`by level: ${JSON.stringify(byLevel)}`);
const dist = {};
for (const r of touched) dist[r.add.length] = (dist[r.add.length] ?? 0) + 1;
console.log(`flags added per touched leg: ${JSON.stringify(dist)}`);
for (const id of [869, 870, 871, 872, 394, 411, 395, 412]) {
    const r = rows[id];
    console.log(`  ${id} ${r.key}  step ${r.step}  carry ${JSON.stringify(r.carry)}  adds ${JSON.stringify(r.add)}`);
}
const json = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
if (json) fs.writeFileSync(json, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
