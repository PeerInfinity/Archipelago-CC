#!/usr/bin/env node
/**
 * plan-seedling-r5-bosskey — THE KEY LEG, and the shut-before control that
 * makes it evidence.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §4 slice 4.
 *
 * ── WHAT THE LEG IS FOR ───────────────────────────────────────────────
 * `fire` is behind BobBoss, BobBoss is behind L30's `bosslock@224,208`, and
 * that lock is `keyType 1` — the key is `bosskey@112,64` in L29. Slice 0
 * found the leg; this is it, with the key and its lock in ONE segment, so
 * that "the lock opened" is a claim about a key this walk picked up rather
 * than about a save file somebody set up.
 *
 * ── ⛔ THE KEY OPENS **TWO** LOCKS, AND §2.6.1 NAMES ONLY ONE ─────────
 * L31 is not a corridor between L29 and L30. Its stairs to L30
 * (`stairsup@160,384`, tile (10,24)) sit in a five-tile POCKET whose only
 * entrance is `bosslock@192,432` at tile (12,27) — a second `keyType 1`
 * lock, persistence tag 0. A flood from the L29 arrival reaches 103 tiles
 * and none of them is the pocket:
 *
 *     reachable from (24,7): 103    12,28 REACHABLE    12,27 SOLID
 *                                   12,26 not reachable  10,24 not reachable
 *
 * So the same key is spent twice and the ledger gains TWO earned entries,
 * `{31,0}` and `{30,2}`, not one. A plan that priced the leg at one lock
 * would have walked into a wall in the middle of L31 with the key in hand
 * and no verb aimed at it.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 * The claim is an OPENED BLOCKER, so it needs a shut-before control, and
 * the honest shape here is not "one field apart" — a key is not a tape
 * field. It is the SAME STANCE AND THE SAME HOLD with the key absent:
 *
 *   r5-bosskey-lock-shut   boots at L30's lock stance and holds UP. Nothing
 *                          in the run holds `keyType 1`, `BossLock.update`
 *                          never sets `activate`, and the walk PINS against
 *                          a lock that is still `type = "Solid"`.
 *   r5-bosskey-leg         boots in L29, takes the key, spends it on both
 *                          locks, and ends INSIDE the brickpole chamber that
 *                          `stairsup@224,160` leaves from.
 *
 * What the pair attributes is `Player.hasKey(1)` — the one thing that
 * differs at the moment both arms stand on the same one-pixel line.
 *
 * ⚠ AND THE CHAMBER IS WHERE THE LEG STOPS, for two reasons that both point
 * the same way. L32's arrival tile (5,8) holds the RETURN teleporter, so the
 * tile planner refuses to end a walk on it; and every tile north of it is
 * across `FallRockLarge`'s arm line — `p.y < fallTo - 24` = **y < 120**
 * against an arrival at y = 128, eight pixels. A key leg that crossed the
 * stairs would have to either stand on a teleporter or start the boss fight,
 * so it stops one door short and step 2 boots into the arena itself.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-bosskey.mjs            # plan + report
 *   node scripts/procgen/plan-seedling-r5-bosskey.mjs --write    # write tapes
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE, rect, rectsOverlap } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { keyLineTouches, KEY_RESPONDERS, opensOnKeyTick } =
    await import(join(MODULE, 'activators.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const {
    R5_KEY_TYPE, R5_KEY_PICKUP, R5_KEY_LOCKS, R5_KEY_LEG_BOOT, R5_LOCK_SHUT_BOOT,
    R5_ARENA_ARM_Y, KEY_LEG, KEY_LOCK_SHUT, keyLockStance,
} = await import(join(MODULE, 'r5Chain.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();
const worldFor = (n) => buildLevelWorld(source(n), { roles: ROLES });

// ── 1. the geometry, confirmed against the shipped extract ────────────
console.log('## the key and the two locks it opens');
const l29 = worldFor(R5_KEY_PICKUP.level);
const key = l29.pickups.find((p) => p.x === R5_KEY_PICKUP.x && p.y === R5_KEY_PICKUP.y);
if (!key) throw new Error(`L${R5_KEY_PICKUP.level} has no pickup at the declared key`);
if (key.keyType !== R5_KEY_TYPE) {
    throw new Error(`the key at (${key.x},${key.y}) is keyType ${key.keyType}, not `
        + `${R5_KEY_TYPE} — the locks below read Player.hasKey(${R5_KEY_TYPE})`);
}
console.log(`   ${key.tag}@${key.x},${key.y} keyType ${key.keyType}, `
    + `volume ${JSON.stringify(key.rect)}`);

const opensOn = opensOnKeyTick(KEY_RESPONDERS.bosslock.keyTimer, KEY_RESPONDERS.bosslock.fade);
for (const dec of R5_KEY_LOCKS) {
    const w = worldFor(dec.level);
    const lock = w.activators.find((a) => a.x === dec.lock.x && a.y === dec.lock.y);
    if (!lock) throw new Error(`L${dec.level} has no activator at ${JSON.stringify(dec.lock)}`);
    if (lock.keyType !== R5_KEY_TYPE) {
        throw new Error(`${lock.id} in L${dec.level} is keyType ${lock.keyType}`);
    }
    if (lock.persistTag !== dec.tag) {
        throw new Error(`${lock.id} in L${dec.level} carries tag ${lock.persistTag}, `
            + `not the declared ${dec.tag} — the ledger claim names the tag`);
    }
    const at = keyLockStance(lock);
    // The stance is CHECKED against the world's own line test, not derived
    // and trusted: `keyLineTouches` is an integer point test, so a box that
    // straddles the last probe without containing it is not a touch.
    if (!keyLineTouches(playerBoxAt(at.x, at.y), lock.keyLine)) {
        throw new Error(`the stance (${at.x},${at.y}) for ${lock.id} does not contain an `
            + `integer probe of its key line ${JSON.stringify(lock.keyLine)}`);
    }
    if (w.collidesSolid(playerBoxAt(at.x, at.y))) {
        throw new Error(`the stance (${at.x},${at.y}) for ${lock.id} is inside a solid`);
    }
    console.log(`   L${dec.level} ${lock.id} tag ${lock.persistTag}, stance (${at.x},${at.y}), `
        + `line ${JSON.stringify(lock.keyLine)}, opens on tick ${opensOn} of contact`);
}

// ── 2. ⛔ THE POCKET — the finding that makes L31 a leg rather than a hop ──
{
    const w = worldFor(31);
    const walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < w.width && ty < w.height
        && !w.collidesSolid(playerBoxAt(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8));
    const arrival = w.teleporters.find((t) => t.to === 29);
    const stairsToL30 = w.teleporters.find((t) => t.to === 30);
    const from = [Math.floor(392 / TILE_SIZE), Math.floor(120 / TILE_SIZE)];
    const seen = new Set();
    const q = [from];
    while (q.length) {
        const [x, y] = q.pop();
        const k = `${x},${y}`;
        if (seen.has(k) || !walkable(x, y)) continue;
        seen.add(k);
        q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const stairsTile = `${stairsToL30.x / TILE_SIZE},${stairsToL30.y / TILE_SIZE}`;
    console.log(`\n## L31's pocket — the second lock is not optional`);
    console.log(`   the L29 arrival (${from.join(',')}) floods ${seen.size} tiles with the `
        + 'lock SHUT');
    console.log(`   the L30 stairs are at tile ${stairsTile} — `
        + `${seen.has(stairsTile) ? '⛔ REACHABLE, so this claim is stale' : 'NOT reachable'}`);
    if (seen.has(stairsTile)) {
        throw new Error('L31\'s stairs to L30 are reachable without the key, so the '
            + 'second keylock is not on the critical path and this plan is wrong about it');
    }
    if (!arrival) throw new Error('L31 has no stairs back to L29');
}

// ── 3. the legs ───────────────────────────────────────────────────────
console.log('\n## the legs');
for (const leg of KEY_LEG.legs) {
    console.log(`   L${leg.level}  ${leg.targets.length} target(s)`
        + `${leg.exit ? `  exit ${JSON.stringify(leg.exit)}` : '  (terminal)'}`);
}

const synth = synthesizeLegs(KEY_LEG.legs, {
    levelSource: source,
    boot: R5_KEY_LEG_BOOT,
    name: KEY_LEG.name,
    lattice: KEY_LEG.lattice,
    nodeMargin: KEY_LEG.nodeMargin,
    relax: {
        noclip: false,
        noDamage: true,
        noHazards: [...KEY_LEG.noHazards],
        grants: [],
        persistence: [],
    },
    allowGrazes: KEY_LEG.allowGrazes,
    extraVolumes: KEY_LEG.avoid.map((v) => ({ tag: v.tag, rect: rect(v.x, v.y, v.w, v.h) })),
});

const legTape = synth.tape;
console.log(`\n   synthesized ${legTape.tick_count} ticks, ${legTape.inputs.length} span(s), `
    + `${synth.arrivals.length} arrival(s), ${synth.grazes.length} graze(s)`);
console.log(`   collects  ${JSON.stringify(synth.collects.map((c) => `${c.item ?? c.pickup?.tag ?? '?'}@L${c.level}`))}`);
console.log(`   keys      ${JSON.stringify(synth.keys)}`);
for (const k of synth.keylocks) {
    console.log(`   keylock   L${k.level} lock (${k.lock.x},${k.lock.y}) keyType ${k.keyType} `
        + `-> ${JSON.stringify(k)}`);
}
console.log(`   transitions ${synth.transitions.map((t) => `${t.from_level}->${t.to_level}`).join(' ')}`);

// ── the §10.2 WINDOW CONTRACT, paid rather than asserted ──────────────
// `synthesizeLegs` stops the tape on the tick the last drive arrives, so its
// final span's release edge lands ON `tick_count` and never dispatches. Five
// of R4's six segments end that way and every one of them got away with it
// because a fresh page released the key implicitly. A WINDOW does not. The
// coast is added HERE rather than inside the driver because it is a fact
// about how this tape will be USED, and the driver emits tapes for both uses.
legTape.tick_count += KEY_LEG.coastTicks;
// ── THE PINS, and why they go on a walk that never touches water ──────
// `pins` is a per-TAPE field, so a chain of windows whose members disagree
// about it is a chain of two different executions. Slice 4 is the slice that
// arms water, the sound pin is UNIFORM over every sound set (`Music.playSound`
// draws from the runtime's one global `Math.random` LFSR, so leaving any set
// on the wall clock leaves that stream frame-rate-dependent), and the
// dead-frame pin changes WHICH frames are dead — 329 against 321 on the same
// tape. Both are the R0-gated PIN classification, so every recording under
// them is still a real-game run; what they buy is that it is a repeatable one.
legTape.tape_version = 5;
legTape.pins = [...KEY_LEG.pins];
legTape.equips = legTape.equips ?? [];
const atRest = assertWindowEndsAtRest(legTape);
if (atRest.length > 0) {
    throw new Error(`the key leg does not end at rest:\n  ${atRest.join('\n  ')}`);
}

// ── 4. ⚠ THE ARENA MOUTH — eight pixels of margin, asserted ───────────
{
    const l32 = worldFor(32);
    const stairs = worldFor(30).teleporters.find((t) => t.to === 32);
    const arrival = stairs.arrival;
    if (arrival.y - R5_ARENA_ARM_Y < 8) {
        throw new Error(`L32's arrival lands at y=${arrival.y} against the rock's arm at `
            + `y<${R5_ARENA_ARM_Y} — there is no margin at all`);
    }
    console.log(`\n## the arena mouth — what step 2 boots into`);
    console.log(`   L32 arrival (${arrival.x},${arrival.y}); `
        + `\`FallRockLarge\` arms at y < ${R5_ARENA_ARM_Y} — ${arrival.y - R5_ARENA_ARM_Y} px `
        + 'of margin, which is why this leg stops one door short of it');
    if (l32.pitTiles.length !== 2) {
        throw new Error(`L32 should have exactly two pit tiles, the extract says `
            + `${l32.pitTiles.length}`);
    }
    // ⛔ AND THE PIT IS SEALED BY A BURNABLE TREE — see `r5Chain.js`.
    const tree = l32.solids.find((s) => s.tag === 'burnabletree');
    if (!tree) throw new Error('L32 has no burnabletree — the exit claim is stale');
    for (const pit of l32.pitTiles) {
        if (!rectsOverlap(tree.rect, pit.rect)) {
            throw new Error(`L32's pit tile at (${pit.tx},${pit.ty}) is NOT under the `
                + 'burnable tree, so the arena has an exit that needs no fire');
        }
    }
    console.log(`   ⛔ both pit tiles are under \`burnabletree\`${JSON.stringify(tree.rect)} `
        + '— the exit needs FIRE, which is the item the arena grants');
}

// ── 5. the shut-before control ────────────────────────────────────────
const shutTape = {
    game: 'seedling',
    tape_version: 5,
    name: KEY_LOCK_SHUT.name,
    description: KEY_LOCK_SHUT.description,
    boot: R5_LOCK_SHUT_BOOT,
    noclip: false,
    noDamage: true,
    noHazards: [...KEY_LEG.noHazards],
    grants: [],
    persistence: [],
    equips: [],
    pins: [...KEY_LEG.pins],
    inputs: [{ key: 'up', from: KEY_LOCK_SHUT.holdFrom, to: KEY_LOCK_SHUT.holdTo }],
    tick_count: KEY_LOCK_SHUT.tickCount,
};
const shutRest = assertWindowEndsAtRest(shutTape);
if (shutRest.length > 0) {
    throw new Error(`the shut control does not end at rest:\n  ${shutRest.join('\n  ')}`);
}
// The control's whole value is that it holds LONGER than the lock would
// need. A hold shorter than the fade would pin for a reason the pair cannot
// tell apart from "not enough time".
const holdTicks = KEY_LOCK_SHUT.holdTo - KEY_LOCK_SHUT.holdFrom;
if (holdTicks <= opensOn) {
    throw new Error(`the control holds ${holdTicks} ticks against a lock that opens on `
        + `${opensOn} — a pin that short proves only that the walk was impatient`);
}
console.log(`\n## the shut-before control`);
console.log(`   boots ${JSON.stringify(R5_LOCK_SHUT_BOOT)}, holds UP for ${holdTicks} ticks `
    + `against a lock that would open on ${opensOn} — so a pin here is the KEY's absence`);

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [legTape, shutTape]) {
        const path = join(dir, `${t.name}.json`);
        // Round-tripped rather than trusted: `serializeTape` will happily
        // write a field combination `parseTape` refuses, and the place to
        // find that out is here rather than at `botLoadTape` in a browser.
        parseTape(serializeTape(t));
        writeFileSync(path, serializeTape(t));
        console.log(`   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the two tapes)');
}
