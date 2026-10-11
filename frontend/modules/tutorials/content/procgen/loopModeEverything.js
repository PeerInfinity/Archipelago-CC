/**
 * Procgen: everything, in Loop mode (catalogue P6): JtA, a generated Seedling
 * room, Maze, Text adventure, Bounce, Noiz2sa and Idle Loops (omsi) in one
 * loop-mode world, played by the bot. ⚖ The user, 2026-10-10: the pool + the
 * loop-mode parameter; Seedling on wasm. In progress: its walk row measures
 * `firstFailingStep`. Shape: ../../tutorialShape.js; shared steps: ../steps/.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    SEEDLING_RUNTIME_NOTE, addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, look, openSection,
    resetPipeline, runAll, tickParam,
} from '../steps/procgen.js';

const loopToggle = { panel: 'loopsPanel', selector: '#loop-ui-toggle-loop-mode' };

export const PROCGEN_LOOP_MODE_EVERYTHING = Object.freeze({
    id: 'procgen-loop-mode-everything',
    title: 'Procgen: everything, in Loop mode',
    summary: 'Mix every substrate — Idle Loops included — into one loop-mode world sharing one mana pool, and watch the bot finish it.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: 'bot-plays',
    doc: null,
    intro: [
        { prose: 'The last procgen tutorial puts it all together: JtA zones, a generated Seedling room, mazes, a text adventure, a bounce zone, a Noiz2sa stage and *Idle Loops* — another idle game, which only runs in loop mode — in one world, every action spending the same mana.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [
        {
            id: 'world',
            title: 'Fill the pool, loop mode on',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...chooseMode('choose-mode', 'shuffledSpiral'),
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-jta', 'jta', 'JtA', 2),
                ...addSubstrate('add-seedling', 'flash_seedling_gen', 'Seedling (generated room)'),
                ...addSubstrate('add-maze', 'maze', 'Maze', 2),
                ...addSubstrate('add-text-adventure', 'text_adventure', 'Text Adventure'),
                ...addSubstrate('add-bounce', 'bounce', 'Bounce Demo'),
                ...addSubstrate('add-noiz2sa', 'noiz2sa', 'Noiz2sa'),
                ...addSubstrate('add-omsi', 'omsi', 'Idle Loops'),
                ...openSection('open-parameters', 'parameters', 'Parameters'),
                ...tickParam('loop-mode', 'enableLoopMode', 'Enable loop mode'),
                ...runAll('generate', 'Generate'),
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'play',
            title: 'Play it',
            blocks: [
                ...look('look-loops', { panel: 'loopsPanel' }, 'Open the **Loops** tab: loop mode is on (**Exit Loop Mode** in its controls), and every region\'s block is there to queue.',
                    (ctx) => ctx.text(loopToggle) === 'Exit Loop Mode'),
                ...look('look-omsi', { panel: 'omsiSubstrateWrapperPanel' }, 'The **Idle Loops** tab plays its region: the whole town of the idle game, spending the shared mana.'),
                ...botPlaysToTheEnd('bot-plays', { watch: { panel: 'loopsPanel' }, watchName: 'Loops', how: 'queue and run each region' }),
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
            { prose: 'Take the world to a multiworld the same way as any other: *Procgen: from a generated world to a multiworld*.' },
        ],
    },
});
