#!/usr/bin/env node
/**
 * Headless per-step driver for the stepped sphere-growth pipeline. Runs ONE
 * step (or a range) of plan → allocate → topology → items → regions →
 * compile, reading the prior step's "envelope" JSON and writing the next.
 * Edit the envelope JSON between invocations to author each step by hand.
 * Shares the step wiring with the Procgen Pipeline panel via sphereSteps.js.
 *
 * Usage:
 *   node scripts/procgen/sphere-step.js plan     --seed 1 --items key_red=1 ... -o s1.json
 *   node scripts/procgen/sphere-step.js allocate -i s1.json  -o s2a.json
 *   node scripts/procgen/sphere-step.js topology -i s2a.json -o s2b.json
 *   node scripts/procgen/sphere-step.js items    -i s2b.json -o s2c.json
 *   node scripts/procgen/sphere-step.js regions  -i s2c.json -o s3.json
 *   node scripts/procgen/sphere-step.js compile  -i s3.json  -o rules.json
 *
 *   # run a contiguous range in one process:
 *   node scripts/procgen/sphere-step.js run --from plan --to compile ...args -o rules.json
 *
 * Step subcommands:
 *   plan accepts the same world flags as dump-sphere-growth.js (--seed,
 *   --items, --spheres, --victory, --quota, --start, --region, --fillers,
 *   --revisit, --max-items-per-region, --physics-profile, --fall-behavior,
 *   --enable-loop-mode, --region-xp-effect, --no-arrow-entry). Those flags
 *   build the resolved config carried in the envelope; later steps read the
 *   config from -i and don't re-parse world flags.
 *
 * I/O flags (all subcommands):
 *   -i, --input PATH     prior envelope JSON (required except for `plan`/`run`)
 *   -o, --out PATH       next envelope JSON (default ./sphere-<step>.json; `-`=stdout)
 *   --params PATH        JSON object merged over the envelope's config (override knobs)
 *   --rules-out PATH     `compile`/`run`: additionally write the bare rules.json
 *
 * `compile` exits non-zero if the sphere oracle reports a mismatch.
 *
 * The envelope is self-contained (it embeds the resolved item library), so a
 * step can run in its own process without re-deriving world state. The grown
 * Grid and rng cross the boundary losslessly (see sphereSteps.js). The grid
 * is stored in a structural (tagged) form — NOT a hand-editing surface; edit
 * the pipeline at steps ①–②c, or a grown region via the in-app editor.
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Substrate libraries register their adapters on import.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrate/textAdventureSubstrateLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';

import {
    SPHERE_STEPS, runStep, runToStep,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
} from '../../frontend/modules/procgenPipeline/sphereSteps.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import { createRng } from '../../frontend/modules/shared/rng.js';

// --- CLI parser ---

function parseArgs(argv) {
    const out = {
        subcommand: null,
        // world flags (used by `plan` / `run`)
        seed: 1,
        region: { width: 8, height: 6 },
        items: {},
        spheres: 3,
        victory: null,
        quotas: {},
        start: null,
        maxItemsPerRegion: 2,
        fillers: 0,
        revisit: 0.25,
        arrowEntry: true,
        fallBehavior: 'current',
        physicsProfile: 'experimental',
        enableLoopMode: false,
        regionXpEffect: 'cost',
        // I/O flags
        input: null,
        out: null,
        params: null,
        rulesOut: null,
        from: null,
        to: null,
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
            case '--items': { const [id, n] = parseKv(next()); out.items[id] = n; break; }
            case '--spheres': out.spheres = parseInt(next(), 10); break;
            case '--victory': out.victory = next(); break;
            case '--quota': { const [id, n] = parseKv(next()); out.quotas[id] = n; break; }
            case '--start': out.start = next(); break;
            case '--max-items-per-region': out.maxItemsPerRegion = parseInt(next(), 10); break;
            case '--fillers': out.fillers = parseInt(next(), 10); break;
            case '--revisit': out.revisit = parseFloat(next()); break;
            case '--no-arrow-entry': out.arrowEntry = false; break;
            case '--fall-behavior': out.fallBehavior = next(); break;
            case '--physics-profile': out.physicsProfile = next(); break;
            case '--enable-loop-mode': out.enableLoopMode = true; break;
            case '--region-xp-effect': out.regionXpEffect = next(); break;
            case '-i': case '--input': out.input = next(); break;
            case '-o': case '--out': out.out = next(); break;
            case '--params': out.params = next(); break;
            case '--rules-out': out.rulesOut = next(); break;
            case '--from': out.from = next(); break;
            case '--to': out.to = next(); break;
            case '-h': case '--help':
                console.log('See the docblock in scripts/procgen/sphere-step.js');
                process.exit(0);
                break;
            default: throw new Error(`unknown flag: ${a}`);
        }
    }
    if (Object.keys(out.items).length === 0) {
        out.items = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };
    }
    return out;
}

// Args → the resolved, serialisable config block sphereSteps consumes.
// Mirrors dump-sphere-growth.js's prep (item-lib merge, victory resolution,
// bounce arrow entry → starting item / exclusive sphere 1).
function buildConfig(args) {
    const selectedSubs = new Set(Object.keys(args.quotas));
    if (args.start) selectedSubs.add(args.start);
    const itemLib = { ...DEFAULT_ITEMS };
    for (const id of selectedSubs) {
        const extra = substrateRegistry.get(id)?.libraryItems;
        if (extra) Object.assign(itemLib, extra);
    }

    let victory = args.victory;
    if (!victory) victory = Object.keys(args.items).find((id) => itemLib[id]?.is_victory) ?? null;
    if (!victory) {
        for (const id of selectedSubs) {
            const vi = substrateRegistry.get(id)?.victoryItem;
            if (vi) { victory = vi; break; }
        }
    }

    const itemPool = { ...args.items };
    const quotaIds = Object.keys(args.quotas);
    const bounceSelected = (args.quotas.bounce ?? 0) > 0 || args.start === 'bounce';
    const bounceStarts = args.start === 'bounce'
        || (args.start == null && bounceSelected
            && quotaIds.length > 0 && quotaIds.every((id) => id === 'bounce'));
    const exclusiveSpheres = {};
    const startingItems = [];
    const lockedCanonicalItems = [];
    if (args.arrowEntry && bounceSelected) {
        const arrows = ['Left arrow', 'Right arrow'].filter((a) => (itemPool[a] ?? 0) > 0);
        if (arrows.length > 0) {
            const pick = arrows[Math.floor(
                createRng((args.seed * 31 + 17) | 0).next() * arrows.length)];
            if (bounceStarts) {
                exclusiveSpheres[1] = [pick];
                lockedCanonicalItems.push(pick);
            } else {
                startingItems.push(pick);
                itemPool[pick] -= 1;
                if (itemPool[pick] <= 0) delete itemPool[pick];
            }
        }
    }

    return {
        seed: args.seed,
        regionSize: args.region,
        itemLib,
        regionParams: { fallBehavior: args.fallBehavior, physicsProfile: args.physicsProfile },
        hazardOpts: undefined,
        maxItemsPerRegion: args.maxItemsPerRegion,
        fillerCount: args.fillers,
        revisitRatio: args.revisit,
        ...(quotaIds.length > 0 ? { substrateQuotas: args.quotas } : { substrateQuotas: null }),
        startSubstrate: args.start,
        sphereCount: args.spheres,
        victoryItem: victory,
        exclusiveSpheres,
        startingItems,
        lockedCanonicalItems,
        enableLoopMode: args.enableLoopMode,
        regionXpEffect: args.regionXpEffect,
        itemPool,
    };
}

// --- file I/O ---

function readJson(path) {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function writeOut(path, obj, fallbackName) {
    const json = JSON.stringify(obj, null, 2);
    const target = path ?? `./sphere-${fallbackName}.json`;
    if (target === '-') { process.stdout.write(`${json}\n`); return '<stdout>'; }
    const abs = resolve(target);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, json);
    return abs;
}

// --- main ---

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const sub = args.subcommand;
    if (!sub) throw new Error('missing subcommand (one of: '
        + `${SPHERE_STEPS.join(', ')}, run)`);

    const isStep = SPHERE_STEPS.includes(sub);
    if (!isStep && sub !== 'run') throw new Error(`unknown subcommand '${sub}'`);

    // Load or create the envelope.
    let env;
    if (args.input) {
        env = deserializeEnvelope(readJson(args.input));
    } else if (sub === 'plan' || sub === 'run') {
        env = newEnvelope(buildConfig(args));
    } else {
        throw new Error(`step '${sub}' requires -i <envelope.json> (or start with 'plan')`);
    }
    // --params overrides the carried config knobs.
    if (args.params) Object.assign(env.config, readJson(args.params));

    const onProgress = (ev) => {
        if (ev?.type) process.stderr.write(`  · ${ev.type}\n`);
    };

    if (sub === 'run') {
        if (args.from) env.completed = SPHERE_STEPS.indexOf(args.from) - 1;
        await runToStep(env, args.to ?? 'compile', { onProgress });
    } else {
        await runStep(sub, env, { onProgress });
    }

    const outPath = writeOut(args.out, serializeEnvelope(env), sub);
    process.stderr.write(`[sphere-step] ${sub} → completed=${env.completed} → ${outPath}\n`);

    // Compile / run-to-compile: surface the oracle + optional bare rules.json.
    if (env.compile) {
        const { rulesJson, oracleErrors } = env.compile;
        if (args.rulesOut) {
            const abs = writeOut(args.rulesOut, rulesJson, 'rules');
            process.stderr.write(`[sphere-step] rules.json → ${abs}\n`);
        }
        if (oracleErrors.length > 0) {
            process.stderr.write('SPHERE ORACLE FAILED:\n');
            for (const e of oracleErrors) process.stderr.write(`  ${e}\n`);
            process.exit(1);
        }
        process.stderr.write('[sphere-step] oracle OK\n');
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().then(() => process.exit(0)).catch((e) => {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    });
}
