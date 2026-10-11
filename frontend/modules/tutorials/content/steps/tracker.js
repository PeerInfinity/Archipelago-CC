/**
 * Shared steps for the Tracking track: every tracker tutorial plays the same
 * exported game, A Link to the Past seed 1, loaded fresh from the **Presets**
 * panel's seed button — a fresh load clears the checks and the inventory, so
 * no step is satisfied by an earlier run's leftovers.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

export const PRESETS = Object.freeze({ panel: 'presetsPanel' });
export const INVENTORY = Object.freeze({ panel: 'inventoryPanel' });
export const LOCATIONS = Object.freeze({ panel: 'locationsPanel' });
export const REGIONS = Object.freeze({ panel: 'regionsPanel' });
export const ALTTP = Object.freeze({ game: 'alttp', seed: 1, folder: 'AP_14089154938208861744', title: 'A Link to the Past' });

const seedButton = {
    ...PRESETS,
    selector: `.preset-button[data-game-directory="${ALTTP.game}"][data-seed-name="${ALTTP.folder}"]`,
};

/** The player's inventory count of `item` (0 when absent). */
export const owned = (ctx, item) => ctx.snapshot()?.inventory?.[item] ?? 0;
/** Is `location` checked? */
export const isChecked = (ctx, location) => (ctx.snapshot()?.checkedLocations ?? []).includes(location);

/**
 * Load ALTTP seed 1 from the Presets panel. `text` replaces the default
 * instruction (the base tutorial explains loading your OWN rules file).
 */
export function loadAlttp(id = 'load', { text } = {}) {
    return [{
        step: {
            id,
            text: text ?? `Open the **Presets** tab and press **${ALTTP.seed}** beside *${ALTTP.title}*. That loads an exported seed of it — the same game every tracking tutorial uses, freshly loaded, so nothing is checked yet.`,
            actions: [
                // After a load the panel shows that preset's details; the list is one Back away.
                { click: { ...PRESETS, selector: '#back-to-presets', optional: true } },
                { click: seedButton },
            ],
            done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(ALTTP.game, ALTTP.seed),
            doneTimeoutMs: 30000,
        },
    }];
}

/** Tick the Inventory's "show unowned items" (left alone when ticked), then click `item`. */
export function addItem(id, item, why) {
    return [
        {
            step: {
                id: `${id}-show-unowned`,
                text: 'Open the **Inventory** tab and tick **Show unowned items** (if it is not ticked already): the items you do not have yet appear, greyed out. (This tutorial uses the plain list, so it unticks **Show categories** if it is ticked.)',
                actions: [
                    { click: { ...INVENTORY, selector: '#show-unowned:not(:checked)', optional: true } },
                    { click: { ...INVENTORY, selector: '#show-categories:checked', optional: true } },
                ],
                done: (ctx) => ctx.query({ ...INVENTORY, selector: '#show-unowned' })?.checked === true
                    && ctx.query({ ...INVENTORY, selector: '#show-categories' })?.checked === false,
            },
        },
        {
            step: {
                id,
                text: `Click **${item}**: you have it now${why ? ` — ${why}` : ''}. (Shift-click takes one away.)`,
                // The flat list: the grouped one holds the same buttons, hidden.
                actions: [{ click: { ...INVENTORY, selector: `#inventory-flat .item-button[data-item="${item}"]` } }],
                done: (ctx) => owned(ctx, item) >= 1,
            },
        },
    ];
}
