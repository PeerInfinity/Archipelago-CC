/**
 * resourceLedger — **THE HOST-SIDE LEDGER OF PER-LOOP STATS AND RESOURCES** (ActionNodes design §5).
 *
 * Until this file the host kept no shared values but the mana pool and region XP (`gameState`). A world whose
 * substrate declares the `stats` / `resources` sharing categories keeps its counters HERE, so a panel that is not
 * the substrate's own (the Resources panel) and a later cross-substrate grant can read and change them.
 *
 *   - One ledger, configured for the loaded world by its OWNER substrate (`configure`), cleared for a world with
 *     none. Ids are the owner's declared types; an unknown id is refused, never invented.
 *   - Values are whole numbers per LOOP. `resetRun(totals)` sets every value to 0 plus the totals given (the owner
 *     passes its held boosts, A4), and is called by the owner on both reset events and on load.
 *   - `apply(delta)` is all-or-nothing and refuses by name: a negative stat delta ("stats only go up"), a resource
 *     going below 0, an unknown id, a non-integer amount.
 *   - Every change calls `onChange(snapshot)`; the module publishes it as `resourceChannels:ledgerChanged`.
 *   - `boosts` is DISPLAY data the owner states (which item gives what, how many held); the ledger does not apply it.
 *
 * Pure: no event bus, no DOM. The module (`index.js`) owns the one instance.
 */

export const LEDGER_CHANGED_EVENT = 'resourceChannels:ledgerChanged';

export const LEDGER_REFUSALS = Object.freeze({
    notConfigured: 'ledger-not-configured',
    unknownStat: 'unknown-stat',
    unknownResource: 'unknown-resource',
    notInteger: 'not-an-integer',
    statDown: 'stat-would-go-down',
    resourceBelowZero: 'resource-below-zero',
});

const KINDS = Object.freeze([
    { key: 'stats', unknown: LEDGER_REFUSALS.unknownStat },
    { key: 'resources', unknown: LEDGER_REFUSALS.unknownResource },
]);

export class ResourceLedger {
    /** @param {{onChange?: (snapshot: object) => void}} [opts] */
    constructor({ onChange = null } = {}) {
        this._onChange = onChange;
        this.clear({ silent: true });
    }

    /**
     * Configure for a world: the owner's id and its declared stats and resources (`{id: {name}}`). Every value
     * starts at 0; call `resetRun` with the held boosts after.
     */
    configure({ owner, stats = {}, resources = {}, label = null }) {
        if (typeof owner !== 'string' || !owner) throw new Error('resourceLedger.configure: owner required');
        this.owner = owner;
        this.label = label;
        this.names = {
            stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v?.name ?? k])),
            resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, v?.name ?? k])),
        };
        this.values = {
            stats: Object.fromEntries(Object.keys(stats).map((k) => [k, 0])),
            resources: Object.fromEntries(Object.keys(resources).map((k) => [k, 0])),
        };
        this.boosts = [];
        this.lastSource = 'configure';
        this._changed();
    }

    /** No world: nothing is kept. */
    clear({ silent = false } = {}) {
        this.owner = null;
        this.label = null;
        this.names = { stats: {}, resources: {} };
        this.values = { stats: {}, resources: {} };
        this.boosts = [];
        this.lastSource = 'clear';
        if (!silent) this._changed();
    }

    isConfigured() {
        return this.owner !== null;
    }

    getStat(id) {
        return this.values.stats[id] ?? 0;
    }

    getResource(id) {
        return this.values.resources[id] ?? 0;
    }

    /** A plain copy: owner, label, values, names, boosts, and the source of the last change. */
    snapshot() {
        return {
            owner: this.owner,
            label: this.label,
            stats: { ...this.values.stats },
            resources: { ...this.values.resources },
            names: { stats: { ...this.names.stats }, resources: { ...this.names.resources } },
            boosts: this.boosts.map((b) => ({ ...b })),
            lastSource: this.lastSource,
        };
    }

    /**
     * Why `delta` cannot be applied, or null. `delta` is `{stats?: {id: n}, resources?: {id: n}}`.
     * @returns {null | {code: string, text: string}}
     */
    whyNot(delta = {}) {
        if (!this.isConfigured()) return { code: LEDGER_REFUSALS.notConfigured, text: 'no world keeps a ledger' };
        for (const { key, unknown } of KINDS) {
            for (const [id, n] of Object.entries(delta[key] ?? {})) {
                if (!(id in this.values[key])) return { code: unknown, text: `'${id}' is not one of ${this.owner}'s ${key}` };
                if (!Number.isInteger(n)) return { code: LEDGER_REFUSALS.notInteger, text: `${key}.${id}: ${n} is not a whole number` };
                if (key === 'stats' && n < 0) {
                    return { code: LEDGER_REFUSALS.statDown, text: `${this.names.stats[id]} would go down by ${-n} (stats only go up)` };
                }
                if (key === 'resources' && this.values.resources[id] + n < 0) {
                    return {
                        code: LEDGER_REFUSALS.resourceBelowZero,
                        text: `${this.names.resources[id]} would go below 0 (has ${this.values.resources[id]}, change ${n})`,
                    };
                }
            }
        }
        return null;
    }

    /**
     * Apply a change, all or nothing.
     * @returns {{ok: true} | {ok: false, code: string, text: string}}
     */
    apply(delta = {}, { source = 'apply' } = {}) {
        const why = this.whyNot(delta);
        if (why) return { ok: false, ...why };
        let any = false;
        for (const { key } of KINDS) {
            for (const [id, n] of Object.entries(delta[key] ?? {})) {
                if (n === 0) continue;
                this.values[key][id] += n;
                any = true;
            }
        }
        if (any) {
            this.lastSource = source;
            this._changed();
        }
        return { ok: true };
    }

    /**
     * A new run (loop): every value to 0, plus `totals` (`{stats, resources}`, the held boosts). An id the ledger
     * does not keep is ignored, as is a non-integer or negative amount (boosts are never negative).
     */
    resetRun(totals = {}, { source = 'reset' } = {}) {
        if (!this.isConfigured()) return;
        for (const { key } of KINDS) {
            for (const id of Object.keys(this.values[key])) {
                const n = totals[key]?.[id];
                this.values[key][id] = Number.isInteger(n) && n > 0 ? n : 0;
            }
        }
        this.lastSource = source;
        this._changed();
    }

    /** The boosts in effect, for display: `[{item, held, gives: {stats, resources, mana}}]`. */
    setBoosts(boosts = []) {
        this.boosts = boosts.map((b) => ({ ...b }));
        this._changed();
    }

    _changed() {
        try {
            this._onChange?.(this.snapshot());
        } catch (e) {
            console.warn('[resourceLedger] onChange threw', e);
        }
    }
}
