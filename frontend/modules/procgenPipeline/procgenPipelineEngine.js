/**
 * procgenPipeline engine — headless grid-growth pipeline logic.
 * See NewDocs/plans/procedural-generation/grid-growth-pipeline.md.
 *
 * This file will host the scenario pool, grid model, growth loop,
 * incremental re-stitcher, and full-world Boolean compile. v1 starts
 * here mostly empty; the punch list in the plan doc drives what gets
 * added next.
 */

// Stubs for the four directions, to match the maze substrate's INPUTS
// shape. Used by grid-position math once the grid model lands.
export const SIDE_N = 'N';
export const SIDE_S = 'S';
export const SIDE_E = 'E';
export const SIDE_W = 'W';
export const SIDES = [SIDE_N, SIDE_S, SIDE_E, SIDE_W];

export const OPPOSITE_SIDE = Object.freeze({
    [SIDE_N]: SIDE_S,
    [SIDE_S]: SIDE_N,
    [SIDE_E]: SIDE_W,
    [SIDE_W]: SIDE_E,
});
