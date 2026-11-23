#!/usr/bin/env node
/**
 * byte-identity.mjs — slice `rules-spinner-alias-guards`: hash every artifact the two guards could move, so the
 * same script run against a worktree at the base and against the slice tip can be diffed line for line.
 *
 *   node CC/docs/cloud-reports/rules-spinner-alias-guards-evidence/tools/byte-identity.mjs <repo-root>
 *
 * Prints one `<key> <md5|verdict>` line per artifact:
 *   gen:<preset>        assembleGeneratedSeedlingSet(rules) → md5 of the delivered set + its check table (or REFUSED)
 *   validate:<file>     validateLevelSet on every committed level-set document → ok / error count / md5 of errors
 *   rewrite:canonical   buildPlacementTable on the vanilla 116 + the AP_1 canonical placement → md5 of its entries,
 *                       and rewriteRecordSet's delivered set
 *   atlastable:<preset> buildAtlasCheckTable with the tag allocator (P4E arm) → md5 of entries + retags
 *   aliases:<map>       aliasTargetsOf (slice tip only; `n/a` at the base, where the module does not exist)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.argv[2] ?? '.');
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const md5 = (x) => createHash('md5').update(typeof x === 'string' ? x : JSON.stringify(x, (k, v) =>
    v instanceof Map ? [...v] : v instanceof Set ? [...v] : v)).digest('hex');
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const out = (k, v) => console.log(`${k} ${v}`);

const GS = await imp('frontend/modules/seedlingDemo/seedlingGeneratedSet.js');
const V = await imp('frontend/modules/seedlingDemo/levelSetValidator.js');
const RW = await imp('frontend/modules/seedlingDemo/apPlacementRewriter.js');
const EX = await imp('frontend/modules/seedlingDemo/levelSetExporter.js');
const { R7_GOAL_LEDGER } = await imp('frontend/modules/seedlingDemo/r7Acceptance.js');
const AT = await imp('frontend/modules/seedlingDemo/seedlingAtlasCheckTable.js');
const LW = await imp('frontend/modules/seedlingDemo/levelWorld.js');
const PS = await imp('frontend/modules/seedlingDemo/procgenSeedling.js');

const files = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'frontend', 'scripts'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0');
const presetRules = files.filter((f) => /^frontend\/presets\/seedling[^/]*\/[^/]+\/[^/]+_rules\.json$/.test(f)).sort();

// 1. every seedling preset through the generated-set assembler (a non-generated preset is refused by name: recorded)
for (const f of presetRules) {
    const rules = json(f);
    const placed = new Map();
    for (const slot of Object.values(rules.regions ?? {})) for (const r of Object.values(slot)) {
        for (const l of r.locations ?? []) if (l.item) placed.set(l.name, l.item);
    }
    try {
        const g = GS.assembleGeneratedSeedlingSet(rules, { locationItemOf: (n) => placed.get(n) ?? null, selfPlayer: 1 });
        out(`gen:${f}`, `${md5(g.set)} table=${md5([...g.table])} report=${md5(g.report)}`);
    } catch (e) {
        out(`gen:${f}`, `REFUSED ${md5(e.message)} ${e.message.split('\n')[0].slice(0, 90)}`);
    }
}

// 2. every committed level-set document through the validator
for (const f of files.filter((p) => p.endsWith('.json') && !p.includes('/presets/') && existsSync(join(ROOT, p))).sort()) {
    let doc;
    try { doc = json(f); } catch { continue; }
    const sets = [];
    if (doc && typeof doc === 'object' && Array.isArray(doc.rooms) && 'set_id' in doc) sets.push(['', doc]);
    if (doc && typeof doc === 'object' && doc.set && Array.isArray(doc.set.rooms)) sets.push(['.set', doc.set]);
    for (const [sub, s] of sets) {
        const v = V.validateLevelSet(s);
        out(`validate:${f}${sub}`, `ok=${v.ok} errors=${v.errors.length} ${md5(v.errors)} warnings=${md5(v.warnings)}`);
    }
}

// 3. the rewriter on the real corpus (the H7 unit tests' own inputs)
const MAP = json('frontend/modules/flashPanel/atlases/seedling-map.json');
{
    const rules = json('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
    const [slot] = Object.keys(rules.regions);
    const placed = new Map();
    for (const region of Object.values(rules.regions[slot])) {
        for (const loc of region.locations ?? []) if (loc.event !== true) placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
    }
    const t = RW.buildPlacementTable({ locationItemOf: (n) => placed.get(n) ?? null, ledger: R7_GOAL_LEDGER,
        rooms: MAP.levels, selfPlayer: 1, bossReport: true });
    out('rewrite:canonical:entries', md5(t.entries));
    out('rewrite:canonical:allocated', t.entries.filter((e) => e.tagSource === 'allocated').map((e) => `${e.level}:${e.tag}`).join(','));
    const vset = EX.vanillaRecordSet(json('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), MAP).set;
    out('rewrite:canonical:set', md5(RW.rewriteRecordSet(vset, t.table)));
}

// 4. the atlas arm's table with the P4E allocator, on every atlas preset (the wiring's alias wrap is replayed when present)
let aliases = null;
try { aliases = await imp('frontend/modules/seedlingDemo/outOfBandAliases.js'); } catch { aliases = null; }
const alloc = aliases
    ? ((targets) => (room, reserved) => PS.placementTagId(room, [...reserved, ...aliases.aliasReservedFor(targets, room.level)]))(aliases.aliasTargetsOf(MAP))
    : PS.placementTagId;
const SDer = await imp('frontend/modules/seedlingDemo/seedlingAtlasDerivation.js');
const GAME = json('frontend/modules/flashPanel/games/seedling.json');
const INDEX = json('frontend/modules/flashPanel/atlases/atlas_files.json');
for (const f of presetRules) {
    const rules = json(f);
    const atlasId = rules.region_atlas?.['1']?.atlas_id;
    const row = atlasId && INDEX.atlases.find((a) => a.atlas_id === atlasId);
    if (!row) { out(`atlastable:${f}`, `SKIP no indexed atlas for ${JSON.stringify(atlasId ?? null)}`); continue; }
    const byName = new Map();
    for (const r of Object.values(rules.regions['1'] ?? {})) for (const l of r.locations ?? []) byName.set(l.name, l.item);
    const locationItemOf = (n) => { const it = byName.get(n); return it && typeof it.name === 'string' ? { name: it.name, player: it.player } : null; };
    try {
        const t = AT.buildAtlasCheckTable({ rules, atlasDoc: json(`frontend/modules/flashPanel/atlases/${row.file}`), mapDoc: MAP,
            locationItemOf, selfPlayer: 1, placementKey: RW.placementKey, tagOf: LW.tagOf,
            itemOfEntity: AT.itemOfEntityFrom({ itemForTag: SDer.ITEM_FOR_TAG, itemForKey: SDer.ITEM_FOR_KEY, victoryItem: SDer.VICTORY_ITEM }),
            propertyLocationOf: AT.propertyLocationOfFrom(GAME, SDer.ITEM_FOR_TAG),
            allocateTag: alloc, optionalTagTypes: Object.keys(LW.PICKUP_CLEARS_OPTIONAL_TAG ?? {}) });
        out(`atlastable:${f}`, `entries=${t.entries.length} ${md5(t.entries)} retags=${t.retags.length} ${md5(t.retags)} refused=${t.refused.length}`);
    } catch (e) {
        out(`atlastable:${f}`, `THREW ${md5(e.message)} ${e.message.split('\n')[0].slice(0, 90)}`);
    }
}

// 5. the derivation itself (slice tip only)
if (aliases) {
    const fmt = (m) => [...m].map(([l, s]) => `${l}:{${[...s].join(',')}}`).join(' ');
    out('aliases:vanilla-map', fmt(aliases.aliasTargetsOf(MAP)));
    out('aliases:vanilla-map:collisions', aliases.aliasCollisionsOf(MAP).length);
} else {
    out('aliases:vanilla-map', 'n/a (base: no outOfBandAliases module)');
}
