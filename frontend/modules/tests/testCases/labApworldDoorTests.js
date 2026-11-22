// lab-apworld-door-map (⚖ Robert 2026-11-21, "Map via APWorld door") — in-app rows for DOOR A, the lab set editor's
// "Open in APWorld Editor", from the host side on: the page's message (`procgenLab:openInApworldEditor`, now carrying
// the set's stamped region atlas) arrives at the Seedling lab panel exactly as a frame's message does (on the host bus,
// addressed to that panel's iframeId), the panel files the atlas in `procgenCore/atlasCache` and forwards the rules,
// the APWorld Editor's own Apply loads them (`files:jsonLoaded`), and the Region Map draws the real map.
//
// The FRAME half (the page really sends `atlases`, its id = the handed rules' id) is `check-procgen-lab-hosting.mjs`
// claim 12; the page's payload rule is pinned in `setEditorView.test.js`.
// ⛓ lab-apworld-door-play (⚖ Robert 2026-11-21, "Play via APWorld door"): door A now ALSO carries the set's level-set
// document (`levelSets`), the host holds it (validate, then `putLevelSets`) before the rules go over, and the Flash
// panel plays the held set's rooms (rows 5–6, js + wasm; Edit ▸ in the js one). Rows 2–3 keep the REFUSAL: a hand-over
// that carries no set, or a tampered one the host refuses, still starts nothing. Row 4 MEASURES the bundle-then-door-A
// re-load, now with the set carried, and changes nothing to steer it.
// ⛔ (J4) Every row that can start a game stops it and CLOSES the Flash panel before it ends; this file is LAST in
// testDiscovery / init-bundled, so no older row starts from a state these rows left.
//
// Each row SETS its own state (⚖): both host caches cleared first and after, the runtime setting restored, the world
// loaded before reloaded. ⛔ No preset-derived hard pins: every count is derived from the handed rules at run time.
import { registerTest } from '../testRegistry.js';
import { buildContext } from '../../tutorials/tutorialContext.js';
import panelManager from '../../../app/core/panelManager.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { getLastRawJsonData } from '../../stateManager/index.js';
import { getPanelInstances } from '../../regionMap/index.js';
import { getActivePanelInstance } from '../../flashPanel/index.js';
import { CUSTOM_SET_NOT_PLAYABLE } from '../../flashPanel/seedlingRandomizerEligibility.js';
import { seedlingMountKey } from '../../flashPanel/seedlingMountKey.js';
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
async function handOverAndApply(tc, rules, atlases, levelSets) {
  const lab = labPanelInstances().find((p) => p.substrate === 'seedling') ?? null;
  tc.reportCondition('the Seedling lab panel is mounted in the app (the host half of door A)', !!lab);
  if (!lab) return false;
  const id = rules.region_atlas?.['1']?.atlas_id;
  // ⛓ The frame's own publisher (`iframe_<id>`) is registered only once that frame has connected; the panel's handler
  // routes by the payload's iframeId and never by publisher, so the row publishes as `tests` (apworldEditorTests' precedent).
  tc.eventBus.registerPublisher(LAB_EVENTS.openInApworldEditor, 'tests');
  tc.eventBus.publish(LAB_EVENTS.openInApworldEditor,
    { substrate: 'seedling', iframeId: lab.iframeId, rules, source: SOURCE, atlases,
      ...(levelSets === undefined ? {} : { levelSets }) }, 'tests');
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

/**
 * Raise the Flash panel, OPENING it when no instance is mounted (an earlier door row closes the one it used, J4; a
 * panel built now reads the rules already loaded). Returns whether one is mounted.
 */
async function raiseFlashPanel(tc) {
  if (!getActivePanelInstance()) {
    try { await panelManager.createPanelForComponent('flashPanel', 'Flash Panel', 2); } catch (e) { tc.log(`open Flash panel: ${e.message}`, 'error'); }
  }
  tc.eventBus.publish('ui:activatePanel', { panelId: 'flashPanel' });
  const ok = await tc.pollForCondition(() => !!getActivePanelInstance(), 'a Flash panel is mounted', 15000, 100);
  tc.reportCondition('a Flash panel is mounted (opened if none was)', !!ok);
  return !!ok;
}

/** Raise the Flash panel and wait for THIS load's answer: G's refusal box (a new one) or an AP load. */
async function flashOutcome(tc, runtime, stale, ms = runtime === 'wasm' ? 120000 : 40000) {
  await raiseFlashPanel(tc);
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

/** A world that is not the door's, so the Flash panel decides on the NEXT door-A load from scratch. */
async function loadOtherWorld(tc, ctx, before) {
  const other = typeof before === 'string' && before.startsWith('./presets/') && !before.includes('seedling') ? before : null;
  if (other) await ctx.loadRulesPath(other);
  else await ctx.loadPreset('adventure', 1);
  await tc.stateManager.pingWorker?.('lab-apworld-door-other', 5000);
}

/**
 * ⛓ (J4) STOP THE GAME AND CLOSE THE FLASH PANEL, then MEASURE that none is left running: no active instance, no
 * adapter, no runtime iframe/embed on any stage. Returns the measurement line.
 */
async function closeFlashPanel(tc) {
  try { await panelManager.destroyPanelByComponentType('flashPanel'); } catch (e) { tc.log(`close Flash panel: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 250));
  const panel = getActivePanelInstance();
  const stages = [...document.querySelectorAll('.flash-panel-swf')];
  const frames = stages.reduce((n, st) => n + st.querySelectorAll('iframe, object, embed').length, 0);
  return { ok: !panel && frames === 0, line: `instance=${panel ? 'yes' : 'none'}, adapter=${panel?.adapter ? 'yes' : 'none'}, `
    + `stages=${stages.length}, runtime frames=${frames}` };
}

/** G's refusal for THIS load, asserted whole on `runtime` (box, status, nothing started). */
async function assertRefused(tc, runtime, leg, stale) {
  const out = await flashOutcome(tc, runtime, stale);
  tc.assertEqual(`[${runtime}] [${leg}] the Flash panel REFUSED (G), it did not load`, 'refused', out?.kind ?? null);
  tc.assertEqual(`[${runtime}] [${leg}] the status reads G's message`, CUSTOM_SET_NOT_PLAYABLE,
    document.querySelector('.flash-panel-status')?.textContent ?? null);
  tc.reportCondition(`[${runtime}] [${leg}] the box says "${CUSTOM_SET_NOT_PLAYABLE}" + a named reason (${out?.box?.textContent ?? ''})`,
    (out?.box?.textContent ?? '').startsWith(CUSTOM_SET_NOT_PLAYABLE));
  await new Promise((r) => setTimeout(r, 1500));
  const panel = getActivePanelInstance();
  const stage = document.querySelector('.flash-panel-swf');
  tc.assertEqual(`[${runtime}] [${leg}] no game was started (no adapter, no iframe, no embed)`, '0/0/0',
    `${panel?.adapter ? 1 : 0}/${stage?.querySelectorAll('iframe').length ?? -1}`
      + `/${stage?.querySelectorAll('object, embed').length ?? -1}`);
}

/**
 * ⛔ THE STILL-REFUSED CASES, on an EMPTY `levelSetCache` (the row clears it). lab-apworld-door-map's row, updated by
 * lab-apworld-door-play: door A now CAN carry the set, so the refusal is kept for the two hand-overs that must still
 * start nothing — (i) one that carries NO set (an older page; the atlas alone), (ii) one whose set was TAMPERED after
 * its stamp (room 10's tree moved; its `provenance.content_hash` still says the rules' hash): the host computes the
 * hash, REFUSES it by name and holds nothing. Both: the Flash panel shows G's "This set can't be played yet". Another
 * world is loaded between the legs so the panel decides the second one from scratch.
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
    const ref = built.rules.region_atlas['1'].level_set;
    tc.reportCondition(`[${runtime}] the handed rules carry the Seedling flash_panel and name a level set`,
      !!built.rules.flash_panel && !!ref);
    tc.assertEqual(`[${runtime}] the host holds NO level set (the row's own state)`, 0, levelSetCache.size);

    // ── (i) no set carried ──
    let stale = staleFlash();
    let lab = await handOverAndApply(tc, built.rules, [built.atlas]);
    if (!lab) return tc.getOverallResult();
    tc.reportCondition(`[${runtime}] [no set] …the door's atlas IS in the host cache (${id})`, atlasCache.has(id));
    tc.assertEqual(`[${runtime}] [no set] the host holds no set, and names the player uncarried`,
      `0/${ref.set_id}`, `${levelSetCache.size}/${lab.lastLevelSetHandover?.uncarried?.[0]?.set_id ?? null}`);
    await assertRefused(tc, runtime, 'no set', stale);

    // ── (ii) a tampered set carried ──
    await loadOtherWorld(tc, ctx, before);
    const tampered = structuredClone(built.levelSet);
    tc.assertEqual(`[${runtime}] [tampered] the tampered copy still DECLARES the rules' hash`, ref.content_hash,
      tampered.provenance?.content_hash ?? null);
    const tree = tampered.rooms[10].source.record.entities.find((e) => e.type === HELD_TREE.type && e.x === HELD_TREE.x);
    tree.x += 16;
    stale = staleFlash();
    lab = await handOverAndApply(tc, built.rules, [built.atlas], [tampered]);
    if (!lab) return tc.getOverallResult();
    const handed = lab.lastLevelSetHandover ?? {};
    tc.reportCondition(`[${runtime}] [tampered] the host REFUSED the set by name (${handed.refused?.[0]?.why ?? 'no refusal'})`,
      handed.put?.length === 0 && handed.refused?.length === 1 && /not the content hash the rules name/.test(handed.refused[0].why));
    tc.assertEqual(`[${runtime}] [tampered] the host cache is still EMPTY`, 0, levelSetCache.size);
    tc.reportCondition(`[${runtime}] [tampered] the lab panel's note names the refusal`,
      /level set REFUSED \(not held\)/.test(lab.noteEl?.textContent ?? ''));
    await assertRefused(tc, runtime, 'tampered', stale);
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
        await loadOtherWorld(tc, ctx, before);
        tc.assertEqual(`[${leg}] the host still HOLDS the set`, 'held', levelSetCache.get(ref.set_id, ref.content_hash).status);
      }
      const stale = staleFlash();
      // ⛓ lab-apworld-door-play: door A now carries the set too (what the page sends)
      if (!await handOverAndApply(tc, built.rules, [built.atlas], [built.levelSet])) return tc.getOverallResult();
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
    const closed = await closeFlashPanel(tc);
    tc.log(`(J4) after the row: ${closed.line}`);
    tc.reportCondition(`(J4) the row stopped its game and closed the Flash panel (${closed.line})`, closed.ok);
    clearCaches();
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
}

/* ── rows 5–6: a set handed over door A WITH its level set plays the held set's rooms ── */

/**
 * ⛓⛓ lab-apworld-door-play — THE SLICE: on an EMPTY `levelSetCache`, the tree set handed over door A with its atlas
 * AND its level set → the host holds the set under the rules' hash (before the rules go over) → Apply → the Flash
 * panel boots `runtime`, delivered THE HELD SET: its id, room 10 with the tree, the runtime's own mounted set, and the
 * mount key is the handed rules' (so it names the set's `level_set`). ⛔ STOP-checks: never vanilla rooms, never a set
 * under another hash. On js, Edit ▸ then opens room 10 back in the lab with the same set id (S4's measure, for a set
 * that arrived over door A). (J4) The game is stopped and the Flash panel closed before the row ends, and that is
 * measured.
 */
const doorASetPlays = (runtime) => async (tc) => {
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let previous = 'auto';
  try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
  let off = () => {};
  try {
    clearCaches();
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    const built = await buildWatchSet({ withTree: true });
    const ref = built.rules.region_atlas['1'].level_set;
    tc.assertEqual(`[${runtime}] the host holds NO level set (the row's own state)`, 0, levelSetCache.size);
    tc.reportCondition(`[${runtime}] the page's set is the one the rules name (${ref?.set_id})`,
      built.levelSet.set_id === ref?.set_id && hasHeldTree(built.levelSet.rooms[10].source.record));
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const staleLoad = getActivePanelInstance()?._apLoadResult ?? null;
    const lab = await handOverAndApply(tc, built.rules, [built.atlas], [built.levelSet]);
    if (!lab) return tc.getOverallResult();
    tc.log(`[${runtime}] lab note: ${lab.noteEl?.textContent ?? ''}`);
    tc.assertEqual(`[${runtime}] the lab panel HELD the door's set under the rules' hash`, `held/${ref.set_id}`,
      `${levelSetCache.get(ref.set_id, ref.content_hash).status}/${lab.lastLevelSetHandover?.put?.[0]?.set_id ?? null}`);
    if (!await raiseFlashPanel(tc)) return tc.getOverallResult();
    const panel = await tc.pollForValue(() => {
      const p = getActivePanelInstance();
      return p?.transport === runtime && p.adapter && p.adapter !== staleAdapter && p._initRuntime === runtime ? p : null;
    }, `[${runtime}] the Flash panel mounted the ${runtime} runtime (a fresh adapter)`, runtime === 'wasm' ? 60000 : 30000, 250);
    tc.reportCondition(`[${runtime}] the Flash panel mounted the ${runtime} runtime (a fresh adapter)`, !!panel);
    if (!panel) {
      tc.log(`[${runtime}] status ${JSON.stringify(document.querySelector('.flash-panel-status')?.textContent)}; refusal box `
        + `${JSON.stringify(document.querySelector('.flash-panel-custom-set-refusal')?.textContent ?? null)}`, 'error');
      return tc.getOverallResult();
    }
    if (runtime === 'wasm') {
      const start = await tc.pollForValue(() => {
        if (panel.statusElement?.textContent !== 'click ▶ Start in the game') return null;
        try { return document.getElementById(panel.flashObjectId)?.contentWindow?.document?.querySelector('#btn-start') ?? null; } catch { return null; }
      }, '[wasm] the panel asks for ▶ Start', 120000, 250);
      tc.reportCondition('[wasm] the panel asks for ▶ Start', !!start);
      if (!start) return tc.getOverallResult();
      start.click();
    }
    const done = await tc.pollForValue(() => (panel._apLoadResult && panel._apLoadResult !== staleLoad
      && panel._seedlingRealSet ? panel._apLoadResult : null), `[${runtime}] the AP load ran`, runtime === 'wasm' ? 120000 : 60000, 250);
    if (!done) {
      tc.log(`[${runtime}] apLoad ${JSON.stringify(panel._apLoadResult ?? null)?.slice(0, 400)}; refusal `
        + `${JSON.stringify(panel._apLoadRefusal ?? null)}; log: ${(document.querySelector('.flash-panel-log')?.textContent ?? '')
          .split('\n').slice(-20).join(' | ')}`, 'error');
    }
    tc.reportCondition(`[${runtime}] the AP load delivered and reset (ok)`, !!done?.ok);
    tc.assertEqual(`[${runtime}] no refusal (the set is HELD)`, null, panel._apLoadRefusal ?? null);
    const delivered = panel._seedlingRealSet;
    tc.assertEqual(`[${runtime}] STOP-check: the DELIVERED set is the held one (its id), not the original rooms`,
      built.levelSet.set_id, delivered?.set_id ?? null);
    tc.reportCondition(`[${runtime}] STOP-check: the delivered room 10 has the tree (the held set's own room)`,
      hasHeldTree(delivered?.rooms?.[10]?.source?.record));
    tc.assertEqual(`[${runtime}] STOP-check: the host serves it only under the hash the rules name`, 'held',
      levelSetCache.get(ref.set_id, ref.content_hash).status);
    let ls = null;
    try { ls = JSON.parse(panel.adapter.bot('botLevelSet')); } catch { ls = null; }
    tc.assertEqual(`[${runtime}] the RUNTIME mounted the delivered set (botLevelSet.active, its rooms)`,
      `${built.levelSet.set_id}/${built.levelSet.rooms.length}`, `${ls?.active ?? null}/${ls?.rooms ?? ls?.table_levels ?? null}`);
    const key = panel._apLoadKey;
    let keyed = null;
    try { keyed = JSON.parse(key)?.atlas?.level_set ?? null; } catch { keyed = null; }
    tc.reportCondition(`[${runtime}] the mount key is the handed rules' and names the set (${JSON.stringify(keyed)})`,
      key === seedlingMountKey({ rules: built.rules, playerId: tc.stateManager.getStaticData?.()?.playerId,
        locations: tc.stateManager.getStaticData?.()?.locations })
        && keyed?.set_id === ref.set_id && keyed?.content_hash === ref.content_hash);
    if (runtime === 'js') {
      const rt = document.getElementById(panel.flashObjectId)?.contentWindow?.__seedlingJsRuntime ?? null;
      tc.reportCondition('[js] the JS page\'s mounted room 10 has the tree', hasHeldTree(rt?.mounted?.records?.get(10)));
      // ── Edit ▸ (S4), for a set that arrived over door A: room 10 opens back in the lab, same set id ──
      tc.assertEqual('[js] Edit ▸ is offered (a held set)', '', panel.editRoomButton?.style.display ?? null);
      panel.adapter.teleport({ level: 10, x: 48, y: 48 });
      const in10 = await tc.pollForCondition(() => {
        try { return JSON.parse(panel.adapter.bot('botStatus'))?.level === 10; } catch { return false; }
      }, '[js] the game is in room 10', 20000, 200);
      tc.reportCondition('[js] the game is in room 10 (teleported, for Edit ▸)', !!in10);
      if (in10) {
        let announced = null;
        const handler = (data) => {
          const p = data?.payload;
          if (p?.substrate === 'seedling' && p.room === 10 && p.record?.set) announced = p;
        };
        tc.eventBus.subscribe(LAB_EVENTS.levelChanged, handler, 'tests');
        off = () => tc.eventBus.unsubscribe?.(LAB_EVENTS.levelChanged, handler, 'tests');
        const answer = await panel._editHeldSetRoom();
        tc.assertEqual('[js] Edit ▸ handed room 10 of the door-A set to the lab', `true/10/${ref.set_id}`,
          `${answer?.ok}/${answer?.room}/${answer?.set_id}`);
        const seen = answer?.ok ? await tc.pollForValue(() => announced, '[js] the lab announces room 10 open', 60000, 250) : null;
        tc.assertEqual('[js] the lab opened room 10 of the SAME set (its own announce: set id)', ref.set_id,
          seen?.record?.set?.set_id ?? null);
        tc.reportCondition('[js] the lab\'s room 10 has the tree', hasHeldTree(seen?.record?.set?.rooms?.[10]?.source?.record));
      }
    }
  } catch (e) {
    tc.reportCondition(`[${runtime}] the door-A play row ran without throwing: ${e.message}`, false);
  } finally {
    off();
    getActivePanelInstance()?._heldSetEditHandle?.close?.();
    const closed = await closeFlashPanel(tc);
    tc.log(`(J4) after the row: ${closed.line}`);
    tc.reportCondition(`[${runtime}] (J4) the row stopped its game and closed the Flash panel (${closed.line})`, closed.ok);
    clearCaches();
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
};

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
    name: `Seedling ${rt} runtime: a lab set handed over the APWorld door without its level set, or with a tampered one, starts no game`,
    description: 'lab-apworld-door-map, updated by lab-apworld-door-play: on an EMPTY levelSetCache, the tree set '
      + 'handed over door A (i) with its atlas and NO level set, (ii) with a level set tampered after its stamp (the '
      + `host refuses it, holds nothing): the Flash panel shows "${CUSTOM_SET_NOT_PLAYABLE}" and starts nothing.`,
    testFunction: fn,
    category: id.startsWith('seedling-js-') ? 'Seedling JS runtime' : 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
  });
}

registerTest({
  id: 'seedling-js-runtime-lab-apworld-door-after-bundle-measured',
  name: 'Seedling JS runtime: a set first loaded as a bundle, then handed over the APWorld door — measured',
  description: 'lab-apworld-door-map (door A carries the set since lab-apworld-door-play): the tree set loaded through '
    + 'the bundle door (held), then handed over door A and applied; the Flash panel\'s answer is LOGGED (OUTCOME …). '
    + 'Asserted only: no vanilla rooms, no other hash, and the Flash panel closed at the end.',
  testFunction: doorAAfterBundleMeasured,
  category: 'Seedling JS runtime',
  enabled: false, // off by default — runs only in the test-substrates mode
});

for (const [id, rt] of [
  ['seedling-js-runtime-lab-apworld-door-set-plays-held-rooms', 'js'],
  ['seedling-wasm-runtime-lab-apworld-door-set-plays-held-rooms', 'wasm'],
]) {
  registerTest({
    id,
    name: `Seedling ${rt === 'js' ? 'JS' : 'wasm'} runtime: a lab set handed over the APWorld door WITH its level set plays the held set's rooms`,
    description: 'lab-apworld-door-play: on an EMPTY levelSetCache, the tree set handed over door A with its atlas and '
      + 'its level set; the lab panel holds the set under the rules\' hash, Apply, and the Flash panel delivers THAT set '
      + `(room 10 has the tree; the runtime's mounted set; the mount key names it)${rt === 'js' ? '; Edit ▸ opens room 10 back in the lab, same set id' : ''}. `
      + 'The game is stopped and the Flash panel closed at the end.',
    testFunction: doorASetPlays(rt),
    category: rt === 'js' ? 'Seedling JS runtime' : 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
  });
}
