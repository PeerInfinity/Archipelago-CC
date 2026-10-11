/**
 * MetaMath: play a demo preset (catalogue M1). Default mode, modules on in the
 * Modules panel (⚖ the user, 2026-10-10). In progress: its walk row measures
 * `firstFailingStep`. Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { graphSteps, queueSteps, setUp, tidyUp } from './proofGames.js';

const MODE_URL = 'https://peerinfinity.github.io/Archipelago-CC/?mode=metamath';

export const METAMATH_DEMO = Object.freeze({
    id: 'metamath-demo',
    title: 'MetaMath: prove 2 + 2 = 4',
    summary: 'Play a MetaMath proof as an Archipelago game: each proof step is a location, unlocked when the steps it depends on are proved.',
    track: 'games',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: '*MetaMath* turns a formal proof from the [Metamath](https://us.metamath.org/) library into a game: every step of the proof is a location, and a step can be checked once the steps it uses are proved. The demo proves 2 + 2 = 4 (`2p2e4`).' },
        { prose: `MetaMath has a mode of its own, with these panels already open: [open it here](${MODE_URL}). This tutorial stays in the default layout and switches the panels on itself.` },
    ],
    sections: [
        { id: 'set-up', title: 'Set up', blocks: setUp({ modeName: 'MetaMath', modeUrl: MODE_URL, game: 'metamath', seed: 1, title: 'MetaMath 2p2e4' }) },
        { id: 'graph', title: 'The proof as a graph', blocks: graphSteps({ nodeWord: 'proof step' }) },
        { id: 'prove', title: 'Prove it', blocks: queueSteps({ unitWord: 'step', completeText: 'Proof complete!' }) },
        { id: 'tidy-up', title: 'Tidy up', blocks: tidyUp() },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: 'The Presets panel has two more proofs (`canth`, Cantor\'s theorem, and `wilth`, Wilson\'s theorem), each with three seeds. *MetaMath: in a multiworld* plays one with other games.' },
        ],
    },
});
