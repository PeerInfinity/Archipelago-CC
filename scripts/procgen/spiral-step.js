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
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import {
    SPIRAL_STEPS, runSpiralStep, runSpiralToStep, resumeSpiralEnvelope,
    nextSpiralStep, detectSpiralCompleted, newSpiralEnvelope,
    serializeSpiralEnvelope, deserializeSpiralEnvelope,
} from '../../frontend/modules/procgenPipeline/spiralSteps.js';

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

// Build a fresh envelope from the world flags (the { config, compileIn } shape
// spiralSteps consumes; config is exactly what arrangeShuffledSpiral takes).
function buildEnv(args) {
    if (Object.keys(args.quotas).length === 0) {
        throw new Error('arrange/run require at least one --quota id=N (or -i <envelope.json>)');
    }
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
        },
        hazardOpts: null,
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
