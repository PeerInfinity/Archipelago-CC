/**
 * Every FEATURE CHECK, in the order the Tutorial panel lists them (⚖ the user,
 * 2026-10-15). A feature check is a scripted walk that tests a feature, not a
 * tutorial. It has the tutorial shape (validateTutorial(t, { check: true })):
 * no track, no guide (`doc: null`), and teaching prose is optional. The walker
 * and the ratchet treat it like a tutorial. It is NOT in TUTORIALS, so the
 * guide generator, the coverage census and the tutorial rows never see it.
 * Its walk row is `feature-check-<id>`, in the manual batch feature-checks.
 * ⛔ Imports only content files.
 */
import { CHECK_STORAGE_PANEL_MODE_KEY } from './storagePanel.js';
import { CHECK_SEEDLING_SOLVE_PROGRESS_AUTO_SHOW } from './seedlingSolveProgress.js';
import { CHECK_SEEDLING_DASH_WINDOW } from './seedlingSlowSolve.js';
import {
    CHECK_REGION_EDIT_APWORLD_EDITOR, CHECK_REGION_EDIT_MAZE_LAB_CLOSED, CHECK_REGION_EDIT_SEEDLING_GENERATED,
    CHECK_REGION_EDIT_SEEDLING_REAL_GAME,
} from './regionEditing.js';

const entry = (source, tutorial) => Object.freeze({ source: `frontend/modules/tutorials/content/checks/${source}`, tutorial });

export const FEATURE_CHECKS = Object.freeze([
    entry('storagePanel.js', CHECK_STORAGE_PANEL_MODE_KEY),
    entry('seedlingSolveProgress.js', CHECK_SEEDLING_SOLVE_PROGRESS_AUTO_SHOW),
    entry('seedlingSlowSolve.js', CHECK_SEEDLING_DASH_WINDOW),
    entry('regionEditing.js', CHECK_REGION_EDIT_MAZE_LAB_CLOSED),
    entry('regionEditing.js', CHECK_REGION_EDIT_SEEDLING_GENERATED),
    entry('regionEditing.js', CHECK_REGION_EDIT_SEEDLING_REAL_GAME),
    entry('regionEditing.js', CHECK_REGION_EDIT_APWORLD_EDITOR),
]);
