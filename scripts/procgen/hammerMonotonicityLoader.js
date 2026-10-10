/**
 * hammerMonotonicityLoader — ⛓ SEEDLING HAMMER-PHASE B2 (W0): the module-load hook `hammerMonotonicityHook.js`
 * registers. It rewrites `procgenOracle.js`'s `solve` declaration into a forwarder through
 * `globalThis.__seedlingSolveHook` (the same body, renamed `solveCaptured`), and refuses loudly if the declaration it
 * rewrites is not there — a capture that silently captured nothing would read as "no spinner record anywhere".
 */
const TARGET = '/frontend/modules/seedlingDemo/procgenOracle.js';
const DECL = 'export function solve(levelRecord, staging, goals, budget = DEFAULT_BUDGET, {';

export async function load(url, context, nextLoad) {
    const out = await nextLoad(url, context);
    if (!url.endsWith(TARGET)) return out;
    const src = String(out.source);
    if (!src.includes(DECL)) {
        throw new Error(`hammerMonotonicityLoader: ${TARGET} no longer declares \`${DECL}\` — the capture cannot `
            + 'forward its solves; update the loader to the new declaration.');
    }
    const fwd = 'export function solve(...a) {\n'
        + '    return globalThis.__seedlingSolveHook ? globalThis.__seedlingSolveHook(solveCaptured, a)'
        + ' : solveCaptured(...a);\n}\n'
        + 'function solveCaptured(levelRecord, staging, goals, budget = DEFAULT_BUDGET, {';
    return { ...out, source: src.replace(DECL, fwd) };
}
