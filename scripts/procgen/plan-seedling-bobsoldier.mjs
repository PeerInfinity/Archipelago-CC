#!/usr/bin/env node
/**
 * plan-seedling-bobsoldier — ⛓⛓⛓ seedling-fidelity-bobsoldier: THE BOBSOLDIER'S DRIVEN WITNESSES.
 *
 * The BobSoldier is a stepped chaser with a spinning sword since this slice (`chasers.CHASERS.bobsoldier`,
 * `bobSoldier.js`, `contactFidelity.bobSoldierLive`). No committed tape can witness it: the four that cross L30 with
 * `noDamage` false stay outside its 80 px leash the whole time (the R8 exposure guard's rows). These tapes retire
 * `noDamage` on purpose, are recorded on the GAME (`check-seedling-bot-differential --record --only=<name>`), and the
 * model must agree per tick — and `probe-seedling-bobsoldier-mobiles.mjs` compares the body itself.
 *
 *   bobsoldier-sword   L30, the player standing still at (104,120) east-south-east of `bobsoldier@48,80` (built at
 *                      (56,88)), no item: the chase closes, the spin begins inside `attackRange` 32 (the `int` d), the
 *                      blade sweeps π/10 a tick from 8 to 16 px off the body and knocks the player at force 3. The
 *                      tape ends after the SECOND sword hit and before the third (which would kill: `hitsMax` 3).
 *   bobsoldier-kill    the same boot with a sword: one tick of `left` to face west, then a press whenever the body is
 *                      in `slash()`'s reach and the 31-tick cadence allows — three landed hits (two knock it back
 *                      by `swordForce` 5 from the player's point), `destroy` at the third (no die animation), and
 *                      the eleven-tick fade during which the corpse still CHASES and SWINGS, then the removal.
 *   bobsoldier-corpse  the kill strategy with the third press held 19 ticks past the cadence: the body dies with its
 *                      blade mid-spin, and the CORPSE's blade (no `destroy` gate) hits the player during the fade.
 *
 * The stances are CHOSEN, not derived — a witness is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-bobsoldier.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-bobsoldier.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { chaserBoxAt, deathTicks } = await import(join(MODULE, 'chasers.js'));
const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
const { removalTicksAfterHit } = await import(join(MODULE, 'enemyDamage.js'));
const { ENEMY_CLASSES } = await import(join(MODULE, 'combat.js'));
const { BOB_SOLDIER } = await import(join(MODULE, 'bobSoldier.js'));
const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

if (CONTACT_FIDELITY.bobSoldierLive !== true) {
    console.error('plan-seedling-bobsoldier: `contactFidelity.bobSoldierLive` is OFF — the model has no BobSoldier to '
        + 'author against (unset SEEDLING_CONTACT_FIDELITY).');
    process.exit(2);
}

const levelSource = atlasLevelSource();
/** L30's one BobSoldier — `<bobsoldier x="48" y="80"/>`, constructed at (56,88). */
const TARGET = 'bobsoldier@48,80';
/** Three tiles east and two south of the placement, on the open floor: d ≈ 56 at boot, inside the leash. */
const BOOT = Object.freeze({ level: 30, x: 96, y: 112 });

function stage(items = {}) {
    return createLevelRun({
        levelSource,
        boot: BOOT,
        noclip: false,
        noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser.
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items },
        roles: ROLES,
    });
}

function tapeJson(name, perTick, items, description) {
    const folded = buildTape(perTick, BOOT, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling',
        name,
        boot: BOOT,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: { items },
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
    const parsed = parseTape({ ...tape, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

// ── bobsoldier-sword ─────────────────────────────────────────────────
{
    const NAME = 'bobsoldier-sword';
    const run = stage({});
    const NO_KEYS = new Set();
    const perTick = [];
    let begun = null;
    for (let i = 0; i < 400; i += 1) {
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
        const c = run.chasers.find((x) => x.id === TARGET);
        if (begun === null && c?.swordSpinning) begun = i + 1;
        const swords = run.playerHits.filter((h) => h.source === 'sword');
        // stop 20 ticks after the second hit, well before the third
        if (swords.length === 2 && i + 1 >= swords[1].t + 20) break;
    }
    const swords = run.playerHits.filter((h) => h.source === 'sword');
    check('⛓⛓⛓ TWO sword hits land, hits 1 -> 2, and the player is ALIVE at the end',
        swords.length === 2 && JSON.stringify(swords.map((h) => h.hits)) === '[1,2]'
            && run.playerDeaths.length === 0,
        JSON.stringify(swords.map((h) => ({ t: h.t, hits: h.hits, kb: h.knockback }))));
    // `p.hit(this, 3 * damage, new Point(x, y), damage)` → `Player.knockback`, whose per-axis gate keeps only the
    // component that lands: the player stands EAST of the body, so the throw is east and at most the force.
    check(`⛓ each hit throws the player EAST (away from the body), by at most \`3 * damage\` = ${BOB_SOLDIER.swordForcePerDamage}`,
        swords.every((h) => h.knockback && h.knockback.dx > 0
            && Math.hypot(h.knockback.dx, h.knockback.dy) <= BOB_SOLDIER.swordForcePerDamage + 1e-9),
        JSON.stringify(swords.map((h) => h.knockback)));
    check('⛓ the spin BEGAN inside `attackRange` before the first hit', begun !== null && begun < swords[0]?.t,
        `spin began t ${begun}`);
    const description = '⛓⛓⛓ seedling-fidelity-bobsoldier — THE SWORD, DRIVEN. L30, the player standing still at '
        + '(104,120), south-east of `bobsoldier@48,80` (built at (56,88)), no item and `noDamage` FALSE (under the '
        + 'flag the run steps no chaser). The model predicts: the chase closes (Bob\'s block, moveSpeed 0.8); the '
        + `spin begins at t ${begun}, inside \`attackRange\` 32 (the \`int\` d); the blade turns π/10 a tick and `
        + '`swordHitting`\'s `collideLine("Player", …)` from 8 to 16 px off the body knocks the player at force 3 — '
        + `hit 1 at t ${swords[0]?.t}, hit 2 at t ${swords[1]?.t}. The third would kill (\`hitsMax\` 3), so the tape `
        + 'stops short of it. Authored by scripts/procgen/plan-seedling-bobsoldier.mjs.';
    emit(NAME, tapeJson(NAME, perTick, {}, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, spin began t ${begun}, sword hits at t `
        + `${swords.map((h) => h.t).join(', ')}`);
}

// ── bobsoldier-kill ──────────────────────────────────────────────────
{
    const NAME = 'bobsoldier-kill';
    const ITEMS = { hasSword: true };
    const CADENCE = 31;
    const HITS_TO_KILL = ENEMY_CLASSES.bobsoldier.kill.hits;
    const run = stage(ITEMS);
    const NO_KEYS = new Set();
    const WEST = new Set(['left']);
    const PRESS = new Set(['primary']);
    const perTick = [];
    const bodyOf = () => {
        const c = run.chasers.find((x) => x.id === TARGET);
        return c && !c.destroy ? chaserBoxAt(c.tag, c.x, c.y) : null;
    };
    const landedRows = () => run.chaserPressHits.filter((h) => h.landed);
    let presses = 0;
    let last = -99;
    for (let i = 0; i < 600; i += 1) {
        if (landedRows().length >= HITS_TO_KILL) break;
        const b = bodyOf();
        const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
        // ⚠ ONE tick of `left` first: `slash()` swings the way the player FACES, and the boot faces down.
        const held = i === 0 ? WEST
            : (reach <= SLASH_REACH && i - last >= CADENCE && presses < HITS_TO_KILL + 3 ? PRESS : NO_KEYS);
        if (held === PRESS) { presses += 1; last = i; }
        perTick.push(held);
        run.advance(held);
        if (run.playerDeaths.length > 0) break;
    }
    const OWED = removalTicksAfterHit('BobSoldier', deathTicks('bobsoldier'));
    for (let i = 0; i < OWED + 8; i += 1) {
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    const landed = landedRows();
    const kills = run.chaserKills;
    check('⛓⛓⛓ THREE presses LAND on the live BobSoldier, 1 -> 2 -> 3 of `hitsMax` 3',
        landed.length === HITS_TO_KILL && JSON.stringify(landed.map((h) => h.hits)) === '[1,2,3]',
        JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed }))));
    check('⛓ the two non-killing hits shove it (`Enemy.knockback`, inherited), the killing one does not',
        landed.length === 3 && landed[0].knockback && landed[1].knockback && landed[2].knockback === null,
        JSON.stringify(landed.map((h) => h.knockback)));
    check('⛓ ONE death, billed to the PRESS', kills.length === 1 && kills[0].by === 'press', JSON.stringify(kills));
    check('⛓⛓ the corpse is GONE by the end — `destroy` at the blow, the eleven-tick fade, the removal',
        !run.chasers.some((c) => c.id === TARGET), `removalTicksAfterHit = ${OWED}`);
    check('the player is alive at the end', run.playerDeaths.length === 0, '');
    const swords = run.playerHits.filter((h) => h.source === 'sword');
    const contacts = run.playerHits.filter((h) => h.source === 'chaser');
    const description = '⛓⛓⛓ seedling-fidelity-bobsoldier — THE DEATH, DRIVEN. `KILL_ARM_POLICY.BobSoldier` flipped '
        + '`refused` -> `modelled` this slice; this is the witness. The `bobsoldier-sword` boot (L30, (104,120)) with a '
        + 'sword: one tick of `left` to face west, then a press whenever the body is in `slash()`\'s reach and the '
        + `31-tick cadence allows. Three LANDED hits (t ${landed.map((h) => h.t).join(', ')}); the first two shove it `
        + 'by `swordForce` 5 from the player\'s point, the third sets `destroy` (BobSoldier plays no "die"), and '
        + `\`Mobile.death\`'s fade removes it ${OWED} ticks later — a corpse that keeps chasing and swinging until then. `
        + `Sword hits on the player: ${swords.length}${swords.length ? ` (t ${swords.map((h) => h.t).join(', ')})` : ''}; `
        + `body contacts: ${contacts.length}. Authored by scripts/procgen/plan-seedling-bobsoldier.mjs.`;
    emit(NAME, tapeJson(NAME, perTick, ITEMS, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, ${landed.length} landed at t `
        + `${landed.map((h) => h.t).join(', ')}, kill at t ${kills[0]?.t}, sword hits ${JSON.stringify(swords.map((h) => h.t))}, `
        + `contacts ${JSON.stringify(contacts.map((h) => h.t))}`);
}

// ── bobsoldier-corpse ────────────────────────────────────────────────
// ⛔ THE CLAIM NO OTHER WITNESS REACHES: `BobSoldier.update` has no `destroy` gate, so the corpse's blade keeps
// turning and keeps HITTING through `Mobile.death`'s fade. `bobsoldier-kill`'s corpse sweeps the quarter away from the
// player, so here the THIRD press waits `DELAY` ticks past the cadence: the spin that began before the blow is then
// a few ticks short of the player's quarter when the body dies, and the corpse's blade crosses the player mid-fade.
{
    const NAME = 'bobsoldier-corpse';
    const ITEMS = { hasSword: true };
    const CADENCE = 31;
    const DELAY = 19;
    const HITS_TO_KILL = ENEMY_CLASSES.bobsoldier.kill.hits;
    const run = stage(ITEMS);
    const NO_KEYS = new Set();
    const WEST = new Set(['left']);
    const PRESS = new Set(['primary']);
    const perTick = [];
    const bodyOf = () => {
        const c = run.chasers.find((x) => x.id === TARGET);
        return c && !c.destroy ? chaserBoxAt(c.tag, c.x, c.y) : null;
    };
    const landedRows = () => run.chaserPressHits.filter((h) => h.landed);
    let last = -99;
    for (let i = 0; i < 600; i += 1) {
        if (run.chaserKills.length > 0) break;
        const b = bodyOf();
        const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
        const need = landedRows().length === HITS_TO_KILL - 1 ? CADENCE + DELAY : CADENCE;
        const held = i === 0 ? WEST : (reach <= SLASH_REACH && i - last >= need ? PRESS : NO_KEYS);
        if (held === PRESS) last = i;
        perTick.push(held);
        run.advance(held);
        if (run.playerDeaths.length > 0) break;
    }
    const OWED = removalTicksAfterHit('BobSoldier', deathTicks('bobsoldier'));
    for (let i = 0; i < OWED + 8; i += 1) { perTick.push(NO_KEYS); run.advance(NO_KEYS); }
    const kills = run.chaserKills;
    const swords = run.playerHits.filter((h) => h.source === 'sword');
    const corpseHits = swords.filter((h) => h.t > (kills[0]?.t ?? Infinity));
    check('⛓ ONE death, billed to the PRESS', kills.length === 1 && kills[0].by === 'press', JSON.stringify(kills));
    check('⛔⛔ the CORPSE\'s blade hits the player during the fade (no `destroy` gate in `BobSoldier.update`)',
        corpseHits.length === 1 && corpseHits[0].t - kills[0].t < OWED,
        JSON.stringify(swords.map((h) => ({ t: h.t, hits: h.hits }))));
    check('the player is alive at the end', run.playerDeaths.length === 0, '');
    check('the corpse is gone by the end', !run.chasers.some((c) => c.id === TARGET), '');
    const description = '⛓⛓⛓ seedling-fidelity-bobsoldier — THE CORPSE STILL SWINGS. The `bobsoldier-kill` boot and '
        + `strategy with the THIRD press held ${DELAY} ticks past the 31-tick cadence: the body dies (billed t `
        + `${kills[0]?.t}) with its blade mid-spin a few ticks short of the player's quarter. \`BobSoldier.update\` `
        + 'runs `super.update()` (where `Mobile.death` fades the alpha) and then its tail with NO `destroy` test, so '
        + 'the spin keeps turning and `swordHitting` keeps testing: the model bills the CORPSE\'s blade at t '
        + `${corpseHits.map((h) => h.t).join(', ')}, ${corpseHits[0] ? corpseHits[0].t - kills[0].t : '?'} ticks into `
        + `the ${OWED}-tick fade. Authored by scripts/procgen/plan-seedling-bobsoldier.mjs.`;
    emit(NAME, tapeJson(NAME, perTick, ITEMS, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, kill at t ${kills[0]?.t}, sword hits ${JSON.stringify(swords.map((h) => h.t))}`);
}

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
