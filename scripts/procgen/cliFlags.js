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

import { fileURLToPath } from 'node:url';

import { helpText } from './argvHelp.js';
import { UsageError } from './cliRun.js';

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

/** @typedef {{arity: 0|1, set: (out: object, key: string, v: string|undefined, flag: string) => void}} Kind */

/** @type {Record<string, Kind>} */
export const KIND = Object.freeze({
    int: { arity: 1, set: (o, k, v, f) => { o[k] = toInt(f, v); } },
    float: { arity: 1, set: (o, k, v, f) => { o[k] = toFloat(f, v); } },
    str: { arity: 1, set: (o, k, v) => { o[k] = v; } },
    wxh: { arity: 1, set: (o, k, v, f) => { o[k] = toWxH(f, v); } },
    /** `id=N`, repeatable, into an object. */
    counts: {
        arity: 1,
        set: (o, k, v, f) => { const [id, n] = splitKv(f, v, 'id=N'); o[k][id] = toInt(f, n); },
    },
    /** `id=W` with a decimal weight, repeatable, into an object. */
    weights: {
        arity: 1,
        set: (o, k, v, f) => { const [id, n] = splitKv(f, v, 'id=W'); o[k][id] = toFloat(f, n); },
    },
    /** `key=value`, repeatable; a plain decimal value becomes a number. */
    params: {
        arity: 1,
        set: (o, k, v, f) => {
            const [key, raw] = splitKv(f, v, 'key=value');
            o[k][key] = PARAM_NUMBER_RE.test(raw) ? Number(raw) : raw;
        },
    },
    /** Repeatable, into an array. */
    list: { arity: 1, set: (o, k, v) => { o[k].push(v); } },
    on: { arity: 0, set: (o, k) => { o[k] = true; } },
    off: { arity: 0, set: (o, k) => { o[k] = false; } },
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
    };
}

/**
 * One flag's spec: the key it writes and its kind. `then(out)` runs after
 * the write (dump-sphere-growth's `--items-per-sphere` clears `spheres`).
 */
export function flag(key, kind, then = null) {
    return Object.freeze({ key, kind, then });
}

const HELP = Object.freeze({ help: true });

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
    help: HELP,
});

/**
 * Parse `argv` against a driver's flag table, writing into `defaults` (the
 * driver's own fresh object, which is returned).
 * @param {string[]} argv
 * @param {Record<string, object>} table flag → spec (`W.*`, `flag(...)`, or `W.help`)
 * @param {object} defaults
 * @param {{subcommand?: boolean, metaUrl?: string}} [opts] `subcommand`: a
 *        first argument not starting with `-` is `out.subcommand`; `metaUrl`:
 *        the driver's, for `-h`
 */
export function parseFlags(argv, table, defaults, { subcommand = false, metaUrl = null } = {}) {
    const out = defaults;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (subcommand && i === 0 && !a.startsWith('-')) { out.subcommand = a; continue; }
        const spec = Object.hasOwn(table, a) ? table[a] : null;
        if (!spec) throw new UsageError(`unknown flag: ${a}`);
        if (spec === HELP) {
            process.stdout.write(`${helpText(fileURLToPath(metaUrl))}\n`);
            process.exit(0);
        }
        let v;
        if (spec.kind.arity) {
            if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
            v = argv[++i];
        }
        spec.kind.set(out, spec.key, v, a);
        spec.then?.(out);
    }
    return out;
}
