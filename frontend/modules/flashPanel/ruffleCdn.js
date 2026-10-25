/**
 * ⛓ Ruffle is pinned exactly. 0.7.1 is the version CI measured green: the
 * flash row (`seedling-flash-runtime-loop-bot-block-names-its-stop`) on its
 * `canvas` renderer, in the seedling-js batch (slice seedling-js-batch-stuck).
 * The unpinned URL served whatever unpkg called latest, so a Ruffle release
 * could move a CI-gated row with no commit here. Moving it is a re-run of that
 * batch, not a pointer bump.
 *
 * A leaf module with no imports, so a standalone page (bounceDemo/djReal)
 * can import the pin without the panel's module graph.
 */
export const RUFFLE_VERSION = '0.7.1';

export const RUFFLE_CDN = `https://unpkg.com/@ruffle-rs/ruffle@${RUFFLE_VERSION}/ruffle.js`;
