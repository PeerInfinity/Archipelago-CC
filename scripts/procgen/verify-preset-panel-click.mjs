#!/usr/bin/env node
/**
 * The Presets-panel CLICK gate: open the panel the way a user does and click
 * through to real presets.
 *
 * This path had no coverage anywhere — every suite loads presets via URL
 * params (`?game=…&seed=…`) or `files:jsonLoaded` — so when `0033a0dab`
 * passed an out-of-scope variable into the panel's auto-load call
 * (2026-07-26), EVERY panel click threw "folderId is not defined" for two
 * days while all gates stayed green (fixed in `d52cac101`). This script is
 * that missing witness.
 *
 * What it drives, per target preset: activate the Presets tab (Golden
 * Layout), click the preset's own button in the games list, and assert the
 * EFFECT — the detail view rendered, no "Error Loading Preset" box, and the
 * auto-load status reports the rules actually loaded. Targets cover a
 * standard procgen preset plus the three atlas presets (graph-only,
 * maze-sidecar, and sphere-grown — three different rules.json shapes
 * through one click path). Any page-level ReferenceError fails the run;
 * other pageerrors are listed but only warn (known-harmless noise exists in
 * unrelated iframes).
 *
 * Prereq: dev server on :8000. Run:
 *   node scripts/procgen/verify-preset-panel-click.mjs
 */
import { chromium } from 'playwright';

const TARGETS = [
  { dir: 'procgen_topdown', seed: 'AP_1' },
  { dir: 'seedling_atlas', seed: 'AP_1' },
  { dir: 'seedling_atlas_maze', seed: 'AP_1' },
  { dir: 'seedling_atlas_sphere', seed: 'AP_1' },
];

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : 'FAIL  '}${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto('http://localhost:8000/frontend/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.lm_tab', { timeout: 60000 });
await page.waitForTimeout(2000);

const tab = page.locator('.lm_tab', { hasText: 'Presets' }).first();
check('Presets tab present', (await tab.count()) > 0);
await tab.click();
await page.waitForSelector('.game-row', { timeout: 15000 });

for (const t of TARGETS) {
  // Return to the games list if a detail view (or an error view) is open.
  const back = page.locator('#back-to-games, #back-to-presets');
  if (await back.count()) await back.first().click().catch(() => {});
  const button = `button[data-game-directory="${t.dir}"][data-seed-name="${t.seed}"]`;
  await page.waitForSelector(button, { timeout: 15000 });
  await page.click(button);
  await page.waitForTimeout(2500);

  const errBox = await page
    .locator('.error-message h3', { hasText: 'Error Loading Preset' })
    .count();
  check(`${t.dir}: no "Error Loading Preset"`, errBox === 0);

  const detail = await page.locator('.preset-detail-header').count();
  check(`${t.dir}: detail view rendered`, detail > 0);

  const status = await page
    .evaluate(() => document.getElementById('preset-status')?.textContent || '');
  check(
    `${t.dir}: rules auto-load reported success`,
    /loaded successfully/i.test(status),
    JSON.stringify(status.replace(/\s+/g, ' ').trim().slice(0, 80))
  );
}

const refErrors = pageErrors.filter((e) => /is not defined|reading '.*'|undefined/.test(e));
check('no ReferenceError-shaped page errors', refErrors.length === 0, refErrors[0] || '');
if (pageErrors.length > refErrors.length) {
  console.log(`  note: ${pageErrors.length - refErrors.length} other pageerror(s) (warn only)`);
}

await browser.close();
console.log(failures === 0 ? 'ALL OK' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
