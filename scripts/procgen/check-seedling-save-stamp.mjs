#!/usr/bin/env node
/**
 * check-seedling-save-stamp — the SAVE, read back out of the BUILT ARTIFACT,
 * against the set that is mounted.
 *
 * Phase 4 of `CC/docs/plans/seedling-external-level-sets.md` (§4.2).
 *
 * ── WHY THIS EXISTS, AND WHY NOTHING ELSE COULD DO IT ─────────────────
 *
 * The persistence table is the one piece of game state with no witness. A row
 * is not a position, a level or an entity, so it reaches no observation stream
 * unless something despawns BECAUSE of it — which is the same blind spot that
 * hid `new Array(45)` from 153 tapes (plan §11.3). And the failure this phase
 * exists to prevent is silent by construction: load a save from set A under set
 * B and the player resumes at an index meaning a different room, with a table
 * whose rows describe entities that are not there. `load: ok`, `start: ok`, no
 * error, VM alive (§8.3, driven).
 *
 * ⇒ every arm below reads `botLevelSet`'s save block — the stamp, the table's
 * size, and `save_cleared`, which lists every FALSE slot as "level:tag" — and
 * compares it against what the mounted set says it should be.
 *
 * ⛓ `save_cleared` IS THE EVIDENCE, not `save_reset`. A reset REASON is a
 * string the code chose to print; a cleared slot surviving (or not surviving) a
 * re-delivery is the table itself answering. The arms that matter assert the
 * slot, and read the reason only to name what happened.
 *
 * ⛔ REAL-GPU WINDOWS CHROME (⚖ user), on `seedling-level-set-win.py` — the
 * same dumb driver phases 3 and 3b use; every verdict stays here.
 *
 * ⚠ ONE FRESH PAGE PER ARM, and it is load-bearing HERE in a way it is not
 * elsewhere: this runtime models SharedObject in process and never writes a
 * .sol (`avm2_amf.c:1907`), so the save lives exactly as long as the page. Each
 * arm therefore builds the save state it needs from a fresh boot, in order.
 *
 * Run (dev server on :8000):
 *   node scripts/procgen/check-seedling-save-stamp.mjs
 *   SEEDLING_PAGE=seedling_bot_ap_3b node scripts/procgen/…   # PHASE 3b, which
 *       has no save stamp at all and must fail every arm
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
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

const { planLevelSetChunks, stampLevelSetIdentity, validateLevelSet } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSetValidator.js'));
// The one home for the 30 (plan §7 Q4); the validator imports it from here too.
const { TAGS_PER_LEVEL } = await import(join(REPO, 'frontend/modules/seedlingDemo/breakableRocks.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));

const VANILLA = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── the sets this gate delivers ──────────────────────────────────────────────
//
// Deliberately three DIFFERENT sizes, so a table that failed to follow the
// mounted set is caught by its length and not only by its contents.
const room = (i) => ({
    id: i,
    name: `R${i}`,
    music: 0,
    source: { xml: '<level width="160" height="160"><Ground/></level>' },
});
const namedRooms = (max) => ({
    moonrock_target: { level: Math.min(2, max), x: 48, y: 32 },
    watcher_text: { level: 0 },
    dark_shrum_death: { level: 0, x: 72, y: 128 },
    bloody_seed_ending: { level: 1, x: 64, y: 96 },
    light_boss_exit: { level: 1, x: 112, y: 96 },
    tentacle_beast_mouth: { level: 0, x: 56, y: 96 },
});
const setOf = (base, count) => stampLevelSetIdentity({
    schema_version: 1,
    set_id: base,
    rooms: Array.from({ length: count }, (_, i) => room(i)),
    start: { level: 0 },
    menu_rooms: [0],
    named_rooms: namedRooms(count - 1),
}, base);

const SET_A = setOf('stamp-a', 5);      // 5 rooms  -> 150 booleans
const SET_B = setOf('stamp-b', 7);      // 7 rooms  -> 210
const SET_BIG = setOf('stamp-big', 117); // 117 rooms — the capacity stopgap's case

// ⛔ THE SENDER MUST AGREE THESE ARE SETS IT WOULD EMIT. The receiver does not
// check validity (§10.2's split) and would mount a document no producer could
// make, which would leave every arm below measuring a fiction.
for (const [name, set] of [['A', SET_A], ['B', SET_B], ['BIG', SET_BIG]]) {
    const v = validateLevelSet(set);
    check(`0. set ${name} is one the SENDER would emit`, v.ok,
        v.ok ? `${set.set_id}, ${set.rooms.length} rooms` : v.errors.join('; '));
}

const deliver = (set) => planLevelSetChunks(set).chunks.map((c) => (
    { call: 'botLoadLevels', arg: JSON.stringify(c) }));

/** A tape that clears ONE persistence slot, so the table has something to say. */
const CLEARED_LEVEL = 1;
const CLEARED_TAG = 3;
const CLEARING_TAPE = JSON.stringify(parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { level: 0, x: 80, y: 128 },
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [{ level: CLEARED_LEVEL, tag: CLEARED_TAG }],
    equips: [],
    pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 987286273, split: false, cosmetic: 0, fp: 0 },
    tick_count: 0,
    inputs: [],
}));
const SLOT = `${CLEARED_LEVEL}:${CLEARED_TAG}`;
const clearOneSlot = [
    { call: 'botLoadTape', arg: CLEARING_TAPE },
    { call: 'botStart' },
    { sleep_ms: 1500 },
];

const arms = [
    { name: '1 vanilla at boot', steps: [{ call: 'botLevelSet' }] },
    {
        name: '2 a delivered set replaces the save',
        steps: [...deliver(SET_A), { call: 'botLevelSet' }],
    },
    {
        name: '3 the same set again keeps the table',
        steps: [
            ...deliver(SET_A), ...clearOneSlot, { call: 'botLevelSet' },
            ...deliver(SET_A), { call: 'botLevelSet' },
        ],
    },
    {
        name: '4 a different set throws it away',
        steps: [
            ...deliver(SET_A), ...clearOneSlot, { call: 'botLevelSet' },
            ...deliver(SET_B), { call: 'botLevelSet' },
        ],
    },
    {
        name: '5 an unstamped save whose table fits is ADOPTED',
        steps: [
            ...deliver(SET_A), ...clearOneSlot, { call: 'botLevelSet' },
            { call: 'botForgeSaveStamp', arg: '' },
            ...deliver(SET_A), { call: 'botLevelSet' },
        ],
    },
    {
        name: '6 a stamp that matches a table it cannot describe',
        steps: [
            ...deliver(SET_A), ...clearOneSlot,
            { call: 'botForgeSaveStamp', arg: SET_B.set_id },
            ...deliver(SET_B), { call: 'botLevelSet' },
        ],
    },
    {
        name: '7 a 117-room set mounts and the table grows to fit',
        steps: [...deliver(SET_BIG), { call: 'botLevelSet' }],
    },
];

mkdirSync(WIN_WSL, { recursive: true });
writeFileSync(join(WIN_WSL, 'seedling-level-set-win.py'), readFileSync(DRIVER));
const planWsl = join(WIN_WSL, 'savestamp-plan.json');
const outWsl = join(WIN_WSL, 'savestamp-results.json');
writeFileSync(planWsl, JSON.stringify({ url: PAGE_URL, arms }));
try { unlinkSync(outWsl); } catch { /* first run */ }

console.log(`\n# the save stamp and the persistence table, in ${PAGE_NAME}`);
console.log(`  vanilla ${VANILLA.set_id} (${VANILLA.rooms.length} rooms)`);
console.log(`  A ${SET_A.set_id} (5)   B ${SET_B.set_id} (7)   BIG ${SET_BIG.set_id} (117)\n`);

let driverOut;
try {
    driverOut = execFileSync(WIN_PY, [
        '-3.12', `${WIN_DOS}\\seedling-level-set-win.py`,
        '--plan', `${WIN_DOS}\\savestamp-plan.json`,
        '--out', `${WIN_DOS}\\savestamp-results.json`,
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
/** The Nth (0-based) botLevelSet readout of an arm, parsed. */
const readout = (armName, nth = -1) => {
    const a = byName.get(armName);
    if (!a) throw new Error(`no arm named ${JSON.stringify(armName)}`);
    if (a.crashed) return { crashed: a.error };
    const vals = a.results.filter((r) => r.call === 'botLevelSet').map((r) => r.value);
    const raw = nth < 0 ? vals[vals.length + nth] : vals[nth];
    return raw == null ? null : JSON.parse(raw);
};
/** Everything a save block should say, in one line. */
const shape = (r) => (r == null ? 'null' : `set=${JSON.stringify(r.save_set)} `
    + `levels=${r.table_levels} booleans=${r.table_length} `
    + `cleared=${JSON.stringify(r.save_cleared)} reset=${JSON.stringify(r.save_reset)}`);

console.log('');

// ── 1. the control ───────────────────────────────────────────────────────────
const a1 = readout('1 vanilla at boot');
check('1a. the save is STAMPED with the built-in vanilla set',
    a1 != null && a1.save_set === VANILLA.set_id, shape(a1));
check('1b. ⛓ the table is the SET\'s size, not a compiled-in constant — '
    + `${VANILLA.rooms.length} levels x ${TAGS_PER_LEVEL} tags`,
a1 != null && a1.table_levels === VANILLA.rooms.length
    && a1.table_length === VANILLA.rooms.length * TAGS_PER_LEVEL, shape(a1));
check('1c. nothing is cleared in a fresh table — every entity will spawn',
    a1 != null && eq(a1.save_cleared, []), shape(a1));
check('1d. ⛓ and NOTHING WAS THROWN AWAY: a first boot has no save to discard, '
    + 'so the reset field must be empty or it cries wolf on every launch',
a1 != null && a1.save_reset === '', shape(a1));

// ── 2. the mismatch path ─────────────────────────────────────────────────────
const a2 = readout('2 a delivered set replaces the save');
check('2a. the delivered set is mounted and the save now belongs to IT',
    a2 != null && a2.mounted === SET_A.set_id && a2.save_set === SET_A.set_id, shape(a2));
check('2b. ⛓ the table FOLLOWED the mounted set — 5 levels, not 116',
    a2 != null && a2.table_levels === 5 && a2.table_length === 5 * TAGS_PER_LEVEL, shape(a2));
check('2c. the reset NAMES both sets, so the player can tell what happened',
    a2 != null && typeof a2.save_reset === 'string'
    && a2.save_reset.indexOf(VANILLA.set_id) >= 0 && a2.save_reset.indexOf(SET_A.set_id) >= 0,
    JSON.stringify(a2 && a2.save_reset));

// ── 3. the KEEP path, with evidence ──────────────────────────────────────────
const a3before = readout('3 the same set again keeps the table', 0);
const a3after = readout('3 the same set again keeps the table', 1);
check(`3a. control: the tape really cleared ${SLOT} — without this, 3b proves nothing`,
    a3before != null && eq(a3before.save_cleared, [SLOT]), shape(a3before));
check('3b. ⛓ re-delivering the SAME set keeps the table, cleared slot and all',
    a3after != null && eq(a3after.save_cleared, [SLOT]) && a3after.table_levels === 5,
    shape(a3after));
check('3c. and it did not report a reset it did not do',
    a3after != null && a3before != null && a3after.save_reset === a3before.save_reset,
    `${JSON.stringify(a3after && a3after.save_reset)}`);

// ── 4. the REBUILD path ──────────────────────────────────────────────────────
const a4before = readout('4 a different set throws it away', 0);
const a4after = readout('4 a different set throws it away', 1);
check(`4a. control: ${SLOT} was cleared before the second delivery`,
    a4before != null && eq(a4before.save_cleared, [SLOT]), shape(a4before));
check('4b. ⛓ a DIFFERENT set rebuilds the table — the cleared slot is gone, and '
    + 'the size is the new set\'s',
a4after != null && eq(a4after.save_cleared, []) && a4after.table_levels === 7
    && a4after.table_length === 7 * TAGS_PER_LEVEL, shape(a4after));
check('4c. and it says so, naming the set the save came from',
    a4after != null && typeof a4after.save_reset === 'string'
    && a4after.save_reset.indexOf(SET_A.set_id) >= 0, JSON.stringify(a4after && a4after.save_reset));

// ── 5. adoption ──────────────────────────────────────────────────────────────
const a5before = readout('5 an unstamped save whose table fits is ADOPTED', 0);
const a5after = readout('5 an unstamped save whose table fits is ADOPTED', 1);
check('5a. control: the slot was cleared and the stamp was then forged away',
    a5before != null && eq(a5before.save_cleared, [SLOT]), shape(a5before));
check('5b. ⛓ an UNSTAMPED save whose table fits is ADOPTED, not destroyed — the '
    + 'upgrade case, and the difference between keeping a playthrough and losing it',
a5after != null && eq(a5after.save_cleared, [SLOT]) && a5after.save_set === SET_A.set_id
    && a5after.table_levels === 5, shape(a5after));
check('5c. adoption is not a reset either',
    a5after != null && a5before != null && a5after.save_reset === a5before.save_reset,
    JSON.stringify(a5after && a5after.save_reset));

// ── 6. the branch the plan got wrong ─────────────────────────────────────────
const a6 = readout('6 a stamp that matches a table it cannot describe');
check('6. ⛔ a stamp that MATCHES over a table that cannot belong to that set is '
    + 'NAMED and rebuilt — plan §4.2 would have extended it with `true` and erased '
    + 'the only evidence of the disagreement',
a6 != null && a6.save_set === SET_B.set_id && a6.table_levels === 7
    && eq(a6.save_cleared, []) && typeof a6.save_reset === 'string'
    && a6.save_reset.indexOf('content-derived') >= 0, shape(a6));

// ── 7. the stopgap is gone ───────────────────────────────────────────────────
const a7 = readout('7 a 117-room set mounts and the table grows to fit');
check('7. ⛓ a 117-room set MOUNTS — phase 3 refused it because the table addressed '
    + '116, and lifting that refusal is what phase 4 owed',
a7 != null && a7.mounted === SET_BIG.set_id && a7.table_levels === 117
    && a7.table_length === 117 * TAGS_PER_LEVEL && a7.error === '', shape(a7));

console.log(`\n${failures === 0 ? 'OK' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
