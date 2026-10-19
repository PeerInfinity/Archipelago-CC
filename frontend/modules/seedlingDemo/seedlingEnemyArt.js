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
