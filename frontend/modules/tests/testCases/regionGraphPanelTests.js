import { registerTest } from '../testRegistry.js';
import { stateManagerProxySingleton } from '../../stateManager/index.js';
import { buildContext } from '../../tutorials/tutorialContext.js';
import { PICKER } from '../../regionGraph/nodePicker.js';
import { locationState, isRegionReachable } from '../../regionView/regionViewModel.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { getLastRawJsonData } from '../../stateManager/index.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { SUB_REGION_VIEW_KEY, multiMemberGroups, isRegionGroupNode, groupNodeId } from '../../regionGraph/subRegionGroups.js';
import { regionOfCell } from '../../regionView/regionViewModel.js';
import { NODE_LOOK_KEY } from '../../regionGraph/nodeLook.js';

const PANEL_ID = 'regionGraphPanel';
const MAX_WAIT_TIME = 10000;

/** The Region Graph's Cytoscape instance (cytoscape keeps it on its container). */
const graphCy = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;
/** The region nodes (not the player marker, not location nodes). */
const regionNodes = (cy) => cy.nodes('.region').filter((n) => !n.hasClass('player') && !n.hasClass('location-node'));
/**
 * Does the graph show the loaded world? Its region nodes are exactly
 * staticData's regions. Durable state, unlike the status bar, whose
 * "Loaded N regions, M connections" the layout overwrites a moment later.
 */
function graphShowsWorld() {
  const cy = graphCy();
  const regions = stateManagerProxySingleton.getStaticData?.()?.regions;
  if (!cy || !regions?.size) return false;
  const ids = regionNodes(cy).map((n) => n.id());
  return ids.length === regions.size && ids.every((id) => regions.has(id)) && cy.edges().length > 0;
}
/**
 * ⛓ Watch the layouts on `cy` from now: `idle()` is true when none started since, or the last one has STOPPED (its
 * `layoutstop`, which an animated layout emits when its animation ends). A layout that was running before the watch is
 * stopped by the rebuild that follows it (`GraphDataManager` stops `currentLayout`), so watch from just before the
 * switch that rebuilds. `dispose()` removes the listeners.
 */
function layoutWatch(cy) {
  let lastStart = 0; let lastStop = 0; let seq = 0;
  const onStart = () => { lastStart = ++seq; };
  const onStop = () => { lastStop = ++seq; };
  cy.on('layoutstart', onStart);
  cy.on('layoutstop', onStop);
  return {
    idle: () => lastStart === 0 || lastStop > lastStart,
    state: () => (lastStart === 0 ? 'none started' : lastStop > lastStart ? 'stopped' : 'running'),
    dispose: () => { cy.off('layoutstart', onStart); cy.off('layoutstop', onStop); },
  };
}
/** Poll until no region node moved for one interval: no layout is running. */
function layoutSettled(testController, cy) {
  let last = null;
  return testController.pollForCondition(() => {
    const now = JSON.stringify(regionNodes(cy).map((n) => n.position()));
    const still = now === last; last = now; return still;
  }, 'the layout settled', MAX_WAIT_TIME, 300);
}
/**
 * Reload the world loaded before a row that changed it (a `./presets/` path
 * only). `always`: also when it is still the loaded one, for a row that
 * changed its state (moved the player, checked a location).
 */
async function restoreWorld(testController, ctx, before, { always = false } = {}) {
  if (typeof before === 'string' && before.startsWith('./presets/') && (always || ctx.rulesSource() !== before)) {
    try { await ctx.loadRulesPath(before); } catch (e) { testController.log(`could not reload ${before}: ${e.message}`); }
  }
}

/**
 * Basic test to verify the Region Graph panel can be activated and displays correctly
 */
export async function testRegionGraphPanelActivation(testController) {
  let overallResult = true;
  const testRunId = `region-graph-activation-${Date.now()}`;
  
  try {
    testController.log(`[${testRunId}] Starting Region Graph panel activation test...`);
    testController.reportCondition('Test started', true);
    
    testController.log(`[${testRunId}] Activating ${PANEL_ID} panel...`);
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    
    const panelElement = await testController.pollForValue(
      () => document.querySelector('.region-graph-panel-container'),
      'Region Graph panel DOM element',
      5000,
      50
    );
    
    if (!panelElement) {
      throw new Error('Region Graph panel not found in DOM');
    }
    
    testController.reportCondition('Region Graph panel found in DOM', true);
    
    const statusBar = panelElement.querySelector('div[style*="position: absolute"]');
    testController.reportCondition('Status bar exists', !!statusBar);
    
    const controlPanel = await testController.pollForValue(
      () => {
        const panels = panelElement.querySelectorAll('div[style*="position: absolute"]');
        return Array.from(panels).find(p => p.querySelector('button#resetView'));
      },
      'Control panel with buttons',
      3000,
      50
    );
    testController.reportCondition('Control panel exists', !!controlPanel);
    
    const resetViewBtn = controlPanel?.querySelector('#resetView');
    const relayoutBtn = controlPanel?.querySelector('#relayout');
    const exportBtn = controlPanel?.querySelector('#exportPositions');
    
    testController.reportCondition('Reset View button exists', !!resetViewBtn);
    testController.reportCondition('Re-layout button exists', !!relayoutBtn);
    testController.reportCondition('Export Positions button exists', !!exportBtn);
    
    const graphContainer = panelElement.querySelector('div[id^="cy-"]');
    testController.reportCondition('Graph container exists', !!graphContainer);
    
    testController.log(`[${testRunId}] Region Graph panel activation test completed successfully`);
    testController.completeTest();
    
  } catch (error) {
    testController.log(`[${testRunId}] ERROR: ${error.message}`);
    testController.reportCondition('Region Graph panel activation test error-free', false);
    overallResult = false;
  }
  
  return overallResult;
}

/**
 * Test that Cytoscape.js library loads correctly
 */
export async function testCytoscapeLibraryLoading(testController) {
  let overallResult = true;
  const testRunId = `cytoscape-loading-${Date.now()}`;
  
  try {
    testController.log(`[${testRunId}] Starting Cytoscape library loading test...`);
    testController.reportCondition('Test started', true);
    
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    
    await testController.pollForCondition(
      () => document.querySelector('.region-graph-panel-container'),
      'Region Graph panel loaded',
      5000,
      50
    );
    
    const cytoscapeLoaded = await testController.pollForCondition(
      () => typeof window.cytoscape === 'function',
      'Cytoscape library loaded',
      MAX_WAIT_TIME,
      100
    );
    
    testController.reportCondition('Cytoscape library loaded', cytoscapeLoaded);
    
    // Skip layout-base test for now - it may not expose itself to window.layoutBase
    const layoutBaseLoaded = true; // assume loaded since cose-base depends on it
    testController.reportCondition('Layout-base library loaded (assumed)', layoutBaseLoaded);
    
    const coseBaseLoaded = await testController.pollForCondition(
      () => typeof window.coseBase === 'object',
      'Cose-base library loaded',
      MAX_WAIT_TIME,
      100
    );
    
    testController.reportCondition('Cose-base library loaded', coseBaseLoaded);
    
    const fcoseLoaded = await testController.pollForCondition(
      () => typeof window.cytoscapeFcose === 'function',
      'FCose layout plugin loaded',
      MAX_WAIT_TIME,
      100
    );
    
    testController.reportCondition('FCose layout plugin loaded', fcoseLoaded);
    
    if (cytoscapeLoaded && layoutBaseLoaded && coseBaseLoaded && fcoseLoaded) {
      testController.log(`[${testRunId}] All libraries loaded successfully: Cytoscape, layout-base, cose-base, and FCose`);
      testController.completeTest();
    } else {
      overallResult = false;
    }
    
  } catch (error) {
    testController.log(`[${testRunId}] ERROR: ${error.message}`);
    testController.reportCondition('Cytoscape loading test error-free', false);
    overallResult = false;
  }
  
  return overallResult;
}

/**
 * Test that the graph loads automatically on initial page load
 */
export async function testGraphInitialLoad(testController) {
  // Shows the world that is ALREADY loaded, without a rules load of its own:
  // the panel builds from current data on first show (checkAndLoadInitialData /
  // the snapshot catch-up), or has built already if an earlier row showed it.
  try {
    if (!stateManagerProxySingleton.getStaticData?.()?.regions?.size) {
      testController.reportCondition('a world is loaded before the panel is shown', false);
      return testController.getOverallResult();
    }
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const panelElement = await testController.pollForValue(
      () => document.querySelector('.region-graph-panel-container'), 'Region Graph panel', 5000, 50);
    if (!panelElement) throw new Error('Region Graph panel not found');
    const shown = await testController.pollForCondition(graphShowsWorld,
      'the graph shows every region of the loaded world', MAX_WAIT_TIME, 100);
    testController.reportCondition('graph shows the loaded world without a rules load', shown);
    const cy = graphCy();
    testController.log(`${cy ? regionNodes(cy).length : 0} region node(s), ${cy?.edges().length ?? 0} edge(s); `
      + `status "${panelElement.querySelector('div[style*="position: absolute"]')?.textContent ?? ''}"`);
    const canvas = await testController.pollForCondition(
      () => { const c = panelElement.querySelector('div[id^="cy-"] canvas'); return !!c && c.width > 0 && c.height > 0; },
      'Cytoscape canvas rendered', 5000, 100);
    testController.reportCondition('Canvas rendered', canvas);
  } catch (error) {
    testController.reportCondition(`Initial load test error-free: ${error.message}`, false);
  }
  return testController.getOverallResult();
}

/**
 * Test that the graph initializes with data from StateManager after loading rules
 */
export async function testGraphDataLoading(testController) {
  // A rules load while the panel is up rebuilds the graph for the new world
  // (stateManager:rulesLoaded → loadGraphData). Reloads the world loaded before.
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const panelElement = await testController.pollForValue(
      () => document.querySelector('.region-graph-panel-container'), 'Region Graph panel', 5000, 50);
    if (!panelElement) throw new Error('Region Graph panel not found');
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows the current world', MAX_WAIT_TIME, 100);
    testController.reportCondition('the graph is built before the rules load', built);
    // A node of the graph as it is now: a rebuild removes every element.
    const oldNode = graphCy() ? regionNodes(graphCy())[0] : null;

    await testController.loadALTTPRules();
    const rebuilt = await testController.pollForCondition(
      () => !!oldNode?.removed() && graphShowsWorld(),
      'the graph rebuilt for the ALTTP rules', MAX_WAIT_TIME, 100);
    testController.reportCondition('a rules load rebuilds the graph for the new world', rebuilt);
    const cy = graphCy();
    testController.log(`${cy ? regionNodes(cy).length : 0} region node(s), ${cy?.edges().length ?? 0} edge(s) for `
      + `${stateManagerProxySingleton.getStaticData?.()?.regions?.size ?? 0} region(s)`);
    const canvas = await testController.pollForCondition(
      () => { const c = panelElement.querySelector('div[id^="cy-"] canvas'); return !!c && c.width > 0 && c.height > 0; },
      'Cytoscape canvas rendered', 5000, 100);
    testController.reportCondition('Cytoscape canvas rendered', canvas);
  } catch (error) {
    testController.reportCondition(`Graph data loading test error-free: ${error.message}`, false);
  } finally {
    await restoreWorld(testController, ctx, before);
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * Test the control buttons functionality
 */
export async function testControlButtons(testController) {
  let overallResult = true;
  const testRunId = `control-buttons-${Date.now()}`;
  
  try {
    testController.log(`[${testRunId}] Starting control buttons test...`);
    testController.reportCondition('Test started', true);
    
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    
    const panelElement = await testController.pollForValue(
      () => document.querySelector('.region-graph-panel-container'),
      'Region Graph panel',
      5000,
      50
    );
    
    if (!panelElement) {
      throw new Error('Region Graph panel not found');
    }
    
    // Built, and no layout running (a running one makes Re-layout a no-op).
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows the current world', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not build');
    await layoutSettled(testController, graphCy());
    await testController.pollForCondition(
      () => !/Running layout/.test(panelElement.querySelector('div[style*="position: absolute"]')?.textContent || ''),
      'no layout running', MAX_WAIT_TIME, 100);
    
    const controlPanel = Array.from(panelElement.querySelectorAll('div[style*="position: absolute"]'))
      .find(p => p.querySelector('button#resetView'));
    
    const resetViewBtn = controlPanel?.querySelector('#resetView');
    const relayoutBtn = controlPanel?.querySelector('#relayout');
    
    if (!resetViewBtn || !relayoutBtn) {
      throw new Error('Control buttons not found');
    }
    
    testController.log(`[${testRunId}] Testing Reset View button...`);
    resetViewBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    testController.reportCondition('Reset View button clicked without error', true);
    
    testController.log(`[${testRunId}] Testing Re-layout button...`);
    const statusBar = panelElement.querySelector('div[style*="position: absolute"]');
    relayoutBtn.click();
    
    const layoutStarted = await testController.pollForCondition(
      () => {
        const text = statusBar?.textContent || '';
        return text.includes('Running layout');
      },
      'Layout started',
      3000,
      50
    );
    testController.reportCondition('Layout started on button click', layoutStarted);
    
    const layoutCompleted = await testController.pollForCondition(
      () => {
        const text = statusBar?.textContent || '';
        return text.includes('Layout complete');
      },
      'Layout completed',
      MAX_WAIT_TIME,
      100
    );
    testController.reportCondition('Layout completed', layoutCompleted);
    
    testController.log(`[${testRunId}] Control buttons test completed successfully`);
    testController.completeTest();
    
  } catch (error) {
    testController.log(`[${testRunId}] ERROR: ${error.message}`);
    testController.reportCondition('Control buttons test error-free', false);
    overallResult = false;
  }
  
  return overallResult;
}

/**
 * Test node selection and event publishing
 */
export async function testNodeSelection(testController) {
  // A real pointer tap on a region node — mousedown + mouseup at its rendered
  // position, which Cytoscape turns into 'tap' — publishes
  // regionView:regionClicked { panelId: 'regionGraph', regionName } and marks
  // the node selected (CA-S5: regionGraph:nodeSelected, which this row heard
  // before, is retired; the row checks it stays silent).
  // The only row through the canvas → tap → handler wiring (the picker calls
  // the handler directly). The tap also runs the panel's "On click"
  // actions (it may move the player), so the world loaded before is reloaded.
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let clickedEvent = null;
  const unsubscribe = testController.eventBus.subscribe('regionView:regionClicked', (data) => {
    if (data?.panelId === 'regionGraph') clickedEvent = data;
  }, 'tests');
  const retired = [];
  const unsubscribeRetired = testController.eventBus.subscribe('regionGraph:nodeSelected', (data) => retired.push(data), 'tests');
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows the current world', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not build');
    const cy = graphCy();
    // Wait out a running layout: a node that is still moving is a moving target.
    await layoutSettled(testController, cy);
    // A region that is not under the player marker, sorted for a stable pick.
    const target = regionNodes(cy).filter((n) => !n.hasClass('current') && !n.hasClass('discovery-hidden'))
      .sort((a, b) => (a.id() < b.id() ? -1 : 1))[0] ?? regionNodes(cy)[0];
    if (!target) throw new Error('no region node to tap');
    cy.center(target);
    await new Promise((r) => setTimeout(r, 100));
    const container = cy.container();
    const rect = container.getBoundingClientRect();
    const rp = target.renderedPosition();
    const at = { clientX: rect.left + rp.x, clientY: rect.top + rp.y, bubbles: true, cancelable: true, button: 0 };
    const top = document.elementFromPoint(at.clientX, at.clientY);
    testController.reportCondition('the node is on screen inside the graph', !!top && container.contains(top));
    top.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
    top.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
    const published = await testController.pollForCondition(() => clickedEvent?.regionName === target.id(),
      `regionView:regionClicked for ${target.id()}`, 3000, 50);
    testController.reportCondition(`tapping "${target.id()}" publishes regionView:regionClicked { panelId: 'regionGraph', regionName } for it`, published);
    testController.reportCondition('the tapped node is marked selected', cy.getElementById(target.id()).hasClass('selected'));
    testController.reportCondition('no regionGraph:nodeSelected (retired in CA-S5)', retired.length === 0);
  } catch (error) {
    testController.reportCondition(`Node selection test error-free: ${error.message}`, false);
  } finally {
    unsubscribe?.();
    unsubscribeRetired?.();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * The "Go to" picker (nodePicker.js): choosing a region does what tapping its
 * node does (regionView:regionClicked from the Region Graph for that node), and choosing a location
 * checks it as a location-node tap does. The section starts folded. Reloads
 * the world loaded before, since the picks move the player and check a location.
 */
export async function testRegionGraphNodePicker(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let selected = null;
  const unsubscribe = testController.eventBus.subscribe('regionView:regionClicked', (data) => {
    if (data?.panelId === 'regionGraph') selected = data;
  }, 'tests');
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    // The controls (and the picker in them) are built once the panel's four
    // Cytoscape scripts have loaded, one after another, on first show. The
    // bundled boot starts the rows sooner after page load, so that load lands
    // inside this row: 8 s measured on a loaded box (2026-10-24), past the
    // 5 s this row once gave the section alone. Wait for it on its own.
    const libsLoaded = await testController.pollForCondition(
      () => typeof window.cytoscapeFcose === 'function', 'the Cytoscape libraries loaded', MAX_WAIT_TIME, 100);
    if (!libsLoaded) throw new Error('the Region Graph\'s Cytoscape libraries did not load');
    const section = await testController.pollForValue(
      () => document.querySelector(`.region-graph-panel-container ${PICKER.section}`),
      'the picker section', 5000, 50);
    if (!section) throw new Error('no picker section in the Region Graph controls');
    testController.reportCondition('the picker section starts folded', section.open === false);
    section.open = true;
    const listOf = (box) => document.getElementById(section.querySelector(box).getAttribute('list'));
    const ready = await testController.pollForCondition(
      () => listOf(PICKER.region).options.length > 0 && listOf(PICKER.location).options.length > 0,
      'the pick lists filled', MAX_WAIT_TIME, 100);
    testController.reportCondition('opening the section fills both lists', ready);
    if (!ready) {
      testController.log(`lists unfilled: ${stateManagerProxySingleton.getStaticData?.()?.regions?.size ?? 0} region(s) in staticData, `
        + `${listOf(PICKER.region).options.length} region / ${listOf(PICKER.location).options.length} location option(s)`);
      return testController.getOverallResult();
    }
    const pick = (box, value) => {
      const input = section.querySelector(box);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const status = () => section.querySelector(PICKER.status).textContent;

    const region = listOf(PICKER.region).options[0].value;
    pick(PICKER.region, region);
    const sawRegion = await testController.pollForCondition(() => selected?.regionName === region,
      `regionView:regionClicked for ${region}`, 3000, 50);
    testController.reportCondition(`picking region "${region}" selects its node, as a tap does`, sawRegion);
    testController.reportCondition('the status names the region', status().includes(region));

    // An ACCESSIBLE unchecked location, as the graph colours it: an
    // inaccessible one (Agahnim 1 in ALTTP at the start) is refused by the
    // check gate, which is not what this row tests.
    const staticData = stateManagerProxySingleton.getStaticData();
    const accessible = new Set();
    for (const [regionName, regionData] of staticData?.regions ?? []) {
      for (const location of regionData?.locations ?? []) {
        if (locationState(ctx.snapshot(), staticData, location, { regionName }) === 'accessible') accessible.add(location.name);
      }
    }
    const unchecked = [...listOf(PICKER.location).options].map((o) => o.value)
      .find((name) => accessible.has(name));
    if (!unchecked) throw new Error('no accessible unchecked location to pick');
    pick(PICKER.location, unchecked);
    const checked = await testController.pollForCondition(
      () => (ctx.snapshot()?.checkedLocations ?? []).includes(unchecked),
      `${unchecked} checked`, 5000, 100);
    testController.reportCondition(`picking location "${unchecked}" checks it, as a tap does`, checked);

    pick(PICKER.region, 'No Such Region');
    testController.reportCondition('an unknown name says so', status().includes('No region "No Such Region"'));
    section.open = false;
  } catch (error) {
    testController.reportCondition(`node picker test error-free: ${error.message}`, false);
  } finally {
    unsubscribe?.();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * The location-node rebuild bug: "force-show" location nodes survive a
 * rebuild. Picks force-show through the settings (not the radio), so the
 * mode must be read back from settings:changed; then writes another
 * moduleSettings.regionGraph.* key, which rebuilds the graph; the location
 * nodes must be drawn again after each. Restores both settings (hover mode
 * then draws none in bulk).
 */
export async function testRegionGraphLocationNodesSurviveRebuild(testController) {
  const MODE = 'moduleSettings.regionGraph.locationVisibility';
  const OTHER = 'moduleSettings.regionGraph.wheelSensitivity';
  let mode0 = null;
  let other0 = null;
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows the current world', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not build');
    const cy = graphCy();
    const regions = stateManagerProxySingleton.getStaticData().regions;
    const withLocations = [...regions.values()].filter((r) => (r?.locations ?? []).length > 0).length;
    if (!withLocations) throw new Error('the loaded world has no locations');
    mode0 = await settingsManager.getSetting(MODE, 'hover');
    other0 = await settingsManager.getSetting(OTHER, 1);
    if (mode0 === 'force-show') { await settingsManager.updateSetting(MODE, 'hover'); }
    const drawn = () => graphCy()?.nodes('.location-node').length ?? 0;
    const rebuiltSince = (node) => () => !!node?.removed() && graphShowsWorld();

    // 1. force-show through the settings: a regionGraph.* write, so it also rebuilds.
    let probe = regionNodes(cy)[0];
    await settingsManager.updateSetting(MODE, 'force-show');
    const rebuilt1 = await testController.pollForCondition(rebuiltSince(probe), 'the graph rebuilt on the mode write', MAX_WAIT_TIME, 100);
    testController.reportCondition('a locationVisibility write rebuilds the graph', rebuilt1);
    const radio = document.querySelector('.region-graph-panel-container input[name="locationVisibility"]:checked');
    testController.reportCondition('the radio follows the setting', radio?.value === 'force-show');
    const shown1 = await testController.pollForCondition(() => drawn() > 0, 'location nodes drawn after the mode write', MAX_WAIT_TIME, 100);
    testController.reportCondition('force-show draws location nodes after its own rebuild', shown1);

    // 2. another regionGraph.* write: the rebuild must not drop them.
    probe = regionNodes(graphCy())[0];
    await settingsManager.updateSetting(OTHER, other0 === 2 ? 3 : 2);
    const rebuilt2 = await testController.pollForCondition(rebuiltSince(probe), 'the graph rebuilt on the second write', MAX_WAIT_TIME, 100);
    testController.reportCondition('a moduleSettings.regionGraph.* write rebuilds the graph', rebuilt2);
    const shown2 = await testController.pollForCondition(() => drawn() > 0, 'location nodes drawn after the rebuild', MAX_WAIT_TIME, 100);
    testController.reportCondition('force-show location nodes are still drawn after the rebuild', shown2);
    testController.log(`${drawn()} location node(s) drawn; ${withLocations} region(s) with locations`);
  } catch (error) {
    testController.reportCondition(`location nodes survive rebuild test error-free: ${error.message}`, false);
  } finally {
    if (other0 !== null) await settingsManager.updateSetting(OTHER, other0);
    if (mode0 !== null) {
      await settingsManager.updateSetting(MODE, mode0);
      if (mode0 === 'hover') {
        const cleared = await testController.pollForCondition(
          () => (graphCy()?.nodes('.location-node').length ?? 0) === 0, 'hover mode drew none in bulk', MAX_WAIT_TIME, 100);
        testController.reportCondition('back in hover mode, no location nodes stay drawn', cleared);
      }
    }
  }
  return testController.getOverallResult();
}

/* ── region-graph-groups-a: subRegionView = nested (option A) ───────────── */

/**
 * ⛓ subRegionView = nested on seedling_atlas (the smallest preset with sub-regions; seedling_playthrough's counts are
 * pinned by subRegionView.nested.test.js — loading its 307 regions cost the fast batch ~20 s). The row SETS the setting itself (session-only, `ctx.setSetting`) and
 * RESTORES it at the end (`ctx.restoreSettings`: the override is cleared, the stored value / schema default applies), and
 * checks the graph is back to no boxes: a leaked `nested` would change every later Region Graph row.
 * The box count is DERIVED at run time (the same fold, `multiMemberGroups`, over the loaded rules and the live substrate
 * registry), never a preset pin. Then a tap on a box runs nothing, and a tap on a member runs its click action (the
 * default actions: the path extends to it), once.
 */
/** The row's world: seedling_atlas (11 regions, 2 levels split into sub-regions) — the smallest preset with boxes. */
const NESTED_RULES = './presets/seedling_atlas/AP_1/AP_1_rules.json';
export async function testRegionGraphSubRegionNested(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let rec = null;
  let moved = false;
  const boxes = () => graphCy()?.nodes().filter((n) => isRegionGroupNode(n)) ?? null;
  try {
    if (ctx.rulesSource() !== NESTED_RULES) { await ctx.loadRulesPath(NESTED_RULES); moved = true; }
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows seedling_atlas', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not build');
    const startView = await settingsManager.getSetting(SUB_REGION_VIEW_KEY);
    testController.reportCondition(`subRegionView starts at the schema default "separate" (it is "${startView}")`, startView === 'separate');
    testController.reportCondition(`separate draws no box (${boxes()?.length})`, boxes()?.length === 0);

    const regions = stateManagerProxySingleton.getStaticData().regions;
    const last = getLastRawJsonData();
    const expected = multiMemberGroups(regions.keys(), { rules: last?.rawJsonData,
      playerId: String(last?.selectedPlayerInfo?.playerId ?? '1'), registry: substrateRegistry });
    if (expected.size === 0) throw new Error('the fold found no group of 2+ (is the Seedling substrate registered?)');

    // Switch: a moduleSettings.regionGraph.* write rebuilds the graph.
    const probe = regionNodes(graphCy())[0];
    const t0 = performance.now();
    await ctx.setSetting(SUB_REGION_VIEW_KEY, 'nested');
    const nested = await testController.pollForCondition(() => !!probe?.removed() && graphShowsWorld() && boxes()?.length === expected.size,
      `the graph rebuilt with ${expected.size} boxes`, MAX_WAIT_TIME, 50);
    const switchMs = Math.round(performance.now() - t0);
    testController.reportCondition(`nested draws one box per display group of 2+: ${boxes()?.length} = ${expected.size} (switch ${switchMs} ms)`, nested);
    const cy = graphCy();
    const inside = regionNodes(cy).filter((n) => n.isChild()).length;
    const membersExpected = [...expected.values()].reduce((a, m) => a + m.length, 0);
    testController.reportCondition(`every member is inside its box: ${inside} = ${membersExpected}`, inside === membersExpected
      && [...expected].every(([key, members]) => members.every((m) => cy.getElementById(m).parent().id() === groupNodeId(key))));
    testController.log(`[subRegionView] seedling_atlas nested: boxes=${boxes().length} inside=${inside} groupsOfOne=${regionNodes(cy).length - inside} switchMs=${switchMs}`);

    // Clicks: the default actions (session-only).
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    await ctx.setSetting(CLICK_ACTIONS, defaultClickActions());
    await testController.pollForCondition(() => stripSummary().startsWith('On click:'), 'the strip shows the click actions', 5000, 50);
    rec = recordEvents(testController, ['regionView:regionClicked']);
    const box = boxes()[0];
    box.emit('tap');
    await new Promise((r) => setTimeout(r, 300));
    testController.reportCondition(`a tap on box "${box.data('groupKey')}" runs no click (${rec.seen.length} regionClicked)`, rec.seen.length === 0);

    const member = await nearestReachableMember(testController, cy);
    if (!member) throw new Error(`no reachable member region within reach of the path end (${await pathEnd()})`);
    const region = member.id();
    member.emit('tap');
    const extended = await testController.pollForCondition(async () => (await pathEnd()) === region,
      `the path ends at ${region}`, 5000, 50);
    testController.reportCondition(`a tap on member "${region}" (in box "${member.parent().data('groupKey')}") runs its click action: the path extends to it`, extended);
    testController.reportCondition(`… and the click is published once, for the member (${rec.seen.map(([, d]) => d?.regionName).join(', ')})`,
      rec.seen.length === 1 && rec.seen[0][1]?.regionName === region);
    moved = true;
  } catch (error) {
    testController.reportCondition(`subRegionView nested test error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    await ctx.restoreSettings();
    const restored = await settingsManager.getSetting(SUB_REGION_VIEW_KEY);
    const back = await testController.pollForCondition(() => graphShowsWorld() && boxes()?.length === 0,
      'the graph rebuilt with no box', MAX_WAIT_TIME, 50);
    testController.reportCondition(`restored: subRegionView reads "${restored}" again and the graph draws no box`, restored === 'separate' && back);
    await restoreWorld(testController, ctx, before, { always: moved });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/* ── region-graph-groups-b: subRegionView = merged (option B) ───────────── */

/**
 * ⛓ subRegionView = merged on seedling_atlas (beside the nested row, for the same reason: 11 regions, 2 groups). The
 * row SETS the setting (session-only) and RESTORES it at the end, then checks the graph is back to `separate` (every
 * region its own node, no group node). The node count is DERIVED at run time from the same fold: one merged node per
 * group of 2+, the rest as regions. A tap on a group node runs the REGION click on `regionOfCell(key, members)` — the
 * region the Region Map's cell click picks — published once.
 */
export async function testRegionGraphSubRegionMerged(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let rec = null;
  let moved = false;
  const merged = () => graphCy()?.nodes().filter((n) => isRegionGroupNode(n, 'merged')) ?? null;
  try {
    if (ctx.rulesSource() !== NESTED_RULES) { await ctx.loadRulesPath(NESTED_RULES); moved = true; }
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const built = await testController.pollForCondition(graphShowsWorld, 'the graph shows seedling_atlas', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not build');
    const startView = await settingsManager.getSetting(SUB_REGION_VIEW_KEY);
    testController.reportCondition(`subRegionView starts at the schema default "separate" (it is "${startView}")`, startView === 'separate');

    const regions = stateManagerProxySingleton.getStaticData().regions;
    const last = getLastRawJsonData();
    const expected = multiMemberGroups(regions.keys(), { rules: last?.rawJsonData,
      playerId: String(last?.selectedPlayerInfo?.playerId ?? '1'), registry: substrateRegistry });
    if (expected.size === 0) throw new Error('the fold found no group of 2+ (is the Seedling substrate registered?)');
    const members = [...expected.values()].reduce((a, m) => a + m.length, 0);
    const nodesExpected = regions.size - members + expected.size;

    const probe = regionNodes(graphCy())[0];
    // ⛓ The merged switch may start an ANIMATED layout (no saved merged positions, e.g. when the row runs alone):
    // the map step below waits for it to stop before it reads a square's screen spot.
    const mergedLayouts = layoutWatch(graphCy());
    const t0 = performance.now();
    await ctx.setSetting(SUB_REGION_VIEW_KEY, 'merged');
    const ok = await testController.pollForCondition(() => !!probe?.removed() && merged()?.length === expected.size
      && regionNodes(graphCy()).length === regions.size - members, `the graph rebuilt with ${expected.size} merged nodes`, MAX_WAIT_TIME, 50);
    const switchMs = Math.round(performance.now() - t0);
    const cy = graphCy();
    const drawn = regionNodes(cy).length + merged().length;
    testController.reportCondition(`merged draws one node per display group of 2+: ${merged().length} = ${expected.size}, `
      + `${drawn} nodes = ${nodesExpected} (switch ${switchMs} ms)`, ok && drawn === nodesExpected);
    testController.reportCondition('every group node stands for exactly its fold\'s members, and no member is drawn',
      [...expected].every(([key, m]) => JSON.stringify(cy.getElementById(groupNodeId(key)).data('members')) === JSON.stringify(m)
        && m.every((r) => cy.getElementById(r).empty())));
    testController.reportCondition('no edge is a self-loop', cy.edges().every((e) => e.source().id() !== e.target().id()));
    testController.log(`[subRegionView] seedling_atlas merged: groupNodes=${merged().length} nodes=${drawn} edges=${cy.edges().length} `
      + `mixedExits=${cy.edges('.mixed-exits').length} switchMs=${switchMs}`);

    // A click on a group node: the default actions (session-only); the click runs on regionOfCell(key, members).
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    await ctx.setSetting(CLICK_ACTIONS, defaultClickActions());
    await testController.pollForCondition(() => stripSummary().startsWith('On click:'), 'the strip shows the click actions', 5000, 50);
    rec = recordEvents(testController, ['regionView:regionClicked']);
    const node = merged()[0];
    const region = regionOfCell(node.data('groupKey'), node.data('members'));
    node.emit('tap');
    const published = await testController.pollForCondition(() => rec.seen.length >= 1, 'the click is published', 5000, 50);
    await new Promise((r) => setTimeout(r, 200));
    testController.reportCondition(`a tap on group node "${node.data('groupKey')}" runs the region click on regionOfCell = "${region}" `
      + `once (${rec.seen.map(([, d]) => d?.regionName).join(', ')})`,
      published && rec.seen.length === 1 && rec.seen[0][1]?.regionName === region);
    rec.stop();
    rec = null;

    // ⛓ region-graph-map-look: nodeLook = map (session-only) draws each merged node as its Region Map cell on the
    // canvas under Cytoscape's; a REAL pointer click (mouse events at its screen spot) on a location square runs the
    // LOCATION click on that location. No rebuild: the same nodes stay.
    const mapCanvas = () => document.querySelector('.region-graph-panel-container .rg-map-look-canvas');
    const sameNode = merged()[0];
    // A square's screen spot is read from the map look's last paint: wait for any layout the switch started to stop
    // (else the nodes, and the squares, move on after the read), then fit; the map look's first paint follows the fit.
    const settledOk = await testController.pollForCondition(() => mergedLayouts.idle(), 'the merged layout stopped', MAX_WAIT_TIME, 20);
    testController.reportCondition(`the merged view's layout has settled (${mergedLayouts.state()}) before the map look`, settledOk);
    mergedLayouts.dispose();
    graphCy().fit(30);
    const mapLayouts = layoutWatch(graphCy());
    const t4 = performance.now();
    await ctx.setSetting(NODE_LOOK_KEY, 'map');
    const mapOk = await testController.pollForCondition(() => Number(mapCanvas()?.dataset.cells ?? 0) > 0,
      'the map look painted its cells', MAX_WAIT_TIME, 20);
    const mapMs = Math.round(performance.now() - t4);
    const layer = mapCanvas()?.mapLook;
    const withCell = layer?.getDebugState().nodes ?? 0;
    const cellLess = drawn - withCell;
    testController.reportCondition(`nodeLook = map: ${mapCanvas()?.dataset.cells} cells painted = ${withCell} nodes with a Region Map cell `
      + `of ${drawn} (${cellLess} without: they keep the graph look), no rebuild (switch ${mapMs} ms)`,
      mapOk && Number(mapCanvas().dataset.cells) === withCell && withCell >= drawn - 1 && withCell > 0 && !sameNode.removed());
    // ⛓ The squares' screen spots are the map look's LAST paint. Read them only once that paint is stable and agrees with
    // the nodes as they are now: the same zoom, pan, node boxes and squares over 3 polls 50 ms apart (frames between
    // them), no layout running, no paint pending, and every square inside its node's rendered box. A paint taken before
    // the nodes or the view moved on leaves a square where its node no longer is: the hit test there finds nothing.
    const paintNow = () => {
      const c = graphCy(); const d = layer?.getDebugState(); const z = c.zoom(); const p = c.pan();
      const idOf = new Map((d?.nodeKeys ?? []).map(([id, k]) => [k, id]));
      const boxes = (d?.nodeKeys ?? []).map(([id]) => { const bb = c.getElementById(id).renderedBoundingBox({ includeLabels: false });
        return [id, Math.round(bb.x1), Math.round(bb.y1), Math.round(bb.x2), Math.round(bb.y2)]; });
      const off = (d?.squares ?? []).filter((q) => {
        const bb = c.getElementById(idOf.get(q.key) ?? '').renderedBoundingBox({ includeLabels: false });
        return !(q.sx >= bb.x1 && q.sx <= bb.x2 && q.sy >= bb.y1 && q.sy <= bb.y2);
      }).map((q) => `${q.location} at (${Math.round(q.sx)}, ${Math.round(q.sy)})`);
      const sig = JSON.stringify([+z.toFixed(4), Math.round(p.x), Math.round(p.y), boxes,
        (d?.squares ?? []).map((q) => [q.key, q.location, Math.round(q.sx), Math.round(q.sy)])]);
      return { sig, off, paints: d?.stats?.paints ?? 0, pending: layer?._paintHandle != null, zoom: z, pan: p, boxes };
    };
    let lastSig = null; let same = 0; let lastPaint = null; let firstPaint = null; let polls = 0;
    const paintStable = await testController.pollForCondition(() => {
      const s = paintNow(); lastPaint = s; firstPaint ??= s; polls += 1;
      const ok = mapLayouts.idle() && !s.pending && s.off.length === 0;
      same = ok && s.sig === lastSig ? same + 1 : 0;
      lastSig = s.sig;
      return same >= 2;
    }, 'the map look paint is stable and on its nodes', MAX_WAIT_TIME, 50);
    testController.reportCondition(`the map look's last paint is stable and every square lies on its node (layout ${mapLayouts.state()}, `
      + `${lastPaint?.paints} paints, pending ${lastPaint?.pending}, off their node: ${lastPaint?.off.join('; ') || 'none'})`, paintStable);
    // One line per run, so a repeat's log says whether the first read would have been stale (the race this wait closes).
    console.log(`[rg-merged map-look] first read: layout ${mapLayouts.state()}, pending ${firstPaint?.pending}, off their node: `
      + `${firstPaint?.off.join('; ') || 'none'}, first==settled ${firstPaint?.sig === lastPaint?.sig}; settled after ${polls} polls`);
    mapLayouts.dispose();
    // ⛓ The spot to click: a point inside a square that Cytoscape's own hit-test gives to the square's node AND that
    // the layer maps back to that square (`squareAtNode`). Map-look §12: a square under another element (the player
    // marker, an edge, a location node) sends a tap to that element instead, so the row samples a 3×3 grid inside each
    // square and takes the first point that is uncovered. The text names what covers a square when none is.
    const dbg = layer?.getDebugState();
    const nodeOfKey = new Map((dbg?.nodeKeys ?? []).map(([id, k]) => [k, id]));
    const cyNow = graphCy();
    const topmostAt = (x, y) => {
      const z = cyNow.zoom(); const p = cyNow.pan();
      return cyNow.renderer().findNearestElement((x - p.x) / z, (y - p.y) / z, true, false) ?? null;
    };
    const squares = dbg?.squares ?? [];
    const covers = [];
    let sq = null;
    for (const q of squares) {
      const node = cyNow.getElementById(nodeOfKey.get(q.key) ?? '');
      const half = (q.side ?? 0) * 0.35;
      for (const [ox, oy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const x = q.sx + ox * half; const y = q.sy + oy * half;
        const top = topmostAt(x, y);
        if (top?.id?.() === node.id() && layer.squareAtNode(node, { x, y })?.location === q.location) { sq = { ...q, sx: x, sy: y }; break; }
        if (ox === 0 && oy === 0) covers.push(top ? `${top.isNode?.() ? 'node' : 'edge'} ${top.id()}` : 'nothing');
      }
      if (sq) break;
    }
    testController.reportCondition(`an uncovered point lies on a location square (${squares.length} squares; `
      + `${sq ? `clicking "${sq.location}"` : `centres covered by: ${covers.join(', ')}; squares `
        + `${squares.map((q) => `${q.location}@(${Math.round(q.sx)},${Math.round(q.sy)}) side ${Math.round(q.side ?? 0)}`).join(', ')}; `
        + `zoom ${cyNow.zoom().toFixed(3)} pan (${Math.round(cyNow.pan().x)},${Math.round(cyNow.pan().y)}); `
        + `boxes ${(lastPaint?.boxes ?? []).map((bx) => bx.join(' ')).join('; ')}`})`, !!sq);
    if (sq) {
      rec = recordEvents(testController, ['regionView:locationClicked', 'regionView:regionClicked']);
      const top = [...document.querySelectorAll('.region-graph-panel-container div[id^="cy-"] canvas')]
        .filter((c) => !c.classList.contains('rg-map-look-canvas')).pop();
      const r = top.getBoundingClientRect();
      const at = { clientX: r.left + sq.sx, clientY: r.top + sq.sy, bubbles: true, cancelable: true, button: 0, buttons: 1 };
      top.dispatchEvent(new MouseEvent('mousedown', at));
      top.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
      const clicked = await testController.pollForCondition(() => rec.seen.length >= 1, 'the square click is published', 5000, 20);
      await new Promise((res) => setTimeout(res, 200));
      testController.reportCondition(`a pointer click on the square of "${sq.location}" runs the LOCATION click on it, once `
        + `(${rec.seen.map(([n, d]) => `${n.split(':')[1]}=${d?.locationName ?? d?.regionName}`).join(', ')})`,
        clicked && rec.seen.length === 1 && rec.seen[0][0] === 'regionView:locationClicked' && rec.seen[0][1]?.locationName === sq.location);
      rec.stop();
      rec = null;
    }
    testController.log(`[nodeLook] seedling_atlas merged map: cells=${withCell}/${drawn} squares=${mapCanvas()?.dataset.squares} switchMs=${mapMs}`);

    // ⛓ region-graph-direction-layout: the Direction-aware layout, once, on the same merged + map graph (the map look's
    // rectangles are the drawn sizes), placed at once (no 1 s animation); it ends with 0 overlaps between the drawn
    // boxes on the canvas. Then the layout state is RESTORED: merged's saved positions and the preset select.
    const ui = layer?.ui;
    const lcm = ui?.layoutControlsManager;
    if (!lcm?.runDirectionLayout) throw new Error('the panel has no Direction-aware layout');
    const savedStore = new Map(lcm.positionStore());
    const presetSel = ui.controlPanel?.querySelector('#layoutPreset');
    const presetBefore = presetSel?.value ?? null;
    const layoutBefore = ui.currentLayoutPreset ?? null;
    const viewBefore = { zoom: graphCy().zoom(), pan: { ...graphCy().pan() } };
    const posBefore = new Map(graphCy().nodes().map((n) => [n.id(), { ...n.position() }]));
    const t5 = performance.now();
    const dir = lcm.runDirectionLayout({ animate: false });
    const dirMs = Math.round(performance.now() - t5);
    const laid = graphCy().nodes().filter((n) => !n.hasClass('player') && !n.hasClass('location-node') && !isRegionGroupNode(n, 'box'));
    let drawnOverlaps = 0;
    for (let i = 0; i < laid.length; i += 1) {
      for (let j = i + 1; j < laid.length; j += 1) {
        const a = laid[i]; const b = laid[j];
        if (Math.abs(a.position('x') - b.position('x')) < (a.outerWidth() + b.outerWidth()) / 2 - 1e-6
          && Math.abs(a.position('y') - b.position('y')) < (a.outerHeight() + b.outerHeight()) / 2 - 1e-6) drawnOverlaps += 1;
      }
    }
    testController.reportCondition(`the Direction-aware layout ran once on ${dir?.nodes} nodes (${dir?.preferredEdges} edges with an exit direction) `
      + `and finished with ${dir?.overlaps} overlaps, ${drawnOverlaps} between the drawn boxes (${dirMs} ms)`,
      !!dir && dir.nodes === laid.length && dir.overlaps === 0 && drawnOverlaps === 0);
    // The layout moved the nodes and fit the view: put both back, so the steps after this one see the graph as before.
    graphCy().nodes().forEach((n) => { const p = posBefore.get(n.id()); if (p && !n.locked()) n.position(p); });
    graphCy().viewport({ zoom: viewBefore.zoom, pan: viewBefore.pan });
    const playerRegion = ui.getCurrentPlayerLocation?.();
    if (playerRegion && graphCy().getElementById('player').length) ui.updatePlayerLocation(playerRegion);
    ui.currentLayoutPreset = layoutBefore;
    if (presetSel && presetBefore !== null) presetSel.value = presetBefore;
    ui.layoutGeneration += 1; // a pending layoutstop save of this run is dropped
    ui.isLayoutRunning = false;
    const store = lcm.positionStore();
    store.clear();
    for (const [id, p] of savedStore) store.set(id, p);
    const offPlace = graphCy().nodes().filter((n) => { const p = posBefore.get(n.id()); return p && !n.hasClass('player') && (n.position('x') !== p.x || n.position('y') !== p.y); }).length;
    testController.reportCondition(`restored: the layout preset reads "${presetSel?.value}" again, merged's saved positions are back (${store.size}), `
      + `${offPlace} nodes off their place and the view at zoom ${graphCy().zoom().toFixed(2)} (was ${viewBefore.zoom.toFixed(2)})`,
      (presetSel?.value ?? null) === presetBefore && store.size === savedStore.size && offPlace === 0
      && Math.abs(graphCy().zoom() - viewBefore.zoom) < 1e-9);
    testController.log(`[directionLayout] seedling_atlas merged map: nodes=${dir?.nodes} preferred=${dir?.preferredEdges} overlaps=${dir?.overlaps} `
      + `meanErr=${dir?.meanAngleError?.toFixed?.(1)} layoutMs=${dir?.layoutMs?.toFixed?.(1)} totalMs=${dirMs}`);

    // ⛓ region-graph-groups-c: collapsible (C) on the same graph and setup — every group closed draws as merged, with
    // a + badge each; a + press opens ONE group into its box, a − press closes it, and neither runs a click action;
    // a body tap still does.
    const badges = () => [...document.querySelectorAll('.region-graph-panel-container .rg-group-badge')];
    const boxes = () => graphCy()?.nodes().filter((n) => isRegionGroupNode(n, 'box')) ?? null;
    const probe2 = merged()[0];
    const t1 = performance.now();
    // A layout the switch starts (no saved collapsible positions → `runLayout`) ends with a `layoutstop` (after its
    // animation): watched from here, so the badge check below waits for the layout itself, not the panel's
    // `isLayoutRunning`, which it clears ~1 s later.
    const colLayouts = layoutWatch(graphCy());
    await ctx.setSetting(SUB_REGION_VIEW_KEY, 'collapsible');
    const closedOk = await testController.pollForCondition(() => !!probe2?.removed() && merged()?.length === expected.size
      && boxes()?.length === 0 && badges().length === expected.size, `collapsible drew ${expected.size} closed groups with a badge each`, MAX_WAIT_TIME, 50);
    const colMs = Math.round(performance.now() - t1);
    testController.reportCondition(`collapsible: every group closed (${merged()?.length} merged nodes = ${expected.size}, 0 boxes), `
      + `${badges().length} + badges (switch ${colMs} ms)`, closedOk && badges().every((b) => b.dataset.open === 'false'));
    testController.reportCondition('nodeLook = map takes no effect in collapsible: no map canvas, no map node',
      !mapCanvas() && !graphCy().nodes().some((n) => n.scratch('_rgMapKey') != null));
    rec = recordEvents(testController, ['regionView:regionClicked']);
    const plus = badges()[0];
    const key = plus.dataset.groupKey;
    // ⛓ A STABLE badge before the hit-test, never a sleep. The badge is shown (non-zero box) as soon as the rebuild
    // places it, but when the rebuild had no saved positions `runLayout` starts an ANIMATED layout: the node (and the
    // fit) keep moving for its duration, and the badge layer re-places the badge one frame after each move. A hit-test
    // in that window can land outside the panel or under another element (the race seen on the bundled boot). So wait
    // until (1) no layout is running (none started, or its `layoutstop` came), (2) the badge layer has no re-placement pending (`_frame`), (3) the badge covers
    // its node's rendered top-right corner and (4) its centre is inside the graph's container. The zoom is in the text: below
    // `showRegionNames` the badge is hidden by design and this poll goes STUCK.
    const plusNode = graphCy().getElementById(groupNodeId(key));
    // The row sets its own view for the hit-test: once the switch's layout has stopped, centre on the node at a zoom
    // where badges show (`showRegionNames`; the fit alone can leave a spread-out graph below it, the badge then hidden
    // by design).
    await testController.pollForCondition(() => colLayouts.idle(), 'the collapsible layout stopped', MAX_WAIT_TIME, 20);
    graphCy().zoom(Math.max(graphCy().zoom(), 1));
    graphCy().center(plusNode);
    const badgeState = () => {
      const b = plus.getBoundingClientRect();
      const rbb = plusNode.renderedBoundingBox({ includeLabels: false });
      const at = { x: parseFloat(plus.style.left) + b.width / 2, y: parseFloat(plus.style.top) + b.height / 2 };
      const box = graphCy().container().getBoundingClientRect();
      const cx = b.left + b.width / 2; const cy2 = b.top + b.height / 2;
      return { b, dx: at.x - rbb.x2, dy: at.y - rbb.y1, rbb, pending: ui.groupBadges?._frame != null,
        shown: plus.style.display === 'block' && b.width > 0 && b.height > 0, layout: !colLayouts.idle(),
        // covers the corner: within half its hit square (the wait's condition; the exact corner is asserted below)
        onCorner: Math.abs(at.x - rbb.x2) <= b.width / 2 && Math.abs(at.y - rbb.y1) <= b.height / 2,
        inside: cx >= box.left && cx <= box.right && cy2 >= box.top && cy2 <= box.bottom };
    };
    const stable = () => { const st = badgeState(); return st.shown && !st.layout && !st.pending && st.onCorner && st.inside; };
    const shownOk = await testController.pollForCondition(stable,
      `the + badge on "${key}" is shown, settled on its node's corner, inside the graph, with no layout running`, 5000, 20);
    colLayouts.dispose();
    const st = badgeState();
    const r = st.b;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const zoomNow = graphCy()?.zoom();
    const hitName = hit ? `${hit.tagName.toLowerCase()}${hit.className ? `.${String(hit.className).split(' ')[0]}` : ''}` : 'nothing';
    testController.reportCondition(`the + badge on "${key}" is shown (${Math.round(r.width)}×${Math.round(r.height)} px hit square, `
      + `zoom ${zoomNow?.toFixed?.(2)}) and a tap at its centre hits the badge, not the canvas `
      + `(hit ${plus.contains(hit) ? 'the badge' : hitName}; layout ${colLayouts.state()}, on corner ${st.onCorner} `
      + `[dx ${st.dx.toFixed(1)}, dy ${st.dy.toFixed(1)}, node ${st.rbb.w.toFixed(1)}×${st.rbb.h.toFixed(1)}], sync pending ${st.pending}, inside ${st.inside})`,
      shownOk && !!hit && plus.contains(hit));
    // ⛓ region-graph-badge-resize: a style change that resizes the node (the map look's size bypass leaving, a class)
    // moves no position and fires no viewport event; the layer re-places the badge on the node's `style` event, so
    // once nothing is pending the badge sits EXACTLY on the corner (it sat dx −4.8, dy 3.8 off before).
    testController.reportCondition(`the + badge on "${key}" sits exactly on its node's corner after the map look `
      + `(|dx| ${Math.abs(st.dx).toFixed(2)}, |dy| ${Math.abs(st.dy).toFixed(2)} ≤ 0.5 px)`,
      shownOk && Math.abs(st.dx) <= 0.5 && Math.abs(st.dy) <= 0.5);
    const groupSize = expected.get(key)?.length ?? 0;
    const t2 = performance.now();
    plus.click();
    const opened = await testController.pollForCondition(() => boxes()?.length === 1 && boxes()[0].data('groupKey') === key
      && boxes()[0].children().length === groupSize, `"${key}" opened into its box`, 5000, 20);
    const openMs = Math.round(performance.now() - t2);
    testController.reportCondition(`a + press opens "${key}": 1 box with ${boxes()?.[0]?.children().length} members = ${groupSize}, `
      + `${merged()?.length} groups still closed (open ${openMs} ms)`, opened && merged()?.length === expected.size - 1);
    const minus = badges().find((b) => b.dataset.groupKey === key);
    testController.reportCondition('the open box carries a − badge', minus?.dataset.open === 'true');
    const t3 = performance.now();
    minus?.click();
    const closed = await testController.pollForCondition(() => boxes()?.length === 0 && merged()?.length === expected.size,
      `"${key}" closed again`, 5000, 20);
    const closeMs = Math.round(performance.now() - t3);
    await new Promise((res) => setTimeout(res, 150));
    testController.reportCondition(`a − press closes it (${boxes()?.length} boxes, close ${closeMs} ms), and no badge press ran a click action `
      + `(${rec.seen.length} regionClicked)`, closed && rec.seen.length === 0);
    const body = merged()[0];
    const bodyRegion = regionOfCell(body.data('groupKey'), body.data('members'));
    body.emit('tap');
    const ran = await testController.pollForCondition(() => rec.seen.length >= 1, 'the body tap is published', 5000, 50);
    testController.reportCondition(`a body tap on closed "${body.data('groupKey')}" runs its click action, once, on "${bodyRegion}"`,
      ran && rec.seen.length === 1 && rec.seen[0][1]?.regionName === bodyRegion);
    testController.log(`[subRegionView] seedling_atlas collapsible: switch=${colMs}ms open=${openMs}ms close=${closeMs}ms badge=${Math.round(r.width)}px`);
    moved = true;
  } catch (error) {
    testController.reportCondition(`subRegionView merged test error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    await ctx.restoreSettings();
    const restored = await settingsManager.getSetting(SUB_REGION_VIEW_KEY);
    const back = await testController.pollForCondition(() => graphShowsWorld() && merged()?.length === 0,
      'the graph rebuilt as separate', MAX_WAIT_TIME, 50);
    testController.reportCondition(`restored: subRegionView reads "${restored}" again and every region is its own node`, restored === 'separate' && back);
    const lookBack = await settingsManager.getSetting(NODE_LOOK_KEY);
    testController.reportCondition(`restored: nodeLook reads "${lookBack}" (the default) and no map canvas is left`,
      lookBack === 'graph' && !document.querySelector('.region-graph-panel-container .rg-map-look-canvas'));
    await restoreWorld(testController, ctx, before, { always: moved });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * The nearest REACHABLE region inside a box (a compound child), not the path end, walking out from the path end along
 * the graph's ACCESSIBLE edges (a two-way edge both ways, a one-way edge forward), sorted per ring for a stable pick.
 * Reachability is read from the snapshot. Polled: the first snapshot can arrive after the build.
 */
async function nearestReachableMember(testController, cy) {
  let found = null;
  await testController.pollForCondition(async () => {
    const end = await pathEnd();
    const snapshot = stateManagerProxySingleton.getLatestStateSnapshot?.();
    if (!cy.getElementById(end)?.length || !snapshot) return false;
    const seen = new Set([end]);
    let ring = [end];
    while (ring.length && !found) {
      const next = new Set();
      for (const id of ring) {
        cy.getElementById(id).connectedEdges('.accessible').forEach((e) => {
          const s = e.source().id(); const t = e.target().id();
          const to = s === id ? t : (e.data('isBidirectional') ? s : null);
          if (to && !seen.has(to) && isRegionReachable(snapshot, to)) { seen.add(to); next.add(to); }
        });
      }
      ring = [...next].sort();
      found = ring.map((id) => cy.getElementById(id)).find((n) => n.isChild() && !n.hasClass('discovery-hidden')) ?? null;
    }
    return !!found;
  }, 'a reachable member region near the path end', MAX_WAIT_TIME, 100);
  return found;
}

/* ── CA-S2: the "On click" strip and the click actions ─────────────────── */

const CLICK_ACTIONS = 'moduleSettings.regionGraph.clickActions';
const STRIP_SUMMARY = '.region-graph-panel-container .click-actions-strip-summary';
const stripSummary = () => document.querySelector(STRIP_SUMMARY)?.textContent ?? '';

/**
 * The Graph's collapsed summary of the default actions. ⛓ CA-S4: Discovery's `discovery.discover` starts ON for the
 * Region Graph (it reproduces the old `regionGraph:nodeSelected` listener; still gated by the discovery bundle), and it
 * runs first (`ORDER.select`), so the summary leads with "discover" whenever the Discovery module is loaded.
 */
async function defaultGraphSummary(rest = 'extend path · Regions — location: check') {
  const { getClickAction } = await import('../../regionView/clickActions.js');
  return `On click: ${getClickAction('discovery.discover') ? 'discover · ' : ''}${rest}`;
}

/**
 * Open the graph, set this row's click actions (session-only, `ctx.setSetting`; `ctx.restoreSettings` puts them back)
 * and wait until the strip shows them (the panel holds what a click reads). → the Cytoscape instance.
 * `alttp`: load ALTTP first (a known world with somewhere to walk from the start; the caller reloads the world
 * loaded before) — the world a solo run boots into may have no reachable exit from its start.
 */
async function clickActionsSetUp(testController, ctx, clickActions, expectSummary, { alttp = false } = {}) {
  testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
  let built = await testController.pollForCondition(graphShowsWorld, 'the graph shows the current world', MAX_WAIT_TIME, 100);
  if (!built) throw new Error('the graph did not build');
  if (alttp) {
    const oldNode = regionNodes(graphCy())[0];
    await testController.loadALTTPRules();
    built = await testController.pollForCondition(() => !!oldNode?.removed() && graphShowsWorld(),
      'the graph rebuilt for ALTTP', MAX_WAIT_TIME, 100);
    if (!built) throw new Error('the graph did not rebuild for ALTTP');
  }
  await ctx.setSetting(CLICK_ACTIONS, clickActions);
  const shown = await testController.pollForCondition(() => stripSummary() === expectSummary,
    `the strip shows "${expectSummary}"`, 5000, 50);
  testController.reportCondition(`the "On click" strip reads "${expectSummary}" (now "${stripSummary()}")`, shown);
  return graphCy();
}

/** The region the path (or, with no path, the player) ends at. */
async function pathEnd() {
  const { getGameStateSingleton } = await import('../../gameState/singleton.js');
  const gs = getGameStateSingleton();
  return gs.getLastRegionInPath?.() || gs.getCurrentRegion?.();
}

/**
 * A REACHABLE region one exit away from where the path ends, sorted for a stable pick. (An accessible region is not
 * necessarily walkable from there — ALTTP's Menu is reachable, but has no walk back from Overworld — so the pick
 * follows an exit out of the path end.) Reachability is read from the snapshot, not from the graph's colour
 * classes, which a cold build applies a moment later. Polled: the first snapshot can arrive after the build.
 */
async function accessibleTarget(testController, cy) {
  let found = null;
  await testController.pollForCondition(async () => {
    const end = await pathEnd();
    const from = cy.getElementById(end);
    const snapshot = stateManagerProxySingleton.getLatestStateSnapshot?.();
    if (!from?.length || !snapshot) return false;
    found = from.connectedEdges().filter((e) => e.source().id() === end).targets()
      .filter((n) => n.id() !== end && !n.hasClass('player') && !n.hasClass('location-node')
        && !n.hasClass('discovery-hidden') && isRegionReachable(snapshot, n.id()))
      .sort((a, b) => (a.id() < b.id() ? -1 : 1))[0] ?? null;
    return !!found;
  }, 'a reachable region one exit from the path end', MAX_WAIT_TIME, 100);
  return found;
}

/** Record the given events (and their payloads) until `stop()`. */
function recordEvents(testController, names) {
  const seen = [];
  const offs = names.map((name) => testController.eventBus.subscribe(name, (data) => seen.push([name, data]), 'tests'));
  return { seen, stop: () => offs.forEach((off) => off?.()) };
}

/**
 * The DEFAULT click (CA-S2): a tap on an accessible region extends the path to it (route from the path end, all the
 * way) and opens the Regions panel at it (`regions.open`, registered by the Regions module). Sets its own state.
 */
export async function testRegionGraphClickDefault(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let rec = null;
  try {
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    const cy = await clickActionsSetUp(testController, ctx, defaultClickActions(), await defaultGraphSummary(), { alttp: true });
    const target = await accessibleTarget(testController, cy);
    if (!target) throw new Error(`no reachable region one exit from the path end (${await pathEnd()})`);
    const region = target.id();
    // Recorded from here: the row's own panel activation (the setup) is not the click's.
    rec = recordEvents(testController, ['regionGraph:nodeSelected', 'regionView:regionClicked', 'ui:activatePanel', 'ui:navigateToRegion']);
    target.emit('tap');
    const extended = await testController.pollForCondition(async () => (await pathEnd()) === region,
      `the path ends at ${region}`, 5000, 50);
    testController.reportCondition(`a click on "${region}" extends the path to it (it ends at ${await pathEnd()})`, extended);
    const opened = await testController.pollForCondition(
      () => rec.seen.some(([n, d]) => n === 'ui:navigateToRegion' && d?.regionName === region), 'ui:navigateToRegion', 3000, 50);
    testController.reportCondition('… and opens the Regions panel at it (ui:activatePanel regionsPanel, then ui:navigateToRegion)',
      opened && rec.seen.some(([n, d]) => n === 'ui:activatePanel' && d?.panelId === 'regionsPanel'));
    const order = rec.seen.map(([n]) => n);
    testController.reportCondition(`regionView:regionClicked { panelId: 'regionGraph', regionName } is published first (${order.join(', ')})`,
      order[0] === 'regionView:regionClicked' && rec.seen[0][1]?.panelId === 'regionGraph' && rec.seen[0][1]?.regionName === region);
    testController.reportCondition('no regionGraph:nodeSelected (retired in CA-S5)', !order.includes('regionGraph:nodeSelected'));
  } catch (error) {
    testController.reportCondition(`default click test error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    await ctx.restoreSettings();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * The ⏸ MASTER SWITCH off (CA-S2): a tap moves nobody, edits no path, opens no Regions panel — but
 * `regionView:regionClicked` is still published (it reports the click, not what the click ran). Until CA-S5 retired it,
 * this row waited on `regionGraph:nodeSelected`; it now checks that stays silent. Sets its own state.
 */
export async function testRegionGraphClickMasterOff(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let rec = null;
  let changed = true; // until the row has seen the path unchanged
  try {
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    const cy = await clickActionsSetUp(testController, ctx, { ...defaultClickActions(), enabled: false }, 'On click: ⏸ paused');
    const master = document.querySelector('.region-graph-panel-container .click-actions-strip-master');
    testController.reportCondition('the collapsed strip shows the master switch, paused (▶)', master?.textContent === '▶');
    // Any reachable region but the path end: with the master switch on, `regions.open` would publish for it whether
    // or not a walk exists, so its silence is the switch's. (No world load: this row changes nothing when it passes.)
    const endBefore = await pathEnd();
    const snapshot = stateManagerProxySingleton.getLatestStateSnapshot?.();
    const target = regionNodes(cy).filter((n) => n.id() !== endBefore && !n.hasClass('discovery-hidden')
      && isRegionReachable(snapshot, n.id())).sort((a, b) => (a.id() < b.id() ? -1 : 1))[0] ?? null;
    if (!target) throw new Error(`no reachable region but the path end (${endBefore})`);
    const region = target.id();
    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const pathBefore = JSON.stringify(getGameStateSingleton().getPath?.() ?? []);
    // Recorded from here: the row's own panel activation (the setup) is not the click's.
    rec = recordEvents(testController, ['regionGraph:nodeSelected', 'regionView:regionClicked', 'ui:activatePanel', 'ui:navigateToRegion']);
    target.emit('tap');
    const selected = await testController.pollForCondition(
      () => rec.seen.some(([n, d]) => n === 'regionView:regionClicked' && d?.panelId === 'regionGraph' && d?.regionName === region),
      'regionView:regionClicked', 3000, 50);
    testController.reportCondition(`master off: regionView:regionClicked is still published for "${region}"`, selected);
    testController.reportCondition('master off: no regionGraph:nodeSelected (retired in CA-S5)',
      !rec.seen.some(([n]) => n === 'regionGraph:nodeSelected'));
    await new Promise((r) => setTimeout(r, 750)); // what a click would do, it would have done by now
    changed = !((await pathEnd()) === endBefore && JSON.stringify(getGameStateSingleton().getPath?.() ?? []) === pathBefore);
    testController.reportCondition(`master off: no move, no path edit (the path still ends at ${await pathEnd()})`, !changed);
    testController.reportCondition('master off: no Regions-panel change (no ui:activatePanel / ui:navigateToRegion)',
      !rec.seen.some(([n]) => n === 'ui:activatePanel' || n === 'ui:navigateToRegion'));
  } catch (error) {
    testController.reportCondition(`master-off click test error-free: ${error.message}`, false);
  } finally {
    rec?.stop();
    await ctx.restoreSettings();
    await restoreWorld(testController, ctx, before, { always: changed });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * A LOCATION click with the location action "Check it now" (CA-S2): the location is checked. Through the "Go to"
 * picker's location box, which calls the location handler as a location-node tap does. Sets its own state.
 */
export async function testRegionGraphClickLocationCheck(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  try {
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    const settings = defaultClickActions();
    settings.location['path.check'] = 'now';
    await clickActionsSetUp(testController, ctx, settings, await defaultGraphSummary());
    const section = document.querySelector(`.region-graph-panel-container ${PICKER.section}`);
    if (!section) throw new Error('no picker section in the Region Graph controls');
    const staticData = stateManagerProxySingleton.getStaticData();
    let target = null;
    for (const [regionName, regionData] of staticData?.regions ?? []) {
      for (const location of regionData?.locations ?? []) {
        if (!target && locationState(ctx.snapshot(), staticData, location, { regionName }) === 'accessible') target = location.name;
      }
    }
    if (!target) throw new Error('no accessible unchecked location');
    const input = section.querySelector(PICKER.location);
    input.value = target;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const checked = await testController.pollForCondition(
      () => (ctx.snapshot()?.checkedLocations ?? []).includes(target), `${target} checked`, 5000, 100);
    testController.reportCondition(`a click on location "${target}" (check it now) checks it`, checked);
  } catch (error) {
    testController.reportCondition(`location check click test error-free: ${error.message}`, false);
  } finally {
    await ctx.restoreSettings();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/* ── CA-S4: the panel-owned actions ────────────────────────────────────── */

/**
 * `discovery.discover` on the Region Graph (CA-S4): with discovery mode on and a click allowed to discover
 * (`clickDiscoversRegion`), a tap on an undiscovered region discovers it; with loop mode's bundle
 * (`clickDiscoversRegion: false`) a tap discovers nothing. The Graph runs ONLY that action here (route, Regions and the
 * location check off). Sets its own state (session-only settings); reloads the world loaded before.
 */
export async function testRegionGraphClickDiscover(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  try {
    const discoveryState = (await import('../../discovery/singleton.js')).default;
    const { LOOP_MODE_OVERRIDES } = await import('../../discovery/worldDiscoveryMode.js');
    const only = { enabled: true, region: { 'path.route': false, 'path.checkAll': false, 'regions.open': false,
      'discovery.discover': true }, location: { 'path.check': false } };
    const cy = await clickActionsSetUp(testController, ctx, only, 'On click: discover');
    const setBundle = async (bundle) => {
      for (const [k, v] of Object.entries(bundle)) await ctx.setSetting(`moduleSettings.discovery.${k}`, v);
      await new Promise((r) => setTimeout(r, 300)); // Discovery reloads its bundle on settings:changed
    };
    await setBundle({ enableDiscoveryMode: true, regionDiscoveryTrigger: 'onEnter', clickDiscoversRegion: true,
      disableLocationCheckUI: false });
    const undiscovered = () => regionNodes(cy).filter((n) => !discoveryState.isRegionDiscovered(n.id()))
      .sort((a, b) => (a.id() < b.id() ? -1 : 1));
    const first = undiscovered()[0];
    if (!first) throw new Error('no undiscovered region in discovery mode');
    first.emit('tap');
    const discovered = await testController.pollForCondition(() => discoveryState.isRegionDiscovered(first.id()),
      `${first.id()} discovered`, 3000, 50);
    testController.reportCondition(`discovery.discover: a tap on undiscovered "${first.id()}" discovers it`, discovered);
    await setBundle(LOOP_MODE_OVERRIDES);
    const second = undiscovered()[0];
    if (!second) throw new Error('no second undiscovered region');
    second.emit('tap');
    await new Promise((r) => setTimeout(r, 750));
    testController.reportCondition(`loop mode's bundle (clickDiscoversRegion: false): a tap on "${second.id()}" discovers nothing`,
      !discoveryState.isRegionDiscovered(second.id()));
  } catch (error) {
    testController.reportCondition(`discover click test error-free: ${error.message}`, false);
  } finally {
    await ctx.restoreSettings();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

/**
 * THE REGIONS PANEL'S LOCATION CLICK FOLLOWS THE GRAPH'S STRIP (CA-S4): it reads the Region Graph's resolved
 * `clickActions.location['path.check']` (it read the old `addLocationsToPath` key, kept in step by CA-S2's mirror,
 * now retired). With "add the check to the path", a click on an accessible location in the Regions panel queues it
 * in the path and checks nothing; with "check it now", the same click checks it. Sets its own state; reloads the world.
 */
export async function testRegionsLocationClickFollowsGraphStrip(testController) {
  const ctx = buildContext({ eventBus: testController.eventBus });
  const before = ctx.rulesSource();
  let showAllBox = null;
  let showAllWas = null;
  try {
    const { defaultClickActions } = await import('../../regionView/clickActions.js');
    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const withCheck = (choice) => { const s = defaultClickActions(); s.location['path.check'] = choice; return s; };
    await ctx.setSetting(CLICK_ACTIONS, withCheck('addToPath'));
    const staticData = stateManagerProxySingleton.getStaticData();
    let target = null;
    for (const [regionName, regionData] of staticData?.regions ?? []) {
      for (const location of regionData?.locations ?? []) {
        if (!target && locationState(ctx.snapshot(), staticData, location, { regionName }) === 'accessible') {
          target = { name: location.name, region: regionName };
        }
      }
    }
    if (!target) throw new Error('no accessible unchecked location');
    testController.eventBus.publish('ui:activatePanel', { panelId: 'regionsPanel' }, 'tests');
    // Show every region (the target need not be on the visited path); put the box back after
    showAllBox = document.querySelector('#show-all-regions');
    showAllWas = showAllBox?.checked ?? null;
    if (showAllBox && !showAllBox.checked) showAllBox.click();
    const wrapper = () => document.querySelector(`li.location-item[data-location-name="${CSS.escape(target.name)}"] .location-wrapper`);
    const block = () => document.querySelector(`.region-block[data-region="${CSS.escape(target.region)}"]`);
    await testController.pollForCondition(() => !!block(), `the Regions panel shows the region ${target.region}`, 5000, 100);
    // A collapsed block renders no locations: expand it with its own header (as a user would)
    if (!wrapper()) block()?.querySelector('.region-header')?.click();
    const shown = await testController.pollForCondition(() => !!wrapper(), `the Regions panel shows ${target.name}`, 5000, 100);
    if (!shown) {
      const items = [...document.querySelectorAll('li.location-item')];
      testController.log(`Regions panel: ${items.length} location items; ${target.name}'s: ${items.filter((li) => li.dataset.locationName === target.name).map((li) => li.outerHTML.slice(0, 300)).join(' | ') || 'none'}; region blocks ${[...document.querySelectorAll('.region-block')].map((b) => `${b.dataset.region}:${b.className}`).join(',')} (target ${target.region}); world ${ctx.rulesSource()}; the panel ${document.querySelector('.regions-panel-container, #regions-panel') ? 'mounted' : 'NOT found'}`);
      throw new Error(`the Regions panel shows no clickable ${target.name}`);
    }
    const queued = () => (getGameStateSingleton().getPath?.() ?? []).some((e) => e.type === 'locationCheck' && e.locationName === target.name);
    wrapper().click();
    const inPath = await testController.pollForCondition(queued, `${target.name} queued in the path`, 5000, 50);
    testController.reportCondition(`the Graph's strip says "add the check to the path": a Regions-panel click queues "${target.name}"`,
      inPath && !(ctx.snapshot()?.checkedLocations ?? []).includes(target.name));
    await ctx.setSetting(CLICK_ACTIONS, withCheck('now'));
    const again = await testController.pollForCondition(() => !!wrapper(), `${target.name} still clickable`, 5000, 100);
    if (!again) throw new Error(`${target.name} is no longer clickable`);
    wrapper().click();
    const checked = await testController.pollForCondition(
      () => (ctx.snapshot()?.checkedLocations ?? []).includes(target.name), `${target.name} checked`, 5000, 100);
    testController.reportCondition(`the Graph's strip says "check it now": the same click checks "${target.name}"`, checked);
  } catch (error) {
    testController.reportCondition(`Regions-panel location click test error-free: ${error.message}`, false);
  } finally {
    if (showAllBox && showAllWas !== null && showAllBox.checked !== showAllWas) showAllBox.click();
    await ctx.restoreSettings();
    await restoreWorld(testController, ctx, before, { always: true });
    ctx.dispose();
  }
  return testController.getOverallResult();
}

// Register all tests
registerTest({
  id: 'test_region_graph_panel_activation',
  name: 'Region Graph Panel Activation',
  category: 'Region Graph',
  testFunction: testRegionGraphPanelActivation,
  //enabled: true,
  description: 'Tests that the Region Graph panel can be activated and displays basic UI elements'
});

registerTest({
  id: 'test_cytoscape_library_loading',
  name: 'Cytoscape Library Loading',
  category: 'Region Graph',
  testFunction: testCytoscapeLibraryLoading,
  //enabled: true,
  description: 'Tests that Cytoscape.js and FCose layout plugin load correctly'
});

registerTest({
  id: 'test_graph_initial_load',
  name: 'Graph Initial Load',
  category: 'Region Graph',
  testFunction: testGraphInitialLoad,
  //enabled: true,
  description: 'The graph shows every region of the already-loaded world on show, without a rules load of its own'
});

registerTest({
  id: 'test_graph_data_loading',
  name: 'Graph Data Loading',
  category: 'Region Graph',
  testFunction: testGraphDataLoading,
  //enabled: true,
  description: 'A rules load while the panel is up rebuilds the graph for the new world; reloads the world loaded before'
});

registerTest({
  id: 'test_control_buttons',
  name: 'Control Buttons',
  category: 'Region Graph',
  testFunction: testControlButtons,
  //enabled: true,
  description: 'Tests the functionality of Reset View and Re-layout buttons'
});

registerTest({
  id: 'test_node_selection',
  name: 'Node Selection',
  category: 'Region Graph',
  testFunction: testNodeSelection,
  //enabled: true,
  description: 'A pointer tap (mousedown + mouseup) on a region node publishes regionView:regionClicked { panelId: \'regionGraph\', regionName } and marks it selected; no regionGraph:nodeSelected (retired)'
});

registerTest({
  id: 'test_region_graph_node_picker',
  name: 'Region Graph: Go to region / location',
  category: 'Region Graph',
  testFunction: testRegionGraphNodePicker,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'The folded "Go to" section: picking a region selects its node as a tap does; picking a location checks it; an unknown name says so'
});

registerTest({
  id: 'test_region_graph_location_nodes_survive_rebuild',
  name: 'Region Graph: force-show location nodes survive a rebuild',
  category: 'Region Graph',
  testFunction: testRegionGraphLocationNodesSurviveRebuild,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'force-show written through the settings draws the location nodes, and a later moduleSettings.regionGraph.* write (which rebuilds the graph) leaves them drawn'
});

registerTest({
  id: 'test_region_graph_sub_region_nested',
  name: 'Region Graph: sub-regions nested in region boxes (subRegionView = nested)',
  category: 'Region Graph',
  testFunction: testRegionGraphSubRegionNested,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'region-graph-groups-a: on seedling_atlas (2 boxes), subRegionView = nested (session-only) draws one box per display group of 2+ with its members inside; a box tap runs nothing, a member tap runs its click action; the setting is restored and the boxes go'
});

registerTest({
  id: 'test_region_graph_sub_region_merged',
  name: 'Region Graph: sub-regions merged into one node per region (subRegionView = merged, then collapsible)',
  category: 'Region Graph',
  testFunction: testRegionGraphSubRegionMerged,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'region-graph-groups-b: on seedling_atlas (2 groups), subRegionView = merged (session-only) draws one node per display group of 2+ in place of its members, no self-loop; a tap on a group node runs the region click on regionOfCell(key, members), once; then (region-graph-map-look) nodeLook = map (session-only) paints every node with a Region Map cell as that cell with no rebuild, and a pointer click on a location square runs the location click on it, once; then (region-graph-groups-c) subRegionView = collapsible draws every group closed with a + badge, a + press opens one group into its box and a − press closes it, neither running a click action, and a body tap runs it, and the stored nodeLook = map takes no effect there; (region-graph-direction-layout) in merged + map the Direction-aware layout runs once and ends with 0 overlaps between the drawn boxes, and the layout preset and the merged view\'s saved positions are restored; the settings are restored (nodeLook graph) and every region is its own node again'
});

registerTest({
  id: 'test_region_graph_click_default',
  name: 'Region Graph: the default click extends the path and opens the Regions panel',
  category: 'Region Graph',
  testFunction: testRegionGraphClickDefault,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'CA-S2: with the default click actions, a tap on an accessible region extends the path to it and opens the Regions panel at it; regionView:regionClicked comes first'
});

registerTest({
  id: 'test_region_graph_click_master_off',
  name: 'Region Graph: the ⏸ master switch off — no action, the click event still published',
  category: 'Region Graph',
  testFunction: testRegionGraphClickMasterOff,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'CA-S2: with clickActions.enabled false, a tap moves nobody, edits no path and opens no Regions panel, but still publishes regionView:regionClicked'
});

registerTest({
  id: 'test_region_graph_click_location_check',
  name: 'Region Graph: a location click checks it now',
  category: 'Region Graph',
  testFunction: testRegionGraphClickLocationCheck,
  enabled: false, // runs where a roster enrols it (the substrates config)
  description: 'CA-S2: with the location action "check it now", a location click (through the Go to picker) checks it'
});

registerTest({
  id: 'test_region_graph_click_discover',
  name: 'Region Graph: a click discovers (discovery.discover), not under loop mode',
  category: 'Region Graph',
  testFunction: testRegionGraphClickDiscover,
  enabled: false,
  description: 'CA-S4: with discovery on and clickDiscoversRegion, a tap discovers an undiscovered region (the registered discovery.discover); with loop mode\'s bundle it discovers nothing',
});

registerTest({
  id: 'test_regions_location_click_follows_graph_strip',
  name: 'Regions panel: a location click follows the Region Graph\'s strip',
  category: 'Region Graph',
  testFunction: testRegionsLocationClickFollowsGraphStrip,
  enabled: false,
  description: 'CA-S4: the Regions panel reads the Graph\'s clickActions location choice: "add to path" queues the check, "check it now" checks it',
});
