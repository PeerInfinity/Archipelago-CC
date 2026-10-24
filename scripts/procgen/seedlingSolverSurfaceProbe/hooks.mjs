/**
 * The C1 dynamic probe's module hook: every import of the simulation's
 * `levelRun.js` resolves to `levelRunWrapper.mjs` instead — except the
 * wrapper's own import of the real module. No simulation or solver file is
 * edited; the redirect lives entirely in the module graph of this process.
 */
const WRAPPER = new URL('./levelRunWrapper.mjs', import.meta.url).href;
const REAL_SUFFIX = '/frontend/modules/seedlingDemo/levelRun.js';

export async function resolve(specifier, context, next) {
    const r = await next(specifier, context);
    if (r.url.endsWith(REAL_SUFFIX) && context.parentURL !== WRAPPER) {
        return { ...r, url: WRAPPER, shortCircuit: true };
    }
    return r;
}
