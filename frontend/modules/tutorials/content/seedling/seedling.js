/**
 * The Seedling track (catalogue S1–S4): the ORIGINAL Seedling, recompiled
 * from its SWF, as an Archipelago game. ⚖ The user, 2026-10-10/11:
 *   - S1 needs F2 (the in-browser SWFRecomp-CC), which is not built: its
 *     steps are the planned ones, and the first is the recorded failure;
 *   - S2 / S4 play **seedling_playthrough** (the 113-level region atlas of
 *     the whole map) on wasm, mentioning the JS switch;
 *   - S3's multiworld uses the **Seedling Playthrough** world;
 *   - S5 (entrance shuffle) is not written yet — Seedling has none.
 * S3 needs a terminal (its walk stops at its first terminal step); the others
 * are in progress (each walk row measures `firstFailingStep`). The walks need a
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

export const SEEDLING_RECOMPILE = seedling({
    id: 'seedling-recompile',
    title: 'Seedling: recompile the original game in your browser',
    summary: 'Turn Seedling\'s Flash file into a WebAssembly game, in the browser, and play it.',
    firstFailingStep: 'open-recompiler',
    intro: [
        { prose: '*Seedling* is a Flash game. Flash is gone from browsers, so this project **recompiles** the game: SWFRecomp turns its SWF into C, and the C into WebAssembly, which any browser runs. The builds the app uses are prebuilt (see the [seedling-wasm README](' + WASM_README + ')); this tutorial does the recompile itself, in the browser.' },
        { prose: '⚠ The in-browser recompiler is planned, not built yet: these steps describe it, and the first one does not work yet.' },
    ],
    sections: [{
        id: 'recompile',
        title: 'Recompile and run',
        blocks: [
            {
                step: {
                    id: 'open-recompiler',
                    text: 'Open the **SWF Recompiler** tab (Quick Launch lists it).',
                    actions: [{ activate: RECOMPILER }],
                    done: (ctx) => ctx.isPanelShowing(RECOMPILER),
                },
            },
            {
                step: {
                    id: 'choose-swf',
                    text: 'Choose **Seedling** among its SWFs (or drop a `.swf` of your own on it).',
                    actions: [{ select: { ...RECOMPILER, selector: 'select.swfr-source', value: 'seedling' } }],
                    done: (ctx) => ctx.query({ ...RECOMPILER, selector: 'select.swfr-source' })?.value === 'seedling',
                },
            },
            {
                step: {
                    id: 'recompile',
                    text: 'Press **Recompile**: SWF → C → WebAssembly, with its progress below.',
                    actions: [{ click: { ...RECOMPILER, selector: 'button.swfr-recompile' } }],
                    done: (ctx) => ctx.text({ ...RECOMPILER, selector: '.swfr-status' }).startsWith('Done'),
                    doneTimeoutMs: 600000,
                },
            },
            {
                step: {
                    id: 'run',
                    text: 'Press **Run**: the recompiled game opens in the **Flash Panel**.',
                    actions: [{ click: { ...RECOMPILER, selector: 'button.swfr-run' } }],
                    done: (ctx) => ctx.exists({ panel: 'flashPanel', selector: 'iframe' }),
                },
            },
        ],
    }],
});

// ── S2: the bot on it ────────────────────────────────────────────────────

export const SEEDLING_BOT = seedling({
    id: 'seedling-bot',
    title: 'Seedling: watch the bot play',
    summary: 'Load the whole of Seedling as an Archipelago world and watch the Playback Bot take its first checks in the original game.',
    // Measured 2026-10-14 on CI (run 38633423493): first-checks passes; the
    // walk failed at its closing step (Stop is never enabled, so it is Reset now).
    // A slow software-WebGPU box does not reach a check inside 180 s.
    firstFailingStep: null,
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
                    // Not ⏹ (Stop): measured 2026-10-14, the Playback Bot panel never tells its control
                    // bar it is running, so Stop stays disabled while the bot plays. Reset does stop it.
                    id: 'reset-bot',
                    text: 'Back in the **Playback Bot** tab, press **↺** (Reset): the bot stops and rewinds to the first sphere, and it says "Sphere log loaded" again. The *Seedling: the bot through the whole game* tutorial lets it run to the end.',
                    actions: [{ activate: BOT }, { click: botButton('reset') }],
                    done: (ctx) => ctx.text(botStatus).startsWith('Sphere log loaded'),
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
    status: 'terminal', // ⚖ the user, 2026-10-14 (seedling-tut-tc): its walk stops at the first terminal step
    doc: 'docs/json/user/tutorials/seedling-multiworld.md',
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
    // Measured 2026-10-14 on CI (run 38633423493): the bot does not finish
    // (solver coverage, the wasm OOM near 150 swaps, the 180 s budget). ⚖ Track only.
    firstFailingStep: 'bot-plays',
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
