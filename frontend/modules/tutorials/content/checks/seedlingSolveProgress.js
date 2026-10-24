/**
 * Feature check: the flash panel's Solve Progress view shows itself while the
 * Seedling solver works and hides when it finishes (⛓ AUTO-SHOW, slice
 * `solve-progress-auto`, ⚖ the user 2026-10-15). The solve is the L6 enemy
 * room the panel stages (`flashPanel/seedlingSolveDemo.js`): JS runtime,
 * deterministic. It asserts the LIFECYCLE the view mirrors on its element's
 * `data-*` attributes — shown on a running note, hidden after the final one,
 * still listening — never elapsed seconds. It sets its own settings for the
 * session and puts them back (its last step; the walk row and leaving the
 * check restore them too).
 */
const FLASH = { panel: 'flashPanel' };
const VIEW = { ...FLASH, selector: '.flash-panel-solve-progress' };
const ROOT = { ...FLASH, selector: '.flash-panel-container' };
const KEYS = Object.freeze({
    runtime: 'moduleSettings.flashPanel.runtime',
    solver: 'moduleSettings.flashPanel.seedlingSolverWalk',
    view: 'moduleSettings.flashPanel.seedlingSolveProgressView',
});
const ATLAS = Object.freeze({ game: 'seedling_atlas', seed: 1 });
const DEMO = 'l6-enemy-room';
// The bus event the panel stages a demo on (flashPanel/seedlingSolveDemo.js SOLVE_DEMO_EVENT; content imports no app code).
const SOLVE_DEMO_EVENT = 'flashPanel:stageSolveDemo';

const view = (ctx) => ctx.query(VIEW)?.dataset ?? {};
const at = (v) => Number(v ?? NaN);

export const CHECK_SEEDLING_SOLVE_PROGRESS_AUTO_SHOW = Object.freeze({
    id: 'seedling-solve-progress-auto-show',
    title: 'Seedling: the Solve Progress view shows while the solver works',
    summary: 'On the default auto mode, the flash panel\'s Solve Progress view appears when a solve starts reporting and hides when it ends.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'solve',
            title: 'A solve with the view on auto',
            blocks: [
                {
                    step: {
                        id: 'settings',
                        text: 'Set the flash panel to the **JS** runtime with the **solver** on, and **Solve Progress** to **auto** (for this session only).',
                        run: async (ctx) => {
                            await ctx.setSetting(KEYS.runtime, 'js');
                            await ctx.setSetting(KEYS.solver, true);
                            await ctx.setSetting(KEYS.view, 'auto');
                        },
                        done: async (ctx) => (await ctx.getSetting(KEYS.view)) === 'auto'
                            && (await ctx.getSetting(KEYS.runtime)) === 'js',
                    },
                },
                {
                    step: {
                        id: 'load',
                        text: 'Load **Seedling Atlas** (seed 1): the vanilla map as a world.',
                        run: (ctx) => ctx.loadPreset(ATLAS.game, ATLAS.seed),
                        done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(ATLAS.game, ATLAS.seed),
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'listening',
                        text: 'Open the **Flash Panel** tab. The Solve Progress view is hidden but listening, so the next solve reports.',
                        actions: [{ activate: FLASH }],
                        done: (ctx) => {
                            const d = view(ctx);
                            return d.mode === 'auto' && d.listening === 'true' && d.visible === 'false';
                        },
                    },
                },
                {
                    step: {
                        id: 'shown',
                        text: 'Stage the level 6 solve: the player arrives from level 5 and the solver plans a way past the bobs to the stairs. The view **appears** with the solve\'s first report.',
                        run: (ctx) => { ctx.eventBus.publish(SOLVE_DEMO_EVENT, { demo: DEMO }, 'tutorials'); },
                        done: (ctx) => {
                            const d = view(ctx);
                            return ctx.query(ROOT)?.dataset.solveDemo === 'staged' && ctx.sinceStep(d.shownAt)
                                && d.shownFinal === 'false';
                        },
                        failed: (ctx) => {
                            const r = ctx.query(ROOT)?.dataset;
                            return r?.solveDemo === 'refused' ? `the panel refused the solve: ${r.solveDemoWhy}` : null;
                        },
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'hidden',
                        text: 'When the solve finishes, the view **hides** at once — and keeps listening for the next solve.',
                        done: (ctx) => {
                            const d = view(ctx);
                            return d.visible === 'false' && d.final === 'true' && d.outcome === 'solved'
                                && d.listening === 'true' && at(d.hiddenAt) >= at(d.shownAt);
                        },
                        doneTimeoutMs: 90000,
                    },
                },
                {
                    step: {
                        id: 'restore',
                        text: 'Put the three settings back as they were.',
                        run: (ctx) => ctx.restoreSettings(),
                        done: (ctx) => ctx.settingsRestored(),
                    },
                },
            ],
        },
    ],
    outro: null,
});
