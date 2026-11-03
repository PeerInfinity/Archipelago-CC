/**
 * Cloudberry substrate — build-time generation (P2b): the game's own generator, a
 * cache, and the deterministic retry.
 *
 * The level generator lives in the Cloudberry game page; nothing in Archipelago-CC
 * can generate a level synchronously. So the sphere hook (`generateZoneForSpecsGen`)
 * plans the request synchronously, looks the result up here, and on a miss YIELDS
 * the promise `ensureCloudberryLevel` returns: the pipeline's asynchronous drivers
 * await a yielded event's `await` before resuming the generator (the synchronous
 * ones cannot, and the hook then refuses by name). A cached result — this session's
 * memory, then the persistent store the environment installed (localStorage in the
 * browser, a gitignored folder headless) — is used without regenerating, so a re-run,
 * a stepped replay or a second Generate costs nothing.
 *
 * A GENERATOR is `{ build, generate(args) → Promise<{ text, docSha256 }>, features?() → Promise<{…}> }`: the
 * document text of `window.cloudberry.generateText(args)` and its canonical sha256
 * (the page's `__cloudberryEmbed.canonicalDocText`, the build id blanked — exactly
 * what the page checks at configure). Installed by the environment:
 *   - the browser: `cloudberryGenFrame.js` (a hidden same-origin game page);
 *   - headless: `scripts/procgen/cloudberryHeadlessGenerator.mjs` (`cloudberrySite.mjs`).
 * `features()` = the page's `__cloudberryEmbed.features`. A plan that needs one the page
 * lacks (P5a: a Double Jump level needs `doubleJump` — the replay fix and the DoubleJump
 * item, Cloudberry `cdc77c9`) is refused BY NAME before anything is generated
 * (`CloudberryFeatureMissing`), and not cached: another page may have it.
 *
 * Each level is generated with `reroll: true` (the generator's own gate search, ⚖ R14).
 * A refusal — `RerollExhausted:`, too few witnessed coins in a piece, the pieces not
 * realising their planned items, no start door — moves to attempt a+1 with a derived
 * seed (`cloudberryAttemptSeed`), up to `cloudberryRetries`; the last refusal is a
 * named error (`CloudberryLevelRefused`). Every step depends only on the request, so
 * the same (seed, params) always resolves to the same result.
 */

import { cloudberryAttemptArgs, readCloudberryDocument } from './cloudberryZonePlan.js';

/** Bump when the stored result's shape changes (old entries are then ignored). */
export const CLOUDBERRY_CACHE_VERSION = 'cloudberry-level-cache/1';

let _generator = null;
let _store = null;
const _memory = new Map();
const _inflight = new Map();
const _stats = { generated: 0, memoryHits: 0, storeHits: 0, refusals: 0, generateMs: [] };

/**
 * Install the environment's generator (`null` uninstalls). `store` (optional):
 * `{ get(key) → result|null, set(key, result) }`, the persistent cache.
 */
export function installCloudberryGenerator(generator, { store = null } = {}) {
    _generator = generator ?? null;
    if (store !== undefined) _store = store;
}

export function cloudberryGenerator() { return _generator; }

/** Counters for instruments: generations, cache hits, refusals, ms per generation. */
export function cloudberryGenerationStats() {
    return { ..._stats, generateMs: [..._stats.generateMs] };
}

/** Forget the memory cache (tests; a new site build). */
export function clearCloudberryLevelCache() {
    _memory.clear();
    _inflight.clear();
}

const storeKey = (key) => `${CLOUDBERRY_CACHE_VERSION}|${key}`;

/**
 * The result for a plan, if this session or the store has it (synchronous):
 *   { generate, docSha256, facts, checks, startDoor, attempt } |
 *   { refused: [reasons…] } | null
 */
export function lookupCloudberryLevel(plan) {
    if (_memory.has(plan.key)) {
        _stats.memoryHits += 1;
        return _memory.get(plan.key);
    }
    if (_store) {
        let hit = null;
        try { hit = _store.get(storeKey(plan.key)); } catch { hit = null; }
        // A stored result from another site build is not trusted once the generator's build is known.
        const stale = hit?.build && _generator?.build && hit.build !== _generator.build;
        if (hit && typeof hit === 'object' && (hit.generate || hit.refused) && !stale) {
            _stats.storeHits += 1;
            _memory.set(plan.key, hit);
            return hit;
        }
    }
    return null;
}

/** The page features a plan needs (P5a: a Double-hero level needs `doubleJump`). */
export function cloudberryPlanFeatures(plan) {
    return plan.doubleJump ? ['doubleJump'] : [];
}

async function resolveLevel(plan, onAttempt) {
    const needed = cloudberryPlanFeatures(plan);
    if (needed.length) {
        const features = (await _generator.features?.()) ?? {};
        const missing = needed.filter((f) => features[f] !== true);
        if (missing.length) {
            return { refused: [`the Cloudberry page (build ${_generator.build || '?'}) has no ${missing.join(', ')}`], missingFeatures: missing, transient: true };
        }
    }
    const reasons = [];
    for (let attempt = 0; attempt <= plan.retries; attempt++) {
        const args = cloudberryAttemptArgs(plan.args, attempt);
        onAttempt?.({ attempt, attempts: plan.retries + 1 });
        const t0 = Date.now();
        // eslint-disable-next-line no-await-in-loop
        const { text, docSha256 } = await _generator.generate({ ...args, reroll: true });
        _stats.generated += 1;
        _stats.generateMs.push(Date.now() - t0);
        let doc;
        try { doc = JSON.parse(text); } catch (err) { doc = { error: `the document is not JSON: ${err.message}` }; }
        const read = readCloudberryDocument(doc, plan);
        if (read.ok) {
            const generate = doc.args?.request;
            if (!generate || generate.reroll !== undefined) {
                reasons.push(`attempt ${attempt} (seed ${args.seed}): the document carries no resolved request`);
                continue;
            }
            return {
                attempt, generate, docSha256, facts: read.facts, checks: read.checks, startDoor: read.startDoor,
                build: _generator.build ?? '',
            };
        }
        reasons.push(`attempt ${attempt} (seed ${args.seed}): ${read.reason}`);
    }
    _stats.refusals += 1;
    return { refused: reasons, build: _generator.build ?? '' };
}

/**
 * Generate (or find) a plan's level. Resolves with the result; never rejects — a
 * generator failure is stored as a refusal for the hook to name. Concurrent calls
 * for the same key share one generation.
 */
export function ensureCloudberryLevel(plan, { onAttempt = null } = {}) {
    const hit = lookupCloudberryLevel(plan);
    if (hit) return Promise.resolve(hit);
    if (_inflight.has(plan.key)) return _inflight.get(plan.key);
    if (!_generator) {
        return Promise.resolve({ refused: ['no Cloudberry generator is installed'], transient: true });
    }
    const p = resolveLevel(plan, onAttempt)
        .catch((err) => ({ refused: [`the generator failed: ${err?.message ?? err}`], transient: true }))
        .then((result) => {
            _inflight.delete(plan.key);
            // A generator failure (page gone, timeout) is not remembered: the next run tries again.
            if (!result.transient) {
                _memory.set(plan.key, result);
                try { _store?.set(storeKey(plan.key), result); } catch { /* best effort */ }
            }
            return result;
        });
    _inflight.set(plan.key, p);
    return p;
}

/** The named refusal for a refused level. */
export function cloudberryRefusalMessage(plan, result) {
    if (result.missingFeatures?.length) {
        return `CloudberryFeatureMissing: cloudberry zone '${plan.region_id}' is a Double Jump level, but `
            + `${result.refused.join('; ')} (__cloudberryEmbed.features.${result.missingFeatures[0]}) — it would play `
            + 'unreplayable and ungated. Use a Cloudberry page that has it (the Cloudberry repo\'s Double Jump '
            + 'change, cdc77c9), or set "Double Jump chance" (cloudberryDoubleJumpChance) to 0.';
    }
    return `CloudberryLevelRefused: cloudberry zone '${plan.region_id}' — no attempt made a level that `
        + `realises its plan (pieces [${plan.pieceSets.map((s) => `{${s.join(',')}}`).join(' ')}], check coins `
        + `per piece [${plan.needs.checks.join(',')}]): ${result.refused.join('; ')}. Change the region seed `
        + '(the world seed), "Retries", "Piece length" or "Check coins per piece".';
}

/** A localStorage-backed store (the browser's persistent cache), or null without storage. */
export function localStorageCloudberryStore(storage = globalThis.localStorage, build = '') {
    if (!storage) return null;
    const prefix = `cloudberryLevel:${build}:`;
    return {
        get(key) {
            const raw = storage.getItem(prefix + key);
            return raw ? JSON.parse(raw) : null;
        },
        set(key, value) { storage.setItem(prefix + key, JSON.stringify(value)); },
    };
}
