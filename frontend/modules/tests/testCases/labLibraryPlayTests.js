// Document library B5 (⚖ Robert 2026-11-23, Q1 "B5: app plays from library") — in-app rows for THE APP PLAYING FROM THE
// LIBRARY: the Seedling lab's own writer (`watchLibraryEngine`, the code its worker runs) saves versions into a
// PER-ROW database; door A then hands over a version's rules WITHOUT its set (the front, `levelSetCache`, is empty), and
// the Flash panel fills the front from the library by fingerprint and plays that exact version, on both runtimes.
//
//   · `…-lab-library-plays-saved-version` (study §6 pin 5, and "an empty front, a library hit"): v1 then v2 saved;
//     rules naming v1 play v1's rooms, never v2's; deleting v1 is refused while the game holds it; once the game stops
//     and v1 is deleted, the same rules are G's named refusal — never vanilla, never v2.
//   · `…-lab-library-running-version-held` (J2 retired, and js-23 (d) "never swapped without a press"): while the game
//     runs, a NEW version saved in the lab changes nothing in it; four other puts do not push its set out; Edit ▸ and a
//     re-load still answer `held`; the holder heartbeats.
//   · `seedling-lab-library-leave-warning-navigation` (js-23 M3, ⚖ Robert Q2): the hosted lab with a draft pending
//     arms its "Leave site?" handler, and a navigation of the frame still completes — the harness does not hang; a
//     committed draft disarms it. Also reads what `persist()` answered under the driver (⚖ Q3).
//
// ⛓ Each row SETS its own state (⚖): its own database (asserted absent at the start, deleted and asserted gone at the
// end), the front emptied first and after, the runtime setting restored, the world reloaded. The app reads the row's
// database through `levelSetLibrarySource.dbName` (B2's seam pattern), restored to null.
// ⛔ (J4) Every row that starts a game stops it and CLOSES the Flash panel before it ends, and measures that; this file
// is LAST in testDiscovery / init-bundled.
import { registerTest } from '../testRegistry.js';
import { buildContext } from '../../tutorials/tutorialContext.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { getLastRawJsonData } from '../../stateManager/index.js';
import { getActivePanelInstance } from '../../flashPanel/index.js';
import { atlasCache } from '../../procgenCore/atlasCache.js';
import { levelSetCache } from '../../procgenCore/levelSetCache.js';
import { heldLevelSetOf, putLevelSets } from '../../procgenCore/levelSetReference.js';
import { levelSetLibrarySource } from '../../procgenCore/levelSetLibrary.js';
import { labPanelInstances } from '../../procgenLabPanel/labRoomEditor.js';
import {
  HELD_TREE, assertRefused, closeFlashPanel, handOverAndApply, loadOtherWorld, raiseFlashPanel, restoreWorld, staleFlash,
} from './labApworldDoorTests.js';

const RUNTIME_KEY = 'moduleSettings.flashPanel.runtime';
const appUrl = (rel) => new URL(rel, document.baseURI).href;
const fetchJson = async (rel) => {
  const res = await fetch(appUrl(rel));
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  return res.json();
};
const rawRules = () => getLastRawJsonData()?.rawJsonData ?? null;
const clearCaches = () => { atlasCache.clear(); levelSetCache.clear(); };
const treesIn = (record) => (record?.entities ?? []).filter((e) => e.type === 'tree').length;
const dbNameOf = (rowId) => `archipelago-cc-document-library-test-${rowId}`;

/** The library's modules, fetched raw on either boot (they are never in the bundle). */
const libraryModules = async () => {
  const [core, idb] = await Promise.all([
    import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibrary.js')),
    import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibraryIdb.js')),
  ]);
  return { core, idb };
};

/**
 * The lab's writer over the row's database: `save(trees)` files a numbered version (`report`) of the vanilla 116 with
 * `trees` MORE trees in room 10 than vanilla — v1 one (HELD_TREE), v2 two — and returns the saved entry with its members' documents
 * read back BY FINGERPRINT (`{entry, set, rules, atlas}`).
 */
async function labWriter(dbName) {
  const [{ createLibraryEngine }, { editorVanillaSet }, { emptyOverlay }] = await Promise.all([
    import(/* @vite-ignore */ appUrl('./modules/seedlingDemo/watchLibraryEngine.js')),
    import(/* @vite-ignore */ appUrl('./modules/seedlingDemo/watchSetEditor.js')),
    import(/* @vite-ignore */ appUrl('./modules/seedlingDemo/seedlingSetOverlay.js')),
  ]);
  const [vanilla, map, rulesSchema, atlasSchema, levelSetSchema] = await Promise.all([
    fetchJson('./modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
    fetchJson('./modules/flashPanel/atlases/seedling-map.json'),
    fetchJson('./schema/rules.schema.json'),
    fetchJson('./schema/region-atlas.schema.json'),
    fetchJson('./schema/seedling-level-set.schema.json'),
  ]);
  const engine = createLibraryEngine({ dbName, schemas: { rulesSchema, atlasSchema, levelSetSchema },
    source: { page: 'tests/labLibraryPlayTests', tab_id: 'in-app-row' } });
  await engine.start({ lineageId: null, parent: null });
  const { core, idb } = await libraryModules();
  const readBack = async (entryId) => {
    const backend = idb.createIdbBackend({ dbName });
    const lib = core.createDocumentLibrary({ backend });
    try {
      const { entry } = await lib.getEntry(entryId);
      const doc = async (role) => {
        const m = entry.members.find((x) => x.role === role);
        const got = m ? await lib.get({ idKey: m.id_key, docId: m.doc_id, contentHash: m.content_hash }) : null;
        return got?.status === 'held' ? got.doc : null;
      };
      return { entry, set: await doc('set'), rules: await doc('rules'), atlas: await doc('atlas') };
    } finally { await backend.close(); }
  };
  return {
    async save(trees) {
      const set = editorVanillaSet(vanilla, map).set;
      for (let i = 0; i < trees; i += 1) set.rooms[10].source.record.entities.push({ ...HELD_TREE, x: HELD_TREE.x + 32 * i });
      const answer = await engine.save({ record: { set, overlay: emptyOverlay() }, kind: 'version', savedBecause: 'report' });
      if (answer.status !== 'saved') throw new Error(`the lab writer did not save: ${JSON.stringify(answer).slice(0, 300)}`);
      return { answer, ...(await readBack(answer.entry_id)) };
    },
    close: () => engine.close(),
  };
}

/** One library call on a short-lived connection of the row's database. */
async function withLibrary(dbName, fn) {
  const { core, idb } = await libraryModules();
  const backend = idb.createIdbBackend({ dbName });
  try { return await fn(core.createDocumentLibrary({ backend })); } finally { await backend.close(); }
}

/** The row's start: its database is not there, and the app is pointed at it. */
async function startRowDb(tc, dbName) {
  const { idb } = await libraryModules();
  tc.assertEqual(`the row's database ${dbName} does not exist at the start`, false, await idb.libraryDatabaseExists(dbName));
  levelSetLibrarySource.dbName = dbName;
}

/** The row's end: the seam back to null, the database deleted and no longer listed. */
async function endRowDb(tc, dbName) {
  levelSetLibrarySource.dbName = null;
  const { idb } = await libraryModules();
  let gone = null;
  try {
    const d = await idb.deleteLibraryDatabase(dbName);
    if (d?.blocked) tc.log(`delete of ${dbName} was blocked first (an open connection), then completed`, 'warn');
    gone = (await idb.libraryDatabaseExists(dbName)) === false;
  } catch (e) { tc.log(`delete ${dbName}: ${e.message}`, 'error'); }
  tc.reportCondition(`the row's database ${dbName} is deleted and no longer listed`, gone === true);
}

/** Raise the Flash panel and wait for `runtime` to play THIS load (a fresh adapter; ▶ Start on wasm). */
async function playLoad(tc, runtime, staleAdapter, staleLoad) {
  if (!await raiseFlashPanel(tc)) return null;
  const panel = await tc.pollForValue(() => {
    const p = getActivePanelInstance();
    return p?.transport === runtime && p.adapter && p.adapter !== staleAdapter && p._initRuntime === runtime ? p : null;
  }, `[${runtime}] the Flash panel mounted the ${runtime} runtime (a fresh adapter)`, runtime === 'wasm' ? 60000 : 30000, 250);
  tc.reportCondition(`[${runtime}] the Flash panel mounted the ${runtime} runtime (a fresh adapter)`, !!panel);
  if (!panel) {
    tc.log(`[${runtime}] status ${JSON.stringify(document.querySelector('.flash-panel-status')?.textContent)}; refusal box `
      + `${JSON.stringify(document.querySelector('.flash-panel-custom-set-refusal')?.textContent ?? null)}`, 'error');
    return null;
  }
  if (runtime === 'wasm') {
    const start = await tc.pollForValue(() => {
      if (panel.statusElement?.textContent !== 'click ▶ Start in the game') return null;
      try { return document.getElementById(panel.flashObjectId)?.contentWindow?.document?.querySelector('#btn-start') ?? null; } catch { return null; }
    }, '[wasm] the panel asks for ▶ Start', 120000, 250);
    tc.reportCondition('[wasm] the panel asks for ▶ Start', !!start);
    if (!start) return null;
    start.click();
  }
  const done = await tc.pollForValue(() => (panel._apLoadResult && panel._apLoadResult !== staleLoad && panel._seedlingRealSet
    ? panel._apLoadResult : null), `[${runtime}] the AP load ran`, runtime === 'wasm' ? 120000 : 60000, 250);
  if (!done) {
    tc.log(`[${runtime}] apLoad ${JSON.stringify(panel._apLoadResult ?? null)?.slice(0, 400)}; refusal `
      + `${JSON.stringify(panel._apLoadRefusal ?? null)}; log: ${(document.querySelector('.flash-panel-log')?.textContent ?? '')
        .split('\n').slice(-20).join(' | ')}`, 'error');
  }
  tc.reportCondition(`[${runtime}] the AP load delivered and reset (ok)`, !!done?.ok);
  return done?.ok ? panel : null;
}

const liveHoldsOf = (dbName, lineageId) => withLibrary(dbName, async (lib) => {
  const inv = await lib.inventory();
  return inv.lineages?.find((l) => l.lineage_id === lineageId)?.liveHolds ?? [];
});

/** Stop the game and close the Flash panel (J4), measured; then wait until the library hold is gone. */
async function stopAndMeasure(tc, runtime, dbName, lineageId) {
  getActivePanelInstance()?._heldSetEditHandle?.close?.();
  const closed = await closeFlashPanel(tc);
  tc.log(`(J4) ${closed.line}`);
  tc.reportCondition(`[${runtime}] (J4) the game stopped and the Flash panel closed (${closed.line})`, closed.ok);
  if (dbName && lineageId) {
    const released = await tc.pollForValue(async () => ((await liveHoldsOf(dbName, lineageId)).length === 0 ? true : null),
      `[${runtime}] the game's library hold is released when the panel goes`, 10000, 200);
    tc.reportCondition(`[${runtime}] the game's library hold is released when the panel goes`, !!released);
  }
  return closed.ok;
}

/* ── row 1: pin 5 — the lab saves v1 then v2; rules naming v1 play v1; v1 deleted → G ── */

const playsSavedVersion = (runtime) => async (tc) => {
  const rowId = `seedling-${runtime}-runtime-lab-library-plays-saved-version`;
  const dbName = dbNameOf(rowId);
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let previous = 'auto';
  try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
  let writer = null;
  try {
    clearCaches();
    await startRowDb(tc, dbName);
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    writer = await labWriter(dbName);
    const v1 = await writer.save(1);
    const v2 = await writer.save(2);
    const ref1 = v1.rules?.region_atlas?.['1']?.level_set;
    tc.assertEqual(`[${runtime}] the lab saved v1 then v2 in ONE lineage`, `1/2/${v1.answer.lineage_id}`,
      `${v1.answer.seq}/${v2.answer.seq}/${v2.answer.lineage_id}`);
    tc.reportCondition(`[${runtime}] v1's rules name v1's set (${ref1?.set_id}), v2's another (${v2.set?.set_id})`,
      ref1?.set_id === v1.set?.set_id && v2.set?.set_id !== v1.set?.set_id);
    tc.assertEqual(`[${runtime}] the front holds NO level set (the row's own state: an empty front)`, 0, levelSetCache.size);

    // ── an EMPTY front, a library hit: door A hands v1's RULES over with its atlas and NO set ──
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const staleLoad = getActivePanelInstance()?._apLoadResult ?? null;
    const lab = await handOverAndApply(tc, v1.rules, [v1.atlas], []);
    if (!lab) return tc.getOverallResult();
    tc.assertEqual(`[${runtime}] door A carried no set (the player is named uncarried)`, ref1.set_id,
      lab.lastLevelSetHandover?.uncarried?.[0]?.set_id ?? null);
    const panel = await playLoad(tc, runtime, staleAdapter, staleLoad);
    if (!panel) return tc.getOverallResult();
    const delivered = panel._seedlingRealSet;
    tc.assertEqual(`[${runtime}] STOP-check: the delivered set is v1 (its id), not v2 and not the original rooms`,
      v1.set.set_id, delivered?.set_id ?? null);
    const room10 = (doc) => treesIn(doc?.rooms?.[10]?.source?.record);
    tc.assertEqual(`[${runtime}] STOP-check: the delivered room 10 has v1's trees (${room10(v1.set)}), not v2's (${room10(v2.set)})`,
      `${room10(v1.set)}/true`, `${room10(delivered)}/${room10(v1.set) !== room10(v2.set)}`);
    const log = document.querySelector('.flash-panel-log')?.textContent ?? '';
    tc.reportCondition(`[${runtime}] the panel says the document library filled the set`,
      log.includes(`document library filled level set ${ref1.set_id}`));
    tc.assertEqual(`[${runtime}] the front now holds v1 under the rules' hash`, 'held',
      levelSetCache.get(ref1.set_id, ref1.content_hash).status);
    let ls = null;
    try { ls = JSON.parse(panel.adapter.bot('botLevelSet')); } catch { ls = null; }
    tc.assertEqual(`[${runtime}] the RUNTIME mounted v1 (botLevelSet.active)`, v1.set.set_id, ls?.active ?? null);

    // ── the game holds v1: front + library; deleting it is refused while it plays ──
    await panel._levelSetHold?.ready;
    tc.assertEqual(`[${runtime}] the game holds its version in the front and the library`, 'held/held',
      `${panel._levelSetHold?.state()?.front ?? null}/${panel._levelSetHold?.state()?.library ?? null}`);
    const refused = await withLibrary(dbName, (lib) => lib.deleteLineage(v1.answer.lineage_id));
    tc.assertEqual(`[${runtime}] deleting v1's set while the game holds it is REFUSED (held)`, 'refused/held',
      `${refused.status}/${refused.why ?? null}`);

    // ── stop, delete, empty the front: the same rules are G's named refusal ──
    if (!await stopAndMeasure(tc, runtime, dbName, v1.answer.lineage_id)) return tc.getOverallResult();
    const deleted = await withLibrary(dbName, (lib) => lib.deleteLineage(v1.answer.lineage_id));
    tc.assertEqual(`[${runtime}] with the game stopped, v1's set is deleted`, 'deleted', deleted.status);
    levelSetCache.clear(); // the front a fresh page would have
    await loadOtherWorld(tc, ctx, before);
    const stale = staleFlash();
    if (!await handOverAndApply(tc, v1.rules, [v1.atlas], [])) return tc.getOverallResult();
    await assertRefused(tc, runtime, 'v1 deleted', stale);
    tc.assertEqual(`[${runtime}] [v1 deleted] the front still holds nothing (never v2, never another version)`, 0,
      levelSetCache.size);
  } catch (e) {
    tc.reportCondition(`[${runtime}] the library play row ran without throwing: ${e.message}`, false);
  } finally {
    await stopAndMeasure(tc, runtime, null, null);
    try { await writer?.close(); } catch { /* best effort */ }
    clearCaches();
    await endRowDb(tc, dbName);
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
};

/* ── row 2: J2 retired + (d) no swap ── */

const runningVersionHeld = (runtime) => async (tc) => {
  const rowId = `seedling-${runtime}-runtime-lab-library-running-version-held`;
  const dbName = dbNameOf(rowId);
  const ctx = buildContext({ eventBus: tc.eventBus });
  const before = ctx.rulesSource();
  let previous = 'auto';
  try { previous = await settingsManager.getSetting(RUNTIME_KEY, 'auto'); } catch { /* keep auto */ }
  let writer = null;
  try {
    clearCaches();
    await startRowDb(tc, dbName);
    await settingsManager.updateSetting(RUNTIME_KEY, runtime, { persist: false });
    writer = await labWriter(dbName);
    const v1 = await writer.save(1);
    const ref1 = v1.rules.region_atlas['1'].level_set;
    const staleAdapter = getActivePanelInstance()?.adapter ?? null;
    const staleLoad = getActivePanelInstance()?._apLoadResult ?? null;
    if (!await handOverAndApply(tc, v1.rules, [v1.atlas], [])) return tc.getOverallResult();
    const panel = await playLoad(tc, runtime, staleAdapter, staleLoad);
    if (!panel) return tc.getOverallResult();
    await panel._levelSetHold?.ready;
    const adapter = panel.adapter;
    const load = panel._apLoadResult;
    const key = panel._apLoadKey;
    const botActive = () => { try { return JSON.parse(panel.adapter.bot('botLevelSet'))?.active ?? null; } catch { return null; } };
    tc.assertEqual(`[${runtime}] the game plays v1`, v1.set.set_id, panel._seedlingRealSet?.set_id ?? null);

    // ── (d) a NEW version saved in the lab while the game runs changes nothing in it ──
    const v2 = await writer.save(2);
    tc.assertEqual(`[${runtime}] the lab saved v2 while the game runs`, 2, v2.answer.seq);
    await new Promise((r) => setTimeout(r, 2000));
    tc.assertEqual(`[${runtime}] (d) NO SWAP: the same adapter, the same AP load, the same mount key, the same rooms`,
      `true/true/true/${v1.set.set_id}/${v1.set.set_id}/${treesIn(v1.set.rooms[10].source.record)}`,
      `${panel.adapter === adapter}/${panel._apLoadResult === load}/${panel._apLoadKey === key}/`
        + `${panel._seedlingRealSet?.set_id ?? null}/${botActive()}/${treesIn(panel._seedlingRealSet?.rooms?.[10]?.source?.record)}`);
    tc.assertEqual(`[${runtime}] (d) the front did not take v2 (nothing listens for saves)`, false,
      levelSetCache.has(v2.set.set_id));

    // ── J2 retired: four other puts do not push the playing set out ──
    const others = [0, 1, 2, 3, 4].map((i) => ({ set_id: `lab-library-other-${i}`, schema_version: 1, rooms: [{ id: 0, n: i }] }));
    putLevelSets(others);
    tc.assertEqual(`[${runtime}] J2 retired: after FIVE other puts the playing version is still served`, 'held',
      levelSetCache.get(ref1.set_id, ref1.content_hash).status);
    tc.reportCondition(`[${runtime}] …and the bound still works on the others (${levelSetCache.refs().length} entries, v1 held)`,
      levelSetCache.refs().length === 5 && levelSetCache.holdsOf(ref1) === 1);
    const reload = heldLevelSetOf(rawRules(), tc.stateManager.getStaticData?.()?.playerId ?? '1', levelSetCache);
    tc.assertEqual(`[${runtime}] a re-load of the rules still reads held`, 'held', reload.status);
    const edit = await panel._editHeldSetRoom({ open: async () => ({ ok: true }) });
    tc.reportCondition(`[${runtime}] Edit ▸ still answers (ok: ${edit?.ok}; ${edit?.why ?? ''})`, edit?.ok === true);

    // ── the holder's heartbeat (B1 D8): a beat keeps the library hold live ──
    const beat = await panel._levelSetHold.beat();
    tc.reportCondition(`[${runtime}] the holder heartbeats its library hold (beats ${beat.beats}, library ${beat.library})`,
      beat.beats >= 1 && beat.library === 'held');
    const holds = await liveHoldsOf(dbName, v1.answer.lineage_id);
    tc.assertEqual(`[${runtime}] the library lists ONE live game hold on v1, from this tab`, '1/game',
      `${holds.length}/${holds[0]?.kind ?? null}`);
    await stopAndMeasure(tc, runtime, dbName, v1.answer.lineage_id);
  } catch (e) {
    tc.reportCondition(`[${runtime}] the running-version row ran without throwing: ${e.message}`, false);
  } finally {
    await stopAndMeasure(tc, runtime, null, null);
    try { await writer?.close(); } catch { /* best effort */ }
    clearCaches();
    await endRowDb(tc, dbName);
    try { await settingsManager.updateSetting(RUNTIME_KEY, previous, { persist: false }); } catch { /* best effort */ }
    await restoreWorld(tc, ctx, before);
  }
  return tc.getOverallResult();
};

/* ── row 3: js-23 M3 — the leave warning under the harness ── */

export async function testLabLeaveWarningNavigation(tc) {
  const dbName = dbNameOf('seedling-lab-library-leave-warning-navigation');
  const lab = labPanelInstances().find((p) => p.substrate === 'seedling') ?? null;
  tc.reportCondition('the Seedling lab panel is mounted in the app', !!lab);
  if (!lab) return tc.getOverallResult();
  const win = () => lab.iframe?.contentWindow ?? null;
  const doc = () => { try { return lab.iframe?.contentDocument ?? null; } catch { return null; } };
  const navigate = (search) => {
    tc.eventBus.registerPublisher('procgenLab:navigate', 'tests');
    tc.eventBus.publish('procgenLab:navigate', { substrate: 'seedling', iframeId: lab.iframeId, search }, 'tests');
  };
  const ready = (want) => tc.pollForValue(() => {
    const w = win();
    try {
      return w?.location?.search?.includes(want) && w.__editorEdit && w.__editorEdit.status !== 'loading' ? w : null;
    } catch { return null; }
  }, `the lab frame took ?${want} and its EDIT arm is ready`, 60000, 250);
  try {
    const { idb } = await libraryModules();
    tc.assertEqual(`the row's database ${dbName} does not exist at the start`, false, await idb.libraryDatabaseExists(dbName));
    navigate(`source=edit&level=4&libraryDb=${dbName}`);
    let w = await ready(`libraryDb=${dbName}`);
    tc.reportCondition('the hosted lab is on the row\'s database, with no writer yet', !!w && w.__labLibrary === undefined);
    if (!w) return tc.getOverallResult();
    doc().getElementById('editLoadVanilla').click();
    const loaded = await tc.pollForCondition(() => win()?.__editorEdit?.set?.rooms === 116, 'the vanilla 116 is held', 60000, 200);
    tc.reportCondition('the lab holds the vanilla 116', !!loaded);
    tc.assertEqual('a CLEAN tab: no "Leave site?" handler', null, win().onbeforeunload ?? null);

    // ── an edit, then the draft LANDS: armed in the window, disarmed at commit ──
    doc().getElementById('editSetAddRoom').click();
    const armed = await tc.pollForValue(() => (win()?.__labLibrary?.draftPending === true ? win().__labLibrary : null),
      'the edit left a draft pending', 5000, 20);
    tc.assertEqual('a pending draft ARMS the handler (readout + window.onbeforeunload)', 'true/function',
      `${armed?.leaveArmed ?? null}/${typeof win()?.onbeforeunload}`);
    const landed = await tc.pollForValue(() => {
      const L = win()?.__labLibrary;
      return L && L.saves.length > 0 && !L.draftPending && L.inFlight === 0 ? L : null;
    }, 'the draft was saved', 30000, 100);
    tc.assertEqual('the draft committed → the handler is DISARMED', 'saved/false/null',
      `${landed?.saves?.at(-1)?.status ?? null}/${landed?.leaveArmed ?? null}/${win()?.onbeforeunload ?? null}`);
    // ⚖ Q3 under the driver: what persist() answered (Chromium answers silently; nothing prompts)
    const persisted = await tc.pollForValue(() => win()?.__labLibrary?.persist ?? null, 'persist() answered', 5000, 100);
    tc.log(`persist() under the driver: ${JSON.stringify(persisted)}; line ${JSON.stringify(doc()?.getElementById('editLibraryPersist')?.textContent ?? null)}`);
    tc.reportCondition(`persist() was asked once at the first save and answered (${persisted?.status ?? 'nothing'})`,
      ['granted', 'already', 'denied', 'unsupported'].includes(persisted?.status));

    // ── M3: an edit, and NAVIGATE while the handler is armed: the navigation completes; nothing hangs ──
    doc().getElementById('editSetAddRoom').click();
    const armedAgain = await tc.pollForValue(() => (win()?.__labLibrary?.leaveArmed === true ? true : null),
      'armed again by a second edit', 5000, 20);
    tc.reportCondition('a second edit arms the handler again', !!armedAgain);
    const oldWin = win();
    const t0 = performance.now();
    navigate('source=generate');
    const moved = await tc.pollForValue(() => {
      const nw = win();
      try { return nw && nw !== oldWin || nw?.location?.search?.includes('source=generate') ? nw : null; } catch { return null; }
    }, 'the frame navigated away with the handler armed', 30000, 100);
    const settled = moved ? await tc.pollForValue(() => {
      try { return win()?.document?.readyState === 'complete' && !win().location.search.includes('libraryDb=') ? true : null; } catch { return null; }
    }, 'the new page in the frame finished loading', 30000, 100) : null;
    tc.reportCondition(`M3: with "Leave site?" armed, the frame's navigation COMPLETED (${Math.round(performance.now() - t0)} ms): `
      + 'no dialog held it (in-app clicks carry no user activation, so Chromium shows no box)', !!settled);
    w = null;
  } catch (e) {
    tc.reportCondition(`the leave-warning row ran without throwing: ${e.message}`, false);
  } finally {
    // the frame back to its boot query, its database deleted
    try {
      if (!win()?.location?.search?.startsWith('?source=generate')) navigate('source=generate');
    } catch { /* best effort */ }
    await endRowDb(tc, dbName);
  }
  return tc.getOverallResult();
}

for (const [rt, label] of [['js', 'JS'], ['wasm', 'wasm']]) {
  registerTest({
    id: `seedling-${rt}-runtime-lab-library-plays-saved-version`,
    name: `Seedling ${label} runtime: rules naming a saved version play THAT version from the document library`,
    description: 'document library B5 (study pin 5): the lab\'s writer saves v1 then v2 into the row\'s own database; '
      + 'door A hands over v1\'s rules with NO set (an empty front); the Flash panel fills the front from the library '
      + 'and plays v1 (room 10\'s tree count is v1\'s, not v2\'s); deleting v1 is refused while it plays; stopped and '
      + 'deleted, the same rules are G\'s named refusal. The game is stopped and the Flash panel closed at the end.',
    testFunction: playsSavedVersion(rt),
    category: rt === 'js' ? 'Seedling JS runtime' : 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
  });
  registerTest({
    id: `seedling-${rt}-runtime-lab-library-running-version-held`,
    name: `Seedling ${label} runtime: a running game keeps its saved version (no swap, never pushed out)`,
    description: 'document library B5 (J2 retired; js-23 (d)): v1 plays from the library; a NEW version saved while it '
      + 'runs changes nothing in the game; five other puts leave v1 served; a re-load and Edit ▸ still answer held; the '
      + 'holder heartbeats its library hold. The game is stopped and the Flash panel closed at the end.',
    testFunction: runningVersionHeld(rt),
    category: rt === 'js' ? 'Seedling JS runtime' : 'Seedling wasm runtime',
    enabled: false, // off by default — runs only in the test-substrates mode
  });
}

registerTest({
  id: 'seedling-lab-library-leave-warning-navigation',
  name: 'Seedling lab: "Leave site?" is armed only while unsaved, and never blocks a navigation in the harness',
  description: 'document library B5 (⚖ Robert Q2; js-23 M3): in the hosted lab on the row\'s own database, a clean '
    + 'tab has no beforeunload handler, a pending draft arms it, the committed draft disarms it, and a navigation of '
    + 'the frame with it armed completes. Also logs what persist() answered at the first save (⚖ Q3).',
  testFunction: testLabLeaveWarningNavigation,
  category: 'Seedling JS runtime',
  enabled: false, // off by default — runs only in the test-substrates mode
});
