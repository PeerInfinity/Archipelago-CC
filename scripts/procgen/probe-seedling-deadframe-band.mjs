#!/usr/bin/env node
/**
 * probe-seedling-deadframe-band — what SHAPE should the dead-frame
 * residue band have, and does the new shape still CATCH what the old one
 * caught?
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 12 step 0.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.85 / §24.9.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────
 *
 * `verify-seedling-bot-differential`'s dead-frame budget compares
 *
 *     residue = dead_frames − modelled
 *
 * against `[loads * 17, loads * 24]`, a LINEAR band whose ends are the
 * min and max per-load fade anyone had seen. §24.85 measured what is
 * wrong with that from both directions at once:
 *
 *   · the FLOOR has zero margin — the smallest observation IS the floor,
 *     so `transition-west-return` reporting 50 against a floor of 51 was
 *     a flake, not a defect (four solo re-runs gave 56);
 *   · and the obvious fix is wrong, because the band's WIDTH grows
 *     linearly in `loads`. On `r3-walk-full` (53 loads) a spurious
 *     150-frame ceremony lands at 857 against a floor of 901 — caught
 *     only because 53 * 17 is still close to 53 * 19.31. Loosen the
 *     per-load floor to admit 50/3 = 16.67 and the same tape admits a
 *     residue 150 frames wrong.
 *
 * A sum of N per-load fades does not spread linearly in N — it spreads as
 * √N. So the shape that fixes the floor without destroying the detection
 * is `mean * N ± c * σ * √N`, and this probe is where that is DERIVED and
 * CHECKED rather than tuned until the sweep goes green.
 *
 * ── THE TWO SIDES, AND WHY BOTH ARE NEEDED ────────────────────────────
 *
 * A band fitted to observations and then validated against the same
 * observations proves only that the fit converged. So the probe asks two
 * different questions:
 *
 *   ADMITS   every one of the 79 tapes' RECORDED residues is inside the
 *            band. (The old band's own claim — reproduced, so a
 *            regression is visible.)
 *   CATCHES  an INJECTED defect of ±`CEREMONY_DEAD_FRAMES.pickup` — the
 *            smallest freeze the model can get wrong — is outside the
 *            band, per tape, on both signs. This is the question the
 *            budget exists to answer and it is not the question the fit
 *            was made from.
 *
 * ⛔ AND IT DOES NOT RUN THE GAME. `dead_frames` is the GAME's number and
 * a full `--win` sweep is ~2.5 hours; the sweep already banks every
 * tape's `{stream, status}` under `test-results/seedling-differential/
 * payloads/<fingerprint>/`, so the game side is read from there and only
 * the MODEL side is recomputed here. ⚠ That directory is gitignored and
 * this slice found it is the ONLY copy of the numbers §24.85 quoted — so
 * `--bank` writes the derived per-load observations to a committed JSON
 * beside the module, and the band's derivation stops depending on a
 * temp directory surviving.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-deadframe-band.mjs
 *   node scripts/procgen/probe-seedling-deadframe-band.mjs --payloads=<dir>
 *   node scripts/procgen/probe-seedling-deadframe-band.mjs --bank
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE_DIR = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { loadTape } = await import(join(MODULE_DIR, 'fixtures/index.js'));
const { atlasLevelSource } = await import(join(MODULE_DIR, 'levelSource.js'));
const { runTape } = await import(join(MODULE_DIR, 'tapeRunner.js'));
const { CEREMONY_DEAD_FRAMES } = await import(join(MODULE_DIR, 'sealCeremony.js'));
const { MODEL_EXEMPT } = await import(join(MODULE_DIR, 'r5Chain.js'));
const {
    FADE_STATS, LEGACY_FADE_PER_LOAD, MAX_HALF_WIDTH, SPREAD_PER_SQRT_LOAD,
    fadeBand, legacyFadeBand,
} = await import(join(MODULE_DIR, 'deadFrameBand.js'));

const arg = (flag) => {
    const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
    return hit ? hit.slice(flag.length + 1) : null;
};
const BANK = process.argv.includes('--bank');
const BANK_PATH = join(MODULE_DIR, 'fixtures', 'dead-frame-observations.json');

/**
 * The sweep's banked game side. Newest payload directory with the most
 * tapes in it wins — a fingerprint changes on every model edit, so the
 * directory name is not something a caller can be expected to know.
 */
function findPayloadDir() {
    const explicit = arg('--payloads');
    if (explicit) return explicit;
    const root = join(REPO, 'test-results', 'seedling-differential', 'payloads');
    if (!existsSync(root)) return null;
    const dirs = readdirSync(root)
        .map((d) => ({ d, n: readdirSync(join(root, d)).filter((f) => f.endsWith('.json')).length }))
        .filter((e) => e.n > 0)
        .sort((a, b) => b.n - a.n);
    return dirs.length ? join(root, dirs[0].d) : null;
}

/**
 * The MODEL side of the budget, term for term as the verifier computes
 * it. ⚠ Deliberately duplicated arithmetic — if this drifts from the
 * verifier the probe stops describing the gate, so the terms are named
 * identically and both read the same banked constants.
 */
function modelledFrames(name, tape) {
    const expected = runTape(tape, { levelSource: atlasLevelSource() });
    const sealFrames = (expected.sealCollections ?? [])
        .reduce((n, c) => n + (c.deadFrames ?? 0), 0);
    const pickupFrames = (expected.collected ?? []).length * CEREMONY_DEAD_FRAMES.pickup;
    const exempt = MODEL_EXEMPT[name] ?? null;
    const spawnedFrames = (exempt?.earned ?? []).length * CEREMONY_DEAD_FRAMES.pickup;
    const declaredFreeze = exempt?.freezeFrames ?? 0;
    return (expected.frozenFramesOwed ?? 0)
        + sealFrames + pickupFrames + spawnedFrames + declaredFreeze;
}

const payloadDir = findPayloadDir();
if (!payloadDir || !existsSync(payloadDir)) {
    console.log('SKIP: no banked sweep payloads found under '
        + 'test-results/seedling-differential/payloads/ — run the differential '
        + 'sweep first (its payloads are what the game side is read from), or '
        + 'pass --payloads=<dir>');
    process.exit(0);
}
console.log(`payloads: ${payloadDir}`);

const rows = [];
for (const file of readdirSync(payloadDir).filter((f) => f.endsWith('.json')).sort()) {
    const name = file.slice(0, -'.json'.length);
    const { stream, status } = JSON.parse(readFileSync(join(payloadDir, file), 'utf8'));
    if (typeof status?.dead_frames !== 'number') continue;
    let modelled;
    try {
        modelled = modelledFrames(name, loadTape(name));
    } catch (e) {
        console.log(`SKIP ${name}: the model does not run this tape — ${e.message}`);
        continue;
    }
    const loads = stream.transitions.length + 1;
    const residue = status.dead_frames - modelled;
    rows.push({ name, loads, dead: status.dead_frames, modelled, residue, perLoad: residue / loads });
}

if (!rows.length) {
    console.log('SKIP: no usable payloads');
    process.exit(0);
}

// ── the observations ──────────────────────────────────────────────────
const totalLoads = rows.reduce((n, r) => n + r.loads, 0);
const perLoad = rows.map((r) => r.perLoad);
const min = Math.min(...perLoad);
const max = Math.max(...perLoad);
/**
 * ⚠ WEIGHTED BY LOADS, not a mean of per-tape means. The quantity being
 * estimated is "what one load costs", and a 53-load tape is 53
 * observations of it while a 1-load tape is one. An unweighted mean would
 * let the roster's many short tapes outvote its few long ones about a
 * constant that only the long ones can measure precisely.
 */
const mean = rows.reduce((n, r) => n + r.residue, 0) / totalLoads;
/** Per-load deviation, weighted the same way. */
const variance = rows.reduce((n, r) => n + r.loads * (r.perLoad - mean) ** 2, 0) / totalLoads;
const sigma = Math.sqrt(variance);

console.log(`\n${rows.length} tapes / ${totalLoads} loads`);
console.log(`per-load fade: min ${min.toFixed(2)} max ${max.toFixed(2)} `
    + `mean ${mean.toFixed(2)} sigma ${sigma.toFixed(2)}`);
console.log(`module declares: mean ${FADE_STATS.mean} sigma ${FADE_STATS.sigma} over `
    + `${FADE_STATS.tapes} tapes / ${FADE_STATS.loads} loads; half-width `
    + `${SPREAD_PER_SQRT_LOAD}·√N capped at ${MAX_HALF_WIDTH}`);
// ⛔ The module's banked stats must BE these observations, not a nearby
// remembered number — §24.85's mean was 19.31 against the 19.13 the sweep
// it quoted actually says. A drift here is the same defect recurring.
const drift = Math.abs(FADE_STATS.mean - mean) > 0.005 || Math.abs(FADE_STATS.sigma - sigma) > 0.005
    || FADE_STATS.tapes !== rows.length || FADE_STATS.loads !== totalLoads;
if (drift) {
    console.log('⛔ FADE_STATS DOES NOT MATCH THESE OBSERVATIONS — the module\'s banked '
        + 'numbers were derived from a different sweep. Re-derive them before trusting '
        + 'the band below.');
}

// ── side 1: ADMITS ────────────────────────────────────────────────────
let admitFails = 0;
let legacyAdmitFails = 0;
for (const r of rows) {
    const b = fadeBand(r.loads);
    const l = legacyFadeBand(r.loads);
    const ok = r.residue >= b.lo && r.residue <= b.hi;
    const legacyOk = r.residue >= l.lo && r.residue <= l.hi;
    if (!ok) admitFails++;
    if (!legacyOk) legacyAdmitFails++;
    if (!ok || !legacyOk) {
        console.log(`  ${ok ? '   ' : '⛔ '}${r.name}: residue ${r.residue} over ${r.loads} load(s) `
            + `= ${r.perLoad.toFixed(2)}/load — band [${b.lo.toFixed(1)},${b.hi.toFixed(1)}]`
            + `${legacyOk ? '' : `, LEGACY [${l.lo},${l.hi}] rejects it`}`);
    }
}
console.log(`\nADMITS: ${rows.length - admitFails}/${rows.length} recorded residues inside the `
    + `new band (legacy: ${rows.length - legacyAdmitFails}/${rows.length})`);

// ── side 2: CATCHES ───────────────────────────────────────────────────
//
// The smallest freeze the model can get wrong is one ordinary pickup
// ceremony. Inject it in BOTH directions per tape — a ceremony the model
// claims and the game never ran (residue too LOW, the floor's job) and one
// the game ran and the model missed (residue too HIGH, the ceiling's job)
// — and require the band to reject both.
const DEFECT = CEREMONY_DEAD_FRAMES.pickup;
let missLow = 0;
let missHigh = 0;
let legacyMissLow = 0;
let legacyMissHigh = 0;
for (const r of rows) {
    const b = fadeBand(r.loads);
    const l = legacyFadeBand(r.loads);
    const low = r.residue - DEFECT;
    const high = r.residue + DEFECT;
    if (low >= b.lo) { missLow++; console.log(`  ⛔ ${r.name}: a spurious ${DEFECT}-frame ceremony `
        + `(${low}) is ADMITTED at [${b.lo.toFixed(1)},${b.hi.toFixed(1)}]`); }
    if (high <= b.hi) { missHigh++; console.log(`  ⛔ ${r.name}: a MISSED ${DEFECT}-frame freeze `
        + `(${high}) is ADMITTED at [${b.lo.toFixed(1)},${b.hi.toFixed(1)}]`); }
    // ⛓ NAMED, not counted. "The legacy band misses 5" is a number; "it
    // misses a MISSED freeze on the four longest tapes on the roster" is
    // the finding — its ceiling is 24/load and the fade is 19, so the
    // slack grows 5 frames per load and passes 150 at 30 loads.
    if (low >= l.lo) {
        legacyMissLow++;
        console.log(`  legacy MISSES a spurious ${DEFECT} on ${r.name} `
            + `(${low} inside [${l.lo},${l.hi}], ${r.loads} loads)`);
    }
    if (high <= l.hi) {
        legacyMissHigh++;
        console.log(`  legacy MISSES a missed ${DEFECT} on ${r.name} `
            + `(${high} inside [${l.lo},${l.hi}], ${r.loads} loads)`);
    }
}
console.log(`\nCATCHES: a spurious ${DEFECT}-frame ceremony is caught on `
    + `${rows.length - missLow}/${rows.length} tapes (legacy ${rows.length - legacyMissLow}), `
    + `a missed one on ${rows.length - missHigh}/${rows.length} (legacy `
    + `${rows.length - legacyMissHigh})`);

// ── the named case from §24.85, asserted by name ──────────────────────
const named = rows.find((r) => r.name === 'r3-walk-full');
if (named) {
    const b = fadeBand(named.loads);
    const l = legacyFadeBand(named.loads);
    const spurious = named.residue - DEFECT;
    console.log(`\n§24.85's named case — r3-walk-full, ${named.loads} loads:`);
    console.log(`  recorded residue ${named.residue}; a spurious ${DEFECT} lands at ${spurious}`);
    console.log(`  legacy [${l.lo},${l.hi}]  → recorded ${named.residue >= l.lo && named.residue <= l.hi
        ? 'ADMITTED' : 'REJECTED'}, spurious ${spurious < l.lo ? 'CAUGHT' : 'ADMITTED ⛔'}`);
    console.log(`  new    [${b.lo.toFixed(1)},${b.hi.toFixed(1)}] → recorded `
        + `${named.residue >= b.lo && named.residue <= b.hi ? 'ADMITTED' : 'REJECTED ⛔'}, `
        + `spurious ${spurious < b.lo ? 'CAUGHT' : 'ADMITTED ⛔'}`);
}
const flake = rows.find((r) => r.name === 'transition-west-return');
if (flake) {
    const b = fadeBand(flake.loads);
    console.log(`\n§24.85's flake — transition-west-return, ${flake.loads} load(s):`);
    console.log(`  recorded residue ${flake.residue}; the flaking run reported 50`);
    console.log(`  legacy [${LEGACY_FADE_PER_LOAD.min * flake.loads},`
        + `${LEGACY_FADE_PER_LOAD.max * flake.loads}] → 50 `
        + `${50 < LEGACY_FADE_PER_LOAD.min * flake.loads ? 'REJECTED (the flake)' : 'admitted'}`);
    console.log(`  new    [${b.lo.toFixed(1)},${b.hi.toFixed(1)}] → 50 `
        + `${50 >= b.lo && 50 <= b.hi ? 'ADMITTED (the flake stops flaking)' : 'REJECTED ⛔'}`);
}

if (BANK) {
    const payload = {
        _comment: 'Derived by scripts/procgen/probe-seedling-deadframe-band.mjs from the '
            + 'differential sweep\'s banked payloads. The per-load fade is the GAME\'s '
            + 'number minus the model\'s own freezes; this file is the committed copy '
            + 'because the payload directory is gitignored and was, at slice 12, the only '
            + 'copy of the numbers §24.85 quoted.',
        totalTapes: rows.length,
        totalLoads,
        min,
        max,
        mean,
        sigma,
        observations: rows.map((r) => ({
            name: r.name, loads: r.loads, dead: r.dead, modelled: r.modelled, residue: r.residue,
        })),
    };
    mkdirSync(dirname(BANK_PATH), { recursive: true });
    writeFileSync(BANK_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nbanked → ${BANK_PATH}`);
}

const bad = admitFails + missLow + missHigh + (drift ? 1 : 0);
console.log(bad === 0
    ? '\nPASS: the band admits every recorded residue and catches every injected defect'
    : `\nFAIL: ${admitFails} admit failure(s), ${missLow + missHigh} missed injection(s)`);
process.exit(bad === 0 ? 0 : 1);
