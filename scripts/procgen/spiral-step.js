#!/usr/bin/env node
/**
 * Headless per-step driver for the stepped SHUFFLED-SPIRAL pipeline. Runs ONE
 * step (or a range) of arrange → content → regions → compile, reading the prior
 * step's "envelope" JSON and writing the next. Edit the envelope JSON between
 * invocations to author each step by hand (e.g. after `arrange`, reorder
 * arrange.sequence or edit arrange.cells, then re-run from `regions`). Shares the
 * step wiring with the Procgen Pipeline panel via spiralSteps.js.
 *
 * Usage:
 *   # start fresh (arrange builds the envelope from the substrate quotas):
 *   node scripts/procgen/spiral-step.js arrange --seed 1 --quota jta=5 --start jta -o s1.json
 *   node scripts/procgen/spiral-step.js content  -i s1.json -o s2.json
 *   node scripts/procgen/spiral-step.js regions  -i s2.json -o s3.json
 *   node scripts/procgen/spiral-step.js compile  -i s3.json -o s4.json --rules-out rules.json
 *
 *   # run the whole pipeline (or a range) in one process:
 *   node scripts/procgen/spiral-step.js run --quota maze=4 --quota jta=4 --start maze \
 *        --items key_red=2 --rules-out rules.json
 *
 *   # re-run from a step after hand-editing the envelope:
 *   node scripts/procgen/spiral-step.js run -i s1.json --from regions --rules-out rules.json
 *
 *   # auto-resume a partial / hand-edited envelope (no --from): runs from the
 *   # FIRST step whose output is missing (presence = keep, absence = recompute):
 *   node scripts/procgen/spiral-step.js run -i partial.json --rules-out rules.json
 *
 * World flags (arrange / run when starting fresh):
 *   --seed N                rng seed (default 1)
 *   --region WxH            per-region tile size (default 8x6)
 *   --quota id=N            per-substrate region quota (repeatable; ≥1 required)
 *   --start id              start substrate ('auto' or substrate id)
 *   --items id=N            item pool entry (procedural substrates; repeatable)
 *   --obstacles id=N        obstacle pool entry (repeatable)
 *   --no-bidirectional      disable assumeBidirectional (default on)
 *   --enable-loop-mode      compute loop_costs in the rules.json
 *   --region-xp-effect E    loop-mode xp effect (default cost)
 *   --victory-item NAME     completion item (default: first quota'd substrate's
 *                           registry victoryItem)
 *
 * JtA ② content dataset flags (arrange / run; Part 3 — generation is Node-only):
 *   --jta-dataset-file F    install a pre-generated dataset document as ② content
 *   --jta-generate          generate the dataset from the bundled-less fixtures
 *   --jta-dataset-seed N    generation seed (default 1)
 *   --jta-dataset-zones N   generation zone count
 *   --jta-dataset-theme K   generation theme key
 *   --jta-dataset-value-mode M   raw (default) | zone_formula
 *   --jta-original-item-weight W  per-rep chance a scheduled award keeps the
 *                                 original item (P2/S3; byte-inert default 1)
 *   --jta-dummy-item-ratio R      per-rep chance an award becomes the minted
 *                                 inert dummy item (P2; byte-inert default 0)
 *
 * Award-schedule knobs, GLOBAL (P2/S3 — one pair governs every generator;
 * the --jta-* spellings above override them for jta only):
 *   --original-item-weight W      per-award chance the original is kept
 *                                 (byte-inert default 1); with an omsi quota
 *                                 this also mints the omsi lootable contents
 *                                 schedule (Pots/Locks, §9b-pre)
 *   --dummy-item-ratio R          per-award chance of a dummy (byte-inert
 *                                 default 0)
 *   --jta-emit-locations    surface each zone task as an AP location + a Victory
 *   --jta-goal-zone N       Victory zone (default: deepest zone when emitting)
 *   --jta-free-zones N      zones requiring no perks (default 1)
 *   --jta-starting-perks N  perks the player starts with (default 0)
 *   --jta-perk-shuffle-seed N   seeded cross-zone perk placement
 *
 * X1 maze consumable-tile knobs (arrange / run; need a maze quota):
 *   --consumable-tiles N    per-maze-region cross-game consumable tiles
 *                           (byte-inert default 0). The foreign pool is the
 *                           union of the OTHER quota'd substrates' registry
 *                           sharing.items declarations; an empty pool places
 *                           nothing. These tiles are NOT AP locations and are
 *                           invisible to winnability logic (D10/D5).
 *   --consumable-count N    grant count per consumable tile (default 1)
 *   --mana-tiles N          per-maze-region mana-refill tiles (default 0)
 *   --mana-tile-amount N    mana per refill tile (default 0; a tile is only
 *                           placed when this is > 0)
 *
 * I/O flags (all subcommands):
 *   -i, --input <envelope.json>   prior step's envelope
 *   -o, --out <envelope.json>     where to write the resulting envelope ('-' = stdout)
 *   --rules-out <rules.json>      (compile / run) also write the bare rules.json
 *   --from <step>                 (run) resume from this step
 *   --to <step>                   (run) stop after this step (default compile)
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Side-effect: register the spiral-capable substrates.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrate/textAdventureSubstrateLibrary.js';
import '../../frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import '../../frontend/modules/runnerDemo/runnerDemoLibrary.js';
import '../../frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import { generateJtaDataset } from '../../frontend/modules/jtaSubstrateWrapper/generateDataset.js';
import { generateOmsiAwardSchedule } from '../../frontend/modules/omsiSubstrateWrapper/generateAwardSchedule.js';
import {
    SPIRAL_STEPS, runSpiralStep, runSpiralToStep, resumeSpiralEnvelope,
    nextSpiralStep, detectSpiralCompleted, newSpiralEnvelope,
    serializeSpiralEnvelope, deserializeSpiralEnvelope,
} from '../../frontend/modules/procgenPipeline/spiralSteps.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Node-only jta dataset generation (the profile/vanilla fixtures aren't
// bundled — stepped-spiral Part 3, decision "generation stays a Node concern").
// Reads the two fixtures off disk and runs the pure generator, returning the
// dataset document the pipeline installs as ② content. Used by the --jta-*
// flags below so `spiral-step run` can mint a jta-dataset world end-to-end.
function generateJtaDatasetFromFixtures({ seed = 1, zones, theme, valueMode, awards }) {
    const profile = JSON.parse(readFileSync(
        resolve(REPO_ROOT, 'CC/scripts/jta-stats/results/vanilla-profile.json'), 'utf8')).static;
    const vanilla = JSON.parse(readFileSync(
        resolve(REPO_ROOT, 'frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json'), 'utf8'));
    const params = {
        ...(zones !== undefined ? { zoneCount: zones } : {}),
        ...(theme !== undefined ? { theme } : {}),
        ...(valueMode !== undefined ? { valueMode } : {}),
        ...(awards !== undefined ? { awards } : {}),
    };
    return generateJtaDataset({ seed, profile, vanilla, params }).dataset;
}

// --- CLI parser ---

function parseArgs(argv) {
    const out = {
        subcommand: null,
        seed: 1,
        region: { width: 8, height: 6 },
        quotas: {},
        start: 'auto',
        items: {},
        obstacles: {},
        bidirectional: true,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        victoryItem: null,
        // X1 maze consumable tiles — byte-inert defaults (all zero).
        consumableTiles: 0,
        consumableCount: 1,
        manaTiles: 0,
        manaTileAmount: 0,
        input: null,
        out: null,
        rulesOut: null,
        from: null,
        to: null,
        // jta ② content dataset config (stepped-spiral Part 3)
        jtaDatasetFile: null,
        jtaGenerate: false,
        jtaDatasetSeed: 1,
        jtaDatasetZones: undefined,
        jtaDatasetTheme: undefined,
        jtaDatasetValueMode: undefined,
        jtaOriginalItemWeight: undefined,
        jtaDummyItemRatio: undefined,
        jtaEmitLocations: false,
        jtaGoalZone: undefined,
        jtaFreeZones: undefined,
        jtaStartingPerks: undefined,
        jtaPerkShuffleSeed: undefined,
    };
    const parseWxH = (s) => {
        const [w, h] = s.split('x').map((n) => parseInt(n, 10));
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error(`expected WxH, got '${s}'`);
        return { width: w, height: h };
    };
    const parseKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected id=N, got '${s}'`);
        return [s.slice(0, i), parseInt(s.slice(i + 1), 10)];
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (i === 0 && !a.startsWith('-')) { out.subcommand = a; continue; }
        switch (a) {
            case '--seed': out.seed = parseInt(next(), 10); break;
            case '--region': out.region = parseWxH(next()); break;
            case '--quota': { const [id, n] = parseKv(next()); out.quotas[id] = n; break; }
            case '--start': out.start = next(); break;
            case '--items': { const [id, n] = parseKv(next()); out.items[id] = n; break; }
            case '--obstacles': { const [id, n] = parseKv(next()); out.obstacles[id] = n; break; }
            case '--no-bidirectional': out.bidirectional = false; break;
            case '--enable-loop-mode': out.enableLoopMode = true; break;
            case '--region-xp-effect': out.regionXpEffect = next(); break;
            case '--victory-item': out.victoryItem = next(); break;
            case '-i': case '--input': out.input = next(); break;
            case '-o': case '--out': out.out = next(); break;
            case '--rules-out': out.rulesOut = next(); break;
            case '--from': out.from = next(); break;
            case '--to': out.to = next(); break;
            case '--jta-dataset-file': out.jtaDatasetFile = next(); break;
            case '--jta-generate': out.jtaGenerate = true; break;
            case '--jta-dataset-seed': out.jtaDatasetSeed = parseInt(next(), 10); break;
            case '--jta-dataset-zones': out.jtaDatasetZones = parseInt(next(), 10); break;
            case '--jta-dataset-theme': out.jtaDatasetTheme = next(); break;
            case '--jta-dataset-value-mode': out.jtaDatasetValueMode = next(); break;
            case '--jta-original-item-weight': out.jtaOriginalItemWeight = parseFloat(next()); break;
            case '--jta-dummy-item-ratio': out.jtaDummyItemRatio = parseFloat(next()); break;
            case '--original-item-weight': out.originalItemWeight = parseFloat(next()); break;
            case '--dummy-item-ratio': out.dummyItemRatio = parseFloat(next()); break;
            case '--consumable-tiles': out.consumableTiles = parseInt(next(), 10); break;
            case '--consumable-count': out.consumableCount = parseInt(next(), 10); break;
            case '--mana-tiles': out.manaTiles = parseInt(next(), 10); break;
            case '--mana-tile-amount': out.manaTileAmount = parseFloat(next()); break;
            case '--jta-emit-locations': out.jtaEmitLocations = true; break;
            case '--jta-goal-zone': out.jtaGoalZone = parseInt(next(), 10); break;
            case '--jta-free-zones': out.jtaFreeZones = parseInt(next(), 10); break;
            case '--jta-starting-perks': out.jtaStartingPerks = parseInt(next(), 10); break;
            case '--jta-perk-shuffle-seed': out.jtaPerkShuffleSeed = parseInt(next(), 10); break;
            case '-h': case '--help':
                process.stdout.write('See the header comment in scripts/procgen/spiral-step.js\n');
                process.exit(0);
                break;
            default: throw new Error(`unknown flag '${a}'`);
        }
    }
    return out;
}

// --- file I/O ---

function readJson(path) {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function writeOut(path, obj, fallbackName) {
    const json = JSON.stringify(obj, null, 2);
    const target = path ?? `./spiral-${fallbackName}.json`;
    if (target === '-') { process.stdout.write(`${json}\n`); return '<stdout>'; }
    const abs = resolve(target);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, json);
    return abs;
}

// The first quota'd substrate declaring a victoryItem on its registry entry —
// mirrors the panel's _resolveVictoryItemId / dump-shuffled-spiral fallback.
function resolveVictory(quotas) {
    return Object.entries(quotas)
        .map(([id, n]) => (n > 0 ? substrateRegistry.get(id)?.victoryItem : null))
        .find(Boolean) ?? null;
}

// Foreign award pool (P2, R3): {substrate, type} for every OTHER substrate
// actually in the mix (quota > 0) that declares sharing.items with a static
// types list. jta is the donor; getTypes-style dynamic declarations (jta's
// own) are not foreign targets here.
function foreignAwardTypes(quotas) {
    const out = [];
    for (const [id, n] of Object.entries(quotas ?? {})) {
        if (!(n > 0) || id === 'jta') continue;
        const types = substrateRegistry.get(id)?.sharing?.items?.types;
        if (Array.isArray(types)) for (const t of types) out.push({ substrate: id, type: t });
    }
    return out;
}

// Resolve the jta ② content config from the --jta-* flags (stepped-spiral
// Part 3), or null when no jta dataset was requested. Either loads a
// pre-generated document (--jta-dataset-file) or generates one from fixtures
// (--jta-generate). The result rides config.growthParams.substrateConfig.jta,
// which ① applySubstrateConfig installs before arrangement.
function buildJtaSubstrateConfig(args) {
    let datasetDoc = null;
    if (args.jtaDatasetFile) {
        datasetDoc = readJson(args.jtaDatasetFile);
    } else if (args.jtaGenerate) {
        // Award-schedule knobs (P2/S3): only built when a knob departs from
        // its byte-inert default; the foreign pool is the co-present
        // substrates' declared item types (R3) drawn from the registry.
        // The knobs are GLOBAL (S3: one pair governs every generator);
        // --jta-* spellings override the global values for jta alone.
        const w = args.jtaOriginalItemWeight ?? args.originalItemWeight;
        const r = args.jtaDummyItemRatio ?? args.dummyItemRatio;
        const awards = (w !== undefined || r !== undefined)
            ? {
                ...(w !== undefined ? { originalItemWeight: w } : {}),
                ...(r !== undefined ? { dummyItemRatio: r } : {}),
                foreignTypes: foreignAwardTypes(args.quotas),
            } : undefined;
        datasetDoc = generateJtaDatasetFromFixtures({
            seed: args.jtaDatasetSeed,
            zones: args.jtaDatasetZones,
            theme: args.jtaDatasetTheme,
            valueMode: args.jtaDatasetValueMode,
            awards,
        });
    } else {
        return null;
    }
    // A goal zone is required to emit a Victory item; default to the deepest
    // dataset zone when emitting locations without an explicit --jta-goal-zone.
    const goalZone = args.jtaGoalZone
        ?? (args.jtaEmitLocations ? datasetDoc.zones.length - 1 : undefined);
    return {
        datasetDoc,
        emitZoneLocations: args.jtaEmitLocations,
        ...(goalZone !== undefined ? { goalZone } : {}),
        ...(args.jtaFreeZones !== undefined ? { freeZones: args.jtaFreeZones } : {}),
        ...(args.jtaStartingPerks !== undefined ? { startingPerks: args.jtaStartingPerks } : {}),
        ...(args.jtaPerkShuffleSeed !== undefined ? { perkShuffleSeed: args.jtaPerkShuffleSeed } : {}),
    };
}

// Resolve the omsi award-schedule config from the GLOBAL knobs (P2-omsi
// slice 5; lootables-only scope ruled 2026-07-19), or null when byte-inert.
// The foreign pool mirrors foreignAwardTypes but must serve omsi: jta's
// types come from the dataset document IN THIS BUILD when one exists
// (dataset worlds rename items — the registry's getTypes only reflects an
// INSTALLED dataset, which happens later, at pipeline ①), falling back to
// the registry declaration (vanilla names).
function buildOmsiSubstrateConfig(args, jtaCfg) {
    if (!(args.quotas.omsi > 0)) return null;
    if (args.originalItemWeight === undefined && args.dummyItemRatio === undefined) return null;
    const foreignTypes = [];
    for (const [id, n] of Object.entries(args.quotas)) {
        if (!(n > 0) || id === 'omsi') continue;
        let types = null;
        if (id === 'jta') {
            const items = jtaCfg?.datasetDoc?.items;
            types = items
                ? items.filter((it) => it && it.behavior == null
                    && typeof it.name === 'string' && it.name.length > 0).map((it) => it.name)
                : substrateRegistry.get('jta')?.sharing?.items?.getTypes?.() ?? null;
        } else {
            const decl = substrateRegistry.get(id)?.sharing?.items;
            types = decl?.types ?? decl?.getTypes?.() ?? null;
        }
        if (Array.isArray(types)) for (const t of types) foreignTypes.push({ substrate: id, type: t });
    }
    const schedule = generateOmsiAwardSchedule({
        seed: args.seed,
        ...(args.originalItemWeight !== undefined ? { originalItemWeight: args.originalItemWeight } : {}),
        ...(args.dummyItemRatio !== undefined ? { dummyItemRatio: args.dummyItemRatio } : {}),
        foreignTypes,
    });
    return schedule ? { awardSchedule: schedule } : null;
}

// Resolve the X1 maze consumable-tile config from the global knobs, or null
// when byte-inert. Same discipline as buildOmsiSubstrateConfig above: the null
// return is what keeps the content pass — and therefore the rng stream and the
// sidecar keys — untouched at defaults.
//
// The foreign pool is the union of every OTHER quota'd substrate's registry
// sharing.items declaration (D2). jta is read from the dataset document in
// THIS build when one exists, for exactly the reason buildOmsiSubstrateConfig
// documents: dataset worlds rename items, and the registry's getTypes only
// reflects an INSTALLED dataset, which happens later at pipeline ①.
function buildConsumableTileConfig(args, jtaCfg) {
    if (!(args.quotas.maze > 0)) return null;
    const consumableCount = Math.max(0, args.consumableTiles | 0);
    const manaCount = Math.max(0, args.manaTiles | 0);
    const manaAmount = Number(args.manaTileAmount) || 0;
    if (consumableCount === 0 && !(manaCount > 0 && manaAmount > 0)) return null;

    const pool = [];
    for (const [id, n] of Object.entries(args.quotas)) {
        if (!(n > 0) || id === 'maze') continue;
        let types = null;
        if (id === 'jta') {
            const items = jtaCfg?.datasetDoc?.items;
            types = items
                ? items.filter((it) => it && it.behavior == null
                    && typeof it.name === 'string' && it.name.length > 0).map((it) => it.name)
                : substrateRegistry.get('jta')?.sharing?.items?.getTypes?.() ?? null;
        } else {
            const decl = substrateRegistry.get(id)?.sharing?.items;
            types = decl?.types ?? decl?.getTypes?.() ?? null;
        }
        if (Array.isArray(types)) {
            for (const t of types) pool.push({ substrate: id, type: t });
        }
    }
    return {
        consumableCount,
        manaCount,
        manaAmount,
        countPerTile: Math.max(1, args.consumableCount | 0),
        pool,
    };
}

// Build a fresh envelope from the world flags (the { config, compileIn } shape
// spiralSteps consumes; config is exactly what arrangeShuffledSpiral takes).
function buildEnv(args) {
    if (Object.keys(args.quotas).length === 0) {
        throw new Error('arrange/run require at least one --quota id=N (or -i <envelope.json>)');
    }
    const jtaCfg = buildJtaSubstrateConfig(args);
    const omsiCfg = buildOmsiSubstrateConfig(args, jtaCfg);
    const consumableTileOpts = buildConsumableTileConfig(args, jtaCfg);
    const config = {
        regionSize: args.region,
        itemPool: { ...args.items },
        obstaclePool: { ...args.obstacles },
        seed: args.seed,
        regionParams: {},
        growthParams: {
            substrateQuotas: args.quotas,
            assumeBidirectional: args.bidirectional,
            ...(args.start && args.start !== 'auto' ? { startSubstrate: args.start } : {}),
            ...(jtaCfg || omsiCfg ? { substrateConfig: {
                ...(jtaCfg ? { jta: jtaCfg } : {}),
                ...(omsiCfg ? { omsi: omsiCfg } : {}),
            } } : {}),
        },
        hazardOpts: null,
        // X1 consumable tiles — null at defaults, so the maze content pass
        // never runs and the spiral stays byte-identical to pre-X1.
        consumableTileOpts,
    };
    const compileIn = {
        seed: args.seed,
        enableLoopMode: args.enableLoopMode,
        regionXpEffect: args.regionXpEffect,
        completionConditionItem: args.victoryItem ?? resolveVictory(args.quotas),
    };
    return newSpiralEnvelope({ config, compileIn });
}

// --- main ---

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const sub = args.subcommand;
    if (!sub) throw new Error(`missing subcommand (one of: ${SPIRAL_STEPS.join(', ')}, run)`);
    const isStep = SPIRAL_STEPS.includes(sub);
    if (!isStep && sub !== 'run') throw new Error(`unknown subcommand '${sub}'`);

    let env;
    if (args.input) {
        env = deserializeSpiralEnvelope(readJson(args.input));
    } else if (sub === 'arrange' || sub === 'run') {
        env = buildEnv(args);
    } else {
        throw new Error(`step '${sub}' requires -i <envelope.json> (or start with 'arrange')`);
    }

    if (sub === 'run') {
        const to = args.to ?? 'compile';
        if (args.from) {
            env.completed = SPIRAL_STEPS.indexOf(args.from) - 1;
            await runSpiralToStep(env, to);
        } else {
            const at = detectSpiralCompleted(env) + 1;
            if (at < SPIRAL_STEPS.length) {
                process.stderr.write(`[spiral-step] auto-resume from ${SPIRAL_STEPS[at]}\n`);
            }
            await resumeSpiralEnvelope(env, to);
        }
    } else {
        await runSpiralStep(sub, env);
    }

    // For `run`, the rules.json (--rules-out) is the primary output; only write
    // the envelope when -o is given. Single-step subcommands always write it.
    if (sub !== 'run' || args.out) {
        const outPath = writeOut(args.out, serializeSpiralEnvelope(env), sub);
        process.stderr.write(`[spiral-step] ${sub} → completed=${env.completed} → ${outPath}\n`);
    } else {
        process.stderr.write(`[spiral-step] ${sub} → completed=${env.completed}\n`);
    }
    if (isStep && sub !== 'compile') {
        const n = nextSpiralStep(env);
        if (n) process.stderr.write(`[spiral-step] next: ${n}\n`);
    }

    if (env.compile) {
        const { rulesJson } = env.compile;
        if (args.rulesOut) {
            const abs = writeOut(args.rulesOut, rulesJson, 'rules');
            process.stderr.write(`[spiral-step] rules.json → ${abs}\n`);
        }
        const regions = Object.keys(rulesJson.regions?.['1'] ?? {}).length;
        process.stderr.write(`[spiral-step] driver ${rulesJson.procgen_metadata?.driver} · ${regions} regions\n`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        process.stderr.write(`[spiral-step] ERROR: ${e.message}\n`);
        process.exit(1);
    });
    // The engine's module graph leaves an unref'd worker/timer handle alive; the
    // work is synchronous above, so exit explicitly once main resolves.
    process.on('beforeExit', () => process.exit(0));
}
