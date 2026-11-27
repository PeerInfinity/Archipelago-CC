/**
 * Generate the preset the mystery substrate's in-app rows load:
 *
 *   mystery_street_test   the long case's office beside one maze region, "The street". It is the
 *                         smallest world in which the player can be AWAY from the office, which is
 *                         what the substrate's lock and the bridge's `inOffice` are about.
 *
 * How it is built, with nothing typed about the case:
 *   1. The SOURCE is the committed, filled mystery world (found by its data: the one committed
 *      preset whose rules carry a `slot_data.mystery` block and whose regions are not generated).
 *   2. A region "The street" is put between the start and the case's region. The item of the
 *      case's first sphere-free question (document order) moves to the street's one location, and
 *      that question takes one more of the world's filler. Rules are untouched.
 *   3. The top-down driver realises it: the case's region by the `mystery` substrate (the case
 *      document read off the source), the street as a maze room.
 *
 * Deterministic; re-running overwrites the rules.json.
 *
 *   node scripts/test/generate-mystery-street-test-preset.mjs
 *   node scripts/test/generate-mystery-street-test-preset.mjs --out-dir /tmp/scratch
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolvePresetOutDir } from './presetOutDir.mjs';
import { preloadScriptContent } from '../procgen/preloadContent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

export const SEED = 1;
export const SEED_ID = 'AP_14089154938208861744';
export const GAME_ID = 'mystery_street_test';
export const GAME_NAME = 'Mystery Street Test';
export const STREET = 'The street';
export const STREET_LOCATION = 'Something in the gutter';
const PLAYER = '1';
const TRUE_RULE = Object.freeze({ rule: 'True_' });

/** The committed, filled mystery world: by its data, never by its name. Throws unless there is exactly one. */
export function findMysterySource() {
    const presets = path.join(repoRoot, 'frontend/presets');
    const index = JSON.parse(fs.readFileSync(path.join(presets, 'preset_files.json'), 'utf8'));
    const found = [];
    for (const [game, entry] of Object.entries(index)) {
        for (const [folder, info] of Object.entries(entry?.folders ?? {})) {
            for (const file of info?.files ?? []) {
                if (!String(file).endsWith('_rules.json')) continue;
                const full = path.join(presets, game, folder, file);
                if (!fs.existsSync(full)) continue;
                const text = fs.readFileSync(full, 'utf8');
                if (!text.includes('"mystery"')) continue;
                const rules = JSON.parse(text);
                const generated = Object.keys(rules?.preset_sidecars?.[PLAYER] ?? {}).length > 0;
                if (!generated && rules?.world?.[PLAYER]?.slot_data?.mystery) found.push({ file: path.relative(repoRoot, full), rules });
            }
        }
    }
    if (found.length !== 1) throw new Error(`expected one committed mystery world, found ${found.length}: ${found.map((f) => f.file).join(', ')}`);
    return found[0];
}

/** The source with the street added. Pure: returns a new document. */
export function withStreet(sourceRules, officeName) {
    const source = JSON.parse(JSON.stringify(sourceRules));
    const regions = source.regions[PLAYER];
    const office = regions[officeName];
    const startName = source.start_regions[PLAYER].default[0];
    const start = regions[startName];
    const wayIn = start.exits.find((e) => e.connected_region === officeName);
    if (!wayIn) throw new Error(`the start "${startName}" has no exit to "${officeName}"`);
    // The first question that needs nothing, holding a paper of the case: its paper goes to the street.
    const papers = source.world[PLAYER].slot_data.mystery.items;
    const donor = office.locations.find((l) => l.access_rule?.rule === 'True_' && l.item && Object.hasOwn(papers, l.item.name));
    if (!donor) throw new Error('no sphere-free question of the case holds a paper');
    const filler = Object.entries(source.items[PLAYER]).find(([, def]) => def.classification === 'filler')?.[0];
    if (!filler) throw new Error('the source defines no filler item');
    const moved = donor.item;
    donor.item = { ...moved, name: filler, advancement: false };
    source.itempool_counts[PLAYER][filler] = (source.itempool_counts[PLAYER][filler] ?? 0) + 1;
    const nextId = Math.max(...Object.values(regions).flatMap((r) => r.locations.map((l) => l.id ?? 0))) + 1;
    wayIn.connected_region = STREET;
    regions[STREET] = {
        name: STREET,
        exits: [{ name: 'Up to the office', connected_region: officeName, access_rule: { ...TRUE_RULE } }],
        locations: [{ name: STREET_LOCATION, id: nextId, access_rule: { ...TRUE_RULE }, item: moved, locked: false }],
    };
    office.exits = [...(office.exits ?? []), { name: 'Down to the street', connected_region: STREET, access_rule: { ...TRUE_RULE } }];
    return { source, movedItem: moved.name, donor: donor.name };
}

/** The whole build, in memory. */
export async function buildMysteryStreetRules() {
    const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
    await imp('frontend/modules/mazeRoom/mazeRoomLibrary.js');
    const lib = await imp('frontend/modules/mysteryArchipelago/mysterySubstrateLibrary.js');
    const { buildTopDownEnvelope, runTopDownToStep } = await imp('frontend/modules/procgenPipeline/topDownSteps.js');
    await preloadScriptContent(); // ⛓ CONTENT SETS C4 — the default packs, after the libraries register

    const found = findMysterySource();
    const claimed = Object.keys(lib.mysteryRegionsOfSource(found.rules, PLAYER));
    if (claimed.length !== 1) throw new Error(`${found.file}: expected one region to be the case, found ${claimed.length}`);
    const { source, movedItem, donor } = withStreet(found.rules, claimed[0]);
    source.game_name = GAME_NAME;

    const entry = lib.substrateRegistryEntry;
    entry.applyPipelineConfig(lib.mysteryConfigFromSource(source, PLAYER));
    try {
        const env = buildTopDownEnvelope({
            source, seed: SEED, gridDims: { width: 2, height: 2 }, regionSizeBase: { width: 8, height: 6 },
            substrateMix: { maze: 1, [lib.MYSTERY_SUBSTRATE_ID]: 1 },
        });
        env.opts.substrateByRegion = { ...lib.mysteryRegionsOfSource(source, PLAYER), [STREET]: 'maze' };
        await runTopDownToStep(env, 'compile');
        const rules = env.compile.rulesJson;
        rules.game_directory = GAME_ID;
        return { rules, sourceFile: found.file, office: claimed[0], movedItem, donor };
    } finally {
        entry.applyPipelineConfig({});
    }
}

export const serializeRules = (rules) => JSON.stringify(rules, null, 2) + '\n';

async function main() {
    const { outDir } = resolvePresetOutDir({ repoRoot, gameId: GAME_ID, seedId: SEED_ID });
    const outFile = path.join(outDir, `${SEED_ID}_rules.json`);
    const { rules, sourceFile, office, movedItem, donor } = await buildMysteryStreetRules();
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, serializeRules(rules));
    const sidecars = rules.preset_sidecars[PLAYER];
    console.log(`source ${sourceFile}`);
    for (const [name, sc] of Object.entries(sidecars)) {
        console.log(`  ${name}: ${sc.substrate}, ${rules.regions[PLAYER][name].locations.length} location(s)`);
    }
    console.log(`  the case is "${office}"; "${movedItem}" moved from "${donor}" to "${STREET_LOCATION}"`);
    console.log(`wrote ${path.relative(repoRoot, outFile)}`);
    console.log('Register with:\n'
        + `  python3 scripts/utils/register-preset.py ${path.relative(repoRoot, outFile)} `
        + `--game-id ${GAME_ID} --game-name '${GAME_NAME}'`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => { console.error(err); process.exit(1); });
}
