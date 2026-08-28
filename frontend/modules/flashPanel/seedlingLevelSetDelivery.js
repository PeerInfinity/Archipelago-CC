/**
 * flashPanel/seedlingLevelSetDelivery — **THE PANEL'S OWN LEVEL-SET DELIVERY**
 * (EDITOR INTEGRATION slice H8; plan §17.1.4, §17.2).
 *
 * ── ⛓⛓⛓ WHAT THIS IS ─────────────────────────────────────────────────────
 *
 * H7 rewrites the vanilla 116 so every AP location holds an `apitem`. This is
 * the half that gets it into the running game: `botLoadLevels` once per chunk,
 * then `botLevelSet` READ BACK and diffed against what was sent, and all of it
 * strictly BEFORE the first `flashSeedling:loadRegion` — because a region load
 * teleports into a room, and teleporting into the vanilla room and then
 * replacing the room under the player is a different game than the one AP
 * generated.
 *
 * ⛔ **THE TRANSPORT ALREADY EXISTS AND HAD EXACTLY ONE DRIVER.**
 * `seedlingDemo/watchWasm.js:1166-1187` is the watch page's; it is the shape
 * this follows, including its own law: *"reading state back out of the artifact
 * is the only check that does not share the producer's assumptions."* The
 * panel's `WasmBridgeAdapter._getFlash()` already returns the whole `game`
 * callback object, so nothing new is exposed on the adapter — this is host
 * wiring, not a new verb.
 *
 * ── ⛔⛔ WHY NOTHING HEAVY IS IMPORTED HERE, MEASURED ─────────────────────
 *
 * `frontend/init-bundled.js` reaches 494 files today and **not one of the
 * level-set modules is among them**. Measured, as source bytes added to the
 * shipped bundle by a single static import from this file:
 *
 *     seedlingDemo/levelSetValidator.js    +10 files,   794,055 B
 *     seedlingDemo/levelSetExporter.js     +15 files,   990,842 B
 *     seedlingDemo/watchWasm.js            +15 files, 1,006,615 B
 *     seedlingDemo/apPlacementRewriter.js  +87 files, 4,868,066 B
 *
 * ⇒ **every dependency this module needs is INJECTED.** `planChunks` is
 * `levelSetValidator.planLevelSetChunks`, passed in by whoever already holds
 * the set; the delivery itself is a state machine over a `bot()` callable and
 * knows nothing about how a room becomes OEL. A test injects the real
 * functions, so the rows are not testing a mock.
 *
 * ⚠ **AND THE READBACK COMPARISON IS DECLARED HERE, NOT IMPORTED — ON
 * PURPOSE, AND PINNED.** `watchWasm.levelSetDisagreement` is the same three
 * fields against the same `botLevelSet` contract, and importing it would cost
 * the 1.0 MB above for twelve lines. So it is restated, and
 * `seedlingLevelSetDelivery.test.js` imports `watchWasm`'s and asserts the two
 * AGREE over a battery of disagreeing pairs — the precedent is
 * `levelSetValidator.TILE_PX`, declared beside its consumer *"because this
 * module is deliberately dependency-light for the bundled browser graph"* and
 * pinned equal to `levelWorld.TILE_SIZE` by a row. A silent divergence is what
 * the pin exists to make impossible.
 *
 * ── ⛓ HONOURING `apMappingInvalidation` IS A PRECONDITION, NOT A STEP ────
 *
 * ⚖ USER, 2026-08-14: a replaced set INVALIDATES the 24 vanilla level
 * references, STAMPED. MEASURED for THIS rewrite (`apPlacementRewriter.
 * referenceImpactOf`): a placement rewrite **moves none of the 24** — it adds
 * no room, removes none, reorders none and repaints no tile — but it
 * **falsifies all 11 `location_coords` entries**, whose whole content is *"the
 * Sword is at level 10, (48, 64)"*. So the companion is not optional here, and
 * the way this module honours it is by REFUSING to deliver a set that arrives
 * without one whose `set_id` and `content_hash` are that set's. A delivery
 * that shipped the rewrite while the panel's teleport UI still described the
 * vanilla is precisely the silent mismatch §6.1 exists to name.
 */

/**
 * ⛓ The three fields `botLevelSet` answers that say WHICH set mounted.
 * `set_id` ends in the content hash (`stampLevelSetIdentity`), so comparing it
 * compares the bytes.
 */
export const READBACK_FIELDS = Object.freeze(['active', 'table_levels', 'start_level']);

/**
 * The first disagreement between what was sent and what the artifact says it
 * mounted, or null. ⛔ IT NAMES THE FIELD: "the readback disagrees" is a
 * sentence nobody can act on.
 *
 * ⛓ Byte-for-byte the contract of `watchWasm.levelSetDisagreement`, and
 * `seedlingLevelSetDelivery.test.js` pins the two equal.
 */
export function readbackDisagreement(sent, back) {
    if (!back) return 'botLevelSet answered nothing — the VM is dead or this build has no accessor';
    if (back.error) return `the artifact recorded a level-set error: ${JSON.stringify(back.error)}`;
    if (back.active !== sent.set_id) return `active ${back.active} ≠ ${sent.set_id}`;
    if (back.table_levels !== sent.rooms.length) {
        return `table_levels ${back.table_levels} ≠ ${sent.rooms.length}`;
    }
    if (back.start_level !== sent.start.level) {
        return `start_level ${back.start_level} ≠ ${sent.start.level}`;
    }
    return null;
}

/** The states, in the order they are reached. */
export const DELIVERY_STATES = Object.freeze(
    ['idle', 'armed', 'delivering', 'delivered', 'refused']);

export class SeedlingLevelSetDelivery {
    /**
     * @param {object} deps
     * @param {(set: object) => {chunks: object[], oversized: object[]}} deps.planChunks
     *   `levelSetValidator.planLevelSetChunks`, INJECTED (see the header).
     * @param {(name: string, arg?: string) => (string|null)} [deps.bot]
     *   the artifact's callback surface — `adapter._getFlash()` wrapped so that
     *   `bot('botLoadLevels', json)` returns what the game returned.
     * @param {(message: string, cls?: string) => void} [deps.log]
     */
    constructor({ planChunks, bot = null, log = null } = {}) {
        if (typeof planChunks !== 'function') {
            throw new Error('seedlingLevelSetDelivery: `planChunks` is required — it is '
                + '`levelSetValidator.planLevelSetChunks`, injected rather than imported so the '
                + 'panel bundle does not gain the whole level-set graph (see the header\'s '
                + 'measurement)');
        }
        this.planChunks = planChunks;
        this.bot = bot;
        this.log = log ?? (() => {});
        this.set = null;
        this.invalidation = null;
        this.state = 'idle';
        this.result = null;
        /** Diagnostics the verify script READS rather than inferring from console text. */
        this.stats = { arms: 0, attempts: 0, chunksSent: 0, refusals: 0, gated: 0, delivered: 0 };
    }

    /**
     * Arm the delivery with a rewritten set and the companion that says what it
     * invalidates. ⛔ BOTH, OR NEITHER.
     */
    arm(set, invalidation) {
        if (!set || !Array.isArray(set.rooms) || typeof set.set_id !== 'string') {
            throw new Error('seedlingLevelSetDelivery: arm() needs a stamped level set with rooms');
        }
        if (!invalidation || invalidation.set_id !== set.set_id
            || invalidation.content_hash !== set.provenance?.content_hash) {
            throw new Error('seedlingLevelSetDelivery: arm() needs this set\'s OWN '
                + '`apMappingInvalidation` companion — got '
                + `${JSON.stringify({ set_id: invalidation?.set_id,
                    content_hash: invalidation?.content_hash })} for set ${set.set_id} `
                + `(${set.provenance?.content_hash}). A rewritten set delivered while the panel's `
                + 'teleport tables still describe the vanilla 116 is the silent mismatch plan §6.1 '
                + 'exists to name: MEASURED, a placement rewrite moves none of the 24 references '
                + 'and falsifies all 11 `location_coords` entries');
        }
        this.set = set;
        this.invalidation = invalidation;
        this.state = 'armed';
        this.result = null;
        this.stats.arms += 1;
        return this;
    }

    /** The artifact's callbacks appeared (or went away on a reload). */
    attachBot(bot) {
        this.bot = typeof bot === 'function' ? bot : null;
        return this;
    }

    /** Both halves present? The delivery waits for the PLACEMENT and the GAME. */
    ready() {
        return this.state === 'armed' && typeof this.bot === 'function';
    }

    /**
     * Send it. Idempotent: a second call after success returns the first
     * result and sends nothing.
     *
     * @returns {{ok: boolean, state: string, chunks: number, why: string|null,
     *            readback: object|null}}
     */
    deliver() {
        if (this.state === 'delivered') return this.result;
        if (this.state === 'idle') {
            // ⛓ NOT A FAILURE. No rewritten set means the vanilla boot, which is
            // what every preset does today.
            return { ok: true, state: 'idle', chunks: 0, why: null, readback: null };
        }
        if (typeof this.bot !== 'function') {
            return { ok: false, state: this.state, chunks: 0, readback: null,
                why: 'the game\'s bot callbacks are not up yet — the delivery waits for the '
                    + 'artifact as well as for the placement' };
        }
        this.state = 'delivering';
        this.stats.attempts += 1;
        const { chunks, oversized } = this.planChunks(this.set);
        if (oversized.length > 0) {
            // ⛔ REFUSED, never sent. A chunk past the proven envelope kills the
            // AVM2 arena mid-call and leaves a PARTIAL set mounted, on which the
            // game runs happily with every index past the end reading as cleared.
            return this._refuse(`${oversized.length} room(s) exceed the proven chunk envelope: `
                + oversized.map((o) => `${o.name ?? o.id} ${o.bytes}B`).join(', '));
        }
        /**
         * ⛔⛔ **`"pending"` IS THE SUCCESS ANSWER FOR EVERY CHUNK BUT THE LAST**
         * — `Bot.botLoadLevels`' own contract: *"pending — accepted; more
         * chunks are owed, nothing is mounted / ok — this chunk COMPLETED the
         * delivery and the set is mounted / error:… — refused BY NAME, and the
         * whole staged delivery is dropped"*.
         *
         * ⚠ MEASURED, ON THE FIRST BROWSER RUN OF THIS SLICE, AND IT IS A
         * FINDING ABOUT THE MODULE THIS ONE FOLLOWS. `watchWasm.js:1169-1170`
         * is `if (said !== 'ok') throw` — which refuses the FIRST chunk of any
         * delivery of more than one, with the message `botLoadLevels: pending`.
         * It has never bitten because every set that page ships is one chunk;
         * the vanilla 116 is **nine**, and it is the first multi-chunk delivery
         * anyone has driven. `probe-seedling-level-set-transport.mjs` had it
         * right all along — it asserts only that the LAST answer is `ok`.
         * ⇒ trap, and a one-line fix owed to `watchWasm` (not this slice's
         * file to touch).
         */
        for (let i = 0; i < chunks.length; i += 1) {
            const last = i === chunks.length - 1;
            let said;
            try {
                said = this.bot('botLoadLevels', JSON.stringify(chunks[i]));
            } catch (e) {
                return this._refuse(`botLoadLevels threw on chunk ${i + 1}/${chunks.length}: ${e.message}`);
            }
            const want = last ? 'ok' : 'pending';
            if (said !== want) {
                return this._refuse(`botLoadLevels answered ${JSON.stringify(said)} to chunk `
                    + `${i + 1}/${chunks.length}, and the ${last ? 'LAST' : 'non-final'} chunk of a `
                    + `delivery must answer ${JSON.stringify(want)}`
                    + `${!last && said === 'ok' ? ' — an early `ok` means the receiver mounted a '
                        + 'set this sender has not finished sending' : ''}`);
            }
            this.stats.chunksSent += 1;
        }
        /**
         * ⛔ THE READBACK IS THE POINT, and it is what makes this a delivery
         * rather than a send. `watchWasm`'s own note: Phase 3b's manifest gate
         * caught `new Array(45)` this way, a defect no tape and no unit test
         * could see because both read the same wrong object.
         */
        let back = null;
        try {
            const raw = this.bot('botLevelSet');
            back = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return this._refuse(`botLevelSet did not answer JSON: ${e.message}`);
        }
        const why = readbackDisagreement(this.set, back);
        if (why) return this._refuse(`the set that mounted is not the set that was sent — ${why}`, back);
        this.state = 'delivered';
        this.stats.delivered += 1;
        this.result = { ok: true, state: 'delivered', chunks: chunks.length, why: null, readback: back };
        this.log(`[ap placement] ${this.set.rooms.length} room(s) mounted in ${chunks.length} `
            + `chunk(s) — ${this.set.set_id}`);
        return this.result;
    }

    /**
     * ⛔⛔ **THE ORDERING GATE.** Called at the TOP of the glue's
     * `handleLoadRegion`, before anything the binding does. A region load that
     * arrives while a rewritten set is still armed DELIVERS FIRST; it never
     * proceeds on the vanilla rooms and never silently drops the delivery.
     *
     * ⛓ `mounted` is a STATE (is the set in the game?); `sent` is an EVENT
     * (did THIS call do the sending?). A caller counting deliveries needs the
     * event — reading the state would count one delivery per region load
     * forever.
     *
     * @returns {{proceed: boolean, mounted: boolean, sent: boolean, why: string|null}}
     */
    gateLoadRegion() {
        this.stats.gated += 1;
        if (this.state === 'idle') return { proceed: true, mounted: false, sent: false, why: null };
        if (this.state === 'delivered') {
            return { proceed: true, mounted: true, sent: false, why: null };
        }
        const result = this.deliver();
        const mounted = result.ok && result.state === 'delivered';
        return { proceed: result.ok, mounted, sent: mounted, why: result.why };
    }

    _refuse(why, readback = null) {
        this.state = 'refused';
        this.stats.refusals += 1;
        this.result = { ok: false, state: 'refused', chunks: this.stats.chunksSent, why, readback };
        this.log(`[ap placement] DELIVERY REFUSED — ${why}`, 'error');
        return this.result;
    }
}
