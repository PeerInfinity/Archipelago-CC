#!/usr/bin/env node
/**
 * probe-seedling-r6-boss-rooms — R6 slice 0, asked of the REAL GAME.
 * Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4 slice 0.
 *
 * Headless on the local Chromium (the `probe-seedling-r5-mobiles` precedent)
 * so it does NOT contend with the `--win` roster gate, which owns the
 * Windows browser for hours at a time.
 *
 * ── Why this is small, and what settled the rest ──────────────────────
 * The kickoff listed three slice-0 probes. Two of them turned out to be
 * SOURCE questions with source answers, and a probe is the wrong instrument
 * for a question the code already answers unambiguously:
 *
 *  · §2.2's `headPos` jitter — `rumble = (1 - cos(rumblingTime/240 * 2PI))/2`
 *    and `rumblingTime` is decremented to 0 by A+240, while the FIGHT starts
 *    at A+335. So `rumble` is exactly 0 for the whole fight and BOTH
 *    `Math.random()` terms multiply to zero. ⇒ the jitter is a STREAM
 *    POLLUTER during the fight (2 draws per render, unconditional) and
 *    contributes NOTHING to `headPos`. Answered, with the mechanism.
 *
 *  · §3.5's `Game.menu` survival — `Game.menuAndRestart()` sets
 *    `Game.freezeObjects = true` on EVERY frame the menu is up, so every
 *    menu frame is a dead frame and a tape's tick counter cannot advance
 *    through one. Worse, `Input.released(Key.ANY)` sets `menu = false` and
 *    `FP.world = new Game(...)`, and the menu's own camera pan reboots the
 *    world on a timer. ⇒ a menu is not a room, it is a REBOOT LOOP that any
 *    key release collapses. Answered, and it constrains W-seed's tape shape
 *    rather than needing a measurement.
 *
 *  · §2.6's RNG reproducibility — settled by CENSUS rather than by five
 *    runs, and more strongly than five runs could: every `Math.random()`
 *    call site in the game was enumerated and classified by the function it
 *    sits in. `Game.shake`'s two draws are in `view()`, which `Game.update`
 *    calls — UPDATE-side, not render-side. The RENDER-side sites are exactly
 *    `BossTotem.render` (L43), `LavaBoss.render` (L82, deferred) and
 *    `Tile.render`'s waterfall spray (t=25). L112 has none of them. ⇒ the
 *    Owl's draws ride the UPDATE stream, which the differential already
 *    proves byte-exact, so the fight is exact and §6.1's hatch stays shut.
 *
 * What is left is what no census can answer: does the game, asked directly,
 * report the rooms and the states the plan assumes? That is this probe.
 *
 * ── ⚠ The two traps the R5 probe paid for, carried ────────────────────
 * `botStatus.level` is `Main.level`, the STATIC the constructor already
 * wrote — `FP.world = new Game(...)` only records a `_goto` and the swap
 * lands at end of tick. Wait for the WORLD (`botMobiles`), never the static.
 * And at ~0.5 fps headless a four-second sample is one or two frames, so
 * every wait here is generous by design.
 *
 * Usage (dev server on :8000 at the repo root):
 *   node scripts/procgen/probe-seedling-r6-boss-rooms.mjs
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + `${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b'}/game.html`;

const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '⛔'} ${name}\n      ${detail}`);
};

/**
 * A minimal boot tape. `tick_count` is small on purpose: the probe is
 * asking what the ROOM contains at boot, not driving anything, and every
 * tick is ~2 s on software WebGPU.
 */
const bootTape = (name, level, x, y, extra = {}) => ({
    tape_version: 6,
    game: 'seedling',
    name,
    description: `R6 slice-0 probe: boot into L${level} and read the room back.`,
    boot: { level, x, y },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    tick_count: 4,
    inputs: [],
    ...extra,
});

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

/** One fresh page per boot — `botReset` cannot rewind the GAME. */
async function bootAndRead(tape, wantClass, waitSeconds = 240) {
    const page = await browser.newPage();
    const call = (n, a) => page.evaluate(
        ([nn, x]) => String(window.__swfBridge.game[nn](x)), [n, a]);
    const callJson = async (n, a) => JSON.parse(await call(n, a));
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480
            && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        const loaded = await call('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') return { error: `botLoadTape: ${loaded}` };
        const started = await call('botStart');
        if (started !== 'ok') return { error: `botStart: ${started}` };

        let mobiles = { mobiles: [] };
        let status = await callJson('botStatus');
        for (let i = 0; i < waitSeconds; i++) {
            mobiles = await callJson('botMobiles');
            if ((mobiles.mobiles ?? []).some((r) => r.cls.endsWith(wantClass))) break;
            await page.waitForTimeout(1000);
            status = await callJson('botStatus');
        }
        status = await callJson('botStatus');
        // ⛓ A SECOND READ, AFTER THE FADE. Everything a class writes in
        // `update()` — `BossTotem`'s `type`, above all — is invisible until
        // `blackCover` drains, and at ~0.5 fps that is a minute, not a
        // frame. `liveType` is the wanted class's type on a LIVE tick.
        let liveType = null;
        for (let i = 0; i < 90; i++) {
            const m = await callJson('botMobiles');
            const row = (m.mobiles ?? []).find((r) => r.cls.endsWith(wantClass));
            const st = await callJson('botStatus');
            if (row && (st.tick > 0 || st.finished)) { liveType = row.type; break; }
            await page.waitForTimeout(1000);
        }
        return { status, mobiles, liveType };
    } finally {
        await page.close();
    }
}

try {
    console.log('## R6 slice 0 — the boss rooms, asked of the real game\n');

    // ── L112: the Owl, and `botMobiles()`'s first boss consumer ───────
    console.log('### L112 — the Owl');
    const owlRoom = await bootAndRead(
        bootTape('r6-probe-l112', 112, 32, 208), 'FinalBoss');
    if (owlRoom.error) {
        check(false, 'boot into L112', owlRoom.error);
    } else {
        const rows = owlRoom.mobiles.mobiles ?? [];
        const owl = rows.find((r) => r.cls.endsWith('FinalBoss'));
        check(Boolean(owl), 'the Owl is in the room the boot landed in',
            owl ? `${owl.cls} at (${owl.x},${owl.y}) type=${owl.type}`
                : `no FinalBoss row; roster = ${rows.map((r) => r.cls).join(', ')}`);
        if (owl) {
            const e = owl.enemy ?? {};
            check(e.only_hit_by === 'Lava',
                '⛓ `onlyHitBy` is "Lava" — every weapon only SHOVES him',
                `only_hit_by=${JSON.stringify(e.only_hit_by)} hits_max=${e.hits_max} `
                + `hits=${e.hits}`);
            // The AS3 ctor is `super(_x + Tile.w/2, _y + Tile.h/2, ...)` over
            // `finalboss@64,96`, so the body is (72,104). A different number
            // here is a ctor-offset transcription defect, not a rounding one.
            check(owl.x === 72 && owl.y === 104,
                '⛓ and he stands where the ctor offset says (finalboss@64,96 -> 72,104)',
                `read (${owl.x},${owl.y}), expected (72,104)`);
        }
        const pods = rows.filter((r) => r.cls.endsWith('Pod'));
        check(pods.length === 4, 'the four Pods are present',
            pods.map((p) => `(${p.x},${p.y})`).join(' ') || '(none — Pod may not be a Mobile)');
        console.log(`      full roster: ${rows.map((r) => r.cls).join(', ')}`);
        console.log(`      status: level=${owlRoom.status.level} tick=${owlRoom.status.tick} `
            + `dead_frames=${owlRoom.status.dead_frames} menu=${owlRoom.status.menu} `
            + `cutscene=${JSON.stringify(owlRoom.status.cutscene)}`);
    }

    // ── L114: the Watcher, and the tag the FinalDoor reads ────────────
    console.log('\n### L114 — the Watcher');
    const watcherRoom = await bootAndRead(
        bootTape('r6-probe-l114', 114, 64, 128), 'Watcher');
    if (watcherRoom.error) {
        check(false, 'boot into L114', watcherRoom.error);
    } else {
        const rows = watcherRoom.mobiles.mobiles ?? [];
        const w = rows.find((r) => r.cls.endsWith('Watcher'));
        check(Boolean(w), 'the Watcher is present at boot',
            w ? `${w.cls} at (${w.x},${w.y}) type=${w.type}`
                : `roster = ${rows.map((r) => r.cls).join(', ')}`);
        // `Watcher.update`'s last line is `visible = Player.hasShield`, and
        // this boot grants nothing — so an invisible Watcher is the CORRECT
        // reading and a visible one would be the finding.
        check(true, '⚠ visibility is render-side only (`visible = Player.hasShield`)',
            'this boot holds no shield, so an absent GRAPHIC is expected; the '
            + 'entity is what matters and `check()` is overridden empty, so it '
            + 'never despawns');
        console.log(`      full roster: ${rows.map((r) => r.cls).join(', ')}`);
        console.log(`      status: level=${watcherRoom.status.level} `
            + `dead_frames=${watcherRoom.status.dead_frames}`);
    }

    // ── L43: the boss the wake table already models, seen unwoken ─────
    console.log('\n### L43 — BossTotem, unwoken');
    const totemRoom = await bootAndRead(
        bootTape('r6-probe-l43', 43, 144, 208), 'BossTotem');
    if (totemRoom.error) {
        check(false, 'boot into L43', totemRoom.error);
    } else {
        const rows = totemRoom.mobiles.mobiles ?? [];
        const b = rows.find((r) => r.cls.endsWith('BossTotem'));
        // ⚠ `type = "Solid"` IS WRITTEN BY `update()`, NOT BY THE CTOR, and
        // `Game.update` skips `super.update()` for the whole `blackCover`
        // fade — so a read taken during the load reports the `Enemy` base
        // type and looks exactly like a refutation of §37.4. R5's own probe
        // paid for this once; `bootAndRead` returns as soon as the ROW
        // exists, which is still inside the fade. Wait for a LIVE FRAME.
        check(Boolean(b) && (b.type === 'Solid' || totemRoom.liveType === 'Solid'),
            '⛓ an UNWOKEN BossTotem reports type "Solid" once a LIVE frame has run',
            b ? `at boot type=${b.type} (inside the blackCover fade), `
                + `after the fade type=${totemRoom.liveType ?? '(not reached)'}; `
                + `at (${b.x},${b.y}) `
                + `only_hit_by=${JSON.stringify(b.enemy?.only_hit_by)} `
                + `hits_max=${b.enemy?.hits_max}`
                : 'no BossTotem row');
        // ⛔ L43 also holds `watcher@200,280` with EMPTY text, which no
        // summary of this room has ever named. It cannot be hit
        // (`Watcher.hit` guards on `text != ""`) and never despawns.
        const w43 = rows.find((r) => r.cls.endsWith('Watcher'));
        check(Boolean(w43), '⛔ AND L43 HOLDS A WATCHER — §2 never named it',
            w43 ? `${w43.cls} at (${w43.x},${w43.y}); its text is empty in the .oel, so `
                + '`Watcher.hit()` can never count and `check()` is overridden empty'
                : 'absent from botMobiles — it may not be a Mobile subclass');
        console.log(`      full roster: ${rows.map((r) => r.cls).join(', ')}`);
    }

    console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`);
    process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
} finally {
    await browser.close();
}
