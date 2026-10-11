/**
 * Tracking: the base tutorial — track a real game (catalogue "Tracker (ALTTP)
 * base"; it replaces the quick-start guide's steps). ⚖ The user, 2026-10-10:
 * track BY HAND first, so the walk measures every in-app step, and connect to
 * a LOCAL server last. In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { ALTTP, LOCATIONS, REGIONS, addItem, isChecked, loadAlttp } from '../steps/tracker.js';
import { CLIENT, LOCAL_SERVER } from '../steps/multiworld.js';

const EXITS = { panel: 'exitsPanel' };
const LOCATION = "Blind's Hideout - Left";
const EXIT = 'Death Mountain Entrance Rock';
const exitCard = (ctx) => ctx.query({ ...EXITS, selector: '.exit-card .exit-name', text: EXIT })?.closest('.exit-card') ?? null;
const lightWorld = { ...REGIONS, selector: '.region-block[data-region="Light World"]' };
const regionSearch = { ...REGIONS, selector: '#region-search' };
const controls = '.controls-header';

export const TRACKER_TRACK_A_GAME = Object.freeze({
    id: 'tracker-track-a-game',
    title: 'Track a game',
    summary: 'Load a game\'s logic, track items and checks by hand, see what is reachable, and connect to your multiworld\'s server.',
    track: 'tracker',
    status: 'in-progress',
    firstFailingStep: 'serve',
    doc: null,
    intro: [
        { prose: 'The app is also a tracker for an ordinary Archipelago game: it knows the game\'s logic, so it can show which locations you can reach with the items you have — and, connected to the multiworld\'s server, it follows your game as you play.' },
        { prose: `This tutorial uses an exported seed of *${ALTTP.title}*; every step works the same with your own game's logic.` },
    ],
    sections: [
        {
            id: 'logic',
            title: 'Your game\'s logic',
            blocks: [
                {
                    step: {
                        id: 'generate',
                        outside: true,
                        text: 'Generate your multiworld with this project\'s Archipelago (a checkout of this repository, or the `JSONExport` branch of Archipelago). Besides the usual multiworld `.zip`, it exports each game\'s logic as `AP_<seed>_rules.json` (in this repository, under `frontend/presets/<game>/AP_<seed>/`).',
                        command: 'python Generate.py',
                        // The exported seed the next step loads stands in for your own.
                        standIn: async () => {},
                    },
                },
                {
                    step: {
                        id: 'load-rules',
                        text: `Open the **Presets** tab and press **Load File**, then choose that \`_rules.json\`. No game of your own yet? The seed buttons load games exported the same way — **Do it** presses **${ALTTP.seed}** beside *${ALTTP.title}*, the game the rest of this tutorial uses.`,
                        actions: loadAlttp().flatMap(({ step }) => step.actions),
                        done: loadAlttp()[0].step.done,
                        doneTimeoutMs: 30000,
                    },
                },
            ],
        },
        {
            id: 'items',
            title: 'Items',
            blocks: [
                ...addItem('add-glove', 'Progressive Glove', 'the first one is the Power Glove, which lifts light rocks, so new places open up'),
                { prose: 'Connected to a server, the items you receive arrive here by themselves.' },
            ],
        },
        {
            id: 'locations',
            title: 'Locations',
            blocks: [
                {
                    step: {
                        id: 'open-locations',
                        text: 'Open the **Locations** tab: a card for every location, coloured by whether you can reach it with what you have.',
                        actions: [{ activate: LOCATIONS }],
                        done: (ctx) => ctx.isPanelShowing(LOCATIONS),
                    },
                },
                {
                    step: {
                        id: 'search-location',
                        text: 'Type **Blind** in the search box: the five chests of Blind\'s Hideout.',
                        actions: [{ fill: { ...LOCATIONS, selector: '#location-search', value: 'Blind' } }],
                        done: (ctx) => ctx.exists({ ...LOCATIONS, selector: '.location-card .location-name', text: LOCATION }),
                    },
                },
                {
                    step: {
                        id: 'check-location',
                        text: `Click **${LOCATION}** to mark it checked. A checked card is hidden unless **Show checked** is ticked.`,
                        actions: [{ click: { ...LOCATIONS, selector: '.location-card .location-name', text: LOCATION } }],
                        done: (ctx) => isChecked(ctx, LOCATION),
                    },
                },
                {
                    step: {
                        id: 'clear-location-search',
                        text: 'Clear the search box.',
                        actions: [{ fill: { ...LOCATIONS, selector: '#location-search', value: '' } }],
                        done: (ctx) => ctx.query({ ...LOCATIONS, selector: '#location-search' })?.value === '',
                    },
                },
            ],
        },
        {
            id: 'exits-and-regions',
            title: 'Exits and regions',
            blocks: [
                {
                    step: {
                        id: 'exit',
                        text: `Open the **Exits** tab and search for **${EXIT}**: with the glove, the rock is liftable, so the exit is *traversable*.`,
                        actions: [{ activate: EXITS }, { fill: { ...EXITS, selector: '#exit-search', value: EXIT } }],
                        done: (ctx) => exitCard(ctx)?.classList.contains('traversable') === true,
                    },
                },
                {
                    step: {
                        id: 'clear-exit-search',
                        text: 'Clear the search box.',
                        actions: [{ fill: { ...EXITS, selector: '#exit-search', value: '' } }],
                        done: (ctx) => ctx.query({ ...EXITS, selector: '#exit-search' })?.value === '',
                    },
                },
                {
                    step: {
                        id: 'regions',
                        text: 'Open the **Regions** tab: the regions along your path from where the game begins, each with its exits and locations and the rule that guards each one.',
                        actions: [{ activate: REGIONS }],
                        done: (ctx) => ctx.isPanelShowing(REGIONS),
                    },
                },
                {
                    step: {
                        id: 'all-regions',
                        text: 'To look further, click **Controls**, tick **Show All Regions**, and type **Light World** in the search box.',
                        actions: [
                            { click: { ...REGIONS, selector: `${controls}:has(.collapse-indicator[style*="rotate(-90deg)"])`, optional: true } },
                            { click: { ...REGIONS, selector: '#show-all-regions:not(:checked)', optional: true } },
                            { fill: { ...regionSearch, value: 'Light World' } },
                        ],
                        done: (ctx) => ctx.exists(lightWorld),
                    },
                },
                {
                    step: {
                        id: 'unfold-light-world',
                        text: 'Click the **Light World** header to unfold it: its exits and locations, coloured by whether you can reach them.',
                        actions: [{ click: { ...REGIONS, selector: '.region-block[data-region="Light World"].collapsed .region-header', optional: true } }],
                        done: (ctx) => ctx.query(lightWorld)?.classList.contains('expanded') === true,
                    },
                },
                {
                    step: {
                        id: 'regions-back',
                        text: 'Clear the search box, untick **Show All Regions**, and fold **Controls** again.',
                        actions: [
                            { fill: { ...regionSearch, value: '' } },
                            { click: { ...REGIONS, selector: '#show-all-regions:checked', optional: true } },
                            { click: { ...REGIONS, selector: `${controls}:has(.collapse-indicator[style*="rotate(0deg)"])`, optional: true } },
                        ],
                        done: (ctx) => ctx.query(regionSearch)?.value === '' && ctx.query({ ...REGIONS, selector: '#show-all-regions' })?.checked === false,
                    },
                },
            ],
        },
        {
            id: 'connect',
            title: 'Connect to your game\'s server',
            blocks: [
                { prose: 'Tracking by hand works with no server at all. To follow a live game, connect to the multiworld\'s server — here a LOCAL one, started from the `.zip` you generated.' },
                {
                    step: {
                        id: 'serve',
                        outside: true,
                        text: 'Start a local server on your multiworld. It listens on port 38281; leave it running.',
                        command: 'python MultiServer.py output/AP_<seed>.zip',
                    },
                },
                {
                    step: {
                        id: 'connect',
                        text: `Open the **Console** tab, check the **Server Address** says \`${LOCAL_SERVER}\`, and press **Connect**. When it asks for your slot name, type the name in your player file. The status turns to *Connected*: the items you receive and the locations you check now arrive by themselves.`,
                        actions: [
                            { fill: { ...CLIENT, selector: '#server-address', value: LOCAL_SERVER } },
                            { click: { ...CLIENT, selector: '.connect-button', text: 'Connect' } },
                        ],
                        done: (ctx) => ctx.text({ ...CLIENT, selector: '#server-status' }) === 'Connected',
                        doneTimeoutMs: 30000,
                    },
                },
            ],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: 'Each of the tracker\'s other panels has a short tutorial of its own: the Path Analyzer, the Region Graph, Dungeons, Helpers, the Spoiler Checklist, the Timer and the Editor.' },
            { prose: 'The **Presets** tab holds exported seeds of dozens of games to explore the same way.' },
        ],
    },
});
