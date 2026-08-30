/**
 * The automation profile the JtA engine is driven under, headlessly.
 *
 * This is one object with two consumers that MUST agree:
 *
 *   - the stats harness (CC/scripts/jta-stats/driver.mjs), which measured the
 *     Phase 3c calibration curve — estimator value at decision time vs resets
 *     actually taken;
 *   - the Pass-B balance pass, which inverts that curve to pick costs.
 *
 * The curve is only a valid correction for the automation that produced it. If
 * the solver played under a different profile (different thresholds, different
 * buy policy), its inversion would be calibrated against a game nobody plays.
 * So the profile lives here, imported by both, rather than being copied.
 *
 * Extracted verbatim from driver.mjs's baselineMods(); driver.mjs re-exports it
 * so the harness's existing callers are unchanged.
 */

/**
 * Mods enabled for headless runs. Note this is NOT the game's shipped default —
 * every toggle ships OFF (the "toggles-all-off" ruling). This models play with
 * automation explicitly enabled, and there the rule is to use the settings that
 * give the best results.
 */
export function baselineMods() {
    const on = [
        'auto_haste',
        'auto_lightning',
        'auto_use_cycle',
        'auto_use_free_items',
        'artifact_tasks_item_cycle_only',
        'auto_dreamcatcher',
        'auto_ring',
        'auto_prioritize',
        'auto_prestige',
        'auto_buy_cheapest',
        // Unlock Savings ON (user ruling 2026-07-06, post-Round-6): the game's
        // toggles still all ship OFF, but this profile models play with the
        // automation explicitly enabled, and there we use the settings that give
        // the best results — savings is a measured pure win in both spark states.
        'auto_buy_budget_enabled',
        'resume_automation_on_reset',
        'force_automation',
        // NOT award_spark_on_discovery (flipped OFF 2026-07-06): the game's own
        // default is false, and Round 5 showed discovery spark is load-bearing —
        // it funds Divinity purchases with zero prestiges, which contaminated
        // every earlier sweep. Spark-on runs are an explicit override now
        // (modOverrides: { award_spark_on_discovery: true }); legacy experiments
        // in experiments.mjs get that override injected automatically.
        'auto_continue_energy_reset',
        'suppress_prestige_popup',
        'show_spark_stats',
        'instant_mode_allowed',
        'threshold_master',
        'threshold_perk_affordable_enabled',
        'threshold_perk_unaffordable_enabled',
        'threshold_combat_enabled',
        'threshold_item_enabled',
        'threshold_prestige_enabled',
        'threshold_progression_enabled',
        'threshold_unlocker_enabled',
        'threshold_other_enabled',
        'auto_prestige_stall_enabled',
        // NOT queue_cycle (mutually exclusive with auto_prioritize),
        // NOT instant_mode (driven via window.setInstantMode instead),
        // NOT auto_prestige ratio/target/wealth conditions (stall-only profile).
    ];
    const mods = {};
    for (const name of on) mods[name] = true;
    mods.threshold_all_skipped = 2; // Best Task
    return mods;
}
