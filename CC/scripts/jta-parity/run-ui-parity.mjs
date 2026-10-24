// JtA UI parity check: fork vs upstream fork-point, FRESH page load.
//
// Serves both sides through the already-running repo dev server on :8000
// (plain python http.server over the repo root — the script refuses to start
// a duplicate and errors if none is listening):
//   fork:     CC/scripts/jta-parity/fork-head/index.html   (full committed
//             tree of the submodule's HEAD via `git archive` — NEVER the live
//             submodule path, whose working tree has uncommitted changes)
//   upstream: CC/scripts/jta-parity/upstream/index.html    (fork-point clone,
//             build/ compiled by fetch-upstream.mjs)
//
// For each view (main page, settings open, stats open, prestige popup open):
//   a. DOM structural diff — both DOM trees serialized identically
//      (tag + sorted attributes + collapsed text, scripts/comments dropped),
//      diffed raw FIRST for classification, then with the EXPLICIT exclusion
//      list below. Every difference must end up classified: excluded-
//      intentional (documented reason), known-pending (documented, expected
//      to disappear after an in-flight fix), or UNEXPECTED (fails the run).
//   b. Screenshot pixel diff — masks over the excluded regions only; both
//      screenshots + a diff image land in results/ui/ with pixel counts.
//
// A self-stability probe (same page serialized twice, 700ms apart, game loop
// running) runs first so tick-volatile DOM would be discovered rather than
// misread as a fork difference. Fresh-load state has no active task, so no
// gameplay numbers move.
//
// DATASET MODE (--dataset [path], Phase 5c layer 3): both sides serve the
// SAME fork extraction; the "fork" side loads the vanilla dataset through
// window.loadGameData after boot (harness-injected — no fork boot param
// needed), the "upstream" side stays on native tables. Expected: zero DOM
// diff with ZERO exclusions (both sides are the same build, so the
// #settings delta vanishes from the comparison entirely).
//
// Usage: node CC/scripts/jta-parity/run-ui-parity.mjs [--dataset [path]]
//   (re-run after the submodule pointer advances: the archive step re-extracts
//    the submodule's HEAD every run, so a post-gating-fix re-check is just a
//    re-run)
import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(
  repoRoot,
  "frontend/modules/journey-to-ascension"
);
const forkExtractDir = path.join(here, "fork-head");

const argv = process.argv.slice(2);
const dsIdx = argv.indexOf("--dataset");
const DATASET_MODE = dsIdx >= 0;
const datasetPath = DATASET_MODE
  ? argv[dsIdx + 1] && !argv[dsIdx + 1].startsWith("--")
    ? path.resolve(argv[dsIdx + 1])
    : path.join(
        repoRoot,
        "frontend/modules/jtaSubstrateWrapper/datasets/vanilla.json"
      )
  : null;
const datasetDoc = DATASET_MODE
  ? JSON.parse(fs.readFileSync(datasetPath, "utf8"))
  : null;

// Raw datasets (5g) get their own results dir; the DOM comparison itself is
// unchanged — every rendered number is an EFFECTIVE value, which raw mode
// must reproduce exactly, so zero-diff is still the expectation.
const RAW_DATASET = datasetDoc?.economy?.value_mode === "raw";
const outDir = path.join(
  here, "results",
  DATASET_MODE ? (RAW_DATASET ? "ui-dataset-raw" : "ui-dataset") : "ui"
);

const BASE = "http://localhost:8000/CC/scripts/jta-parity";
const FORK_URL = `${BASE}/fork-head/index.html`;
// Dataset mode compares fork+dataset ("fork" side) vs fork native
// ("upstream" side) — same URL, different post-boot treatment.
const UPSTREAM_URL = DATASET_MODE
  ? FORK_URL
  : `${BASE}/upstream/index.html`;

// ---------------------------------------------------------------------------
// MARK: The exclusion list (every entry documented — do not widen casually)
// ---------------------------------------------------------------------------
// Applied to BOTH sides in the "clean" diff and as screenshot masks. A raw
// (no-exclusion) diff is always computed too, so exclusions hide nothing from
// the report — they only keep approved deltas out of the pass/fail signal.
const EXCLUSIONS = DATASET_MODE
  ? [] // same build on both sides — nothing is approved to differ
  : [
      {
        selector: "#settings",
        reason:
          "Settings popup box: user-approved fork additions — the 'Game Mods' " +
          "section (7 mod controls) plus a .scroll-area wrapper around the " +
          "popup's existing content. Static fork delta in index.html.",
      },
    ];
// Known-pending: NOT approved-permanent, NOT unexpected. Reported separately
// and expected to disappear on a future committed HEAD.
const KNOWN_PENDING = DATASET_MODE
  ? []
  : [
      {
        selector: "#prestige-box",
        reason:
          "Fork's populatePrestigeView builds its Divinity additions (purchase " +
          "queue / auto-buy controls) UNGATED on the current committed HEAD; the " +
          "gating fix is in flight (uncommitted, other agent). Re-run this " +
          "script after the submodule pointer advances and this entry should " +
          "become removable.",
      },
    ];

const VIEWS = [
  {
    name: "main",
    prepare: null,
    fullPage: true,
  },
  {
    name: "settings-open",
    prepare: async (page) => {
      await page.click("#open-settings");
      await page.waitForSelector("#settings-overlay:not(.hidden)", {
        timeout: 5000,
      });
    },
    fullPage: false, // fixed-position overlay; fullPage would tile it
  },
  {
    name: "stats-open",
    prepare: async (page) => {
      await page.click("#open-stats");
      await page.waitForSelector("#stats-overlay:not(.hidden)", {
        timeout: 5000,
      });
    },
    fullPage: false,
  },
  {
    name: "prestige-open",
    // #open-prestige is hidden on a fresh game (no prestige available); the
    // click listener itself is not gated in either build, so a programmatic
    // click opens and populates the popup. Marked synthetic-open in the
    // report. If a build ever refuses to open it, that is recorded, not
    // silently skipped.
    prepare: async (page) => {
      await page.evaluate(() =>
        document.getElementById("open-prestige")?.click()
      );
      await page.waitForTimeout(200);
    },
    fullPage: false,
    syntheticOpen: true,
    knownPending: KNOWN_PENDING,
  },
];

// ---------------------------------------------------------------------------
// MARK: Helpers
// ---------------------------------------------------------------------------
function log(msg) {
  console.log(`[ui-parity] ${msg}`);
}

function assertDevServer() {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: "localhost", port: 8000 }, () => {
      sock.destroy();
      resolve();
    });
    sock.on("error", () =>
      reject(
        new Error(
          "no dev server on :8000 — start one from the repo root " +
            "(python -m http.server 8000) and re-run; this script will not " +
            "start its own to avoid stranding a duplicate"
        )
      )
    );
  });
}

// Full committed tree of the submodule's HEAD (superset of run-parity.mjs's
// build/-only extraction; same .sha marker, so the two scripts share the dir).
function extractForkTree() {
  const sha = execSync("git rev-parse HEAD", {
    cwd: submoduleDir,
    encoding: "utf8",
  }).trim();
  const marker = path.join(forkExtractDir, ".sha");
  if (
    !fs.existsSync(path.join(forkExtractDir, "index.html")) ||
    !fs.existsSync(marker) ||
    fs.readFileSync(marker, "utf8").trim() !== sha
  ) {
    fs.rmSync(forkExtractDir, { recursive: true, force: true });
    fs.mkdirSync(forkExtractDir, { recursive: true });
    execSync(
      `git archive ${sha} | tar -x -C ${JSON.stringify(forkExtractDir)}`,
      { cwd: submoduleDir, shell: "/bin/bash" }
    );
    fs.writeFileSync(marker, sha + "\n");
    log(`extracted fork HEAD ${sha.slice(0, 7)} (full tree)`);
  } else {
    log(`fork HEAD ${sha.slice(0, 7)} already extracted`);
  }
  return sha;
}

// Runs inside the page: deterministic structural serialization.
function serializeDom(exclusionSelectors) {
  const lines = [];
  const walk = (node, depth) => {
    const pad = "  ".repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (t) lines.push(`${pad}"${t}"`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return; // comments etc.
    if (node.tagName === "SCRIPT") return;
    for (const sel of exclusionSelectors) {
      if (node.matches(sel)) {
        lines.push(`${pad}[EXCLUDED SUBTREE ${sel}]`);
        return;
      }
    }
    const attrs = [...node.attributes]
      .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
      .sort()
      .join(" ");
    lines.push(`${pad}<${node.tagName.toLowerCase()}${attrs ? " " + attrs : ""}>`);
    for (const c of node.childNodes) walk(c, depth + 1);
  };
  walk(document.body, 0);
  return lines.join("\n");
}

function unifiedDiff(fileA, fileB) {
  try {
    execSync(`diff -u ${JSON.stringify(fileA)} ${JSON.stringify(fileB)}`, {
      encoding: "utf8",
    });
    return ""; // identical
  } catch (e) {
    return e.stdout ?? "(diff failed)";
  }
}

const diffLineCount = (d) =>
  d
    .split("\n")
    .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
    .length;

// In-browser exact pixel diff (no image deps in the repo): draws both PNGs on
// canvases, compares RGBA bytes. Differing pixels are split into INSIDE the
// excluded-region union rects (mask-footprint differences: the approved delta
// changes the element's size, so the two pink masks cover different areas —
// painted orange in the diff image) and OUTSIDE them (painted red; these are
// the pixels that must be zero-or-noise for parity). Returns counts, max
// channel deltas, bounding box of OUTSIDE diffs, and the diff image.
async function pixelDiff(scratchPage, pngA, pngB, unionRects = []) {
  const toUrl = (b) => `data:image/png;base64,${b.toString("base64")}`;
  return scratchPage.evaluate(
    async ([a, b, rects]) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => rej(new Error("image load failed"));
          img.src = src;
        });
      const ia = await load(a);
      const ib = await load(b);
      if (ia.width !== ib.width || ia.height !== ib.height) {
        return {
          sizeMismatch: true,
          forkSize: [ia.width, ia.height],
          upstreamSize: [ib.width, ib.height],
        };
      }
      const mk = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height);
      };
      const da = mk(ia);
      const db = mk(ib);
      const out = document.createElement("canvas");
      out.width = ia.width;
      out.height = ia.height;
      const og = out.getContext("2d");
      const od = og.createImageData(ia.width, ia.height);
      const inRects = (x, y) =>
        rects.some((r) => x >= r.x - 4 && x <= r.x2 + 4 && y >= r.y - 4 && y <= r.y2 + 4);
      let inside = 0;
      let outside = 0;
      let maxDeltaInside = 0;
      let maxDeltaOutside = 0;
      let xMin = Infinity,
        xMax = -1,
        yMin = Infinity,
        yMax = -1;
      for (let i = 0; i < da.data.length; i += 4) {
        const same =
          da.data[i] === db.data[i] &&
          da.data[i + 1] === db.data[i + 1] &&
          da.data[i + 2] === db.data[i + 2] &&
          da.data[i + 3] === db.data[i + 3];
        if (same) {
          // faded grayscale base so the diff image stays readable
          const g = Math.round(
            (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3
          );
          od.data[i] = od.data[i + 1] = od.data[i + 2] = 128 + (g >> 1);
          od.data[i + 3] = 255;
        } else {
          let d = 0;
          for (let c = 0; c < 4; c++) {
            d = Math.max(d, Math.abs(da.data[i + c] - db.data[i + c]));
          }
          const p = i / 4;
          const x = p % ia.width;
          const y = (p / ia.width) | 0;
          if (inRects(x, y)) {
            inside++;
            if (d > maxDeltaInside) maxDeltaInside = d;
            od.data[i] = 255;
            od.data[i + 1] = 160;
            od.data[i + 2] = 0; // orange: excluded-region footprint
          } else {
            outside++;
            if (d > maxDeltaOutside) maxDeltaOutside = d;
            if (x < xMin) xMin = x;
            if (x > xMax) xMax = x;
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
            od.data[i] = 255;
            od.data[i + 1] = 0;
            od.data[i + 2] = 0; // red: must be zero-or-noise
          }
          od.data[i + 3] = 255;
        }
      }
      og.putImageData(od, 0, 0);
      const diff = inside + outside;
      return {
        sizeMismatch: false,
        width: ia.width,
        height: ia.height,
        totalPixels: ia.width * ia.height,
        diffPixels: diff,
        insideExcludedPixels: inside,
        outsidePixels: outside,
        maxChannelDeltaInside: maxDeltaInside,
        maxChannelDeltaOutside: maxDeltaOutside,
        outsideBBox: outside > 0 ? { xMin, xMax, yMin, yMax } : null,
        diffDataUrl: diff > 0 ? out.toDataURL("image/png") : null,
      };
    },
    [toUrl(pngA), toUrl(pngB), unionRects]
  );
}

async function bootPage(browser, url, withDataset = false) {
  // Fresh context per page per view: clean localStorage/cache, fixed
  // deterministic viewport.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  // "Hidden until game's ready to render" — game-area unhides when the
  // DOMContentLoaded bootstrap finished; tasks render immediately after.
  await page.waitForSelector("#game-area:not(.hidden)", { timeout: 10000 });
  await page.waitForFunction(
    () => document.querySelectorAll("#tasks *").length > 0,
    { timeout: 10000 }
  );
  if (withDataset) {
    // Dataset side: swap tables via the fork's own hook (re-inits the game
    // and rebuilds the Rendering), then prove it actually loaded — a save
    // must land under the dataset-keyed slot, else this whole comparison
    // would be fork-vs-fork vacuous.
    const probe = await page.evaluate((ds) => {
      const r = window.loadGameData(ds);
      if (!r.ok) return { ok: false, errors: r.errors ?? [] };
      window.saveGame();
      const key = `incrementalGameSave_substrate__${ds.dataset_id}`;
      return { ok: true, saved: localStorage.getItem(key) !== null };
    }, datasetDoc);
    if (!probe.ok) {
      throw new Error(
        `loadGameData rejected the dataset: ${probe.errors.join("; ")}`
      );
    }
    if (!probe.saved) {
      throw new Error(
        "dataset vacuity guard tripped: no save under the dataset-keyed slot"
      );
    }
    await page.waitForFunction(
      () => document.querySelectorAll("#tasks *").length > 0,
      { timeout: 10000 }
    );
  }
  await page.evaluate(() => document.fonts.ready);
  // Freeze cosmetic motion for pixel-stable screenshots (applied to BOTH
  // sides identically; DOM serialization is unaffected by CSS).
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
  });
  await page.waitForTimeout(300);
  return { ctx, page };
}

// ---------------------------------------------------------------------------
// MARK: Main
// ---------------------------------------------------------------------------
await assertDevServer();
const forkSha = extractForkTree();
fs.mkdirSync(outDir, { recursive: true });

// Serving sanity: both entry points and their compiled builds must come back
// over HTTP before any browser work.
for (const u of [
  FORK_URL,
  UPSTREAM_URL,
  `${BASE}/fork-head/build/game.js`,
  `${BASE}/upstream/build/game.js`,
]) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
}
log("both sides served OK on :8000");

// Screenshot-determinism flags: without them the compositor jitters a few
// dozen pixels (channel deltas <= ~20) run to run — the SAME page twice is
// not byte-identical. Software rendering + no LCD text removes most of it;
// the retake-to-reproduce rule below absorbs the rest.
const browser = await chromium.launch({
  args: [
    "--disable-gpu",
    "--force-color-profile=srgb",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--hide-scrollbars",
  ],
});
const report = {
  generatedAt: new Date().toISOString(),
  mode: DATASET_MODE ? "dataset" : "upstream",
  dataset: DATASET_MODE
    ? { path: datasetPath, dataset_id: datasetDoc.dataset_id }
    : null,
  forkCommit: forkSha,
  forkUrl: FORK_URL,
  upstreamUrl: UPSTREAM_URL,
  exclusions: EXCLUSIONS,
  knownPending: KNOWN_PENDING,
  selfStability: null,
  views: [],
};

// --- Self-stability probe (fork page, no exclusions, loop left running;
//     in dataset mode the probe runs on the dataset-loaded side — the new
//     surface whose volatility matters) ----
{
  const { ctx, page } = await bootPage(browser, FORK_URL, DATASET_MODE);
  const s1 = await page.evaluate(serializeDom, []);
  await page.waitForTimeout(700);
  const s2 = await page.evaluate(serializeDom, []);
  report.selfStability = {
    stable: s1 === s2,
    note: "same page serialized twice 700ms apart with the game loop running",
  };
  if (s1 !== s2) {
    const a = path.join(outDir, "selfstability-t0.txt");
    const b = path.join(outDir, "selfstability-t700.txt");
    fs.writeFileSync(a, s1);
    fs.writeFileSync(b, s2);
    report.selfStability.diff = unifiedDiff(a, b).slice(0, 4000);
    log("WARNING: fresh-load DOM is tick-volatile — see selfstability-*.txt");
  } else {
    log("self-stability probe: fresh-load DOM is static (as expected)");
  }
  await ctx.close();
}

let unexpected = 0;
let scratchCtx = await browser.newContext();
const scratchPage = await scratchCtx.newPage();

for (const view of VIEWS) {
  log(`--- view: ${view.name} ---`);
  const sides = {};
  for (const [label, url] of [
    ["fork", FORK_URL],
    ["upstream", UPSTREAM_URL],
  ]) {
    const { ctx, page } = await bootPage(
      browser,
      url,
      DATASET_MODE && label === "fork"
    );
    let prepareError = null;
    if (view.prepare) {
      try {
        await view.prepare(page);
      } catch (e) {
        prepareError = String(e).split("\n")[0];
      }
    }
    sides[label] = { ctx, page, prepareError };
  }

  const excl = EXCLUSIONS.map((e) => e.selector);
  const pendingSel = (view.knownPending ?? []).map((e) => e.selector);

  // For prestige-open: record whether each side actually opened the overlay.
  const overlayState = {};
  if (view.name === "prestige-open") {
    for (const label of ["fork", "upstream"]) {
      overlayState[label] = await sides[label].page.evaluate(() => {
        const el = document.getElementById("prestige-overlay");
        return el ? !el.classList.contains("hidden") : null;
      });
    }
  }

  // a) DOM diffs: raw (classification), clean (exclusions), residual
  //    (exclusions + known-pending; prestige view only).
  const ser = {};
  for (const label of ["fork", "upstream"]) {
    ser[label] = {
      raw: await sides[label].page.evaluate(serializeDom, []),
      clean: await sides[label].page.evaluate(serializeDom, excl),
      residual: await sides[label].page.evaluate(serializeDom, [
        ...excl,
        ...pendingSel,
      ]),
    };
  }
  const files = {};
  for (const kind of ["raw", "clean", "residual"]) {
    for (const label of ["fork", "upstream"]) {
      const f = path.join(outDir, `dom-${view.name}-${kind}-${label}.txt`);
      fs.writeFileSync(f, ser[label][kind]);
      files[`${kind}-${label}`] = f;
    }
  }
  const rawDiff = unifiedDiff(files["raw-upstream"], files["raw-fork"]);
  const cleanDiff = unifiedDiff(files["clean-upstream"], files["clean-fork"]);
  const residualDiff = unifiedDiff(
    files["residual-upstream"],
    files["residual-fork"]
  );
  fs.writeFileSync(path.join(outDir, `diff-${view.name}-raw.txt`), rawDiff);
  fs.writeFileSync(path.join(outDir, `diff-${view.name}-clean.txt`), cleanDiff);
  if (pendingSel.length) {
    fs.writeFileSync(
      path.join(outDir, `diff-${view.name}-residual.txt`),
      residualDiff
    );
  }

  let classification;
  if (cleanDiff === "") {
    classification =
      rawDiff === ""
        ? "identical (even before exclusions)"
        : "excluded-intentional only";
  } else if (pendingSel.length && residualDiff === "") {
    classification = "known-pending only (see knownPending)";
  } else {
    classification = "UNEXPECTED DIFFERENCES";
    unexpected++;
    console.error(
      `\n[ui-parity] UNEXPECTED DOM differences in view '${view.name}' ` +
        `(first 40 diff lines):\n` +
        (pendingSel.length ? residualDiff : cleanDiff)
          .split("\n")
          .slice(0, 40)
          .join("\n")
    );
  }

  // b) screenshots + pixel diff (masks = exclusions + known-pending regions)
  const maskSel = [...excl, ...pendingSel];
  const takeShot = (p) =>
    p.screenshot({
      fullPage: view.fullPage,
      mask: maskSel.map((s) => p.locator(s)),
      animations: "disabled",
    });
  const shots = {};
  for (const label of ["fork", "upstream"]) {
    shots[label] = await takeShot(sides[label].page);
    fs.writeFileSync(
      path.join(outDir, `shot-${view.name}-${label}.png`),
      shots[label]
    );
  }

  // Rects of excluded/known-pending elements on BOTH pages, unioned per
  // selector: the approved delta changes the element's size, so its centered
  // box (and its pink mask) sits at different coordinates on each page —
  // pixel differences inside the union footprint are a visual consequence of
  // the approved delta, not new findings.
  const excludedRects = [];
  for (const label of ["fork", "upstream"]) {
    for (const s of maskSel) {
      const box = await sides[label].page.locator(s).boundingBox().catch(() => null);
      if (box) excludedRects.push({ side: label, selector: s, ...box });
    }
  }
  const unionRects = [...new Set(excludedRects.map((r) => r.selector))].map(
    (sel) => {
      const rs = excludedRects.filter((r) => r.selector === sel);
      return {
        selector: sel,
        x: Math.min(...rs.map((r) => r.x)),
        y: Math.min(...rs.map((r) => r.y)),
        x2: Math.max(...rs.map((r) => r.x + r.width)),
        y2: Math.max(...rs.map((r) => r.y + r.height)),
      };
    }
  );

  const px = await pixelDiff(scratchPage, shots.fork, shots.upstream, unionRects);
  let diffImagePath = null;
  if (px.diffDataUrl) {
    diffImagePath = path.join(outDir, `shot-${view.name}-diff.png`);
    fs.writeFileSync(
      diffImagePath,
      Buffer.from(px.diffDataUrl.split(",")[1], "base64")
    );
    delete px.diffDataUrl;
  }

  // Renderer noise floor: the SAME upstream page screenshotted twice is not
  // byte-identical when a translucent overlay is up (GPU compositing jitter
  // of a few shades at element edges — measured, not assumed; observed 0-40
  // px with channel deltas <= 8). Outside-region cross diffs are judged
  // against this floor.
  let noiseFloor = null;
  {
    const again = await takeShot(sides.upstream.page);
    const n = await pixelDiff(scratchPage, shots.upstream, again, unionRects);
    delete n.diffDataUrl;
    noiseFloor = {
      diffPixels: n.diffPixels,
      maxChannelDelta: Math.max(n.maxChannelDeltaInside, n.maxChannelDeltaOutside),
    };
  }

  // Retake-to-reproduce: compositing jitter is transient (a fresh pair of
  // screenshots lands on different pixels or none), a real UI difference
  // reproduces identically. Only a difference that survives every retake
  // with meaningful deltas is UNEXPECTED.
  let retakes = 0;
  if (!px.sizeMismatch && px.outsidePixels > 0) {
    for (; retakes < 3 && px.outsidePixels > 0; retakes++) {
      const f2 = await takeShot(sides.fork.page);
      const u2 = await takeShot(sides.upstream.page);
      const p2 = await pixelDiff(scratchPage, f2, u2, unionRects);
      delete p2.diffDataUrl;
      if (p2.outsidePixels === 0) {
        px.outsidePixels = 0;
        px.transientNoise = true;
        break;
      }
    }
  }

  let pixelClassification;
  if (px.sizeMismatch) {
    pixelClassification = "UNEXPECTED (page size mismatch)";
    unexpected++;
  } else if (px.diffPixels === 0) {
    pixelClassification = "exact";
  } else if (px.outsidePixels === 0) {
    pixelClassification = px.transientNoise
      ? px.insideExcludedPixels > 0
        ? "excluded-region footprint + transient compositing noise (vanished on retake)"
        : "transient compositing noise (vanished on retake)"
      : "confined to excluded regions (mask/size footprint of approved delta)";
  } else if (
    px.maxChannelDeltaOutside <= Math.max(20, noiseFloor.maxChannelDelta) &&
    px.outsidePixels <= Math.max(500, 10 * noiseFloor.diffPixels)
  ) {
    pixelClassification =
      px.insideExcludedPixels > 0
        ? "excluded-region footprint + renderer noise outside (see noiseFloor)"
        : "renderer compositing noise (see noiseFloor)";
  } else {
    pixelClassification = "UNEXPECTED";
    unexpected++;
    console.error(
      `\n[ui-parity] UNEXPECTED pixel differences in view '${view.name}' ` +
        `(reproduced across ${retakes} retakes): ` +
        `${px.outsidePixels} px outside excluded regions, ` +
        `maxChannelDelta ${px.maxChannelDeltaOutside}, ` +
        `bbox ${JSON.stringify(px.outsideBBox)} (noise floor ${noiseFloor.diffPixels} px)`
    );
  }

  report.views.push({
    name: view.name,
    syntheticOpen: view.syntheticOpen ?? false,
    prepareErrors: {
      fork: sides.fork.prepareError,
      upstream: sides.upstream.prepareError,
    },
    overlayOpened: view.name === "prestige-open" ? overlayState : undefined,
    dom: {
      rawDiffLines: diffLineCount(rawDiff),
      cleanDiffLines: diffLineCount(cleanDiff),
      residualDiffLines: pendingSel.length ? diffLineCount(residualDiff) : null,
      classification,
    },
    screenshot: px,
    pixelClassification,
    noiseFloor,
    excludedRects,
    diffImage: diffImagePath,
  });
  log(
    `${view.name}: DOM ${classification}; raw=${diffLineCount(rawDiff)} ` +
      `clean=${diffLineCount(cleanDiff)} diff lines; pixels ` +
      (px.sizeMismatch
        ? `SIZE MISMATCH fork=${px.forkSize} upstream=${px.upstreamSize}`
        : `${px.diffPixels} differ (${px.insideExcludedPixels} in excluded ` +
          `footprint, ${px.outsidePixels} outside) — ${pixelClassification}; ` +
          `noise floor ${noiseFloor.diffPixels}`)
  );

  await sides.fork.ctx.close();
  await sides.upstream.ctx.close();
}

await scratchCtx.close();
await browser.close();

report.verdict =
  unexpected === 0
    ? "PASS (UI identical modulo documented exclusions / known-pending)"
    : `FAIL (${unexpected} view(s) with UNEXPECTED differences)`;
fs.writeFileSync(
  path.join(outDir, "ui-parity-report.json"),
  JSON.stringify(report, null, 2)
);
console.log(`\n[ui-parity] ${report.verdict}`);
console.log(`[ui-parity] report: ${path.join(outDir, "ui-parity-report.json")}`);
process.exit(unexpected === 0 ? 0 : 1);
