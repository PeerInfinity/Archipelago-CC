// MEASUREMENT ONLY (load hook): `plan-seedling-encounters.mjs`'s `emit` writes into $SLOT_EMIT_DIR (a scratch dir),
// never into the tree, so a producer's ON tape can be diffed against the committed one.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/plan-seedling-encounters.mjs')) return out;
    const src = String(out.source);
    const anchor = '            writeFileSync(path, json);';
    if (src.split(anchor).length !== 2) throw new Error('emit-loader: anchor not found once');
    return { ...out, source: src.replace(anchor, "            writeFileSync(join(process.env.SLOT_EMIT_DIR, `${name}.json`), json);"), shortCircuit: true };
}
