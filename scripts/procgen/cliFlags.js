/**
 * cliFlags — the pipeline drivers' ONE argv parser (§5au item 6).
 *
 * Before this, six hand-written `parseArgs` each kept their own copies of
 * `parseWxH` / `parseKv` / `parseStrKv`, and they had drifted:
 *   - `--seed abc`, `--quota maze=x`, `--region 8xq` parsed to NaN silently;
 *   - a flag with no value (`--seed` last) read `undefined` and ran on;
 *   - `--param k=1e3` was the number 1000 on topdown-step and the string
 *     "1e3" on sphere-step / dump-sphere-growth.
 * Here every value is checked once, and a bad one is a usage error (exit 1)
 * naming the flag.
 *
 * ⛓ EACH DRIVER STILL DECLARES WHICH FLAGS IT ACCEPTS, in its own file, as a
 * table keyed by the flag (`'--seed': W.seed,`). `argvScan.js` reads those
 * keys (its `table` pattern), so `--help` and the instruments index keep
 * listing exactly the flags that driver takes — a shared `switch` would have
 * credited every world flag to every driver.
 *
 * ⛓ THE PARSE RESULT IS ECHOED: a dump writes it as its `config`, so the
 * driver passes its own defaults object and each flag writes the same key
 * the old parser wrote, in argv order. For valid argv the result is the same
 * object, key order included.
 *
 * Usage (from a driver):
 *   import { W, parseFlags } from './cliFlags.js';
 *   const FLAGS = { '--seed': W.seed, '--quota': W.quota, '-h': W.help };
 *   const opts = parseFlags(argv, FLAGS, { seed: 1, quotas: {} }, { metaUrl: import.meta.url });
 */

import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { helpText } from './argvHelp.js';
import { InputError, UsageError, readInputJson } from './cliRun.js';

/* ── value readers: each returns the value or throws a UsageError naming the flag ── */

const INT_RE = /^-?\d+$/;
/** ⛓ `--param` coerces a plain decimal to a number and leaves anything else
 *  a string — sphere-step's and dump-sphere-growth's rule, now topdown's too. */
const PARAM_NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function toInt(flag, v) {
    if (!INT_RE.test(v)) throw new UsageError(`${flag}: expected an integer, got '${v}'`);
    return parseInt(v, 10);
}

export function toFloat(flag, v) {
    const n = Number(v);
    if (v.trim() === '' || !Number.isFinite(n)) throw new UsageError(`${flag}: expected a number, got '${v}'`);
    return n;
}

export function toWxH(flag, v) {
    const m = /^(\d+)x(\d+)$/.exec(v);
    if (!m) throw new UsageError(`${flag}: expected WxH, got '${v}'`);
    return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

function splitKv(flag, v, shape) {
    const i = v.indexOf('=');
    if (i <= 0) throw new UsageError(`${flag}: expected ${shape}, got '${v}'`);
    return [v.slice(0, i), v.slice(i + 1)];
}

/* ── kinds: how a flag writes its key ── */

/**
 * @typedef {{arity: 0|1, set: Function, schema?: object, check?: (v: any) => boolean}} Kind
 * `set(out, key, raw, flag)` writes a flag's value; `schema` is the JSON
 * Schema of that key in a `--config` file and `check` its validator (a kind
 * without one cannot come from a file).
 */

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';
const isMap = (v, each) => v !== null && typeof v === 'object' && !Array.isArray(v)
    && Object.values(v).every(each);

/** @type {Record<string, Kind>} */
export const KIND = Object.freeze({
    int: { arity: 1, set: (o, k, v, f) => { o[k] = toInt(f, v); }, schema: { type: 'integer' }, check: isInt },
    float: { arity: 1, set: (o, k, v, f) => { o[k] = toFloat(f, v); }, schema: { type: 'number' }, check: isNum },
    str: { arity: 1, set: (o, k, v) => { o[k] = v; }, schema: { type: 'string' }, check: isStr },
    wxh: {
        arity: 1,
        set: (o, k, v, f) => { o[k] = toWxH(f, v); },
        schema: {
            type: 'object',
            properties: { width: { type: 'integer', minimum: 0 }, height: { type: 'integer', minimum: 0 } },
            required: ['width', 'height'],
            additionalProperties: false,
        },
        check: (v) => isMap(v, isInt) && Object.keys(v).sort().join() === 'height,width'
            && v.width >= 0 && v.height >= 0,
    },
    /** `id=N`, repeatable, into an object. */
    counts: {
        arity: 1,
        set: (o, k, v, f) => { const [id, n] = splitKv(f, v, 'id=N'); o[k][id] = toInt(f, n); },
        schema: { type: 'object', additionalProperties: { type: 'integer' } },
        check: (v) => isMap(v, isInt),
    },
    /** `id=W` with a decimal weight, repeatable, into an object. */
    weights: {
        arity: 1,
        set: (o, k, v, f) => { const [id, n] = splitKv(f, v, 'id=W'); o[k][id] = toFloat(f, n); },
        schema: { type: 'object', additionalProperties: { type: 'number' } },
        check: (v) => isMap(v, isNum),
    },
    /** `key=value`, repeatable; a plain decimal value becomes a number. */
    params: {
        arity: 1,
        set: (o, k, v, f) => {
            const [key, raw] = splitKv(f, v, 'key=value');
            o[k][key] = PARAM_NUMBER_RE.test(raw) ? Number(raw) : raw;
        },
        schema: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
        check: (v) => isMap(v, (x) => isStr(x) || isNum(x) || typeof x === 'boolean'),
    },
    /** Repeatable, into an array. */
    list: {
        arity: 1,
        set: (o, k, v) => { o[k].push(v); },
        schema: { type: 'array', items: { type: 'string' } },
        check: (v) => Array.isArray(v) && v.every(isStr),
    },
    on: { arity: 0, set: (o, k) => { o[k] = true; }, schema: { type: 'boolean' }, check: (v) => typeof v === 'boolean' },
    off: { arity: 0, set: (o, k) => { o[k] = false; }, schema: { type: 'boolean' }, check: (v) => typeof v === 'boolean' },
    /** Read by `cliRun.js` off the raw argv; consumed here, never stored. */
    consumed: { arity: 1, set: () => {} },
});

/** A kind accepting only `choices`. */
export function oneOf(...choices) {
    return {
        arity: 1,
        set: (o, k, v, f) => {
            if (!choices.includes(v)) {
                throw new UsageError(`${f} expects ${choices.map((c) => `'${c}'`).join(' or ')}, got '${v}'`);
            }
            o[k] = v;
        },
        schema: { enum: [...choices] },
        check: (v) => choices.includes(v),
    };
}

/**
 * One flag's spec: the key it writes and its kind. `clears`: keys set to null
 * after the write (dump-sphere-growth's `--items-per-sphere` clears
 * `spheres`), which a `--config` file may then also set to null.
 */
export function flag(key, kind, { clears = [] } = {}) {
    return Object.freeze({ key, kind, clears: Object.freeze([...clears]) });
}

const HELP = Object.freeze({ help: true });
const CONFIG = Object.freeze({ config: true });
const CONFIG_SCHEMA = Object.freeze({ configSchema: true });

/**
 * ⛓⛓ THE WORLD AND I/O FLAGS more than one driver takes, one spec each. A
 * driver whose flag means something else declares its own spec instead
 * (topdown-step's `--mix` is `W.mixWeights`, dump-grid-growth's `W.mixCounts`).
 */
export const W = Object.freeze({
    seed: flag('seed', KIND.int),
    region: flag('region', KIND.wxh),
    grid: flag('grid', KIND.wxh),
    quota: flag('quotas', KIND.counts),
    mixCounts: flag('mix', KIND.counts),
    mixWeights: flag('mix', KIND.weights),
    start: flag('start', KIND.str),
    items: flag('items', KIND.counts),
    obstacles: flag('obstacles', KIND.counts),
    spheres: flag('spheres', KIND.int),
    victory: flag('victory', KIND.str),
    maxItemsPerRegion: flag('maxItemsPerRegion', KIND.int),
    fillers: flag('fillers', KIND.int),
    revisit: flag('revisit', KIND.float),
    noBidirectional: flag('bidirectional', KIND.off),
    noArrowEntry: flag('arrowEntry', KIND.off),
    fallBehavior: flag('fallBehavior', KIND.str),
    physicsProfile: flag('physicsProfile', KIND.str),
    param: flag('params', KIND.params),
    enableLoopMode: flag('enableLoopMode', KIND.on),
    regionXpEffect: flag('regionXpEffect', KIND.str),
    consumableTiles: flag('consumableTiles', KIND.int),
    consumableCount: flag('consumableCount', KIND.int),
    manaTiles: flag('manaTiles', KIND.int),
    manaTileAmount: flag('manaTileAmount', KIND.float),
    input: flag('input', KIND.str),
    out: flag('out', KIND.str),
    rulesOut: flag('rulesOut', KIND.str),
    from: flag('from', KIND.str),
    to: flag('to', KIND.str),
    jsonStatus: flag(null, KIND.consumed),
    /** `--config PATH`: a JSON object of this driver's keys (§5au item 7). */
    config: CONFIG,
    /** `--config-schema`: print the JSON Schema `--config` is checked against, exit 0. */
    configSchema: CONFIG_SCHEMA,
    help: HELP,
});

/**
 * ⛓ The keys a `--config` file may set: every key a flag of `table` writes,
 * with that flag's kind and every flag spelling that writes it.
 * @returns {Map<string, {kind: Kind, flags: string[], clears: string[], nullable: boolean}>}
 */
function configKeys(table, defaults) {
    const keys = new Map();
    const cleared = new Set(Object.values(table).flatMap((spec) => spec?.clears ?? []));
    for (const [name, spec] of Object.entries(table)) {
        if (!spec?.kind?.check || spec.key == null) continue;
        const have = keys.get(spec.key);
        if (have) { have.flags.push(name); continue; }
        keys.set(spec.key, {
            kind: spec.kind,
            flags: [name],
            clears: spec.clears,
            nullable: defaults[spec.key] === null || defaults[spec.key] === undefined || cleared.has(spec.key),
        });
    }
    return keys;
}

/**
 * ⛓ THE JSON SCHEMA of a driver's `--config` file, derived from its flag
 * table and its defaults (a key whose default is null may also be null).
 */
export function configSchema(table, defaults, { tool = null } = {}) {
    const properties = {};
    for (const [key, { kind, flags, nullable }] of configKeys(table, defaults)) {
        properties[key] = {
            ...(nullable ? { anyOf: [kind.schema, { type: 'null' }] } : kind.schema),
            'x-flags': flags.filter((f) => f.startsWith('--')),
            ...(defaults[key] !== undefined ? { default: defaults[key] } : {}),
        };
    }
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: `${tool ?? 'driver'} --config`,
        description: 'Flags given on the command line override these values; a repeatable map or list flag '
            + '(--quota, --items, --atlas, …) merges into the file\'s map or appends to its list.',
        type: 'object',
        properties,
        additionalProperties: false,
    };
}

/**
 * Read and check a `--config` file against the table, then write it into
 * `out`. Anything wrong with the FILE is an InputError (exit 3).
 */
function applyConfig(out, path, table, defaults) {
    const doc = readInputJson(path, '--config');
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        throw new InputError(`--config ${path}: expected a JSON object`);
    }
    const keys = configKeys(table, defaults);
    for (const [key, value] of Object.entries(doc)) {
        const k = keys.get(key);
        if (!k) {
            throw new InputError(`--config ${path}: unknown key '${key}' (this driver's keys: ${[...keys.keys()].join(', ')}; `
                + 'see --config-schema)');
        }
        if (!(value === null ? k.nullable : k.kind.check(value))) {
            throw new InputError(`--config ${path}: '${key}' must be ${describe(k.kind.schema)}`
                + `${k.nullable ? ' or null' : ''}, got ${JSON.stringify(value)}`);
        }
    }
    for (const [key, value] of Object.entries(doc)) {
        // ⛓ a copy: a flag that merges into a map or list must not edit the parsed file
        out[key] = value === null ? null : structuredClone(value);
        if (value !== null) for (const c of keys.get(key).clears) if (!Object.hasOwn(doc, c)) out[c] = null;
    }
}

function describe(schema) {
    if (schema.enum) return `one of ${schema.enum.map((c) => JSON.stringify(c)).join(', ')}`;
    if (schema.type === 'object' && schema.properties) return `{${Object.keys(schema.properties).join(', ')}} integers`;
    if (schema.type === 'object') {
        const plural = { integer: 'integers', number: 'numbers', string: 'strings', boolean: 'booleans' };
        return `an object of ${[].concat(schema.additionalProperties.type).map((t) => plural[t]).join(' / ')}`;
    }
    if (schema.type === 'array') return 'an array of strings';
    return schema.type === 'integer' ? 'an integer' : `a ${schema.type}`;
}

/**
 * Parse `argv` against a driver's flag table, writing into `defaults` (the
 * driver's own fresh object, which is returned). A `--config` file in the
 * table is applied first, wherever it sits, so the flags win over it.
 * @param {string[]} argv
 * @param {Record<string, object>} table flag → spec (`W.*`, `flag(...)`, `W.config`, `W.help`)
 * @param {object} defaults
 * @param {{subcommand?: boolean, metaUrl?: string}} [opts] `subcommand`: a
 *        first argument not starting with `-` is `out.subcommand`; `metaUrl`:
 *        the driver's, for `-h`
 */
export function parseFlags(argv, table, defaults, { subcommand = false, metaUrl = null } = {}) {
    const out = defaults;
    const pristine = structuredClone(defaults);
    const tool = metaUrl ? basename(fileURLToPath(metaUrl), '.js') : null;
    // ⛓ the config file first, wherever --config sits: flags win over it.
    if (Object.values(table).includes(CONFIG)) {
        const at = argv.flatMap((a, i) => (a === '--config' && !(subcommand && i === 0) ? [i] : []));
        if (at.length > 1) throw new UsageError('--config given more than once');
        if (at.length === 1) {
            if (at[0] + 1 >= argv.length) throw new UsageError('--config needs a value');
            applyConfig(out, argv[at[0] + 1], table, pristine);
        }
    }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (subcommand && i === 0 && !a.startsWith('-')) { out.subcommand = a; continue; }
        const spec = Object.hasOwn(table, a) ? table[a] : null;
        if (!spec) throw new UsageError(`unknown flag: ${a}`);
        if (spec === HELP) {
            process.stdout.write(`${helpText(fileURLToPath(metaUrl))}\n`);
            process.exit(0);
        }
        if (spec === CONFIG_SCHEMA) {
            process.stdout.write(`${JSON.stringify(configSchema(table, pristine, { tool }), null, 2)}\n`);
            process.exit(0);
        }
        if (spec === CONFIG) { i++; continue; }
        let v;
        if (spec.kind.arity) {
            if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
            v = argv[++i];
        }
        spec.kind.set(out, spec.key, v, a);
        for (const c of spec.clears) out[c] = null;
    }
    return out;
}
