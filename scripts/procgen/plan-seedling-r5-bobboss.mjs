#!/usr/bin/env node
/**
 * plan-seedling-r5-bobboss — the densest encounter script on the ladder.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.6.1 and §4 slice 4.
 *
 * ── ⛔ THE ARM SCHEDULE IS PROBED, NOT DERIVED ────────────────────────
 * The arithmetic in `bobBoss.js` says the rock takes 174 frames from the
 * arm to the boss's spawn. What it CANNOT say is how many of those are
 * TAPE TICKS, and that is the number a script is written in.
 *
 * `Bot.update`'s gate is `if (game.blackCover > 0 || Game.freezeObjects) {
 * deadFrames++; autoAdvance(); return; }` — so a frozen frame costs no
 * tick. But `Game.freezeObjects` is a sticky static with several writers
 * and no per-frame reset, and R3 measured a pickup's PHASE B consuming one
 * tape tick per frame while the player still could not move: on those
 * frames the flag is true when `Mobile.mobileUpdate` reads it and false by
 * the time the next frame's gate does. Whether a `BobBossNPC` dialogue
 * behaves like the rock's freeze or like a pickup's phase B decides
 * whether the fight's press schedule is written in ticks the tape controls
 * or in ticks it cannot see — and it is not a question the source answers
 * in one reading.
 *
 * So `r5-bobboss-arm` asks the game. It is a real fixture and a real
 * claim, not scaffolding:
 *
 *   - it boots at the arena mouth and steps north over `y < 120`;
 *   - it holds NO SWORD, so its `primary` taps can only page dialogue —
 *     `useItem` on an empty inventory does nothing, so nothing this tape
 *     does can be a swing;
 *   - it taps on a fixed cadence for the whole run, so the dialogues
 *     resolve whether or not `autoAdvance` is doing it too;
 *   - and it then just stands there, which is survivable because
 *     `noDamage` is armed and the boss cannot be killed anyway.
 *
 * What comes back is the tick cost of the arm, of each dialogue, and of
 * each form transition, measured rather than predicted.
 *
 * ⚠ THE FIGHT ITSELF IS ONE-VISIT-OR-RESTART. `BobBoss`'s constructor is
 * `if (Player.hasFire) { FP.world.remove(this); return; }` and the whole
 * cast is rebuilt on every entry until `hasFire` — so a re-entry after a
 * partial fight respawns form 0. That is why the schedule is measured
 * before it is written, and why the pair arms are recorded before anything
 * downstream is planned.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-bobboss.mjs            # report
 *   node scripts/procgen/plan-seedling-r5-bobboss.mjs --write    # write tapes
 *   node scripts/procgen/plan-seedling-r5-bobboss.mjs --read     # read the probe
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const {
    ARENA, ROCK, BOB_BOSS_FORMS, BOSS_IFRAMES, FIRE, BURNABLE_TREE, BOB_BOSS_LEDGER,
    rockSchedule, formPresses, bobBossPressBill,
} = await import(join(MODULE, 'bobBoss.js'));
const { R5_ARENA_ARM_Y, KEY_LEG } = await import(join(MODULE, 'r5Chain.js'));

const WRITE = process.argv.includes('--write');
const READ = process.argv.includes('--read');
const source = atlasLevelSource();
const world = buildLevelWorld(source(ARENA.level), { roles: ROLES });

// ── 1. the arena, confirmed against the extract ───────────────────────
console.log(`## L${ARENA.level} — the arena`);
console.log(`   ${world.width}x${world.height} tiles; arrival (${ARENA.arrival.x},`
    + `${ARENA.arrival.y}); the rock arms at y < ${R5_ARENA_ARM_Y}`);
const rock = source(ARENA.level).entities.find((e) => e.type === 'fallrocklarge');
if (!rock) throw new Error('L32 has no fallrocklarge');
if (rock.attrs.bossrock !== '1' || rock.attrs.thirdboss !== '1') {
    throw new Error(`the rock is not the boss rock: ${JSON.stringify(rock.attrs)}`);
}
if (Number(rock.attrs.tag) !== ROCK.tag) {
    throw new Error(`the rock carries tag ${rock.attrs.tag}, not the declared ${ROCK.tag}`);
}
const sched = rockSchedule();
console.log(`   the arm: ${sched.waitTicks} wait + ${sched.fallTicks} fall + `
    + `${sched.cameraTicks} camera = the boss spawns ${sched.bossSpawnsAt} frames later`);
console.log(`   ⚠ FRAMES, not ticks — every one of them is inside `
    + '`Game.freezeObjects`, and whether the bot counts them is what the probe asks');

// ── 2. the fight's bill ───────────────────────────────────────────────
const bill = bobBossPressBill();
console.log(`\n## the three forms — ${bill.landed} landed hits, `
    + `${bill.presses} presses at cadence ${bill.cadence}`);
for (const f of BOB_BOSS_FORMS) {
    console.log(`   form ${f.index}: hitsMax ${f.hitsMax}, ${f.pages.length} dialogue page(s), `
        + `forming ${f.formingTicks}, ${formPresses(f).presses} press(es) — ${f.note}`);
}
console.log(`\n## the ledger this encounter earns`);
for (const e of BOB_BOSS_LEDGER) console.log(`   {${e.level},${e.tag}}  ${e.by}`);
console.log(`   fire's write is OUT OF BAND: \`Fire.removed()\` calls `
    + `\`Game.setPersistence(${FIRE.tag}, false)\` and `
    + '`Main.levelPersistenceSet(i, j)` indexes `i * 30 + j` — so a tag of -1 in L32 '
    + `lands on index ${32 * 30 - 1}, which is L31 tag 29, its LAST slot`);
console.log(`   and \`BurnableTree.removed()\` writes {32,${BURNABLE_TREE.tag}} when the `
    + `${BURNABLE_TREE.burnTicks}-tick burn finishes — the arena's exit`);

// ── 3. the probe tape ─────────────────────────────────────────────────
const ARM_HOLD = { key: 'up', from: 4, to: 18 };
const TAP_FROM = 26;
const TAP_EVERY = 12;
const TAP_TICKS = 2;
const PROBE_TICKS = 900;
const taps = [];
for (let t = TAP_FROM; t < PROBE_TICKS - 20; t += TAP_EVERY) {
    taps.push({ key: 'primary', from: t, to: t + TAP_TICKS });
}
const probe = {
    game: 'seedling',
    tape_version: 5,
    name: 'r5-bobboss-arm',
    description: 'THE ARM SCHEDULE, MEASURED. Boots at L32\'s arena mouth (80,128), steps '
        + `north over \`FallRockLarge\`'s arm line at y < ${R5_ARENA_ARM_Y}, and then taps `
        + `\`primary\` every ${TAP_EVERY} ticks for the rest of the run. It holds NO `
        + 'SWORD, so `useItem` on an empty inventory does nothing and no tap can be a '
        + 'swing — the taps exist only to page the three `BobBossNPC` dialogues whether '
        + 'or not `Bot.autoAdvance` is already doing it. What the stream measures is how '
        + 'many TAPE TICKS the rock\'s ~174 frozen frames, each dialogue and each '
        + '120-tick form transition actually cost, which is the unit an encounter script '
        + 'has to be written in and which the source does not answer in one reading '
        + '(`Game.freezeObjects` is sticky, and R3 measured a pickup\'s phase B '
        + 'consuming a tick per frame while the player still could not move).',
    boot: { level: ARENA.level, x: ARENA.boot.x, y: ARENA.boot.y },
    noclip: false,
    noDamage: true,
    noHazards: [...KEY_LEG.noHazards],
    grants: [],
    persistence: [],
    equips: [],
    pins: [...KEY_LEG.pins],
    inputs: [ARM_HOLD, ...taps],
    tick_count: PROBE_TICKS,
};
const rest = assertWindowEndsAtRest(probe);
if (rest.length > 0) throw new Error(`the probe does not end at rest:\n  ${rest.join('\n  ')}`);
parseTape(serializeTape(probe));
console.log(`\n## the probe — ${probe.name}`);
console.log(`   boot ${JSON.stringify(probe.boot)} -> player (${ARENA.arrival.x},`
    + `${ARENA.arrival.y}); ${ARM_HOLD.to - ARM_HOLD.from} ticks of UP to cross `
    + `y < ${R5_ARENA_ARM_Y}; ${taps.length} taps; ${PROBE_TICKS} ticks`);

// ── 4. what the probe SAID, once it has been recorded ─────────────────
const expectationPath = join(MODULE, 'fixtures', 'expectations', `${probe.name}.json`);
if (READ) {
    if (!existsSync(expectationPath)) {
        console.log(`\n⚠ ${probe.name} has not been recorded yet — run\n`
            + `   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record `
            + `--only=${probe.name}`);
    } else {
        const stream = JSON.parse(readFileSync(expectationPath, 'utf8'));
        const ticks = stream.ticks;
        console.log(`\n## what the game said — ${ticks.length} observations`);
        // Where the player MOVED, and where it went still. A frozen frame
        // costs no observation, so a run of identical positions is the tape
        // ticking while nothing moves and a GAP in nothing is invisible.
        let runStart = 0;
        const still = [];
        for (let i = 1; i <= ticks.length; i += 1) {
            const same = i < ticks.length
                && ticks[i].x === ticks[runStart].x && ticks[i].y === ticks[runStart].y;
            if (!same) {
                if (i - runStart >= 8) {
                    still.push({ from: runStart, to: i - 1, x: ticks[runStart].x,
                        y: ticks[runStart].y });
                }
                runStart = i;
            }
        }
        console.log(`   ${still.length} still span(s) of 8+ ticks:`);
        for (const s of still) {
            console.log(`     t ${s.from}..${s.to} (${s.to - s.from + 1} ticks) at `
                + `(${s.x.toFixed(2)},${s.y.toFixed(2)})`);
        }
        console.log(`   first ${JSON.stringify(ticks[0])}`);
        console.log(`   last  ${JSON.stringify(ticks.at(-1))}`);
    }
}

// ── 5. ⛓ WHAT THE PROBE SAID, and the pair it makes possible ─────────
//
// ⛓ **THE ROCK'S 174 FRAMES ARE DEAD AND THE DIALOGUE'S ARE NOT.** The
// probe came back `dead_frames = 195` — the ~21-frame boot fade plus the
// rock's 174, exactly — while the three dialogues cost TAPE TICKS: the
// player sits at (80,116.85) for 75 consecutive observations with `up`
// still held through tick 18, which is only possible if the tape is
// advancing while `Mobile.mobileUpdate` refuses to move. So a
// `BobBossNPC` dialogue is the R3 PHASE-B shape, not the rock's.
//
// ⛔ **AND THAT MEANS `Bot.autoAdvance` NEVER SEES IT.** `autoAdvance()`
// is called from INSIDE the dead-frame branch and nowhere else, so a
// freeze the gate reads as live is a freeze the bot does not dismiss.
// The tape pages every one of the fourteen pages itself. A script written
// on the assumption that the bot would handle them stalls at the first
// one, forever, and reports a clean run of dead frames while doing it.
//
// ⇒ THE PAIR IS `grants`, ONE FIELD APART. `primary` is both the talk key
// and the sword, and the two are mutually exclusive by construction: the
// dialogue holds `Game.freezeObjects`, which gates `Player.input()`, so a
// press inside a dialogue can only page and a press outside it can only
// swing. So the SAME press train drives both arms, and whether it kills
// anything is decided entirely by whether the tape granted a sword.
const PRESS_FROM = 26;
const PRESS_CADENCE = bill.cadence;
const PRESS_LAST = 2380;
const COLLECT_WALK = { key: 'up', from: 1800, to: 1880 };
const FIGHT_TICKS = 2500;
const presses = [];
for (let t = PRESS_FROM; t <= PRESS_LAST; t += PRESS_CADENCE) {
    presses.push({ key: 'primary', from: t, to: t + 2 });
}
const fightInputs = [ARM_HOLD, ...presses, COLLECT_WALK];
const fightShared = {
    game: 'seedling',
    tape_version: 5,
    boot: { level: ARENA.level, x: ARENA.boot.x, y: ARENA.boot.y },
    noclip: false,
    noDamage: true,
    noHazards: [...KEY_LEG.noHazards],
    persistence: [],
    equips: [],
    pins: [...KEY_LEG.pins],
    inputs: fightInputs,
    tick_count: FIGHT_TICKS,
};
const fight = {
    ...fightShared,
    name: 'r5-bobboss-fire',
    grants: [{ level: ARENA.level, items: ['sword'] }],
    description: `THE BOBBOSS CHAIN, arm 1 of 2 — the sword GRANTED. ${presses.length} `
        + `\`primary\` presses at the ${PRESS_CADENCE}-tick cadence (the boss's own `
        + `${BOSS_IFRAMES}-tick i-frames plus one; 21 is the dash floor and the larger `
        + 'wins), and the same train does two jobs the game keeps apart for it: inside a '
        + '`BobBossNPC` dialogue `Game.freezeObjects` gates `Player.input()`, so a press '
        + 'can only page; outside one it can only swing. The count is a FLOOR — seven '
        + 'landed hits is the arithmetic (2 + 3 + 2, and form 1\'s 3 is `Enemy.hitsMax`\'s '
        + 'default because its switch case sets none) and fourteen dialogue pages need '
        + 'their own releases. The assertion is the EFFECT: `hasFire`, and a '
        + '`persistence_cleared` that gains {32,1} from the rock and {31,29} from '
        + '`Fire.removed()` calling `setPersistence(-1, false)` in L32 — `i * 30 + j` '
        + 'lands it in L31\'s last slot.',
};
const control = {
    ...fightShared,
    name: 'r5-bobboss-fire-control',
    grants: [],
    description: 'THE BOBBOSS CHAIN, arm 2 of 2 — the sword WITHHELD. Identical to '
        + '`r5-bobboss-fire` in every field but `grants`. The presses still page all '
        + 'fourteen dialogue pages, because paging is what a press does while '
        + '`Game.freezeObjects` is up; what they cannot do is hit anything, because '
        + '`useItem` reads `Inventory.getItem(Main.primary)` off an EMPTY slot array. '
        + 'So form 0 never dies, forms 1 and 2 never exist, `Fire` is never spawned, and '
        + 'the ledger keeps only {32,1} — the rock, which the walk armed with its feet. '
        + 'Without this arm, "the walk ended holding fire" is not evidence that the '
        + 'sword did anything.',
};
for (const t of [fight, control]) {
    const r = assertWindowEndsAtRest(t);
    if (r.length > 0) throw new Error(`${t.name} does not end at rest:\n  ${r.join('\n  ')}`);
    parseTape(serializeTape(t));
}
console.log(`\n## the fight pair — ONE FIELD APART (\`grants\`)`);
console.log(`   ${presses.length} presses at ${PRESS_CADENCE}, t ${PRESS_FROM}..${PRESS_LAST}; `
    + `collect walk UP ${COLLECT_WALK.from}..${COLLECT_WALK.to}; ${FIGHT_TICKS} ticks`);
console.log('   fire arm    grants [sword] — expects hasFire, {32,1} and {31,29}');
console.log('   control     grants []      — expects no fire, {32,1} only');

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [probe, fight, control]) {
        const path = join(dir, `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`   wrote ${path}`);
    }
} else if (!READ) {
    console.log('\n(dry run — pass --write to emit the tapes, --read to read the probe back)');
}
