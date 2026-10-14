/**
 * The Seedling track (catalogue S1–S4): the ORIGINAL Seedling, recompiled
 * from its SWF, as an Archipelago game. ⚖ The user, 2026-10-10/11:
 *   - S1 drives the SWF Recompiler panel (F2: the in-browser SWFRecomp-CC,
 *     the swfrecomp-browser submodule); its walk recompiles a SMALL AVM2
 *     SWF, and Seedling itself is an optional step in the prose;
 *   - S2 / S4 play **seedling_playthrough** (the 113-level region atlas of
 *     the whole map) on wasm, mentioning the JS switch;
 *   - S3's multiworld uses the **Seedling Playthrough** world;
 *   - S5 (entrance shuffle) is not written yet — Seedling has none.
 * In progress: each walk row measures `firstFailingStep`; the walks need a
 * WebGPU browser (their batch's flag). Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { BOT, SEEDLING_RUNTIME_NOTE, botCannotFinish, botPlaysToTheEnd, loadPresetWorld, startSeedlingGame } from '../steps/procgen.js';
import { localMultiworld } from '../steps/multiworld.js';

const WASM_README = 'https://github.com/PeerInfinity/seedling-wasm#readme';
const RECOMPILER = { panel: 'swfRecompilerPanel' };
const PLAYTHROUGH = Object.freeze({ game: 'seedling_playthrough', seed: 1, title: 'Seedling Playthrough' });
const botStatus = { ...BOT, selector: '.playback-bot .playback-bot-status' };
const botButton = (name) => ({ ...BOT, selector: `.playback-bot .playback-control-bar-button-${name}` });

const seedling = (t) => Object.freeze({ track: 'seedling', status: 'in-progress', doc: null, outro: null, ...t });
const loadPlaythrough = (id) => loadPresetWorld(id, PLAYTHROUGH.game, PLAYTHROUGH.seed, `${PLAYTHROUGH.title} — the whole map as a world`);

// ── S1: recompile the SWF in the browser ─────────────────────────────────

// The SWF Recompiler panel (swfRecompilerPanel/swfRecompilerUI.js CONTROLS).
const swfr = (selector) => ({ ...RECOMPILER, selector });
const S1_EXAMPLE = 'avm2_graphics_runtime';
/** A stage of the panel's list finished (✓) since the step began — not a previous run's. */
const stageDone = (ctx, stage) => {
    const row = ctx.query(swfr(`.swfr-stage[data-stage="${stage}"]`));
    return row?.dataset.state === 'done' && ctx.sinceStep(row.dataset.at);
};
/** The panel's error for a stage that failed since the step began. */
const stageFailed = (stage) => (ctx) => {
    const row = ctx.query(swfr(`.swfr-stage[data-stage="${stage}"]`));
    return row?.dataset.state === 'error' && ctx.sinceStep(row.dataset.at)
        ? `${stage}: ${row.querySelector('.swfr-stage-text')?.textContent ?? 'failed'}` : null;
};

export const SEEDLING_RECOMPILE = seedling({
    id: 'seedling-recompile',
    title: 'Seedling: recompile the original game in your browser',
    summary: 'Turn a Flash file into a WebAssembly program in the browser and run it — then, if you like, all of Seedling.',
    // Measured 2026-10-14 (slice F2b-2): every step works, on the new-tab route
    // under npm test's headless shell. ⚖ null → ready is the planner's call.
    firstFailingStep: null,
    intro: [
        { prose: '*Seedling* is a Flash game. Flash is gone from browsers, so this project **recompiles** the game: SWFRecomp turns its SWF into C, and the C into WebAssembly, which any browser runs. The builds the app uses are prebuilt (see the [seedling-wasm README](' + WASM_README + ')); this tutorial does the recompile itself, in the browser, with the same SWFRecomp commit that built them.' },
        { prose: 'It starts with a **small** SWF, a one-frame test that draws four shapes and prints what it drew, so the whole pipeline takes about half a minute. Seedling itself is the optional last step: the same buttons, but minutes rather than seconds.' },
        { prose: 'The compile runs **clang** in your browser. The first time, it downloads the compiler package (about 110 MB, from cdn.wasmer.io); the browser keeps it after that. It needs a recent Chrome or Edge with WebGPU.' },
    ],
    sections: [
        {
            id: 'recompile',
            title: 'Recompile, compile, run',
            blocks: [
                {
                    step: {
                        id: 'open-recompiler',
                        text: 'Open the **SWF Recompiler** tab (Quick Launch lists it). It loads the recompiler page and says whether it can compile **in the panel** (Chrome) or will use **a new tab** (other browsers).',
                        actions: [{ activate: RECOMPILER }],
                        done: (ctx) => ctx.isPanelShowing(RECOMPILER) && ctx.query(swfr('.swfr-panel'))?.dataset.ready === 'true',
                        // The page's first visit installs its service worker and reloads once.
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'choose-swf',
                        text: `Choose the example **${S1_EXAMPLE}** in the **SWF** list.`,
                        actions: [{ select: { ...swfr('select.swfr-source'), value: S1_EXAMPLE } }],
                        done: (ctx) => ctx.query(swfr('select.swfr-source'))?.value === S1_EXAMPLE,
                    },
                },
                {
                    step: {
                        id: 'recompile',
                        text: 'Press **Recompile**: SWFRecomp, itself compiled to WebAssembly, turns the SWF into C. Where the panel cannot compile, this opens the recompiler in a new tab first — keep this tab in front.',
                        actions: [{ click: swfr('button.swfr-recompile') }],
                        done: (ctx) => stageDone(ctx, 'recompile'),
                        failed: (ctx) => stageFailed('load')(ctx) || stageFailed('recompile')(ctx),
                        doneTimeoutMs: 90000,
                    },
                },
                {
                    step: {
                        id: 'compile',
                        text: 'Press **Compile**: clang turns the C into WebAssembly. Its progress shows in the **Compile** row (the first time, most of it is the compiler download).',
                        actions: [{ click: swfr('button.swfr-compile') }],
                        done: (ctx) => stageDone(ctx, 'compile'),
                        failed: stageFailed('compile'),
                        doneTimeoutMs: 300000,
                    },
                },
                {
                    step: {
                        id: 'run',
                        text: 'Press **Run**: the movie starts — below the buttons, or in the recompiler tab. A red square, a cyan quad, a red-to-green gradient and a blue line.',
                        actions: [{ click: swfr('button.swfr-run') }],
                        done: (ctx) => stageDone(ctx, 'run'),
                        failed: stageFailed('run'),
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'check',
                        text: 'Press **Check**: the panel compares what the movie printed (its **Trace**) with the example\'s expected output, and reads six pixels back from its canvas.',
                        actions: [{ click: swfr('button.swfr-check') }],
                        done: (ctx) => stageDone(ctx, 'check') && ctx.query(swfr('.swfr-panel'))?.dataset.verdict === 'pass',
                        failed: stageFailed('check'),
                        doneTimeoutMs: 30000,
                    },
                },
            ],
        },
        {
            id: 'seedling',
            title: 'Optional: all of Seedling',
            blocks: [
                { prose: 'The same buttons recompile the whole game. Choose **A SWF file of your own…** and pick Seedling\'s SWF (build it from its AS3 source, [PeerInfinity/Seedling](https://github.com/PeerInfinity/Seedling), or use a copy of the original game you have), then Recompile, Compile and Run.' },
                { prose: '- It is big: on a fast desktop Chrome the recompile took about a minute and the compile about five; on a slow machine allow 20 minutes and 3 GB of memory.\n- The result is the original game, title screen and all — the same game the prebuilt `seedling_original` build plays.\n- The tutorial\'s own test does not take this step; it would run for about 18 minutes.' },
            ],
        },
    ],
});

// ── S2: the bot on it ────────────────────────────────────────────────────

export const SEEDLING_BOT = seedling({
    id: 'seedling-bot',
    title: 'Seedling: watch the bot play',
    summary: 'Load the whole of Seedling as an Archipelago world and watch the Playback Bot take its first checks in the original game.',
    // Measured 2026-10-11: the seed-1 preset the Presets panel loads
    // (seedling_playthrough/AP_14089154938208861744) carries no `flash_panel`
    // block, so the Flash Panel never offers the wasm game (only AP_1 does).
    firstFailingStep: 'start-game-page',
    intro: [
        { prose: '*Seedling Playthrough* is the whole map of the original game as an Archipelago world: its 113 levels are the regions, its chests and bosses the locations. The Playback Bot plays it from the world\'s solution, sphere by sphere, by driving the real game.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [{
        id: 'play',
        title: 'Play',
        blocks: [
            ...loadPlaythrough('load'),
            ...startSeedlingGame('start-game'),
            {
                step: {
                    id: 'open-bot',
                    text: 'Open the **Playback Bot** tab. It says "Sphere log loaded" — the world\'s solution, sphere by sphere.',
                    actions: [{ activate: BOT }],
                    done: (ctx) => ctx.isPanelShowing(BOT) && ctx.text(botStatus).startsWith('Sphere log loaded'),
                },
            },
            {
                step: {
                    id: 'first-checks',
                    text: 'Press **▶** (Play) and open the **Flash Panel** tab: the bot walks the player to the first sphere\'s chests. Watch it make its first check.',
                    actions: [{ click: botButton('play') }, { activate: { panel: 'flashPanel' } }],
                    done: (ctx) => (ctx.snapshot()?.checkedLocations ?? []).length > 0,
                    failed: botCannotFinish,
                    doneTimeoutMs: 180000,
                },
            },
            {
                step: {
                    id: 'stop-bot',
                    text: 'Back in the **Playback Bot** tab, press **⏹** (Stop). The *Seedling: the bot through the whole game* tutorial lets it run to the end.',
                    actions: [{ click: botButton('stop') }],
                },
            },
        ],
    }],
});

// ── S3: a local multiworld ───────────────────────────────────────────────

export const SEEDLING_MULTIWORLD = seedling({
    id: 'seedling-multiworld',
    title: 'Seedling: in a multiworld',
    summary: 'Generate a multiworld with Seedling Playthrough, host it locally, and connect the app to play it.',
    firstFailingStep: 'mw-install',
    intro: [
        { prose: 'Here Seedling Playthrough is a slot of a multiworld you generate and host yourself, on your own computer; the app is its client.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [
        {
            id: 'multiworld',
            title: 'Generate, host, connect',
            blocks: localMultiworld({
                gameName: 'Seedling Playthrough',
                slot: 'Tutorial',
                install: {
                    text: 'The Seedling Playthrough world ships with this project, as `worlds/seedling_playthrough/`: work in a checkout of this repository (with its Python requirements installed), not in an installed Archipelago.',
                    command: 'git clone https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC',
                },
            }),
        },
        {
            id: 'play',
            title: 'Play your slot',
            blocks: [
                ...startSeedlingGame('start-game'),
                { prose: 'The checks you make arrive at the server, and the items other slots send you arrive in the game.' },
            ],
        },
    ],
});

// ── S4: the whole game ───────────────────────────────────────────────────

export const SEEDLING_WHOLE_GAME = seedling({
    id: 'seedling-whole-game',
    title: 'Seedling: the bot through the whole game',
    summary: 'Watch the Playback Bot play the original Seedling from the first chest to the end.',
    // Measured 2026-10-11: the seed-1 preset the Presets panel loads
    // (seedling_playthrough/AP_14089154938208861744) carries no `flash_panel`
    // block, so the Flash Panel never offers the wasm game (only AP_1 does).
    firstFailingStep: 'start-game-page',
    intro: [
        { prose: 'The Playback Bot plays the whole of *Seedling Playthrough* — every sphere of its solution, in the original game. It is the project\'s long-running test of the bot; how far it gets is the progress marker of that work.' },
        { prose: SEEDLING_RUNTIME_NOTE },
    ],
    sections: [{
        id: 'play',
        title: 'Play to the end',
        blocks: [
            ...loadPlaythrough('load'),
            ...startSeedlingGame('start-game'),
            ...botPlaysToTheEnd('bot-plays', { watch: { panel: 'flashPanel' }, watchName: 'Flash Panel', how: 'play the original game' }),
        ],
    }],
});
