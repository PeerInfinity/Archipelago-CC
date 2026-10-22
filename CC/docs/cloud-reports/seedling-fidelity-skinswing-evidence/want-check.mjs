// scratch: the skin test's runTape + `want` checks for candidate boots, key ON (default) — node, no vitest
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { loadPackStack } = await import(R + 'frontend/modules/contentPacks/contentPacks.js');
const { createArtLibrary } = await import(R + 'frontend/modules/artLibrary/artLibrary.js');
const { createJsRuntime } = await import(M + 'jsRuntimeCore.js');
const { ENEMY_HIT_TINT, enemyOps, enemySkinView, stepEnemySkin } = await import(M + 'seedlingEnemySkin.js');
const { fightKeys } = await import(M + 'fidelitySkinSwing.js');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: pathToFileURL(R + 'frontend/packs/').href, readJson: fsJson }));
const MAP = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const GAME = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/games/seedling.json', 'utf8'));
const cases = [
    ['lavarunner-L71', 71, 96, 200, { anims: ['walk', 'die'], tint: true, mirror: true }],
    ['L71 resite', 71, 80, 208, { anims: ['walk', 'die'], tint: true, mirror: true }],
    ['bulb-L74', 74, 80, 100, { anims: ['walk', 'drop', 'die'] }],
    ['L74 resite', 74, 64, 100, { anims: ['walk', 'drop', 'die'] }],
];
for (const [name, level, x, y, want] of cases) {
    const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    let skin = null; const anims = new Set(); const ops = []; let die = 0;
    for (const held of fightKeys(300)) {
        rt.tick(held);
        const view = enemySkinView(rt.run);
        skin = stepEnemySkin(skin, view, rt.ticks);
        for (const s of skin.bodies.values()) { anims.add(s.sprite?.anim); if (s.sprite?.anim === 'die') die++; }
        ops.push(...enemyOps(view, art, { skin }));
    }
    const got = { anims: want.anims.map((a) => `${a}:${anims.has(a)}`).join(' '),
        tint: ops.some((o) => o.tint === ENEMY_HIT_TINT), mirror: ops.some((o) => o.flipX), art: ops.every((o) => o.sheetRef) };
    console.log(name, `(${x},${y}) die-frames ${die}`, JSON.stringify(got));
}
