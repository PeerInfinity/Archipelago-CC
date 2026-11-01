/**
 * Checked-seed verifier — did this region's configure get handed checks the host
 * does not have? A pure seam of `bridge.js` (no window, no client, no clock), so
 * the rule is unit-testable on the module the bridge runs.
 *
 * WHY. A configure is SEEDED with the host's checked locations (configure's
 * `checkedLocations` and the location-report ledger's ACCEPTED set) from the
 * iframe's CACHED snapshot. After a rules (re)load the host's subscribers to
 * `stateManager:rulesLoaded` run in registration order: procgenPlayer's publishes
 * the new world's loadRegion BEFORE the iframe adapter forwards that same
 * rulesLoaded (which carries the new world's snapshot). The iframe therefore hears
 * loadRegion while its cache is still the PREVIOUS world's, and a location the new
 * world has not checked is handed to the game as collected (measured on cloudberry,
 * P3a: configure got [loc_0], the host had none; the page never reported the coin).
 *
 * THE RULE — event-ordered, no clock. Messages from the host arrive in the order
 * the host posted them, and every snapshot the host posts after loadRegion is the
 * new world's (the proxy suppresses snapshots between loadRules and its
 * confirmation). So the FIRST snapshot the bridge hears after a configure is fresh,
 * and it alone decides:
 *   - an empty seed is never armed (nothing to be wrong about);
 *   - every seeded name in that snapshot → confirmed, disarmed, never reconsidered;
 *   - a seeded name missing → disarmed, and the payload is handed back ONCE to
 *     configure again; that second configure is NOT re-armed (it was seeded from the
 *     fresh snapshot), so a region is configured at most twice per loadRegion;
 *   - any later host change (a loop reset clearing checks, say) never reconfigures —
 *     it is the ledger's and setCheckedLocations' business, as before.
 */
export function createCheckedSeedVerifier() {
    let armed = null; // { payload, names: string[] }

    return {
        /** a configure was seeded with `names` from the cached snapshot; `reconfigure` = this IS the one re-run */
        configured(payload, names, { reconfigure = false } = {}) {
            armed = !reconfigure && names.length > 0 ? { payload, names: [...names] } : null;
        },

        /**
         * A snapshot arrived. Returns `{ payload, stale }` when the last configure must be
         * re-run (stale = the seeded names the host does not have), otherwise null.
         * @param {Set<string>} hostChecked the host's checked location names
         */
        snapshot(hostChecked) {
            const seed = armed;
            armed = null;
            if (!seed) return null;
            const stale = seed.names.filter((n) => !hostChecked.has(n));
            return stale.length ? { payload: seed.payload, stale } : null;
        },

        /** for tests and logs */
        isArmed() { return armed !== null; },
    };
}
