/**
 * Other: the Vibe Coding Simulator (catalogue "Vibe Coding"; ruling 12 — an
 * April Fool's joke, though fully working; low priority). ⚖ The user,
 * 2026-10-10: listed normally, saying it is not likely to be fun to play;
 * default mode with its module ticked in the Modules panel (ruling 19), and a
 * link to its own mode. In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { disableModules, enableModules } from '../steps/modules.js';
import { loadPresetWorld } from '../steps/procgen.js';

const MODE_URL = 'https://peerinfinity.github.io/Archipelago-CC/?mode=vibecoding';
const SIM = { panel: 'vibeCodingSimPanel' };
const SIM_MODULES = [{ moduleId: 'vibeCodingSim', title: 'Vibe Coding Simulator', panel: 'vibeCodingSimPanel' }];
const docBadge = { ...SIM, selector: '.vcs-card:not(.vcs-card-workflow) .vcs-badge-row button.vcs-badge-btn:not(:disabled)', text: 'D' };
const acceptButton = { ...SIM, selector: 'button.vcs-badge-task-action[title="Accept changes"]' };

export const OTHER_VIBE_CODING = Object.freeze({
    id: 'other-vibe-coding',
    title: 'The Vibe Coding Simulator',
    summary: 'Manage unreliable AI agents building a project, one feature (one location) at a time — a joke game, fully playable.',
    track: 'other',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: 'The **Vibe Coding Simulator** started as an April Fool\'s joke: a project-management game in which AI agents write each feature\'s planning doc, code and tests, report success about half the time whatever they did, and you find out the truth by reviewing and testing. Each feature is a location of a DepGraph world. It works — but it is not likely to be fun to play.' },
        { prose: `It has a mode of its own, with its layout: [open it here](${MODE_URL}). This tutorial stays in the default layout.` },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...enableModules('enable-module', SIM_MODULES, { modeName: 'the Vibe Coding Simulator', modeUrl: MODE_URL }),
                ...loadPresetWorld('load', 'depgraph_vanilla', 7, 'DepGraph (the simulator\'s project)'),
            ],
        },
        {
            id: 'a-task',
            title: 'A task',
            blocks: [
                {
                    step: {
                        id: 'write-doc',
                        text: 'Open the **Vibe Coding Simulator** tab. The *Features* column lists the project; each feature has badges **D** (planning doc), **C** (code), **T** (tests) and **M** (manual review). Press **D** on the first feature: an agent starts writing its planning doc.',
                        actions: [{ click: docBadge }],
                        done: (ctx) => ctx.exists({ ...SIM, selector: '.vcs-task-bar-container' }),
                    },
                },
                {
                    step: {
                        id: 'speed',
                        text: 'Press **10×** to make the clock run faster, and wait for the agent to finish: its task waits for your review, with **✓** (accept) and **✗** (reject).',
                        actions: [{ click: { ...SIM, selector: '.vcs-btn-speed', text: '10×' } }],
                        done: (ctx) => ctx.exists(acceptButton),
                        doneTimeoutMs: 120000,
                    },
                },
                {
                    step: {
                        id: 'accept',
                        text: 'Press **✓** to accept the agent\'s work. Was it any good? Only reviews, tests and the manual check will tell — the agent\'s own report is right about half the time.',
                        actions: [{ click: acceptButton }],
                        done: (ctx) => !ctx.exists(acceptButton),
                    },
                },
                { prose: 'The game\'s README (Quick Launch → Help) explains the rest: reviewing a task\'s timeline, rewinding to its first bad step, merge conflicts, and the test workflow.' },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [
                { step: { id: 'pause', text: 'Press **⏸** to stop the clock.', actions: [{ click: { ...SIM, selector: '.vcs-btn-speed', text: '⏸' } }] } },
                ...disableModules('disable-module', SIM_MODULES),
            ],
        },
    ],
    outro: null,
});
