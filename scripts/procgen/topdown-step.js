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
 *
 *   # run a range (or the whole pipeline) in one process:
 *   node scripts/procgen/topdown-step.js run --source world_rules.json \
 *        --mix maze=1 --rules-out rules.json
 *
 *   # re-run from a step after hand-editing the envelope (e.g. substrate pins):
 *   node scripts/procgen/topdown-step.js run -i t1.json --from realise --rules-out rules.json
 *
 *   # auto-resume a partial / hand-edited envelope (no --from): runs from the
 *   # FIRST step whose output is missing (presence = keep, absence = recompute):
 *   node scripts/procgen/topdown-step.js run -i partial.json --rules-out rules.json
 *
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

// Side-effect: register the maze + bounce substrates.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import {
    TOPDOWN_STEPS, runTopDownStep, runTopDownToStep, resumeTDEnvelope,
    nextTopDownStep, detectTDCompleted, buildTopDownEnvelope,
    serializeTDEnvelope, deserializeTDEnvelope,
} from '../../frontend/modules/procgenPipeline/topDownSteps.js';
import {
    defaultProcgenParams, assembleRegionParams,
} from '../../frontend/modules/procgenPipeline/sphereConfigHooks.js';

// --- CLI parser ---

function parseArgs(argv) {
    const out = {
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
    };
    const parseWxH = (s) => {
        const [w, h] = s.split('x').map((n) => parseInt(n, 10));
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error(`expected WxH, got '${s}'`);
        return { width: w, height: h };
    };
    const parseNumKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected id=N, got '${s}'`);
        return [s.slice(0, i), parseFloat(s.slice(i + 1))];
    };
    const parseStrKv = (s) => {
        const i = s.indexOf('=');
        if (i < 0) throw new Error(`expected key=value, got '${s}'`);
        const v = s.slice(i + 1);
        const n = Number(v);
        return [s.slice(0, i), Number.isFinite(n) && v.trim() !== '' ? n : v];
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (i === 0 && !a.startsWith('-')) { out.subcommand = a; continue; }
        switch (a) {
            case '--source': out.source = next(); break;
            case '--seed': out.seed = parseInt(next(), 10); break;
            case '--grid': out.grid = parseWxH(next()); break;
            case '--region': out.region = parseWxH(next()); break;
            case '--mix': { const [id, w] = parseNumKv(next()); out.mix[id] = w; break; }
            case '--param': { const [k, v] = parseStrKv(next()); out.params[k] = v; break; }
            case '--physics-profile': out.physicsProfile = next(); break;
            case '--fall-behavior': out.fallBehavior = next(); break;
            case '--sphere-log': out.sphereLog = next(); break;
            case '--enable-loop-mode': out.enableLoopMode = true; break;
            case '--region-xp-effect': out.regionXpEffect = next(); break;
            case '-i': case '--input': out.input = next(); break;
            case '-o': case '--out': out.out = next(); break;
            case '--rules-out': out.rulesOut = next(); break;
            case '--from': out.from = next(); break;
            case '--to': out.to = next(); break;
            case '-h': case '--help':
                process.stdout.write('See the header comment in scripts/procgen/topdown-step.js\n');
                process.exit(0);
                break;
            default: throw new Error(`unknown flag '${a}'`);
        }
    }
    if (Object.keys(out.mix).length === 0) out.mix = { maze: 1 };
    return out;
}

// --- file I/O ---

function readJson(path) {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

// Sphere log: a JSON array, or JSONL (one entry per line).
function readSphereLog(path) {
    const text = readFileSync(resolve(path), 'utf8').trim();
    if (text.startsWith('[')) {
        const j = JSON.parse(text);
        if (Array.isArray(j)) return j;
    }
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
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
function buildEnv(args) {
    const source = readJson(args.source);
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
    });
}

// --- main ---

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const sub = args.subcommand;
    if (!sub) throw new Error(`missing subcommand (one of: ${TOPDOWN_STEPS.join(', ')}, run)`);
    const isStep = TOPDOWN_STEPS.includes(sub);
    if (!isStep && sub !== 'run') throw new Error(`unknown subcommand '${sub}'`);

    let env;
    if (args.input) {
        env = deserializeTDEnvelope(readJson(args.input));
    } else if (sub === 'layout' || sub === 'run') {
        if (!args.source) throw new Error(`${sub} requires --source <rules.json> (or -i <envelope.json>)`);
        env = buildEnv(args);
    } else {
        throw new Error(`step '${sub}' requires -i <envelope.json> (or start with 'layout')`);
    }

    const onProgress = (ev) => {
        if (ev?.type === 'region') process.stderr.write(`  · region ${ev.region_id} (${ev.substrate})\n`);
        else if (ev?.type) process.stderr.write(`  · ${ev.type}\n`);
    };

    if (sub === 'run') {
        const to = args.to ?? 'compile';
        if (args.from) {
            env.completed = TOPDOWN_STEPS.indexOf(args.from) - 1;
            await runTopDownToStep(env, to, { onProgress });
        } else {
            const at = detectTDCompleted(env) + 1;
            if (at < TOPDOWN_STEPS.length) {
                process.stderr.write(`[topdown-step] auto-resume from ${TOPDOWN_STEPS[at]}\n`);
            }
            await resumeTDEnvelope(env, to, { onProgress });
        }
    } else {
        await runTopDownStep(sub, env, { onProgress });
    }

    // For `run`, the rules.json (--rules-out) is the primary output; only write
    // the envelope when -o is given (avoids dropping a default file in the cwd).
    // Single-step subcommands always write the envelope (it IS their output).
    if (sub !== 'run' || args.out) {
        const outPath = writeOut(args.out, serializeTDEnvelope(env), sub);
        process.stderr.write(`[topdown-step] ${sub} → completed=${env.completed} → ${outPath}\n`);
    } else {
        process.stderr.write(`[topdown-step] ${sub} → completed=${env.completed}\n`);
    }
    if (isStep && sub !== 'compile') {
        const n = nextTopDownStep(env);
        if (n) process.stderr.write(`[topdown-step] next: ${n}\n`);
    }

    if (env.compile) {
        const { rulesJson } = env.compile;
        if (args.rulesOut) {
            const abs = writeOut(args.rulesOut, rulesJson, 'rules');
            process.stderr.write(`[topdown-step] rules.json → ${abs}\n`);
        }
        const regions = Object.keys(rulesJson.regions?.['1'] ?? {}).length;
        process.stderr.write(`[topdown-step] driver ${rulesJson.procgen_metadata?.driver} · ${regions} regions\n`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        process.stderr.write(`[topdown-step] ERROR: ${e.message}\n`);
        process.exit(1);
    });
    // The engine's module graph leaves an unref'd worker/timer handle alive;
    // the work is synchronous above, so exit explicitly once main resolves.
    process.on('beforeExit', () => process.exit(0));
}
