/**
 * APCalc: play a demo preset (catalogue A1), and generate a world of your own
 * with the APCalc Generator (A2, through the .apworld button F1 added). Default mode, modules on
 * in the Modules panel (⚖ the user, 2026-10-10). apcalc-demo is in progress (its
 * walk row measures `firstFailingStep`); apcalc-generator is ready (⚖ the user,
 * 2026-10-10). Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { disableModules, enableModules } from '../steps/modules.js';
import { loadPresetWorld } from '../steps/procgen.js';

const MODE_URL = 'https://peerinfinity.github.io/Archipelago-CC/?mode=apcalc';
const CALC = { panel: 'apcalcPanel' };
const GEN = { panel: 'apcalcGeneratorPanel' };
const progress = { ...CALC, selector: '.apcalc-status-progress' };
const CALC_MODULES = [{ moduleId: 'apcalc', title: 'APCalc', panel: 'apcalcPanel' }];
const GEN_MODULES = [...CALC_MODULES, { moduleId: 'apcalcGenerator', title: 'APCalc Generator', panel: 'apcalcGeneratorPanel' }];
const GEN_SEED = 7;
const checkedCount = (ctx) => Number.parseInt(ctx.text(progress), 10);

export const APCALC_DEMO = Object.freeze({
    id: 'apcalc-demo',
    title: 'APCalc: the calculator game',
    summary: 'Play APCalc: a calculator whose number and operation keys are the items, and whose results are the locations.',
    track: 'games',
    status: 'in-progress',
    firstFailingStep: 'reach-target', // a by-hand step: the walk cannot know a target's digits
    doc: null,
    intro: [
        { prose: '*APCalc* is a calculator as an Archipelago game. Its keys — digits and operations — are items, each with a limited number of presses; reaching a number on the map checks it as a location, and each layer of the map needs the operations found in the one before.' },
        { prose: `APCalc has a mode of its own, with its panels already open: [open it here](${MODE_URL}). This tutorial stays in the default layout and switches the panel on itself.` },
    ],
    sections: [
        {
            id: 'set-up',
            title: 'Set up',
            blocks: [
                ...enableModules('enable-modules', CALC_MODULES, { modeName: 'APCalc', modeUrl: MODE_URL }),
                ...loadPresetWorld('load', 'apcalc', 1, 'APCalc'),
            ],
        },
        {
            id: 'play',
            title: 'Play',
            blocks: [
                {
                    step: {
                        id: 'easy',
                        text: 'Open the **APCalc** tab and choose **Easy**: the status line then lists the *Targets* you can reach from here.',
                        actions: [{ click: { ...CALC, selector: '.apcalc-difficulty-btn', text: 'Easy' } }],
                        done: (ctx) => ctx.exists({ ...CALC, selector: '.apcalc-difficulty-btn.apcalc-difficulty-active', text: 'Easy' }),
                    },
                },
                {
                    step: {
                        id: 'reach-target',
                        text: 'Type one of the targets with the digit keys and press **=**. Reaching it checks it: the progress reads *1/… checked*, and the number appears under **Discovered Paths**.',
                        done: (ctx) => checkedCount(ctx) >= 1,
                        doneTimeoutMs: 60000,
                    },
                },
                { prose: 'From a reached number, an operation and more digits lead to the next layer. A key with no presses left greys out — find more of it as items. **C** clears the display.' },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [...disableModules('disable-modules', CALC_MODULES)],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [{ prose: '*APCalc: generate a world* makes a new map with the generator.' }],
    },
});

export const APCALC_GENERATOR = Object.freeze({
    id: 'apcalc-generator',
    title: 'APCalc: generate a world',
    summary: 'Generate a new APCalc map with the APCalc Generator, play it, and package it as a .apworld.',
    track: 'games',
    status: 'ready', // ⚖ the user, 2026-10-10 (tutorial-bugs)
    doc: 'docs/json/user/tutorials/apcalc-generator.md',
    intro: [
        { prose: 'The **APCalc Generator** builds APCalc maps in the browser: how many spheres, how many operations and numbers each one adds, how branchy the map is. The result plays at once, saves as a rules.json, and — with the .apworld button — becomes a game Archipelago can host.' },
    ],
    sections: [
        {
            id: 'generate',
            title: 'Generate',
            blocks: [
                ...enableModules('enable-modules', GEN_MODULES, { modeName: 'APCalc', modeUrl: MODE_URL }),
                {
                    step: {
                        id: 'seed',
                        text: `In the **APCalc Generator** tab, set **seed** to **${GEN_SEED}**. The other fields shape the map: spheres, operations and numbers per sphere, trash, branches.`,
                        actions: [{ fill: { ...GEN, selector: '#apcalc-gen-seed', value: String(GEN_SEED) } }],
                        done: (ctx) => ctx.query({ ...GEN, selector: '#apcalc-gen-seed' })?.value === String(GEN_SEED),
                    },
                },
                {
                    step: {
                        id: 'generate',
                        text: 'Press **Generate**. The log ends with *Export complete.*, and the results show the map\'s size.',
                        actions: [{ click: { ...GEN, selector: 'button.apcalc-gen-btn-primary' } }],
                        done: (ctx) => ctx.text({ ...GEN, selector: '.apcalc-gen-log' }).includes('Export complete.')
                            && ctx.text({ ...GEN, selector: '.apcalc-gen-summary' }).endsWith(`seed ${GEN_SEED}`),
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'load',
                        text: 'Press **Load in Frontend**: the new map is the loaded game, and the **APCalc** tab plays it.',
                        actions: [{ click: { ...GEN, selector: '.apcalc-gen-btn', text: 'Load in Frontend' } }],
                        done: (ctx) => ctx.rulesLoadedSinceStep(),
                        doneTimeoutMs: 30000,
                    },
                },
                { prose: '**Download rules.json** saves the map as a file, to load again from the **JSON** panel.' },
            ],
        },
        {
            id: 'apworld',
            title: 'Package it as a .apworld',
            blocks: [
                {
                    step: {
                        id: 'apworld',
                        text: 'Press **⭳ .apworld**: the generator runs Archipelago\'s world generator in your browser on this map and saves it as a game for `custom_worlds/` — as the APWorld Editor does for procgen worlds. The first build loads Python (~10 MB); the log ends with *.apworld: downloaded apcalc.apworld*.',
                        actions: [{ click: { ...GEN, selector: 'button.apcalc-gen-apworld' } }],
                        done: (ctx) => /\.apworld: downloaded \S+\.apworld/.test(ctx.text({ ...GEN, selector: '.apcalc-gen-log' })),
                        failed: (ctx) => ctx.text({ ...GEN, selector: '.apcalc-gen-log' }).match(/\.apworld: build failed: .*/)?.[0] ?? null,
                        doneTimeoutMs: 120000,
                    },
                },
            ],
        },
        {
            id: 'tidy-up',
            title: 'Tidy up',
            blocks: [...disableModules('disable-modules', GEN_MODULES)],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [{ prose: '*APCalc: in a multiworld* hosts APCalc on a local server.' }],
    },
});
