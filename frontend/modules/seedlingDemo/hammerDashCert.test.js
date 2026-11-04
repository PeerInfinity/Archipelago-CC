/**
 * seedlingDemo/hammerDashCert.test — ⛓ SEEDLING HAMMER-PHASE DASHCERT (`seedling-hammer-dashcert`; ⚖ the user queued it
 * 2026-11-02, planner `seedling-hammer-phase-planning-2`). Report: `CC/docs/cloud-reports/seedling-hammer-dashcert.md`.
 *
 * THE GAP (fidelity L100LATTICE's hand-over (a)). With fidelity's `fineStanceWalk` ON, survey step 216 (L100 → L101)
 * walks its break stance on a fine 8 px corridor that `spinnerDashWhole` certifies whole, and the drive is hit by
 * `jellyfish@80,112` at t125 (game-witnessed; UNBILLED DAMAGE under `unbilledDamageGate`). The preview and the drive
 * part at t82, and the cause is 34 ticks earlier: the t48 press reaches `jellyfish@80,16` in the rect and the reach on
 * t49 and t50, and the RUN refuses both on `slash()`'s line of sight (`collideLine("Solid")` meets `tile:Cliff`; MASKS
 * D2's `pixelMaskSightLines`), landing it at t51. `previewWalk`'s chaser arm asks no line, so the preview lands it at
 * t50. The body's i-frame then runs two ticks apart, the t81 scheduled dash is certified in the preview and yielded by
 * the drive's own `certifyDash` (the i-frame expires mid-dash), and the two walks are different walks.
 *
 * THE FIX (`DASH_CERT_SIGHT`, OFF): inside `spinnerDashWhole`, every preview asks the run's own line before a swing lands
 * on a chaser. ON, step 216 is certified on the walk the drive takes: 327 t, hitless, L101 — the game agrees at every
 * tick (`fixtures/dashcert-witness/step216-on.json`).
 *
 * ── THE MUTATION LIST (each row's catcher named) ──
 *   m1 the old certificate restored (`spinnerDashWhole` ON does not raise `dashCertSightDepth`)
 *        → 'ON: step 216 …' red (UNBILLED DAMAGE; measured: 1 red, 3 pass)
 *   m2 the chaser not billed (the whole-chain check's `probeSamples` with each sample's `chasers` set aside)
 *        → NO ROW REDS (measured). No whole-chain preview on the route meets a chaser (the survey's audit ON: 330 of
 *          330 certified), and step 216's certified walk is hitless in the preview and in the game. The billing half
 *          has no catcher here; the report names it as residue.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { DASH_CERT_SIGHT, DEFAULT_DASH_MODE, solveSegment, withDashCertSight } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const W216 = JSON.parse(readFileSync(join(HERE, 'fixtures/dashcert-witness/step216-on.json'), 'utf8'));
/** The witness's tape with its inputs cut: step 216's boot (the survey's own staging). */
const BOOT216 = { ...W216.tape, inputs: [], tick_count: 0 };
/** fidelity's L100LATTICE key: present only on a tree that carries it (its branch, or main after it lands). */
const HAS_FINE_STANCE_WALK = CONTACT_FIDELITY_KEYS.includes('fineStanceWalk');

const runOf = (tape) => createRunForStaging(solveStaging(stagingFromTape(parseTape(tape))), atlasLevelSource());
const keysOf = (perTick) => perTick.map((k) => [...k].sort().join('+'));
/** The tape's per-tick held sets, from its `{key, from, to}` runs. */
const tapeKeys = (tape) => Array.from({ length: tape.tick_count }, (_, t) => tape.inputs
    .filter((i) => i.from <= t && t < i.to).map((i) => i.key).sort().join('+'));
const solve216 = () => {
    const run = runOf(BOOT216);
    try {
        const r = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 288, y: 96 } }], name: 'l100',
            boot: BOOT216.boot, dashMode: DEFAULT_DASH_MODE });
        return { r, run, error: null };
    } catch (e) {
        return { r: null, run, error: e };
    }
};

describe('hammer DASHCERT — the whole-dash certificate sees the swing\'s line of sight (`DASH_CERT_SIGHT`, ON)', () => {
    // ⛓ flipped ON (⚖ the user, 2026-11-03: "Land 2, hold fineStanceWalk": this switch lands without the fine walk)
    it.skipIf(ENV.SEEDLING_DASH_CERT_SIGHT !== undefined)('ships ON', () => {
        expect(DASH_CERT_SIGHT.enabled).toBe(true);
    });

    it('the witness replays on the model: 327 t, 0 hits, L101 — the game\'s own end (p4g, 0 px at every tick)', () => {
        const run = runOf(BOOT216);
        const keys = tapeKeys(W216.tape);
        for (const k of keys) run.advance(new Set(k ? k.split('+') : []));
        expect(run.playerHits.map((h) => h.t)).toEqual(W216.gameHits.map((h) => h.t));
        expect([run.ticksCompleted, run.level]).toEqual([W216.gameEnd.tick, W216.gameEnd.level]);
    }, 60_000);

    it('a corridor whose certificate meets no blocked line is OFF exactly: step 216 at the defaults (no fine walk)', () => {
        // ⚖ fidelity's key OFF (or absent): the 16 px break-stance walk; the certificate is asked and refuses nothing.
        const arm = (on) => withDashCertSight(on, () => (HAS_FINE_STANCE_WALK
            ? withContactFidelity({ fineStanceWalk: false }, solve216) : solve216()));
        const off = arm(false);
        const before = { ...DASH_CERT_SIGHT.counts };
        const on = arm(true);
        expect(DASH_CERT_SIGHT.counts.asks - before.asks).toBeGreaterThan(0);
        expect(DASH_CERT_SIGHT.counts.refused - before.refused).toBe(0);
        expect(on.error?.message ?? null).toBe(off.error?.message ?? null);
        expect(on.r ? keysOf(on.r.perTick) : null).toEqual(off.r ? keysOf(off.r.perTick) : null);
    }, 120_000);

    it.skipIf(!HAS_FINE_STANCE_WALK)('ON: step 216 with fidelity\'s `fineStanceWalk` — certified on the walk the drive '
        + 'takes; OFF the drive is hit (UNBILLED DAMAGE)', () => {
        const arm = (on) => withContactFidelity({ fineStanceWalk: true, unbilledDamageGate: true },
            () => withDashCertSight(on, solve216));
        const off = arm(false);
        expect(off.error?.message ?? '').toMatch(/UNBILLED DAMAGE .*chaser:jellyfish@80,112/);
        const before = { ...DASH_CERT_SIGHT.counts };
        const on = arm(true);
        expect(on.error).toBeNull();
        expect(DASH_CERT_SIGHT.counts.refused - before.refused).toBeGreaterThan(0);
        expect(keysOf(on.r.perTick)).toEqual(tapeKeys(W216.tape));
        expect(on.run.playerHits).toEqual([]);
        expect(on.run.level).toBe(101);
    }, 120_000);
});
