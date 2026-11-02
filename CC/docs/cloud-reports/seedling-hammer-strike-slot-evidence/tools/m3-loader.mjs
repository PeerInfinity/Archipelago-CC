// MEASUREMENT ONLY (design (3) scratch): `execCorpseWeigh` re-selects the slot it arrived with (the blade) before each
// walk to a bump stance; its own `primaryWeapon !== 'fire'` check then selects Fire again at the stance.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const anchor = "            ctx.walkTo(ctx.goal, stance, { what: `${ctx.what} -> corpse bump ${i + 1} stance";
    if (src.split(anchor).length !== 2) throw new Error('m3-loader: anchor not found once');
    src = src.replace(anchor, "            if (run.progress('primary') !== prior) { globalThis.__m3 = (globalThis.__m3 ?? 0) + 1; ctx.equip(prior); }\n" + anchor);
    return { ...out, source: src, shortCircuit: true };
}
