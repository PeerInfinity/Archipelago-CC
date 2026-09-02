/**
 * ⛓⛓ **H6 — THE CHECK REPORT, TURNED INTO AN AP LOCATION CHECK** (EDITOR
 * INTEGRATION M1; plan §17.0.4 (e), §17.1.4, §17.2.7).
 *
 * The game reports `Game.pendingCheck = "<seq>|<level>|<tag>|<0|1>"` from
 * inside `Game.setPersistence`, the collection choke point fourteen pickup
 * classes, `Chest` and M1's `APItem` all call. This turns one such report into
 * `user:locationCheck` on the dispatcher — the same event and the same
 * `{initialTarget:'bottom'}` dialect `flashBridgeAdapter._dispatchLocationCheck`
 * publishes — and into a `{location, item, player}` readout, because the host's
 * placement table can answer *"found X for Player Y"* the instant the check
 * fires, without waiting for the server's `PrintJSON`.
 *
 * ── ⛔⛔ WHY THE FILTER IS THE PLACEMENT TABLE AND NOT A TAG LIST ─────────
 *
 * `setPersistence` is not a pickup hook. MEASURED in the AS3 fork: **~50 call
 * sites** — every door taken (`Teleporter.as:72`), every boss killed, every
 * lock opened, `Bot.as:1645` replaying a tape's persistence rows — so the
 * report is high-traffic by construction and the host has to decide what is a
 * check. Two things make a tag list the WRONG filter:
 *
 *  1. **11 of the 39 rewritten locations have NO vanilla `@tag`** — `bosskey`,
 *     `totempart` and `seed` take none in `Game.as`'s XML loop — so their tags
 *     are ALLOCATED by the rewriter out of the room's free slots. A vanilla tag
 *     list would drop every one of their checks.
 *  2. `Lock.turnOff()` and the other ~45 writers use tags of their own in the
 *     same rooms. Only the table knows which `(level, tag)` is a location.
 *
 * ⇒ the key is `apPlacementRewriter.placementKey(level, tag)` and the table is
 * INJECTED, never imported: `apPlacementRewriter.js` costs a static importer
 * 87 files and 4,868,066 B of bundle (measured at H7/H8), and this module is
 * reached from `flashPanel/index.js`.
 *
 * ── ⛔ THE FOURTH FIELD IS A FILTER, NOT DECORATION ──────────────────────
 *
 * A clear is `false` (`Main.buildLevelPersistence` fills the table with `true`
 * = *"nothing cleared"*), and six of the ~50 writers RESTORE a slot with
 * `true` — `Lock.returnToNormal`, `RockLock:73`, `BossLock:89`,
 * `LightPole:97`, `ButtonRoom:93,96`. ⛓ `ButtonRoom:93` writes a slot in
 * ANOTHER room (`Game.setPersistence(t, persist, room)`), and the rewriter
 * allocates its 11 tags out of exactly the free slots such a writer targets —
 * so without this field a button could credit a check the player never earned.
 * The AS3 reports the value written; this requires a CLEAR.
 *
 * ── ⛓ THE TWO ENCOUNTER LOCATIONS ARE NOT HERE ──────────────────────────
 *
 * `fire@L32` and `darksword@L12` are granted by a boss drop and a special
 * pickup, not by an `APItem`, so they are not rewritten and stay on the
 * adapter's existing property path (`propertyToLocationFlash`). This module
 * covers the 39 that ARE rewritten, and `hostOwnedLocations()` names them so
 * the adapter can stand down on exactly those and no others.
 */

import { parseSeqPayload } from './seqPayload.js';

/** How many `|`-separated fields the report carries. */
export const PENDING_CHECK_FIELDS = 4;

/**
 * Parse one `pendingCheck` payload.
 *
 * ⛔ THE `<seq>` IS STRIPPED AND NEVER COMPARED. It exists only because
 * BridgeGeneric reports a property when its value CHANGED, so two clears of
 * ONE slot would produce the same string and the second would be dropped
 * (measured on p4c at W5-0). It is not part of the address.
 *
 * @returns {{seq:number, level:number, tag:number, cleared:boolean}|null}
 *   null for the empty boot report and for anything malformed.
 */
export function parsePendingCheck(value) {
    // ⛔ The five refusal rules — including EMPTY IS NOT ZERO, which is why
    // `"1|19|4|"` is not a CLEAR at a real address — are `parseSeqPayload`'s,
    // stated once for both string reports. The TYPING below is this caller's.
    const parts = parseSeqPayload(value, PENDING_CHECK_FIELDS);
    if (!parts) return null;
    const [seq, level, tag, written] = parts.map(Number);
    if (![seq, level, tag, written].every(Number.isInteger)) return null;
    if (written !== 0 && written !== 1) return null;
    return { seq, level, tag, cleared: written === 0 };
}

export class SeedlingCheckBinding {
    /**
     * @param {object} deps
     * @param {Map<string, object>} deps.table  the placement table, keyed by
     *   `apPlacementRewriter.placementKey(level, tag)`. INJECTED.
     * @param {(level:number, tag:number) => string} deps.placementKey  the
     *   rewriter's own key function — ⛔ passed in rather than restated, so the
     *   two spellings of the address cannot drift.
     * @param {number} [deps.selfPlayer]  this slot, for the readout's wording.
     */
    constructor({ table, placementKey, selfPlayer = null } = {}) {
        if (!(table instanceof Map)) {
            throw new Error('SeedlingCheckBinding: `table` (the placement table) is required — '
                + 'this module never imports apPlacementRewriter, which costs a browser bundle '
                + '87 files and 4.8 MB');
        }
        if (typeof placementKey !== 'function') {
            throw new Error('SeedlingCheckBinding: `placementKey` is required — restating the '
                + 'address here is how the two spellings drift');
        }
        this.table = table;
        this.placementKey = placementKey;
        this.selfPlayer = selfPlayer;
        /** ⛔ A SET, so a re-entry that re-clears a slot cannot check twice. */
        this.checked = new Set();
        this.stats = { reports: 0, malformed: 0, restores: 0, unknown: 0, checks: 0, repeats: 0 };
    }

    /**
     * The AP location names this binding OWNS. The adapter stands down on
     * exactly these — no undo write, no second `user:locationCheck` — because
     * an `APItem` grants nothing, so the only writer of the corresponding
     * `Main.*` flag is the bridge itself, and its own echo would otherwise read
     * as a player pickup and take the item straight back.
     */
    hostOwnedLocations() {
        return new Set([...this.table.values()].map((e) => e.location));
    }

    /** One BridgeGeneric property report, straight off the adapter. */
    onStateReport(property, value) {
        if (property !== 'pendingCheck') return [];
        const report = parsePendingCheck(value);
        if (!report) {
            // The empty boot report is not malformed — BridgeGeneric reports
            // every declared property once, and `""` is what a build with the
            // seam and no collection yet says.
            if (value !== '' && value != null) this.stats.malformed += 1;
            return [];
        }
        this.stats.reports += 1;
        if (!report.cleared) {
            // A RESTORE, not a collection. Six of ~50 writers do this.
            this.stats.restores += 1;
            return [];
        }
        const entry = this.table.get(this.placementKey(report.level, report.tag));
        if (!entry) {
            // Not a location: a lock, a door, a boss, a tape replay. The common
            // case by a wide margin, and deliberately silent.
            this.stats.unknown += 1;
            return [];
        }
        if (this.checked.has(entry.location)) {
            this.stats.repeats += 1;
            return [];
        }
        this.checked.add(entry.location);
        this.stats.checks += 1;
        return [
            { type: 'locationCheck', location: entry.location, ledgerId: entry.ledgerId,
                level: entry.level, tag: entry.tag },
            { type: 'apItemFound', location: entry.location, item: entry.item,
                player: entry.player, forSelf: entry.player === this.selfPlayer,
                look: entry.look, ledgerId: entry.ledgerId },
        ];
    }

    /** The panel rebuilt its adapter; the game starts over, so may we. */
    onGameRestart() {
        this.checked.clear();
    }
}
