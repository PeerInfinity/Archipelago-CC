/**
 * DepGraph: play a demo preset (catalogue D1). Default mode, modules on in the
 * Modules panel (⚖ the user, 2026-10-10). In progress: its walk row measures
 * `firstFailingStep`. Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { graphSteps, queueSteps, setUp, tidyUp } from './proofGames.js';

const MODE_URL = 'https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph';

export const DEPGRAPH_DEMO = Object.freeze({
    id: 'depgraph-demo',
    title: 'DepGraph: a coding adventure',
    summary: 'Play a dependency graph as an Archipelago game: each task is a location, unlocked when the tasks it depends on are done.',
    track: 'games',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: '*DepGraph* makes a game of any dependency graph — a tech tree, a recipe chain, a to-do list: each node is a location, and it can be checked once its dependencies are. The demo is the *coding adventure* graph.' },
        { prose: `DepGraph has a mode of its own, with these panels already open: [open it here](${MODE_URL}). This tutorial stays in the default layout and switches the panels on itself.` },
    ],
    sections: [
        { id: 'set-up', title: 'Set up', blocks: setUp({ modeName: 'DepGraph', modeUrl: MODE_URL, game: 'depgraph', seed: 1, title: 'DepGraph (coding adventure)' }) },
        { id: 'graph', title: 'The graph', blocks: graphSteps({ nodeWord: 'task' }) },
        { id: 'solve', title: 'Solve it', blocks: queueSteps({ unitWord: 'task', completeText: 'Solution complete!' }) },
        { id: 'tidy-up', title: 'Tidy up', blocks: tidyUp() },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: '*DepGraph: more graphs* loads the other bundled graphs and shows how to make your own.' },
        ],
    },
});
