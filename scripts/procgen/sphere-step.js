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
 *   node scripts/procgen/sphere-step.js compile  -i s3.json  -o env.json --rules-out rules.json
 *   # a contiguous range in one process (world flags as for `plan`):
 *   node scripts/procgen/sphere-step.js run --from plan --to compile ...args -o env.json
 *   # auto-resume a partial / hand-edited envelope from its first missing step:
 *   node scripts/procgen/sphere-step.js run -i partial.json -o env.json
 *   # replay recorded layout edits whose stage already ran:
 *   node scripts/procgen/sphere-step.js run -i s3.json --from regions -o env.json
 *   # append a sphere to a FINISHED envelope (or a bare rules.json):
 *   node scripts/procgen/sphere-step.js append -i done.json --items gem=1 \
 *        -o appended.json --rules-out rules.json
 *   World flags (`plan` / `run` from scratch; later steps read the config from -i):
 *     --seed N                    rng seed (default 1)
 *     --region WxH                region tile size (default 8x6)
 *     --items id=N                item pool entry, repeatable (default: four keys + victory;
 *                                 for `append`, the NEW sphere's content)
 *     --spheres N                 sphere count (default 3)
 *     --victory id                goal item (default: a victory item from the pool)
 *     --quota id=N                per-substrate region quota, repeatable
 *     --start id                  start substrate
 *     --max-items-per-region N    (default 2)
 *     --fillers N                 filler regions, no items (default 0)
 *     --revisit P                 revisit ratio for attachments (default 0.25)
 *     --spheres-per-batch N       grow sphere-major in batches of N (default: all at once)
 *     --no-arrow-entry            skip bounce's free-arrow prep
 *     --fall-behavior B           bounce bounceFallBehavior (default: substrate default)
 *     --physics-profile P         bounce bouncePhysicsProfile (default: substrate default)
 *     --param key=value           any substrate procgen param, repeatable (numbers coerced)
 *     --enable-loop-mode          embed loop_costs in the rules.json
 *     --region-xp-effect E        loop-mode xp effect: cost (default) | speed | both | none
 *     --truncate-to-wave K        `append` only: keep K leading waves before regrowing
 *   I/O flags (all subcommands):
 *     -i, --input PATH            prior envelope JSON (required except for `plan`/`run`)
 *     -o, --out PATH              next envelope JSON (default ./sphere-<step>.json; `-` = stdout)
 *     --params PATH               JSON object merged over the envelope's config
 *     --rules-out PATH            `compile`/`run`/`append`: also write the bare rules.json
 *     --from STEP                 `run`: start at this step (default: auto-resume)
 *     --to STEP                   `run`: stop after this step (default compile)
 *     --json-status PATH          write the run's status object (`-` = stdout); see cliRun.js
 *     -h, --help                  print this and exit
 *
 * Recorded layout edits (envelope `edits[]`, see layoutEdits.js) replay after
 * the step each one addresses — layout ops and re-roll after `regions`,
 * set-substrate after `items`. An edit hand-added to an envelope whose stage
 * has ALREADY run does nothing until that step runs again; the run names any
 * edit it is skipping, so the no-op is never silent.
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
 * World flags build the resolved config (via the shared substrate hooks, like
 * the panel) carried in the envelope. `compile` exits 2 if the sphere
 * oracle reports a mismatch.
 * Exit codes (cliRun.js): 0 ok · 1 usage · 2 oracle mismatch · 3 input
 * rejected · 4 internal.
 *
 * The envelope is self-contained (it embeds the resolved item library), so a
 * step can run in its own process without re-deriving world state. The grown
 * Grid and rng cross the boundary losslessly (see sphereSteps.js). The grid
 * is stored in a structural (tagged) form — NOT a hand-editing surface; edit
 * the pipeline at steps ①–②c, or a grown region via the in-app editor.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { argvHelp } from './argvHelp.js';
import { KIND, W, flag, parseFlags } from './cliFlags.js';
import { runCli, UsageError, parseOrUsage, readInputJson } from './cliRun.js';

// Substrate libraries (procgenCore/substrateLibraries.js) — loaded by main, not on import.
import { checkSubstrateIds, loadPipelineSubstrates } from './registerPipelineSubstrates.js';

import {
    SPHERE_STEPS, runStep, runToStep, resumeEnvelope, detectCompleted, sphereEditsBehind,
    nextSphereStep, resolveSpheresPerBatch, appendSphere,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
} from '../../frontend/modules/procgenPipeline/sphereSteps.js';
import { DEFAULT_ITEMS } from '../../frontend/modules/shared/procgen/library.js';
import { rebuildEnvelopeFromRulesJson } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import {
    defaultProcgenParams, activeSubstrateIds,
    collectSphereGrowthPrep, assembleRegionParams,
    mergeSubstrateItemLib, resolveSphereGoal,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

argvHelp(import.meta.url);

// --- CLI parser ---

/** ⛓ The flags this driver takes (cliFlags.js parses them). */
const FLAGS = {
    '--seed': W.seed,
    '--region': W.region,
    '--items': W.items,
    '--spheres': W.spheres,
    '--victory': W.victory,
    '--quota': W.quota,
    '--start': W.start,
    '--max-items-per-region': W.maxItemsPerRegion,
    '--fillers': W.fillers,
    '--revisit': W.revisit,
    '--spheres-per-batch': flag('spheresPerBatch', KIND.int),
    '--truncate-to-wave': flag('truncateToWave', KIND.int),
    '--no-arrow-entry': W.noArrowEntry,
    '--fall-behavior': W.fallBehavior,
    '--physics-profile': W.physicsProfile,
    '--param': W.param,
    '--enable-loop-mode': W.enableLoopMode,
    '--region-xp-effect': W.regionXpEffect,
    '-i': W.input,
    '--input': W.input,
    '-o': W.out,
    '--out': W.out,
    '--params': flag('paramsFile', KIND.str),
    '--rules-out': W.rulesOut,
    '--from': W.from,
    '--to': W.to,
    '--json-status': W.jsonStatus,
    '-h': W.help,
};

function parseArgs(argv) {
    const out = parseFlags(argv, FLAGS, {
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
        // `--params PATH` (a JSON file). Its own key: it once shared `params`
        // with the `--param k=v` map above, so the later literal key nulled the
        // map and every `--param` threw "Cannot set properties of null".
        paramsFile: null,
        rulesOut: null,
        from: null,
        to: null,
    }, { subcommand: true, metaUrl: import.meta.url });
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
    // One goal item (`Victory`): the pool's victory items fold into it, and the
    // library gains its row.
    const goal = resolveSphereGoal({
        explicit: args.victory, itemPool: args.items,
        itemLib: mergeSubstrateItemLib(DEFAULT_ITEMS, selectedSubs), selectedIds: selectedSubs,
    });
    const { itemLib } = goal;
    const victory = goal.goalItem;

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
    const itemPool = { ...goal.itemPool };
    const prep = args.arrowEntry
        ? collectSphereGrowthPrep({
            activeIds, itemPool, quotas: args.quotas,
            startSubstrate: args.start, seed: args.seed, params,
        })
        : {
            startingItems: [], pinnedCanonicalItems: [],
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
        pinnedCanonicalItems: prep.pinnedCanonicalItems,
        enableLoopMode: args.enableLoopMode,
        regionXpEffect: args.regionXpEffect,
        spheresPerBatch: args.spheresPerBatch,
        itemPool,
    };
}

// --- file I/O ---

function readJson(path, what) {
    return readInputJson(path, what);
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

// Recorded layout edits (layoutEdits.js) replay after the step each one
// addresses. Say so — and name the ones this run's START POINT is already past,
// because those will NOT fire (the step that replays them is not going to run).
// Re-run with --from <stage> to apply them.
function announceEdits(env, firstStep) {
    if (!env.edits?.length) return;
    process.stderr.write(`[sphere-step] ${env.edits.length} recorded edit`
        + `${env.edits.length === 1 ? '' : 's'} on the envelope\n`);
    for (const e of sphereEditsBehind(env, firstStep)) {
        process.stderr.write(`[sphere-step] \u26a0 '${e.op}' is staged before ${firstStep}`
            + ' — NOT replayed on this run (re-run with --from <its stage>)\n');
    }
}

// --- main ---

async function main(status) {
    const args = parseOrUsage(() => parseArgs(process.argv.slice(2)));
    const sub = args.subcommand;
    status.subcommand = sub;
    if (!sub) throw new UsageError('missing subcommand (one of: '
        + `${SPHERE_STEPS.join(', ')}, run, append)`);

    const isStep = SPHERE_STEPS.includes(sub);
    if (!isStep && sub !== 'run' && sub !== 'append') {
        throw new UsageError(`unknown subcommand '${sub}'`);
    }
    await loadPipelineSubstrates();
    checkSubstrateIds(args, { layout: 'sphere', tool: 'sphere-step', counts: { quotas: '--quota' }, start: 'start' });

    // Load or create the envelope. `append` accepts EITHER a saved envelope or a
    // bare finished rules.json (reconstructed via its embedded sphere_tree —
    // procedural substrates only; zone substrates must use a saved envelope).
    let env;
    if (sub === 'append') {
        if (!args.input) throw new UsageError('append requires -i <rules.json | envelope.json>');
        const raw = readJson(args.input, '-i');
        env = raw.procgen_metadata?.['1']
            ? rebuildEnvelopeFromRulesJson(raw, {
                ...(Object.keys(args.quotas).length ? { substrateQuotas: args.quotas } : {}),
                maxItemsPerRegion: args.maxItemsPerRegion,
            })
            : deserializeEnvelope(raw);
    } else if (args.input) {
        env = deserializeEnvelope(readJson(args.input, '-i'));
    } else if (sub === 'plan' || sub === 'run') {
        env = newEnvelope(buildConfig(args));
    } else {
        throw new UsageError(`step '${sub}' requires -i <envelope.json> (or start with 'plan')`);
    }
    // --params overrides the carried config knobs.
    if (args.paramsFile) Object.assign(env.config, readJson(args.paramsFile, '--params'));

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
            announceEdits(env, args.from);
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
            announceEdits(env, SPHERE_STEPS[Math.min(at, SPHERE_STEPS.length - 1)]);
            await resumeEnvelope(env, to, { onProgress });
        }
    } else {
        await runStep(sub, env, { onProgress });
    }

    const outPath = writeOut(args.out, serializeEnvelope(env), sub);
    process.stderr.write(`[sphere-step] ${sub} → completed=${env.completed} → ${outPath}\n`);
    status.outputs.envelope = outPath;
    status.completed = SPHERE_STEPS[env.completed] ?? null;
    status.next = nextSphereStep(env) ?? null;
    status.summary.seed = env.config?.seed ?? null;

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
            status.outputs.rules = abs;
        }
        status.summary.driver = rulesJson.procgen_metadata?.['1']?.driver ?? null;
        status.summary.regions = Object.keys(rulesJson.regions?.['1'] ?? {}).length;
        status.oracle = { checked: true, errors: oracleErrors };
        if (oracleErrors.length > 0) {
            // ⛓ exit 2 (oracle mismatch), set by runCli from status.oracle.errors.
            process.stderr.write('SPHERE ORACLE FAILED:\n');
            for (const e of oracleErrors) process.stderr.write(`  ${e}\n`);
            return;
        }
        process.stderr.write('[sphere-step] oracle OK\n');
    }
}

runCli('sphere-step', import.meta.url, main);
