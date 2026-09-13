/**
 * textAdventureSubstrateWrapper/textAdventureCompositeMap — **THE TEXT
 * ADVENTURE'S OWN CELL ON THE COMPOSITE MAP** (APWORLD EDITOR HUB slice H3;
 * ⚖ *"each substrate declares whether it supports map rendering … I don't want
 * to hardcode support for map rendering for specific substrates."*).
 *
 * This function WAS `procgenPipelineUI.js`'s `_drawTextAdventureRegion`,
 * reached by a hand-written `hint === 'text_adventure'` branch. It moved here
 * whole; `textAdventureSubstrateWrapperLibrary.js` DECLARES it as
 * `compositeMap.drawRegion`. See `mazeRoom/mazeCompositeMap.js` for the other
 * half of the same move, and `procgenCore/compositeMapRenderer.js` for what is
 * left over once no substrate is named.
 *
 * ⛓ A text-adventure region has no tile geometry to draw — it has LOCATIONS.
 * So the cell is a parchment card: the region id, a location count, then the
 * location names until the cell runs out of room, with locked ones marked. The
 * exits land on their SIDES (`resolveExitTilePositions`' side fallback) so the
 * connection lines (drawn by the shared renderer) meet something.
 *
 * ⛓⛓ PRESET SIDECARS G2a — **PAYLOAD-FREE**: the cell is painted from the ROOM
 * (`textAdventureRoom.js`: `{exits: Map, locations[]}`), which is what both the
 * pipeline's live build (`playable_payload: core.world`) and a loaded document
 * (`compositeMapDocument` → the entry's own `deserializeWorld`) hand it. Until
 * G2a it read the maze's tile payload (`items` / `itemLocationNames` /
 * `obstacles` / `obstacleLib` / `entrance`) — none of which a room has, so a
 * regenerated text-adventure cell drew "0 locations". A gate is the AUTHORED
 * `access_rule` on the exit / location, drawn closed when it does not hold on
 * an empty inventory — the same evaluator a maze logic gate's `clear_rule`
 * went through, so the picture's vocabulary is unchanged. No entrance mark: a
 * room has no entrance tile.
 *
 * ⛔ No DOM at module load — the library that declares this stays
 * node-importable for the capability-matrix generator.
 */

import { evaluateRuleAgainstInventory } from '../shared/procgen/library.js';
import {
    TILE_PX, COLORS, resolveExitTilePositions, fitTextToWidth,
} from '../procgenCore/compositeMapRenderer.js';

/** The inventory a composite map is drawn against: nothing collected. */
const EMPTY_INVENTORY = new Set();

/** A gate is closed when its authored rule does not hold on nothing. Absent = open. */
const gateClosed = (rule) => !!rule && !evaluateRuleAgainstInventory(rule, EMPTY_INVENTORY);

/**
 * Paint one text-adventure region into its composite-map cell.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} region the grid region (its `playable_payload` is the ROOM:
 *   `exits` (Map or array of sided records, `access_rule?`) and `locations`
 *   (`{id, name?, access_rule?}`)).
 * @param {{offX:number, offY:number, regionSize:{width,height},
 *   tilePx?:number, colors?:object}} geom
 */
export function drawTextAdventureCompositeRegion(ctx, region, {
    offX, offY, regionSize, tilePx = TILE_PX, colors = COLORS,
} = {}) {
    const room = region?.playable_payload ?? {};
    const cellW = regionSize.width * tilePx;
    const cellH = regionSize.height * tilePx;

    ctx.fillStyle = colors.textAdventureBg;
    ctx.fillRect(offX, offY, cellW, cellH);

    for (const { exit, x, y } of resolveExitTilePositions(room.exits, regionSize).filter(Boolean)) {
        ctx.fillStyle = gateClosed(exit.access_rule) ? colors.exitBlocked : colors.exit;
        ctx.fillRect(offX + x * tilePx, offY + y * tilePx, tilePx, tilePx);
    }

    // A deserialized room's location carries its AP `name`; the live build's
    // carries only its `id` (the AP name is baked at serialize).
    const locationNames = [];
    const lockedLocations = new Set();
    for (const location of Array.isArray(room.locations) ? room.locations : []) {
        const locationName = location?.name ?? location?.id;
        if (!locationName) continue;
        locationNames.push(locationName);
        if (gateClosed(location.access_rule)) lockedLocations.add(locationName);
    }

    const padX = 6;
    const padY = 6;
    const headerSize = 11;
    const lineSize = 10;
    const lineGap = 2;
    let textY = offY + padY;

    ctx.save();
    ctx.fillStyle = colors.textAdventureFg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.font = `bold ${headerSize}px sans-serif`;
    const heading = region?.region_id ?? region?.name ?? '(region)';
    const headingLine = fitTextToWidth(ctx, heading, cellW - padX * 2);
    if (headingLine && textY + headerSize <= offY + cellH - padY) {
        ctx.fillText(headingLine, offX + padX, textY);
        textY += headerSize + lineGap;
    }

    ctx.font = `${lineSize}px sans-serif`;
    const summary = `${locationNames.length} location${locationNames.length === 1 ? '' : 's'}`;
    if (textY + lineSize <= offY + cellH - padY) {
        ctx.fillText(summary, offX + padX, textY);
        textY += lineSize + lineGap;
    }

    const maxY = offY + cellH - padY;
    let truncated = 0;
    for (let i = 0; i < locationNames.length; i++) {
        const name = locationNames[i];
        const remaining = locationNames.length - i;
        if (textY + lineSize > maxY) {
            truncated = remaining;
            break;
        }
        // Last visible slot may need to host a "+N more" instead.
        const isLastSlot = textY + lineSize * 2 + lineGap > maxY;
        if (isLastSlot && remaining > 1) {
            ctx.fillStyle = colors.textAdventureFgDim;
            ctx.fillText(`+${remaining} more`, offX + padX, textY);
            truncated = 0;
            textY += lineSize + lineGap;
            break;
        }
        const prefix = lockedLocations.has(name) ? '\u{1F512} ' : '• ';
        ctx.fillStyle = lockedLocations.has(name) ? colors.locationBlocked : colors.textAdventureFg;
        ctx.fillText(fitTextToWidth(ctx, prefix + name, cellW - padX * 2), offX + padX, textY);
        textY += lineSize + lineGap;
    }
    if (truncated > 0) {
        ctx.fillStyle = colors.textAdventureFgDim;
        ctx.fillText(`+${truncated} more`, offX + padX, textY);
    }
    ctx.restore();
}
