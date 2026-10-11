/**
 * Procgen: Shuffled spiral, with Maze (catalogue P1, one tutorial per mode — ⚖
 * the user, 2026-10-10). Ready (⚖ the user, 2026-10-10); its walk row holds it.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, openSection, resetPipeline, runAll,
} from '../steps/procgen.js';

export const PROCGEN_SHUFFLED_SPIRAL = Object.freeze({
    id: 'procgen-shuffled-spiral',
    title: 'Procgen: Shuffled spiral, with Maze',
    summary: 'Generate a maze-only world with the Shuffled spiral mode, load it, and watch the Playback Bot finish it.',
    track: 'procgen',
    status: 'ready', // ⚖ the user, 2026-10-10 (tutorial-bugs)
    doc: 'docs/json/user/tutorials/procgen-shuffled-spiral.md',
    intro: [
        { prose: '**Shuffled spiral** lays its regions out from a centre cell outwards, in shuffled zones, and then places the scenario\'s items so the world can be finished. You choose how many regions of each substrate it makes — here, mazes only.' },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...chooseMode('choose-mode', 'shuffledSpiral'),
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-maze', 'maze', 'Maze', 4),
                { prose: 'In this mode the counts are *quotas*: the world gets exactly four maze regions. The scenario\'s items (a red key, a blue key and Victory, unless you change them) are spread over them.' },
            ],
        },
        {
            id: 'generate',
            title: 'Generate and load',
            blocks: [
                ...runAll('generate', 'Generate'),
                { prose: 'The step chips are **1 Arrange** (the spiral), **2 Content**, **3 Regions** (each maze drawn) and **4 Compile**.' },
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'play',
            title: 'Watch it played',
            blocks: [
                ...botPlaysToTheEnd('bot-plays'),
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
            { prose: 'Add a second substrate to the pool (a text adventure, a bounce zone) and generate again: the spiral mixes them, each region its own kind of game.' },
        ],
    },
});
