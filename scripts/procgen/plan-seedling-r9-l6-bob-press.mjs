/**
 * ⛓⛓⛓ R9 SLICE 12 — **THE PRESS ARM'S DRIVEN WITNESS AGAINST A CHASER.**
 *
 * `KILL_ARM_POLICY.Bob` flipped `refused` -> `modelled` this slice, and a
 * refusal retired without a driven witness is trap 101. This is the witness:
 * the player presses ONE bob to death in L6 and the GAME adjudicates every
 * consequence the R8 refusal itemised.
 *
 * ⛔⛔ THE REFUSAL'S OWN BILL, AND WHAT THIS TAPE ASKS THE GAME ABOUT:
 *   · `Enemy.hit`'s five gates against a chaser — the model says three presses
 *     land and that tests 2..5 of each are refused on a 30-tick i-frame;
 *   · the KNOCKBACK — `swordForce` 5 from the PLAYER's entity point on a
 *     non-killing hit, and NONE at all on the killing one;
 *   · the death as an ANIMATION — `Bob.startDeath` plays "die" without setting
 *     `destroy`, so `totalEnemies()` counts the corpse for the whole 25 ticks
 *     and the body leaves 36 ticks after the blow;
 *   · the `classCount` move — computed, and L6's answer is a scanned nil.
 *
 * ⚠ `noDamage` IS **FALSE**, AND IT HAS TO BE — which is the opposite of
 * `r8-l18-spinner-press`'s configuration and not a preference. Under that flag
 * the run steps no chaser at all, so it has no live position to offer and
 * `chaserPressBodiesNow` returns `null` by design: the press would reach
 * nothing and the tape would be a witness to an empty room. So the player
 * stands in a live bob's leash, unprotected, for the whole exchange — and that
 * it takes ZERO hits is one of the claims rather than a happy accident.
 *
 * ⚠ THE STANCE IS CHOSEN, NOT DERIVED. A witness is not a solve: the walk is
 * "east until the bob is in reach, then STAND STILL and let it come back",
 * because a knocked bob recoils 5 px and chases straight in again, which is
 * what makes a three-hit kill reachable without walking into it. The COUNTS
 * are the mechanism's.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r9-l6-bob-press.mjs
 *   node scripts/procgen/plan-seedling-r9-l6-bob-press.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-l6-bob-press
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { chaserBoxAt, deathTicks } = await import(join(MODULE, 'chasers.js'));
const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
const { SWORD_FORCE } = await import(join(MODULE, 'combatVerbs.js'));
const { removalTicksAfterHit } = await import(join(MODULE, 'enemyDamage.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const NAME = 'r9-l6-bob-press';
const BOOT = Object.freeze({ level: 6, x: 80, y: 48 });
/** L6's eastern bob — the one the player's own approach walks into. */
const TARGET = 'bob@112,48';
/** `KILL_PRESS_CADENCE`'s reason, used as a cadence and not as a law here. */
const CADENCE = 31;
const HITS_TO_KILL = 3;

const levelSource = atlasLevelSource();
const run = createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⚠ FALSE — see the header. The claim needs a LIVE chaser.
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    // A sword is what a press needs; the rest of the campaign is irrelevant.
    seam: { items: { hasSword: true } },
    roles: ROLES,
});

const NO_KEYS = new Set();
const EAST = new Set(['right']);
const PRESS = new Set(['primary']);
const perTick = [];
const MAX_TICKS = 600;

const bodyOf = () => {
    const c = run.chasers.find((x) => x.id === TARGET);
    return c ? chaserBoxAt(c.tag, c.x, c.y) : null;
};
const landedRows = () => run.chaserPressHits.filter((h) => h.landed);

let presses = 0;
let last = -99;
for (let i = 0; i < MAX_TICKS; i += 1) {
    // ⛔ DRIVEN BY THE LEDGER, NOT BY THE PRESS COUNT: a press is issued on one
    // tick and its five hit tests run on T+1..T+5, so stopping when the last
    // press was ISSUED would read the ledger before the swing had touched
    // anything.
    if (landedRows().length >= HITS_TO_KILL) break;
    const b = bodyOf();
    const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
    const held = (reach <= SLASH_REACH && i - last >= CADENCE && presses < HITS_TO_KILL)
        ? PRESS
        : (presses === 0 ? EAST : NO_KEYS);
    if (held === PRESS) { presses += 1; last = i; }
    perTick.push(held);
    run.advance(held);
    if (run.playerDeaths.length > 0) break;
}
/**
 * ⛓ AND A TAIL LONG ENOUGH TO SPEND THE WHOLE DEATH STAGING, because the
 * removal is the fencepost the game and the model most easily disagree about:
 * `endAnim` sets `destroy` at the animation's end and `MOBILE_DEATH_FADE`
 * ticks after that. A tape that stopped at the killing blow would never ask.
 */
const OWED = removalTicksAfterHit('Bob', deathTicks('bob'));
for (let i = 0; i < OWED + 8; i += 1) {
    perTick.push(NO_KEYS);
    run.advance(NO_KEYS);
}

const landed = landedRows();
const tests = run.chaserPressHits;
const kills = run.chaserKills;
const locks = run.chaserPressKillLocks;

check('⛓⛓⛓ THREE presses LAND on the live bob, 1 -> 2 -> 3 of `hitsMax` 3',
    landed.length === HITS_TO_KILL
        && JSON.stringify(landed.map((h) => h.hits)) === '[1,2,3]',
    JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed }))));
check('⛔ every landed hit arms the 30-tick i-frame — `hitsTimer = hitsTimerMax`',
    landed.every((h) => h.hitsTimer === 30),
    JSON.stringify(landed.map((h) => h.hitsTimer)));
check('⛔ `slash()`\'s own gate was satisfied on each — reach <= SLASH_REACH',
    landed.every((h) => h.reach <= SLASH_REACH),
    JSON.stringify(landed.map((h) => Number(h.reach.toFixed(3)))));
check('⛓⛓ the NON-killing hits are shoved by swordForce, and AWAY from the player',
    landed.slice(0, 2).every((h) => h.knockback
        && Math.abs(Math.hypot(h.knockback.dx, h.knockback.dy) - SWORD_FORCE) < 1e-3
        && h.knockback.dx > 0),
    JSON.stringify(landed.slice(0, 2).map((h) => h.knockback)));
check('⛔ …and the KILLING hit takes NO knockback — `Enemy.as`\'s own ordering',
    landed[HITS_TO_KILL - 1]?.knockback === null,
    // ⚠ `null` IS THE ANSWER HERE, so the detail must not print an absent row
    // and a correct null the same way — the check is on the row's presence AND
    // its value.
    landed.length === HITS_TO_KILL
        ? `knockback = ${String(landed[HITS_TO_KILL - 1].knockback)}`
        : '⛔ no killing hit row at all');
check('⛓ ONE death, billed to the PRESS, one tick after the blow',
    kills.length === 1 && kills[0].by === 'press' && kills[0].weapon === 'sword'
        && kills[0].t === landed[HITS_TO_KILL - 1].t + 1,
    JSON.stringify(kills));
check('⛔ the kill-lock scan RAN and L6\'s answer is a MEASURED nil',
    locks.length === 1 && locks[0].nil === true && /scanned, not assumed/.test(locks[0].why),
    JSON.stringify(locks.map((l) => ({ nil: l.nil, opens: l.opens }))));
check('⛓⛓ the corpse is GONE by the end — the whole death staging is spent',
    !run.chasers.some((c) => c.id === TARGET),
    `removalTicksAfterHit = ${OWED}; tail = ${OWED + 8}`);
check('⛔⛔ the player took ZERO hits standing inside a LIVE bob\'s leash',
    run.playerHits.length === 0 && run.playerDeaths.length === 0,
    `${run.playerHits.length} hit(s), ${run.playerDeaths.length} death(s)`);

const folded = buildTape(perTick, BOOT, NAME,
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: NAME,
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['dead_frames'],
    // ⚠ A v6 `save` BLOCK IS REQUIRED ONCE A SEAM IS DECLARED, and a v7 `rng`
    // one for the same reason — a null would be the format's "inherit", which
    // a tape carrying a seam may not say (trap 130).
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 1, split: false },
    seam: { items: { hasSword: true } },
    tick_count: perTick.length,
    inputs: folded.inputs,
    tape_version: 8,
};

const description = '⛓⛓⛓ R9 SLICE 12 — THE PRESS ARM\'S DRIVEN WITNESS AGAINST A '
    + 'CHASER. `KILL_ARM_POLICY.Bob` flipped `refused` -> `modelled` this slice and a '
    + 'refusal retired without a driven witness is trap 101; this is the witness. The '
    + 'player presses L6\'s `bob@112,48` to death and the GAME adjudicates every '
    + `consequence the R8 refusal itemised: ${landed.length} LANDED hits out of `
    + `${tests.length} recorded hit TEST(s) (⛔ one press is FIVE tests and the RECEIVER `
    + 'decides — `enemyHit` sets `hitsTimer` 30, so tests 2..5 are refused on i-frames), '
    + 'a `swordForce` 5 knockback from the PLAYER\'s entity point on each NON-killing '
    + 'hit and NONE on the killing one, the death as an ANIMATION during which '
    + `\`totalEnemies()\` still counts the body (${OWED} ticks from the blow to the `
    + 'removal), and the `classCount` consequence COMPUTED — L6 holds no `tset -1` lock '
    + 'and that nil is scanned rather than assumed. ⚠ `noDamage` is **FALSE** and it has '
    + 'to be, which is the opposite of `r8-l18-spinner-press`: under that flag the run '
    + 'steps no chaser, so the press would reach nothing and the tape would witness an '
    + 'empty room. The player therefore stands in a live bob\'s leash unprotected for '
    + 'the whole exchange, and that it takes ZERO hits is one of the claims. The stance '
    + 'is CHOSEN, not derived — a witness is not a solve. Authored by '
    + 'scripts/procgen/plan-seedling-r9-l6-bob-press.mjs.';

function tapeJson(obj) {
    const parsed = parseTape({ ...obj, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

const path = join(TAPES, `${NAME}.json`);
const json = tapeJson(tape);
if (CHECK) {
    const same = existsSync(path) && readFileSync(path, 'utf8') === json;
    check('⛓ the committed tape is what this script produces today', same,
        same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
} else {
    writeFileSync(path, json);
    console.log(`\nwrote ${path.slice(REPO.length + 1)}`);
}
console.log(`\n## ${NAME}: ${perTick.length} ticks, ${landed.length} landed hit(s), `
    + `${kills.length} kill(s), ${run.playerHits.length} player hit(s)`);
if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
