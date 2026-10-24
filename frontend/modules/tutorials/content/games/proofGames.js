/**
 * The MetaMath and DepGraph tutorials share their panels — the Proof Queue
 * and the Proof Graph — so their steps are built here, once. ⚖ The user,
 * 2026-10-10: default mode, the modules switched on in the Modules panel (the
 * game's own mode makes that unnecessary — said in the step); the Proof
 * Graph's two-click connect mode (added for this) is how a tutorial connects
 * nodes.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { disableModules, enableModules } from '../steps/modules.js';
import { loadPresetWorld } from '../steps/procgen.js';

export const QUEUE = Object.freeze({ panel: 'proofQueuePanel' });
export const GRAPH = Object.freeze({ panel: 'proofGraphPanel' });
export const PROOF_MODULES = Object.freeze([
    { moduleId: 'proofQueue', title: 'Proof Queue', panel: 'proofQueuePanel' },
    { moduleId: 'proofGraph', title: 'Proof Graph', panel: 'proofGraphPanel' },
]);

const queueStatus = { ...QUEUE, selector: '.pq-status' };
const graphStatus = { ...GRAPH, selector: '.pg-status' };
const connectButton = { ...GRAPH, selector: 'button.pg-btn-connect' };

/** Switch the two panels on, and load the game's preset. */
export function setUp({ modeName, modeUrl, game, seed, title }) {
    return [
        ...enableModules('enable-modules', PROOF_MODULES, { modeName, modeUrl }),
        ...loadPresetWorld('load', game, seed, title),
    ];
}

/** Look at the graph, and switch on its two-click connect mode. */
export function graphSteps({ nodeWord }) {
    return [
        {
            step: {
                id: 'open-graph',
                text: `Open the **Proof Graph** tab: every ${nodeWord} is a node, and an arrow runs from each dependency to the ${nodeWord} that uses it — you draw the arrows. The status line counts them.`,
                actions: [{ activate: GRAPH }],
                done: (ctx) => ctx.isPanelShowing(GRAPH) && ctx.text(graphStatus).startsWith('Edges:'),
            },
        },
        {
            step: {
                id: 'connect-mode',
                text: 'Press **Click to connect** to turn on the two-click mode: click a dependency, then the node that uses it, and the arrow is drawn (dragging from a node does the same with the mode off). A wrong pair flashes red and counts as *Wrong*.',
                actions: [{ click: connectButton }],
                done: (ctx) => ctx.query(connectButton)?.getAttribute('aria-pressed') === 'true',
            },
        },
        {
            step: {
                id: 'connect-mode-off',
                text: 'Press it again to go back to dragging. With the mode off, a click on a node whose arrows are all drawn checks it — as **Check Next** does.',
                actions: [{ click: connectButton }],
                done: (ctx) => ctx.query(connectButton)?.getAttribute('aria-pressed') === 'false',
            },
        },
    ];
}

/** Play the whole game in the Proof Queue, on Trivial with Auto-check. */
export function queueSteps({ unitWord, completeText }) {
    const difficulty = { ...QUEUE, selector: 'select.pq-select-difficulty' };
    const autocheck = { ...QUEUE, selector: 'input.pq-cb-autocheck' };
    return [
        {
            step: {
                id: 'open-queue',
                text: `Open the **Proof Queue** tab: the ${unitWord}s, in order, each with the ones it depends on. A ${unitWord} joins the queue when it becomes available.`,
                actions: [{ activate: QUEUE }],
                done: (ctx) => ctx.isPanelShowing(QUEUE) && ctx.exists(queueStatus),
            },
        },
        {
            step: {
                id: 'trivial',
                text: 'Set the difficulty to **Trivial**: no dependencies to type, so each step can be checked as soon as it is available.',
                actions: [{ select: { ...difficulty, value: 'trivial' } }],
                done: (ctx) => ctx.query(difficulty)?.value === 'trivial',
            },
        },
        {
            step: {
                id: 'autocheck',
                text: `Tick **Auto-check**: every available ${unitWord} is checked in turn, until the status reads *${completeText}*`,
                actions: [{ click: { ...autocheck, selector: 'input.pq-cb-autocheck:not(:checked)', optional: true } }],
                done: (ctx) => ctx.text(queueStatus) === completeText,
                // Auto-check paces itself (61 DepGraph tasks took 15–60 s on the
                // box); a status that stops changing is the failure, not the clock.
                failed: (ctx) => (ctx.unchangedFor('queue-status', ctx.text(queueStatus), 30000)
                    ? `the Proof Queue has said "${ctx.text(queueStatus)}" for 30 s` : null),
                doneTimeoutMs: 180000,
            },
        },
        {
            prose: `On **Easy** and above, each row asks for the step numbers of its dependencies, typed into its boxes; a row turns clickable when they are right. **Hard** adds a five-second wait after a wrong answer. **Check Next** checks the next ready ${unitWord} without Auto-check.`,
        },
    ];
}

export function tidyUp() {
    return [
        { prose: 'Untick **Auto-check** if you want to play by hand next time.' },
        ...disableModules('disable-modules', PROOF_MODULES),
    ];
}
