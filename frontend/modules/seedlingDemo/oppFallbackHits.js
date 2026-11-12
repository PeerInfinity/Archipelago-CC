/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE OPP-FALLBACK-HITS — `OPP_PRESS_FALLBACK` MUST NOT ADOPT A REDO THAT TAKES HITS
 * (`OPP_FALLBACK_HITS`).
 *
 * Measured (`CC/docs/cloud-reports/seedling-hammer-opp-fallback-hits.md` § 3): `OPP_PRESS_FALLBACK` adopts its redo on
 * one test — "the kill completed" (a returned record, or the lock tail's `PendingDeclaration`). The press kill's
 * executor (`execKillByPressOnce`) never reads the player's hit ledger: its no-hit rule is the FORECAST's (`safeStep`
 * and the danger map), so a contact hit the forecast did not price is billed by the model and adopted with the redo.
 * The witness: leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560
 * cleared` under the hammerClearTagChain train row's set: the redo is recorded `{verdict: solved, ticks: 826, how:
 * opp-plain}` and its 826 keys bill two chaser contact hits. ⚖ The no-hit rule: logic never expects tanking a hit.
 *
 * ⇒ ON (`SEEDLING_OPP_FALLBACK_HITS=1`, or `withOppFallbackHits(true, fn)`): after a redo that killed, the hits the
 * model billed over the redo's own ticks are read off the run the redo ended on. Any hit ⇒ the redo is UNDONE (the run,
 * keys, equips, takes and dash count are the refusal's again, exactly as a redo that did not kill) and the ORIGINAL
 * refusal is thrown, its words unchanged plus one sentence naming the hits (`oppFallbackHitsSentence`). A hitless redo
 * is adopted exactly as before.
 *
 * ⛔ OFF (the default) nothing is read: byte-identical. `OPP_FALLBACK_HITS.census` (an instrument, default false, never
 * from env) makes the OFF path AUDIT the redo too and record it in `OPP_FALLBACK_HITS_COUNTS` while still adopting —
 * the census's one-pass reading of today's adoptions. Read by nothing that decides.
 *
 * Thread: the solve WORKER (the solver reads its switches at module load; the page's solverEnvChannel installs the env
 * there). No main-thread decision reads it.
 */
export const OPP_FALLBACK_HITS = { enabled: globalThis.process?.env?.SEEDLING_OPP_FALLBACK_HITS === '1', census: false };
export const OPP_FALLBACK_HITS_DEFAULT = false;

/**
 * The instrument: `audited` redos that killed and were read, `hitless` / `hit` their split, `refused` the ones the
 * switch refused; `rows` one per audited redo `{t, ticks, bodies, hits: [{t, source, id}], refused}`.
 */
export const OPP_FALLBACK_HITS_COUNTS = { audited: 0, hitless: 0, hit: 0, refused: 0, rows: [] };
export function resetOppFallbackHitsCounts() {
    OPP_FALLBACK_HITS_COUNTS.audited = 0;
    OPP_FALLBACK_HITS_COUNTS.hitless = 0;
    OPP_FALLBACK_HITS_COUNTS.hit = 0;
    OPP_FALLBACK_HITS_COUNTS.refused = 0;
    OPP_FALLBACK_HITS_COUNTS.rows.length = 0;
}

/** Run `fn` with `OPP_FALLBACK_HITS` set to `enabled`, restoring the previous value (sync or async). */
export function withOppFallbackHits(enabled, fn) {
    const was = OPP_FALLBACK_HITS.enabled;
    OPP_FALLBACK_HITS.enabled = enabled === true;
    const restore = () => { OPP_FALLBACK_HITS.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/** Is the redo audited at all? ON, or the census instrument. */
export function oppFallbackHitsAudits() {
    return OPP_FALLBACK_HITS.enabled || OPP_FALLBACK_HITS.census;
}

/**
 * The hits a run's ledger billed on the ticks AFTER run clock `fromClock`, as `{t, source, id}` rows (a ledger row's
 * `t` is the clock the hit's tick completed, so a tick advanced from `fromClock` bills `t > fromClock`). `run` is any
 * object with the levelRun `ledger(name)` reader (the segment's view included).
 */
export function playerHitsSince(run, fromClock) {
    return (run?.ledger?.('playerHits') ?? []).filter((h) => h.t > fromClock)
        .map((h) => ({ t: h.t, source: h.source ?? null, id: h.id ?? null }));
}

/**
 * Record one audited redo, and say whether it is REFUSED (ON and it took a hit). `row` is the fallback's own record.
 */
export function auditOppFallbackRedo(row, hits) {
    const refused = OPP_FALLBACK_HITS.enabled && hits.length > 0;
    OPP_FALLBACK_HITS_COUNTS.audited += 1;
    if (hits.length > 0) OPP_FALLBACK_HITS_COUNTS.hit += 1;
    else OPP_FALLBACK_HITS_COUNTS.hitless += 1;
    if (refused) OPP_FALLBACK_HITS_COUNTS.refused += 1;
    OPP_FALLBACK_HITS_COUNTS.rows.push({ t: row.t, ticks: row.ticks ?? null, bodies: [...(row.bodies ?? [])],
        hits: hits.map((h) => ({ ...h })), refused });
    return refused;
}

/** The sentence a hit-refused redo appends to the refusal that stands. */
export function oppFallbackHitsSentence(row, hits) {
    const named = hits.slice(0, 4).map((h) => `t${h.t} ${h.source ?? '?'}:${h.id ?? '?'}`).join(', ');
    return `The plain fallback (\`OPP_PRESS_FALLBACK\`) rewound to the kill's first tick (t${row.t}) and redid the kill `
        + `with \`OPPORTUNISTIC_STRIKE\` off; it killed in ${row.ticks} tick(s) but the model billed ${hits.length} `
        + `player hit(s) on the redo (${named}${hits.length > 4 ? ', …' : ''}), so it is not adopted `
        + '(`OPP_FALLBACK_HITS`: the no-hit rule — a redo that tanks a hit is not a solve).';
}
