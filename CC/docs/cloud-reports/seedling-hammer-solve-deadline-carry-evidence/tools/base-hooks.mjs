// SCRATCH (SDC): redirect seedlingDemo/solverBot.js to the pristine base copy beside it (same dir, so its imports resolve).
export async function resolve(specifier, context, next) {
    const r = await next(specifier, context);
    if (r.url.endsWith('/frontend/modules/seedlingDemo/solverBot.js')) return { ...r, url: r.url.replace(/solverBot\.js$/, '.sdc-base-solverBot.js') };
    return r;
}
