#!/usr/bin/env node
/**
 * plan-seedling-r5-shaft — THE EIGHTEEN PRESSES MEET THE GAME.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §22.
 *
 * ── WHY THIS SCRIPT IS THE ONE THAT MATTERS ───────────────────────────
 *
 * `SHAFT_PLAN` has been a plan since §19.8 and a CORRECT plan since §20.3,
 * and slice 8 said the quiet part out loud: **its minimality certificate
 * is one stratum.** The hand plan and the blind BFS both ran through the
 * same unaimed press model, so "eighteen is the minimum" is a statement
 * two instruments that share a derivation agree on
 * ([[feedback_verifier_shared_assumption]]).
 *
 * The game is the first independent check that plan will ever meet, and
 * this is where it meets it. Every fact below is one an aimed-world model
 * would fake:
 *
 *   · three lock-buttons HELD AT CLOSE, not merely touched;
 *   · every block's position PINNED, not just the named one's — `runFire`'s
 *     effect check is an exact set both ways, which is what catches a press
 *     that moved something the plan did not name;
 *   · L39's ledger at NINE writes and EIGHT net clears, with {39,7}
 *     cleared and then RE-SET by the final press;
 *   · and the last press's THREE SIMULTANEOUS GLIDES.
 *
 * ── ⛓ IT BOOTS WHERE `r5-totem-entrance` COMES TO REST ────────────────
 *
 * That tape ends at tile (9,25), which §21.6 measured as the only
 * reachable stance touching `rope@96,384`. This one boots into L39 with
 * {39,8} declared — the flag the entrance button earned — and starts from
 * the arrival, so the two are a chain rather than two unrelated windows.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-shaft.mjs
 *   node scripts/procgen/plan-seedling-r5-shaft.mjs --write
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { ROPE_PULL, SHAFT_PLAN, SHAFT_LEDGER } = await import(join(MODULE, 'r5Shaft.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

/** L39's arrival from L38, tile (9,38). */
const BOOT = Object.freeze({ level: 39, x: 144, y: 608 });
/** ⛓ The flag `r5-totem-entrance` EARNS — declared here, so this is a chain. */
const PERSISTENCE = Object.freeze([Object.freeze({
    level: 39,
    tag: 8,
    note: '`buttonroom@32,48` in L38 — the entrance write `r5-totem-entrance` makes for '
        + 'real. Declared here so the shaft window boots into the room that tape opens, '
        + 'rather than into one no walk can enter.',
})]);

const world = buildLevelWorld(levelSource(39), {
    roles: ROLES, inventory: held, cleared: [8],
});
const centre = (t) => ({ x: t.tx * TILE_SIZE + TILE_SIZE / 2, y: t.ty * TILE_SIZE + TILE_SIZE / 2 });

// ── 1. the rope, and the stance slice 8 corrected ────────────────────
console.log('## the rope pull');
{
    const rope = world.solids.find((s) => s.ropeId === `rope@${ROPE_PULL.rope.x},${ROPE_PULL.rope.y}`);
    if (!rope) throw new Error(`L39 has no rope at (${ROPE_PULL.rope.x},${ROPE_PULL.rope.y})`);
    const s = centre(ROPE_PULL.stance);
    console.log(`   rope@${ROPE_PULL.rope.x},${ROPE_PULL.rope.y} spans `
        + `[${rope.rect.x},${rope.rect.right}) x [${rope.rect.y},${rope.rect.bottom}) `
        + `-> shrinks to [${rope.shrunkRect.x},${rope.shrunkRect.right})`);
    console.log(`   stance tile (${ROPE_PULL.stance.tx},${ROPE_PULL.stance.ty}) = `
        + `(${s.x},${s.y}) — §21.6's correction; slice 7's (7,25) is unreachable`);
}

// ── 2. the legs: the rope, then the eighteen ─────────────────────────
const targets = [
    /**
     * ⛔ THE EQUIP, AND IT IS THE FIRST THING THE LEG DOES.
     *
     * `useItem(Main.primary)` reads the SELECTED SLOT and a fresh run's is
     * 0 — the sword. §20.5 called "one weapon, one equip, for the whole
     * visit" a convenience; it is an obligation. Without this the whole
     * verb runs, the press lands, a THRUST is scheduled, and the effect
     * check reports the rope unmoved with a paragraph about rect geometry.
     * Slot 1 is `fire` (`tapeFormat.INVENTORY_ITEM_IDS`).
     */
    { ...centre(ROPE_PULL.stance), equip: { slot: 1 } },
    {
        ...centre(ROPE_PULL.stance),
        fire: { rope: { x: ROPE_PULL.rope.x, y: ROPE_PULL.rope.y } },
    },
    ...SHAFT_PLAN.map((step) => ({
        ...centre(step.stance),
        fire: {
            moves: step.moves.map((m) => ({
                from: { tx: m.from[0], ty: m.from[1] },
                to: { tx: m.to[0], ty: m.to[1] },
            })),
        },
    })),
];

console.log(`\n## the plan: 1 rope pull + ${SHAFT_PLAN.length} presses`);
SHAFT_PLAN.forEach((step, i) => {
    console.log(`   ${String(i + 1).padStart(2)}  stance (${step.stance.tx},${step.stance.ty})  `
        + `${step.moves.map((m) => `(${m.from})->(${m.to})`).join(' + ')}`);
});

let out = null;
let failure = null;
try {
    out = synthesizeLegs([{ level: 39, targets }], {
        levelSource,
        boot: { ...BOOT },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 39, items: [...HELD] }],
            persistence: PERSISTENCE.map((p) => ({ ...p })),
            // ⛔ VERSION 4, BY PRESENCE. Without this the emitted tape drops
            // the equip and every press replays as a SWORD press.
            equips: [],
        },
        name: 'r5-shaft',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 2000,
    });
} catch (e) {
    failure = e.message;
}

if (!out) {
    console.log(`\n⛔ THE DRIVE FAILED, and the failure is the finding:\n\n   ${failure}\n`);
    process.exit(1);
}

// ── 3. ⛔ THE FADE, WHICH THE PLAN NEVER PRICED INTO THE TAPE ─────────
/**
 * `runFire` waits for the GLIDE — `run.pushesSettled`, 32 ticks — and that
 * is the whole of what a press verb can know. What it cannot know is that
 * the three blocks the last press parks are now HOLDING three lock-buttons
 * and that a `Lock` fades at 0.01 alpha per tick: **101 continuous ticks**
 * (§14's measurement, and R3's `l71-hold-101-shut` / `-102-open` pair).
 *
 * §20.8 priced those 101 ticks in the tape budget and the plan did not
 * carry them, so the first drive of the shaft ended one tick after the
 * last glide with all three wandlocks still solid and an empty ledger —
 * eighteen presses that each "worked" and a room that never opened. The
 * same shape as §20.2's collateral, one abstraction up: the verb's local
 * success is not the leg's.
 */
const LOCK_FADE_TAIL = 130;

// ── 4. what the run says ─────────────────────────────────────────────
const tape = parseTape(serializeTape({
    ...out.tape,
    tick_count: out.tape.tick_count + LOCK_FADE_TAIL,
    description: '⛓⛓ THE SHAFT — eighteen fire presses, three blocks and four holds. '
        + '`SHAFT_PLAN` has been a plan since §19.8 and a CORRECT plan since §20.3, and '
        + 'both of its certificates ran through the same unaimed press model. This is the '
        + 'first independent check it has ever met. The choreography: block 1 up column 9 '
        + 'onto `button t1` (which opens BOTH group-1 responders — `cover t1` lets block 2 '
        + 'in and `wandlock@48,160` lets block 3 out); block 2 down column 12 and TWO '
        + 'tiles past its destination onto `button t2`, holding `cover t2` for block 3\'s '
        + 'whole crossing; block 3 out of its pocket, east along row 9 and ONE tile past '
        + 'its own destination onto `button t0`; and then a SINGLE press from the middle '
        + 'of the cross that sends all three onto the three lock-buttons at once — every '
        + 'push a pure axis, so the `bothRange` diagonal §19.8 needed is not needed '
        + 'anywhere. ⛓ The rope is pulled with FIRE rather than the sword: `genericHit`\'s '
        + 'rope arm takes no `t`, a sword press would consult the `blockedLine` oracle and '
        + 'then waive it, and this way the whole visit needs one weapon and one equip.',
}));
const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log(`\n## the drive`);
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   fires: ${out.fires.length}`);
for (const f of out.fires) {
    console.log(`      t${f.from}..${f.to}  ${JSON.stringify(f.expect ?? f.moved ?? '')}`);
}

// ── 4. the claims an aimed-world model would fake ────────────────────
console.log('\n## the claims');
const checks = [];
const check = (ok, name, detail) => { checks.push({ ok, name, detail }); };
check(out.fires.length === SHAFT_PLAN.length + 1,
    `⛓ ${SHAFT_PLAN.length + 1} fire presses landed — the rope and the eighteen`,
    `${out.fires.length}`);
/**
 * ⛓ THE LEDGER, from the RUN's own earned clears rather than from a count
 * of presses. §20.4's finding is that a plain `Lock` writes persistence
 * BOTH ways — `turnOff()` false and `returnToNormal()` TRUE — and that
 * {39,7} is cleared to let block 3 out of its pocket and RE-SET by the
 * final press, which moves block 1 off `button t1`. So the claim is about
 * the NET set, and the write that is taken back has to be ABSENT from it
 * rather than merely unmentioned.
 */
/**
 * ⛔ NOT `earnedClears`, AND THE SHAFT IS WHERE THAT STOPPED BEING
 * ACADEMIC. A banked clear is cashed when the level it names is next
 * BUILT, so a run that opens three locks and never leaves the room reports
 * an EMPTY `earnedClears` — indistinguishable from a run whose locks never
 * opened. The WRITES are the claim.
 */
const writes = [
    ...(run.lockWrites ?? []).map((w) => ({ ...w.flag, value: w.value })),
    ...(run.ropePulls ?? []).map((r) => ({ ...r.flag, value: false })),
];
const net = new Map();
for (const w of writes) net.set(`${w.level}:${w.tag}`, w.value);
const cleared = [...net.entries()].filter(([, v]) => v === false).map(([k]) => k).sort();
console.log(`   writes:        [${writes.map((w) => `${w.level}:${w.tag}=${w.value}`).join(' ')}]`);
console.log(`   net cleared:   [${cleared.join(' ')}]`);
const wantNet = SHAFT_LEDGER.filter((f) => f.net && f.level === 39 && f.tag !== 8)
    .map((f) => `${f.level}:${f.tag}`).sort();
const taken = SHAFT_LEDGER.filter((f) => !f.net).map((f) => `${f.level}:${f.tag}`);
check(JSON.stringify(cleared) === JSON.stringify(wantNet),
    '⛓⛓ THE LEDGER IS THE NET SET, and the write that is taken back is ABSENT',
    JSON.stringify(cleared) === JSON.stringify(wantNet)
        ? `[${cleared.join(' ')}] — and [${taken.join(' ')}] is written and then RE-SET by `
            + 'the final press, which moves block 1 off `button t1` and leaves group 1 '
            + 'quiet with nothing in the lock'
        : `the run cleared [${cleared.join(' ')}] and \`SHAFT_LEDGER\` declares `
            + `[${wantNet.join(' ')}] (net) with [${taken.join(' ')}] taken back`);
for (const t of taken) {
    check(!cleared.includes(t),
        `⛓ {${t}} is NOT in the end-of-run ledger — it was cleared and taken back`,
        '`returnToNormal()` writes it TRUE again, and no rung before slice 7 modelled '
        + 'either direction');
}

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE) {
    const path = join(MODULE, 'fixtures', 'tapes', `${tape.name}.json`);
    writeFileSync(path, serializeTape(tape));
    console.log(`\n   wrote ${path}`);
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
