/**
 * Feature check: the flash panel's solver PROGRESS LINE, under the game, follows a Seedling solve while the Solver
 * section is closed, and the section shows the whole view when opened (⛓ PANEL LAYOUT, slice
 * `seedling-panel-layout`, ⚖ the user 2026-10-24 — it replaced AUTO-SHOW's off/auto/always setting and this
 * check's earlier form, `seedling-solve-progress-auto-show`). The solve is the L6 enemy room the panel stages
 * (`flashPanel/seedlingSolveDemo.js`): JS runtime, deterministic. It asserts what the line and the view mirror on
 * their elements' `data-*` attributes — never elapsed seconds. It sets its own settings for the session and puts
 * them back, and leaves the Solver section as it found it.
 */
const FLASH = { panel: 'flashPanel' };
const VIEW = { ...FLASH, selector: '.flash-panel-solve-progress' };
const ROOT = { ...FLASH, selector: '.flash-panel-container' };
const LINE = { ...FLASH, selector: '.flash-panel-solve-progress-line' };
const SOLVER = { ...FLASH, selector: '.flash-panel-section-solver' };
// a click on the Solver section's title, only when it is in the state named (`optional`: already there, nothing to do)
const OPEN_SOLVER = { ...FLASH, selector: '.flash-panel-section-solver:not([open]) > summary', optional: true };
const CLOSE_SOLVER = { ...FLASH, selector: '.flash-panel-section-solver[open] > summary', optional: true };
const KEYS = Object.freeze({
    runtime: 'moduleSettings.flashPanel.runtime',
    solver: 'moduleSettings.flashPanel.seedlingSolverWalk',
});
const ATLAS = Object.freeze({ game: 'seedling_atlas', seed: 1 });
const DEMO = 'l6-enemy-room';
// The bus event the panel stages a demo on (flashPanel/seedlingSolveDemo.js SOLVE_DEMO_EVENT; content imports no app code).
const SOLVE_DEMO_EVENT = 'flashPanel:stageSolveDemo';

const view = (ctx) => ctx.query(VIEW)?.dataset ?? {};
const line = (ctx) => ctx.query(LINE)?.dataset ?? {};
const solverOpen = (ctx) => ctx.query(SOLVER)?.open === true;
// the Solver section's state when the check started (put back by its last step)
let solverWasOpen = false;

export const CHECK_SEEDLING_SOLVE_PROGRESS_LINE = Object.freeze({
    id: 'seedling-solve-progress-line',
    title: 'Seedling: the solver\'s progress line follows a solve, and the Solver section shows the rest',
    summary: 'With the Solver section closed, the flash panel\'s progress line under the game follows a solve to its end; opening the section shows the whole view of that solve.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'solve',
            title: 'A solve with the Solver section closed',
            blocks: [
                {
                    step: {
                        id: 'settings',
                        text: 'Set the flash panel to the **JS** runtime with the **solver** on (for this session only).',
                        run: async (ctx) => {
                            await ctx.setSetting(KEYS.runtime, 'js');
                            await ctx.setSetting(KEYS.solver, true);
                        },
                        done: async (ctx) => (await ctx.getSetting(KEYS.runtime)) === 'js'
                            && (await ctx.getSetting(KEYS.solver)) === true,
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
                        id: 'panel',
                        text: 'Open the **Flash Panel** tab. Under the game, the solver\'s progress line waits for a solve; the Solver section\'s view is listening for one.',
                        actions: [{ activate: FLASH }],
                        run: (ctx) => { solverWasOpen = solverOpen(ctx); },
                        done: (ctx) => !!ctx.query(LINE) && view(ctx).listening === 'true',
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'close-solver',
                        text: 'Close the **Solver** section if it is open: its view is hidden, and still listening.',
                        actions: [{ click: CLOSE_SOLVER }],
                        done: (ctx) => {
                            const d = view(ctx);
                            return !solverOpen(ctx) && d.mode === 'listen' && d.visible === 'false' && d.listening === 'true';
                        },
                    },
                },
                {
                    step: {
                        id: 'running',
                        text: 'Stage the level 6 solve: the player arrives from level 5 and the solver plans a way past the bobs to the stairs. The **progress line** shows the solve as it runs (its work against the budget); the view stays hidden.',
                        run: (ctx) => { ctx.eventBus.publish(SOLVE_DEMO_EVENT, { demo: DEMO }, 'tutorials'); },
                        done: (ctx) => {
                            const l = line(ctx);
                            return ctx.query(ROOT)?.dataset.solveDemo === 'staged' && ctx.sinceStep(l.updatedAt)
                                && view(ctx).visible === 'false';
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
                        id: 'final',
                        text: 'When the solve finishes, the line says so (*solved*, with the plan in hand); the view never showed.',
                        done: (ctx) => {
                            const l = line(ctx);
                            const d = view(ctx);
                            return l.final === 'true' && l.outcome === 'solved' && d.final === 'true' && d.visible === 'false'
                                && d.listening === 'true' && /^solver: solved /.test(ctx.text(LINE));
                        },
                        doneTimeoutMs: 90000,
                    },
                },
                {
                    step: {
                        id: 'open',
                        text: 'Open the **Solver** section: the whole view of that solve is there (its header, the work meter, the tree).',
                        actions: [{ click: OPEN_SOLVER }],
                        done: (ctx) => {
                            const d = view(ctx);
                            return solverOpen(ctx) && d.visible === 'true' && d.mode === 'always' && /solved — final/.test(ctx.text(VIEW));
                        },
                        doneTimeoutMs: 10000,
                    },
                },
                {
                    step: {
                        id: 'restore',
                        text: 'Put the settings back as they were, and the **Solver** section as you had it.',
                        run: async (ctx) => {
                            if (!solverWasOpen) ctx.query(SOLVER)?.querySelector('summary')?.click();
                            await ctx.restoreSettings();
                        },
                        done: (ctx) => ctx.settingsRestored() && solverOpen(ctx) === solverWasOpen,
                    },
                },
            ],
        },
    ],
    outro: null,
});
