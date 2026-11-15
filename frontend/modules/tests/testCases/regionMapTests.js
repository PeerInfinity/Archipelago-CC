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
import { MIN_ZOOM } from '../../regionMap/regionMapCamera.js';
import { seedlingCompositeMapStats } from '../../flashPanel/seedlingCompositeMap.js';

const COMPONENT = 'regionMapPanel';
const WAIT = 15000;
const SEEDLING = 'seedling_playthrough';
const CLASSIC = 'adventure';

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

/** Load the world unless it is the loaded one already, then open the panel and wait for its model. */
async function setUp(testController, game) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  if (!await ctx.isPresetLoaded(game, 1)) await ctx.loadPreset(game, 1);
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

registerTest({
  id: 'region-map-classic-world',
  name: 'Region Map: a classic AP world (no grid_cell, no hook)',
  category: 'Region Map',
  testFunction: testRegionMapClassicWorld,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'The panel loads a world with no sidecars: the generic layout, one generic box per region, a square place for every location',
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
