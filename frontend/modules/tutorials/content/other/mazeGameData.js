/**
 * Other: A-Mazing-Idle and the Maze Game Data panel. The Maze Game Data panel
 * is the host-side view of A-Mazing-Idle (an incremental maze game by
 * ImGregHenry, integrated with permission), loaded into an Iframe Panel — not
 * the procgen Maze substrate. (⚖ the user, 2026-10-10: a short draft of its
 * own.) In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

const IFRAMES = { panel: 'iframeManagerPanel' };
const IFRAME = { panel: 'iframePanel' };
const DATA = { panel: 'mazeGameDataPanel' };
const MAZE_GAME = './modules/a-mazing-idle-remote/index-iframe.html';
const quickActions = '.mgd-section[data-section="quickActions"]';

export const OTHER_MAZE_GAME_DATA = Object.freeze({
    id: 'other-maze-game-data',
    title: 'A-Mazing-Idle and the Maze Game Data panel',
    summary: 'Load the incremental maze game A-Mazing-Idle into an Iframe Panel and watch its state in the Maze Game Data panel.',
    track: 'other',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: '[A-Mazing-Idle](https://imgreghenry.github.io/A-Mazing-Idle/) by ImGregHenry is an incremental game of bots solving mazes, integrated here with the author\'s permission. It runs in an **Iframe Panel** (it loads from the author\'s site, so it needs the internet), and the **Maze Game Data** panel shows its state and can change it. (This is not the procgen *Maze* substrate.)' },
    ],
    sections: [
        {
            id: 'load',
            title: 'Load the game',
            blocks: [
                {
                    step: {
                        id: 'pick',
                        text: 'Open the **Iframe Manager** tab and choose **A-Mazing-Idle** among the known pages.',
                        actions: [{ select: { ...IFRAMES, selector: '.known-pages-select', value: MAZE_GAME } }],
                        done: (ctx) => ctx.query({ ...IFRAMES, selector: '.url-input' })?.value === MAZE_GAME,
                    },
                },
                {
                    step: {
                        id: 'load',
                        text: 'Press **Load Iframe**, then open the **Iframe Panel** tab: the game starts solving mazes by itself.',
                        actions: [{ click: { ...IFRAMES, selector: '.load-button' } }, { activate: IFRAME }],
                        done: (ctx) => ctx.text({ ...IFRAME, selector: '.iframe-status' }).startsWith('Connected') && ctx.text({ ...IFRAME, selector: '.iframe-status' }).includes('a-mazing-idle'),
                        doneTimeoutMs: 60000,
                    },
                },
            ],
        },
        {
            id: 'data',
            title: 'Its data',
            blocks: [
                {
                    step: {
                        id: 'connected',
                        text: 'Open the **Maze Game Data** tab: it says *Connected*, with the game\'s biome, points, mazes solved and bot upgrades, and a log of completed mazes.',
                        actions: [{ activate: DATA }],
                        done: (ctx) => ctx.text({ ...DATA, selector: '.mgd-conn-label' }) === 'Connected',
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'refresh',
                        text: 'Press **Refresh** to read the game\'s state now.',
                        actions: [{ click: { ...DATA, selector: '.mgd-refresh-btn' } }],
                        done: (ctx) => ctx.text({ ...DATA, selector: '.mgd-gs-biome' }) !== '--',
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'new-maze',
                        text: 'Unfold **Quick Actions** and press **Generate New Maze**: the game drops its maze and starts a new one. **Inject Points** and **Advance to Biome** jump the game ahead, for testing. Fold the section again.',
                        actions: [
                            { click: { ...DATA, selector: `${quickActions}:has(.mgd-section-body[style*="display: none"]) .mgd-section-header`, optional: true } },
                            { click: { ...DATA, selector: '.mgd-new-maze-btn' } },
                            { click: { ...DATA, selector: `${quickActions}:has(.mgd-section-body[style*="display: block"]) .mgd-section-header`, optional: true } },
                        ],
                    },
                },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [
                {
                    step: {
                        id: 'unload',
                        text: 'In the **Iframe Manager**, press **Unload All**.',
                        actions: [{ click: { ...IFRAMES, selector: '.unload-button' } }],
                        done: (ctx) => !ctx.exists({ ...IFRAME, selector: '.iframe-content iframe' }),
                    },
                },
            ],
        },
    ],
    outro: null,
});
