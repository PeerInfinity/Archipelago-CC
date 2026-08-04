#!/usr/bin/env node
/**
 * plan-seedling-r5-totem-entrance — THE PAIR THAT HAS BEEN DECLARED AND
 * UNRECORDED SINCE §18.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §22.
 *
 * ── WHAT THIS PAIR IS FOR ─────────────────────────────────────────────
 *
 * `r5Totem.TOTEM_PAIR` has named these two tapes since slice 5 step 2 and
 * neither has ever existed. The reason is §21.4: the leg they were declared
 * for was priced as *"boot at (144,288), the entrance button, the door at
 * (144,0)"*, and **L38 is two disjoint rooms**. The button is in the one
 * the arrival cannot reach. Four slices of machinery later — the
 * `ButtonRoom` self-latch (§20.6), the `Pulser` (§21.65), the `Chest` verb
 * and the `SealPiece` ceremony (slice 9) — the leg exists, so the pair can
 * be recorded.
 *
 * ── ⛓ THE FIELD IS THE PRESS, AND IT IS ONE TARGET ────────────────────
 *
 * Both arms run the SAME five-link chain, open the SAME chest, walk through
 * the SAME join, take the SAME door into L39 and hold UP for the SAME
 * number of ticks. The press arm's L38 leg has one more target: the two
 * seconds it spends standing on `buttonroom@32,48`.
 *
 * That target is the whole difference, and what it buys is a persistence
 * write into ANOTHER LEVEL — `{39,8} = false`, which deletes
 * `wandlock@144,592` at L39's build time. So:
 *
 *     press arm    walks up L39's corridor
 *     control      is PINNED at tile (9,38), one tile short of the lock
 *
 * ⚠ AND BOTH ARMS CARRY THE ARRIVAL BUTTON'S WRITES. The L37 -> L38 door
 * lands the player ON `buttonroom@144,288`, so {37,4} and {38,5} are in
 * both ledgers (`TOTEM_PAIR.arrivalButton`). ⛓ AND SLICE 9 ADDS A THIRD TO
 * BOTH: `Chest.open()` clears {38,1}. An exact-set assertion that named
 * only the entrance write would go red on a correct walk.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-totem-entrance.mjs
 *   node scripts/procgen/plan-seedling-r5-totem-entrance.mjs --write
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
const { TOTEM_PAIR } = await import(join(MODULE, 'r5Totem.js'));
const { CEREMONY_DEAD_FRAMES } = await import(join(MODULE, 'sealCeremony.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
/** What the route holds by the time it reaches L38 — all four, banked at boot. */
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

/** The L37 door's arrival in L38, tile (9,18) — the SOUTH room. */
const BOOT = Object.freeze({ level: 38, x: 144, y: 288 });
/**
 * ⛓ THE L39 HALF IS A HAND-AUTHORED HOLD, and that is the point.
 *
 * A planned target would need the planner to route the CONTROL through a
 * lock the control has not opened, which it correctly refuses. So both arms
 * get the identical span — `up`, from the tick the L38 leg ends — and the
 * evidence is where each one comes to rest. Same input, two outcomes, one
 * field apart is the `l71-shieldlock` shape with the field moved from an
 * item to a button.
 */
const L39_HOLD_TICKS = 400;
/** …and a tail with no input, so the window ends AT REST (§16's rule). */
const L39_TAIL_TICKS = 48;

const worldFor = (n, cleared = []) => buildLevelWorld(levelSource(n), {
    roles: ROLES, inventory: held, cleared,
});

// ── 1. what the entrance button writes, and what it deletes ──────────
console.log('## the entrance button, and the lock it deletes');
{
    const w = worldFor(38);
    const b = w.pressers.find((p) => p.x === 32 && p.y === 48);
    if (!b) throw new Error('L38 has no buttonroom@32,48');
    console.log(`   ${b.tag}@${b.x},${b.y} t=${b.t} flip=${b.flip} room=${b.room} `
        + `rect [${b.rect.x},${b.rect.right}) x [${b.rect.y},${b.rect.bottom})`);
    const shut = worldFor(39).activators.map((a) => a.id);
    const open = worldFor(39, [8]).activators.map((a) => a.id);
    const gone = shut.filter((a) => !open.includes(a));
    console.log(`   L39 activators without the write: ${shut.length}`);
    console.log(`   …with {39,8} cleared:            ${open.length}  ⇒ gone: [${gone.join(' ')}]`);
    if (gone.length !== 1 || gone[0] !== 'wandlock@144,592') {
        throw new Error(`the write deletes [${gone.join(' ')}], expected wandlock@144,592`);
    }
}

// ── 2. the two arms ──────────────────────────────────────────────────
/** The L38 chain, which is identical in both arms. */
const CHAIN = Object.freeze([
    // link 1: the `room = -1` self-latch that opens the cover link 2 is under
    Object.freeze({ x: 152, y: 136, hold: { presser: { x: 144, y: 128 }, ticks: 4 } }),
    // link 2: a SECOND self-latch, and it ARMS THE PULSER rather than opening
    Object.freeze({ x: 216, y: 232, hold: { presser: { x: 208, y: 224 }, ticks: 4 } }),
    // links 3+4 run on the pulser's own clock while the walk returns
    Object.freeze({ x: 152, y: 130, chest: { chest: { x: 144, y: 112 } } }),
]);
/** ⛓ The one target that differs. */
const ENTRANCE = Object.freeze({ x: 40, y: 56, hold: { presser: { x: 32, y: 48 }, ticks: 4 } });

function armFor(name, targets, description) {
    const out = synthesizeLegs([
        {
            level: 38,
            // The arrival lands ON `buttonroom@144,288` — R1's forced-contact rule.
            contacts: ['proximity-hazard:buttonroom@144,288'],
            targets,
            exit: { x: 144, y: 0 },
        },
        { level: 39, targets: [] },
    ], {
        levelSource,
        boot: { ...BOOT },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 38, items: [...HELD] }],
            persistence: [],
        },
        name,
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 1500,
    });
    // ⛓ THE L39 HALF, appended by hand: `up` for the same 400 ticks in both
    // arms, then a tail with no input so the window ends at rest.
    const from = out.tape.tick_count;
    const tape = {
        ...out.tape,
        description,
        pins: [],
        inputs: [...out.tape.inputs, { key: 'up', from, to: from + L39_HOLD_TICKS }],
        tick_count: from + L39_HOLD_TICKS + L39_TAIL_TICKS,
    };
    return { out, tape: parseTape(serializeTape(tape)) };
}

const press = armFor(TOTEM_PAIR.press, [...CHAIN, ENTRANCE],
    '⛓⛓ THE ENTRANCE TO THE WHOLE TOTEM CLUSTER, and it is a five-link puzzle rather '
    + 'than a walk. L38 is TWO DISJOINT ROOMS: the L37 door lands in the south one and '
    + '`buttonroom@32,48` — the only opener of L39 — is in the north one. The join is ONE '
    + 'cell holding a `cover` AND, underneath it, a `chest` that is `type = "Solid"` until '
    + 'opened. This arm runs the chain: a `room = -1` ButtonRoom latches its group and '
    + 'opens a cover; a SECOND one under that cover ARMS A `Pulser`; the pulse shoves a '
    + 'PushableBlockFire one tile north onto a button no player can stand on; that button '
    + 'opens the cover over the chest; and the chest opens on a ONE-PIXEL LINE beneath it '
    + 'from a TWO-PIXEL stance band. Then the entrance button, then the door, then 400 '
    + 'ticks of UP in L39 — which this arm spends WALKING, because {39,8} is written and '
    + '`wandlock@144,592` was never built.');
const control = armFor(TOTEM_PAIR.control, [...CHAIN],
    '⛓ THE CONTROL, and the field is a BUTTON rather than a flag. Byte-identical to '
    + '`r5-totem-entrance` except for one target: it opens the same chest, walks through '
    + 'the same join and takes the same door, and it does NOT stand on '
    + '`buttonroom@32,48`. So L39 is built WITH `wandlock@144,592` and the same 400 ticks '
    + 'of UP end PINNED one tile short of it. ⚠ Its ledger is NOT empty — the arrival '
    + 'button writes {37,4}+{38,5} and the chest clears {38,1} in both arms, which is '
    + 'exactly why an exact-set assertion has to name them.');

// ── 3. what each arm did ─────────────────────────────────────────────
console.log('\n## the two arms');
for (const [label, arm] of [['press', press], ['control', control]]) {
    const run = runTape(arm.tape, { levelSource });
    const end = run.ticks[run.ticks.length - 1];
    const tile = { tx: Math.floor(end.x / TILE_SIZE), ty: Math.floor(end.y / TILE_SIZE) };
    arm.run = run;
    arm.end = end;
    arm.tile = tile;
    console.log(`   ${label.padEnd(8)} ${arm.tape.tick_count} ticks, `
        + `${arm.tape.inputs.length} spans — ends L${end.level} `
        + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile (${tile.tx},${tile.ty})`);
    console.log(`      holds    ${arm.out.holds.map((h) => `${h.presser.tag}@${h.presser.x},`
        + `${h.presser.y}(t=${h.presser.t})`).join(' ')}`);
    console.log(`      chest    ${arm.out.chests.map((c) => `${c.chest.id} tag `
        + `${c.chest.persistTag} @t${c.openedAt}, seal @t${c.collectedAt}, `
        + `${c.deadFrames} dead`).join(' ')}`);
    console.log(`      writes   ${arm.out.roomWrites.map((w) => `{${w.level},${w.tag}}=`
        + `${w.value}`).join(' ')}`);
}

// ── 4. the claims the pair makes ─────────────────────────────────────
console.log('\n## the claims');
const checks = [];
const check = (ok, name, detail) => { checks.push({ ok, name, detail }); };

check(control.tile.ty === TOTEM_PAIR.pinnedAt.tile.ty && control.end.level === 39,
    '⛔ the CONTROL is pinned at the declared tile',
    `L${control.end.level} tile (${control.tile.tx},${control.tile.ty}), declared `
    + `(${TOTEM_PAIR.pinnedAt.tile.tx},${TOTEM_PAIR.pinnedAt.tile.ty})`);
check(press.tile.ty < control.tile.ty,
    '⛓⛓ …and the PRESS arm walks NORTH past where it stood',
    `${(control.end.y - press.end.y).toFixed(2)} px, `
    + `${control.tile.ty - press.tile.ty} tile(s)`);
check(press.out.chests.length === 1 && control.out.chests.length === 1,
    '⛓ BOTH arms open the chest — it is the join, not the errand',
    'the field is the entrance button, and a pair whose control cannot reach the room '
    + 'is not a control');
// ⚠ AN EXACT SET, BOTH WAYS, and the count would have been wrong. A
// `room >= 0` ButtonRoom writes TWICE — the named room's TSET and its own
// TAG (`crossRoomWrites`, §18) — so the entrance button is {39,8} AND
// {38,4}, and "one more write" is the arithmetic of somebody who read the
// mechanic as one line.
const writeSet = (arm) => arm.out.roomWrites.map((w) => `${w.level}:${w.tag}`).sort();
const SHARED = ['37:4', '38:0', '38:3', '38:5'];
const ENTRANCE_WRITES = ['38:4', '39:8'];
check(JSON.stringify(writeSet(control)) === JSON.stringify([...SHARED].sort()),
    '⛓ the CONTROL\'s ledger is the arrival button and the two self-latches',
    `[${writeSet(control).join(' ')}] — {37,4}+{38,5} from the arrival (both arms carry `
    + 'them) and {38,0}+{38,3} from the two `room = -1` latches, whose own-tag write is '
    + 'OUTSIDE the room branch (§20.6)');
check(JSON.stringify(writeSet(press))
        === JSON.stringify([...SHARED, ...ENTRANCE_WRITES].sort()),
    '⛓⛓ …and the PRESS arm is that set plus TWO — the entrance button writes twice',
    `[${writeSet(press).join(' ')}] — {39,8} deletes the wandlock and {38,4} is its own `
    + 'tag, from the same `set activate`');
check(press.tile.tx === 9 && press.tile.ty === 25,
    '⛓⛓ AND THE PRESS ARM COMES TO REST ON THE ROPE\'S OWN STANCE',
    `tile (${press.tile.tx},${press.tile.ty}) — §21.6 measured the only reachable stance `
    + 'that touches `rope@96,384` as column 9 row 25, and 400 ticks of UP from the '
    + 'arrival stop exactly there. The shaft leg starts where this one ends.');
check(press.out.chests[0].deadFrames === CEREMONY_DEAD_FRAMES.total,
    `⛓ the ceremony is ${CEREMONY_DEAD_FRAMES.total} dead frames in the MODEL`,
    'the game\'s own `dead_frames` counter is the check, and it has never seen a '
    + 'SealController before');

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE) {
    for (const arm of [press, control]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${arm.tape.name}.json`);
        writeFileSync(path, serializeTape(arm.tape));
        console.log(`\n   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes)');
}
