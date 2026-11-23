// Region Map panel (region-map step 3b) — in-app rows.
//
// Each row SETS its own starting state (⚖ in-app tests set their own initial state): it loads its world (unless it is
// loaded already), opens the panel, sets the settings it needs for this session only (`ctx.setSetting`, restored
// after), and closes the panel again when it opened it. The classic-world row (fast) reloads the world loaded before;
// the Seedling rows leave seedling_playthrough loaded (each sets its own world; a reload costs seconds a row). ⛔ No preset-derived hard pins (js-19 e3): every count is DERIVED at run time from
// the loaded rules and an independent `resolveRegionLayout` call, so a later rules move cannot stop a train here.
//
// The rows read the panel's state through `getDebugState()` (what it holds and last painted), never pixels.
import { registerTest } from '../testRegistry.js';
import { buildContext } from '../../tutorials/tutorialContext.js';
import panelManager from '../../../app/core/panelManager.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { stateManagerProxySingleton, getLastRawJsonData } from '../../stateManager/index.js';
import discoveryStateSingleton from '../../discovery/singleton.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { resolveRegionLayout } from '../../procgenCore/regionLayoutResolve.js';
import { computeRegionView, readDiscoverySettings } from '../../regionView/regionViewState.js';
import {
  discoveryContext, enteredFromDiscoveredIndex, exitDiscovery, locationDiscovery, regionDiscovery,
} from '../../regionView/regionViewModel.js';
import { getPanelInstances } from '../../regionMap/index.js';
import { MIN_ZOOM } from '../../procgenCore/mapCamera.js';
import { seedlingCompositeMapStats } from '../../flashPanel/seedlingCompositeMap.js';
import { worldToScreen } from '../../procgenCore/mapCamera.js';
import { squareAt } from '../../regionMap/regionMapOverlay.js';
import { linkShape } from '../../regionMap/regionMapLinkGeometry.js';
import mobileLayoutManager from '../../../app/core/mobileLayoutManager.js';
import { completeModuleInfo } from '../../../app/initialization/completeModuleInfo.js';
import { lookupModuleInfo } from '../../quickLaunch/quickLaunchCatalog.js';
import { ZOOM_BUTTON_FACTOR, ZOOM_BUTTON_PX } from '../../regionMap/regionMapUI.js';
import { REGION_MAP_CLICK_ACTIONS_KEY, regionOfCell } from '../../regionMap/regionMapClickActions.js';
import { defaultClickActions, withInitialValues } from '../../regionView/clickActions.js';
import { resetLoopsToIdle } from './loopsPanelTests.js';
import { writeBundle } from '../../presets/documentBundle.js';
import { atlasCache } from '../../procgenCore/atlasCache.js';

const COMPONENT = 'regionMapPanel';
const WAIT = 15000;
const SEEDLING = 'seedling_playthrough';
const CLASSIC = 'adventure';
/** A generated, non-Seedling world (procgen topdown), loaded by its rules path. */
const GENERATED = 'procgen_topdown';
const GENERATED_RULES = './presets/procgen_topdown/AP_1/AP_1_rules.json';

const rawRules = () => {
  const last = getLastRawJsonData();
  return last?.rawJsonData ? { rules: last.rawJsonData, playerId: String(last.selectedPlayerInfo?.playerId ?? '1') } : null;
};
const panel = () => getPanelInstances()[0] ?? null;
const dbg = () => panel()?.getDebugState() ?? null;
const nextFrames = (n = 2) => new Promise((resolve) => {
  const step = (k) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1)));
  step(n);
});

/**
 * Load the world unless it is the loaded one already, then open the panel and wait for its model. `rulesPath` loads a
 * `./presets/…` rules file instead of `?game=<game>&seed=1` (a generated preset whose seed folder is not `AP_<seed id>`).
 */
async function setUp(testController, game, { rulesPath = null } = {}) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  if (rulesPath) {
    if (ctx.rulesSource() !== rulesPath) await ctx.loadRulesPath(rulesPath);
  } else if (!await ctx.isPresetLoaded(game, 1)) await ctx.loadPreset(game, 1);
  await testController.stateManager.pingWorker?.(`regionMap-${game}`, 5000);
  const opened = getPanelInstances().length === 0;
  if (opened) await panelManager.createPanelForComponent(COMPONENT, 'Region Map', 2);
  testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
  const ready = await testController.pollForCondition(() => {
    const d = dbg();
    return d?.hasModel && d.viewport.w > 0 && d.lastPaint?.cells > 0 && rawRules()?.rules && d.displayRegions.length > 0;
  }, `the Region Map panel opened on ${game} and painted`, WAIT, 100);
  testController.reportCondition(`the panel opens on ${game} and paints`, ready);
  return { ctx, before, opened, ready };
}

async function tearDown(testController, { ctx, before, opened }, { restoreWorld = true } = {}) {
  try { await ctx.restoreSettings(); } catch (e) { testController.log(`restoreSettings: ${e.message}`); }
  if (opened) {
    try { await panelManager.destroyPanelByComponentType(COMPONENT); } catch (e) { testController.log(`close panel: ${e.message}`); }
  }
  if (restoreWorld && typeof before === 'string' && before.startsWith('./presets/') && ctx.rulesSource() !== before) {
    try { await ctx.loadRulesPath(before); } catch (e) { testController.log(`could not reload ${before}: ${e.message}`); }
  }
  ctx.dispose();
}

/** The layout, derived independently of the panel (the same resolver, the same registry). */
function independentLayout(rule = 'R1') {
  const r = rawRules();
  return resolveRegionLayout({ rules: r.rules, player: r.playerId, registry: substrateRegistry, rule });
}

async function fitAllAndSettle(testController, what) {
  panel().fitAll();
  await nextFrames(3);
  return testController.pollForCondition(() => {
    const d = dbg();
    return d && d.lastPaint && d.lastPaint.cells + d.lastPaint.hidden === d.displayRegions.length;
  }, what, 5000, 50);
}

/* ── the classic world (generic layout, generic boxes) — the fast smoke row ── */

export async function testRegionMapClassicWorld(testController) {
  let s = null;
  try {
    s = await setUp(testController, CLASSIC);
    if (!s.ready) return testController.getOverallResult();
    const d = dbg();
    const layout = independentLayout();
    testController.reportCondition(`no grid_cell, no hook → the generic layout (source: ${d.layoutStats.source})`, d.layoutStats.source === 'generic');
    testController.reportCondition(`one cell per display region (${d.displayRegions.length} = the layout's ${layout.positions.size})`,
      d.displayRegions.length === layout.positions.size && Object.keys(d.frames).length === layout.positions.size);
    const ok = await fitAllAndSettle(testController, 'fit all paints every cell');
    const p = dbg().lastPaint;
    testController.reportCondition(`fit all paints every cell (${p.cells}/${d.displayRegions.length})`, ok);
    testController.reportCondition(`every cell is a generic box (${p.generic} generic, ${p.art} art)`, p.generic === p.cells && p.art === 0);
    const want = Object.values(rawRules().rules.regions[rawRules().playerId] ?? {}).reduce((n, r) => n + (r.locations?.length ?? 0), 0);
    const placed = Object.values(dbg().tiles).reduce((n, t) => n + t.length, 0);
    testController.reportCondition(`every location has a square place (${placed}/${want}), none "not on map"`, placed === want && dbg().unplaced.length === 0);
    testController.reportCondition(`the squares painted are the placed ones (${p.squares})`, p.squares === placed);
  } catch (error) {
    testController.reportCondition(`classic-world row error-free: ${error.message}`, false);
  } finally {
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/* ── seedling_playthrough: cells, art, squares, the cell-size toggle ── */

export async function testRegionMapSeedlingPaints(testController) {
  let s = null;
  try {
    const t0 = performance.now();
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
    await s.ctx.setSetting('moduleSettings.regionMap.cellSize', 'level');
    const layout = independentLayout();
    let d = dbg();
    testController.reportCondition(`the Seedling hook laid it out (source: ${d.layoutStats.source})`, d.layoutStats.source === 'hook');
    testController.reportCondition(`N cells = the layout's display regions (${d.displayRegions.length} = ${layout.positions.size})`,
      d.displayRegions.length === layout.positions.size);
    testController.reportCondition(`the groups are the layout's (${d.groups} = ${layout.groups.length})`, d.groups === layout.groups.length);
    const all = await fitAllAndSettle(testController, 'fit all paints all N cells');
    testController.reportCondition(`fit all paints all N cells (${dbg().lastPaint.cells})`, all && dbg().lastPaint.cells === layout.positions.size);
    testController.reportCondition(`every cell is drawn by its substrate's painter (${dbg().lastPaint.art} art)`, dbg().lastPaint.art === dbg().lastPaint.cells);

    // the art bakes for the visible cells: nothing pending, nothing failed
    const baked = await testController.pollForCondition(() => {
      const st = seedlingCompositeMapStats();
      return st.requested > 0 && st.pending === 0;
    }, 'every requested bake landed', 60000, 200);
    const st = seedlingCompositeMapStats();
    testController.reportCondition(`the art bakes for the visible cells (${st.baked} baked, ${st.pending} pending, ${st.failures.length} failed)`,
      baked && st.failures.length === 0);
    await nextFrames(3);
    d = dbg();
    testController.log(`PERF: open→first paint ${d.counters.firstPaintMs?.toFixed(0)} ms · model ${d.counters.modelMs?.toFixed(1)} ms · `
      + `${st.baked} bakes · ${d.counters.paints} paints for ${d.counters.paintRequests} requests (${d.counters.artRedraws} art redraws) · `
      + `row ${(performance.now() - t0).toFixed(0)} ms`);
    testController.reportCondition(`repaints are coalesced (${d.counters.paints} paints ≤ ${d.counters.paintRequests} requests)`,
      d.counters.paints <= d.counters.paintRequests);

    // the squares: exactly the visible levels' tiles, every location of the world placed, ≥ min at the minimum zoom
    const want = Object.values(rawRules().rules.regions[rawRules().playerId] ?? {}).reduce((n, r) => n + (r.locations?.length ?? 0), 0);
    const placed = Object.values(d.tiles).reduce((n, t) => n + t.length, 0);
    testController.reportCondition(`every location is placed (${placed}/${want}; not on map: ${d.unplaced.length})`, placed + d.unplaced.length === want);
    const visibleTiles = d.lastPaint.keys.reduce((n, k) => n + (d.tiles[k]?.length ?? 0), 0);
    testController.reportCondition(`squares on screen = the visible levels' location tiles (${d.lastPaint.squares} = ${visibleTiles})`,
      d.lastPaint.squares === visibleTiles);
    panel().setCamera({ zoom: MIN_ZOOM });
    await nextFrames(3);
    const min = dbg().settings.minSquarePx;
    const sq = dbg().squares;
    testController.reportCondition(`at the minimum zoom every square is ≥ ${min} px (smallest ${Math.min(...sq.map((q) => q.side)).toFixed(1)}, ${sq.length} squares)`,
      sq.length > 0 && sq.every((q) => q.side >= min));
    testController.reportCondition('event squares are drawn as events', sq.some((q) => q.kind === 'event') && sq.some((q) => q.kind === 'item'));

    // the cell-size toggle changes the frames: uniform = one square for every cell
    const levelFrames = JSON.stringify(dbg().frames);
    await s.ctx.setSetting('moduleSettings.regionMap.cellSize', 'uniform');
    const toggled = await testController.pollForCondition(() => JSON.stringify(dbg().frames) !== levelFrames, 'the frames changed', 5000, 50);
    const cells = Object.values(dbg().frames).map((f) => f.cell);
    testController.reportCondition('uniform: the frames change, every cell is the same square',
      toggled && cells.every((c) => c.w === cells[0].w && c.h === cells[0].w));
    await s.ctx.setSetting('moduleSettings.regionMap.cellSize', 'level');
    const back = await testController.pollForCondition(() => JSON.stringify(dbg().frames) === levelFrames, 'the frames came back', 5000, 50);
    testController.reportCondition('back to sized by level: the same frames as before', back);
  } catch (error) {
    testController.reportCondition(`Seedling paint row error-free: ${error.message}`, false);
  } finally {
    if (s) await tearDown(testController, s, { restoreWorld: false });
  }
  return testController.getOverallResult();
}

/* ── follow player ── */

export async function testRegionMapFollowPlayer(testController) {
  let s = null;
  const gameState = getGameStateSingleton();
  const startRegion = gameState?.getCurrentRegion?.() ?? null;
  try {
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
    await s.ctx.setSetting('moduleSettings.regionMap.followPlayer', true);
    const p = panel();
    p.controls.follow.checked = true;
    p.follow = true;
    const d0 = dbg();
    // a rules region in another display region than the current one (and not the start's)
    const regions = stateManagerProxySingleton.getStaticData()?.regions;
    const view = p.view.get();
    const target = [...(regions?.keys?.() ?? [])].find((n) => {
      const k = view.regions.get(n)?.displayKey;
      return k && k !== d0.currentDisplayRegion && k !== d0.start && d0.frames[k];
    });
    if (!target) throw new Error('no region in another display region');
    const key = view.regions.get(target).displayKey;
    gameState.setCurrentRegion(target);
    const inside = () => {
      const d = dbg();
      const c = d.frames[key]?.cell;
      return d.currentDisplayRegion === key && !!c
        && Math.abs(d.camera.x - (c.x + c.w / 2)) < 1 && Math.abs(d.camera.y - (c.y + c.h / 2)) < 1;
    };
    const followed = await testController.pollForCondition(inside, `the camera eased onto ${key}`, 5000, 50);
    testController.reportCondition(`follow player re-centres on the new region's cell (${target} → ${key})`, followed);
    p.setCamera({ x: dbg().camera.x + 500 });
    testController.reportCondition('a manual pan turns follow off, and the control shows it', dbg().follow === false && p.controls.follow.checked === false);
  } catch (error) {
    testController.reportCondition(`follow row error-free: ${error.message}`, false);
  } finally {
    if (startRegion) gameState.setCurrentRegion(startRegion);
    if (s) await tearDown(testController, s, { restoreWorld: false });
  }
  return testController.getOverallResult();
}

/* ── discovery mode ── */

export async function testRegionMapDiscovery(testController) {
  let s = null;
  let savedDiscovery = null;
  try {
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    // ⛓ its own discovery state: only the start regions discovered (an earlier row may have discovered more),
    // undiscovered regions shown as placeholders; all restored after.
    savedDiscovery = discoveryStateSingleton.getSerializableState();
    await s.ctx.setSetting('moduleSettings.discovery.undiscoveredDisplay', 'hidden');
    await s.ctx.setSetting('moduleSettings.regionMap.showUndiscovered', true);
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', true);
    const active = await testController.pollForCondition(() => dbg()?.discoveryActive === true, 'discovery mode on in the view', 8000, 50);
    testController.reportCondition('discovery mode reaches the panel\'s view', active);
    // cleared AFTER the mode switch (turning the mode on discovers what the session has seen), then the start
    // region's whole display group discovered: its exits to OTHER levels are the frontier, drawn as fog.
    discoveryStateSingleton.clearDiscovery();
    const startKey = dbg().start;
    const startMembers = panel().view.get().displayGroups.get(startKey)?.members ?? [];
    for (const m of startMembers) discoveryStateSingleton.discoverRegion(m);
    testController.eventBus.publish('discovery:changed', {}, 'tests');
    const fewer = await testController.pollForCondition(() => {
      const v = dbg()?.visibility ?? {};
      return Object.entries(v).filter(([, x]) => x === 'shown').map(([k]) => k).join() === startKey;
    }, 'the cleared discovery reached the view', 8000, 50);
    testController.log(`after the clear: ${JSON.stringify(Object.values(dbg().visibility).reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {}))}`);
    testController.reportCondition(`only the start level (${startKey}, ${startMembers.length} region(s) discovered) is shown`, fewer);
    const viewKeys = Object.keys(dbg().visibility);
    testController.reportCondition(`the view's display groups cover the panel's cells (sub-regions fold: ${viewKeys.length} groups, ${dbg().displayRegions.length} cells)`,
      dbg().displayRegions.every((k) => viewKeys.includes(k)));
    const check = async (label) => {
      await fitAllAndSettle(testController, `${label}: fit all`);
      const d = dbg();
      const vis = d.visibility;
      const hidden = d.displayRegions.filter((k) => vis[k] === 'hidden');
      const placeholder = d.displayRegions.filter((k) => vis[k] === 'placeholder');
      const drawn = new Set(d.lastPaint.keys);
      testController.reportCondition(`${label}: no hidden region is drawn (${hidden.length} hidden)`, hidden.every((k) => !drawn.has(k)));
      testController.reportCondition(`${label}: every placeholder is drawn as fog (${d.lastPaint.fogged} fogged = ${placeholder.length})`,
        d.lastPaint.fogged === placeholder.length && placeholder.every((k) => drawn.has(k)));
      testController.reportCondition(`${label}: every shown region is drawn (${drawn.size} = ${d.displayRegions.length - hidden.length})`,
        drawn.size === d.displayRegions.length - hidden.length);
      const fogKeys = new Set(placeholder);
      testController.reportCondition(`${label}: no square in a fogged cell`, d.squares.every((q) => !fogKeys.has(q.key)));
      return { hidden: hidden.length, placeholder: placeholder.length };
    };
    const a = await check('show undiscovered');
    testController.reportCondition(`from the start level only, some regions are fog and some hidden (${a.hidden} hidden, ${a.placeholder} fog)`,
      a.hidden > 0 && a.placeholder > 0);
    await s.ctx.setSetting('moduleSettings.regionMap.showUndiscovered', false);
    await testController.pollForCondition(() => dbg().settings.showUndiscovered === false, 'the control reached the panel', 5000, 50);
    await nextFrames(3);
    const b = await check('hide undiscovered');
    testController.reportCondition(`hiding undiscovered regions turns the fog into hidden (${b.placeholder} fog, ${b.hidden} hidden)`,
      b.placeholder === 0 && b.hidden === a.hidden + a.placeholder);

    // ⛓ the recompute cost in discovery mode (`hasEntranceFromDiscoveredRegion` is O(R²·E) and runs per frame)
    const r = rawRules();
    const discoveryState = await readDiscoverySettings(settingsManager);
    const args = {
      snapshot: stateManagerProxySingleton.getLatestStateSnapshot(), staticData: stateManagerProxySingleton.getStaticData(),
      discovery: discoveryStateSingleton, discoveryState, registry: substrateRegistry, rules: r.rules, playerId: r.playerId,
      showUndiscovered: true,
    };
    const reps = 20;
    const timed = (fn) => {
      fn();
      const t0 = performance.now();
      for (let i = 0; i < reps; i += 1) fn();
      return (performance.now() - t0) / reps;
    };
    const on = timed(() => computeRegionView(args));
    const off = timed(() => computeRegionView({ ...args, discoveryState: { active: false, settings: discoveryState.settings } }));
    // The discovery decisions alone, with the per-region scan (the Region Graph's context) and with the index.
    const rd = args.staticData.regions;
    const decide = (ctx) => {
      for (const [name, data] of rd) {
        regionDiscovery(name, ctx);
        for (const l of data.locations ?? []) locationDiscovery(l.name, name, ctx);
        for (const e of data.exits ?? []) {
          if (e.connected_region && rd.has(e.connected_region)) {
            exitDiscovery({ source: name, target: e.connected_region, forwardExitName: e.name, reverseExitName: '' }, ctx);
          }
        }
      }
    };
    const base = { active: true, settings: discoveryState.settings, discovery: discoveryStateSingleton, regions: rd, showUndiscovered: true };
    const scan = timed(() => decide(discoveryContext(base)));
    const indexed = timed(() => decide(discoveryContext({ ...base, enteredFromDiscovered: enteredFromDiscoveredIndex(rd, discoveryStateSingleton) })));
    testController.log(`PERF: computeRegionView on ${SEEDLING} (${rd.size} regions): discovery ON ${on.toFixed(2)} ms, OFF ${off.toFixed(2)} ms `
      + `per recompute (mean of ${reps}); the discovery decisions alone: scan ${scan.toFixed(2)} ms, index ${indexed.toFixed(2)} ms`);
    testController.reportCondition(`the discovery recompute was measured (ON ${on.toFixed(2)} ms, OFF ${off.toFixed(2)} ms)`, Number.isFinite(on));
  } catch (error) {
    testController.reportCondition(`discovery row error-free: ${error.message}`, false);
  } finally {
    if (s) await tearDown(testController, s, { restoreWorld: false });
    if (savedDiscovery) {
      discoveryStateSingleton.loadFromSerializedState(savedDiscovery);
      testController.eventBus.publish('discovery:changed', {}, 'tests');
    }
  }
  return testController.getOverallResult();
}


/* ── step 4 / CA-S3: CLICKS — the panel's click actions, through its real pointer events ── */

const STRIP = '.region-map-click-strip-host';
const stripSummary = () => panel()?.clickStripHost?.querySelector('.click-actions-strip-summary')?.textContent ?? '';

/**
 * The Map's click actions (`moduleSettings.regionMap.clickActions`, CA-S3) for this row only: `clickActions`, or the
 * defaults. Session-only (`ctx.setSetting`, put back by `restoreSettings`). It waits for the panel's own load first
 * (a first run SAVES its copy of the Region Graph's, and a persistent write would clear this override), then until
 * the panel holds the value a click reads. Follow is turned off: a move would ease the camera under the next click.
 */
async function setClickOptions(testController, ctx, clickActions = defaultClickActions()) {
  await panel()?.clickActionsReady;
  await ctx.setSetting(REGION_MAP_CLICK_ACTIONS_KEY, clickActions);
  // ⛓ CA-S4: once loaded, the Map's strip seeds the panel-owned actions this config does not name (all OFF on the Map,
  // written session-only over this override), so the panel holds the row's config plus those values.
  const want = JSON.stringify(withInitialValues('regionMap', clickActions).settings);
  const held = await testController.pollForCondition(() => JSON.stringify(dbg()?.clickActions) === want,
    'the panel holds the row\'s click actions', 3000, 25);
  if (!held) testController.reportCondition(`the panel holds the row's click actions (${JSON.stringify(dbg()?.clickActions)})`, false);
  await ctx.setSetting('moduleSettings.regionMap.followPlayer', false);
  const p = panel();
  if (p) { p.follow = false; p.controls.follow.checked = false; }
  return held;
}

/** The `runClickActions` answer's result for action `id`, or undefined (a click's `lastClick.result`). */
const actionResult = (click, id) => click?.result?.results?.find((r) => r.id === id)?.result;

/** Dispatch a pointer down + up (no drag) at canvas point (sx, sy) and wait for the panel's click to land. */
async function clickCanvas(testController, sx, sy, what) {
  const p = panel();
  const n = p.clickCount;
  const r = p.canvas.getBoundingClientRect();
  const init = { clientX: r.left + sx, clientY: r.top + sy, pointerId: 1, bubbles: true, button: 0 };
  p.canvas.dispatchEvent(new PointerEvent('pointerdown', init));
  p.canvas.dispatchEvent(new PointerEvent('pointerup', init));
  const ok = await testController.pollForCondition(() => panel().clickCount > n, `the click on ${what} landed`, 5000, 25);
  // `regions.open` (on by default) activates the Regions panel, which can hide this tab: bring it back.
  testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
  await testController.pollForCondition(() => dbg()?.viewport.w > 0 && panel().canvas.getBoundingClientRect().width > 0,
    'the Region Map tab is showing again', 3000, 25);
  await nextFrames(2);
  return ok ? panel().lastClick : null;
}

/** Centre the camera on cell `key`, zoomed so its level fills most of the view, and wait for that paint. */
async function focusCell(testController, key) {
  const d = dbg();
  const f = d.frames[key];
  if (!f) return false;
  const zoom = Math.min(d.viewport.w / f.w, d.viewport.h / f.h) * 0.8;
  panel().setCamera({ x: f.x + f.w / 2, y: f.y + f.h / 2, zoom });
  await nextFrames(3);
  return testController.pollForCondition(() => {
    const c = dbg().camera;
    return Math.abs(c.zoom - zoom) < 1e-9 && dbg().lastPaint?.keys?.includes(key);
  }, `focused on ${key}`, 3000, 25);
}

/** A canvas point inside display cell `key`'s level rectangle that is on no location square (null if none). */
function cellPointOffSquares(key) {
  const d = dbg();
  const f = d.frames[key];
  if (!f) return null;
  const squares = d.squares;
  const grid = [];
  for (let v = 0.02; v < 1; v += 0.06) for (let u = 0.02; u < 1; u += 0.06) grid.push([u, v]);
  for (const [u, v] of [[0.5, 0.5], ...grid]) {
    const s = worldToScreen(d.camera, d.viewport, f.x + f.w * u, f.y + f.h * v);
    if (s.x < 1 || s.y < 1 || s.x > d.viewport.w - 1 || s.y > d.viewport.h - 1) continue;
    if (!squareAt(squares, s.x, s.y)) return s;
  }
  return null;
}

/** A painted square for `location` that a click at its centre hits (the topmost there), or null. */
function squarePoint(location) {
  const squares = dbg().squares;
  const q = squares.find((x) => x.location === location);
  if (!q) return null;
  return squareAt(squares, q.sx, q.sy)?.location === location ? { x: q.sx, y: q.sy } : null;
}

/**
 * A reachable rules region the player is not in, that a click on its cell moves to (`regionOfCell` = it): the camera
 * is focused on its cell and a point off every square found. → { region, key, point } | null (the reasons logged)
 */
async function reachableTarget(testController) {
  const view = panel().view.get();
  const cur = gameStateRegion();
  const seen = { cells: 0, clickable: 0, reachable: 0, focused: 0, visibility: {} };
  // A hidden cell is not clickable (the Region Graph hides those nodes); a placeholder is (an undiscovered node taps).
  // The player's own cell counts when it moves to another region (a level the player is in a sub-region of).
  for (const [key, g] of view.displayGroups) {
    seen.cells += 1;
    seen.visibility[g.visibility] = (seen.visibility[g.visibility] ?? 0) + 1;
    if (g.visibility === 'hidden' || !dbg().frames[key]) continue;
    seen.clickable += 1;
    const region = regionOfCell(key, g.members);
    if (region === cur || !view.regions.get(region)?.reachable) continue;
    seen.reachable += 1;
    if (!await focusCell(testController, key)) continue;
    seen.focused += 1;
    const point = cellPointOffSquares(key);
    if (point) return { region, key, point };
  }
  const reach = [...view.regions.values()].filter((r) => r.reachable).map((r) => `${r.name}→${r.displayKey}`);
  testController.log(`no reachable target: current ${cur} (cell ${view.currentDisplayRegion}); ${JSON.stringify(seen)}; reachable: ${reach.slice(0, 12).join(', ')}`);
  return null;
}
const gameStateRegion = () => { try { return getGameStateSingleton().getCurrentRegion(); } catch { return null; } };

/** The unchecked locations whose painted square a click hits, by the view's square colour key. */
function squaresByColor(color) {
  return dbg().squares.filter((q) => q.color === color && squarePoint(q.location)).map((q) => q.location);
}

/** Record the player's region and path, and give back a restore that puts both back. */
function savePlayer() {
  const gs = getGameStateSingleton();
  const region = gs.getCurrentRegion();
  const path = gs.getPath().map((e) => ({ ...e }));
  return () => { try { gs.setPath(path, region); gs.setCurrentRegion(region); } catch { /* best effort */ } };
}

/** Wait for the state manager to report `location` checked (true) or the check's rejection reason. */
function watchCheck(testController, location) {
  let rejected = null;
  const onRej = (d) => { if (d?.locationName === location) rejected = d.reason ?? 'rejected'; };
  testController.eventBus.subscribe('stateManager:locationCheckRejected', onRej, 'tests');
  const isChecked = () => {
    const c = stateManagerProxySingleton.getLatestStateSnapshot?.()?.checkedLocations;
    return Array.isArray(c) ? c.includes(location) : c instanceof Set ? c.has(location) : false;
  };
  return {
    isChecked,
    rejected: () => rejected,
    stop: () => testController.eventBus.unsubscribe?.('stateManager:locationCheckRejected', onRej, 'tests'),
  };
}

/** Click the first clickable accessible (green) square: hover it, click it, wait for the check. → its name | null */
async function checkGreenSquare(testController, label, { assert = true } = {}) {
  await fitAllAndSettle(testController, `${label}: fit all`);
  let loc = squaresByColor('accessible')[0];
  if (loc) {
    await focusCell(testController, dbg().squares.find((q) => q.location === loc).key);
    if (!squarePoint(loc)) loc = squaresByColor('accessible')[0];
  }
  if (assert) testController.reportCondition(`${label}: an accessible (green) location square on screen (${loc ?? 'none'})`, !!loc);
  if (!loc) return null;
  const pt = squarePoint(loc);
  const r = panel().canvas.getBoundingClientRect();
  panel().canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + pt.x, clientY: r.top + pt.y, pointerId: 1, bubbles: true }));
  const tip = panel().tooltip.textContent;
  const w = watchCheck(testController, loc);
  const c = await clickCanvas(testController, pt.x, pt.y, `square ${loc}`);
  const ok = await testController.pollForCondition(w.isChecked, `${label}: ${loc} checked`, 5000, 50);
  w.stop();
  if (assert) {
    testController.reportCondition(`${label}: hovering the square names the location as the Region Graph labels it ("${tip.split('\n')[0]}")`,
      tip.startsWith(`${loc}`) && tip.split('\n')[0].endsWith(': accessible'));
    testController.reportCondition(`${label}: the click resolves to a LOCATION click on ${loc} (got ${c?.target}:${c?.location})`,
      c?.target === 'location' && c.location === loc);
    testController.reportCondition(`${label}: click an accessible location square → checked (${loc})`, ok);
  }
  return ok ? loc : null;
}

/**
 * The shared legs: a click on an accessible square checks it (and the hover names it); a click on a reachable
 * region's cell moves the player there. A world whose start reaches no other cell gets more green squares checked
 * first (up to 6; their items open the way) — the row's own state. Returns every location it checked (the caller
 * reloads the world).
 */
async function clickLegs(testController, label) {
  const checked = [];
  const first = await checkGreenSquare(testController, label);
  if (first) checked.push(first);
  await fitAllAndSettle(testController, `${label}: fit all (moves)`);
  let t = await reachableTarget(testController);
  for (let i = 0; !t && i < 6; i += 1) {
    const more = await checkGreenSquare(testController, `${label} (opening the way)`, { assert: false });
    if (!more) break;
    checked.push(more);
    t = await reachableTarget(testController);
  }
  testController.reportCondition(`${label}: a reachable region in another cell, with a point off its squares (${t?.region ?? 'none'}; ${checked.length} check(s) first)`, !!t);
  if (t) {
    const c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key}`);
    testController.reportCondition(`${label}: the click resolves to a REGION click on ${t.region} (got ${c?.target}:${c?.region})`,
      c?.target === 'region' && c.region === t.region);
    const moved = await testController.pollForCondition(() => gameStateRegion() === t.region, `${label}: the player moved to ${t.region}`, 5000, 50);
    testController.reportCondition(`${label}: click a reachable region → the player moves there (${gameStateRegion()})`, moved);
    testController.reportCondition(`${label}: the selection is the clicked cell`, dbg().selected === t.key);
  }
  return checked;
}

/**
 * The checks a row made are undone by reloading the loaded world (the state manager's worker has no uncheck
 * command): a later row starts with nothing checked by this one.
 */
async function reloadIfChecked(testController, ctx, names, { before = null, restoreWorld = false } = {}) {
  if (!names.length || !ctx) return;
  const src = ctx.rulesSource();
  // tearDown reloads the world loaded before when it was another preset: that load clears these checks too.
  if (restoreWorld && typeof before === 'string' && before.startsWith('./presets/') && before !== src) return;
  try { if (typeof src === 'string' && src.startsWith('./presets/')) await ctx.loadRulesPath(src); }
  catch (e) { testController.log(`reload after the checks: ${e.message}`); }
}

/**
 * The Map's OWN click actions change what a Region Map click does (CA-S3; before it, step 4's interim read the Region
 * Graph's `regionGraph.*` keys). Session-only: the route OFF → a region click moves nobody; the route "move the
 * player there" (`{ from: 'player' }`) → the same click moves the player directly. `ctx.restoreSettings()` puts them
 * back.
 */
async function mapRouteLeg(testController, label, ctx) {
  const withRoute = (route) => ({ ...defaultClickActions(), region: { ...defaultClickActions().region, 'path.route': route } });
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
    await setClickOptions(testController, ctx, withRoute(false));
    await fitAllAndSettle(testController, `${label}: fit all (route leg)`);
    const t = await reachableTarget(testController);
    testController.reportCondition(`${label}: a reachable target for the route leg (${t?.region ?? 'none'})`, !!t);
    if (!t) return;
    const before = gameStateRegion();
    let c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key} (route off)`);
    await nextFrames(4);
    testController.reportCondition(`${label}: regionMap.clickActions route OFF → the Region Map click moves nobody (${gameStateRegion()})`,
      c?.target === 'region' && c.result?.ran === true && actionResult(c, 'path.route') === undefined && gameStateRegion() === before);
    await setClickOptions(testController, ctx, withRoute({ from: 'player' }));
    c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key} (route: move the player)`);
    const moved = await testController.pollForCondition(() => gameStateRegion() === t.region, `${label}: moved directly`, 5000, 50);
    const r = actionResult(c, 'path.route');
    testController.reportCondition(`${label}: regionMap.clickActions route "move the player there" → the same click moves the player (a ${r?.kind} move to ${gameStateRegion()})`,
      moved && r?.ok === true && r.kind === 'move');
  } finally {
    await ctx.restoreSettings();
    testController.reportCondition(`${label}: the row's click settings are put back`, ctx.settingsRestored());
  }
}

/** Generated, non-Seedling (procgen topdown AP_1) — the fast row. */
export async function testRegionMapClicksGenerated(testController) {
  let s = null;
  let restorePlayer = null;
  let checked = [];
  try {
    s = await setUp(testController, GENERATED, { rulesPath: GENERATED_RULES });
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
    await setClickOptions(testController, s.ctx);
    restorePlayer = savePlayer();
    checked = await clickLegs(testController, GENERATED);
    await s.ctx.restoreSettings();
    await mapRouteLeg(testController, GENERATED, s.ctx);
  } catch (error) {
    testController.reportCondition(`generated-world clicks row error-free: ${error.message}`, false);
  } finally {
    restorePlayer?.();
    await reloadIfChecked(testController, s?.ctx, checked, { before: s?.before, restoreWorld: true });
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/**
 * zoom-links: the toolbar's + / −, a two-finger pinch and the neighbour lines, on procgen_topdown AP_1 (fast). The
 * + press multiplies the zoom by ZOOM_BUTTON_FACTOR and − divides it back; a pinch of two synthetic pointers (distinct
 * pointerIds) zooms by the finger-distance ratio and fires NO click; the links painted are the model's, cross-group
 * and neighbour counted apart. Counts derived from the panel's own model (no preset pins).
 */
export async function testRegionMapZoomPinchLinks(testController) {
  let s = null;
  try {
    s = await setUp(testController, GENERATED, { rulesPath: GENERATED_RULES });
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.regionMap.showLinks', true);
    await s.ctx.setSetting('moduleSettings.regionMap.followPlayer', true);
    const p = panel();
    p.follow = true;
    p.controls.follow.checked = true;
    const ok = await fitAllAndSettle(testController, 'fit all paints every cell');
    testController.reportCondition('fit all paints every cell', ok);
    p.follow = true;
    p.controls.follow.checked = true;

    // + then −, by the real buttons
    const zoomOf = () => Number(p.canvas.dataset.zoom);
    const z0 = dbg().camera.zoom;
    const plus = p.root.querySelector('button.region-map-zoom-in');
    const minus = p.root.querySelector('button.region-map-zoom-out');
    testController.reportCondition('the toolbar has + and − buttons beside Fit all',
      !!plus && !!minus && minus.previousElementSibling?.classList.contains('region-map-fit-all') && plus.previousElementSibling === minus);
    const side = plus ? plus.getBoundingClientRect() : null;
    testController.reportCondition(`the buttons are large enough to tap (${side?.width.toFixed(0)}×${side?.height.toFixed(0)} px ≥ ${ZOOM_BUTTON_PX - 1})`,
      !!side && side.width >= ZOOM_BUTTON_PX - 1 && side.height >= ZOOM_BUTTON_PX - 1);
    plus.click();
    const zin = await testController.pollForCondition(() => Math.abs(zoomOf() - z0 * ZOOM_BUTTON_FACTOR) < 1e-9 * z0,
      'the + press painted', 3000, 25);
    testController.log(`ZOOM: fit ${z0.toPrecision(6)} → + ${zoomOf().toPrecision(6)} (×${(zoomOf() / z0).toFixed(4)})`);
    testController.reportCondition(`+ multiplies the zoom by ${ZOOM_BUTTON_FACTOR.toFixed(4)} (${z0.toPrecision(4)} → ${zoomOf().toPrecision(4)})`, zin);
    testController.reportCondition('a + press turns Follow off, as the wheel does', dbg().follow === false && p.controls.follow.checked === false);
    testController.reportCondition('the press stamps canvas.dataset.zoomedAt', Number(p.canvas.dataset.zoomedAt) > 0);
    minus.click();
    const zout = await testController.pollForCondition(() => Math.abs(zoomOf() - z0) < 1e-9 * z0, 'the − press painted', 3000, 25);
    testController.reportCondition(`− divides it back (${zoomOf().toPrecision(4)})`, zout);

    // a two-finger pinch: fingers 100 px apart around the centre → 200 px apart
    const r = p.canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const clicks = p.clickCount;
    const zp = dbg().camera.zoom;
    const ev = (type, id, x, y) => p.canvas.dispatchEvent(new PointerEvent(type, {
      clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 11, bubbles: true, button: 0,
    }));
    ev('pointerdown', 11, cx - 50, cy);
    ev('pointerdown', 12, cx + 50, cy);
    for (let k = 1; k <= 5; k += 1) {
      ev('pointermove', 11, cx - 50 - 10 * k, cy);
      ev('pointermove', 12, cx + 50 + 10 * k, cy);
    }
    ev('pointerup', 12, cx + 100, cy);
    ev('pointerup', 11, cx - 100, cy);
    await nextFrames(3);
    const zr = dbg().camera.zoom / zp;
    testController.log(`PINCH: 100 → 200 px apart: zoom ${zp.toPrecision(6)} → ${dbg().camera.zoom.toPrecision(6)} (×${zr.toFixed(4)}); `
      + `pinches ${dbg().pinch.pinches}, pinch moves ${dbg().pinch.pinchMoves}`);
    testController.reportCondition(`the pinch zoomed by the finger-distance ratio (×${zr.toFixed(4)} = ×2)`, Math.abs(zr - 2) < 1e-6);
    testController.reportCondition(`the pinch fired no click (clicks ${clicks} → ${p.clickCount})`, p.clickCount === clicks && dbg().pinch.pointers === 0);

    // the links: every one on screen after Fit all, the two kinds counted apart
    await fitAllAndSettle(testController, 'fit all again');
    await nextFrames(2);
    const d = dbg();
    const m = p.model;
    const wantNb = m.neighbourLinks.length;
    testController.log(`LINKS: ${d.lastPaint.links} cross-group (model ${m.links.length}), ${d.lastPaint.neighbourLinks} neighbour (model ${wantNb})`);
    testController.reportCondition(`the neighbour lines are drawn (${d.lastPaint.neighbourLinks} = the model's ${wantNb}, > 0)`,
      wantNb > 0 && d.lastPaint.neighbourLinks === wantNb && d.neighbourLinks === wantNb);
    testController.reportCondition(`the cross-group lines are counted apart (${d.lastPaint.links} = ${m.links.length})`, d.lastPaint.links === m.links.length);
    // ⛓ link-ends: how the lines END — a gap mark between adjacent cells, else a line clipped to the borders; an
    // arrowhead on every kind but join. The wanted counts are the geometry module's own answer over the model.
    const shapes = [...m.links, ...m.neighbourLinks].map((l) => linkShape(l, p.frames)).filter(Boolean);
    const want = { gap: shapes.filter((q) => q.form === 'gap').length, line: shapes.filter((q) => q.form === 'line').length,
      heads: shapes.filter((q) => q.head).length };
    testController.log(`LINK ENDS: ${d.lastPaint.gapMarks} gap marks (want ${want.gap}), ${d.lastPaint.edgeLines} edge-clipped lines `
      + `(want ${want.line}), ${d.lastPaint.arrowheads} arrowheads (want ${want.heads})`);
    testController.reportCondition(`every link is drawn as a gap mark or a border-clipped line, as linkShape says (${d.lastPaint.gapMarks}/${d.lastPaint.edgeLines} = ${want.gap}/${want.line})`,
      want.gap > 0 && d.lastPaint.gapMarks === want.gap && d.lastPaint.edgeLines === want.line);
    testController.reportCondition(`no arrowhead on a join (${d.lastPaint.arrowheads} drawn = ${want.heads} non-join links)`, d.lastPaint.arrowheads === want.heads);
    await s.ctx.setSetting('moduleSettings.regionMap.showLinks', false);
    const off = await testController.pollForCondition(() => dbg().lastPaint.neighbourLinks === 0 && dbg().lastPaint.links === 0,
      'Links off draws none', 3000, 25);
    testController.reportCondition('the Links box turns the neighbour lines off too', off);
  } catch (error) {
    testController.reportCondition(`zoom/pinch/links row error-free: ${error.message}`, false);
  } finally {
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/** seedling_playthrough — the moves, a check, and the refusal of an inaccessible square (the Region Graph's). */
export async function testRegionMapClicksSeedling(testController) {
  let s = null;
  let restorePlayer = null;
  let checked = [];
  try {
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
    await setClickOptions(testController, s.ctx);
    restorePlayer = savePlayer();
    checked = await clickLegs(testController, SEEDLING);

    // An inaccessible (red) square: the same refusal the Region Graph's check gets — the state manager's
    // `not_accessible` (the gate is downstream of both panels). The Region Graph's own dispatch of the same check,
    // through ITS dispatcher and originator, is the control.
    await fitAllAndSettle(testController, 'fit all (refusal)');
    let red = squaresByColor('inaccessible')[0];
    if (red) {
      await focusCell(testController, dbg().squares.find((q) => q.location === red).key);
      if (!squarePoint(red)) red = squaresByColor('inaccessible')[0];
    }
    testController.reportCondition(`an inaccessible (red) location square on screen (${red ?? 'none'})`, !!red);
    if (red) {
      const pt = squarePoint(red);
      let w = watchCheck(testController, red);
      const c = await clickCanvas(testController, pt.x, pt.y, `square ${red}`);
      const mapRefused = await testController.pollForCondition(() => w.rejected() != null, `the Region Map's check of ${red} was refused`, 5000, 50);
      const mapReason = w.rejected();
      w.stop();
      testController.reportCondition(`click an inaccessible square → refused (${mapReason}), not checked`,
        c?.target === 'location' && mapRefused && !w.isChecked());
      const { moduleDispatcher: rgDispatcher } = await import('../../regionGraph/index.js');
      const { checkLocation } = await import('../../regionView/regionActions.js');
      const { REGION_GRAPH_ORIGINATORS } = await import('../../regionGraph/regionGraphOriginators.js');
      w = watchCheck(testController, red);
      checkLocation({ dispatcher: rgDispatcher }, { locationName: red, regionName: c.region, originator: REGION_GRAPH_ORIGINATORS.check });
      await testController.pollForCondition(() => w.rejected() != null, `the Region Graph's check of ${red} was refused`, 5000, 50);
      testController.reportCondition(`the Region Graph's own check of it gets the same refusal (${w.rejected()} = ${mapReason})`,
        w.rejected() === mapReason && mapReason === 'not_accessible');
      w.stop();
    }
  } catch (error) {
    testController.reportCondition(`Seedling clicks row error-free: ${error.message}`, false);
  } finally {
    restorePlayer?.();
    await reloadIfChecked(testController, s?.ctx, checked);
    if (s) await tearDown(testController, s, { restoreWorld: false });
  }
  return testController.getOverallResult();
}

/**
 * Loop mode: a Region Map click PLANS, as a Region Graph click does — its route moves carry `regionView-path-regionMap`
 * (CA-S3, R7), a planning source (`loops/loopModeExemptions.js`), so the strict loop-mode gate lets the move through
 * and its path append is kept. The "On click" strip now sits in front of Loop's click intercepts: this row is that
 * check.
 */
export async function testRegionMapClicksLoopMode(testController) {
  let s = null;
  let restorePlayer = null;
  let loopsEl = null;
  let loopModeAtEntry = null;
  let pathBefore = null;
  let savedDiscovery = null;
  const { centralRegistry } = await import('../../../app/core/centralRegistry.js');
  const loopState = (await import('../../loops/loopStateSingleton.js')).default;
  const isLoopModeActive = () => centralRegistry.getPublicFunction?.('loops', 'isLoopModeActive')?.() === true;
  const setPath = centralRegistry.getPublicFunction?.('gameState', 'setPath') ?? ((p) => getGameStateSingleton().setPath(p));
  const setLoopMode = async (want) => {
    if (isLoopModeActive() === want) return true;
    loopsEl?.querySelector('#loop-ui-toggle-loop-mode')?.click();
    return testController.pollForCondition(() => isLoopModeActive() === want, `loop mode ${want ? 'on' : 'off'}`, 3000, 50);
  };
  try {
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
    await setClickOptions(testController, s.ctx);
    restorePlayer = savePlayer();
    pathBefore = getGameStateSingleton().getPath().map((e) => ({ ...e }));
    testController.eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, 'tests');
    loopsEl = await testController.pollForValue(() => document.querySelector('.loop-panel-container'), 'the Loops panel', 5000, 50);
    testController.reportCondition('the Loops panel is in the DOM', !!loopsEl);
    if (!loopsEl) return testController.getOverallResult();
    loopModeAtEntry = isLoopModeActive();
    testController.reportCondition('loop mode ON (the Loops panel\'s own toggle)', await setLoopMode(true));
    testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
    // Its own discovery state: loop mode shows only discovered levels, so one reachable level in another cell is
    // discovered (all restored after).
    savedDiscovery = discoveryStateSingleton.getSerializableState();
    const view = panel().view.get();
    const lvl = [...view.regions.values()].find((r) => r.reachable && r.displayKey !== view.currentDisplayRegion
      && dbg().frames[r.displayKey] && regionOfCell(r.displayKey, view.displayGroups.get(r.displayKey)?.members) === r.name);
    if (lvl) {
      for (const m of view.displayGroups.get(lvl.displayKey).members) discoveryStateSingleton.discoverRegion(m);
      testController.eventBus.publish('discovery:changed', {}, 'tests');
      await testController.pollForCondition(() => dbg().visibility[lvl.displayKey] === 'shown', `loop mode: ${lvl.displayKey} discovered`, 5000, 50);
    }
    await fitAllAndSettle(testController, 'loop mode: fit all');
    const t = await reachableTarget(testController);
    testController.reportCondition(`loop mode: a reachable target (${t?.region ?? 'none'})`, !!t);
    if (t) {
      const n0 = getGameStateSingleton().getPath().length;
      const c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key} (loop mode)`);
      const planned = await testController.pollForCondition(() => {
        const p = getGameStateSingleton().getPath();
        const moves = p.filter((e) => e.type === 'regionMove');
        return p.length > n0 && moves.at(-1)?.destinationRegion === t.region;
      }, `loop mode: the click's move reached the path`, 5000, 50);
      const r = actionResult(c, 'path.route');
      testController.reportCondition(`loop mode: a Region Map click PLANS — its move to ${t.region} is appended to the path (path.route: ${r?.kind}, source regionView-path-regionMap)`,
        planned && r?.ok === true && (r.kind === 'path' || r.kind === 'single'));
    }
  } catch (error) {
    testController.reportCondition(`loop-mode clicks row error-free: ${error.message}`, false);
  } finally {
    if (loopModeAtEntry != null) { try { await setLoopMode(loopModeAtEntry); } catch { /* best effort */ } }
    if (pathBefore) resetLoopsToIdle(loopState, setPath, pathBefore);
    if (savedDiscovery) {
      discoveryStateSingleton.loadFromSerializedState(savedDiscovery);
      testController.eventBus.publish('discovery:changed', {}, 'tests');
    }
    restorePlayer?.();
    if (s) await tearDown(testController, s, { restoreWorld: false });
  }
  return testController.getOverallResult();
}

/* ── CA-S3: the "On click" strip and the Map's own click actions (each row sets its own state) ── */

/** Record the given events (and their payloads) until `stop()`. */
function recordEvents(testController, names) {
  const seen = [];
  const offs = names.map((name) => testController.eventBus.subscribe(name, (data) => seen.push([name, data]), 'tests'));
  return { seen, stop: () => offs.forEach((off) => off?.()) };
}
const pathOf = () => JSON.stringify(getGameStateSingleton().getPath?.() ?? []);
const pathEndRegion = () => { const gs = getGameStateSingleton(); return gs.getLastRegionInPath?.() || gs.getCurrentRegion?.(); };
// CA-S5: `regionMap:nodeSelected` left this list with the event (retired; nothing heard it).
const CLICK_EVENTS = ['regionView:regionClicked', 'regionView:locationClicked', 'ui:activatePanel', 'ui:navigateToRegion'];

/**
 * The generated world, the panel, discovery off. With `target`, a reachable region in another cell first: the
 * world's start reaches none until a few green squares are checked (their items open the way, as `clickLegs` does;
 * procgen_topdown AP_1 needs 7), so up to 8 are checked under the DEFAULT actions. Then this row's `clickActions`; the strip reads `summary`.
 * → { s, t, checked } (the caller reloads the world when `checked` is not empty)
 */
async function clickRowSetUp(testController, clickActions, summary, { target = false } = {}) {
  const s = await setUp(testController, GENERATED, { rulesPath: GENERATED_RULES });
  const checked = [];
  let t = null;
  if (!s.ready) return { s, t, checked };
  await s.ctx.setSetting('moduleSettings.discovery.enableDiscoveryMode', false);
  if (target) {
    await setClickOptions(testController, s.ctx);
    await fitAllAndSettle(testController, 'fit all (target)');
    t = await reachableTarget(testController);
    for (let i = 0; !t && i < 8; i += 1) {
      const more = await checkGreenSquare(testController, 'opening the way', { assert: false });
      if (!more) break;
      checked.push(more);
      // The region view recomputes on its own frame: let it see the check before looking again (as clickLegs does).
      await fitAllAndSettle(testController, 'fit all (target, after a check)');
      t = await reachableTarget(testController);
    }
    testController.reportCondition(`a reachable region in another cell, with a point off its squares (${t?.region ?? 'none'}; ${checked.length} check(s) first)`, !!t);
  }
  await setClickOptions(testController, s.ctx, clickActions);
  const shown = await testController.pollForCondition(() => stripSummary() === summary, `the strip shows "${summary}"`, 3000, 25);
  testController.reportCondition(`the Map's "On click" strip, at the top of the panel, reads "${summary}" (now "${stripSummary()}")`,
    shown && panel().root.firstChild === panel().clickStripHost && !!document.querySelector(`${STRIP} .click-actions-strip`));
  if (t && !await focusCell(testController, t.key)) t = null;
  return { s, t, checked };
}

/** The DEFAULT Map click on a region: extend the path to it, and open the Regions panel at it; the generic event. */
export async function testRegionMapClickDefault(testController) {
  let s = null;
  let restorePlayer = null;
  let rec = null;
  let checked = [];
  try {
    const got = await clickRowSetUp(testController, defaultClickActions(), 'On click: extend path · Regions — location: check',
      { target: true });
    ({ s, checked } = got);
    const { t } = got;
    if (!s.ready || !t) return testController.getOverallResult();
    restorePlayer = savePlayer();
    rec = recordEvents(testController, CLICK_EVENTS);
    const c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key}`);
    const extended = await testController.pollForCondition(() => pathEndRegion() === t.region, `the path ends at ${t.region}`, 5000, 50);
    const r = actionResult(c, 'path.route');
    testController.reportCondition(`a click on ${t.region} extends the path to it (path.route ${r?.kind}; it ends at ${pathEndRegion()})`,
      extended && r?.ok === true);
    const opened = await testController.pollForCondition(
      () => rec.seen.some(([n, d]) => n === 'ui:navigateToRegion' && d?.regionName === t.region), 'ui:navigateToRegion', 3000, 50);
    testController.reportCondition('… and opens the Regions panel at it (regions.open: ui:activatePanel regionsPanel, ui:navigateToRegion)',
      opened && rec.seen.some(([n, d]) => n === 'ui:activatePanel' && d?.panelId === 'regionsPanel'));
    const order = rec.seen.map(([n]) => n);
    testController.reportCondition(`regionView:regionClicked { panelId: 'regionMap', regionName } first, before any action (${order.join(', ')})`,
      order[0] === 'regionView:regionClicked'
      && JSON.stringify(rec.seen[0][1]) === JSON.stringify({ panelId: 'regionMap', regionName: t.region }));
  } catch (error) {
    testController.reportCondition(`default Map click row error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    restorePlayer?.();
    await reloadIfChecked(testController, s?.ctx, checked, { before: s?.before, restoreWorld: true });
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/** The ⏸ MASTER SWITCH off: no move, no path edit, no Regions-panel change; the click and its event still happen. */
export async function testRegionMapClickMasterOff(testController) {
  let s = null;
  let restorePlayer = null;
  let rec = null;
  let checked = [];
  try {
    const got = await clickRowSetUp(testController, { ...defaultClickActions(), enabled: false }, 'On click: ⏸ paused', { target: true });
    ({ s, checked } = got);
    const { t } = got;
    if (!s.ready || !t) return testController.getOverallResult();
    const master = panel().clickStripHost.querySelector('.click-actions-strip-master');
    testController.reportCondition(`the collapsed strip keeps the master switch, paused (${master?.textContent})`, master?.textContent === '▶');
    restorePlayer = savePlayer();
    const regionBefore = gameStateRegion();
    const pathBefore = pathOf();
    rec = recordEvents(testController, CLICK_EVENTS);
    const c = await clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key} (master off)`);
    await new Promise((res) => setTimeout(res, 500)); // what a click would do, it would have done by now
    testController.reportCondition(`master off: the click lands and runs nothing (${JSON.stringify(c?.result)})`,
      c?.target === 'region' && c.result?.ran === false && c.result.reason === 'disabled');
    testController.reportCondition(`master off: no move, no path edit (still at ${gameStateRegion()})`,
      gameStateRegion() === regionBefore && pathOf() === pathBefore);
    // (The row's own `clickCanvas` re-activates the Map's tab: a `ui:activatePanel` for the Map is not the click's.)
    testController.reportCondition('master off: no Regions-panel change (no ui:activatePanel regionsPanel / ui:navigateToRegion)',
      !rec.seen.some(([n, d]) => (n === 'ui:activatePanel' && d?.panelId !== COMPONENT) || n === 'ui:navigateToRegion'));
    testController.reportCondition('master off: regionView:regionClicked is still published',
      rec.seen.some(([n, d]) => n === 'regionView:regionClicked' && d?.regionName === t.region));
  } catch (error) {
    testController.reportCondition(`master-off Map click row error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    restorePlayer?.();
    await reloadIfChecked(testController, s?.ctx, checked, { before: s?.before, restoreWorld: true });
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/** A location-square click with the location action "Check it now": the location is checked; the generic event. */
export async function testRegionMapClickLocationCheck(testController) {
  let s = null;
  let rec = null;
  let checked = [];
  try {
    const settings = defaultClickActions();
    settings.location['path.check'] = 'now';
    ({ s } = await clickRowSetUp(testController, settings, 'On click: extend path · Regions — location: check'));
    if (!s.ready) return testController.getOverallResult();
    rec = recordEvents(testController, CLICK_EVENTS);
    const loc = await checkGreenSquare(testController, 'location check');
    if (loc) checked = [loc];
    const ev = rec.seen.find(([n]) => n === 'regionView:locationClicked');
    testController.reportCondition(`regionView:locationClicked { panelId: 'regionMap', regionName, locationName: ${loc} } (${JSON.stringify(ev?.[1])})`,
      !!loc && ev?.[1]?.panelId === 'regionMap' && ev[1].locationName === loc && typeof ev[1].regionName === 'string');
  } catch (error) {
    testController.reportCondition(`location-check Map click row error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    await reloadIfChecked(testController, s?.ctx, checked, { before: s?.before, restoreWorld: true });
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/**
 * ⛓ "GO TO" ≡ A CANVAS CLICK (region-map tutorial, G1: `regionMap/regionMapPicker.js`). The same target clicked on the
 * canvas and chosen in the picker give the same click record (`lastClick` but its counter), the same bus record
 * (`regionView:*Clicked`, `ui:navigateToRegion`) and the same path end: a region under the default actions; then, with
 * the master switch off, a region and a location square (the events are published, no action runs).
 */
export async function testRegionMapGoToEqualsCanvasClick(testController) {
  let s = null;
  let restorePlayer = null;
  let checked = [];
  const sameRecord = (c) => (c ? JSON.stringify({ ...c, n: 0 }) : null);
  const busOf = (seen) => JSON.stringify(seen.filter(([n]) => n !== 'ui:activatePanel'));
  /** One leg: `act()` makes the click; → { click, bus, pathEnd } */
  const leg = async (act) => {
    const rec = recordEvents(testController, CLICK_EVENTS);
    try {
      const click = await act();
      await new Promise((res) => setTimeout(res, 300)); // the route's dispatch and the Regions panel's navigation
      return { click: sameRecord(click), bus: busOf(rec.seen), pathEnd: pathEndRegion() };
    } finally { rec.stop(); }
  };
  try {
    const got = await clickRowSetUp(testController, defaultClickActions(), 'On click: extend path · Regions — location: check',
      { target: true });
    ({ s, checked } = got);
    const { t } = got;
    if (!s.ready || !t) return testController.getOverallResult();
    testController.reportCondition('the picker starts folded', panel().pickerEl.open === false);
    restorePlayer = savePlayer();
    const canvasLeg = await leg(() => clickCanvas(testController, t.point.x, t.point.y, `cell ${t.key}`));
    restorePlayer();
    const pickerLeg = await leg(() => panel().picker.goToRegion(t.key));
    restorePlayer();
    testController.reportCondition(`a region: the picker's click record equals the canvas click's (${pickerLeg.click} vs ${canvasLeg.click})`,
      !!canvasLeg.click && pickerLeg.click === canvasLeg.click);
    testController.reportCondition(`… the same bus record (${pickerLeg.bus})`, canvasLeg.bus.includes('regionView:regionClicked') && pickerLeg.bus === canvasLeg.bus);
    testController.reportCondition(`… the same path end (${pickerLeg.pathEnd})`, pickerLeg.pathEnd === canvasLeg.pathEnd && pickerLeg.pathEnd === t.region);

    // Master off: a click (canvas or picker) publishes its event and runs nothing.
    await s.ctx.setSetting(REGION_MAP_CLICK_ACTIONS_KEY, { ...defaultClickActions(), enabled: false });
    await testController.pollForCondition(() => dbg()?.clickActions?.enabled === false, 'the panel holds master off', 3000, 25);
    await focusCell(testController, t.key);
    const point = cellPointOffSquares(t.key);
    const offCanvas = await leg(() => clickCanvas(testController, point.x, point.y, `cell ${t.key} (master off)`));
    const offPicker = await leg(() => panel().picker.goToRegion(t.key));
    testController.reportCondition(`master off, a region: equal records, nothing ran (${offPicker.click})`,
      offPicker.click === offCanvas.click && JSON.parse(offPicker.click ?? '{}').result?.ran === false && offPicker.bus === offCanvas.bus
      && offPicker.bus.includes('regionView:regionClicked'));
    await fitAllAndSettle(testController, 'fit all (a square)');
    const q = dbg().squares.find((x) => squarePoint(x.location));
    if (q) await focusCell(testController, q.key);
    const at = q ? squarePoint(q.location) : null;
    testController.reportCondition(`a location square on screen (${q?.location ?? 'none'})`, !!at);
    if (at) {
      const sqCanvas = await leg(() => clickCanvas(testController, at.x, at.y, `square ${q.location} (master off)`));
      const sqPicker = await leg(() => panel().picker.goToLocation(q.location));
      testController.reportCondition(`master off, a location: equal records and bus records (${sqPicker.bus})`,
        !!sqCanvas.click && sqPicker.click === sqCanvas.click && JSON.parse(sqPicker.click).target === 'location'
        && sqPicker.bus === sqCanvas.bus && sqPicker.bus.includes('regionView:locationClicked'));
    }
  } catch (error) {
    testController.reportCondition(`go-to ≡ canvas click row error-free: ${error.message}`, false);
  } finally {
    restorePlayer?.();
    await reloadIfChecked(testController, s?.ctx, checked, { before: s?.before, restoreWorld: true });
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/**
 * The Map's settings are its OWN (⚖ R4): an edit of the Region Graph's strip (its ⏸ master switch, pressed and pressed
 * back — the Graph's real save path) leaves the Map's `clickActions` unchanged, in the panel and in storage.
 */
export async function testRegionMapClickSettingsIndependent(testController) {
  let s = null;
  const GRAPH_KEY = 'moduleSettings.regionGraph.clickActions';
  let graphBefore = null;
  try {
    s = await setUp(testController, GENERATED, { rulesPath: GENERATED_RULES });
    if (!s.ready) return testController.getOverallResult();
    await panel().clickActionsReady;
    const mapHeld = JSON.stringify(dbg().clickActions);
    const mapStored = JSON.stringify(await settingsManager.getSetting(REGION_MAP_CLICK_ACTIONS_KEY));
    testController.reportCondition(`the Map holds its stored click actions (${mapHeld})`, mapHeld === mapStored);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' }, 'tests');
    const master = await testController.pollForValue(
      () => document.querySelector('.region-graph-panel-container .click-actions-strip-master'), 'the Region Graph\'s strip', 5000, 50);
    testController.reportCondition('the Region Graph\'s "On click" strip is on the page', !!master);
    if (!master) return testController.getOverallResult();
    graphBefore = await settingsManager.getSetting(GRAPH_KEY);
    const enabled0 = graphBefore?.enabled !== false;
    master.click();
    const flipped = await testController.pollForCondition(async () => ((await settingsManager.getSetting(GRAPH_KEY))?.enabled !== false) === !enabled0,
      'the Region Graph saved its edit', 3000, 25);
    testController.reportCondition(`the Region Graph's strip edit is saved (enabled ${enabled0} → ${!enabled0})`, flipped);
    await nextFrames(2);
    testController.reportCondition(`… and the Map's click actions are unchanged, in the panel (${JSON.stringify(dbg().clickActions)})`,
      JSON.stringify(dbg().clickActions) === mapHeld);
    testController.reportCondition('… and in storage', JSON.stringify(await settingsManager.getSetting(REGION_MAP_CLICK_ACTIONS_KEY)) === mapStored);
    document.querySelector('.region-graph-panel-container .click-actions-strip-master')?.click();
    const back = await testController.pollForCondition(async () => JSON.stringify(await settingsManager.getSetting(GRAPH_KEY)) === JSON.stringify(graphBefore),
      'the Region Graph\'s setting is back', 3000, 25);
    testController.reportCondition('the Region Graph\'s click actions are put back (its strip pressed again)', back);
    if (back) graphBefore = null;
  } catch (error) {
    testController.reportCondition(`settings-independence row error-free: ${error.message}`, false);
  } finally {
    if (graphBefore) { try { await settingsManager.updateSetting(GRAPH_KEY, graphBefore); } catch { /* best effort */ } }
    testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

/* ── a CUSTOM Seedling set loaded as a bundle: its derived atlas reaches the panel (region-map atlas-cache) ── */

/**
 * A module or document under `frontend/`, by a URL off the PAGE (not this file's `import.meta.url`), so the same row
 * works on the bundled boot: the Seedling set editor's modules are fetched raw at run time and never join the bundle.
 */
const appUrl = (rel) => new URL(rel, document.baseURI).href;
const fetchJson = async (rel) => {
  const r = await fetch(appUrl(rel));
  if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);
  return r.json();
};

/**
 * The custom set the slice's dumps use (`scripts/dev/region-map-atlas-cache-dump.mjs` `customSetRules`): the editor's
 * vanilla rooms + the committed vanilla overlay, compiled by the set editor's own `rulesJsonOf` → `{rules, atlas}`, the
 * two documents the set editor's bundle download zips.
 */
async function buildCustomSeedlingSet() {
  const [{ tileTypeForPlacement, SEEDLING_TILE_SIZE }, { compileRegionAtlas }, { parseOelLevel }, SA, { editorVanillaSet }] = await Promise.all([
    import(appUrl('./modules/flashPanel/seedlingSemantics.js')),
    import(appUrl('./modules/procgenPipeline/regionAtlasCompiler.js')),
    import(appUrl('./modules/seedlingDemo/procgenLevelOel.js')),
    import(appUrl('./modules/seedlingDemo/seedlingSetAdapter.js')),
    import(appUrl('./modules/seedlingDemo/watchSetEditor.js')),
  ]);
  const [vanillaSet, mapDoc, overlay, rulesSchema] = await Promise.all([
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
    fetchJson('./modules/flashPanel/atlases/seedling-map.json'),
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json'),
    fetchJson('./schema/rules.schema.json'),
  ]);
  const deps = {
    parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema,
    // ⛔ `game: 'seedling'` (→ `flash_seedling`, the registered substrate): the derivation's default and the maze set
    // lab's `SEEDLING_ATLAS_GAME`, which the watch page also uses since lab-set-seedling-identity (it said
    // `'seedling-watch-edit'` before, a substrate no hook ran for; CC/docs/region-map/atlas-cache.md § Residue).
    atlas: { game: 'seedling', mapDocument: 'custom-set.json' },
  };
  const record = SA.setRecord(editorVanillaSet(vanillaSet, mapDoc).set, overlay);
  const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps), record, { base: { kind: 'set', set_id: record.set.set_id } });
  const { rules, atlas } = SA.rulesJsonOf(session, deps, { compileRegionAtlas });
  return { rules, atlas };
}

/**
 * lab-set-seedling-identity: the bundle the WATCH PAGE's set editor writes, built through the page's own modules: its set
 * deps (`watchSetIdentity.WATCH_SET_ATLAS`, game `seedling`), the mount's REPORT (`watchSetEditor.reportOf`) with the
 * page's compile (`labSetIdentity`: a `seedling-lab-<8 hex>` stamped copy; ⛓ S4: with its `flash_panel`), and the bundle door's atlas
 * member (`atlasAtDoor`). The page's real press is driven, byte for byte, by `check-seedling-editor-arm.mjs`; this row
 * asks what the APP does with those documents. Same rooms + overlay as `buildCustomSeedlingSet`.
 */
async function buildWatchPageBundle() {
  const [{ tileTypeForPlacement, SEEDLING_TILE_SIZE }, { compileRegionAtlas }, { stampAtlasIdentity, validateRegionAtlas }, { parseOelLevel }, SA, { editorVanillaSet, reportOf }, ID] = await Promise.all([
    import(appUrl('./modules/flashPanel/seedlingSemantics.js')),
    import(appUrl('./modules/procgenPipeline/regionAtlasCompiler.js')),
    import(appUrl('./modules/procgenPipeline/regionAtlasValidator.js')),
    import(appUrl('./modules/seedlingDemo/procgenLevelOel.js')),
    import(appUrl('./modules/seedlingDemo/seedlingSetAdapter.js')),
    import(appUrl('./modules/seedlingDemo/watchSetEditor.js')),
    import(appUrl('./modules/seedlingDemo/watchSetIdentity.js')),
  ]);
  const [vanillaSet, mapDoc, overlay, rulesSchema, served] = await Promise.all([
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
    fetchJson('./modules/flashPanel/atlases/seedling-map.json'),
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json'),
    fetchJson('./schema/rules.schema.json'),
    fetchJson('./modules/flashPanel/atlases/atlas_files.json'),
  ]);
  const deps = { parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema, atlas: ID.WATCH_SET_ATLAS };
  const lab = ID.labSetIdentity({ compileRegionAtlas, stampAtlasIdentity });
  const record = SA.setRecord(editorVanillaSet(vanillaSet, mapDoc).set, overlay);
  const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps), record, { base: { kind: 'set', set_id: record.set.set_id } });
  const rep = reportOf(session, deps, { compileRegionAtlas: lab.compileRegionAtlas, validateRegionAtlas });
  if (!rep.download.rules.allowed) throw new Error(`the watch page's report refused the export: ${rep.download.rules.why}`);
  return {
    rules: rep.rules,
    atlas: lab.atlasAtDoor(rep.atlas, rep.rules),
    base: ID.LAB_SET_ATLAS_BASE,
    servedIds: new Set((served.atlases ?? []).map((a) => a.atlas_id)),
  };
}

/** Raise the Presets panel and hand back its live instance (its file door is `loadDocumentFile`). */
async function presetsPanel(testController) {
  testController.eventBus.publish('ui:activatePanel', { panelId: 'presetsPanel' }, 'tests');
  return testController.pollForValue(() => {
    const p = document.getElementById('presets-panel')?.__panel;
    return p && typeof p.loadDocumentFile === 'function' && p.presetsListContainer ? p : null;
  }, 'the Presets panel is live', WAIT, 50);
}

/**
 * The body both custom-set rows share: build `{rules, atlas}`, load them as a bundle through the Presets panel's file
 * door, and measure the Region Map. `extra(testController, built, id)` adds a row's own conditions before the load.
 */
async function runCustomSetBundleRow(testController, build, { fileName, extra = null } = {}) {
  let s = null;
  try {
    s = await setUp(testController, SEEDLING);
    if (!s.ready) return testController.getOverallResult();
    atlasCache.clear();
    const t0 = performance.now();
    const built = await build();
    const { rules, atlas } = built;
    const id = rules.region_atlas?.['1']?.atlas_id;
    testController.reportCondition(`the custom set compiled (${Object.keys(rules.regions?.['1'] ?? {}).length} regions, ${Math.round(performance.now() - t0)} ms) and its rules name its derived atlas (${id})`,
      typeof id === 'string' && id === atlas.atlas_id);
    if (extra) extra(testController, built, id);
    const presets = await presetsPanel(testController);
    testController.reportCondition('the Presets panel is live', !!presets);
    if (!presets) return testController.getOverallResult();
    const bytes = await writeBundle([{ kind: 'rules', doc: rules }, { kind: 'region-atlas', doc: atlas }], { jszip: await presets.loadJSZip() });
    // ⛓ THE HOST ENTRY PATH: the same call a file pick makes (`#json-file-input` → `loadDocumentFile`).
    await presets.loadDocumentFile(new File([bytes], fileName, { type: 'application/zip' }));
    testController.reportCondition(`the bundle's region atlas is in the host cache under ${id}`, atlasCache.get(id)?.atlas_id === id);
    testController.eventBus.publish('ui:activatePanel', { panelId: COMPONENT }, 'tests');
    const want = Object.values(rules.regions['1']).reduce((n, r) => n + (r.locations?.length ?? 0), 0);
    const loaded = await testController.pollForCondition(() => {
      const r = rawRules();
      const m = panel()?.model;
      // ⛔ the PANEL's own source, not just the stored rules: those switch before the panel rebuilds its model.
      return r?.rules?.region_atlas?.['1']?.atlas_id === id && panel()?.source?.rules === r.rules
        && m && m.cells.size > 0 && dbg()?.lastPaint?.cells > 0;
    }, 'the Region Map rebuilt on the custom set', WAIT, 100);
    testController.reportCondition('the Region Map rebuilt on the custom set and painted', loaded);
    if (!loaded) return testController.getOverallResult();
    const m = panel().model;
    const cells = [...m.cells.values()];
    const sized = cells.filter((c) => c.extent).length;
    testController.reportCondition(`every cell has its level's real extent (${sized}/${cells.length})`, sized === cells.length);
    const placed = cells.reduce((n, c) => n + c.tiles.length, 0);
    const onTiles = cells.filter((c) => c.tileSource === 'substrate').length;
    testController.reportCondition(`N/N squares placed (${placed}/${want}), none "not on map" (${m.unplaced.length})`, want > 0 && placed === want && m.unplaced.length === 0);
    testController.reportCondition(`squares on the substrate's own tiles in every cell (${onTiles}/${cells.length})`, onTiles === cells.length);
    const kinds = {};
    for (const l of m.layout.graph.links) kinds[l.kind ?? 'join'] = (kinds[l.kind ?? 'join'] ?? 0) + 1;
    testController.reportCondition(`its warps are classified (${JSON.stringify(kinds)})`, (kinds.warp ?? 0) > 0);
  } catch (error) {
    testController.reportCondition(`custom-set atlas row error-free: ${error.message}`, false);
  } finally {
    atlasCache.clear();
    if (s) await tearDown(testController, s, { restoreWorld: true });
  }
  return testController.getOverallResult();
}

export async function testRegionMapCustomSetAtlas(testController) {
  return runCustomSetBundleRow(testController, buildCustomSeedlingSet, { fileName: 'custom-seedling-set.zip' });
}

/**
 * lab-set-seedling-identity: the WATCH PAGE's bundle. Before the Region Map half (shared above), the documents
 * themselves: every room is `flash_seedling`, the `flash_panel` block is the compiler's own Seedling wiring (⛓ RE-RECORDED
 * by S4, seedling-custom-set-arm: until S4 there was none), and the atlas id is the lab's own
 * `seedling-lab-<8 hex>` fingerprint, which the served atlas index does not hold.
 */
export async function testRegionMapWatchSetBundle(testController) {
  return runCustomSetBundleRow(testController, buildWatchPageBundle, {
    fileName: 'watch-page-set.zip',
    extra: (tc, { rules, base, servedIds }, id) => {
      const rows = Object.values(rules.preset_sidecars?.['1'] ?? {});
      const subs = [...new Set(rows.map((r) => r.substrate))];
      tc.reportCondition(`every room of the watch page's set is a Seedling room (${rows.length} rooms, substrates ${JSON.stringify(subs)})`,
        rows.length > 0 && subs.length === 1 && subs[0] === 'flash_seedling');
      // ⛓ S4 RE-RECORD (was "no flash_panel block"): the compiler's own Seedling wiring. This bundle carries no level-set
      // member, so the player still refuses these rules with slice G's sentence (seedlingCustomSetArm.test.js).
      tc.reportCondition(`the rules carry the Seedling flash_panel block (S4) (${JSON.stringify(rules.flash_panel?.['1']?.wasm ?? null)})`,
        typeof rules.flash_panel?.['1']?.wasm === 'string' && Object.keys(rules.flash_panel).join() === '1');
      tc.reportCondition(`the atlas id is the lab's own fingerprint and is not served (${id})`,
        new RegExp(`^${base}-[0-9a-f]{8}$`).test(id ?? '') && !servedIds.has(id));
    },
  });
}

/**
 * region-map-link-ends: the Region Map's MOBILE tab sits right after the Region Graph's (⚖ the user 2026-11-22T21:55Z,
 * "Yes, add it"). Any boot: the mobile tab order computed the way `mobileLayoutManager.determinePanelOrder` computes it,
 * from the registry's own moduleInfo (as `layoutManager.js` `setupMobileLayout` registers it) and the served layout
 * presets, on every preset. On a MOBILE boot (`npm test -- --layout=mobile`) also the live tab bar: the tab is next to
 * the Region Graph's, a tap shows the panel, and it paints.
 */
export async function testRegionMapMobileTab(testController) {
  try {
    const presets = await (await fetch('./layout-configs/layout_presets.json', { cache: 'no-store' })).json();
    const registry = [...centralRegistry.getAllPanelComponents()];
    const info = lookupModuleInfo('regionMapPanel', centralRegistry.getAllPanelComponents().get('regionMapPanel')) ?? {};
    testController.reportCondition(`the Region Map's moduleInfo names mobileAfter = regionGraphPanel (${JSON.stringify(info.mobileAfter ?? null)})`,
      info.mobileAfter === 'regionGraphPanel');
    // A scratch manager with the singleton's own methods: the live one (if any) is never touched.
    const scratch = Object.create(Object.getPrototypeOf(mobileLayoutManager));
    const results = [];
    for (const id of Object.keys(presets)) {
      Object.assign(scratch, { panels: new Map(), layoutPresets: presets, activeLayoutId: id, columnCount: 0 });
      for (const [type, entry] of registry) {
        scratch.registerPanel(type, entry.componentClass, type, completeModuleInfo(type, lookupModuleInfo(type, entry) ?? {}));
      }
      scratch.determinePanelOrder();
      const col = scratch.columnPanels.find((c) => c.includes('regionMapPanel')) ?? [];
      const ok = scratch.panelOrder.filter((t) => t === 'regionMapPanel').length === 1
        && col[col.indexOf('regionGraphPanel') + 1] === 'regionMapPanel';
      results.push(`${id}:${ok ? 'next' : 'NOT'}`);
    }
    testController.log(`MOBILE ORDER per preset: ${results.join(' ')}`);
    testController.reportCondition(`on every layout preset the Region Map tab follows the Region Graph's, once (${results.length} presets)`,
      results.length > 0 && results.every((r) => r.endsWith(':next')));

    const mobile = document.body.classList.contains('mobile-layout-active');
    testController.log(`boot layout: ${mobile ? 'MOBILE' : 'desktop'} (${window.innerWidth} × ${window.innerHeight})`);
    if (!mobile) return testController.getOverallResult();
    const m = mobileLayoutManager;
    const before = m.activePanel;
    m.showPanel('regionGraphPanel');
    const tabs = () => [...document.querySelectorAll('.mobile-tab-bar .mobile-tab')].map((t) => t.dataset.componentType);
    const t = tabs();
    testController.log(`LIVE TABS (Region Graph's column): ${t.join(', ')}`);
    testController.reportCondition('the live tab bar shows the Region Map tab right after the Region Graph\'s',
      t[t.indexOf('regionGraphPanel') + 1] === 'regionMapPanel' && t.filter((x) => x === 'regionMapPanel').length === 1);
    document.querySelector('.mobile-tab[data-component-type="regionMapPanel"]')?.click();
    const shown = await testController.pollForCondition(() => m.activePanel === 'regionMapPanel'
      && (getPanelInstances()[0]?.getDebugState()?.lastPaint?.cells ?? 0) > 0, 'the Region Map shows and paints', 20000, 50);
    testController.reportCondition('a tap on the tab shows the Region Map, and it paints', shown);
    if (before && m.panels.has(before)) m.showPanel(before);
  } catch (error) {
    testController.reportCondition(`mobile tab row error-free: ${error.message}`, false);
  }
  return testController.getOverallResult();
}

registerTest({
  id: 'region-map-classic-world',
  name: 'Region Map: a classic AP world (no grid_cell, no hook)',
  category: 'Region Map',
  testFunction: testRegionMapClassicWorld,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'The panel loads a world with no sidecars: the generic layout, one generic box per region, a square place for every location',
});
registerTest({
  id: 'region-map-zoom-pinch-links',
  name: 'Region Map: + / − zoom, a two-finger pinch, the neighbour lines',
  category: 'Region Map',
  testFunction: testRegionMapZoomPinchLinks,
  enabled: false,
  description: 'zoom-links: + and − zoom by ZOOM_BUTTON_FACTOR and untick Follow; a two-pointer pinch zooms by the distance ratio and fires no click; the neighbour lines drawn are the model\'s, counted apart from the cross-group links, under the Links box; link-ends: gap marks / border-clipped lines / arrowheads as linkShape says',
});
registerTest({
  id: 'region-map-mobile-tab',
  name: 'Region Map: the mobile tab sits next to the Region Graph\'s',
  category: 'Region Map',
  testFunction: testRegionMapMobileTab,
  enabled: false,
  description: 'link-ends: from the registry\'s moduleInfo and the served presets, the mobile tab order puts the Region Map right after the Region Graph on every preset; on a --layout=mobile boot, the live tab is there and a tap shows and paints the panel',
});
registerTest({
  id: 'region-map-seedling-paints',
  name: 'Region Map: seedling_playthrough cells, art, squares, cell size',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapSeedlingPaints,
  enabled: false,
  description: 'N cells = the layout\'s display regions; the art bakes; squares = the visible levels\' tiles, ≥ the minimum at the minimum zoom; the cell-size toggle changes the frames',
});
registerTest({
  id: 'region-map-follow-player',
  name: 'Region Map: follow player',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapFollowPlayer,
  enabled: false,
  description: 'A region move re-centres the camera on the new display region; a manual pan turns follow off',
});
registerTest({
  id: 'region-map-discovery',
  name: 'Region Map: discovery mode',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapDiscovery,
  enabled: false,
  description: 'Hidden regions are not drawn, placeholders are fog with no squares, as the view says; and the recompute cost is measured',
});
registerTest({
  id: 'region-map-clicks-generated',
  name: 'Region Map: clicks on a generated world (procgen topdown)',
  category: 'Region Map',
  testFunction: testRegionMapClicksGenerated,
  enabled: false,
  description: 'Step 4: a cell click moves the player, a green square click checks it, the hover names it; CA-S3: the Map\'s own clickActions route changes what a Region Map click does',
});
registerTest({
  id: 'region-map-click-default',
  name: 'Region Map: the default click (extend the path, open the Regions panel)',
  category: 'Region Map',
  testFunction: testRegionMapClickDefault,
  enabled: false,
  description: 'CA-S3: with the default clickActions, a cell click extends the path to its region and opens the Regions panel at it; regionView:regionClicked first',
});
registerTest({
  id: 'region-map-click-master-off',
  name: 'Region Map: the click master switch off',
  category: 'Region Map',
  testFunction: testRegionMapClickMasterOff,
  enabled: false,
  description: 'CA-S3: clickActions.enabled false: a cell click moves nobody, edits no path, opens no Regions panel; the selection and the generic event are still published',
});
registerTest({
  id: 'region-map-click-location-check',
  name: 'Region Map: a location-square click checks it',
  category: 'Region Map',
  testFunction: testRegionMapClickLocationCheck,
  enabled: false,
  description: 'CA-S3: the location action "check it now": a green square click checks it and publishes regionView:locationClicked',
});
registerTest({
  id: 'region-map-go-to-equals-canvas-click',
  name: 'Region Map: "Go to" does what a canvas click does',
  category: 'Region Map',
  testFunction: testRegionMapGoToEqualsCanvasClick,
  enabled: false,
  description: 'region-map tutorial (G1): the same cell or square, clicked on the canvas and chosen in the Go-to picker: the same click record, bus record and path end (default actions; master off, a region and a square)',
});
registerTest({
  id: 'region-map-click-settings-independent',
  name: 'Region Map: its click settings are its own',
  category: 'Region Map',
  testFunction: testRegionMapClickSettingsIndependent,
  enabled: false,
  description: 'CA-S3 (R4): an edit of the Region Graph\'s "On click" strip leaves the Map\'s clickActions unchanged',
});
registerTest({
  id: 'region-map-clicks-seedling',
  name: 'Region Map: clicks on seedling_playthrough',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapClicksSeedling,
  enabled: false,
  description: 'Step 4: a cell click moves the player, a green square click checks it, a red one is refused exactly as the Region Graph\'s check is',
});
registerTest({
  id: 'region-map-clicks-loop-mode',
  name: 'Region Map: a click plans in loop mode',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapClicksLoopMode,
  enabled: false,
  description: 'Step 4: with loop mode on, a Region Map cell click is a planning source (CA-S3: regionView-path-regionMap): its move is appended to the path',
});
registerTest({
  id: 'region-map-custom-set-atlas',
  name: 'Region Map: a custom Seedling set\'s derived atlas reaches the panel',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapCustomSetAtlas,
  enabled: false,
  description: 'region-map atlas-cache: a custom set loaded as a bundle through the Presets panel\'s file door puts its derived atlas in the host cache; the panel then shows real extents, N/N squares on their tiles, and its warps',
});
registerTest({
  id: 'region-map-watch-set-bundle',
  name: 'Region Map: the Seedling watch page\'s set bundle is a Seedling world',
  category: 'Region Map: Seedling',
  testFunction: testRegionMapWatchSetBundle,
  enabled: false,
  description: 'lab-set-seedling-identity: the bundle the watch page\'s set editor writes (its own deps, report compile and atlas door) is Seedling rooms, the Seedling flash_panel wiring (S4), a seedling-lab fingerprint that is not served; loaded through the Presets panel\'s file door, the panel shows real extents, N/N squares on their tiles, and its warps',
});
