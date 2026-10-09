#!/usr/bin/env node
/**
 * plan-seedling-ghostsword — ⛓⛓⛓ seedling-fidelity-ghostsword: THE GHOST SWORD'S DRIVEN WITNESSES.
 *
 * The ghost sword's press is modelled since this slice (`ghostSword.js`, `levelRun.applyThrust`'s ghost arm,
 * `presses.swordWindowStep`'s ghost window, all behind `GHOSTSWORD_PRESS`). No committed tape can witness it: before
 * this slice the model THREW on a ghostsword press, so no tape ever pressed one. These tapes are recorded on the GAME
 * (`check-seedling-bot-differential --record --only=<name>`), and the model must agree per tick.
 *
 *   ghostsword-l3-rockghost   L3, standing on the dungeon floor EAST of the water column, facing west, with the sword,
 *                             the ghost sword and the conch: ONE press breaks `breakablerockghost@0,64` (rockType 1 —
 *                             `hit(hasGhostSword ? 1 : 0)`) across the water from 18.35 px, which only the ghost
 *                             sword's 24 px reach and 24 x 48 rect can do (the sword's reach is 16, its rect 16 wide);
 *                             then the walk west swims the column and takes the teleporter under the rock to L111 — a
 *                             transition the game makes only if the rock is gone.
 *   ghostsword-l3-rock        L3's arrival pocket, the same items minus the conch: one press breaks the PLAIN
 *                             `breakablerock@96,112` (rockType 0) — the rock arm reads the FLAG, so the ghost sword
 *                             breaks both kinds — and the walk north passes where it stood.
 *   ghostsword-l30-bobsoldier the `bobsoldier-kill` boot (L30) with the ghost sword: a press whenever the body is in the
 *                             ghost swing's 24 px reach and the 31-tick cadence allows. Two LANDED hits kill it
 *                             (`genericHit(…, "Spear", 5, ghostSwordDamage 2)` against `hitsMax` 3 — the sword needs
 *                             three); the first knocks it back, the second sets `destroy`; the fade removes it.
 *
 * The stances are CHOSEN, not derived — a witness is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-ghostsword.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-ghostsword.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
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
    const { GHOSTSWORD_PRESS, GHOST_SWORD_REACH, GHOST_SLASH_ANIM_TICKS } = await import(join(MODULE, 'ghostSword.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    if (GHOSTSWORD_PRESS.enabled !== true) {
        console.error('plan-seedling-ghostsword: `ghostSword.GHOSTSWORD_PRESS` is OFF — the model has no ghost swing to '
            + 'author against (unset SEEDLING_GHOSTSWORD, or set it to 1).');
        process.exit(2);
    }

    const levelSource = atlasLevelSource();
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);

    function stage(boot, items) {
        return createLevelRun({
            levelSource,
            boot,
            noclip: false,
            noHazards: [],
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

    function tapeJson(name, boot, perTick, items, description) {
        const folded = buildTape(perTick, boot, name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const tape = {
            game: 'seedling',
            name,
            boot,
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

    // ── ghostsword-l3-rockghost ──────────────────────────────────────────
    {
        const NAME = 'ghostsword-l3-rockghost';
        const BOOT = Object.freeze({ level: 3, x: 28, y: 64 });
        const ITEMS = { hasSword: true, hasGhostSword: true, canSwim: true };
        const ROCK = 'breakablerockghost@0,64';
        const WEST = new Set(['left']);
        const run = stage(BOOT, ITEMS);
        const perTick = [];
        let transition = null;
        let pressAt = null;
        let goneAt = null;
        for (let i = 0; i < 200 && !transition; i += 1) {
            // one tick of `left` to face west, then the press, then stand until the rock is gone, then walk west
            let held = NO_KEYS;
            if (i === 0) held = WEST;
            else if (i === 1) { held = PRESS; pressAt = i; }
            else if (goneAt !== null && i >= goneAt + 2) held = WEST;
            perTick.push(held);
            const r = run.advance(held);
            if (goneAt === null && (run.entities('brokenRocks') ?? new Set()).has(ROCK)) goneAt = i + 1;
            if (r?.transition) transition = r.transition;
        }
        for (let i = 0; i < 10; i += 1) { perTick.push(NO_KEYS); run.advance(NO_KEYS); }
        const ghostPresses = run.presses.filter((p) => p.weapon === 'ghostsword');
        const first = ghostPresses[0];
        const fromX = first ? first.rect.right : null;   // the player's x at the first test (rect is x-24 .. x)
        const reach = first ? distanceRectPoint(fromX, first.rect.y + 24, { x: 0, y: 64, right: 16, bottom: 80 }) : null;
        check(`⛓⛓⛓ ONE ghost press is ${GHOST_SLASH_ANIM_TICKS.slash} hit tests (the sword's is 5)`,
            ghostPresses.length === GHOST_SLASH_ANIM_TICKS.slash && ghostPresses.every((p) => p.t === pressAt),
            `${ghostPresses.length} tests, fired ${ghostPresses.map((p) => p.fired).join(',')}`);
        check('⛓⛓ the FIRST test breaks the ghost rock (`hit(hasGhostSword ? 1 : 0)`, rockType 1)',
            first?.hits?.some((h) => h.id === ROCK && h.broke === true), JSON.stringify(first?.hits));
        check(`⛓⛓ from beyond the SWORD's reach (${SLASH_REACH}) and within the ghost's (${GHOST_SWORD_REACH})`,
            reach > SLASH_REACH && reach <= GHOST_SWORD_REACH, `distanceRectPoint ${reach?.toFixed(3)}`);
        check('⛓ the walk west takes the teleporter under the rock to L111', transition?.to_level === 111,
            JSON.stringify(transition));
        const description = '⛓⛓⛓ seedling-fidelity-ghostsword — THE GHOST ROCK, ACROSS THE WATER. L3, the player on the '
            + 'dungeon floor east of the water column, with the sword, the ghost sword and the conch: one tick of `left` to '
            + `face west, then ONE press at t ${pressAt}. The model: \`set slashing\` plays the ghost sword's "slash" (7 `
            + 'frames at 30 under the `FP.elapsed` clamp — SEVEN hit tests, the sword\'s five plus two), the rect is '
            + "`getSlashRect`'s ghost arm (24 along, `width * 2` = 48 across), and its first test reaches "
            + `\`${ROCK}\` from ${reach?.toFixed(2)} px — past the sword's 16, inside the ghost's 24 — and \`genericHit\`'s `
            + 'rock arm passes `hasGhostSword ? 1 : 0` = 1, which breaks a rockType-1 rock. The rock is gone at '
            + `t ${goneAt}; the walk west swims the column and takes the teleporter under it at t ${transition?.t} `
            + '(-> L111). Authored by scripts/procgen/plan-seedling-ghostsword.mjs.';
        emit(NAME, tapeJson(NAME, BOOT, perTick, ITEMS, description));
        console.log(`## ${NAME}: ${perTick.length} ticks, press t ${pressAt}, rock gone t ${goneAt}, `
            + `transition ${JSON.stringify(transition)}`);
    }

    // ── ghostsword-l3-rock ───────────────────────────────────────────────
    // ⛓ The PLAIN rock under the ghost sword: `genericHit`'s rock arm passes the FLAG (`hasGhostSword ? 1 : 0`), so a
    // ghost swing breaks a rockType-0 rock exactly as the sword does. L3's arrival pocket (route step 12's door).
    {
        const NAME = 'ghostsword-l3-rock';
        const BOOT = Object.freeze({ level: 3, x: 96, y: 128 });
        const ITEMS = { hasSword: true, hasGhostSword: true };
        const ROCK = 'breakablerock@96,112';
        const NORTH = new Set(['up']);
        const run = stage(BOOT, ITEMS);
        const perTick = [];
        let goneAt = null;
        for (let i = 0; i < 60; i += 1) {
            let held = NO_KEYS;
            if (i === 0) held = NORTH;
            else if (i === 1) held = PRESS;
            else if (goneAt !== null && i >= goneAt + 2) held = NORTH;
            perTick.push(held);
            run.advance(held);
            if (goneAt === null && (run.entities('brokenRocks') ?? new Set()).has(ROCK)) goneAt = i + 1;
            if (goneAt !== null && run.state.y <= 96) break;
        }
        const first = run.presses.find((p) => p.weapon === 'ghostsword');
        check('⛓⛓ a ghost swing breaks the PLAIN rock too (`hit(1)`, rockType 0 <= 1)',
            first?.hits?.some((h) => h.id === ROCK && h.broke === true), JSON.stringify(first?.hits));
        check('⛓ the walk north passes where the rock stood', goneAt !== null && run.state.y <= 96,
            `y ${run.state.y.toFixed(2)} at t ${perTick.length}`);
        const description = '⛓⛓⛓ seedling-fidelity-ghostsword — THE PLAIN ROCK UNDER THE GHOST SWORD. L3\'s arrival '
            + 'pocket, holding the sword and the ghost sword: one tick of `up`, then ONE press. `genericHit`\'s rock arm '
            + 'passes the FLAG — `hasGhostSword ? 1 : 0` — not the swing\'s `t`, so the ghost swing (24 x 48, seven tests) '
            + `breaks \`${ROCK}\` (rockType 0) at its first test; the rock is gone at t ${goneAt} and the walk north `
            + 'passes where it stood. Authored by scripts/procgen/plan-seedling-ghostsword.mjs.';
        emit(NAME, tapeJson(NAME, BOOT, perTick, ITEMS, description));
        console.log(`## ${NAME}: ${perTick.length} ticks, rock gone t ${goneAt}, y ${run.state.y.toFixed(2)}`);
    }

    // ── ghostsword-l30-bobsoldier ────────────────────────────────────────
    {
        const NAME = 'ghostsword-l30-bobsoldier';
        const BOOT = Object.freeze({ level: 30, x: 96, y: 112 });
        const ITEMS = { hasSword: true, hasGhostSword: true };
        const TARGET = 'bobsoldier@48,80';
        const CADENCE = 31;
        const run = stage(BOOT, ITEMS);
        const WEST = new Set(['left']);
        const perTick = [];
        const bodyOf = () => {
            const c = run.chasers.find((x) => x.id === TARGET);
            return c && !c.destroy ? chaserBoxAt(c.tag, c.x, c.y) : null;
        };
        let presses = 0;
        let last = -99;
        for (let i = 0; i < 600; i += 1) {
            if (run.chaserKills.length > 0) break;
            const b = bodyOf();
            const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
            // ⚠ ONE tick of `left` first: the swing goes the way the player FACES, and the boot faces down.
            const held = i === 0 ? WEST
                : (reach <= GHOST_SWORD_REACH && i - last >= CADENCE && presses < 6 ? PRESS : NO_KEYS);
            if (held === PRESS) { presses += 1; last = i; }
            perTick.push(held);
            run.advance(held);
            if (run.playerDeaths.length > 0) break;
        }
        const OWED = removalTicksAfterHit('BobSoldier', deathTicks('bobsoldier'));
        for (let i = 0; i < OWED + 8; i += 1) { perTick.push(NO_KEYS); run.advance(NO_KEYS); }
        const landed = run.chaserPressHits.filter((h) => h.landed);
        const kills = run.chaserKills;
        check('⛓⛓⛓ TWO ghost presses LAND and the second kills: hits 2 -> 4 of `hitsMax` 3 (damage 2, the sword\'s 1)',
            landed.length === 2 && JSON.stringify(landed.map((h) => h.hits)) === '[2,4]' && landed[1].killed === true,
            JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed, reach: h.reach }))));
        check('⛓ every landed press was a ghostsword press', landed.every((h) => h.weapon === 'ghostsword'),
            JSON.stringify(landed.map((h) => h.weapon)));
        check('⛓ ONE death, billed to the PRESS', kills.length === 1 && kills[0].by === 'press', JSON.stringify(kills));
        check('⛓ the corpse is GONE by the end', !run.chasers.some((c) => c.id === TARGET), `removal ${OWED}`);
        check('the player is alive at the end', run.playerDeaths.length === 0, '');
        const swords = run.playerHits.filter((h) => h.source === 'sword');
        const description = '⛓⛓⛓ seedling-fidelity-ghostsword — THE GHOST SWORD ON AN ENEMY. The `bobsoldier-kill` boot '
            + '(L30, (104,120)) holding the sword AND the ghost sword: one tick of `left` to face west, then a press '
            + 'whenever the body is within the ghost swing\'s 24 px reach and the 31-tick cadence allows. `genericHit` '
            + 'is called with "Spear", force 5 and `ghostSwordDamage` 2, so TWO landed hits kill a `hitsMax`-3 body '
            + `(t ${landed.map((h) => h.t).join(', ')}; hits ${landed.map((h) => h.hits).join(' -> ')}) where the sword `
            + `needs three. Sword hits on the player: ${swords.length}. Authored by `
            + 'scripts/procgen/plan-seedling-ghostsword.mjs.';
        emit(NAME, tapeJson(NAME, BOOT, perTick, ITEMS, description));
        console.log(`## ${NAME}: ${perTick.length} ticks, landed t ${landed.map((h) => h.t).join(', ')}, `
            + `kill t ${kills[0]?.t}, sword hits ${JSON.stringify(swords.map((h) => h.t))}`);
    }

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
