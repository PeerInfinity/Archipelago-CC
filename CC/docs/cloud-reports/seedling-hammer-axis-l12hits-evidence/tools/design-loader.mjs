// MEASUREMENT ONLY (load hook, the M design check): rewrites `axisAlongStrike`'s on-axis offer per $L12_DESIGN —
//   1: offer only bodies the press KILLS (one hit left of the base `hitsMax` 3: `hits >= 2`), so no body is left alive
//      by the walk's strikes;
//   3: offer nothing while an attack chaser (a puncher) is within contact range of the player (centre distance under
//      `puncherAttackRange` 10 + `puncherPunchReach` 8 + the player's half box 4).
// The tree is not edited.
export async function load(url, context, next) {
    const out = await next(url, context);
    if (!url.endsWith('/seedlingDemo/solverBot.js')) return out;
    let src = String(out.source);
    const a = '            along = bodies.filter((b) => AXIS_OF_FACING[facingToward(state, b.rect)] === axis);\n';
    if (!src.includes(a)) throw new Error('design-loader: anchor not found');
    const d = process.env.L12_DESIGN;
    const add = d === '1'
        ? '            along = along.filter((b) => (b.hits ?? 0) >= 2);\n'
        : d === '3'
            ? '            if (bodies.some((b) => b.tag === "puncher" && Math.hypot(b.x - state.x, b.y - state.y) < 22)) along = [];\n'
            : '';
    src = src.replace(a, a + add);
    return { ...out, source: src, shortCircuit: true };
}
