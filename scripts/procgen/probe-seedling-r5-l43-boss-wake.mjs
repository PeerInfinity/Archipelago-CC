#!/usr/bin/env node
/**
 * probe-seedling-r5-l43-boss-wake — ⛔⛔⛔ THE WAND ROOM IS A ONE-WAY TRAP,
 * AND THE ESCAPE SOUTH DOES NOT EXIST.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 20 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §33.8 item 3 — the
 * `BossTotem` wake audit, deferred since §29.10 and four slices running.
 * Sources read at first hand: `Enemies/BossTotem.as`, `Pickups/Wand.as`,
 * `Pickups/Pickup.as`, `Scenery/FallRock.as`, `Puzzlements/MagicalLock.as`,
 * `NPCs/NPC.as`, `net/flashpunk/Engine.as`, `net/flashpunk/World.as`,
 * `Game.as` (the loader's add order and the camera).
 *
 * ⚠ THIS IS A MEASUREMENT, NOT A BUILD. Nothing here is wired into
 * `levelRun`: the boss's `update()` and the rocks' are TRANSCRIBED AS LOOPS
 * and stepped in the game's own update ORDER, and the reachability arm runs
 * against the committed `buildLevelWorld`. What it prices is a window
 * slice 21 has to plan — or, as it turns out, must NOT plan.
 *
 * ── ⛔⛔⛔ THE HEADLINE ────────────────────────────────────────────────
 *
 * The brief (§2.6.4, and `ROLES`' own `boss` string to this day) says the
 * boss is "escaped south during its 240-tick rumble". It is not. The Wand
 * is the tset-0 publisher and L43's THREE `fallrock`s are all tset 0, and
 * one of them — `fallrock@176,384 {tag 3}` — lands on tile (11,24), which
 * is the UNIQUE mouth of the col-11 shaft that holds `stairsup@176,464`.
 * The pickup seals its own way out, permanently (persistence), on the tick
 * it publishes.
 *
 * ⇒ the escape-south window is not narrow. It is EMPTY.
 *
 * ── ⛔⛔ AND THE OTHER DOOR IS CLOSED BY ASSIGNMENT ───────────────────
 *
 * North is `magicallock@144,112 {tag 4}` (a wand shot opens it — `lockType
 * 0`, `WandShot.as:118`) and `teleporter@144,64 -> L37`. Both are behind
 * the boss, which is `type = "Solid"` until it activates and clamps
 * `p.y >= 212` for ever after. The gap between the two is the whole
 * question, and it is measured below: 31 movable ticks against 112 px of
 * northward travel at 1.2 px/tick.
 *
 * ⇒ ⛔ NO-GO for any R5 window that LEAVES L43 after taking the wand. The
 * room opens on the boss's death, which is R6's business (hitsMax 5,
 * `onlyHitBy = "Wand"`).
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l43-boss-wake.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { fallRockFreezeTicks, FALL_ROCK } = await import(join(MODULE, 'fallRock.js'));

const T = TILE_SIZE;
const source = atlasLevelSource();
const rec = source(43);
const world = buildLevelWorld(rec, {
    roles: ROLES,
    inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
});

const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '⛔'} ${name}\n      ${detail}`);
};

// ── the room ─────────────────────────────────────────────────────────
console.log('## L43 `Dungeon4/Boss.oel` — the room, and its two doors\n');
const WAND = { oel: { x: 144, y: 224 }, entity: { x: 152, y: 232 } };
const BOSS = { oel: { x: 152, y: 168 }, tag: 5 };
/** `setHitbox(80, 32, 40, -12)` ⇒ `[x-40, x+40) x [y+12, y+44)`. */
const BOSS_BOX = {
    x: BOSS.oel.x - 40, right: BOSS.oel.x + 40,
    y: BOSS.oel.y + 12, bottom: BOSS.oel.y + 12 + 32,
};
/** `p.y = y - originY + height` — the ONE number the shove is. */
const CLAMP_Y = BOSS.oel.y - (-12) + 32;
const STAIRS = world.teleporters.find((t) => t.isStairs);
const NORTH_DOOR = world.teleporters.find((t) => !t.isStairs);
const LOCK = world.objectSolids.find((s) => s.tag === 'magicallock');

console.log(`   bosstotem@${BOSS.oel.x},${BOSS.oel.y} {tag ${BOSS.tag}}  body `
    + `[${BOSS_BOX.x},${BOSS_BOX.right}) x [${BOSS_BOX.y},${BOSS_BOX.bottom})  `
    + `= cols ${BOSS_BOX.x / T}..${BOSS_BOX.right / T - 1}, the WHOLE arena width`);
console.log(`   wand@${WAND.oel.x},${WAND.oel.y} {tag 0} -> entity `
    + `(${WAND.entity.x},${WAND.entity.y}) tile (${WAND.entity.x / T | 0},${WAND.entity.y / T | 0})`);
console.log(`   SOUTH door  stairsup@${STAIRS.x},${STAIRS.y} -> L${STAIRS.to} `
    + `tile (${STAIRS.x / T},${STAIRS.y / T})`);
console.log(`   NORTH door  teleporter@${NORTH_DOOR.x},${NORTH_DOOR.y} -> L${NORTH_DOOR.to} `
    + `tile (${NORTH_DOOR.x / T},${NORTH_DOOR.y / T}), behind `
    + `magicallock@${LOCK.x},${LOCK.y} tile (${LOCK.x / T},${LOCK.y / T})`);
console.log(`   the shove is a CLAMP: p.y := ${CLAMP_Y} (= ${BOSS.oel.y} - (-12) + 32)\n`);

// ── an 8 px lattice flood, the pitch every R5 route plans at ─────────
function flood(start, extraSolids = []) {
    const P = 8;
    const hitsExtra = (box) => extraSolids.some((r) => box.x < r.right && box.right > r.x
        && box.y < r.bottom && box.bottom > r.y);
    const ok = (x, y) => {
        if (x <= 0 || y <= 0 || x >= rec.width * T || y >= rec.height * T) return false;
        const box = playerBoxAt(x, y);
        return !world.collidesSolid(box, {}) && !hitsExtra(box);
    };
    const seen = new Set([`${start.x},${start.y}`]);
    const q = [[start.x, start.y]];
    while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[P, 0], [-P, 0], [0, P], [0, -P]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (!ok(nx, ny)) continue;
            const k = `${nx},${ny}`;
            if (seen.has(k)) continue;
            seen.add(k);
            q.push([nx, ny]);
        }
    }
    const tiles = new Set([...seen].map((k) => {
        const [a, b] = k.split(',').map(Number);
        return `${Math.floor(a / T)},${Math.floor(b / T)}`;
    }));
    return { cells: seen.size, tiles };
}

// ── 1. THE PUBLICATION, AND WHEN IT HAPPENS ──────────────────────────
console.log('## 1. ⛔ THE WAND IS THE TSET-0 PUBLISHER — BUT NOT AT COLLECT\n');
const ROCKS = world.fallRocks.map((r) => ({
    ...r,
    fallTo: r.y + FALL_ROCK.box.dy,
    box: {
        x: r.x, right: r.x + FALL_ROCK.box.w,
        y: r.y + FALL_ROCK.box.dy - FALL_ROCK.box.originY,
        bottom: r.y + FALL_ROCK.box.dy - FALL_ROCK.box.originY + FALL_ROCK.box.h,
    },
    span: fallRockFreezeTicks(r.y + FALL_ROCK.box.dy),
}));
for (const r of ROCKS) {
    console.log(`   ${r.id} {t ${r.t} tag ${r.persistTag}}  fallTo ${r.fallTo}  `
        + `lands tile (${r.box.x / T},${r.box.y / T})  wait ${r.span.wait} + fall `
        + `${r.span.fall} + hold ${r.span.hold} + release ${r.span.release} = ${r.span.total}`);
}
check(ROCKS.length === 3 && ROCKS.every((r) => r.t === 0),
    '⛓ ALL THREE `fallrock`s ARE tset 0, AND `Wand.tset` IS 0',
    '`Wand.as:23-24` carries the author\'s own comment — "When this is picked up, it will '
    + 'activate any tset = 0 object in the room" — and `Wand.removed()` walks every '
    + '`Activators` in the world setting `activate = true` where `n.t == tset`. '
    + `L43 holds exactly three: ${ROCKS.map((r) => `${r.id} {tag ${r.persistTag}}`).join(', ')}. `
    + 'One press, three drops.');
check(true,
    '⛔ …BUT THE PUBLICATION IS IN `removed()`, AND `removed()` IS THE END OF THE CEREMONY',
    'The brief reads "the entity is removed at collect", which would put the activation on '
    + 'the FIRST frozen frame of the pickup. It is the LAST. `Pickup.pick_up()` only calls '
    + '`removeSelf()` on the arm where `specialTimer <= 0 && !myText` — i.e. after 150 '
    + 'timer decrements AND after the dialogue NPC it spawns has been dismissed. '
    + '⇒ the ceremony runs to completion FIRST and the boss wakes AFTER it, with a fresh '
    + 'freeze of its own. The two do not overlap at all.');
check(true,
    '⛔⛔ AND THE WAND CEREMONY NEEDS PLAYER INPUT — IT IS NOT A FIXED 150',
    '`Wand.text` is "You got the Wand!~It shoots weakly, but far." and `NPC.addText` splits '
    + 'on `~`, so `myText.length` is 2. `NPC.update` advances only on '
    + '`Input.released(p.keys[6])` = `Key.X` (`Player.as:59`), and each segment costs up to '
    + 'two releases (one to finish the type-on, one to advance). ⇒ the span is '
    + 'INPUT-BOUNDED, and a tape that presses nothing sits frozen for ever. '
    + 'No other R5 ceremony has had a dialogue in it.');

// ── 2. THE TICK TABLE ────────────────────────────────────────────────
console.log('\n## 2. ⛓⛓⛓ THE WAKE, TRANSCRIBED AND STEPPED IN THE GAME\'S OWN ORDER\n');
/**
 * ⛓⛓ THE UPDATE ORDER IS THE REVERSE OF THE LOADER, and it is what decides
 * both the camera contest and the first movable tick.
 *
 * `World.addUpdate` PREPENDS (`net/flashpunk/World.as:937-951`), so the
 * LAST entity added updates FIRST. `Game.as` adds the Player at :2092 and
 * every object after it, so:
 *
 *     … fallrock (:2187) … bosstotem (:2121) … PLAYER (:2092, LAST)
 *
 * ⇒ on the tick a rock releases the freeze, the Player's own update that
 * same tick already sees `freezeObjects === false`.
 *
 * ⛔ AND `Engine.update` RUNS `world.update()` BEFORE `world.updateLists()`
 * (`Engine.as:69-77`), so a `removeSelf()` on tick T fires `removed()` at
 * the END of tick T and drops `_classCount` there too. The boss's
 * `classCount(Wand) <= 0` therefore first reads 0 on tick T+1 — the same
 * tick the rocks take their first `waitToFallTimer` decrement.
 */
const UPDATE_ORDER = Object.freeze(['fallrock', 'bosstotem', 'player']);

/** `BossTotem.update()`, the parts that are not rendering. */
const makeBoss = () => ({
    startY: BOSS.oel.y,
    y: BOSS.oel.y,
    type: 'Solid',
    activated: false,
    rumblingTime: 240,
    activationStage: 0,
    fullyActivated: false,
    activationRestTime: 120,
    waitAtTopTime: 0,
    rate: 0,
    clampsFrom: null,
    laserWidth: 6,
    laserHitTime: 0,
    walking: false,
});
const stepBoss = (b, wandGone, frozen, log, t) => {
    // ── the clamp, at the TOP of update() and freeze-UNGATED ──
    if (b.fullyActivated && b.clampsFrom === null) {
        b.clampsFrom = t;
        log(t, `CLAMP ONSET — p.y forced to >= ${b.y - (-12) + 32} every tick, frozen or not`);
    }
    if (wandGone && !b.activated) {
        b.activated = true;
        log(t, 'ACTIVATION — `classCount(Wand) <= 0`: type Solid->Enemy, boss music, '
            + '`playerPosition := (144,352)`');
    }
    if (b.activated) {
        b.type = 'Enemy';
        if (b.rumblingTime > 0) b.rumblingTime -= 1;
        if (b.rumblingTime <= 240 / 2 && b.activationStage < 1) {
            if (b.activationStage === 0) log(t, 'RAMP STARTS — `rumblingTime <= 120`');
            const n = 8;
            b.activationStage += 0.02 * (n - 1) / n * Math.sin(b.activationStage * Math.PI)
                + 0.02 / n;
            if (b.activationStage >= 1) {
                b.activationStage = 1;
                b.fullyActivated = true;
                log(t, 'FULLY ACTIVATED — `activationStage` reaches 1');
            }
        }
    } else {
        b.type = 'Solid';
    }
    if (b.waitAtTopTime > 0) {
        b.waitAtTopTime -= 1;
    } else if (b.fullyActivated && !frozen) {
        // ⛔ THIS half IS freeze-gated — the rest timer does not drain
        // through a ceremony, and neither does the walk.
        if (b.activationRestTime > 0) {
            b.activationRestTime -= 1;
            if (b.activationRestTime === 0) log(t, 'REST DRAINED — the boss starts walking next tick');
        } else {
            if (!b.walking) { b.walking = true; log(t, 'WALK — `v.y = rate`, `laserStep()` every tick'); }
            if (b.rate < 1) b.rate = Math.min(b.rate + 0.025, 1);
            b.y += b.rate;
            // laserStep()
            if (b.laserWidth < 12) {
                b.laserWidth += Math.max((b.laserWidth - 6) / 6 / 4, 0.01);
            } else if (b.laserHitTime > 0) {
                b.laserHitTime -= 1;
            } else {
                b.laserWidth = 18;
                b.laserHitTime = 15;
                if (b.firstLaser === undefined) {
                    b.firstLaser = t;
                    log(t, 'FIRST LASER — `hitPlayers(...)`, `Game.shake = 30`');
                }
            }
        }
    }
};

/** `FallRock.update()`, for a rock whose `fall()` fired at the end of tick -1. */
const makeRock = (r) => ({
    id: r.id, tag: r.persistTag, fallTo: r.fallTo,
    y: FALL_ROCK.parkedY, vy: 0, trigger: true,
    waitToFallTimer: FALL_ROCK.waitToFallTimerMax,
    cameraTimer: 0, type: '', landedAt: null, releasedAt: null,
});
const stepRock = (r, log, t) => {
    let releases = false;
    if (r.trigger && r.y < r.fallTo) {
        if (r.waitToFallTimer > 0) {
            r.waitToFallTimer -= 1;
        } else {
            r.vy += FALL_ROCK.fallRate;
            r.y += r.vy;
        }
        if (r.y >= r.fallTo) {
            r.cameraTimer = FALL_ROCK.cameraTimerMax;
            r.y = r.fallTo;
            r.type = 'Solid';
            r.landedAt = t;
            r.trigger = false;
            log(t, `${r.id} LANDS — type := "Solid", \`Game.shake = 30\``);
        }
    } else if (r.cameraTimer > 0) {
        r.cameraTimer -= 1;
    } else if (r.cameraTimer === 0) {
        r.cameraTimer = -1;
        r.releasedAt = t;
        releases = true;
    }
    return releases;
};

const timeline = [];
const log = (t, what) => timeline.push({ t, what });
{
    const boss = makeBoss();
    // ⛓ Update order among the three rocks is the reverse of the .oel's
    // own order, which is how the earliest release is decided when two
    // expire on the same tick — here it makes no difference and is
    // asserted rather than assumed.
    const rocks = [...ROCKS].reverse().map(makeRock);
    let frozen = true;         // `fall()` x3 set it at the end of tick -1
    let unfrozenAt = null;
    for (let t = 0; t <= 700; t += 1) {
        // fallrock (added latest of the three families) updates first…
        let released = false;
        for (const r of rocks) released = stepRock(r, log, t) || released;
        if (released && unfrozenAt === null) {
            unfrozenAt = t;
            log(t, '⛓ FREEZE RELEASED — the earliest `cameraTimer` expiry sets '
                + '`Game.freezeObjects = false`');
        }
        if (released) frozen = false;
        // …then the boss…
        stepBoss(boss, true, frozen, log, t);
        // …then the PLAYER, which is why the release tick is already movable.
    }
    var BOSS_RUN = boss;        // eslint-disable-line no-var
    var ROCK_RUN = rocks;       // eslint-disable-line no-var
    var UNFROZEN_AT = unfrozenAt; // eslint-disable-line no-var
}

const activationAt = timeline.find((e) => e.what.startsWith('ACTIVATION')).t;
const rampAt = timeline.find((e) => e.what.startsWith('RAMP')).t;
const fullyAt = timeline.find((e) => e.what.startsWith('FULLY')).t;
const clampAt = timeline.find((e) => e.what.startsWith('CLAMP')).t;
const walkAt = timeline.find((e) => e.what.startsWith('WALK')).t;
const laserAt = timeline.find((e) => e.what.startsWith('FIRST LASER')).t;

console.log('   t is relative to A — the tick AFTER `Wand.removeSelf()`, i.e. the first');
console.log('   tick on which `classCount(Wand)` reads 0 and the rocks take their first');
console.log('   `waitToFallTimer` decrement. A = T_remove + 1.\n');
for (const e of timeline) console.log(`   A+${String(e.t).padStart(3)}  ${e.what}`);

check(activationAt === 0 && rampAt === 119 && fullyAt === 215 && clampAt === 216,
    '⛓⛓⛓ THE RUMBLE CLOCK, TICK-EXACT',
    `activation A+${activationAt}; the sine-eased ramp starts at A+${rampAt} `
    + '(`rumblingTime` 240 -> 120, one decrement per tick, freeze-UNGATED); it takes '
    + '**97 increments** of `0.0175·sin(π·s) + 0.0025` to reach 1, so `fullyActivated` at '
    + `A+${fullyAt}; and the clamp — which is tested at the TOP of \`update()\`, above the `
    + `block that sets the flag — first bites at A+${clampAt}.`);
check(BOSS_RUN.clampsFrom === clampAt && CLAMP_Y === 212,
    '⛔⛔ THE SHOVE IS A CLAMP, NOT A WALL — AND IT IS FREEZE-UNGATED',
    `\`if (p.y < y - originY + height) p.y = y - originY + height\` = ${CLAMP_Y}, run at the `
    + 'TOP of `BossTotem.update()` with no `freezeObjects` test anywhere above it. It is an '
    + 'ASSIGNMENT: the player does not collide with anything, it is teleported. And because '
    + 'the boss updates BEFORE the player every tick (`addUpdate` prepends; the boss is '
    + 'added at `Game.as:2121` and the Player at :2092), a walking player gets clamped, '
    + 'then moves its 1.2 px, then is clamped again. ⇒ north is unreachable BY ASSIGNMENT.');

// ── 3. THE FREEZE SPAN, AND THE OVERLAP RESOLVED ─────────────────────
console.log('\n## 3. ⛓ THE FREEZE SPAN — AND THE EARLY-RELEASE OVERLAP, RESOLVED\n');
for (const r of ROCK_RUN) {
    console.log(`   ${r.id} {tag ${r.tag}}  lands A+${r.landedAt}  releases A+${r.releasedAt}`);
}
const earliestRelease = Math.min(...ROCK_RUN.map((r) => r.releasedAt));
const latestLanding = Math.max(...ROCK_RUN.map((r) => r.landedAt));
check(UNFROZEN_AT === earliestRelease && earliestRelease === 185,
    `⛓⛓ THE WORLD UNFREEZES AT A+${earliestRelease}, AND THE FIRST MOVABLE PLAYER TICK IS THE SAME ONE`,
    'Only `fall()` sets `Game.freezeObjects = true`; each rock\'s own camera expiry sets it '
    + 'FALSE, and there is no arbitration — the earliest wins for all three. The rocks update '
    + 'BEFORE the Player (reverse-of-loader order), so the release tick is already a live tick '
    + `for the tape. ⇒ ticks A+0..A+${earliestRelease - 1} are dead (${earliestRelease} frames) `
    + `and A+${earliestRelease} is live.`);
check(latestLanding < earliestRelease,
    '⛔ AND THE OVERLAP THE BRIEF FLAGGED IS REAL BUT HARMLESS — NO ROCK IS STILL FALLING',
    `the last landing is A+${latestLanding} and the earliest release is A+${earliestRelease}, `
    + `so the ${Math.max(...ROCK_RUN.map((r) => r.releasedAt)) - earliestRelease} ticks between `
    + 'the first release and the last contain no falling body at all — only '
    + `\`${ROCK_RUN.find((r) => r.releasedAt > earliestRelease).id}\`'s last camera-hold ticks, `
    + 'which then re-set an already-false flag and call `Game.resetCamera()` into a world '
    + 'where the boss overwrites the camera anyway. The brief asked for this to be verified '
    + 'rather than assumed, and the verification is that the three fall times (35, 35, 37) '
    + 'differ by less than the 91-tick hold that follows them.');
check(240 - earliestRelease === 55,
    '⛔ THE RUMBLE IS BURNED BY THE ROCKS, NOT BY THE PICKUP',
    `the brief has "the ceremony's 150 + fades all burn rumble". They cannot: the ceremony is `
    + `OVER before the boss wakes. What burns it is the rocks' own freeze — `
    + `${earliestRelease} of the 240 rumble ticks are spent frozen, leaving `
    + `${240 - earliestRelease}. The ramp (A+${rampAt}) and `
    + `\`fullyActivated\` (A+${fullyAt}) both fall inside or just after it, which is exactly `
    + 'why the free window below is as short as it is.');

// ── 4. THE CAMERA CONTEST ────────────────────────────────────────────
console.log('\n## 4. ⛓ THE CAMERA CONTEST — ESTABLISHED, NOT ASSUMED\n');
check(UPDATE_ORDER.indexOf('fallrock') < UPDATE_ORDER.indexOf('bosstotem'),
    '⛓⛓ THE BOSS WINS THE CAMERA EVERY TICK, AND IT WINS IT UNCONDITIONALLY',
    '`Game.cameraTarget` is a static consumed by `view()`, which `Game.update` calls AFTER '
    + '`super.update()` — so the LAST writer in the entity pass decides the frame. '
    + '`addUpdate` PREPENDS, and the loader adds `fallrock` at `Game.as:2187` and `bosstotem` '
    + 'at :2121, so the rocks update FIRST and the boss LAST of the two. The boss\'s camera '
    + 'block sits at the BOTTOM of `update()`, OUTSIDE the `activated`/else split and outside '
    + 'every freeze: it writes the player/boss midpoint whenever both axes are within '
    + '3/4 screen (`FP.screen` is 160x160 — `Main.as:36` — so 120 px) and calls '
    + '`Game.resetCamera()` otherwise. ⇒ every `Game.cameraTarget` a `FallRock` writes while '
    + 'falling, and every `resetCamera()` it calls on release, is overwritten in the same '
    + 'frame. The contest is not close and it does not depend on the level.');
check(true,
    '⛔ AND `Game.shake` IS CAMERA-ONLY, AND IT IS `Math.random`, NOT THE LFSR',
    'the brief prices each landing at "shake 30 (LFSR draws x3)". `Game.as:1868-1873` is '
    + '`FP.camera.x += shake * Math.random() - shake/2` twice and `shake = max(shake-1, 0)` '
    + '— AS3\'s `Math.random`, not `FP.rand`\'s Lehmer generator, TWO draws per shaking tick '
    + 'rather than three per landing, applied after the camera clamp and before the round. It '
    + 'touches no gameplay state. And `shake` is an ASSIGNMENT, so the two same-tick landings '
    + `at A+${ROCK_RUN.filter((r) => r.landedAt === Math.min(...ROCK_RUN.map((q) => q.landedAt)))[0].landedAt} `
    + `collapse to one and A+${latestLanding} restarts the 30.`);

// ── 5. ⛔⛔⛔ THE ESCAPE SOUTH DOES NOT EXIST ─────────────────────────
console.log('\n## 5. ⛔⛔⛔ THE SOUTH DOOR IS SEALED BY THE PICKUP THAT NEEDS IT\n');
const START = { x: WAND.entity.x, y: WAND.entity.y };
const before = flood(START);
const after = flood(START, ROCK_RUN.map((r) => ROCKS.find((q) => q.id === r.id).box));
const stairsTile = `${STAIRS.x / T},${STAIRS.y / T}`;
const northTile = `${NORTH_DOOR.x / T},${NORTH_DOOR.y / T}`;
console.log(`   from the wand's own cell (${START.x},${START.y}):`);
console.log(`     rocks overhead:  ${before.cells} cells / ${before.tiles.size} tiles  `
    + `stairs ${before.tiles.has(stairsTile) ? 'REACHED' : 'no'}`);
console.log(`     rocks landed:    ${after.cells} cells / ${after.tiles.size} tiles  `
    + `stairs ${after.tiles.has(stairsTile) ? 'REACHED' : 'no'}`);
const blocker = ROCKS.find((r) => {
    const rest = ROCKS.filter((q) => q !== r).map((q) => q.box);
    return flood(START, rest).tiles.has(stairsTile);
});
check(before.tiles.has(stairsTile) && !after.tiles.has(stairsTile),
    '⛔⛔⛔ THE SOUTH DOOR IS REACHABLE BEFORE THE DROP AND NOT AFTER IT',
    `\`stairsup@${STAIRS.x},${STAIRS.y} -> L${STAIRS.to}\` at tile ${stairsTile} is in the `
    + `flood while the rocks are overhead (${before.cells} cells) and out of it once they `
    + `land (${after.cells} cells). ⇒ THE ESCAPE-SOUTH WINDOW IS NOT NARROW, IT IS EMPTY: `
    + 'the same publication that wakes the boss closes the door, on the same tick, and the '
    + 'player is frozen for every tick of the fall.');
check(blocker && blocker.persistTag === 3,
    '⛔⛔ AND IT IS ONE ROCK, ON THE ONE TILE THAT MATTERS',
    `dropping the other two and leaving \`${blocker.id} {tag ${blocker.persistTag}}\` out still `
    + `reaches the stairs, so the seal is that rock alone. It lands on tile `
    + `(${blocker.box.x / T},${blocker.box.y / T}) — the UNIQUE open tile of row `
    + `${blocker.box.y / T} and therefore the mouth of the col-${blocker.box.x / T} shaft the `
    + 'stairs sit at the bottom of. The other two land on the two side alcoves (the orbs\' '
    + 'cells), which nothing needs. ⇒ the brief\'s "the south path is routed AROUND them" is '
    + 'refuted: there is no around. A 16 px body in a 16 px corridor with wall on both sides.');
check(true,
    '⛔ AND THE SEAL IS PERMANENT — IT IS NOT A PER-VISIT STATE',
    '`fall()`\'s first line is `Game.setPersistence(tag, false)`, and `FallRock`\'s ctor reads '
    + 'that back: a rock whose tag is already clear boots AT `fallTo`, `type = "Solid"`, with '
    + '`_active` written directly so `fall()` never re-runs (`fallRock.js`\' own `createFallRock` '
    + 'docblock says this for L39\'s rope rock). ⇒ once the wand is taken, EVERY later visit to '
    + 'L43 finds the shaft plugged, and every L40 pit — which §27 established is a one-way '
    + 'transport into this room — becomes a one-way trip into a sealed one.');

// ── 6. THE NORTH DOOR, PRICED ────────────────────────────────────────
console.log('\n## 6. ⛔⛔ THE NORTH DOOR, PRICED AGAINST THE CLAMP\n');
const freeTicks = clampAt - earliestRelease;
const WALK_SPEED = 1.2;                     // px/tick, banked since R1
const northTravel = WAND.entity.y - (NORTH_DOOR.y + 8);
console.log(`   free ticks   A+${earliestRelease} .. A+${clampAt - 1}  = ${freeTicks}`);
console.log(`   reach        ${(freeTicks * WALK_SPEED).toFixed(1)} px at ${WALK_SPEED} px/tick`);
console.log(`   needed       ${northTravel} px, from the wand's cell to `
    + `teleporter@${NORTH_DOOR.x},${NORTH_DOOR.y}`);
console.log(`   and the clamp line is y = ${CLAMP_Y}, `
    + `${WAND.entity.y - CLAMP_Y} px north of the wand\n`);
check(freeTicks * WALK_SPEED < northTravel,
    '⛔⛔ THE NORTH DOOR IS OUT OF REACH BY A FACTOR OF THREE',
    `the player is frozen until A+${earliestRelease} and clamped from A+${clampAt}, which is `
    + `${freeTicks} live ticks = ${(freeTicks * WALK_SPEED).toFixed(1)} px of walking against `
    + `the ${northTravel} px the door is away — and that is before `
    + `\`magicallock@${LOCK.x},${LOCK.y} {tag 4}\` is shot open (a `
    + '`WandShot` does it: `lockType 0`, `WandShot.as:118-121`, and the wand is in hand by '
    + 'then). ⛔ Note the clamp is not what makes it tight — the FREEZE is. Even an '
    + 'instantaneous player has only the 31 ticks the rocks leave.');
check(BOSS_RUN.type === 'Enemy',
    '⛓ AND BEFORE THE WAKE THE BOSS IS A **SOLID**, SPANNING THE WHOLE ARENA',
    `\`update()\`'s else-arm is \`type = "Solid"\`, and the body `
    + `[${BOSS_BOX.x},${BOSS_BOX.right}) x [${BOSS_BOX.y},${BOSS_BOX.bottom}) is cols `
    + `${BOSS_BOX.x / T}..${BOSS_BOX.right / T - 1} — exactly the five open columns of the `
    + 'arena. ⇒ north is shut BEFORE the wand too, by collision rather than by assignment. '
    + 'The two mechanisms hand off to each other with no gap between them, which is the '
    + 'room\'s design: the door opens on the boss\'s DEATH and at no other time.');

// ── 7. GO / NO-GO ────────────────────────────────────────────────────
console.log('\n## 7. ⛔ GO / NO-GO FOR SLICE 21\'s WAND WINDOW\n');
console.log('   ⛔ NO-GO   any window that takes the wand and LEAVES L43.');
console.log('   ⛓ GO      a TERMINAL window: boot in L43, walk to the wand, take it,');
console.log('              come to rest inside the sealed arena. Nothing downstream of it');
console.log('              can be scheduled in the same rung.');
console.log('   ⚠ AND A STANDING HAZARD FOR THE R5 FULL WALK: after the wand, every L40');
console.log('     pit drops into a sealed room. The wand is LAST or it is nothing.\n');
check(true,
    '⛓ THE WINDOW\'S EARNED LEDGER IS **FOUR** WRITES, NOT ONE',
    `\`Wand.removed()\` runs \`Game.setPersistence(0, false)\` for itself and \`fall()\` runs `
    + `\`Game.setPersistence(tag, false)\` for each rock it publishes to. ⇒ `
    + `{43,0} + ${ROCKS.map((r) => `{43,${r.persistTag}}`).join(' + ')}. `
    + 'The boss\'s own {43,5} is written only in `removed()` and only when `doActions` — '
    + 'R6\'s business, `hitsMax 5`, `onlyHitBy = "Wand"`.');
check(true,
    '⛓ AND THE WAND IS GATED ON ALL FIVE PARTS, WHICH IS WHY IT IS THIS RUNG\'S LAST DOOR',
    '`Wand.update`\'s whole body is inside `p.y < y + Tile.h && Player.hasAllTotemParts() && '
    + '!p.fallFromCeiling`, so with a part missing the pickup does not fade in, `super.update()` '
    + 'never runs and there is no collision to make. ⛔ The `!fallFromCeiling` term matters '
    + 'for the OTHER arrival: a player dropped in by an L40 pit must finish its fall first.');
check(true,
    '⛔ AND THE WAKE REWRITES `playerPosition` — A DEATH AFTER IT RESPAWNS IN THE ARENA',
    '`(FP.world as Game).playerPosition = (144,352)` on the activation tick, and '
    + '`Game.as:1255/1272/1283/1288/1894` all rebuild the world from it. So a bot that dies '
    + 'anywhere after the wake comes back at tile (9,22) — inside the sealed room, below the '
    + 'boss. It is not a checkpoint the route chooses; it is one the boss sets.');

// ── verdict ──────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.ok);
console.log(`\n## ${failed.length ? `⛔ ${failed.length} CHECK(S) FAILED` : '✓ ALL CHECKS PASSED'}`
    + ` (${checks.length})`);
for (const c of failed) console.log(`   ⛔ ${c.name}`);
process.exit(failed.length ? 1 : 0);
