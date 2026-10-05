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
 * Run: node scripts/procgen/seedling-divergence-legs.mjs --out=<legs.jsonl> [--presets=a,b] [--blocks]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

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
        const into = new Map();
        for (const [, pl] of regions) {
            for (const e of pl.exits ?? []) {
                if (!e.targetRegion || !e.targetExitId) continue;
                if (!into.has(e.targetRegion)) into.set(e.targetRegion, new Set());
                into.get(e.targetRegion).add(e.targetExitId);
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
            const add = (a, via) => {
                if (a && !arrivals.some((b) => b.x === a.x && b.y === a.y)) arrivals.push({ x: a.x, y: a.y, exitId: a.exitId, landing: a.landing, via });
            };
            for (const id of into.get(region) ?? []) add(resolveArrivalSpawn(pl, { exit_id: id }, RETURNS), id);
            if (starts.has(region)) add(resolveArrivalSpawn(pl, null, RETURNS), 'start');
            const rr = rulesRegions[region];
            const goals = [];
            for (const e of pl.exits ?? []) {
                if (/^in_/.test(e.exit_id)) continue;
                const re = (rr?.exits ?? []).find((x) => x.name === e.exitName) ?? null;
                const sphere = re ? exitSphere(spheres, region, re.access_rule, pm, evaluateRuleWithInventory) : null;
                goals.push({ goal: { kind: 'exit', level: pl.level, tiles: e.exit_tiles, name: e.exitName, exit_id: e.exit_id },
                    target_level: e.target_level, targetRegion: e.targetRegion, rule: re?.access_rule ?? null, sphere,
                    key: `x|${JSON.stringify(e.exit_tiles)}`, edge: re ? { region, exit: re.name } : null });
            }
            for (const l of rr?.locations ?? []) {
                const s = spheres.locationSphere.get(l.name) ?? null;
                goals.push({ goal: { kind: 'location', level: pl.level, name: l.name }, rule: l.access_rule ?? null,
                    sphere: s === null ? null : { index: s, ...spheres.at(s) }, item: l.item?.name ?? null,
                    key: `l|${l.name.replace(/^.*? - /, '')}`, edge: { region, location: l.name } });
            }
            for (const a of arrivals) {
                for (const g of goals) {
                    const k = `${pl.level}|${a.x}|${a.y}|${g.key}`;
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
                    const leg = { id: legs.length, preset, region, level: pl.level, arrive: a, ...g, blocks,
                        regionSphere: spheres.regionSphere.get(region) ?? null };
                    delete leg.key;
                    delete leg.edge;
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
