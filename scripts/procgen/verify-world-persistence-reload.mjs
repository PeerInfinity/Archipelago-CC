/**
 * In-app end-to-end verify for "World persistence across reloads".
 * Design: NewDocs/plans/world-persistence-reload-design.md.
 *
 * The feature is OPT-IN (generalSettings.restoreLastWorld, default OFF), so the
 * verify runs two contexts:
 *
 *   PHASE A — OFF BY DEFAULT (fresh context, setting untouched):
 *     Load a non-default world, confirm NOTHING is persisted (write gate off),
 *     reload, confirm the default preset boots (read gate off — no restore).
 *
 *   PHASE B — ENABLED (context seeded with restoreLastWorld + autoLoadMode on):
 *     Load a non-default preset by publishing a real files:jsonLoaded through
 *     window.eventBus (the same event the presets panel fires) → assert a
 *     path-type record is persisted; reload → assert the loaded world restores
 *     with no user action; reload again → restore repeats (entry kept on
 *     success); inline-type restore leg (procgen / manual-upload shape); JtA
 *     substrate reattach spot-check (dataset_id slot key survives the reload);
 *     ?reset=true → default boots and the record is cleared.
 *
 * Enabling in PHASE B injects a default-mode blob carrying restoreLastWorld +
 * autoLoadMode = true. That feeds BOTH gates: the raw boot read (modeDataLoader,
 * before settingsManager is up) sees restoreLastWorld directly, and autoLoadMode
 * routes the same userSettings into settingsManager for the write-site gate.
 *
 * Requires the dev server on :8000. Run:
 *   node scripts/procgen/verify-world-persistence-reload.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:8000/frontend/';
const KEY = 'apcc_lastWorld';

const browser = await chromium.launch();
let page; // reassigned per context
let logs = [];

function attach(p) {
  p.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  p.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
}

let checks = 0;
function check(desc, ok, detail = '') {
  if (!ok) {
    console.log('LOGS (last 40):', logs.slice(-40).join('\n'));
    throw new Error(`FAIL: ${desc}${detail ? ` — ${detail}` : ''}`);
  }
  checks += 1;
  console.log(`ok ${checks}: ${desc}`);
}

async function waitFor(desc, fn, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    let v;
    try {
      v = await fn();
    } catch {
      v = null;
    }
    if (v) return v;
    if (Date.now() - start > timeoutMs) {
      console.log('LOGS (last 40):', logs.slice(-40).join('\n'));
      throw new Error(`timeout waiting for: ${desc}`);
    }
    await page.waitForTimeout(500);
  }
}

const gameName = () =>
  page.evaluate(() =>
    (window.stateManagerProxy && window.stateManagerProxy.getGameName
      ? window.stateManagerProxy.getGameName()
      : null)
  );
const rulesSource = () =>
  page.evaluate(() =>
    (window.stateManagerProxy ? window.stateManagerProxy.currentRulesSource : null)
  );
const readRecord = () =>
  page.evaluate((k) => {
    const raw = sessionStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, KEY);

async function bootReady() {
  await waitFor('stateManagerProxy exposed', () =>
    page.evaluate(() => !!(window.stateManagerProxy && window.eventBus))
  );
  // getGameName resolves once the worker confirms rules load.
  await waitFor('a game is active', async () => {
    const g = await gameName();
    return g && g !== 'Unknown Game';
  });
}

// Publish a real files:jsonLoaded for a preset whose game differs from the boot
// default (the same event the presets panel fires). Returns { path, expectGame }.
function loadNonDefaultPreset(defaultGame) {
  return page.evaluate(async (dfltGame) => {
    const resp = await fetch('./presets/preset_files.json');
    const presets = await resp.json();
    for (const [dir, entry] of Object.entries(presets)) {
      const folders = entry.folders || {};
      for (const [seed, folder] of Object.entries(folders)) {
        const rulesFile = (folder.files || []).find((f) => f.endsWith('_rules.json'));
        if (!rulesFile) continue;
        const game = (folder.games && folder.games[0]) || {};
        if ((entry.name || game.game) === dfltGame) continue; // skip default's game
        const path = `./presets/${dir}/${seed}/${rulesFile}`;
        const r = await fetch(path);
        if (!r.ok) continue;
        const jsonData = await r.json();
        // Publish as a REGISTERED publisher of files:jsonLoaded (the presets
        // panel is one) so the eventBus accepts it.
        const publishers = window.eventBus.publishers?.['files:jsonLoaded'];
        const publisher = publishers ? [...publishers.keys()][0] : 'presets';
        window.eventBus.publish(
          'files:jsonLoaded',
          { jsonData, selectedPlayerId: game.player ?? 1, sourceName: path },
          publisher
        );
        return { path, expectGame: jsonData.game_name || entry.name || game.game };
      }
    }
    return null;
  }, defaultGame);
}

try {
  // ══ PHASE A — OFF BY DEFAULT ═══════════════════════════════════════
  const ctxA = await browser.newContext();
  page = await ctxA.newPage();
  attach(page);
  logs.length = 0;

  await page.goto(BASE);
  await bootReady();
  const defA = await gameName();
  check('off-default: boots with a default game', !!defA, String(defA));

  const loadedA = await loadNonDefaultPreset(defA);
  check('off-default: published a non-default preset', !!loadedA, JSON.stringify(loadedA));
  await waitFor('off-default: active game switches (load still works)', async () =>
    (await gameName()) !== defA
  );
  // The write gate is off, so persistence must NOT happen. Give the (skipped)
  // async persist a beat to prove it stays a no-op.
  await page.waitForTimeout(700);
  check('off-default: nothing persisted (write gate off)', (await readRecord()) === null);

  await page.reload();
  await bootReady();
  check('off-default: reload boots the default (no restore)',
    (await gameName()) === defA, String(await gameName()));
  await ctxA.close();

  // ══ PHASE B — ENABLED ══════════════════════════════════════════════
  const ctxB = await browser.newContext();
  page = await ctxB.newPage();
  attach(page);
  logs.length = 0;

  // Turn the opt-in feature ON for every boot in this context.
  await page.addInitScript(() => {
    localStorage.setItem(
      'archipelagoToolSuite_modeData_default',
      JSON.stringify({
        userSettings: { generalSettings: { restoreLastWorld: true, autoLoadMode: true } },
      })
    );
  });

  await page.goto(BASE);
  await bootReady();
  const defaultGame = await gameName();
  check('enabled: boots with a default game', !!defaultGame, String(defaultGame));
  check('enabled: fresh boot persists nothing yet', (await readRecord()) === null);

  // ── Load a non-default preset → persisted path-type ────────────────
  const loaded = await loadNonDefaultPreset(defaultGame);
  check('enabled: found + published a non-default preset', !!loaded, JSON.stringify(loaded));
  await waitFor('enabled: active game switches to the loaded preset', async () => {
    const g = await gameName();
    return g && g !== defaultGame;
  });
  const loadedGame = await gameName();
  check('enabled: loaded game differs from default', loadedGame !== defaultGame,
    `${loadedGame} vs ${defaultGame}`);
  const rec = await waitFor('enabled: record persisted', async () => await readRecord());
  check('enabled: persisted as path-type', rec.type === 'path', JSON.stringify(rec));
  check('enabled: persisted path matches the load', rec.path === loaded.path, rec.path);

  // ── Reload → restore, no user action ───────────────────────────────
  await page.reload();
  await bootReady();
  check('restored the loaded world after reload (not default)',
    (await gameName()) === loadedGame, `${await gameName()} (default is ${defaultGame})`);
  check('restored source is the persisted path',
    (await rulesSource()) === loaded.path, String(await rulesSource()));

  // ── Reload again → restore repeats (entry kept on success) ──────────
  await page.reload();
  await bootReady();
  check('restore repeats on a second reload',
    (await gameName()) === loadedGame, String(await gameName()));
  check('record still present after successful restore',
    (await readRecord()) !== null);

  // ── Inline-type restore (procgen / manual-upload shape) ────────────
  await page.evaluate(async (path) => {
    const jsonData = await (await fetch(path)).json();
    const publishers = window.eventBus.publishers?.['files:jsonLoaded'];
    const publisher = publishers ? [...publishers.keys()][0] : 'presets';
    window.eventBus.publish(
      'files:jsonLoaded',
      { jsonData, selectedPlayerId: 1, sourceName: 'userLoaded:persist-inline-test.json' },
      publisher
    );
  }, loaded.path);
  const inlineRec = await waitFor('inline record persisted', async () => {
    const r = await readRecord();
    return r && r.sourceName === 'userLoaded:persist-inline-test.json' ? r : null;
  });
  check('persisted as inline-type', inlineRec.type === 'inline', JSON.stringify(inlineRec.type));
  check('inline record carries the payload', !!inlineRec.jsonData);
  await page.reload();
  await bootReady();
  check('restored inline world after reload', (await gameName()) === loadedGame,
    String(await gameName()));
  check('restored inline source label preserved',
    (await rulesSource()) === 'userLoaded:persist-inline-test.json', String(await rulesSource()));

  // ── Substrate reattach spot-check (JtA dataset-keyed slot) ─────────
  // The JtA save slot keys on dataset_id, which lives in preset_sidecars — a
  // raw-rules-only field. Prove that identity survives a reload.
  const JTA_PATH =
    './presets/jta_dataset_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
  const readDatasetId = () =>
    page.evaluate(async () => {
      const mod = await import('./modules/stateManager/index.js');
      const raw = mod.getLastRawJsonData?.()?.rawJsonData;
      const sidecars = raw?.preset_sidecars;
      if (!sidecars) return null;
      let found = null;
      const walk = (o) => {
        if (found || !o || typeof o !== 'object') return;
        if (o.jta_dataset_ref?.dataset_id) {
          found = o.jta_dataset_ref.dataset_id;
          return;
        }
        for (const v of Object.values(o)) walk(v);
      };
      walk(sidecars);
      return found;
    });

  const jtaLoaded = await page.evaluate(async (path) => {
    const r = await fetch(path);
    if (!r.ok) return null;
    const jsonData = await r.json();
    const publishers = window.eventBus.publishers?.['files:jsonLoaded'];
    const publisher = publishers ? [...publishers.keys()][0] : 'presets';
    window.eventBus.publish(
      'files:jsonLoaded',
      { jsonData, selectedPlayerId: 1, sourceName: path },
      publisher
    );
    return true;
  }, JTA_PATH);
  check('JtA dataset preset published', !!jtaLoaded);
  await waitFor('JtA record persisted as its path', async () => {
    const r = await readRecord();
    return r && r.path === JTA_PATH ? r : null;
  });
  const datasetBefore = await waitFor('dataset_id readable before reload', readDatasetId);
  await page.reload();
  await bootReady();
  check('JtA world restored after reload',
    (await rulesSource()) === JTA_PATH, String(await rulesSource()));
  const datasetAfter = await waitFor('dataset_id readable after reload', readDatasetId);
  check('JtA dataset_id (slot key) survives the reload identically',
    datasetAfter === datasetBefore, `${datasetAfter} vs ${datasetBefore}`);

  // ── ?reset=true (same tab) → default boots, entry cleared ──────────
  await page.goto(`${BASE}?reset=true`);
  await bootReady();
  check('?reset=true boots the default game',
    (await gameName()) === defaultGame, String(await gameName()));
  check('?reset=true cleared the persisted record',
    (await readRecord()) === null);
  await ctxB.close();

  console.log(`\nPASS — ${checks} checks`);
} finally {
  await browser.close();
}
