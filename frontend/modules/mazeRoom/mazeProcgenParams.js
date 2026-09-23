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
});

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
