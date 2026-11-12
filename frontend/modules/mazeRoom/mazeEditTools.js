/**
 * mazeRoom/mazeEditTools — **WHICH OF `editorView`'s SHARED RECTANGLE TOOLS THE
 * MAZE LAB TURNS ON, AND THE SENTENCES THAT ARE THE MAZE'S** (maze editor
 * tools, step B2 of A → B → C).
 *
 * B1 moved Seedling editor E1's FILL / CLEAR / MOVE / paste-mode wiring into
 * `procgenCore/editorView.js` as OPT-IN tools. This file is the maze's opt-in,
 * kept apart from `mazeLabView.js` so the node-side surface pin
 * (`mazeEditorSurface.test.js`) mounts the SAME list the page does rather than
 * a copy of it.
 *
 * ⛓ THE CENSUS (measured against `mazeEditAdapter`; the as-built has the rows):
 *  · **FILL — ON.** Its target is the page's `floodTarget()`, which on the maze
 *    names a TILE (the FLOOR or WALL palette entry), exactly what FLOOD paints.
 *    An entity palette entry names no target and FILL refuses with
 *    `MAZE_FILL_REFUSAL`. ⚠ A rect of ENTITIES is not offered: the maze's
 *    allocating entities (BUTTON, FLAG) would mint one door/flag per cell and
 *    the ENTRANCE is a singleton, and `editorView` asks one `floodTarget` for
 *    both FLOOD and FILL.
 *  · **CLEAR — ON** (`mazeEditAdapter.clearOps`): `entity` → `clearEntity`
 *    (the entrance stays: it has nowhere to go), `tile` → a wall becomes floor.
 *  · **MOVE — ON**: the cut is those clears, the paste is the ADD paste the lab
 *    already had, as ONE group; the maze's own refusals (a wall on an exit, an
 *    item on an exit, a wall on the entrance) refuse the whole group.
 *  · **REPLACE paste — OFF.** `mazeWriteOps` already empties the entity field
 *    before writing one and always writes the tile, so a REPLACE lands the same
 *    world as an ADD: the select would offer a choice that changes nothing.
 *    Pinned in `mazeEditTools.test.js`.
 */

import { EDIT_TOOLS } from '../procgenCore/editorView.js';

/** ⛓ The shared tools the maze lab's EDIT arm names, in the order its buttons show them. */
export const MAZE_EDIT_TOOLS = Object.freeze([EDIT_TOOLS.FILL, EDIT_TOOLS.CLEAR, EDIT_TOOLS.MOVE]);

/** ⛓ FILL's sentence when the palette names something that is not a tile. */
export const MAZE_FILL_REFUSAL = 'FILL paints a TILE — pick FLOOR or WALL in the palette first '
    + '(an item, obstacle, block, button, flag or the entrance is placed one cell at a time '
    + 'with the BRUSH)';
