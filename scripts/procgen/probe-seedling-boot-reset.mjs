#!/usr/bin/env node
/**
 * probe-seedling-boot-reset — **TWO WINDOWS ON ONE PAGE, AND WHAT THE SECOND
 * ONE INHERITS.**
 *
 * ⚖ Ruling 25 (user, 2026-08-22): *"I thought it was supposed to initialize the
 * persistence data to how it would be in a fresh start unless something
 * deliberately overrides that. But apparently that's not what was happening."*
 * `Bot.as`'s `botStart` gated its persistence sweep on
 * `persistLevel.length > 0` and its save-array reset on
 * `saveTotemParts.length > 0 || saveKeys.length > 0 || saveSealParts.length > 0`,
 * so a tape that DECLARED NOTHING took no reset at all and inherited whatever
 * the page happened to hold. This row is that sentence made measurable.
 *
 * ── ⛔ WHY IT IS ITS OWN INSTRUMENT AND NOT A `--tapes` RUN ─────────────
 *
 * `seedling-bot-replay-win.py --tapes` cannot express this run. Its boundary
 * guard refuses window k+1 whose declared UNTIMED persistence set differs from
 * the live world's `persistence_cleared` — which is EXACTLY the mutant's shape
 * (window 1 clears a flag, window 2 declares nothing). The guard is right for
 * a solver chain and it is the reason this probe exists rather than a flag on
 * that driver: a safety gate that also blocks its own defect's measurement
 * should be measured AROUND, never loosened.
 *
 * ── WHAT IT DRIVES ──────────────────────────────────────────────────────
 *
 * ARM 1 — PERSISTENCE. Window 1 is a v3 tape declaring one clear
 * (`{level, tag}`); window 2 is a v3 tape on the same level declaring
 * `persistence: []`. It reads `botStatus.persistence_cleared` — the GAME's own
 * table, never an echo of the tape — after each `botStart`.
 * ARM 2 — THE SAVE ARRAYS. Window 1 is a v6 tape presenting one totem part;
 * window 2 a v6 tape presenting an empty save block. It reads
 * `botStatus.save.totem_parts`, likewise read back from the game.
 *
 * Neither arm walks: `botStart` applies the boot state BEFORE the world is
 * built (`Bot.as:1587`), so the state is complete at tick 0 and no input is
 * needed to see it. Both windows are on ONE page on purpose — a fresh page per
 * tape is what hid the defect for the whole arc.
 *
 * ── THE VERDICT ─────────────────────────────────────────────────────────
 *
 *   INHERITS  window 2 still holds window 1's flag / part — the guards are in
 *   FRESH     window 2 holds nothing — the reset is unconditional
 *
 * It PRINTS the verdict and exits 0 either way unless `--expect=` is given:
 * `--expect=fresh` (or `inherits`) turns it into a gate. That split is
 * deliberate — the same command is the BEFORE measurement and the AFTER
 * assertion, and a probe that could only assert one of them could not be the
 * before.
 *
 * USAGE
 *   node scripts/procgen/probe-seedling-boot-reset.mjs
 *   node scripts/procgen/probe-seedling-boot-reset.mjs --expect=fresh
 *   SEEDLING_PAGE=seedling_bot_ap_p4bctl node scripts/procgen/probe-seedling-boot-reset.mjs
 *
 * Headless swiftshader, like `check-seedling-wasm-pages.mjs` — it needs no GPU
 * because it takes no live ticks. Needs a dev server at the repo root on :8000.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split('=').slice(1).join('=');
const HOST = arg('host', 'http://localhost:8000');
const PAGE_NAME = process.env.SEEDLING_PAGE || arg('page', 'seedling_bot_ap_p4b');
const EXPECT = arg('expect', '');
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

// The room and flag the arm uses. L0 tag 1 is a `breakablerock` in the
// committed roster (`r2-walk-1-sword-shield` declares it), so the tag is one
// the game really has rather than a number this file invented.
const LEVEL = 0;
const TAG = 1;
const BOOT = { level: LEVEL, x: 80, y: 128 };   // Main.as:51, the build's spawn

const base = (version, name) => ({
    tape_version: version,
    game: 'seedling',
    name,
    boot: { ...BOOT },
    noclip: false,
    noDamage: true,
    noHazards: [],
    grants: [],
    persistence: [],
    tick_count: 1,
    inputs: [],
});
const TAPES = {
    persistenceDeclares: {
        ...base(3, 'probe-boot-reset-w1'),
        persistence: [{ level: LEVEL, tag: TAG, note: 'the flag window 2 must not inherit' }],
    },
    persistenceEmpty: { ...base(3, 'probe-boot-reset-w2') },
    saveDeclares: {
        ...base(6, 'probe-boot-reset-w1-save'),
        pins: [],
        equips: [],
        save: { totem_parts: [0], keys: [], seal_parts: [] },
    },
    saveEmpty: {
        ...base(6, 'probe-boot-reset-w2-save'),
        pins: [],
        equips: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
    },
};

const browser = await chromium.launch({
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader', '--no-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
console.log(`page: ${PAGE_URL}`);
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
await page.click('#btn-start', { timeout: 60000 });
// The bridge appears only once the runtime is up and the SWF is running; a
// wait on the ELEMENT would pass on a page that never booted.
await page.waitForFunction(
    () => typeof window.__swfBridge?.game?.botStatus === 'function',
    null, { timeout: 240000 });

const call = (name, a) => page.evaluate(([n, x]) => {
    const g = window.__swfBridge.game;
    return x === undefined ? g[n]() : g[n](x);
}, [name, a ?? undefined]);
const status = async () => JSON.parse(await call('botStatus'));

async function window_(tape) {
    const loaded = await call('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') throw new Error(`botLoadTape(${tape.name}): ${loaded}`);
    const started = await call('botStart');
    if (started !== 'ok') throw new Error(`botStart(${tape.name}): ${started}`);
    return status();
}

const rows = [];
const say = (label, value) => { rows.push([label, value]); console.log(`  ${label}: ${value}`); };

console.log('\n## ARM 1 — PERSISTENCE');
const p1 = await window_(TAPES.persistenceDeclares);
const cleared1 = (p1.persistence_cleared || []).map((r) => `${r.level}:${r.tag}`).sort();
say('window 1 declares one clear, the game holds', JSON.stringify(cleared1));
const p2 = await window_(TAPES.persistenceEmpty);
const cleared2 = (p2.persistence_cleared || []).map((r) => `${r.level}:${r.tag}`).sort();
say('window 2 declares NOTHING, the game holds', JSON.stringify(cleared2));
const persistenceVerdict = cleared2.length === 0 ? 'FRESH' : 'INHERITS';
say('ARM 1 VERDICT', persistenceVerdict);

console.log('\n## ARM 2 — THE SAVE ARRAYS');
const s1 = await window_(TAPES.saveDeclares);
say('window 1 presents totem part 0, the game holds',
    JSON.stringify(s1.save?.totem_parts ?? null));
const s2 = await window_(TAPES.saveEmpty);
const held2 = s2.save?.totem_parts ?? [];
say('window 2 presents an EMPTY save, the game holds', JSON.stringify(held2));
const saveVerdict = (Array.isArray(held2) ? held2.filter(Boolean).length : 1) === 0
    ? 'FRESH' : 'INHERITS';
say('ARM 2 VERDICT', saveVerdict);

await browser.close();

console.log(`\nVERDICT persistence=${persistenceVerdict} save=${saveVerdict}`);
if (EXPECT) {
    const want = EXPECT.toUpperCase();
    const ok = persistenceVerdict === want && saveVerdict === want;
    console.log(ok ? `PASS — both arms are ${want}` : `FAIL — expected both ${want}`);
    process.exit(ok ? 0 : 1);
}
