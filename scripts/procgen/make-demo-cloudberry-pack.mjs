#!/usr/bin/env node
/**
 * Generate the committed demo CLOUDBERRY region-library pack + register it in the
 * region-libraries index — the Cloudberry analogue of make-demo-runner-pack.mjs.
 *
 * Each entry is one Cloudberry Kingdom level made by the GAME'S OWN generator: this
 * script opens the Cloudberry page headless (served from the same-origin local copy,
 * `scripts/setup/fetch-cloudberry-site.mjs`), calls `generateText({...args, reroll:
 * true})` once per region (the reroll search makes every claimed item gate real, ⚖ R14)
 * and keeps the RESOLVED request (`doc.args.request`), the document's canonical
 * sha256, the rule facts (each piece's items, the Jetpack hero) and the chosen check
 * coins (⚖ R19: `--checks-per-piece`, default 1, among the coins the computer
 * collects in that piece). Then it CONFIGURES the page with each payload and refuses
 * one the page will not play (hash mismatch, a check coin not found, …).
 *
 * ⛔ No game data lands in the pack: only our arguments, hashes, coin ids, piece item
 * names and the rules emitted from them (⚖ R18).
 *
 * A region whose search ends `RerollExhausted:` is a named refusal: this script stops
 * and says so — pick other args for that region in REGIONS below.
 *
 * Deterministic: the same REGIONS give the same pack bytes, on any build whose
 * generator (`engine.generator`) makes the same documents; the build id is not in the
 * pack (the document hash blanks it). `--check` regenerates in memory and compares
 * with the committed pack (exit 1 on any difference).
 *
 *   node scripts/procgen/make-demo-cloudberry-pack.mjs [--check] [--site <dir>] [--checks-per-piece <n>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'make-demo-cloudberry-pack.mjs', kind: 'browser' });

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const OUT = path.join(repoRoot, 'frontend/region-libraries/demo-cloudberry-pack.json');
const INDEX = path.join(repoRoot, 'frontend/region-libraries/region_library_files.json');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const CHECK = argv.includes('--check');
const PER_PIECE = Number(arg('--checks-per-piece') ?? 1);

const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
const { chromium } = await import('playwright');
const site = await import('./cloudberrySite.mjs');
const rules = await imp('frontend/modules/cloudberryDemo/cloudberryRules.js');
const { substrateRegistry } = await imp('frontend/modules/shared/procgen/substrateRegistry.js');
await imp('frontend/modules/cloudberryDemo/cloudberryLibrary.js');
const { stampLibraryIdentity, validateRegionLibrary } = await imp('frontend/modules/procgenPipeline/regionLibraryValidator.js');
const cloudberry = substrateRegistry.get('cloudberry');

const up = (o) => ({ ...o, Jump: 2 });
/**
 * The regions. Nested pieces (each piece's items ⊇ the last's); a first piece with no
 * platform item gives a free check coin. `trace:false, settings:false` keep the
 * documents small (the hash covers whatever the flags are).
 */
const REGIONS = [
    { id: 'cb_moving', name: 'Cloudberry: Moving Blocks',
        args: { seed: 11, tileset: 'castle', length: 6000, pieces: [{ upgrades: up({}) }, { upgrades: up({ MovingBlock: 5 }) }] } },
    { id: 'cb_falling_cloud', name: 'Cloudberry: Falling Blocks, Clouds',
        args: { seed: 12, tileset: 'cave', length: 9000, pieces: [{ upgrades: up({}) }, { upgrades: up({ FallingBlock: 5 }) }, { upgrades: up({ FallingBlock: 3, Cloud: 5 }) }] } },
    { id: 'cb_bouncy', name: 'Cloudberry: Bouncy Blocks',
        args: { seed: 13, tileset: 'sea', length: 6000, pieces: [{ upgrades: up({}) }, { upgrades: up({ BouncyBlock: 5 }) }] } },
    { id: 'cb_ghost_conveyor', name: 'Cloudberry: Ghost Blocks, Conveyors',
        args: { seed: 15, tileset: 'forest', length: 9000, pieces: [{ upgrades: up({}) }, { upgrades: up({ GhostBlock: 5 }) }, { upgrades: up({ GhostBlock: 3, Conveyor: 5 }) }] } },
    { id: 'cb_moving_elevator', name: 'Cloudberry: Moving Blocks, Elevators',
        args: { seed: 14, tileset: 'castle', length: 6000, pieces: [{ upgrades: up({ MovingBlock: 5 }) }, { upgrades: up({ MovingBlock: 3, Elevator: 5 }) }] } },
    { id: 'cb_jetpack', name: 'Cloudberry: Jetpack, Bouncy Blocks, Pendulums',
        args: { seed: 4, difficulty: 2, tileset: 'castle', length: 7000, pieces: [{ upgrades: { BouncyBlock: 5 } }, { upgrades: { BouncyBlock: 3, Pendulum: 5 } }],
            heroCustom: { move: 'Jetpack', phsx: { jetpackfuel: 1 } } } },
    { id: 'cb_jetpack_flyblob', name: 'Cloudberry: Jetpack, Fly Blobs',
        args: { seed: 6, difficulty: 2, tileset: 'cave', length: 6000, pieces: [{ upgrades: up({}) }, { upgrades: up({ FlyBlob: 5 }) }],
            heroCustom: { move: 'Jetpack', phsx: { jetpackfuel: 1 } } } },
];
const SIDES = ['N', 'E', 'S', 'W'];

/** A captured slot's item: the AP name of an item the NEXT piece adds (null → the engine's filler). */
function slotItems(facts, checks) {
    return checks.map((c) => {
        const next = facts.pieceItems[c.piece + 1] ?? [];
        const have = new Set(facts.pieceItems.slice(0, c.piece + 1).flat());
        const add = next.find((it) => !have.has(it));
        return add ? rules.CLOUDBERRY_ITEM_NAMES[add] : null;
    });
}

const browser = await chromium.launch({ args: [...site.CHROMIUM_ARGS] });
const entries = [];
let generator = null;
try {
    const t0 = Date.now();
    const { page, build, close } = await site.openCloudberryPage(browser, { dir: arg('--site'), log: console.error });
    console.log(`page ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (site build ${build ?? '?'})`);
    for (const r of REGIONS) {
        const args = { ...r.args, reroll: true, trace: false, settings: false };
        const t = Date.now();
        const { doc, docSha256 } = await site.generateDocument(page, args);
        if (typeof doc.error === 'string' && doc.error.startsWith('RerollExhausted:')) {
            throw new Error(`region ${r.id}: ${doc.error} — pick other args for it in REGIONS`);
        }
        if (doc.error) throw new Error(`region ${r.id}: the generator refused: ${doc.error}`);
        generator ??= doc.engine?.generator ?? null;
        if (doc.engine?.generator !== generator) throw new Error(`region ${r.id}: generator ${doc.engine?.generator} != ${generator}`);
        const facts = rules.documentFacts(doc);
        const chosen = rules.chooseCheckCoins(facts, PER_PIECE);
        if (chosen.length === 0) throw new Error(`region ${r.id}: no witnessed coin to make a check`);
        const generate = doc.args.request;
        const params = { ...rules.buildCloudberryPayload(r.id, { generate, docSha256, checks: chosen }).params,
            exits: [], sidePortals: {}, entrySide: null };
        const played = await site.configurePayload(page, params, { regionId: r.id });
        if (played.refusal) throw new Error(`region ${r.id}: the page REFUSED the payload: ${played.refusal}`);
        const items = slotItems(facts, chosen);
        const checks = chosen.map((c) => ({ name: c.name, coin: c.coin, piece: c.piece }));
        const { locations, exitPaths, obstacleDefs } = rules.emitCloudberryRules(
            { pieceItems: facts.pieceItems, jetpack: facts.jetpack },
            { checks, items: Object.fromEntries(checks.map((c, k) => [c.name, items[k]])), exitSides: SIDES });
        entries.push({
            entry_id: r.id,
            name: r.name,
            substrate: 'cloudberry',
            exit_sides: SIDES,
            payload: {
                args: r.args,
                generate,
                docSha256,
                facts: { pieceItems: facts.pieceItems, jetpack: facts.jetpack },
                checks,
            },
            carried_rules: { locations, exitPaths, obstacleDefs },
            location_slots: checks.length,
        });
        console.log(`  ${r.id}: ${((Date.now() - t) / 1000).toFixed(1)} s, rerolls [${generate.rerolls.join(',')}], `
            + `pieces ${JSON.stringify(facts.pieceItems)}${facts.jetpack ? ' +Jetpack' : ''}, `
            + `${checks.length} checks of ${facts.coins.length} witnessed coins, played ${played.playResult?.pieces} pieces`);
    }
    await close();
} finally {
    await browser.close();
}

const library = {
    schema_version: 1,
    library_id: 'demo-cloudberry-pack',
    name: 'Demo Cloudberry Pack',
    description: `${entries.length} pre-generated Cloudberry Kingdom levels (all four exit sides, `
        + `${PER_PIECE} check coin per piece) for the cloudberry substrate's region-library content source. `
        + 'Generated by scripts/procgen/make-demo-cloudberry-pack.mjs (no game data: generator arguments, '
        + 'document hashes, check coin ids and the rules emitted from the documents\' facts).',
    provenance: { generator: 'cloudberry P2a demo', cloudberryGenerator: generator, checksPerPiece: PER_PIECE },
    entries,
};
stampLibraryIdentity(library);
const vr = validateRegionLibrary(library, { entryCapabilityCheck: (e) => cloudberry.validateLibraryEntry(e) });
if (!vr.ok) {
    console.error('FAIL: generated pack does not validate:', vr.errors.join('; '));
    process.exit(1);
}
const text = `${JSON.stringify(library, null, 2)}\n`;

if (CHECK) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (have !== text) {
        console.error(`--check FAILED: ${path.relative(repoRoot, OUT)} ${have === null ? 'is missing' : 'differs from a fresh generation'}`);
        process.exit(1);
    }
    console.log(`--check OK: ${path.relative(repoRoot, OUT)} is byte-identical to a fresh generation (${entries.length} entries)`);
    process.exit(0);
}

fs.writeFileSync(OUT, text);
const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
index.libraries = (index.libraries ?? []).filter((l) => l.file !== 'demo-cloudberry-pack.json');
index.libraries.push({
    file: 'demo-cloudberry-pack.json',
    library_id: library.library_id,
    name: library.name,
    description: `${entries.length} Cloudberry Kingdom levels (four exit sides, check coins per piece).`,
    entry_count: entries.length,
    substrates: ['cloudberry'],
});
fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${path.relative(repoRoot, OUT)} (library_id=${library.library_id}, ${entries.length} entries) + updated index`);
