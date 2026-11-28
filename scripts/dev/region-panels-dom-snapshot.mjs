/**
 * Region panels DOM snapshot — the equivalence instrument of the region-view-dedup slice
 * (`CC/docs/region-map/dedup.md`). The Locations / Exits / Regions panels' twin of D0
 * (`region-graph-class-snapshot.mjs`).
 *
 * It drives the running app with Playwright, loads a preset and, in each state, renders the three panels under
 * every sort method (the Regions panel also in "Show All" with every block expanded), and records each panel's
 * rendered HTML. The HTML is canonicalised only by dropping the inline `style` of the column grids (the panels'
 * own column-count control) — nothing else. A refactor that keeps the panels' behaviour leaves every file and every
 * digest byte-identical: run it before and after, then `diff -r` the two directories.
 *
 * In every state it also runs the REAL-SNAPSHOT ORACLE: each replaced reachability copy, as it was
 * (`frontend/modules/regionView/legacyReachabilityCopies.testkit.js`), against `isRegionReachable` over the live
 * stateManager snapshot, for every region name, exit side and location parent the preset has (+ '' and a missing
 * name). Its counts go to `oracle.json`; any inequality exits 1.
 *
 * The states, one page session per preset, in this order:
 *   S1  the initial load;
 *   S2  three location checks (stateManager) and one move (a click on the first traversable Exits-panel card leaving
 *       the current region, i.e. the panel's own exit-click path);
 *   S3  discovery mode ON (default discovery settings) at S2's state — partly discovered: what S2 visited;
 *   S4  S3 with each panel's "Show undiscovered" box unticked;
 *   S5  discovery OFF, Loop mode ON (`gameState.setLoopModeActive(true)`);
 *   S6  S5 with discovery ON;
 *   S7  a fresh page (a reload), discovery and Loop mode off.
 *
 * `--timing` instead measures each panel's render (the sort select's synchronous `change` handler, i.e.
 * `updateLocationDisplay` / `updateExitDisplay` / `renderAllRegions`) on the first preset at S1, `--runs` (default 5)
 * times per sort method, and prints the medians. Writes `<out>/timing.json`.
 *
 * Usage:
 *   node scripts/dev/region-panels-dom-snapshot.mjs --port=8141 --out=<dir> \
 *       [--presets=<name>[=<rules path>],...] [--timing [--runs=5]] [--headed]
 * A bare name loads `?game=<name>&seed=1`; `name=./presets/…_rules.json` loads `?rules=`.
 * Writes <dir>/<preset>/S<n>/<panel>-<variant>.html, <dir>/digests.json, <dir>/oracle.json and <dir>/findings.json
 * (the findings census, `FINDINGS_FN` below).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from '../procgen/boxLock.js';

const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
};
if (process.argv.includes('--help')) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(0);
}
const PORT = arg('port', process.env.TEST_PORT || '8000');
const OUT = arg('out', null);
const PRESETS = arg('presets', 'seedling_playthrough,alttp,procgen_topdown=./presets/procgen_topdown/AP_1/AP_1_rules.json').split(',').filter(Boolean);
const HEADED = process.argv.includes('--headed');
const TIMING = process.argv.includes('--timing');
const RUNS = Number(arg('runs', '5'));
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }

takeBoxLockOrExit({ name: 'region-panels-dom-snapshot.mjs', kind: 'browser' });

const BASE = `http://localhost:${PORT}/frontend/`;

const PANELS = {
    locations: { id: 'locationsPanel', root: '.locations-panel-container', sort: '#sort-select', undiscovered: '#show-undiscovered' },
    exits: { id: 'exitsPanel', root: '.exits-panel-container', sort: '#exit-sort-select', undiscovered: '#exit-show-undiscovered' },
    regions: { id: 'regionsPanel', root: '.regions-panel-container', sort: '#region-sort-select', undiscovered: '#region-show-undiscovered' },
};

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** In-page: a panel's canonical HTML. */
const HTML_FN = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = el.cloneNode(true);
    for (const g of c.querySelectorAll('#locations-grid, #exits-grid')) g.removeAttribute('style');
    return c.outerHTML;
};

async function settleHtml(page, sel, label) {
    let prev = null; let same = 0;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        await page.waitForTimeout(300);
        const cur = await page.evaluate(HTML_FN, sel);
        if (cur !== null && cur === prev) { if (++same >= 3) return cur; } else { same = 0; }
        prev = cur;
    }
    console.error(`${label}: did not settle in 60 s`);
    return prev;
}

const setSetting = (page, key, value) => page.evaluate(async ([k, v]) => {
    const { default: settingsManager } = await import('./app/core/settingsManager.js');
    await settingsManager.updateSetting(k, v);
}, [key, value]);

const activate = (page, panelId) => page.evaluate(async (id) => {
    const { default: eventBus } = await import('./app/core/eventBus.js');
    eventBus.publish('ui:activatePanel', { panelId: id }, 'tests');
}, panelId);

const waitForRules = (page) => page.waitForFunction(async () => {
    const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
    return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
}, null, { timeout: 90000, polling: 500 });

/** In-page: the real-snapshot oracle (see the header). */
const ORACLE_FN = async () => {
    const legacy = await import('./modules/regionView/legacyReachabilityCopies.testkit.js');
    const { isRegionReachable } = await import('./modules/regionView/regionViewModel.js');
    const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
    const sd = sm.getStaticData(); const snap = sm.getLatestStateSnapshot();
    const names = new Set(['', 'no such region']);
    const pairs = [];
    for (const [rn, rd] of sd.regions) {
        names.add(rn);
        for (const e of rd.exits ?? []) { names.add(e.connected_region); pairs.push([rn, e.connected_region]); }
    }
    for (const [, l] of sd.locations ?? []) names.add(l.parent_region ?? l.region);
    pairs.push(['', 'no such region']);
    const one = {
        exitFilterParent: legacy.exitFilterParent, exitFilterConnected: legacy.exitFilterConnected,
        navShowAll: legacy.navShowAll, navPath: (s, n) => legacy.navPath(s, { name: n }),
        navLast: (s, n) => legacy.navLast(s, { name: n }),
        blockEntranceSource: (s, n) => legacy.blockEntranceSource(s, { sourceRegion: n }),
        blockExitConnected: legacy.blockExitConnected, locationLinkRegion: legacy.locationLinkRegion,
        regionLinkDisplayStatus: (s, n) => legacy.regionLinkDisplayStatus(s, n) === true,
    };
    const two = {
        exitSortA: (s, p, c) => legacy.exitSortA(s, { parentRegion: p, connectedRegion: c }),
        exitSortB: (s, p, c) => legacy.exitSortB(s, { parentRegion: p, connectedRegion: c }),
        exitCard: legacy.exitCard, regionsExitClick: legacy.regionsExitClick,
    };
    const out = { sites: {}, mismatches: [], values: {} };
    for (const [k, fn] of Object.entries(one)) {
        let rows = 0; let eq = 0;
        for (const n of names) { rows++; if (fn(snap, n) === isRegionReachable(snap, n)) eq++; else out.mismatches.push([k, n]); }
        out.sites[k] = { rows, equal: eq };
    }
    for (const [k, fn] of Object.entries(two)) {
        let rows = 0; let eq = 0;
        for (const [p, c] of pairs) {
            rows++;
            const b = fn(snap, p, c);
            if (b[0] === isRegionReachable(snap, p) && b[1] === isRegionReachable(snap, c)) eq++;
            else out.mismatches.push([k, p, c]);
        }
        out.sites[k] = { rows, equal: eq };
    }
    // The undefined arm of createRegionLink, unchanged code: its three-way answer, before vs adopted.
    let rl = 0; let rlEq = 0;
    for (const n of names) {
        rl++;
        const raw = snap?.regionReachability?.[n];
        const after = isRegionReachable(snap, n) ? true : (raw === undefined ? undefined : false);
        if (legacy.regionLinkDisplayStatus(snap, n) === after) rlEq++; else out.mismatches.push(['regionLinkThreeWay', n]);
    }
    out.sites.regionLinkThreeWay = { rows: rl, equal: rlEq };
    for (const v of Object.values(snap.regionReachability ?? {})) out.values[String(v)] = (out.values[String(v)] ?? 0) + 1;
    return out;
};

/**
 * In-page: the FINDINGS census (`CC/docs/region-map/findings-fix.md`). What the inputs the left-alone copies disagree
 * on actually hold in a live snapshot:
 *  - `reach`: `snapshot.regionReachability[name]` for every region name the preset uses (regions, exit targets,
 *    location parents), bucketed `true` / `false` / `'reachable'` / `'unreachable'` / `'checked'` / `missing` / other;
 *  - `locationRules` / `exitRules`: what `evaluateRule` returns for every location / exit access rule, bucketed
 *    `true` / `false` / `undefined` / `null` / `throw` / `truthy:<type>` / `falsy:<type>`. A `truthy:*` bucket is the
 *    input on which a strict `=== true` and a truthiness test disagree.
 */
const FINDINGS_FN = async () => {
    const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
    const { evaluateRule } = await import('./modules/shared/ruleEngine.js');
    const { createSnapshotInterface } = await import('./modules/shared/snapshotInterface.js');
    const sd = sm.getStaticData(); const snap = sm.getLatestStateSnapshot();
    const si = createSnapshotInterface(snap, sd);
    const names = new Set();
    for (const [rn, rd] of sd.regions) {
        names.add(rn);
        for (const e of rd.exits ?? []) if (e.connected_region != null) names.add(e.connected_region);
        for (const l of rd.locations ?? []) names.add(l.parent_region ?? l.region ?? rn);
    }
    const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
    const reach = {};
    const rr = snap?.regionReachability;
    for (const n of names) {
        if (!rr || !Object.prototype.hasOwnProperty.call(rr, n)) { bump(reach, 'missing'); continue; }
        const v = rr[n];
        const k = (v === true || v === false || ['reachable', 'unreachable', 'checked'].includes(v))
            ? (typeof v === 'string' ? `'${v}'` : String(v)) : `other:${typeof v}:${String(v)}`;
        bump(reach, k);
    }
    const classify = (rule) => {
        let r;
        try { r = evaluateRule(rule, si); } catch { return 'throw'; }
        if (r === true || r === false || r === undefined || r === null) return String(r);
        return r ? `truthy:${typeof r}` : `falsy:${typeof r}`;
    };
    const locationRules = {}; const exitRules = {}; const truthySamples = [];
    for (const [rn, rd] of sd.regions) {
        for (const l of rd.locations ?? []) {
            if (!l.access_rule) { bump(locationRules, 'no rule'); continue; }
            const k = classify(l.access_rule); bump(locationRules, k);
            if (k.startsWith('truthy:') && truthySamples.length < 5) truthySamples.push(['location', l.name]);
        }
        for (const e of rd.exits ?? []) {
            if (!e.access_rule) { bump(exitRules, 'no rule'); continue; }
            const k = classify(e.access_rule); bump(exitRules, k);
            if (k.startsWith('truthy:') && truthySamples.length < 5) truthySamples.push(['exit', rn, e.name]);
        }
    }
    return { names: names.size, reach, locationRules, exitRules, truthySamples };
};

async function openPreset(browser, preset) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const [name, rules] = preset.split('=');
    const query = rules ? `rules=${encodeURIComponent(rules)}` : `game=${name}&seed=1`;
    await page.goto(`${BASE}?${query}`, { waitUntil: 'load', timeout: 60000 });
    await waitForRules(page);
    for (const p of Object.values(PANELS)) {
        await activate(page, p.id);
        await page.waitForSelector(p.root, { state: 'attached', timeout: 60000 });
    }
    return { context, page, errors };
}

/** Every variant of one panel in the current state → { variant: html }. */
async function capturePanel(page, key, label) {
    const p = PANELS[key];
    await activate(page, p.id);
    const options = await page.evaluate(([root, sort]) =>
        [...document.querySelectorAll(`${root} ${sort} option`)].map((o) => o.value), [p.root, p.sort]);
    const initial = await page.evaluate(([root, sort]) => document.querySelector(`${root} ${sort}`)?.value, [p.root, p.sort]);
    const setSort = (v) => page.evaluate(([root, sort, val]) => {
        const s = document.querySelector(`${root} ${sort}`);
        s.value = val;
        s.dispatchEvent(new Event('change', { bubbles: true }));
    }, [p.root, p.sort, v]);
    const out = {};
    for (const v of options) {
        await setSort(v);
        out[`sort-${v}`] = await settleHtml(page, p.root, `${label} ${key} ${v}`);
    }
    if (key === 'regions') {
        // Show All, every block expanded: every region's entrances and exits are built.
        const clickBox = (id, want) => page.evaluate(([root, sel, w]) => {
            const b = document.querySelector(`${root} ${sel}`);
            if (!b || b.checked === w) return !!b;
            b.click();
            return true;
        }, [p.root, id, want]);
        await clickBox('#show-all-regions', true);
        await settleHtml(page, p.root, `${label} regions showAll`);
        const expanded = await page.evaluate((root) => {
            const b = document.querySelector(`${root} #expand-collapse-all`);
            if (!b) return false;
            if (/expand/i.test(b.textContent)) b.click();
            return b.textContent;
        }, p.root);
        for (const v of options) {
            await setSort(v);
            out[`showAll-expanded-sort-${v}`] = await settleHtml(page, p.root, `${label} regions showAll ${v}`);
        }
        await page.evaluate((root) => {
            const b = document.querySelector(`${root} #expand-collapse-all`);
            if (b && /collapse/i.test(b.textContent)) b.click();
        }, p.root);
        await clickBox('#show-all-regions', false);
        out._expandButton = expanded;
    }
    await setSort(initial);
    await settleHtml(page, p.root, `${label} ${key} restore`);
    return out;
}

const setUndiscoveredBoxes = (page, checked) => page.evaluate(([panels, v]) => {
    for (const p of panels) {
        const b = document.querySelector(`${p.root} ${p.undiscovered}`);
        if (b && b.checked !== v) b.click();
    }
}, [Object.values(PANELS), checked]);

const setLoopMode = (page, on) => page.evaluate(async (v) => {
    const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
    getGameStateSingleton().setLoopModeActive(v);
}, on);

async function doActions(page) {
    const plan = await page.evaluate(async () => {
        const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
        const { evaluateRule } = await import('./modules/shared/ruleEngine.js');
        const { createSnapshotInterface } = await import('./modules/shared/snapshotInterface.js');
        const sd = sm.getStaticData(); const snap = sm.getLatestStateSnapshot();
        const si = createSnapshotInterface(snap, sd);
        const reach = (r) => [true, 'reachable', 'checked'].includes(snap.regionReachability?.[r]);
        const checked = new Set(snap.checkedLocations ?? []);
        const locs = [];
        for (const [rn, rd] of sd.regions) {
            if (!reach(rn)) continue;
            for (const l of rd.locations ?? []) {
                if (checked.has(l.name)) continue;
                let ok = true;
                try { ok = l.access_rule ? !!evaluateRule(l.access_rule, si) : true; } catch { ok = false; }
                if (ok) locs.push(l.name);
            }
        }
        locs.sort();
        return { locations: locs.slice(0, 3) };
    });
    for (const name of plan.locations) {
        await page.evaluate(async (n) => {
            const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
            await sm.checkLocation(n);
        }, name);
        await page.waitForTimeout(300);
    }
    // One move: the first traversable exit card leaving the current region (Exits panel, name sort).
    await activate(page, PANELS.exits.id);
    await page.waitForTimeout(500);
    plan.move = await page.evaluate(async (root) => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        const here = getGameStateSingleton().getCurrentRegion?.() ?? null;
        const s = document.querySelector(`${root} #exit-sort-select`);
        s.value = 'name';
        s.dispatchEvent(new Event('change', { bubbles: true }));
        const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
        const exitNames = (sm.getStaticData().regions.get(here)?.exits ?? []).map((e) => e.name).sort();
        const cards = [...document.querySelectorAll(`${root} .exit-card.traversable`)];
        let card = null;
        for (const n of exitNames) {
            card = cards.find((c) => {
                let d = null;
                try { d = JSON.parse(decodeURIComponent(c.dataset.exit ?? '')); } catch { /* not a card */ }
                return d && d.name === n && (d.parentRegion ?? d.region) === here;
            });
            if (card) break;
        }
        if (!card) return { here, clicked: null };
        const text = JSON.parse(decodeURIComponent(card.dataset.exit)).name;
        card.click();
        return { here, clicked: text };
    }, PANELS.exits.root);
    await page.waitForTimeout(800);
    plan.after = await page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        return getGameStateSingleton().getCurrentRegion?.() ?? null;
    });
    return plan;
}

async function runPreset(browser, preset) {
    const dir = path.join(OUT, preset.split('=')[0]);
    const digests = {}; const oracle = {}; const findings = {};
    let { context, page, errors } = await openPreset(browser, preset);
    const take = async (state) => {
        const sdir = path.join(dir, state);
        fs.mkdirSync(sdir, { recursive: true });
        digests[state] = {};
        for (const key of Object.keys(PANELS)) {
            const variants = await capturePanel(page, key, `${preset} ${state}`);
            for (const [v, html] of Object.entries(variants)) {
                if (v.startsWith('_')) { digests[state][`${key}${v}`] = html; continue; }
                fs.writeFileSync(path.join(sdir, `${key}-${v}.html`), html ?? 'null');
                digests[state][`${key}-${v}`] = { sha256: sha(html ?? 'null'), bytes: (html ?? '').length };
            }
        }
        oracle[state] = await page.evaluate(ORACLE_FN);
        findings[state] = await page.evaluate(FINDINGS_FN);
    };
    await take('S1');
    const plan = await doActions(page);
    await take('S2');
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', true);
    await take('S3');
    await setUndiscoveredBoxes(page, false);
    await take('S4');
    await setUndiscoveredBoxes(page, true);
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', false);
    await setLoopMode(page, true);
    await take('S5');
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', true);
    await take('S6');
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', false);
    await setLoopMode(page, false);
    await context.close();
    ({ context, page, errors: errors } = await openPreset(browser, preset).then((r) => ({ ...r, errors: [...errors, ...r.errors] })));
    await take('S7');
    await context.close();
    return { preset, plan, digests, oracle, findings, errors };
}

async function runTiming(browser, preset) {
    const { context, page } = await openPreset(browser, preset);
    const out = {};
    for (const key of Object.keys(PANELS)) {
        const p = PANELS[key];
        await activate(page, p.id);
        await settleHtml(page, p.root, `${preset} timing ${key}`);
        const options = await page.evaluate(([root, sort]) =>
            [...document.querySelectorAll(`${root} ${sort} option`)].map((o) => o.value), [p.root, p.sort]);
        out[key] = {};
        for (const v of options) {
            const samples = [];
            for (let i = 0; i <= RUNS; i++) {
                const ms = await page.evaluate(([root, sort, val]) => {
                    const s = document.querySelector(`${root} ${sort}`);
                    s.value = val;
                    const t0 = performance.now();
                    s.dispatchEvent(new Event('change', { bubbles: true }));
                    return performance.now() - t0;
                }, [p.root, p.sort, v]);
                if (i > 0) samples.push(ms); // the first run warms the sort's path
                await page.waitForTimeout(150);
            }
            const sorted = [...samples].sort((a, b) => a - b);
            out[key][v] = { median: sorted[Math.floor(sorted.length / 2)], samples };
        }
    }
    await context.close();
    return out;
}

const browser = await chromium.launch({ headless: !HEADED });
let bad = false;
try {
    fs.mkdirSync(OUT, { recursive: true });
    if (TIMING) {
        const t = await runTiming(browser, PRESETS[0]);
        fs.writeFileSync(path.join(OUT, 'timing.json'), `${JSON.stringify(t, null, 1)}\n`);
        for (const [k, byV] of Object.entries(t)) {
            console.log(`${PRESETS[0]} ${k}: ${Object.entries(byV).map(([v, r]) => `${v}=${r.median.toFixed(1)}ms`).join(' ')}`);
        }
    } else {
        const digests = {}; const oracle = {}; const findings = {}; const summary = [];
        for (const preset of PRESETS) {
            const r = await runPreset(browser, preset);
            const name = preset.split('=')[0];
            digests[name] = r.digests; oracle[name] = r.oracle; findings[name] = r.findings;
            const mism = Object.values(r.oracle).reduce((n, o) => n + o.mismatches.length, 0);
            const rows = Object.values(r.oracle).reduce((n, o) => n + Object.values(o.sites).reduce((m, s) => m + s.rows, 0), 0);
            if (mism) bad = true;
            summary.push({ preset, plan: r.plan, errors: r.errors, oracleRows: rows, oracleMismatches: mism });
            console.log(`${preset}: checks ${r.plan.locations.length}, move ${JSON.stringify(r.plan.move)} → ${r.plan.after}`
                + ` | oracle ${rows} rows, ${mism} mismatch(es)`
                + (r.errors.length ? ` | ${r.errors.length} page error(s): ${r.errors[0]}` : ''));
        }
        fs.writeFileSync(path.join(OUT, 'digests.json'), `${JSON.stringify(digests, null, 1)}\n`);
        fs.writeFileSync(path.join(OUT, 'oracle.json'), `${JSON.stringify(oracle, null, 1)}\n`);
        fs.writeFileSync(path.join(OUT, 'findings.json'), `${JSON.stringify(findings, null, 1)}\n`);
        fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
    }
} finally {
    await browser.close();
}
process.exit(bad ? 1 : 0);
