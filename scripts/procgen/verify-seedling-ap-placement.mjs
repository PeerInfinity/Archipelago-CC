#!/usr/bin/env node
/**
 * verify-seedling-ap-placement — **AP'S PLACEMENT, DELIVERED INTO THE LIVE
 * ARTIFACT, AND THE ROOM MEASURED** (EDITOR INTEGRATION slice H7/H8; plan
 * §17.1.4, §17.2).
 *
 * ── ⛓⛓⛓ THE CLAIM, AND WHY IT IS A PAIR ─────────────────────────────────
 *
 * H7 rewrites the vanilla 116 so every AP location's pickup entity becomes an
 * `<apitem>`; H8 delivers that set through `botLoadLevels`/`botLevelSet`.
 * ⛔ **`Game.as`'s XML loop enumerates KNOWN element names** (`:2211-2279`), so
 * on **p4c** — the build that ships today — an unknown `<apitem>` is IGNORED.
 * ⇒ a rewritten room shows **NO pickup at all** at an AP location, and the
 * `APItem` that will stand there lands in M1's p4d.
 *
 * That absence is only evidence next to its control, so this instrument runs
 * the SAME page twice:
 *
 *   ARM A  the REWRITTEN set   → the AP location's pickup is ABSENT
 *   ARM B  the VANILLA set     → the same pickup is PRESENT
 *
 * ⛔ **AND THE DISCRIMINATOR IS THE DIFFERENCE OF THE TWO ROSTERS, NOT THE
 * ABSENCE ALONE.** "The BossKey is gone" is also true of a delivery that
 * mounted nothing, of a room that never built and of a page that died. So the
 * rows compare the two arms' whole `botMobiles()` rosters and require the
 * difference to be **exactly the rewritten entities and nothing else** — which
 * a broken delivery cannot produce, because it would move every enemy too.
 *
 * ── ⛓ THE SUBJECT ROOMS ARE THE GAME'S OWN DEBUG WARPS ───────────────────
 *
 * A tape boots the player at a position, and a pickup 8 px away is COLLECTED
 * before `botMobiles` is read — which would make the control read ABSENT and
 * the discriminator vacuous. So the spawn is not invented: it is
 * `games/seedling.json`'s `region_coords`, the vanilla debug-warp table, whose
 * entries are vetted player positions. MEASURED distances from the warp to the
 * subject pickup: **Gundernourd L19 → 113 px**, **Lacste L40 → 273-615 px**.
 * ⚠ `region_coords` is also one of the tables a rewrite FALSIFIES (plan §6.1,
 * `apMappingInvalidation`) — but only as a *label*: the coordinate still
 * resolves to the same room at the same tile, which is measured by
 * `apPlacementRewriter.referenceImpactOf` and is exactly what lets this
 * instrument use it as a spawn.
 *
 * ── ⛔ THE DELIVERY RUNS IN THE PAGE, NOT IN THIS PROCESS ─────────────────
 *
 * `SeedlingLevelSetDelivery` is imported by the game frame itself and driven
 * against the real `window.__swfBridge.game`. Re-implementing the chunk loop
 * here would gate a copy of the thing that ships.
 *
 * Headless WSL: WebGPU comes up on swiftshader with
 * `check-seedling-wasm-pages.mjs`'s flags, which are not optional — without
 * them the page reaches `__runtimeReady`, the ▶ click invokes `runSWF`, the
 * renderer cannot initialise and `botStatus` never appears.
 *
 * ⛓ THE SERVER IS `serveRepoRoot()`, which binds a FREE port on 127.0.0.1 over
 * THIS worktree. A fixed port would collide with the strays a multi-worktree
 * day leaves behind; the port is printed so a run can be attributed.
 *
 * Run: node scripts/procgen/verify-seedling-ap-placement.mjs [--keep-open]
 *
 * ── ⛓⛓ `--win` — THE M1 ARMS ON REAL-GPU WINDOWS CHROME ─────────────────────
 *
 *   python3 -m http.server 8129            # repo root of THIS worktree
 *   node scripts/procgen/verify-seedling-ap-placement.mjs --win [--win-port=N]
 *
 * `--win` runs the M1 arms — the ones that need the world to TURN — through
 * `seedling-level-set-win.py` on real-GPU Windows Chrome (~24 fps) instead of
 * WSL's SwiftShader (~0.45 fps). `seedling-bot.md` says *"always pass
 * `--win`"*; M1 did not, and read a three-frame observation window as a dead
 * world. `--win-port=` names the repo-root static server Windows can reach —
 * ⛔ NOT :8000, which serves the PRIMARY tree.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'verify-seedling-ap-placement.mjs', kind: 'browser' });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4c';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT} — `
        + '`git submodule update --init frontend/modules/flashPanel/wasm`');
    process.exit(0);
}

const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const RULES = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');

const { R7_GOAL_LEDGER } = await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));
const { buildPlacementTable, rewriteRecordSet } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/apPlacementRewriter.js'));
const { apMappingInvalidation, vanillaRecordSet } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/levelSetExporter.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { placementKey } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/apPlacementRewriter.js'));
/**
 * ⛓⛓ THE TWO HOST BINDINGS, IMPORTED INTO THE GATE — and this is M1b's whole
 * addition on top of their unit suites. Those suites are thorough and every one
 * of their payloads is a string a HUMAN typed. The one thing no unit row can
 * see is whether the string the GAME writes at runtime is that string, so the
 * rows below take the payload verbatim off `stateLog` and put it through the
 * real parser, the real placement table and the real exit list.
 */
const { SeedlingCheckBinding } = await import(
    join(REPO, 'frontend/modules/flashPanel/seedlingCheckBinding.js'));
const { SeedlingRegionBinding, outExitIdOf } = await import(
    join(REPO, 'frontend/modules/flashPanel/seedlingRegionBinding.js'));

// ── the two sets ─────────────────────────────────────────────────────────────

const [SLOT] = Object.keys(RULES.regions);
const SELF_PLAYER = Number(SLOT);
const PLACED = new Map();
for (const region of Object.values(RULES.regions[SLOT])) {
    for (const loc of region.locations ?? []) {
        PLACED.set(loc.name, { name: loc.item.name, player: loc.item.player });
    }
}
const { set: VANILLA_SET } = vanillaRecordSet(EMBED, MAP);
const { table } = buildPlacementTable({
    locationItemOf: (n) => PLACED.get(n) ?? null,
    ledger: R7_GOAL_LEDGER, rooms: MAP.levels, selfPlayer: SELF_PLAYER,
});
const { set: REWRITTEN_SET, replaced } = rewriteRecordSet(VANILLA_SET, table);

/**
 * ⛓ THE SUBJECT ROOMS AND THEIR SPAWNS, DERIVED. A room qualifies when the
 * vanilla debug-warp table names it AND the placement table rewrites something
 * in it; the spawn is the warp's own position.
 */
const SUBJECTS = Object.entries(GAME_CONFIG.region_coords)
    .map(([region, warp]) => ({
        region,
        level: warp.level,
        spawn: { x: warp.x, y: warp.y },
        entries: [...table.values()].filter((e) => e.level === warp.level),
    }))
    .filter((s) => s.entries.length > 0);

if (SUBJECTS.length === 0) {
    console.log('SKIP: no vanilla debug warp names a room the placement table rewrites — '
        + 'the spawn would have to be invented, and a pickup next to the spawn is COLLECTED '
        + 'before the roster is read');
    process.exit(0);
}

/**
 * ⛔⛔ **A WALL-CLOCK SETTLE IS A FRAME BUDGET IN DISGUISE, AND THIS PAGE RUNS
 * AT ~0.45 FRAMES PER SECOND.** M1 reported the two runtime rows as OWED on the
 * strength of a ten-second probe that saw `botStatus.tick` stay 0, `finished`
 * stay false and `dead_frames` move by THREE, and read that as *"the world does
 * not turn under this instrument's tape"*. ⛓ M1b measured the same three arms
 * for twenty seconds each and got the same shape — and the shape is the ANSWER,
 * not the defect: `dead_frames` moved **8 in 17.5 s**, i.e. one frame every
 * ~2.2 s, and `verify-seedling-bot-differential.mjs:500-507` has said so since
 * R5 in its own words — *"the game runs at ~0.5 ticks/s here, and every world
 * load burns ~20 `blackCover` fade frames before tick 0"*, `SECONDS_PER_FRAME =
 * 2.5`, `FADE_FRAMES = 25`. Three frames is not a paused world; it is three
 * frames of a ~25-frame room-load fade, and `Bot.update`'s dead-frame gate
 * returns before the tick counter on every one of them. The differential gate
 * reaches tick 0 because it waits `(ticks + dead + 25) * 2.5 s + 60 s` and
 * POLLS `finished`; this file waited eight seconds and asked.
 *
 * ⇒ **A row that needs the world to TURN polls `botStatus.finished`; a row that
 * needs only the ROSTER does not.** The two draw arms below keep their
 * wall-clock settle deliberately — the roster is a fact of `Game`'s
 * construction, complete before the first fade frame, which is why those rows
 * were green throughout — and the collection and door arms wait for the tape.
 * `ticks` still defaults to 0 for the same reason.
 */
const tapeFor = (level, spawn, ticks = 0, { persistence = [], inputs = [] } = {}) =>
    JSON.stringify(parseTape({
        tape_version: 8,
        game: 'seedling',
        boot: { level, x: spawn.x, y: spawn.y },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence,
        equips: [],
        pins: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 987286273, split: false, cosmetic: 0, fp: 0 },
        tick_count: ticks,
        inputs,
    }));

/**
 * How long a tape of `ticks` may take, in ms.
 *
 * ⛓ THE THREE NUMBERS ARE `verify-seedling-bot-differential.mjs:500-507`'s,
 * cited rather than re-derived: that file MEASURED them over 150 tapes and its
 * comment is the source of record. They are a BUDGET and never an assertion —
 * a number that is too large costs patience, and the row that matters is
 * `finished`, which is the game's own latch. The generous floor is the wasm
 * page's own settling, which no tape length predicts.
 */
const SECONDS_PER_FRAME = 2.5;
const FADE_FRAMES = 25;
const deadlineForTicks = (ticks) =>
    Math.ceil((ticks + FADE_FRAMES) * SECONDS_PER_FRAME * 1000) + 60000;

// ── reporting ────────────────────────────────────────────────────────────────

let failures = 0;
const check = (name, ok, detail = '') => {
    console.log(`${ok ? '  ok  ' : 'FAIL  '}${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
};

console.log(`# AP placement on ${PAGE_NAME}`);
console.log(`  vanilla   ${VANILLA_SET.set_id} (${VANILLA_SET.rooms.length} rooms)`);
console.log(`  rewritten ${REWRITTEN_SET.set_id} — ${replaced} entities substituted`);
console.log(`  subject room(s): ${SUBJECTS.map((s) => `${s.region} L${s.level} `
    + `(${s.entries.length} rewritten, spawn ${s.spawn.x},${s.spawn.y})`).join('; ')}\n`);

// ── the browser ──────────────────────────────────────────────────────────────

/**
 * ⛓⛓⛓ `--win` — REAL-GPU WINDOWS CHROME, AND ON THIS ARC IT IS NOT AN
 * OPTIMISATION.
 *
 * ⛔ `docs/json/developer/procgen/seedling-bot.md` has two sections saying so —
 * *"Always pass `--win`"* and *"Use the `--win` channel for anything longer
 * than a few hundred ticks"* — and M1 paid for not reading them: WSL's own
 * Chromium is SwiftShader at ~0.45 frames/sec against Windows Chrome's ~24, so
 * the two RUNTIME rows (a collection and a door) were reported OWED on the
 * strength of a ten-second window that contained THREE FRAMES of a ~25-frame
 * room-load fade. The physics is identical either way; a deterministic tick
 * loop does not care what draws it.
 *
 * ⚠ THE ROSTER ARMS ABOVE STAY LOCAL AND THAT IS DELIBERATE: they read what
 * `Game`'s constructor BUILT and need no frames at all, so they cost the same
 * on either channel and keep working on a box with no Windows side. `--win`
 * covers the M1 arms, which are the ones that need a world that turns.
 *
 * ⛔ AND THE PAGE MUST BE SERVED WHERE WINDOWS CAN SEE IT. `serveRepoRoot()`
 * binds 127.0.0.1 on a free port for THIS process; Windows Chrome reaches WSL
 * through `localhost:<port>` on a server that is already up. So `--win` needs
 * `--win-port=` (default 8129) naming a repo-root static server on this
 * worktree — ⛔ NOT :8000, which serves the PRIMARY tree and does not carry
 * this slice's build at all.
 */
const WIN = process.argv.includes('--win');
const WIN_PORT = Number(process.argv.filter((a) => a.startsWith('--win-port='))
    .map((a) => a.slice('--win-port='.length)).pop() ?? 8129);
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-level-set-win.py');

const server = await serveRepoRoot();
const PORT = server.address().port;
const PAGE_URL = `http://127.0.0.1:${PORT}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
console.log(`  serving this worktree on 127.0.0.1:${PORT}`);

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

/**
 * ONE READING: a FRESH page, the set delivered through the shipped delivery
 * module, then ONE boot and its `botMobiles()` roster.
 *
 * ⛔ A FRESH PAGE PER (ARM, ROOM), AND THE SECOND HALF OF THAT RULE WAS
 * MEASURED THE HARD WAY. A first cut booted all four subject rooms on one
 * page; rooms 1 and 3 read their own roster and rooms 2 and 4 read the
 * PREVIOUS room's, unchanged, down to the `bosskey` position — a stale reading
 * that looks exactly like a correct one, because the roster is well-formed and
 * plausible. `botStart` reuses the world unless the next tape's boot names
 * other construction args (`Bot.as:1722-1725`), so consecutive boots on one
 * page are not independent observations. One page, one boot, one claim.
 */
async function runReading(label, subject, set, invalidation) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const out = { label, level: subject.level, delivery: null, room: null, logs };
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__runtimeReady === true, null, { timeout: 240000 });
        // The page refuses to press ▶ itself (the renderer and the audio context
        // consume the user activation); Playwright's click IS a user gesture.
        await page.click('#btn-start', { timeout: 60000 });
        await page.waitForFunction(
            () => typeof window.__swfBridge?.game?.botStatus === 'function',
            null, { timeout: 240000 });

        // ── the delivery, running IN THE PAGE ────────────────────────────
        out.delivery = await page.evaluate(async ([levelSet, companion]) => {
            const { SeedlingLevelSetDelivery } = await import(
                '/frontend/modules/flashPanel/seedlingLevelSetDelivery.js');
            const { planLevelSetChunks } = await import(
                '/frontend/modules/seedlingDemo/levelSetValidator.js');
            const g = window.__swfBridge.game;
            const d = new SeedlingLevelSetDelivery({
                planChunks: planLevelSetChunks,
                bot: (name, arg) => (arg === undefined ? g[name]() : g[name](arg)),
            });
            d.arm(levelSet, companion);
            const result = d.deliver();
            return { ...result, stats: d.stats, state: d.state };
        }, [set, invalidation]);

        /**
         * ── the one boot, then the roster ────────────────────────────────
         *
         * ⛔⛔ **POLLED ON `armed`, NOT SLEPT — AND THE THREE-SECOND SLEEP THIS
         * REPLACES WAS A COIN FLIP.** M1b ran this file twice on one tree and
         * got two different answers: `Rostef L30`'s rewritten arm came back
         * with LEVEL 0's roster (`IntroCharacter`, `Statue`, `Player@88,136`)
         * on the second run, and `bosskey0@L19` moved from *observable* to
         * *not observable* between them. At ~0.45 frames/sec (see `tapeFor`)
         * three seconds is ONE OR TWO FRAMES, and whether the world swap has
         * landed inside them is luck.
         *
         * ⛓ AND THE ROW BELOW COULD NOT CATCH IT, WHICH IS THE SHARPER HALF.
         * *"botStatus says level N"* passes the instant `botStart` evaluates
         * `new Game(level, …)`, because that constructor writes `Main.level` on
         * its own second line while the swap is still only `FP._goto` — trap
         * 112, and `Bot.update`'s own gate says so in a fifty-line comment. So
         * a stale roster passed a level check and then differed from its
         * control by three entities, which is exactly what a real placement
         * defect looks like.
         *
         * ⛓ `armed` IS THE LANDING, and it is the only field that is. `Bot.update`
         * sets it when `FP.world === pendingWorld` — an OBJECT IDENTITY test —
         * and `Engine.checkWorld()` has already called `begin()` (and therefore
         * `loadlevel`) by then, so an armed bot is a built room. It costs ONE
         * frame rather than a fade, so this is also ~2 s instead of 3 s of
         * hoping. `finished` is accepted beside it because a 0-tick tape
         * disarms on its first live frame.
         */
        out.room = await page.evaluate(async ([t, deadline]) => {
            const g = window.__swfBridge.game;
            const loaded = g.botLoadTape(t);
            const started = g.botStart();
            const t0 = Date.now();
            let status = null;
            let landed = false;
            for (;;) {
                try { status = JSON.parse(g.botStatus()); } catch { status = null; }
                if (status && (status.armed || status.finished)) { landed = true; break; }
                if (Date.now() - t0 > deadline) break;
                await new Promise((r) => setTimeout(r, 250));
            }
            let mobiles = null;
            try { mobiles = JSON.parse(g.botMobiles()); } catch { mobiles = null; }
            return { loaded, started, mobiles, landed, waitedMs: Date.now() - t0,
                level: status?.level ?? null };
        }, [tapeFor(subject.level, subject.spawn), deadlineForTicks(0)]);
    } catch (e) {
        out.error = e.message.split('\n')[0];
        console.log(`  PAGE LOGS (last 25):\n${logs.slice(-25).map((l) => `    ${l}`).join('\n')}`);
    }
    await page.close();
    return out;
}

/**
 * ⛓⛓ THE ROSTER IS KEYED BY POSITION, NOT BY CLASS NAME — and that is a
 * finding, not a convenience. `botMobiles` reports `getQualifiedClassName`, so
 * the OEL element `totempart` comes back as `Pickups::BossTotemPart` and
 * `torchpickup` as `Pickups::TorchPickup`. Matching on a NAME would need a
 * transcription of `Game.as`'s construction lines living here, drifting on its
 * own; the tile is the address the placement table already holds, and
 * `Pickup`'s constructor offsets it by a known half-tile (`_x + Tile.w/2`).
 */
const TILE_HALF = 8;
const rosterOf = (room) => (room?.mobiles?.mobiles ?? [])
    .map((m) => ({ cls: String(m.cls), at: `${m.x},${m.y}` }));
const keysOf = (roster) => roster.map((m) => `${m.cls}@${m.at}`).sort();
const atOf = (roster, at) => roster.find((m) => m.at === at) ?? null;

const ARMS = [
    { label: 'rewritten', set: REWRITTEN_SET },
    { label: 'vanilla', set: VANILLA_SET },
];
const readings = new Map();
for (const s of SUBJECTS) {
    for (const arm of ARMS) {
        // eslint-disable-next-line no-await-in-loop
        readings.set(`${arm.label}|${s.level}`, await runReading(
            arm.label, s, arm.set, apMappingInvalidation(arm.set)));
    }
}

// ── the claims ───────────────────────────────────────────────────────────────

for (const [key, r] of readings) {
    const wantId = r.label === 'rewritten' ? REWRITTEN_SET.set_id : VANILLA_SET.set_id;
    check(`${key}: the page came up and the set was DELIVERED`,
        !r.error && r.delivery?.ok === true && r.delivery.state === 'delivered',
        r.error ? `stopped: ${r.error}`
            : `${r.delivery?.chunks} chunk(s), state ${r.delivery?.state}`
              + `${r.delivery?.why ? ` — ${r.delivery.why}` : ''}`);
    check(`${key}: botLevelSet READ BACK the set that was sent`,
        r.delivery?.readback?.active === wantId, JSON.stringify(r.delivery?.readback ?? null));
    // ⛔ THE BOOT IS ITS OWN CLAIM. A stale roster is a well-formed roster.
    // ⚠ AND THE LEVEL IS NOT THE CLAIM — `Main.level` moves inside `new Game`,
    // one line into a constructor whose world has not been swapped in yet
    // (trap 112). `armed` is the swap, so the WITNESS is `landed`.
    check(`${key}: botLoadTape/botStart both took and the world SWAP LANDED `
        + `(level ${r.level})`,
    r.room?.loaded === 'ok' && r.room?.started === 'ok' && r.room?.landed === true
        && r.room?.level === r.level,
    `loaded=${JSON.stringify(r.room?.loaded)} started=${JSON.stringify(r.room?.started)} `
    + `landed=${JSON.stringify(r.room?.landed)} in ${r.room?.waitedMs} ms, `
    + `botStatus.level=${JSON.stringify(r.room?.level)}`);
}

let observable = 0;
const notObservable = [];
for (const s of SUBJECTS) {
    const a = rosterOf(readings.get(`rewritten|${s.level}`)?.room);
    const b = rosterOf(readings.get(`vanilla|${s.level}`)?.room);
    const label = `${s.region} L${s.level}`;

    check(`${label}: both arms BUILT the room (a non-empty roster is the witness)`,
        a.length > 0 && b.length > 0, `rewritten ${a.length} mobile(s), vanilla ${b.length}`);

    /**
     * ⛔ WHAT `botMobiles` CAN SEE IS DECIDED BY THE CONTROL, NOT BY A TABLE
     * HERE. It walks `Mobile`; `Pickup extends Mobile`, so the twelve pickups,
     * the five keys and the five totem parts are in it — but `Chest` is
     * Scenery and is NOT, so a chest location is INVISIBLE to this instrument.
     * ⛓ That is REPORTED BY NAME rather than skipped: an entry the vanilla arm
     * cannot see is not evidence either way, and pretending otherwise would
     * turn "this instrument cannot look here" into a passing row. Deciding it
     * from the vanilla roster costs nothing, because four independent rows
     * above already say that arm delivered, mounted and built its room.
     */
    const seen = [];
    for (const entry of s.entries) {
        const at = `${entry.entity.x + TILE_HALF},${entry.entity.y + TILE_HALF}`;
        const inB = atOf(b, at);
        const inA = atOf(a, at);
        if (!inB) {
            notObservable.push(`${entry.ledgerId} (${entry.entity.type})`);
            console.log(`  note  ${label}: ${entry.ledgerId} is NOT OBSERVABLE — `
                + `botMobiles walks Mobile and the vanilla arm reports nothing at ${at}, `
                + `so the vanilla \`${entry.entity.type}\` is not a Mobile in this build`);
            continue;
        }
        observable += 1;
        seen.push(`${inB.cls}@${at}`);
        // ⛔ THE PAIR. p4c's XML loop has no `apitem` case, so the tile must be
        // EMPTY in the rewritten arm and hold the vanilla pickup in the control.
        check(`${label}: ${entry.ledgerId} — vanilla PRESENT (${inB.cls})`, true, at);
        check(`${label}: ${entry.ledgerId} — rewritten ABSENT`, inA === null,
            inA ? `${inA.cls} is still at ${at} — the rewrite did not reach this room` : at);
    }

    // ⛔ AND NOTHING ELSE MOVED. Without this the absence is also what a dead
    // page, an empty world or a delivery that mounted nothing looks like.
    if (seen.length > 0) {
        const ka = keysOf(a);
        const kb = keysOf(b);
        const onlyInB = kb.filter((m) => !ka.includes(m)).sort();
        const onlyInA = ka.filter((m) => !kb.includes(m)).sort();
        check(`${label}: the two rosters differ in EXACTLY the ${seen.length} rewritten entities`,
            onlyInA.length === 0 && JSON.stringify(onlyInB) === JSON.stringify(seen.sort()),
            `only-in-vanilla [${onlyInB.join(' ')}] vs expected [${seen.join(' ')}]`
            + `; only-in-rewritten [${onlyInA.join(' ')}]`);
    }
}

check(`the discriminator ran on at least one location (${observable} observable, `
    + `${notObservable.length} not)`, observable > 0,
notObservable.length > 0 ? `not observable: ${notObservable.join(', ')}` : '');

// ═══════════════════════════════════════════════════════════════════════════
// ⛓⛓⛓ M1 — THE SAME PLACEMENT ON THE BUILD THAT HAS THE `APItem` CLASS
// ═══════════════════════════════════════════════════════════════════════════
//
// Everything above is the p4c pair: an `<apitem>` element p4c's XML loop does
// not know, so the tile is EMPTY. M1's build adds the class, the two report
// seams and the two getters, and the rows below are the ones that could not be
// written before it existed. They SKIP by name when the artifact is not on
// disk, so this file stays green on a checkout that has only p4c.
//
// ⛔ **THE `@look` IS OBSERVED WITHOUT A SINGLE PIXEL, AND THAT IS A BETTER
// ROW THAN THE ONE THE PLAN ASKED FOR.** `Bot.mobileRow` reports `frame` as
// `m.graphic as Spritemap` — **null when the graphic is a plain `Image`**
// (`Bot.as:2481-2503`). `APItem` binds a `Spritemap` for the fourteen pickup
// looks and the five keys, and a plain `Image` for `ap`, the Archipelago logo
// (following `DarkShield`/`DarkSuit`, the two vanilla classes that bind an
// Image). So *"the placeholder drew the logo"* is `frame === null` and *"it
// drew the Seedling sprite"* is `frame === 0` — deterministic, off the roster
// this instrument already reads, with no screenshot, no canvas geometry and no
// tolerance. A pixel diff would have needed a same-arm control against an
// animated tileset; this needs none.
//
// The two arms are the RULED behaviour end to end: the SAME location, rewritten
// twice — once from the canonical placement (the item is this slot's own
// Seedling item ⇒ its Seedling graphic) and once from a synthetic FOREIGN
// placement (another player's item ⇒ the logo). Nothing in the gate spells a
// look; both come out of `buildPlacementTable`.

/**
 * ⛔ THE PATH IS WRITTEN WHOLE AND THE NAME IS DERIVED FROM IT, and that is not
 * a style choice. `check-seedling-wasm-pins.mjs` enumerates *"the builds this
 * repo's tracked files actually spell"* through four spellings, and a name
 * assembled by interpolation (`.../wasm/${M1_PAGE}/`) matches NONE of them —
 * measured here: with the name in its own `const`, the gate read this file and
 * reported p4d UNREFERENCED, which is how a build ships and then gets cleared
 * for retirement while an instrument still loads it. Spelt as a literal path
 * it is spelling 1, and the pin is real.
 */
const M1_ARTIFACT = join(REPO, 'frontend/modules/flashPanel/wasm/seedling_bot_ap_p4d');
const M1_PAGE = basename(M1_ARTIFACT);
const M1_URL = `http://127.0.0.1:${PORT}/frontend/modules/flashPanel/wasm/${M1_PAGE}/game.html`;
/** The same page, on the host+port Windows Chrome can reach. */
const WIN_URL = `http://localhost:${WIN_PORT}/frontend/modules/flashPanel/wasm/${M1_PAGE}/game.html`;

/** The collection subject: a pickup the roster can see, in a warped room. */
const M1_SUBJECT = [...table.values()].find((e) => e.ledgerId === 'torchpickup@L30');
/** Its AP item's Seedling flag, DERIVED from the shipped config, never typed. */
const M1_FLAG = GAME_CONFIG.locations.find(
    (l) => l.ap_name === M1_SUBJECT?.item)?.property ?? null;
/**
 * ⛔⛔ A DOOR MUST BE WALKED ONTO, AND BOOTING ON IT IS THE ONE SPELLING THAT
 * CAN NEVER FIRE — measured at M1b, and it is the reason M1's door rows read
 * empty. `Teleporter.check()` runs on the new world's FIRST frame and sets
 * `playerTouching = true` when the player is already colliding
 * (`Teleporter.as:68-73`); `update()`'s report is gated on `!playerTouching`
 * and only the `else` branch — *"the player is no longer on me"* — re-arms it.
 * That latch exists so an ARRIVAL does not bounce straight back, and a boot
 * onto the portal is indistinguishable from an arrival. So a tape that spawns
 * on a door and holds nothing is silent BY CONSTRUCTION, whatever the AS3 does.
 *
 * ⛓ SO THE APPROACH IS DERIVED, NOT INVENTED. A door qualifies when the
 * VANILLA DEBUG WARP for its room shares a column or a row with it and is
 * within four tiles: the warp is the game's own drop point for that room, so
 * the straight line between them is walkable by the game's own choosing, and
 * the direction and the distance both fall out of the two coordinates. The
 * shortest candidate per TYPE is taken — a longer walk is more frames and more
 * chances to catch on geometry, and buys nothing.
 *
 * ⛔ NO COORDINATE, DIRECTION OR TICK COUNT IS TYPED HERE.
 */
const APPROACH_REACH_PX = 64;
const M1_DOORS = (() => {
    const warpsByLevel = new Map();
    for (const [name, w] of Object.entries(GAME_CONFIG.region_coords)) {
        if (!warpsByLevel.has(w.level)) warpsByLevel.set(w.level, []);
        warpsByLevel.get(w.level).push({ name, ...w });
    }
    const cands = [];
    for (const room of MAP.levels) {
        for (const w of warpsByLevel.get(room.level) ?? []) {
            for (const e of room.entities ?? []) {
                if (!['teleporter', 'stairsup', 'stairsdown'].includes(e.type)) continue;
                if (e.attrs?.to === undefined) continue;
                const dx = e.x - w.x;
                const dy = e.y - w.y;
                let key = null;
                let dist = 0;
                if (dx === 0 && dy !== 0) { key = dy < 0 ? 'up' : 'down'; dist = Math.abs(dy); }
                else if (dy === 0 && dx !== 0) { key = dx < 0 ? 'left' : 'right'; dist = Math.abs(dx); }
                if (!key || dist > APPROACH_REACH_PX) continue;
                cands.push({
                    level: room.level, type: e.type, x: e.x, y: e.y, to: Number(e.attrs.to),
                    warp: w.name, from: { x: w.x, y: w.y }, key, dist,
                    // ⛓ The budget, from the distance: the player's own cap is
                    // ~1.45 px/tick and it accelerates into it, so one px per
                    // tick plus a fixed margin is generous in the only
                    // direction a budget may err.
                    ticks: Math.ceil(dist) + 40,
                });
            }
        }
    }
    cands.sort((a, b) => a.dist - b.dist);
    const out = [];
    for (const c of cands) {
        if (out.some((d) => d.type === c.type)) continue;
        out.push(c);
        if (out.length === 2) break;
    }
    return out;
})();

if (!existsSync(join(M1_ARTIFACT, 'game.html'))) {
    console.log(`\n  SKIP  ${M1_PAGE}: no artifact at ${M1_ARTIFACT} — the M1 rows `
        + '(the APItem draws, the check report, the door report) need the build that '
        + 'carries the class and the two seams');
} else if (!M1_SUBJECT || !M1_FLAG || M1_DOORS.length === 0) {
    console.log(`\n  SKIP  ${M1_PAGE}: the subject could not be derived `
        + `(subject ${!!M1_SUBJECT}, flag ${JSON.stringify(M1_FLAG)}, ${M1_DOORS.length} door(s))`);
} else {
    console.log(`\n# M1 on ${M1_PAGE}`);
    console.log(`  subject   ${M1_SUBJECT.ledgerId} @ L${M1_SUBJECT.level} tag ${M1_SUBJECT.tag} `
        + `(${M1_SUBJECT.tagSource}) — ${M1_SUBJECT.item} for player ${M1_SUBJECT.player}, `
        + `look ${M1_SUBJECT.look}, flag ${M1_FLAG}`);
    console.log(`  door(s)   ${M1_DOORS.map((d) => `${d.type}@L${d.level} (${d.x},${d.y}) -> ${d.to}`
        + ` — walk ${d.key} ${d.dist}px from the "${d.warp}" warp (${d.from.x},${d.from.y}), `
        + `${d.ticks} ticks`).join('; ')}`);

    /**
     * ⛓ A FOREIGN placement of the SAME location, built by the SAME function.
     * The rewriter's `lookFor` puts the player check above both tie-break
     * steps, so another player's item is the logo whatever it is called.
     */
    const { table: FOREIGN_TABLE } = buildPlacementTable({
        locationItemOf: (n) => (n === M1_SUBJECT.location
            ? { name: 'A Thing From Somewhere Else', player: SELF_PLAYER + 1 }
            : PLACED.get(n) ?? null),
        ledger: R7_GOAL_LEDGER, rooms: MAP.levels, selfPlayer: SELF_PLAYER,
    });
    const FOREIGN_ENTRY = FOREIGN_TABLE.get([...FOREIGN_TABLE.keys()]
        .find((k) => FOREIGN_TABLE.get(k).ledgerId === M1_SUBJECT.ledgerId));
    const { set: FOREIGN_SET } = rewriteRecordSet(VANILLA_SET, FOREIGN_TABLE);

    /**
     * ⛓⛓⛓ THE STEP SOURCES ARE STRINGS, AND THAT IS WHAT MAKES ONE ARM RUN ON
     * TWO CHANNELS. Playwright invokes a string expression that evaluates to a
     * function with the argument it is handed — in node AND in Windows Python —
     * so the SAME source drives the local page and the one
     * `seedling-level-set-win.py` opens on real-GPU Windows Chrome. Written as
     * closures they would be node-only, and the `--win` arm would be a second
     * implementation of the delivery and the poll.
     */
    const M1_STEPS = {
        // ⛓ THE DECLARATIONS ARE THE SHIPPED ONES, spliced from
        // games/seedling.json rather than written here — the ORDER is the
        // guarantee under test and a list typed in the gate would prove
        // nothing about the file the panel loads.
        configure: `(cfg) => {
            window.__swfBridge.stateLog.length = 0;
            return window.__swfBridge.game.configure(JSON.stringify(cfg));
        }`,
        deliver: `async ([levelSet, companion]) => {
            const { SeedlingLevelSetDelivery } = await import(
                '/frontend/modules/flashPanel/seedlingLevelSetDelivery.js');
            const { planLevelSetChunks } = await import(
                '/frontend/modules/seedlingDemo/levelSetValidator.js');
            const g = window.__swfBridge.game;
            const d = new SeedlingLevelSetDelivery({
                planChunks: planLevelSetChunks,
                bot: (name, arg) => (arg === undefined ? g[name]() : g[name](arg)),
            });
            d.arm(levelSet, companion);
            return { ...d.deliver(), state: d.state };
        }`,
        room: `async ([t, ms, awaitFinish, deadline]) => {
            const g = window.__swfBridge.game;
            const loaded = g.botLoadTape(t);
            const started = g.botStart();
            const t0 = Date.now();
            let status = null;
            const read = () => {
                try { status = JSON.parse(g.botStatus()); } catch (e) { status = null; }
                return status;
            };
            if (awaitFinish) {
                // ⛔ POLLED, NOT SLEPT — see \`tapeFor\`. \`finished\` is the bot's
                // own terminal latch and the ONLY honest answer to "has this
                // tape run"; a wall-clock number would have to encode a frame
                // rate the CHANNEL decides, and the two channels differ by 50x.
                for (;;) {
                    const st = read();
                    if (st && (st.finished || (st.error || '') !== '')) break;
                    if (Date.now() - t0 > deadline) break;
                    await new Promise((r) => setTimeout(r, 250));
                }
            } else {
                await new Promise((r) => setTimeout(r, ms));
                read();
            }
            let mobiles = null;
            try { mobiles = JSON.parse(g.botMobiles()); } catch (e) { mobiles = null; }
            return { loaded, started, mobiles, level: status ? status.level : null,
                status, waitedMs: Date.now() - t0,
                reports: window.__swfBridge.stateLog.slice() };
        }`,
        // ⛓ A SYNTHETIC \`ReceivedItems\`: the one write the bridge makes on the
        // AP server's say-so. ⚠ 6 s, not 3: measured at W5-0, a queued write can
        // take >3 s to land and report on headless swiftshader — the poll is a
        // game frame, and they are slow there.
        grant: `async ([property, ms]) => {
            const before = window.__swfBridge.stateLog.length;
            window.__swfBridge.queueItems({ class: 'main', property, value: true });
            await new Promise((r) => setTimeout(r, ms));
            return window.__swfBridge.stateLog.slice(before);
        }`,
    };

    /**
     * ONE READING on the M1 build, as a PLAN: a fresh page, ▶ Start,
     * `configure` with the shipped property declarations, an optional delivery,
     * one boot, and then whatever the caller asked for. ⛔ One page, one boot,
     * one claim — trap 955: `botStart` reuses the world, so consecutive boots
     * on one page read the previous room's roster.
     */
    const armPlan = (name, { set = null, boot, settleMs = 5000, grant = null, ticks = 0,
        awaitFinish = false, persistence = [], inputs = [] }) => {
        const steps = [{ label: 'configure', eval: M1_STEPS.configure,
            arg: { classes: GAME_CONFIG.classes,
                state_properties: GAME_CONFIG.state_properties } }];
        if (set) {
            steps.push({ label: 'deliver', eval: M1_STEPS.deliver,
                arg: [set, apMappingInvalidation(set)] });
        }
        steps.push({ label: 'room', eval: M1_STEPS.room,
            arg: [tapeFor(boot.level, { x: boot.x, y: boot.y }, ticks,
                { persistence, inputs }), settleMs, awaitFinish, deadlineForTicks(ticks)] });
        if (grant) steps.push({ label: 'grant', eval: M1_STEPS.grant, arg: [grant, 6000] });
        return { name, steps, ticks, awaitFinish };
    };

    /** The local SwiftShader channel: one page per arm, in this process. */
    async function runArmsLocal(arms) {
        const out = [];
        for (const arm of arms) {
            // eslint-disable-next-line no-await-in-loop
            const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
            const rec = { name: arm.name, results: [], console: [], crashed: false };
            page.on('console', (m) => rec.console.push(`[${m.type()}] ${m.text()}`));
            page.on('pageerror', (e) => rec.console.push(`[pageerror] ${e.message}`));
            try {
                /* eslint-disable no-await-in-loop */
                await page.goto(M1_URL, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => window.__runtimeReady === true,
                    null, { timeout: 240000 });
                await page.click('#btn-start', { timeout: 60000 });
                await page.waitForFunction(
                    () => typeof window.__swfBridge?.game?.botStatus === 'function',
                    null, { timeout: 240000 });
                for (const step of arm.steps) {
                    /**
                     * ⛔⛔ **THE TWO PLAYWRIGHT APIs DISAGREE ABOUT WHAT A
                     * STRING MEANS, AND THE DEFAULT CHANNEL IS THE ONE THAT
                     * LOSES.** Python's `page.evaluate(expr, arg)` *"if the
                     * expression evaluates to a function, the function is
                     * automatically invoked"*. Node's does NOT: it evaluates
                     * the expression, gets a function OBJECT, fails to
                     * serialise it and hands back `undefined` — **no throw, no
                     * page error, every step recorded as `null`**. Measured:
                     * the `--win` arm was green while this one produced
                     * `configure=null` on all six arms and 31 red rows whose
                     * shape said "the build is broken" rather than "the
                     * harness returned nothing".
                     *
                     * ⛓ So the invocation is made EXPLICIT here rather than
                     * relying on either API's convenience. The source stays a
                     * string — one source, two channels, no drift — and this
                     * side does the call the Python side does for free.
                     */
                    const value = await page.evaluate(([src, a]) => {
                        // eslint-disable-next-line no-eval
                        const fn = (0, eval)(src);
                        return fn(a);
                    }, [step.eval, step.arg]);
                    rec.results.push({ eval: step.label, value });
                }
                /* eslint-enable no-await-in-loop */
            } catch (e) {
                rec.crashed = true;
                rec.error = e.message.split('\n')[0];
            }
            // eslint-disable-next-line no-await-in-loop
            await page.close();
            out.push(rec);
        }
        return out;
    }

    /**
     * ⛓⛓⛓ THE `--win` CHANNEL — real-GPU Windows Chrome, ~24 fps against
     * SwiftShader's ~0.45, and `docs/json/developer/procgen/seedling-bot.md`
     * has said *"always pass `--win`"* since R5. ⛔ IT IS NOT AN OPTIMISATION
     * HERE: the two runtime rows need a world that TURNS, and at 2.5 s a frame
     * a 100-tick approach walk is four minutes of box per door.
     *
     * The driver is `seedling-level-set-win.py` — the same dumb step runner the
     * level-set probe uses, given an `eval` step so the JS above can be handed
     * to it verbatim. Every rule, every table and every verdict stays here.
     */
    function runArmsWin(arms) {
        mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
        writeFileSync(join(WIN_SCRATCH_WSL, basename(WIN_DRIVER)), readFileSync(WIN_DRIVER));
        /**
         * ⛔⛔ **THE PLAN FORWARDS `url` AND `boot`, AND FORGETTING THEM COST
         * A WHOLE WINDOWS RUN.** This line used to read
         * `arms.map((a) => ({ name: a.name, steps: a.steps }))` — an
         * ENUMERATION, so P1-e's per-arm `url` and `boot` were silently
         * dropped and all five panel arms ran on the GAME page under the
         * wasm-page boot. The symptom was three hops away from the cause:
         * `arm` answered `{"tabs": []}` (no Golden Layout on the game page)
         * and then `fetch('./presets/…')` resolved against
         * `.../wasm/<build>/game.html`, 404'd, and the HTML error page threw
         * `SyntaxError: Unexpected token '<'` out of `.json()`. A new field on
         * a plan reaches nothing if the builder lists the old ones.
         */
        const plan = {
            url: WIN_URL,
            arms: arms.map((a) => ({ name: a.name, steps: a.steps,
                ...(a.url ? { url: a.url } : {}), ...(a.boot ? { boot: a.boot } : {}) })),
        };
        writeFileSync(join(WIN_SCRATCH_WSL, 'ap-placement-plan.json'), JSON.stringify(plan));
        const stdout = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\${basename(WIN_DRIVER)}`,
            '--plan', `${WIN_SCRATCH_DOS}\\ap-placement-plan.json`,
            '--out', `${WIN_SCRATCH_DOS}\\ap-placement-results.json`,
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        for (const line of stdout.split('\n').filter((l) => l.trim())) console.log(`  win| ${line}`);
        const results = JSON.parse(
            readFileSync(join(WIN_SCRATCH_WSL, 'ap-placement-results.json'), 'utf8'));
        return results.arms;
    }

    /** A driver record, back in the shape the rows below read. */
    const shapeArm = (rec) => {
        const valueOf = (label) => rec.results?.find((r) => r.eval === label)?.value ?? null;
        const room = valueOf('room');
        return {
            label: rec.name,
            error: rec.crashed ? (rec.error ?? 'crashed') : null,
            logs: rec.console ?? [],
            configured: valueOf('configure'),
            delivery: valueOf('deliver'),
            room,
            reports: room?.reports ?? [],
            afterGrant: valueOf('grant') ?? [],
        };
    };

    const reportsNamed = (r, name) => (r.reports ?? []).filter((x) => x.name === name);
    const atTile = (r, at) => (r.room?.mobiles?.mobiles ?? []).find((m) => `${m.x},${m.y}` === at) ?? null;
    const AT = `${M1_SUBJECT.entity.x + TILE_HALF},${M1_SUBJECT.entity.y + TILE_HALF}`;
    const SPAWN = GAME_CONFIG.region_coords[Object.keys(GAME_CONFIG.region_coords)
        .find((k) => GAME_CONFIG.region_coords[k].level === M1_SUBJECT.level)];

    /**
     * ⛔ EVERY ARM IS PLANNED BEFORE ANY OF THEM RUNS, and that is what lets
     * the `--win` channel exist at all: the Python driver takes ONE plan and
     * opens ONE browser for the lot. It is also a claim worth stating —
     * nothing here depends on an earlier arm's RESULT. The one row that did
     * (a re-entry after a collection) turned out to be measuring the harness's
     * own fresh-start reset rather than the game, and is now a declared-clear
     * arm of its own.
     */
    const ARMS = [
        // ── (1)+(2) THE APITEM DRAWS, AND ITS LOOK FOLLOWS THE PLACEMENT ────
        armPlan('draw-own',
            { set: REWRITTEN_SET, boot: { level: M1_SUBJECT.level, x: SPAWN.x, y: SPAWN.y } }),
        armPlan('draw-foreign',
            { set: FOREIGN_SET, boot: { level: M1_SUBJECT.level, x: SPAWN.x, y: SPAWN.y } }),
        armPlan('collect', {
            set: REWRITTEN_SET,
            boot: { level: M1_SUBJECT.level, x: M1_SUBJECT.entity.x, y: M1_SUBJECT.entity.y },
            grant: M1_FLAG,
            // ⛓ TEN TICKS, NOT NINETY. The player boots ON the item, so
            // `Pickup.update()`'s own `collide` has nothing to wait for but a
            // LIVE frame. The budget that matters is the ~25-frame fade, and
            // `deadlineForTicks` already carries it.
            ticks: 10,
            awaitFinish: true,
        }),
        armPlan('declared-clear', {
            set: REWRITTEN_SET,
            boot: { level: M1_SUBJECT.level, x: SPAWN.x, y: SPAWN.y },
            ticks: 10,
            awaitFinish: true,
            persistence: [{ level: M1_SUBJECT.level, tag: M1_SUBJECT.tag,
                note: `${M1_SUBJECT.ledgerId} already collected` }],
        }),
        // ⛓ BOOT AT THE WARP, HOLD ONE DIRECTION. The span is released five
        // ticks before the end so the tape's last observation is not taken with
        // a key down — the same ENDS-MEET courtesy the R1 fixtures keep.
        ...M1_DOORS.map((door) => armPlan(`door-${door.type}`, {
            boot: { level: door.level, x: door.from.x, y: door.from.y },
            ticks: door.ticks,
            inputs: [{ key: door.key, from: 0, to: door.ticks - 5 }],
            awaitFinish: true,
        })),
    ];
    console.log(`  channel   ${WIN ? `--win (real-GPU Windows Chrome, ${WIN_URL})`
        : `local SwiftShader (${M1_URL})`} — ${ARMS.length} arm(s)`);
    const RAW = WIN ? runArmsWin(ARMS) : await runArmsLocal(ARMS);
    const ARM = new Map(RAW.map((r) => [r.name, shapeArm(r)]));
    const armOf = (name) => ARM.get(name) ?? { label: name, error: 'the driver returned no arm',
        reports: [], afterGrant: [] };
    for (const a of ARM.values()) {
        const st = a.room?.status;
        // ⛓ Only the arms that ASKED to run a tape get a finished/not readout —
        // the two draw arms settle for a roster and never wait, and printing
        // "DID NOT FINISH" beside them reads as a failure that is not one.
        if (!st || !ARMS.find((p) => p.name === a.label)?.awaitFinish) continue;
        const frames = Number(st.tick ?? 0) + Number(st.dead_frames ?? 0);
        console.log(`  ${a.label}: ${st.finished ? 'FINISHED' : 'DID NOT FINISH'} — `
            + `tick ${st.tick}, ${st.dead_frames} dead, `
            + `${((a.room.waitedMs ?? 0) / 1000).toFixed(1)} s`
            + `${frames > 0 ? ` (${(a.room.waitedMs / frames / 1000).toFixed(2)} s/frame)` : ''}`
            + `${(st.error ?? '') !== '' ? ` error=${JSON.stringify(st.error)}` : ''}`);
    }

    const drawOwn = armOf('draw-own');
    const drawForeign = armOf('draw-foreign');

    for (const r of [drawOwn, drawForeign]) {
        check(`M1 ${r.label}: configure took and the set was DELIVERED`,
            !r.error && r.configured === 'ok' && r.delivery?.state === 'delivered',
            r.error ? `stopped: ${r.error}`
                : `configure=${r.configured} ${r.delivery?.chunks} chunk(s) ${r.delivery?.state}`);
    }

    const own = atTile(drawOwn, AT);
    const foreign = atTile(drawForeign, AT);
    // ⛔ THE CLASS IS THE FIRST CLAIM. On p4c this tile is EMPTY (every row
    // above says so); the whole point of the build is that it is not.
    check(`M1: the ${M1_SUBJECT.ledgerId} tile holds an APItem — p4c leaves it EMPTY`,
        own?.cls === 'Pickups::APItem', `${JSON.stringify(own?.cls ?? null)} at ${AT}`);
    check(`M1: the FOREIGN arm puts an APItem on the same tile too`,
        foreign?.cls === 'Pickups::APItem', `${JSON.stringify(foreign?.cls ?? null)} at ${AT}`);

    // ⛔ AND THE LOOK, without a pixel. Spritemap vs Image, off `frame`.
    check(`M1: this slot's OWN item (${M1_SUBJECT.item}, look "${M1_SUBJECT.look}") draws a `
        + 'SPRITEMAP — the Seedling graphic',
    typeof own?.frame === 'number', `frame=${JSON.stringify(own?.frame ?? null)}`);
    check(`M1: a FOREIGN player's item (look "${FOREIGN_ENTRY?.look}") draws an IMAGE — `
        + 'the Archipelago logo',
    foreign !== null && foreign.frame === null,
    `frame=${JSON.stringify(foreign?.frame ?? null)}, alpha=${JSON.stringify(foreign?.alpha ?? null)}`);
    // ⛓ AND THE LOOKS REALLY DIFFER — the discriminator is not reading one arm
    // twice, and the two looks came out of the rewriter, not out of this file.
    check('M1: the two arms were built from DIFFERENT looks by the rewriter',
        M1_SUBJECT.look !== FOREIGN_ENTRY?.look && FOREIGN_ENTRY?.look === 'ap',
        `own "${M1_SUBJECT.look}" vs foreign "${FOREIGN_ENTRY?.look}"`);

    /**
     * ── (3) COLLECT IT: the check report, and the flag that flips ONCE ──────
     *
     * ⛔ THE BOOT IS THE ENTITY'S RAW OEL COORDINATE, NOT ITS RUNTIME ONE, and
     * that is measured. `Game`'s constructor offsets the PLAYER spawn by the
     * same half-tile every pickup applies — booting at `entity + TILE_HALF`
     * (where the pickup actually stands) put the player at `entity + 16`, ELEVEN
     * pixels off the item's 8x8 hitbox, and the first run read *"the APItem is
     * still on the tile"* for five seconds. Booting at the OEL coordinate lands
     * the player exactly where the pickup is.
     * ⚠ And the boot takes ~2 s to land: for the first two seconds `botStatus`
     * still reports the OUTGOING room's player position.
     */
    const collect = armOf('collect');
    check('M1 collect: the TAPE RAN — this is the row M1 could not write',
        collect.room?.status?.finished === true,
        `tick=${collect.room?.status?.tick}/10, dead=${collect.room?.status?.dead_frames}, `
        + `${((collect.room?.waitedMs ?? 0) / 1000).toFixed(1)} s`);
    check('M1 collect: configure took and the set was DELIVERED',
        !collect.error && collect.configured === 'ok' && collect.delivery?.state === 'delivered',
        collect.error ? `stopped: ${collect.error}` : `${collect.delivery?.state}`);
    /**
     * ⛔ THE ROW ASKS FOR THE CLASS, NOT FOR AN EMPTY TILE, and the first
     * spelling asked for the wrong thing. `atTile` returns the FIRST mobile at
     * a coordinate and the PLAYER is standing on that exact coordinate — it is
     * how they collected it — so `atTile(...) === null` was false on a run that
     * had already reported the check. A row that reads "Player" as "the item is
     * still here" cannot pass however the build behaves.
     */
    const stillThere = (collect.room?.mobiles?.mobiles ?? [])
        .filter((m) => m.cls === 'Pickups::APItem' && `${m.x},${m.y}` === AT);
    check('M1 collect: no APItem is left on the tile — the player walked onto it',
        stillThere.length === 0,
        `${JSON.stringify((collect.room?.mobiles?.mobiles ?? [])
            .filter((m) => `${m.x},${m.y}` === AT).map((m) => m.cls))} at ${AT}`);

    const checks = reportsNamed(collect, 'pendingCheck').filter((r) => r.value !== '');
    const want = `${M1_SUBJECT.level}|${M1_SUBJECT.tag}|0`;
    check(`M1 collect: pendingCheck reported the table's own address (…|${want})`,
        checks.some((r) => String(r.value).endsWith(`|${want}`)),
        JSON.stringify(checks.map((r) => r.value)));
    // ⛔ AND THE SEQ IS WHY THERE IS ONE AT ALL. BridgeGeneric reports only on
    // CHANGE, and this room's boot clears other slots too.
    check('M1 collect: every pendingCheck report carries a DISTINCT seq prefix',
        new Set(checks.map((r) => String(r.value).split('|')[0])).size === checks.length,
        `${checks.length} report(s)`);

    /**
     * ⛔⛔ THE ITEM GRANTED NOTHING, WHICH IS THE WHOLE DESIGN. Under the
     * canonical placement this location holds THIS slot's own `${M1_SUBJECT.item}`
     * — the identity case — so a build whose APItem wrote the flag would look
     * correct in the room and wrong here.
     */
    const flagBefore = reportsNamed(collect, M1_FLAG).filter((r) => r.value === true);
    check(`M1 collect: collecting it did NOT set ${M1_FLAG} — the APItem grants nothing`,
        flagBefore.length === 0, JSON.stringify(flagBefore));
    check('M1 collect: and keyMask/totemCount are still zero — no key, no totem part either',
        reportsNamed(collect, 'keyMask').every((r) => Number(r.value) === 0)
        && reportsNamed(collect, 'totemCount').every((r) => Number(r.value) === 0),
        JSON.stringify([reportsNamed(collect, 'keyMask').map((r) => r.value),
            reportsNamed(collect, 'totemCount').map((r) => r.value)]));

    const granted = (collect.afterGrant ?? []).filter((r) => r.name === M1_FLAG && r.value === true);
    check(`M1 grant: a synthetic ReceivedItems flips ${M1_FLAG} EXACTLY ONCE`,
        granted.length === 1, `${granted.length} true-report(s) after the write`);

    /**
     * ── (3b) THE SLOT, DECLARED CLEAR: persistence hides it and NOTHING ──────
     *         re-reports — `doActions`, driven
     *
     * ⛔⛔ THE RE-ENTRY CANNOT BE A SECOND BOOT ON THE SAME PAGE, AND THAT IS
     * MEASURED. `botStart` resets the WHOLE persistence table to all-true
     * before it builds the world — unconditionally, by ⚖ RULING 25
     * (`Bot.as:1637-1645`: *"the all-true table IS the fresh start"*) — and
     * then applies the tape's own declared clears on top. So a second
     * `botStart` after a collection UNDOES it: the first spelling of this row
     * booted back into L30 and read the `APItem` present again, which says
     * nothing about `APItem.check()` and everything about the harness's own
     * fresh-start guarantee.
     *
     * ⛓ The vehicle the harness DOES provide is the tape's `persistence` block,
     * which is exactly this claim in the tape's own vocabulary: declare the
     * subject's slot CLEARED and boot. `APItem.check()` reads
     * `!Game.checkPersistence(tag)` on the new world's first frame, sets
     * `doActions = false` and removes itself — so the item is absent AND the
     * removal does not re-report, which is the whole of trap 964's polarity and
     * the `doActions` latch in one arm.
     */
    const declared = armOf('declared-clear');
    check('M1 declared-clear: configure took, the set was DELIVERED and the tape ran',
        !declared.error && declared.configured === 'ok'
        && declared.delivery?.state === 'delivered'
        && declared.room?.status?.finished === true,
        declared.error ? `stopped: ${declared.error}`
            : `configure=${declared.configured} ${declared.delivery?.state} `
              + `tick=${declared.room?.status?.tick}`);
    const clearedRoster = (declared.room?.mobiles?.mobiles ?? []);
    check(`M1 declared-clear: the APItem is ABSENT with L${M1_SUBJECT.level} tag `
        + `${M1_SUBJECT.tag} cleared — so the collected marker really is the FALSE `
        + '(trap 964 said the brief\'s `true` would bring it back)',
    clearedRoster.length > 0 && clearedRoster.every((m) => m.cls !== 'Pickups::APItem'),
    `${clearedRoster.length} mobile(s): ${clearedRoster.map((m) => m.cls).join(', ')}`);
    /**
     * ⛔⛔ THE TAPE'S OWN DECLARATION REPORTS, AND THAT IS NOT THE APItem —
     * measured here, and it is the finding this row exists to state precisely.
     * `botStart` applies a declared clear through `Game.setPersistence(tag,
     * false, level)` (`Bot.as:1645`), which is the SAME choke point M1's
     * `pendingCheck` line sits in, so the harness's own declaration arrives as
     * `"1|30|4|0"` — seq 1, written BEFORE the world was built. (The all-true
     * reset above it does not: it calls `Main.levelPersistenceSet` directly.)
     *
     * ⛓ SO THE DISCRIMINATOR IS THE COUNT, AND IT IS NOT VACUOUS. If
     * `APItem.check()` did not set `doActions = false` before removing itself,
     * `removed()` would call `setPersistence` again and this arm would carry a
     * SECOND report at seq 2 — a check the player never earned, at a real
     * table address, on every re-entry to an already-collected room. One report
     * is the latch; two would be the defect. → §17.3.8: the bot's persistence
     * declaration is itself a host-visible check, which matters to anyone who
     * ever replays a tape with the check binding attached.
     */
    const clearedChecks = (declared.reports ?? [])
        .filter((r) => r.name === 'pendingCheck' && r.value !== '');
    check('M1 declared-clear: EXACTLY ONE pendingCheck — the TAPE\'s own declared clear, '
        + 'and none from the APItem removing itself (`doActions` is false)',
    clearedChecks.length === 1
        && String(clearedChecks[0].value) === `1|${M1_SUBJECT.level}|${M1_SUBJECT.tag}|0`,
    JSON.stringify(clearedChecks.map((r) => r.value)));

    /**
     * ── (3c) ⛓⛓⛓ THE HOST RESOLVES THE RUNTIME PAYLOAD ──────────────────────
     *
     * ⛔ THIS IS THE ROW THE UNIT SUITE CANNOT WRITE, AND IT IS WHY M1b EXISTS.
     * `seedlingCheckBinding.test.js` is thorough and every payload in it is a
     * string a human typed; the one thing it cannot see is whether the string
     * the GAME writes is that string. So the payload goes in VERBATIM, off the
     * report log, through the real `SeedlingCheckBinding` over the real
     * placement table — and the address it dispatches is compared with the
     * table's own entry for this location, not with a literal.
     */
    const observedCheck = checks.map((r) => String(r.value))
        .find((v) => v.endsWith(`|${want}`)) ?? null;
    const bindingFor = () => new SeedlingCheckBinding(
        { table, placementKey, selfPlayer: SELF_PLAYER });
    const dispatched = observedCheck === null ? []
        : bindingFor().onStateReport('pendingCheck', observedCheck);
    check('M1 host: the RUNTIME pendingCheck resolves to this location\'s AP address',
        dispatched.some((e) => e.type === 'locationCheck'
            && e.location === M1_SUBJECT.location
            && e.ledgerId === M1_SUBJECT.ledgerId),
        `${JSON.stringify(observedCheck)} -> ${JSON.stringify(dispatched.map((e) => e.type + ':'
            + (e.location ?? '')))}`);
    check(`M1 host: and it names the item the table placed there (${M1_SUBJECT.item} `
        + `for player ${M1_SUBJECT.player})`,
    dispatched.some((e) => e.type === 'apItemFound' && e.item === M1_SUBJECT.item
        && e.player === M1_SUBJECT.player && e.look === M1_SUBJECT.look),
    JSON.stringify(dispatched.find((e) => e.type === 'apItemFound') ?? null));

    // ⛔ THE MUTANTS, INLINE, ON THE SAME RUNTIME STRING (§17.3.6's labelling).
    // Each mutates ONE thing about the payload the game really wrote.
    check('M1 host MUTANT: the SAME report with the 4th field as a RESTORE (|1) '
        + 'dispatches NOTHING — six of ~50 writers restore a slot',
    observedCheck !== null
        && bindingFor().onStateReport('pendingCheck',
            `${observedCheck.slice(0, -1)}1`).length === 0,
    `${JSON.stringify(observedCheck === null ? null : `${observedCheck.slice(0, -1)}1`)}`);
    {
        const b = bindingFor();
        const first = observedCheck === null ? [] : b.onStateReport('pendingCheck', observedCheck);
        // ⛓ A SECOND report of the same clear, with a DIFFERENT seq — which is
        // what a re-entry would send if persistence had not hidden the item.
        const second = observedCheck === null ? []
            : b.onStateReport('pendingCheck', `99|${observedCheck.split('|').slice(1).join('|')}`);
        check('M1 host MUTANT: a SECOND clear of the same slot checks NOTHING — the latch',
            first.length === 2 && second.length === 0,
            `first ${first.length} effect(s), second ${second.length}`);
    }
    {
        // ⛓ A tag this table does NOT hold, at the same level: a lock, a boss,
        // a button. The common case by a wide margin, and it must be silent.
        const free = [...Array(64).keys()].find(
            (t) => !table.has(placementKey(M1_SUBJECT.level, t)));
        check(`M1 host MUTANT: a clear at an address the table does NOT hold `
            + `(L${M1_SUBJECT.level} tag ${free}) is SILENT`,
        free !== undefined && bindingFor().onStateReport('pendingCheck',
            `1|${M1_SUBJECT.level}|${free}|0`).length === 0);
    }

    // ── (4) THE DOOR: pendingExit fires, and it BEATS the level move ─────────
    for (const door of M1_DOORS) {
        const d = armOf(`door-${door.type}`);
        check(`M1 ${d.label}: the TAPE RAN`, d.room?.status?.finished === true,
            `tick=${d.room?.status?.tick}/${door.ticks}, dead=${d.room?.status?.dead_frames}, `
            + `${((d.room?.waitedMs ?? 0) / 1000).toFixed(1)} s`);
        check(`M1 ${d.label}: and the player MOVED — a walk that goes nowhere reports `
            + 'nothing for a reason that is not the seam',
        (d.room?.status?.x !== door.from.x + TILE_HALF)
            || (d.room?.status?.y !== door.from.y + TILE_HALF),
        `boot (${door.from.x},${door.from.y}) -> (${d.room?.status?.x},${d.room?.status?.y})`);
        check(`M1 ${d.label}: the page came up and configure took`,
            !d.error && d.configured === 'ok', d.error ? `stopped: ${d.error}` : `${d.configured}`);
        const exits = (d.reports ?? []).filter((r) => r.name === 'pendingExit' && r.value !== '');
        check(`M1 ${d.label}: pendingExit reported the door the player stepped on`,
            exits.some((r) => String(r.value).split('|').slice(1).join('|')
                === `${door.level}|${door.type}|${door.x}|${door.y}|${door.to}`),
            JSON.stringify(exits.map((r) => r.value)));
        /**
         * ⛔⛔ THE ORDERING IS THE POINT, AND IT IS WHY `pendingExit` IS
         * DECLARED ABOVE `level`. `new Game(to,..)` sets Main.level in its own
         * constructor, so both have moved by the time BridgeGeneric polls; what
         * decides which the host sees first is the declaration order.
         */
        const iExit = (d.reports ?? []).findIndex(
            (r) => r.name === 'pendingExit' && r.value !== '');
        /**
         * ⛔⛔ **SEARCHED AFTER THE EXIT, AND ASSERTED AS ADJACENCY — because
         * "after" alone would be a TAUTOLOGY.** As first written this was
         * `findIndex((r, n) => n > 0 && r.name === 'level' && Number(r.value)
         * === door.to)`: a scan from the START for the destination level. For
         * `door-teleporter` the destination is 18, which the game is never in
         * before the move, so it could only ever find the right report. For
         * `door-stairsup` the destination is **0 — the level the game BOOTS
         * IN** — so whenever the boot's own baseline echo landed inside the
         * captured window the row matched THAT and reported the level move
         * before the exit that caused it. MEASURED, P1-e run 1:
         * `pendingExit at 26, level=0 at 20`, with the sister door green at
         * `26 -> 27` in the same run; M1b's green `23 -> 24` was the same code
         * with the echo outside the window. A timing-sensitive ROW, not a game
         * order defect.
         *
         * ⛓ AND THE REPAIR IS NOT "SEARCH AFTER `iExit`" ON ITS OWN: a search
         * that starts after `iExit` and then asserts `> iExit` cannot fail, and
         * a row that cannot fail is not a row (this slice already paid for one
         * of those — see the ordering fixture in
         * `seedlingRandomizerWiring.test.js`). §11.2's claim is ADJACENCY —
         * `pendingExit` is declared immediately above `level` and BridgeGeneric
         * reports in declaration order, so the level move the door caused is
         * the VERY NEXT report. M1b measured exactly that twice (`23 -> 24`,
         * `26 -> 27`) and called it `+1` in prose without asserting it.
         */
        const iLevel = (d.reports ?? []).findIndex(
            (r, n) => n > iExit && r.name === 'level' && Number(r.value) === door.to);
        check(`M1 ${d.label}: the door report lands IMMEDIATELY BEFORE the level move it `
            + 'caused — adjacent, because both are one burst in declaration order',
        iExit >= 0 && iLevel === iExit + 1,
        `pendingExit at ${iExit}, level=${door.to} at ${iLevel}`);

        /**
         * ⛓⛓⛓ AND THE HOST TAKES THE CROSSING — ON THE STRING THE GAME WROTE.
         *
         * ⛔ THE WORLD IS SYNTHETIC AND THE PAYLOAD IS NOT, which is the only
         * split this row can honestly make: no committed atlas region declares
         * an `external` exit onto a seedling room (that is the maze/seedling
         * pairing W6 built the field for), so the exit list has to be
         * constructed. ⛓ BUT ITS `exit_id` IS NOT TYPED EITHER — it is
         * `outExitIdOf` applied to the door the GAME reported, so a report whose
         * coordinates disagreed with the atlas formula would not find it.
         */
        const observedExit = exits.map((r) => String(r.value)).find((v) => {
            const f = v.split('|');
            return f.length === 6 && Number(f[1]) === door.level && f[2] === door.type;
        }) ?? null;
        const worldWith = (external) => ({
            level: door.level,
            exits: [{
                exit_id: outExitIdOf(door),
                exitName: `seed.level_${door.level} -> elsewhere`,
                targetRegion: 'mz.mz_cross',
                ...(external
                    ? { external: true, target_substrate: 'maze', target_level: null,
                        target_spawn: null }
                    : { target_level: door.to, target_spawn: { x: 8, y: 8 } }),
                entrance_spawn: { x: 8, y: 8 },
            }],
        });
        const bindTo = (external) => {
            const b = new SeedlingRegionBinding();
            b.onLoadRegion({ region_id: `seed.level_${door.level}`, world: worldWith(external),
                arrivedFrom: null });
            b.onStateReport('level', door.level); // baseline
            return b;
        };
        const moved = observedExit === null ? []
            : bindTo(true).onStateReport('pendingExit', observedExit);
        check(`M1 ${d.label} host: the RUNTIME payload publishes a regionMove through `
            + `the exit id the ATLAS spells (${outExitIdOf(door)})`,
        moved.some((e) => e.type === 'regionMove' && e.exitId === outExitIdOf(door)
            && e.external === true && e.fromLevel === door.level && e.toLevel === door.to),
        `${JSON.stringify(observedExit)} -> ${JSON.stringify(moved.map((e) => e.type))}`);
        // ⛔ MUTANT, INLINE: the SAME runtime string against the SAME exit with
        // `external` dropped — an ordinary door inside this substrate, which
        // the `level` arm owns and this arm must not touch.
        check(`M1 ${d.label} host MUTANT: the same report on a SAME-SUBSTRATE exit `
            + 'emits NOTHING', observedExit !== null
            && bindTo(false).onStateReport('pendingExit', observedExit).length === 0);
        // ⛔ MUTANT, INLINE: the departure mark, spent — the swap's own level
        // report is swallowed once and a LATER genuine move is not.
        {
            const b = bindTo(true);
            const swallowed = observedExit === null ? ['x']
                : b.onStateReport('pendingExit', observedExit).length === 1
                    ? b.onStateReport('level', door.to) : ['x'];
            check(`M1 ${d.label} host: the swap's own level report is SWALLOWED, and the mark `
                + 'is spent ONCE', swallowed.length === 0 && b.pendingDeparture === null,
            `${JSON.stringify(swallowed)}, mark=${JSON.stringify(b.pendingDeparture)}`);
        }
    }

/**
 * ── ⛓⛓⛓ P1-e — THE PRESET-DRIVEN ROW THROUGH THE REAL PANEL ────────────────
 *
 * Every arm above drives the GAME PAGE directly and constructs the delivery
 * itself. These arms drive `frontend/index.html` — the app a person actually
 * opens — and assert that PRODUCTION does it: the panel detects eligibility
 * from the loaded preset's data, shows its overlay, builds the placement table
 * from the live `stateManager`, delivers, resets, binds, and reports a find.
 *
 * ⛔ NOTHING HERE CONSTRUCTS A DELIVERY. If a row passes, it passes because
 * `flashPanelUI._startSeedlingRandomizer` ran.
 *
 * ⛓ THE PRESET IS SWITCHED THE WAY THE FLASH GATES SWITCH IT —
 * `proxy.loadRules(rules, {playerId}, src)`, whose own precedent
 * (`verify-seedling-wasm-bridge.mjs:80-86`) calls it *"the flow a user takes
 * when picking the preset in the UI rather than the URL"*. That is also what
 * makes the CONTROL arm possible at all: the same preset with ONE field moved.
 *
 * ⛔ `--win` ONLY. The app page mounts the wasm game in an iframe and then
 * waits for a world to build; on SwiftShader that is ~0.45 fps and the whole
 * sequence is a frame budget, not a wall clock (trap 970/971).
 */
const PANEL_ARMS_ENABLED = WIN && !process.argv.includes('--no-panel');

const PANEL_JS = {
    /**
     * ⛓ THE WATCHER IS INSTALLED BEFORE THE PANEL CAN ACT. The overlay is up
     * only while the load runs, and the delivery inside it is SYNCHRONOUS — so
     * "was it ever shown?" cannot be answered by looking afterwards. A 50 ms
     * sampler records TRANSITIONS, which is the shape the claim has.
     */
    arm: `() => {
        window.__p1e = { overlay: [], t0: Date.now() };
        const state = () => {
            const el = document.querySelector('.flash-panel-ap-overlay');
            if (!el) return 'absent';
            return el.style.display === 'none' || el.style.display === '' ? 'hidden' : 'shown';
        };
        let last = null;
        window.__p1eTimer = setInterval(() => {
            const now = state();
            const el = document.querySelector('.flash-panel-ap-overlay');
            if (now !== last) {
                window.__p1e.overlay.push({ at: Date.now() - window.__p1e.t0, state: now,
                    text: el ? el.textContent : null });
                last = now;
            }
        }, 50);
        const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Game');
        if (tab) tab.click();
        return { tab: Boolean(tab), tabs: [...document.querySelectorAll('.lm_tab')]
            .map((t) => t.title) };
    }`,
    /**
     * Load a preset's rules, optionally with ONE field moved (the control).
     *
     * ⛔⛔ **THE APP BOOTS ON A FALLBACK PRESET, AND A SWITCH ISSUED BEFORE
     * THAT BOOT SETTLES IS SILENTLY CLOBBERED.** MEASURED, P1-e run 2: with
     * only a 6 s settle after the first Golden Layout tab appears,
     * `proxy.loadRules(<seedling>)` RESOLVED and the next step read
     * `{size: 25, sample: "Blue Labyrinth 0", flashPanelWasm: null}` — the
     * `adventure` fallback, whose own `rulesLoadedConfirmation` arrived after
     * ours and won. The panel had already mounted the seedling iframe and then
     * TORE IT DOWN on the reinit-for-preset-switch path, so the symptom two
     * steps later was `TimeoutError: no frame whose url contains '/wasm/'` —
     * with the wasm runtime's own boot lines sitting in the console log,
     * proving it had been there.
     *
     * ⇒ **wait for the fallback to LAND, then switch, then wait for the switch
     * to be VISIBLE in the proxy's own static data.** Neither wait is a sleep:
     * the first is "some rules are loaded", the second is "the rules I loaded
     * are the ones answered". `verify-seedling-wasm-bridge.mjs` has the same
     * fence spelled as an assertion (*"panel idle on the fallback preset"*).
     */
    loadPreset: `async ([src, patch]) => {
        const { default: proxy } = await import(
            '/frontend/modules/stateManager/stateManagerProxySingleton.js');
        const settle = async (want, deadlineMs) => {
            const t0 = Date.now();
            for (;;) {
                const sd = proxy.getStaticData();
                if (want(sd)) return sd;
                if (Date.now() - t0 > deadlineMs) return null;
                await new Promise((r) => setTimeout(r, 200));
            }
        };
        const fallback = await settle((sd) => Boolean(sd && sd.game_name), 120000);
        const rules = await fetch(src).then((r) => r.json());
        if (patch && patch.wasm) rules.flash_panel = { ...rules.flash_panel, wasm: patch.wasm };
        const want = rules.flash_panel ? rules.flash_panel.wasm : null;
        await proxy.loadRules(rules, { playerId: 1 }, src);
        const after = await settle(
            (sd) => Boolean(sd) && (sd.flash_panel ? sd.flash_panel.wasm : null) === want, 120000);
        return {
            wasm: want,
            fallbackGame: fallback ? fallback.game_name : null,
            settledGame: after ? after.game_name : null,
            settled: Boolean(after),
            locations: Object.keys(rules.regions || {}),
        };
    }`,
    /**
     * ⛔ THE PROXY'S OWN MAP, READ ON THE LIVE PAGE. In node the worker's
     * `getStaticGameData()` answers a Map directly; the proxy receives it
     * through a structured clone and converts it back
     * (`stateManagerProxy.js:398-404`). That round trip exists ONLY here, and
     * the AP-id join depends on the record still carrying its `id`.
     */
    staticShape: `async () => {
        const { default: proxy } = await import(
            '/frontend/modules/stateManager/stateManagerProxySingleton.js');
        const sd = proxy.getStaticData();
        const locs = sd && sd.locations;
        const first = locs && typeof locs.values === 'function'
            ? [...locs.values()][0] : null;
        return {
            isMap: locs instanceof Map,
            size: locs && locs.size !== undefined ? locs.size : null,
            playerId: sd ? sd.playerId : null,
            playerIdType: sd ? typeof sd.playerId : null,
            flashPanelWasm: sd && sd.flash_panel ? sd.flash_panel.wasm : null,
            sample: first ? { name: first.name, id: first.id,
                item: first.item ? { name: first.item.name, player: first.item.player } : null }
                : null,
        };
    }`,
    /** Everything the rows read, in one call. */
    observe: `async () => {
        const mod = await import('/frontend/modules/flashPanel/index.js');
        const panel = mod.getActivePanelInstance();
        const glue = mod.getSeedlingRegionGlue();
        const frame = document.getElementById(panel && panel.flashObjectId);
        const g = frame && frame.contentWindow && frame.contentWindow.__swfBridge
            ? frame.contentWindow.__swfBridge.game : null;
        const call = (n, a) => {
            if (!g || typeof g[n] !== 'function') return null;
            try { return a === undefined ? g[n]() : g[n](a); } catch (e) { return 'ERR:' + e.message; }
        };
        const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };
        const mobiles = parse(call('botMobiles'));
        const found = document.querySelector('.flash-panel-ap-found');
        return {
            load: panel && panel._apLoadResult
                ? { ok: panel._apLoadResult.ok, why: panel._apLoadResult.why,
                    reset: panel._apLoadResult.reset, steps: panel._apLoadResult.steps }
                : null,
            status: (document.querySelector('.flash-panel-status') || {}).textContent || null,
            log: [...document.querySelectorAll('.flash-panel-log > *')]
                .map((n) => n.textContent).slice(-40),
            overlay: window.__p1e ? window.__p1e.overlay : null,
            glueStats: glue ? glue.stats : null,
            hasDelivery: Boolean(glue && glue.delivery),
            deliveryState: glue && glue.delivery ? glue.delivery.state : null,
            deliveryStats: glue && glue.delivery ? glue.delivery.stats : null,
            hasCheckBinding: Boolean(glue && glue.checkBinding),
            hostOwned: glue && glue.checkBinding
                ? glue.checkBinding.hostOwnedLocations().size : null,
            levelSet: parse(call('botLevelSet')),
            status_bot: parse(call('botStatus')),
            roster: mobiles && mobiles.mobiles
                ? mobiles.mobiles.map((m) => m.cls + '@' + m.x + ',' + m.y) : null,
            readout: found ? { display: found.style.display,
                headline: (found.querySelector('.flash-panel-ap-found-headline') || {}).textContent,
                rows: (found.querySelector('.flash-panel-ap-found-rows') || {}).textContent } : null,
        };
    }`,
    /** Warp the player onto a tile, through the panel's own adapter. */
    warp: `async (to) => {
        const mod = await import('/frontend/modules/flashPanel/index.js');
        const panel = mod.getActivePanelInstance();
        panel.adapter.teleport(to);
        return to;
    }`,
    /** A synthetic ReceivedItems: the bridge's own item write, once. */
    grant: `async ([property, ms]) => {
        const mod = await import('/frontend/modules/flashPanel/index.js');
        const panel = mod.getActivePanelInstance();
        const frame = document.getElementById(panel.flashObjectId);
        const before = frame.contentWindow.__swfBridge.stateLog.length;
        frame.contentWindow.__swfBridge.queueItems({ class: 'main', property, value: true });
        await new Promise((r) => setTimeout(r, ms));
        return frame.contentWindow.__swfBridge.stateLog.slice(before);
    }`,
};

if (PANEL_ARMS_ENABLED) {
    const APP_URL = `http://localhost:${WIN_PORT}/frontend/?mode=flash`;
    const PRESETS = [
        { id: 'seedling_playthrough',
            src: './presets/seedling_playthrough/AP_1/AP_1_rules.json', expect: 'eligible' },
        { id: 'seedling',
            src: './presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json',
            expect: 'eligible' },
        { id: 'seedling_atlas',
            src: './presets/seedling_atlas/AP_1/AP_1_rules.json', expect: 'ineligible' },
    ];
    /**
     * ⛓ THE BOOT WAITS ONLY FOR THE LAYOUT; the preset fence is inside
     * `loadPreset`, where it can be a CONDITION rather than a duration.
     */
    const boot = { kind: 'app', ready_js: "() => !!document.querySelector('.lm_tab')",
        deadline_sec: 180 };
    const panelArm = (name, src, { patch = null, warp = null, grant = null } = {}) => {
        const steps = [
            { eval: PANEL_JS.arm, label: 'arm' },
            { eval: PANEL_JS.loadPreset, arg: [src, patch], label: 'loadPreset' },
            { eval: PANEL_JS.staticShape, label: 'staticShape' },
            // ⛔ THE ▶ IS A FRAME CLICK. The activation the parent document
            // holds does not travel into the child frame, and the wasm page
            // spends it on WebGPU and the AudioContext.
            /**
             * ⛓ THE PANEL SAYS WHEN IT IS READY FOR THE CLICK, and waiting on
             * ITS words rather than on a frame's existence is what makes this
             * step diagnosable: the status is a top-document fact that
             * survives the iframe being remounted.
             */
            { wait_js: `() => {
                const st = document.querySelector('.flash-panel-status');
                return Boolean(st) && /Start in the game/.test(st.textContent || '');
            }`, deadline_sec: 240, label: 'awaiting-start' },
            { frame_click: { iframe: '.flash-panel-swf iframe', contains: '/wasm/',
                selector: '#btn-start', deadline_sec: 240 }, label: 'start' },
            // The load sequence ends when the panel says so — polled, never slept.
            /**
             * ⛔ "THE OVERLAY IS NOT UP" IS TRUE BEFORE THE SEQUENCE STARTS,
             * so waiting on it alone passes instantly and every row below
             * reads a page that has not done anything yet. The wait is
             * therefore over the SAMPLER's record — a transition to `shown`
             * must have HAPPENED — or over the log line the ineligible path
             * writes instead. Same shape as trap 806: a condition that cannot
             * be false at the moment it is first asked is not a wait.
             */
            { wait_js: `() => {
                const w = window.__p1e;
                if (!w) return false;
                const logs = [...document.querySelectorAll('.flash-panel-log > *')]
                    .map((n) => n.textContent);
                if (logs.some((l) => /not applicable/.test(l))) return true;
                if (!w.overlay.some((o) => o.state === 'shown')) return false;
                const el = document.querySelector('.flash-panel-ap-overlay');
                if (!el) return true;
                if (el.style.display === 'none') return true;
                return el.style.color === 'rgb(233, 69, 96)';
            }`, deadline_sec: 180, label: 'settled', soft: true },
        ];
        if (warp) {
            steps.push({ eval: PANEL_JS.warp, arg: warp, label: 'warp' });
            steps.push({ sleep_ms: 6000 });
        }
        if (grant) steps.push({ eval: PANEL_JS.grant, arg: [grant, 6000], label: 'grant' });
        steps.push({ eval: PANEL_JS.observe, label: 'observe' });
        return { name, url: APP_URL, boot, steps };
    };

    /**
     * ⛔⛔ **A ROSTER ROW MUST BE READ IN THE ROOM IT IS ABOUT.** The first
     * shape of the control's *"the VANILLA pickup is PRESENT"* row read the
     * roster of LEVEL 0 — where the game boots and where nothing is rewritten
     * — and asked whether it held a pickup that lives in level 30. It could
     * never pass, which is the same failure as a row that can never fail: the
     * assertion is not about the thing it names. So both the eligible subject
     * arm and the control WARP to the subject room's own vanilla debug spawn
     * first, and then the two rosters are the discriminator the whole M1 block
     * is built on — `APItem` at that tile on p4d, the vanilla pickup at the
     * same tile on p4c.
     */
    const SUBJECT_ROOM = { level: M1_SUBJECT.level, x: SPAWN.x, y: SPAWN.y };
    const PANEL_PLAN = [
        panelArm(`panel-${PRESETS[0].id}`, PRESETS[0].src, { warp: SUBJECT_ROOM }),
        ...PRESETS.slice(1).map((p) => panelArm(`panel-${p.id}`, p.src)),
        /**
         * ⛔ THE CONTROL, AND IT IS THE MUTANT'S OWN ARM. The SAME preset with
         * `flash_panel.wasm` moved back to the build that declares NO `apitem`:
         * a lookup that ignored `capabilities` would read eligible here and
         * every row below would move.
         */
        panelArm('panel-control-p4c', PRESETS[0].src,
            { patch: { wasm: `${PAGE_NAME}/game.html` }, warp: SUBJECT_ROOM }),
        /** The check leg: warp onto the placement, then a synthetic receive. */
        panelArm('panel-check', PRESETS[0].src, {
            warp: { level: M1_SUBJECT.level, x: M1_SUBJECT.entity.x, y: M1_SUBJECT.entity.y },
            grant: M1_FLAG,
        }),
    ];

    console.log(`\n── P1-e — the real panel, ${PANEL_PLAN.length} arm(s) on ${APP_URL} ──`);
    let PANEL = new Map();
    try {
        PANEL = new Map(runArmsWin(PANEL_PLAN).map((r) => [r.name, r]));
    } catch (e) {
        console.log(`  DRIVER FAILED: ${e.message.split('\n')[0]}`);
    }
    const valueOf = (rec, label) => rec?.results?.find((r) => r.eval === label)?.value ?? null;
    const panelOf = (name) => PANEL.get(name) ?? null;

    for (const preset of PRESETS) {
        const rec = panelOf(`panel-${preset.id}`);
        const obs = valueOf(rec, 'observe');
        const shape = valueOf(rec, 'staticShape');
        const eligible = preset.expect === 'eligible';
        const tag = `P1-e ${preset.id}`;

        check(`${tag}: the arm ran and the panel reached a settled state`,
            Boolean(rec) && !rec.crashed && Boolean(obs),
            rec?.error ?? `boot ${rec?.boot_sec ?? '?'}s, status=${obs?.status ?? 'none'}`);
        if (!obs) continue;

        /**
         * ⛔ THE PROXY'S MAP SURVIVES THE STRUCTURED CLONE, WITH THE `id`. This
         * is the one shape node cannot see, and the whole AP-id join rests on
         * it (`stateManagerProxy.js:398-404`).
         */
        check(`${tag}: getStaticData().locations is a Map whose records carry an id and an item`,
            shape?.isMap === true && Number.isInteger(shape?.sample?.id)
                && typeof shape?.sample?.item?.name === 'string',
        JSON.stringify(shape));
        check(`${tag}: the slot is a STRING, so Number('') === 0 is a live risk and is guarded`,
            shape?.playerIdType === 'string', `${shape?.playerIdType} ${JSON.stringify(shape?.playerId)}`);
        const lp = valueOf(rec, 'loadPreset');
        check(`${tag}: the preset switch SETTLED — the fallback landed first and did not `
            + 'clobber it', lp?.settled === true,
        `fallback=${JSON.stringify(lp?.fallbackGame)} -> settled=${JSON.stringify(lp?.settledGame)}`);
        check(`${tag}: the panel loaded the p4d page the preset names`,
            String(shape?.flashPanelWasm ?? '').startsWith(M1_PAGE),
            String(shape?.flashPanelWasm));

        const shown = (obs.overlay ?? []).filter((o) => o.state === 'shown');
        const hidden = (obs.overlay ?? []).filter((o) => o.state === 'hidden');
        if (eligible) {
            /**
             * ⛔ "OFF" IS `hidden` OR `absent`, AND THE SUCCESSFUL PATH IS
             * `absent`. The sequence calls `overlay.hide()`, and then
             * `flashPanelUI`'s `finally` runs `detachSafetyNet()`, which
             * REMOVES a non-sticky element from the DOM — so a load that went
             * perfectly ends with the element gone, not merely hidden.
             * MEASURED (run 4): `…{"at":23389,"state":"shown"},
             * {"at":24194,"state":"absent"}` on both eligible presets, i.e. the
             * overlay behaved exactly as designed and the ROW was wrong about
             * the design. Written as "hidden after shown" it asserted a state
             * the happy path does not end in.
             */
            const off = (obs.overlay ?? []).filter(
                (o) => o.state === 'hidden' || o.state === 'absent');
            check(`${tag}: the overlay was observed ON and then OFF`,
                shown.length > 0 && off.length > 0 && off.at(-1).at > shown[0].at,
                JSON.stringify(obs.overlay));
            check(`${tag}: the delivery was SENT exactly once`,
                obs.deliveryState === 'delivered' && obs.deliveryStats?.delivered === 1
                    && obs.deliveryStats?.attempts === 1,
                JSON.stringify(obs.deliveryStats));
            check(`${tag}: the mounted set is the REWRITTEN one, read back out of the game`,
                typeof obs.levelSet?.active === 'string'
                    && obs.levelSet.active.startsWith('seedling-ap-record'),
                JSON.stringify(obs.levelSet));
            check(`${tag}: the check binding is attached, and OWNS locations`,
                obs.hasCheckBinding === true && obs.hostOwned > 0,
                `hostOwned=${obs.hostOwned}`);
            /**
             * ⛔⛔ **THE RESET'S END STATE CANNOT BE THE WITNESS FOR THIS SET.**
             * Every set this slice delivers has `start.level === 0`, which is
             * the level the game BOOTS into — so *"the player stands at the
             * set's start level"* is true before the reset is even issued and
             * cannot fail. The falsifiable claims are the ones the sequence
             * RECORDED: that a reset was issued at all, in the mode the DATA
             * chose, and what the world read before and after it.
             */
            const resetStep = (obs.load?.steps ?? []).find((s) => s.name === 'reset-end');
            const beganStep = (obs.load?.steps ?? []).find((s) => s.name === 'reset-begin');
            check(`${tag}: a reset was ISSUED, in the mode the SET's own start chose`,
                beganStep?.detail?.mode === 'new-game-arm'
                    && beganStep?.detail?.level === -1
                    && beganStep?.detail?.expectLevel === (REWRITTEN_SET.start?.level ?? 0),
                JSON.stringify(beganStep?.detail));
            check(`${tag}: the reset was OBSERVED, polled rather than slept`,
                resetStep?.detail?.landed === true,
                `waited ${((resetStep?.detail?.waitedMs ?? 0) / 1000).toFixed(2)} s, `
                + `level=${resetStep?.detail?.level}, roster ${resetStep?.detail?.rosterSize}, `
                + `player ${JSON.stringify(resetStep?.detail?.player)}, `
                + `moved=${resetStep?.detail?.moved}`);
            if (preset.id === PRESETS[0].id) {
                check(`${tag}: an APItem stands at the rewritten tile in ${M1_SUBJECT.location}`,
                    (obs.roster ?? []).some((m) => m.includes('APItem')
                        && m.endsWith(`@${M1_SUBJECT.entity.x + TILE_HALF},`
                            + `${M1_SUBJECT.entity.y + TILE_HALF}`)),
                    JSON.stringify((obs.roster ?? []).slice(0, 10)));
            }
            check(`${tag}: the step log is the ruled sequence, in order`,
                JSON.stringify((obs.load?.steps ?? []).map((s) => s.name))
                    === JSON.stringify(['overlay-on', 'deliver-begin', 'deliver-end',
                        'reset-begin', 'reset-end', 'bind', 'overlay-off']),
                JSON.stringify((obs.load?.steps ?? []).map((s) => s.name)));
            // ⛓ REPORTED, never asserted: whether the new-game arm's ceremony
            // moved the world at all is the thing nobody has measured yet.
            console.log(`       ${tag} reset ceremony — before `
                + `${JSON.stringify(beganStep?.detail?.world)} after `
                + `{"level":${resetStep?.detail?.level},"rosterSize":`
                + `${resetStep?.detail?.rosterSize},"time":${resetStep?.detail?.time},"player":`
                + `${JSON.stringify(resetStep?.detail?.player)}}  moved=`
                + `${resetStep?.detail?.moved}`);
        } else {
            // ⛓ THE DATA-INELIGIBLE ARM. Nothing was delivered, nothing bound,
            // and the panel SAID WHY rather than doing nothing quietly.
            check(`${tag}: no delivery and no binding — it is not a Seedling placement`,
                obs.hasDelivery === false && obs.hasCheckBinding === false,
                `delivery=${obs.hasDelivery} binding=${obs.hasCheckBinding}`);
            check(`${tag}: the overlay never came up`, shown.length === 0,
                JSON.stringify(obs.overlay));
            check(`${tag}: the panel log NAMES the failing predicate`,
                (obs.log ?? []).some((l) => /not applicable/.test(l) && /placement/.test(l)),
                JSON.stringify((obs.log ?? []).filter((l) => /not applicable/.test(l))));
        }
    }

    // ── the CONTROL: the same preset on the build that declares no apitem ────
    {
        const rec = panelOf('panel-control-p4c');
        const obs = valueOf(rec, 'observe');
        check('P1-e CONTROL: the arm ran', Boolean(obs),
            rec?.error ?? `boot ${rec?.boot_sec ?? '?'}s, ${obs ? 'observed' : 'NO observation'}`);
        if (obs) {
            check('P1-e CONTROL: p4c declares no `apitem`, so NOTHING is delivered or bound',
                obs.hasDelivery === false && obs.hasCheckBinding === false,
                `delivery=${obs.hasDelivery} binding=${obs.hasCheckBinding}`);
            check('P1-e CONTROL: and the refusal NAMES the capability check',
                (obs.log ?? []).some((l) => /does not declare/.test(l)),
                JSON.stringify((obs.log ?? []).filter((l) => /not applicable/.test(l))));
            check('P1-e CONTROL: the VANILLA pickup is present at the same tile — the '
                + 'discriminator, read in the room it is about',
                (obs.roster ?? []).some((m) => m.endsWith(
                    `@${M1_SUBJECT.entity.x + TILE_HALF},${M1_SUBJECT.entity.y + TILE_HALF}`)),
                JSON.stringify((obs.roster ?? []).slice(0, 8)));
        }
    }

    // ── the CHECK LEG, through production ────────────────────────────────────
    {
        const rec = panelOf('panel-check');
        const obs = valueOf(rec, 'observe');
        const granted = valueOf(rec, 'grant') ?? [];
        check('P1-e check: the arm ran', Boolean(obs),
            rec?.error ?? `boot ${rec?.boot_sec ?? '?'}s, ${obs ? 'observed' : 'NO observation'}`);
        if (obs) {
            check('P1-e check: the glue dispatched exactly one location check',
                obs.glueStats?.locationChecks === 1,
                JSON.stringify(obs.glueStats));
            check(`P1-e check: and it reported the item the table placed there `
                + `(${M1_SUBJECT.item} for player ${M1_SUBJECT.player})`,
            obs.glueStats?.itemsFound === 1
                && (obs.log ?? []).some((l) => l.includes(M1_SUBJECT.item)),
            JSON.stringify((obs.log ?? []).filter((l) => /ap placement/.test(l)).slice(-4)));
            check('P1-e check: the READOUT element shows the find',
                obs.readout?.display === 'block'
                    && /1 placement found/.test(obs.readout?.headline ?? '')
                    && (obs.readout?.rows ?? '').includes(M1_SUBJECT.item),
                JSON.stringify(obs.readout));
            check(`P1-e check: a synthetic ReceivedItems flips ${M1_FLAG} ONCE`,
                granted.filter((r) => r.name === M1_FLAG && String(r.value) === 'true').length === 1,
                JSON.stringify(granted.map((r) => `${r.name}=${r.value}`)));
        }
    }
} else if (!WIN) {
    // ⛔ SKIPPED BY NAME. Headless SwiftShader is ~0.45 fps and this sequence
    // waits for two world builds; a green run there would be a green run of
    // something else.
    console.log('\nSKIP: P1-e (the real panel) runs on --win only — real-GPU Windows Chrome');
}
}

await browser.close();
await closeServer(server);
console.log(`\n${failures === 0 ? 'ALL ROWS PASSED' : `${failures} ROW(S) FAILED`} — `
    + `${PAGE_NAME}, END ${new Date().toISOString()}`);
process.exit(failures === 0 ? 0 : 1);
