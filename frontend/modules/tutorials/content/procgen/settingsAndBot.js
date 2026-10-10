/**
 * Procgen: settings and the Playback Bot (catalogue P1's "other settings, the
 * playback bot" — its own tutorial, ⚖ the user, 2026-10-10). In progress: its
 * walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    BOT, MAZE, PIPELINE, botCannotFinish, choosePreset, generatedSinceStep, loadIntoFrontend, openSection, resetPipeline, setParam,
} from '../steps/procgen.js';

const botStatus = { ...BOT, selector: '.playback-bot .playback-bot-status' };
const botButton = (name) => ({ ...BOT, selector: `.playback-bot .playback-control-bar-button-${name}` });
const nextStep = (label) => ({ ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: label });
const finished = (ctx) => ctx.text(botStatus).startsWith('finished');

/** One sphere step button: press it, and the next one's label shows. */
function sphereStep(id, label, next, text) {
    return {
        step: {
            id,
            text,
            actions: [{ click: nextStep(label) }],
            done: (ctx) => ctx.exists(nextStep(next)),
            doneTimeoutMs: 60000,
        },
    };
}

export const PROCGEN_SETTINGS_AND_BOT = Object.freeze({
    id: 'procgen-settings-and-bot',
    title: 'Procgen: settings and the Playback Bot',
    summary: 'Change a generated world\'s seed and size, run the pipeline one step at a time, and drive the Playback Bot by hand.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: 'The mode tutorials press **Run all** and **▶**. This one opens up both: the parameters that shape a world, the pipeline\'s steps one at a time, and the bot\'s other controls.' },
    ],
    sections: [
        {
            id: 'parameters',
            title: 'Parameters',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...choosePreset('choose-preset', 'shipped:maze-sphere-demo', 'Maze demo (sphere growth)'),
                ...openSection('open-parameters', 'parameters', 'Parameters'),
                ...setParam('set-seed', 'seed', 'Seed', 7),
                { prose: 'The seed picks one world among all the ones these settings allow; the same seed always gives the same world. Changing any setting flips the Preset drop-down back to *Custom* — your setup is your own now.' },
                ...setParam('set-spheres', 'sphereCount', 'Spheres', 3),
                ...setParam('set-filler', 'fillerCount', 'Filler regions', 1),
                { prose: '*Spheres* is how many rounds of progression the plan has; *Filler regions* adds rooms with nothing in them. **Save Params** / **Load Params** keep a setup, and **Reset Defaults** puts just these parameters back.' },
            ],
        },
        {
            id: 'one-step-at-a-time',
            title: 'One step at a time',
            blocks: [
                { prose: 'Beside **Run all** is a button for the NEXT step only. Each step\'s output shows below in the **Sphere pipeline** section, where it can be looked at, and some can be edited, before the next step runs.' },
                sphereStep('run-plan', 'Run 1 Plan', 'Run 2a Allocate', 'Press **Run 1 Plan**: the plan — which items each sphere holds and how many regions it needs.'),
                sphereStep('run-allocate', 'Run 2a Allocate', 'Run 2b Topology', 'Press **Run 2a Allocate**: each region gets its substrate (here, always Maze).'),
                {
                    step: {
                        id: 'run-finish',
                        text: 'Press **Run all (finish)** to run the remaining steps.',
                        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn-primary', text: 'Run all (finish)' } }],
                        done: generatedSinceStep,
                        doneTimeoutMs: 120000,
                    },
                },
                { prose: '**◀ Previous sphere** drops the last sphere built, so it can be grown again; **Reset** clears the steps.' },
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'the-bot',
            title: 'The Playback Bot',
            blocks: [
                {
                    step: {
                        id: 'bot-open',
                        text: 'Open the **Playback Bot** tab: "Sphere log loaded".',
                        actions: [{ activate: BOT }],
                        done: (ctx) => ctx.isPanelShowing(BOT) && ctx.text(botStatus).startsWith('Sphere log loaded'),
                    },
                },
                {
                    step: {
                        id: 'bot-step',
                        text: 'Press **⏯** (Step): the bot takes one action and stops. Its status line says what it is doing.',
                        actions: [{ click: botButton('step') }],
                        done: (ctx) => ctx.seenSinceStep('moved', () => !ctx.text(botStatus).startsWith('Sphere log loaded')),
                    },
                },
                {
                    step: {
                        id: 'bot-play',
                        text: 'Press **▶** (Play) and open the **Maze Room** to watch it walk the rest of the way. **⏹** stops it.',
                        actions: [{ click: botButton('play') }, { activate: MAZE }],
                        done: (ctx) => ctx.seenSinceStep('running', () => !finished(ctx)) && finished(ctx),
                        failed: botCannotFinish,
                        doneTimeoutMs: 180000,
                    },
                },
                {
                    prose: [
                        '- **⏭** (Instant) plays the rest at once, without walking; **↺** (Reset) starts the run over.',
                        '- **Manual walk-to**: pick a region (and optionally a cell), press **Go**, and the bot walks the player there — handy for looking at one room. It is off while a sphere run is going.',
                        '- **Route clicks to bot**: with it on, a click on a location in the **Locations** or **Exits** panel sends the bot there instead of checking it at once.',
                        '- You can always walk yourself: click into the **Maze Room** and use the arrow keys.',
                    ].join('\n'),
                },
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
            { prose: 'The mode tutorials (*Sphere growth*, *Shuffled spiral*, *Grid growth*, *Top-down*) each build a world a different way; the bot plays any of them.' },
        ],
    },
});
