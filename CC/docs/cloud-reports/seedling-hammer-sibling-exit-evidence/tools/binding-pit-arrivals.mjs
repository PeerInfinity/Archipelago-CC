// SIBLING-EXIT step 1 (measure only): the region binding fed the game's own reports for an L16 -> L17 pit fall,
// once per pit tile of `level_16__r1c9`. A pit is no Teleporter (Teleporter.as/Stairs.as are the only writers of
// `Game.pendingExit`), so the crossing is the `level` report alone, tie-broken on `Main.playerPositionX/Y`, which the
// fall sets to the CTOR spawn (`Player.checkFallingInPit` -> `new Game(fallthroughLevel, x, y)` -> `Game.playerPosition`
// setter -> `Main.playerPositionX/Y`): the exit's own `target_spawn`. Also: the same with a spawn 8 px off (the model's
// centre-x), to show what the tie-break does if the report were not exact.
//   node binding-pit-arrivals.mjs [region=level_16__r1c9]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const { SeedlingRegionBinding } = await import(join(REPO, 'frontend/modules/flashPanel/seedlingRegionBinding.js'));
const SIDE = JSON.parse(readFileSync(join(REPO, 'worlds/seedling_playthrough/_worldgen_sidecars.json'), 'utf8'));
const region = process.argv[2] ?? 'level_16__r1c9';
const world = SIDE[region].playable_payload;
const crossOnce = (spawn, to) => {
    let t = 0;
    const b = new SeedlingRegionBinding({ now: () => (t += 60000) });
    b.onStateReport('level', world.level);
    b.onLoadRegion({ region_id: region, world, arrivedFrom: null });
    b.onStateReport('level', world.level);
    b.onStateReport('playerPositionX', spawn.x);
    b.onStateReport('playerPositionY', spawn.y);
    return b.onStateReport('level', to).filter((e) => e.type === 'regionMove' || e.type === 'warn');
};
for (const e of world.exits.filter((x) => x.targetRegion && x.target_level !== world.level)) {
    const exact = crossOnce(e.target_spawn, e.target_level)[0];
    const off = crossOnce({ x: e.target_spawn.x + 8, y: e.target_spawn.y - 75 }, e.target_level)[0];
    console.log(JSON.stringify({ taken: e.exitName, exit_id: e.exit_id, tile: e.exit_tiles, spawn: e.target_spawn,
        credited: exact?.exitName ?? exact?.message ?? null, creditedRegion: exact?.targetRegion ?? null,
        same: exact?.exitName === e.exitName, offByCentre: off?.exitName ?? null }));
}
