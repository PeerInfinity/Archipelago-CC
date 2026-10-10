/**
 * Procgen: Top-down, with Maze (catalogue P1, one tutorial per mode — ⚖ the
 * user, 2026-10-10; the source world is Adventure seed 1, ⚖ 2026-10-10). In
 * progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, loadPresetWorld, openSection, resetPipeline, runAll,
} from '../steps/procgen.js';

export const PROCGEN_TOP_DOWN = Object.freeze({
    id: 'procgen-top-down',
    title: 'Procgen: Top-down, with Maze',
    summary: 'Turn an existing game\'s region graph (Adventure) into a world of mazes with the Top-down mode, and watch the Playback Bot finish it.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: '**Top-down** starts from a world that already exists — any game\'s rules.json — and *realises* it: every region becomes a generated room, and the source\'s access rules stay on the exits. This tutorial realises Atari 2600 *Adventure* as mazes.' },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...loadPresetWorld('load-source', 'adventure', 1, 'Adventure'),
                ...chooseMode('choose-mode', 'topDown'),
                ...openSection('open-source', 'topdown-source', 'Top-down source'),
                { prose: 'With **Use currently-loaded rules.json** ticked, the source is the world you just loaded — Adventure.' },
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-maze', 'maze', 'Maze'),
                { prose: 'Top-down always uses a *mix*: each region\'s substrate is drawn by weight. Maze alone, at any weight, makes every region a maze.' },
            ],
        },
        {
            id: 'generate',
            title: 'Generate and load',
            blocks: [
                ...runAll('generate', 'Generate'),
                { prose: 'The step chips are **1 Layout** (the source\'s regions placed on a grid), **2 Realise** (each one drawn as a maze), **3 Finalize** and **4 Compile**.' },
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
            { prose: 'Any loaded game can be a source — try a larger one from the **Presets** panel, or mix Maze with a text adventure.' },
        ],
    },
});
