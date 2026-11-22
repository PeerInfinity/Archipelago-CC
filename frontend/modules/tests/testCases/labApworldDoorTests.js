// lab-apworld-door-map (⚖ Robert 2026-11-21, "Map via APWorld door") — in-app rows for DOOR A, the lab set editor's
// "Open in APWorld Editor", from the host side on: the page's message (`procgenLab:openInApworldEditor`, now carrying
// the set's stamped region atlas) arrives at the Seedling lab panel exactly as a frame's message does (on the host bus,
// addressed to that panel's iframeId), the panel files the atlas in `procgenCore/atlasCache` and forwards the rules,
// the APWorld Editor's own Apply loads them (`files:jsonLoaded`), and the Region Map draws the real map.
//
// The FRAME half (the page really sends `atlases`, its id = the handed rules' id) is `check-procgen-lab-hosting.mjs`
// claim 12; the page's payload rule is pinned in `setEditorView.test.js`. ⛔ This slice carries NO level set over door
// A, so the Flash panel still starts nothing for a door-A set (rows 2–3); row 4 MEASURES what happens when the SAME set
// was first handed over the bundle door (S4's licensed path) and changes nothing to steer it.
//
// Each row SETS its own state (⚖): both host caches cleared first and after, the runtime setting restored, the world
// loaded before reloaded. ⛔ No preset-derived hard pins: every count is derived from the handed rules at run time.
import { registerTest as registerRow } from '../testRegistry.js';
import { isolatesJsSaves } from '../jsSaveIsolation.js';
// ⛓ RE3 (i) — these rows boot the wasm (and JS) Seedling: each starts with no per-room save and leaves none behind.
const registerTest = (def) => registerRow({ ...def, testFunction: isolatesJsSaves(def.testFunction) });
import { buildContext } from '../../tutorials/tutorialContext.js';
import panelManager from '../../../app/core/panelManager.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { getLastRawJsonData } from '../../stateManager/index.js';
import { getPanelInstances } from '../../regionMap/index.js';
import { getActivePanelInstance } from '../../flashPanel/index.js';
import { CUSTOM_SET_NOT_PLAYABLE } from '../../flashPanel/seedlingRandomizerEligibility.js';
import { writeBundle } from '../../presets/documentBundle.js';
import { atlasCache } from '../../procgenCore/atlasCache.js';
import { levelSetCache } from '../../procgenCore/levelSetCache.js';
import { LAB_EVENTS } from '../../procgenCore/labProtocol.js';
import { labPanelInstances } from '../../procgenLabPanel/labRoomEditor.js';

const WAIT = 20000;
const RUNTIME_KEY = 'moduleSettings.flashPanel.runtime';
const SOURCE = 'the Seedling watch page (SET arm)';
const REGION_MAP = 'regionMapPanel';
/** ⛓ The S4 row's own marker: room 10 of the vanilla 116 gains one tree, so "the delivered rooms are the held set's" is visible. */
const HELD_TREE = Object.freeze({ type: 'tree', x: 16, y: 80 });

const appUrl = (rel) => new URL(rel, document.baseURI).href;
const fetchJson = async (rel) => {
  const res = await fetch(appUrl(rel));
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  return res.json();
};
const hasHeldTree = (record) => (record?.entities ?? [])
  .some((e) => e.type === HELD_TREE.type && e.x === HELD_TREE.x && e.y === HELD_TREE.y);
const rawRules = () => getLastRawJsonData()?.rawJsonData ?? null;
const regionMap = () => getPanelInstances()[0] ?? null;
const hub = () => document.querySelector('.apworld-editor-panel')?.__panel ?? null;
const clearCaches = () => { atlasCache.clear(); levelSetCache.clear(); };

/**
 * The watch page's own compile, through its own modules (deps, REPORT compile, `atlasAtDoor`) — what its door A hands
 * over: `{rules, atlas, levelSet}`. `withTree` adds the S4 tree to room 10 over an EMPTY overlay (the play rows);
 * otherwise the vanilla 116 + the vanilla overlay (the Region Map row — the bundle door's `region-map-watch-set-bundle`).
 * ⛔ Pipeline modules are imported dynamically: a static import here would put them in the bundle's boot.
 */
async function buildWatchSet({ withTree = false } = {}) {
  const [{ tileTypeForPlacement, SEEDLING_TILE_SIZE }, { compileRegionAtlas }, { stampAtlasIdentity, validateRegionAtlas },
    { parseOelLevel }, SA, { editorVanillaSet, reportOf }, ID, { emptyOverlay }] = await Promise.all([
    import(appUrl('./modules/flashPanel/seedlingSemantics.js')),
    import(appUrl('./modules/procgenPipeline/regionAtlasCompiler.js')),
    import(appUrl('./modules/procgenPipeline/regionAtlasValidator.js')),
    import(appUrl('./modules/seedlingDemo/procgenLevelOel.js')),
    import(appUrl('./modules/seedlingDemo/seedlingSetAdapter.js')),
    import(appUrl('./modules/seedlingDemo/watchSetEditor.js')),
    import(appUrl('./modules/seedlingDemo/watchSetIdentity.js')),
    import(appUrl('./modules/seedlingDemo/seedlingSetOverlay.js')),
  ]);
  const [vanillaSet, mapDoc, rulesSchema] = await Promise.all([
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
    fetchJson('./modules/flashPanel/atlases/seedling-map.json'),
    fetchJson('./schema/rules.schema.json'),
  ]);
  const overlay = withTree ? emptyOverlay() : await fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json');
  const deps = { parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema, atlas: ID.WATCH_SET_ATLAS };
  const set = editorVanillaSet(vanillaSet, mapDoc).set;
  if (withTree) set.rooms[10].source.record.entities.push({ ...HELD_TREE });
  const lab = ID.labSetIdentity({ compileRegionAtlas, stampAtlasIdentity });
  const session = SA.createSetSession(SA.createSeedlingSetAdapter(deps), SA.setRecord(set, overlay),
    { base: { kind: 'set', set_id: set.set_id } });
  const rep = reportOf(session, deps, { compileRegionAtlas: lab.compileRegionAtlas, validateRegionAtlas });
  if (!rep.download.rules.allowed) throw new Error(`the watch page's report refused the export: ${rep.download.rules.why}`);
  return { rules: rep.rules, atlas: lab.atlasAtDoor(rep.atlas, rep.rules), levelSet: SA.downloadSet(session).set };
}

/**
 * ⛓ DOOR A FROM THE HOST SIDE: the message a hosted watch page sends, arriving on the host bus addressed to the
 * Seedling lab panel (the same handler a frame's postMessage reaches), then the APWorld Editor's own Apply. Resolves
 * true once the app's rules ARE the handed ones (the stateManager's rulesLoaded for this load).
 */
async function handOverAndApply(tc, rules, atlases) {
  const lab = labPanelInstances().find((p) => p.substrate === 'seedling') ?? null;
  tc.reportCondition('the Seedling lab panel is mounted in the app (the host half of door A)', !!lab);
  if (!lab) return false;
  const id = rules.region_atlas?.['1']?.atlas_id;
  // ⛓ The frame's own publisher (`iframe_<id>`) is registered only once that frame has connected; the panel's handler
  // routes by the payload's iframeId and never by publisher, so the row publishes as `tests` (apworldEditorTests' precedent).
  tc.eventBus.registerPublisher(LAB_EVENTS.openInApworldEditor, 'tests');
  tc.eventBus.publish(LAB_EVENTS.openInApworldEditor,
    { substrate: 'seedling', iframeId: lab.iframeId, rules, source: SOURCE, atlases }, 'tests');
  const held = await tc.pollForValue(() => {
    const p = hub();
    return p?.rulesDoc?.region_atlas?.['1']?.atlas_id === id && p.rulesDoc.game_name === rules.game_name ? p : null;
  }, 'the APWorld Editor holds the handed-over rules', WAIT, 100);
  tc.reportCondition(`the APWorld Editor holds the handed-over rules (atlas ${id})`, !!held);
  if (!held) {
    const p = hub();
    tc.log(`lab note: ${JSON.stringify(lab.noteEl?.textContent ?? null)}; hub ${p ? 'mounted' : 'NOT mounted'}, `
      + `holds ${JSON.stringify(p?.rulesDoc?.game_name ?? null)} / ${JSON.stringify(p?.rulesDoc?.region_atlas ?? null)}`, 'error');
    return false;
  }
  const loaded = tc.waitForEvent('stateManager:rulesLoaded', WAIT);
  held._handleApply();
  await loaded;
  await tc.stateManager.pingWorker?.('lab-apworld-door-apply', 5000);
  const now = rawRules();
  tc.reportCondition('Apply loaded them into the app (files:jsonLoaded → the stateManager)',
    now?.region_atlas?.['1']?.atlas_id === id && now?.game_name === rules.game_name);
  return lab;
}

/** The Region Map, opened if it is not, rebuilt on the app's CURRENT rules. Returns `{opened, stats}` or null. */
async function regionMapStats(tc) {
  const opened = getPanelInstances().length === 0;
  if (opened) await panelManager.createPanelForComponent(REGION_MAP, 'Region Map', 2);
  tc.eventBus.publish('ui:activatePanel', { panelId: REGION_MAP }, 'tests');
  const ok = await tc.pollForCondition(() => {
    const p = regionMap();
    const m = p?.model;
    return !!m && p.source?.rules === rawRules() && m.cells.size > 0 && p.getDebugState()?.lastPaint?.cells > 0;
  }, 'the Region Map rebuilt on the handed-over rules and painted', WAIT, 100);
  if (!ok) return { opened, stats: null };
  const m = regionMap().model;
  const cells = [...m.cells.values()];
  return {
    opened,
    stats: {
      source: m.layout.stats.source,
      cells: cells.length,
      sized: cells.filter((c) => c.extent).length,
      placed: cells.reduce((n, c) => n + c.tiles.length, 0),
      onTiles: cells.filter((c) => c.tileSource === 'substrate').length,
      unplaced: m.unplaced.length,
    },
  };
}

async function closeRegionMap(tc, opened) {
  if (!opened) return;
  try { await panelManager.destroyPanelByComponentType(REGION_MAP); } catch (e) { tc.log(`close Region Map: ${e.message}`); }
}

async function restoreWorld(tc, ctx, before) {
  if (typeof before === 'string' && before.startsWith('./presets/') && ctx.rulesSource() !== before) {
    try { await ctx.loadRulesPath(before); } catch (e) { tc.log(`could not reload ${before}: ${e.message}`); }
  }
  ctx.dispose();
}

/* ── row 1: door A → Apply → the Region Map draws the set's real map ── */

/**
 * The vanilla 116 + the vanilla overlay handed over door A, first WITHOUT its atlas (the control: exactly what door A
 * handed before this slice — the `hook` layout with no cell sized), then WITH it (the slice). ⛔ MUTANT: the host does
 * not file the atlas (`_fileAtlases` dropped) — the second half reads the control's numbers and reds.
 */
export async function testRegionMapLabApworldDoorSeedlingSet(tc) {
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let opened = false;
  try {
    clearCaches();
    const built = await buildWatchSet();
    const id = built.rules.region_atlas['1'].atlas_id;
    tc.reportCondition(`the page's door atlas is the one its rules name (${id})`, built.atlas.atlas_id === id);
    const want = Object.values(built.rules.regions['1']).reduce((n, r) => n + (r.locations?.length ?? 0), 0);

    // ── the control: no atlas over the door (today's payload) ──
    if (!await handOverAndApply(tc, built.rules, [])) return tc.getOverallResult();
    tc.reportCondition('with no atlas handed over, the host cache holds none', !atlasCache.has(id));
    const off = await regionMapStats(tc);
    opened = off.opened;
    tc.reportCondition(`CONTROL (no atlas): the Region Map built (${JSON.stringify(off.stats)})`, !!off.stats);
    if (!off.stats) return tc.getOverallResult();
    tc.reportCondition(`CONTROL (no atlas): no cell has its level's real extent (${off.stats.sized}/${off.stats.cells})`,
      off.stats.sized === 0);

    // ── the slice: the atlas over the door ──
    if (!await handOverAndApply(tc, built.rules, [built.atlas])) return tc.getOverallResult();
    tc.reportCondition(`the lab panel filed the door's atlas in the host cache under ${id}`, atlasCache.get(id) === built.atlas);
    const on = await regionMapStats(tc);
    const s = on.stats;
    tc.reportCondition(`WITH the atlas: the Region Map rebuilt (${JSON.stringify(s)})`, !!s);
    if (!s) return tc.getOverallResult();
    tc.reportCondition(`the layout is the substrate's hook (source: ${s.source})`, s.source === 'hook');
    tc.reportCondition(`every cell has its level's real extent (${s.sized}/${s.cells})`, s.cells > 0 && s.sized === s.cells);
    tc.reportCondition(`N/N squares placed (${s.placed}/${want}), none "not on map" (${s.unplaced})`,
      want > 0 && s.placed === want && s.unplaced === 0);
    tc.reportCondition(`squares on the substrate's own tiles in every cell (${s.onTiles}/${s.cells})`, s.onTiles === s.cells);
  } catch (e) {
    tc.reportCondition(`the door-A Region Map row ran without throwing: ${e.message}`, false);
  } finally {
    clearCaches();
    await closeRegionMap(tc, opened);
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
}

/* ── rows 2–4: nothing pretends to play ── */

/** Raise the Flash panel and wait for THIS load's answer: G's refusal box (a new one) or an AP load. */
async function flashOutcome(tc, runtime, stale, ms = runtime === 'wasm' ? 120000 : 40000) {
  tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
  return tc.pollForValue(() => {
    const panel = getActivePanelInstance();
    const box = document.querySelector('.flash-panel-custom-set-refusal');
    if (box && box !== stale.box) return { kind: 'refused', panel, box };
    if (panel?._apLoadResult && panel._apLoadResult !== stale.load && panel.transport === runtime) {
      return { kind: 'loaded', panel, result: panel._apLoadResult };
    }
    return null;
  }, `[${runtime}] the Flash panel answered this load`, ms, 200);
}

const staleFlash = () => ({
  box: document.querySelector('.flash-panel-custom-set-refusal'),
  load: getActivePanelInstance()?._apLoadResult ?? null,
});

/**
 * ⛔ THE STILL-REFUSED CASE, on an EMPTY `levelSetCache` (the row clears it): the tree set handed over door A WITH its
 * atlas → Apply → the Flash panel starts no game and shows G's "This set can't be played yet", on `runtime`, even
 * though the atlas is now in the host cache. S4's arm reads `atlasCache` only alongside a HELD set.
 */
const doorASetStartsNoGame = (runtime) => async (tc) => {
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let previous = 'auto';
  try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
  try {
    clearCaches();
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    const built = await buildWatchSet({ withTree: true });
    const id = built.rules.region_atlas['1'].atlas_id;
    tc.reportCondition(`[${runtime}] the handed rules carry the Seedling flash_panel and name a level set`,
      !!built.rules.flash_panel && !!built.rules.region_atlas['1'].level_set);
    tc.assertEqual(`[${runtime}] the host holds NO level set (the row's own state)`, 0, levelSetCache.size);
    const stale = staleFlash();
    if (!await handOverAndApply(tc, built.rules, [built.atlas])) return tc.getOverallResult();
    tc.reportCondition(`[${runtime}] …and the door's atlas IS in the host cache (${id})`, atlasCache.has(id));
    const out = await flashOutcome(tc, runtime, stale);
    tc.assertEqual(`[${runtime}] the Flash panel REFUSED (G), it did not load`, 'refused', out?.kind ?? null);
    tc.assertEqual(`[${runtime}] the status reads G's message`, CUSTOM_SET_NOT_PLAYABLE,
      document.querySelector('.flash-panel-status')?.textContent ?? null);
    tc.reportCondition(`[${runtime}] the box says "${CUSTOM_SET_NOT_PLAYABLE}" + a named reason (${out?.box?.textContent ?? ''})`,
      (out?.box?.textContent ?? '').startsWith(CUSTOM_SET_NOT_PLAYABLE));
    await new Promise((r) => setTimeout(r, 1500));
    const panel = getActivePanelInstance();
    const stage = document.querySelector('.flash-panel-swf');
    tc.assertEqual(`[${runtime}] no game was started (no adapter, no iframe, no embed)`, '0/0/0',
      `${panel?.adapter ? 1 : 0}/${stage?.querySelectorAll('iframe').length ?? -1}`
        + `/${stage?.querySelectorAll('object, embed').length ?? -1}`);
  } catch (e) {
    tc.reportCondition(`[${runtime}] the door-A refusal row ran without throwing: ${e.message}`, false);
  } finally {
    clearCaches();
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
};

/**
 * ⛓ THE SECOND CASE — MEASURED, NOT STEERED: the SAME tree set first loaded through the bundle door (S4: the host
 * now HOLDS its level set under the rules' `content_hash`), then handed over door A and applied. Whatever the Flash
 * panel does next is S4's licensed path; this row LOGS it (`OUTCOME …`) and asserts only the slice's STOP conditions:
 * it never boots VANILLA rooms (a load, if any, delivered the held set, whose room 10 has the tree) and never a set
 * whose hash is not the one the rules name.
 */
async function doorAAfterBundleMeasured(tc) {
  const runtime = 'js';
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let previous = 'auto';
  try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
  try {
    clearCaches();
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    const built = await buildWatchSet({ withTree: true });
    const ref = built.rules.region_atlas['1'].level_set;
    tc.eventBus.publish('ui:activatePanel', { panelId: 'presetsPanel' }, 'tests');
    const presets = await tc.pollForValue(() => {
      const p = document.getElementById('presets-panel')?.__panel;
      return p && typeof p.loadDocumentFile === 'function' ? p : null;
    }, 'the Presets panel is live', 15000, 50);
    if (!presets) return tc.getOverallResult();
    const bytes = await writeBundle([{ kind: 'rules', doc: built.rules }, { kind: 'region-atlas', doc: built.atlas },
      { kind: 'level-set', doc: built.levelSet }], { jszip: await presets.loadJSZip() });
    const bundleLoaded = tc.waitForEvent('stateManager:rulesLoaded', WAIT);
    await presets.loadDocumentFile(new File([bytes], 'door-a-after-bundle.zip', { type: 'application/zip' }));
    await bundleLoaded;
    await tc.stateManager.pingWorker?.('lab-apworld-door-bundle', 5000);
    tc.assertEqual('the bundle door left the set HELD under the hash the rules name', 'held',
      levelSetCache.get(ref.set_id, ref.content_hash).status);
    // ⛔ the bundle load's own Flash answer is not this row's subject: let it settle, then measure door A's.
    const settled = await flashOutcome(tc, runtime, staleFlash());
    tc.log(`after the BUNDLE door: ${settled?.kind ?? 'no answer'}`);
    /**
     * ⛓ TWO ORDERINGS, both measured. (a) door A straight after the bundle (the bundle's game still up), and (b) door A
     * after an UNRELATED world load in between, so the Flash panel decides on door A's load from scratch while the host
     * still holds the set. ⛔ Neither is steered; each is logged as an OUTCOME line.
     */
    for (const leg of ['a: straight after the bundle', 'b: after another world in between']) {
      if (leg.startsWith('b')) {
        const other = typeof before === 'string' && before.startsWith('./presets/') && !before.includes('seedling')
          ? before : null;
        if (other) await ctx.loadRulesPath(other);
        else await ctx.loadPreset('adventure', 1);
        await tc.stateManager.pingWorker?.('lab-apworld-door-other', 5000);
        tc.assertEqual(`[${leg}] the host still HOLDS the set`, 'held', levelSetCache.get(ref.set_id, ref.content_hash).status);
      }
      const stale = staleFlash();
      if (!await handOverAndApply(tc, built.rules, [built.atlas])) return tc.getOverallResult();
      const out = await flashOutcome(tc, runtime, stale, 30000);
      const panel = out?.panel ?? getActivePanelInstance();
      const delivered = panel?._seedlingRealSet ?? null;
      const tree = hasHeldTree(delivered?.rooms?.[10]?.source?.record);
      const state = `adapter=${!!panel?.adapter}, delivered set ${delivered?.set_id ?? '(none)'}, room 10 tree=${tree}, `
        + `refusal=${JSON.stringify(panel?._apLoadRefusal ?? null)}, status=${JSON.stringify(document.querySelector('.flash-panel-status')?.textContent ?? null)}`;
      const outcome = out?.kind === 'loaded' ? `PLAYS (a new AP load, ok=${!!out.result?.ok}) — ${state}`
        : out?.kind === 'refused' ? `REFUSED (G) — ${out.box.textContent}`
          : `NO NEW ANSWER (the panel kept what it had) — ${state}`;
      tc.log(`OUTCOME [${leg}]: ${outcome}`);
      tc.reportCondition(`[${leg}] measured: ${outcome}`, true);
      if (panel?.adapter && delivered) {
        tc.reportCondition(`[${leg}] STOP-check: a running game runs the HELD set (its id, room 10's tree), not vanilla rooms`,
          delivered.set_id === built.levelSet.set_id && tree);
        tc.assertEqual(`[${leg}] STOP-check: the host serves that set only under the hash the rules name`, 'held',
          levelSetCache.get(ref.set_id, ref.content_hash).status);
      }
    }
  } catch (e) {
    tc.reportCondition(`the bundle-then-door-A row ran without throwing: ${e.message}`, false);
  } finally {
    clearCaches();
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
}

registerTest({
  id: 'region-map-lab-apworld-door-seedling-set',
  name: 'Region Map: a lab set handed over "Open in APWorld Editor" draws its real map',
  description: 'lab-apworld-door-map: the watch page\'s compile of the vanilla rooms + overlay handed over door A '
    + '(procgenLab:openInApworldEditor to the Seedling lab panel) and applied in the APWorld Editor; without its atlas '
    + '(the control) no cell is sized, with it the Region Map uses the hook layout, every cell sized, N/N squares on tiles.',
  testFunction: testRegionMapLabApworldDoorSeedlingSet,
  category: 'Region Map: Seedling',
  enabled: false, // off by default — runs only in the test-substrates mode
});

for (const [id, fn, rt] of [
  ['seedling-js-runtime-lab-apworld-door-set-starts-no-game', doorASetStartsNoGame('js'), 'JS'],
  ['seedling-wasm-runtime-lab-apworld-door-set-starts-no-game', doorASetStartsNoGame('wasm'), 'wasm'],
]) {
  registerTest({
    id,
    name: `Seedling ${rt} runtime: a lab set handed over the APWorld door (atlas cached, no set held) starts no game`,
    description: 'lab-apworld-door-map: the tree set handed over door A WITH its atlas, applied, on an EMPTY '
      + `levelSetCache: the Flash panel shows "${CUSTOM_SET_NOT_PLAYABLE}" and starts nothing.`,
    testFunction: fn,
    category: id.startsWith('seedling-js-') ? 'Seedling JS runtime' : 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
  });
}

registerTest({
  id: 'seedling-js-runtime-lab-apworld-door-after-bundle-measured',
  name: 'Seedling JS runtime: a set first loaded as a bundle, then handed over the APWorld door — measured',
  description: 'lab-apworld-door-map: the tree set loaded through the bundle door (held), then handed over door A and '
    + 'applied; the Flash panel\'s answer is LOGGED (OUTCOME …). Asserted only: no vanilla rooms, no other hash.',
  testFunction: doorAAfterBundleMeasured,
  category: 'Seedling JS runtime',
  enabled: false, // off by default — runs only in the test-substrates mode
});
