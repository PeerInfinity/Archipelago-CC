/**
 * Maze ↔ procgen-pipeline integration: the maze's procgen parameters and
 * the panel controls for them, attached to the maze registry entry as
 * optional adapter hooks so the Procgen Pipeline driver and panel name no
 * substrate (bounceProcgenParams.js / runnerProcgenParams.js are the model;
 * assembled centrally by sphereConfigHooks.js).
 *
 * ⛓ PROCGEN PIPELINE PRESETS C1. These pieces used to live in the pipeline:
 * the connection flags and the hazard params in presetRun.js's
 * DEFAULT_PARAMS, the flags gated there by a helper that asked
 * `e.substrate === 'maze'`, and every control in the panel (the hazards
 * behind a `localRenderers = { maze: … }` table). The maze declares:
 *
 *   - defaultProcgenParams       — the panel merges this into its defaults.
 *   - renderProcgenParams        — the hazard controls (maze content modules
 *     Phase 2e), in the panel's per-substrate "maze parameters" subsection.
 *     The hazard params build ENGINE vocabulary (presetRun's
 *     effectiveHazardOpts → hazardOpts, which only a substrate declaring
 *     `applyContentModules` acts on), so the maze has no buildRegionParams.
 *   - buildLibraryRegionParams   — the regionParams a SELECTED maze library
 *     entry reads. Consulted for the substrates of the selected sphere
 *     libraries, not the active quotas: a maze pack realises maze regions
 *     with no maze quota, and nothing but the library instantiate reads
 *     these flags.
 *   - renderLibraryProcgenParams — the controls for those flags, shown in
 *     the panel's Region libraries subsection.
 *
 * Pure logic + call-time DOM only (no top-level document/window access) so
 * headless CLI drivers can import the maze library without panel code. The
 * row helpers are the shared per-region form's (`procgenCore/
 * regionGenerationForm.js`, apworld substrate R1), not a private copy.
 */

import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';
import { BIOMES } from '../procgenCore/skeletonKinds.js';
import {
    MAZE_BIOME_KEY, REGION_BIOMES, TILE_KINDS_DOMAINS, TILE_KINDS_KEY, mazeBiomeIds, placesTileKinds,
} from './mazeRegionBiomes.js';

// ── Panel parameter defaults ────────────────────────────────────────
export const DEFAULT_MAZE_PROCGEN_PARAMS = Object.freeze({
    // Maze region-library connection strictness (region-library F6c), read by
    // instantiateTileGridLibraryEntryForSpecs (mazeLibraryEntry.js) in sphere
    // mode. Both DEFAULT false = best-effort: a captured maze opening is aligned
    // to the needed wall when possible and relabelled onto a side-based
    // connection otherwise. true = require alignment (a captured maze can't
    // satisfy tile-align without a carve, so it throws).
    mazeRequireSameWall: false,
    mazeRequireTileAlign: false,
    // Hazard module (maze content modules Phase 2). When enabled, every maze
    // region gets `hazardCount` hazards placed by hazardPathGen through the
    // entry's applyContentModules. Disabled by default — existing presets stay
    // hazard-free unless the caller opts in.
    enableHazards: false,
    hazardCount: 3,
    hazardMaxConsecutiveFails: 10,
    hazardWallOverlapAllowed: false,
    // How a SPIRAL world's maze rooms are entered (⚖ the user, 2026-10-10,
    // tutorial-bugs): 'zone' = every arrival lands on the room's entrance, the
    // point its compiled logic is measured from; 'region' = land on the exit
    // leading back to where the player came from (the seedling-pipeline T2b
    // arm, which the logic does not model). Stamped as the payload's `arrival`
    // only for 'zone', only in a world with no linked reverse exits (the
    // spiral): a linked world's arrival exit is already the one its logic
    // uses. The APWorld Editor can set it per room.
    mazeArrival: 'zone',
});

/** ⛓ The values of `mazeArrival` (and of a maze payload's `arrival`). */
export const MAZE_ARRIVALS = Object.freeze(['zone', 'region']);

/** ⛓ The class the *Maze rooms play as* row carries (the R1 pins splice it out by it). */
export const MAZE_ARRIVAL_ROW_CLASS = 'procgen-pipeline-maze-arrival-row';

/** ⛓ CONTENT SETS GEN-1 — the class the *Maze biome* block carries (the R1 pins splice it out by it, as the arrival row). */
export const MAZE_BIOME_ROW_CLASS = 'procgen-pipeline-maze-biome-row';

/** The rows the *Maze biome* list editor shows for a bag: one `{id, weight}` per row (`classic` alone by default). */
export function mazeBiomeRows(params) {
    const v = params?.[MAZE_BIOME_KEY];
    if (typeof v === 'string' && v) return [{ id: v, weight: 1 }];
    if (Array.isArray(v) && v.length) return v.map((r) => (typeof r === 'string' ? { id: r, weight: 1 } : { id: r?.id, weight: r?.weight ?? 1 }));
    return [{ id: 'classic', weight: 1 }];
}

/**
 * ⛓⛓ CONTENT SETS GEN-1 (⚖ Robert 2026-11-22: "controlled by the biome, and the generation settings"; Q8 "A
 * per-room mix") — **THE MAZE BIOME, A SMALL LIST EDITOR.** One row = one biome for every maze room; two or more =
 * a mix, each room picked by hash of the seed and its name, by weight. Writes `params.mazeBiome` (one id for one row,
 * else `[{id, weight}]`; `classic` alone is the default and records nothing). While a row's biome places tile kinds
 * ("Randomly placed tiles"), its three numbers show, written to `params.tileKinds`. A bad setting (a biome twice)
 * is refused by name when the world is generated, never here.
 */
function renderMazeBiomeBlock(params, onChange) {
    const wrap = document.createElement('div');
    wrap.className = MAZE_BIOME_ROW_CLASS;
    const nameOf = (id) => REGION_BIOMES[id]?.name ?? BIOMES[id]?.name ?? id;
    const draw = () => {
        if (typeof wrap.replaceChildren === 'function') wrap.replaceChildren();
        else for (const c of [...wrap.children]) c.remove();
        const rows = mazeBiomeRows(params);
        const write = (next) => {
            params[MAZE_BIOME_KEY] = next.length === 1 ? next[0].id : next.map((r) => ({ id: r.id, weight: r.weight }));
            onChange();
            draw();
        };
        rows.forEach((row, i) => {
            const line = document.createElement('div');
            line.className = 'procgen-pipeline-maze-biome';
            const select = document.createElement('select');
            select.dataset.paramKey = MAZE_BIOME_KEY;
            for (const id of mazeBiomeIds()) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = nameOf(id);
                select.appendChild(option);
            }
            select.value = row.id;
            select.addEventListener('change', () => write(rows.map((r, j) => (j === i ? { ...r, id: select.value } : r))));
            line.appendChild(select);
            if (rows.length > 1) {
                const weight = document.createElement('input');
                weight.type = 'number';
                weight.min = '1';
                weight.step = '1';
                weight.title = 'weight: how often a room gets this biome, against the other rows';
                weight.value = String(row.weight);
                weight.addEventListener('change', () => {
                    const w = Math.max(1, Math.floor(Number(weight.value) || 1));
                    write(rows.map((r, j) => (j === i ? { ...r, weight: w } : r)));
                });
                line.appendChild(weight);
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = '−';
                remove.title = 'remove this biome from the mix';
                remove.addEventListener('click', () => write(rows.filter((_, j) => j !== i)));
                line.appendChild(remove);
            }
            wrap.appendChild(fieldRow(i === 0 ? 'Maze biome' : '',
                i === 0 ? 'The wall style (and what is added after it) of every procedural maze room. Add rows for a '
                    + 'per-room mix: each room picks one by hash of the seed and its name, by weight.' : null, line));
        });
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'procgen-pipeline-maze-biome-add';
        add.textContent = '+ biome';
        add.title = 'add a biome to the mix';
        add.addEventListener('click', () => {
            const unused = mazeBiomeIds().find((id) => !rows.some((r) => r.id === id));
            if (unused) write([...rows, { id: unused, weight: 1 }]);
        });
        wrap.appendChild(add);
        const placing = rows.map((r) => r.id).find(placesTileKinds);
        if (placing) {
            const own = REGION_BIOMES[placing].tileKinds;
            for (const [key, d] of Object.entries(TILE_KINDS_DOMAINS)) {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = String(d.min);
                input.max = String(d.max);
                input.step = '1';
                input.dataset.paramKey = `${TILE_KINDS_KEY}.${key}`;
                input.value = String(params[TILE_KINDS_KEY]?.[key] ?? own[key]);
                input.addEventListener('change', () => {
                    const v = Math.min(d.max, Math.max(d.min, Math.floor(Number(input.value) || d.min)));
                    params[TILE_KINDS_KEY] = { ...(params[TILE_KINDS_KEY] ?? {}), [key]: v };
                    onChange();
                });
                wrap.appendChild(fieldRow(`Tile kinds: ${key}`, `${nameOf(placing)}: ${d.why}`, input));
            }
        }
    };
    draw();
    return wrap;
}

/**
 * The hazard sub-fields shown while hazards are enabled: count per region, max
 * consecutive placement failures before stopping, and the wall-overlap toggle —
 * one container, so the toggle can show / hide them as a unit.
 */
function renderHazardSubFields(params, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'procgen-pipeline-hazard-fields';

    wrap.appendChild(numberField(params, {
        key: 'hazardCount', label: 'Hazards per region',
        title: 'Target hazard count for each region (0 disables)', def: 0, min: 0, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'hazardMaxConsecutiveFails', label: 'Max consecutive fails',
        title: 'Stop early after this many failed placement attempts in a row', def: 10, min: 1, integer: true,
    }, onChange));

    const overlapInput = document.createElement('input');
    overlapInput.type = 'checkbox';
    overlapInput.checked = !!params.hazardWallOverlapAllowed;
    overlapInput.addEventListener('change', () => {
        params.hazardWallOverlapAllowed = !!overlapInput.checked;
        onChange();
    });
    wrap.appendChild(fieldRow('Allow wall overlap',
        'Hazard paths may include wall tiles (still must contain ≥1 floor tile)', overlapInput));
    return wrap;
}

/**
 * The maze's per-substrate panel controls: the hazard toggle, and its sub-fields
 * while it is on (shown / hidden in place on toggle).
 */
export function renderMazeProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    const arrival = document.createElement('select');
    arrival.className = 'procgen-pipeline-maze-arrival';
    arrival.dataset.paramKey = 'mazeArrival';
    for (const [value, text] of [['zone', 'zones (arrive at the entrance)'], ['region', 'regions (arrive at the exit back)']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        arrival.appendChild(option);
    }
    arrival.value = MAZE_ARRIVALS.includes(params.mazeArrival) ? params.mazeArrival : 'zone';
    arrival.addEventListener('change', () => {
        params.mazeArrival = arrival.value;
        onChange();
    });
    const arrivalRow = wrap.appendChild(fieldRow('Maze rooms play as',
        'Shuffled spiral: zones always start at the room\'s entrance, where its logic is measured from; '
        + 'regions start at the exit that leads back to where you came from (the logic does not model that yet). '
        + 'The APWorld Editor can set it per room.', arrival));
    arrivalRow.className = `${arrivalRow.className} ${MAZE_ARRIVAL_ROW_CLASS}`;
    wrap.appendChild(renderMazeBiomeBlock(params, onChange));
    const hazardInput = document.createElement('input');
    hazardInput.type = 'checkbox';
    hazardInput.checked = !!params.enableHazards;
    wrap.appendChild(fieldRow('Enable hazards',
        'Procgen places hazards (2/3/5-tile linear paths or 4/8-tile loops) on every region',
        hazardInput));
    let subFields = params.enableHazards ? wrap.appendChild(renderHazardSubFields(params, onChange)) : null;
    hazardInput.addEventListener('change', () => {
        params.enableHazards = !!hazardInput.checked;
        if (params.enableHazards && !subFields) {
            subFields = wrap.appendChild(renderHazardSubFields(params, onChange));
        } else if (!params.enableHazards && subFields) {
            subFields.remove();
            subFields = null;
        }
        onChange();
    });
    return wrap;
}

/**
 * The regionParams a selected maze library entry reads. Sphere mode only —
 * the flags' one reader is the requirement-aware sphere instantiate.
 */
export function buildMazeLibraryRegionParams({ params = {}, mode = 'sphere' } = {}) {
    if (mode !== 'sphere') return {};
    return {
        mazeRequireSameWall: !!params.mazeRequireSameWall,
        mazeRequireTileAlign: !!params.mazeRequireTileAlign,
    };
}

/**
 * The two connection-strictness toggles, shown when a maze pack is selected in
 * sphere mode. Default OFF = best-effort: captured openings align to the needed
 * wall when possible, else fall back to a side-based connection at their
 * captured tiles. Turning a flag ON requires alignment (tile-align can't be
 * satisfied by a captured maze, so it fails generation loudly — surfaced as an
 * opt-in for a future carve capability).
 */
export function renderMazeLibraryProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'procgen-pipeline-maze-connection';
    const header = document.createElement('div');
    header.className = 'procgen-pipeline-scenario-subheader';
    header.textContent = 'Maze connection (sphere mode)';
    header.title = 'How a captured maze pack connects into a sphere slot. Default '
        + 'best-effort: align to the wall when possible, else connect by side.';
    wrap.appendChild(header);

    const toggle = (key, cbClass, text, title) => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!params[key];
        cb.className = cbClass;
        cb.addEventListener('change', () => {
            params[key] = cb.checked;
            onChange();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(text));
        label.title = title;
        wrap.appendChild(label);
    };
    toggle('mazeRequireSameWall', 'procgen-pipeline-maze-samewall-cb', 'Require same wall',
        'ON: a child exit must reuse a captured opening on that exact wall (else '
        + 'generation fails). OFF (default): relabel any opening onto the side.');
    toggle('mazeRequireTileAlign', 'procgen-pipeline-maze-tilealign-cb', 'Require tile alignment',
        'ON: openings must sit at the grid-mirror tile — a captured maze cannot '
        + 'satisfy this without a carve, so generation fails. OFF (default): keep '
        + 'the captured tile (side-based connection).');
    return wrap;
}
