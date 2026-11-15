/**
 * mazeSeedlingLink — **THE MAZE LAB'S ROOM, OPENED IN THE SEEDLING EDITOR** (⚖ Robert 2026-11-14: "Link back: maze lab
 * → Seedling"). The reverse of `seedlingDemo/seedlingMazeLink.js`: a maze room converted from a Seedling level → the
 * Seedling editor's own URL for that level (`seedlingDemo/watch.html?source=edit&level=<N>`), or a stated reason why
 * there is none.
 *
 * ⛔ NO PRESET NAME, NO GAME NAME AND NO LEVEL LIST ARE WRITTEN HERE. "Converted from a Seedling level" is read off the
 * room's own documents, by the same two FIELDS the forward link joins on:
 * - the room (`playable_payload`) carries an integer `level` — the level number of the map it was converted from;
 * - its preset's rules declare, for the room's player, `region_atlas[p].map_document`, and that is the map the Seedling
 *   editor reads (`mapDocumentPath(null).name`, the editor's own default — the editor is never told another one).
 * Both must hold. A room with no integer `level` (every generated maze, every procgen preset room) is NOT converted:
 * no link and no note. A room that carries a level but whose map is unknown (a pasted sidecar: the map is in its
 * preset's rules, which a paste does not bring) or is another map is converted but CANNOT link, and says why.
 *
 * ⛔ The link names the level it opens, and only that: the Seedling editor opens the ORIGINAL level, so an edited
 * maze room carries a note that its edits are not carried over; a room-less region (opened as its shared level world's
 * room) and a level split across several maze rooms both open the WHOLE level, and say so.
 *
 * Pure: no fetch, no DOM. The page hands it the rules the preset link already fetched (no extra request).
 */

import { mapDocumentPath, regionAtlasOf } from '../flashPanel/mapDocumentPath.js';

/** The Seedling editor's page, relative to `frontend/`. */
export const SEEDLING_EDITOR_PAGE = 'modules/seedlingDemo/watch.html';

/** The Seedling editor URL (relative to `frontend/`) that opens vanilla level `level`. */
export function seedlingEditorUrl(level) {
    const q = new URLSearchParams({ source: 'edit', level: String(level) });
    return `${SEEDLING_EDITOR_PAGE}?${q.toString()}`;
}

/** The map document the Seedling editor reads (it is never handed a preset, so it is its default). */
export const seedlingEditorMap = () => mapDocumentPath(null).name;

/**
 * Where a maze room came from, as far as its own documents say.
 *
 * @param {object} args
 * @param {object} args.payload  the room (a sidecar's `playable_payload`, or a bare payload)
 * @param {object|null} [args.rules]  the preset's rules.json (null: the room was pasted, not opened by preset link)
 * @param {string|null} [args.player]  the slot whose sidecars hold the room
 * @returns {null | {level, linkable: true, mapDocument, url, siblings}
 *   | {level, linkable: false, reason}} null = not converted from a level-numbered map.
 */
export function seedlingOriginOf({ payload, rules = null, player = null }) {
    const level = payload?.level;
    if (!Number.isInteger(level)) return null;
    const editorMap = seedlingEditorMap();
    if (!rules) {
        return Object.freeze({
            level,
            linkable: false,
            reason: `this room carries level number ${level}, but a pasted room does not say which map that number `
                + 'indexes (its preset\'s rules do) — open it by preset link (?preset=…&region=…) to get the Seedling '
                + 'editor link',
        });
    }
    const declared = regionAtlasOf(rules, player)?.map_document;
    if (typeof declared !== 'string' || declared === '') {
        return Object.freeze({
            level,
            linkable: false,
            reason: `this room carries level number ${level}, but its preset declares no \`region_atlas.map_document\` `
                + `for player ${player}, so the number names no map`,
        });
    }
    if (declared !== editorMap) {
        return Object.freeze({
            level,
            linkable: false,
            reason: `this room was converted from level ${level} of ${declared}; the Seedling editor reads ${editorMap}`,
        });
    }
    const own = rules?.preset_sidecars?.[String(player)] ?? {};
    const siblings = Object.values(own)
        .filter((s) => s?.substrate === 'maze' && s?.playable_payload?.level === level).length;
    return Object.freeze({ level, linkable: true, mapDocument: declared, url: seedlingEditorUrl(level), siblings });
}

/**
 * What the page shows for the room on screen.
 *
 * @param {object} args
 * @param {object|null} args.origin  `seedlingOriginOf`'s answer for the room's base
 * @param {number} [args.edits]  the maze edits made to it on this page
 * @param {object|null} [args.presetLink]  `{region, room, sharedWorld}` when it was opened by preset link
 * @returns {{shown: false} | {shown: true, ok: false, level, reason}
 *   | {shown: true, ok: true, level, url, label, notes: string[]}}
 */
export function seedlingLinkFor({ origin, edits = 0, presetLink = null }) {
    if (!origin) return Object.freeze({ shown: false });
    if (!origin.linkable) {
        return Object.freeze({ shown: true, ok: false, level: origin.level, reason: origin.reason });
    }
    const { level } = origin;
    const notes = [];
    if (presetLink && presetLink.room !== presetLink.region) {
        notes.push(`region ${presetLink.region} has no room of its own: it opened room ${presetLink.room} of the shared `
            + `level world ${presetLink.sharedWorld}, so the link opens that room's level, ${level} (the whole level)`);
    }
    if (origin.siblings > 1) {
        notes.push(`level ${level} is split across ${origin.siblings} maze rooms in this preset; each links to the whole `
            + `level ${level}`);
    }
    if (edits > 0) {
        notes.push(`the Seedling editor opens the ORIGINAL level ${level}: this room's ${edits} maze edit(s) are not `
            + 'carried over');
    }
    return Object.freeze({
        shown: true,
        ok: true,
        level,
        url: origin.url,
        label: `open level ${level} in the Seedling editor ↗`,
        notes: Object.freeze(notes),
    });
}
