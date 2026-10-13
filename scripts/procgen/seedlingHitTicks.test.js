/**
 * S5-2 HIT TICKS — `seedlingHitTicks.js`: a rise of the game's `hits` lands on the drained row that first carries it,
 * however late the 25 ms sampler reads it; a merge of old + new rows names the unknowns (never 0); and a mutant that
 * takes the tick from the WALL clock is red by name.
 *
 * The game is simulated in `Bot`'s frame order (`Bot.as:3234,3335` + `playerDamage.js`' tick order): record row
 * `tick`, `tick++`, the enemies' `Player.hit` (`hits += 1`, `hitsTimer = 20`), then `hitUpdate` (`hitsTimer--`).
 * The row that first carries a hit taken in the frame that recorded row k is k + 1 (the model ledger's `t`).
 */
import { describe, it, expect } from 'vitest';
import { createHitRecorder, hitTickOf, HITS_TIMER_MAX, UNBILLED_GATE_KIND, unbilledHitOfRow, unbilledHitCensus, unbilledHitLine }
    from './seedlingHitTicks.js';
import { mergeVerdict } from './seedlingDivergenceMerge.js';

const FRAME_MS = 1000 / 60;

/** A game that takes a hit in each frame of `hitFrames`; `frozen` frames run `hitUpdate` but no `tick++`. */
function simulateGame({ hitFrames, frozen = new Set(), frames = 200 }) {
    const g = { tick: 0, hits: 0, hits_timer: 0, dead_frames: 0, armed: true, x: 0, y: 0 };
    const snaps = []; // the status after each frame, at its wall time
    const firstRowWithHit = [];
    for (let f = 0; f < frames; f++) {
        if (frozen.has(f)) {
            g.dead_frames += 1;
        } else {
            const k = g.tick; // RECORD row k, then act
            g.tick += 1;
            if (hitFrames.includes(k)) { g.hits += 1; g.hits_timer = HITS_TIMER_MAX; g.x = k; firstRowWithHit.push(k + 1); }
        }
        if (g.hits_timer > 0) g.hits_timer -= 1; // hitUpdate runs outside the freeze
        snaps.push({ wall: (f + 1) * FRAME_MS, status: { ...g } });
    }
    return { snaps, firstRowWithHit };
}

/** Read the status every `everyMs` (with `stalls`: wall windows the sampler is starved through). */
function sample(snaps, { everyMs = 25, stalls = [], tickOf } = {}) {
    const rec = createHitRecorder({ atArrival: 0, ...(tickOf ? { tickOf: (s) => tickOf(s, now) } : {}) });
    let now = 0;
    const end = snaps.at(-1).wall;
    for (now = everyMs; now <= end; now += everyMs) {
        if (stalls.some(([a, b]) => now > a && now < b)) continue;
        const at = now;
        const snap = [...snaps].reverse().find((s) => s.wall <= at);
        if (snap) rec.observe(snap.status, { tape: 0 });
    }
    return rec.hits;
}

/** The named check: every exact entry's `t` is the first drained row carrying its hit. */
function hitTicksAgainstRows(entries, firstRowWithHit) {
    const bad = [];
    entries.forEach((e, i) => {
        if (e.exact && e.t !== firstRowWithHit[i]) bad.push(`hit ${i + 1}: t=${e.t}, the first row carrying it is ${firstRowWithHit[i]}`);
    });
    if (entries.length !== firstRowWithHit.length) bad.push(`${entries.length} entries for ${firstRowWithHit.length} hits`);
    return bad;
}

describe('S5-2 hit ticks — the recorder', () => {
    it('one increment records ONE entry at the first row carrying the hit, whenever the sampler reads it', () => {
        const { snaps, firstRowWithHit } = simulateGame({ hitFrames: [37, 81, 140] });
        const hits = sample(snaps, { stalls: [[1400, 1700]] }); // starved ~18 frames over the second hit
        expect(hits.map((h) => h.t)).toEqual(firstRowWithHit);
        expect(hits.every((h) => h.exact && h.d === 1 && h.clock === 'tape' && h.tape === 0)).toBe(true);
        expect(hitTicksAgainstRows(hits, firstRowWithHit)).toEqual([]);
    });

    it('the formula on the hit frame itself: {tick: k + 1, hits_timer: 19} → t = k + 1', () => {
        expect(hitTickOf({ tick: 38, hits_timer: HITS_TIMER_MAX - 1 })).toBe(38);
        expect(hitTickOf({ runtime: 'js', ticks: 500, hits_timer: 10 })).toBe(491);
        expect(hitTickOf({ tick: 38, hits_timer: 0 })).toBeNull();
    });

    it('a read >= 20 frames late is NOT exact (t null, the tick an upper bound); a frozen frame between reads is named', () => {
        const late = sample(simulateGame({ hitFrames: [37] }).snaps, { stalls: [[600, 1100]] });
        expect(late).toHaveLength(1);
        expect(late[0]).toMatchObject({ t: null, exact: false });
        expect(late[0].why).toMatch(/hits_timer read 0/);
        const fr = sample(simulateGame({ hitFrames: [37], frozen: new Set([39, 40]) }).snaps, { everyMs: 100 });
        expect(fr[0].exact).toBe(false);
        expect(fr[0].why).toMatch(/dead_frames rose by/);
    });

    it('a fall of hits (a new Player) moves the baseline and records nothing', () => {
        const rec = createHitRecorder({ atArrival: 2 });
        expect(rec.observe({ tick: 5, hits: 0, hits_timer: 0 })).toEqual([]);
        expect(rec.observe({ tick: 9, hits: 1, hits_timer: 18, x: 3, y: 4 })).toMatchObject([{ t: 8, d: 1, x: 3, y: 4 }]);
    });

    it('⛔ MUTANT — the tick taken from the WALL clock is red by name', () => {
        const { snaps, firstRowWithHit } = simulateGame({ hitFrames: [37, 81, 140] });
        const wallTick = (s, now) => Math.floor(now / FRAME_MS); // frames elapsed by the wall clock at the read
        const hits = sample(snaps, { stalls: [[1400, 1700]], tickOf: wallTick });
        const bad = hitTicksAgainstRows(hits, firstRowWithHit);
        expect(bad.length).toBeGreaterThan(0);
        expect(bad.join('\n')).toMatch(/the first row carrying it is/);
    });
});

describe('S5-2 hit ticks — the merge', () => {
    const plan = { legs: 3, shards: [{ shard: 1, ids: [1, 2, 3] }] };
    const old = { id: 1, key: 'level_12 <- old', end: 'done', roomHits: { atArrival: 0, max: 1, samples: 40 } };
    const hitIsDiv = { id: 2, key: 'level_22 <- in_L25_144_32 -> exit:out_teleporter_192_64', end: 'diverged',
        roomHits: { atArrival: 0, max: 1, samples: 40, hits: [{ t: 57, hits: 1, d: 1, x: 100, y: 64, exact: true, tape: 0 }] },
        plans: [{ ok: true }], divs: [{ t: 57, tape: 0 }] };
    const gated = { id: 3, key: 'level_75 <- k', end: 'refused', roomHits: { atArrival: 0, max: 0, samples: 3, hits: [] },
        plans: [{ ok: false, obstacle: { kind: UNBILLED_GATE_KIND, hits: 1 } }] };

    it('an old row (no hits array) is UNKNOWN, never 0 — and the census names it', () => {
        expect(unbilledHitOfRow(old).known).toBe(false);
        expect(unbilledHitLine(old)).toBeNull();
        const { lines, unknown } = unbilledHitCensus([old, hitIsDiv]);
        expect(unknown).toEqual([1]);
        expect(lines).toContain('UNBILLED-HIT-UNKNOWN: 1 row(s) carry no hit ticks (rows from before S5-2): ids 1');
    });

    it('a hit at the divergence tick on the same tape IS the divergence; a billed hit is not unbilled', () => {
        expect(unbilledHitOfRow(hitIsDiv)).toMatchObject({ known: true, taken: 1, billed: 0, unbilled: 1, relation: 'is-divergence' });
        const billed = { ...hitIsDiv, plans: [{ ok: true, forcedHits: [{ billed: [{ t: 57, source: 'Spike' }] }] }] };
        expect(unbilledHitOfRow(billed).unbilled).toBe(0);
        const elsewhere = { ...hitIsDiv, divs: [{ t: 57, tape: 1 }] };
        expect(unbilledHitOfRow(elsewhere).relation).toBe('other-tape');
    });

    it('the merge prints the per-leg line, the unknowns and the gate bucket — and none of it fails the merge', () => {
        const v = mergeVerdict({ rows: [old, hitIsDiv, gated], plan });
        expect(v.failed).toBe(false);
        expect(v.lines).toContain('UNBILLED-HIT: 2 level_22 <- in_L25_144_32 -> exit:out_teleporter_192_64 '
            + 'hits=[tape0:57@100,64] billed=[-] div=tape0:57 relation=is-divergence');
        expect(v.lines.some((l) => l.startsWith('UNBILLED-HIT: 3 ') && l.includes(`gate=${UNBILLED_GATE_KIND}x1`))).toBe(true);
        expect(v.lines).toContain(`UNBILLED-GATE: 1 refusal(s) of kind ${UNBILLED_GATE_KIND}`);
        expect(v.lines.some((l) => l.startsWith('UNBILLED-HIT-UNKNOWN: 1 '))).toBe(true);
    });
});

describe('S5-2 hit ticks — defaults', () => {
    it('clean rows (hits known, none unbilled) and rows that never served add no merge line', () => {
        const clean = { id: 1, end: 'done', roomHits: { atArrival: 0, max: 0, samples: 9, hits: [] } };
        const skipped = { id: 2, end: 'skipped' };
        expect(unbilledHitCensus([clean, skipped]).lines).toEqual([]);
    });
});
