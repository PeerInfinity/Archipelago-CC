// WALLS-CENSUS-2 scratch candidate (measurement only; applied IN MEMORY by trace-loader.mjs under WC2_REWIND_WAIT=1).
// THE PARK RETRY: each of `execL39Shaft`'s parks (its route-stance walk + its fire route) and its press-stance walk is
// retried after a billiard refusal that SPENT ticks (the departure wait already covers the plan-time ones): the segment
// is rewound to the park's first tick (`ctx.rewind.to`, the fight fallback's primitive), the player idles
// `L39_SHAFT_WAIT_STEP` ticks (every tick checked for a hit), and the same park is asked again, up to `L39_SHAFT_WAIT_MAX`.
export const PARK_FROM = `            const first = best.steps[0];
            const waited = l39ShaftWalk(run, perTick, ctx, first.stance, { what: \`\${what} -> \${slot.presser} route stance\`,
                ...(first.exempt ? { contactsOverride: first.exempt } : {}) }, refuse);
            const rec = execRoute(run, perTick, {
                shove: { block: { x: best.b.row.x, y: best.b.row.y } }, route: best.steps,
                target: { id: best.b.id }, weapon: 'fire', slot: resolved.slot,
            }, ctx, \`\${what} (park \${best.b.id} on \${slot.presser})\`);`;
const RETRY = (body) => `            for (let wc2Wait = 0; ; ) {
                const wc2T0 = perTick.length;
                try {
${body}
                    break;
                } catch (e) {
                    const billiard = e instanceof SolverRefusal && e.obstacle?.kind === 'danger'
                        && typeof e.obstacle.id === 'string' && e.obstacle.id.startsWith('spinner@');
                    if (!billiard || !ctx.rewind || perTick.length === wc2T0
                        || wc2Wait + L39_SHAFT_WAIT_STEP > L39_SHAFT_WAIT_MAX) throw e;
                    ({ run } = ctx.rewind.to(wc2T0));
                    const hits0 = run.ledger('playerHits').length;
                    for (let i = 0; i < L39_SHAFT_WAIT_STEP; i += 1) {
                        perTick.push(new Set());
                        const { transition } = run.advance(new Set());
                        if (transition || run.ledger('playerHits').length !== hits0) throw e;
                    }
                    wc2Wait += L39_SHAFT_WAIT_STEP;
                    process.stderr.write('REWINDWAIT ' + JSON.stringify({ at: wc2T0, waited: wc2Wait, why: e.obstacle.id }) + '\\n');
                }
            }`;
export const PARK_TO = `            const first = best.steps[0];
            let waited, rec;
${RETRY(`                    waited = l39ShaftWalk(run, perTick, ctx, first.stance, { what: \`\${what} -> \${slot.presser} route stance\`,
                        ...(first.exempt ? { contactsOverride: first.exempt } : {}) }, refuse);
                    rec = execRoute(run, perTick, {
                        shove: { block: { x: best.b.row.x, y: best.b.row.y } }, route: best.steps,
                        target: { id: best.b.id }, weapon: 'fire', slot: resolved.slot,
                    }, ctx, \`\${what} (park \${best.b.id} on \${slot.presser})\`);`)}`;
export const PRESS_FROM = `        const waited = l39ShaftWalk(run, perTick, ctx, stance,
            { what: \`\${what} -> the press stance (\${L39_SHAFT.stance.tx},\${L39_SHAFT.stance.ty})\` }, refuse);`;
export const PRESS_TO = `        let waited;
${RETRY(`                    waited = l39ShaftWalk(run, perTick, ctx, stance,
                        { what: \`\${what} -> the press stance (\${L39_SHAFT.stance.tx},\${L39_SHAFT.stance.ty})\` }, refuse);`)}`;
