/**
 * Shared step groups for the procgen tutorials — ONE copy of the text for the
 * steps several tutorials take (the catalogue plan's "shared step groups").
 * Each function returns BLOCKS, to spread into a section's `blocks`; `id`
 * arguments keep step ids unique within the tutorial that uses them.
 *
 * ⛓ EVERY `done` HERE ASKS WHAT HAPPENED SINCE THE STEP BEGAN (ctx.markStep,
 * tutorialContext.js; ⚖ the user, 2026-10-10). The panel polls `done` from the
 * moment a step is entered, so a check on the app's state alone passes on the
 * last run's leftovers: a pipeline that is still "complete", a bot that still
 * says "finished", a world that is still loaded.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

export const PIPELINE = Object.freeze({ panel: 'procgenPipelinePanel' });
export const BOT = Object.freeze({ panel: 'playbackBotPanel' });
export const MAZE = Object.freeze({ panel: 'mazeRoomPanel' });

const botStatus = { ...BOT, selector: '.playback-bot .playback-bot-status' };
const botButton = (name) => ({ ...BOT, selector: `.playback-bot .playback-control-bar-button-${name}` });
const pipelineMessage = { ...PIPELINE, selector: '.procgen-pipeline-message' };
const modeRadio = (mode) => ({ ...PIPELINE, selector: `input[name="procgen-pipeline-mode"][value="${mode}"]` });

/** The pipeline modes, as the Mode section labels them. */
export const MODE_LABELS = Object.freeze({
    sphereGrowth: 'Sphere growth',
    shuffledSpiral: 'Shuffled spiral',
    gridGrowth: 'Grid growth',
    topDown: 'Top-down',
});

/** Is a Procgen Pipeline section (`data-section-id`) unfolded? */
const sectionOpen = (ctx, sectionId) => ctx.exists({
    ...PIPELINE, selector: `.procgen-pipeline-collapsible.is-expanded[data-section-id="${sectionId}"]`,
});

/** How long the bot's status may stay the same before a walk calls it stalled. */
export const BOT_STALL_MS = 60000;

/**
 * The bot cannot finish: its status is an error, it has said the same thing
 * for BOT_STALL_MS, or the Maze Room it drives
 * says its walker is stuck ("Stuck — reset to retry.", after a "no path …
 * under current inventory"; it does not move again). → the app's own words.
 */
export function botCannotFinish(ctx) {
    const status = ctx.text(botStatus);
    if (status.startsWith('error')) return `the Playback Bot says "${status}"`;
    if (ctx.unchangedFor('bot-status', status, BOT_STALL_MS)) {
        return `the Playback Bot has said "${status}" for ${BOT_STALL_MS / 1000} s`;
    }
    if (ctx.text({ ...MAZE, selector: '.playback-control-bar-status' }) !== 'Stuck — reset to retry.') return null;
    const blocked = [...(ctx.query({ ...MAZE, selector: '.maze-room-playback-log' })
        ?.querySelectorAll('.maze-room-playback-log-blocked') ?? [])].pop()?.textContent.trim();
    return `the Maze Room is stuck${blocked ? ` ("${blocked}")` : ''}; the bot says "${status}"`;
}

/** Did a pipeline run produce a loadable world since the step began, and is nothing running? */
export const generatedSinceStep = (ctx) => ctx.sinceStep(ctx.query({ ...PIPELINE, selector: '.procgen-pipeline-actions' })?.dataset.generatedAt)
    && ctx.exists({ ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Load into frontend' })
    && !ctx.exists({ ...PIPELINE, selector: 'button.procgen-pipeline-btn-primary', text: 'Working…' });

/** Reset the Procgen Pipeline to a fresh panel's setup (its Reset panel button). */
export function resetPipeline(id, text) {
    return [{
        step: {
            id,
            text: text ?? 'In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel\'s — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.',
            actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-reset-panel' } }],
            done: (ctx) => ctx.seenSinceStep('reset', () => ctx.text(pipelineMessage) === 'Panel reset to its defaults.')
                && ctx.query(modeRadio('sphereGrowth'))?.checked === true,
        },
    }];
}

/** Choose a shipped preset from the Preset drop-down. */
export function choosePreset(id, presetId, label) {
    const select = { ...PIPELINE, selector: 'select.procgen-pipeline-preset-select' };
    return [{
        step: {
            id,
            text: `Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **${label}**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.`,
            actions: [{ select: { ...select, value: presetId } }],
            done: (ctx) => ctx.query(select)?.value === presetId
                && ctx.seenSinceStep('applied', () => ctx.text(pipelineMessage) === `Preset "${label}" applied.`),
        },
    }];
}

/** Choose a pipeline mode in the Mode section. */
export function chooseMode(id, mode, text) {
    return [{
        step: {
            id,
            text: text ?? `In the **Mode** section, choose **${MODE_LABELS[mode]}**.`,
            actions: [{ click: modeRadio(mode) }],
            done: (ctx) => ctx.query(modeRadio(mode))?.checked === true,
        },
    }];
}

/** Unfold a pipeline section if it is folded (its heading toggles it). */
export function openSection(id, sectionId, title) {
    return [{
        step: {
            id,
            text: `Make sure the **${title}** section is unfolded — if its heading shows ▶, click it.`,
            actions: [{
                click: {
                    ...PIPELINE,
                    selector: `.procgen-pipeline-collapsible.is-collapsed[data-section-id="${sectionId}"] .procgen-pipeline-collapsible-header`,
                    optional: true,
                },
            }],
            done: (ctx) => sectionOpen(ctx, sectionId),
        },
    }];
}

/**
 * Add a substrate in the Scenario Pool (click its row under "Substrates (click
 * to add)"), then — when `count` is given — type its count (a quota, or a mix
 * weight in the modes that use a mix).
 */
export function addSubstrate(id, substrate, label, count = null) {
    const row = { ...PIPELINE, selector: `.procgen-pipeline-library-row-substrate[data-substrate-id="${substrate}"]` };
    const input = { ...PIPELINE, selector: `.procgen-pipeline-selected-row[data-substrate-id="${substrate}"] .procgen-pipeline-count-input` };
    const blocks = [{
        step: {
            id,
            text: `Under **Substrates (click to add)**, click **${label}**. It moves to the selected list on the right, with a count of 1.`,
            actions: [{ click: row }],
            done: (ctx) => ctx.exists(input),
        },
    }];
    if (count !== null) {
        blocks.push({
            step: {
                id: `${id}-count`,
                text: `Set its count to **${count}**.`,
                actions: [{ fill: { ...input, value: String(count) } }],
                done: (ctx) => ctx.query(input)?.value === String(count),
            },
        });
    }
    return blocks;
}

/** Type a value into one of the Parameters section's number boxes. */
export function setParam(id, key, label, value) {
    const input = { ...PIPELINE, selector: `.procgen-pipeline-params input[data-param-key="${key}"]` };
    return [{
        step: {
            id,
            text: `In **Parameters**, set **${label}** to **${value}**.`,
            actions: [{ fill: { ...input, value: String(value) } }],
            done: (ctx) => ctx.query(input)?.value === String(value),
        },
    }];
}

/** Press the primary button (Run all / Generate) and wait for a world. */
export function runAll(id, label = 'Run all') {
    return [{
        step: {
            id,
            text: `Press **${label}**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.`,
            actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn-primary' } }],
            done: generatedSinceStep,
            doneTimeoutMs: 120000,
        },
    }];
}

/** Load the pipeline's world into the app. */
export function loadIntoFrontend(id) {
    return [{
        step: {
            id,
            text: 'Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.',
            actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Load into frontend' } }],
            done: (ctx) => ctx.rulesLoadedSinceStep() && ctx.rulesSource() === 'procgenPipeline',
            doneTimeoutMs: 30000,
        },
    }];
}

/** Load a committed preset world (`?game=<game>&seed=<seed>`), as the Presets panel does. */
export function loadPresetWorld(id, game, seed, title) {
    return [{
        step: {
            id,
            text: `Load **${title}** (seed ${seed}) — in the **Presets** panel, or by opening the page with \`?game=${game}&seed=${seed}\`. **Do it** loads it for you.`,
            run: (ctx) => ctx.loadPreset(game, seed),
            done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(game, seed),
            doneTimeoutMs: 30000,
        },
    }];
}

/** Watch the Playback Bot play the loaded world to the end, in the Maze Room. */
export function botPlaysToTheEnd(id, { watch = MAZE, watchName = 'Maze Room', how = 'walk the world' } = {}) {
    const finished = (ctx) => ctx.text(botStatus).startsWith('finished');
    return [
        {
            step: {
                id: `${id}-open`,
                text: 'Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world\'s solution path, sphere by sphere.',
                actions: [{ activate: BOT }],
                done: (ctx) => ctx.isPanelShowing(BOT) && ctx.text(botStatus).startsWith('Sphere log loaded'),
            },
        },
        {
            step: {
                id,
                text: `Press **▶** (Play), then open the **${watchName}** tab to watch the bot ${how}, collect each sphere's items and finish.`,
                actions: [{ click: botButton('play') }, { activate: watch }],
                done: (ctx) => ctx.seenSinceStep('running', () => !finished(ctx)) && finished(ctx),
                failed: botCannotFinish,
                doneTimeoutMs: 180000,
            },
        },
    ];
}

/** Bring a panel forward and say what it shows (a "look" step). */
export function look(id, target, text, extraDone = null) {
    return [{
        step: {
            id,
            text,
            actions: [{ activate: target }],
            done: (ctx) => ctx.isPanelShowing(target) && (!extraDone || extraDone(ctx)),
        },
    }];
}

/** Tick one of the Parameters section's checkboxes (e.g. Enable loop mode). */
export function tickParam(id, key, label) {
    const box = { ...PIPELINE, selector: `.procgen-pipeline-params input[type="checkbox"][data-param-key="${key}"]` };
    return [{
        step: {
            id,
            text: `In **Parameters**, tick **${label}**.`,
            actions: [{ click: box }],
            done: (ctx) => ctx.query(box)?.checked === true,
        },
    }];
}

/** The Flash runtime note every Seedling-carrying tutorial gives (⚖ the user, 2026-10-10: wasm, mention the switch). */
export const SEEDLING_RUNTIME_NOTE = 'Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel\'s Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm, where that work is in progress.';
