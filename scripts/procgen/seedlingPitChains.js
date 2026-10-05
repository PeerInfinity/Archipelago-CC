/**
 * ⛓ RULES patched-set — **WHERE A FALL REALLY ENDS** (the playthrough's pit outcomes).
 *
 * The fidelity DESCENT rule (game-measured, `seedlingDemo/fidelityDescent.js`): a fall chains
 * through a door IFF the door is LIVE and the descent column crosses it after the first update.
 * Stairs are teleporters; a DEACTIVATED door, a door outside the column, or the fall-out does not
 * chain. `censusFallsOntoDoors` measures exactly that on the model, per (pit tile, ctor), and names
 * the door that `fires`. This module turns its rows into the derivation's `pitOutcome` hook: a pit
 * group whose fall fires a door exits to the door's TARGET, never to the intermediate landing — the
 * intermediate is not a standable place (the player never has control there).
 *
 * ⛔ No hand row: every chain is the census's. ⛔ Refuses by name:
 *   · a pit tile whose ctors disagree (one fires, another does not, or two fire different doors) —
 *     one exit cannot carry two outcomes, and picking one would be a guess;
 *   · a pit group whose tiles disagree;
 *   · a chain that ends on a cell the caller's `standable(level, [tx, ty])` refuses.
 */

const key = (from, x, y) => `${from}|${x}|${y}`;

/**
 * @param {{rows: Array<object>}} census  `censusFallsOntoDoors(levels)` over the levels the atlas derives from
 * @param {{tileSize: number, standable: (level: number, tile: [number, number]) => (true|string)}} deps
 *   `standable` returns `true`, or the reason the cell is not a place to stand.
 * @returns {{pitOutcome: Function, chains: Array<object>}} the derivation hook, and every chain it applied
 */
export function pitChainsFromCensus(census, { tileSize, standable }) {
    const byTile = new Map();
    for (const r of census.rows ?? []) {
        if (r.error) continue;
        const k = key(r.from, r.pit.x, r.pit.y);
        const outcome = r.fires
            ? `${r.fires.door}>${r.fires.to}@${r.fires.arrival.x},${r.fires.arrival.y}`
            : 'lands';
        const prev = byTile.get(k);
        if (prev && prev.outcome !== outcome) {
            throw new Error(`seedlingPitChains: L${r.from}'s pit at (${r.pit.x},${r.pit.y}) has ctors that `
                + `disagree (${prev.outcome} vs ${outcome}); one pit exit cannot carry two outcomes`);
        }
        byTile.set(k, { outcome, row: r });
    }
    const chains = [];
    const pitOutcome = (room, group) => {
        const outs = group.tiles.map(([tx, ty]) => byTile.get(key(room.level, tx * tileSize, ty * tileSize)));
        const fired = outs.filter((o) => o?.row.fires);
        if (fired.length === 0) return null;
        if (fired.length !== outs.length || new Set(fired.map((o) => o.outcome)).size !== 1) {
            throw new Error(`seedlingPitChains: L${room.level}'s pit group landing at L${group.to} `
                + `[${group.arrival}] mixes chained and unchained tiles (${outs.map((o) => o?.outcome ?? 'lands')
                    .join(', ')}); one pit exit cannot carry two outcomes`);
        }
        const { row } = fired[0];
        const arrival = [Math.floor(row.fires.arrival.x / tileSize), Math.floor(row.fires.arrival.y / tileSize)];
        const ok = standable(row.fires.to, arrival);
        if (ok !== true) {
            throw new Error(`seedlingPitChains: L${room.level}'s pit chains through L${row.to}'s `
                + `${row.fires.door} to L${row.fires.to} [${arrival}], which is not a place to stand — ${ok}`);
        }
        const chain = { from: room.level, tiles: group.tiles, landing: { level: row.to, tile: group.arrival },
            via: row.fires.door, t: row.fires.t, ends: { level: row.fires.to, tile: arrival } };
        chains.push(chain);
        return { to: row.fires.to, arrival };
    };
    return { pitOutcome, chains };
}
