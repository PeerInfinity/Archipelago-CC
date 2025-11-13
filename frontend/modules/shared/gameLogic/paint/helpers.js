/**
 * Paint game-specific helper functions
 *
 * Implements the paint percentage calculation logic that determines
 * what percentage of the target image can be painted with current items.
 */

/**
 * Calculate paint_percent_available - the core Paint game logic function.
 *
 * This calculates what percentage of the target image can be painted
 * based on collected items. The calculation considers:
 * - Color depth (RGB channels)
 * - Canvas size (width x height)
 * - Pick Color tool availability
 * - World options (canvas_size_increment, logic_percent)
 *
 * This matches the Python implementation in worlds/paint/rules.py:
 * - paint_percent_available() (lines 7-11)
 * - calculate_paint_percent_available() (lines 14-34)
 *
 * @param {Object} state - The current game state/snapshot
 * @param {Object} context - Context object containing settings and static data
 * @returns {number} The percentage of image that can be painted (0-100)
 */
export function paint_percent_available(state, context) {
    // Get world options from settings
    const settings = context?.settings || {};
    const canvasSizeIncrement = settings.canvas_size_increment || 50; // Default from Paint.yaml
    const logicPercent = settings.logic_percent || 60; // Default from Paint.yaml

    // Get the player ID from context (defaults to 1 for single player)
    const player = context?.player || 1;

    // Check if we have the Pick Color item
    const hasPickColor = state.has && state.has("Pick Color", player);

    // Get color depth counts (capped at 7 maximum)
    const rCount = Math.min(state.count ? state.count("Progressive Color Depth (Red)", player) : 0, 7);
    const gCount = Math.min(state.count ? state.count("Progressive Color Depth (Green)", player) : 0, 7);
    const bCount = Math.min(state.count ? state.count("Progressive Color Depth (Blue)", player) : 0, 7);

    // Without Pick Color, color depth is capped at 2
    const r = hasPickColor ? rCount : Math.min(rCount, 2);
    const g = hasPickColor ? gCount : Math.min(gCount, 2);
    const b = hasPickColor ? bCount : Math.min(bCount, 2);

    // Get canvas size progression counts
    const w = state.count ? state.count("Progressive Canvas Width", player) : 0;
    const h = state.count ? state.count("Progressive Canvas Height", player) : 0;

    // Calculate the paint percent using the formula from the Python code
    // The formula calculates:
    // 1. Maximum per-pixel score with current color depth (worst case)
    // 2. Multiply by available canvas pixels / total pixels
    // 3. Multiply by logic_percent to allow imperfect solutions

    // Calculate color distance in worst case (RGB distance formula)
    const colorPenalty = Math.sqrt(
        (Math.pow(2, 7 - r) - 1) ** 2 +
        (Math.pow(2, 7 - g) - 1) ** 2 +
        (Math.pow(2, 7 - b) - 1) ** 2
    );

    // Per-pixel score (1 - normalized_distance)
    // The * 12 factor is from the similarity calculation in the Python code
    const perPixelScore = 1 - ((Math.sqrt(colorPenalty ** 2 * 12)) / 765);

    // Canvas dimensions
    const currentWidth = Math.min(400 + w * canvasSizeIncrement, 800);
    const currentHeight = Math.min(300 + h * canvasSizeIncrement, 600);
    const totalPixels = currentWidth * currentHeight;
    const maxPixels = 800 * 600; // 480000

    // Final calculation
    const paintPercent = (perPixelScore * totalPixels * logicPercent) / maxPixels;

    return paintPercent;
}

// Export all helpers as default for game logic registry
export default {
    paint_percent_available
};
