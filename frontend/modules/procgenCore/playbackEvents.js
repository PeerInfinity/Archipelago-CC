/**
 * ⛓ The event-bus names of the PlaybackController contract that are not
 * method calls (`docs/json/developer/procgen/substrate-registry.md#playback`).
 * Import-free, so a substrate module and the Playback Bot can both name them
 * without importing each other.
 */

/**
 * `{ substrate, target, reason }` — a controller ACCEPTED a `walkTo` and only
 * later found it cannot be walked (Seedling JS J2: the panel came up on a
 * runtime with no feet; the live walk gave up). The Playback Bot turns it into
 * the same terminal, named `error:` status a synchronous `false` gets, so an
 * asynchronous refusal is never a silent wait.
 */
export const PLAYBACK_WALK_FAILED_EVENT = 'playback:walkFailed';
