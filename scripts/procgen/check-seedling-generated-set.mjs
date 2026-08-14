#!/usr/bin/env node
/**
 * check-seedling-generated-set — THE PHASE 5 ROUND TRIP.
 *
 * `CC/docs/plans/seedling-external-level-sets.md` §5. Generate → export →
 * validate → chunk → deliver → mount → READ THE MANIFEST BACK OUT OF THE
 * ARTIFACT and diff it against what was emitted.
 *
 * ── ⛓ WHY THIS IS THE ACCEPTANCE AND THE UNIT TESTS ARE NOT ──────────────────
 *
 * Every stage above already existed and was gated separately before this phase.
 * What had never been shown is that a set this repo GENERATES survives all of
 * them in sequence — and the only way to know is to ask the thing that mounted
 * it what it thinks it has. `botLevelSet` reports the mounted set through the
 * accessors that replaced Phase 3b's literals, so the comparison covers the
 * build as well as the data.
 *
 * ⛔ AND THE READBACK IS THE POINT. Phase 3b's manifest gate caught
 * `new Array(45)` — forty-five empty slots where the plan said `[45]` — on its
 * first run, a defect no tape and no vitest could see, because both were reading
 * the same wrong object. Reading state back out of the artifact is the only
 * check that does not share the producer's assumptions.
 *
 * ── WHAT EACH ARM IS FOR ─────────────────────────────────────────────────────
 *
 *   control              nothing delivered — the built-in vanilla manifest, so a
 *                        later arm's disagreement is attributable to the mount
 *                        rather than to the page
 *   mount the set        deliver every chunk, then read the manifest back
 *   boot a room          a tape into a GENERATED room, so the arm proves the
 *                        room BUILDS and not merely that its bytes arrived
 *   boot past the end    the §8.3 control: one past this set's last room, which
 *                        the game does NOT refuse — asserted so the gate cannot
 *                        be read as proof the runtime bounds anything
 *
 * ⛔ ONE ARM = ONE FRESH PAGE (see the driver's header): after a single abort
 * the wasm throws and every later reading in that page is fiction while still
 * looking like data.
 *
 * ⚠ REAL-GPU WINDOWS CHROME ONLY. WSL's own chromium is SwiftShader at ~0.5 fps
 * and anything that waits for a world to be built becomes a race against machine
 * load rather than a fact.
 *
 * Prerequisites: a dev server on :8000, and `--seeds` reproducible on a QUIET
 * box — the generator is not deterministic under load (procgenOracle:503).
 *
 * Run:
 *   node scripts/procgen/check-seedling-generated-set.mjs
 *   SEEDLING_PAGE=seedling_bot_ap_p4b node scripts/procgen/check-seedling-generated-set.mjs --seeds=1-6
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const { generateSeedlingLevel } = await M('procgenSeedling.js');
const { GENERATE_BIOMES } = await M('watchGenerate.js');
const { buildLevelSet, apMappingInvalidation } = await M('levelSetExporter.js');
const { validateLevelSet, planLevelSetChunks } = await M('levelSetValidator.js');
const { parseTape } = await M('tapeFormat.js');

const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WIN_WSL = '/mnt/c/playwright';
const WIN_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const DRIVER = join(HERE, 'seedling-level-set-win.py');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const SEEDS = arg('seeds', '1-6').split(',').flatMap((part) => {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (!range) return [Number(part)];
    const out = [];
    for (let s = Number(range[1]); s <= Number(range[2]); s += 1) out.push(s);
    return out;
});
const BIOME = arg('biome', 'pre-sword');

let loadavg = 'unavailable';
try { loadavg = readFileSync('/proc/loadavg', 'utf8').trim(); } catch { /* not linux */ }

// ── build the set, here, from the same producer the CLI uses ─────────────────

const bounds = { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 };
const entries = [];
for (const seed of SEEDS) {
    const out = generateSeedlingLevel({ seed, palette: GENERATE_BIOMES[BIOME], bounds });
    entries.push({
        seed, record: out.record, summary: out.summary, name: `${BIOME}_seed${seed}`,
    });
}
const { set, report } = buildLevelSet(entries, {
    setId: `procgen-roundtrip-${entries.length}`,
    generator: 'scripts/procgen/check-seedling-generated-set.mjs',
    provenance: { biome: BIOME, seeds: entries.map((e, room) => ({ room, seed: e.seed })), bounds },
});
const sender = validateLevelSet(set);
const { chunks, oversized } = planLevelSetChunks(set);
const invalidation = apMappingInvalidation(set);

// ── the arms ────────────────────────────────────────────────────────────────

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

const deliverSteps = (cs) => cs.map((c) => ({ call: 'botLoadLevels', arg: JSON.stringify(c) }));
const SETTLE_MS = 3000;
// Two DIFFERENT rooms; see the arm's comment. Falls back to whatever the set has
// when it is smaller than that.
const BOOT_ROOMS = [...new Set([1, 3].map((n) => Math.min(n, set.rooms.length - 1)))];

const arms = [
    { name: 'control: nothing delivered', steps: [{ call: 'botLevelSet' }] },
    {
        name: 'the generated set, mounted',
        steps: [...deliverSteps(chunks), { call: 'botLevelSet' }],
    },
    // ⛓ TWO ROOMS, BECAUSE ONE CANNOT TELL YOU WHICH ROOM BUILT. Every room in a
    // generated set is built from the same palette, so an entity-class roster is
    // the same in all of them — a delivery shifted by one would produce an
    // identical roster and pass. The GOAL PICKUP'S POSITION is the per-room
    // fingerprint: the generator puts it somewhere different in every seed.
    ...BOOT_ROOMS.map((level) => ({
        name: `a generated room BUILDS: room ${level}`,
        steps: [
            ...deliverSteps(chunks),
            { call: 'botLoadTape', arg: tapeAt(level, set.start.x ?? 80, set.start.y ?? 128) },
            { call: 'botStart' },
            { sleep_ms: SETTLE_MS },
            { call: 'botMobiles' },
            { call: 'botStatus' },
            { call: 'botLevelSet' },
        ],
    })),
    {
        // ⛔ THE BOUND IS SET-AWARE, AND THAT IS WHAT THIS ARM ASSERTS. One past
        // this set's last room. Phase 3's SEAM 4 (§10.1) gave `botLoadTape` the
        // bounds check `boot.level` never had, and it asks `Game.levelCount()` —
        // the MOUNTED set's length, not the vanilla 116. Under a 6-room
        // generated set the refusal must therefore read "0..5".
        //
        // ⚠ THIS IS NOT §8.3's SILENT-CLEAR CONTROL, and the first version of
        // this gate got that wrong: it asserted "the game does NOT refuse it",
        // read `botStatus.error` (empty, because the TAPE LOAD returned the
        // refusal), and printed PASS for the opposite of what happened. §8.3's
        // property — an out-of-range level booting with a live VM and every tag
        // reading as cleared — is no longer reachable THROUGH A TAPE, because
        // seam 4 closed that door on purpose. The sender is still the only line
        // of defence for every path that is not a tape; that argument is
        // unchanged, and this arm does not evidence it either way.
        name: 'one room past the end is refused by the SET-AWARE bound',
        steps: [
            ...deliverSteps(chunks),
            { call: 'botLoadTape', arg: tapeAt(set.rooms.length) },
            { call: 'botLoadTape', arg: tapeAt(set.rooms.length - 1) },
        ],
    },
];

// ── drive ───────────────────────────────────────────────────────────────────

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-level-set-win.py'), readFileSync(DRIVER));
const planWsl = join(WIN_WSL, 'generated-set-plan.json');
const outWsl = join(WIN_WSL, 'generated-set-results.json');
writeFileSync(planWsl, JSON.stringify({ url: PAGE_URL, arms }));
try { unlinkSync(outWsl); } catch { /* first run */ }

console.log(`# a GENERATED level set, round-tripped through ${PAGE_NAME} on real-GPU Windows Chrome`);
console.log(`  load at generate time: ${loadavg}`);
console.log(`  seeds ${SEEDS.join(', ')} (biome ${BIOME}) -> ${set.set_id}`);
console.log(`  ${set.rooms.length} rooms, ${chunks.length} chunk(s), plan ${
    (readFileSync(planWsl).length / 1024).toFixed(1)} KB\n`);

let driverOut;
try {
    driverOut = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-level-set-win.py`,
        '--plan', `${WIN_DOS}\\generated-set-plan.json`,
        '--out', `${WIN_DOS}\\generated-set-results.json`,
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
const arm = (name) => {
    const a = byName.get(name);
    if (!a) throw new Error(`the driver returned no arm named ${JSON.stringify(name)}`);
    return a;
};
const lastOf = (a, callName) => {
    const v = a.results.filter((r) => r.call === callName).map((r) => r.value);
    return v.length === 0 ? undefined : v[v.length - 1];
};
const readout = (a) => {
    const raw = lastOf(a, 'botLevelSet');
    return raw == null ? null : JSON.parse(raw);
};

let failures = 0;
const check = (label, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail === undefined ? '' : ` — ${detail}`}`);
};

console.log('');

// ── the sender side, before anything crossed ────────────────────────────────
check('the exported set validates on the sender', sender.ok,
    sender.ok ? `${set.rooms.length} rooms, ${sender.warnings.length} warning(s)` : sender.errors.join(' | '));
check('no room exceeds the proven chunk envelope on its own', oversized.length === 0,
    oversized.length === 0 ? 'none' : JSON.stringify(oversized));
check('the §6.1 companion carries this set\'s stamp and all 24 references',
    invalidation.set_id === set.set_id && invalidation.total_references === 24,
    `${invalidation.set_id} / ${invalidation.total_references}`);

// ── the control ─────────────────────────────────────────────────────────────
const control = readout(arm('control: nothing delivered'));
check('the control arm answered botLevelSet at all', control != null,
    control == null ? 'null — this build has no botLevelSet, or the page died' : `set ${control.active}`);
if (control != null) {
    check('the control is the BUILT-IN vanilla set, so a mount is attributable',
        control.active?.startsWith('seedling-vanilla') && control.mounted == null,
        `active ${control.active}, mounted ${JSON.stringify(control.mounted)}`);
}

// ── the mount, read back out of the artifact ────────────────────────────────
const mounted = readout(arm('the generated set, mounted'));
check('the mount arm answered botLevelSet at all', mounted != null,
    mounted == null ? 'null — the page died during delivery' : `set ${mounted.active}`);

if (mounted != null) {
    check('IDENTITY: the artifact reports the set_id the exporter stamped',
        mounted.active === set.set_id, `${mounted.active} vs ${set.set_id}`);
    check('SIZE: the level table is the set\'s length',
        mounted.table_levels === set.rooms.length,
        `${mounted.table_levels} vs ${set.rooms.length}`);
    check('PERSISTENCE: the table was rebuilt at this set\'s size',
        mounted.table_length === set.rooms.length * 30,
        `${mounted.table_length} vs ${set.rooms.length * 30}`);
    check('no level-set refusal happened on the way to here',
        !mounted.error, JSON.stringify(mounted.error ?? ''));

    // ⛓ FIELD BY FIELD, through the accessors that replaced Phase 3b's
    // literals — not off `meta`. A readout of the raw manifest would prove the
    // DATA arrived and say nothing about the code that reads it.
    check('MUSICS: what the artifact reports equals what was emitted',
        JSON.stringify(mounted.musics) === JSON.stringify(set.rooms.map((r) => r.music)),
        `${JSON.stringify(mounted.musics)} vs ${JSON.stringify(set.rooms.map((r) => r.music))}`);
    check('MUSICS: Game.levelMusics was SEEDED from it',
        JSON.stringify(mounted.musics_live) === JSON.stringify(mounted.musics),
        'manifest vs the live array the bosses write');
    check('MENU ROOMS: menuRoom(0..n-1) equals what was emitted',
        JSON.stringify(mounted.menu_rooms) === JSON.stringify(set.menu_rooms),
        `${JSON.stringify(mounted.menu_rooms)} vs ${JSON.stringify(set.menu_rooms)}`);
    check('START: startLevel equals what was emitted',
        mounted.start_level === set.start.level, `${mounted.start_level} vs ${set.start.level}`);

    // ⚖ THE 2026-08-14 RULING, READ BACK OUT OF THE GAME. A generated set
    // dereferences none of the six, so it carries `named_rooms: {}` — and the
    // artifact must report an EMPTY object rather than six entries resolved to
    // some default. `namedRoomsVia` iterates the set's own names, so an empty
    // manifest gives an empty readout; anything else means a name was invented
    // somewhere between here and there.
    const namedBack = mounted.named_rooms ?? {};
    check('NAMED ROOMS: the artifact reports exactly the names the set carries',
        JSON.stringify(Object.keys(namedBack).sort())
            === JSON.stringify(Object.keys(set.named_rooms).sort()),
        `${JSON.stringify(Object.keys(namedBack))} vs ${JSON.stringify(Object.keys(set.named_rooms))}`);
    check('NAMED ROOMS: and no refusal was recorded for a missing name',
        !/named_rooms is missing/.test(String(mounted.error ?? '')),
        JSON.stringify(mounted.error ?? ''));

    check('FLAGS: no generated room claims the snow gradient or a music exemption',
        JSON.stringify(mounted.snow_rooms ?? []) === '[]'
        && JSON.stringify(mounted.music_exempt_rooms ?? []) === '[]',
        `snow ${JSON.stringify(mounted.snow_rooms)}, exempt ${JSON.stringify(mounted.music_exempt_rooms)}`);
}

// ── a generated room BUILDS, and it is the RIGHT room ───────────────────────
//
// ⚠ THE ROSTER IS NOT A FINGERPRINT HERE, and the first run of this gate showed
// why: `Projectiles::Arrow` counts differ between runs (18 then 15) because the
// arrow traps fire during the 3 s settle. Anything counted over wall-clock is a
// comparison of how the two runs were scheduled. The GOAL PICKUP'S POSITION does
// not move once built, and the generator puts it somewhere different in every
// seed — so it is both stable and room-distinguishing.
const goalOf = (m) => (m.mobiles ?? []).find((x) => /TorchPickup/.test(x.cls));
const seen = new Map();
for (const level of BOOT_ROOMS) {
    const built = arm(`a generated room BUILDS: room ${level}`);
    const mob = lastOf(built, 'botMobiles');
    const st = lastOf(built, 'botStatus');
    if (built.crashed || mob == null || st == null) {
        check(`the boot arm survived (room ${level})`, false,
            built.crashed ? `CRASHED: ${built.error}` : 'a callback returned null — the VM is dead');
        continue;
    }
    const m = JSON.parse(mob);
    const s = JSON.parse(st);
    check(`the game is alive and in room ${level} after mounting a GENERATED set`,
        !s.error && s.level === level,
        `level ${s.level}, tick ${s.tick}${s.error ? `, error ${s.error}` : ''}`);
    // ⛓ MORE THAN "THE BYTES ARRIVED": a room whose XML crossed but never became
    // a world has no entities, and both cases report the same manifest.
    const goal = goalOf(m);
    check(`room ${level} actually BUILT — its goal pickup exists in the world`,
        goal != null, goal == null
            ? `${(m.mobiles ?? []).length} mobile(s), none a TorchPickup`
            : `TorchPickup at (${goal.x}, ${goal.y})`);
    if (goal != null) seen.set(level, goal);
}

// ⛔ THE OFFSET IS MEASURED ONCE AND THEN ASSERTED CONSTANT, which is what makes
// this a check rather than a fitted constant. `TorchPickup` centres itself on
// its tile, so the built position is the OEL position plus a fixed amount; if
// the delivery were shifted by one room, the second room's pickup would sit at
// the FIRST room's goal and the offset would come out different.
if (seen.size === BOOT_ROOMS.length && BOOT_ROOMS.length >= 2) {
    const [a, b] = BOOT_ROOMS;
    const off = (level) => ({
        dx: seen.get(level).x - entries[level].summary.goalOel.x,
        dy: seen.get(level).y - entries[level].summary.goalOel.y,
    });
    const oa = off(a);
    const ob = off(b);
    check('the goal pickups of two different rooms are in DIFFERENT places',
        seen.get(a).x !== seen.get(b).x || seen.get(a).y !== seen.get(b).y,
        `room ${a} (${seen.get(a).x}, ${seen.get(a).y}) vs room ${b} (${seen.get(b).x}, ${seen.get(b).y})`);
    check('each room\'s goal sits at ITS OWN record\'s goal, under one constant offset',
        oa.dx === ob.dx && oa.dy === ob.dy,
        `room ${a} +(${oa.dx}, ${oa.dy}) vs room ${b} +(${ob.dx}, ${ob.dy}) — a delivery shifted by one room would disagree here`);
}

// ── the set-aware bound ─────────────────────────────────────────────────────
//
// ⛔ READ OFF `botLoadTape`'s OWN RETURN VALUE, not off a later `botStatus`.
// That was this gate's first defect: `botStatus.error` is empty after a refused
// tape — the refusal is the TAPE LOAD's return — so the original check passed
// while asserting the opposite of what the artifact did. A gate that reads the
// wrong call reports the wrong mechanism, whatever its verdict says.
const past = arm('one room past the end is refused by the SET-AWARE bound');
const tapeReturns = past.results.filter((r) => r.call === 'botLoadTape').map((r) => r.value);
if (past.crashed || tapeReturns.length < 2) {
    check('the bound arm ran both tape loads', false,
        past.crashed ? `CRASHED: ${past.error}` : `${tapeReturns.length} tape load(s)`);
} else {
    const [over, edge] = tapeReturns;
    const last = set.rooms.length - 1;
    check(`boot.level ${set.rooms.length} is REFUSED under a ${set.rooms.length}-room set`,
        typeof over === 'string' && over.startsWith('error:'), JSON.stringify(over));
    // ⛓ THE RANGE IN THE MESSAGE IS THE WHOLE CLAIM. "0..115" would mean the
    // bound is still the vanilla table and a generated set is bounded by a
    // number that has nothing to do with it; "0..N-1" means seam 4 really asks
    // the mounted set. Nothing else in this gate distinguishes those.
    check('and the refusal names THIS SET\'s range, so the bound is set-aware',
        typeof over === 'string' && over.includes(`(0..${last})`),
        `expected "(0..${last})" in ${JSON.stringify(over)}`);
    // The control, so the arm cannot pass by refusing everything.
    check(`boot.level ${last} — the last real room — is ACCEPTED`,
        edge === 'ok', JSON.stringify(edge));
}

console.log('');
console.log(`## the export, for the record`);
console.log(`  invented: ${report.invented.join(', ') || 'nothing'}`);
console.log(`  reachability: ${report.reachability.reachable}/${report.reachability.total} from room ${report.reachability.start}`);
console.log('');
console.log(failures === 0 ? 'OK' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
