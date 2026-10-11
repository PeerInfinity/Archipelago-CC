/**
 * Loop mode L1: Adventure in Loop Mode, by hand (catalogue "Loop mode").
 * ⚖ The user, 2026-10-10: the Playback Bot does not play this mode, and the
 * costs come from **Generate Costs**; the tutorial covers one or more moves,
 * explores and location checks — not a whole playthrough. In progress: its
 * walk row measures `firstFailingStep`. Shape: ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { loadWorldWithLog } from '../steps/worlds.js';

const LOOPS = { panel: 'loopsPanel' };
const STATS = { panel: 'loopStatsPanel' };
const GAME_STATE = { panel: 'gameStatePanel' };
const MENU = { panel: 'menuPanel' };
const REGION = 'Overworld';
const block = `.loop-region-block[data-region="${REGION}"]`;
const toggle = { ...LOOPS, selector: '#loop-ui-toggle-loop-mode' };
const runButton = { ...LOOPS, selector: '#loop-ui-toggle-pause' };
const controlsFolded = `.loop-controls .controls-header:has(.collapse-indicator[style*="rotate(-90deg)"])`;
const controlsOpen = `.loop-controls .controls-header:has(.collapse-indicator[style*="rotate(0deg)"])`;

/** The queue's entries as text, with their state. */
const entries = (ctx) => [...(ctx.query(LOOPS)?.querySelectorAll('.loop-action-entry') ?? [])]
    .map((el) => ({ text: el.textContent, done: el.classList.contains('state-completed') }));
const hasEntry = (ctx, word, { done = false } = {}) => entries(ctx).some((e) => e.text.includes(word) && (!done || e.done));
const GATE = 'Black Castle Gate';
const PORT = 'BlackCastlePort';
/** A location or exit of the region whose name the panel shows (no longer ???). */
const item = (list, name) => ({ ...LOOPS, selector: `${block} .${list} li.compact-item:not(.undiscovered) .compact-item-name`, text: name });
const found = (ctx, list, name) => [...(ctx.query(LOOPS)?.querySelectorAll(`${block} .${list} li.compact-item:not(.undiscovered) .compact-item-name`) ?? [])]
    .some((el) => el.textContent.trim().startsWith(name));

export const LOOPS_ADVENTURE = Object.freeze({
    id: 'loops-adventure',
    title: 'Adventure in Loop Mode',
    summary: 'Turn a world into an incremental game: queue moves, explores and checks, spend mana, and start again when it runs out.',
    track: 'loops',
    status: 'in-progress',
    firstFailingStep: null,
    doc: null,
    intro: [
        { prose: 'In **Loop mode** a world becomes an incremental game. You do not walk it — you queue actions (move, explore a region, check a location), and each costs **mana**. When the mana runs out, the loop resets: you are back at the start, with what you discovered and the experience you gained, and the queue runs again.' },
        { prose: 'This tutorial plays a few actions of the *Adventure* world by hand. (The Playback Bot does not play Loop mode here; the procgen Loop-mode tutorials show worlds whose games drive themselves.)' },
    ],
    sections: [
        {
            id: 'enter',
            title: 'Enter Loop mode',
            blocks: [
                ...loadWorldWithLog('load', 'adventure', 1, 'Adventure'),
                {
                    step: {
                        id: 'open-loops',
                        text: 'Open the **Loops** tab. Adventure has no mana costs of its own yet, so the panel offers to make them.',
                        actions: [{ activate: LOOPS }],
                        done: (ctx) => ctx.exists({ ...LOOPS, selector: '#loop-ui-generate-costs-inline' }) || ctx.text(toggle) === 'Exit Loop Mode',
                    },
                },
                {
                    step: {
                        id: 'generate-costs',
                        text: 'Press **Generate Costs**: every move, explore and check gets a mana cost, worked out from the world\'s solution (its sphere log) — and Loop mode starts. (**Accept Defaults** gives every move 50 and every check 100 instead.)',
                        actions: [{ click: { ...LOOPS, selector: '#loop-ui-generate-costs-inline', optional: true } }],
                        done: (ctx) => ctx.text(toggle) === 'Exit Loop Mode' && !ctx.exists({ ...LOOPS, selector: '#loop-ui-generate-costs-inline' }),
                        // A refusal is written in the progress label, in colour.
                        failed: (ctx) => {
                            const label = ctx.query({ ...LOOPS, selector: '#loop-ui-cost-progress-label' });
                            return label?.style.color ? label.textContent.trim() : null;
                        },
                        doneTimeoutMs: 60000,
                    },
                },
            ],
        },
        {
            id: 'explore',
            title: 'Explore',
            blocks: [
                {
                    step: {
                        id: 'queue-explore',
                        text: `The game starts in the **${REGION}**. Its locations and exits show as *???* until you find them. Unfold its block if it is folded and press **Explore Region**: an *Explore* action joins the queue.`,
                        actions: [
                            { click: { ...LOOPS, selector: `${block}.collapsed .loop-region-header`, optional: true } },
                            { click: { ...LOOPS, selector: `${block} .explore-btn` } },
                        ],
                        done: (ctx) => hasEntry(ctx, 'Explore'),
                    },
                },
                {
                    step: {
                        id: 'instant',
                        text: 'Actions take time, and each explore finds one thing. To skip the waiting, click **Controls** and tick **Instant**; tick **Auto-restart when queue complete** too, so the explore runs again, loop after loop.',
                        actions: [
                            { click: { ...LOOPS, selector: controlsFolded, optional: true } },
                            { click: { ...LOOPS, selector: '#loop-ui-toggle-instant:not(:checked)', optional: true } },
                            { click: { ...LOOPS, selector: '#loop-ui-toggle-auto-restart:not(:checked)', optional: true } },
                        ],
                        done: (ctx) => ctx.query({ ...LOOPS, selector: '#loop-ui-toggle-instant' })?.checked === true
                            && ctx.query({ ...LOOPS, selector: '#loop-ui-toggle-auto-restart' })?.checked === true,
                    },
                },
                {
                    step: {
                        id: 'run-explore',
                        text: `Press **Start**. Each explore turns one *???* into the name of what it found; keep watching until **${GATE}** and the exit **${PORT}** are among them.`,
                        actions: [{ click: { ...runButton, text: 'Start' } }],
                        done: (ctx) => found(ctx, 'region-locations-list', GATE) && found(ctx, 'region-exits-list', PORT),
                        doneTimeoutMs: 60000,
                    },
                },
            ],
        },
        {
            id: 'check-and-move',
            title: 'Check a location, and move',
            blocks: [
                {
                    step: {
                        id: 'pause',
                        text: 'Press **Pause**, and untick **Auto-restart** again.',
                        actions: [
                            { click: { ...runButton, text: 'Pause', optional: true } },
                            { click: { ...LOOPS, selector: '#loop-ui-toggle-auto-restart:checked', optional: true } },
                        ],
                        done: (ctx) => ctx.text(runButton) !== 'Pause' && ctx.query({ ...LOOPS, selector: '#loop-ui-toggle-auto-restart' })?.checked === false,
                    },
                },
                {
                    step: {
                        id: 'queue-check',
                        text: `Click **${GATE}**: a *Check* action joins the queue. It holds the Black Key.`,
                        actions: [{ click: item('region-locations-list', GATE) }],
                        done: (ctx) => hasEntry(ctx, 'Check'),
                    },
                },
                {
                    step: {
                        id: 'queue-move',
                        text: `Click the exit **${PORT} → BlackCastle**. It says *Blocked* now, but the queue plans ahead: once the check before it has given you the Black Key, the gate opens, so a *Move* action joins the queue.`,
                        actions: [{ click: { ...LOOPS, selector: `${block} .region-exits-list li.compact-item:not(.undiscovered) .compact-item-name`, text: `${PORT} → BlackCastle` } }],
                        done: (ctx) => hasEntry(ctx, 'Move'),
                    },
                },
                {
                    step: {
                        id: 'run-queue',
                        text: 'If the queue is not running already (a new action can resume it), press **Resume**, **Restart** or **Start** — whichever the button says — to carry it out. Each finished action is marked done, with the mana it left you.',
                        // Never the button while it says Pause: that would stop the run.
                        actions: ['Resume', 'Restart', 'Start'].map((text) => ({ click: { ...runButton, text, optional: true } })),
                        done: (ctx) => hasEntry(ctx, 'Check', { done: true }) && hasEntry(ctx, 'Move', { done: true }),
                        // The queue stopped (its button offers to restart) without both done.
                        failed: (ctx) => (ctx.text(runButton) === 'Restart'
                            ? `the queue ended: ${entries(ctx).map((e) => `${e.text.trim().slice(0, 40)}${e.done ? ' (done)' : ''}`).join('; ')}`
                            : null),
                        doneTimeoutMs: 60000,
                    },
                },
                { prose: 'When the mana runs out, the loop resets: back to the start, and the queue runs again from the top — with everything you explored still known, and each region\'s experience making its actions cheaper. **Restart** in the Controls starts a new loop at once.' },
            ],
        },
        {
            id: 'around',
            title: 'The panels around it',
            blocks: [
                {
                    step: {
                        id: 'loop-stats',
                        text: 'Open **Loop Stats**: the queue\'s mana costs, action by action, and the mana you will have left at the end.',
                        actions: [{ activate: STATS }],
                        done: (ctx) => ctx.isPanelShowing(STATS) && ctx.exists({ ...STATS, selector: '#loop-stats-list' }),
                    },
                },
                {
                    step: {
                        id: 'game-state',
                        text: 'Open **Game State**: where you are, your mana, each region\'s experience, and the path you have taken.',
                        actions: [{ activate: GAME_STATE }],
                        done: (ctx) => ctx.isPanelShowing(GAME_STATE),
                    },
                },
                {
                    step: {
                        id: 'menu',
                        text: 'Open **Menu**: the game\'s start. **Restart** here starts a new loop.',
                        actions: [{ activate: MENU }],
                        done: (ctx) => ctx.isPanelShowing(MENU),
                    },
                },
                { prose: 'The **Discovery** settings (in Options, or the Settings panel) say what starts hidden and what exploring reveals.' },
            ],
        },
        {
            id: 'leave',
            title: 'Leave Loop mode',
            blocks: [
                {
                    step: {
                        id: 'exit-loop-mode',
                        text: 'Back in **Loops**, untick **Instant**, press **Exit Loop Mode**, and fold the **Controls**.',
                        actions: [
                            { click: { ...LOOPS, selector: controlsFolded, optional: true } },
                            { click: { ...LOOPS, selector: '#loop-ui-toggle-instant:checked', optional: true } },
                            { click: { ...toggle, text: 'Exit Loop Mode' } },
                            { click: { ...LOOPS, selector: controlsOpen, optional: true } },
                        ],
                        done: (ctx) => ctx.text(toggle) === 'Enter Loop Mode',
                    },
                },
            ],
        },
    ],
    outro: {
        title: 'Next',
        blocks: [
            { prose: 'The procgen Loop-mode tutorials build a world for Loop mode — with Journey to Ascension and other games that play their own part of each action.' },
        ],
    },
});
