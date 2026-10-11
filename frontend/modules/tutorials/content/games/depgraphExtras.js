/**
 * DepGraph: more graphs (catalogue D3, "extra features"): the other bundled
 * graphs as presets, the Region Graph view, and making a graph of your own
 * (the Task List converter — a terminal step). In progress: its walk row
 * measures `firstFailingStep`. Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { disableModules, enableModules } from '../steps/modules.js';
import { loadPresetWorld } from '../steps/procgen.js';
import { PROOF_MODULES, QUEUE } from './proofGames.js';

const MODE_URL = 'https://peerinfinity.github.io/Archipelago-CC/?mode=depgraph';
const REGION_GRAPH = { panel: 'regionGraphPanel' };

export const DEPGRAPH_EXTRAS = Object.freeze({
    id: 'depgraph-extras',
    title: 'DepGraph: more graphs, and your own',
    summary: 'Load DepGraph\'s other bundled graphs, see one in the Region Graph, and turn a task list of your own into a game.',
    track: 'games',
    status: 'in-progress',
    firstFailingStep: 'convert', // a terminal step (no stand-in)
    doc: null,
    intro: [
        { prose: 'DepGraph ships seven graphs — the coding and baking adventures, a tech tree, a skill tree, a recipe chain, the SWFRecomp vibe-coding plan and a task-flow example — and reads graphs of your own as JSON, DOT or CSV.' },
    ],
    sections: [
        {
            id: 'graphs',
            title: 'The bundled graphs',
            blocks: [
                ...enableModules('enable-modules', PROOF_MODULES, { modeName: 'DepGraph', modeUrl: MODE_URL }),
                ...loadPresetWorld('load-tech-tree', 'depgraph', 7, 'DepGraph (tech tree)'),
                {
                    step: {
                        id: 'look-tech-tree',
                        text: 'The **Proof Queue** now lists the tech tree\'s technologies.',
                        actions: [{ activate: QUEUE }],
                        done: (ctx) => ctx.isPanelShowing(QUEUE) && ctx.exists({ ...QUEUE, selector: '.pq-status' }),
                    },
                },
                ...loadPresetWorld('load-recipe-chain', 'depgraph', 13, 'DepGraph (recipe chain)'),
                { prose: 'In the **Presets** panel, the DepGraph seeds come in threes per graph: 1–3 the coding adventure, 4–6 baking, 7–9 the tech tree, 10–12 the skill tree, 13–15 the recipe chain, 16–18 the vibe-coding plan, 19–21 the task flow. The *vanilla* presets keep each item in its own place.' },
                {
                    step: {
                        id: 'region-graph',
                        text: 'Open the **Region Graph** tab: the same graph, laid out as regions. (In DepGraph\'s own mode, a click on a region there checks all its locations.)',
                        actions: [{ activate: REGION_GRAPH }],
                        done: (ctx) => ctx.isPanelShowing(REGION_GRAPH),
                    },
                },
            ],
        },
        {
            id: 'your-own',
            title: 'A graph of your own',
            blocks: [
                { prose: 'A DepGraph world reads its graph from its options: a bundled one by name, or a file of your own. The Task List converter turns a plain to-do list into one, choosing how tasks depend on each other (`layered`, `sparse`, `priority` or `categories`).' },
                {
                    step: {
                        id: 'convert',
                        outside: true,
                        text: 'In a checkout of this repository, convert a task list (one task per line) into a graph file.',
                        command: 'python worlds/depgraph/tasklist/tasklist_to_depgraph.py my_tasks.txt --approach layered -o my_graph.json',
                    },
                },
                { prose: 'Then name the file in a player YAML (DepGraph\'s graph options) and generate as with any game — *DepGraph: in a multiworld* goes through that.' },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [...disableModules('disable-modules', PROOF_MODULES)],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [{ prose: 'The [DepGraph feature page](../features/depgraph.md) lists every option.' }],
    },
});
