/**
 * mazeLabPreset — **A LINK THAT OPENS A PRESET'S MAZE ROOM** (maze converted rooms, step 2 of 3; ⚖ Robert 2026-11-12
 * "Build it properly").
 *
 * `lab.html?source=edit&preset=<preset id>&region=<region name>` names a committed preset and one region of it; the
 * page fetches `presets/preset_files.json`, then that preset's rules.json, picks the region's sidecar out of
 * `preset_sidecars[player][region]` and hands it to `mazeLab.loadPayload` — the ONE loader step 1 built (traps and
 * every engine entity field intact).
 *
 * ⛔ NO PRESET NAME IS WRITTEN HERE. Everything is read off the two documents by SHAPE:
 * - the preset id is a key of `preset_files.json` (`<id>` or `<id>/<folder>` when it has several folders);
 * - the folder's rules file is the one `*_rules.json` it lists (a `_P<n>_rules.json` per-player slice is not it);
 * - the region is a key of exactly one player's `preset_sidecars`;
 * - a sidecar that carries `playable_payload` IS a room; one that carries only `shared_world` is a region of a
 *   shared level world, and its room is the ONE sidecar of the same player whose
 *   `playable_payload.shared_world.regions` lists it. Zero or several such holders refuse by name (measured on the
 *   committed `seedling_playthrough_maze`: every room-less region has exactly one).
 * Every refusal is a `MazeLabError` naming the parameter and the value, so a hand-written link says what it got wrong.
 *
 * ⚠ The fetches are INJECTED (`fetchJson(path)` resolves a `frontend/`-relative path), so the unit rows run this file
 * over the real committed documents from disk and the page runs it over HTTP — one resolver, two transports.
 */

import { MazeLabError } from './mazeLab.js';

/** The preset index, relative to `frontend/` (the dev index; the page's other repo paths resolve the same way). */
export const PRESET_INDEX_PATH = 'presets/preset_files.json';

const refuse = (msg) => { throw new MazeLabError(`mazeLab ?preset=: ${msg}`); };

/** A folder's own rules file: `*_rules.json` / `rules.json`, never a `_P<n>_rules.json` per-player slice. */
const isWholeRulesFile = (f) => typeof f === 'string' && (f === 'rules.json' || f.endsWith('_rules.json'))
    && !/_P\d+_rules\.json$/.test(f);

/**
 * `?preset=` → the rules file to fetch. `spec` is `<id>` or `<id>/<folder>`. Returns
 * `{ preset, folder, file, path }` with `path` relative to `frontend/`.
 */
export function presetRulesPath(index, spec) {
    if (!index || typeof index !== 'object') refuse('the preset index is not an object');
    const [preset, folder, ...rest] = String(spec ?? '').split('/');
    if (!preset || rest.length) {
        refuse(`${JSON.stringify(spec)} is not a preset id — write \`<id>\` or \`<id>/<folder>\` as `
            + '`presets/preset_files.json` names them');
    }
    const entry = Object.prototype.hasOwnProperty.call(index, preset) ? index[preset] : null;
    if (!entry || typeof entry !== 'object') {
        refuse(`${JSON.stringify(preset)} is not a preset in presets/preset_files.json`);
    }
    const folders = Object.keys(entry.folders ?? {});
    let chosen = folder;
    if (chosen === undefined || chosen === '') {
        if (folders.length !== 1) {
            refuse(`${JSON.stringify(preset)} has ${folders.length} folders (${folders.join(', ') || 'none'}) — name `
                + `one: \`?preset=${preset}/<folder>\``);
        }
        [chosen] = folders;
    } else if (!folders.includes(chosen)) {
        refuse(`${JSON.stringify(preset)} has no folder ${JSON.stringify(chosen)} (it has: ${folders.join(', ') || 'none'})`);
    }
    const files = (entry.folders[chosen].files ?? []).filter(isWholeRulesFile);
    if (files.length !== 1) {
        refuse(`${preset}/${chosen} lists ${files.length} rules files (${files.join(', ') || 'none'}) — the link opens `
            + 'a folder with exactly one');
    }
    return Object.freeze({ preset, folder: chosen, file: files[0], path: `presets/${preset}/${chosen}/${files[0]}` });
}

/**
 * `?region=` in a fetched rules document → the sidecar `loadPayload` takes, and where it came from.
 * Returns `{ player, region, room, sharedWorld, sidecar }`: `room` is the sidecar key whose `playable_payload` is
 * loaded (`=== region` for a room-bearing region), `sharedWorld` the level world it belongs to (or null).
 */
export function resolvePresetRegion(rules, region, { preset = '?' } = {}) {
    const sidecars = rules?.preset_sidecars;
    if (!sidecars || typeof sidecars !== 'object' || !Object.keys(sidecars).length) {
        refuse(`${preset} carries no \`preset_sidecars\` — it is not a procgen preset, so it has no rooms to open`);
    }
    if (typeof region !== 'string' || !region) refuse('?region= names nothing');
    const players = Object.keys(sidecars).filter((p) => Object.prototype.hasOwnProperty.call(sidecars[p] ?? {}, region));
    if (players.length === 0) {
        const n = Object.values(sidecars).reduce((a, s) => a + Object.keys(s ?? {}).length, 0);
        refuse(`${preset} has no region ${JSON.stringify(region)} (its preset_sidecars hold ${n} regions)`);
    }
    if (players.length > 1) {
        refuse(`${preset}: region ${JSON.stringify(region)} is in the sidecars of ${players.length} players `
            + `(${players.join(', ')}) — the link opens a region that names one room`);
    }
    const [player] = players;
    const own = sidecars[player];
    const sidecar = own[region];
    if (sidecar?.substrate !== 'maze') {
        refuse(`${preset}: region ${JSON.stringify(region)} is a ${JSON.stringify(sidecar?.substrate)} sidecar — the `
            + 'maze lab opens maze rooms (`substrate: "maze"`)');
    }
    if (sidecar.playable_payload !== undefined) {
        return Object.freeze({ player, region, room: region, sharedWorld: sidecar.shared_world ?? null, sidecar });
    }
    if (typeof sidecar.shared_world !== 'string') {
        refuse(`${preset}: region ${JSON.stringify(region)} has neither a room (\`playable_payload\`) nor a `
            + '`shared_world` that names one');
    }
    const holders = Object.keys(own).filter((k) => {
        const regions = own[k]?.playable_payload?.shared_world?.regions;
        return Array.isArray(regions) && regions.includes(region);
    });
    if (holders.length !== 1) {
        refuse(`${preset}: region ${JSON.stringify(region)} is part of the shared level world `
            + `${JSON.stringify(sidecar.shared_world)}, and ${holders.length} rooms list it `
            + `(${holders.join(', ') || 'none'}) — the link opens the ONE room that does`);
    }
    const room = holders[0];
    return Object.freeze({ player, region, room, sharedWorld: sidecar.shared_world, sidecar: own[room] });
}

/**
 * The whole route: index → rules → sidecar. `fetchJson(path)` takes a `frontend/`-relative path and resolves the
 * parsed document (or throws its own transport error, which is re-thrown naming the document it was fetching).
 * Returns `resolvePresetRegion`'s answer plus `{ preset, folder, path }`.
 */
export async function openPresetRegion({ preset, region, fetchJson }) {
    const get = async (path, what) => {
        try {
            return await fetchJson(path);
        } catch (e) {
            return refuse(`${JSON.stringify(preset)} — could not fetch ${what} ${path} (${e.message})`);
        }
    };
    const where = presetRulesPath(await get(PRESET_INDEX_PATH, 'the preset index'), preset);
    const hit = resolvePresetRegion(await get(where.path, 'the rules file'), region, { preset: where.preset });
    return Object.freeze({ ...hit, preset: where.preset, folder: where.folder, path: where.path });
}

/** The status line a link-opened room carries. */
export function describePresetLink(link) {
    const via = link.room === link.region ? ''
        : ` — region ${link.region} has no room of its own; it is part of the shared level world `
            + `${link.sharedWorld}, whose room is ${link.room}`;
    return `opened preset ${link.preset}/${link.folder} room ${link.room}${via} — UNCERTIFIED until SOLVE`;
}
