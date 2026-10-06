/**
 * flashPanel/seedlingEntityColliders — GENERATED. Do not edit by hand.
 *
 * The physics model's hitbox of every entity tag that has one
 * (`seedlingDemo/levelWorld.ENTITY_CLASSES`), as the world rect of a
 * placement at the origin: the rect covers
 * `[x + left, x + left + w) x [y + top, y + top + h)` in pixels. A
 * pixel-mask class carries its mask's bounding box.
 *
 * `seedlingSemantics` reads its footprints from here, so the traversal
 * transcription seals exactly the tiles the game's hitbox covers. It cannot
 * import the model itself: `levelWorld.js` imports `seedlingSemantics.js`
 * at evaluation time, and the edge back would be a cycle.
 *
 * Regenerate + verify:
 *   node scripts/procgen/make-seedling-entity-colliders.mjs
 *   node scripts/procgen/make-seedling-entity-colliders.mjs --check
 */

export const ENTITY_COLLIDERS = Object.freeze({
    adnanchar: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 8, src: "NPCs/NPC.as:48-59 + AdnanCharacter.as:13 (Spritemap 8x8)" }),
    bar: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 64, h: 16, src: "Game.as:2110 + Scenery/Bar.as:16-20" }),
    barstool: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 8, src: "Game.as:2111 + Scenery/Barstool.as:16-23" }),
    beamtower: Object.freeze({ collider: 'rect', left: 0, top: -8, w: 16, h: 32, src: "Game.as:2087 + Puzzlements/BeamTower.as:28-44" }),
    bed: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 32, src: "Game.as:2108 + Scenery/Bed.as:15-21" }),
    bombpusher: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 48, h: 48, src: "Game.as:2089 + Enemies/BombPusher.as:24-35" }),
    bonetorch: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2152 (new BoneTorch(x, y, 0, ...)) + Scenery/BoneTorch.as:29-52" }),
    bonetorch2: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2153 (new BoneTorch(x, y, 1, ...)) + Scenery/BoneTorch.as:29-52" }),
    bosslock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2147 (new BossLock(x, y, keyType, tag)) + Puzzlements/BossLock.as:30-38" }),
    bosstotem: Object.freeze({ collider: 'rect', left: -40, top: 12, w: 80, h: 32, src: "Game.as:2071 + Enemies/BossTotem.as:280-315,486" }),
    breakablerock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Puzzlements/BreakableRock.as:22-43" }),
    breakablerockghost: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2158 (new BreakableRock(x, y, tag, 1)) + Puzzlements/BreakableRock.as:22-43" }),
    brickpole: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Scenery/BrickPole.as:14-22 (sprite offsets are cosmetic)" }),
    brickwell: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Scenery/BrickWell.as:14-24 (sprite offsets are cosmetic)" }),
    building: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 64, h: 48, src: "Scenery/Building.as:20-23 + assets/graphics/BuildingMask.png (64x48)" }),
    building1: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 48, h: 32, src: "Scenery/Building.as:20-23 + assets/graphics/Building1Mask.png (48x32)" }),
    building2: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 64, h: 48, src: "Game.as:2100 (new Building(x, y, 2)) + Scenery/Building.as:20-23" }),
    building4: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 144, h: 128, src: "Game.as:2102 (new Building(x, y, 4)) + Scenery/Building.as:20-23" }),
    building5: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 64, h: 48, src: "Game.as:2103 (new Building(x, y, 5)) + Scenery/Building.as:20-23" }),
    building6: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 80, h: 88, src: "Game.as:2104 (new Building(x, y, 6)) + Scenery/Building.as:20-23" }),
    building7: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 80, h: 96, src: "Scenery/Building.as:20-23 + assets/graphics/Building7Mask.png (80x96)" }),
    building8: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 64, h: 64, src: "Scenery/Building.as:20-23 + assets/graphics/Building8Mask.png (64x64)" }),
    burnabletree: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2095 + Scenery/BurnableTree.as:20-30 via Scenery/Tree.as:20-26" }),
    chest: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2159 + Chest.as:25-34" }),
    cover: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2142 + Puzzlements/Cover.as:23-35" }),
    crusher: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2090 + Puzzlements/Crusher.as:37-40" }),
    dresser: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 16, src: "Game.as:2109 + Scenery/Dresser.as:16-20" }),
    dungeonspire: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2160 + Scenery/DungeonSpire.as:16-23" }),
    finaldoor: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2190 + Scenery/FinalDoor.as:23-26" }),
    forestchar: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 9, src: "Game.as:2173 + NPCs/NPC.as:47-59 + NPCs/ForestCharacter.as:13 (Spritemap 8x9)" }),
    frozenboss: Object.freeze({ collider: 'rect', left: 32, top: 128, w: 80, h: 32, src: "Game.as:2192 + Scenery/FrozenBoss.as:18-20" }),
    grasslock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2143 + Puzzlements/GrassLock.as:13-16 + Puzzlements/Lock.as:25-34" }),
    hermit: Object.freeze({ collider: 'rect', left: 3, top: 2, w: 10, h: 12, src: "Game.as:2179 + NPCs/NPC.as:47-59 + NPCs/Hermit.as:13 (Spritemap 10x12)" }),
    iceturret: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2137 + Enemies/IceTurret.as:53-95 + Projectiles/IceTurretBlast.as:52" }),
    introchar: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 8, src: "NPCs/NPC.as:48-59 + IntroCharacter.as:13 (Spritemap 8x8)" }),
    karlore: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2174 + NPCs/Karlore.as:17-23" }),
    lavaboss: Object.freeze({ collider: 'rect', left: 16, top: 11, w: 64, h: 58, src: "Game.as:2073 + Enemies/LavaBoss.as:24-46" }),
    lavachain: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2141 + Puzzlements/LavaChain.as:24-46" }),
    lock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2138 (new Lock(x, y, tset, tag)) + Puzzlements/Lock.as:25-33" }),
    magicallock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2148 (new MagicalLock(x, y, tag, 0)) + Puzzlements/MagicalLock.as:21-46" }),
    magicallockfire: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2149 (new MagicalLock(x, y, tag, 1)) — the same class, sprite only" }),
    moonrockpile: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 16, src: "Game.as:2193 + Scenery/MoonrockPile.as:17-23 (sprite MoonrockPile.png 32x16)" }),
    opentree: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2096 + Scenery/OpenTree.as:13-26 via Scenery/Tree.as:20-26" }),
    oracle: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2177 + NPCs/NPC.as:47-59 + NPCs/Oracle.as:38 (setHitbox overrides)" }),
    oraclestatue: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2195 + Scenery/OracleStatue.as:16-21" }),
    planttorch: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2154 + Scenery/PlantTorch.as:26-48" }),
    pole: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Scenery/Pole.as:15-20" }),
    pulser: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2139 + Puzzlements/Pulser.as:26-38" }),
    pushableblock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2164 + Puzzlements/PushableBlock.as:23-32" }),
    pushableblockfire: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2165 + Puzzlements/PushableBlockFire.as:25-33" }),
    pushableblockspear: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2166 + Puzzlements/PushableBlockSpear.as:11-16 via PushableBlockFire" }),
    rekcahdam: Object.freeze({ collider: 'rect', left: 4, top: 3, w: 9, h: 10, src: "NPCs/NPC.as:48-59 + Rekcahdam.as:13 (Spritemap 9x10)" }),
    rock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Scenery/Rock.as:12-17 (new Rock(x, y, 0))" }),
    rock2: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Scenery/Rock.as:12-17 (new Rock(x, y, 1) — index picks the sprite only)" }),
    rock3: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2114 (new Rock(x, y, 2)) — Scenery/Rock.as:12-17, index picks the sprite" }),
    rock4: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2115 (new Rock(x, y, 3)) — Scenery/Rock.as:12-17, index picks the sprite" }),
    rocklock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2137 + Puzzlements/RockLock.as:22-28" }),
    ruinedpillar: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2196 + Scenery/RuinedPillar.as:16-23" }),
    sensei: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 8, src: "Game.as:2181 + NPCs/NPC.as:47-59 + NPCs/Sensei.as:13 (Spritemap 8x8)" }),
    shieldboss: Object.freeze({ collider: 'rect', left: 0, top: 8, w: 48, h: 48, src: "Game.as:2170 + Enemies/ShieldBoss.as:32-47" }),
    shieldlock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2145 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,1))" }),
    shieldlocknorm: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2144 + Puzzlements/ShieldLock.as:35-49 (new ShieldLock(x,y,tag,0))" }),
    shieldstatue: Object.freeze({ collider: 'rect', left: 8, top: 0, w: 32, h: 32, src: "Game.as:2194 + Scenery/ShieldStatue.as:16-23" }),
    sign: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2182 + NPCs/NPC.as:47-59 + NPCs/Sign.as:11 (Spritemap 16x16)" }),
    snowhill: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 96, h: 56, src: "Game.as:2097 + Scenery/SnowHill.as:14-22" }),
    spinningaxe: Object.freeze({ collider: 'rect', left: 4, top: 4, w: 8, h: 8, src: "Game.as:2140 + Puzzlements/SpinningAxe.as:24-44" }),
    stairsdown: Object.freeze({ collider: 'trigger', left: 0, top: 0, w: 16, h: 16, src: "Stairs.as:11-20 via Game.as:2168 (new Stairs(x, y, false, ...)) — `Stairs extends Teleporter` and calls super(x, y, to, px, py, true, -1, false, sign), so it is the identical trigger with `show` forced true and `tag` forced -1" }),
    stairsup: Object.freeze({ collider: 'trigger', left: 0, top: 0, w: 16, h: 16, src: "Stairs.as:11-20 via Game.as:2167 (new Stairs(x, y, true, ...))" }),
    statue1: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 48, h: 32, src: "Game.as:2187 (new Statue(x, y, 0, ...)) + NPCs/Statue.as:19-45 via NPCs/NPC.as:47-49" }),
    statue2: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 48, h: 24, src: "NPCs/Statue.as:19-45 via NPCs/NPC.as:47-49 (new Statue(x, y, 1, ...))" }),
    teleporter: Object.freeze({ collider: 'trigger', left: 0, top: 0, w: 16, h: 16, src: "Teleporter.as:31-53" }),
    tentaclebeast: Object.freeze({ collider: 'pixelmask', left: 1, top: 2, w: 46, h: 44, src: "Game.as:2079 + Enemies/TentacleBeast.as:38-46 + assets/graphics/TentacleBeastMask.png (46x44)" }),
    totem: Object.freeze({ collider: 'rect', left: 0, top: 32, w: 32, h: 32, src: "Game.as:2183 + NPCs/Totem.as:16-27 via NPCs/NPC.as:47-59" }),
    tree: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Scenery/Tree.as:20-26" }),
    treebare: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 32, h: 32, src: "Game.as:2094 (new Tree(x, y, true)) + Scenery/Tree.as:20-26" }),
    treelarge: Object.freeze({ collider: 'pixelmask', left: 0, top: 0, w: 160, h: 192, src: "Scenery/TreeLarge.as:22-30 + assets/graphics/TreeLargeMask.png (160x192)" }),
    wandlock: Object.freeze({ collider: 'rect', left: 0, top: 0, w: 16, h: 16, src: "Game.as:2146 (new WandLock(x, y, tset, tag)) + Puzzlements/WandLock.as:13-16" }),
    witch: Object.freeze({ collider: 'rect', left: 0, top: 2, w: 16, h: 13, src: "Game.as:2178 + NPCs/NPC.as:47-59 + NPCs/Witch.as:16 (Spritemap 16x13)" }),
    yeti: Object.freeze({ collider: 'rect', left: 3, top: 2, w: 10, h: 12, src: "Game.as:2180 + NPCs/NPC.as:47-59 + NPCs/Yeti.as:13 (Spritemap 10x12)" }),
});
