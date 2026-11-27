/**
 * ⛓ ONE LAYOUT RUN AT A TIME, AND "SETTLED" MEANS THE NODES HAVE STOPPED (region-graph-layout-settled).
 *
 * Every layout the panel runs goes through `startLayout`; every rebuild or new layout that replaces a running one goes
 * through `supersedeLayout`. A run SETTLES exactly once, on its OWN layout's `layoutstop`, which Cytoscape emits after
 * the last position change of that run:
 *   · a `layoutPositions` layout (preset, fcose, breadthfirst, grid, circle, concentric, the Direction-aware and the
 *     procgen grid presets) emits it when every node animation and the fit animation have ended
 *     (`Promise.all(animations)`), or at once when it does not animate;
 *   · cose with `animate: true` moves the nodes live, every frame, and emits it after its final positions and fit.
 * On settle the panel saves the positions, re-seats the location nodes and the player marker, shows "Layout complete",
 * clears `ui.isLayoutRunning`, emits `LAYOUT_SETTLED_EVENT` on the cy and resolves `whenLayoutSettled`.
 *
 * What it replaces: a cy-wide `layoutstop` handler that armed a blind 1050 ms timer. Any layout's `layoutstop` armed
 * it, a superseded one's too, and a superseded cose emits TWO (one from `stop()`, one on its next frame). The rebuild
 * bumped the generation guard BEFORE stopping the old layout, so the stale stop passed it: "Layout complete" and
 * `isLayoutRunning = false` could land while the new layout was still moving, and a reader that counted `layoutstop`s
 * read "stopped" ~0.5–1 s early.
 *
 * A superseded run never settles: its `layoutstop` (from `stop()`) carries a stale token. A superseded cose still runs
 * one more frame (Cytoscape's cose finishes its loop after `stop()`), in which it writes its own positions to its
 * nodes and fits the view; `supersedeLayout` empties that run's node set and drops its fit first, so that frame
 * changes nothing.
 */

export const LAYOUT_SETTLED_EVENT = 'rg-layoutsettled';

const UI_OF_CY = new WeakMap();

function state(ui) {
  if (!ui._layoutRun) ui._layoutRun = { token: 0, runs: 0, settled: 0, waiters: [] };
  return ui._layoutRun;
}

function release(ui, info) {
  const s = state(ui);
  const waiters = s.waiters;
  s.waiters = [];
  for (const resolve of waiters) resolve(info);
}

/**
 * Run `options` as the panel's current layout (stopping a running one first). `beforeSettle(layout)` runs on this
 * run's `layoutstop`, before the settle work. Returns the layout.
 */
export function startLayout(ui, options, { beforeSettle = null } = {}) {
  supersedeLayout(ui, { release: false });
  const s = state(ui);
  const token = ++s.token;
  const run = ++s.runs;
  UI_OF_CY.set(ui.cy, ui);
  const layout = ui.cy.layout(options);
  ui.currentLayout = layout;
  ui.isLayoutRunning = true;
  layout.one('layoutstop', () => {
    if (token !== s.token) return; // superseded: never settles
    s.token += 1; // this run is over: a later stop() of the same layout is stale too
    beforeSettle?.(layout);
    settle(ui, { layout, run });
  });
  layout.run();
  return layout;
}

function settle(ui, info) {
  const s = state(ui);
  ui.isLayoutRunning = false;
  try {
    ui.onLayoutSettled?.(info);
  } finally {
    s.settled += 1;
    ui.cy?.emit?.(LAYOUT_SETTLED_EVENT, [{ run: info.run, settled: s.settled }]);
    release(ui, { run: info.run, settled: s.settled, superseded: false });
  }
}

/**
 * Stop the running layout (if any) WITHOUT settling it. Waiters resolve on the next run's settle, or, when no layout is
 * running once the current task's synchronous work is done (a rebuild that fits saved positions), then.
 */
export function supersedeLayout(ui, { release: releaseIfIdle = true } = {}) {
  const s = state(ui);
  const layout = ui.currentLayout;
  const wasRunning = !!ui.isLayoutRunning;
  s.token += 1;
  ui.isLayoutRunning = false;
  if (layout && wasRunning) {
    // cose (animate: true) runs one more frame after stop(): it writes ITS positions to `options.eles` and fits.
    if (layout.options && ui.cy?.collection) {
      layout.options.eles = ui.cy.collection();
      layout.options.fit = false;
    }
    layout.stop?.();
  }
  if (releaseIfIdle && s.waiters.length) {
    queueMicrotask(() => { if (!ui.isLayoutRunning) release(ui, { run: null, settled: s.settled, superseded: true }); });
  }
}

/** A promise that resolves when no panel layout is running (at once when none is). */
export function whenLayoutSettled(ui) {
  if (!ui.isLayoutRunning) return Promise.resolve({ run: null, settled: state(ui).settled, superseded: false });
  return new Promise((resolve) => state(ui).waiters.push(resolve));
}

/** How many runs have settled so far (a reader watches it advance across a switch). */
export function layoutSettledCount(ui) {
  return state(ui).settled;
}

/**
 * The run state of the panel that owns `cy` (for a reader that has the cy, not the panel: the in-app rows), or null
 * when that panel never started a layout. `running` is true from a run's start to its settle.
 */
export function layoutRunOf(cy) {
  const ui = cy ? UI_OF_CY.get(cy) : null;
  if (!ui) return null;
  return { running: !!ui.isLayoutRunning, settled: state(ui).settled, whenSettled: () => whenLayoutSettled(ui) };
}
