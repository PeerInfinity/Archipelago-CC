#!/usr/bin/env node
/**
 * plan-seedling-hammer-c2-ghost — ⛓⛓⛓ SEEDLING HAMMER-PHASE C2 D1: THE GHOST SWORD AGAINST A SPINNER, ON THE GAME.
 *
 * The ghost press is modelled since fidelity GHOSTSWORD (`ghostSword.js`, `levelRun.applyThrust`'s ghost arm) and its
 * release since GHOSTMOTION (`slashEndTicksFor`), but no committed tape ever pressed the ghost sword in a spinner room:
 * the witnesses were a rock, a plain rock, a BobSoldier and open floor. This is the spinner's. The game is the witness
 * (`check-seedling-bot-differential --record --only=hammer-c2-l18-ghostspinner`): the player's stream must be the
 * model's at every tick, and the bodies are asked of the game too (`probe-seedling-u9-shield-mobiles.mjs
 * --class=Spinner`: position, `hits`, `hits_timer` per sampled tick), as are the tests (`probe-seedling-dash-window.mjs`:
 * `Bot.slashTests`, cumulative, per sampled tick).
 *
 *   hammer-c2-l18-ghostspinner   L18, `r9-solve-18`'s frozen staging (`fixtures/witness-bases/r9-solve-18.hammer-a.json`)
 *                                with ONE progress override: `seam.items.hasGhostSword` true — the override
 *                                `ghostsword-l30-bobsoldier` already commits (the sword AND the ghost sword; the ghost
 *                                sword never tests without the sword). The walk heads for `spinner@48,96` and presses
 *                                the moment the body is inside 20 px and the ghost rect toward it overlaps it. The
 *                                presses then run the chain 0 · 2 · 8 · 10 · 18 with the facing key held (the motion
 *                                witnesses' stance): a swing, a dash, a press the ghost dash's 6-tick release SWALLOWS
 *                                (the sword's chain dashes there), and two dashes. Then it waits out the 30-tick i-frame
 *                                and aims and presses once more. Measured in the model, and asked of the game:
 *                                  · the swing lands from beyond the SWORD's reach (16) and inside the ghost's (24);
 *                                  · each landing is 2 damage (`ghostSwordDamage`): `hits` 0 → 2 → 4, and the second
 *                                    landing kills a `hitsMax`-3 body (the sword needs three);
 *                                  · each swing tests 7 ticks and each dash 6 (a dash REPLACES the swing's window);
 *                                  · the outcomes slash · dash · swallowed · dash · dash · slash.
 *
 * ⛔ The walk is CHOSEN, not derived — a witness is not a solve. The tick it presses is a pure function of the model's
 * run, so `--check` re-derives it byte for byte.
 *
 * ⚠ The base's timed clear (`{18,0} @450`, the kill lock its solve opened) is dropped: this walk kills one body and
 * crosses nowhere. `tick0` is dropped too (a game measurement of the committed clock's boot fields).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-hammer-c2-ghost.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-c2-ghost.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

/** The witness's walk, exported for `hammerGhostSpinner.test.js` (which asks the forecast on the same tape). */
export const NAME = 'hammer-c2-l18-ghostspinner';
export const TARGET = 'spinner@48,96';
/** Presses relative to the first: the swing, then the ghost dash chain with the sword's t 8 inside it. */
export const CHAIN = Object.freeze([0, 2, 8, 10, 18]);
/** The press trigger: the body's rect within this of the player's point (the ghost's reach is 24). */
export const TRIGGER = 20;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape, chooseHeld } = await import(join(MODULE, 'botDriverV1.js'));
    const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
    const { facingToward, FACING_KEYS } = await import(join(MODULE, 'solverBot.js'));
    const { GHOSTSWORD_PRESS, GHOST_SWORD_REACH, GHOST_SLASH_ANIM_TICKS, ghostSlashRect } = await import(
        join(MODULE, 'ghostSword.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    if (GHOSTSWORD_PRESS.enabled !== true) {
        console.error('plan-seedling-hammer-c2-ghost: `ghostSword.GHOSTSWORD_PRESS` is OFF — there is no ghost swing to '
            + 'author against (unset SEEDLING_GHOSTSWORD, or set it to 1).');
        process.exit(2);
    }

    const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'witness-bases', 'r9-solve-18.hammer-a.json'), 'utf8'));
    const staging = stagingFromTape(base);
    const seam = { ...staging.seam, items: { ...staging.seam.items, hasGhostSword: true } };
    const persistence = staging.persistence.filter((c) => c.at === undefined);
    const run = createRunForStaging({ ...staging, seam, persistence, equips: [] }, atlasLevelSource());

    const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    const ready = (b) => distanceRectPoint(run.state.x, run.state.y, b.rect) <= TRIGGER
        && overlaps(ghostSlashRect(run.state.x, run.state.y, facingToward(run.state, b.rect)), b.rect);
    const perTick = [];
    let first = null;
    let second = null;
    let aimed = false;
    for (let i = 0; i < 400; i += 1) {
        const b = (run.entities('spinnerBodies') ?? []).find((x) => x.id === TARGET);
        if (!b && second !== null && i > second + 15) break;
        let held = new Set();
        const face = b ? FACING_KEYS[facingToward(run.state, b.rect)] : null;
        if (first === null && b) {
            if (ready(b)) first = i;
            else held = chooseHeld(run.state, { x: b.x, y: b.y }, 2);
        }
        if (first !== null && i >= first && i <= first + CHAIN.at(-1) + 1) {
            held = new Set([face]);
            if (CHAIN.includes(i - first)) held.add('primary');
        } else if (first !== null && second === null && b) {
            if (aimed) {
                held = new Set(['primary']);
                second = i;
            } else if (b.hitsTimer === 0 && ready(b)) {
                held = new Set([face]);
                aimed = true;
            } else if (!ready(b)) {
                held = chooseHeld(run.state, { x: b.x, y: b.y }, 2);
            }
        }
        perTick.push(held);
        run.advance(held);
    }

    const outcomes = run.slashPresses.map((p) => `${p.t - first}:${p.outcome}`);
    const tests = new Map();
    for (const p of run.presses.filter((x) => x.weapon === 'ghostsword')) tests.set(p.t, (tests.get(p.t) ?? 0) + 1);
    const landed = run.spinnerPressHits.filter((h) => h.landed);
    check('⛓⛓⛓ the outcomes are slash · dash · SWALLOWED · dash · dash, then the second slash',
        JSON.stringify(outcomes) === JSON.stringify(['0:slash', '2:dash', '8:swallowed', '10:dash', '18:dash',
            `${second - first}:slash`]), outcomes.join(' '));
    const want = { [first]: 2, [first + 2]: GHOST_SLASH_ANIM_TICKS.slashnarrow, [first + 10]:
        GHOST_SLASH_ANIM_TICKS.slashnarrow, [first + 18]: GHOST_SLASH_ANIM_TICKS.slashnarrow,
        [second]: GHOST_SLASH_ANIM_TICKS.slash };
    check(`⛓⛓ each swing tests ${GHOST_SLASH_ANIM_TICKS.slash} ticks and each dash `
        + `${GHOST_SLASH_ANIM_TICKS.slashnarrow} (the t 2 dash REPLACES the swing's window after 2)`,
        JSON.stringify(Object.fromEntries(tests)) === JSON.stringify(want), JSON.stringify(Object.fromEntries(tests)));
    check(`⛓⛓⛓ two landings, 2 damage each: hits ${JSON.stringify(landed.map((h) => h.hits))}, the second kills a `
        + `\`hitsMax\` ${SPINNER.hitsMax} body`, landed.length === 2 && landed.every((h) => h.weapon === 'ghostsword')
        && JSON.stringify(landed.map((h) => h.hits)) === '[2,4]' && landed[1].killed === true,
        JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed }))));
    check(`⛓⛓ the first landing is from beyond the sword's reach (${SLASH_REACH}) and within the ghost's `
        + `(${GHOST_SWORD_REACH})`, landed[0].reach > SLASH_REACH && landed[0].reach <= GHOST_SWORD_REACH,
        `distanceRectPoint ${landed[0]?.reach.toFixed(3)}`);
    check('⛓ the body is gone by the end, and the player took no hit',
        !(run.entities('spinnerBodies') ?? []).some((x) => x.id === TARGET) && run.playerHits.length === 0,
        `hits ${run.playerHits.length}`);

    const tape = buildTape(perTick, staging.boot, NAME, { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE C2 D1 — THE GHOST SWORD AGAINST A SPINNER, ON THE GAME. '
        + "`r9-solve-18`'s frozen staging (`witness-bases/r9-solve-18.hammer-a.json`) with ONE progress override, "
        + '`seam.items.hasGhostSword` true (the sword is held too: a ghost sword alone never tests). The walk heads for '
        + `\`${TARGET}\` and presses at t ${first}, when the body is inside ${TRIGGER} px and the ghost rect (24 x 48) `
        + `toward it overlaps it; then presses at +${CHAIN.slice(1).join(', +')} with the facing key held. The swing `
        + `lands at t ${landed[0]?.t} from ${landed[0]?.reach.toFixed(2)} px (past the sword's 16), 2 damage; the `
        + "+2 press DASHES and replaces the swing's window; the +8 press is SWALLOWED (the ghost dash's 6-tick "
        + 'release, which the sword chain would dash on); +10 and +18 dash; each dash tests 6 ticks. The i-frame run '
        + `out, it aims and presses at t ${second}: the landing at t ${landed[1]?.t} makes hits 4 and kills the `
        + 'body (the sword needs three). No hit on the player. Authored by scripts/procgen/plan-seedling-hammer-c2-ghost.mjs.';
    const raw = {
        ...base, name: NAME, persistence, seam, tick_count: perTick.length, inputs: tape.inputs, description,
    };
    delete raw.tick0;
    delete raw.note;
    const parsed = parseTape(raw);
    const json = `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    const path = join(TAPES, `${NAME}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${NAME} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
    console.log(`## ${NAME}: ${perTick.length} ticks, presses ${run.slashPresses.map((p) => p.t).join(',')}, landed `
        + `${landed.map((h) => `t${h.t} hits ${h.hits}${h.killed ? ' KILL' : ''}`).join(' · ')}`);
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
