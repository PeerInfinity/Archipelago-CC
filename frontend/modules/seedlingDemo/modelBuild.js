/**
 * seedlingDemo/modelBuild — **WHICH BUILD THE MODEL SPEAKS FOR** (slice seedling-fidelity-p4hport).
 *
 * ⛓ THE MODEL ASKS THE BUILD, AS `apChestRoster.js` DOES. A build's manifest `capabilities` (`builds.json`) say what
 * its game does; the model reads the same words and picks the arm:
 *   · `bossdraws` (p4h, Seedling `p4h-as3` 0ea17b675a): the nine L57/L112 gameplay sites read `Pattern.vdc` over the
 *     bosses' own counters — `finalBossRng.OwlPatternStream`, `tentacleBeast.TentaclePatternStream` — so every entry
 *     is the same fight and no seed premise or re-entry refusal is owed (`levelRun`);
 *   · anything else: today's seeded `OwlDrawStream` / `TentacleDrawStream`, byte for byte.
 *
 * ⛔ A CALLER THAT NAMES NO BUILD GETS p4g's ANSWER. `null`/`undefined` capabilities resolve to
 * `modelBuildDefault()`, which is the default build's word list (`P4G_CAPABILITIES`, held equal to `builds.json`'s
 * `role: 'default'` row by `fidelityP4hPort.test.js`) until P2 flips the default. There is no data path from a tape
 * to this choice: only code passes `capabilities`.
 *
 * ⚠ `setModelBuildDefault` exists for MEASUREMENT ONLY (a vitest setup file that asks a whole test file "what would
 * p4h say"); it returns its own restore. Nothing committed calls it outside a test.
 */

import { BOSS_DRAWS_CAPABILITY } from '../flashPanel/seedlingRandomizerEligibility.js';

/** The default build (`seedling_bot_ap_p4g`)'s manifest capabilities, in the manifest's order. */
export const P4G_CAPABILITIES = Object.freeze(['arm', 'apitem', 'hold', 'tag', 'freeze', 'sincebegin', 'bossreport']);

let defaultCapabilities = P4G_CAPABILITIES;

/** The capabilities a caller that names no build is answered for (p4g's, unless a measurement swapped them). */
export const modelBuildDefault = () => defaultCapabilities;

/**
 * MEASUREMENT ONLY: answer every caller that names no build as `capabilities` would. Returns the restore.
 * @param {string[]} capabilities
 * @returns {() => void}
 */
export function setModelBuildDefault(capabilities) {
    if (!Array.isArray(capabilities)) throw new TypeError('setModelBuildDefault: capabilities must be an array');
    const was = defaultCapabilities;
    defaultCapabilities = Object.freeze([...capabilities]);
    return () => { defaultCapabilities = was; };
}

/** A caller's capabilities, or the default's when it named none. */
export const resolveModelCapabilities = (capabilities) => (capabilities ?? defaultCapabilities);

/** Does this build read the L57/L112 patterns (`Pattern.vdc`) instead of `Math.random`? */
export const declaresBossDraws = (capabilities) => resolveModelCapabilities(capabilities).includes(BOSS_DRAWS_CAPABILITY);

