/**
 * Feature check: the Seedling solver's dash pass, cut by its time limit and then given the time (slice
 * `seedling-slowsolve-check`, ⚖ the user 2026-10-16: "the longest solve that actually completes", "an example that
 * isn't a boss fight", then "a version with the time limits extended, for the optional parts of the solve that are
 * cut to save solve time, like dashing").
 *
 * The solve is the flash panel's `l12-dash-cut` demo (`flashPanel/seedlingSolveDemo.js`): divergence leg 108, level
 * 12 from level 0's door to the teleporter at (432, 352), sword in hand. The solver plans in two passes: a dashless
 * one, then a full one that may dash, which only gets the first 85 work units of the solve (the upgrade window,
 * `flashPanel.seedlingSolverUpgradeWindowWork`). The Solve Progress view is set to ALWAYS (⚖ the user, 2026-10-16:
 * "for this demo, let's set Solve Progress to Always"), so it stays open between the two solves. Section 1 runs it at that default: the full pass is cut and the
 * dashless walk ships. Section 2 sets the window to 0 (the whole 640-unit budget) for the session: the full pass
 * finishes and its shorter, dashing walk ships. The sword comes through the AP item path (the Inventory panel), so it
 * has an inventory slot; that is why the world is seedling_playthrough. Settings are session-only and restored, and
 * the world is reloaded before section 2 and at the end, which drops the sword. Why the reload before section 2: the
 * world's region glue places an arrival by the region the player left, so after the first walk (to level 33) a second
 * staging would land beside the goal; the panel refuses that by name (`solveDemoMoved`).
 *
 * The numbers in the text were measured on one box (`seedling-bot-log.md`, SLOWSOLVE): the work units and ticks are
 * the same on every machine, the seconds are not. The steps assert the view's lifecycle and its outcome only.
 */
const FLASH = { panel: 'flashPanel' };
const VIEW = { ...FLASH, selector: '.flash-panel-solve-progress' };
const ROOT = { ...FLASH, selector: '.flash-panel-container' };
const LOG = { ...FLASH, selector: '.flash-panel-log' };
const SWORD = { panel: 'inventoryPanel', selector: '.item-button[data-item="Progressive Sword"]' };
// The panel hides items you do not own until "Show unowned" is ticked (the selector names the UNticked state).
const SHOW_UNOWNED = { panel: 'inventoryPanel', selector: '#show-unowned:not(:checked)', optional: true };
const KEYS = Object.freeze({
    runtime: 'moduleSettings.flashPanel.runtime',
    solver: 'moduleSettings.flashPanel.seedlingSolverWalk',
    view: 'moduleSettings.flashPanel.seedlingSolveProgressView',
    window: 'moduleSettings.flashPanel.seedlingSolverUpgradeWindowWork',
});
// The window's default (`SOLVER_UPGRADE_WINDOW_WORK` in seedlingDemo/jsRuntimeSolver.js; content imports no app code).
const DEFAULT_WINDOW = 85;
const WORLD = Object.freeze({ game: 'seedling_playthrough', seed: 1 });
const DEMO = 'l12-dash-cut';
// The bus event the panel stages a demo on (flashPanel/seedlingSolveDemo.js SOLVE_DEMO_EVENT).
const SOLVE_DEMO_EVENT = 'flashPanel:stageSolveDemo';
// The region glue's log line for the walk's end: the crossing out of level 12 to 33 (seedlingRegionGlue.js).
const CROSSING = /level 12 -> 33: crossing/g;

const view = (ctx) => ctx.query(VIEW)?.dataset ?? {};
const viewText = (ctx) => ctx.text(VIEW);
const crossings = (ctx) => (ctx.text(LOG).match(CROSSING) ?? []).length;
const swordCount = (ctx) => Number(ctx.snapshot()?.inventory?.['Progressive Sword'] ?? 0);
// The crossing count when a walk was staged, so its `done` asks for a NEW crossing.
let crossingsAtStage = 0;
// Did the staged solve report a RUNNING note? (On `always` the view never hides, so a final note from the solve before
// would also read as final: the final step asks for this solve's running note first.)
let sawRunning = false;

const stageStep = (id, text) => ({
    step: {
        id,
        text,
        run: (ctx) => {
            crossingsAtStage = crossings(ctx);
            sawRunning = false;
            ctx.eventBus.publish(SOLVE_DEMO_EVENT, { demo: DEMO }, 'tutorials');
        },
        done: (ctx) => {
            const d = view(ctx);
            sawRunning ||= ctx.seenSinceStep('running', () => d.final === 'false' && d.outcome === 'running');
            return ctx.query(ROOT)?.dataset.solveDemo === 'staged' && sawRunning && d.visible === 'true';
        },
        failed: (ctx) => {
            const r = ctx.query(ROOT)?.dataset;
            return r?.solveDemo === 'refused' ? `the panel refused the solve: ${r.solveDemoWhy}` : null;
        },
        doneTimeoutMs: 60000,
    },
});

const finalStep = (id, text, { outcome, window }) => ({
    step: {
        id,
        text,
        done: (ctx) => {
            const d = view(ctx);
            const t = viewText(ctx);
            return sawRunning && d.final === 'true' && d.outcome === outcome && d.visible === 'true'
                && t.includes('segment 1 (full)') && t.includes(`upgrade window ${window}`);
        },
        failed: (ctx) => {
            const d = view(ctx);
            return sawRunning && d.final === 'true' && d.outcome !== outcome
                ? `the solve's last note is ${d.outcome}, not ${outcome}: ${viewText(ctx).slice(0, 200)}` : null;
        },
        doneTimeoutMs: 60000,
    },
});

const walkStep = (id, text) => ({
    step: {
        id,
        text,
        done: (ctx) => crossings(ctx) > crossingsAtStage,
        doneTimeoutMs: 90000,
    },
});

const loadStep = (id, text) => ({
    step: {
        id,
        text,
        run: (ctx) => ctx.loadPreset(WORLD.game, WORLD.seed),
        done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(WORLD.game, WORLD.seed),
        doneTimeoutMs: 30000,
    },
});

const listeningStep = (id, text) => ({
    step: {
        id,
        text,
        actions: [{ activate: FLASH }],
        done: (ctx) => {
            const d = view(ctx);
            return d.mode === 'always' && d.listening === 'true' && d.visible === 'true';
        },
        doneTimeoutMs: 30000,
    },
});

const swordStep = (id, text) => ({
    step: {
        id,
        text,
        actions: [{ click: SHOW_UNOWNED }, { click: SWORD }],
        done: (ctx) => swordCount(ctx) >= 1,
    },
});

export const CHECK_SEEDLING_DASH_WINDOW = Object.freeze({
    id: 'seedling-dash-window',
    title: 'Seedling: the solver\'s dash pass, cut by its window and then given the time',
    summary: 'A level 12 solve whose dashing pass is cut by the 85-unit upgrade window, then the same solve with the window opened to the whole budget.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'cut',
            title: 'The dash pass, cut at the default window',
            blocks: [
                {
                    step: {
                        id: 'settings',
                        text: 'Set the flash panel to the **JS** runtime with the **solver** on, **Solve Progress** on **always**, and the upgrade window at its default **85** work units (for this session only).',
                        run: async (ctx) => {
                            await ctx.setSetting(KEYS.runtime, 'js');
                            await ctx.setSetting(KEYS.solver, true);
                            await ctx.setSetting(KEYS.view, 'always');
                            await ctx.setSetting(KEYS.window, DEFAULT_WINDOW);
                        },
                        done: async (ctx) => (await ctx.getSetting(KEYS.view)) === 'always'
                            && (await ctx.getSetting(KEYS.runtime)) === 'js'
                            && Number(await ctx.getSetting(KEYS.window)) === DEFAULT_WINDOW,
                    },
                },
                loadStep('load', 'Load **Seedling Playthrough** (seed 1): the whole game as an Archipelago world, whose items reach the game through the item path.'),
                listeningStep('listening', 'Open the **Flash Panel** tab. The Solve Progress view is open below the game, waiting for a solve.'),
                swordStep('sword', 'In the **Inventory** panel, tick **Show unowned** if it is off, then click **Progressive Sword**. The sword reaches the game in a slot of its own, which the solver needs to plan a sword-dash.'),
                stageStep('stage-cut', 'Stage the solve: the player enters level 12 from level 0, holding the sword, and the solver plans a way to the teleporter at (432, 352). The view starts reporting: the tree of goals, the tiles the search has reached, and the work meter against the 640-unit budget.'),
                finalStep('cut', 'Watch the two passes. The **dashless** pass finds a 561-tick walk at about 36 units. The **full** pass, which may dash, gets only the first **85** units of the solve, so it is **cut** (the view\'s last note: the full segment, *refused*, "upgrade window 85"). The view keeps that note on screen while the bot plays the dashless walk.', { outcome: 'refused', window: DEFAULT_WINDOW }),
                walkStep('walk-cut', 'The bot walks the 561-tick plan to the teleporter and crosses to level 33.'),
            ],
        },
        {
            id: 'extended',
            title: 'The same solve with the window opened',
            blocks: [
                {
                    step: {
                        id: 'window-0',
                        text: 'Set the upgrade window to **0**, which means the whole budget (for this session only). This is the time limit on the optional part of the solve, the dashing pass.',
                        run: (ctx) => ctx.setSetting(KEYS.window, 0),
                        done: async (ctx) => Number(await ctx.getSetting(KEYS.window)) === 0,
                    },
                },
                loadStep('reload', 'Reload the world. This world places an arrival by the region the player came from: from level 33\'s side the player would land beside the teleporter. A fresh world starts on level 0\'s side again.'),
                listeningStep('listening-full', 'Back on the **Flash Panel** tab, the view is open and waiting again.'),
                swordStep('sword-full', 'The reload dropped the sword: click **Progressive Sword** in the **Inventory** panel again.'),
                stageStep('stage-full', 'Stage the same solve again. The dashless pass runs exactly as before; this time the full pass may spend the whole budget, and the work meter climbs past 85.'),
                finalStep('full', 'The **full** pass finishes, at about 202 units: the view\'s last note is the full segment, *solved*, "upgrade window 640". It found a **328-tick** walk with dashes, 233 ticks shorter, for a few seconds more of solving (measured on one box: about 1.6 s at the default, 3.5 s here).', { outcome: 'solved', window: 640 }),
                walkStep('walk-full', 'The bot walks the 328-tick plan to the teleporter and crosses to level 33.'),
                {
                    step: {
                        id: 'restore',
                        text: 'Reload the world (dropping the sword), then put the four settings back as they were.',
                        run: async (ctx) => {
                            await ctx.loadPreset(WORLD.game, WORLD.seed);
                            await ctx.restoreSettings();
                        },
                        done: (ctx) => ctx.settingsRestored() && swordCount(ctx) === 0,
                        doneTimeoutMs: 30000,
                    },
                },
            ],
        },
    ],
    outro: null,
});
