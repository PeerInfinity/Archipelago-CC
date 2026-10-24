#!/usr/bin/env node
/**
 * Seedling SEAL DELIVERY — an AP Seal reaches the game's seal slots, and every other AP item is asked of the game
 * too (the census). `seedling_playthrough` loaded by `?rules=`, headless logic-only, under the box lock; every
 * session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game stands in the start region (the AP load finished);
 *     2. THE CENSUS: every `ap_items` row of games/seedling.json is granted through the AP inventory
 *        (`stateManagerProxy.addItemToInventory`, a progressive / fill item as many times as it has rungs /
 *        slots), and the game's OWN readout each should set is read back (`readState`: the item flags,
 *        `hitsMax`, `keyMask`, `totemCount`, the per-slot `sealSlot<i>` / `totemPart<i>` path reads; W also
 *        `botStatus.save`). One `ROW <S> census` line per AP item: `{item, copies, reaches, readout, set}`.
 *        `Nothing` is the one row that reaches nothing by design;
 *     3. THE SEALS: the sixteen AP Seals fill the game's seal LOG — sixteen distinct identities, its LAST slot
 *        filled (`SealController.hasAllSealParts()`, the FinalDoor's predicate); W: `botStatus.save.seal_parts`
 *        and `has_all_seal_parts`; J: the readouts and the booted run's `saveState.bootSealParts`;
 *     4. W only — THE FINALDOOR (the user's witness): the player is put three tiles under `finaldoor@112,0` in
 *        L113, inside its 32 px circle (`new Game(113, 112, 32)`, the circle `r6-final-door` crosses at t36).
 *        CONTROL first, the Watcher NOT talked to: the seal ceremony runs and the door stays (`{113,0}` not
 *        cleared). Then `{114,0}` is STAGED by the probe (`Game.setPersistence(0, false, 114)` — the Watcher's
 *        talk is the rules arc's cross-room prerequisite, not this slice's) and the player re-placed: the door
 *        OPENS on the seals AP delivered (`{113,0}` in `persistence_cleared`). J: the page has no host verb for
 *        a persistence slot, so the door row is SKIPPED by name (its seals are rows 3).
 *
 *   A  (wasm, `seedling_atlas` — the ATLAS arm, whose rooms stand UNREWRITTEN, so `Starting House - Chest` is a
 *      real `Chest`): the game's sixteen slots are written directly (the setter, as the adapter would), and the
 *      player enters L86: `Chest.checkBySeal` removes the unopened chest, and its AP location is CHECKED. ⚖ The
 *      user (2026-10-16): *"for now let's have deleting the chests automatically award the location checks for
 *      them"* — this row is that ruling's PIN. CONTROL first: before the jump the location is NOT checked (the
 *      16 seals alone check nothing). Then, after the jump (`ROW A checkBySeal`): the chest's flag `{86,0}` is
 *      cleared, the game reported `pendingCheck "<seq>|86|0|0"`, and the check binding marked
 *      `Starting House - Chest` checked. A binding that stops firing on the removal is RED here.
 *      (`--control` does not touch A: the auto-check held on the base tree too.)
 *
 * `--control`: the base tree's expectation — no Seal / Totem Shard reaches the game, and the door stays shut
 * WITH the Watcher staged. Without it, the delivery rows are asserted.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W/A SKIP.
 *
 * Run: node scripts/procgen/probe-seedling-seal-delivery.mjs [--host=http://localhost:8000] [--only=W,J,A]
 *      [--control] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } from './seedlingRoomPlay.js';
import { bootRetriesLine, isBootFault, startWasmGame, withBootRetry } from './seedlingProbeBoot.js';

argvHelp(import.meta.url);

/** The presets, by their rules files (served paths relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
export const ATLAS_RULES_PATH = './presets/seedling_atlas/AP_1/AP_1_rules.json';
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';
/** `finaldoor@112,0` in L113: three tiles under it is inside its 32 px circle (`r6-final-door`, t36); (112,80) is outside. */
export const DOOR = Object.freeze({ level: 113, tag: 0, inside: { x: 112, y: 32 }, outside: { x: 112, y: 80 } });
/** The Watcher's dialogue slot `FinalDoor.update` reads (`watcher_text` = vanilla 114, tag 0). */
export const WATCHER = Object.freeze({ level: 114, tag: 0 });
/** ms to wait out the seal ceremony (181 dead frames) + the open animation (56) at the logic-only frame rate. */
const DOOR_WAIT_MS = 30000;

/**
 * The game readout each AP item should set, from its games/seedling.json def (`flash` = its flash name).
 * `copies` = how many grants reach every rung / slot. Derived, not listed: a new item def is a new row.
 */
export function censusPlan(cfg) {
    const defOf = (f) => cfg.items.find((d) => d.flash_name === f);
    const rows = [];
    for (const it of cfg.ap_items) {
        const f = it.flash_name;
        const def = defOf(f);
        const chain = cfg.progressive_items?.[f];
        const fusion = (cfg.fusion_items ?? []).find((x) => (x.requires_flags ?? []).includes(f));
        if (def?.fill) {
            rows.push({ item: it.ap_name, flash: f, copies: def.fill.slots, reaches: `fill ${def.fill.rule} → ${def.method}`,
                readouts: Array.from({ length: def.fill.slots }, (_, i) => ({ read: `${def.fill.observed}${i}`, empty: def.fill.empty })) });
        } else if (chain) {
            rows.push({ item: it.ap_name, flash: f, copies: chain.length, reaches: `progressive → ${chain.join(', ')}`,
                readouts: chain.map((r) => (defOf(r)?.property ? { read: defOf(r).property, want: defOf(r).value } : { read: null, rung: r })) });
        } else if (fusion) {
            const r = defOf(fusion.result);
            rows.push({ item: it.ap_name, flash: f, copies: 1, reaches: `fusion → ${fusion.result}`, readouts: [{ read: r?.property ?? null, want: r?.value }] });
        } else if (def?.method) {
            rows.push({ item: it.ap_name, flash: f, copies: 1, reaches: `method → ${def.method}(${def.args})`,
                readouts: [{ read: def.observed.property, bit: def.observed.bit }] });
        } else if (def?.op === 'add') {
            rows.push({ item: it.ap_name, flash: f, copies: 1, reaches: `ui add → ${def.property}`, readouts: [{ read: def.property, want: (def.base ?? 0) + (def.value ?? 1) }] });
        } else if (def?.property) {
            rows.push({ item: it.ap_name, flash: f, copies: 1, reaches: `path → ${def.property}`, readouts: [{ read: def.property, want: def.value }] });
        } else {
            rows.push({ item: it.ap_name, flash: f, copies: 1, reaches: 'NOTHING', readouts: [] });
        }
    }
    return rows;
}

/** Is one readout set in `state`? (`empty` = a slot read; `bit` = a mask; `want` = a value.) */
export function readoutSet(r, state) {
    if (!r.read) return false;
    const v = state[r.read];
    if (v === undefined || v === null) return false;
    if ('empty' in r) return v !== r.empty && v !== false && v !== -1;
    if ('bit' in r) return ((Number(v) >> r.bit) & 1) === 1;
    return v === r.want;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-seal-delivery.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J,A').split(',').filter(Boolean);
    const CONTROL = process.argv.includes('--control');
    const CFG = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
    const PLAN = censusPlan(CFG);
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        if ((S === 'W' || S === 'A') && !haveWasm) { console.log(`SKIP: ${S} — seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`); continue; }
        console.log(`INFO: ── session ${S} (a fresh page)${CONTROL ? ' — CONTROL' : ''} ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await withBootRetry(S, () => (S === 'A' ? runAtlas() : runSession(S)));
    }
    await browser.close();
    console.log(bootRetriesLine());
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function openPage(S, rulesPath) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: S === 'J' ? JS_PAGE : WASM_PAGE, logs, name: `seal-${S}` });
        // ⛓ A known boot fault closes this page and re-boots the session once (seedlingProbeBoot.js); anything else is the session's.
        try {
            await bootPage(S, page, rp, logs, rulesPath);
        } catch (e) {
            if (isBootFault(e)) { await page.close(); throw e; }
            throw e;
        }
        return { page, logs, rp };
    }

    async function bootPage(S, page, rp, logs, rulesPath) {
        await page.goto(`${HOST}/frontend/?rules=${rulesPath}`, { waitUntil: 'domcontentloaded' });
        await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
        await rp.installWatchers();
        if (S === 'J') {
            await page.evaluate(async () => {
                const sm = (await import('./app/core/settingsManager.js')).default;
                await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
            });
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('JS runtime iframe mounted', async () => page.frames().some((fr) => fr.url().includes(JS_PAGE)), 60000);
        } else {
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            await startWasmGame(() => rp.gameFrame(), { logs });
            await assertLogicOnlyChannel(rp.gameFrame());
        }
        await rp.waitForApLoad(180000);
    }

    /** Every readout a row compares, in one page round trip (either runtime). */
    function snapOf(page) { return () => page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        const p = mod.getActivePanelInstance();
        const g = mod.getSeedlingRegionGlue();
        const game = g?.adapter?._getFlash?.() ?? null;
        const parse = (f) => { try { const raw = f(); return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; } };
        const st = parse(() => game?.botStatus?.());
        const rs = parse(() => game?.readState?.()) ?? {};
        const run = p?.seedlingPlaybackSurface?.()?.jsRuntime?.run ?? null;
        const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
        const snap = proxy.getLatestStateSnapshot?.() ?? {};
        const checked = snap.checkedLocations instanceof Set ? [...snap.checkedLocations] : (snap.checkedLocations ?? []);
        return {
            region: g?.binding?.region ?? null,
            level: st?.level ?? rs.level ?? null,
            state: rs,
            save: st?.save ?? null,
            cleared: st?.persistence_cleared ?? null,
            jsBootSeals: run?.saveState?.bootSealParts ?? null,
            ap: Object.fromEntries(Object.entries(snap.inventory ?? {}).filter(([, v]) => v > 0)),
            checked,
        };
    }); }

    async function grant(page, item, copies) {
        await page.evaluate(async ({ name, n }) => {
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            for (let i = 0; i < n; i += 1) await proxy.addItemToInventory(name);
        }, { name: item, n: copies });
    }

    async function runSession(S) {
        let rp;
        let logs = [];
        try {
            const opened = await openPage(S, RULES_PATH);
            rp = opened.rp;
            logs = opened.logs;
            const { page } = opened;
            const { check, waitFor } = rp;
            const snap = snapOf(page);
            const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

            // 1. THE NEW GAME.
            const born = await waitFor('the new game stands in the start region', async () => {
                const s = await snap();
                return s.region === START && s.level === 0 ? s : null;
            }, 60000);
            check(`${S}: the new game stands in the start region "${START}"`, !!born);
            await page.waitForTimeout(1500);

            // 2. THE CENSUS — every AP item, as many copies as it has rungs / slots.
            for (const row of PLAN) {
                // eslint-disable-next-line no-await-in-loop
                await grant(page, row.item, row.copies);
            }
            await waitFor('every grant in the AP inventory', async () => {
                const s = await snap();
                return PLAN.every((r) => (s.ap[r.item] ?? 0) >= r.copies) ? s : null;
            }, 30000);
            // Settle: the writes land on the next queue ticks; a fill writes slot by slot as its readouts echo.
            let s = null;
            const deadline = Date.now() + 20000;
            for (;;) {
                // eslint-disable-next-line no-await-in-loop
                s = await snap();
                const allSet = PLAN.every((r) => r.reaches === 'NOTHING' || r.readouts.every((x) => readoutSet(x, s.state)));
                if (allSet || Date.now() > deadline) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            await page.waitForTimeout(1500);
            s = await snap();
            for (const row of PLAN) {
                const got = row.readouts.map((x) => ({ read: x.read ?? `(rung ${x.rung}: no def)`, value: x.read ? s.state[x.read] ?? null : null, set: readoutSet(x, s.state) }));
                const set = row.readouts.length > 0 && got.every((g) => g.set);
                out('census', { item: row.item, flash: row.flash, copies: row.copies, reaches: row.reaches, set, readout: got.length > 4 ? `${got.filter((g) => g.set).length}/${got.length} slot(s) set` : got });
                if (row.reaches === 'NOTHING') {
                    check(`${S}: census — "${row.item}" reaches nothing, by design (\`${row.flash}\` has no def)`, row.flash === '!nothing');
                } else if (CONTROL && (row.flash === '!seal' || row.flash === '!totem')) {
                    check(`${S}: CONTROL census — "${row.item}" does NOT reach the game (the brief's defect)`, !set, JSON.stringify(got.slice(0, 3)));
                } else {
                    check(`${S}: census — "${row.item}" ×${row.copies} sets the game's readout (${row.reaches})`, set,
                        JSON.stringify(got.filter((g) => !g.set).slice(0, 4)));
                }
            }

            // 3. THE SEALS.
            const log = Array.from({ length: 16 }, (_, i) => s.state[`sealSlot${i}`]);
            const filled = log.filter((v) => Number.isInteger(v) && v !== -1);
            out('seals', { log, wasmSave: s.save?.seal_parts ?? null, hasAll: s.save?.has_all_seal_parts ?? null, jsBootSeals: s.jsBootSeals, apSeals: s.ap.Seal ?? 0 });
            if (CONTROL) {
                check(`${S}: CONTROL — the AP holds 16 Seals and the game's seal log is EMPTY`, (s.ap.Seal ?? 0) === 16 && filled.length === 0, JSON.stringify(log));
            } else {
                check(`${S}: the 16 AP Seals fill the game's seal LOG — 16 distinct identities, the LAST slot filled`,
                    filled.length === 16 && new Set(filled).size === 16 && log[15] !== -1, JSON.stringify(log));
                if (S === 'W') {
                    check('W: botStatus agrees — save.seal_parts is that log and has_all_seal_parts is true',
                        JSON.stringify(s.save?.seal_parts) === JSON.stringify(log) && s.save?.has_all_seal_parts === true, JSON.stringify(s.save));
                } else {
                    check('J: the booted run holds the 16 (saveState.bootSealParts — what the model reads)',
                        Array.isArray(s.jsBootSeals) && s.jsBootSeals.length === 16, JSON.stringify(s.jsBootSeals));
                }
            }

            // 4. THE FINALDOOR.
            if (S === 'J') {
                console.log('SKIP: J — the FinalDoor row: the JS page has no host verb for a persistence slot, so the Watcher\'s {114,0} '
                    + 'cannot be staged here (the rules arc\'s cross-room prerequisite); its seals are the rows above');
            } else {
                const doorCleared = (x) => (x.cleared ?? []).some((c) => c.level === DOOR.level && c.tag === DOOR.tag);
                const atDoor = async (why) => {
                    await rp.jumpSettled(DOOR.level, DOOR.outside.x, DOOR.outside.y);
                    await rp.jump(DOOR.level, DOOR.inside.x, DOOR.inside.y);
                    await waitFor(`the player under the door (${why})`, async () => {
                        const g = await rp.readGameState();
                        return g.level === DOOR.level && g.playerPositionY === DOOR.inside.y ? 'there' : null;
                    }, 15000);
                };
                await atDoor('control: the Watcher not talked to');
                await page.waitForTimeout(DOOR_WAIT_MS);
                const ctl = await snap();
                out('door control', { level: ctl.level, doorCleared: doorCleared(ctl), watcher: (ctl.cleared ?? []).filter((c) => c.level === WATCHER.level) });
                check('W: CONTROL — without the Watcher\'s {114,0}, the seal ceremony runs and the FinalDoor STAYS ({113,0} not cleared)',
                    ctl.level === DOOR.level && !doorCleared(ctl), JSON.stringify(ctl.cleared));
                // Stage the Watcher's talk (the probe's staging, as fidelity's tapes declare it).
                await rp.gameFrame().evaluate((w) => window.__swfBridge.queueItems([{ invocation: 'method_call', path: [{ class: 'Game' }],
                    method: 'setPersistence', args: [w.tag, false, w.level] }]), WATCHER);
                await waitFor('the Watcher\'s {114,0} staged', async () => ((await snap()).cleared ?? []).some((c) => c.level === WATCHER.level && c.tag === WATCHER.tag) ? 'staged' : null, 10000);
                await atDoor('the Watcher staged');
                let opened = null;
                const until = Date.now() + DOOR_WAIT_MS;
                while (!opened && Date.now() < until) {
                    // eslint-disable-next-line no-await-in-loop
                    const x = await snap();
                    if (doorCleared(x)) opened = x;
                    // eslint-disable-next-line no-await-in-loop
                    else await page.waitForTimeout(500);
                }
                const last = opened ?? await snap();
                out('door', { opened: !!opened, level: last.level, seals: last.save?.seal_parts ?? null, cleared: last.cleared });
                if (CONTROL) {
                    check('W: CONTROL — with the Watcher staged and NO seal in the game, the FinalDoor stays shut', !opened, JSON.stringify(last.cleared));
                } else {
                    check('W: WITNESS — with the 16 AP Seals and the Watcher staged, the FinalDoor at L113 OPENS in the game ({113,0} cleared)',
                        !!opened, JSON.stringify({ seals: last.save?.seal_parts, cleared: last.cleared }));
                }
            }
            const errs = logs.filter((l) => l.startsWith('[pageerror]'));
            console.log(`INFO: ${errs.length} page error(s)${errs.length ? `: ${errs.map((l) => l.slice(0, 160)).join(' | ')}` : ''}`);
            await page.close();
        } catch (e) {
            if (isBootFault(e)) throw e;
            (rp?.check ?? ((l, ok) => console.log(`${ok ? 'PASS' : 'FAIL'}: ${l}`)))(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
            if (!rp) return 1;
        }
        return rp.failures();
    }

    /** A — the atlas arm's real Chest under 16 seals (`Chest.checkBySeal`): the removal AWARDS its check (⚖ the pin). */
    async function runAtlas() {
        let rp;
        let logs = [];
        try {
            const opened = await openPage('A', ATLAS_RULES_PATH);
            rp = opened.rp;
            logs = opened.logs;
            const { page } = opened;
            const snap = snapOf(page);
            const out = (tag, o) => console.log(`ROW A ${tag} ${JSON.stringify(o)}`);
            await page.waitForTimeout(3000);
            const before = await snap();
            const CHEST = 'Starting House - Chest';
            out('before', { level: before.level, checked: before.checked, seals: before.save?.seal_parts });
            rp.check(`A: CONTROL — before the jump "${CHEST}" is NOT checked`, !before.checked.includes(CHEST), JSON.stringify(before.checked));
            // The game's sixteen slots, written as the adapter writes a seal (no AP grant: the atlas preset holds one Seal).
            await rp.gameFrame().evaluate(() => window.__swfBridge.queueItems(Array.from({ length: 16 }, (_, i) => ({
                invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [i, i] }))));
            await rp.waitFor('the game holds 16 seals', async () => ((await snap()).save?.has_all_seal_parts === true ? 'yes' : null), 10000);
            const mid = await snap();
            rp.check(`A: CONTROL — 16 seals in the game, still outside L86: "${CHEST}" is NOT checked`, !mid.checked.includes(CHEST),
                JSON.stringify({ level: mid.level, checked: mid.checked }));
            const jumped = await rp.jumpSettled(86, 48, 64);
            let after = null;
            const until = Date.now() + 15000;
            for (;;) {
                // eslint-disable-next-line no-await-in-loop
                after = await snap();
                if (after.checked.includes(CHEST) || Date.now() > until) break;
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            const chestCleared = (after.cleared ?? []).some((c) => c.level === 86 && c.tag === 0);
            const pending = String(after.state.pendingCheck ?? '');
            out('checkBySeal', { jumped, level: after.level, chestFlagCleared: chestCleared, locationChecked: after.checked.includes(CHEST),
                pendingCheck: after.state.pendingCheck ?? null, checked: after.checked });
            rp.check('A: 16 seals in the game, the player in L86', after.level === 86, JSON.stringify(jumped));
            rp.check('A: Chest.checkBySeal REMOVED the unopened chest — its flag {86,0} is cleared', chestCleared, JSON.stringify(after.cleared));
            rp.check('A: the game REPORTED the removal — pendingCheck "<seq>|86|0|0"', /^\d+\|86\|0\|0$/.test(pending), JSON.stringify(pending));
            rp.check(`A: ⚖ the removal AWARDS the check — the binding marked "${CHEST}" checked`, after.checked.includes(CHEST),
                JSON.stringify(after.checked));
            await page.close();
        } catch (e) {
            if (isBootFault(e)) throw e;
            (rp?.check ?? ((l, ok) => console.log(`${ok ? 'PASS' : 'FAIL'}: ${l}`)))(`A: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
            if (!rp) return 1;
        }
        return rp.failures();
    }
}
