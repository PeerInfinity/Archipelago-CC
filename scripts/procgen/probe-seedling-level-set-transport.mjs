#!/usr/bin/env node
/**
 * probe-seedling-level-set-transport — the RECEIVER's half of the level-set
 * delivery, driven in the built artifact. Phase 3 of
 * CC/docs/plans/seedling-external-level-sets.md.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────
 *
 * Phase 3 put four seams into the AS3 (~/CC/seedling, branch `bot`): the parse
 * split, the level table behind a MOUNTED SET, `botLoadLevels`, and four
 * level-id bounds checks. None of it can be believed from the source — the
 * artifact is a SWFRecomp AVM2 recompile, and every claim about it has to be
 * driven through the wasm.
 *
 * ⛔ REAL-GPU WINDOWS CHROME, NEVER WSL HEADLESS. WSL's Chromium is SwiftShader:
 * `seedling-bot-replay-win.py`'s header and `probe-seedling-r5-mobiles.mjs:96`
 * both record ~0.5 fps there against ~3.6 fps on the real-GPU rig. Every arm
 * below waits for a world to be BUILT, so on software rendering each one would
 * be a race against machine load rather than a fact about which room loaded.
 * The browser side is `seedling-level-set-win.py`, a dumb driver; all the rules
 * and every verdict stay here.
 *
 * The arms, each on its own FRESH PAGE:
 *
 *   1. CONTROL — nothing delivered. The built-in table still answers.
 *   2. THE §8.3 REGRESSION — `boot.level` 116 was accepted by this build's
 *      predecessor (load ok, start ok, VM alive, thirty cleared flags). It must
 *      now be refused BY NAME, with 115 still accepted beside it; and with a
 *      5-room set mounted, level 5 — which EXISTS in vanilla — must go too.
 *   3. CONFORMANCE — the shared fixture, one page per case. The sender's half is
 *      frontend/modules/seedlingDemo/levelSetDelivery.test.js; NEITHER HALF
 *      PROVES PARITY ALONE, which is why both exist.
 *   4. THE REAL SET — the actual vanilla 116 rooms as XML text, ~1.38 MB,
 *      chunked by the sender's own planner. §8.1 proved that much JSON can
 *      CROSS in pieces; it did not prove the receiver can RETAIN it, because
 *      nothing kept the rooms afterwards. This does.
 *   5. THE SWAP — the same delivery with room 5's XML replaced by room 0's,
 *      booted at level 5. If the mounted table is really where rooms come from,
 *      the game must build room 0's entities. Two vanilla controls fingerprint
 *      rooms 0 and 5 first, and the arm is ABANDONED if they match, because a
 *      fingerprint that cannot tell two rooms apart cannot tell anything.
 *   6. OVER CAPACITY — 117 rooms against a persistence table that addresses
 *      116. §8.3: the rows past its end read as *every tag already cleared* and
 *      the game reports itself healthy, so this is refused at the boundary
 *      until plan phase 4 sizes the table from the mounted set.
 *
 * Run (dev server on :8000, the phase-3 artifact staged, Windows Playwright
 * installed per SWFRecomp-CC tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md):
 *   node scripts/procgen/probe-seedling-level-set-transport.mjs
 *   SEEDLING_PAGE=seedling_bot_ap node scripts/procgen/…   # the OLD build,
 *       which should FAIL arms 2-6 — that is what makes this probe a claim
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_phase3';
const SEEDLING = process.env.SEEDLING_SRC || join(process.env.HOME, 'CC', 'seedling');
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

// The Windows side. Same staging rules as verify-seedling-bot-differential.mjs:
// py.exe cannot take Linux paths, so the driver and both JSON files live in
// C:\playwright\ (= /mnt/c/playwright/).
const WIN_WSL = '/mnt/c/playwright';
const WIN_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const DRIVER = join(HERE, 'seedling-level-set-win.py');

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { planLevelSetChunks, MAX_ROOMS_PER_CHUNK } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/levelSetValidator.js'));

const fixture = (name) => JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures', name), 'utf8'));

const CONFORMANCE = fixture('seedling-level-set-delivery-conformance.json');
const VANILLA = fixture('seedling-vanilla-set.json');

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

// ── the arms, as steps for the dumb driver ───────────────────────────────────

const tapeAt = (level, x = 80, y = 128) => JSON.stringify(parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { level, x, y },
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

const deliverSteps = (chunks) => chunks.map((c) => (
    { call: 'botLoadLevels', arg: JSON.stringify(c) }));

/**
 * ⚠ WHAT THE ROOM FINGERPRINT IS, and why it is only class names: a room's
 * identity here is the MULTISET OF ENTITY CLASSES it built, plus its pod count.
 * Positions, velocities, animation frames, the player and the tick are all
 * dropped, because they move — and a comparison of things that move is a
 * comparison of how fast the two runs were scheduled.
 */
const SETTLE_MS = 3000;
const rosterSteps = (level) => ([
    { call: 'botLoadTape', arg: tapeAt(level) },
    { call: 'botStart' },
    { sleep_ms: SETTLE_MS },
    { call: 'botMobiles' },
    { call: 'botStatus' },
]);

/** The real vanilla 116, with each room's OEL read from the AS3 tree as TEXT. */
function realVanillaSetAsXml() {
    const assets = join(SEEDLING, 'assets');
    if (!existsSync(assets)) return null;
    let bytes = 0;
    const rooms = VANILLA.rooms.map((room) => {
        const xml = readFileSync(join(assets, room.source.embed), 'utf8');
        bytes += xml.length;
        return { ...room, source: { xml } };
    });
    return { set: { ...VANILLA, rooms }, bytes };
}

const real = realVanillaSetAsXml();
const realPlan = real && planLevelSetChunks(real.set);
let swappedPlan = null;
if (real) {
    const swapped = JSON.parse(JSON.stringify(real.set));
    swapped.rooms[5].source.xml = swapped.rooms[0].source.xml;
    swappedPlan = planLevelSetChunks(swapped);
}

const tiny = (i) => ({
    id: i,
    name: `T${i}`,
    music: 0,
    source: { xml: '<level width="160" height="160"><Ground/></level>' },
});
const overCapacity = { ...VANILLA, rooms: Array.from({ length: 117 }, (_, i) => tiny(i)) };

const smallSet = CONFORMANCE.cases[0];

const arms = [
    { name: 'control: nothing delivered', steps: [{ call: 'botLevelSet' }] },
    { name: 'boot.level 115 (control)', steps: [{ call: 'botLoadTape', arg: tapeAt(115) }] },
    { name: 'boot.level 116', steps: [{ call: 'botLoadTape', arg: tapeAt(116) }] },
    {
        name: 'a 5-room set is mounted, then boot 4 and boot 5',
        steps: [
            ...deliverSteps(smallSet.chunks),
            { call: 'botLevelSet' },
            { call: 'botLoadTape', arg: tapeAt(4) },
            { call: 'botLoadTape', arg: tapeAt(5) },
        ],
    },
    ...CONFORMANCE.cases.map((c) => ({
        name: `conformance: ${c.name}`,
        steps: [...deliverSteps(c.chunks), { call: 'botLevelSet' }],
    })),
    ...(real ? [
        { name: 'the real vanilla 116 as XML', steps: [...deliverSteps(realPlan.chunks), { call: 'botLevelSet' }] },
        { name: 'fingerprint room 0 (control)', steps: rosterSteps(0) },
        { name: 'fingerprint room 5 (control)', steps: rosterSteps(5) },
        {
            name: 'room 5 carrying room 0\'s XML, booted at 5',
            steps: [...deliverSteps(swappedPlan.chunks), { call: 'botLevelSet' }, ...rosterSteps(5)],
        },
    ] : []),
    { name: '117 rooms against a 116-row table', steps: [...deliverSteps(planLevelSetChunks(overCapacity).chunks), { call: 'botLevelSet' }] },
];

// ── run them on Windows ──────────────────────────────────────────────────────

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-level-set-win.py'), readFileSync(DRIVER));
const planWsl = join(WIN_WSL, 'levelset-plan.json');
const outWsl = join(WIN_WSL, 'levelset-results.json');
writeFileSync(planWsl, JSON.stringify({ url: PAGE_URL, arms }));
try { unlinkSync(outWsl); } catch { /* first run */ }

console.log(`# level-set transport, driven in ${PAGE_NAME} on real-GPU Windows Chrome`);
console.log(`  ${arms.length} arms, one fresh page each; plan ${
    (readFileSync(planWsl).length / 1024 / 1024).toFixed(2)} MB\n`);

let driverOut;
try {
    driverOut = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-level-set-win.py`,
        '--plan', `${WIN_DOS}\\levelset-plan.json`,
        '--out', `${WIN_DOS}\\levelset-results.json`,
    ], { cwd: WIN_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
    const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
    console.log(`DRIVER FAILED: ${e.message}\n${said}`);
    process.exit(1);
}
// cmd.exe/py.exe launched from a WSL cwd emit a harmless UNC warning.
driverOut.replace(/\r/g, '').split('\n')
    .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
    .forEach((l) => console.log(`  ${l}`));

const results = JSON.parse(readFileSync(outWsl, 'utf8'));
const byName = new Map(results.arms.map((a) => [a.name, a]));
const arm = (name) => {
    const a = byName.get(name);
    if (!a) throw new Error(`the driver returned no arm named ${JSON.stringify(name)}`);
    return a;
};
/** Every value returned by a named callback in this arm, in order. */
const valuesOf = (a, callName) => a.results
    .filter((r) => r.call === callName).map((r) => r.value);
const lastOf = (a, callName) => {
    const v = valuesOf(a, callName);
    return v.length === 0 ? undefined : v[v.length - 1];
};
const readout = (a) => {
    const raw = lastOf(a, 'botLevelSet');
    return raw == null ? null : JSON.parse(raw);
};
/** The room fingerprint, or a string naming why there is not one. */
const fingerprint = (a) => {
    if (a.crashed) return `CRASHED: ${a.error}`;
    const mob = lastOf(a, 'botMobiles');
    const st = lastOf(a, 'botStatus');
    if (mob == null || st == null) return 'VM DEAD: a callback returned null';
    const m = JSON.parse(mob);
    const s = JSON.parse(st);
    if (s.error) return `BOT ERROR: ${s.error}`;
    return JSON.stringify({ mobiles: m.mobiles.map((x) => x.cls).sort(), pods: m.pods.length });
};

console.log('');

// ── 1. control ───────────────────────────────────────────────────────────────
const control = readout(arm('control: nothing delivered'));
check('1. control: no set mounted, and the built-in table answers',
    control !== null && control.mounted === null && control.rooms === control.built_in
        && control.rooms === 116 && control.staged === 0 && control.error === '',
    JSON.stringify(control));

// ── 2. the §8.3 regression ───────────────────────────────────────────────────
const boot115 = lastOf(arm('boot.level 115 (control)'), 'botLoadTape');
check('2a. control: boot.level 115 is still accepted', boot115 === 'ok', String(boot115));

const boot116 = lastOf(arm('boot.level 116'), 'botLoadTape');
check('2b. ⛓ boot.level 116 is REFUSED BY NAME — §8.3 measured this build\'s '
    + 'predecessor answering `ok`, booting, staying alive and reading thirty '
    + 'cleared flags',
typeof boot116 === 'string' && boot116.startsWith('error:boot.level 116'),
String(boot116));

const boundedArm = arm('a 5-room set is mounted, then boot 4 and boot 5');
const boundedTapes = valuesOf(boundedArm, 'botLoadTape');
const boundedReadout = readout(boundedArm);
check('2c. ⛓ with a 5-room set mounted, boot.level 4 is accepted and 5 — which '
    + 'EXISTS in the built-in 116 — is refused: the bound follows the MOUNTED '
    + 'table, not the compiled-in one',
boundedReadout !== null && boundedReadout.rooms === 5
    && boundedTapes[0] === 'ok'
    && typeof boundedTapes[1] === 'string' && boundedTapes[1].startsWith('error:boot.level 5'),
`rooms=${boundedReadout?.rooms} in=${boundedTapes[0]} past=${boundedTapes[1]}`);

// ── 3. the shared conformance fixture ────────────────────────────────────────
console.log(`\n  ${CONFORMANCE.cases.length} conformance cases\n`);
for (const c of CONFORMANCE.cases) {
    const a = arm(`conformance: ${c.name}`);
    const r = readout(a);
    const mounted = r !== null && r.mounted !== null;
    const last = lastOf(a, 'botLoadLevels');
    // ⛓ Reasons are not compared BETWEEN the sides — but where the fixture says
    // so, the receiver's own reason must name the values that conflicted. This
    // exists because the first build reported `disagrees with "null"`: it reset
    // its staging before composing the message, so the verdict was right and
    // the reason named nothing. Found by this probe, kept as a gate.
    if (c.receiver_reason_must_contain) {
        const missing = c.receiver_reason_must_contain
            .filter((s) => !String(last).includes(s));
        check(`3r. the refusal NAMES what conflicted: ${c.name}`,
            missing.length === 0,
            missing.length === 0 ? String(last)
                : `⛔ the reason ${JSON.stringify(String(last))} never mentions `
                    + missing.map((s) => JSON.stringify(s)).join(' or '));
    }
    check(`3. ${c.mounts ? 'mounts' : 'refuses'}: ${c.name}`,
        !a.crashed && mounted === c.mounts,
        a.crashed
            ? `⛔ the page died: ${a.error}`
            : mounted === c.mounts
                ? (c.mounts ? `mounted ${r.mounted}, ${r.rooms} rooms` : `refused: ${last}`)
                : `⛔ receiver said ${JSON.stringify(last)} and mounted=${mounted}, fixture `
                    + `says mounts=${c.mounts}. Without the rule this case exercises: `
                    + c.would_mount_without_the_rule);
}

// ── 4 + 5. the real 116 rooms, and the swap ──────────────────────────────────
if (real == null) {
    console.log(`\nSKIP arms 4-5: no OEL tree at ${join(SEEDLING, 'assets')}`);
} else {
    console.log(`\n  the real set: 116 rooms, ${real.bytes} B of OEL, `
        + `${realPlan.chunks.length} chunks (<=${MAX_ROOMS_PER_CHUNK} rooms/chunk), `
        + `${realPlan.oversized.length} oversized\n`);

    const arm4 = arm('the real vanilla 116 as XML');
    const r4 = readout(arm4);
    check('4. ⛓ the REAL vanilla set mounts, and the receiver RETAINS it — §8.1 '
        + 'proved the bytes can cross in pieces, not that they can be kept',
    !arm4.crashed && r4 !== null && r4.mounted === real.set.set_id && r4.rooms === 116,
    arm4.crashed
        ? `⛔ the page died: ${arm4.error} — the arena failure §8.1 measured, `
            + 'reached by RETENTION rather than by one oversized call'
        : `${r4?.mounted} / ${r4?.rooms} rooms, last response `
            + `${lastOf(arm4, 'botLoadLevels')}`);

    const room0 = fingerprint(arm('fingerprint room 0 (control)'));
    const room5 = fingerprint(arm('fingerprint room 5 (control)'));
    const readable = room0.startsWith('{') && room5.startsWith('{');
    const distinct = readable && room0 !== room5;
    check('5a. control: rooms 0 and 5 build DIFFERENT entity rosters, so the '
        + 'fingerprint can tell them apart at all',
    distinct,
    distinct
        ? `${JSON.parse(room0).mobiles.length} vs ${JSON.parse(room5).mobiles.length} mobiles`
        : `⛔ identical or unreadable — arm 5b proves nothing and is abandoned. `
            + `room0=${room0.slice(0, 160)} room5=${room5.slice(0, 160)}`);

    if (distinct) {
        const swapArm = arm('room 5 carrying room 0\'s XML, booted at 5');
        const got = fingerprint(swapArm);
        check('5b. ⛓ with room 5\'s XML replaced by room 0\'s, booting level 5 builds '
            + 'ROOM 0\'s entities — the mounted table is really where rooms come from',
        got === room0,
        got === room0
            ? 'the delivered XML is what loaded'
            : got === room5
                ? '⛔ room 5\'s own roster: the delivery mounted but `loadLevelIndex` '
                    + 'still read the [Embed] array'
                : `⛔ neither control: ${got.slice(0, 200)}`);
    }
}

// ── 6. over capacity ─────────────────────────────────────────────────────────
const arm6 = arm('117 rooms against a 116-row table');
const r6 = readout(arm6);
const arm6Last = lastOf(arm6, 'botLoadLevels');
check('6. a 117-room set is refused against a persistence table that addresses 116 '
    + '— §8.3: the rows past its end read as every tag already cleared',
!arm6.crashed && r6 !== null && r6.mounted === null
    && typeof arm6Last === 'string' && arm6Last.indexOf('persistence table') > 0,
String(arm6Last));

console.log(`\n${failures === 0 ? 'ALL ARMS PASS' : `${failures} ARM(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
