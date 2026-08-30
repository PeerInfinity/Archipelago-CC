/**
 * seedlingDemo/seedlingDamageSites — GENERATED. Do not edit by hand.
 *
 * Every class in the Seedling checkout that calls `hit()`, `drown()` or
 * `die()` on a `Player`, or writes a Player's position — read off the CALL
 * SITES by `scripts/procgen/extract-seedling-damage-sites.mjs`, which knows
 * nothing about which classes anybody thinks are enemies.
 *
 * ⚠⚠ THIS IS THE INDEPENDENT STRATUM FOR THE COMBAT CENSUS. `combat.js`'s
 * two tables were written by reading the classes a human already believed
 * were dangerous; a table-vs-table assertion would agree with the omission
 * that produced it (R4 §14: thirty-two mutations agreed with the bug).
 * `combat.assertDamageFamilyCovered` requires this list and those tables to
 * agree, and every disagreement is a missing row or a declared exclusion.
 *
 * Regenerate + verify:
 *   node scripts/procgen/extract-seedling-damage-sites.mjs --source ~/CC/seedling
 *   node scripts/procgen/extract-seedling-damage-sites.mjs --source ~/CC/seedling --check
 *
 * `net/flashpunk` (the runtime's own move sweep) and `Player.as` (the
 * player's own body — lava, drowning, the fall) are declared exclusions, not
 * quiet ones; see the extractor's header.
 */

/** What each `kind` means. */
export const DAMAGE_SITE_KINDS = Object.freeze({
    hit: "calls Player.hit — the damage family",
    drown: "calls Player.drown() — no hit(), no noDamage guard",
    die: "calls Player.die() — lethal at any hitsMax",
    move: "writes the player's position — displacement, not damage",
});

/** class name → the sites it holds, in file order. */
export const DAMAGE_SITES = Object.freeze({
    Arrow: [
        { kind: 'hit', file: 'Projectiles/Arrow.as', line: 49 },
    ],
    BeamTower: [
        { kind: 'hit', file: 'Puzzlements/BeamTower.as', line: 92 },
    ],
    BobBoss: [
        { kind: 'move', file: 'Enemies/BobBoss.as', line: 219 },
        { kind: 'move', file: 'Enemies/BobBoss.as', line: 220 },
    ],
    BobSoldier: [
        { kind: 'hit', file: 'Enemies/BobSoldier.as', line: 169 },
    ],
    BossTotem: [
        { kind: 'move', file: 'Enemies/BossTotem.as', line: 284 },
        { kind: 'hit', file: 'Enemies/BossTotem.as', line: 486 },
    ],
    BossTotemShot: [
        { kind: 'hit', file: 'Projectiles/BossTotemShot.as', line: 56 },
    ],
    Crusher: [
        { kind: 'hit', file: 'Puzzlements/Crusher.as', line: 98 },
    ],
    Enemy: [
        { kind: 'hit', file: 'Enemies/Enemy.as', line: 218 },
    ],
    Explosion: [
        { kind: 'hit', file: 'Projectiles/Explosion.as', line: 60 },
    ],
    FallRock: [
        { kind: 'move', file: 'Scenery/FallRock.as', line: 59 },
    ],
    FallRockLarge: [
        { kind: 'move', file: 'Scenery/FallRockLarge.as', line: 67 },
    ],
    Flyer: [
        { kind: 'hit', file: 'Enemies/Flyer.as', line: 68 },
    ],
    Game: [
        { kind: 'move', file: 'Game.as', line: 2025 },
        { kind: 'move', file: 'Game.as', line: 2026 },
    ],
    Grenade: [
        { kind: 'hit', file: 'Enemies/Grenade.as', line: 133 },
    ],
    IceTurretBlast: [
        { kind: 'hit', file: 'Projectiles/IceTurretBlast.as', line: 53 },
    ],
    LavaBall: [
        { kind: 'hit', file: 'Projectiles/LavaBall.as', line: 69 },
    ],
    LavaChain: [
        { kind: 'hit', file: 'Puzzlements/LavaChain.as', line: 90 },
    ],
    LavaTrap: [
        { kind: 'move', file: 'Enemies/LavaTrap.as', line: 59 },
        { kind: 'move', file: 'Enemies/LavaTrap.as', line: 60 },
        { kind: 'die', file: 'Enemies/LavaTrap.as', line: 72 },
    ],
    Moonrock: [
        { kind: 'move', file: 'Scenery/Moonrock.as', line: 128 },
    ],
    Pod: [
        { kind: 'move', file: 'Scenery/Pod.as', line: 70 },
        { kind: 'move', file: 'Scenery/Pod.as', line: 71 },
        { kind: 'hit', file: 'Scenery/Pod.as', line: 73 },
    ],
    Pulser: [
        { kind: 'hit', file: 'Puzzlements/Pulser.as', line: 114 },
    ],
    Puncher: [
        { kind: 'hit', file: 'Enemies/Puncher.as', line: 216 },
    ],
    RockFall: [
        { kind: 'hit', file: 'Scenery/RockFall.as', line: 73 },
    ],
    ShieldBoss: [
        { kind: 'hit', file: 'Enemies/ShieldBoss.as', line: 110 },
    ],
    ShieldLock: [
        { kind: 'move', file: 'Puzzlements/ShieldLock.as', line: 35 },
    ],
    Spinner: [
        { kind: 'hit', file: 'Enemies/Spinner.as', line: 75 },
    ],
    SpinningAxe: [
        { kind: 'hit', file: 'Puzzlements/SpinningAxe.as', line: 75 },
    ],
    Tentacle: [
        { kind: 'hit', file: 'Enemies/Tentacle.as', line: 73 },
    ],
    TurretSpit: [
        { kind: 'hit', file: 'Projectiles/TurretSpit.as', line: 53 },
    ],
    Whirlpool: [
        { kind: 'drown', file: 'Puzzlements/Whirlpool.as', line: 81 },
    ],
});

/** Every class with at least one `hit`/`drown`/`die` site — the LETHAL set. */
export const HARMFUL_CLASSES = Object.freeze(
    Object.entries(DAMAGE_SITES)
        .filter(([, sites]) => sites.some((s) => s.kind !== 'move'))
        .map(([cls]) => cls),
);

/** Every class that only DISPLACES the player. */
export const DISPLACING_CLASSES = Object.freeze(
    Object.entries(DAMAGE_SITES)
        .filter(([, sites]) => sites.every((s) => s.kind === 'move'))
        .map(([cls]) => cls),
);
