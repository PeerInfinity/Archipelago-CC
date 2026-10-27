// load hook: wrap levelRun.createLevelRun so globalThis.__oppInstrument sees every run (measurement only).
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/levelRun.js')) return out;
    let src = String(out.source);
    src = src.replace('export function createLevelRun(', 'function __oppCreateLevelRunInner(');
    src += '\nexport function createLevelRun(...a) { const r = __oppCreateLevelRunInner(...a); return globalThis.__oppInstrument ? globalThis.__oppInstrument(r) : r; }\n';
    return { ...out, source: src, shortCircuit: true };
}
