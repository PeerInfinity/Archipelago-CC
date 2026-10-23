/**
 * The divergence sweep's HIT TICKS (S5-2, planner `seedling-js-planning-6`): one entry per increment of the GAME's
 * `hits`, on the same clock as the drained rows, so an unbilled hit lines up with a divergence. Pure (no browser, no
 * repo imports): the in-page lab (`seedlingDivergenceLab.js`) feeds it `botStatus` reads, the merge job and a unit
 * test import it off a sparse checkout.
 *
 * ── THE CLOCK ─────────────────────────────────────────────────────────────────────────────────────────────────
 * A drained row is `{t: obsBase + i}` (`Bot.botDrain`), and `Bot`'s frame hook RECORDS row `tick`, then `tick++`,
 * then the game updates (`Bot.as:3234,3335`). Within that update the enemies run first and `Player.hit` sets
 * `hitsTimer = 20`; `Player.update`'s `hitUpdate` then takes it to 19 on the SAME frame (`playerDamage.js`' head,
 * "the order within a tick"). So a hit in the frame that recorded row k reads, after that frame,
 * `{tick: k + 1, hits_timer: 19}`, and every later frame adds 1 to `tick` and takes 1 off the timer:
 *
 *     t = tick + hits_timer − HITS_TIMER_MAX + 1      (= k + 1)
 *
 * `t` is the FIRST drained row whose state carries the hit (the knockback is frictioned on the hit's own frame, so
 * that row's position already moved) — the model ledger's convention, `playerHits[].t = ticksCompleted + 1`
 * (`levelRun.js`), which is what a plan's billed `forcedHits[].billed[].t` carry. A divergence at `t` with a hit at
 * the same `t` is the hit.
 *
 * The status is SAMPLED (every 25 ms, not every frame), and the timer is what makes a late read exact: a read up to
 * 19 frames after the hit still names the frame. It is NOT exact (`exact: false`, `why` names it) when:
 *   · `hits_timer` already read 0 (the read came ≥ 20 frames late: `t` is null, `tick` is an upper bound);
 *   · `dead_frames` rose since the previous read (a frozen frame runs `hitUpdate` but no `tick++`, so the timer
 *     ran ahead of the clock by up to that many frames);
 *   · the tape was not armed at the read (the bot's `tick` stops while the game may still update).
 * The JS runtime's `botStatus` (`runtime: 'js'`) has no tape clock: its `ticks` (the core's step count, `game_time`)
 * is the clock there, and the same arithmetic holds (the model transcribes `hitUpdate` in the hit's own step).
 *
 * ⛓ The attacker is NOT here: `botStatus` does not name it, and a nearest-mobile guess 25 ms late is not cheap
 * evidence. The model's billed rows carry `source`; the game's do not.
 *
 * ⛓ An old row has no `roomHits.hits` array: that is UNKNOWN, never 0 hits (`hitsOfRow` → null).
 *
 * ── ⛓ ARRIVAL LATCH (§5.124) ──────────────────────────────────────────────────────────────────────────────────
 * A hit on a 0-tick HOLD tape (the arrival's freeze, waiting ~19 frames for its latch) has no plan row to be billed
 * against: a refused leg has no plan at all (leg 209). The lab steps the MODEL from that hold's arrival staging, nothing
 * held, over the frames the game ran (the read's `gt` − the staged `seam.time`, +1), and records it on the hit as
 * `arrival: {rows, billed, frames, seamTime}` (`rows[i]` = the state after model tick i + 1). `arrivalLatchVerdict`
 * bills the hit when a model hit's state, `HITS_TIMER_MAX − 1 − hits_timer` rows on (the frames since the hit at
 * the read), is the game's read FIELD FOR FIELD (`x`, `y`, `hitsTimer`). The model's stepping is its own
 * (`createRunForStaging` + `advance`); the harness only compares.
 */

/** `Player.hitsTimerMax` (`Player.as:336`; `playerDamage.PLAYER_DAMAGE.hitsTimerMax`). */
export const HITS_TIMER_MAX = 20;

/**
 * ⛓ UNBILLEDGATE (fidelity-7 wave 15, `claude/seedling-unbilledgate-f64y27` 2e4b0af01c): the `SolverRefusal`
 * `obstacle.kind` of a segment that solved with a hit no forced-hit plan billed, or a death. Behind
 * `CONTACT_FIDELITY.unbilledDamageGate` (OFF). ⚠ The obstacle's other fields are provisional until their harvest.
 */
export const UNBILLED_GATE_KIND = 'unbilled-damage';

/** The clock a status read is on, and its tick: the wasm tape's `tick`, or the JS core's `ticks`. */
export function statusClock(s) {
    if (s?.runtime === 'js') return typeof s.ticks === 'number' ? { clock: 'js-ticks', tick: s.ticks } : null;
    return typeof s?.tick === 'number' ? { clock: 'tape', tick: s.tick } : null;
}

/** A read's hit row `t` (the formula in the head), or null with no clock or a timer already run out. */
export function hitTickOf(s) {
    const c = statusClock(s);
    const timer = typeof s?.hits_timer === 'number' ? s.hits_timer : 0;
    return c && timer > 0 ? c.tick + timer - HITS_TIMER_MAX + 1 : null;
}

/**
 * A recorder over successive status reads. `observe(status, ctx)` returns the entries this read adds (one per rise
 * of `hits`; `d` > 1 only when one `Player.hit` dealt more than 1). A fall of `hits` is a new `Player` (a death, a
 * room re-entered): the baseline follows it and nothing is recorded. `ctx` fields ride on each entry (the lab's
 * `tape` index). `tickOf` is the derivation — a unit test's mutant seam; the lab never passes it.
 */
export function createHitRecorder({ atArrival = null, tickOf = hitTickOf } = {}) {
    let prev = typeof atArrival === 'number' ? atArrival : null;
    let prevDead = null;
    const hits = [];
    function observe(s, ctx = {}) {
        if (!s || typeof s.hits !== 'number') return [];
        const dead = typeof s.dead_frames === 'number' ? s.dead_frames : null;
        const deadRise = prevDead !== null && dead !== null ? dead - prevDead : 0;
        prevDead = dead ?? prevDead;
        const before = prev;
        prev = s.hits;
        if (before === null || s.hits <= before) return [];
        const c = statusClock(s);
        const timer = typeof s.hits_timer === 'number' ? s.hits_timer : 0;
        let why = null;
        if (!c) why = 'no clock on the status';
        else if (timer <= 0) why = 'hits_timer read 0 (the read came >= 20 frames late)';
        else if (deadRise > 0) why = `dead_frames rose by ${deadRise} since the previous read`;
        else if (c.clock === 'tape' && s.armed === false) why = 'the tape was not armed at the read';
        const t = tickOf(s);
        const e = { t, hits: s.hits, d: s.hits - before, hits_timer: timer, x: s.x ?? null, y: s.y ?? null,
            // ⛓ ARRIVAL LATCH (§5.124) — the game's clock at the read (the latch's frames step no tape tick)
            ...(typeof s.game_time === 'number' ? { gt: s.game_time } : {}),
            clock: c?.clock ?? null, tick: c?.tick ?? null, exact: why === null, ...(why ? { why } : {}), ...ctx };
        hits.push(e);
        return [e];
    }
    return { observe, get hits() { return hits.slice(); } };
}

/** A row's game hits: the `roomHits.hits` array, or null when the row predates it (UNKNOWN — never 0). */
export function hitsOfRow(row) {
    const h = row?.roomHits?.hits;
    return Array.isArray(h) ? h : null;
}

/**
 * ⛓ ARRIVAL LATCH (§5.124) — a hold-tape hit against the model stepping its arrival staging (see the head):
 * `{billed: {t, source, id, arrival: true}, row}` when a model hit, carried to the read, is the game's read field for
 * field; else `{billed: null, why}`. A hit with no `arrival` record is not asked (null).
 */
export function arrivalLatchVerdict(hit) {
    const a = hit?.arrival;
    if (!a) return null;
    if (a.error) return { billed: null, why: `the model could not step the arrival: ${a.error}` };
    const timer = typeof hit.hits_timer === 'number' ? hit.hits_timer : 0;
    if (timer <= 0) return { billed: null, why: 'hits_timer read 0 (the hit\'s frame is not fixed)' };
    const since = HITS_TIMER_MAX - 1 - timer;
    const near = [];
    for (const b of a.billed ?? []) {
        const row = a.rows?.[b.t - 1 + since];
        if (!row) { near.push(`${b.t}:${b.source ?? '?'} past the ${a.rows?.length ?? 0} stepped frames`); continue; }
        if (row.x === hit.x && row.y === hit.y && row.hitsTimer === timer) {
            return { billed: { t: b.t, source: b.source ?? null, id: b.id ?? null, arrival: true }, row: b.t + since };
        }
        near.push(`${b.t}:${b.source ?? '?'} reads (${row.x},${row.y}) hitsTimer ${row.hitsTimer}`);
    }
    return { billed: null, why: `the model's arrival bills ${a.billed?.length ?? 0} hit(s) in ${a.rows?.length ?? 0} frames`
        + `${near.length ? `, none the game's read (${hit.x},${hit.y}) hitsTimer ${timer}: ${near.join('; ')}` : ''}` };
}

/**
 * A row's billed hits: every plan's `forcedHits[].billed[]` (model ledger rows, `t` on the plan's run clock), and
 * ⛓ ARRIVAL LATCH (§5.124) each hold-tape hit the model's arrival bills (`arrival: true`).
 */
export function billedOfRow(row) {
    const planned = (row?.plans ?? []).flatMap((p) => (p.forcedHits ?? []).flatMap((f) => f.billed ?? []));
    const latch = (hitsOfRow(row) ?? []).map((h) => arrivalLatchVerdict(h)?.billed).filter(Boolean);
    return [...planned, ...latch];
}

/** The plans' refusals of kind `UNBILLED_GATE_KIND` (their `obstacle`, as the lab copies it). */
export function unbilledGateRefusalsOf(row) {
    return (row?.plans ?? []).filter((p) => p.obstacle?.kind === UNBILLED_GATE_KIND).map((p) => p.obstacle);
}

/**
 * A row's unbilled-hit verdict: the game's hits vs the billed ones vs the first divergence. `relation` (when the
 * row has hits and a divergence on the same tape) is `is-divergence` (a hit's `t` = the divergence's), `before`
 * (every same-tape hit precedes it), `after` (the hit follows the divergence: a consequence, not the cause).
 */
export function unbilledHitOfRow(row) {
    const hits = hitsOfRow(row);
    const billed = billedOfRow(row);
    const div = (row?.divs ?? [])[0] ?? null;
    const gate = unbilledGateRefusalsOf(row);
    if (!hits) return { known: false, billed: billed.length, gate: gate.length, div: div?.t ?? null };
    const taken = hits.reduce((n, h) => n + (h.d ?? 1), 0);
    const unbilled = Math.max(0, taken - billed.length);
    let relation = null;
    if (div && hits.length) {
        const same = hits.filter((h) => div.tape === undefined || h.tape === undefined || h.tape === div.tape);
        const ts = same.map((h) => h.t).filter((t) => typeof t === 'number');
        if (ts.includes(div.t)) relation = 'is-divergence';
        else if (ts.length && ts.every((t) => t < div.t)) relation = 'before';
        else if (ts.length && ts.every((t) => t > div.t)) relation = 'after';
        else if (ts.length) relation = 'mixed';
        else if (same.length) relation = 'inexact';
        else relation = 'other-tape';
    }
    return { known: true, taken, billed: billed.length, unbilled, div: div?.t ?? null, divTape: div?.tape ?? null,
        relation, gate: gate.length, hits };
}

/** The merge's per-leg line for a row with an unbilled hit (or an unknown one); null for a clean known row. */
export function unbilledHitLine(row) {
    const v = unbilledHitOfRow(row);
    const name = `${row?.id ?? '?'} ${row?.key ?? ''}`.trim();
    const gate = v.gate ? ` gate=${UNBILLED_GATE_KIND}x${v.gate}` : '';
    if (!v.known) return null;
    if (!v.unbilled && !v.gate) return null;
    const hs = v.hits.map((h) => `${h.tape !== undefined ? `tape${h.tape}:` : ''}${h.t ?? `<=${h.tick}`}${h.exact ? '' : '~'}`
        + `@${h.x},${h.y}`).join(' ');
    const billed = billedOfRow(row).map((b) => `${b.arrival ? 'arrival' : ''}${b.t}:${b.source ?? '?'}`).join(' ') || '-';
    // ⛓ ARRIVAL LATCH (§5.124) — a hold-tape hit the model's arrival did NOT bill says why
    const latchWhy = v.hits.map((h) => arrivalLatchVerdict(h)).filter((x) => x && !x.billed).map((x) => x.why);
    return `UNBILLED-HIT: ${name} hits=[${hs}] billed=[${billed}] div=${v.div === null ? '-' : `${v.divTape !== null ? `tape${v.divTape}:` : ''}${v.div}`}`
        + `${v.relation ? ` relation=${v.relation}` : ''}${gate}${latchWhy.length ? ` arrival=[${latchWhy.join(' | ')}]` : ''}`;
}

/**
 * The merge's census: rows with an unknown hit record (rows that SERVED — a `roomHits` — with no `hits` array: from
 * before S5-2), rows with unbilled hits, the gate's refusals. A row that never served (skipped, hung, unresolved)
 * carries no hit claim at all and is not counted; with nothing to say the census prints nothing, so a merge of
 * clean rows prints exactly today's lines.
 */
export function unbilledHitCensus(rows) {
    const lines = [];
    const unknown = [];
    let gate = 0;
    for (const r of rows) {
        if (!r?.roomHits && !unbilledGateRefusalsOf(r).length) continue;
        const v = unbilledHitOfRow(r);
        gate += v.gate;
        if (!v.known) { unknown.push(r.id); continue; }
        const l = unbilledHitLine(r);
        if (l) lines.push(l);
    }
    if (unknown.length) lines.push(`UNBILLED-HIT-UNKNOWN: ${unknown.length} row(s) carry no hit ticks (rows from before S5-2): ids ${unknown.join(',')}`);
    if (gate) lines.push(`UNBILLED-GATE: ${gate} refusal(s) of kind ${UNBILLED_GATE_KIND}`);
    // ⛓ ARRIVAL LATCH (§5.124) — every hold-tape hit the model's arrival bills is RECLASSIFIED (no longer UNBILLED): a check
    // whose answer removes a line must be loud, so each one prints its own line (the leg, the game's frame, the model
    // tick and row it matched) and the count is its own bucket (`arrival-latch-billed: N`), never folded into "billed".
    const latch = rows.flatMap((r) => (hitsOfRow(r) ?? []).map((h) => ({ h, v: arrivalLatchVerdict(h) }))
        .filter(({ v }) => v?.billed).map(({ h, v }) => `ARRIVAL-LATCH-BILLED: ${`${r.id ?? '?'} ${r.key ?? ''}`.trim()} `
            + `game read gt=${h.gt ?? '?'} hits_timer=${h.hits_timer} @${h.x},${h.y} (tape${h.tape ?? '?'}) = model tick ${v.billed.t} `
            + `(row ${v.row}, staged seam ${h.arrival?.seamTime ?? '?'}): ${v.billed.source ?? '?'} ${v.billed.id ?? ''}`.trim()));
    if (latch.length) lines.push(...latch, `arrival-latch-billed: ${latch.length}`);
    return { lines, unknown };
}
