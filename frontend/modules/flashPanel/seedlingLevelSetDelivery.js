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
 * ⚠ **THE READBACK COMPARISON WAS RESTATED HERE; M1 HOISTED IT INSTEAD.**
 * `watchWasm.levelSetDisagreement` was the same three fields against the same
 * `botLevelSet` contract, and importing `watchWasm.js` costs the 1.0 MB above
 * for twelve lines — so H7/H8 restated it and pinned the two equal by a row.
 * M1 moved the function to `seedlingDemo/levelSetDisagreement.js`, whose whole
 * specification is that it imports NOTHING: **measured, its closure is ONE
 * file / 2,708 B against `watchWasm.js`'s 16 / 1,057,624 B**, so this module
 * can now import the real thing and there is only ever one implementation.
 * ⛔ The pin row was RE-AIMED, not deleted: two consumers of one function
 * agree by construction, so a battery asking whether they agree is a FIXED
 * POINT. The test asserts the IDENTITY and keeps the battery.
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
 * ⛓ The three fields `botLevelSet` answers that say WHICH set mounted, and the
 * comparison over them — ONE implementation, imported from the module M1
 * hoisted it into. The re-export keeps this module's own spelling for its
 * callers and its rows.
 */
import {
    READBACK_FIELDS,
    levelSetDisagreement as readbackDisagreement,
} from '../seedlingDemo/levelSetDisagreement.js';

// ⛔ IMPORTED, then re-exported — not `export … from …`, which creates no local
// binding and would leave `readbackDisagreement` undefined at its one call site.
export { READBACK_FIELDS, readbackDisagreement };

/**
 * ⛓⛓⛓ **THE `botLoadLevels`/`botLevelSet` PROTOCOL — ONE IMPLEMENTATION FOR
 * BOTH HOSTS** (maze-lab arms F-b / plan §17.1 F1).
 *
 * `watchWasm.shipToWasm`'s `levels` stage and this module's `deliver()` were
 * the same three rules written twice: *pending for every chunk but the last*,
 * *`ok` only on the one that completes the delivery*, and *read the mounted set
 * BACK and diff it against what was sent*. They had already drifted once, in
 * the direction one-way duplication always drifts: the lab's loop read
 * `if (said !== 'ok') throw` for a year and refused the FIRST chunk of any
 * multi-chunk delivery. This module found it, fixed its own copy, and left
 * *"a one-line fix owed to `watchWasm`"* in a comment — the next contract
 * change would have had the same latency.
 *
 * ⛔ **THE STATE MACHINE DID NOT COME WITH IT, AND THAT IS THE WHOLE DESIGN.**
 * `arm()` REFUSES a set that arrives without its own `apMappingInvalidation`
 * companion, and that precondition guards a hazard the LAB DOES NOT HAVE — the
 * panel's teleport tables describing the vanilla 116 while a rewritten set is
 * mounted (see this file's header). MEASURED: `grep -n invalidation
 * frontend/modules/seedlingDemo/watch*.js` is **0 lines over 28 files**. So the
 * lab constructing a `SeedlingLevelSetDelivery` would have had to manufacture a
 * companion document to get past a guard that protects nothing on its side —
 * and would have planned its chunks TWICE, because `watchViewer.
 * validatedChunks` already validates and plans on the SENDER, which its own
 * docblock says is *"UPSTREAM of the sender, the only place it can be if there
 * is to be exactly one of it"*. ⇒ the PROTOCOL is hoisted; the state machine,
 * the companion rule and the chunk-planning boundary each stay where they were.
 *
 * ⛔ **IT RETURNS, IT DOES NOT REFUSE.** The two hosts refuse in different
 * vocabularies — this one with a prose `why` on a `refused` state, the lab with
 * a stage CODE (`set-readback-disagrees`) that `watchSummary.test.js` and
 * `docs/json/developer/procgen/seedling-bot.md` both read — so the shared part
 * hands back the parts and each caller words its own refusal. `stage` says
 * WHICH half failed, which is what lets the lab keep its code.
 *
 * ⛓ AND IT IS DRIVABLE IN NODE, which the lab's loop never was: `shipToWasm`
 * needs an iframe and a live game, so the lab's copy of this contract could
 * only ever be asserted by SCANNING ITS OWN SOURCE TEXT. The rules are now
 * driven, once, over an injected `bot`.
 *
 * @param {object} deps
 * @param {(name: string, arg?: string) => *} deps.bot  the artifact's callback
 *   surface (`wasmGamePage.callBot`'s rule on both sides).
 * @param {object[]} deps.chunks  ALREADY PLANNED and already checked for
 *   oversized rooms — by `planChunks` at `deliver()` here, by
 *   `watchViewer.validatedChunks` there.
 * @param {object} deps.set  what was sent, for the readback diff.
 * @returns {{ok: boolean, stage: ('chunks'|'readback'|null), sent: number,
 *            why: string|null, disagreement: string|null, readback: object|null}}
 *   `sent` is how many chunks the game ACCEPTED, so a refusal can say where it
 *   stopped; `disagreement` is `levelSetDisagreement`'s own words, unwrapped.
 */
export function deliverChunks({ bot, chunks, set }) {
    let sent = 0;
    for (let i = 0; i < chunks.length; i += 1) {
        const last = i === chunks.length - 1;
        let said;
        try {
            said = bot('botLoadLevels', JSON.stringify(chunks[i]));
        } catch (e) {
            return { ok: false, stage: 'chunks', sent, disagreement: null, readback: null,
                why: `botLoadLevels threw on chunk ${i + 1}/${chunks.length}: ${e.message}` };
        }
        /**
         * ⛔⛔ **`"pending"` IS THE SUCCESS ANSWER FOR EVERY CHUNK BUT THE
         * LAST** — `Bot.botLoadLevels`' own contract (`Bot.as:3358-3368`,
         * `LevelSet.as:331`): *pending* = accepted, more chunks owed, nothing
         * mounted; *ok* = this chunk COMPLETED the delivery and the set is
         * mounted; *error:…* = refused BY NAME, and the whole staged delivery
         * is dropped.
         *
         * ⛔ AND AN EARLY `ok` IS A REFUSAL TOO: it says the receiver mounted a
         * set the sender had not finished sending, which is a PARTIAL set the
         * game then runs happily on, every index past the end reading as
         * cleared.
         */
        const want = last ? 'ok' : 'pending';
        if (said !== want) {
            return { ok: false, stage: 'chunks', sent, disagreement: null, readback: null,
                why: `botLoadLevels answered ${JSON.stringify(said)} to chunk `
                    + `${i + 1}/${chunks.length}, and the ${last ? 'LAST' : 'non-final'} chunk of a `
                    + `delivery must answer ${JSON.stringify(want)}`
                    + `${!last && said === 'ok' ? ' — an early `ok` means the receiver mounted a '
                        + 'set this sender has not finished sending' : ''}` };
        }
        sent += 1;
    }
    /**
     * ⛔ THE READBACK IS THE POINT, and it is what makes this a delivery rather
     * than a send. Reading state back out of the artifact is the only check
     * that does not share the producer's assumptions — Phase 3b's manifest gate
     * caught `new Array(45)` this way, a defect no tape and no unit test could
     * see because both read the same wrong object.
     */
    let back = null;
    try {
        const raw = bot('botLevelSet');
        back = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
        return { ok: false, stage: 'readback', sent, disagreement: null, readback: null,
            why: `botLevelSet did not answer JSON: ${e.message}` };
    }
    const disagreement = readbackDisagreement(set, back);
    if (disagreement) {
        return { ok: false, stage: 'readback', sent, disagreement, readback: back,
            why: `the set that mounted is not the set that was sent — ${disagreement}` };
    }
    return { ok: true, stage: null, sent, why: null, disagreement: null, readback: back };
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
         * ⛓ THE PROTOCOL ITSELF IS `deliverChunks` ABOVE — the one `watchWasm`'s
         * `levels` stage now calls too. The `this.bot` indirection is kept so a
         * bot that reads `this` sees what it always saw.
         */
        const out = deliverChunks({
            bot: (name, arg) => this.bot(name, arg), chunks, set: this.set,
        });
        this.stats.chunksSent += out.sent;
        if (!out.ok) return this._refuse(out.why, out.readback);
        const back = out.readback;
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
