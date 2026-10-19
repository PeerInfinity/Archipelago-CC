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
 * ── ⛓⛓ R4b part 2 — THE NINE REPORT ROWS ARE TABLE ROWS, AND THE FLAG PATH IS RETIRED ──
 *
 * On a build declaring `bossreport` the seven boss kills, the Bob Boss's Fire drop `(32,4)` and the Witch's dark
 * sword `(12,1)` REPORT through the same clear as every `APItem` (`apPlacementRewriter`'s `tagSource: 'fixed'`
 * rows), and the game no longer grants Fire or the dark sword. So they are checked here like any other row, and
 * the old ENCOUNTER path — a `hasFire` / `hasDarkSword` property turning true, echo- and level-filtered — is gone:
 * on this build nothing but the host's own grant ever sets those flags, so reading them would check the location
 * off the SERVER's item. A build without `bossreport` never gets here (the load refuses the nine by name).
 * `hostOwnedLocations()` still names the property path's own names for the two flags (`propertyLocations`, the
 * game config's `Fire` / `Dark Sword`), so the adapter stands down there and never undoes the host's grant.
 *
 * ── ⛓⛓ THE RECONCILE — ONE REPORT SLOT, TWO CLEARS IN ONE FRAME ───────────
 *
 * `pendingCheck` is one string polled once per frame, so two clears in one update report only the LAST. The Owl
 * does exactly that: `FinalBoss.endAnim` clears `tag` then `tag + 1` in one call (`FinalBoss.as:219-222`), so
 * `(112,0)` — the Owl location — is overwritten by `(112,1)` (the rocklock event) before the host reads it. The
 * event collector already met this (`seedlingEventCollector.onReconcile`, L38's ButtonRoom); this is the same fix
 * for checks: after every live clear (`liveClears`) the glue re-reads the game's cleared table
 * (`botStatus().persistence_cleared`) and `onReconcile` checks every table address found cleared and not yet
 * checked. ⛔ The arming window still holds: a clear refused there (a tape's declaration the player never earned)
 * is remembered (`unearned`) and the reconcile does not credit it either — a later LIVE clear of the same slot
 * still checks it.
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
    constructor({ table, placementKey, selfPlayer = null, propertyLocations = [] } = {}) {
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
        /** ⛓ W2 — the host `botStart` arming windows, `{from, to}` seq ranges (⚖ W0-Q1). */
        this.hostStarts = [];
        this.stats = { reports: 0, malformed: 0, restores: 0, unknown: 0, checks: 0, repeats: 0, armingWindow: 0,
            reconcile: 0, reconcileReads: 0 };
        /** ⛓ R4b part 2 — the property path's names for flags the host owns (`Fire`, `Dark Sword`): stood down. */
        this.propertyLocations = (propertyLocations ?? []).filter((n) => typeof n === 'string' && n !== '');
        /** ⛓ THE RECONCILE — clears reported outside a host start's arming window, of ANY slot (the glue's trigger). */
        this.liveClears = 0;
        /** ⛓ THE RECONCILE — table keys whose clear arrived inside an arming window (never credited by a re-read). */
        this.unearned = new Set();
    }

    /**
     * ⛓⛓ W2 — **⚖ W0-Q1: A CHECK FIRED INSIDE A HOST `botStart` IS NOT A CHECK.**
     *
     * `botStart` re-declares the tape's clears through `Game.setPersistence`
     * (`Bot.as` R2 block), one `pendingCheck` each, BEFORE the first stepped
     * tick (W0 ii.2/ii.8). A clear the player earned is already in `checked`
     * (the dedupe), so the only clear that can reach a NEW check from inside
     * that window is one the player never earned — the fake-check hazard
     * (W0 ii.6). The playback engine declares exactly the live cleared set, so
     * this is the second, independent net the user ruled for.
     *
     * The window is a `<seq>` RANGE, not a time: the engine reads
     * `pendingCheck`'s seq just before `botStart` and just after it returns, in
     * the same JS turn. `Game.pendingCheckSeq` is bump-only for the page's life
     * (`Game.as:621`), and nothing steps between `botStart` and the next
     * frame's `Bot.update`, so every report with `from < seq <= to` was written
     * by that call and nothing else. (The seq is otherwise stripped and never
     * compared — `parsePendingCheck` — this is its one other use.)
     *
     * @param {{from:number, to:number}} window  seqs read before / after `botStart`
     */
    ignoreHostStart({ from, to } = {}) {
        if (!Number.isInteger(from) || !Number.isInteger(to) || to <= from) return false;
        this.hostStarts.push({ from, to });
        if (this.hostStarts.length > 32) this.hostStarts.shift();
        return true;
    }

    /** Was `seq` written inside a host `botStart`'s arming window? */
    insideHostStart(seq) {
        return this.hostStarts.some((w) => seq > w.from && seq <= w.to);
    }

    /**
     * The AP location names this binding OWNS. The adapter stands down on
     * exactly these — no undo write, no second `user:locationCheck` — because
     * an `APItem` grants nothing, so the only writer of the corresponding
     * `Main.*` flag is the bridge itself, and its own echo would otherwise read
     * as a player pickup and take the item straight back.
     */
    hostOwnedLocations() {
        return new Set([...[...this.table.values()].map((e) => e.location),
            // ⛓ R4b part 2 — the property path's own names for the two host-granted flags (see the head).
            ...this.propertyLocations]);
    }

    /**
     * One BridgeGeneric property report, straight off the adapter.
     *
     * @param {string} property
     * @param {*} value
     */
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
        const host = this.insideHostStart(report.seq);
        if (!host) this.liveClears += 1;
        const key = this.placementKey(report.level, report.tag);
        const entry = this.table.get(key);
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
        if (host) {
            // ⚖ W0-Q1 — an UNEARNED declaration's echo, never a collection
            // (an earned one was a repeat, above). Counted, so a gate can tell
            // "caught" from "never fired" — and remembered, so the reconcile
            // cannot credit it from the game's table either.
            this.stats.armingWindow += 1;
            this.unearned.add(key);
            return [];
        }
        this.unearned.delete(key);
        return this._check(entry);
    }

    _check(entry, at = 'live') {
        this.checked.add(entry.location);
        this.stats.checks += 1;
        if (at === 'reconcile') this.stats.reconcile += 1;
        return [
            { type: 'locationCheck', location: entry.location, ledgerId: entry.ledgerId,
                level: entry.level, tag: entry.tag, ...(at === 'reconcile' ? { at } : {}) },
            { type: 'apItemFound', location: entry.location, item: entry.item,
                player: entry.player, forSelf: entry.player === this.selfPlayer,
                look: entry.look, ledgerId: entry.ledgerId },
        ];
    }

    /**
     * ⛓ THE RECONCILE (see the head) — the game's cleared slots as they stand after a live clear
     * (`botStatus().persistence_cleared`, `[{level, tag}]`): every table address among them not yet checked, and
     * not refused inside an arming window, is checked now. A readout with no such array is not a read.
     */
    onReconcile(cleared) {
        if (!Array.isArray(cleared)) return [];
        this.stats.reconcileReads += 1;
        const out = [];
        for (const c of cleared) {
            const key = this.placementKey(Number(c?.level), Number(c?.tag));
            const entry = this.table.get(key);
            if (!entry || this.checked.has(entry.location) || this.unearned.has(key)) continue;
            out.push(...this._check(entry, 'reconcile'));
        }
        return out;
    }

    /** The panel rebuilt its adapter; the game starts over, so may we. */
    onGameRestart() {
        this.checked.clear();
        this.hostStarts = [];
        this.unearned.clear();
    }
}
