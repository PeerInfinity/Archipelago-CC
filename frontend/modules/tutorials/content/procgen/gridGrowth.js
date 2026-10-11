/**
 * Procgen: Grid growth, with Maze (catalogue P1, one tutorial per mode — ⚖ the
 * user, 2026-10-10). Ready (⚖ the user, 2026-10-10); its walk row holds it.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, openSection, resetPipeline, runAll,
} from '../steps/procgen.js';

export const PROCGEN_GRID_GROWTH = Object.freeze({
    id: 'procgen-grid-growth',
    title: 'Procgen: Grid growth, with Maze',
    summary: 'Generate a maze-only world with the legacy Grid growth mode, load it, and watch the Playback Bot finish it.',
    track: 'procgen',
    status: 'ready', // ⚖ the user, 2026-10-10 (tutorial-bugs)
    doc: 'docs/json/user/tutorials/procgen-grid-growth.md',
    intro: [
        { prose: '**Grid growth** is the pipeline\'s first mode, kept as the legacy grower: it grows regions cell by cell on a grid, drawing from the scenario pool, until the pool or the frontier runs out. How many regions you get is emergent.' },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...chooseMode('choose-mode', 'gridGrowth'),
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-maze', 'maze', 'Maze', 4),
                { prose: 'Grid growth can allocate substrates by *quotas* (fixed counts, the default) or a *mix* (weighted random per region) — the **Substrate allocation** switch above the list. With only Maze chosen, both give a maze world.' },
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
            { prose: 'Grid growth runs in one go — it has no step chips. The *Sphere growth* mode replaced it as the default because it plans the progression first.' },
        ],
    },
});
