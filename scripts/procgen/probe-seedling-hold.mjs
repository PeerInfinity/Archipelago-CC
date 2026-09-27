#!/usr/bin/env node
/**
 * HOLD-AFTER-LATCH, MEASURED ON THE GAME (R9 slice P4E, ⚖ 72 (a′)) — does a
 * tape that declares `hold` freeze the room at its seam latch until the next
 * `botStart`, and does the next window then start from EXACTLY the latch?
 *
 * The seam it closes (kickoff §61.3): `Main.update` is `Bot.update();
 * super.update();`, so the finish frame's own world step runs after the latch,
 * and every wall-clock frame the page spends between windows steps the live
 * room too (36–38 measured at the L15/L16 boundaries). The candidate build
 * declares the `hold` capability: a tape_version 12 `hold: true` sets
 * `Bot.holding` at the latch and `Main.update` skips `super.update()` and
 * `Music.update()` while it is set; `botStart`, `botReset` and `botLoadLevels`
 * release it — never `botLoadTape`.
 *
 * TWO ARMS, one fresh page each, the same window (default `r9-solve-14`, the
 * L14→L15 campaign window §61.1 measured), then a 0-tick successor booted at
 * the latch's own spawn (`playerPositionX/Y` — the director's SKIP path):
 *   held  — the window stamped by `tapeFormat.holdingWindowTape`, projected by
 *           `gameVisibleTape` (the director's own two calls).
 *   free  — the same window as committed (no `hold`): the control.
 * Read at A (the finish), B (3 s later), C (after the successor's
 * `botLoadTape`), D (the successor's own latch) and E (2 s later):
 *   C1  held: `game_time` at A = B = C = the latch's `save.time` (Δ0); the
 *       successor's latch `save.time` = the first latch's; mobiles unmoved.
 *       free: the clock runs (the gap).
 *   C2  `arm.armed_at` at D is the clock at the successor's arm — the
 *       existing readout; no bridge property was needed for it.
 *   C3  the mixer (`static.Music.currentSet/Index`) at the successor's latch =
 *       the first latch's: with the world AND the mixer held, nothing drains
 *       between the latch and the next `botStart` (⚖ 66 (i)).
 * On a build WITHOUT `hold` in its `builds.json` entry the probe asks only the
 * negative: the loader REFUSES a tape_version 12 by name.
 *
 * ⛓ Headless logic-only, one browser via `seedling-level-set-win.py`; takes
 * the box lock.
 *
 * Run: SEEDLING_PORT=8000 node scripts/procgen/probe-seedling-hold.mjs [--window=r9-solve-14]
 *   (`SEEDLING_PAGE=<build>` drives another build; the default is the candidate)
 */
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const { takeBoxLockOrExit } = await import('./boxLock.js');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
const { proveDriverChannel, withLogicOnlySteps } = await import('./seedlingChannel.js');
const { closeChannelOnExit, driverChannel } = await import('./seedlingDriver.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4e';
const PORT = process.env.SEEDLING_PORT || '8000';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:${PORT}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WINDOW = process.argv.find((a) => a.startsWith('--window='))?.slice('--window='.length)
    ?? 'r9-solve-14';

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}
takeBoxLockOrExit({ name: 'probe-seedling-hold.mjs', kind: 'browser' });

const T = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { holdCapabilityOf } = await import(join(REPO, 'frontend/modules/seedlingDemo/watchWasm.js'));
const MANIFEST = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const HOLD = holdCapabilityOf(MANIFEST, `../flashPanel/wasm/${PAGE_NAME}/game.html`);

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const w1 = T.parseTape(JSON.parse(readFileSync(
    join(REPO, `frontend/modules/seedlingDemo/fixtures/tapes/${WINDOW}.json`), 'utf8')));
const held1 = T.gameVisibleTape(T.holdingWindowTape(w1));
const free1 = T.gameVisibleTape(w1);
/** A 0-tick successor at `boot`, declaring nothing but (maybe) `hold`. */
const successor = (hold, boot) => T.gameVisibleTape(T.parseTape({
    tape_version: hold ? T.HOLD_TAPE_VERSION : 8, game: 'seedling', boot, noclip: false,
    noDamage: false, noHazards: [], grants: [], persistence: [], equips: [], pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 0, split: w1.rng.split, cosmetic: 0, fp: 0 },
    ...(hold ? { despawn: [], hold: true } : {}), tick_count: 0, inputs: [] }));

const FINISHED = {
    wait_js: '() => JSON.parse(window.__swfBridge.game.botStatus()).finished === true',
    deadline_sec: 600, label: 'finished' };
const READS = [{ call: 'botStatus' }, { call: 'botSeam' }, { call: 'botMobiles' }];
/**
 * ⛓ The successor boots at the latch's own SPAWN, which only the page knows
 * after the first window runs — so the successor step is an `eval` that reads
 * `botSeam` and loads the tape it composes. Its tape is composed HERE (the
 * format's own functions); the page only fills in the boot.
 */
const loadSuccessor = (hold) => ({
    label: 'successor',
    eval: `async (t) => { const g = window.__swfBridge.game;
        const s = JSON.parse(g.botSeam()).seam;
        t.boot = { level: s.level, x: s.playerPositionX, y: s.playerPositionY };
        return g.botLoadTape(JSON.stringify(t)); }`,
    arg: successor(hold, { level: 0, x: 0, y: 0 }),
});
const armOf = (name, first, hold) => ({ name, steps: [
    { call: 'botLoadTape', arg: JSON.stringify(first) }, { call: 'botStart' }, FINISHED,
    ...READS, { sleep_ms: 3000 }, ...READS,
    loadSuccessor(hold), { sleep_ms: 1500 }, ...READS,
    { call: 'botStart' }, FINISHED, ...READS, { sleep_ms: 2000 }, ...READS,
] });
const ARMS = HOLD.capable
    ? [armOf('held', held1, true), armOf('free', free1, false)]
    : [{ name: 'refused', steps: [{ call: 'botLoadTape', arg: JSON.stringify(held1) }] }];

console.log(`# hold-after-latch on ${PAGE_NAME} — ${HOLD.why}; window ${WINDOW} `
    + `(${w1.tick_count} ticks, boot L${w1.boot.level})`);
const channel = driverChannel({ win: false, driver: join(HERE, 'seedling-level-set-win.py'),
    chromiumArgs: HEADLESS_LOGIC_ONLY_ARGS });
closeChannelOnExit(channel);
channel.write('hold-plan.json', JSON.stringify({ url: PAGE_URL, arms: withLogicOnlySteps(ARMS) }));
channel.clear('hold-results.json');
try {
    channel.run(['--plan', channel.path('hold-plan.json'), '--out', channel.path('hold-results.json')],
        { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
} catch (e) {
    console.log(`DRIVER FAILED: ${e.message}`);
    process.exit(1);
}
const results = JSON.parse(channel.read('hold-results.json'));
if (!proveDriverChannel(results.arms)) process.exit(1);

/** The arm's call values, in order, and its five read points A–E. */
const readsOf = (arm) => {
    const vals = arm.results.filter((r) => 'call' in r || r.eval === 'successor')
        .map((r) => r.value);
    // 0 load, 1 start, 2-4 A, 5-7 B, 8 successor, 9-11 C, 12 start, 13-15 D, 16-18 E
    const at = (i) => ({ status: JSON.parse(vals[i]), seam: JSON.parse(vals[i + 1]).seam,
        mobiles: JSON.parse(vals[i + 2]).mobiles ?? [] });
    return { load: vals[0], start: vals[1], succ: vals[8], restart: vals[12],
        A: at(2), B: at(5), C: at(9), D: at(13), E: at(16) };
};
const bodies = (r) => JSON.stringify(r.mobiles.map((m) => [m.cls, m.x, m.y]));
const music = (seam) => `${seam?.['static.Music.currentSet']}/${seam?.['static.Music.currentIndex']}`;

if (!HOLD.capable) {
    const v = results.arms[0].results.find((r) => r.call === 'botLoadTape')?.value ?? '';
    check(`${PAGE_NAME} (no \`hold\`): the loader REFUSES tape_version 12 by name`,
        /^error:tape_version/.test(String(v)), String(v));
    process.exit(failures === 0 ? 0 : 1);
}

const byName = new Map(results.arms.map((a) => [a.name, a]));
for (const name of ['held', 'free']) {
    const a = byName.get(name);
    check(`${name}: the arm ran`, a && !a.crashed, a?.error ?? '');
}
const H = readsOf(byName.get('held'));
const F = readsOf(byName.get('free'));
const latch = H.A.seam['save.time'];
console.log(`\n  held: latch ${latch}; game_time A ${H.A.status.game_time} · B ${H.B.status.game_time} `
    + `· C ${H.C.status.game_time}; successor armed_at ${H.D.status.arm.armed_at}, latch `
    + `${H.D.seam['save.time']}`);
console.log(`  free: latch ${F.A.seam['save.time']}; game_time A ${F.A.status.game_time} · B `
    + `${F.B.status.game_time} · C ${F.C.status.game_time}; successor armed_at `
    + `${F.D.status.arm.armed_at}, latch ${F.D.seam['save.time']}\n`);

check('C1 held: the game REPORTS the hold (`held` true at the finish)', H.A.status.held === true,
    `held ${H.A.status.held}`);
check('C1 held: the clock is FROZEN at the latch — A = B = C = the latch\'s save.time (Δ0)',
    [H.A, H.B, H.C].every((r) => r.status.game_time === latch), `latch ${latch}`);
check('C1 held: `botLoadTape` does NOT release it (still held at C)', H.C.status.held === true,
    `held ${H.C.status.held}`);
check('C1 held: the bodies did not move across the hold (A = B = C)',
    bodies(H.A) === bodies(H.B) && bodies(H.B) === bodies(H.C), bodies(H.A));
check('C1 held: the successor starts FROM the latch — its latch save.time = the first\'s (Δ0) '
    + 'and its rng.gameplay too', H.D.seam['save.time'] === latch
    && H.D.seam['rng.gameplay'] === H.A.seam['rng.gameplay'],
`${H.D.seam['save.time']} vs ${latch}`);
check('C2: `arm.armed_at` IS the clock at the successor\'s arm (the existing readout)',
    H.D.status.arm.armed_at === latch, `armed_at ${H.D.status.arm.armed_at}`);
check('C3: the mixer at the successor\'s latch = the first latch\'s (nothing drained)',
    music(H.D.seam) === music(H.A.seam), `${music(H.A.seam)} → ${music(H.D.seam)}`);
check('control free: no hold is reported and the clock RUNS between the windows',
    F.A.status.held === false && F.B.status.game_time > F.A.status.game_time
    && F.D.seam['save.time'] > F.A.seam['save.time'],
    `+${F.D.seam['save.time'] - F.A.seam['save.time']} frame(s) of gap`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
