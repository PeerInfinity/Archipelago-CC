/**
 * seedlingDemo/seedlingEnemyArt — THE ART ROWS for G3's bodies: the enemies,
 * the arrow and the AP item looks. ONE spelling of each sheet, frame size,
 * origin and animation, read by BOTH the renderer (`seedlingEnemySkin.js`,
 * whose per-tick reducer runs these anims) and the pack extractor
 * (`scripts/procgen/extract-seedling-art-packs.mjs` spreads them into its
 * `ART_TABLE`), so the pack and the code cannot disagree about a frame list.
 * No imports: the extractor loads it in node without the sim.
 */

export const fps = (frames, rate, loop = true) => Object.freeze({ clock: 'fps', frames: Object.freeze(frames), fps: rate, ...(loop ? {} : { loop: false }) });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/**
 * THE ART ROWS (the extractor's `ART_TABLE` spreads these in; ONE spelling of
 * each sheet, frame size, origin and anim). `origin` is FlashPunk's
 * `centerOO` (or the class's own `x`/`originX`): the frame pixel that sits on
 * the body's position, and the pivot of a turn or a scale.
 */
export const ENEMY_ART = Object.freeze([
    { pack: 'seedling', key: 'seedling:enemy/bob', file: 'Bob.png', fw: 8, fh: 8, origin: [4, 4],
        as3: 'Enemies/Bob.as:15-16 Spritemap(8, 8); :35 centerOO; :36 walk sitFrames [0,1,2,1] fps 10 one-shot; :37 die [3..6] fps 5',
        anims: { walk: fps([0, 1, 2, 1], 10, false), die: fps([3, 4, 5, 6], 5) } },
    { pack: 'seedling', key: 'seedling:enemy/lavarunner', file: 'LavaRunner.png', fw: 20, fh: 20, origin: [10, 10],
        as3: 'Enemies/LavaRunner.as:13-14 Spritemap(20, 20); :31 centerOO; :32-34 walk/swim/die fps 15',
        anims: { walk: fps([0, 2, 3, 4], 15), swim: fps([5, 7, 8, 9], 15), die: fps(range(10, 18), 15) } },
    { pack: 'seedling', key: 'seedling:enemy/jellyfish', file: 'Jellyfish.png', fw: 14, fh: 15, origin: [7, 7.5],
        as3: 'Enemies/Jellyfish.as:14-15 Spritemap(14, 15); :28 centerOO; :29 walk [0,1,2,3,2,1] fps 15 one-shot; :30 die [4..11] fps 7 one-shot',
        anims: { walk: fps([0, 1, 2, 3, 2, 1], 15, false), die: fps(range(4, 11), 7, false) } },
    { pack: 'seedling', key: 'seedling:enemy/bulb', file: 'Bulb.png', fw: 16, fh: 16, origin: [8, 8],
        as3: 'Enemies/Bulb.as:14-15 Spritemap(16, 16); :21 centerOO; :22-25 walk/drop/die at animSpeed 8',
        anims: { walk: fps([0, 1, 2, 3, 4], 8), drop: fps(range(5, 11), 8), die: fps(range(12, 18), 8) } },
    { pack: 'seedling', key: 'seedling:enemy/flyer', file: 'Flyer.png', fw: 18, fh: 26, origin: [9, 13],
        as3: 'Enemies/Flyer.as:14-15 Spritemap(18, 26); :30 centerOO; :31 walk fps 15; :32 fall [4..22] fps 30; :33 die [23..26] fps 10',
        anims: { walk: fps([0, 1, 2, 3], 15), fall: fps(range(4, 22), 30), die: fps([23, 24, 25, 26], 10) } },
    { pack: 'seedling', key: 'seedling:enemy/puncher', file: 'Puncher.png', fw: 20, fh: 20, origin: [10, 10],
        as3: 'Enemies/Puncher.as:14-15 Spritemap(20, 20); :30 centerOO; :32-44 walk fps 4, attack fps 12, stand fps 2, die fps 10',
        anims: {
            'walk-side': fps([6, 7, 8, 9], 4), 'walk-up': fps([16, 17, 18, 19], 4), 'walk-down': fps([26, 27, 28, 29], 4),
            'attack-side': fps([2, 3, 4, 5], 12), 'attack-up': fps([12, 13, 14, 15], 12), 'attack-down': fps([22, 23, 24, 25], 12),
            'stand-side': fps([0, 1], 2), 'stand-up': fps([10, 11], 2), 'stand-down': fps([20, 21], 2),
            die: fps(range(30, 39), 10),
        } },
    { pack: 'seedling', key: 'seedling:enemy/bobsoldier', file: 'BobSoldier.png', fw: 10, fh: 10, origin: [5, 5],
        as3: 'Enemies/BobSoldier.as:27-28 Spritemap(10, 10); :58 centerOO; :59 walk [0,1,2,1] fps 10',
        anims: { walk: fps([0, 1, 2, 1], 10) } },
    { pack: 'seedling', key: 'seedling:enemy/lameSword', file: 'LameSword.png', fw: 16, fh: 5, origin: [0, 3],
        as3: 'Enemies/BobSoldier.as:24-25 Spritemap(16, 5); :62-63 y = -3, originY = 3 (x = originX = 0); :187-198 angle = swordSpin deg' },
    { pack: 'seedling', key: 'seedling:enemy/spinner', file: 'Spinner.png', fw: 18, fh: 9, origin: [5, 5],
        as3: 'Enemies/Spinner.as:16-17 Spritemap(18, 9); :35-38 x = y = -5, origin 5; :97-121 frame 1 (the hammer) turned, then frame 0 (the body)' },
    { pack: 'seedling', key: 'seedling:projectile/arrow', file: 'Arrow.png', origin: [4, 1.5],
        as3: 'Projectiles/Arrow.as:15-16 Image; :24 centerOO; :32,41 angle = atan2(-v.y, v.x)' },
    // ── G3b: the room bodies that are not chasers (`seedlingRoomBodySkin.js`) ──
    { pack: 'seedling', key: 'seedling:enemy/wallflyer', file: 'WallFlyer.png', fw: 20, fh: 16, origin: [12, 8],
        as3: 'Enemies/WallFlyer.as:17 Spritemap(20, 16); :29-31 centerOO, x = -12, originX = 12; :32-34 jump fps 15, jumping [3,4] fps 7, die [5..8] fps 10',
        anims: { jump: fps([0, 1, 2, 3], 15), jumping: fps([3, 4], 7), die: fps([5, 6, 7, 8], 10) } },
    { pack: 'seedling', key: 'seedling:enemy/drill', file: 'Drill.png', fw: 16, fh: 16, origin: [8, 8],
        as3: 'Enemies/Drill.as:16 Spritemap(16, 16); :25 centerOO; :26-30 sit [0], drill [0..4] / undrill [3,2,1,0] fps 20 one-shot, die [5..10] fps 10 one-shot, hit [3,4] fps 20',
        anims: { drill: fps([0, 1, 2, 3, 4], 20, false), undrill: fps([3, 2, 1, 0], 20, false), die: fps(range(5, 10), 10, false), hit: fps([3, 4], 20) } },
    { pack: 'seedling', key: 'seedling:enemy/iceturret', file: 'IceTurret.png', fw: 32, fh: 32, origin: [12, 16],
        as3: 'Enemies/IceTurret.as:16 Spritemap(32, 32); :34-37 originX 12, originY 16; :39-42 startshot [0] / finishshot [1..5] fps 10, hit [1], dead [6]',
        anims: { startshot: fps([0], 10), finishshot: fps([1, 2, 3, 4, 5], 10) } },
    { pack: 'seedling', key: 'seedling:projectile/iceblast', file: 'IceBlast.png', fw: 16, fh: 7, origin: [8, 4],
        as3: 'Projectiles/IceTurretBlast.as:15 Spritemap(16, 7); :23-26 x = -8, y = -4, origin (8, 4); :34,44 angle = atan2(-v.y, v.x)' },
    { pack: 'seedling', key: 'seedling:enemy/turret', file: 'Turret.png', fw: 16, fh: 16, origin: [8, 8],
        as3: 'Enemies/Turret.as:15 Spritemap(16, 16); :28 centerOO; :30-33 startshot [1,2] / finishshot [2,1] fps 10, hit [0], die [3..8] fps 10',
        anims: { startshot: fps([1, 2], 10), finishshot: fps([2, 1], 10), die: fps(range(3, 8), 10) } },
    { pack: 'seedling', key: 'seedling:projectile/turretspit', file: 'TurretSpit.png', fw: 12, fh: 8, origin: [8, 4],
        as3: 'Projectiles/TurretSpit.as:17 Spritemap(12, 8); :23-26 x = -8, y = -4, origin (8, 4); :35 angle = atan2(-v.y, v.x)' },
    // `BobBoss.as:17-20,46` one sheet per form, `Spritemap(images[_st], 20, 20)`; BobSoldier's ctor centerOO + "walk".
    ...[1, 2, 3].map((n) => ({ pack: 'seedling', key: `seedling:enemy/bobboss${n - 1}`, file: `BobBoss${n}.png`, fw: 20, fh: 20, origin: [10, 10],
        as3: `Enemies/BobBoss.as:${16 + n} imgBobBoss${n}; :46 Spritemap(20, 20); BobSoldier.as:58-59 centerOO, walk [0,1,2,1] fps 10 (× the form's rate, BobBoss.as:66,72)`,
        anims: { walk: fps([0, 1, 2, 1], 10) } })),
    { pack: 'seedling', key: 'seedling:enemy/bobbossWeapons', file: 'BobBossWeapons.png', fw: 24, fh: 5, origin: [0, 3],
        as3: 'Enemies/BobBoss.as:22-23 Spritemap(24, 5); :53-55 y = -3, originY = 3, frame = the form; BobSoldier.as:187-198 angle = swordSpin deg' },
    // ── G3c: the puzzlements and the last of the room bodies (`seedlingHazardSkin.js`). ⚠ The manifest refuses
    //    `fps 0`, and LavaChain's frames ride its own transcription (`lavaChain.LAVA_CHAIN.anims`, the sim's), so the
    //    chain, the crusher, the totem and the bomb are frame-only rows. ──
    ...[['spinningaxe', 'SpinningAxe.png', 0], ['spinningaxeRed', 'SpinningAxeRed.png', 1]].map(([k, file, colour]) => ({
        pack: 'seedling', key: `seedling:puzzlement/${k}`, file, origin: [4, 10],
        as3: `Puzzlements/SpinningAxe.as:15-16,26-35 Image (${file}, _colorType ${colour}); :37-40 originX 4, originY = height / 2; :52 angle += spinRate` })),
    { pack: 'seedling', key: 'seedling:puzzlement/crusher', file: 'Crusher.png', fw: 32, fh: 32, origin: [16, 16],
        as3: 'Puzzlements/Crusher.as:18-19 Spritemap(32, 32), no anims (frame 0); :38 centerOO; :109-113 angle += 8 while v ≠ 0, else 0' },
    { pack: 'seedling', key: 'seedling:puzzlement/lavachain', file: 'LavaChain.png', fw: 64, fh: 16, origin: [8, 8],
        as3: 'Puzzlements/LavaChain.as:18-19 Spritemap(64, 16); :34-37 origin (8, 8); :39-42 sit [0], extend [1,2] fps 15, hit [3,4,5,5,5,5,4,3] fps 15, retract [6..12] fps 25; :52 angle = 90 · direction' },
    { pack: 'seedling', key: 'seedling:enemy/bosstotem', file: 'BossTotem.png', fw: 32, fh: 48, origin: [0, 0],
        as3: 'Enemies/BossTotem.as:18-19 Spritemap(32, 48): frame 0 the head, 1 an arm, 2 a leg; :605-640 each part sets its own origin (legs (0,0), arms (armsBase.x · scaleX, 0), head headOrigin (16, 47))' },
    { pack: 'seedling', key: 'seedling:projectile/bosstotemshot', file: 'BossTotemShot.png', fw: 20, fh: 20, origin: [10, 10],
        as3: 'Projectiles/BossTotemShot.as:17-18 Spritemap(20, 20); :27 centerOO; :28-29 fly [0,1,2] fps 10, played in the ctor',
        anims: { fly: fps([0, 1, 2], 10) } },
    { pack: 'seedling', key: 'seedling:enemy/bombpusher', file: 'BombPusher.png', fw: 48, fh: 48, origin: [24, 24],
        as3: 'Enemies/BombPusher.as:15-16 Spritemap(48, 48); :27 centerOO; :29-30 shoot [0,2,1,2,3] fps 5, sit [0,3] fps 2',
        anims: { shoot: fps([0, 2, 1, 2, 3], 5), sit: fps([0, 3], 2) } },
    { pack: 'seedling', key: 'seedling:projectile/bomb', file: 'Bomb.png', fw: 16, fh: 16, origin: [8, 8],
        as3: 'Projectiles/Bomb.as:15-16 Spritemap(16, 16), no anims; :29 centerOO; :41-51 scale from t, angle += 15 a tick' },
    { pack: 'seedling', key: 'seedling:enemy/grenade', file: 'Grenade.png', fw: 16, fh: 16, origin: [8, 8],
        as3: 'Enemies/Grenade.as:16-17 Spritemap(16, 16); :43 centerOO; :44-47 explode [0,1,0,2,0,3,4,3] fps 12, hit [5,6,7] fps 12, sit [0,4] fps 5 (played in the ctor)',
        anims: { explode: fps([0, 1, 0, 2, 0, 3, 4, 3], 12), hit: fps([5, 6, 7], 12), sit: fps([0, 4], 5) } },
    // ── AP item looks: `Pickups/APItem.as:52-66,94-104` (the sheet and frame size each look binds; 0x0 = an Image,
    //    i.e. the whole file) and `:160-172` (`centerOO`, frame 0 — an APItem never advances its frame) ──
    ...[['sword', 'Sword.png', 16, 16], ['shield', 'Shield.png', 7, 7], ['darkshield', 'DarkShield.png', 9, 9, 'Image'],
        ['conch', 'Conch.png', 8, 8], ['feather', 'Feather.png', 12, 12], ['wand', 'WandPickup.png', 5, 9],
        ['firewand', 'FireWandPickup.png', 5, 9], ['ghostspear', 'GhostSpear.png', 20, 7], ['ghostsword', 'GhostSwordPickup.png', 24, 7],
        ['darksuit', 'DarkSuit.png', 10, 10, 'Image'], ['torchpickup', 'TorchPickup.png', 12, 12], ['health', 'HealthPickup.png', 8, 8],
        ['totempart', 'BossTotemParts.png', 24, 24], ['chest', 'Chest.png', 16, 16], ['seed', 'Seed.png', 9, 13]]
        .map(([look, file, w, h, image]) => ({ pack: 'seedling', key: `seedling:pickup/${look}`, file, fw: w, fh: h, origin: [w / 2, h / 2],
            as3: `Pickups/APItem.as:94-104 "${look}" → [${file}, ${image ? '0, 0] (an Image: the whole ' + w + 'x' + h + ' file)' : `${w}, ${h}]`}; :171 centerOO, frame 0` })),
    // `Game.as:432-444` `bossKeys` (Spritemap(12, 16), centerOO at `Game.as:811-813`); `APItem.as:155-162` "bosskeyN".
    ...['', '1', '2', '3', '4'].map((n, i) => ({ pack: 'seedling', key: `seedling:pickup/bosskey${i}`, file: `BossKey${n}.png`, fw: 12, fh: 16, origin: [6, 8],
        as3: `Game.as:${432 + 2 * i}-${433 + 2 * i} sprBossKey${n}; Game.as:444 bossKeys[${i}]; APItem.as:155-162 "bosskey${i}"` })),
]);
