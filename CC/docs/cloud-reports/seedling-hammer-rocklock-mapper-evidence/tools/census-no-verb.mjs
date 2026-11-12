// MEASUREMENT ONLY (slice seedling-hammer-rocklock-mapper): every divergence-sweep EVENT leg (a location leg whose
// location is a rules event) mapped by the page's own mapper as the page's MAIN thread maps it, under three URLs:
// none (OFF), `SEEDLING_ROCKLOCK_KILL=1`, and that plus `SEEDLING_TALK_CLEAR_GOAL=1`. Prints, per obstacle class, the
// legs (by key) the mapper refuses `no-verb`.   node census-no-verb.mjs <legs.jsonl>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
for (const k of Object.keys(process.env)) if (k.startsWith('SEEDLING_')) delete process.env[k];
const M = (p) => import(join(ROOT, 'frontend/modules', p));
const JR = await M('seedlingDemo/jsRuntimeSolver.js');
const SB = await M('seedlingDemo/solverBot.js');
const { atlasEventGoal, runtimeEventsOf } = await M('flashPanel/seedlingPlaybackController.js');
const PT = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const { events } = runtimeEventsOf(PT);
const byName = new Map(events.map((e) => [e.location, e]));
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const URLS = { off: '', rock: 'SEEDLING_ROCKLOCK_KILL=1', rockTalk: 'SEEDLING_ROCKLOCK_KILL=1;SEEDLING_TALK_CLEAR_GOAL=1' };
const rows = [];
for (const leg of legs) {
    if (leg.goal?.kind !== 'location') continue;
    const e = byName.get(leg.goal.name);
    if (!e) continue;
    const row = { key: leg.key, event: e.eventId, cls: e.obstacle?.class ?? null, presser: e.presser?.class ?? null };
    for (const [arm, spec] of Object.entries(URLS)) {
        globalThis.location = { search: spec ? `?seedlingSolverEnv=${encodeURIComponent(spec)}` : '' };
        // TALK_CLEAR_GOAL is read at module load; a page with the param has it on from the start, so mirror it here.
        const r = JR.withTalkClearGoal(spec.includes('TALK_CLEAR_GOAL=1'), () => SB.withRockLockKill(false,
            () => JR.solverGoalFor(atlasEventGoal(e, leg.level), { run: { level: leg.level }, resolved: null })));
        row[arm] = r.goal ? 'mapped' : r.refusal?.reason ?? r.walker;
        if (r.refusal?.reason === 'no-verb') row[`${arm}Why`] = r.walker.replace(/^.*no-verb: /, '').replace(/\. Its check.*$/, '');
    }
    rows.push(row);
}
console.log(JSON.stringify({ eventLegs: rows.length, rows }));
