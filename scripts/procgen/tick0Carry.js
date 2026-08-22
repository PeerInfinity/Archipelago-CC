/**
 * tick0Carry — how a PRODUCER carries the v11 tick-0 latch it did not measure.
 * R9 slice 8, ⚖ ruling 20.
 *
 * ── WHY A PRODUCER HAS TO CARRY A FIELD IT CANNOT DERIVE ─────────────
 *
 * The tick-0 block is a GAME measurement: the state a fresh page reaches one
 * build and one fade after it applies the declaration, read by
 * `derive-seedling-tick0.mjs` from a zero-tick run. No solver line produces
 * it, and no model line can — `SEAM_BOOT_SPEC` marks the rng rows
 * `modelled: false` precisely because the JS engine transports them and does
 * not simulate them.
 *
 * But every one of these segments is RE-AUTHORED by its producer, whose
 * `--check` asserts the committed file is byte-identical to what it derives
 * today. A producer that did not carry the field would therefore report DRIFT
 * on a tape nothing had drifted in — and the obvious "fix" (re-running the
 * producer) would silently DELETE the measurement.
 *
 * ⇒ the producer READS the block off the committed tape and writes it back.
 * ⚖ Ruling 17: the tape IS the artifact, so there is no sidecar to duplicate
 * it and nothing is typed. ⛔ And the read is deliberately one-way — a
 * producer can carry a tick-0 latch and can never author one.
 *
 * ⚠ THE SECOND KEY IS NOT OPTIONAL EITHER. `despawn` is mandatory from v10
 * up, and every one of these segments was v8 or v9, so a tape that gains the
 * tick-0 block also gains `despawn: []` — the tape format's own rule, not a
 * choice made here, and `[]` is what these tapes have always meant.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The committed tape's tick-0 block, or `null` when it carries none.
 *
 * ⚠ RETURNS NULL RATHER THAN THROWING for a tape that does not exist or
 * does not carry the field: a producer authors tapes that are not chain
 * segments too, and most of them will never have one. The gate that
 * *requires* the field is `derive-seedling-tick0.mjs --check`, which knows
 * the derived set; this helper only knows how to carry what is there.
 */
export function committedTick0(tapesDir, label) {
    const path = join(tapesDir, `${label}.json`);
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return raw.tick0 ?? null;
}

/**
 * What to hand `parseTape` so the emitted version is 11 and the block
 * survives the round trip. Spread over the producer's own object.
 */
export function tick0ParseFields(tick0, obj) {
    if (!tick0) return {};
    // ⚠ THE VERSION RIDES ALONG. A producer's object declares its own
    // `tape_version` (8 or 9), and `parseTape` refuses a tick-0 block below
    // 11 BY DEFINITION — so carrying the field without carrying the version
    // makes the producer refuse its own committed tape. Spread this AFTER
    // any explicit `tape_version` the caller sets, or it is overwritten by
    // the number the field just invalidated.
    return { tape_version: 11, tick0, despawn: obj.despawn ?? [] };
}

/**
 * The `despawn` key, in `serializeTape`'s position — AFTER `persistence`,
 * BEFORE `equips`. Empty spread when the tape carries no tick-0 block, so a
 * producer's other tapes are byte-unchanged.
 */
export const despawnField = (tick0, parsed) => (tick0 ? { despawn: parsed.despawn } : {});

/**
 * The `tick0` key, in `serializeTape`'s position — AFTER `seam`, BEFORE
 * `tick_count`. Same empty-spread rule.
 */
export const tick0Field = (tick0, parsed) => (tick0 ? { tick0: parsed.tick0 } : {});
