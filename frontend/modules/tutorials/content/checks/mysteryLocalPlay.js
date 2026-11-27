/**
 * Feature check: a mystery case played through LOCALLY, with no Archipelago server (⚖ the user, 2026-11-27: "a
 * tutorial, or maybe just a feature check, that plays through a mystery game preset locally, without an Archipelago
 * server").
 *
 * The committed mystery world is loaded as a preset, so the app itself is the whole game: a solved question is a
 * check in the app's own state, the item on that location is granted locally, and the next `mystery:state` carries
 * the paper. The game's page starts on such an offline state (its `game` begins `offline:`). The play is the page's
 * own careful reader, asked for by the host (`mystery:autoSolve`), so every move is one the page makes itself: the
 * check drives nothing on the page by hand.
 *
 * ⛔ What is read: the page's own word that it started (`window.__ap.first`) and that the reader is done
 * (`mystery:autoSolveStatus`), and the app's checked locations against the loaded world's own list of questions
 * (`slot_data.mystery.locations`). No question, paper or count is named here.
 * ⛔ Imports only content files.
 */

const GAME = 'mystery_custom_house_fire';
const PANEL = Object.freeze({ panel: 'mysteryPanel' });
const PAGE = Object.freeze({ ...PANEL, frame: 'iframe', selector: 'body' });
const STATUS_EVENT = 'mystery:autoSolveStatus';

/** The game page's window, once the panel has framed it. */
const pageWindow = (ctx) => ctx.query(PAGE)?.ownerDocument?.defaultView ?? null;
/** The page's own bridge state (`window.__ap`): set once the page has started on a state from the host. */
const pageBridge = (ctx) => pageWindow(ctx)?.__ap ?? null;
/** The loaded world's questions, as location names, off the page's story and the app's checks. */
const checkedCount = (ctx) => (ctx.snapshot()?.checkedLocations ?? []).length;

function steps() {
    // What the page has said of its careful reader since the request (the last status), and the listener's undo.
    let lastStatus = null;
    let unsubscribe = null;
    let story = null;
    let checkedBefore = 0;
    return [
        {
            step: {
                id: 'load',
                text: `Load the mystery world: open the page with \`?game=${GAME}&seed=1\`. **Do it** loads it for you. No server is involved: the Console stays disconnected for the whole check.`,
                run: (ctx) => ctx.loadPreset(GAME, 1),
                done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(GAME, 1),
                doneTimeoutMs: 30000,
            },
        },
        {
            step: {
                id: 'open',
                text: 'Open the **Mystery Game** tab (Quick Launch lists it, under *Non-procgen Games*). The case opens and starts at once: with no server the app answers the page itself. If the page asks whether this is a new room, a timeline from an earlier run is saved on this device: **OK** starts a fresh one.',
                actions: [{ activate: PANEL }],
                done: (ctx) => {
                    const bridge = pageBridge(ctx);
                    if (!bridge?.first) return false;
                    story = bridge.story ?? null;
                    return typeof bridge.first.game === 'string' && bridge.first.game.startsWith('offline:');
                },
                doneTimeoutMs: 60000,
            },
        },
        {
            step: {
                id: 'play',
                text: 'Let the game\'s careful reader play the case: **Do it** asks the page for it. It reads, links and answers by itself; each question it solves is checked in the app, and the paper that question gives arrives in the game a moment later. Watch the timeline fill in until the reader stops.',
                run: (ctx) => {
                    lastStatus = null;
                    checkedBefore = checkedCount(ctx);
                    unsubscribe?.();
                    unsubscribe = ctx.eventBus.subscribe(STATUS_EVENT, (status) => { lastStatus = status; }, 'tutorials');
                    ctx.eventBus.publish('mystery:autoSolve', { ...(story ? { story } : {}), instant: true }, 'tutorials');
                },
                done: (ctx) => {
                    if (lastStatus?.state === 'failed') throw new Error(`the careful reader failed: ${JSON.stringify(lastStatus)}`);
                    if (lastStatus?.state !== 'done') return false;
                    unsubscribe?.();
                    unsubscribe = null;
                    // Every question the page says it solved is a check in the app, and there are more than before.
                    return Array.isArray(lastStatus.solved) && lastStatus.solved.length > 0
                        && checkedCount(ctx) >= checkedBefore + lastStatus.solved.length;
                },
                doneTimeoutMs: 300000,
            },
        },
        {
            step: {
                id: 'solved',
                text: 'The case is solved: the page shows its last question answered, and the app holds **Victory** (the **Inventory** tab lists it).',
                done: (ctx) => Number(ctx.snapshot()?.inventory?.Victory ?? 0) > 0,
                doneTimeoutMs: 30000,
            },
        },
    ];
}

export const CHECK_MYSTERY_LOCAL_PLAY = Object.freeze({
    id: 'mystery-local-play',
    title: 'Mystery: a case played through with no server',
    summary: 'Load the committed mystery world, open Mystery Game, and let the game\'s own careful reader play the whole case: every solved question is checked in the app and every paper arrives, with no Archipelago server.',
    status: 'ready',
    doc: null,
    intro: [
        { prose: 'A mystery world loaded as a preset plays without a server: the app keeps the checks and hands out the items itself, and the game\'s page starts on the app\'s offline answer. Its save is kept apart from any multiworld\'s (the game is named `offline:<seed>:<player>`).' },
    ],
    sections: [
        { id: 'play', title: 'Play the case through', blocks: steps() },
    ],
    outro: null,
});
