#!/usr/bin/env node
/**
 * check-seedling-vanilla-manifest — the built-in `seedling-vanilla` manifest,
 * read out of the BUILT ARTIFACT and compared with the committed JSON twin.
 *
 * Phase 3b of `CC/docs/plans/seedling-external-level-sets.md` (§4.3, §3.5).
 *
 * ── WHAT THIS EXISTS TO CATCH ─────────────────────────────────────────
 *
 * Phase 3b DELETES literals from `Game.as` — the music table, the title-screen
 * rooms, the start level, the snow room, the music-exempt room, and the six
 * code-built room references — and makes the game read them from a manifest
 * instead. Two things can go wrong that no tape replay would notice:
 *
 *   1. the manifest says something different from the literal it replaced
 *      (a mistranscribed music index changes which song plays in one room —
 *      not a position, not a level, and not in any observation stream);
 *   2. the manifest is right and nothing seeds it (`Game.levelMusics` is the
 *      copy the bosses write; a seeding step that never ran leaves the right
 *      DATA behind a table the game does not use).
 *
 * ⇒ both halves are reported by `botLevelSet()` and both are compared here.
 * `musics` is the manifest; `musics_live` is `Game.levelMusics` at boot,
 * before any boss has woken. Reading only one of them could not tell those two
 * failures apart.
 *
 * ── ⛓ THE TWIN IS INDEPENDENT, WHICH IS WHAT MAKES THIS A CHECK ───────
 *
 * `fixtures/seedling-vanilla-set.json` was produced by
 * `scripts/procgen/extract-seedling-vanilla-set.py` (Phase 2) reading the OEL
 * corpus and `Game.as` with Python ElementTree. `VanillaSet.as` is the AS3
 * literal, MOVED out of `Game.as`. Neither was derived from the other, so an
 * agreement between them is evidence rather than a tautology — and the
 * comparison happens through the wasm, so it covers the build as well as the
 * source.
 *
 * ⚠ WHAT IT DOES NOT COVER, stated rather than left to be discovered:
 *   · room NAMES. The twin carries them; the AS3 manifest deliberately does
 *     not (position is identity, and 116 strings buy nothing in the game).
 *   · the two `Game.as` CALL SITES that cannot execute in this artifact —
 *     `Main.as:50` sets `Game.menu = false` and `:51` boots an explicit level,
 *     so the title-screen and new-game paths are dead here. The ACCESSORS they
 *     would call are exercised (`botLevelSet` calls them); the one-line
 *     substitutions that call them are not, in this build or any tape.
 *   · that the right room loads — that is the tape sweep's job
 *     (`verify-seedling-bot-differential.mjs`), which drives 116 rooms'
 *     geometry through the same resolver.
 *
 * ⛔ REAL-GPU WINDOWS CHROME (⚖ user), on `seedling-level-set-win.py` — the
 * same dumb driver phase 3's transport probe uses. Nothing here waits for a
 * world to be built, so software rendering would not race; the rule is the
 * user's and there is no reason to make this the exception.
 *
 * Run (dev server on :8000):
 *   node scripts/procgen/check-seedling-vanilla-manifest.mjs
 *   SEEDLING_PAGE=seedling_bot_ap_phase3 node scripts/procgen/…   # the PHASE 3
 *       build, which has no manifest at all and must FAIL every arm
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_3b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

const WIN_WSL = '/mnt/c/playwright';
const WIN_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const DRIVER = join(HERE, 'seedling-level-set-win.py');

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { validateLevelSet } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/levelSetValidator.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));

/** A zero-input tape that just boots the start room, so a world gets built. */
const BOOT_TAPE = JSON.stringify(parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { level: 0, x: 80, y: 128 },
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

const VANILLA = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The first index where two arrays differ, for a failure that names itself. */
const firstDiff = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return `not both arrays (${typeof a} vs ${typeof b})`;
    if (a.length !== b.length) return `lengths ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i += 1) {
        if (!eq(a[i], b[i])) return `index ${i}: ${JSON.stringify(a[i])} vs ${JSON.stringify(b[i])}`;
    }
    return 'equal';
};

// ── what the twin says ───────────────────────────────────────────────────────

const twinMusics = VANILLA.rooms.map((r) => r.music);
const twinSnow = VANILLA.rooms.filter((r) => r.snow_gradient).map((r) => r.id);
const twinExempt = VANILLA.rooms.filter((r) => r.music_override_exempt).map((r) => r.id);
// ⛔ THE DEFAULTS ARE THE GAME'S, NOT ZERO. The schema says an omitted x/y on a
// named room means the `Game` constructor's own (80, 128) — `Game.as:629`. A
// checker that expected 0 here would fail the roomRef-shaped entry for being
// right. ⚠ Phase 4 widened `moonrock_target` to carry a real arrival, so
// `watcher_text` is now the ONLY entry this default applies to; the moonrock's
// (48, 32) is asserted as data, not as a fallback.
const twinNamed = Object.fromEntries(Object.entries(VANILLA.named_rooms).map(
    ([name, ref]) => [name, { level: ref.level, x: ref.x ?? 80, y: ref.y ?? 128 }]));

// ── the arms ─────────────────────────────────────────────────────────────────

const arms = [
    { name: 'the manifest at boot', steps: [{ call: 'botLevelSet' }] },
    {
        // ⛓ THE ROSTER IS THE WITNESS THAT A ROOM WAS BUILT. `botStatus`'s
        // `level` is `Main.level`, which is set whether or not a room loaded —
        // an empty world would report level 0 and look healthy. The mobiles a
        // room built cannot be faked by the level counter, and for vanilla they
        // can only have come through the EMBED arm, because no vanilla room
        // carries `source.xml`.
        name: 'the manifest after the game has been running',
        steps: [
            { call: 'botLoadTape', arg: BOOT_TAPE },
            { call: 'botStart' },
            { sleep_ms: 3000 },
            { call: 'botMobiles' },
            { call: 'botStatus' },
            { call: 'botLevelSet' },
        ],
    },
];

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-level-set-win.py'), readFileSync(DRIVER));
const planWsl = join(WIN_WSL, 'manifest-plan.json');
const outWsl = join(WIN_WSL, 'manifest-results.json');
writeFileSync(planWsl, JSON.stringify({ url: PAGE_URL, arms }));
try { unlinkSync(outWsl); } catch { /* first run */ }

console.log(`# the built-in vanilla manifest, read out of ${PAGE_NAME}`);
console.log(`  twin: fixtures/seedling-vanilla-set.json (${VANILLA.rooms.length} rooms, ${VANILLA.set_id})\n`);

let driverOut;
try {
    driverOut = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-level-set-win.py`,
        '--plan', `${WIN_DOS}\\manifest-plan.json`,
        '--out', `${WIN_DOS}\\manifest-results.json`,
    ], { cwd: WIN_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
    const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
    console.log(`DRIVER FAILED: ${e.message}\n${said}`);
    process.exit(1);
}
driverOut.replace(/\r/g, '').split('\n')
    .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
    .forEach((l) => console.log(`  ${l}`));

const results = JSON.parse(readFileSync(outWsl, 'utf8'));
const byName = new Map(results.arms.map((a) => [a.name, a]));
const lastOf = (armName, callName) => {
    const a = byName.get(armName);
    if (!a) throw new Error(`the driver returned no arm named ${JSON.stringify(armName)}`);
    const vals = a.results.filter((r) => r.call === callName).map((r) => r.value);
    return vals.length === 0 ? undefined : vals[vals.length - 1];
};
const parse = (raw) => (raw == null ? null : JSON.parse(raw));

console.log('');
const boot = parse(lastOf('the manifest at boot', 'botLevelSet'));
check('the boot arm answered botLevelSet at all', boot != null,
    boot == null ? 'null — this build has no botLevelSet, or the page died' : `set ${boot.active}`);

if (boot != null) {
    // ── identity and size ────────────────────────────────────────────────
    check('the ACTIVE set is the vanilla manifest', boot.active === VANILLA.set_id,
        `${boot.active} vs ${VANILLA.set_id}`);
    check('nothing was DELIVERED — vanilla is built in, not mounted over',
        boot.mounted === null, `mounted: ${JSON.stringify(boot.mounted)}`);
    check('the table is the set\'s length', boot.rooms === VANILLA.rooms.length,
        `${boot.rooms} vs ${VANILLA.rooms.length}`);
    check('the compiled-in embeds still number the same',
        boot.built_in === VANILLA.rooms.length, `${boot.built_in}`);
    check('no level-set refusal happened on the way to here',
        boot.error === '', JSON.stringify(boot.error));

    // ── the six §3.5 constants ───────────────────────────────────────────
    check('MUSICS: the manifest equals the twin', eq(boot.musics, twinMusics),
        firstDiff(boot.musics, twinMusics));
    check('MUSICS: Game.levelMusics was SEEDED from it',
        eq(boot.musics_live, twinMusics), firstDiff(boot.musics_live, twinMusics));
    check('MENU ROOMS: menuRoom(0..n-1) equals the twin',
        eq(boot.menu_rooms, VANILLA.menu_rooms), firstDiff(boot.menu_rooms, VANILLA.menu_rooms));
    check('MENU ROOMS: menuRoomCount() equals the twin\'s length',
        boot.menu_room_count === VANILLA.menu_rooms.length,
        `${boot.menu_room_count} vs ${VANILLA.menu_rooms.length}`);
    check('START: startLevel equals the twin', boot.start_level === VANILLA.start.level,
        `${boot.start_level} vs ${VANILLA.start.level}`);
    check('SNOW: hasSnowGradient picks out the twin\'s rooms',
        eq(boot.snow_rooms, twinSnow), `${JSON.stringify(boot.snow_rooms)} vs ${JSON.stringify(twinSnow)}`);
    check('MUSIC EXEMPT: isMusicExempt picks out the twin\'s rooms',
        eq(boot.music_exempt_rooms, twinExempt),
        `${JSON.stringify(boot.music_exempt_rooms)} vs ${JSON.stringify(twinExempt)}`);

    // ── the six code-built references ────────────────────────────────────
    const got = boot.named_rooms || {};
    check('NAMED ROOMS: the same six names, no more and no fewer',
        eq(Object.keys(got).sort(), Object.keys(twinNamed).sort()),
        `${JSON.stringify(Object.keys(got).sort())}`);
    // ⚠ FIELD BY FIELD, NOT BY `JSON.stringify`. AS3's serializer emits object
    // keys in its own order (`{y, x, level}`), so a stringify comparison
    // reported all six of these as failures while every value was right — a
    // checker bug that reads exactly like a defect in the thing under test.
    for (const [name, want] of Object.entries(twinNamed)) {
        const mine = got[name] || {};
        const wrong = ['level', 'x', 'y'].filter((k) => mine[k] !== want[k]);
        check(`NAMED ROOMS: ${name} resolves to the twin's room and arrival`,
            wrong.length === 0,
            wrong.length === 0
                ? `level ${want.level} at (${want.x}, ${want.y})`
                : wrong.map((k) => `${k} ${mine[k]} vs ${want[k]}`).join(', '));
    }
}

// ── the manifest the game holds is a VALID set, by the sender's authority ────
const verdict = validateLevelSet(VANILLA);
check('the twin still validates against the frozen schema', verdict.ok,
    verdict.ok ? `${VANILLA.rooms.length} rooms` : verdict.errors.join('; '));

// ── the game is still playing, and the resolver served it a room ────────────
const running = parse(lastOf('the manifest after the game has been running', 'botStatus'));
const later = parse(lastOf('the manifest after the game has been running', 'botLevelSet'));
const roster = parse(lastOf('the manifest after the game has been running', 'botMobiles'));
check('the game is alive and in a room after the resolver served it',
    running != null && running.level === VANILLA.start.level,
    running == null ? 'botStatus returned null' : `level ${running.level}, tick ${running.tick}`);
check('the EMBED arm actually built a room — a non-empty roster, which no'
    + ' vanilla room could get from source.xml',
    roster != null && Array.isArray(roster.mobiles) && roster.mobiles.length > 0,
    roster == null ? 'botMobiles returned null'
        : `${roster.mobiles.length} mobile(s): ${roster.mobiles.map((m) => m.cls).sort().join(', ')}`);
check('and still reports no refusal once rooms have been loaded',
    later != null && later.error === '',
    later == null ? 'botLevelSet returned null' : JSON.stringify(later.error));

console.log(`\n${failures === 0 ? 'OK' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
