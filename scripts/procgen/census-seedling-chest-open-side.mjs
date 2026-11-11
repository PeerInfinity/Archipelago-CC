#!/usr/bin/env node
/**
 * census-seedling-chest-open-side — **EVERY CHEST ON THE MAP: WHERE IT OPENS FROM, WHAT IT WOULD CUT AS A SOLID,
 * AND WHAT THE DELIVERY SHIPS IN ITS PLACE** (slice rules-chest-open-side; a REPORT, no rule reads it).
 *
 * `Chest.as:29` makes a chest a `Solid`, and `Chest.as:63` opens it only for a player on the one-pixel line under its
 * bottom edge. For each `chest` of the map the playthrough rules derive from (`PLAYTHROUGH_MAP`), this prints:
 *
 *   · its placement, tag, the tiles its 16x16 box touches, and whether a `cover` shares its cell;
 *   · the OPEN SIDE, from the model: every player position whose box touches the probe line
 *     (`chest.chestProbeLine`, `activators.keyLineTouches`) and is free of every Solid with the chest shut
 *     (`levelWorld.collidesSolid`), as the tiles those positions lie in;
 *   · the room analysed twice with the playthrough producer's own grid and analyzer options: as the rules read it
 *     today (the chest's cell is floor), and with the chest's tiles walled. `separates` = the sub-region holding the
 *     chest splits; `cut off` = each door and location of that sub-region that is not in the open side's part;
 *   · FIRES when the open side's part is not the whole of the chest's sub-region (a chest-as-Solid rule would move a
 *     rule there), else `no change`;
 *   · the DELIVERY: whether the goal ledger holds the chest (`apChestDelivery.apChestRows`), in which case the
 *     randomizer's set carries an `<apitem>` in its place (`apPlacementRewriter.rewriteRecordSet`): a non-solid
 *     `Pickups/APItem` taken on overlap from any side, so the Solid and its open side are the VANILLA set's.
 *
 * ⛔ A MEASUREMENT, NOT A GATE: exit 0 whatever it finds. Node only; it takes no box (no browser, no wasm).
 * The analysis is tile-level: an off-grid chest walls every tile its box touches, which over-states it (said per row).
 *
 * Run:
 *   node scripts/procgen/census-seedling-chest-open-side.mjs [--json=<path>]
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

/**
 * The census rows. Everything is read off the playthrough producer and the model; nothing here names a level.
 * @returns {Promise<Array<object>>}
 */
export async function chestOpenSideCensus() {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const M = (p) => import(join(REPO, p));
    const P = await import('./make-seedling-playthrough-rules.mjs');
    const { analyzeRegion } = await M('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
    const { buildLevelWorld } = await M('frontend/modules/seedlingDemo/levelWorld.js');
    const { playerBoxAt } = await M('frontend/modules/seedlingDemo/playerPhysicsV2.js');
    const { chestProbeLine, CHEST } = await M('frontend/modules/seedlingDemo/chest.js');
    const { keyLineTouches } = await M('frontend/modules/seedlingDemo/activators.js');
    const { apChestRows } = await M('frontend/modules/seedlingDemo/apChestDelivery.js');
    const map = P.PLAYTHROUGH_MAP;
    const TILE = map.tile_size;
    const layer = P.derivePlaythroughLayer(undefined, { quiet: true });
    const ledger = apChestRows(map);
    const key = ([x, y]) => `${x},${y}`;
    const rows = [];
    for (const level of [...map.levels].sort((a, b) => a.level - b.level)) {
        for (const chest of level.entities.filter((e) => e.type === 'chest')) {
            const region = layer.atlas.regions.find((r) => r.map_ref === level.level);
            const tiles = [];
            for (let ty = Math.floor(chest.y / TILE); ty * TILE < chest.y + CHEST.box.h; ty += 1) {
                for (let tx = Math.floor(chest.x / TILE); tx * TILE < chest.x + CHEST.box.w; tx += 1) tiles.push([tx, ty]);
            }
            const chestTiles = new Set(tiles.map(key));
            // The open side: free player positions on the probe line, the chest shut.
            const world = buildLevelWorld(level);
            const line = chestProbeLine(chest.x, chest.y);
            const stance = new Map();
            for (let y = line.y - TILE; y <= line.y + TILE; y += 1) {
                for (let x = chest.x - TILE; x <= chest.x + 2 * TILE; x += 1) {
                    const box = playerBoxAt(x, y);
                    if (!keyLineTouches(box, line) || world.collidesSolid(box, {}) !== null) continue;
                    const t = [Math.floor(x / TILE), Math.floor(y / TILE)];
                    stance.set(key(t), t);
                }
            }
            // The room as the rules read it, and with the chest's tiles walled.
            const options = P.playthroughAnalyzerOptionsFor(level);
            const grid = P.playthroughGridFor(level);
            const today = analyzeRegion(region, grid, options);
            const walledGrid = {
                ...grid,
                cells: grid.cells.map((c, i) => (chestTiles.has(`${i % grid.width},${Math.floor(i / grid.width)}`)
                    ? { ...c, kind: 'wall', conditions: [], manual: [] } : c)),
            };
            const location = (region.locations ?? []).find((l) => chestTiles.has(key(l.tile))) ?? null;
            const walledRegion = { ...region, locations: (region.locations ?? []).filter((l) => l !== location) };
            const walled = analyzeRegion(walledRegion, walledGrid, options);
            const compOf = (analysis, t) => analysis.components.find((c) => c.tiles.some((u) => key(u) === key(t))) ?? null;
            const kindAt = ([tx, ty]) => grid.cells[ty * grid.width + tx]?.kind ?? 'off-map';
            const home = tiles.map((t) => compOf(today, t)).find(Boolean) ?? null;
            // The open side's part: the walled room's sub-region each open-side tile lies in. A tile in none is a
            // crossing cell (gated/directional/manual): the open side is then reached through that crossing.
            const stanceParts = [...new Set([...stance.values()].map((t) => compOf(walled, t)?.id ?? `(${kindAt(t)} cell ${t})`))];
            const homeRest = (home?.tiles ?? []).filter((t) => !chestTiles.has(key(t)));
            const parts = [...new Set(homeRest.map((t) => compOf(walled, t)?.id ?? `(${kindAt(t)} cell ${t})`))];
            const walledPart = (b) => walled.bindings.find((w) => w.kind === b.kind && w.id === b.id)?.component?.id ?? '(unbound)';
            const members = today.bindings.filter((b) => b.component?.id === home?.id
                && !(b.kind === 'location' && location && b.id === location.name));
            const cutOff = members
                .filter((b) => !stanceParts.includes(walledPart(b)))
                .map((b) => `${b.kind} ${b.id}`);
            // No change: the chest's sub-region, less the chest, is one part and the open side is in it (or the chest
            // is alone in its sub-region and every way to it is a crossing the open side is on).
            const sameRoom = stance.size > 0 && cutOff.length === 0
                && (homeRest.length === 0
                    ? [...stance.values()].every((t) => kindAt(t) !== 'wall')
                    : parts.length === 1 && stanceParts.length === 1 && parts[0] === stanceParts[0]);
            const cellAt = ([tx, ty]) => grid.cells[ty * grid.width + tx] ?? null;
            const priceOf = (t) => (cellAt(t)?.conditions ?? []).map((c) => options.conditionKey(c)).sort().join(' + ') || 'free';
            const around = tiles.length === 1
                ? [['up', 0, -1], ['left', -1, 0], ['right', 1, 0], ['down', 0, 1]].map(([n, dx, dy]) => ({ side: n, tile: [tiles[0][0] + dx, tiles[0][1] + dy] }))
                : [];
            const neighbours = around.map((n) => `${n.side} ${kindAt(n.tile)}${['gated', 'directional'].includes(kindAt(n.tile)) ? ` [${priceOf(n.tile)}]` : ''}`);
            // A chest alone in its sub-region: a crossing into its cell from a side that is not the open side reaches
            // the location today and would not open it.
            const otherWays = homeRest.length === 0
                ? around.filter((n) => n.side !== 'down' && !['wall', 'sink', 'off-map'].includes(kindAt(n.tile))).map((n) => `${n.side} (${kindAt(n.tile)} [${priceOf(n.tile)}])`)
                : [];
            // An off-grid chest: the tile verdict over-states it, so the model's own flood answers (the player's box,
            // the chest shut) which tiles of the chest's sub-region the open side reaches.
            let modelUnreached = null;
            if (tiles.length > 1) {
                const homeKeys = new Set((home?.tiles ?? []).map(key));
                const reached = new Set(P.modelFloodTiles(level, [...stance.values()], (tx, ty) => homeKeys.has(`${tx},${ty}`)).map(key));
                modelUnreached = (home?.tiles ?? []).filter((t) => !reached.has(key(t)));
            }
            const fires = modelUnreached !== null ? (stance.size === 0 || modelUnreached.length > 0) : (!sameRoom || otherWays.length > 0);
            const ledgerRow = ledger.find((r) => r.level === level.level && r.entity === chest) ?? null;
            rows.push({
                level: level.level,
                chest: `chest@${chest.x},${chest.y}`,
                tag: chest.attrs?.tag ?? null,
                tiles,
                offGrid: tiles.length > 1,
                cover: level.entities.some((e) => e.type === 'cover' && e.x === chest.x && e.y === chest.y),
                openSideTiles: [...stance.values()],
                subRegions: today.components.map((c) => c.id),
                home: home?.id ?? null,
                homeSize: home?.tiles.length ?? 0,
                neighbours,
                openSideParts: stanceParts,
                separates: parts.length > 1,
                parts,
                members: members.map((b) => `${b.kind} ${b.id}`),
                cutOff,
                fires,
                otherWays,
                modelUnreached,
                location: location?.name ?? null,
                delivery: ledgerRow ? 'apitem' : 'chest',
                ledgerRow: ledgerRow?.row.id ?? null,
            });
        }
    }
    return rows;
}

async function main() {
    const rows = await chestOpenSideCensus();
    const jsonArg = process.argv.find((a) => a.startsWith('--json='));
    console.log(`CHESTS: ${rows.length} on the playthrough map`);
    for (const r of rows) {
        console.log(`L${r.level} ${r.chest} tag ${r.tag} · tiles ${r.tiles.map((t) => `(${t})`).join(' ')}`
            + `${r.offGrid ? ' OFF-GRID (every touched tile walled: over-stated)' : ''}${r.cover ? ' · under a cover' : ''}`);
        console.log(`    open side: ${r.openSideTiles.length ? r.openSideTiles.map((t) => `(${t})`).join(' ') : 'NONE (no free position on the line)'}`
            + ` · room sub-regions today ${r.subRegions.length}, the chest in ${r.home} (${r.homeSize} tile(s))`
            + `${r.neighbours.length ? ` · round it: ${r.neighbours.join(', ')}` : ''}`);
        console.log(`    walled: ${r.home} -> ${r.parts.join(' | ') || '(the chest was alone in it)'}${r.separates ? ' SEPARATES' : ''} · open side in ${r.openSideParts.join(' | ') || '(none)'}`);
        if (r.modelUnreached) console.log(`    the model's flood from the open side (the chest shut), inside ${r.home}: ${r.modelUnreached.length ? `does NOT reach ${r.modelUnreached.map((t) => `(${t})`).join(' ')}` : 'reaches every tile of it'}`);
        console.log(`    ${r.fires ? 'FIRES' : 'no change'}${!r.modelUnreached && r.cutOff.length ? ` · cut off from the open side: ${r.cutOff.join(', ')}` : ''}`
            + `${r.otherWays.length ? ` · reached today without the open side: ${r.otherWays.join(', ')}` : ''}`);
        console.log(`    delivery: ${r.delivery === 'apitem' ? `<apitem> (ledger row ${r.ledgerRow}, ${r.location}): non-solid, taken from any side` : 'a Chest Solid (no ledger row)'}`);
    }
    const fires = rows.filter((r) => r.fires);
    console.log(`FIRES (vanilla Chest Solid): ${fires.length} — ${fires.map((r) => `L${r.level}`).join(', ') || 'none'}`);
    console.log(`DELIVERED AS <apitem>: ${rows.filter((r) => r.delivery === 'apitem').length} of ${rows.length}`);
    if (jsonArg) writeFileSync(jsonArg.slice('--json='.length), `${JSON.stringify(rows, null, 1)}\n`);
}
