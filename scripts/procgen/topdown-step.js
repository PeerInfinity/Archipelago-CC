#!/usr/bin/env node
/**
 * Headless per-step driver for the stepped TOP-DOWN pipeline. Runs ONE step (or
 * a range) of layout → realise → finalize → compile, reading the prior step's
 * "envelope" JSON and writing the next. Edit the envelope JSON between
 * invocations to author each step by hand (e.g. after `layout`, edit
 * layout.substrateByRegion["<region>"] to pin that region's substrate, then
 * re-run from `realise` — ② re-realises only that region). Shares the step wiring
 * with the Procgen Pipeline panel via topDownSteps.js.
 *
 * Usage:
 *   # start from a source rules.json (layout builds the envelope):
 *   node scripts/procgen/topdown-step.js layout   --source world_rules.json \
 *        --seed 1 --grid 6x6 --region 6x6 --mix maze=1 -o t1.json
 *   node scripts/procgen/topdown-step.js realise  -i t1.json -o t2.json
 *   node scripts/procgen/topdown-step.js finalize -i t2.json -o t3.json
 *   node scripts/procgen/topdown-step.js compile  -i t3.json -o t4.json --rules-out rules.json
 *   # run a range (or the whole pipeline) in one process:
 *   node scripts/procgen/topdown-step.js run --source world_rules.json \
 *        --mix maze=1 --rules-out rules.json
 *   # re-run from a step after hand-editing the envelope (e.g. substrate pins):
 *   node scripts/procgen/topdown-step.js run -i t1.json --from realise --rules-out rules.json
 *   # auto-resume a partial / hand-edited envelope (no --from): runs from the
 *   # FIRST step whose output is missing (presence = keep, absence = recompute):
 *   node scripts/procgen/topdown-step.js run -i partial.json --rules-out rules.json
 *   # RECORDED LAYOUT EDITS (envelope `edits[]`, see layoutEdits.js) replay
 *   # after the step each one addresses — layout ops after `finalize`, re-roll
 *   # and set-substrate after `layout`. An edit hand-added to an envelope whose
 *   # stage has ALREADY run does nothing until that step runs again, so:
 *   node scripts/procgen/topdown-step.js run -i t1.json --from layout --rules-out rules.json
 *   # (the run names any edit it is skipping, so the no-op is never silent).
 * World flags (layout / run when starting from --source):
 *   --source <rules.json>   source world to realise (required to start)
 *   --seed N                rng seed (default 1)
 *   --grid WxH              grid cell dimensions (default 12x12; auto-fits source)
 *   --region WxH            per-region tile size (default 6x6)
 *   --mix id=weight         substrate mix (repeatable; default maze=1)
 *   --param key=value       substrate param (repeatable; numbers parsed)
 *   --physics-profile P     bounce physics profile (classic|experimental|dj)
 *   --fall-behavior B       bounce fall behavior
 *   --sphere-log <file>     authoritative sphere log (.json array or .jsonl) →
 *                           driver 'top-down-sphere' + sphere_tree/_plan
 *   --enable-loop-mode      compute loop_costs in the rules.json
 *   --region-xp-effect E    loop-mode xp effect (default cost)
 *   --discovery-mode M      follow (default: discovery follows loop mode) | on | off
 * I/O flags (all subcommands):
 *   -i, --input <envelope.json>   prior step's envelope
 *   -o, --out <envelope.json>     where to write the resulting envelope ('-' = stdout)
 *   --rules-out <rules.json>      (compile / run) also write the bare rules.json
 *   --from <step>                 (run) resume from this step
 *   --to <step>                   (run) stop after this step (default compile)
 *   --config PATH                 read flags from a JSON object (the keys a dump
 *                                 echoes as `config`; flags given here win; exit 3
 *                                 if it fails the schema); see cliFlags.js
 *   --config-schema               print that JSON Schema and exit
 *   --json-status PATH            write the run's status object (`-` = stdout); see cliRun.js
 *   -h, --help                    print this and exit
 *
 * Exit codes (cliRun.js): 0 ok · 1 usage · 2 oracle mismatch · 3 input
 * rejected · 4 internal.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { argvHelp } from './argvHelp.js';
import { KIND, W, flag, parseFlags } from './cliFlags.js';
import { runCli, UsageError, InputError, parseOrUsage, readInputJson } from './cliRun.js';

// Substrate libraries (procgenCore/substrateLibraries.js) — loaded by main, not on import.
import { checkSubstrateIds, loadPipelineSubstrates } from './registerPipelineSubstrates.js';
import {
    TOPDOWN_STEPS, runTopDownStep, runTopDownToStep, resumeTDEnvelope,
    nextTopDownStep, detectTDCompleted, buildTopDownEnvelope, tdEditsBehind,
    serializeTDEnvelope, deserializeTDEnvelope,
} from '../../frontend/modules/procgenPipeline/topDownSteps.js';
import {
    defaultProcgenParams, assembleRegionParams,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

argvHelp(import.meta.url);

// --- CLI parser ---

/** ⛓ The flags this driver takes (cliFlags.js parses them). */
const FLAGS = {
    '--source': flag('source', KIND.str),
    '--seed': W.seed,
    '--grid': W.grid,
    '--region': W.region,
    '--mix': W.mixWeights,
    '--param': W.param,
    '--physics-profile': W.physicsProfile,
    '--fall-behavior': W.fallBehavior,
    '--sphere-log': flag('sphereLog', KIND.str),
    '--enable-loop-mode': W.enableLoopMode,
    '--region-xp-effect': W.regionXpEffect,
    '--discovery-mode': W.discoveryMode,
    '-i': W.input,
    '--input': W.input,
    '-o': W.out,
    '--out': W.out,
    '--rules-out': W.rulesOut,
    '--from': W.from,
    '--to': W.to,
    '--config': W.config,
    '--config-schema': W.configSchema,
    '--json-status': W.jsonStatus,
    '-h': W.help,
};

function parseArgs(argv, { configDoc = null } = {}) {
    const out = parseFlags(argv, FLAGS, {
        subcommand: null,
        source: null,
        seed: 1,
        grid: { width: 12, height: 12 },
        region: { width: 6, height: 6 },
        mix: {},
        params: {},
        physicsProfile: null,
        fallBehavior: null,
        sphereLog: null,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        input: null,
        out: null,
        rulesOut: null,
        from: null,
        to: null,
    }, { subcommand: true, metaUrl: import.meta.url, configDoc });
    if (Object.keys(out.mix).length === 0) out.mix = { maze: 1 };
    return out;
}

// --- file I/O ---

function readJson(path, what) {
    return readInputJson(path, what);
}

// Sphere log: a JSON array, or JSONL (one entry per line).
function readSphereLog(path) {
    let text;
    try { text = readFileSync(resolve(path), 'utf8').trim(); } catch (e) {
        throw new InputError(`--sphere-log ${path}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`);
    }
    try {
        if (text.startsWith('[')) {
            const j = JSON.parse(text);
            if (Array.isArray(j)) return j;
        }
        return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
    } catch (e) {
        throw new InputError(`--sphere-log ${path}: not a JSON array or JSONL (${e.message})`);
    }
}

function writeOut(path, obj, fallbackName) {
    const json = JSON.stringify(obj, null, 2);
    const target = path ?? `./topdown-${fallbackName}.json`;
    if (target === '-') { process.stdout.write(`${json}\n`); return '<stdout>'; }
    const abs = resolve(target);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, json);
    return abs;
}

// Build a fresh envelope from --source + world flags (mirrors the panel's
// _buildTDEnvelope: substrate params via the shared hooks, mode 'topDown').
function buildEnv(args, { sourceDoc = null } = {}) {
    const source = sourceDoc ?? readJson(args.source, '--source');
    const params = defaultProcgenParams({});
    if (args.physicsProfile != null) params.bouncePhysicsProfile = args.physicsProfile;
    if (args.fallBehavior != null) params.bounceFallBehavior = args.fallBehavior;
    Object.assign(params, args.params);
    const activeIds = Object.entries(args.mix)
        .filter(([, w]) => Number(w) > 0).map(([id]) => id);
    const regionParams = assembleRegionParams({ activeIds, mode: 'topDown', params });
    const sphereLog = args.sphereLog ? readSphereLog(args.sphereLog) : null;
    return buildTopDownEnvelope({
        source,
        seed: args.seed,
        gridDims: args.grid,
        regionSizeBase: args.region,
        substrateMix: args.mix,
        regionParams,
        hazardOpts: null,
        sphereLog,
        enableLoopMode: args.enableLoopMode,
        regionXpEffect: args.regionXpEffect,
        discoveryMode: args.discoveryMode ?? 'follow',
    });
}

// --- main ---

// Recorded layout edits (layoutEdits.js) replay after the step each one
// addresses. Say so — and, crucially, name the ones this run's START POINT
// is already past, because those will NOT fire (the step that replays them
// is not going to run). Re-run with --from <stage> to apply them.
function announceEdits(env, firstStep, log) {
    if (!env.edits?.length) return;
    log(`[topdown-step] ${env.edits.length} recorded edit`
        + `${env.edits.length === 1 ? '' : 's'} on the envelope\n`);
    for (const e of tdEditsBehind(env, firstStep)) {
        log(`[topdown-step] ⚠ '${e.op}' is staged before `
            + `${firstStep} — NOT replayed on this run (re-run with --from <its stage>)\n`);
    }
}

/**
 * The `run` subcommand's body: run `env` to `args.to` (default compile), from
 * `args.from` or, without it, from the first step whose output is missing.
 */
async function runToEnd(env, args, { log, onProgress }) {
    const to = args.to ?? 'compile';
    if (args.from) {
        announceEdits(env, args.from, log);
        env.completed = TOPDOWN_STEPS.indexOf(args.from) - 1;
        await runTopDownToStep(env, to, { onProgress });
    } else {
        const at = detectTDCompleted(env) + 1;
        if (at < TOPDOWN_STEPS.length) {
            log(`[topdown-step] auto-resume from ${TOPDOWN_STEPS[at]}\n`);
        }
        announceEdits(env, TOPDOWN_STEPS[Math.min(at, TOPDOWN_STEPS.length - 1)], log);
        await resumeTDEnvelope(env, to, { onProgress });
    }
}

/** ⛓ A config OBJECT (the `--config` keys) → the parsed config of a `run`; for `runPipeline`. */
export const resolveConfig = (doc) => ({ ...parseArgs([], { configDoc: doc }), subcommand: 'run' });

/** ⛓ The substrate ids this driver's config names, and the layout that must place them. */
export const SUBSTRATE_CHECK = Object.freeze({ layout: 'topdown', tool: 'topdown-step', counts: { mix: '--mix' } });

/**
 * `run`, in-process: a new envelope laid out from `source` (a rules.json
 * OBJECT; else `config.source`, a path) or `envelope` (a serialized one to
 * resume), run to `config.to` (default compile). Writes nothing; the
 * substrate libraries must already be loaded.
 * @returns {Promise<{envelope: object, rulesJson: object|null, summary: object}>}
 */
export async function build(config, { envelope = null, source = null, log = () => {}, onProgress = null } = {}) {
    let env;
    if (envelope) env = deserializeTDEnvelope(structuredClone(envelope));
    else if (source || config.source) env = buildEnv(config, { sourceDoc: source ? structuredClone(source) : null });
    else throw new UsageError('topdown-step needs a source rules.json (`source`) or an `envelope` to resume');
    await runToEnd(env, config, { log, onProgress });
    const rulesJson = env.compile?.rulesJson ?? null;
    return {
        envelope: serializeTDEnvelope(env),
        rulesJson,
        summary: {
            seed: env.opts?.seed ?? null,
            completed: TOPDOWN_STEPS[env.completed] ?? null,
            driver: rulesJson?.procgen_metadata?.['1']?.driver ?? null,
            regions: rulesJson ? Object.keys(rulesJson.regions?.['1'] ?? {}).length : null,
        },
    };
}

async function main(status) {
    const args = parseOrUsage(() => parseArgs(process.argv.slice(2)));
    status.config = args;
    const sub = args.subcommand;
    status.subcommand = sub;
    if (!sub) throw new UsageError(`missing subcommand (one of: ${TOPDOWN_STEPS.join(', ')}, run)`);
    const isStep = TOPDOWN_STEPS.includes(sub);
    if (!isStep && sub !== 'run') throw new UsageError(`unknown subcommand '${sub}'`);
    await loadPipelineSubstrates();
    checkSubstrateIds(args, SUBSTRATE_CHECK);

    let env;
    if (args.input) {
        env = deserializeTDEnvelope(readJson(args.input, '-i'));
    } else if (sub === 'layout' || sub === 'run') {
        if (!args.source) throw new UsageError(`${sub} requires --source <rules.json> (or -i <envelope.json>)`);
        env = buildEnv(args);
    } else {
        throw new UsageError(`step '${sub}' requires -i <envelope.json> (or start with 'layout')`);
    }

    const onProgress = (ev) => {
        if (ev?.type === 'region') process.stderr.write(`  · region ${ev.region_id} (${ev.substrate})\n`);
        else if (ev?.type) process.stderr.write(`  · ${ev.type}\n`);
    };


    const log = (m) => process.stderr.write(m);
    if (sub === 'run') {
        await runToEnd(env, args, { log, onProgress });
    } else {
        announceEdits(env, sub, log);
        await runTopDownStep(sub, env, { onProgress });
    }

    // For `run`, the rules.json (--rules-out) is the primary output; only write
    // the envelope when -o is given (avoids dropping a default file in the cwd).
    // Single-step subcommands always write the envelope (it IS their output).
    if (sub !== 'run' || args.out) {
        const outPath = writeOut(args.out, serializeTDEnvelope(env), sub);
        process.stderr.write(`[topdown-step] ${sub} → completed=${env.completed} → ${outPath}\n`);
        status.outputs.envelope = outPath;
    } else {
        process.stderr.write(`[topdown-step] ${sub} → completed=${env.completed}\n`);
    }
    status.completed = TOPDOWN_STEPS[env.completed] ?? null;
    status.next = nextTopDownStep(env) ?? null;
    status.summary.seed = env.opts?.seed ?? null;
    if (isStep && sub !== 'compile') {
        const n = nextTopDownStep(env);
        if (n) process.stderr.write(`[topdown-step] next: ${n}\n`);
    }

    if (env.compile) {
        const { rulesJson } = env.compile;
        if (args.rulesOut) {
            const abs = writeOut(args.rulesOut, rulesJson, 'rules');
            process.stderr.write(`[topdown-step] rules.json → ${abs}\n`);
            status.outputs.rules = abs;
        }
        const regions = Object.keys(rulesJson.regions?.['1'] ?? {}).length;
        status.summary.driver = rulesJson.procgen_metadata?.['1']?.driver ?? null;
        status.summary.regions = regions;
        process.stderr.write(`[topdown-step] driver ${rulesJson.procgen_metadata?.['1']?.driver} · ${regions} regions\n`);
    }
}

runCli('topdown-step', import.meta.url, main);
