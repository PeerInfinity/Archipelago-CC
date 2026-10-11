#!/usr/bin/env node
/**
 * Seedling CROSS-ROOM BUTTON WRITE, THE GAME'S WAY (rules `rules-l38-button-event`, W0). A `ButtonRoom` whose
 * `room >= 0` writes `Game.setPersistence(t, persist, room)` (`ButtonRoom.as:93`): its TSET, as a tag, in ANOTHER
 * level, `persist = !flip`. The rules are about to export the L38 → L39 one as a `game_state` event keyed on the
 * TARGET's flag `{room, t}`, and the JS collector reads events off the game's `persistence_cleared`, so this asks
 * the wasm game, for every such button in `seedling-map.json` (read there, never listed by hand):
 *
 *   PRESS  booted ON the button (the game presses it on contact, `ButtonRoom.update`), idle: the game WRITES
 *          `{room, t}` into `persistence_cleared` when the write clears (`flip`), the store the collector reads;
 *   BUILT  for a target entity that is SOLID in one of its two states — a `Lock`-family entity (`Lock.check()`
 *          removes it when `tag >= 0 && tSet < 0 && !checkPersistence(tag)`) or a `FallRock` (`FallRock.as:42-45`
 *          builds it FALLEN, type "Solid", when its tag is cleared) — booted at every door landing into the
 *          target's level that stands on the target's column within two tiles, holding TOWARD it: once with
 *          exactly the flags PRESS read back from the game staged as persistence, once BARE (no flag). A lock is
 *          built gone with the flag (the player passes) and standing without it (stopped); a fall rock the other
 *          way round.
 *
 * Every tape runs on a FRESH page (a reused page keeps the previous build's entities: `botStart`'s reuse path,
 * seedling-bot.md "Consecutive boots on one page").
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-cross-room-button.mjs [--host=http://localhost:8000] [--ticks=240]
 *      [--only=38] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TILE = 16;
/** The classes `Lock.check()`'s persistence guard removes (`Lock` and its subclasses that keep `check()`). */
const LOCK_CLASSES = new Set(['lock', 'wandlock', 'grasslock']);
const DOOR_TYPES = new Set(['teleporter', 'stairsup', 'stairsdown']);

/**
 * Every cross-room `ButtonRoom` of a map extract and what its write reaches: `{presser: {level, x, y, t, tag, flip,
 * room}, write: {level, tag, value}, targets: [{level, type, x, y, tset, tag}]}`. `value` is the persistence the
 * press writes (`!flip`): false = CLEARED, the only value `persistence_cleared` can show.
 */
export function crossRoomButtonsOf(map) {
    const levelOf = (n) => map.levels.find((l) => l.level === n);
    return map.levels.flatMap((l) => (l.entities ?? []).filter((e) => e.type === 'buttonroom'
        && Number.isInteger(Number(e.attrs?.room)) && Number(e.attrs.room) >= 0).map((e) => {
        const room = Number(e.attrs.room);
        const t = Number(e.attrs.tset);
        return {
            presser: { level: l.level, x: e.x, y: e.y, t, tag: Number(e.attrs.tag), flip: Number(e.attrs.flip) === 1, room },
            write: { level: room, tag: t, value: Number(e.attrs.flip) !== 1 },
            targets: (levelOf(room)?.entities ?? []).filter((x) => Number(x.attrs?.tag) === t).map((x) => ({
                level: room, type: x.type, x: x.x, y: x.y, tset: Number(x.attrs?.tset), tag: t,
            })),
        };
    }));
}

/** How a target's SOLIDITY answers its flag: `'opens'` (a cleared tag removes it), `'closes'` (adds it), or null. */
export function flagEffect(target) {
    if (LOCK_CLASSES.has(target.type) && target.tset < 0) return 'opens';
    if (target.type === 'fallrock') return 'closes';
    return null;
}

/** Door landings into `level` on the target's column, within two tiles: `{from, door, x, y, dir}`. */
export function landingsToward(map, target) {
    return map.levels.flatMap((l) => (l.entities ?? []).filter((e) => DOOR_TYPES.has(e.type)
        && Number(e.attrs?.to) === target.level).map((e) => ({
        from: l.level, door: `${e.type}@${e.x},${e.y}`, x: Number(e.attrs.playerx), y: Number(e.attrs.playery),
    }))).filter((d) => d.x === target.x && d.y !== target.y && Math.abs(d.y - target.y) <= 2 * TILE)
        .map((d) => ({ ...d, dir: d.y > target.y ? 'up' : 'down' }));
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '240'));
    const only = arg('only', '') ? new Set(arg('only', '').split(',').map(Number)) : null;
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const buttons = crossRoomButtonsOf(MAP).filter((b) => !only || only.has(b.presser.level));
    console.log(`PAGE: ${PAGE} · ${buttons.length} cross-room button(s)`);

    takeBoxLockOrExit({ name: 'probe-seedling-cross-room-button.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const tapeOf = (name, level, boot, inputs, persistence) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-cross-room-button',
        boot: { level, ...boot }, noclip: false, noDamage: true, noHazards: [],
        grants: [], persistence, equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: {}, tick_count: TICKS,
        inputs: inputs ? [{ key: inputs, from: 0, to: TICKS }] : [],
    });

    // ⛔ EVERY TAPE ON A FRESH PAGE: nothing a tape leaves on a page (statics, the save object) can reach the next.
    const logs = [];
    const run = async (tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            // ⛓ the logic-only channel, PROVED before anything is measured (`seedlingChannel.js`)
            await assertLogicOnlyChannel(page);
            if (await bot('botLoadTape', JSON.stringify(tape)) !== 'ok') throw new Error(`botLoadTape ${tape.name}`);
            if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name}`);
            for (const deadline = Date.now() + 10 * 60 * 1000; ;) {
                const st = await botJson('botStatus');
                if (st.finished) break;
                if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                await page.waitForTimeout(500);
            }
            const drained = await botJson('botDrain');
            return { ticks: drained.ticks ?? [], cleared: (await botJson('botStatus')).persistence_cleared ?? [] };
        } finally {
            await page.close();
        }
    };
    try {
        const same = (c, f) => Number(c.level) === f.level && Number(c.tag) === f.tag;
        for (const b of buttons) {
            const p = b.presser;
            const id = `L${p.level} buttonroom@${p.x},${p.y} -> {${b.write.level},${b.write.tag}} (flip ${Number(p.flip)})`;
            const press = await run(tapeOf(`l${p.level}-btn-${p.x}-${p.y}-press`, p.level, { x: p.x, y: p.y }, null, []));
            const wrote = press.cleared.some((c) => same(c, b.write));
            const written = press.cleared.filter((c) => same(c, b.write)).map((c) => ({ level: Number(c.level), tag: Number(c.tag) }));
            const row = { button: id, targets: b.targets, cleared: press.cleared, built: [] };
            check(`${id}: PRESS ${b.write.value ? 'sets' : 'CLEARS'} {${b.write.level},${b.write.tag}} — `
                + `${b.write.value ? 'absent from' : 'written to'} persistence_cleared`, b.write.value ? !wrote : wrote,
                JSON.stringify(press.cleared));
            for (const t of b.targets) {
                const effect = flagEffect(t);
                if (!effect || b.write.value) continue;
                for (const L of landingsToward(MAP, t)) {
                    const ys = (r) => r.ticks.filter((o) => o.level === t.level).map((o) => o.y);
                    const flagged = ys(await run(tapeOf(`l${t.level}-${t.type}-flag`, t.level, { x: L.x, y: L.y }, L.dir, written)));
                    const bare = ys(await run(tapeOf(`l${t.level}-${t.type}-bare`, t.level, { x: L.x, y: L.y }, L.dir, [])));
                    // past the target = its far edge crossed in the direction held
                    const past = (y) => (L.dir === 'up' ? Math.min(...y) < t.y : Math.max(...y) > t.y + TILE);
                    const arm = { target: `${t.type}@${t.x},${t.y}`, landing: L, effect,
                        flagged: { y0: flagged[0], min: Math.min(...flagged), max: Math.max(...flagged) },
                        bare: { y0: bare[0], min: Math.min(...bare), max: Math.max(...bare) } };
                    row.built.push(arm);
                    const label = `${id}: BUILT ${t.type}@${t.x},${t.y} from L${L.from} ${L.door}'s landing (${L.x},${L.y}), holding ${L.dir}`;
                    if (effect === 'opens') {
                        check(`${label} — with the game-written flag the player passes it; BARE it stands`,
                            flagged.length > 0 && past(flagged) && !past(bare), JSON.stringify(arm));
                    } else {
                        check(`${label} — with the game-written flag it is FALLEN (stopped); BARE the player passes`,
                            flagged.length > 0 && !past(flagged) && past(bare), JSON.stringify(arm));
                    }
                }
            }
            console.log(`ROW ${JSON.stringify(row)}`);
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
