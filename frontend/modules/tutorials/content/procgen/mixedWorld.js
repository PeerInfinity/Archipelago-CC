/**
 * Procgen: a mixed world (catalogue P4): one world built from several
 * substrates — maze, text adventure, bounce, Noiz2sa and a generated Seedling
 * room — played to the end by the Playback Bot; plus the Substrate Registry.
 * ⚖ The user, 2026-10-10: a custom pool built in the tutorial; Seedling stays
 * on the wasm runtime (mention the switch). In progress: its walk row measures
 * `firstFailingStep`. Shape: ../../tutorialShape.js; shared steps: ../steps/.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    SEEDLING_RUNTIME_NOTE, addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, look, openSection,
    resetPipeline, runAll, startSeedlingGame,
} from '../steps/procgen.js';

const REGISTRY = { panel: 'substrateRegistryPanel' };
const matrixButton = { ...REGISTRY, selector: 'button.srp-mode[data-mode="matrix"]' };

export const PROCGEN_MIXED_WORLD = Object.freeze({
    id: 'procgen-mixed-world',
    title: 'Procgen: a mixed world',
    summary: 'Build one world from a maze, a text adventure, a bounce zone, a Noiz2sa stage and a generated Seedling room, and watch the Playback Bot play every kind.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: null, // every step works since the ▶ Start step + a WebGPU test browser; ready = the user's call
    doc: null,
    intro: [
        { prose: 'Each region of a generated world is drawn by a *substrate* — a kind of game that knows how to make a room, put items in it, and gate its exits. One world can mix them: the logic underneath does not care whether a key sits at the end of a maze, a text adventure\'s room or a platform.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [
        {
            id: 'pool',
            title: 'Fill the scenario pool',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...chooseMode('choose-mode', 'shuffledSpiral'),
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-maze', 'maze', 'Maze', 2),
                ...addSubstrate('add-text-adventure', 'text_adventure', 'Text Adventure'),
                ...addSubstrate('add-bounce', 'bounce', 'Bounce Demo'),
                ...addSubstrate('add-noiz2sa', 'noiz2sa', 'Noiz2sa'),
                ...addSubstrate('add-seedling', 'flash_seedling_gen', 'Seedling (generated room)'),
                { prose: 'Hover a substrate\'s name to see its card: what it can hold and how its exits are gated.' },
            ],
        },
        {
            id: 'generate',
            title: 'Generate and load',
            blocks: [
                ...runAll('generate', 'Generate'),
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'panels',
            title: 'Where each kind of region plays',
            blocks: [
                ...look('look-text-adventure', { panel: 'textAdventureSubstrateWrapperPanel' }, 'The **Text Adventure** tab plays text-adventure regions: rooms described in words, exits and items you click.'),
                ...look('look-bounce', { panel: 'bounceDemoPanel' }, 'The **Bounce Demo** tab plays bounce zones: a platformer whose jumps are the progression.'),
                ...look('look-noiz2sa', { panel: 'noiz2saSubstratePanel' }, 'The **Noiz2sa** tab plays Noiz2sa stages: a bullet-hell shooter, where surviving a stage opens its exit.'),
                ...look('look-seedling', { panel: 'flashPanel' }, 'The **Flash Panel** plays the generated Seedling room in the original game.'),
                ...startSeedlingGame('start-game'),
                { prose: 'Mazes play in the **Maze Room**, as before. When the player walks into a region, the app brings its panel forward.' },
            ],
        },
        {
            id: 'play',
            title: 'Watch it played',
            blocks: [
                ...botPlaysToTheEnd('bot-plays'),
                { prose: 'The bot drives each region with that substrate\'s own controller — walking the maze, choosing the text adventure\'s exits, jumping the platforms.' },
            ],
        },
        {
            id: 'registry',
            title: 'What each substrate can do',
            blocks: [
                ...look('open-registry', REGISTRY, 'Open the **Substrate Registry** tab: every substrate the app has, one per row.'),
                {
                    step: {
                        id: 'registry-matrix',
                        text: 'Press **Matrix**: a column per capability (sphere growth, items, gated exits, the bot…), a check where the substrate has it.',
                        actions: [{ click: matrixButton }],
                        done: (ctx) => ctx.exists({ ...REGISTRY, selector: '.srp-matrix' }),
                    },
                },
                { prose: '**Detail** shows one substrate at a time; the filter box narrows the rows.' },
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
            { prose: 'The same pool in Loop mode: *Procgen: everything, in Loop mode*.' },
        ],
    },
});
