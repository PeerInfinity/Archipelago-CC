#!/usr/bin/env node
/**
 * seedling-live-server.mjs — a Seedling Playthrough room on a REAL upstream
 * Archipelago server, played by the app's Playback Bot. ⚠ A SCAFFOLD.
 *
 * Usage:
 *   node scripts/test/seedling-live-server.mjs --upstream=<AP checkout> [--seed=2] [--budget-s=120]
 *        [--port=<dev server port>] [--ws-port=<free port>] [--runtime=js|wasm] [--with-apquest]
 *        [--python=python] [--wait-for-box=<sec>] [--keep]
 *
 *   From the tree root, the venv active, a dev server serving THIS tree on --port
 *   (default TEST_PORT, else 8000). --upstream (or AP_UPSTREAM) is an upstream
 *   Archipelago checkout (0.6.9 was the measured one); it is not vendored here.
 *
 * What it does, in order, and what it undoes:
 *   1. PACK   `seedling_playthrough` with scripts/build/pack_apworld.py into a temp dir, and take
 *             apworlds/spoiler_export_hook.apworld as committed. Both go into <upstream>/custom_worlds/;
 *             a file already there under that name is moved aside and PUT BACK at the end.
 *   2. GEN    upstream `Generate.py --player_files_path <tmp>/players --seed N --outputpath <tmp>/out`:
 *             Sprout (Seedling Playthrough, spoiler_data_in_slot_data: own_slot) alone, or with Questy
 *             (APQuest) at slot 2 under --with-apquest.
 *   3. SERVE  upstream `MultiServer.py --disable_save --port <ws-port> <room zip>`; its PID is recorded.
 *   4. PLAY   headless Chromium on the app, with no local preset for the game (the server's own doc is
 *             what loads), the Flash runtime set to --runtime for the session, connected as Sprout; then
 *             the Playback Bot's play() for --budget-s.
 *   5. PRINT  one line: checks the client SENT (LocationChecks frames) / the room's locations, the
 *             server's "has completed their goal" (or not), and how the run ended.
 *   6. STOP   the browser, then the server BY ITS PID (no pattern kill), the custom_worlds files put back,
 *             the temp dir deleted unless --keep.
 *
 * Exit: 0 when the client connected and sent at least one check; 1 when it did not; 2 for a setup
 * failure (no upstream, pack/generate failed, the server never listened).
 *
 * ⚠ WHAT IT CANNOT DO YET (the scaffold's limits; the real passes wait for the playthrough):
 *   - It does not grade a full play: the goal is reported, never required. A full play is ~50 min on
 *     wasm (see walk-seedling-whole-game.mjs) and parks earlier today (the bot's own walls).
 *   - Foreign items: with --with-apquest nobody plays Questy, so Sprout's items in Questy's world never
 *     arrive. The probes sent them from a second in-page socket; that is not wired here.
 *   - It is not a CI job and is not in any batch (no new per-push check).
 *   - One room per run; no reconnect, no release/collect modes, no slot ≥ 2 for Sprout.
 *
 * Docs: docs/json/developer/procgen/seedling-bot.md § Live-server test (scaffold).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { takeBoxLock, releaseBoxLock } from '../procgen/boxLock.js';
import { waitForClientReady, waitForSyncFunction } from '../procgen/clientReady.js';
import { resolveTestPort } from './testServer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME = 'Seedling Playthrough';
const PRESET_KEY = 'seedling_playthrough';
const SLOT = 'Sprout';
const APWORLDS = ['seedling_playthrough.apworld', 'spoiler_export_hook.apworld'];

export function parseArgs(argv, env = process.env) {
    const o = { upstream: env.AP_UPSTREAM || null, seed: 2, budgetS: 120, port: null, wsPort: null, runtime: 'js', withApquest: false, python: 'python', waitForBox: 0, keep: false };
    for (const a of argv) {
        const eq = a.indexOf('=');
        const k = eq === -1 ? a : a.slice(0, eq);
        const v = eq === -1 ? undefined : a.slice(eq + 1);
        const int = () => { if (!/^\d+$/.test(v ?? '')) throw new Error(`${k} takes a whole number, got ${v}`); return Number(v); };
        switch (k) {
            case '--upstream': o.upstream = v; break;
            case '--seed': o.seed = int(); break;
            case '--budget-s': o.budgetS = int(); break;
            case '--port': o.port = int(); break;
            case '--ws-port': o.wsPort = int(); break;
            case '--runtime': if (!['js', 'wasm'].includes(v)) throw new Error('--runtime is js or wasm'); o.runtime = v; break;
            case '--with-apquest': o.withApquest = true; break;
            case '--python': o.python = v; break;
            case '--wait-for-box': o.waitForBox = int(); break;
            case '--keep': o.keep = true; break;
            case '--help': o.help = true; break;
            default: throw new Error(`unknown argument ${a}`);
        }
    }
    return o;
}

/** The upstream checkout, or a clear refusal (it is not vendored in this repo). */
export function checkUpstream(dir) {
    if (!dir) {
        throw new Error('no upstream Archipelago checkout: pass --upstream=<dir> or set AP_UPSTREAM. It is not vendored here; '
            + 'one way: `git worktree add --detach ~/CC/ap-upstream-seedling <upstream/main commit>` from a clone of '
            + 'ArchipelagoMW/Archipelago (0.6.9 was the measured one).');
    }
    const abs = path.resolve(dir);
    for (const f of ['MultiServer.py', 'Generate.py']) {
        if (!fs.existsSync(path.join(abs, f))) throw new Error(`--upstream ${abs} is not an Archipelago checkout: no ${f}`);
    }
    if (path.resolve(abs) === ROOT) throw new Error('--upstream is this tree; it must be an UPSTREAM checkout (the server under test is upstream\'s)');
    return abs;
}

export function playerYamls({ withApquest }) {
    const files = { '1_seedling.yaml': `name: ${SLOT}\ngame: ${GAME}\n${GAME}:\n  spoiler_data_in_slot_data: own_slot\n` };
    if (withApquest) files['2_quest.yaml'] = 'name: Questy\ngame: APQuest\nAPQuest: {}\n';
    return files;
}

/** What the wire says, from the frames the page's socket sent and received. */
export function wireSummary(frames) {
    const sent = new Set();
    let goal = false;
    let connected = null;
    let refused = null;
    for (const f of frames) {
        if (f.dir === '>' && f.cmd === 'LocationChecks') for (const id of f.locations ?? []) sent.add(id);
        if (f.dir === '<' && f.cmd === 'PrintJSON' && /\bhas completed their goal\b/.test(f.text ?? '') && (f.text ?? '').startsWith(SLOT)) goal = true;
        if (f.dir === '<' && f.cmd === 'Connected') connected = { slot: f.slot, missing: f.missing, checked: f.checked };
        if (f.dir === '<' && f.cmd === 'ConnectionRefused') refused = f.errors ?? [];
    }
    return { sent: sent.size, goal, connected, refused };
}

const freePort = () => new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const say = (s) => console.log(`[live] ${s}`);

function run(cmd, args, opts) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status}):\n${(r.stderr || r.stdout || '').slice(-2000)}`);
    return r.stdout;
}

/** Steps 1: pack and install; → the undo. */
function installApworlds(o, up, tmp) {
    const built = path.join(tmp, 'apworlds');
    fs.mkdirSync(built, { recursive: true });
    run(o.python, ['-c', 'import sys; sys.path.insert(0, "scripts/build"); from pack_apworld import pack_apworld; '
        + `sys.exit(0 if pack_apworld("seedling_playthrough", ${JSON.stringify(path.join(built, APWORLDS[0]))}) else 1)`], { cwd: ROOT });
    fs.copyFileSync(path.join(ROOT, 'apworlds', APWORLDS[1]), path.join(built, APWORLDS[1]));
    const dest = path.join(up, 'custom_worlds');
    fs.mkdirSync(dest, { recursive: true });
    const moved = [];
    const added = [];
    for (const f of APWORLDS) {
        const target = path.join(dest, f);
        if (fs.existsSync(target)) {
            const aside = path.join(tmp, `aside-${f}`);
            fs.copyFileSync(target, aside);
            moved.push([aside, target, fs.statSync(target)]);
        } else added.push(target);
        fs.copyFileSync(path.join(built, f), target);
    }
    say(`packed + installed ${APWORLDS.join(', ')} into ${dest} (${moved.length} put aside, to be restored)`);
    return () => {
        for (const [aside, target, st] of moved) { fs.copyFileSync(aside, target); fs.utimesSync(target, st.atime, st.mtime); }
        for (const target of added) fs.rmSync(target, { force: true });
        say(`custom_worlds restored (${moved.length} put back, ${added.length} removed)`);
    };
}

/** Step 2: → the room zip. */
function generate(o, up, tmp) {
    const players = path.join(tmp, 'players');
    const out = path.join(tmp, 'out');
    fs.mkdirSync(players, { recursive: true });
    fs.mkdirSync(out, { recursive: true });
    for (const [n, text] of Object.entries(playerYamls(o))) fs.writeFileSync(path.join(players, n), text);
    const log = run(o.python, ['Generate.py', '--player_files_path', players, '--seed', String(o.seed), '--outputpath', out],
        { cwd: up, env: { ...process.env, SKIP_REQUIREMENTS_UPDATE: '1' } });
    fs.writeFileSync(path.join(tmp, 'generate.log'), log);
    const zip = fs.readdirSync(out).find((f) => /^AP_\d+\.zip$/.test(f));
    if (!zip) throw new Error(`Generate.py wrote no AP_*.zip into ${out}`);
    say(`generated ${zip} (seed ${o.seed}, ${Object.keys(playerYamls(o)).length} player(s))`);
    return path.join(out, zip);
}

/** Step 3: → { pid, stop }. */
async function startServer(o, up, zip, tmp, wsPort) {
    const logPath = path.join(tmp, 'multiserver.log');
    const logFd = fs.openSync(logPath, 'w');
    const child = spawn(o.python, ['MultiServer.py', '--disable_save', '--port', String(wsPort), zip],
        { cwd: up, env: { ...process.env, SKIP_REQUIREMENTS_UPDATE: '1' }, stdio: ['pipe', logFd, logFd] });
    const pid = child.pid;
    say(`MultiServer pid ${pid} on :${wsPort} (log ${logPath})`);
    let exited = null;
    child.on('exit', (c, s) => { exited = { c, s }; });
    const deadline = Date.now() + 120000;
    while (!/server listening on/.test(fs.readFileSync(logPath, 'utf8'))) {
        if (exited) throw new Error(`MultiServer exited (${JSON.stringify(exited)}) before listening:\n${fs.readFileSync(logPath, 'utf8').slice(-2000)}`);
        if (Date.now() > deadline) { process.kill(pid, 'SIGTERM'); throw new Error('MultiServer did not listen within 120 s'); }
        await new Promise((r) => setTimeout(r, 250));
    }
    const stop = async () => {
        if (exited) return;
        process.kill(pid, 'SIGTERM'); // by its own PID, the one spawn() returned
        for (let i = 0; i < 40 && !exited; i++) await new Promise((r) => setTimeout(r, 250));
        if (!exited) process.kill(pid, 'SIGKILL');
        say(`MultiServer pid ${pid} stopped`);
    };
    return { pid, stop, logPath };
}

/** Step 4: the page; → the frames, the console lines and the bot's end state. */
async function play(o, httpPort, wsPort) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...(o.runtime === 'wasm' ? ['--enable-unsafe-webgpu'] : [])] });
    const frames = [];
    const errors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
        page.on('websocket', (ws) => {
            if (!ws.url().includes(`:${wsPort}`)) return;
            const take = (dir) => (f) => {
                let j; try { j = JSON.parse(f.payload); } catch { return; }
                for (const c of j) frames.push({ t: Date.now(), dir, cmd: c.cmd, slot: c.slot, missing: c.missing_locations?.length, checked: c.checked_locations?.length, locations: c.locations, errors: c.errors, text: c.cmd === 'PrintJSON' ? (c.data ?? []).map((d) => d.text).join('') : undefined });
            };
            ws.on('framesent', take('>'));
            ws.on('framereceived', take('<'));
        });
        // No local preset for the game: what loads is the server's own doc (the probe's Path A).
        await page.route('**/presets/preset_files.json', async (route) => {
            const res = await route.fetch();
            const json = await res.json();
            delete json[PRESET_KEY];
            await route.fulfill({ response: res, json });
        });
        await page.goto(`http://localhost:${httpPort}/frontend/index.html`);
        // ⛔ Sync predicates only (clientReady.js, trap 2: an async one resolves at its first poll).
        await waitForClientReady(page);
        await page.evaluate(async ({ runtime, slot, game }) => {
            window.__fpMod = await import('/frontend/modules/flashPanel/index.js');
            window.__bus = (await import('/frontend/app/core/eventBus.js')).default;
            window.__bus.registerPublisher('ui:activatePanel', 'seedling-live-server');
            window.__lines = [];
            window.__bus.subscribe('ui:printToConsole', (d) => window.__lines.push(d.message), 'seedling-live-server');
            const settings = (await import('/frontend/app/core/settingsManager.js')).default;
            await settings.updateSetting('moduleSettings.flashPanel.runtime', runtime, { persist: false });
            const mh = (await import('/frontend/modules/client/core/messageHandler.js')).default;
            mh.clientSlotName = slot;
            mh.chosenGame = game;
        }, { runtime: o.runtime, slot: SLOT, game: GAME });
        await page.evaluate((p) => window.__apSpike.connect(`ws://localhost:${p}`), wsPort);
        const loaded = await page.waitForFunction(() => window.__lines.find((m) => /^Loaded the server-sent /.test(m)) ?? null, null, { timeout: 120000 })
            .then((h) => h.jsonValue()).catch(() => null);
        say(loaded ? `app: ${loaded}` : 'app: no "Loaded the server-sent …" line within 120 s');
        if (!loaded) return { frames, errors, bot: null, loaded: null };
        // The Flash panel's game, then the bot (the order the probes used).
        await page.evaluate(() => window.__bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'seedling-live-server'));
        await waitForSyncFunction(page, () => !!window.__fpMod.getActivePanelInstance?.()?._apLoadResult, undefined, { timeout: 120000 })
            .catch(() => say('flash panel: no AP load result within 120 s'));
        const bot = await page.evaluate(async (budgetMs) => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            window.__bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'seedling-live-server');
            const botMod = await import('/frontend/modules/playbackBot/index.js');
            for (let i = 0; i < 40 && !botMod.getActivePanel()?.getBot?.(); i++) await sleep(250);
            window.__bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'seedling-live-server');
            await sleep(1500);
            const b = botMod.getActivePanel()?.getBot?.();
            if (!b) return { error: 'no Playback Bot' };
            b.refresh?.();
            const t0 = Date.now();
            b.play();
            while (Date.now() - t0 < budgetMs) {
                const s = String(b.getStatus?.() ?? '');
                if (/^error|^finished|blocked/.test(s)) break;
                await sleep(1000);
            }
            const status = b.getStatus?.() ?? null;
            b.stop?.();
            return { ms: Date.now() - t0, status, queue: b._queue?.length ?? null, cursor: b._cursor ?? null, logTail: (b.getLog?.() ?? []).slice(-8) };
        }, o.budgetS * 1000);
        return { frames, errors, bot, loaded };
    } finally {
        await browser.close();
    }
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    if (o.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); return 0; }
    let up;
    try { up = checkUpstream(o.upstream); } catch (e) { console.error(`seedling-live-server: ${e.message}`); return 2; }
    const httpPort = o.port ?? resolveTestPort();
    const wsPort = o.wsPort ?? await freePort();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seedling-live-server-'));
    say(`upstream ${up}; dev server :${httpPort}; MultiServer :${wsPort}; tmp ${tmp}`);
    const undo = [];
    const t0 = Date.now();
    let code = 2;
    try {
        takeBoxLock({ name: `seedling-live-server seed ${o.seed}`, kind: 'own-port', repo: ROOT, waitSec: o.waitForBox });
        undo.push(() => releaseBoxLock());
        undo.push(installApworlds(o, up, tmp));
        const zip = generate(o, up, tmp);
        const server = await startServer(o, up, zip, tmp, wsPort);
        undo.push(server.stop);
        const r = await play(o, httpPort, wsPort);
        const w = wireSummary(r.frames);
        const total = w.connected ? (w.connected.missing ?? 0) + (w.connected.checked ?? 0) : '?';
        const end = r.bot?.status ?? r.bot?.error ?? (r.loaded ? 'no bot' : 'the server doc never loaded');
        console.log(`${w.connected ? `connected as ${SLOT} (slot ${w.connected.slot})` : `NOT connected${w.refused ? ` (refused: ${JSON.stringify(w.refused)})` : ''}`}`
            + `, checks sent ${w.sent}/${total}, goal ${w.goal ? 'COMPLETED' : 'not reached'}, bot after ${r.bot?.ms != null ? (r.bot.ms / 1000).toFixed(0) : '?'} s: ${JSON.stringify(end)}`
            + ` (run ${((Date.now() - t0) / 1000).toFixed(0)} s, ${r.errors.length} page error(s))`);
        fs.writeFileSync(path.join(tmp, 'result.json'), JSON.stringify({ wire: w, bot: r.bot, loaded: r.loaded, errors: r.errors, frames: r.frames }, null, 1));
        code = w.connected && w.sent >= 1 ? 0 : 1;
    } catch (e) {
        console.error(`seedling-live-server: ${e.message}`);
        code = 2;
    } finally {
        for (const u of undo.reverse()) { try { await u(); } catch (e) { console.error(`cleanup: ${e.message}`); } }
        if (o.keep) say(`kept ${tmp}`);
        else fs.rmSync(tmp, { recursive: true, force: true });
    }
    return code;
}

const isMain = process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(2); });
