// Byte-identity harness for the maze wall-generation stack
// (docs/json/developer/procgen/maze.md, "Biomes and wall backends").
//
// Dumps `generateMaze`'s full tile grid + backend stats over a fixed matrix so a
// before/after diff proves a MECHANICAL move of the algorithms (backends and the
// TILE_*/getTile/setTile definitions into `shared/procgen/mazeAlgorithms/`) is
// behaviour-preserving. Not a test — a one-off oracle.
//
// The matrix: seeds 1..12 × the eight biomes × four sizes × two entrance/exit
// layouts. The two layouts matter because `cellGrid.connectFixedTiles` only
// carves when a fixed tile is OFF the odd/odd cell lattice:
//   - `lattice`   entrance (1,1), single exit at the last odd cell — no carve.
//   - `offlattice` entrance (0,0), two exits at even coords / the dead strip —
//                  exercises connectFixedTiles' L-carve and multi-exit.
// Sizes include even dimensions (10x10, 12x8) so the cell grid's dead
// right/bottom strip is covered too.
//
// Also dumps the registry contents — `listBackends()` ids in registration
// order and `listPostProcessors()` — because the move must not change either.
//
// Run:
//   node scripts/procgen/dump-maze-byteidentity.mjs [outfile]
// Prints one line per cell plus a trailing md5 of the whole dump; the md5 is
// the gate. Writes the full dump to `outfile` when given.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { generateMaze, TILE_FLOOR } from '../../frontend/modules/mazeRoom/mazeRoomEngine.js';
import { BIOMES } from '../../frontend/modules/mazeRoom/mazeRoomBiomeLibrary.js';
import { listBackends } from '../../frontend/modules/shared/procgen/mazeAlgorithms/registry.js';
import { listPostProcessors } from '../../frontend/modules/shared/procgen/mazeAlgorithms/postProcessors.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const BIOME_IDS = Object.keys(BIOMES);
const SIZES = [
    { width: 9, height: 9 },
    { width: 10, height: 10 },
    { width: 12, height: 8 },
    { width: 15, height: 15 },
];

// Two entrance/exit layouts. `lastOdd` is the last cell-lattice tile coordinate
// for a given extent — the tile a fixed point must sit on to need no carve.
const lastOdd = (extent) => {
    const cells = Math.floor((extent - 1) / 2);
    return 2 * (cells - 1) + 1;
};

const LAYOUTS = {
    // On-lattice: entrance and the single exit both sit on cell positions.
    lattice: ({ width, height }) => ({
        entrance: { x: 1, y: 1 },
        exits: [{ exit_id: 'exit', x: lastOdd(width), y: lastOdd(height) }],
    }),
    // Off-lattice + multi-exit: even coordinates and a corner in the dead strip
    // for even extents, so connectFixedTiles has real work to do.
    offlattice: ({ width, height }) => ({
        entrance: { x: 0, y: 0 },
        exits: [
            { exit_id: 'exit_a', x: width - 1, y: height - 1 },
            { exit_id: 'exit_b', x: 0, y: height - 1 },
        ],
    }),
};

// The tile grid as one 0/1 string, row-major. TILE_FLOOR is 0 and TILE_WALL is
// 1 today; map through TILE_FLOOR so the dump stays meaningful if the constant
// values ever change (they must not, but the dump should say so rather than
// silently agree).
function tilesToString(world) {
    let out = '';
    for (let i = 0; i < world.tiles.length; i++) {
        out += world.tiles[i] === TILE_FLOOR ? '0' : '1';
    }
    return out;
}

// Backend stats, stably ordered, with the placement positions. Everything
// generateMaze reports except `shortestPath` derivatives that are already
// implied by the tiles.
function statsToString(stats) {
    const pos = (p) => (p ? `${p.x},${p.y}` : '-');
    return [
        `biome=${stats.biome}`,
        `backend=${stats.backend}`,
        `fallback=${stats.usedFallback}`,
        `iter=${stats.iterations}`,
        `acc=${stats.accepted}`,
        `rej=${stats.rejected}`,
        `rejFeas=${stats.rejectedFeasibility}`,
        `stalled=${stats.stalled}`,
        `path=${stats.shortestPath === null ? '-' : stats.shortestPath}`,
        `gateKey=${stats.gateKeyPlaced}`,
        `gateKeyReason=${stats.gateKeyReason ?? '-'}`,
        `door=${pos(stats.doorPos)}`,
        `key=${pos(stats.keyPos)}`,
    ].join(' ');
}

const lines = [];
lines.push(`backends ${listBackends().map((b) => b.id).join(',')}`);
lines.push(`postProcessors ${listPostProcessors().join(',')}`);

for (const seed of SEEDS) {
    for (const biomeId of BIOME_IDS) {
        for (const size of SIZES) {
            for (const layoutName of Object.keys(LAYOUTS)) {
                const layout = LAYOUTS[layoutName](size);
                const { world, stats } = generateMaze({
                    seed,
                    width: size.width,
                    height: size.height,
                    biome: { id: biomeId },
                    entrance: layout.entrance,
                    exits: layout.exits,
                });
                lines.push(
                    `${seed} ${biomeId} ${size.width}x${size.height} ${layoutName} `
                    + `${tilesToString(world)} ${statsToString(stats)}`,
                );
            }
        }
    }
}

const dump = `${lines.join('\n')}\n`;
const md5 = createHash('md5').update(dump).digest('hex');

const outfile = process.argv[2];
if (outfile) writeFileSync(outfile, dump);

process.stdout.write(dump);
process.stdout.write(`CELLS ${lines.length - 2}\n`);
process.stdout.write(`MD5 ${md5}\n`);
