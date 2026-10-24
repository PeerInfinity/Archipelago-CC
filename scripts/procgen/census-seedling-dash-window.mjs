#!/usr/bin/env node
/**
 * census-seedling-dash-window — Seedling fidelity DASH, D4: **WHICH COMMITTED TAPES LEAN ON THE
 * DASH TEST THE GAME DOES NOT RUN?** Model-only; it plays nothing and drives no browser.
 *
 * D1 measured on the game (`probe-seedling-dash-window.mjs`) that a DASH press buys four
 * `Player.slash()` rect tests, where the roster's model (`combatVerbs.SLASH_ANIM_TICKS_LEGACY`,
 * behind `DASH_WINDOW_ROSTER_WIDE`) runs five and drops `slashEnd` a tick late. The two windows
 * differ in exactly two places, and this census replays every committed tape under the roster's
 * model and lists each one:
 *
 *   A  FIFTH TEST   a dash thrust's fifth test (`fired − press = 5`) lands an EFFECTIVE hit —
 *                   a rope pulled, a rock broken, a tree burned, a block or pole moved, a body
 *                   struck or killed, a bridge tile. The game never runs that test. (L16's
 *                   refuted plan: `rope@32,16`, fired 88.)
 *   B  RE-ARM       a sword press exactly five ticks after a dash press. The roster's model still
 *                   has the dash's `slashDashed` up (swallowed, or a different arm); in the game
 *                   `slashEnd` fired the tick before, so the press takes another arm.
 *
 * A tape with neither replays identically under both windows by construction of the press
 * schedule; one with either is a SUSPECT, not a refutation: its stream may still agree (the
 * effect may not reach the trajectory — the 117 t L16 witness pulls its rope on the fifth test
 * too and its stream survives). Every committed tape replays against its recording at both
 * windows (tapeRunner, D2), so a suspect is a place where the RECORDING was blind to the effect.
 *
 * Run:
 *   node scripts/procgen/census-seedling-dash-window.mjs           # the table
 *   node scripts/procgen/census-seedling-dash-window.mjs --json    # the rows as JSON
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** A hit record that changed the world (`levelRun`'s per-arm `hits` rows). */
export function effectiveHit(h) {
    return h.pulled === true || h.broke === true || h.burned === true || h.moved === true
        || h.landed === true || h.killed === true || h.as3 === 'Tile';
}

/** A dash thrust's rect is `slashnarrow`'s 1.5 × 0.65 squash: 24 × 20.8 or 20.8 × 24. */
export const isDashRect = (r) => [r.w, r.h].some((d) => Math.abs(d - 20.8) < 1e-9);

/**
 * One tape's suspects, from the run's own ledgers: `slashPresses` (each press's outcome) and the
 * `presses` ledger (each thrust's rect test, with the press tick `t` and the tick it `fired`).
 */
export function dashWindowSuspects({ slashPresses, presses }, legacyTicks = 5) {
    const dashes = slashPresses.filter((p) => p.outcome === 'dash');
    const fifth = presses.filter((p) => p.weapon === 'sword' && isDashRect(p.rect)
        && p.fired - p.t === legacyTicks && p.hits.some(effectiveHit))
        .map((p) => ({ press: p.t, fired: p.fired, hits: p.hits.filter(effectiveHit).map((h) => h.id ?? h.as3) }));
    const rearm = slashPresses.filter((p) => dashes.some((d) => d.level === p.level && p.t - d.t === legacyTicks))
        .map((p) => ({ press: p.t, outcome: p.outcome }));
    return { dashes: dashes.length, fifth, rearm };
}

if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));
    const { fixtureNames, loadTape } = await M('fixtures/index.js');
    const { parseTape } = await M('tapeFormat.js');
    const { createTapeStepper } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const levelSource = atlasLevelSource();
    const refutedDir = join(HERE, '..', '..', 'frontend/modules/seedlingDemo/fixtures/refuted');
    const sources = [
        ...fixtureNames().map((n) => ({ name: n, tape: () => loadTape(n) })),
        ...readdirSync(refutedDir).filter((f) => f.endsWith('.tape.json')).map((f) => ({
            name: `refuted/${f.replace(/\.tape\.json$/, '')}`,
            tape: () => parseTape(readFileSync(join(refutedDir, f), 'utf8')),
        })),
    ];
    const rows = [];
    for (const s of sources) {
        let run = null;
        let error = null;
        try {
            const st = createTapeStepper(s.tape(), { levelSource, onTick: (t, x, h, rn) => { run = rn; } });
            for (let r = st.next(); !r.done; r = st.next()) { /* to the end */ }
        } catch (e) {
            error = String(e.message).slice(0, 160);
        }
        if (error || !run) { rows.push({ name: s.name, error }); continue; }
        rows.push({ name: s.name, ...dashWindowSuspects({ slashPresses: run.slashPresses, presses: run.ledger('presses') }) });
    }
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 1));
        return;
    }
    const withDash = rows.filter((r) => r.dashes > 0);
    const suspects = withDash.filter((r) => r.fifth.length || r.rearm.length);
    console.log(`census-seedling-dash-window: ${rows.length} tape(s); ${withDash.length} press a dash; `
        + `${suspects.length} suspect(s); ${rows.filter((r) => r.error).length} replay error(s)`);
    for (const r of rows.filter((x) => x.error)) console.log(`  ERROR ${r.name}: ${r.error}`);
    for (const r of withDash) {
        const tag = (r.fifth.length || r.rearm.length) ? 'SUSPECT' : 'clean  ';
        console.log(`  ${tag} ${r.name.padEnd(34)} dashes ${String(r.dashes).padStart(2)}`
            + `${r.fifth.length ? `  A fifth-test hits: ${r.fifth.map((f) => `p${f.press}/f${f.fired} ${f.hits.join('+')}`).join(', ')}` : ''}`
            + `${r.rearm.length ? `  B re-arm presses: ${r.rearm.map((p) => `t${p.press} ${p.outcome}`).join(', ')}` : ''}`);
    }
}
