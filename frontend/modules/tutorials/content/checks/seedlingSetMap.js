/**
 * Feature check: the Seedling lab's level-set MAP (Seedling editor E3; ⚖ the
 * user, 2026-11-14: "How do I open the map in the Seedling lab? Can you add a
 * tutorial to the feature check list in the Tutorials panel?"). The steps'
 * text is the answer, click by click: the Procgen Lab — Seedling tab, its
 * Source drop-down set to EDIT, LOAD the VANILLA 116, the map view, fit, and
 * one room selected on the map.
 *
 * ⛔ The walk READS the page; it changes nothing about the map. Counts come
 * off the page (`__editorEdit.set`), and the room it selects is found on the
 * page's own map at run time (its cell, from `set.map.cells`), never a fixed
 * position: the map's layout is the page's, and may move.
 * ⛔ Imports only content files.
 */
import { look } from '../steps/procgen.js';

const LAB = { panel: 'procgenLabPanel', title: 'Procgen Lab — Seedling' };
const inLab = (selector) => ({ ...LAB, frame: 'iframe', selector });
const labStatus = { ...LAB, selector: '.procgen-lab-status' };

/** The lab page's window (the iframe's), or null. */
const labWindow = (ctx) => ctx.query(inLab('body'))?.ownerDocument?.defaultView ?? null;
/** The page's set-editor readout (`window.__editorEdit.set`), or null. */
const setOf = (ctx) => labWindow(ctx)?.__editorEdit?.set ?? null;
const sourceSelect = (ctx) => ctx.query(inLab('#source'));
const roomsSelect = (ctx) => ctx.query(inLab('#editSetRoom'));
/** The room the select step clicked (set by its `run`, read by its `done`). */
let pickedRoom = null;

/**
 * The room the walk selects: the first room the map links to from the room
 * selected when the set loaded, by a door. Read off the page's own map, so it
 * follows whatever set and layout the page holds.
 */
function neighbourOnMap(ctx) {
    const map = setOf(ctx)?.map;
    const from = Number(roomsSelect(ctx)?.value ?? 0);
    const link = map?.links?.find((l) => l.kind === 'exit' && l.from === from && l.to !== from && map.cells[l.to]);
    return link ? link.to : null;
}

/** Click room `room`'s cell on the map canvas, the way a person does: press, release, click, at its centre. */
function clickRoomOnMap(ctx, room) {
    const canvas = ctx.query(inLab('#editSetOverview'));
    const cell = setOf(ctx)?.map?.cells?.[room];
    if (!canvas || !cell) throw new Error(`the map has no cell for room ${room}`);
    const [x, y, w, h] = cell;
    const View = canvas.ownerDocument.defaultView;
    // Scroll the map's panel so the room is on screen (as a person would before clicking it).
    const wrap = canvas.parentNode;
    wrap.scrollIntoView?.({ block: 'center' });
    const r0 = canvas.getBoundingClientRect();
    const sx = r0.width / canvas.width;
    const sy = r0.height / canvas.height;
    wrap.scrollLeft = Math.max(0, (x + w / 2) * sx - wrap.clientWidth / 2);
    wrap.scrollTop = Math.max(0, (y + h / 2) * sy - wrap.clientHeight / 2);
    const r = canvas.getBoundingClientRect();
    const at = { clientX: r.left + (x + w / 2) * sx, clientY: r.top + (y + h / 2) * sy };
    for (const type of ['mousedown', 'mouseup', 'click']) {
        canvas.dispatchEvent(new View.MouseEvent(type, { bubbles: true, cancelable: true, view: View, button: 0, ...at }));
    }
}

export const CHECK_SEEDLING_SET_MAP = Object.freeze({
    id: 'seedling-set-map',
    title: 'Seedling lab: open the level-set map',
    summary: 'How to open the map in the Seedling lab: the Procgen Lab — Seedling tab, Source EDIT, LOAD the VANILLA 116 — the map shows every room, placed by its doors — then click a room to select it.',
    status: 'ready',
    doc: null,
    intro: [
        { prose: 'The Seedling lab\'s **map** shows a whole level set at once: one cell per room, placed by door direction from the start room, with lines for its doors, pits and named arrivals. It lives in the lab\'s set editor, which opens on the page\'s **EDIT** source.' },
    ],
    sections: [
        {
            id: 'open',
            title: 'Open the set editor',
            blocks: [
                ...look('open-lab', LAB, 'Open the **Procgen Lab — Seedling** tab (in Quick Launch if it is closed). Wait for its status line to say it is connected.',
                    (ctx) => ctx.text(labStatus).includes('· connected') && Boolean(sourceSelect(ctx))),
                {
                    step: {
                        id: 'source-edit',
                        text: 'At the top of the lab page, set the **Source** drop-down to **EDIT — a room, on its own**. The page switches to its editor, with the level-set section below the room.',
                        run: (ctx) => {
                            const sel = sourceSelect(ctx);
                            if (!sel) throw new Error('the Seedling lab has no Source drop-down');
                            if (sel.value === 'edit') return;
                            sel.value = 'edit';
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                        },
                        done: (ctx) => sourceSelect(ctx)?.value === 'edit' && labWindow(ctx)?.__editorEdit?.status === 'ok'
                            && Boolean(ctx.query(inLab('#editLoadVanilla'))),
                        doneTimeoutMs: 120000,
                    },
                },
                {
                    step: {
                        id: 'load-vanilla',
                        text: 'Press **LOAD the VANILLA 116 as `xml`**. The original game\'s rooms load as a level set: the rooms drop-down (*the LOADED SET\'s rooms*) lists every one of them.',
                        actions: [{ click: inLab('#editLoadVanilla') }],
                        done: (ctx) => {
                            const set = setOf(ctx);
                            return Boolean(set?.rooms) && set.edits === 0 && roomsSelect(ctx)?.options.length === set.rooms;
                        },
                        doneTimeoutMs: 120000,
                    },
                },
            ],
        },
        {
            id: 'map',
            title: 'The map',
            blocks: [
                {
                    step: {
                        id: 'map-view',
                        text: 'Scroll down to **the LEVEL SET** section. Its overview is the map while **map view** is ticked (it is by default; untick it for the strip, one cell per room in index order). Every room of the set has a cell on it.',
                        actions: [{ click: { ...inLab('#editSetMapView:not(:checked)'), optional: true } }],
                        done: (ctx) => {
                            const set = setOf(ctx);
                            return ctx.query(inLab('#editSetMapView'))?.checked === true
                                && set?.map?.cells?.length === set.rooms;
                        },
                    },
                },
                {
                    step: {
                        id: 'fit',
                        text: 'Press **fit** beside it to fit the whole map to the panel. **+** and **−** zoom (or Ctrl+wheel on the map); scroll the panel to pan.',
                        actions: [{ click: inLab('#editSetZoomFit') }],
                        done: (ctx) => ctx.text(inLab('#status')).startsWith('MAP fitted to the panel'),
                    },
                },
                {
                    step: {
                        id: 'select-room',
                        text: 'Click a room on the map — here, one that a door of the selected room leads to. It becomes the selected room (the rooms drop-down follows), and its links in and out are highlighted. A double click would open it in the room editor.',
                        run: (ctx) => {
                            const room = neighbourOnMap(ctx);
                            if (room === null) throw new Error('the selected room has no door to another room on the map');
                            pickedRoom = room;
                            clickRoomOnMap(ctx, room);
                        },
                        done: (ctx) => pickedRoom !== null && roomsSelect(ctx)?.value === String(pickedRoom)
                            && ctx.text(inLab('#status')).startsWith(`selected room ${pickedRoom} `),
                    },
                },
                { prose: '**RE-LAYOUT** lays the map out again from the doors (no positions are stored). With the map focused, **C** arms CONNECT and **D** DISCONNECT — editing the set\'s doors on the map itself.' },
            ],
        },
    ],
    outro: null,
});
