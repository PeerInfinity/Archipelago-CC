/**
 * Procgen: the Seedling features (catalogue P3): Seedling rooms inside a
 * generated world — a generated room as a sphere leaf, the generated room
 * world in a spiral — the Flash Panel, the Procgen Lab's Seedling tab, and the
 * bot. ⚖ The user, 2026-10-10: on the wasm runtime (getting the bot through
 * Seedling on wasm is a high priority), mentioning the switch to JS. In
 * progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    SEEDLING_RUNTIME_NOTE, botPlaysToTheEnd, choosePreset, loadIntoFrontend, look, resetPipeline, runAll,
    startSeedlingGame,
} from '../steps/procgen.js';

const LAB = { panel: 'procgenLabPanel', title: 'Procgen Lab — Seedling' };
const labStatus = { ...LAB, selector: '.procgen-lab-status' };

export const PROCGEN_SEEDLING = Object.freeze({
    id: 'procgen-seedling',
    title: 'Procgen: Seedling rooms',
    summary: 'Put generated Seedling rooms into a procgen world, play them in the original game, look at a room in the Procgen Lab, and watch the bot.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: null, // every step works since the ▶ Start step + a WebGPU test browser; ready = the user's call
    doc: null,
    intro: [
        { prose: '*Seedling* is a Flash game this project runs in the browser, recompiled from its SWF. Its rooms can be regions of a generated world: either real rooms from the game (the *region atlas*) or new rooms generated in its style, with the game\'s own physics deciding what is reachable.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [
        {
            id: 'world',
            title: 'A world with generated Seedling rooms',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...choosePreset('choose-preset', 'shipped:seedling-generated-room-demo', 'Generated Seedling rooms in a maze spiral'),
                { prose: 'Two mazes and two generated Seedling rooms, laid out by Shuffled spiral. Each Seedling room has its goal, one door into the other room and one into a maze. The **Parameters** section shows the room generator\'s knobs too.' },
                ...runAll('generate', 'Generate'),
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'play',
            title: 'Play it',
            blocks: [
                ...look('look-flash', { panel: 'flashPanel' }, 'Open the **Flash Panel** tab: the Seedling regions play here, in the original game.'),
                ...look('look-flash-substrate', { panel: 'flashSubstratePanel' }, 'The **Flash Substrate** tab is the other way a SWF can be a region — a plain recompiled SWF, without Seedling\'s room model (the bot cannot walk those).'),
                ...startSeedlingGame('start-game'),
                ...botPlaysToTheEnd('bot-plays'),
            ],
        },
        {
            id: 'lab',
            title: 'The Procgen Lab',
            blocks: [
                ...look('open-lab', LAB, 'Open the **Procgen Lab — Seedling** tab: the Seedling room generator\'s own page, inside the app. Its status line says when it is connected.',
                    (ctx) => ctx.text(labStatus).includes('· connected')),
                {
                    step: {
                        id: 'lab-take',
                        text: 'Press **TAKE — the page\'s level**: the room the lab is showing comes into the box below, as data. **SEND** does the reverse — load a room you paste into the box.',
                        actions: [{ click: { ...LAB, selector: 'button.procgen-lab-take' } }],
                        done: (ctx) => Boolean(ctx.query({ ...LAB, selector: 'textarea.procgen-lab-box' })?.value.trim()),
                    },
                },
                { prose: '**open standalone ↗** opens the same lab page in a tab of its own; its links lead to the procgen demo catalogue and the glossary. The **Procgen Lab — maze** tab does the same for maze rooms.' },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [
                ...resetPipeline('reset-end'),
            ],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: 'The pipeline\'s Preset list has more Seedling worlds: a real atlas room as a sphere leaf, a room whose chest is a check, a room gated by water. The *Seedling* track goes further — the whole original game, recompiled and randomized.' },
        ],
    },
});
