/**
 * Location-report ledger — which of the active region's AP locations the
 * bridge may dispatch (`user:locationCheck`) when the game reports one.
 * A pure seam of `bridge.js` (no window, no client), so both sides of the
 * rule are unit-testable.
 *
 * A name is in one of three states:
 *   - ACCEPTED   — the host's checked-locations snapshot has it (seeded at
 *                  loadRegion, refreshed on every snapshot). Never
 *                  dispatched again: an accepted check is never doubled.
 *   - IN FLIGHT  — dispatched, and neither accepted nor refused yet. A
 *                  repeated report is suppressed, so a game that re-fires
 *                  its objective every frame does not double-dispatch
 *                  while the host is still processing the first.
 *   - ARMED      — anything else; the next report dispatches.
 *
 * An in-flight name returns to ARMED when the host REFUSED it:
 *   - at once, on the loop-mode action gate's `loops:clickIgnored`
 *     (kind 'location') for that name — the gate swallowed the check, e.g.
 *     a clear made while the queue is not parked on the region;
 *   - or, failing any explicit word, when it is reported again after
 *     `settleMs` and the host's snapshot still lacks it (a refusal that
 *     publishes nothing, e.g. a planning click-to-queue mode authoring the
 *     check instead of performing it).
 * So a check the host did not accept can be sent again on the same visit.
 */

/** how long an unconfirmed dispatch suppresses a repeat before the snapshot decides */
export const LOCATION_REPORT_SETTLE_MS = 3000;

export function createLocationReportLedger({ now = () => Date.now(), settleMs = LOCATION_REPORT_SETTLE_MS } = {}) {
    const accepted = new Set();
    const inFlight = new Map(); // name -> dispatch time

    const hasIn = (names, name) => {
        if (!names) return false;
        if (names instanceof Set) return names.has(name);
        if (Array.isArray(names)) return names.includes(name);
        return false;
    };

    return {
        /** a new region: forget everything; `checkedNames` = the host's checked names for it */
        reset(checkedNames = []) {
            accepted.clear();
            inFlight.clear();
            for (const name of checkedNames) accepted.add(name);
        },

        /** the host's checked-locations snapshot: in-flight names it has are accepted */
        noteHostChecked(hostChecked) {
            for (const name of [...inFlight.keys()]) {
                if (hasIn(hostChecked, name)) {
                    inFlight.delete(name);
                    accepted.add(name);
                }
            }
        },

        /** the host said it refused `name` (the action gate swallowed it) */
        noteRefused(name) {
            if (!accepted.has(name)) inFlight.delete(name);
        },

        /**
         * The game reported `name`. True = dispatch it now (and it is in flight);
         * false = it is accepted, or still in flight.
         * @param {string} name
         * @param {Set<string>|string[]|null} hostChecked the host's current checked locations
         */
        shouldDispatch(name, hostChecked) {
            if (accepted.has(name)) return false;
            if (hasIn(hostChecked, name)) {
                inFlight.delete(name);
                accepted.add(name);
                return false;
            }
            const sentAt = inFlight.get(name);
            if (sentAt !== undefined && now() - sentAt < settleMs) return false;
            inFlight.set(name, now());
            return true;
        },

        /** for tests and logs */
        stateOf(name) {
            return accepted.has(name) ? 'accepted' : inFlight.has(name) ? 'inFlight' : 'armed';
        },
    };
}
