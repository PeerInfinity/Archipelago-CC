/**
 * Shared step: load a preset world AND wait for its sphere log. The log is
 * fetched after the rules (sphereState), so a step that needs it — Loop
 * mode's Generate Costs, the Loops Cost Debugger — taken at once after a
 * plain load finds none ("No sphere log available").
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

export function loadWorldWithLog(id, game, seed, title) {
    return [{
        step: {
            id,
            text: `Load **${title}** (seed ${seed}) — in the **Presets** panel, or by opening the page with \`?game=${game}&seed=${seed}\`. **Do it** loads it for you.`,
            run: (ctx) => ctx.loadPreset(game, seed),
            done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.publishedSinceStep('sphereState:dataLoaded')
                && ctx.isPresetLoaded(game, seed),
            doneTimeoutMs: 30000,
        },
    }];
}
