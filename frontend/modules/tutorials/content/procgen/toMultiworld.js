/**
 * Procgen: from a generated world to a multiworld (catalogue P2): the
 * pipeline's world → the APWorld Editor (look, edit) → a `.apworld` → a LOCAL
 * multiworld → the Client → the Playback Bot. In progress: its walk row
 * measures `firstFailingStep` — it STOPS at the first terminal step (no
 * stand-in, ⚖ the user, 2026-10-10) until a harness can start a server.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    PIPELINE, botPlaysToTheEnd, choosePreset, generatedSinceStep, resetPipeline, runAll,
} from '../steps/procgen.js';
import { localMultiworld } from '../steps/multiworld.js';

const EDITOR = { panel: 'apworldEditorPanel' };
const GAME_NAME = 'Tutorial Maze';
const APWORLD_FILE = 'tutorial_maze.apworld';
const SLOT = 'Tutorial';
const editorStatus = { ...EDITOR, selector: '.apworld-status' };
const nameBox = { ...EDITOR, selector: 'input.apworld-build-name' };

export const PROCGEN_TO_MULTIWORLD = Object.freeze({
    id: 'procgen-to-multiworld',
    title: 'Procgen: from a generated world to a multiworld',
    summary: 'Take a generated world through the APWorld Editor to a .apworld, play it on a local Archipelago server, and let the Playback Bot send the checks.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: 'mw-install',
    doc: null,
    intro: [
        { prose: 'A world the pipeline generates is a real Archipelago game: the **APWorld Editor** can package it as a `.apworld`, which Archipelago\'s own generator and server load like any other game. This tutorial goes the whole way — generate, look, edit, package, host it locally, connect, and play.' },
        { prose: 'You need a copy of Archipelago (or this project\'s repository) on your computer for the middle part; everything else is in the browser.' },
    ],
    sections: [
        {
            id: 'world',
            title: 'Generate a world',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...choosePreset('choose-preset', 'shipped:maze-sphere-demo', 'Maze demo (sphere growth)'),
                ...runAll('run-all'),
            ],
        },
        {
            id: 'editor',
            title: 'Look at it in the APWorld Editor',
            blocks: [
                {
                    step: {
                        id: 'open-editor',
                        text: 'Press **Open in APWorld Editor** (under the result). The world opens in the **APWorld Editor** tab: its regions, locations, items and rules, as tabs you can browse and edit.',
                        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Open in APWorld Editor' } }],
                        done: (ctx) => ctx.publishedSinceStep('apworldEditor:loadRules') && ctx.isPanelShowing(EDITOR)
                            && !ctx.text(editorStatus).startsWith('No rules loaded'),
                        doneTimeoutMs: 30000,
                    },
                },
                { prose: 'Browse a little: the **Regions** tab lists the mazes the pipeline built, **Locations** the pickups in them, **Items** the keys and Victory. Every edit you make is checked as you make it, and **↶ Undo** takes it back.' },
                {
                    step: {
                        id: 'name-game',
                        text: `Give the game a name of its own: type **${GAME_NAME}** in the *apworld game name* box beside **⭳ .apworld**. (Blank keeps the world's own name.)`,
                        actions: [{ fill: { ...nameBox, value: GAME_NAME } }],
                        done: (ctx) => ctx.query(nameBox)?.value === GAME_NAME,
                    },
                },
                {
                    step: {
                        id: 'build-apworld',
                        text: 'Press **⭳ .apworld**. The editor runs Archipelago\'s world generator in your browser (the first time, it downloads Python — a few seconds) and saves the `.apworld`. Its status line names the file.',
                        actions: [{ click: { ...EDITOR, selector: 'button.apworld-build-download' } }],
                        done: (ctx) => ctx.seenSinceStep('building', () => ctx.text(editorStatus).includes('.apworld: '))
                            && ctx.text(editorStatus).includes(`.apworld: downloaded ${APWORLD_FILE}`),
                        failed: (ctx) => (ctx.text(editorStatus).includes('.apworld: build failed') ? ctx.text(editorStatus) : null),
                        doneTimeoutMs: 120000,
                    },
                },
            ],
        },
        {
            id: 'multiworld',
            title: 'Host it on a local server and connect',
            blocks: [
                ...localMultiworld({ gameName: GAME_NAME, apworldFile: APWORLD_FILE, slot: SLOT }),
            ],
        },
        {
            id: 'play',
            title: 'Play it',
            blocks: [
                { prose: 'Connected, the app is a client of the server: each location the bot checks is sent to it, and the items the server sends back arrive in your inventory.' },
                ...botPlaysToTheEnd('bot-plays'),
                { prose: 'The server\'s window logs each check; when Victory is found, the slot is finished.' },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [
                ...resetPipeline('reset-end'),
                { prose: 'Stop the server with **Ctrl+C** in its terminal; delete `custom_worlds/' + APWORLD_FILE + '` and the `TutorialPlayers` folder when you no longer need them.' },
            ],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: 'Put more than one player file in `TutorialPlayers/` — the same generated game twice, or with any other Archipelago game — and the items are shuffled between the worlds.' },
        ],
    },
});
