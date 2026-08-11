/**
 * seedlingDemo/combat — the two damage families, per INSTANCE, and the
 * arithmetic of a kill-lock.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.3/§2.4/§2.5.
 *
 * R5 retires `noDamage`, and that un-guards more than "the enemies". Every
 * table here answers one of the three questions the rung actually asks:
 *
 *   1. **Does approaching it cost anything?** — the aggro disc / static
 *      volume, which is the ROUTING default (§3.2: a chaser never
 *      approached never moves).
 *   2. **Can it be cleared, and how?** — because ten locks on this map open
 *      on `totalEnemies() == 0` and nothing else, and three of those ten
 *      are the doors to `darksuit`, to Dungeon 8 and through it.
 *   3. **Is it counted?** — which is NOT the same question as "is it an
 *      enemy". `Game.totalEnemies()` is a hand-written class-list SUM
 *      (`Game.as:1736-1764`; the `typeCount("Enemy")` version is commented
 *      out one line above it), and four placed enemy classes are missing
 *      from it. That omission is what makes L53's and L78's locks
 *      satisfiable at all, so it is asserted BY NAME below rather than
 *      left to be re-derived.
 *
 * ── WHY A SEPARATE MODULE ─────────────────────────────────────────────
 *
 * `levelWorld.ENTITY_CLASSES` answers the four ROLE questions (blocking,
 * trigger, pickup, proximity-hazard) and is already 3k lines. Combat is a
 * fifth question with its own vocabulary — hit points, aggro reach, which
 * terrain kills it, whether its death writes a flag — and the ladder's
 * precedent for a mechanic with its own vocabulary is a module of its own
 * (`activators.js`, `pushables.js`, `presses.js`, `bridges.js`). Slice 2
 * wires a `combat` ROLE that consults these tables; slice 0's instrument
 * consults the same ones, so there is one implementation and two callers —
 * the `levelRun.js` doctrine.
 *
 * ── ⚠ THE FACTS THE SOURCE WILL MISLEAD YOU ABOUT ─────────────────────
 *
 * - **`classCount` is EXACT-CLASS, not `is`.** `World._classCount` is keyed
 *   on `Entity._class`, which `Entity.as:68` sets from
 *   `getQualifiedClassName(this)` — the runtime class, not the hierarchy.
 *   So `classCount(Bob)` does NOT count `LavaRunner`, `Flyer` or `Bulb`,
 *   all three of which `extend Bob`. A kill bill that summed by
 *   inheritance would double every lavarunner on the map.
 * - **`Enemy.update`'s terrain switch reads the RAW tile type.** Its
 *   `getState()` (`Enemy.as:133-141`) is `nearestToPoint("Tile", x, y).t`
 *   and is NOT routed through `Bot.coerceState` — R0's four coerce sites
 *   are all in `Player`. So an enemy standing on water/lava/pit answers to
 *   the REAL map whatever the tape's `noHazards` says, and
 *   `dieInWater`/`dieInLava`/`canFallInPit` are a second way to empty a
 *   kill list that costs no sword press at all.
 * - **An enemy in its i-frames cannot contact-damage.** `Enemy.hitPlayer`
 *   gates on `hitsTimer <= 0`, so a hit buys 30 ticks of contact safety
 *   from THAT enemy as well as blocking the next hit.
 * - **`hitByDarkStuff` retires an enemy's i-frames permanently.**
 *   `Enemy.hit`'s gate is `(hitsTimer <= 0 || hitByDarkStuff)`, and
 *   `hitByDarkStuff` is set by a `"Shield"` or `"Suit"` hit — the darksuit
 *   retaliation inside `Player.hit`. An enemy that has touched a
 *   suit-wearing player takes every subsequent press.
 *
 * ── THE SECOND DAMAGE FAMILY ──────────────────────────────────────────
 *
 * `Puzzlements` damage through the same `Player.hit`, were never in any
 * enemy census, and none of them is counted by `totalEnemies()`. Their
 * TIMING CLASS is the field that matters, because two of the six take
 * their phase from `Game.worldFrame(...)` — i.e. from `Game.time`, which
 * is `Main.time`, a static that ticks on EVERY engine frame including the
 * dead ones (`Game.as:818` sits outside the `blackCover` gate). Those two
 * are phase-uncertain by the accumulated dead-frame count and get envelope
 * treatment; the other four are self-timed and exactly modellable.
 *
 * ── R5 SLICE 2: THE TABLES ARE NOW CHECKED AGAINST THE CALL SITES ─────
 *
 * Both tables above were written by READING the classes a human already
 * believed were dangerous, which is the shape R4 §14 caught being wrong:
 * a census is a claim about an ABSENCE, and a check that shares its
 * subject's derivation agrees with the omission that produced it.
 * `seedlingDamageSites.js` is the second, independent derivation — a grep
 * over the checkout for every `hit`/`drown`/`die` call on a `Player`-typed
 * expression, which knows nothing about enemies — and
 * `assertDamageFamilyCovered` requires the two to agree.
 *
 * ⚠ THE ENVELOPE NUMBERS. `speed` is the class's own `moveSpeed`, and it
 * is a BOUND on displacement per tick, not the observed step: `Mobile`
 * runs `friction()` (0.25) before `moveX/moveY`, and every chaser
 * re-normalizes its velocity to `moveSpeed` AFTER moving, so the actual
 * step is `moveSpeed - f`. The bound is what a contact-freedom proof needs
 * and the slack is deliberate — see `encounters.chaseEnvelope`.
 *
 * ⛔ AND `Enemy.update`'s OFF-SCREEN RETURN DOES NOT FREEZE THE SUBCLASS.
 * `Bob.update` is `super.update(); …chase…`, so an off-screen Bob still
 * runs its chase block and still accumulates velocity — what it skips is
 * `mobileUpdate` (friction, `moveX`/`moveY`), the terrain switch,
 * `hitUpdate` and `hitPlayer`. So off-screen means CANNOT MOVE and CANNOT
 * DAMAGE, which is all the envelope needs, but "frozen" is the wrong word
 * for it and the i-frame timer does not run down out there either.
 */

/**
 * The `Game.totalEnemies()` sum, VERBATIM and in source order
 * (`Game.as:1738-1763`).
 *
 * Exported as data rather than folded into a predicate because the claim
 * "this kill list is complete" is a claim about THIS list, and a reader
 * has to be able to diff it against the AS3.
 */
export const TOTAL_ENEMIES_CLASSES = Object.freeze([
    'Bob', 'BobSoldier', 'BobBoss', 'Flyer', 'Jellyfish', 'Cactus',
    'SandTrap', 'ShieldBoss', 'Spinner', 'WallFlyer', 'Puncher', 'Drill',
    'Turret', 'IceTurret', 'BossTotem', 'Tentacle', 'TentacleBeast',
    'Grenade', 'DarkTrap', 'LightBoss', 'LavaRunner', 'Bulb', 'Squishle',
    'FinalBoss', 'Enemy',
]);

/**
 * The `Enemies/*.as` classes the sum does NOT include, each with the reason
 * it matters.
 *
 * ⚠ This is an assertion, not documentation. §7's gate is "the
 * `totalEnemies` whitelist WITH its omissions asserted", because a kill
 * list is a claim about an ABSENCE and an absence is the one thing a
 * passing recording cannot confirm. `assertTotalEnemiesTable` below checks
 * the two lists partition the class directory.
 */
export const TOTAL_ENEMIES_OMISSIONS = Object.freeze({
    LavaTrap: 'nine placed, three of them the L108 ferry — and L78\'s kill '
        + 'lock stands in a room with three of them. Not counted is what '
        + 'makes that lock satisfiable.',
    IceTrap: 'five placed, `canHit = false` — unkillable AND uncounted, so '
        + 'L53\'s lock ignores the one in its own room.',
    BombPusher: '`hit()` overridden empty — unkillable. Counting it would '
        + 'seal L40 permanently, which is presumably why it is not.',
    LavaBoss: 'R6\'s problem; it is Solid to the player and sits off every '
        + 'kill-lock route.',
    LightBossController: 'an `Entity`, not a `Mobile` — it SPAWNS LightBoss '
        + '(which IS counted) rather than being an enemy itself.',
});

/**
 * The enemy census, per EXTRACT TAG.
 *
 * `as3` is the class `Game.loadlevel` constructs; `counted` is derived and
 * asserted against `TOTAL_ENEMIES_CLASSES` rather than declared twice.
 *
 * `kill`     — `null` when nothing can hit it, else `{hits}` sword presses
 *              at damage 1 (`hasDarkSword` doubles `Player.swordDamage`, so
 *              the bill halves — `pressesFor()` below).
 * `aggro`    — `{kind, range}`; `range` is the class's own `runRange` in
 *              pixels, measured `FP.distance(enemy, player)` from CENTRES.
 * `hitbox`   — `setHitbox(w, h, ox, oy)`, verbatim.
 * `terrain`  — what the RAW tile under it does: `dies` | `survives` |
 *              `falls` (the pit spin-and-fade, which also removes it).
 * `offScreen`— `activeOffScreen`; false means `Enemy.update` early-returns
 *              while the camera does not contain it (`Enemy.as:64-67`,
 *              zero margin), i.e. the thing is FROZEN until woken.
 * `sideWrite`— the persistence flag its `removed()` writes, if any. A kill
 *              that writes a flag is a LEDGER entry (§3.5).
 */
export const ENEMY_CLASSES = Object.freeze({
    bob: {
        ctor: { dx: 8, dy: 8, src: 'Bob.as:33 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Bob', kill: { hits: 3 }, aggro: { kind: 'chase', range: 80 },
        hitbox: { w: 8, h: 8, ox: 4, oy: 4 }, damage: 1, speed: 0.5,
        threatPad: 0, envelopeProof: true,
        threat: 'contact only — the 8x8 body is the whole threat',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/Bob.as:21,41 + Enemy defaults',
    },
    bobsoldier: {
        ctor: { dx: 8, dy: 8, src: 'BobSoldier.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'BobSoldier', kill: { hits: 3 }, aggro: { kind: 'chase', range: 80 },
        hitbox: { w: 8, h: 8, ox: 4, oy: 2 }, damage: 1, speed: 0.8,
        threatPad: 16, envelopeProof: true,
        threat: '`weaponLength = sprLameSword.width` = 16, a collideLine from the body (BobSoldier.as:37,165)',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/BobSoldier.as:33,65',
        why: 'carries a sword line beyond the body hitbox; see `reach`.',
        reach: { kind: 'sword-line', px: 16 },
    },
    bulb: {
        ctor: { dx: 8, dy: 8, src: 'Bulb.as `super(_x, _y)` → Bob adds Tile/2 — the offset is the PARENT\'s' },
        as3: 'Bulb', kill: { hits: 1 }, aggro: { kind: 'chase', range: 80 },
        hitbox: { w: 12, h: 12, ox: 6, oy: 6 }, damage: 1, speed: 0.65,
        threatPad: 0, envelopeProof: true,
        threat: 'contact only',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/Bulb.as:27,30 (extends Bob → runRange 80)',
        // ⛔ THE ONE KILL THAT EDITS THE NAV MESH. `startDeath` is
        // overridden EMPTY, so the kill does not destroy it: `update` plays
        // "drop", and `endAnim`'s "drop" arm does
        // `collidePoint("Tile", x, y).t = 17` — the tile under its CENTRE
        // becomes LAVA for the rest of the visit — before playing "die",
        // whose own `endAnim` arm removes it.
        navMeshEdit: { becomes: 17, where: 'the tile under its centre', src: 'Enemies/Bulb.as:71-79' },
    },
    lavarunner: {
        ctor: { dx: 8, dy: 8, src: 'LavaRunner.as `super(_x, _y)` → Bob adds Tile/2' },
        as3: 'LavaRunner', kill: { hits: 2 }, aggro: { kind: 'chase', range: 80 },
        hitbox: { w: 12, h: 12, ox: 6, oy: 6 }, damage: 1, speed: 1.5,
        threatPad: 0, envelopeProof: true,
        threat: 'contact only',
        // ⚠ It survives LAVA and nothing else. `dieInWater` is left at the
        // `Enemy` default and `canFallInPit` likewise — so water and pits
        // clear a lavarunner for free, which is the cheap arm of three of
        // the ten kill locks.
        terrain: { water: 'dies', lava: 'survives', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/LavaRunner.as:36,38,41 (extends Bob → runRange 80)',
    },
    jellyfish: {
        ctor: { dx: 8, dy: 8, src: 'Jellyfish.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Jellyfish', kill: { hits: 3 }, aggro: { kind: 'chase', range: 160 },
        hitbox: { w: 12, h: 12, ox: 6, oy: 6 }, damage: 1, speed: 0.8,
        threatPad: 0, envelopeProof: true,
        threat: 'contact only — the reach is all leash',
        // The only class on the map that must be KILLED: it survives water
        // and lava and refuses to fall in a pit.
        terrain: { water: 'survives', lava: 'survives', pit: 'refuses' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/Jellyfish.as:22,31-37',
        why: 'the longest leash on the map — 160 px, double every other chaser.',
    },
    puncher: {
        ctor: { dx: 8, dy: 8, src: 'Puncher.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Puncher', kill: { hits: 3 }, aggro: { kind: 'chase', range: 80 },
        hitbox: { w: 12, h: 12, ox: 6, oy: 4 }, damage: 1, speed: 1,
        threatPad: 8, envelopeProof: true,
        threat: 'the punch box is `r = 8` deep off the body edge (Puncher.as:201); the 10 is its attackRange, the distance at which it decides to punch',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        reach: { kind: 'punch', px: 10 },
        src: 'Enemies/Puncher.as:22-24,46,50',
    },
    drill: {
        ctor: { dx: 8, dy: 8, src: 'Drill.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Drill', kill: { hits: 3 }, aggro: { kind: 'teleport-hop', range: 48 },
        hitbox: { w: 10, h: 10, ox: 5, oy: 5 }, damage: 1, speed: 16,
        threatPad: 0, envelopeProof: true,
        threat: 'contact only; the hop is the motion, not the reach',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/Drill.as:18,37',
        why: 'the hop needs a solid-free line (`collideLine("Solid")`).',
    },
    flyer: {
        ctor: { dx: 8, dy: 8, src: 'Flyer.as `super(_x, _y)` → Bob adds Tile/2' },
        as3: 'Flyer', kill: { hits: 3 }, aggro: { kind: 'chase-through-walls', range: 80 },
        hitbox: { w: 10, h: 8, ox: 5, oy: 12 }, damage: 2, speed: 1,
        threatPad: 0, envelopeProof: true,
        threat: '`hitPlayer` is overridden EMPTY — only the drop frame damages, and it damages on the body',
        terrain: { water: 'survives', lava: 'survives', pit: 'refuses' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/Flyer.as:35-43 (extends Bob → runRange 80)',
        why: 'the only damage-2 contact outside a boss; `hitPlayer` is '
            + 'overridden so only the DROP frame damages.',
    },
    spinner: {
        ctor: { dx: 8, dy: 8, src: 'Spinner.as:30 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Spinner', kill: { hits: 3 }, aggro: { kind: 'none', range: 0 },
        hitbox: { w: 7, h: 7, ox: 4, oy: 4 }, damage: 1, speed: 1,
        threatPad: 13, envelopeProof: false,
        threat: '⚠ `hammerLength = sprSpinner.width - originX` = 18 - 5 = 13, a collideLine at `(Game.time % 45)/45 * 2π` — so the pad is real AND its angle is phase-uncertain, which is why the envelope may not clear one',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        // ⚠ RUNS OFF SCREEN. Its body wall-bounces on `Mobile` physics with
        // no chase (`runRange = 0` makes the chase block dead), so the body
        // is exactly modellable — but the HAMMER is
        // `(Game.time % 45)/45 * 2π`, a rotating `collideLine` whose phase
        // rides on the accumulated dead-frame count.
        offScreen: true, phaseSource: 'Game.time',
        reach: { kind: 'hammer-line', px: 'sprSpinner.width - originX' },
        sideWrite: 'own tag',
        src: 'Enemies/Spinner.as:23,42,44,58-62,69-76',
        why: '⚠ `Spinner.removed()` writes `setPersistence(tag, false)` — a '
            + 'kill-earned LEDGER entry, and the only non-boss enemy with one.',
    },
    wallflyer: {
        ctor: { dx: 8, dy: 8, src: 'WallFlyer.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'WallFlyer', kill: { hits: 3 }, aggro: { kind: 'wall-hug-launch', range: 'screen width' },
        hitbox: { w: 14, h: 14, ox: 7, oy: 7 }, damage: 1, speed: 4,
        threatPad: 160, envelopeProof: false,
        threat: 'the trigger ray is `FP.screen.width` and the launch is 4 px/tick along it — an envelope on the body proves nothing',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: 'in-flight only', sideWrite: null,
        src: 'Enemies/WallFlyer.as:38,71-75',
    },
    turret: {
        ctor: { dx: 8, dy: 8, src: 'Turret.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Turret', kill: { hits: 3 }, aggro: { kind: 'static-shooter', range: 64 },
        hitbox: { w: 16, h: 16, ox: 8, oy: 8 }, damage: 1, speed: 0,
        threatPad: 64, envelopeProof: false,
        threat: '⛔ THE BODY IS NOT THE THREAT. `TurretSpit` (speed 3) covers the whole 64 px attackRange, so a clearance proof on the 16x16 body would declare a shooting gallery contact-free',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        projectile: { as3: 'TurretSpit', speed: 3, everyTicks: 40 },
        src: 'Enemies/Turret.as:17-22,35',
    },
    iceturret: {
        ctor: { dx: 16, dy: 16, src: 'IceTurret.as `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile, not half' },
        as3: 'IceTurret', kill: { hits: 3 }, aggro: { kind: 'static-shooter', range: 128 },
        hitbox: { w: 32, h: 32, ox: 16, oy: 16 }, damage: 1, speed: 0,
        threatPad: 128, envelopeProof: false,
        threat: 'as the turret, at 128 px, and 3 blasts per volley — plus a `freeze(15)` that is OUTSIDE `noDamage`',
        // ⚠ TWO-STAGE, and the second stage is where the ladder's stories
        // about it go wrong. `death()` intercepts the first `destroy`:
        // hitbox shrinks to 16x16, the "dead" anim plays, `destroy` is put
        // BACK to false and `solids` gains Enemy/Player — a CORPSE that
        // still answers `classCount(IceTurret)`, so a kill lock stays shut.
        // The corpse clears only by reaching water/lava/pit, because
        // `update`'s first line is `dieInWater = hits >= hitsMax`.
        terrain: { water: 'dies-as-corpse', lava: 'dies-as-corpse', pit: 'falls-as-corpse' },
        offScreen: false, sideWrite: null,
        corpse: {
            solidWhenClear: true,
            // ⚠ AND THE ONLY THING THAT MOVES IT IS FIRE OR A PULSER.
            // `IceTurret.bump(p, t)` is gated on `t == "Fire" || t ==
            // "Pulse"` and has exactly two callers: `Player.genericHit`
            // (with the ATTACK TYPE, so a sword or spear press is a no-op)
            // and `Pulser.as:106`. It sets a target TILE one step away from
            // the pusher and `input()` glides there at 0.5 px/tick.
            pushedBy: ['Fire', 'Pulse'],
            glideSpeed: 0.5,
            src: 'Enemies/IceTurret.as:114-151,172-203,205-240',
        },
        src: 'Enemies/IceTurret.as:19,44,51,56,135-151',
    },
    grenade: {
        ctor: { dx: 8, dy: 8, src: '⚠ Grenade.as:34 spawns at `_y + Tile.h/2 - fallHeight` (48 px ABOVE) and `endY = _y + Tile.h/2` is where it lands; the RESTING position is what a route avoids' },
        as3: 'Grenade', kill: null, aggro: { kind: 'armed-by-proximity', range: 32 },
        hitbox: { w: 6, h: 6, ox: 3, oy: 3 }, damage: 1, speed: 0,
        threatPad: 20, envelopeProof: true,
        threat: 'armed at 32 px, blast radius 20 — so the crossing that ARMS it is survivable at >20 px, which is the whole bait-and-stand-clear verb',
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: null,
        blast: { radius: 20, force: 2 },
        src: 'Enemies/Grenade.as:19-23,38-50,70-71',
        why: '`hit()` is overridden EMPTY, so it cannot be killed — but it '
            + 'IS counted, and it removes ITSELF by exploding once armed. '
            + 'Arm it from 32 px and stand more than 20 px away.',
    },
    icetrap: {
        ctor: { dx: 8, dy: 8, src: 'IceTrap.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'IceTrap', kill: null, aggro: { kind: 'static', range: 8 },
        hitbox: { w: 16, h: 16, ox: 8, oy: 8 }, damage: 1, speed: 0,
        threatPad: 0, envelopeProof: true,
        threat: 'the 16x16 body chomps; the blast is IceTurretBlast on contact',
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/IceTrap.as:17,28,32',
        why: '`canHit = false` — unkillable, and NOT counted. A pure avoid '
            + 'volume; its `IceTurretBlast` freeze is outside `noDamage`.',
    },
    sandtrap: {
        ctor: { dx: 8, dy: 8, src: 'SandTrap.as:27 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'SandTrap', kill: { hits: 3 }, aggro: { kind: 'static', range: 20 },
        hitbox: { w: 16, h: 16, ox: 8, oy: 8 }, damage: 1, speed: 0,
        threatPad: 0, envelopeProof: true,
        threat: 'the 16x16 body chomps at 20 px',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: 'own tag',
        src: 'Enemies/SandTrap.as:17,35,85',
        why: '⚠ counted AND killable AND its `removed()` writes its tag.',
    },
    darktrap: {
        ctor: { dx: 8, dy: 8, src: 'DarkTrap.as `super(_x, _y, …)` → SandTrap adds Tile/2' },
        as3: 'DarkTrap', kill: null, aggro: { kind: 'static', range: 20 },
        hitbox: { w: 16, h: 16, ox: 8, oy: 8 }, damage: 1, speed: 0,
        threatPad: 0, envelopeProof: true,
        threat: 'the 16x16 body chomps at 20 px, and it cannot be killed',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/DarkTrap.as:56-59 (extends SandTrap → chompRange 20)',
        // ⛔ THE ONE COMBINATION THAT CAN SEAL A KILL LOCK FOREVER: counted
        // by `totalEnemies()` and `hit()` overridden empty. No kill-lock
        // level on this map contains one — `assertNoUnclearableKillLock`
        // is what keeps that a checked fact rather than a lucky one.
        unclearableIfCounted: true,
    },
    lavatrap: {
        ctor: { dx: 8, dy: 8, src: 'LavaTrap.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'LavaTrap', kill: { hits: 3 }, aggro: { kind: 'static-tongue', range: 32 },
        hitbox: { w: 10, h: 10, ox: 5, oy: 5 }, damage: 1, speed: 0,
        threatPad: 32, envelopeProof: false,
        threat: '⛔ the tongue LATCHES at 32 px and then writes the player\'s position absolutely — `die()` without the suit. Not a graze and not an envelope question',
        terrain: { water: 'dies', lava: 'dies', pit: 'falls' },
        offScreen: false, sideWrite: null,
        src: 'Enemies/LavaTrap.as:21,43',
        why: 'NOT counted. The tongue latches at 32 px and then writes the '
            + 'player\'s position absolutely — `die()` without the suit, a '
            + 'FERRY with it (L108). Killable, and killing an L108 one '
            + 'deletes the bridge.',
    },
    bombpusher: {
        ctor: { dx: 24, dy: 24, src: 'BombPusher.as `super(_x + Tile.w*3/2, _y + Tile.h*3/2)`' },
        as3: 'BombPusher', kill: null, aggro: { kind: 'static-lobber', range: 256 },
        hitbox: { w: 48, h: 48, ox: 24, oy: 24 }, damage: 1, speed: 0,
        threatPad: 24, envelopeProof: false,
        threat: 'the lobbed Bomb\'s `Explosion` is r 24 at the LANDING point, aimed at where the player stood at launch, from up to 256 px away',
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: true, sideWrite: null,
        src: 'Enemies/BombPusher.as:20-34,67',
        why: 'Solid FROM CONSTRUCTION (unlike the iceturret, which is Solid '
            + 'only post-mortem), unkillable, uncounted, and runs off '
            + 'screen. Its lobbed Bomb is aimed at the player\'s position '
            + 'at launch — deterministic.',
    },

    // ── bosses ────────────────────────────────────────────────────────
    // All four are COUNTED, so a boss in a kill-lock room is a fight, not
    // an avoid. None of them is in a kill-lock room.
    shieldboss: {
        ctor: { dx: 24, dy: 32, src: 'ShieldBoss.as `super(_x + Tile.w*1.5, _y + Tile.h*2)` — ⚠ asymmetric' },
        as3: 'ShieldBoss', kill: { hits: 4, why: 'the first is always swallowed' },
        aggro: { kind: 'boss', range: 'arena' },
        // ⛓ R6 SLICE 5: `setHitbox(48, 48, 24, 24)`, filled in beside the
        // totem's for the same reason — `shieldBossFight.SHIELD_BOSS.hitbox`
        // is the live one and the two are asserted equal. ⛔ IT IS NOT HIS
        // CONTACT VOLUME: see `CONTACT_BOSS_WHY.shieldboss`.
        hitbox: { w: 48, h: 48, ox: 24, oy: 24 }, damage: 1,
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: '(19, 0) at startDeath',
        boss: '⛓⛓⛓ R6 SLICE 5 — KILLED. The shield\'s only opener, and the room\'s '
            + 'only route north: the body is in `Mobile.solids`, it contains '
            + '`bosskey@96,64`, and the stairs to L20 are behind the `bosslock` that '
            + 'key opens.',
        src: 'Enemies/ShieldBoss.as:64,103-218',
    },
    bosstotem: {
        ctor: { dx: 0, dy: 0, src: 'BossTotem.as `super(_x, _y)` — no offset at any level of the chain' },
        as3: 'BossTotem', kill: { hits: 5, why: '`onlyHitBy = "Wand"`' },
        aggro: { kind: 'boss', range: 'arena' },
        // ⛓ R6 SLICE 4: `setHitbox(80, 32, 40, -12)`. It was `null` for five
        // rungs and that was HONEST — the census rect is the SPAWN box and
        // the fight moves it 140 px south. It is filled in now because
        // `bossTotemFight.BOSS_TOTEM_BODY` is the live one and the two are
        // asserted equal; a reader who found `null` here would go looking
        // for a hitbox the class plainly has.
        hitbox: { w: 80, h: 32, ox: 40, oy: -12 }, damage: 1,
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: '(43, 5)',
        // ⛔⛔⛔ CORRECTED AT R5 SLICE 20. This row said "AVOID — activated by
        // COLLECTING the wand, escaped south during its 240-tick rumble
        // (§2.6.4)". There is no escape south to time. The Wand is the
        // tset-0 publisher and L43's three `fallrock`s are all tset 0, and
        // `fallrock@176,384 {tag 3}` lands on tile (11,24) — the unique open
        // tile of row 24 and therefore the mouth of the col-11 shaft
        // `stairsup@176,464` sits at the bottom of. The pickup seals its own
        // way out on the tick it publishes, and the seal is persistence, so
        // it holds for every later visit. Measured in `r5Totem.L43_BOSS_WAKE`.
        boss: 'R6 — COLLECTING the wand seals the room. The tset-0 publish drops three '
            + 'fallrocks and one of them plugs the only shaft to `stairsup@176,464`; the '
            + 'player is frozen for all 185 ticks of the fall, and the 31 live ticks '
            + 'before the clamp (`p.y := 212`, freeze-ungated, from A+216) buy 37 px of '
            + 'the 160 the north teleporter is away. The room opens on the boss\'s death.',
        // ⚠ MODEL GAP, NAMED: `update()`\'s else-arm is `type = "Solid"`, so
        // an UNWOKEN BossTotem is a solid spanning the arena's five open
        // columns (cols 7..11, `[112,192) x [180,212)`). This row's
        // `hitbox: null` keeps it out of `chaseEnvelope`, which is right for
        // a boss; it also keeps the body out of `world.solids`, which is a
        // silence. Nothing in R5 routes north of it, so no leg pays for it —
        // giving it a hitbox without a driven witness would change every
        // chase envelope this table feeds.
        preWakeSolid: { w: 80, h: 32, ox: 40, oy: -12, cols: [7, 11], src: 'BossTotem.as:257,315' },
        src: 'Enemies/BossTotem.as:478',
    },
    lavaboss: {
        ctor: { dx: 48, dy: 40, src: 'LavaBoss.as `super(_x + 48, _y + 40)`' },
        as3: 'LavaBoss', kill: { hits: null }, aggro: { kind: 'boss', range: 'arena' },
        hitbox: null, damage: 1,
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: 'own tag',
        boss: 'R6 — and UNCOUNTED, so it seals no lock',
        src: 'Enemies/LavaBoss.as:137',
    },
    tentaclebeast: {
        ctor: { dx: 24, dy: 24, src: 'TentacleBeast.as `super(_x + 24, _y + 24)` — ⚠ NOT levelWorld\'s dx/dy 1/2, which is the MASK\'s top-left and answers a different question' },
        as3: 'TentacleBeast', kill: { hits: null }, aggro: { kind: 'boss', range: 'arena' },
        hitbox: null, damage: 1,
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: false, sideWrite: 'own tag',
        boss: 'R6', src: 'Enemies/TentacleBeast.as:102',
    },
    finalboss: {
        ctor: { dx: 8, dy: 8, src: 'FinalBoss.as `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'FinalBoss',
        // ⛓ R6 SLICE 6b: `hitsMax` is the inherited 3 and every one of the
        // three is a LAVA SELF-HIT — `onlyHitBy = "Lava"`, so a sword press
        // takes `Enemy.hit`'s `justKnock` arm and moves him without counting.
        kill: { hits: 3, why: '`onlyHitBy = "Lava"` — the player SHOVES, the lava kills' },
        aggro: { kind: 'boss', range: 'arena' },
        // ⛓ `setHitbox(12, 12, 6, 6)` (FinalBoss.as:52). Filled in beside the
        // totem's and the shield's for the same reason:
        // `finalBossFight.FINAL_BOSS.hitbox` is the live one and the two are
        // asserted equal there.
        hitbox: { w: 12, h: 12, ox: 6, oy: 6 }, damage: 1,
        // ⛓ `dieInLava = false` — "Handled manually" (FinalBoss.as:58). The
        // lava does not destroy him; it calls `hit(6, …, "Lava")`, which is
        // the only type `onlyHitBy` admits.
        terrain: { water: 'immune (dieInWater false)', lava: 'the KILL MECHANISM, not death: `dieInLava = false` and `update()` calls `hit(6, centre, 1, "Lava")` by hand', pit: 'immune (canFallInPit false)' },
        // ⛔ R6 SLICE 6b — CORRECTED. `FinalBoss.as:56` sets
        // `activeOffScreen = true`, so `Enemy.update`'s first line never
        // returns for him. This row said `false` for five rungs and no tape
        // had ever been in the room. It matters twice: the barrage aims at
        // the player from anywhere in the level, and §11.6's 9 px shake band
        // — which makes `onScreen` three-valued for every other class — can
        // never make HIM inactive. The one boss with no `onScreen` question.
        offScreen: true, sideWrite: 'own tag + tag+1, both CLEARED',
        boss: '⛓⛓⛓ R6 SLICE 6b — KILLED. Three lava self-hits, each a SHOVE the player '
            + 'buys with a sword press: `justKnock` sets no `hitsTimer`, so all five of '
            + 'a press\'s hit tests land and compound. `canHit = rockfallTime < 0` makes '
            + 'him untouchable for all 240 ticks of every barrage, so the fight lives in '
            + 'the walk phases. ⛔ `death()` is overridden EMPTY and `startDeath` sets '
            + '`type = "Solid"`: the corpse never fades and never removes, so it is a '
            + 'PERMANENT WALL wherever the third shove left him.',
        src: 'Enemies/FinalBoss.as:52,56,58,101-165,197,221-222,236-243',
    },
    lightbosscontroller: {
        ctor: { dx: 0, dy: 0, src: 'LightBossController.as — an `Entity`, not a `Mobile`; it spawns LightBoss rather than standing anywhere' },
        as3: 'LightBossController', kill: null, aggro: { kind: 'spawner', range: 'level' },
        hitbox: null, damage: 0,
        terrain: { water: 'n/a', lava: 'n/a', pit: 'n/a' },
        offScreen: true, sideWrite: 'own tag',
        boss: 'R6 — an `Entity`, not an enemy; it SPAWNS LightBoss, which is counted',
        src: 'Enemies/LightBossController.as:106',
    },
});

/**
 * The second damage family: `Puzzlements` that reach `Player.hit`, plus the
 * two that move the player without it.
 *
 * `timing` is the field the rung turns on:
 *   `self`       — its own countdown; exactly modellable.
 *   `worldFrame` — `Game.worldFrame(...)`, i.e. `Game.time`, i.e. phase
 *                  uncertain by the accumulated dead-frame count. Gets a
 *                  jitter-band envelope (§3.2) unless the slice-0
 *                  measurement says the variance is zero.
 *   `activator`  — gated by an `Activators` group as well as its own timer.
 *   `boss-script` — R6 slice 6b. NOT a clock at all: the state is written
 *                  by another entity's fight script AND by the player's own
 *                  overlap, so it is modellable only alongside that fight.
 *                  The value exists so the absence of a countdown is
 *                  DECLARED rather than implied by filing it `self`.
 */
export const PUZZLEMENT_HAZARDS = Object.freeze({
    spinningaxe: {
        ctor: { dx: 8, dy: 8, src: 'SpinningAxe.as:36 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'SpinningAxe', timing: 'self', damage: 1,
        src: 'Puzzlements/SpinningAxe.as:24,45,75',
        why: 'the `rate` attribute is the spin rate; nothing shared feeds it.',
    },
    beamtower: {
        ctor: { dx: 8, dy: 16, src: 'BeamTower.as:28 `super(_x + 8, _y + 16)`' },
        as3: 'BeamTower', timing: 'worldFrame', damage: 1,
        src: 'Puzzlements/BeamTower.as:22,92,102',
        why: '⚠ the beam position is '
            + '`radius * sin(Game.worldFrame(phases, loops)/phases * 2π)`. '
            + 'Four of these flank the L108 ferry corridor, so the phase '
            + 'question is on the critical path.',
    },
    lavachain: {
        ctor: { dx: 8, dy: 8, src: 'LavaChain.as:30 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'LavaChain', timing: 'worldFrame', damage: 1,
        src: 'Puzzlements/LavaChain.as:23,53,90',
        why: '`if (!Game.worldFrame(Main.FPS, loops))` gates the step.',
    },
    crusher: {
        ctor: { dx: 16, dy: 16, src: 'Crusher.as:37 `super(_x + Tile.w, _y + Tile.h)`' },
        as3: 'Crusher', timing: 'self', damage: 1000,
        src: 'Puzzlements/Crusher.as:33,98',
        why: '⛔ damage 1000 — "KILL EVERYTHING". A crusher contact is '
            + '`die()` at any `hitsMax`, so its volume is never a graze.',
    },
    pulser: {
        ctor: { dx: 8, dy: 8, src: 'Pulser.as:42 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Pulser', timing: 'self', damage: 1,
        src: 'Puzzlements/Pulser.as:32-36,102-114',
        why: 'also a MECHANIC: its pulse bumps `PushableBlockFire` and a '
            + 'dead `IceTurret` with the type "Pulse".',
    },
    arrowtrap: {
        // ⛔⛔ R7 SLICE 6b — THIS ROW SAID 2.5 AND THE SIGNATURE SAYS 2.
        // `super(_x + Tile.w/2, _y + sprArrowTrap.height/2, …)` with a 16x5
        // sprite reads as a half pixel, and the row's old comment said so in
        // as many words. But the call lands on
        // `Activators(_x:int, _y:int, _g:Graphic, _t:int)` and the int params
        // TRUNCATE it — the entity sits at `oel.y + 2`. Trap 143's shape one
        // class along: the expression is not the signature.
        // [[feedback_call_site_arg_order_not_meaning]]
        ctor: { dx: 8, dy: 2, src: 'ArrowTrap.as:24 `super(_x + Tile.w/2, _y + sprArrowTrap.height/2, …)` through `Activators(_x:int, _y:int, …)` — the int params truncate the 2.5 to 2' },
        as3: 'ArrowTrap', timing: 'activator', damage: 1,
        src: 'Puzzlements/ArrowTrap.as:18-19,30-38,48-63 + Projectiles/Arrow.as:49',
        why: '3 arrows every 10 frames at speed 5, downward. ⚠ The arrow\'s '
            + 'DAMAGE is 1, not 5 — `Player.hit(e, f, p, d = 1)` and the '
            + 'call passes no `d`; the 5 is `new Point(0, 5)`, the speed. '
            + 'The `Game.worldFrame` in this class is in `render()` and '
            + 'picks a sprite frame, so the timing is self/activator only.',
    },
    whirlpool: {
        ctor: { dx: 16, dy: 16, src: 'Whirlpool.as `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile' },
        as3: 'Whirlpool', timing: 'self', damage: 0, displaces: true,
        src: 'Puzzlements/Whirlpool.as:56-84',
        why: 'writes the player\'s position absolutely and then `drown()`s '
            + 'them; `noHazards` does not reach it. An avoid volume with a '
            + 'knife edge — gate is overlap AND `FP.distance < 16`.',
    },
    /**
     * ⛓⛓ R6 SLICE 6b — THE FIRST `boss-script` ROW, AND THE NAME IS THE
     * CLAIM.
     *
     * A `Pod` is `Scenery` (an `Entity`, not an `Enemy`), so it belongs in
     * this table rather than in `ENEMY_CLASSES`, and
     * `seedlingDamageSites.HARMFUL_CLASSES` finds it at three sites
     * (`Pod.as:70`, `:71` the position writes, `:73` the `hit`).
     *
     * ⛔ ITS `timing` IS A NEW CLASS AND MUST NOT BE FILED AS `self`. The
     * three existing values all name a clock the modeller can read: `self`
     * is the entity's own countdown, `worldFrame` is `Game.time`,
     * `activator` is a group plus a timer. A Pod's animation state has
     * **two writers and neither is a timer**: `FinalBoss.update` at `:150`,
     * `:172` and `:179` (`pods[cpod].open = true/false`, i.e. the fight's
     * own script) and THE PLAYER'S OWN OVERLAP (`Pod.as:78-80` — standing in
     * an `"opened"` pod plays `"close"`). Filing it `self` would read as
     * "exactly modellable from its own countdown", which is the one thing it
     * is not: the schedule is the boss's, and the player is inside it.
     *
     * ⚠ `displaces: true` and `damage: 1` are BOTH true and they are not the
     * same event — the displacement is ungated and per-tick, the damage is
     * behind `Player.hit`'s own `hitsTimer` AND behind `Bot.noDamage`. The
     * avoid volume lives on `levelWorld.ENTITY_CLASSES.pod.hazard`, which is
     * the oel cell exactly.
     */
    pod: {
        ctor: { dx: 8, dy: 8, src: 'Pod.as:24 `super(_x + Tile.w/2, _y + Tile.h/2)`' },
        as3: 'Pod', timing: 'boss-script', damage: 1, displaces: true,
        src: 'Scenery/Pod.as:24-45,60-80 + Enemies/FinalBoss.as:150,172,179',
        why: '⛔ the pin SURVIVES `noDamage` and the damage does not — `p.x = x; '
            + 'p.y = y; p.v.x = p.v.y = 0` sits ABOVE `p.hit(null, 0, null, 1)` and is '
            + 'ungated, so a pinned player cannot walk out at any `noDamage` setting. '
            + 'L112 places FOUR, and the boss opens and closes them on its own '
            + 'schedule; standing in an OPEN one CLOSES it, so the player is their own '
            + 'trigger and the volume is live on a fresh boot.',
    },
    pull: {
        ctor: { dx: 0, dy: 0, src: 'Pull `super(_x, _y)`' },
        as3: 'Pull', timing: 'self', damage: 0, displaces: true,
        src: 'levelWorld ENTITY_CLASSES (priced as a proximity hazard since R1)',
        why: 'adds force every tick to anything overlapping. Routed around '
            + 'since R1; unchanged at R5.',
    },
});

/** `Enemy.hitsTimerMax` — the i-frame window a hit buys (`Enemy.as:24`). */
export const ENEMY_IFRAMES = 30;

/**
 * The floor on the gap between two attack presses.
 *
 * ⚠ Not an i-frame number. `Player.useItem` turns a SECOND press inside
 * `slashTimer` (20) into a DASH — `knockback(2, Point(x - v.x, y - v.y))`,
 * an impulse along the current velocity that MOVES the player. R3 spaced
 * its ceremony presses eight apart precisely because they must land inside
 * that window; a kill schedule needs the opposite, so 21 is the floor.
 */
export const KILL_CADENCE_FLOOR = 21;

/**
 * How many presses a kill costs at the run's current sword.
 *
 * `Player.swordDamage` is `hasDarkSword ? 2 : 1`, so every bill after the
 * Witch halves — which is why the itinerary banks `darksword` before D7 and
 * D8 (§3.5). `Math.ceil` because `hits >= hitsMax` is the test and `hits`
 * is a `Number` that lands ON the boundary.
 */
export function pressesFor(row, { hasDarkSword = false } = {}) {
    if (!row?.kill || row.kill.hits == null) return null;
    return Math.ceil(row.kill.hits / (hasDarkSword ? 2 : 1));
}

/** Is this tag's class summed by `Game.totalEnemies()`? */
export function isCounted(tag) {
    const row = ENEMY_CLASSES[tag];
    return row ? TOTAL_ENEMIES_CLASSES.includes(row.as3) : false;
}

/**
 * The aggro disc a routing planner must not cross without a declared
 * encounter verdict (§3.2's wake rule).
 *
 * A chaser that is never approached never moves, so the disc is the whole
 * model for one — but the disc is a REFUSAL, not a warning: a woken
 * enemy's displacement is permanent for the visit, so an undeclared
 * crossing is a route that silently changed.
 *
 * `margin` is the player's own half-box plus the enemy's, because
 * `FP.distance` is centre-to-centre and the gate is on the CENTRES.
 */
export function aggroDisc(tag, x, y, { margin = 8 } = {}) {
    const row = ENEMY_CLASSES[tag];
    if (!row) return null;
    const r = typeof row.aggro?.range === 'number' ? row.aggro.range : null;
    if (r === null) return null;
    return { x, y, r: r + margin, kind: row.aggro.kind, tag };
}

/**
 * Every combat-relevant instance in one level record, per instance.
 *
 * "L40 has enemies" is not a claim (§5); this returns the rows a claim is
 * made of. `unclassified` is returned rather than thrown here because the
 * INSTRUMENT wants the whole list; slice 2's `combat` role is what turns
 * an unclassified tag into a build failure.
 *
 * ⛔⛔ **THE PLACEMENT TABLE IS THIS MODULE'S, AND THE FIRST VERSION OF IT
 * WAS WRONG — THE LIVE GAME CAUGHT IT.**
 *
 * An enemy's `x`/`y` — the coordinates `FP.distance`, `getState` and every
 * aggro test read — are the CONSTRUCTOR's, not the `.oel` file's. Slice 2
 * shipped this function taking an INJECTED `placementOf`, on the reasoning
 * that `levelWorld.ENTITY_CLASSES` already carries `dx`/`dy` and a second
 * transcription would be a second thing to get wrong. Both halves of that
 * reasoning were false:
 *
 * 1. **`ENTITY_CLASSES` only carries `dx`/`dy` for entries that answer the
 *    BLOCKING role.** Seventeen of the thirty-two combat tags are
 *    `notSolid(...)`/`cheapOnly(...)` entries written to say "this does not
 *    block", which never needed a constructed position — so they have none,
 *    and the injected lookup returned `{dx: 0, dy: 0}` for `bob`,
 *    `sandtrap`, `darktrap`, `turret`, `jellyfish` and twelve others. Every
 *    one of them is `+8/+8`. The whole census was eight pixels up and left.
 * 2. **Where it DOES carry one, it can be answering a different question.**
 *    `tentaclebeast`'s `dx/dy` is `1/2` — the MASK's top-left, per §8.2's
 *    own note — while the entity is at `+24/+24`.
 *
 * The live contact-control pair is what found it: the model predicted the
 * boxes meeting at t44 and the GAME hit at t49, and the five ticks are the
 * eight pixels. So the ctor offset is transcribed HERE, per class, from each
 * class's own constructor chain — including the chains where the offset is
 * the PARENT's (`Bulb`, `LavaRunner`, `Flyer` via `Bob`; `DarkTrap` via
 * `SandTrap`), which is the ladder's second transcription lesson exactly.
 *
 * `placementOf` survives as an optional CROSS-CHECK: pass one and a
 * disagreement is a throw, not a silent preference. Where the two tables
 * were written for the same question they must agree; where they were not
 * (the pixelmask entries) the caller does not pass one.
 *
 * @param {object}    levelRecord
 * @param {Function=} opts.placementOf `(tag) => {dx, dy}` — cross-check only
 */
export function combatCensus(levelRecord, { placementOf = null } = {}) {
    const enemies = [];
    const hazards = [];
    const unclassified = [];
    const place = (e, row) => {
        const c = row.ctor;
        if (!c || !Number.isFinite(c.dx) || !Number.isFinite(c.dy)) {
            throw new Error(`combatCensus: "${e.type}" has no \`ctor\` offset. Read its `
                + 'constructor CHAIN — the offset is often the parent\'s — and add '
                + '{dx, dy, src} to its row. A missing offset must never default to 0: '
                + 'that is exactly the defect the live contact-control pair caught.');
        }
        if (placementOf) {
            const p = placementOf(e.type);
            if (p && Number.isFinite(p.dx) && (p.dx !== c.dx || p.dy !== c.dy)) {
                throw new Error(`combatCensus: "${e.type}" placement disagreement — the `
                    + `combat row says (${c.dx},${c.dy}) from ${c.src}, the injected table `
                    + `says (${p.dx},${p.dy}). One of the two transcriptions is wrong, or `
                    + 'they are answering different questions (a pixelmask entry\'s dx/dy '
                    + 'is the MASK\'s top-left, not the entity\'s position).');
            }
        }
        return { cx: e.x + c.dx, cy: e.y + c.dy };
    };
    for (const e of levelRecord.entities ?? []) {
        if (ENEMY_CLASSES[e.type]) {
            const row = ENEMY_CLASSES[e.type];
            enemies.push({
                tag: e.type, x: e.x, y: e.y, ...place(e, row), attrs: e.attrs ?? {},
                as3: row.as3, counted: isCounted(e.type), row,
            });
        } else if (PUZZLEMENT_HAZARDS[e.type]) {
            hazards.push({
                tag: e.type, x: e.x, y: e.y, ...place(e, PUZZLEMENT_HAZARDS[e.type]),
                attrs: e.attrs ?? {},
                as3: PUZZLEMENT_HAZARDS[e.type].as3,
                timing: PUZZLEMENT_HAZARDS[e.type].timing,
                row: PUZZLEMENT_HAZARDS[e.type],
            });
        } else if (LOOKS_LIKE_COMBAT.has(e.type)) {
            unclassified.push(e.type);
        }
    }
    return { level: levelRecord.level, enemies, hazards, unclassified };
}

/**
 * Tags that LOOK like combat and must therefore be classified or reported.
 *
 * Deliberately a denylist of the extract's own enemy/hazard tags rather
 * than "everything not in ENTITY_CLASSES": the census's job is to make a
 * MISSING combat row loud, and every other tag already answers to
 * `levelWorld`'s four roles.
 */
export const LOOKS_LIKE_COMBAT = new Set([
    ...Object.keys(ENEMY_CLASSES), ...Object.keys(PUZZLEMENT_HAZARDS),
]);

/** `Lock`'s kill-lock discriminator: `tSet == -1` (`Lock.as:109-115`). */
export const KILL_LOCK_TSET = -1;

/**
 * The classes that inherit `Lock.update`'s kill arm.
 *
 * `WandLock` and `GrassLock` call `super.update()`; `RockLock` re-states
 * the same test (`RockLock.as:52`). `ShieldLock` does NOT call
 * `super.update()` at all, and `BossLock`/`MagicalLock` never had it — so a
 * `tset="-1"` on one of those three is not a kill lock.
 */
export const KILL_LOCK_TAGS = Object.freeze(['lock', 'wandlock', 'rocklock', 'grasslock']);

/**
 * The kill locks in one level, with the bill they open on.
 *
 * ⚠ A MISSING `tset` ATTRIBUTE IS GROUP 0, NEVER −1 — `int("")` is 0 and
 * that is the R2 lesson, still armed. `tSetOf` in `levelWorld` is the
 * shipped resolver and carries the forced-ctor values; this reads the raw
 * attribute the same way for the four tags above, none of which forces one.
 */
export function killLocksIn(levelRecord, { placementOf } = {}) {
    const bill = combatCensus(levelRecord, { placementOf }).enemies.filter((r) => r.counted);
    const locks = [];
    for (const e of levelRecord.entities ?? []) {
        if (!KILL_LOCK_TAGS.includes(e.type)) continue;
        const raw = e.attrs?.tset;
        const tSet = raw === undefined ? 0 : (Number.parseInt(raw, 10) || 0);
        if (tSet !== KILL_LOCK_TSET) continue;
        locks.push({
            tag: e.type, x: e.x, y: e.y,
            flag: e.attrs?.tag === undefined ? -1 : Number.parseInt(e.attrs.tag, 10),
            bill,
        });
    }
    return locks;
}

/**
 * How this instance can be cleared, or why it cannot.
 *
 * Two arms, and the second one is the finding: an enemy standing on — or
 * pushed/lured onto — water, lava or a pit clears itself through
 * `Enemy.update`'s own terrain switch, which reads the RAW tile type and so
 * is live even under a tape that coerces the hazard for the PLAYER.
 */
export function clearabilityOf(instanceRow, { rawTileType = null } = {}) {
    const { row } = instanceRow;
    const ways = [];
    if (row.kill && row.kill.hits != null) {
        ways.push({ how: 'kill', presses: row.kill.hits, note: row.kill.why ?? null });
    }
    if (rawTileType === 1 && row.terrain.water.startsWith('dies')) {
        ways.push({ how: 'stands-on-water', note: row.terrain.water });
    }
    if (rawTileType === 17 && row.terrain.lava.startsWith('dies')) {
        ways.push({ how: 'stands-on-lava', note: row.terrain.lava });
    }
    if (rawTileType === 6 && row.terrain.pit.startsWith('falls')) {
        ways.push({ how: 'stands-on-pit', note: row.terrain.pit });
    }
    if (row.as3 === 'Grenade') {
        ways.push({ how: 'self-destruct', note: 'arm it from 32 px and stand clear of the 20 px blast' });
    }
    return { ways, clearable: ways.length > 0 };
}

/**
 * The two tables partition the `Enemies/` directory — checked, not claimed.
 *
 * @param {string[]} directoryClasses every `Enemies/*.as` class name
 */
export function assertTotalEnemiesTable(directoryClasses) {
    const findings = [];
    const summed = new Set(TOTAL_ENEMIES_CLASSES);
    const omitted = new Set(Object.keys(TOTAL_ENEMIES_OMISSIONS));
    for (const c of directoryClasses) {
        if (c === 'Enemy') continue; // the base class is BOTH: summed, never placed
        if (summed.has(c) === omitted.has(c)) {
            findings.push(summed.has(c)
                ? `${c} is in BOTH the sum and the omissions`
                : `${c} is in NEITHER the sum nor the omissions — classify it`);
        }
    }
    for (const c of omitted) {
        if (!directoryClasses.includes(c)) {
            findings.push(`${c} is listed as an omission but is not a class in Enemies/`);
        }
    }
    return findings;
}

/**
 * The classes the call-site census finds dangerous that neither table
 * carries a row for — each with the reason, and each a claim.
 *
 * ⚠ This is the half of `assertDamageFamilyCovered` that can go wrong
 * QUIETLY, so it is data with citations rather than a filter. Three shapes:
 *
 *   `base`       the inherited site every row already prices (`Enemy`).
 *   `projectile` a thing a placed class SPAWNS; the volume belongs to the
 *                spawner's row, which is where a router can see it.
 *   `unplaced`   nothing in the extract constructs it on R5's map.
 */
export const DAMAGE_FAMILY_EXCLUSIONS = Object.freeze({
    Enemy: { kind: 'base', why: '`Enemy.hitPlayer` (Enemy.as:210-220) is THE contact-damage '
        + 'site every subclass inherits — it is what each row\'s `damage` field prices. '
        + 'Listing it as its own row would be listing the mechanism as an instance.' },

    Arrow: { kind: 'projectile', of: 'arrowtrap', why: 'Arrow.as:49 — 3 per 10 frames, '
        + 'downward at speed 5, damage 1. Priced on the arrowtrap\'s own volume.' },
    TurretSpit: { kind: 'projectile', of: 'turret', why: 'TurretSpit.as:53 — the turret\'s '
        + '64 px range is what decides whether one is ever fired.' },
    IceTurretBlast: { kind: 'projectile', of: 'iceturret', why: 'IceTurretBlast.as:53 — and '
        + 'its `freeze(15)` is OUTSIDE `noDamage`, which the iceturret row carries.' },
    Explosion: { kind: 'projectile', of: 'grenade/bombpusher/wand', why: 'Explosion.as:60 — '
        + 'the grenade blast (r 20), the bombpusher\'s Bomb, and a WAND kill\'s own '
        + 'explosion, which is why §5 forbids wand kills near self.' },
    LavaBall: { kind: 'projectile', of: 'lavaboss', why: 'LavaBall.as:69 — LavaBoss is R6\'s '
        + 'and uncounted; the ball exists only while it is alive.' },
    BossTotemShot: { kind: 'projectile', of: 'bosstotem', why: 'BossTotemShot.as:56 — the '
        + 'straight-down pairs of the fight §2.6.4 rules AVOID.' },

    RockFall: { kind: 'unplaced', why: '⚠⚠ NOT `FallRock`, and NOT placeable: the only two '
        + 'construction sites are `FinalBoss.as:144,216`, so it is R6\'s. Recorded here '
        + 'because it is the ONE gameplay-RNG damage volume in the game — '
        + '`sprRockFall.scale = Math.random()/2 + 0.25` feeds `setHitbox` two lines later '
        + '(RockFall.as:33,37), so the rect is 8x4..24x12 by a draw, and `Game.shake += '
        + 'scale + 1` on landing moves the camera by a draw too. §2.1\'s "no gameplay RNG '
        + 'in R5\'s scope" is TRUE, and this is the named reason it is true.' },
    // ⛓⛓ R6 SLICE 6b: `Pod`'s exclusion is DELETED, not amended. It said
    // `kind: 'unplaced'` — L112 places four — and the row that replaces it is
    // `PUZZLEMENT_HAZARDS.pod`. It is deleted in the SAME CHANGE as the row
    // because `assertDamageFamilyCovered` used to test `covered.has(cls)`
    // BEFORE the exclusions, so a class in both tables passed silently and
    // the stale claim would have survived for ever. See the mutual-exclusion
    // finding below. → [[feedback_two_tables_one_class_is_a_silence]]
    Tentacle: { kind: 'unplaced', why: 'spawned only by `TentacleBeast.as:188`, whose own '
        + 'spawn positions are `Math.random()`-placed (TentacleBeast.as:138-139,167-168) — '
        + 'the R6 encounter §3.6 banks the RNG-pinning question for.' },
});

/**
 * The two tables cover every class that can reach the player — checked
 * against a derivation that knows nothing about them.
 *
 * ⚠⚠ THE §14 LESSON IN ITS SLICE-2 COSTUME. `ENEMY_CLASSES` and
 * `PUZZLEMENT_HAZARDS` were written by reading the classes somebody already
 * believed were dangerous. A mutation table over those tables would agree
 * with any class they BOTH forgot, because fixture and check share the
 * derivation. `seedlingDamageSites.HARMFUL_CLASSES` is the second stratum:
 * a grep over the checkout for `hit`/`drown`/`die` on a `Player`-typed
 * receiver, which has no notion of "enemy" at all.
 *
 * @param {string[]} harmfulClasses `seedlingDamageSites.HARMFUL_CLASSES`
 * @returns {string[]} findings; empty means the families are covered
 */
export function assertDamageFamilyCovered(harmfulClasses) {
    return assertDamageFamilyCoveredWith(harmfulClasses, DAMAGE_FAMILY_EXCLUSIONS);
}

/**
 * The same check with the exclusions table INJECTED.
 *
 * ⛓ R6 SLICE 6b. The mutual-exclusion arm below cannot be exercised against
 * the shipped tables — that is the point of fixing it — so the table is a
 * parameter and the test feeds it a class that carries both a row and an
 * exclusion. Same seam `combatCensus` already uses for the placement table,
 * and for the same reason: a partition's violation has to be constructible.
 *
 * @param {string[]} harmfulClasses `seedlingDamageSites.HARMFUL_CLASSES`
 * @param {object} exclusions a `DAMAGE_FAMILY_EXCLUSIONS`-shaped table
 * @returns {string[]} findings; empty means the families are covered
 */
export function assertDamageFamilyCoveredWith(harmfulClasses, exclusions) {
    const findings = [];
    const covered = new Set([
        ...Object.values(ENEMY_CLASSES).map((r) => r.as3),
        ...Object.values(PUZZLEMENT_HAZARDS).map((r) => r.as3),
    ]);
    // ⛔⛔ R6 SLICE 6b — TRAP 94, FIXED IN THE SAME CHANGE AS THE `Pod` ROW.
    //
    // The two tables are a PARTITION and nothing said so. The loop below
    // `continue`d on `covered.has(cls)` BEFORE it looked at the exclusions,
    // so a class carrying a real row AND a stale exclusion passed both
    // checks and printed nothing: adding `PUZZLEMENT_HAZARDS.pod` while
    // `DAMAGE_FAMILY_EXCLUSIONS.Pod` still claimed `kind: 'unplaced'` would
    // have left that falsehood unreachable for ever. The reverse check that
    // already existed guards an exclusion's PRESENCE in the census, not its
    // consistency with the rows.
    //
    // ⚠ This runs over the tables themselves rather than over
    // `harmfulClasses`, deliberately: a class in both tables is a defect
    // whether or not the call-site census still finds it dangerous, and
    // routing it through the census would make the finding depend on the
    // very thing the exclusion is a claim about.
    for (const cls of Object.keys(exclusions)) {
        if (!covered.has(cls)) continue;
        findings.push(`${cls} is BOTH a row (ENEMY_CLASSES/PUZZLEMENT_HAZARDS) and a `
            + `DAMAGE_FAMILY_EXCLUSIONS entry ("${exclusions[cls].kind}") `
            + '— the two tables are a partition. The row is the live claim; delete the '
            + 'exclusion, whose reason is now stale by construction');
    }
    for (const cls of harmfulClasses ?? []) {
        if (covered.has(cls)) continue;
        if (exclusions[cls]) continue;
        findings.push(`${cls} reaches the player (seedlingDamageSites) but has no row in `
            + 'ENEMY_CLASSES or PUZZLEMENT_HAZARDS and no entry in '
            + 'DAMAGE_FAMILY_EXCLUSIONS — classify it, or declare why it cannot fire');
    }
    // The other direction: an exclusion for something that is NOT dangerous
    // is a stale claim, and stale claims are how a census rots.
    const harmful = new Set(harmfulClasses ?? []);
    for (const cls of Object.keys(exclusions)) {
        if (!harmful.has(cls)) {
            findings.push(`${cls} is declared a damage-family exclusion but the call-site `
                + 'census does not find it reaching the player — the checkout moved');
        }
    }
    return findings;
}

/**
 * The per-tick displacement BOUND for one instance, for a contact-freedom
 * proof.
 *
 * Deliberately the class's whole `moveSpeed` rather than its observed step
 * (`moveSpeed - f`, because `friction()` runs before `moveX/moveY`): an
 * envelope has to dominate, and a bound that is loose by a quarter pixel per
 * tick is cheap. Returns 0 for anything static — a turret's threat is its
 * PROJECTILE and lives on its own row.
 *
 * ⚠ It is a bound only while the instance has NOT been hit. `Enemy.hit`
 * applies knockback force, and a knocked enemy's `v.length > moveSpeed` puts
 * its own chase code on the `pushed` branch, which does not re-normalize. So
 * this is sound for an avoid crossing and must not be used to price the
 * ticks after a press lands.
 */
export function stepBoundFor(tag) {
    const row = ENEMY_CLASSES[tag];
    // ⚠ NOT 0. An unknown tag is not a thing that cannot move, it is a thing
    // nobody priced, and `0` would let an envelope prove contact-freedom
    // against a hazard it has never heard of.
    if (!row) return null;
    // ⛔ A BOSS HAS NO BOUND, and `0` would be the worst possible answer —
    // it reads as "static" and would let an envelope declare a boss arena
    // contact-free. `null` is "no envelope; this one is an ENCOUNTER SCRIPT",
    // and `chaseEnvelope` refuses it by name.
    if (row.boss) return null;
    return Number.isFinite(row.speed) ? row.speed : null;
}

/**
 * No kill lock may share a level with a counted-but-unclearable instance.
 *
 * The one combination that seals a lock forever is `counted && !killable &&
 * no terrain death` — `DarkTrap` is exactly that, and `BombPusher` would be
 * if it were counted. Ten locks, zero such instances today; this is what
 * keeps that a checked fact.
 */
export function assertNoUnclearableKillLock(levelRecord, { placementOf } = {}) {
    const locks = killLocksIn(levelRecord, { placementOf });
    if (locks.length === 0) return [];
    const findings = [];
    for (const inst of combatCensus(levelRecord, { placementOf }).enemies) {
        if (!inst.counted) continue;
        const { clearable } = clearabilityOf(inst);
        if (!clearable) {
            findings.push(`L${levelRecord.level}: ${inst.tag}@${inst.x},${inst.y} is `
                + `COUNTED and has no clearing arm — every kill lock in this level is sealed`);
        }
    }
    return findings;
}

// ── ⛓⛓⛓ R6 SLICE 3: THE CONTACT SOURCE ───────────────────────────────

/**
 * `Enemy.hitPlayer()`, transcribed (`Enemies/Enemy.as:211-221`).
 *
 * ```
 *   if (!destroy && (!(graphic is Spritemap) || currentAnim != "die") && hitsTimer <= 0)
 *   {
 *       var p:Player = collide("Player", x, y) as Player;
 *       if (p) p.hit(this, 3, new Point(x, y), damage);
 *   }
 * ```
 *
 * ⛔ THE GATE IS THE **ENEMY's** i-FRAME TIMER, NOT THE PLAYER's. So every
 * landed sword press buys 30 ticks of contact safety from that body as well
 * as blocking the next press — and against the totem (whose `hitsTimerMax`
 * is 20) each landed wand shot buys 20. §8.9's second half, and the reason
 * the fight's stance owes clearance from the BODY and not only the laser.
 *
 * ⛔ AND IT RUNS INSIDE `Enemy.update`, WHICH IS BEHIND `onScreen()` AT ZERO
 * MARGIN. An off-screen body cannot damage — `camera.js`'s header, from the
 * other side — so the caller must supply the verdict rather than assume it,
 * and a band that answers `uncertain` is a stance the window has to move.
 *
 * ⚠ `f` IS THE BASE CLASS's 3, NOT A FIELD. `Puncher`, `Spinner` and
 * `BossTotem` pass their own force from their own overrides; this function
 * is `Enemy`'s, which is what a plain body contact costs.
 *
 * @param {object} enemy `{hitsTimer, destroy, dieAnim}` — the body's own state
 * @param {'on'|'off'|'uncertain'} onScreenVerdict from `camera.onScreen*`
 * @returns {{fires:boolean, refusedAt:string|null}}
 */
export function enemyHitPlayerFires(enemy, onScreenVerdict) {
    if (onScreenVerdict === 'uncertain') {
        return { fires: false, refusedAt: 'onScreen:uncertain' };
    }
    if (onScreenVerdict !== 'on') return { fires: false, refusedAt: 'offScreen' };
    if (enemy.destroy) return { fires: false, refusedAt: 'destroy' };
    if (enemy.dieAnim) return { fires: false, refusedAt: 'die anim' };
    if ((enemy.hitsTimer ?? 0) > 0) return { fires: false, refusedAt: 'enemy hitsTimer' };
    return { fires: true, refusedAt: null };
}

/**
 * Which census bodies this rung can price a CONTACT for, and which it
 * refuses by name.
 *
 * ⛔⛔ THE SPLIT IS "DOES THE RUN STEP ITS POSITION", NOT "IS IT DANGEROUS".
 * A contact is `collide("Player", x, y)` at the body's CURRENT position, so
 * a body the model does not move is a body whose contact test the model
 * cannot evaluate — and the honest answer for one of those is a refusal,
 * not a rect from the `.oel`.
 *
 * Three groups:
 *
 *   · `static`  — `speed === 0` and `aggro.kind === 'static'`: the body is
 *                 where `loadlevel` put it forever. `Mobile.mobileUpdate`
 *                 still runs, but `v` is never written, so `moveX(0)`
 *                 moves nothing. These are priced.
 *   · `stepped` — families the run DOES step (`Spinner`, `IceTurret`) but
 *                 whose own `hitPlayer` override this slice has not wired.
 *                 Refused by name, so a tape that walks into one is a named
 *                 failure rather than a silent zero.
 *   · `mover`   — everything else: its position is an encounter script.
 *
 * ⚠ `boss` rows fall in `mover` by construction (`stepBoundFor` returns
 * null for them), which is what keeps the totem out of this arm until
 * slice 4 wires its own.
 */
export const CONTACT_STEPPED_FAMILIES = Object.freeze(['spinner', 'iceturret', 'bob']);

/**
 * ⛓⛓⛓ R8 SLICE 1 — WHICH `stepped` FAMILIES PRICE THEIR OWN CONTACT, AND
 * WHERE. A `stepped` verdict is not one answer, it is two.
 *
 * `stepContactsNow`'s census scan cannot price a body it does not place, and
 * for a family the run DOES step the census rect is the `.oel` placement —
 * stale from the room's second tick. There are exactly two honest responses
 * to that, and they are opposite:
 *
 *   · **priced in its own step** — the stepper calls `applyPlayerHit` at the
 *     body's LIVE position, so the census scan must SKIP it or the contact is
 *     billed twice, once from a place the body has left. This is what a
 *     `boss` row already does; `bob` joins it.
 *   · **not wired** — nobody prices it anywhere, so the census scan THROWS by
 *     name and a tape that walks into one is a named failure rather than a
 *     silent zero.
 *
 * ⛔ THE DIFFERENCE IS A SKIP VERSUS A THROW, so it cannot be left to a reader
 * of the word "stepped". `contactPricing` returns `pricedBy`, and a `null`
 * there is the refusal.
 *
 * ⚠ THE VALUES ARE FUNCTION NAMES IN `levelRun`, on purpose: a row that says
 * "somewhere" is not checkable, and `levelRun.test.js` greps for them.
 */
export const CONTACT_STEPPED_PRICED_BY = Object.freeze({
    /**
     * ⛓⛓⛓ R8 SLICE 6 — AND THIS PRICER **REFUSED** RATHER THAN BILLING,
     * which is a third answer the field can carry and is still a pricer.
     *
     * The census scan's partition is between "priced somewhere" (SKIP — the
     * body is billed at its LIVE position) and "priced nowhere" (THROW at the
     * placement). A spinner was in the second half, and the throw it produced
     * was about a CELL THE BODY LEFT ON TICK ONE: the census rect is the
     * `.oel` placement and a spinner is a billiard.
     *
     * ⛓⛓⛓ R8 SLICE 8 — AND NOW IT BILLS, ON BOTH ARMS. The refusal rested on
     * *"`hammerAngle` rides on `Game.time`, which this model does not carry"*;
     * `gameClock` carries it, so `levelRun.stepSpinnerContactsNow` runs the
     * game's own two tests at the live position — `hitPlayer`'s 7x7 body at
     * force 3 and the 13 px `collideLine` at force 4 — through the one
     * `applyPlayerHit` funnel. ⛔ The refusal SURVIVES as the fallback arm for
     * a tape whose boot cannot declare the clock (`run.gameTimeRefusal` names
     * which), and there it is still the union over all 45 phases: a refusal at
     * the right place beats a bill at the wrong one, and both beat a silent
     * zero.
     */
    spinner: 'stepSpinnerContactsNow',
    iceturret: null,
    bob: 'stepChasersNow',
});

/**
 * Why each `stepped` family answers the way it does — one reason per class,
 * for `CONTACT_BOSS_WHY`'s reason: the answers are not interchangeable.
 */
export const CONTACT_STEPPED_WHY = Object.freeze({
    spinner: '⛓ R8 SLICE 8: Spinner has its own stepped state, `spinnerRects` is in the '
        + 'block sweep, and BOTH its damage arms are billed at the live position by '
        + '`stepSpinnerContactsNow` — `Enemy.hitPlayer`\'s 7x7 body at force 3 and '
        + '`Spinner.update`\'s 13 px `collideLine` at force 4, whose phase is '
        + '`(Game.time % 45)/45·2π` and which `gameClock` now counts exactly. ⛔ Where '
        + 'the clock cannot run (no `pins: ["dead_frames"]`, or a `cutscene[0]` boot) the '
        + 'slice-6 REFUSAL stands in: the union over all 45 phases, the 13 px disc. The '
        + 'census scan skips the placement, which is a cell the body leaves on tick one.',
    iceturret: 'IceTurret is stepped (and its corpse glides), and nothing prices its '
        + 'contact either — its threat on this rung is the BLAST, which has its own arm.',
    bob: '⛓ R8 SLICE 1: `chasers.chaserStep` walks the body every tick and '
        + '`stepChasersNow` calls `applyPlayerHit` from `Enemy.update`\'s own tail, at the '
        + 'position THIS tick left. The census rect is the `.oel` placement and a chaser '
        + 'leaves it on the first tick the player is inside `runRange` 80 — so the census '
        + 'scan must skip the body, exactly as it skips a boss, or the same contact is '
        + 'billed twice from two different places.',
});

/**
 * ⛓⛓⛓ R6 SLICE 4: THE BODIES THIS RUNG STEPS *AND* PRICES.
 *
 * `bosstotem` leaves the `mover` arm here. `levelRun` now runs its whole
 * `update()` — `moveY` included — so "the model does not compute this
 * body's position" stopped being true, which was the ONLY reason a boss was
 * refused. What replaces the refusal is not the static arm either: the boss
 * is priced by its OWN `hitPlayer`, in the boss's own step, because its
 * gate is a `collidable` flag and a 20-tick `hitsTimer` that no census row
 * can see.
 *
 * ⚠ SO `stepContactsNow` MUST STILL SKIP IT. The census scan would price
 * the body a second time, from a `.oel` placement 140 px above where the
 * descent has taken it. `kind: 'boss'` is what tells it to.
 */
export const CONTACT_BOSS_FAMILIES = Object.freeze(['bosstotem', 'shieldboss', 'finalboss']);

/**
 * ⛓⛓⛓ R8 SLICE 1 — THE ENEMY CLASSES WHOSE RUNTIME `type` IS NOT A CONSTANT.
 *
 * A chaser's `solids` carries `"Enemy"` (`Bob.as:39`), so "does that body
 * block this one" is a question about the body's runtime `type` — and for
 * three classes the answer changes DURING the visit:
 *
 * ```
 *   IceTurret.as:94    type = "Solid"   inside the corpse arm
 *   FinalBoss.as:233   type = "Solid"
 *   BossTotem.as:296   type = "Enemy"   ⎫ the woken/unwoken flip, both ways
 *   BossTotem.as:315   type = "Solid"   ⎭
 * ```
 *
 * ⚠ NOT THE SAME LIST AS THE CTOR OVERRIDES. `BombPusher`, `LavaBoss`,
 * `ShieldBoss` and `TentacleBeast` also assign a non-`"Enemy"` type — but
 * they do it ONCE, in the constructor, so the census can carry the answer.
 * These three cannot be carried; a consumer that needs the answer refuses the
 * room by name (`levelRun.assertChaserSolidsBound`). Trap 64's shape from the
 * other end: an unwoken boss is a WALL and a woken one is not, and only one
 * of those readings was ever written down.
 */
export const TYPE_REWRITING_ENEMIES = Object.freeze(['IceTurret', 'FinalBoss', 'BossTotem']);

/**
 * Why each boss family leaves the census arm, one reason per class — and
 * ⛔ THE TWO REASONS ARE DIFFERENT, which is why this is a table and not a
 * sentence with a class name interpolated into it.
 *
 * The totem's census rect is right at spawn and WRONG for the whole fight;
 * the Shieldspire never moves a pixel, so his census rect is right for ever
 * — and pricing it would still be wrong, because his contact volume is not
 * his hitbox at all.
 */
export const CONTACT_BOSS_WHY = Object.freeze({
    bosstotem: '80x32 at force 3, gated on `collidable` and a 20-tick `hitsTimer`. '
        + 'The census rect is its SPAWN box and the descent has moved it 140 px south — '
        + 'pricing it here would be a second, wrong contact.',
    // ⛓⛓⛓ R6 SLICE 5, and it is the sharper case of the two.
    shieldboss: '⛔ HIS CONTACT VOLUME IS NOT HIS HITBOX. `ShieldBoss.hitPlayer` is a '
        + 'full override that collides its OWN rect — `(x-24, y+24, 48, Tile.h)`, the '
        + '48x16 strip BELOW the body — and damages only on `sprShieldBoss.frame` 5..8, '
        + 'i.e. six ticks of one stab animation. He never moves, so the census rect is '
        + 'accurate for ever and pricing it would STILL be wrong: it would charge a '
        + 'contact for the 48x48 wall the player cannot even touch, and miss the strip '
        + 'the whole fight is fought in.',
    /**
     * ⛓⛓⛓ R6 SLICE 6f, and it is the THIRD distinct reason — the volume is
     * right and the POSITION is a fight.
     *
     * The Owl takes `Enemy.hitPlayer` UNCHANGED: `collide("Player", x, y)`
     * against his own 12x12 hitbox, `p.hit(this, 3, new Point(x, y), 1)`,
     * gated on `hitsTimer <= 0` and `currentAnim != "die"`. So unlike the
     * Shieldspire the census hitbox IS the contact volume — and unlike the
     * totem the body is not merely displaced once, it walks a pod circuit and
     * is shoved 50 px at a time by the player's own sword. Pricing the
     * placement box would charge a contact at (72,104) for a body that has
     * been somewhere else since the room's second tick.
     *
     * ⛔ AND THE `hitsTimer` GATE IS LOAD-BEARING HERE IN A WAY IT IS NOWHERE
     * ELSE: the lava self-hit sets it to 30, so for the 30 ticks after each
     * kill-hit the boss cannot damage the player at all. A stance that
     * survives the shove is standing inside a 30-tick amnesty it earned by
     * landing the shove.
     */
    finalboss: '⛓ THE CENSUS HITBOX IS RIGHT AND THE POSITION IS NOT. `Enemy.hitPlayer` '
        + 'is inherited unchanged — the 12x12 box at force 3, damage 1, gated on '
        + '`hitsTimer <= 0` and `currentAnim != "die"` — but he walks a four-pod circuit '
        + 'and the player shoves him 50 px at a time, so the placement rect is stale from '
        + 'the room\'s second tick. `activeOffScreen = true`, so there is no `onScreen` '
        + 'question for him at all: the one boss the shake band cannot make inactive.',
});

export function contactPricing(tag) {
    const row = ENEMY_CLASSES[tag];
    if (!row) return { kind: 'unknown', why: `"${tag}" has no combat row` };
    if (CONTACT_BOSS_FAMILIES.includes(tag)) {
        return {
            kind: 'boss',
            why: `${row.as3} is stepped by \`levelRun\` and prices its own \`hitPlayer\` `
                + `override in its own step. ${CONTACT_BOSS_WHY[tag]}`,
        };
    }
    if (CONTACT_STEPPED_FAMILIES.includes(tag)) {
        return {
            kind: 'stepped',
            // ⛔ `pricedBy` IS THE LOAD-BEARING FIELD, not `kind`: a `stepped`
            // family with a pricer is SKIPPED by the census scan and one
            // without is a THROW. See `CONTACT_STEPPED_PRICED_BY`.
            pricedBy: CONTACT_STEPPED_PRICED_BY[tag] ?? null,
            why: CONTACT_STEPPED_WHY[tag],
        };
    }
    if (row.speed === 0 && row.aggro?.kind === 'static' && !row.boss) {
        return { kind: 'static', why: `${row.as3} never writes \`v\`` };
    }
    return {
        kind: 'mover',
        why: `${row.as3}'s position is an encounter script (speed ${row.speed}, aggro `
            + `${row.aggro?.kind ?? 'none'}), and a contact tests the body where it IS`,
    };
}

/** The contact rect of one census instance — its hitbox at its placement. */
export function contactRect(instance) {
    const box = instance.row?.hitbox;
    if (!box) return null;
    const x = instance.cx - box.ox;
    const y = instance.cy - box.oy;
    return { x, y, right: x + box.w, bottom: y + box.h, w: box.w, h: box.h };
}
