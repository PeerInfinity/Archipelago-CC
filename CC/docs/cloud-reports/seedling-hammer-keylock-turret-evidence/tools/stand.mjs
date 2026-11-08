// scratch (KEYLOCK-TURRET W0): the model's answer to "does standing on the key line with the turret alive get the
// player hit?" — the generated room of gadget.mjs, the boot ON the key-line stance (88,184), the player leans north
// into the lock until the line latches and then presses nothing for 200 ticks (execKeylock's own keys). One row per
// event: a player hit, a freeze, the lock's latch and open. `--turret=none` drops the turret (the control).
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await import(R + 'procgenLevel.js');
const { bootStaging } = await import(R + 'procgenOracle.js');
const { POST_SWORD_ITEMS } = await import(R + 'procgenPalette.js');
const { levelSourceFromAtlas } = await import(R + 'atlasSource.js');
const { atlasOf } = await import(R + 'procgenLevel.js');
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { keyLineTouches } = await import(R + 'activators.js');
const { playerBoxAt } = await import(R + 'playerPhysicsV2.js');
const noTurret = process.argv.includes('--turret=none');
let record = emptyLevel({ level: 900, width: 11, height: 30 });
const walls = [];
for (let tx = 1; tx <= 9; tx += 1) if (tx !== 5) walls.push({ tx, ty: 10, terrain: 'wall' });
record = withTerrain(record, walls);
record = withEntities(record, [
    { type: 'totempart', ...oelAtTile(5, 2), attrs: { tag: '0' } },
    { type: 'bosslock', ...oelAtTile(5, 10), attrs: { keyType: '0', tag: '1' } },
    ...(noTurret ? [] : [{ type: 'iceturret', ...oelAtTile(4, 12) }]),
]);
const staging = bootStaging({ boot: bootAtTile(record, 5, 11), items: POST_SWORD_ITEMS, pins: ['dead_frames'] });
staging.save = { ...staging.save, keys: [0] };
const run = createRunForStaging(staging, levelSourceFromAtlas(atlasOf(record)), { scratchPersistence: true });
const lock = run.world.activators.find((a) => a.id === 'bosslock@80,160');
let touched = null; let opened = null; let hits = 0;
for (let t = 0; t < 200; t += 1) {
    const held = touched === null ? new Set(['up']) : new Set();
    run.advance(held);
    if (touched === null && keyLineTouches(playerBoxAt(run.state.x, run.state.y), lock.keyLine)) { touched = t; console.log(`t${t} key line touched at (${run.state.x},${run.state.y})`); }
    const h = run.ledger('playerHits');
    if (h.length !== hits) { hits = h.length; console.log(`t${t} HIT ${h.at(-1).source}:${h.at(-1).id} player (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) on-line ${keyLineTouches(playerBoxAt(run.state.x, run.state.y), lock.keyLine)}`); }
    if (opened === null && run.entities('openActivators').has(lock.id)) { opened = t; console.log(`t${t} lock OPEN`); }
}
console.log(JSON.stringify({ turret: !noTurret, touched, opened, hits, deaths: run.playerDeaths?.length ?? null, end: { x: run.state.x, y: run.state.y } }));
