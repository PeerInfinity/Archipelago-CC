/**
 * ⚖ **ONE loop-cost model — the standing proof.** Runs the procgen pipeline's
 * block producer (`generateLoopCosts`) and the runtime's planner
 * (`loopsCostDebugger/costPlanner.js` — what the Loops panel's Generate Costs
 * and the auto-generate on entering loop mode actually run) over the SAME
 * documents, and asserts the two blocks are byte-equal modulo `generatedAt`
 * and `generatedFrom`.
 *
 * ── WHY THIS GATE EXISTS ──────────────────────────────────────────────
 *
 * Until 2026-09-06 the tree carried TWO live cost models. Over these same five
 * documents they agreed only on the start region and the first priced region
 * (maze fixture far room 60 vs 23; shapez 5/56 regions, 0/140 locations). ⚖ The
 * user ruled *"Let's make the planner the official algorithm"*, so the
 * generator's own model was deleted and both callers now drive
 * `shared/procgen/loopCostPlanner.js`. This gate is what keeps that true: a
 * second model can only come back by RED-ing here.
 *
 * ⛓ It is a differential, not a snapshot. It pins no cost NUMBER — the numbers
 * are free to move when the model is deliberately changed, and this still holds.
 * The numbers themselves are pinned by `loopCostGenerator.test.js`.
 *
 * ── WHAT IT COVERS ────────────────────────────────────────────────────
 *
 * Five documents, one per class the write-by-class rule distinguishes:
 *   procgen_maze        plain procgen world (coarse regions)
 *   maze_loop_worldgen  a maze fixture that ships a REAL block (untracked;
 *                       skipped when absent, and it says so)
 *   jta_schedule_test   a NATIVE substrate (its own mana economy ⇒ no entries)
 *   omsi_substrate_test a second NATIVE substrate
 *   shapez              56 regions / 140 locations — the size case
 *
 * Pure-node (no dev server, no browser). Measured on this box: 1.05 / 0.76 /
 * 0.84 s over three runs.
 * Run: node scripts/procgen/check-loop-costs-one-model.mjs
 *      node scripts/procgen/check-loop-costs-one-model.mjs --verbose
 * ⛓ **ADOPTED INTO CI 2026-09-06 (⚖ user) — the first of V3b's 50 boxed gates.**
 *   The `@ci-box` line that stood here is DELETED. Measured before and after:
 *   `--set=headless` 31 arms / 1 shard → 32 arms / 2 shards, i.e. 4 procgen gate
 *   jobs per push → 5. That extra shard is the priced cost the user accepted; the
 *   600 s figure `planCiShards` charged an unpriced arm is a placeholder, and the
 *   real arm time is read back off the first CI run that carries it.
 *   ⛑ It reads NO `--host=` — pure node, no dev server — so `argvFor` handing it
 *   no host is correct here, unlike the 20 gates V3b measured with a hand-rolled reader.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MODULES = join(ROOT, 'frontend', 'modules');

const verbose = process.argv.includes('--verbose');

/**
 * ⛔ **THE IMPORT DOOR IS CLOSED, DELIBERATELY.** Everything below runs inside
 * `main()`, reached only when this file IS the entry point. 250 of the 265
 * instruments in this directory do module-scope work on a bare import and are
 * listed for it in `check-procgen-help.baseline.json` — which says out loud that
 * an entry there "is NOT an approved side effect, it is a KNOWN one" and that
 * closing the door means moving the work into a `main()`. A NEW instrument can
 * simply be written that way, so this one is: the baseline's effectful list does
 * not move for it.
 */

let generateLoopCosts;
let CostPlanner;
let documentStateManager; let documentPlayerId; let documentSphereLog;


/** The five documents, by preset directory. */
const DOCUMENTS = [
    { preset: 'procgen_maze', required: true },
    {
        preset: 'maze_loop_worldgen',
        required: false,
        note: 'regenerate with the command in check-maze-loop-mana.mjs\'s header',
    },
    { preset: 'jta_schedule_test', required: true },
    { preset: 'omsi_substrate_test', required: true },
    { preset: 'shapez', required: true },
];

function fail(msg) {
    console.error('FAIL:', msg);
    process.exit(1);
}

// The first `AP_<seed>/AP_<seed>_rules.json` under a preset directory, or null.
// ⚠ NOT a /** */ docblock: the glob spelling of that path contains `*/`, which
// TERMINATES a block comment and turns the rest of the line into code.
function rulesPathFor(preset) {
    const dir = join(ROOT, 'frontend', 'presets', preset);
    if (!existsSync(dir)) return null;
    for (const seedDir of readdirSync(dir).sort()) {
        if (!seedDir.startsWith('AP_')) continue;
        const p = join(dir, seedDir, `${seedDir}_rules.json`);
        if (existsSync(p)) return p;
    }
    return null;
}

/** The sphere log a document can be planned against — its own. */
function sphereLogFor(rulesPath, doc) {
    const embedded = documentSphereLog(doc)?.entries;
    if (embedded && embedded.length) return embedded;
    const jl = rulesPath.replace('_rules.json', '_sphere_log.jsonl');
    if (!existsSync(jl)) return [];
    return readFileSync(jl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Everything but the two metadata fields that are a timestamp and a name. */
function comparable(block) {
    if (!block) return null;
    const { generatedAt, generatedFrom, ...rest } = block;
    return rest;
}

/** The first differing key path between two blocks, for a legible failure. */
function firstDifference(a, b) {
    for (const bucket of ['regions', 'locations']) {
        const keys = new Set([...Object.keys(a?.[bucket] ?? {}), ...Object.keys(b?.[bucket] ?? {})]);
        for (const k of keys) {
            const av = JSON.stringify(a?.[bucket]?.[k]);
            const bv = JSON.stringify(b?.[bucket]?.[k]);
            if (av !== bv) return `${bucket}.${k}: generator ${av} vs planner ${bv}`;
        }
    }
    for (const k of ['version', 'defaultRegionCost', 'defaultLocationCost', 'defaultRegionXpEffect']) {
        if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) {
            return `${k}: generator ${JSON.stringify(a?.[k])} vs planner ${JSON.stringify(b?.[k])}`;
        }
    }
    return 'the two blocks stringify differently but no field differs — key ORDER moved';
}

async function main() {
    // Substrate libraries register their entries on import — without them every
    // region classifies COARSE and the jta/omsi documents would prove nothing.
    await import(join(MODULES, 'mazeRoom/mazeRoomLibrary.js'));
    await import(join(MODULES, 'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js'));
    await import(join(MODULES, 'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js'));
    await import(join(MODULES, 'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js'));

    ({ generateLoopCosts } = await import(join(MODULES, 'shared/procgen/loopCostGenerator.js')));
    ({ CostPlanner } = await import(join(MODULES, 'loopsCostDebugger/costPlanner.js')));
    ({ documentStateManager, documentPlayerId, documentSphereLog } =
        await import(join(MODULES, 'loopsCostDebugger/documentStateManager.js')));

    let checked = 0;
    let skipped = 0;

    for (const { preset, required, note } of DOCUMENTS) {
        const rulesPath = rulesPathFor(preset);
        if (!rulesPath) {
            if (required) fail(`${preset}: no rules.json on disk`);
            skipped += 1;
            console.log(`-- ${preset}: SKIPPED (not on disk${note ? ` — ${note}` : ''})`);
            continue;
        }
        const doc = JSON.parse(readFileSync(rulesPath, 'utf8'));
        const playerId = documentPlayerId(doc);
        const sphereLog = sphereLogFor(rulesPath, doc);

        const fromGenerator = generateLoopCosts({ rulesJson: doc, sphereLog, playerId });

        const sm = await documentStateManager(doc, playerId);
        const planner = new CostPlanner({ stateManager: sm, eventBus: null });
        planner.useStateManager(sm, { playerId });
        planner.loadSphereLog(sphereLog);
        const rejection = planner.getPlanRejectionReason();
        if (rejection) fail(`${preset}: the planner refused the document — ${rejection}`);
        planner.planAll();
        const fromPlanner = planner.getCostData();

        const a = comparable(fromGenerator);
        const b = comparable(fromPlanner);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            fail(`${preset}: the two models disagree — ${firstDifference(a, b)}`);
        }

        const regions = Object.keys(a.regions).length;
        const locations = Object.keys(a.locations).length;
        const worldRegions = Object.keys(doc.regions?.[playerId] ?? {}).length;
        console.log(
            `OK ${preset}: identical blocks — ${regions}/${worldRegions} regions written, `
            + `${locations} locations, defaults ${a.defaultRegionCost}/${a.defaultLocationCost}`);
        if (verbose) {
            for (const [name, entry] of Object.entries(a.regions)) {
                console.log(`     R ${name.padEnd(36).slice(0, 36)} ${JSON.stringify(entry)}`);
            }
        }
        checked += 1;
    }

    if (checked === 0) fail('no document was checked');
    console.log(`\nONE MODEL: ALL OK — ${checked} document(s) identical`
        + (skipped ? `, ${skipped} skipped` : ''));
}

// Run only when this file IS the entry point (the import door above).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
