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
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const tapeFor = (level, spawn) => JSON.stringify(parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { level, x: spawn.x, y: spawn.y },
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 987286273, split: false, cosmetic: 0, fp: 0 },
    tick_count: 0,
    inputs: [],
}));

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

        // ── the one boot, then the roster ────────────────────────────────
        out.room = await page.evaluate(async ([t]) => {
            const g = window.__swfBridge.game;
            const loaded = g.botLoadTape(t);
            const started = g.botStart();
            await new Promise((r) => setTimeout(r, 3000));
            let mobiles = null;
            try { mobiles = JSON.parse(g.botMobiles()); } catch { mobiles = null; }
            let status = null;
            try { status = JSON.parse(g.botStatus()); } catch { status = null; }
            return { loaded, started, mobiles, level: status?.level ?? null };
        }, [tapeFor(subject.level, subject.spawn)]);
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
    check(`${key}: botLoadTape/botStart both took, and botStatus says level ${r.level}`,
        r.room?.loaded === 'ok' && r.room?.level === r.level,
        `loaded=${JSON.stringify(r.room?.loaded)} started=${JSON.stringify(r.room?.started)} `
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

await browser.close();
await closeServer(server);
console.log(`\n${failures === 0 ? 'ALL ROWS PASSED' : `${failures} ROW(S) FAILED`} — `
    + `${PAGE_NAME}, END ${new Date().toISOString()}`);
process.exit(failures === 0 ? 0 : 1);
