/**
 * seedlingMazeLink — **THE SEEDLING EDITOR'S ROOM, OPENED IN THE MAZE LAB** (⚖ Robert 2026-11-14: "Seedling editor →
 * maze lab link"). The EDIT arm's open room → the maze lab URL(s) of its converted maze room(s), or a stated reason
 * why there is none. The maze lab's own link (`lab.html?source=edit&preset=<id>&region=<region>`, resolved by
 * `mazeRoom/mazeLabPreset.js`) is the target; this file only FINDS which preset + region to put in it.
 *
 * ⛔ NO PRESET NAME AND NO LEVEL LIST ARE WRITTEN HERE. Both halves of the join are read off documents:
 * - **Which vanilla level the room IS** — by CONTENT: the room's `{width, height, layers, entities}` against the map
 *   document's levels (the game's rooms, and the same levels with the delivered set's patches applied). A set room's
 *   record carries no level number or path, so content is the one join every base kind shares (an `atlas` base, a
 *   room of a loaded vanilla set, a pasted OEL of a vanilla room). The room's BASE record is what is matched, so an
 *   edited room still names the level it was opened from, and the link says the maze lab shows the unedited one.
 * - **Which maze rooms convert that level** — every preset folder of the index that `has_procgen_data` for the map
 *   document's own `game`; in its rules, every player whose `region_atlas.map_document` is the map this page reads;
 *   every `substrate: "maze"` sidecar with an integer `playable_payload.level`. Each is checked through the maze
 *   lab's own `resolvePresetRegion` (so a link offered here is one the lab opens, never its FATAL path).
 *
 * ⚠ The fetches are INJECTED (`fetchJson(path)` with a `frontend/`-relative path), as `openPresetRegion`'s are, so the
 * unit rows read the committed documents from disk and the page fetches them over HTTP, on demand only.
 */

import { PRESET_INDEX_PATH, presetRulesPath, resolvePresetRegion } from '../mazeRoom/mazeLabPreset.js';
import { mapDocumentPath } from '../flashPanel/mapDocumentPath.js';
import { SEEDLING_SET_PATCHES, applySetPatches } from './seedlingSetPatches.js';

/** The maze lab page, relative to `frontend/`. */
export const MAZE_LAB_PAGE = 'modules/mazeRoom/lab.html';

/** A room's content key: what the game draws and builds, nothing that names it. */
export const roomContentKey = (r) => JSON.stringify([r?.width, r?.height, r?.layers, r?.entities]);

const levelIndexes = new WeakMap();
/**
 * `mapDoc` → `{ game: Map<key, level>, delivered: Map<key, level>, patchIds: Map<level, id[]> }`. The delivered index
 * holds only the levels a patch changes (the rest are the game's own).
 */
function indexesOf(mapDoc, patches) {
    const hit = levelIndexes.get(mapDoc);
    if (hit && hit.patches === patches) return hit;
    const levels = Array.isArray(mapDoc?.levels) ? mapDoc.levels : [];
    const game = new Map();
    for (const l of levels) game.set(roomContentKey(l), l.level);
    const patchIds = new Map();
    for (const p of patches) patchIds.set(p.level, [...(patchIds.get(p.level) ?? []), p.id]);
    const delivered = new Map();
    for (const l of applySetPatches(levels, patches)) {
        if (patchIds.has(l.level)) delivered.set(roomContentKey(l), l.level);
    }
    const out = { game, delivered, patchIds, patches };
    levelIndexes.set(mapDoc, out);
    return out;
}

/**
 * A room record → `{ level, delivered, patchIds }` (the vanilla level its content is; `delivered` when it is the
 * randomizer's patched version of it; `patchIds` the patches the delivered set applies to that level), or null.
 */
export function identifyVanillaLevel(record, mapDoc, { patches = SEEDLING_SET_PATCHES } = {}) {
    if (!record) return null;
    const ix = indexesOf(mapDoc, patches);
    const key = roomContentKey(record);
    if (ix.game.has(key)) {
        const level = ix.game.get(key);
        return { level, delivered: false, patchIds: ix.patchIds.get(level) ?? [] };
    }
    if (ix.delivered.has(key)) {
        const level = ix.delivered.get(key);
        return { level, delivered: true, patchIds: ix.patchIds.get(level) ?? [] };
    }
    return null;
}

/** The maze lab URL (relative to `frontend/`) that opens `region` of preset `spec`. */
export function mazeLabUrl(spec, region) {
    const q = new URLSearchParams({ source: 'edit', preset: spec, region });
    return `${MAZE_LAB_PAGE}?${q.toString()}`;
}

/**
 * The index + rules → every converted maze room, by level. `mapName` is the map document this page reads
 * (`mapDocumentPath(null).name` on the page). Returns
 * `{ byLevel: Map<level, [{spec, preset, folder, region, sharedWorld}]>, searched: [spec], skipped: [{spec, why}] }`;
 * within a level the rooms are ordered by their preset's coverage (most levels first), then spec, then region.
 */
export async function findMazeCounterparts({ mapDoc, mapName, fetchJson }) {
    const index = await fetchJson(PRESET_INDEX_PATH);
    const game = mapDoc?.game;
    const searched = [];
    const skipped = [];
    const rooms = [];
    for (const [id, entry] of Object.entries(index ?? {})) {
        const folders = Object.entries(entry?.folders ?? {});
        for (const [folder, fe] of folders) {
            if (!fe?.has_procgen_data || !(fe.games ?? []).some((g) => g?.game === game)) continue;
            const spec = folders.length === 1 ? id : `${id}/${folder}`;
            let rules;
            try {
                rules = await fetchJson(presetRulesPath(index, spec).path);
            } catch (e) {
                skipped.push({ spec, why: e.message });
                continue;
            }
            searched.push(spec);
            for (const [player, sidecars] of Object.entries(rules?.preset_sidecars ?? {})) {
                if (mapDocumentPath(rules, player).name !== mapName) continue;
                for (const [region, sc] of Object.entries(sidecars ?? {})) {
                    const level = sc?.playable_payload?.level;
                    if (sc?.substrate !== 'maze' || !Number.isInteger(level)) continue;
                    try {
                        const hit = resolvePresetRegion(rules, region, { preset: spec });
                        if (hit.room !== region) throw new Error(`${region} opens room ${hit.room}`);
                        rooms.push({ level, spec, preset: id, folder, region, sharedWorld: hit.sharedWorld });
                    } catch (e) {
                        skipped.push({ spec, region, why: e.message });
                    }
                }
            }
        }
    }
    const coverage = new Map();
    for (const r of rooms) coverage.set(r.spec, (coverage.get(r.spec) ?? new Set()).add(r.level));
    rooms.sort((a, b) => (coverage.get(b.spec).size - coverage.get(a.spec).size)
        || a.spec.localeCompare(b.spec) || a.region.localeCompare(b.region));
    const byLevel = new Map();
    for (const { level, ...room } of rooms) byLevel.set(level, [...(byLevel.get(level) ?? []), Object.freeze(room)]);
    return Object.freeze({ byLevel, searched, skipped });
}

/**
 * The link for the room the editor holds. `baseRecord` is the room as opened (before this session's edits), `edits`
 * the session's op count, `baseKind` the base tag's kind. Returns
 * `{ ok: true, level, options: [{label, url, spec, region}], notes: [string] }` or `{ ok: false, reason }`.
 */
export function mazeLinkFor({ baseRecord, baseKind, edits = 0, mapDoc, counterparts, patches = SEEDLING_SET_PATCHES }) {
    if (baseKind === 'generate') {
        return { ok: false, reason: 'a GENERATED room has no maze conversion — the maze presets convert the game\'s '
            + 'own rooms' };
    }
    const id = identifyVanillaLevel(baseRecord, mapDoc, { patches });
    if (!id) {
        return { ok: false, reason: 'this room matches no vanilla level by content, so no maze conversion of it exists' };
    }
    const found = counterparts.byLevel.get(id.level) ?? [];
    if (!found.length) {
        return { ok: false, reason: `no maze preset converts level ${id.level} (searched: `
            + `${counterparts.searched.join(', ') || 'none'})` };
    }
    const notes = [];
    if (edits > 0) {
        notes.push(`the maze lab opens the UNEDITED original of level ${id.level}: this room's ${edits} edit(s) are `
            + 'not in it');
    }
    if (id.delivered) {
        notes.push(`this is level ${id.level} as the randomizer DELIVERS it (${id.patchIds.join(', ')})`);
    } else if (id.patchIds.length) {
        notes.push(`the randomizer delivers level ${id.level} patched (${id.patchIds.join(', ')}); a maze conversion `
            + 'made from the delivered rooms shows that change');
    }
    const options = found.map((r) => ({
        label: `${r.spec} · ${r.region}${r.sharedWorld ? ` (shared level world ${r.sharedWorld})` : ''}`,
        url: mazeLabUrl(r.spec, r.region),
        spec: r.spec,
        region: r.region,
    }));
    return { ok: true, level: id.level, options, notes };
}
