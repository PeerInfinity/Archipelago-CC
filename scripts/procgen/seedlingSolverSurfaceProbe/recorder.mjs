/**
 * The recording Proxy. `wrapRun(run)` returns a Proxy whose every string
 * property read is counted by (surface, member, caller file:line), where the
 * caller is the first stack frame outside this directory. The values
 * `run.world`, `run.state` and `run.worldFor(n)` hand out are wrapped one
 * level down (surfaces `world` and `state`); nothing deeper is wrapped.
 *
 * ⚠ PROXY INVARIANTS. A `get` trap must return the target's own value for a
 * non-configurable, non-writable DATA property. The only values this probe
 * substitutes are what the run's `world`/`state` GETTERS return and what the
 * `worldFor` METHOD returns: an accessor property carries no such invariant,
 * and a method's return value is not a property. Every member of a wrapped
 * world or state is returned as `Reflect.get` gives it — never re-wrapped —
 * so a frozen world (and its frozen members) is safe.
 *
 * Identity is preserved per target (a WeakMap), so `run.state === run.state`
 * holds under the probe exactly when it holds without it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');

export function installRecorder(outFile) {
    const counts = new Map(); // `${surface}\t${name}\t${site}` → n
    const wrapped = { world: new WeakMap(), state: new WeakMap() };
    let runs = 0;

    // Structured CallSites (no stack-string formatting): this runs on every
    // property read, millions of times per route.
    const holder = {};
    const relCache = new Map();
    const rel = (file) => {
        let r = relCache.get(file);
        if (r === undefined) {
            const abs = file.startsWith('file://') ? fileURLToPath(file) : file;
            r = abs.startsWith(HERE) ? null : path.relative(REPO, abs);
            relCache.set(file, r);
        }
        return r;
    };
    const callerSite = () => {
        const savedLimit = Error.stackTraceLimit;
        const savedPrepare = Error.prepareStackTrace;
        Error.stackTraceLimit = 4;
        Error.prepareStackTrace = (_, sites) => sites;
        Error.captureStackTrace(holder, callerSite);
        const sites = holder.stack;
        Error.prepareStackTrace = savedPrepare;
        Error.stackTraceLimit = savedLimit;
        for (const cs of sites) {
            const f = cs.getFileName();
            if (!f) continue;
            const r = rel(f);
            if (r === null) continue;
            return `${r}:${cs.getLineNumber()}`;
        }
        return '?';
    };
    const note = (surface, name) => {
        const k = `${surface}\t${name}\t${callerSite()}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
    };
    const wrapLeaf = (surface, v) => {
        if (v === null || typeof v !== 'object') return v;
        const cache = wrapped[surface];
        if (cache.has(v)) return cache.get(v);
        const p = new Proxy(v, {
            get(target, prop, receiver) {
                if (typeof prop === 'string') note(surface, prop);
                return Reflect.get(target, prop, target);
            },
        });
        cache.set(v, p);
        return p;
    };
    const wrapRun = (run) => {
        runs++;
        return new Proxy(run, {
            get(target, prop) {
                const v = Reflect.get(target, prop, target);
                if (typeof prop !== 'string') return v;
                note('run', prop);
                if (prop === 'world') return wrapLeaf('world', v);
                if (prop === 'state') return wrapLeaf('state', v);
                if (prop === 'worldFor' && typeof v === 'function') {
                    return function worldFor(...a) { return wrapLeaf('world', v.apply(target, a)); };
                }
                return v;
            },
        });
    };
    globalThis.__seedlingSurfaceProbe = { wrapRun };
    if (outFile) {
        process.on('exit', () => {
            const rows = [...counts].map(([k, n]) => {
                const [surface, name, site] = k.split('\t');
                return { surface, name, site, n };
            });
            fs.writeFileSync(outFile, JSON.stringify({ runs, rows }));
        });
    }
}
