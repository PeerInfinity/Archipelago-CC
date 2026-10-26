/**
 * ⛓⛓⛓ seedling-fidelity-l40latch (wave 32) — L40 BOSS KEY 2'S S-DOOR LATCH, HELD UNDER `bobsoldier@880,832`.
 *
 * The chain to `bosskey@656,528` (legs 859/860, survey step 67) opens the lock room's south door `wandlock@480,560`
 * {t 3} by latching `buttonroom@880,768` {t 3, room -1}, at the top of the pocket the chest (`chest@880,816`) and the
 * tree (`burnabletree@872,784`) close. Once both are gone, `bobsoldier@880,832` (the pocket's guard, measured by
 * L40CONTACT: it chases inside 80 px, spins at d < 33) walks up the pocket to whoever stands on the latch. The hold
 * verb stood still for the lock's whole fade (131 ticks), and the bobsoldier's sword lands on the still player
 * (L40BK2's hand-over: *"hold tick 84 of 131 MOVED"*; at this slice's staging, tick 93, dead by 133).
 *
 * The staging (`latch-boot.json`) is survey step 67's boot ON the latch with the chest and the tree banked by
 * persistence, past the hammer arc's press kill of `spinner@880,848` (D3 / PKC), so the latch is measured alone.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpseBumpSampleOf, packCorpseBumpSample, unpackCorpseBumpSample } from './fidelityCorpseBump.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const L40LATCH_WITNESS_DIR = join(HERE, 'fixtures', 'l40latch-witness');

/** The leg's goal: `bosskey@656,528`, the `Level 040 - Boss Key 2` location. */
export const L40LATCH_GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 656, y: 528 }) });

/** How long the stand witness stands: the hold's own bound (101-tick fade + slack = 131) and a margin past the death. */
export const L40LATCH_STAND_TICKS = 160;

async function fixture(name) {
    const { readFileSync } = await import('node:fs');
    return JSON.parse(readFileSync(join(L40LATCH_WITNESS_DIR, `${name}.json`), 'utf8'));
}

/** The staging: step 67's boot on the latch, the chest and the tree banked (`fixtures/l40latch-witness/latch-boot.json`). */
export async function l40LatchBoot() {
    return fixture('latch-boot');
}

/** A tape on the latch boot's header from per-tick held sets (each an array of key names). */
export async function l40LatchTape(name, perTick, extra = {}) {
    const { buildTape } = await import('./botDriverV1.js');
    const boot = await l40LatchBoot();
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...boot, name, tick_count: perTick.length, inputs: folded.inputs, ...extra };
}

/** `l40latch-stand`: the latch boot and no input at all — what the bobsoldier does to a still holder. */
export async function l40LatchStandTape() {
    return l40LatchTape('l40latch-stand', Array.from({ length: L40LATCH_STAND_TICKS }, () => []), {
        description: 'seedling-fidelity-l40latch W0: L40 on the latch of buttonroom@880,768 (the chest and the tree '
            + 'banked), standing still — bobsoldier@880,832 walks up the pocket and its sword lands on the holder '
            + '(probe-seedling-l40latch.mjs)',
    });
}

/** D1's switches: the hold's still wait priced (D1a) and the BobSoldier's orbit kill (D1b), every other at its default. */
export const L40LATCH_D1_SWITCHES = Object.freeze({ holdWaitPriced: true, chaserOrbitKill: true });

/**
 * `l40latch-orbit-chain`: the ticks the solver spent from the latch boot with D1's switches ON before its refusal,
 * folded onto the boot's own header (with the refusal's `equips`). Built at record time (the solve is ~70 s).
 */
export async function l40LatchOrbitTape() {
    const boot = await l40LatchBoot();
    const { out, refusal } = await l40LatchSolve(boot, L40LATCH_D1_SWITCHES);
    if (out) throw new Error('l40LatchOrbitTape: the latch solve SOLVED — the witness is the refused prefix; re-derive');
    const tape = await l40LatchTape('l40latch-orbit-chain', refusal.perTick.map((k) => [...k]), {
        refused: refusal.message.slice(0, 600),
        description: 'seedling-fidelity-l40latch D1: L40 on the latch of buttonroom@880,768 (the chest, the tree and '
            + 'spinner@880,848 banked) — the SOLVER\'s own ticks for Boss Key 2 with holdWaitPriced + chaserOrbitKill '
            + 'ON, until it refused: the latch publishes {t 3} on the first tick, the hold\'s priced wait climbs the '
            + 'ladder, bobsoldier@880,832 is killed on the move behind its blade (the orbit arm), spinner@816,848 by the '
            + 'press arm, wandlock@480,560 fades open meanwhile (probe-seedling-l40latch.mjs)',
    });
    return { ...tape, equips: [...(boot.equips ?? []), ...(refusal.equips ?? [])] };
}

/**
 * `solveSegment` for the key from a tick-0 boot tape, under `over`: `{out, refusal}` (a `SolverRefusal` or an
 * executor's `BotDriverV2Error` is returned, anything else thrown). A fresh fork run per try, as the page solves.
 */
export async function l40LatchSolve(bootTape, over = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment, SolverRefusal } = await import('./solverBot.js');
    const { BotDriverV2Error } = await import('./botDriverV2.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const levelSource = atlasLevelSource();
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(bootTape))));
    return withContactFidelity(over, () => {
        const run = createRunForStaging(staging, levelSource);
        try {
            const out = solveSegment({ run, goals: [L40LATCH_GOAL], name: 'l40latch', boot: staging.boot,
                dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
            return { out, refusal: null };
        } catch (e) {
            // an executor's own refusal (`runHold`'s MOVED) is a `BotDriverV2Error`, returned as the answer too
            if (e instanceof SolverRefusal || e instanceof BotDriverV2Error) return { out: null, refusal: e };
            throw e;
        }
    });
}

/** The game poll's fold: `fidelityCorpseBump`'s (the player, every block, every chaser and turret) plus the hits. */
export function l40LatchSampleOf(s, m) {
    return { ...corpseBumpSampleOf(s, m), hits: s.hits ?? null };
}

/** The recording's compact row: `[t, level, x, y, blocks, bodies, hits]`. */
export function packL40LatchSample(g) {
    return [...packCorpseBumpSample(g), g.hits];
}

/** The inverse of `packL40LatchSample`. */
export function unpackL40LatchSample(row) {
    return { ...unpackCorpseBumpSample(row.slice(0, 6)), hits: row[6] };
}

const AS3_OF = Object.freeze({ bob: 'Bob', bobsoldier: 'BobSoldier', puncher: 'Puncher' });

/**
 * The model's samples of a tape, by tape tick, under `over`: `fidelityCorpseBump`'s fold (the player, the blocks, the
 * chasers and the turrets) plus the player's hits since its last death (`hits`, the game's `botStatus.hits`: a death
 * respawns the player at 0) and the hit rows themselves (`{samples, hits, error}`).
 */
export async function l40LatchModelSamples(tapeJson, over) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let hits = [];
    let error = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const rows = run ? (run.world.pushables ?? []) : [];
                const live = run ? run.entities('pushables') : null;
                const chasers = run ? (run.entities('chasers') ?? new Map()) : new Map();
                const turrets = run ? (run.entities('turrets') ?? new Map()) : new Map();
                hits = run ? run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id, died: h.died })) : [];
                samples[o.t] = {
                    // the game's `hits` counts since the last death (a death respawns the player at 0)
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    hits: hits.length - (hits.findLastIndex((h) => h.died) + 1),
                    blocks: live ? rows.map((p) => ({ cls: p.as3, b: live.get(p.id) }))
                        .filter((p) => p.b && !p.b.removed)
                        .map((p) => ({ cls: p.cls, x: p.b.rect.x, y: p.b.rect.y })) : [],
                    bodies: [
                        ...[...chasers.values()].filter((c) => !c.removed && AS3_OF[c.tag])
                            .map((c) => ({ cls: AS3_OF[c.tag], x: c.x, y: c.y })),
                        ...[...turrets.values()].filter((c) => !c.removed)
                            .map((c) => ({ cls: 'IceTurret', x: c.x, y: c.y, ...(c.dead ? { anim: 'dead' } : {}) })),
                    ],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
    });
    return { samples, hits, error };
}

/** The game-side checks of `l40latch-stand` (each `{name, ok, detail}`). */
export function l40LatchStandChecks(samples) {
    const first = samples.find((g) => (g.hits ?? 0) > 0);
    const soldierUp = samples.find((g) => (g.bodies ?? []).some((b) => b.cls === 'BobSoldier' && b.y < 816));
    return [{
        name: 'the game\'s bobsoldier@880,832 leaves the pocket and walks up toward the latch (y < 816)',
        ok: soldierUp !== undefined, detail: soldierUp ? `from t${soldierUp.t}` : 'never',
    }, {
        name: 'the game HITS the still holder on the latch',
        ok: first !== undefined, detail: first ? `first hit at t${first.t}; max hits ${Math.max(...samples.map((g) => g.hits ?? 0))}` : 'never',
    }];
}

/** The game-side checks of `l40latch-orbit-chain` (each `{name, ok, detail}`). */
export function l40LatchOrbitChecks(samples) {
    const soldier = (g) => (g.bodies ?? []).some((b) => b.cls === 'BobSoldier' && b.x > 800 && b.y > 700);
    const gone = samples.find((g) => !soldier(g));
    return [{
        name: 'the game never hits the player',
        ok: samples.every((g) => (g.hits ?? 0) === 0),
        detail: `max hits ${Math.max(...samples.map((g) => g.hits ?? 0))}`,
    }, {
        name: 'the game\'s bobsoldier@880,832 is killed and removed, and stays gone',
        ok: gone !== undefined && samples.filter((g) => g.t >= gone.t).every((g) => !soldier(g)),
        detail: gone ? `gone from t${gone.t}` : 'never',
    }];
}

export const L40LATCH_WITNESSES = Object.freeze({
    'l40latch-stand': Object.freeze({ tape: l40LatchStandTape, switches: {}, checks: l40LatchStandChecks }),
    'l40latch-orbit-chain': Object.freeze({ tape: l40LatchOrbitTape, switches: L40LATCH_D1_SWITCHES,
        checks: l40LatchOrbitChecks }),
});
