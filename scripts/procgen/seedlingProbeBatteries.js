/**
 * seedlingProbeBatteries — **ONE COMMAND RUNS THE STANDARD SEEDLING PROBE
 * BATTERY, EACH PROBE WITH ITS OWN ARGS, EACH IN FULL** (slice
 * seedling-probe-battery).
 *
 * ⛔ WHY. `seedling-probe.yml` took a probe list and ONE `args` string applied
 * to every probe, so a slice ran each probe by hand with the args it cared
 * about — and `probe-seedling-wasm-arrival-composites.mjs`'s session X went
 * red on main for days unseen because only `--only=D` was ever dispatched.
 * A battery is a named, committed list (`seedling-probe-batteries.json`) the
 * workflow reads (`-f battery=standard`): one job per entry, its own args.
 *
 * ⛓ VALIDATION IS READ OFF THE PROBES, NOT A HAND LIST. A flag is accepted
 * only if `argvScan.flagsIn` finds the probe parsing it (the same scanner the
 * instruments index and `--help` use), so a renamed flag reds the battery's
 * vitest row instead of being silently ignored by the probe on CI.
 *
 * CLI (the workflow's plan job): `node scripts/procgen/seedlingProbeBatteries.js
 * <name>` prints the battery's matrix as JSON, or exits 1 with the refusals.
 * A `.js`, not an `.mjs`, so it enrols in no gate roster (`headlessChromium.js`
 * says why).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagsIn } from './argvScan.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BATTERIES_FILE = join(HERE, 'seedling-probe-batteries.json');
export const PROBE_NAME_RE = /^probe-seedling-[a-z0-9-]+\.mjs$/;
/** One token: `--flag` or `--flag=value`, value without shell metacharacters. */
const TOKEN_RE = /^--([a-zA-Z][a-zA-Z0-9-]*)(?:=([A-Za-z0-9_.,:/@+-]*))?$/;
/** Set by the job itself; a battery that passes it would point the probe elsewhere. */
export const JOB_OWNED_FLAGS = Object.freeze(['host']);

/** Split an args string into tokens; `{ tokens, problems }`. */
export function parseArgs(args) {
    const tokens = String(args ?? '').split(/\s+/).filter(Boolean);
    const problems = [];
    for (const t of tokens) {
        const m = t.match(TOKEN_RE);
        if (!m) problems.push(`"${t}" is not --flag or --flag=value (no shell metacharacters)`);
        else if (JOB_OWNED_FLAGS.includes(m[1])) problems.push(`--${m[1]} is set by the job`);
    }
    return { tokens, flags: tokens.map((t) => t.match(TOKEN_RE)?.[1]).filter(Boolean), problems };
}

/** The job id of an entry: its own `id`, else the probe's stem (+ nothing else — a duplicate must name itself). */
export const entryId = (e) => e.id ?? String(e.probe ?? '').replace(/\.mjs$/, '');

/**
 * Every refusal for one battery (empty = valid). `dir` = where the probes
 * live; `readProbe` = a seam for the test.
 */
export function batteryProblems(name, entries, { dir = HERE, readProbe = (p) => readFileSync(p, 'utf8') } = {}) {
    const problems = [];
    if (!Array.isArray(entries) || entries.length === 0) return [`${name}: not a non-empty list`];
    const seen = new Map();
    for (const [i, e] of entries.entries()) {
        const at = `${name}[${i}]`;
        const extra = Object.keys(e ?? {}).filter((k) => !['probe', 'args', 'id'].includes(k));
        if (extra.length) problems.push(`${at}: unknown key(s) ${extra.join(', ')}`);
        if (!PROBE_NAME_RE.test(e?.probe ?? '')) { problems.push(`${at}: "${e?.probe}" is not a probe-seedling-*.mjs name`); continue; }
        const path = join(dir, e.probe);
        if (!existsSync(path)) { problems.push(`${at}: ${e.probe} does not exist under scripts/procgen/`); continue; }
        const id = entryId(e);
        if (seen.has(id)) problems.push(`${at}: duplicate id "${id}" (also ${seen.get(id)}) — give one an "id"`);
        seen.set(id, at);
        const { flags, problems: argProblems } = parseArgs(e.args);
        problems.push(...argProblems.map((p) => `${at} ${e.probe}: ${p}`));
        const known = new Set(flagsIn(readProbe(path), { file: path }).map((f) => f.name));
        for (const f of flags) {
            if (!known.has(f)) problems.push(`${at} ${e.probe}: --${f} is not a flag the probe parses (it parses ${[...known].map((k) => `--${k}`).join(', ') || 'none'})`);
        }
    }
    return problems;
}

/** The parsed file. */
export const readBatteries = (file = BATTERIES_FILE) => JSON.parse(readFileSync(file, 'utf8')).batteries ?? {};

/** The workflow's matrix for one battery: `[{ id, probe, args }]`; throws the refusals. */
export function batteryMatrix(name, { batteries = readBatteries(), dir = HERE } = {}) {
    if (!Object.hasOwn(batteries, name)) throw new Error(`no battery "${name}" (have: ${Object.keys(batteries).join(', ')})`);
    const problems = batteryProblems(name, batteries[name], { dir });
    if (problems.length) throw new Error(`battery "${name}" refused:\n  ${problems.join('\n  ')}`);
    return batteries[name].map((e) => ({ id: entryId(e), probe: e.probe, args: e.args ?? '' }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const name = process.argv[2];
    if (!name || name.startsWith('--')) {
        console.log('Usage: node scripts/procgen/seedlingProbeBatteries.js <battery>   (prints the matrix JSON)');
        console.log(`Batteries: ${Object.keys(readBatteries()).join(', ')}`);
        process.exit(name === '--help' ? 0 : 1);
    }
    try {
        console.log(JSON.stringify(batteryMatrix(name)));
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
