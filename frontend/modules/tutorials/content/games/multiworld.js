/**
 * The generator games in a multiworld (catalogue M2, D2, A3): the game on a
 * LOCAL server (⚖ the user, 2026-10-10), connected from the Client, played in
 * its panels. Needs a terminal: the terminal steps have no stand-in, so each
 * walk STOPS at its install step until a harness can start MultiServer.py.
 * Shape: ../../tutorialShape.js; shared steps: ../steps/.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { localMultiworld } from '../steps/multiworld.js';
import { disableModules, enableModules } from '../steps/modules.js';
import { PROOF_MODULES, queueSteps } from './proofGames.js';

const RELEASES = 'https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds';
const SITE = 'https://peerinfinity.github.io/Archipelago-CC/';

/** `modules`: the game's modules to switch on (and off again); null for a game whose module is always on (`open` then says how its panel is opened). */
function multiworldTutorial({ id, title, game, gameName, modules = null, modeUrl, modeName, install, apworldFile, play, summary, intro, open = [] }) {
    return Object.freeze({
        id,
        title,
        summary,
        track: 'games',
        status: 'terminal', // ⚖ the user, 2026-10-14 (seedling-tut-tc): its walk stops at the first terminal step
        doc: `docs/json/user/tutorials/${id}.md`,
        intro: [
            { prose: intro },
            { prose: 'Hosting is the same for every game: a player file, `Generate.py`, a local `MultiServer.py`, and the app\'s **Console** connects to it. Each location you check is sent to the server.' },
        ],
        sections: [
            {
                id: 'panels',
                title: 'Open the game\'s panels',
                blocks: modules ? [...enableModules('enable-modules', modules, { modeName, modeUrl })] : open,
            },
            {
                id: 'multiworld',
                title: 'Host it and connect',
                blocks: localMultiworld({ gameName, apworldFile, slot: 'Tutorial', install }),
            },
            { id: 'play', title: 'Play', blocks: play },
            ...(modules ? [{ id: 'tidy-up', title: 'Tidy up', blocks: [...disableModules('disable-modules', modules)] }] : []),
        ],
        outro: {
            title: 'Next',
            blocks: [{ prose: `Add more player files to \`TutorialPlayers/\` — any games — and ${game}'s items are shuffled among them.` }],
        },
    });
}

export const METAMATH_MULTIWORLD = multiworldTutorial({
    id: 'metamath-multiworld',
    title: 'MetaMath: in a multiworld',
    summary: 'Host a MetaMath proof on a local Archipelago server and prove it from the app.',
    intro: 'MetaMath is an Archipelago game like any other: its `.apworld` is released with this project, and its proofs can be shuffled with other games.',
    game: 'MetaMath',
    gameName: 'Metamath',
    modules: PROOF_MODULES,
    modeName: 'MetaMath',
    modeUrl: `${SITE}?mode=metamath`,
    apworldFile: 'metamath.apworld',
    install: {
        text: `Download [metamath.apworld](${RELEASES}/metamath.apworld) and copy it into \`custom_worlds/\`.`,
        command: 'cp ~/Downloads/metamath.apworld custom_worlds/',
    },
    play: [
        { prose: 'Connected, the Proof Queue plays the server\'s game: each step you prove is a check sent to it.' },
        ...queueSteps({ unitWord: 'step', completeText: 'Proof complete!' }),
    ],
});

export const DEPGRAPH_MULTIWORLD = multiworldTutorial({
    id: 'depgraph-multiworld',
    title: 'DepGraph: in a multiworld',
    summary: 'Host a DepGraph graph on a local Archipelago server and solve it from the app.',
    intro: 'DepGraph is an Archipelago game like any other: its `.apworld` is released with this project, and any graph — a bundled one or your own — can be shuffled with other games.',
    game: 'DepGraph',
    gameName: 'DepGraph',
    modules: PROOF_MODULES,
    modeName: 'DepGraph',
    modeUrl: `${SITE}?mode=depgraph`,
    apworldFile: 'depgraph.apworld',
    install: {
        text: `Download [depgraph.apworld](${RELEASES}/depgraph.apworld) and copy it into \`custom_worlds/\`.`,
        command: 'cp ~/Downloads/depgraph.apworld custom_worlds/',
    },
    play: [
        { prose: 'Connected, the Proof Queue plays the server\'s game: each task you finish is a check sent to it.' },
        ...queueSteps({ unitWord: 'task', completeText: 'Solution complete!' }),
    ],
});

export const APCALC_MULTIWORLD = multiworldTutorial({
    id: 'apcalc-multiworld',
    title: 'APCalc: in a multiworld',
    summary: 'Host APCalc on a local Archipelago server and play it from the app.',
    intro: 'APCalc is an Archipelago world in this project\'s repository (`worlds/apcalc`); no released `.apworld` yet — *APCalc: generate a world* will make one from any map.',
    game: 'APCalc',
    gameName: 'APCalc',
    modules: [{ moduleId: 'apcalc', title: 'APCalc', panel: 'apcalcPanel' }],
    modeName: 'APCalc',
    modeUrl: `${SITE}?mode=apcalc`,
    apworldFile: 'apcalc.apworld',
    install: {
        text: 'Work in a checkout of this project\'s repository: its `worlds/apcalc` is the APCalc world, so there is nothing to install.',
        command: 'git clone --recurse-submodules https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC',
    },
    play: [
        {
            step: {
                id: 'play-apcalc',
                text: 'Open the **APCalc** tab and reach a number: it is checked on the server, and the Console reports it.',
                actions: [{ activate: { panel: 'apcalcPanel' } }],
                done: (ctx) => Number.parseInt(ctx.text({ panel: 'apcalcPanel', selector: '.apcalc-status-progress' }), 10) >= 1,
                doneTimeoutMs: 60000,
            },
        },
    ],
});


const MYSTERY_PANEL = Object.freeze({ panel: 'mysteryPanel' });
/** Checked locations and items held, as plain counts off the app's state. */
const checkedCount = (ctx) => (ctx.snapshot()?.checkedLocations ?? []).length;
const heldCount = (ctx) => Object.values(ctx.snapshot()?.inventory ?? {}).reduce((sum, n) => sum + (Number(n) > 0 ? Number(n) : 0), 0);

export const MYSTERY_MULTIWORLD = multiworldTutorial({
    id: 'mystery-multiworld',
    title: 'Mystery: a case in a multiworld',
    summary: 'Host a mystery case on a local Archipelago server, open it in Mystery Game, solve a question and receive a paper.',
    intro: 'A mystery case is an Archipelago world in this project\'s repository (`worlds/mystery_custom_house_fire`): each question of the case is a location, and each paper is an item. The game itself is a page of its own, shown in the **Mystery Game** panel.',
    game: 'The mystery case',
    gameName: 'Mystery - The Fire at the Custom House',
    // The module is on in every mode; its panel is not in the layout until it is opened.
    open: [
        {
            step: {
                id: 'open-panel',
                text: 'Open the **Mystery Game** tab (Quick Launch lists it, under *Non-procgen Games*). With no mystery world loaded it says so and shows nothing yet.',
                actions: [{ activate: MYSTERY_PANEL }],
                done: (ctx) => ctx.isPanelShowing(MYSTERY_PANEL),
            },
        },
    ],
    install: {
        text: 'Work in a checkout of this project\'s repository: its `worlds/mystery_custom_house_fire` is the case\'s world, so there is nothing to install.',
        command: 'git clone --recurse-submodules https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC',
    },
    play: [
        { prose: 'The game waits for the connection before it starts, and keeps one save for each multiworld slot. Connected, it shows the papers you hold; the rest are out in the multiworld.' },
        {
            step: {
                id: 'open-case',
                text: 'Go back to the **Mystery Game** tab. The case of the connected world opens in it.',
                actions: [{ activate: MYSTERY_PANEL }],
                done: (ctx) => ctx.exists({ ...MYSTERY_PANEL, selector: 'iframe' }),
                doneTimeoutMs: 30000,
            },
        },
        {
            step: {
                id: 'solve-question',
                text: 'Read the first paper and work on the timeline until a question is solved. Its check is sent to the server, and the **Console** reports it.',
                done: (ctx) => checkedCount(ctx) >= 1,
                doneTimeoutMs: 600000,
            },
        },
        {
            step: {
                id: 'receive-paper',
                text: 'A solved question sends an item to somebody: here, with one slot, to you. When it is a paper of the case, the game announces it and lists it with your papers.',
                done: (ctx) => heldCount(ctx) >= 1,
                doneTimeoutMs: 600000,
            },
        },
    ],
});
