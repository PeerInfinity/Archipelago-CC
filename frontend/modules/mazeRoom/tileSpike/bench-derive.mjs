/**
 * ⚖ Q6 measurement for the Q3 search: wall time of `deriveRegionLogic` on the generated guard room
 * (the test's room), and the same per-inventory BFS run on the NATIVE `step` for the ratio.
 * Run: node frontend/modules/mazeRoom/tileSpike/bench-derive.mjs
 */
import { readFileSync } from 'node:fs';
import { createState, step, getExitAt, mazeVisitedKey, setObstacle, INPUTS } from '../mazeRoomEngine.js';
import { generateMazeLevel, MAZE_PALETTE } from '../procgenMaze.js';
import { parseAreaSpec } from '../../procgenCore/areaSpec.js';
import { parseElementSpec } from '../../procgenCore/elementSpec.js';
import { parseSkeleton } from '../../procgenCore/skeletonKinds.js';
import { deriveRegionLogic, reachUnder, regionItems } from './deriveTileLogic.js';

const HELPERS = JSON.parse(readFileSync(new URL('./maze_tiles.helpers.json', import.meta.url)));
const has = (item) => ({ rule: 'Has', args: { item_name: item } });

function room(rockAt) {
    const w = generateMazeLevel({
        seed: 2, palette: MAZE_PALETTE, width: 15, height: 15,
        skeleton: parseSkeleton('rooms', { simulator: true, substrate: 'bench' }),
        areas: parseAreaSpec('1'), elements: parseElementSpec('guard;len=2;turns=1'),
    }).record;
    if (rockAt) {
        w.obstacleLib = { ...w.obstacleLib, rock: { id: 'rock', clear_set_type: 'rule',
            clear_rule: { rule: 'Or', children: [has('Progressive Sword'), has('Progressive Swim')] } } };
        setObstacle(w, ...rockAt, 'rock');
    }
    return w;
}

function nativeStates(world, inventory) {
    const w = { ...world, items: new Map() };
    const start = createState(w);
    start.inventory = new Set(inventory);
    const seen = new Set([mazeVisitedKey(start)]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const s = queue[head];
        if (head > 0 && getExitAt(w, s.player_pos.x, s.player_pos.y) !== null) continue;
        for (const input of INPUTS) {
            const n = step(w, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.add(mazeVisitedKey(n));
            queue.push(n);
        }
    }
    return seen.size;
}

const time = (fn, reps) => {
    fn();
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn();
    return (performance.now() - t0) / reps;
};

for (const [name, rockAt] of [['plain', null], ['rock on lane', [8, 4]], ['rock on button', [8, 3]]]) {
    const w = room(rockAt);
    const items = regionItems(w);
    const d = deriveRegionLogic(w, HELPERS);
    const derive = time(() => deriveRegionLogic(w, HELPERS), 5);
    const full = reachUnder(w, items, HELPERS);
    const scripted = time(() => reachUnder(w, items, HELPERS), 10);
    const native = time(() => nativeStates(w, items), 10);
    const expansions = full.states * INPUTS.length;
    console.log(`${name}: items ${items.length}, searched ${d.searched} skipped ${d.skipped}, states ${d.states}; `
        + `derive ${derive.toFixed(1)} ms | one full-inventory BFS: ${full.states} states, scripted ${scripted.toFixed(2)} ms `
        + `(${(scripted * 1000 / expansions).toFixed(1)} µs/step) vs native ${native.toFixed(2)} ms `
        + `(${(native * 1000 / expansions).toFixed(2)} µs/step) = ${(scripted / native).toFixed(1)}×`);
}
