/**
 * In-app end-to-end verify for "World persistence across reloads" (P3).
 * Design: NewDocs/plans/world-persistence-reload-design.md.
 *
 *   1. Boot the app → note the default (first-preset) game. A fresh boot
 *      does NOT persist (only user-driven files:jsonLoaded does), so
 *      sessionStorage.apcc_lastWorld starts empty.
 *   2. Load a DIFFERENT preset by publishing a real files:jsonLoaded through
 *      window.eventBus (the same event the presets panel publishes) →
 *      assert the active game changed AND a path-type record was persisted.
 *   3. page.reload() (same tab, sessionStorage survives) → assert the app
 *      restored the loaded world, NOT the default preset, with no user action.
 *   4. Reload once more → assert the restore repeats (entry kept on success).
 *   5. Navigate to ?reset=true (same tab) → assert the default preset boots
 *      and apcc_lastWorld was cleared.
 *
 * Requires the dev server on :8000. Run:
 *   node scripts/procgen/verify-world-persistence-reload.mjs
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:8000/frontend/';
const KEY = 'apcc_lastWorld';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

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

try {
  // ── 1. Boot → default game, nothing persisted ──────────────────────
  await page.goto(BASE);
  await bootReady();
  const defaultGame = await gameName();
  check('boots with a default game', !!defaultGame, String(defaultGame));
  check('fresh boot persists nothing', (await readRecord()) === null);

  // ── 2. Load a DIFFERENT preset via a real files:jsonLoaded ─────────
  const loaded = await page.evaluate(async (dfltGame) => {
    const resp = await fetch('./presets/preset_files.json');
    const presets = await resp.json();
    // Find a preset whose game differs from the boot default.
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
        // panel is one) so the eventBus accepts it — same event the panel fires.
        const publishers = window.eventBus.publishers?.['files:jsonLoaded'];
        const publisher = publishers ? [...publishers.keys()][0] : 'presets';
        window.eventBus.publish(
          'files:jsonLoaded',
          {
            jsonData,
            selectedPlayerId: game.player ?? 1,
            sourceName: path,
          },
          publisher
        );
        return { path, expectGame: jsonData.game_name || entry.name || game.game };
      }
    }
    return null;
  }, defaultGame);
  check('found + published a non-default preset', !!loaded, JSON.stringify(loaded));

  await waitFor('active game switches to the loaded preset', async () => {
    const g = await gameName();
    return g && g !== defaultGame;
  });
  const loadedGame = await gameName();
  check('loaded game differs from default', loadedGame !== defaultGame,
    `${loadedGame} vs ${defaultGame}`);

  const rec = await waitFor('record persisted', async () => await readRecord());
  check('persisted as path-type', rec.type === 'path', JSON.stringify(rec));
  check('persisted path matches the load', rec.path === loaded.path, rec.path);

  // ── 3. Reload → restore, no user action ────────────────────────────
  await page.reload();
  await bootReady();
  check('restored the loaded world after reload (not default)',
    (await gameName()) === loadedGame, `${await gameName()} (default is ${defaultGame})`);
  check('restored source is the persisted path',
    (await rulesSource()) === loaded.path, String(await rulesSource()));

  // ── 4. Reload again → restore repeats (entry kept on success) ───────
  await page.reload();
  await bootReady();
  check('restore repeats on a second reload',
    (await gameName()) === loadedGame, String(await gameName()));
  check('record still present after successful restore',
    (await readRecord()) !== null);

  // ── 4b. Inline-type restore (procgen / manual-upload shape) ────────
  // Re-publish the same rules under a NON-preset sourceName so it persists
  // inline (full payload), reload, and confirm it restores without a fetch.
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

  // ── 4c. Substrate reattach spot-check (JtA dataset-keyed slot) ─────
  // The JtA save slot keys on dataset_id, which lives in preset_sidecars — a
  // raw-rules-only field. Prove that identity survives a reload: load the JtA
  // dataset preset, reload, and confirm the restored raw JSON carries the same
  // dataset_id (so the slot re-keys to the same world by construction).
  const JTA_PATH =
    './presets/jta_dataset_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
  const readDatasetId = () =>
    page.evaluate(async () => {
      const mod = await import('./modules/stateManager/index.js');
      const raw = mod.getLastRawJsonData?.()?.rawJsonData;
      const sidecars = raw?.preset_sidecars;
      if (!sidecars) return null;
      // Walk to the first jta_dataset_ref.dataset_id.
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

  // ── 5. ?reset=true (same tab) → default boots, entry cleared ───────
  await page.goto(`${BASE}?reset=true`);
  await bootReady();
  check('?reset=true boots the default game',
    (await gameName()) === defaultGame, String(await gameName()));
  check('?reset=true cleared the persisted record',
    (await readRecord()) === null);

  console.log(`\nPASS — ${checks} checks`);
} finally {
  await browser.close();
}
