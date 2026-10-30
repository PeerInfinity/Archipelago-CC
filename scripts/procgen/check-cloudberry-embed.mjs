#!/usr/bin/env node
/**
 * check-cloudberry-embed — **A CLOUDBERRY WORLD, FROM THE DEMO PACK THROUGH THE PYTHON ROUND
 * TRIP INTO THE REAL FRONTEND, PLAYED** (cloudberry P2a gate).
 *
 *   committed demo pack (frontend/region-libraries/demo-cloudberry-pack.json)
 *     → JS pipeline (arrangeShuffledSpiral, the library content source → buildRulesJson)
 *     → world_generator --canonical-seed 1   (keeps the pack's captured items in place)
 *     → Generate.py --seed 1                 (AP's own fill + sphere log: the world is winnable)
 *     → the frontend on that export (?rules=…), the Cloudberry page in the cloudberry panel:
 *
 *   1. the start region configures in the panel (the page plays the hash-checked level);
 *   2. an UNHELD item: its platforms are not landable — the bot walking to the check coin
 *      behind them dies, and nothing is sent;
 *   3. the free check coin, collected by the bot → `user:locationCheck` → the AP location is
 *      checked in the tracker → the host's checked set reaches the page (setCheckedLocations:
 *      the coin is drawn as an outline) and the item it holds is received
 *      (pollItems: the platforms become landable);
 *   4. RECEIVING the item: the bot now reaches the coin it died on in 2, and it is checked;
 *   5. the END DOOR's exit menu: the player stands at the door, Up opens the menu, → chooses
 *      east → `sendExit` → `user:regionMove` → the next region loads in the panel.
 *
 * The bot is the page's own (the computer's recording, P1a); it is driven through the
 * substrate's host-side PlaybackProxy (the surface loops and the Playback Bot use), except in 5,
 * where the page's own `botWalkTo` parks the player at the door by a side the region has no
 * exit on (so the door does not leave by itself) and the KEYBOARD opens and answers the menu.
 *
 * Needs the same-origin Cloudberry site (`node scripts/setup/fetch-cloudberry-site.mjs`) and a
 * dev server serving this tree. Runs in a throwaway world/preset and cleans up (restores
 * preset_files.json). Screenshots: `--shots <dir>`.
 *
 *   node scripts/procgen/check-cloudberry-embed.mjs [--port <n>] [--shots <dir>] [--keep] [--bundled]
 *
 * @ci-box V3b adopted this script's NAME, not its RUN: it shells out to this tree's Python venv and `Generate.py`, and needs the fetched Cloudberry site and a dev server.
 * @tree-writes frontend/presets/preset_files.json: `Generate.py` registers this gate's export there, and the gate restores the file's bytes in its `finally` — which a SIGKILL skips.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { argvHelp } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { failOnCrash, totalLine } from './gateTotal.js';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { generatePythonOrExit } from './repoPython.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'check-cloudberry-embed.mjs', kind: 'browser' });

const argv = process.argv.slice(2);
const arg = (name) => {
    const eq = argv.find((a) => a.startsWith(`${name}=`));
    if (eq) return eq.slice(name.length + 1);
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
};
const PORT = Number(arg('--port') ?? process.env.TEST_PORT ?? 8000);
const SHOTS = arg('--shots') ? path.resolve(arg('--shots')) : null;
const KEEP = argv.includes('--keep');
// --bundled: the deployed boot (frontend/dist/bundle.js; build it first with `npm run build`). Only step 1
// runs there (the module is in the bundle and the region configures through the bridge): the play steps'
// helpers import frontend modules into the page, which under the bundle are SECOND copies, not the app's.
const BUNDLED = argv.includes('--bundled');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const GAME_NAME = 'Cloudberry Library Spiral';
const WORLD_DIR = path.join(repoRoot, 'worlds/cloudberry_library_spiral_worldgen');
const PRESET_NAME = 'cloudberry_library_spiral_worldgen';
const PRESET_DIR = path.join(repoRoot, 'frontend/presets', PRESET_NAME);
const PRESET_FILES_JSON = path.join(repoRoot, 'frontend/presets/preset_files.json');
const OUTPUT_DIR = path.join(repoRoot, 'output');
const LIBRARY_FILE = path.join(repoRoot, 'frontend/region-libraries/demo-cloudberry-pack.json');
const SITE_DIR = path.join(repoRoot, 'frontend/external/cloudberry');
const SEED = 1;
const tmpRules = path.join(repoRoot, 'scripts/procgen/.cloudberry-spiral-rules.json');
const tmpTemplates = path.join(repoRoot, 'scripts/procgen/.cloudberry-spiral-templates');

let failures = 0;
failOnCrash(() => failures);
const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
    if (!cond) failures++;
    return cond;
};
const run = (cmd, args) => execFileSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

if (!fs.existsSync(path.join(SITE_DIR, 'index.html'))) {
    console.error(`REFUSED: no Cloudberry site at ${path.relative(repoRoot, SITE_DIR)} — run: node scripts/setup/fetch-cloudberry-site.mjs`);
    process.exit(2);
}
const py = generatePythonOrExit('check-cloudberry-embed.mjs');
const presetFilesBefore = fs.existsSync(PRESET_FILES_JSON) ? fs.readFileSync(PRESET_FILES_JSON, 'utf8') : null;

function cleanup() {
    fs.rmSync(tmpTemplates, { recursive: true, force: true });
    fs.rmSync(tmpRules, { force: true });
    if (presetFilesBefore !== null) fs.writeFileSync(PRESET_FILES_JSON, presetFilesBefore);
    if (KEEP) { console.log(`[kept] ${WORLD_DIR}\n[kept] ${PRESET_DIR}`); return; }
    for (const p of [WORLD_DIR, PRESET_DIR]) fs.rmSync(p, { recursive: true, force: true });
    if (fs.existsSync(OUTPUT_DIR)) {
        for (const f of fs.readdirSync(OUTPUT_DIR)) if (/^AP_\d+\.zip$/.test(f)) fs.rmSync(path.join(OUTPUT_DIR, f), { force: true });
    }
}

let browser = null;
try {
    fs.rmSync(PRESET_DIR, { recursive: true, force: true });
    fs.rmSync(WORLD_DIR, { recursive: true, force: true });

    // ── Pass A: the JS pipeline ─────────────────────────────────────────
    const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
    await imp('frontend/modules/cloudberryDemo/cloudberryLibrary.js');
    const engine = await imp('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const validator = await imp('frontend/modules/procgenPipeline/regionLibraryValidator.js');
    const { substrateRegistry } = await imp('frontend/modules/shared/procgen/substrateRegistry.js');
    const cloudberry = substrateRegistry.get('cloudberry');

    const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    const vr = validator.validateRegionLibrary(lib, { entryCapabilityCheck: (e) => cloudberry.validateLibraryEntry(e) });
    ok(vr.ok, `demo Cloudberry pack validates (${vr.errors.join('; ') || 'no errors'})`);
    const srcId = engine.librarySourceId(lib.library_id);
    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, seed: SEED,
        itemPool: {}, obstaclePool: {}, regionParams: {},
        growthParams: { substrateQuotas: { [srcId]: 4 }, substrateConfig: { [srcId]: { libraryDoc: lib } }, assumeBidirectional: true },
        hazardOpts: null,
    });
    const regions = [...grid.allRegions()];
    ok(regions.length === 4 && regions.every((r) => r.substrate === 'cloudberry'),
        `Pass A: 4 regions, every one cloudberry (${regions.map((r) => r.substrate).join(',')})`);
    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED, completionConditionItem: 'Victory',
        procgenMetadata: { driver: 'shuffled-spiral', stop_reason: 'spiral_complete' },
    });
    const compiled = Object.fromEntries(Object.values(rules.regions).flatMap((byName) => Object.entries(byName)));
    const start = compiled.Menu?.exits?.[0]?.connected_region;
    ok(typeof start === 'string' && start.startsWith('region_'), `Pass A: the world starts in ${start}`);
    const startRegion = compiled[start];
    const free = startRegion.locations.filter((l) => l.access_rule?.rule === 'True_');
    const gated = startRegion.locations.filter((l) => l.access_rule?.rule === 'Has');
    ok(free.length >= 1 && gated.length >= 1,
        `Pass A: ${start} has a free check coin (${free.map((l) => l.name)}) and one behind an item (${gated.map((l) => `${l.name}: ${l.access_rule.args.item_name}`)})`);
    const needed = gated[0]?.access_rule?.args?.item_name;
    ok(free.some((l) => l.item?.name === needed || l.item === needed),
        `Pass A: the free coin holds what the gated one needs (${needed}) — captured items kept`);
    ok(startRegion.exits.every((e) => JSON.stringify(e.access_rule).includes(needed)),
        `Pass A: every exit of ${start} needs S_last (${startRegion.exits.map((e) => JSON.stringify(e.access_rule)).join(' | ')})`);
    ok(!JSON.stringify(rules).includes(lib.library_id), 'Pass A: no library residency in the compiled world');
    fs.writeFileSync(tmpRules, JSON.stringify(rules, null, 2));

    // ── world_generator + Generate.py ─────────────────────────────────────
    run(py, ['-m', 'world_generator', tmpRules, '-o', WORLD_DIR, '--game-name', GAME_NAME, '--force', '--canonical-seed', '1']);
    run(py, ['-c', `from Options import generate_yaml_templates; generate_yaml_templates(${JSON.stringify(tmpTemplates)})`]);
    run(py, ['Generate.py', '--weights_file_path', path.join(tmpTemplates, `${GAME_NAME}.yaml`), '--multi', '1', '--seed', String(SEED)]);
    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    ok(apDirs.length === 1, `Generate.py: one AP_* export (${apDirs.join(',')})`);
    const seedId = apDirs[0];
    const exportRel = `./presets/${PRESET_NAME}/${seedId}/${seedId}_rules.json`;
    const exported = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, seedId, `${seedId}_rules.json`), 'utf8'));
    const exportedLocs = Object.values(exported.regions).flatMap((b) => Object.values(b)).flatMap((r) => r.locations ?? []);
    const allLocs = Object.values(compiled).flatMap((r) => r.locations ?? []).map((l) => l.name);
    ok(allLocs.every((n) => exportedLocs.some((l) => l.name === n)), `Generate.py: all ${allLocs.length} check coins exported`);
    const sphereLocs = new Set();
    for (const line of fs.readFileSync(path.join(PRESET_DIR, seedId, `${seedId}_sphere_log.jsonl`), 'utf8').split('\n').filter(Boolean)) {
        for (const pd of Object.values(JSON.parse(line).player_data ?? {})) {
            for (const l of [...(pd.new_accessible_locations ?? []), ...(pd.checked_locations ?? [])]) sphereLocs.add(l);
        }
    }
    ok(allLocs.every((n) => sphereLocs.has(n)), `Generate.py: the sphere log reaches every check coin (${sphereLocs.size}/${allLocs.length})`);
    ok(exportedLocs.some((l) => l.item?.name === 'Victory'), 'Generate.py: Victory placed (a winnable seed)');
    const placedAt = (name) => exportedLocs.find((l) => l.name === name)?.item?.name;
    const freeName = free.find((l) => (l.item?.name ?? l.item) === needed)?.name;
    ok(placedAt(freeName) === needed, `Generate.py (canonical): ${freeName} still holds ${needed}`);

    // ── the frontend ─────────────────────────────────────────────────────
    browser = await chromium.launch({ args: [...HEADLESS_LOGIC_ONLY_ARGS] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    // The game panel's iframe only (the whole UI is mostly other panels).
    const shot = async (name) => {
        if (!SHOTS) return;
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.locator('iframe[src*="/external/cloudberry/index.html"]').screenshot({ path: path.join(SHOTS, `${name}.png`) });
    };

    const base = `http://localhost:${PORT}/frontend/`;
    await page.goto(`${base}?rules=${encodeURIComponent(exportRel)}${BUNDLED ? '&bundled=true' : ''}`);
    const frame = () => page.frames().find((f) => f.url().includes('/external/cloudberry/index.html'));
    const game = (fn, a) => frame().evaluate(fn, a);
    const app = () => game(() => {
        const a = window.__cloudberryEmbed?.app;
        return a ? { region: a.config?.regionId ?? null, refusal: a.refusal ?? null, play: a.playResult ?? null,
            items: a.itemsState ?? null, checked: [...(a.checked ?? [])], events: a.events ?? [], menu: a.menu ?? null } : null;
    });
    async function waitFor(desc, fn, timeoutMs = 90000) {
        const t0 = Date.now();
        for (;;) {
            let v = null;
            try { v = await fn(); } catch { /* the frame may be reloading */ }
            if (v) return v;
            if (Date.now() - t0 > timeoutMs) {
                console.log(logs.filter((l) => /cloudberry|flash-bridge|pageerror|error/i.test(l)).slice(-20).join('\n'));
                throw new Error(`timeout waiting for: ${desc}`);
            }
            await page.waitForTimeout(250);
        }
    }
    const snapshot = () => page.evaluate(async () => {
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        await proxy.pingWorker('sync');
        const s = proxy.uiCache ?? {};
        const checked = s.checkedLocations;
        return { inventory: s.inventory ?? {}, checked: checked instanceof Set ? [...checked] : (Array.isArray(checked) ? checked : Object.keys(checked ?? {})) };
    });
    const walkTo = (target) => page.evaluate(async (t) => {
        const { substrateRegistry } = await import('./modules/shared/procgen/substrateRegistry.js');
        const c = substrateRegistry.get('cloudberry')?.getPlaybackController?.();
        if (!c) return false;
        c.walkTo(t);
        return true;
    }, target);
    const botResults = async () => (await app()).events.filter((e) => e.kind === 'bot');

    // 1. the start region in the panel
    const a1 = await waitFor(`${start} configured in the cloudberry panel`, async () => {
        const a = await app();
        return a?.play?.ok || a?.refusal ? a : null;
    }, 180000);
    ok(!a1.refusal && a1.region === start, `1. ${start} configured and playing (${a1.refusal ?? `${a1.play.pieces} pieces, ${a1.play.checks} checks`})`);
    ok(frame().url().startsWith(base), `1. the page is same-origin (${frame().url().split('?')[0]})`);
    ok((a1.items?.platforms ?? []).length === 0, `1. nothing held (${JSON.stringify(a1.items?.platforms)})`);
    const look = await waitFor('the check-coin look', () => game(() => window.__cloudberryEmbed.app.look ?? null), 20000);
    ok(look.source === 'logo' && look.sheet?.startsWith(`${base}packs/archipelago/`),
        `1. the check coins draw the Archipelago logo from THIS server's art library (${look.sheet ?? look.reason})`);
    await page.waitForTimeout(3000);
    await shot('1-start-region');
    if (BUNDLED) {
        console.log('(--bundled: steps 2–5 skipped — their helpers would read a second copy of the modules)');
        throw Object.assign(new Error('bundled stop'), { bundledStop: true });
    }

    const flashName = (apName) => apName.slice(start.length + 2);
    const freeCheck = flashName(freeName);
    const gatedName = gated.find((l) => l.access_rule.args.item_name === needed).name;
    const gatedCheck = flashName(gatedName);

    // 2. unheld platforms are not landable
    let before = (await botResults()).length;
    ok(await walkTo({ kind: 'location', name: gatedName }), `2. walkTo ${gatedName} (needs ${needed}, unheld)`);
    const died = await waitFor('the bot\'s walk to the gated coin ends', async () => {
        const r = await botResults();
        return r.length > before ? r[r.length - 1] : null;
    });
    ok(died.result === 'died' || died.status === 'died' || JSON.stringify(died).includes('died'), `2. the bot died — ${needed} platforms are not landable (${JSON.stringify(died)})`);
    ok(!(await snapshot()).checked.includes(gatedName), `2. ${gatedName} not checked`);
    await shot('2-unheld-dashed');

    // 3. the free coin → tracker → outline + item received
    before = (await botResults()).length;
    ok(await walkTo({ kind: 'location', name: freeName }), `3. walkTo ${freeName}`);
    const s3 = await waitFor(`${freeName} checked in the tracker`, async () => {
        const s = await snapshot();
        return s.checked.includes(freeName) ? s : null;
    });
    ok(Number(s3.inventory[needed]) > 0, `3. ${freeName} checked → ${needed} received by the host`);
    const a3 = await waitFor(`the page has ${freeCheck} checked and ${needed} held`, async () => {
        const a = await app();
        return a.checked.includes(freeCheck) && (a.items?.platforms ?? []).length > 0 ? a : null;
    });
    ok(a3.checked.includes(freeCheck), `3. setCheckedLocations reached the page: ${freeCheck} drawn as the outline (${JSON.stringify(a3.checked)})`);
    ok(a3.items.platforms.length > 0, `3. pollItems reached the page: platforms held ${JSON.stringify(a3.items.platforms)}`);
    const tracker = await page.evaluate(() => document.body.innerText.match(/Checked: \d+\/\d+/)?.[0] ?? null);
    ok(tracker === `Checked: 1/${allLocs.length}`, `3. the tracker counts it (${tracker})`);
    await page.waitForTimeout(1500);
    await shot('3-checked-outline');

    // 4. receiving the item made the platforms landable
    before = (await botResults()).length;
    ok(await walkTo({ kind: 'location', name: gatedName }), `4. walkTo ${gatedName} again, ${needed} held`);
    await waitFor(`${gatedName} checked in the tracker`, async () => ((await snapshot()).checked.includes(gatedName) ? true : null));
    const r4 = (await botResults()).slice(before);
    ok(r4.some((r) => JSON.stringify(r).includes('reached')), `4. the bot reached it (${JSON.stringify(r4.at(-1))})`);

    // 5. the end door's menu, chosen by keyboard → user:regionMove
    const exits = startRegion.exits.map((e) => e.name.split('__').pop());
    const away = ['north', 'east', 'south', 'west'].find((s) => !exits.includes(`exit_${s[0].toUpperCase()}`));
    const choose = ['east', 'south', 'west', 'north'].find((s) => exits.includes(`exit_${s[0].toUpperCase()}`));
    const target = startRegion.exits.find((e) => e.name.endsWith(`exit_${choose[0].toUpperCase()}`)).connected_region;
    before = (await botResults()).length;
    await game((side) => window.__swfBridge.botWalkTo({ kind: 'portal', id: side }), away);
    const parked = await waitFor('the bot parks at the end door', async () => {
        const r = await botResults();
        return r.length > before ? r[r.length - 1] : null;
    });
    ok(parked.result === 'reached' && (await app()).region === start,
        `5. the bot parked the player at the end door; no ${away} exit, so nothing left (${JSON.stringify(parked)})`);
    await frame().locator('canvas').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await game(() => window.__cloudberryEmbed.rearmDoors());
    await page.keyboard.down('ArrowUp');
    const menu = await waitFor('the exit menu opens on Up', async () => ((await app()).menu ? (await app()).menu : null), 10000)
        .catch(() => null);
    await page.keyboard.up('ArrowUp');
    ok(menu?.door === 'end', `5. Up at the end door opened the exit menu (${JSON.stringify(menu)})`);
    const entries = await game(() => [...document.querySelectorAll('button, [role=button], div')]
        .map((el) => el.textContent).filter((t) => /exit_[NESW]/.test(t ?? '')).slice(-4));
    ok(entries.some((t) => t.includes(`to ${target}`)), `5. the menu labels the exit with its target region (${JSON.stringify(entries.slice(0, 2))})`);
    await page.waitForTimeout(500);
    await shot('5-exit-menu');
    const key = { north: 'ArrowUp', east: 'ArrowRight', south: 'ArrowDown', west: 'ArrowLeft' }[choose];
    await page.keyboard.press(key);
    const moved = await waitFor(`${target} configured after choosing ${choose}`, async () => {
        const a = await app();
        return a?.region === target && a.play?.ok ? a : null;
    }, 120000);
    ok(moved.region === target, `5. → ${choose} sent the exit: user:regionMove → ${target} loaded in the panel`);
    const sent = (await app()).events.filter((e) => e.kind === 'sendExit');
    ok(sent.length === 0 || sent.every((e) => e.door !== 'start'), '5. no start-door exit was sent');
    await page.waitForTimeout(3000);
    await shot('6-next-region');

    const errors = logs.filter((l) => l.startsWith('[pageerror]') && !l.includes('unwind'));
    ok(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
} catch (err) {
    if (!err?.bundledStop) ok(false, `crashed: ${err.stack ?? err}`);
} finally {
    if (browser) await browser.close();
    cleanup();
}
console.log(failures === 0 ? '\nAll cloudberry embed assertions passed.' : `\n${failures} assertion(s) FAILED.`);
console.log(totalLine(failures));
process.exit(failures === 0 ? 0 : 1);
