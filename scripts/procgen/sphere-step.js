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
 *   # auto-resume a partial / hand-edited envelope (no --from): runs from the
 *   # FIRST step whose output is missing (presence = keep, absence = recompute):
 *   node scripts/procgen/sphere-step.js run -i partial.json -o rules.json
 *
 *   # append a sphere to a FINISHED envelope (grow one wave further + recompile):
 *   #   --items id=N → the new sphere's content; the goal is relocated into it.
 *   #   --truncate-to-wave K → rewind to K leading waves before regrowing.
 *   node scripts/procgen/sphere-step.js append -i done.json --items gem=1 \
 *        -o appended.json --rules-out rules.json
 *
 * Append semantics: a wave gates on the prior sphere, so the goal can only move
 * one tier later when the kept final sphere has a non-goal item. Default: a
 * GOAL-ONLY final sphere is reverted (dropped) and the new sphere takes its
 * place; a multi-item final relocates the goal forward (depth + 1).
 *
 * Sphere-major batches (--spheres-per-batch < sphere count): the pipeline LOOPS
 * the middle four phases per batch — plan → { allocate → topology → items →
 * regions } × batches → compile. `run` drives the whole loop in one process.
 * Stepping by hand, after `regions` the next subcommand is `allocate` again for
 * the next sphere (a no-op that just advances the cursor), then topology/items/
 * regions, until all spheres are built — only THEN run `compile`. Each step
 * prints a `next:` hint with the batch progress so you know whether to loop back
 * or compile. --spheres-per-batch unset / ≥ sphere count = one batch (all
 * spheres), the byte-identical default.
 *
 * Step subcommands:
 *   plan accepts the same world flags as dump-sphere-growth.js (--seed,
 *   --items, --spheres, --victory, --quota, --start, --region, --fillers,
 *   --revisit, --spheres-per-batch, --max-items-per-region, --physics-profile,
 *   --fall-behavior,
 *   --param key=value, --enable-loop-mode, --region-xp-effect,
 *   --no-arrow-entry). Those flags build the resolved config (via the shared
 *   substrate hooks, like the panel) carried in the envelope; later steps read
 *   the config from -i and don't re-parse world flags.
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
import '../../frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import '../../frontend/modules/runnerDemo/runnerDemoLibrary.js';

import {
    SPHERE_STEPS, runStep, runToStep, resumeEnvelope, detectCompleted,
    nextSphereStep, resolveSpheresPerBatch, appendSphere,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
} from '../../frontend/modules/procgenPipeline/sphereSteps.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';
import { rebuildEnvelopeFromRulesJson } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import {
    defaultProcgenParams, activeSubstrateIds,
    collectSphereGrowthPrep, assembleRegionParams,
    mergeSubstrateItemLib, resolveVictoryItem,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

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
        // null = "all spheres in one batch" (byte-identical default). A
        // positive integer < sphere count grows sphere-major in batches —
        // Phase 2; Phase 1 only carries the knob.
        spheresPerBatch: null,
        // `append` only: keep this many leading waves before regrowing
        // (null = auto — revert a goal-only final sphere, else keep all).
        truncateToWave: null,
        arrowEntry: true,
        // null = "not provided" → the substrate's defaultProcgenParams value
        // wins (bounce: physics 'dj', fall 'current'). A flag value overrides.
        fallBehavior: null,
        physicsProfile: null,
        params: {},
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
    const parseStrKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected key=value, got '${s}'`);
        return [s.slice(0, i), s.slice(i + 1)];
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
            case '--spheres-per-batch': out.spheresPerBatch = parseInt(next(), 10); break;
            case '--truncate-to-wave': out.truncateToWave = parseInt(next(), 10); break;
            case '--no-arrow-entry': out.arrowEntry = false; break;
            case '--fall-behavior': out.fallBehavior = next(); break;
            case '--physics-profile': out.physicsProfile = next(); break;
            case '--param': {
                const [k, v] = parseStrKv(next());
                out.params[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
                break;
            }
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
    // Default item pool for world-building subcommands. `append` reads --items
    // as the NEW sphere's content, so an empty list there means "just relocate
    // the goal" — don't inject a default pool.
    if (out.subcommand !== 'append' && Object.keys(out.items).length === 0) {
        out.items = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };
    }
    return out;
}

// Args → the resolved, serialisable config block sphereSteps consumes. Uses
// the shared substrate-hook assembly (sphereConfigHooks) — the SAME path the
// panel's _buildSphereConfig / _collectSphereGrowthPrep / _assembleRegionParams
// take — so the CLI's regionParams match the panel's (the old inline arrow
// block + minimal {fallBehavior, physicsProfile} regionParams diverged).
function buildConfig(args) {
    const selectedSubs = new Set(Object.keys(args.quotas));
    if (args.start) selectedSubs.add(args.start);
    const itemLib = mergeSubstrateItemLib(DEFAULT_ITEMS, selectedSubs);
    const victory = resolveVictoryItem({
        explicit: args.victory, itemPool: args.items, itemLib, selectedIds: selectedSubs,
    });

    // Substrate params: merged defaultProcgenParams overlaid with explicit CLI
    // flags (and --param). The bounce hooks read the bounce*-prefixed keys.
    const params = defaultProcgenParams({});
    if (args.physicsProfile != null) params.bouncePhysicsProfile = args.physicsProfile;
    if (args.fallBehavior != null) params.bounceFallBehavior = args.fallBehavior;
    Object.assign(params, args.params);

    // Pre-plan prep (bounce's free arrow → starting item + pool delta +
    // bounceFreeArrow regionParam) + the full braid regionParams. --no-arrow-
    // entry skips ONLY the prep; regionParams still carry the braid layout.
    const activeIds = activeSubstrateIds(args.quotas, args.start);
    const itemPool = { ...args.items };
    const prep = args.arrowEntry
        ? collectSphereGrowthPrep({
            activeIds, itemPool, quotas: args.quotas,
            startSubstrate: args.start, seed: args.seed, params,
        })
        : {
            startingItems: [], lockedCanonicalItems: [],
            exclusiveSpheres: {}, regionParams: {}, note: '',
        };
    const regionParams = assembleRegionParams({
        activeIds, mode: 'sphere', params, extra: prep.regionParams,
    });

    const quotaIds = Object.keys(args.quotas);
    return {
        seed: args.seed,
        regionSize: args.region,
        itemLib,
        regionParams,
        hazardOpts: undefined,
        maxItemsPerRegion: args.maxItemsPerRegion,
        fillerCount: args.fillers,
        revisitRatio: args.revisit,
        ...(quotaIds.length > 0 ? { substrateQuotas: args.quotas } : { substrateQuotas: null }),
        startSubstrate: args.start,
        sphereCount: args.spheres,
        victoryItem: victory,
        exclusiveSpheres: prep.exclusiveSpheres,
        startingItems: prep.startingItems,
        lockedCanonicalItems: prep.lockedCanonicalItems,
        enableLoopMode: args.enableLoopMode,
        regionXpEffect: args.regionXpEffect,
        spheresPerBatch: args.spheresPerBatch,
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
        + `${SPHERE_STEPS.join(', ')}, run, append)`);

    const isStep = SPHERE_STEPS.includes(sub);
    if (!isStep && sub !== 'run' && sub !== 'append') {
        throw new Error(`unknown subcommand '${sub}'`);
    }

    // Load or create the envelope. `append` accepts EITHER a saved envelope or a
    // bare finished rules.json (reconstructed via its embedded sphere_tree —
    // procedural substrates only; zone substrates must use a saved envelope).
    let env;
    if (sub === 'append') {
        if (!args.input) throw new Error('append requires -i <rules.json | envelope.json>');
        const raw = readJson(args.input);
        env = raw.procgen_metadata
            ? rebuildEnvelopeFromRulesJson(raw, {
                ...(Object.keys(args.quotas).length ? { substrateQuotas: args.quotas } : {}),
                maxItemsPerRegion: args.maxItemsPerRegion,
            })
            : deserializeEnvelope(raw);
    } else if (args.input) {
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

    if (sub === 'append') {
        // Grow a FINISHED world one sphere further. --items id=N → the new
        // sphere's content (id repeated N times); the goal is relocated into it.
        // --truncate-to-wave rewinds to an earlier sphere before regrowing.
        const newItems = [];
        for (const [id, n] of Object.entries(args.items)) {
            for (let i = 0; i < n; i++) newItems.push(id);
        }
        await appendSphere(env, {
            items: newItems,
            truncateToWave: args.truncateToWave,
            seed: args.seed,
        }, { onProgress });
    } else if (sub === 'run') {
        const to = args.to ?? 'compile';
        if (args.from) {
            // Explicit override: resume from the named step.
            env.completed = SPHERE_STEPS.indexOf(args.from) - 1;
            await runToStep(env, to, { onProgress });
        } else {
            // Auto-detect the resume point from which step outputs are
            // present (parity with the panel's Load-envelope behavior) —
            // a partial / hand-edited envelope resumes from the first step
            // whose output is missing. presence = keep, absence = recompute.
            const at = detectCompleted(env) + 1;
            if (at < SPHERE_STEPS.length) {
                process.stderr.write(`[sphere-step] auto-resume from ${SPHERE_STEPS[at]}\n`);
            }
            await resumeEnvelope(env, to, { onProgress });
        }
    } else {
        await runStep(sub, env, { onProgress });
    }

    const outPath = writeOut(args.out, serializeEnvelope(env), sub);
    process.stderr.write(`[sphere-step] ${sub} → completed=${env.completed} → ${outPath}\n`);

    // Sphere-major hint: when batch < all the pipeline LOOPS the middle four
    // phases per batch, so after ③ the next per-step invocation is ②a again
    // (not ④). Surface nextSphereStep + the batch progress so a hand-stepping
    // user knows to loop back rather than jump to compile. (`run` already loops
    // internally, so only the single-step subcommands need the nudge.)
    if (isStep && sub !== 'compile') {
        const next = nextSphereStep(env);
        const total = env.plan?.spheres?.length ?? 0;
        const batch = total ? resolveSpheresPerBatch(env.config?.spheresPerBatch, total) : total;
        if (next && batch < total) {
            const built = env.grow?.grid ? (env.batchStart ?? 0) : 0;
            process.stderr.write(`[sphere-step] next: ${next} `
                + `(sphere-major batch ${batch}: ${built}/${total} spheres built)\n`);
        } else if (next) {
            process.stderr.write(`[sphere-step] next: ${next}\n`);
        }
    }

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
