#!/usr/bin/env node
// Verify the fork's standalone `?dataset=<url>` boot (synthetic-data rider
// D-a, jta-synthetic-post-v1-design.md §4.4).
//
// Serves the fork page from one local server and a GENERATED themed dataset
// from a second (different origin, CORS-enabled — proving the boot path
// works for genuinely remote documents), then drives headless Chromium:
//
//   1. absent param  -> vanilla boot: getLoadedDatasetId() null, vanilla
//                       zone-0 task in the DOM (the byte-inert leg's page
//                       half; the sim half is the native parity gate);
//   2. ?dataset=<url> -> the dataset id reports loaded, a themed zone-0
//                       task renders, the vanilla name does not;
//   3. broken url    -> the failure surfaces (alert) and the vanilla game
//                       keeps running untouched.
//
// Usage: node scripts/procgen/verify-jta-dataset-url-boot.mjs

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const forkDir = path.join(repoRoot, "frontend/modules/journey-to-ascension");

const { generateJtaDataset } = await import(pathToFileURL(
  path.join(repoRoot, "frontend/modules/jtaSubstrateWrapper/generateDataset.js")));

const profile = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "CC/scripts/jta-stats/results/vanilla-profile.json"), "utf8")).static;
const vanilla = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json"), "utf8"));

const { dataset } = generateJtaDataset({ seed: 1, profile, vanilla, params: {} });

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".map": "application/json",
};

function serveDir(rootDir, { cors = false } = {}) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(rootDir, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(rootDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    const headers = { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" };
    if (cors) headers["Access-Control-Allow-Origin"] = "*";
    res.writeHead(200, headers).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const dsDir = fs.mkdtempSync(path.join(await import("node:os").then((m) => m.default.tmpdir()), "jta-ds-"));
fs.writeFileSync(path.join(dsDir, "ds.json"), JSON.stringify(dataset));

const gameServer = await serveDir(forkDir);
const dsServer = await serveDir(dsDir, { cors: true });
const gameOrigin = `http://127.0.0.1:${gameServer.address().port}`;
const dsUrl = `http://127.0.0.1:${dsServer.address().port}/ds.json`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${msg}`);
  if (!cond) failures++;
};

const vanillaTask = vanilla.zones[0].tasks[0].name;
const themedTask = dataset.zones[0].tasks[0].name;

async function boot(url) {
  const page = await browser.newPage();
  const alerts = [];
  page.on("dialog", (d) => { alerts.push(d.message()); void d.accept(); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { page, alerts };
}

// 1 — absent param: vanilla boot, page half of the byte-inert leg.
{
  const { page, alerts } = await boot(`${gameOrigin}/index.html`);
  await page.waitForFunction((t) => document.body.innerText.includes(t), vanillaTask);
  const id = await page.evaluate(() => window.getLoadedDatasetId?.() ?? null);
  ok(id === null, `absent param: no dataset loaded (id ${JSON.stringify(id)})`);
  ok(alerts.length === 0, "absent param: no error surfaced");
  await page.close();
}

// 2 — served dataset URL boots standalone play on the dataset.
{
  const { page, alerts } = await boot(`${gameOrigin}/index.html?dataset=${encodeURIComponent(dsUrl)}`);
  await page.waitForFunction((id) => window.getLoadedDatasetId?.() === id, dataset.dataset_id);
  ok(true, `dataset param: ${dataset.dataset_id} reports loaded`);
  await page.waitForFunction((t) => document.body.innerText.includes(t), themedTask);
  const vanillaVisible = await page.evaluate((t) => document.body.innerText.includes(t), vanillaTask);
  ok(!vanillaVisible, `dataset param: themed zone-0 task "${themedTask}" rendered, vanilla "${vanillaTask}" absent`);
  ok(alerts.length === 0, "dataset param: no error surfaced");
  const slotKey = await page.evaluate(() => Object.keys(localStorage).find((k) => k.includes("_substrate__")) ?? null);
  ok(slotKey === null || slotKey.endsWith(dataset.dataset_id),
    `dataset param: any save slot is dataset-keyed (${JSON.stringify(slotKey)})`);
  await page.close();
}

// 3 — broken URL: failure surfaces, vanilla game untouched.
{
  const { page, alerts } = await boot(`${gameOrigin}/index.html?dataset=${encodeURIComponent(dsUrl.replace("ds.json", "missing.json"))}`);
  await page.waitForFunction((t) => document.body.innerText.includes(t), vanillaTask);
  // the fetch-failure alert may lag the vanilla render; poll for it
  for (let i = 0; i < 40 && alerts.length === 0; i++) await new Promise((r) => setTimeout(r, 250));
  ok(alerts.length === 1 && alerts[0].includes("Failed to load dataset"),
    `broken url: failure surfaced (${JSON.stringify(alerts[0] ?? null)})`);
  const id = await page.evaluate(() => window.getLoadedDatasetId?.() ?? null);
  ok(id === null, "broken url: vanilla tables still live");
  await page.close();
}

await browser.close();
gameServer.close();
dsServer.close();
fs.rmSync(dsDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll ?dataset= boot assertions passed.");
