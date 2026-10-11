/**
 * Procgen: Journey to Ascension in Loop mode (catalogue P5): a JtA-only world
 * with loop mode on — the Loops panel, Loop Stats, Discovery, Game State and
 * Menu — played by the bot. ⚖ The user, 2026-10-10: the pool + the pipeline's
 * loop-mode parameter. In progress: its walk row measures `firstFailingStep`.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/procgen.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import {
    addSubstrate, botPlaysToTheEnd, chooseMode, loadIntoFrontend, look, openSection, resetPipeline, runAll, tickParam,
} from '../steps/procgen.js';

const LOOPS = { panel: 'loopsPanel' };
const loopToggle = { ...LOOPS, selector: '#loop-ui-toggle-loop-mode' };

export const PROCGEN_LOOP_MODE_JTA = Object.freeze({
    id: 'procgen-loop-mode-jta',
    title: 'Procgen: Journey to Ascension in Loop mode',
    summary: 'Generate a world of Journey to Ascension zones with loop mode on, see the loop panels, and watch the bot finish it.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: 'bot-plays',
    doc: null,
    intro: [
        { prose: '*Loop mode* turns a world into an incremental game: every action costs mana, and when the mana runs out the loop restarts — keeping what you have learned. *Journey to Ascension* (JtA) is an idle game whose zones make natural regions; this tutorial builds a world of them with loop mode on.' },
    ],
    sections: [
        {
            id: 'world',
            title: 'Generate a JtA world in loop mode',
            blocks: [
                ...resetPipeline('reset-start', 'Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.'),
                ...chooseMode('choose-mode', 'shuffledSpiral'),
                ...openSection('open-scenario', 'scenario', 'Scenario Pool'),
                ...addSubstrate('add-jta', 'jta', 'JtA', 3),
                ...openSection('open-parameters', 'parameters', 'Parameters'),
                ...tickParam('loop-mode', 'enableLoopMode', 'Enable loop mode'),
                { prose: 'With loop mode on, the world carries its loop costs: what each region costs in mana to explore and to cross.' },
                ...runAll('generate', 'Generate'),
                ...loadIntoFrontend('load'),
            ],
        },
        {
            id: 'play',
            title: 'Watch it played',
            blocks: [
                ...botPlaysToTheEnd('bot-plays', { watch: { panel: 'jtaSubstrateWrapperPanel' }, watchName: 'JtA', how: 'work through the zones' }),
            ],
        },
        {
            id: 'loop-panels',
            title: 'The loop panels',
            blocks: [
                ...look('look-loops', LOOPS, 'Open the **Loops** tab. The world brought its costs, so loop mode is on — the button in its controls reads **Exit Loop Mode**.',
                    (ctx) => ctx.text(loopToggle) === 'Exit Loop Mode'),
                { prose: 'Each region is a block: **Explore Region** queues exploring it, and a click on an exit queues the move through it. **Start** runs the queue; the loop ends when the mana does.' },
                ...look('look-loop-stats', { panel: 'loopStatsPanel' }, 'The **Loop Stats** tab adds the queue up: the mana each action costs and what is left at the end.'),
                ...look('look-discovery', { panel: 'discoveryPanel' }, 'The **Discovery** tab: in loop mode, regions, exits and locations start hidden and are discovered by exploring.'),
                ...look('look-game-state', { panel: 'gameStatePanel' }, 'The **Game State** tab: current and maximum mana, the path walked this loop, and each region\'s experience.'),
                ...look('look-menu', { panel: 'menuPanel' }, 'The **Menu** tab: restart the run, or skip back to the menu.'),
                ...look('look-jta', { panel: 'jtaSubstrateWrapperPanel' }, 'The **JtA** tab plays the JtA zones themselves.'),
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
            { prose: '*Procgen: everything, in Loop mode* mixes JtA with every other substrate, Idle Loops included, all spending the same mana.' },
        ],
    },
});
