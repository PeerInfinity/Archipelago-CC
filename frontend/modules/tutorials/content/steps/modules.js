/**
 * Shared steps: switch modules on (and off again) in the **Modules** panel.
 * ⚖ The user, 2026-10-10: the generator games' tutorials stay in the default
 * mode, where their modules are off; a step enables them in the Modules
 * panel, and the prose says the game's own mode makes that step unnecessary.
 *
 * Each tick is `optional` (it names the UNticked box), so a module that is
 * already on is left alone; `done` asks for the panel itself.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

export const MODULES = Object.freeze({ panel: 'modulesPanel' });

const box = (moduleId, state) => ({
    ...MODULES,
    selector: `.module-entry[data-module-id="${moduleId}"] .module-controls input[type="checkbox"]${state}`,
    optional: true,
});

/**
 * One step that ticks every module in `modules` ([{ moduleId, title, panel }])
 * — `modeLink` names the mode where they are on already.
 */
export function enableModules(id, modules, { modeName, modeUrl }) {
    const names = modules.map((m) => `**${m.title}**`).join(', ');
    return [{
        step: {
            id,
            text: `Open the **Modules** tab and tick ${names}. Each one's panel opens as you tick it. (Opened from [${modeName}'s own mode](${modeUrl}), the page has them on already, and you can skip this step.)`,
            actions: modules.map((m) => ({ click: box(m.moduleId, ':not(:checked)') })),
            done: (ctx) => modules.every((m) => Boolean(ctx.query({ panel: m.panel }))),
        },
    }];
}

/** The tidy-up: untick the same modules, which closes their panels. */
export function disableModules(id, modules) {
    const names = modules.map((m) => `**${m.title}**`).join(', ');
    return [{
        step: {
            id,
            text: `To put the default layout back, untick ${names} in the **Modules** tab.`,
            actions: modules.map((m) => ({ click: box(m.moduleId, ':checked') })),
            done: (ctx) => modules.every((m) => !ctx.query({ panel: m.panel })),
        },
    }];
}
