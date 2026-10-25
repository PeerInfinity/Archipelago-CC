#!/usr/bin/env node
/**
 * Measure-only (slice L371): WHERE a refusal's error was constructed. The solver turns a throw into a refusal's text
 * (`settleSolve`), so the stack is lost; this process wraps the global `Error` BEFORE the solver is imported and prints
 * the construction stack of every error whose message starts with `--match` (first `--max`). Nothing tracked changes.
 *
 * Run: node l371-stack.mjs --requests=<jsonl> --seam=<t> --match='chaserForecast: whether' [--max=3]
 */
import { readFileSync } from 'node:fs';

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const match = arg('match');
let left = Number(arg('max', '3'));
const Base = globalThis.Error;
Error.stackTraceLimit = 40;
globalThis.Error = class extends Base {
    constructor(message, opts) {
        super(message, opts);
        if (left > 0 && typeof message === 'string' && message.startsWith(match)) {
            left -= 1;
            console.log(`STACK ${message.slice(0, 160)}\n${this.stack.split('\n').slice(1, 30).join('\n')}`);
        }
    }
};
const R = `file://${process.env.BX_ROOT ?? '/home/user/Archipelago-CC'}/`;
const rel = (p) => new URL(p, R).href;
const { restoreRequest } = await import(rel('scripts/procgen/seedlingSolveRequestCodec.js'));
const { atSeamTime } = await import(rel('scripts/procgen/replay-seedling-solve-request.mjs'));
const { levelSourceFromAtlas } = await import(rel('frontend/modules/seedlingDemo/atlasSource.js'));
const { solveAnytime, ANYTIME_PASSES } = await import(rel('frontend/modules/seedlingDemo/jsRuntimeSolver.js'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))[0];
const req = restoreRequest(atSeamTime(line.requests[0].request, Number(arg('seam'))));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes: passes.slice(0, 1) });
console.log(`ANSWER ok=${a.ok} ${String(a.message ?? '').slice(0, 200)}`);
