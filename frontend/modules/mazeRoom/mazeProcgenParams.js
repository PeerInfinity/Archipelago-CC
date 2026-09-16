/**
 * Maze ↔ procgen-pipeline integration: the maze's procgen parameters and
 * the panel controls for them, attached to the maze registry entry as
 * optional adapter hooks so the Procgen Pipeline driver and panel name no
 * substrate (bounceProcgenParams.js / runnerProcgenParams.js are the model;
 * assembled centrally by sphereConfigHooks.js).
 *
 * ⛓ PROCGEN PIPELINE PRESETS C1. These pieces used to live in the pipeline:
 * the two connection flags in presetRun.js's DEFAULT_PARAMS, gated there by
 * a helper that asked `e.substrate === 'maze'`, and their toggles in the
 * panel. The maze declares:
 *
 *   - defaultProcgenParams       — the panel merges this into its defaults.
 *   - buildLibraryRegionParams   — the regionParams a SELECTED maze library
 *     entry reads. Consulted for the substrates of the selected sphere
 *     libraries, not the active quotas: a maze pack realises maze regions
 *     with no maze quota, and nothing but the library instantiate reads
 *     these flags.
 *   - renderLibraryProcgenParams — the controls for those flags, shown in
 *     the panel's Region libraries subsection.
 *
 * Pure logic + call-time DOM only (no top-level document/window access) so
 * headless CLI drivers can import the maze library without panel code.
 */

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
});

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
