/**
 * The divergence sweep row's `seam` (slice `seedling-js-seam-offset`, planner `seedling-js-planning-6`). Pure (no
 * browser, no repo imports): the in-page lab (`seedlingDivergenceLab.js`) imports it by URL, a unit test off disk.
 *
 * A row's seam is the leg's FIRST solve request's `staging.seam`, copied as the worker got it. That block is the
 * tape's own (`tapeFormat.SEAM_BOOT_SPEC`: the item flags under `items`, `hits_max` beside them, `time` the clock
 * the solver planned at), so `parseTape` reads a row's seam unedited, and a tape booted from it is the request's.
 *
 * ⛔ NOT the row's `items`. That is `botStatus().items` read AFTER the leg, in the game's `Player` property names:
 * `hitsMax` sits among the flags, where the seam's `items` group refuses it ("seam.items.hitsMax is not a seam
 * field"), and an item the leg picked up is in it although the solver never planned with it.
 *
 * @param {Array<{req?: {staging?: {seam?: object|null}}}>} solves  the leg's solves, in order
 * @returns {object|null}  a plain copy of the first request's seam; null when the leg made no solve or staged none
 */
export function sweepRowSeam(solves) {
    const seam = solves?.[0]?.req?.staging?.seam;
    return seam && typeof seam === 'object' ? JSON.parse(JSON.stringify(seam)) : null;
}
