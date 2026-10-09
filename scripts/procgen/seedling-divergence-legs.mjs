#!/usr/bin/env node
/**
 * Measure-only (the divergence sweep, planner `seedling-js-planning-2`) — THE LEG LIST: every exit and
 * location leg of the committed Seedling atlas worlds + `seedling_playthrough`, from each region's
 * RESOLVED arrivals, with the inventory the AP route holds there. Pure node, no browser; it writes jsonl
 * and changes nothing tracked. Its consumer is `probe-seedling-divergence-sweep.mjs`.
 *
 *   arrivals   for every door INTO a region (another region's sidecar exit naming it as `targetRegion` +
 *              `targetExitId`), `seedlingRegionBinding.resolveArrivalSpawn` over that door — the binding's
 *              own answer (the game's return spawn, else the door's entrance spawn); a start region also
 *              gets its no-"came from" arrival. Distinct (x, y) per region.
 *   goals      every sidecar exit that is not an `in_` (arrival-only) door, and every rules location of the
 *              region. A logical link (no door) is not walked, so it is not a leg.
 *   sphere     the preset's sphere log (embedded; `seedling_playthrough` carries none, so
 *              `forwardSimulator.generateSphereLog` over the committed rules — the same tool the embedded
 *              logs come from). A location's sphere = where it becomes accessible; an exit's = the first
 *              sphere at or after its region's in which its own `access_rule` holds (`never` = the route
 *              never may take it). `inventory` = the items collected THROUGH that sphere, in collection
 *              order (the game's slot order is acquisition order) — what the AP route holds there.
 *   blocks     (`--blocks`) how many locations the sphere log LOSES with this leg's edge removed (the exit's
 *              rule, or the location's rule, set False): the leg's weight in the playthrough's ranking.
 *
 * Geometry repeats across presets (every atlas world is cut from the same map): a leg whose
 * (level, arrival, goal) an earlier preset already lists is kept once, under the first preset, with
 * `alsoIn`. Preset order: playthrough first (it binds every level).
 *
 *   events     ⛓ an arrival whose door EDGE needs a `game_state` event (an obstacle flag only the game sets:
 *              `level_76 -> level_71__r0c6` = `Has(L71 flag 2: …)`, its landing inside the shield lock) carries
 *              `arrive.events` (`{eventId, level, tag}`). An arrival reached by several doors needs an event only
 *              when EVERY door does. The leg STAGES those flags (`stagedEvents`: `{eventId, level, tag, otherLevel}`,
 *              `eventStaging`): the sweep writes each into the game's persistence table before the jump, so the
 *              obstacle is already broken — the true game state for that arrival, since a player using it broke the
 *              obstacle earlier in the run (persistence is game-global: a flag in ANOTHER level is staged too,
 *              `otherLevel: true`). ⚖ A TEST-HARNESS STAGING CHOICE ONLY: the runtime's "flags flow game → AP only"
 *              is unchanged, and production never stages a flag the game did not set. Two cases stay `skip`ped BY
 *              NAME (the sweep emits a skipped row and never runs them): a gate that maps to no flag (an event that
 *              is not `game_state`, or one without an integer `{level, tag}`), and a leg whose GOAL is one of its own
 *              gating events (staged, there is nothing left to clear).
 *   key        `legKey` — (region, the arrival's door, goal): the leg's identity ACROSS SHAs. The numeric `id` is
 *              the list position (display only: it shifts when an earlier leg is added or removed).
 *
 * Run: node scripts/procgen/seedling-divergence-legs.mjs --out=<legs.jsonl> [--presets=a,b] [--blocks]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/**
 * The `game_state` event items a rule CANNOT hold without: `Has` / `HasAll` of an event item; `And` = the union;
 * `Or` = none when some branch needs none, else the union of every branch's (fail-closed: each branch needs one).
 * `byItem` maps an event ITEM name to its event (`procgenCore/eventRoute.gameStateEventsOf`).
 */
export function requiredEvents(rule, byItem) {
    if (!rule || typeof rule !== 'object') return [];
    const own = (names) => names.filter((n) => byItem.has(n)).map((n) => byItem.get(n));
    const uniq = (list) => [...new Map(list.map((e) => [e.item, e])).values()];
    switch (rule.rule) {
        case 'Has': return own([rule.args?.item_name]);
        case 'HasAll': return own(rule.args?.item_names ?? []);
        case 'And': return uniq((rule.children ?? []).flatMap((c) => requiredEvents(c, byItem)));
        case 'Or': {
            const branches = (rule.children ?? []).map((c) => requiredEvents(c, byItem));
            return branches.some((b) => b.length === 0) ? [] : uniq(branches.flat());
        }
        default: return [];
    }
}

/**
 * An arrival's event needs from its doors' (`needs` = one `requiredEvents` list per door reaching the spawn): none
 * when ANY door needs none (the arrival is reachable without an event), else the union of every door's.
 */
export function arrivalEventNeeds(needs) {
    const gated = needs.length > 0 && needs.every((n) => n.length > 0);
    return gated ? [...new Map(needs.flat().map((e) => [e.item, e])).values()] : [];
}

/**
 * The flag an event STAGES (`{eventId, level, tag}`), or `{why}` when it maps to none: only a `game_state` event
 * (`procgenCore/eventRoute.gameStateEventsOf`, `kind: 'game_state'`) with an integer obstacle `{level, tag}` whose
 * `eventId` is that flag's (`flag:L<level>:<tag>`) is a persistence flag the game itself would hold.
 */
export function stagedFlagOf(event) {
    const id = event?.eventId ?? event?.item ?? event?.name ?? '?';
    if (event?.kind !== 'game_state') return { why: `${id}: not a game_state event (event_kind ${JSON.stringify(event?.kind ?? null)})` };
    if (!Number.isInteger(event.level) || !Number.isInteger(event.tag)) return { why: `${id}: no integer obstacle {level, tag}` };
    if (event.eventId !== `flag:L${event.level}:${event.tag}`) return { why: `${id}: the event id is not its obstacle's flag:L${event.level}:${event.tag}` };
    return { eventId: event.eventId, level: event.level, tag: event.tag };
}

/**
 * An event-gated arrival's staging: `staged` (one `{eventId, level, tag, otherLevel}` per mappable event; `otherLevel`
 * = the obstacle is in another level than the arrival's) and `unmappable` (`[why]`). A leg with ANY unmappable gate
 * is skipped: staging only some of its gates would still land it inside the rest.
 */
export function eventStaging(events, arrivalLevel) {
    const staged = [];
    const unmappable = [];
    for (const e of events ?? []) {
        const f = stagedFlagOf(e);
        if (f.why) unmappable.push(f.why);
        else staged.push({ ...f, otherLevel: f.level !== arrivalLevel });
    }
    return { staged, unmappable };
}

/**
 * An event-gated leg's fields: `{}` for an ungated arrival; `{stagedEvents}` when every gate maps to a flag; else
 * `{skip}` BY NAME — an unmappable gate (`arrival-needs-unmappable-event`), or a location goal that IS one of the
 * gating events (`goal-is-a-staged-event`: staged, there is nothing left to clear).
 */
export function eventGate({ arrive, level, goal }) {
    if (!arrive?.events?.length) return {};
    const need = arrive.events.map((e) => e.eventId ?? e.name).join(' / ');
    const { staged, unmappable } = eventStaging(arrive.events, level);
    if (unmappable.length) {
        return { skip: `arrival-needs-unmappable-event: every door into (${arrive.x},${arrive.y}) needs ${need} — `
            + `${unmappable.join('; ')} (no persistence flag to stage: the landing would be inside the obstacle)` };
    }
    if (goal?.kind === 'location' && arrive.events.some((e) => e.name === goal.name)) {
        return { skip: `goal-is-a-staged-event: every door into (${arrive.x},${arrive.y}) needs ${goal.name}, `
            + 'the goal itself — staging its flag leaves nothing to clear' };
    }
    return { stagedEvents: staged };
}

/** The leg's identity across SHAs: (region, the arrival's door — `start` for the no-"came from" one, goal). */
export function legKey({ region, arrive, goal }) {
    const goalId = goal.kind === 'exit' ? `exit:${goal.exit_id}` : `location:${goal.name}`;
    return `${region} <- ${arrive.via} -> ${goalId}`;
}

/**
 * The legs `--ids=` / `--keys=` select (`--keys` is `|`-separated: a location name may hold a comma). A key that
 * matches no leg THROWS by name (a stale key from another SHA must not select nothing silently).
 */
export function pickLegs(legs, { ids = [], keys = [] } = {}) {
    if (!ids.length && !keys.length) return legs;
    const known = new Set(legs.map((l) => l.key));
    const missing = keys.filter((k) => !known.has(k));
    if (missing.length) throw new Error(`no leg has the key(s) ${JSON.stringify(missing)}`);
    const wantKeys = new Set(keys);
    return legs.filter((l) => ids.includes(l.id) || wantKeys.has(l.key));
}

/** `--ids=a,b` and `--keys=k1|k2` off `argv`. */
export function legSelectors(arg) {
    return { ids: arg('ids', '').split(',').filter(Boolean).map(Number), keys: arg('keys', '').split('|').filter(Boolean) };
}

export const PRESETS = ['seedling_playthrough', 'seedling_atlas', 'seedling_atlas_location', 'seedling_atlas_host',
    'seedling_atlas_maze', 'seedling_atlas_sphere'];

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const OUT = arg('out', '');
    if (!OUT) { console.log('FAIL: --out=<legs.jsonl> is required'); process.exit(2); }
    const presets = arg('presets', PRESETS.join(',')).split(',');
    const BLOCKS = process.argv.includes('--blocks');
    const { resolveArrivalSpawn } = await M('flashPanel/seedlingRegionBinding.js');
    const { returnSpawnTable } = await M('flashPanel/seedlingReturnSpawns.js');
    const { atlasRoomRegions } = await M('seedlingDemo/seedlingAtlasCheckTable.js');
    const { generateSphereLog } = await M('shared/procgen/forwardSimulator.js');
    const { evaluateRuleWithInventory } = await M('shared/procgen/library.js');
    const { gameStateEventsOf } = await M('procgenCore/eventRoute.js');
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const RETURNS = returnSpawnTable(MAP);

    const seen = new Map();
    const legs = [];
    for (const preset of presets) {
        const rules = JSON.parse(readFileSync(join(REPO, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
        const embedded = (rules.sphere_log ?? []).filter((e) => e.type === 'state_update');
        const log = embedded.length ? embedded : generateSphereLog(rules).filter((e) => e.type === 'state_update');
        const spheres = sphereTable(log);
        const rulesRegions = rules.regions['1'];
        const pm = rules.progression_mapping?.['1'] ?? null;
        const sidecars = rules.preset_sidecars['1'];
        const regions = atlasRoomRegions(rules).map(({ region }) => [region, sidecars[region].playable_payload]);
        // every EVENT a door may need: the game_state ones (their flags stage) and any other event location
        // (`event_kind` set, not game_state: no flag to stage, so a leg gated on it stays skipped by name)
        const byItem = new Map([...otherEventsOf(rules, '1'), ...gameStateEventsOf(rules, '1').map((e) => ({ ...e, kind: 'game_state' }))]
            .map((e) => [e.item, e]));
        // region → door id → the doors' edges' event needs (one entry per source door)
        const into = new Map();
        for (const [from, pl] of regions) {
            for (const e of pl.exits ?? []) {
                if (!e.targetRegion || !e.targetExitId) continue;
                if (!into.has(e.targetRegion)) into.set(e.targetRegion, new Map());
                const doors = into.get(e.targetRegion);
                if (!doors.has(e.targetExitId)) doors.set(e.targetExitId, []);
                const edge = (rulesRegions[from]?.exits ?? []).find((x) => x.name === e.exitName) ?? null;
                doors.get(e.targetExitId).push(edge ? requiredEvents(edge.access_rule, byItem) : []);
            }
        }
        const starts = new Set(startTargets(rules));
        const totalLocs = spheres.allLocations.size;
        const blocksCache = new Map();
        const blocksOf = (mutate) => {
            const doc = structuredClone(rules);
            delete doc.sphere_log;
            mutate(doc.regions['1']);
            let got;
            try { got = new Set(generateSphereLog(doc).filter((e) => e.type === 'state_update').flatMap((e) => e.player_data['1'].sphere_locations ?? [])); } catch (err) { return { error: err.message.slice(0, 120) }; }
            return totalLocs - [...spheres.allLocations].filter((l) => got.has(l)).length;
        };
        for (const [region, pl] of regions) {
            const arrivals = [];
            // needs: one event list per door reaching this spawn; the arrival needs events only when EVERY door does
            const add = (a, via, needs) => {
                if (!a) return;
                const same = arrivals.find((b) => b.x === a.x && b.y === a.y);
                if (same) { same.needs.push(...needs); return; }
                arrivals.push({ x: a.x, y: a.y, exitId: a.exitId, landing: a.landing, via, needs: [...needs] });
            };
            for (const [id, needs] of into.get(region) ?? []) add(resolveArrivalSpawn(pl, { exit_id: id }, RETURNS), id, needs);
            if (starts.has(region)) add(resolveArrivalSpawn(pl, null, RETURNS), 'start', [[]]);
            for (const a of arrivals) {
                const events = arrivalEventNeeds(a.needs);
                delete a.needs;
                if (events.length) {
                    a.events = events.map((e) => ({ eventId: e.eventId, level: e.level, tag: e.tag, name: e.name, kind: e.kind }));
                }
            }
            const rr = rulesRegions[region];
            const goals = [];
            for (const e of pl.exits ?? []) {
                if (/^in_/.test(e.exit_id)) continue;
                const re = (rr?.exits ?? []).find((x) => x.name === e.exitName) ?? null;
                const sphere = re ? exitSphere(spheres, region, re.access_rule, pm, evaluateRuleWithInventory) : null;
                goals.push({ goal: { kind: 'exit', level: pl.level, tiles: e.exit_tiles, name: e.exitName, exit_id: e.exit_id },
                    target_level: e.target_level, targetRegion: e.targetRegion, rule: re?.access_rule ?? null, sphere,
                    geo: `x|${JSON.stringify(e.exit_tiles)}`, edge: re ? { region, exit: re.name } : null });
            }
            for (const l of rr?.locations ?? []) {
                const s = spheres.locationSphere.get(l.name) ?? null;
                goals.push({ goal: { kind: 'location', level: pl.level, name: l.name }, rule: l.access_rule ?? null,
                    sphere: s === null ? null : { index: s, ...spheres.at(s) }, item: l.item?.name ?? null,
                    geo: `l|${l.name.replace(/^.*? - /, '')}`, edge: { region, location: l.name } });
            }
            for (const a of arrivals) {
                for (const g of goals) {
                    const k = `${pl.level}|${a.x}|${a.y}|${g.geo}`;
                    if (seen.has(k)) { (seen.get(k).alsoIn ??= []).push(`${preset}:${region}`); continue; }
                    let blocks = null;
                    if (BLOCKS && g.edge) {
                        const bk = `${preset}|${JSON.stringify(g.edge)}`;
                        if (!blocksCache.has(bk)) {
                            blocksCache.set(bk, blocksOf((rg) => {
                                const r = rg[g.edge.region];
                                const t = g.edge.exit ? r.exits.find((x) => x.name === g.edge.exit) : r.locations.find((x) => x.name === g.edge.location);
                                if (t) t.access_rule = { rule: 'Or', children: [] };
                            }));
                        }
                        blocks = blocksCache.get(bk);
                    }
                    const leg = { id: legs.length, key: legKey({ region, arrive: a, goal: g.goal }), preset, region,
                        level: pl.level, arrive: a, ...g, blocks,
                        regionSphere: spheres.regionSphere.get(region) ?? null };
                    delete leg.geo;
                    delete leg.edge;
                    // ⚖ TEST-HARNESS STAGING ONLY (see `events` above): production never stages a flag
                    Object.assign(leg, eventGate({ arrive: a, level: pl.level, goal: g.goal }));
                    seen.set(k, leg);
                    legs.push(leg);
                }
            }
        }
        console.log(`INFO: ${preset}: ${regions.length} regions, ${log.length} spheres, ${legs.length} legs so far`);
    }
    writeFileSync(OUT, legs.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const by = (f) => legs.reduce((m, l) => { const k = f(l); m[k] = (m[k] ?? 0) + 1; return m; }, {});
    console.log(`INFO: ${legs.length} legs → ${OUT}`, JSON.stringify(by((l) => `${l.preset} ${l.goal.kind}`)));
    const staged = legs.filter((l) => l.stagedEvents);
    console.log(`INFO: ${staged.length} leg(s) STAGE their arrival's gating flag(s) (an event-gated arrival; test-harness staging): `
        + JSON.stringify(by((l) => (l.stagedEvents ? l.stagedEvents.map((e) => e.eventId + (e.otherLevel ? '(other level)' : '')).join('+') : 'ungated'))));
    const skipped = legs.filter((l) => l.skip);
    console.log(`INFO: ${skipped.length} leg(s) SKIPPED by name (an event gate that maps to no flag, or the goal IS the gating event)`
        + (skipped.length ? `: ${JSON.stringify(by((l) => (l.skip ? `${l.skip.split(':')[0]} ${l.arrive.events.map((e) => e.eventId ?? e.name).join('+')}` : 'run')))}` : ''));
    const keys = new Set(legs.map((l) => l.key));
    if (keys.size !== legs.length) { console.log(`FAIL: ${legs.length - keys.size} duplicate leg key(s)`); process.exit(1); }
}

/** Event locations that are NOT `game_state` (`event_kind` set to anything else): gates with no flag to stage. */
export function otherEventsOf(rules, playerId = '1') {
    const out = [];
    for (const [region, reg] of Object.entries(rules?.regions?.[String(playerId)] ?? {})) {
        for (const loc of reg?.locations ?? []) {
            if (!loc?.event_kind || loc.event_kind === 'game_state') continue;
            out.push({ name: loc.name, item: loc.item?.name ?? loc.name, region, eventId: loc.event_id ?? null,
                level: loc.obstacle?.level ?? null, tag: loc.obstacle?.tag ?? null, kind: loc.event_kind });
        }
    }
    return out;
}

/** The start hop's target regions (Menu → …). */
function startTargets(rules) {
    const out = [];
    for (const s of rules.start_regions?.['1']?.default ?? []) {
        for (const e of rules.regions['1'][s]?.exits ?? []) out.push(e.connected_region);
    }
    return out;
}

/** The sphere log as ordinals: per sphere, the cumulative inventory (in collection order) and reached regions. */
export function sphereTable(log) {
    const regionSphere = new Map();
    const locationSphere = new Map();
    const allLocations = new Set();
    const rows = [];
    const order = [];
    const counts = new Map();
    const reached = new Set();
    log.forEach((e, i) => {
        const pd = e.player_data['1'];
        for (const [name, n] of Object.entries(pd.new_inventory_details?.base_items ?? {})) {
            for (let k = 0; k < n; k++) order.push(name);
            counts.set(name, (counts.get(name) ?? 0) + n);
        }
        for (const r of pd.new_accessible_regions ?? []) { if (!regionSphere.has(r)) regionSphere.set(r, i); reached.add(r); }
        for (const l of pd.new_accessible_locations ?? []) if (!locationSphere.has(l)) locationSphere.set(l, i);
        for (const l of pd.sphere_locations ?? []) allLocations.add(l);
        rows.push({ label: e.sphere_index, inventory: [...order], counts: new Map(counts), reached: new Set(reached) });
    });
    return { regionSphere, locationSphere, allLocations, rows,
        at: (i) => ({ label: rows[i].label, inventory: rows[i].inventory }) };
}

function exitSphere(spheres, region, rule, pm, evaluate) {
    const from = spheres.regionSphere.get(region);
    if (from === undefined) return { index: null, label: 'never (region unreached)' };
    for (let i = from; i < spheres.rows.length; i++) {
        const row = spheres.rows[i];
        const v = evaluate(rule ?? { rule: 'True_' }, row.counts, '1', (r) => row.reached.has(r), pm);
        if (v === true) return { index: i, ...spheres.at(i) };
    }
    return { index: null, label: 'never (rule never holds)' };
}
