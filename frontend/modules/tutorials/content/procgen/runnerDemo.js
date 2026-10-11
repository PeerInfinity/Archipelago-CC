/**
 * Procgen: a runner world (catalogue P4's "Runner Demo?" — not in the mixed
 * world, its generation is heavy; ⚖ the user, 2026-10-10: a short draft of
 * its own). A committed Runner WorldGen preset, played by the Playback Bot in
 * the **Runner Demo** panel. In progress: its walk row measures
 * `firstFailingStep`. Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { botPlaysToTheEnd } from '../steps/procgen.js';
import { loadWorldWithLog } from '../steps/worlds.js';

const RUNNER = { panel: 'runnerDemoPanel' };

export const PROCGEN_RUNNER_DEMO = Object.freeze({
    id: 'procgen-runner-demo',
    title: 'Procgen: a runner world',
    summary: 'Play a generated world of auto-running platformer strips, where the jumps you can make are the items you hold.',
    track: 'procgen',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: 'The **Runner Demo** substrate turns each region into an auto-running platformer strip: the runner keeps moving, you jump, and the pickups and exit portals along the strip are the region\'s locations and exits. How high and how far you can jump are items — so the world\'s logic is made of jumps.' },
        { prose: 'Runner worlds take a while to generate, so this tutorial plays one that is already made.' },
    ],
    sections: [
        {
            id: 'play',
            title: 'Watch it play',
            blocks: [
                ...loadWorldWithLog('load', 'runner_worldgen', 1, 'Runner WorldGen'),
                {
                    step: {
                        id: 'open-runner',
                        text: 'Open the **Runner Demo** tab: the first strip. Click into it and press **Space** to jump yourself.',
                        actions: [{ activate: RUNNER }],
                        done: (ctx) => ctx.exists({ ...RUNNER, selector: 'iframe' }),
                        doneTimeoutMs: 30000,
                    },
                },
                ...botPlaysToTheEnd('bot-plays', { watch: RUNNER, watchName: 'Runner Demo', how: 'run each strip, jump to its pickups and portals' }),
            ],
        },
    ],
    outro: null,
});
