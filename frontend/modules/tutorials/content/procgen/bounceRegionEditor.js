/**
 * Procgen: the Bounce Region Editor (catalogue: part of procgen, ⚖ the user,
 * 2026-10-10): a bounce region of a generated world opened in the editor from
 * the pipeline's step 3, a platform changed, saved back, recompiled, played.
 * In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    PIPELINE, botPlaysToTheEnd, choosePreset, generatedSinceStep, loadIntoFrontend, openSection, resetPipeline, runAll,
} from '../steps/procgen.js';

const EDITOR = { panel: 'bounceRegionEditorPanel' };
const editorTitle = { ...EDITOR, selector: '.bre-title' };
const editorSide = { ...EDITOR, selector: '.bre-sidebar' };
const editorMessage = { ...EDITOR, selector: '.bre-message' };

export const PROCGEN_BOUNCE_REGION_EDITOR = Object.freeze({
    id: 'procgen-bounce-region-editor',
    title: 'Procgen: editing a bounce region',
    summary: 'Open a generated world\'s bounce zone in the Bounce Region Editor, change a platform, save it back to the pipeline, and play the result.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: 'bot-plays',
    doc: null,
    intro: [
        { prose: 'A generated region is not final: the pipeline\'s step 3 lists every region it built, and **Edit ▸** opens one in its substrate\'s editor. For a bounce zone that is the **Bounce Region Editor** — its platforms, pickups and portals on a canvas, and the access rules they imply, re-derived as you edit.' },
    ],
    sections: [
        {
            id: 'world',
            title: 'A world with bounce zones',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...choosePreset('choose-preset', 'shipped:maze-bounce-sphere-mix', 'Maze + bounce (sphere growth)'),
                ...runAll('run-all'),
                ...openSection('open-steps', 'sphere-pipeline', 'Sphere pipeline'),
            ],
        },
        {
            id: 'edit',
            title: 'Edit a bounce zone',
            blocks: [
                {
                    step: {
                        id: 'edit-region',
                        text: 'In the **Sphere pipeline** section\'s region list, find a region whose substrate reads **Bounce Demo** and press its **Edit ▸**. The **Bounce Region Editor** opens with that zone.',
                        actions: [{
                            click: {
                                ...PIPELINE,
                                selector: 'div:has(> select.procgen-pipeline-region-substrate option[value="bounce"]:checked) > button',
                                text: 'Edit ▸',
                            },
                        }],
                        done: (ctx) => ctx.isPanelShowing(EDITOR) && ctx.text(editorTitle).includes('[pipeline]'),
                    },
                },
                {
                    step: {
                        id: 'pick-platform',
                        text: 'Pick a platform — click it on the canvas, or choose it in the sidebar\'s **pick** drop-down (here **b1**, the second from the bottom). The sidebar shows its fields — position, width, kind — and **Derived access rules** lists what reaching each exit needs.',
                        actions: [{ select: { ...EDITOR, selector: 'select.bre-platform-pick', value: 'b1' } }],
                        done: (ctx) => ctx.text(editorSide).includes('selected: b1'),
                    },
                },
                { prose: 'Change a field — move the platform, widen it — and watch the rules update; **↶ Undo** takes an edit back.' },
                {
                    step: {
                        id: 'save',
                        text: 'Press **Save**: the edited zone goes back into the pipeline\'s world.',
                        actions: [{ click: { ...EDITOR, selector: '.bre-toolbar button', text: 'Save' } }],
                        done: (ctx) => ctx.text(editorMessage).startsWith('Saved'),
                    },
                },
            ],
        },
        {
            id: 'recompile',
            title: 'Recompile and play',
            blocks: [
                {
                    step: {
                        id: 'recompile',
                        text: 'Back in the **Procgen Pipeline**, press **Run 4 Compile**: the world\'s rules are written again, with your zone in them.',
                        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Run 4 Compile' } }],
                        done: generatedSinceStep,
                        doneTimeoutMs: 60000,
                    },
                },
                ...loadIntoFrontend('load'),
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
            { prose: 'The editor also opens on its own — its *Load fixture…* list has hand-made levels — and **Export level JSON** saves a level to a file.' },
        ],
    },
});
