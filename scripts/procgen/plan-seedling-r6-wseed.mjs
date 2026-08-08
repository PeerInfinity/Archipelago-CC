#!/usr/bin/env node
/**
 * plan-seedling-r6-wseed — ⛓⛓⛓ W-SEED: THE BLOODLESS ENDING, TWO REBOOTS,
 * AND THE LADDER'S FIRST "THE GAME SAYS IT WAS BEATEN".
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6d. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.7 item 4 and §17.10
 * item 2, with the mechanics at §14.5 and modelled in `endingChain.js`.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into L115 at (72,136) — the tile `teleporter@112,0` in L113
 * lands the player on, which is WATER — swims north up a waterfall onto the
 * island, and collects `seed@72,72`. Then the game takes over for 338
 * ticks and two world reboots:
 *
 * ```
 *   150 frozen  `Pickup.specialTimer`
 *    53 ticks   the seed's own 3-page NPC (6 frames/char, 32 columns)
 *   200 frozen  `Seed.removeSelf` -> the cover fade
 *   ── REBOOT 1: cutscene[2] = true, `new Game(115, currentPlayerPosition)`
 *   138 TICKS   `sprTreeGrow.play("grow")`, the seed rebuilt as the tree
 *   200 TICKS   `endAnim` -> drawCover -> the second fade
 *   ── REBOOT 2: menu = true, cutscene[2] = false, badge 14, menuIndex 2
 * ```
 *
 * ⛔⛔⛔ AND THE SECOND HALF IS **TICKS**, WHICH §14.5 PRICED AS FROZEN
 * FRAMES. `Game.as:961`'s `cutscene[2]` arm sets `p.receiveInput = false`,
 * which makes `canInventory()` false, which runs `inventory.open = false`,
 * which **is** `Game.freezeObjects = false` (`Inventory.as:153`). The
 * cutscene LOWERS the freeze at the end of every one of its own frames. So
 * the brief's "~688 frozen frames" is 350 frozen frames and 338 TAPE TICKS,
 * and a tape that budgeted the other way would end 338 observations early.
 * What holds the player still is `p.active = false` — `Player.update` is
 * never called at all — and that is a different mechanism with a different
 * cost. (`endingChain.CUTSCENE_2_HOLD`.)
 *
 * ── ⚖ THE BOOT GRANTS, AND ONE OF THEM IS A DELTA ─────────────────────
 *
 * ⚖ RULED (user, 2026-08-08): W-seed's boot GRANTS THE CONCH to cross
 * L115's moat, on the precedent of `hasShield` in W-talk — an item earned
 * in a priced chain elsewhere on the ladder (the conch is real-collected in
 * `r5-d5-conch`). `noHazards` was considered and NOT chosen.
 *
 * ⛔ **AND THE MOAT HAS A SECOND GATE THE RULING COULD NOT HAVE KNOWN
 * ABOUT.** §17.8 found that both L115 arrival tiles are water and stopped
 * there. The row between the arrival and the island is not water — it is
 * **WATERFALL** (`t = 25`, tiles (3..6, 7)), and a waterfall pushes down at
 * `WATERFALL_ACCELERATION` unless the player holds the FEATHER. Measured,
 * not assumed: with the conch alone the climb comes to rest INSIDE the fall
 * at y 126.65 — pushed down as fast as the swim lifts — and stays there for
 * ever, 30 px short of the island's southern edge.
 *
 * ⇒ the boot grants `feather` as well, which is the SAME decision the
 * ruling made, applied to a gate it did not have in front of it: an item
 * earned in a priced chain elsewhere (`r5-feather`, `r5-waterfall`, whose
 * whole subject is this mechanic) rather than a `noHazards` crutch. The
 * alternative was measured too and it is worse in both directions — the
 * only conch-only route to the island threads the map's east edge through
 * `CliffSideMaskL` pixelmasks that leave a corridor **two pixels wide**,
 * which is a stunt rather than a chain.
 *
 * ── THE PAIR: THE LAST X RELEASE DELETED ──────────────────────────────
 *
 * W-talk's shape, for W-talk's reason: the primitive is the SIXTH and last
 * dialogue release, and the tape ends inside the ceremony with the seed's
 * NPC on its last page. There is no walk-away to take here either — this
 * freeze is a `Pickup`'s, and it pins the player harder than a dialogue's
 * does (`Game.freezeObjects` with nothing to lower it, so the frames are
 * DEAD and the tape's counter does not even run).
 *
 * ⇒ the discriminator is `menu_state`: 2 on the drive, 0 on the control,
 * from the game's own readout. And the control is not "nothing happens" —
 * it pays the same 150 frozen frames and reads five sixths of the same
 * text; what it never reaches is `removeSelf`.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-wseed.mjs [--write]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const WRITE = process.argv.includes('--write');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES, buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const { CREDITS, coverFadeFrames, treeSchedule } = await import(join(MODULE, 'endingChain.js'));
const { menuWriterEliminations } = await import(join(MODULE, 'r6Acceptance.js'));

/**
 * ⚠ THE ARRIVAL TILE, AS A BOOT BLOCK. `teleporter@112,0` in L113 carries
 * `playerx="64" playery="128"`, and `spawnFromBoot` adds the half tile — so
 * the spawn is (72,136), which is `t = 1` WATER. Booting at the position a
 * real chain hands you is the point: the moat is the window's first claim.
 */
const BOOT = { level: 115, x: 64, y: 128 };
/**
 * ⚖ The conch is the ruling; the feather is the same ruling applied to the
 * WATERFALL the ruling did not know about. See the docblock.
 */
const GRANTS = [{ level: 115, items: ['conch', 'feather'] }];
const PINS = ['sound', 'dead_frames'];
/**
 * ⛔ EMPTY, AND THAT IS THE WHOLE POINT OF THE GRANTS. L115 holds water AND
 * a waterfall and this window crosses both of them ARMED — a `noHazards`
 * entry here would be the crutch the ⚖ declined.
 */
const NO_HAZARDS = [];

/** The approach, in three legs. */
const NORTH_1 = 95;
const EAST = 14;
const NORTH_2_END = 145;
/** The first dialogue release, comfortably after the contact. */
const TALK_FROM = 140;
const TALK_CADENCE = 8;
/** Ticks after the deleted release for the control to show the freeze holding. */
const CONTROL_TAIL = 40;

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });

const approachSpans = () => [
    { key: 'up', from: 0, to: NORTH_1 },
    { key: 'right', from: NORTH_1, to: NORTH_1 + EAST },
    { key: 'up', from: NORTH_1 + EAST, to: NORTH_2_END },
];

const freshRun = () => createLevelRun({
    levelSource: atlasLevelSource(),
    boot: BOOT,
    noclip: false,
    noHazards: NO_HAZARDS,
    noDamage: false,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
});

const run = (inputs, tickCount) => {
    const r = freshRun();
    const stream = [];
    for (let k = 0; k < tickCount; k += 1) {
        stream.push({ t: k, x: r.state.x, y: r.state.y, level: r.level });
        r.advance(heldKeysAt({ inputs }, k));
    }
    return { run: r, stream };
};

// ── PHASE 0: the moat has TWO gates, and the second one is measured ───
//
// ⛔ NOT ASSERTED FROM THE TILE TABLE. "t = 25 is a waterfall" is a fact
// about the extract; "the conch alone cannot get there" is a fact about the
// physics, and it is the one the ⚖ turns on. So it is DRIVEN: the same
// approach with the feather withheld, run to a standstill.
const conchOnly = (() => {
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: [{ level: 115, items: ['conch'] }],
        persistence: [],
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: [] },
        roles: ROLES,
    });
    const inputs = [{ key: 'up', from: 0, to: 400 }];
    for (let k = 0; k < 400; k += 1) r.advance(heldKeysAt({ inputs }, k));
    return { y: r.state.y, collected: r.collected.length };
})();

// ── PHASE 1: the approach, and the tick the ceremony starts on ────────
const contactTick = (() => {
    const inputs = approachSpans();
    const r = freshRun();
    let prev = null;
    for (let k = 0; k < 400; k += 1) {
        const pos = `${r.state.x},${r.state.y}`;
        if (k > 20 && prev === pos) return k - 1;
        prev = pos;
        r.advance(heldKeysAt({ inputs }, k));
    }
    throw new Error('plan: the approach never reached the seed');
})();
if (contactTick >= TALK_FROM) {
    throw new Error(`plan: the ceremony starts at tick ${contactTick} and the first `
        + `release is scheduled at ${TALK_FROM} — a release before the contact is a `
        + 'SWORD-less no-op in an empty room, not a page turn');
}

// ── PHASE 2: the dialogue, and how many releases it costs ─────────────
const probeTalk = (cadence) => {
    const inputs = [
        ...approachSpans(),
        ...Array.from({ length: 20 }, (_, i) => press(TALK_FROM + i * cadence)),
    ];
    const r = freshRun();
    for (let k = 0; k < 400; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.endingReboots.length) {
            const used = Math.floor((r.endingReboots[0].t - 2 - TALK_FROM) / cadence) + 1;
            return { used, reboot: r.endingReboots[0], fade: r.seedFades[0] };
        }
    }
    throw new Error(`plan: the seed dialogue never finished at cadence ${cadence}`);
};
const talkFloor = probeTalk(TALK_CADENCE - 1);
const talk = probeTalk(TALK_CADENCE);
if (talkFloor.used !== talk.used) {
    throw new Error(`plan: talk cadence ${TALK_CADENCE - 1} needs ${talkFloor.used} `
        + `releases and ${TALK_CADENCE} needs ${talk.used} — a cadence that changes the `
        + 'RELEASE count is not "one above the floor", it is a different schedule');
}
const RELEASES = talk.used;
const TALK_PRESSES = Array.from({ length: RELEASES },
    (_, i) => TALK_FROM + i * TALK_CADENCE);
const LAST_RELEASE = TALK_PRESSES[TALK_PRESSES.length - 1];

// ── PHASE 3: the tree, the credits, and the tape's own length ─────────
const full = (() => {
    const inputs = [...approachSpans(), ...TALK_PRESSES.map(press)];
    const r = freshRun();
    for (let k = 0; k < 2000; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.credits) return { run: r, at: r.credits.t };
    }
    throw new Error('plan: the tree never reached the credits');
})();
/**
 * ⛔ THE TAPE ENDS ON THE CREDITS TICK AND NOT ONE LATER.
 * `Game.menuAndRestart()` sets `Game.freezeObjects = true` on every frame
 * while `menu` is true, so there is no tick 521 to record — and
 * `Input.released(Key.ANY)` is what LEAVES the menu, rebooting the world.
 */
const TICK_COUNT = full.at;
const CONTROL_TICK_COUNT = LAST_RELEASE + CONTROL_TAIL;

const INPUTS = [...approachSpans(), ...TALK_PRESSES.map(press)];
const CONTROL_INPUTS = [...approachSpans(), ...TALK_PRESSES.slice(0, -1).map(press)];

const tapeFor = (name, inputs, tickCount, description) => parseTape({
    tape_version: 7,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    // ⚠ NOT DECLARED. L115 holds no boss and no enemy, so no gameplay
    // consumer reads the stream position. W-owl is the window that declares
    // the split.
    rng: { seed: 0, split: false },
    tick_count: tickCount,
    inputs,
});

const tape = tapeFor('r6-seed-credits', INPUTS, TICK_COUNT,
    'R6 slice 6d: W-SEED, the bloodless ending. Boots into L115 at (72,136) — the tile '
    + '`teleporter@112,0` in L113 lands the player on, which is WATER — with the conch '
    + 'and the feather granted, and swims north. The moat has TWO gates and the second '
    + 'is a WATERFALL (`t = 25`, the whole row between the arrival and the island): with '
    + `the conch alone the swim stalls at y ${conchOnly.y} and never moves again, which `
    + 'the plan drives rather than asserts. Fourteen ticks of `right` place the stance '
    + `over \`seed@72,72\`, and the ceremony starts on tick ${contactTick}: 150 frozen `
    + `frames of \`Pickup.specialTimer\`, then a ${RELEASES}-release three-page dialogue `
    + 'whose text is an `.oel` ATTRIBUTE (`Game.as:2185` passes `o.@text` as the fourth '
    + 'ctor argument — the third place a pickup ceremony can get its text from and the '
    + 'first that is level data), then `Seed.removeSelf`, which is an override that '
    + `never reaches \`removed()\`: no item, no flag, and ${coverFadeFrames()} FROZEN `
    + 'frames of cover before `FP.world = new Game(115, currentPlayerPosition)` with '
    + '`Game.cutscene[2]` set. The reboot is what ARMS the tree — `Game.as:2185` passes '
    + '`cutscene[2]` as `Seed`\'s fifth ctor argument, so the same `.oel` object comes '
    + `back as a growing one — and the ${treeSchedule().grow} frames of \`grow\` and the `
    + `${treeSchedule().fade} of the second cover fade are TAPE TICKS, not frozen `
    + 'frames: `cutscene[2]` sets `p.receiveInput = false`, which makes '
    + '`canInventory()` false, which runs `inventory.open = false`, which IS '
    + '`Game.freezeObjects = false`. What holds the player still is `p.active = false`. '
    + `At tick ${TICK_COUNT} the cover reaches 1 and the game reboots a second time with `
    + '`Game.menu = true`, `Game.cutscene[2] = false`, badge 14 and `menuIndex` 2 — THE '
    + 'CREDITS, which `botStatus.menu_state` reports directly. The tape ends on that '
    + 'tick and not one later: `Game.menuAndRestart()` freezes every frame from there, '
    + 'and `Input.released(Key.ANY)` would leave the menu and reboot the world again.');

const control = tapeFor('r6-seed-control', CONTROL_INPUTS, CONTROL_TICK_COUNT,
    'R6 slice 6d: the one-release-fewer control — the same tape with the SIXTH and last '
    + 'dialogue release deleted. The approach is byte-identical (three movement spans '
    + 'from a separate generator), the 150 frozen frames of `Pickup.specialTimer` are '
    + 'paid in full and five sixths of the seed\'s text is read; what is never reached '
    + 'is `Seed.removeSelf`. So there is no cover fade, no `cutscene[2]`, no reboot, no '
    + 'tree, no second fade and no credits: `menu_state` stays 0 where the drive\'s '
    + 'reads 2, and that readout is the pair\'s discriminator. The tape ends inside the '
    + 'ceremony with the player still standing on the seed and the NPC on its last '
    + 'page — the same shape as `r6-watcher-control`, and for a stronger version of the '
    + 'same reason: a pickup\'s freeze has nothing to lower it, so these frames are '
    + 'DEAD and the tape\'s counter does not even run through them.');

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = run(tape.inputs, tape.tick_count);
const c = run(control.inputs, control.tick_count);

// ── the moat ─────────────────────────────────────────────────────────
const w115 = buildLevelWorld(atlasLevelSource()(115), { roles: ROLES });
check(w115.waterfallTiles.length === 4
    && w115.waterfallTiles.every((t) => t.ty === 7),
    '⛔⛔⛔ THE MOAT HAS TWO GATES — the row below the island is a WATERFALL',
    `${w115.waterfallTiles.length} waterfall tiles, all at row `
    + `${w115.waterfallTiles[0]?.ty} (tx `
    + `${w115.waterfallTiles.map((t) => t.tx).join(',')}); the arrival tile `
    + `(4,8) is t = ${w115.walkableTiles.find((t) => t.tx === 4 && t.ty === 8)?.t}`);
check(conchOnly.collected === 0 && conchOnly.y >= 96,
    '⛔ …and the CONCH ALONE CANNOT CROSS IT — driven, not asserted from the table',
    `400 ticks of \`up\` with the feather withheld come to rest at y `
    + `${conchOnly.y.toFixed(2)} — INSIDE the fall (rows 112..128), pushed back down `
    + 'as fast as the swim climbs, and never within 6 px of the island\'s southern edge '
    + 'at y 96. Nothing collected. §17.8 found the water and stopped there; the ⚖ that '
    + 'granted the conch could not have known about this gate');
check(a.stream.some((o) => o.y > 128) && a.run.collected.length === 1,
    '⛓⛓ …and the ARMED crossing works — no `noHazards` entry on either arm',
    `noHazards ${JSON.stringify(tape.noHazards)}, grants `
    + `${JSON.stringify(GRANTS[0].items)}; from y ${a.stream[0].y} to the seed at tick `
    + `${contactTick}`);
check(a.run.damage.hits === 0 && a.run.playerHits.length === 0,
    '⛓ ZERO DAMAGE and no drowning — the water is armed and the conch answers it',
    `hits ${a.run.damage.hits}, ${a.run.playerHits.length} contact(s)`);

// ── the ceremony ─────────────────────────────────────────────────────
check(a.run.collected.length === 1 && a.run.collected[0].item === null
    && a.run.earnedClears.length === 0,
    '⛔ THE PICKUP GRANTS NOTHING AND CLEARS NOTHING — `Seed` overrides `removeSelf`',
    `collected ${JSON.stringify(a.run.collected)}, earnedClears `
    + `${JSON.stringify(a.run.earnedClears)}`);
check(a.run.seedFades.length === 1 && a.run.seedFades[0].arm === 'plain'
    && a.run.seedFades[0].fadeFrames === coverFadeFrames(),
    '⛓⛓ THE FIRST COVER FADE IS 200 **FROZEN** FRAMES — nothing lowers the flag',
    JSON.stringify(a.run.seedFades[0]));

// ── the two reboots ──────────────────────────────────────────────────
const [r1, r2] = a.run.endingReboots;
check(a.run.endingReboots.length === 2 && r1.arm === 'plain' && r2.arm === 'tree'
    && r1.sameLevel && r2.sameLevel,
    '⛓⛓⛓ TWO GAME-INITIATED REBOOTS, BOTH INTO THE SAME LEVEL',
    JSON.stringify(a.run.endingReboots));
check(a.run.transitions.length === 0,
    '⛔ …and NEITHER produces a transition record — the level field never changes',
    `transitions ${JSON.stringify(a.run.transitions)}. \`deriveTransitions\` is the one `
    + 'derivation both sides share and it reads the LEVEL, so these are loads nothing '
    + 'can see — the dead-frame band has to be told about them (`endingReboots`)');

// ── the tree ─────────────────────────────────────────────────────────
const sched = treeSchedule();
const [endAnim, coverFull] = a.run.treeEvents;
check(a.run.treeEvents.length === 2 && endAnim.r === sched.grow
    && coverFull.r === sched.grow + sched.fade,
    `⛓⛓ THE TREE IS ${sched.grow} TICKS OF GROW AND ${sched.fade} OF COVER`,
    `endAnim at relative tick ${endAnim?.r} (absolute ${endAnim?.t}), coverFull at `
    + `${coverFull?.r} (absolute ${coverFull?.t}); the reboot is at ${r1.t}, so the `
    + 'first grow update is the first LIVE frame of the rebuilt world — `play("grow")` '
    + 'runs in the CONSTRUCTOR, not inside an update pass, which is the OPPOSITE '
    + 'fencepost from W-door\'s');
const holdTicks = r2.t - r1.t;
check(holdTicks === sched.grow + sched.fade,
    `⛔⛔⛔ AND ALL ${holdTicks} OF THEM ARE **TICKS** — §14.5 priced them as frozen`,
    `${holdTicks} tape ticks between the two reboots against `
    + `${a.run.frozenFramesOwed} frozen frames for the WHOLE run (the first cover fade, `
    + 'and nothing else). `cutscene[2]` sets `p.receiveInput = false`, which makes '
    + '`canInventory()` false, which runs `inventory.open = false`, which IS '
    + '`Game.freezeObjects = false` — the cutscene LOWERS the freeze every frame');
const holdStream = a.stream.filter((o) => o.t > r1.t && o.t <= r2.t);
check(holdStream.length > 0
    && holdStream.every((o) => o.x === holdStream[0].x && o.y === holdStream[0].y),
    '⛓ …with the player motionless for every one of them (`p.active = false`)',
    `${holdStream.length} observations at (${holdStream[0]?.x}, ${holdStream[0]?.y}) — `
    + 'the respawn `Game.currentPlayerPosition` gave, which is the BOOT block: the '
    + '`playerPosition` setter writes it from the ctor args and walking never does');

// ── the credits ──────────────────────────────────────────────────────
check(a.run.credits !== null && a.run.credits.menuState === CREDITS.menuState
    && a.run.credits.t === tape.tick_count,
    '⛓⛓⛓ THE CREDITS — `menuState` 2, ON THE TAPE\'S LAST OBSERVATION',
    JSON.stringify(a.run.credits) + `, tick_count ${tape.tick_count}`);
check(a.run.cutscene.every((f) => f === false),
    '⛓ …and `cutscene[2]` is CLEARED again — the tree arm is its only clearer',
    `cutscene ${JSON.stringify(a.run.cutscene)}; the plain arm SET it at tick ${r1.t} `
    + `and the tree arm cleared it at ${r2.t}, so the terminal readout is the menu and `
    + 'not the flag');
const live = menuWriterEliminations('W-seed').filter((e) => e.live);
check(live.length === 1 && live[0].site === 'Pickups/Seed.as:77',
    '⛓⛓ …and the ELIMINATION still leaves exactly one writer — the belt to the readout',
    `${live.length} live writer(s): ${live.map((e) => e.site).join(', ')}. The readout `
    + 'says it is a menu with index 2; the elimination says the 2 came from the tree');
let creditsRefused = null;
try {
    run(tape.inputs, tape.tick_count + 1);
} catch (e) { creditsRefused = e.message; }
check(creditsRefused !== null && /CREDITS/.test(creditsRefused),
    '⛔ AND ONE TICK MORE IS REFUSED BY NAME — a menu is a reboot loop, not a room',
    creditsRefused ? creditsRefused.slice(0, 160) : 'the model ran past the credits');

// ── the control ──────────────────────────────────────────────────────
check(c.run.credits === null && c.run.endingReboots.length === 0
    && c.run.seedFades.length === 0 && c.run.collected.length === 0,
    '⛔⛔⛔ THE CONTROL NEVER REACHES `removeSelf` — one release short of three pages',
    `credits ${c.run.credits}, endingReboots ${c.run.endingReboots.length}, seedFades `
    + `${c.run.seedFades.length}, collected ${c.run.collected.length}`);
check(c.run.cutscene.every((f) => f === false) && c.run.level === 115,
    '⛓⛓ …and it ends inside the ceremony, in L115, with every cutscene flag false',
    `level ${c.run.level}, cutscene ${JSON.stringify(c.run.cutscene)}, at `
    + `(${c.stream[c.stream.length - 1].x}, ${c.stream[c.stream.length - 1].y}) — the `
    + `same place the drive's ceremony started, at tick ${contactTick}`);

// ── the pair's shape ─────────────────────────────────────────────────
const move = (t) => t.inputs.filter((s) => s.key !== 'primary');
check(JSON.stringify(move(tape)) === JSON.stringify(move(control)),
    '⛔ THE MOVEMENT SPANS ARE FROM A SEPARATE GENERATOR AND ARE IDENTICAL',
    `${JSON.stringify(move(tape))} on both arms`);
const drivePresses = tape.inputs.filter((s) => s.key === 'primary');
const ctlPresses = control.inputs.filter((s) => s.key === 'primary');
check(ctlPresses.length === RELEASES - 1
    && JSON.stringify(drivePresses.slice(0, -1)) === JSON.stringify(ctlPresses),
    '⛓ ONE PRIMITIVE FEWER, and every earlier release is byte-identical',
    `${drivePresses.length} releases against ${ctlPresses.length}; the deleted one is `
    + `${JSON.stringify(drivePresses[drivePresses.length - 1])}`);
let firstDiff = -1;
for (let i = 0; i < c.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y) {
        firstDiff = i; break;
    }
}
check(firstDiff === r1.t,
    '⛓⛓ …and the arms are position-identical UNTIL THE REBOOT, which is the divergence',
    `first positional difference at tick ${firstDiff}, which is exactly reboot 1 `
    + `(${r1.t}). Up to there the two streams are the same 182 observations; from there `
    + `the drive is at its RESPAWN (${a.stream[r1.t].x}, ${a.stream[r1.t].y}) and the `
    + `control is still frozen on the seed at (${c.stream[r1.t].x}, `
    + `${c.stream[r1.t].y}). A pair whose arms diverge by a POSITION JUMP rather than `
    + 'by a velocity is the shape a world swap makes, and it is the same one a death '
    + 'makes (§8.8)');

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`approach: up ${NORTH_1}, right ${EAST}, up to ${NORTH_2_END}; contact at `
    + `${contactTick}`);
console.log(`${RELEASES} releases at ${TALK_PRESSES.join(', ')} (cadence ${TALK_CADENCE}, `
    + `floor ${TALK_CADENCE - 1}); reboot 1 at ${r1.t}, endAnim ${endAnim.t}, reboot 2 `
    + `(CREDITS) at ${r2.t}`);
console.log(`drive ${tape.tick_count} ticks / ${a.run.frozenFramesOwed} frozen + 150 `
    + `phase A; control ${control.tick_count} ticks / ${c.run.frozenFramesOwed} frozen`);

if (checks.some((k) => !k.ok)) {
    console.error('\n⛔ at least one check FAILED — nothing written');
    process.exit(1);
}

if (WRITE) {
    for (const t of [tape, control]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, `${serializeTape(t)}\n`);
        console.log(`wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes)');
}
