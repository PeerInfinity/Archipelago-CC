/**
 * The Guided Tour — THE ONLY COPY of its text. `docs/json/user/guided-tour.md`
 * is generated from this (`node scripts/tutorials/generate-tutorial-docs.mjs`),
 * the Tutorial panel renders it, and the in-app row `tutorial-guided-tour`
 * performs every step and asserts each one's `done`. Shape: ../tutorialShape.js.
 *
 * ⛔ Imports nothing: the generator imports this file in node. Steps reach
 * the app through `ctx` (../tutorialContext.js).
 */

const LIVE = 'https://peerinfinity.github.io/Archipelago-CC/';
const GAME = 'procgen_maze';
const SEED = 1;
const ID = 'guided-tour';
/** The world's link, opening this tour in the Tutorial panel too (`?tutorial=`, tutorialUrl.js). */
const START = `${LIVE}?game=${GAME}&seed=${SEED}&tutorial=${ID}`;

const MAZE = { panel: 'mazeRoomPanel' };
const BOT = { panel: 'playbackBotPanel' };
const PIPELINE = { panel: 'procgenPipelinePanel' };
const botStatus = { ...BOT, selector: '.playback-bot .playback-bot-status' };

export const GUIDED_TOUR = Object.freeze({
    id: ID,
    title: 'Guided Tour',
    doc: 'docs/json/user/guided-tour.md',
    intro: [
        {
            prose: `Ten minutes, nothing to install, no server to set up — everything below runs in the [live demo](${LIVE}) in your browser. (New to Archipelago itself? Read the [Introduction to Archipelago](./introduction-to-archipelago.md) first; this tour assumes the basics.)`,
        },
        {
            prose: 'One warning before you start: the app opens with a *lot* of panels. That\'s normal — it\'s a workbench, and this tour only uses a handful of tabs. Ignore the rest; nothing breaks if you never touch them. If you ever rearrange things into a mess, the **JSON** panel\'s *Reset Default Mode* button restores the default layout.',
        },
        {
            docOnly: true,
            prose: 'This tour is also a tutorial inside the app: the link in Stop 1 opens it in the **Tutorial** panel, which shows each step as you go — or performs it for you (**Do it**, or **▶ Play** for the lot). Already in the app? Open the **Tutorial** tab and press *Start* on *Guided Tour*.',
        },
    ],
    sections: [
        {
            id: 'stop-1',
            title: 'Stop 1 — Watch a world play itself',
            blocks: [
                { docOnly: true, prose: 'Open this link:' },
                { docOnly: true, prose: `**<${START}>**` },
                {
                    panelOnly: true,
                    step: {
                        id: 'load-world',
                        text: `Load the tour's world — the one the link \`?game=${GAME}&seed=${SEED}\` opens. **Do it** loads it for you.`,
                        run: (ctx) => ctx.loadPreset(GAME, SEED),
                        done: (ctx) => ctx.isPresetLoaded(GAME, SEED),
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    prose: 'It\'s a small world that was *procedurally generated* by this project — three connected maze regions with a key, a locked door, and a Victory item, plus the machine-checkable logic that proves it\'s solvable.',
                },
                {
                    step: {
                        id: 'open-maze-room',
                        text: 'Find the **Maze Room** tab and click it. You\'ll see the first maze region, with the player at the entrance.',
                        actions: [{ activate: MAZE }],
                        done: (ctx) => ctx.isPanelShowing(MAZE) && ctx.exists({ ...MAZE, selector: 'canvas.maze-room-canvas' }),
                    },
                },
                {
                    step: {
                        id: 'open-playback-bot',
                        text: 'Now find the **Playback Bot** tab. It says "Sphere log loaded" — the bot has the world\'s recorded solution path.',
                        actions: [{ activate: BOT }],
                        done: (ctx) => ctx.isPanelShowing(BOT) && ctx.text(botStatus).startsWith('Sphere log loaded'),
                    },
                },
                {
                    step: {
                        id: 'play-bot',
                        text: 'Press **▶** (Play), then click back to the **Maze Room** tab to watch.',
                        actions: [
                            { click: { ...BOT, selector: '.playback-bot .playback-control-bar-button-play' } },
                            { activate: MAZE },
                        ],
                        done: (ctx) => ctx.text(botStatus).startsWith('finished'),
                        doneTimeoutMs: 120000,
                    },
                },
                {
                    prose: 'The bot walks the maze for real — through the first region, picking up the red key, moving between regions, and finishing at the Victory pickup. Its log narrates the progression: `Sphere 0.1 → walking to "…key_red_pickup…"`, then the sphere-2 target, until `finished — 3 locations visited`. That order isn\'t scripted by hand; it\'s the world\'s actual progression spheres, replayed.',
                },
                { prose: 'A few things worth trying while you\'re here:' },
                {
                    prose: [
                        '- **↺** resets the run; **⏯** (Step) advances one action at a time; **⏭** finishes instantly.',
                        '- Click into the **Maze Room** panel and walk yourself with the **arrow keys** — the bot isn\'t required.',
                        '- The bot panel\'s **Manual walk-to** picks a region and sends the player there on demand.',
                    ].join('\n'),
                },
            ],
        },
        {
            id: 'stop-2',
            title: 'Stop 2 — See the logic underneath',
            blocks: [
                { prose: 'The maze isn\'t just graphics — every location and passage has an Archipelago access rule, and the whole app is watching them.' },
                {
                    step: {
                        id: 'open-region-graph',
                        text: 'Open the **Region Graph** tab: the world as a graph of regions, color-coded by reachability and check status. This is the same view used for real games like A Link to the Past — where it has hundreds of nodes.',
                        actions: [{ activate: { panel: 'regionGraphPanel' } }],
                        done: (ctx) => ctx.isPanelShowing({ panel: 'regionGraphPanel' }),
                    },
                },
                {
                    step: {
                        id: 'open-locations',
                        text: 'Open the **Locations** panel: the three locations, with the ones the bot checked marked off.',
                        actions: [{ activate: { panel: 'locationsPanel' } }],
                        done: (ctx) => ctx.isPanelShowing({ panel: 'locationsPanel' }),
                    },
                },
                {
                    step: {
                        id: 'open-inventory',
                        text: 'Open the **Inventory** panel: the red key and Victory the bot collected.',
                        actions: [{ activate: { panel: 'inventoryPanel' } }],
                        done: (ctx) => {
                            const inv = ctx.snapshot()?.inventory ?? {};
                            return ctx.isPanelShowing({ panel: 'inventoryPanel' }) && inv.key_red >= 1 && inv.victory >= 1;
                        },
                    },
                },
                { prose: 'Everything you just watched — which doors need which keys, which regions are reachable — was *derived* logic, evaluated live. This is the project\'s core trick: game logic exported to JSON, evaluated in the browser.' },
            ],
        },
        {
            id: 'stop-3',
            title: 'Stop 3 — Generate your own world',
            blocks: [
                { prose: 'The world from Stop 1 came out of a panel you also have open.' },
                {
                    step: {
                        id: 'open-pipeline',
                        text: 'Find the **Procgen Pipeline** tab.',
                        actions: [{ activate: PIPELINE }],
                        done: (ctx) => ctx.isPanelShowing(PIPELINE),
                    },
                },
                {
                    step: {
                        id: 'choose-sphere-growth',
                        text: 'The **Mode** section has four generation strategies; make sure **Sphere growth** — the one that plans the item progression first, then grows a world to match — is selected (it is unless you changed it).',
                        actions: [{ click: { ...PIPELINE, selector: 'input[name="procgen-pipeline-mode"][value="sphereGrowth"]' } }],
                        done: (ctx) => ctx.query({ ...PIPELINE, selector: 'input[name="procgen-pipeline-mode"][value="sphereGrowth"]' })?.checked === true,
                    },
                },
                {
                    step: {
                        id: 'see-parameters',
                        text: 'The **Parameters** section has the knobs (seed, region size, number of spheres…). Leave the defaults for now.',
                        actions: [{ activate: PIPELINE }],
                    },
                },
                {
                    step: {
                        id: 'run-all',
                        text: 'Press **Run all**. The step buttons (1 Plan → 2a Allocate → 2b Topology → 2c Items → 3 Build regions → 4 Compile) run in sequence until it reports **Pipeline complete**.',
                        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn-primary' } }],
                        done: (ctx) => ctx.exists({ ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Pipeline complete' }),
                        doneTimeoutMs: 120000,
                    },
                },
                {
                    step: {
                        id: 'load-into-frontend',
                        text: 'Press **Load into frontend**.',
                        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Load into frontend' } }],
                        done: (ctx) => ctx.rulesSource() === 'procgenPipeline',
                        doneTimeoutMs: 30000,
                    },
                },
                { prose: 'Your world is now the loaded game — the Maze Room shows its first region, the Region Graph shows its layout, and the Playback Bot has its solution log. Change the **Seed** parameter and repeat for a different world every time. You can also run the steps one at a time and inspect what each produces, or **Download rules.json** to keep the world as a file.' },
                { prose: 'The same panel can build worlds from other *substrates* — a Doodle-Jump-style platformer whose movement abilities are the progression items, a text adventure, and more, mixed in one world — via the **Scenario Pool** section. See [Procedural Generation](../features/procgen.md) for what\'s possible.' },
            ],
        },
    ],
    outro: {
        title: 'Where to go next',
        blocks: [
            {
                prose: [
                    '- **Track a real game:** the **Presets** panel has exported seeds for dozens of Archipelago games — pick one and explore its region graph, no server needed. When you\'re ready to track a live multiworld, the [Quick Start Guide](./quick-start.md) covers connecting to a server.',
                    '- **Loop mode:** any world can become an incremental game — queue actions, spend mana, loop. See [Loops](../features/loops.md).',
                    '- **Everything else:** the [Overview](./overview.md) and the [Features Index](../features/README.md) map the rest of the project.',
                ].join('\n'),
            },
        ],
    },
});
