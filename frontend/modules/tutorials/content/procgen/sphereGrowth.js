/**
 * Procgen: Sphere growth, with Maze (catalogue P1, one tutorial per mode — ⚖
 * the user, 2026-10-10). Ready (⚖ the user, 2026-10-10); its walk row holds it.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    botPlaysToTheEnd, choosePreset, loadIntoFrontend, resetPipeline, runAll,
} from '../steps/procgen.js';

export const PROCGEN_SPHERE_GROWTH = Object.freeze({
    id: 'procgen-sphere-growth',
    title: 'Procgen: Sphere growth, with Maze',
    summary: 'Generate a maze-only world with the Sphere growth mode, load it, and watch the Playback Bot finish it.',
    track: 'procgen',
    status: 'ready', // ⚖ the user, 2026-10-10 (tutorial-bugs)
    doc: 'docs/json/user/tutorials/procgen-sphere-growth.md',
    intro: [
        { prose: '**Sphere growth** is the pipeline\'s default mode: it plans the item progression first — which items unlock which, sphere by sphere — and then grows a world to match. This tutorial builds a world from mazes alone, so you can see the plan become rooms.' },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...choosePreset('choose-preset', 'shipped:maze-sphere-demo', 'Maze demo (sphere growth)'),
                { prose: 'The preset plans four keys and the Victory item over five spheres, with two empty "filler" regions and some revisits. The **Mode** section now shows *Sphere growth*, and the **Scenario Pool** has only *Maze*.' },
            ],
        },
        {
            id: 'generate',
            title: 'Generate and load',
            blocks: [
                ...runAll('run-all'),
                { prose: 'Watch the step chips: **1 Plan** decides the spheres, **2a Allocate**, **2b Topology** and **2c Items** lay them out, **3 Build regions** draws each maze, and **4 Compile** writes the world\'s rules.' },
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'play',
            title: 'Watch it played',
            blocks: [
                ...botPlaysToTheEnd('bot-plays'),
                { prose: 'The bot\'s log follows the plan: each sphere\'s keys, then the doors they open, then Victory.' },
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
            { prose: 'The other modes build worlds differently: *Shuffled spiral*, *Grid growth* and *Top-down* each have a tutorial like this one. *Procgen: settings and the Playback Bot* goes through the knobs.' },
        ],
    },
});
