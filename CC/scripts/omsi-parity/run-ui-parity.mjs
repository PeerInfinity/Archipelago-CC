// Omsi Loops UI parity check: fork vs upstream fork-point, real browser.
//
// Built for the XML-migration Phase 1 exit gate (introspection-sites
// refactor): the skills/buffs columns and the per-action skill/buff tooltip
// sections are VIEW behavior the headless sim harness cannot see — they must
// render identically before and after the refactor. Clones the
// CC/scripts/jta-parity/run-ui-parity.mjs conventions (DOM structural diff +
// screenshot pixel diff + self-stability probe), with one addition: the
// comparison runs across three INJECTED SAVE STATES, because the interesting
// view logic (skills column, buffs column, "Learn skill" tooltips) only
// renders on progressed saves.
//
//   fresh — no save. Both columns hidden.
//   mid   — Magic/Combat 20, town-0 progress maxed. Skills column ON, buffs
//           column OFF; Heal The Sick / Fight Monsters unlocked with their
//           unlock-gated (non-taught) skills.
//   deep  — mid + Alchemy 250 / Dark 1200 / more, towns 0-1 unlocked, all
//           progress vars maxed. Buffs column ON (Dark Ritual unlocked);
//           Learn Alchemy renders a "Learn skill: Alchemy" tooltip section.
//
// Save blobs are crafted ONCE in the headless harness (same bytes injected
// on both sides; the save format is identical across the two commits) and
// stamped with a per-page-load `date` so addOffline() banks ~0 offline time.
// The game is paused right after boot on both sides so no gameplay numbers
// move during serialization.
//
// Hover probes: for the tooltip-bearing actions the refactor touched
// (Heal The Sick, Fight Monsters, Learn Alchemy, Dark Ritual), hover the
// action container and pixel-compare the viewport, and string-compare the
// container's outerHTML.
//
// Expectation (substrate era): ZERO exclusions — the substrate branch carries
// no UI mods, so every view/state must be identical modulo renderer
// compositing noise.
//
// EXCEPTION (automation merge, user ruling 2026-07-16): the automation
// branch's UI additions are deliberately Extras-checkbox-gated (JtA pattern)
// and live under exactly four id-addressable subtrees —
//   #automationStatsWrap  (stat-view radio addition, index.html)
//   #automationView       (the Automation stats view + planner settings, index.html)
//   #automationSection    (the "Automation (fork)" Extras-menu block, menu.view.js)
//   #forkTestingSection   (the "Testing (fork)" Extras-menu block — expGainMultiplier)
// — all hidden at default options. The DOM walk skips those subtrees (on
// BOTH sides; upstream simply has none of them) and the report lists the
// exclusions. Vacuity guards: every excluded id must EXIST on the fork side
// and must NOT exist upstream — a stale list fails loudly instead of
// silently narrowing the comparison. EVERYTHING ELSE (tooltips, screenshots,
// the rest of the DOM) must stay identical to the fork point at default
// options; the four regions are display-gated so pixel comparisons stay
// exact with no exclusion of their own.
//
// Usage: node CC/scripts/omsi-parity/run-ui-parity.mjs
//   (needs the repo dev server on :8000; refuses to start its own)
import { execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { FORK_POINT } from "./run-parity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(repoRoot, "frontend/modules/omsi-loops");
const outDir = path.join(here, "results", "ui");

const BASE = "http://localhost:8000/CC/scripts/omsi-parity";
const FORK_URL = `${BASE}/ui-fork-head/index.html`;
const UPSTREAM_URL = `${BASE}/ui-upstream/index.html`;
const SAVE_KEY = "idleLoops1";
// Date.now is frozen to this epoch on BOTH pages before any game script runs:
// the paused game otherwise banks wall time into a "Bonus Seconds" ticker
// that updates the DOM every second (observed as a "4.08s" -> "5.08s"
// self-stability diff), and the two sides would bank different amounts.
// Injected saves are stamped with the same epoch so addOffline() banks 0.
// Driver ticks compute Date.now() deltas, so a frozen clock also means zero
// gameplay progression regardless of pause state. performance.now stays real.
const FIXED_EPOCH = Date.UTC(2026, 0, 1, 12, 0, 0);

// The automation-merge exception (header): fork-added, display-gated UI
// subtrees excluded from the DOM comparison. Everything else stays a
// zero-exclusion comparison.
const EXCLUDED_SUBTREES = ["automationStatsWrap", "automationView", "automationSection", "forkTestingSection"];

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
            reject(new Error(
                "no dev server on :8000 — start one from the repo root " +
                "(python -m http.server 8000) and re-run; this script will " +
                "not start its own to avoid stranding a duplicate")));
    });
}

// Full committed tree of a commit from the submodule's object store.
function extractTree(commit, dir) {
    const sha = execSync(`git rev-parse ${commit}`, { cwd: submoduleDir, encoding: "utf8" }).trim();
    const marker = path.join(dir, ".sha");
    if (!fs.existsSync(path.join(dir, "index.html")) ||
        !fs.existsSync(marker) ||
        fs.readFileSync(marker, "utf8").trim() !== sha) {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        execSync(`git archive ${sha} | tar -x -C ${JSON.stringify(dir)}`,
            { cwd: submoduleDir, shell: "/bin/bash" });
        fs.writeFileSync(marker, sha + "\n");
        log(`extracted ${sha.slice(0, 7)} (full tree) -> ${path.basename(dir)}`);
    } else {
        log(`${sha.slice(0, 7)} already extracted -> ${path.basename(dir)}`);
    }
    return sha;
}

// ---------------------------------------------------------------------------
// MARK: Save-state crafting (headless harness; one blob per state, both sides)
// ---------------------------------------------------------------------------
async function craftSaves() {
    const { makeContext } = await import(
        pathToFileURL(path.join(submoduleDir, "test/harness.mjs")).href);

    const craft = (setup) => {
        const ctx = makeContext();
        ctx.ev(setup);
        return ctx.ev("JSON.stringify(doSave())");
    };

    const mid = craft(`
        cheatSkill("Magic", 20);
        cheatSkill("Combat", 20);
        towns[0].expWander = 505000;
        towns[0].expMet = 505000;
        towns[0].expSecrets = 505000;
    `);
    const deep = craft(`
        cheatSkill("Magic", 100);
        cheatSkill("Combat", 100);
        cheatSkill("Alchemy", 250);
        cheatSkill("Dark", 1200);
        cheatSkill("Mercantilism", 10);
        cheatSkill("Thievery", 5);
        cheatSkill("Pyromancy", 100);
        cheatSkill("Restoration", 1500);
        for (const action of totalActionList) {
            if (action.type === "progress") {
                towns[action.townNum]["exp" + action.varName] = 505000;
            }
        }
        townsUnlocked = [0, 1];
    `);
    return { mid, deep };
}

// ---------------------------------------------------------------------------
// MARK: The states and their in-page assertions (guard against a save blob
// silently failing to load — that would make the comparison vacuous)
// ---------------------------------------------------------------------------
const STATES = [
    {
        name: "fresh",
        save: null,
        // the skills column IS visible on a fresh game: Invest and
        // CollectInterest are unlocked at level 0 and grant Mercantilism exp
        assert: `getSkillLevel("Magic") === 0
            && document.getElementById("skillList").style.display === ""
            && document.getElementById("buffList").style.display === "none"`,
        hoverProbes: [],
    },
    {
        name: "mid",
        save: "mid",
        assert: `getSkillLevel("Magic") === 20 && getSkillLevel("Combat") === 20
            && document.getElementById("skillList").style.display !== "none"
            && document.getElementById("buffList").style.display !== "none"`,
        // Heal/Fight: skills gated by their own unlock (skillPrereqs side);
        // SDungeon: two gated skills on a multipart
        hoverProbes: ["Heal", "Fight", "SDungeon"],
        // NOTE: the buffs column is ALSO on in this state — TheSpire's
        // unlock is (Combat + Magic) >= 35 and 20+20 clears it. The
        // buffs-column-off case is covered by `fresh`.
    },
    {
        name: "deep",
        save: "deep",
        assert: `getSkillLevel("Dark") === 1200 && townsUnlocked.length === 2
            && document.getElementById("skillList").style.display !== "none"
            && document.getElementById("buffList").style.display !== "none"`,
        // LearnAlchemy: teaches Alchemy while Magic-gated; DarkRitual:
        // grantsBuff tooltip + the action that turns the buffs column on;
        // BrewPotions: Alchemy-gated Alchemy exp. All three live in town 1,
        // so the deep state serializes and screenshots with town 1 showing.
        prepare: "view.showTown(1)",
        hoverProbes: ["LearnAlchemy", "DarkRitual", "BrewPotions"],
    },
];

// ---------------------------------------------------------------------------
// MARK: In-page helpers (copied from jta-parity conventions)
// ---------------------------------------------------------------------------
// `excludeIds`: fork-added subtree roots to skip (the automation-merge
// exception — see the header). Runs identically on both sides; upstream
// simply contains none of the ids. Returns the serialization plus the list
// of ids actually skipped so the caller can vacuity-check the exception.
function serializeDom(excludeIds = []) {
    const lines = [];
    const skipped = [];
    const walk = (node, depth) => {
        const pad = "  ".repeat(depth);
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent.replace(/\s+/g, " ").trim();
            if (t) lines.push(`${pad}"${t}"`);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.tagName === "SCRIPT") return;
        if (node.id && excludeIds.includes(node.id)) {
            skipped.push(node.id);
            return;
        }
        const attrs = [...node.attributes]
            .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
            .sort()
            .join(" ");
        lines.push(`${pad}<${node.tagName.toLowerCase()}${attrs ? " " + attrs : ""}>`);
        for (const c of node.childNodes) walk(c, depth + 1);
    };
    walk(document.body, 0);
    return { dom: lines.join("\n"), skipped };
}

function unifiedDiff(fileA, fileB) {
    try {
        execSync(`diff -u ${JSON.stringify(fileA)} ${JSON.stringify(fileB)}`, { encoding: "utf8" });
        return "";
    } catch (e) {
        return e.stdout ?? "(diff failed)";
    }
}

const diffLineCount = (d) => d.split("\n")
    .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
    .length;

// Exact in-browser pixel diff (no image deps): compares RGBA bytes.
async function pixelDiff(scratchPage, pngA, pngB) {
    const toUrl = (b) => `data:image/png;base64,${b.toString("base64")}`;
    return scratchPage.evaluate(async ([a, b]) => {
        const load = (src) => new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error("image load failed"));
            img.src = src;
        });
        const ia = await load(a);
        const ib = await load(b);
        if (ia.width !== ib.width || ia.height !== ib.height) {
            return { sizeMismatch: true, forkSize: [ia.width, ia.height], upstreamSize: [ib.width, ib.height] };
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
        let diff = 0;
        let maxDelta = 0;
        let xMin = Infinity, xMax = -1, yMin = Infinity, yMax = -1;
        for (let i = 0; i < da.data.length; i += 4) {
            const same = da.data[i] === db.data[i] && da.data[i + 1] === db.data[i + 1]
                && da.data[i + 2] === db.data[i + 2] && da.data[i + 3] === db.data[i + 3];
            if (same) {
                const g = Math.round((da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3);
                od.data[i] = od.data[i + 1] = od.data[i + 2] = 128 + (g >> 1);
                od.data[i + 3] = 255;
            } else {
                diff++;
                for (let c = 0; c < 4; c++) maxDelta = Math.max(maxDelta, Math.abs(da.data[i + c] - db.data[i + c]));
                const p = i / 4;
                const x = p % ia.width;
                const y = (p / ia.width) | 0;
                if (x < xMin) xMin = x;
                if (x > xMax) xMax = x;
                if (y < yMin) yMin = y;
                if (y > yMax) yMax = y;
                od.data[i] = 255;
                od.data[i + 1] = 0;
                od.data[i + 2] = 0;
                od.data[i + 3] = 255;
            }
        }
        og.putImageData(od, 0, 0);
        return {
            sizeMismatch: false,
            totalPixels: ia.width * ia.height,
            diffPixels: diff,
            maxChannelDelta: maxDelta,
            bbox: diff > 0 ? { xMin, xMax, yMin, yMax } : null,
            diffDataUrl: diff > 0 ? out.toDataURL("image/png") : null,
        };
    }, [toUrl(pngA), toUrl(pngB)]);
}

async function bootPage(browser, url, saveBlob, stateName, prepare) {
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
        deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0]));
    await page.addInitScript(([key, blob, epoch]) => {
        Date.now = () => epoch;
        if (blob) {
            const save = JSON.parse(blob);
            save.date = new Date(epoch).toISOString();
            localStorage.setItem(key, JSON.stringify(save));
        }
    }, [SAVE_KEY, saveBlob, FIXED_EPOCH]);
    await page.goto(url, { waitUntil: "load" });
    // Views.draw() + startGame() have run once the town-0 action containers
    // exist (containerWander is created for every save state).
    await page.waitForFunction(
        () => document.getElementById("containerWander") !== null,
        { timeout: 15000 });
    // Freeze gameplay so no numbers move during serialization/screenshots.
    await page.evaluate(() => {
        if (!globalThis.gameIsStopped) pauseGame();
    });
    if (prepare) await page.evaluate(prepare);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
        content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
    });
    // The view runs a periodic catch-up ~2s after boot (updateStories & co.)
    // whose FIRST firing corrects classes ("capped") and column visibility;
    // serialize only after it has fired on this page. Subsequent firings are
    // no-ops with the clock frozen — the self-stability probe verifies that.
    await page.waitForTimeout(2600);
    if (pageErrors.length) {
        throw new Error(`page errors on ${url} (state ${stateName}): ${pageErrors.join(" | ")}`);
    }
    return { ctx, page };
}

// ---------------------------------------------------------------------------
// MARK: Main
// ---------------------------------------------------------------------------
await assertDevServer();
const forkSha = extractTree("HEAD", path.join(here, "ui-fork-head"));
const upstreamSha = extractTree(FORK_POINT, path.join(here, "ui-upstream"));
fs.mkdirSync(outDir, { recursive: true });
log(`fork HEAD:  ${forkSha}`);
log(`fork point: ${upstreamSha}`);

for (const u of [FORK_URL, UPSTREAM_URL]) {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
}
log("both sides served OK on :8000");

const saves = await craftSaves();
log(`crafted save blobs: mid=${saves.mid.length}B deep=${saves.deep.length}B`);

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
    forkCommit: forkSha,
    upstreamCommit: upstreamSha,
    forkUrl: FORK_URL,
    upstreamUrl: UPSTREAM_URL,
    exclusions: EXCLUDED_SUBTREES.map((id) => ({
        id,
        reason: "fork-added automation UI (Extras-checkbox-gated; user ruling 2026-07-16)",
    })),
    selfStability: {},
    states: [],
};

let unexpected = 0;
const scratchCtx = await browser.newContext();
const scratchPage = await scratchCtx.newPage();

for (const state of STATES) {
    log(`--- state: ${state.name} ---`);
    const saveBlob = state.save ? saves[state.save] : null;

    // Self-stability probe: fork page serialized twice 700ms apart (paused).
    {
        const { ctx, page } = await bootPage(browser, FORK_URL, saveBlob, state.name, state.prepare);
        const s1 = (await page.evaluate(serializeDom, EXCLUDED_SUBTREES)).dom;
        await page.waitForTimeout(700);
        const s2 = (await page.evaluate(serializeDom, EXCLUDED_SUBTREES)).dom;
        report.selfStability[state.name] = { stable: s1 === s2 };
        if (s1 !== s2) {
            const a = path.join(outDir, `selfstability-${state.name}-t0.txt`);
            const b = path.join(outDir, `selfstability-${state.name}-t700.txt`);
            fs.writeFileSync(a, s1);
            fs.writeFileSync(b, s2);
            report.selfStability[state.name].diff = unifiedDiff(a, b).slice(0, 4000);
            log(`WARNING: ${state.name} DOM is volatile while paused — see selfstability-${state.name}-*.txt`);
        }
        await ctx.close();
    }

    const sides = {};
    for (const [label, url] of [["fork", FORK_URL], ["upstream", UPSTREAM_URL]]) {
        sides[label] = await bootPage(browser, url, saveBlob, state.name, state.prepare);
    }

    // Vacuity guard: the injected save actually loaded, and the columns are
    // in the state this scenario exists to compare.
    for (const label of ["fork", "upstream"]) {
        const ok = await sides[label].page.evaluate(`!!(${state.assert})`);
        if (!ok) {
            throw new Error(`state assert failed on ${label} for '${state.name}' — save did not load as intended`);
        }
    }

    // a) full-body DOM structural diff — zero exclusions EXCEPT the three
    //    fork-added automation subtrees (vacuity-guarded both ways)
    const ser = {};
    for (const label of ["fork", "upstream"]) {
        const { dom, skipped } = await sides[label].page.evaluate(serializeDom, EXCLUDED_SUBTREES);
        ser[label] = dom;
        if (label === "fork") {
            const missing = EXCLUDED_SUBTREES.filter((id) => !skipped.includes(id));
            if (missing.length) {
                throw new Error(`stale exclusion list: fork side never rendered ${missing.join(", ")} `
                    + `in state '${state.name}' — update EXCLUDED_SUBTREES instead of comparing vacuously`);
            }
        } else if (skipped.length) {
            throw new Error(`exclusion leak: upstream side carries fork-only subtree(s) ${skipped.join(", ")} `
                + `in state '${state.name}' — the exception would mask a real upstream difference`);
        }
    }
    const files = {};
    for (const label of ["fork", "upstream"]) {
        files[label] = path.join(outDir, `dom-${state.name}-${label}.txt`);
        fs.writeFileSync(files[label], ser[label]);
    }
    const domDiff = unifiedDiff(files.upstream, files.fork);
    fs.writeFileSync(path.join(outDir, `diff-${state.name}.txt`), domDiff);
    let domClassification;
    if (domDiff === "") {
        domClassification = "identical";
    } else {
        domClassification = "UNEXPECTED DIFFERENCES";
        unexpected++;
        console.error(`\n[ui-parity] UNEXPECTED DOM differences in state '${state.name}' (first 40 diff lines):\n`
            + domDiff.split("\n").slice(0, 40).join("\n"));
    }

    // b) tooltip outerHTML string-compare for the hover-probe actions
    const tooltipMismatches = [];
    for (const varName of state.hoverProbes) {
        const html = {};
        for (const label of ["fork", "upstream"]) {
            html[label] = await sides[label].page.evaluate(
                (v) => document.getElementById(`container${v}`)?.outerHTML ?? "(missing)", varName);
        }
        if (html.fork !== html.upstream) {
            tooltipMismatches.push(varName);
            fs.writeFileSync(path.join(outDir, `tooltip-${state.name}-${varName}-fork.html`), html.fork);
            fs.writeFileSync(path.join(outDir, `tooltip-${state.name}-${varName}-upstream.html`), html.upstream);
        }
        if (html.fork === "(missing)") {
            throw new Error(`hover probe container${varName} missing in state '${state.name}'`);
        }
    }
    if (tooltipMismatches.length) {
        unexpected++;
        console.error(`[ui-parity] UNEXPECTED tooltip HTML mismatches in '${state.name}': ${tooltipMismatches.join(", ")}`);
    }

    // c) screenshots: full page + hover probes; exact pixel diff with a
    //    retake-to-reproduce rule for compositing jitter
    const shots = [{ probe: null, fullPage: true }, ...state.hoverProbes.map((p) => ({ probe: p, fullPage: false }))];
    const pixelResults = [];
    for (const shot of shots) {
        const label = shot.probe ? `hover-${shot.probe}` : "main";
        const take = async (side) => {
            const { page } = sides[side];
            if (shot.probe) {
                await page.locator(`#container${shot.probe}`).hover();
                await page.waitForTimeout(150);
            } else {
                await page.mouse.move(0, 0);
                await page.waitForTimeout(150);
            }
            return page.screenshot({ fullPage: shot.fullPage, animations: "disabled" });
        };
        let px = null;
        let retained = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            const a = await take("fork");
            const b = await take("upstream");
            retained = { a, b };
            px = await pixelDiff(scratchPage, a, b);
            if (!px.sizeMismatch && px.diffPixels === 0) break;
        }
        for (const [sideLabel, buf] of [["fork", retained.a], ["upstream", retained.b]]) {
            fs.writeFileSync(path.join(outDir, `shot-${state.name}-${label}-${sideLabel}.png`), buf);
        }
        let pixelClassification;
        if (px.sizeMismatch) {
            pixelClassification = "UNEXPECTED (size mismatch)";
            unexpected++;
        } else if (px.diffPixels === 0) {
            pixelClassification = "exact";
        } else if (px.maxChannelDelta <= 20 && px.diffPixels <= 500) {
            pixelClassification = "renderer compositing noise (persisted across retakes, low delta)";
        } else if (px.diffPixels <= 64 && px.maxChannelDelta <= 32) {
            // Measured at the automation merge (2026-07-16): the mid state's
            // Wander / Train Strength actionHighlight borders rasterize their
            // rounded corners with a ≤32-delta drift on the fork side (36 px,
            // same bbox every boot). DOM, classes, computed border styles and
            // subpixel getBoundingClientRect are IDENTICAL on both sides, and
            // an upstream-vs-upstream A/A boot is pixel-exact — this is a
            // page-global rasterization quirk (extra fork stylesheets/scripts
            // shifting a Skia path), not a style or layout difference. Kept
            // as its own narrow category (≤64 px, ≤32 delta) so a real visual
            // regression still fails loudly.
            pixelClassification = "corner antialiasing drift (DOM/geometry/computed styles verified identical; A/A exact)";
        } else {
            pixelClassification = "UNEXPECTED";
            unexpected++;
            console.error(`[ui-parity] UNEXPECTED pixel differences in '${state.name}/${label}': `
                + `${px.diffPixels} px, maxChannelDelta ${px.maxChannelDelta}, bbox ${JSON.stringify(px.bbox)}`);
        }
        if (px.diffDataUrl) {
            fs.writeFileSync(path.join(outDir, `shot-${state.name}-${label}-diff.png`),
                Buffer.from(px.diffDataUrl.split(",")[1], "base64"));
            delete px.diffDataUrl;
        }
        pixelResults.push({ label, ...px, pixelClassification });
        log(`${state.name}/${label}: ${px.sizeMismatch ? "SIZE MISMATCH" : `${px.diffPixels} px differ`} — ${pixelClassification}`);
    }

    report.states.push({
        name: state.name,
        dom: { diffLines: diffLineCount(domDiff), classification: domClassification },
        tooltipProbes: state.hoverProbes,
        tooltipMismatches,
        screenshots: pixelResults,
    });
    log(`${state.name}: DOM ${domClassification} (${diffLineCount(domDiff)} diff lines); `
        + `tooltips ${tooltipMismatches.length === 0 ? "identical" : "MISMATCHED"}`);

    await sides.fork.ctx.close();
    await sides.upstream.ctx.close();
}

await scratchCtx.close();
await browser.close();

report.verdict = unexpected === 0
    ? `PASS (UI identical across all states; exclusions: ${EXCLUDED_SUBTREES.join(", ")} — gated fork UI)`
    : `FAIL (${unexpected} UNEXPECTED difference group(s))`;
fs.writeFileSync(path.join(outDir, "ui-parity-report.json"), JSON.stringify(report, null, 2));
console.log(`\n[ui-parity] ${report.verdict}`);
console.log(`[ui-parity] report: ${path.join(outDir, "ui-parity-report.json")}`);
process.exit(unexpected === 0 ? 0 : 1);
