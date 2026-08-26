/**
 * procgen/provisionalLatch — **ASK THE GAME BEFORE THE SERIES.**
 *
 * R9 slice P1, ⚖ ruling 54 items (1) and (4) (user, 2026-08-25: *"Yes, I want
 * to make all of these changes."*).
 *
 * ── ⛔⛔⛔ THE DEFECT THIS MODULE EXISTS FOR ───────────────────────────
 *
 * Kickoff §33.2, the epistemic note: **every "driven 0-hit, calm arrival" in
 * §30.6, §31.6 and §32.5 was the MODEL's word.** A producer's `--check`
 * latches the COMMITTED tape (`solve-seedling-r9-campaign.mjs:492`); only its
 * EMIT path latches the PROVISIONAL one (`:565`). So a walk the producers
 * called certified had never met the game, and the campaign re-record stopped
 * at S1 three times on exactly such a row — `r9-solve-3` (§33) and `r8-d2-19`
 * (§35), each mid-cascade, each after the GPU had already been spent on its
 * predecessors.
 *
 * ⇒ two words that must never again print the same:
 *
 * | level | what it means |
 * |---|---|
 * | `MODEL-CERTIFIED` | `claimArrival`'s three rows pass **in the model** |
 * | `GAME-CERTIFIED`  | a LATCH the GAME produced agrees with them |
 * | `REFUSED: <cond>` | ⚖ 49's four STOP conditions, by name — plus `unlatched`, which is the state all four presuppose |
 * | `unasked`         | no latch, and none was driven |
 *
 * ⛔ `unasked` IS NOT A FAILURE AND IS NOT A PASS. It is the third state
 * §33.2 shows the tables were missing: a row nobody put to the game reads as
 * green in a two-state column, and that is how three runs' worth of GPU was
 * spent on walks the game had never seen.
 *
 * ── ⚖ 54 (4) — THE CACHE KEY, AND THE MEASUREMENT THAT MOVED IT ───────
 *
 * The latch caches used to key on the **COMPLETE** tape bytes
 * (`rerecordCampaign.latchCacheKey`), on this argument: `GAME_VISIBLE_DROPS`
 * removes `tick0`, so two different complete boots project to the same
 * game-visible bytes and a projection-keyed cache would hand the second one
 * the first one's latch.
 *
 * ⛔⛔ **THE ARGUMENT IS ABOUT THE WRONG CONSUMER, AND THE CACHE PAID FOR IT.**
 * `driveLatch` ships `JSON.stringify(gameVisibleTape(parsed))` — the
 * PROJECTION — to the Windows driver. `tick0` is never in the bytes that are
 * driven, so a latch cannot depend on it, and keying on it can only ever throw
 * a good answer away. The continuation window `tick0` really does drive is
 * `watchWasm`'s, which is a different code path with a different projection
 * (`continuationTape`) and no cache here.
 *
 * ⛓⛓⛓ **MEASURED, NOT ARGUED (P1 W0).** `r8-d2-19`'s 721-tick walk was driven
 * at §37's third run and the game's answer is in `rerecord-cache/` under key
 * `558c4596083c` — 722 observations, 0 hits, calm at L20 (192, 64). The tape
 * `r9/re-record-attempt-4` committed for that same walk keys to
 * `67990818be8a` and MISSES, and the whole of the difference is one field:
 *
 *     md5({...branchTape, tick0: <the tick0 the tape carried at S1>})
 *         === 558c4596083c
 *
 * S2 re-derives `tick0` AFTER S1 has driven, so the complete-bytes key throws
 * away the answer the run just paid for, on the one axis `GAME_VISIBLE_DROPS`
 * exists to remove. ⛔ md5 is one-way, so the entries already in the cache
 * cannot be re-keyed — the migration is READ-OLD-THEN-NEW and nothing is ever
 * deleted (the cache is machine-global and shared across trees and sessions,
 * ⚖ 47b(5)).
 *
 * ── TWO PROJECTIONS, NAMED, AND WHY THEY DIFFER ───────────────────────
 *
 * · **`gameVisibleTape` — the RECORD-SET projection, UNCHANGED.** S3 records
 *   every tape whose projection moved (§35.4 item 3), and that projection
 *   KEEPS `description`, so the record set is over-inclusive in exactly the
 *   prose direction and never under-inclusive. That is the safe sign for a
 *   selector that had been UNDER-recording, and it stays.
 * · **`latchKeyTape` — the KEY projection.** `gameVisibleTape` minus the
 *   fields no consumer of the shipped bytes can read. Today that is exactly
 *   `description`, and a prose edit therefore costs no drive.
 *
 * ⛓ **THE DROP IS DERIVED, BY ENUMERATION RATHER THAN BY GREP-AND-HOPE.**
 * `Bot.botLoadTape` is the fork's only entry point for a tape and it reads the
 * root BY NAME — `t.tape_version t.game t.noclip t.boot t.inputs t.noDamage
 * t.noHazards t.grants t.persistence t.equips t.pins t.rng t.save t.seam`,
 * fourteen names — and the one `for..in` in that function walks a nested
 * `itemsBlock`, never the root; `description` is spelled **zero times in the
 * whole of `Bot.as`**. The Windows driver reads `tape.get("name")` and
 * `tape.get("persistence")` and nothing else. ⇒ the law is *a latch is a pure
 * function of the bytes the game **READS***.
 *
 * ⛔ AND THE LIMIT IS ENFORCED RATHER THAN TRUSTED: `latchKeyTape` REFUSES BY
 * NAME any projected field that is in neither list. A tape field added
 * tomorrow is classified deliberately or the key stops working — it never
 * silently joins the "safe to drop" side, and it never silently joins the key
 * either. Keeping a field is the safe error (a wasted GPU run); dropping one
 * is the unsafe error (a wrong number), so the refusal is on the side of the
 * wasted run.
 */

import { createHash } from 'node:crypto';

export class ProvisionalLatchError extends Error {
    constructor(message) { super(message); this.name = 'ProvisionalLatchError'; }
}
const fail = (m) => { throw new ProvisionalLatchError(m); };

/** The mode flags. Spelled here — a `.js`, outside `standingValues.producerScripts`. */
export const PROVISIONAL_FLAG = '--latch-provisional';
export const TABLE_FLAG = '--table';
export const DRIVE_FLAG = '--drive';
export const BRANCH_FLAG = '--branch';

/**
 * The projected fields the KEY drops, and the ones it keeps. Both are
 * ENUMERATED, and a field in neither is a refusal.
 *
 * ⛔ `tick_count` IS KEPT even though `botLoadTape` does not read it by name:
 * the pipeline reads it to size the driver's deadline, and a field kept in the
 * key costs at worst a GPU run. Only a field measured unreadable is dropped.
 */
export const KEY_DROPS = Object.freeze(['description']);
export const KEY_KEEPS = Object.freeze([
    // ── `Bot.botLoadTape`'s own reads, by name (Bot.as:844..) ──
    'tape_version', 'game', 'noclip', 'boot', 'inputs', 'noDamage', 'noHazards',
    'grants', 'persistence', 'equips', 'pins', 'rng', 'save', 'seam',
    // ── the Windows driver's label, and the pipeline's deadline input ──
    'name', 'tick_count',
]);

/**
 * The bytes the KEY is taken over. `projected` is `gameVisibleTape`'s OUTPUT —
 * this module never re-projects, so there is one spelling of what the game is
 * handed and this is a second reading of it rather than a second definition.
 *
 * @param {object} projected the result of `gameVisibleTape(parseTape(raw))`
 * @returns {object} the same object minus `KEY_DROPS`
 */
export function latchKeyTape(projected) {
    if (projected === null || typeof projected !== 'object' || Array.isArray(projected)) {
        fail('latchKeyTape: expects the OUTPUT of gameVisibleTape, an object');
    }
    const unclassified = Object.keys(projected)
        .filter((k) => !KEY_KEEPS.includes(k) && !KEY_DROPS.includes(k));
    if (unclassified.length) {
        fail(`latchKeyTape: ${unclassified.join(', ')} — the game-visible projection carries `
            + 'a field this key has no classification for. Decide it deliberately: add it to '
            + '`KEY_KEEPS` (the safe error — at worst a wasted GPU run) or to `KEY_DROPS` '
            + 'with the measurement that shows no consumer of the shipped bytes reads it. '
            + 'A key that guessed would return the WRONG latch, which is the unsafe error.');
    }
    const out = {};
    for (const k of Object.keys(projected)) {
        if (!KEY_DROPS.includes(k)) out[k] = projected[k];
    }
    return out;
}

const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 12);

/** The KEY, over the bytes the game READS. */
export function latchKeyOf(projected) {
    return md5(JSON.stringify(latchKeyTape(projected)));
}

/**
 * ⛓⛓ **THE MIGRATION, AS AN ORDERED LIST OF PLACES TO LOOK.** The first entry
 * is the key a new drive writes; the rest are the spellings earlier runs used.
 * A caller tries them in order and SAYS WHICH ONE HIT — a reuse is never
 * silent and a legacy hit is never mistaken for a current one.
 *
 * ⛔ NOTHING IS DELETED and no entry is re-keyed: md5 is one-way, so an
 * existing file cannot be re-derived from its contents. The legacy arms
 * therefore decay to nothing on their own as new drives write new-key files,
 * which is the only honest migration available.
 *
 * @param {object} opts
 * @param {object} opts.complete the tape as it will be committed/driven, whole
 * @param {object} opts.projected `gameVisibleTape`'s output for that tape
 * @param {'complete'|'projection'} opts.legacy which spelling this cache used
 *   before P1 — `driveLatch`'s was the COMPLETE bytes, `latchOf`'s was the
 *   PROJECTION (which still carried `description`).
 * @returns {{key: string, era: string, why: string}[]}
 */
export function latchCacheCandidates({ complete, projected, legacy }) {
    if (legacy !== 'complete' && legacy !== 'projection') {
        fail(`latchCacheCandidates: legacy must be 'complete' or 'projection', got ${legacy}`);
    }
    const current = { key: latchKeyOf(projected), era: 'key',
        why: 'the bytes the game READS (⚖ 54 (4))' };
    const before = legacy === 'complete'
        ? { key: md5(JSON.stringify(complete)), era: 'legacy:complete',
            why: 'the COMPLETE bytes — the pre-P1 spelling; it separates tapes that differ '
                + 'only in `tick0`, which is never shipped' }
        : { key: md5(JSON.stringify(projected)), era: 'legacy:projection',
            why: 'the projection WITH `description` — the pre-P1 spelling; a prose edit '
                + 'moved it' };
    return current.key === before.key ? [current] : [current, before];
}

/**
 * ⛓⛓ **THE MODEL'S ARRIVAL, READ OFF THE RUN — ONE SPELLING FOR FIVE
 * PRODUCERS.** Exactly the quantities `claimArrival` already asserts, plus the
 * two the game's latch can be compared against.
 *
 * ⛔ `ctor` IS `worldCtor` AND NOT `state`. The latch's `playerPositionX/Y` is
 * `Main.playerPositionX/Y` — the arguments the current `Game` was CONSTRUCTED
 * with — and `worldCtor` is this run's copy of exactly those. `state.x/y` is
 * where the player is standing: on `r8-d2-19` those are (192, 64) and
 * (200, 72), one `SPAWN_OFFSET` apart. `end` carries the standing pair too,
 * because a reader wants to see both, but only `ctor` is compared.
 *
 * ⛔ THE LEVEL COMES FROM THE RUN'S OWN `level`, not from the last transition:
 * a walk that ends without a transition still stands somewhere, and a column
 * that read `transitions[last]` would print nothing for it rather than the
 * truth.
 *
 * @param {?object} run a `levelRun`; `null` for a PROMOTED segment nobody
 *   re-solves, which is reported as no arrival rather than as a green one.
 * @param {?number} to the segment's DECLARED destination level
 */
export function modelArrivalOf(run, to = null) {
    if (!run) return null;
    const last = run.transitions[run.transitions.length - 1] ?? null;
    return {
        hits: run.playerHits.length,
        deaths: run.playerDeaths.length,
        level: run.level ?? null,
        to: to ?? null,
        ctor: run.worldCtor ? { x: run.worldCtor.x, y: run.worldCtor.y } : null,
        velocity: { vx: run.state.vx, vy: run.state.vy },
        end: { x: run.state.x, y: run.state.y },
        transitions: run.transitions.map((t) => ({ t: t.t, to: t.to_level })),
        lastTransition: last ? { t: last.t, to: last.to_level } : null,
        ticks: run.ticksCompleted ?? null,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 49's STOP CONDITIONS, AS A COLUMN
 * ══════════════════════════════════════════════════════════════════════ */

/** The certification levels, in the order they are decided. */
export const CERT_LEVELS = Object.freeze(
    ['GAME-CERTIFIED', 'MODEL-CERTIFIED', 'REFUSED', 'unasked']);

/**
 * ⛓⛓⛓ **THE PIXEL ROW COMPARES THE SPAWN ARGUMENTS, NOT WHERE THE PLAYER IS
 * STANDING — and that is a derivation, not a tolerance.**
 *
 * The game's latch carries `playerPositionX/Y`, which is `Main.playerPositionX/Y`
 * — the arguments the current `Game` was CONSTRUCTED with (`Bot.as:1722-1725`,
 * `:1817`). The model's copy of exactly those is `levelRun`'s `worldCtor`,
 * rewritten at every world swap; its `state.x/y` is where the player stands,
 * which is a different quantity with the same shape. On `r8-d2-19` the two are
 * (192, 64) and (200, 72) — one `SPAWN_OFFSET` apart, and a column that
 * compared the wrong pair would refuse every arrival in the roster.
 *
 * ⇒ the comparison is EXACT and there is NO TOLERANCE CONSTANT (⚖ 17). A model
 * that carries no `ctor` gets `pixel n/a` and the verdict says so out loud
 * rather than passing silently.
 *
 * @param {object} opts
 * @param {?object} opts.latch the `driveLatch` record — `{envelope, hits, …}` —
 *   or `null` when nothing was asked.
 * @param {?object} opts.model  the producer's own arrival record (walkReport's
 *   `arrival`): `{hits, deaths, level, to, ctor:{x,y}, velocity:{vx,vy}}`.
 * @param {?Array} opts.latchFindings `seamLatchFindings(envelope, {requireCalm:true})`,
 *   INJECTED so this module stays free of the browser tree.
 * @returns {{level: string, game: string, model: string, reasons: string[], rows: object[]}}
 */
export function certifyAgainstLatch({ latch = null, model = null, latchFindings = null } = {}) {
    const rows = [];
    const reasons = [];

    /* ── the MODEL's own three (claimArrival) ───────────────────────── */
    let modelVerdict = 'unasked';
    if (model) {
        const mHits = (model.hits ?? 0) === 0 && (model.deaths ?? 0) === 0;
        const mLevel = model.to === null || model.to === undefined
            ? null : model.level === model.to;
        const mCalm = model.velocity
            ? model.velocity.vx === 0 && model.velocity.vy === 0 : null;
        rows.push({ side: 'model', name: 'hits/deaths', ok: mHits,
            detail: `hits ${model.hits ?? '?'}, deaths ${model.deaths ?? '?'}` });
        if (mLevel !== null) {
            rows.push({ side: 'model', name: 'arrival level', ok: mLevel,
                detail: `L${model.level} against the declared L${model.to}` });
        }
        if (mCalm !== null) {
            rows.push({ side: 'model', name: 'calm', ok: mCalm,
                detail: `v=(${model.velocity.vx}, ${model.velocity.vy})` });
        }
        const bad = rows.filter((r) => r.side === 'model' && !r.ok);
        modelVerdict = bad.length ? 'refused' : 'certified';
        for (const r of bad) reasons.push(`model ${r.name}: ${r.detail}`);
    }

    /* ── the GAME's latch, ⚖ 49's four ─────────────────────────────── */
    let gameVerdict = 'unasked';
    if (latch) {
        const seam = latch.envelope?.seam ?? {};
        /**
         * ⛔⛔ **AN UNCLAIMED LATCH IS ITS OWN CONDITION, NOT A NON-CALM ONE.**
         * ⚖ 49 names four STOPs — calm, hit, level, pixel — and every one of
         * them presupposes that the run ARRIVED. A walk that never latched
         * fails all four rows at once through `seamLatchFindings`' UNCLAIMED
         * detail, and reporting that as "not calm" would be a TRUE SENTENCE
         * ABOUT THE WRONG SUBJECT: the game did not arrive somewhere moving,
         * it did not arrive. Measured on a truncated walk, where every
         * signature row reads UNCLAIMED and the arrival velocity is simply
         * absent.
         */
        const whole = Boolean(latch.envelope?.latched) && !latch.envelope?.partial;
        rows.push({ side: 'game', name: 'latched', ok: whole,
            detail: whole ? `whole at tick ${seam['latch.tick']}`
                : `⛔ ${latch.envelope?.latched ? 'PARTIAL' : 'NOTHING LATCHED'}`
                    + `${latch.envelope?.why ? ` — ${latch.envelope.why}` : ''}` });
        if (!whole) {
            reasons.push(`unlatched: ${latch.envelope?.latched
                ? 'the latch is PARTIAL' : 'the run never latched a seam'}`);
        }
        const notCalm = whole ? (latchFindings ?? []).filter((r) => !r.ok) : [];
        rows.push({ side: 'game', name: 'calm', ok: notCalm.length === 0,
            detail: !whole ? 'n/a — nothing arrived to be calm (this row makes NO claim)'
                : notCalm.length
                    ? notCalm.map((r) => `${r.name} [${r.detail}]`).join('; ')
                    : `${(latchFindings ?? []).length - 1} signature row(s) latched at tick `
                        + `${seam['latch.tick']}` });
        if (notCalm.length) {
            reasons.push(`not-calm: ${notCalm.map((r) => r.name).join(', ')}`);
        }

        const hits = latch.hits ?? seam['arrival.velocity']?.hits ?? null;
        if (hits !== null) {
            rows.push({ side: 'game', name: 'hit', ok: hits === 0, detail: `hits=${hits}` });
            if (hits !== 0) reasons.push(`hit: the game took ${hits}`);
        }

        const to = model?.to ?? null;
        if (to !== null && to !== undefined && seam.level !== undefined) {
            const ok = seam.level === to;
            rows.push({ side: 'game', name: 'level', ok,
                detail: `the latch is in L${seam.level}, the declaration says L${to}` });
            if (!ok) reasons.push(`level: L${seam.level} against the declared L${to}`);
        }

        const gx = seam.playerPositionX;
        const gy = seam.playerPositionY;
        const ctor = model?.ctor ?? null;
        if (gx === undefined || gy === undefined) {
            rows.push({ side: 'game', name: 'pixel', ok: true,
                detail: 'n/a — the latch carries no playerPosition' });
        } else if (!ctor) {
            rows.push({ side: 'game', name: 'pixel', ok: true,
                detail: `n/a — the game latched (${gx}, ${gy}) and the model reported no `
                    + '`ctor` to compare it against (this row makes NO claim)' });
        } else {
            const ok = gx === ctor.x && gy === ctor.y;
            rows.push({ side: 'game', name: 'pixel', ok,
                detail: `game (${gx}, ${gy}) against the model's ctor (${ctor.x}, ${ctor.y})` });
            if (!ok) reasons.push(`pixel: (${gx}, ${gy}) against (${ctor.x}, ${ctor.y})`);
        }
        gameVerdict = rows.filter((r) => r.side === 'game' && !r.ok).length
            ? 'refused' : 'certified';
    }

    /**
     * ⛔ THE GAME OUTRANKS THE MODEL, ALWAYS. §33.2's whole finding is that a
     * model claim read as a verdict; a precedence that let a green model hide
     * a red latch would put it back.
     */
    let level;
    if (gameVerdict === 'refused') level = 'REFUSED';
    else if (modelVerdict === 'refused') level = 'REFUSED';
    else if (gameVerdict === 'certified') level = 'GAME-CERTIFIED';
    else if (modelVerdict === 'certified') level = 'MODEL-CERTIFIED';
    else level = 'unasked';

    return { level, game: gameVerdict, model: modelVerdict, reasons, rows };
}

/** The one-cell rendering of a certification, reasons and all. */
export function certificationCell(cert) {
    if (cert.level !== 'REFUSED') return cert.level;
    return `REFUSED: ${cert.reasons.join(' · ') || '(no reason recorded)'}`;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⚖ 54 (2) — THE TABLE A SEAL QUOTES
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THE COLUMNS, AND WHOSE WORD EACH ONE IS.**
 *
 * ⚖ 54 (2): *"a `--table` mode: committed / model / game-latch per segment
 * from a branch; a seal QUOTES it."* Every table in §30.6, §31.6, §32.5 and
 * §33.3 was a hand transcription of a producer's stdout, and §33.2 is what
 * happens when one of those columns is read as a verdict it never was. So the
 * shape here is fixed by one rule: **a column says whose word it is, and a
 * column nobody answered says `unasked` rather than nothing.**
 *
 * | column | whose word |
 * |---|---|
 * | `committed` | the tape ON DISK in the tree the table is run in |
 * | `ref` | the tape at `--branch=<ref>`, when one is given |
 * | `model` | the producer's own solve length TODAY |
 * | `arrival` | the producer's `claimArrival` quantities |
 * | `latch` | the GAME, out of the cache — never driven by this mode |
 * | `cert` | `certifyAgainstLatch` over the two |
 * | `walk` | `walkReport`'s five verdicts |
 *
 * ⛔ `--table` NEVER DRIVES. A table that could spend a GPU is a table nobody
 * can run while thinking, and the whole point of ⚖ 54 (1)'s separate mode is
 * that asking the game is a decision somebody makes on purpose.
 */
export const TABLE_COLUMNS = Object.freeze([
    'chain', '#', 'segment', 'role', 'committed', 'ref', 'model',
    'model arrival', 'game latch', 'certification', 'walk',
]);

/** One latch record, flattened for a cell. `null` in, `null` out. */
export function latchCell(latch, hitBy) {
    if (!latch) return null;
    const seam = latch.envelope?.seam ?? {};
    const v = seam['arrival.velocity'] ?? {};
    return {
        key: hitBy?.key ?? null,
        era: hitBy?.era ?? null,
        tick: seam['latch.tick'] ?? null,
        level: seam.level ?? null,
        x: seam.playerPositionX ?? null,
        y: seam.playerPositionY ?? null,
        vx: v.vx ?? null,
        vy: v.vy ?? null,
        hits: latch.hits ?? v.hits ?? null,
        observations: latch.observations ?? null,
    };
}

const cell = (v) => (v === null || v === undefined ? '—' : String(v));

/**
 * The markdown a seal quotes. ⛔ The `ref` column is present only when a ref
 * was asked for: an empty column in a quoted table reads as a measurement that
 * came back blank.
 */
export function renderTableMarkdown(rows, { ref = null } = {}) {
    const cols = TABLE_COLUMNS.filter((c) => c !== 'ref' || ref);
    const head = cols.map((c) => (c === 'ref' ? `@${ref}` : c));
    const body = rows.map((r) => cols.map((c) => {
        switch (c) {
        case 'chain': return r.chain;
        case '#': return r.role === 'headline' ? '—' : String(r.index + 1);
        case 'segment': return `\`${r.segment}\``;
        case 'role': return r.role;
        case 'committed': return cell(r.committedTicks);
        case 'ref': return cell(r.refTicks);
        case 'model': return cell(r.modelTicks);
        case 'model arrival': return r.arrival
            ? `${r.arrival.hits}h/${r.arrival.deaths}d · L${r.arrival.level}`
                + `${r.arrival.to === null || r.arrival.to === undefined
                    ? '' : ` (→L${r.arrival.to})`}`
                + ` · v=(${r.arrival.velocity?.vx}, ${r.arrival.velocity?.vy})`
            : 'unasked';
        case 'game latch': return r.latch
            ? `t${r.latch.tick} · L${r.latch.level} · (${r.latch.x}, ${r.latch.y})`
                + ` · v=(${r.latch.vx}, ${r.latch.vy}) · ${r.latch.hits}h`
                + ` · ${r.latch.era}`
            : '**unasked**';
        case 'certification': return r.certification === 'REFUSED'
            ? `**REFUSED: ${r.reasons.join(' · ')}**` : r.certification;
        case 'walk': return r.verdict ?? 'unmeasured';
        default: return '';
        }
    }));
    const widths = head.map((h, i) => Math.max(h.length,
        ...body.map((b) => b[i].length)));
    const line = (xs) => `| ${xs.map((x, i) => x.padEnd(widths[i])).join(' | ')} |`;
    return [
        line(head),
        `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`,
        ...body.map(line),
    ].join('\n');
}
