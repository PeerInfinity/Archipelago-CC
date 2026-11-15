/**
 * Region Graph class snapshot — the D0 equivalence instrument of the Region Map
 * step 2 slice (`CC/docs/region-map/step2-view-model.md`).
 *
 * It drives the running app with Playwright, loads a preset, opens the Region
 * Graph, and dumps a canonical, sorted JSON of every Cytoscape element:
 * id → group, sorted class list, label text and the view-derived data keys
 * (`isDiscovered`, `locationCounts`, `hierarchyDepth`), plus the player's region
 * and the current path. Positions are NOT dumped: the layout is not under test
 * and is not deterministic.
 *
 * The states, one page session per preset, in this order:
 *   S1  the initial load;
 *   S2  three location checks (through the "Go to" picker, i.e. the location-tap
 *       handler) and one region move (a region-node tap, i.e. the default
 *       "move player directly");
 *   S3  discovery mode ON (default discovery settings), at S2's state;
 *   S4  S3 with the "Show undiscovered" box (`#graph-show-undiscovered`) unticked;
 *   S5  discovery OFF with the external filters registered: an accessibility
 *       filter returning false (reachability colours off, as APCalc hard mode)
 *       and an edge filter hiding every edge whose source sorts after its target;
 *   S6  S5 with discovery ON.
 * Every state also records `hoverSweep`: each region's location nodes as hover
 * mode (the default `locationVisibility`) draws them, one region at a time.
 * S2 hovers the first checked location's region BEFORE its actions, so those
 * location nodes in `elements` are the ones the snapshots updated.

 * A refactor that keeps the Region Graph's behaviour leaves every dump
 * byte-identical. Run it before and after, then `diff -r` the two directories.
 *
 * Usage:
 *   node scripts/dev/region-graph-class-snapshot.mjs --port=8130 --out=<dir> \
 *       [--presets=<name>[=<rules path>],...] [--headed] [--wait-for-box=<sec>]
 * A bare name loads `?game=<name>&seed=1`; `name=./presets/…_rules.json` loads `?rules=`.
 * Writes <dir>/<preset>/S<n>.json. Exit 1 when a state could not be reached.
 */
import fs from 'node:fs';
import path from 'node:path';
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
if (!OUT) { console.error('--out=<dir> is required'); process.exit(2); }

takeBoxLockOrExit({ name: 'region-graph-class-snapshot.mjs', kind: 'browser' });

const BASE = `http://localhost:${PORT}/frontend/`;

/** In-page: the Region Graph's cy, read off its container (cytoscape keeps `_cyreg` there). */
const DUMP_FN = () => {
    const container = document.querySelector('.region-graph-panel-container div[id^="cy-"]');
    const cy = container?._cyreg?.cy;
    if (!cy) return null;
    const out = {};
    cy.elements().forEach((el) => {
        const d = el.data();
        const rec = {
            group: el.group(),
            classes: [...el.classes()].sort(),
            label: d.label ?? null,
        };
        if (d.isDiscovered !== undefined) rec.isDiscovered = d.isDiscovered;
        if (d.locationCounts !== undefined) rec.locationCounts = d.locationCounts;
        if (d.hierarchyDepth !== undefined) rec.hierarchyDepth = d.hierarchyDepth;
        if (el.group() === 'edges') { rec.source = d.source; rec.target = d.target; }
        out[el.id()] = rec;
    });
    return out;
};

/**
 * In-page: the location nodes as hover mode draws them (the default
 * `locationVisibility`), one region at a time — mouseover each region that has
 * locations, in id order, and read its location nodes + edges; then leave the
 * graph so none stay drawn. Location nodes shown BEFORE the sweep (S2's hovered
 * region, updated by the snapshots the actions caused) are in `elements`.
 */
const HOVER_SWEEP_FN = () => {
    const container = document.querySelector('.region-graph-panel-container div[id^="cy-"]');
    const cy = container?._cyreg?.cy;
    if (!cy) return null;
    const out = {};
    const ids = cy.nodes('.region').filter((n) => !n.hasClass('player') && !n.hasClass('location-node'))
        .map((n) => n.id()).sort();
    for (const id of ids) {
        cy.getElementById(id).emit('mouseover');
        const els = cy.elements(`[parentRegion="${id}"], edge[source="${id}"].region-location-edge`);
        if (!els.length) continue;
        const rec = {};
        els.forEach((el) => { rec[el.id()] = { classes: [...el.classes()].sort(), label: el.data('label') ?? null,
            ...(el.data('isDiscovered') !== undefined ? { isDiscovered: el.data('isDiscovered') } : {}) }; });
        out[id] = rec;
    }
    container.dispatchEvent(new MouseEvent('mouseleave'));
    // graphContainer (the listener's element) may be the container's parent.
    container.parentElement?.dispatchEvent(new MouseEvent('mouseleave'));
    return out;
};

function canon(value) {
    if (Array.isArray(value)) return value.map(canon);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canon(value[k])]));
    }
    return value;
}

async function settle(page, label) {
    // Stable = three identical dumps 400 ms apart, with no layout running.
    let prev = null; let same = 0;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
        await page.waitForTimeout(400);
        const cur = JSON.stringify(await page.evaluate(DUMP_FN));
        if (cur !== 'null' && cur === prev) { if (++same >= 3) return true; } else { same = 0; }
        prev = cur;
    }
    console.error(`${label}: did not settle in 60 s`);
    return false;
}

async function snapshot(page) {
    const elements = await page.evaluate(DUMP_FN);
    const extra = await page.evaluate(async () => {
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        const gs = getGameStateSingleton();
        const path = (gs?.getPath?.() ?? []).map((p) => ({ type: p.type, region: p.region ?? p.destinationRegion ?? null,
            exit: p.exitUsed ?? null, location: p.locationName ?? null }));
        const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
        return { currentRegion: gs?.getCurrentRegion?.() ?? null, path, rulesSource: sm.getRawJsonDataSource?.() ?? null };
    });
    const pathClasses = Object.fromEntries(Object.entries(elements ?? {})
        .filter(([, r]) => r.classes.some((c) => c === 'in-path' || c.startsWith('path-')))
        .map(([id, r]) => [id, r.classes.filter((c) => c === 'in-path' || c.startsWith('path-'))]));
    const playerRegion = Object.entries(elements ?? {}).find(([, r]) => r.classes.includes('current'))?.[0] ?? null;
    return canon({ ...extra, playerRegion, pathClasses, elements });
}

const setSetting = (page, key, value) => page.evaluate(async ([k, v]) => {
    const { default: settingsManager } = await import('./app/core/settingsManager.js');
    await settingsManager.updateSetting(k, v);
}, [key, value]);

async function doActions(page) {
    // S2: three location checks via the picker (= the location-tap handler) and
    // one region tap (= "move player directly", the default click option).
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
        const { getGameStateSingleton } = await import('./modules/gameState/singleton.js');
        const here = getGameStateSingleton().getCurrentRegion();
        const targets = [...sd.regions.keys()].filter((r) => r !== here && reach(r)).sort();
        const regionOf = (loc) => [...sd.regions].find(([, rd]) => (rd.locations ?? []).some((l) => l.name === loc))?.[0];
        return { locations: locs.slice(0, 3), target: targets[0] ?? null, here, hover: regionOf(locs[0]) ?? null };
    });
    // Hover the first check's region first, so its location nodes are drawn
    // while the checks' snapshots update them (the update path, not creation).
    if (plan.hover) {
        await page.evaluate((id) => {
            document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy.getElementById(id).emit('mouseover');
        }, plan.hover);
    }
    await page.evaluate(async ({ locations }) => {
        const { PICKER } = await import('./modules/regionGraph/nodePicker.js');
        const root = document.querySelector(`.region-graph-panel-container ${PICKER.section}`);
        root.open = true;
        for (const name of locations) {
            const box = root.querySelector(PICKER.location);
            box.value = name;
            box.dispatchEvent(new Event('input', { bubbles: true }));
            box.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 300));
        }
        root.open = false;
    }, plan);
    if (plan.target) {
        await page.waitForTimeout(500);
        await page.evaluate((target) => {
            const cy = document.querySelector('.region-graph-panel-container div[id^="cy-"]')._cyreg.cy;
            cy.getElementById(target).emit('tap');
        }, plan.target);
    }
    return plan;
}

async function openPreset(browser, preset, presetSettings = {}) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const [name, rules] = preset.split('=');
    const query = rules ? `rules=${encodeURIComponent(rules)}` : `game=${name}&seed=1`;
    await page.goto(`${BASE}?${query}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(async () => {
        const { stateManagerProxySingleton: sm } = await import('./modules/stateManager/index.js');
        return (sm.getStaticData?.()?.regions?.size ?? 0) > 0 && !!sm.getLatestStateSnapshot?.();
    }, null, { timeout: 90000, polling: 500 });
    // Settings written BEFORE the panel's first show: a later write to a
    // moduleSettings.regionGraph key rebuilds the graph, which drops drawn
    // location nodes without re-showing them (a pre-existing Region Graph
    // behaviour, named in the step 2 report), so S5/S6 set theirs here.
    for (const [k, v] of Object.entries(presetSettings)) await setSetting(page, k, v);
    if (Object.keys(presetSettings).length) await page.waitForTimeout(1000);
    await page.evaluate(async () => {
        const { default: eventBus } = await import('./app/core/eventBus.js');
        eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' }, 'tests');
    });
    await page.waitForFunction(() => {
        const c = document.querySelector('.region-graph-panel-container div[id^="cy-"]');
        return (c?._cyreg?.cy?.nodes('.region').length ?? 0) > 0;
    }, null, { timeout: 90000, polling: 500 });
    return { context, page, errors };
}

async function runPreset(browser, preset) {
    const dir = path.join(OUT, preset.split('=')[0]);
    const states = [];
    let { context, page, errors } = await openPreset(browser, preset);
    fs.mkdirSync(dir, { recursive: true });
    const take = async (name) => {
        const ok = await settle(page, `${preset} ${name}`);
        const snap = await snapshot(page);
        snap.hoverSweep = canon(await page.evaluate(HOVER_SWEEP_FN));
        fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(snap, null, 1)}\n`);
        states.push({ name, ok, elements: Object.keys(snap.elements ?? {}).length });
        return ok;
    };

    await take('S1');

    const plan = await doActions(page);
    await take('S2');

    // S3: discovery ON, default discovery settings.
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', true);
    await take('S3');

    // S4: untick "Show undiscovered".
    const toggle = (checked) => page.evaluate((v) => {
        const box = document.querySelector('.region-graph-panel-container #graph-show-undiscovered');
        if (!box) return false;
        box.checked = v;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }, checked);
    const hasBox = await toggle(false);
    await take('S4');
    if (hasBox) await toggle(true);

    // S5: discovery OFF, the external filters on — an accessibility filter
    // that hides the reachability colours (as APCalc's hard mode does) and an
    // edge filter that hides every edge whose source sorts after its target.
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', false);
    await settle(page, `${preset} S5 pre`);
    await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        centralRegistry.getPublicFunction('regionGraph', 'registerEdgeVisibilityFilter')((a, b) => a < b);
        centralRegistry.getPublicFunction('regionGraph', 'registerAccessibilityVisibilityFilter')(() => false);
    });
    await take('S5');

    // S6: S5 + discovery ON.
    await setSetting(page, 'moduleSettings.discovery.enableDiscoveryMode', true);
    await take('S6');
    await page.evaluate(async () => {
        const { centralRegistry } = await import('./app/core/centralRegistry.js');
        centralRegistry.getPublicFunction('regionGraph', 'registerEdgeVisibilityFilter')(null);
        centralRegistry.getPublicFunction('regionGraph', 'registerAccessibilityVisibilityFilter')(null);
    });
    await context.close();
    return { preset, plan, hasBox, states, errors };
}

const browser = await chromium.launch({ headless: !HEADED });
const summary = [];
let bad = false;
try {
    for (const preset of PRESETS) {
        const r = await runPreset(browser, preset);
        summary.push(r);
        if (r.states.some((s) => !s.ok)) bad = true;
        console.log(`${preset}: ${r.states.map((s) => `${s.name}=${s.elements}${s.ok ? '' : '(UNSETTLED)'}`).join(' ')}`
            + ` | checks ${r.plan.locations.length}, move ${r.plan.here} → ${r.plan.target}`
            + (r.errors.length ? ` | ${r.errors.length} page error(s): ${r.errors[0]}` : ''));
    }
} finally {
    await browser.close();
}
fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
process.exit(bad ? 1 : 0);
