/**
 * census-seedling-chest-open-side — what the slice rules-chest-open-side reported, held on the map and the ledger:
 * every chest of the playthrough map is a goal-ledger row, so the randomizer's set carries an `<apitem>` in its place
 * (no `Chest` Solid is left in the delivered game), and a chest-as-Solid rule would move rules in more than one room.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { chestOpenSideCensus } from './census-seedling-chest-open-side.mjs';

describe('census-seedling-chest-open-side', () => {
    let rows;
    beforeAll(async () => { rows = await chestOpenSideCensus(); }, 120000);

    it('finds every chest entity of the playthrough map, each with an open side under it', async () => {
        const { PLAYTHROUGH_MAP } = await import('./make-seedling-playthrough-rules.mjs');
        const chests = PLAYTHROUGH_MAP.levels.flatMap((l) => l.entities.filter((e) => e.type === 'chest').map((e) => `L${l.level} chest@${e.x},${e.y}`));
        expect(rows.map((r) => `L${r.level} ${r.chest}`).sort()).toEqual(chests.sort());
        for (const r of rows) {
            expect(r.openSideTiles.length, `${r.chest} of L${r.level}`).toBeGreaterThan(0);
            // The line is under the chest: every open-side tile is in the row(s) at or below its bottom edge.
            const bottomRow = Math.max(...r.tiles.map((t) => t[1]));
            for (const t of r.openSideTiles) expect(t[1]).toBeGreaterThanOrEqual(bottomRow);
        }
    });

    it('every chest is a ledger row: the delivery ships an apitem in its place, never the Solid', () => {
        expect(rows.filter((r) => r.delivery !== 'apitem').map((r) => `L${r.level}`)).toEqual([]);
        for (const r of rows) expect(r.location, `L${r.level}`).toMatch(/Chest$/);
    });

    it('as a vanilla Solid the chest would cut its room in more rooms than one (the slice\'s stop)', () => {
        const separating = rows.filter((r) => r.separates && !r.offGrid);
        expect(separating.length).toBeGreaterThan(1);
        for (const r of separating) {
            expect(r.fires).toBe(true);
            expect(r.cutOff.length, `L${r.level}`).toBeGreaterThan(0);
        }
        // A fired row is never a room the open side already holds whole.
        for (const r of rows.filter((x) => !x.fires)) expect(r.separates && !r.offGrid, `L${r.level}`).toBe(false);
    });
});
