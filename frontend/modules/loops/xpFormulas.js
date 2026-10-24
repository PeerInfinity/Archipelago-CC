/**
 * `loops/xpFormulas.js` — **A RE-EXPORT. The definitions moved.**
 *
 * The formulas now live in `shared/procgen/xpFormulas.js` (loop-costs L2,
 * 2026-09-06), because the ONE cost algorithm — `shared/procgen/
 * loopCostPlanner.js` — needs them, and `shared/` cannot import out of itself
 * cleanly (it is also its own git repository; the single outward import in
 * `shared/procgen/` is `adapterPrimitives.js` → `mazeRoom/`, a named
 * exception).
 *
 * This file stays because SIX loops-side modules import it by this path
 * (`costDataManager`, `loopBlockBuilder`, `loopState`, `loopUI`,
 * `loopsCostDebugger/costPlanner`, `resourceChannels/resourceChannelsLibrary`)
 * plus `xpFormulas.test.js` and `resourceChannels.test.js`. Moving them would
 * be churn with no reader; keeping the door open costs one line.
 */
export * from '../shared/procgen/xpFormulas.js';
