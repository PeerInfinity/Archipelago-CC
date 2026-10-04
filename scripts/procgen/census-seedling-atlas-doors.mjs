#!/usr/bin/env node
/**
 * census-seedling-atlas-doors — **THE ATLAS DOOR CENSUS**: every INTERNAL exit of
 * a Seedling region atlas (the crossings between sub-regions of one level) by
 * rule and by level, the `Progressive Swim` rows flagged BOT-UNCERTIFIED unless
 * a committed tape witnesses that level with water armed, and whether the
 * pipeline's content source can reach either side of a swim row.
 *
 * SEEDLING SWIM S2, D2. The playthrough atlas's swim rows are rules v1's
 * permissiveness bounds, read off the analyzer's terrain split; a permissive row
 * strands a seed, a strict one only costs a door. This table says which of them
 * any bot run has stood in.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Report-only; exit 0 whatever it finds. The pure half is
 * `seedlingAtlasDoorCensus.js`; `seedlingAtlasDoorCensus.test.js` pins the
 * committed playthrough atlas's counts, so a restamped atlas moves that row.
 *
 * ⛓ WHAT IT BOUNDS (named in the printed header):
 *   · the witness set is DERIVED from `frontend/modules/seedlingDemo/fixtures/
 *     tapes/*.json`, never typed: a tape witnesses level L when it BOOTS in L,
 *     its `noHazards` lacks `water`, and its grants hold a tag whose AP item is
 *     `Progressive Swim` (`ITEM_FOR_TAG`, `seedlingAtlasDerivation.js`). A tape
 *     with water armed and no swim tag is listed as NO-SWIM (a drown control only if it enters water). Boot level only —
 *     a tape is not replayed, so a level it walks into is not counted, and a
 *     witness does not say which internal exit the tape crossed;
 *   · "placeable" is the content source's own predicate
 *     (`buildSeedlingContentSource`: a compiled sub-region with ≥1 wired door);
 *   · the content source's swim rules are the rules its zones carry — the bound
 *     doors' `boundaryRule` and the rooms' location rules — nothing else.
 *
 * Run:
 *   node scripts/procgen/census-seedling-atlas-doors.mjs
 *   node scripts/procgen/census-seedling-atlas-doors.mjs --atlas=seedling-9ff3df2a
 *   node scripts/procgen/census-seedling-atlas-doors.mjs --atlas=path/to/atlas.json --json=/tmp/doors.json
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

import { argvHelp } from './argvHelp.js';
import { censusAtlasDoors, swimWitnesses, SWIM_ITEM, ruleItems } from './seedlingAtlasDoorCensus.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ATLAS_DIR = join(REPO, 'frontend/modules/flashPanel/atlases');
const TAPE_DIR = join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const INDEX = readJson(join(ATLAS_DIR, 'atlas_files.json'));
const PLAYTHROUGH = INDEX.atlases.find((a) => a.file === 'seedling-playthrough.json').atlas_id;
const atlasArg = arg('atlas', PLAYTHROUGH);
const byId = INDEX.atlases.find((a) => a.atlas_id === atlasArg);
const atlasPath = byId ? join(ATLAS_DIR, byId.file) : resolve(atlasArg);
if (!existsSync(atlasPath)) {
    console.error(`ERROR: --atlas=${atlasArg} is neither an atlas_id atlas_files.json lists `
        + `[${INDEX.atlases.map((a) => a.atlas_id).join(', ')}] nor a file`);
    process.exit(2);
}
const atlas = readJson(atlasPath);

const { ITEM_FOR_TAG } = await import(pathToFileURL(join(REPO, 'frontend/modules/seedlingDemo/seedlingAtlasDerivation.js')));
const swimTags = Object.entries(ITEM_FOR_TAG).filter(([, item]) => item === SWIM_ITEM).map(([tag]) => tag);
const tapeFiles = readdirSync(TAPE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const tapes = tapeFiles.map((file) => ({ file, tape: readJson(join(TAPE_DIR, file)) }));
const { witness, noSwim } = swimWitnesses(tapes, swimTags);

const { buildSeedlingContentSource } = await import(pathToFileURL(join(REPO, 'frontend/modules/flashPanel/flashSeedlingLibrary.js')));
const { boundaryRule } = await import(pathToFileURL(join(REPO, 'frontend/modules/procgenPipeline/regionAtlasPool.js')));
const source = buildSeedlingContentSource(atlas);
const placeable = new Set(source.zones.map((z) => `${z.payload.atlas_region}/${z.payload.atlas_sub_region ?? ''}`));
let contentSourceSwimRules = 0;
for (const z of source.zones) {
    for (const d of z.payload.exits) if (ruleItems(boundaryRule(z.region, d.exit_id)).has(SWIM_ITEM)) contentSourceSwimRules += 1;
    for (const l of z.locations) if (ruleItems(l.access_rule).has(SWIM_ITEM)) contentSourceSwimRules += 1;
}

const c = censusAtlasDoors(atlas, { witness, noSwim, placeable });
const out = [];
const say = (s = '') => out.push(s);
say('# census-seedling-atlas-doors');
say(`atlas ${c.atlasId} (${atlasPath.slice(REPO.length + 1)}) · ${c.regions} regions · ${c.regionsWithSubgraph} with a subgraph · `
    + `${c.subRegions} sub-regions · ${c.internalExits} internal exits`);
say(`bounds: witnesses = ${tapes.length} committed tapes, boot level only, water armed + a swim tag [${swimTags.join(', ')}] `
    + `(ITEM_FOR_TAG → ${SWIM_ITEM}); placeable = the content source's ${source.zones.length} rooms with ≥1 wired door `
    + `(${source.doorless.length} doorless)`);
say();
say('## internal exits by rule');
for (const r of c.byRule) say(`  ${String(r.count).padStart(4)}  ${r.rule}`);
say();
say(`## the ${SWIM_ITEM} rows: ${c.swim} of ${c.internalExits} internal exits, over ${c.swimLevels.length} levels`);
say('  level  region      internal  swim  verdict          witnesses / water-armed tapes with no swim tag');
for (const r of c.swimLevels) {
    say(`  ${String(r.level).padStart(5)}  ${r.region_id.padEnd(10)}  ${String(r.internal).padStart(8)}  ${String(r.swim).padStart(4)}  `
        + `${r.verdict.padEnd(15)}  ${r.witnesses.join(', ') || '—'}${r.noSwimTapes.length ? ` / no-swim: ${r.noSwimTapes.join(', ')}` : ''}`);
}
say();
say(`WITNESSED levels: ${c.witnessedLevels.length} [${c.witnessedLevels.join(', ')}]`);
say(`BOT-UNCERTIFIED levels: ${c.uncertifiedLevels.length} [${c.uncertifiedLevels.join(', ')}]`);
say(`swim rows on a WITNESSED level: ${c.swimLevels.filter((r) => r.verdict === 'WITNESSED').reduce((n, r) => n + r.swim, 0)} of ${c.swim}`);
say();
say('## the pipeline side');
say(`swim rows with a placeable side: ${c.swimRowsWithPlaceableSide} of ${c.swim}; with BOTH sides placeable: ${c.swimRowsBothSidesPlaceable}`);
say(`swim rules the content source's zones carry (bound-door boundaryRule + location rules): ${contentSourceSwimRules}`);
say('⇒ a swim row is geometry INSIDE a placed room (one sub-region = one AP region); no pipeline world emits it as a door or a rule.');
console.log(out.join('\n'));

const jsonOut = arg('json', '');
if (jsonOut) {
    mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
    const levelsObj = (m) => Object.fromEntries([...m].sort((a, b) => a[0] - b[0]));
    writeFileSync(resolve(jsonOut), `${JSON.stringify({
        ...c, swimTags, tapes: tapes.length, witnessTapes: levelsObj(witness), noSwimTapes: levelsObj(noSwim),
        placeableRooms: source.zones.length, doorlessRooms: source.doorless.length, contentSourceSwimRules,
    }, null, 2)}\n`);
    console.log(`wrote ${jsonOut}`);
}
