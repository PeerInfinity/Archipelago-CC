/**
 * ⛓⛓⛓ seedling-fidelity-l40bk2b (wave 33) — L40 BOSS KEY 2 PAST THE LATCH: `bobsoldier@880,832` MET IN ITS NOTCH.
 *
 * `bobsoldier@880,832` stands in a one-tile notch, the only way into the tree/latch pocket, above L40's one-tile
 * corridor (y 848–864, x 736–896). With the hammer arc's OPP ON, leg 853 (`<- in_L39_144_0`, seam 5152) kills both
 * x≈744 bobs in the press kill and then meets the BobSoldier on the burn stance's walk, 144 px off in the x 736 shaft.
 * The kill rung's chaser arm finds no still stance (the blade rests where the player stood), and the orbit arm
 * (`chaserOrbitKill`, L40LATCH) steers straight at a point on a circle round the body. In the notch that point lies in
 * the shaft wall or the corridor's floor: the ccw candidates pin the player for the whole bound, the cw ones land one
 * hit, back off INTO the floor and stand inside the blade when the spin stops on them.
 *
 * D1 (`CONTACT_FIDELITY.orbitFreeAim`) projects each orbit aim onto the free point nearest it (`solverBot.orbitFreeAim`).
 *
 * The staging (`corridor-boot.json`) is survey step 67's boot moved into the corridor west of the notch, the two
 * corridor spinners banked (so the BobSoldier is measured alone). It is the PLAIN world (the chest at (880,816) is a
 * chest): the AP leg's records make it an `apitem` (not Solid), and the probe page plays the plain world.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { l40LatchBoot, l40LatchModelSamples, l40LatchOrbitChecks, l40LatchSampleOf, l40LatchSolve, l40LatchTape,
    packL40LatchSample, unpackL40LatchSample } from './fidelityL40Latch.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const L40BK2B_WITNESS_DIR = join(HERE, 'fixtures', 'l40bk2b-witness');

/** The staging's goal: step 67's own, `chest@880,816` (its stance (888,834) is in the BobSoldier's notch). */
export const L40BK2B_GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 880, y: 816 }) });

/** The BobSoldier the slice is about. */
export const L40BK2B_BODY = 'bobsoldier@880,832';

/** How many ticks past the BobSoldier's removal the D1 witness keeps (the walk on, before the chest's proximity). */
export const L40BK2B_AFTER_REMOVAL = 6;

/** How many ticks past the first hit the shipped orbit's witness keeps. */
export const L40BK2B_AFTER_HIT = 30;

/** D1's switch. */
export const L40BK2B_D1_SWITCHES = Object.freeze({ orbitFreeAim: true });

async function fixture(name) {
    const { readFileSync } = await import('node:fs');
    return JSON.parse(readFileSync(join(L40BK2B_WITNESS_DIR, `${name}.json`), 'utf8'));
}

/** The staging: step 67's boot in the corridor, both corridor spinners banked (`fixtures/l40bk2b-witness/corridor-boot.json`). */
export async function l40Bk2bBoot() {
    return fixture('corridor-boot');
}

/** A tape on the corridor boot's header from per-tick held sets (each an array of key names). */
export async function l40Bk2bTape(name, perTick, extra = {}) {
    const { buildTape } = await import('./botDriverV1.js');
    const boot = await l40Bk2bBoot();
    const folded = buildTape(perTick.map((k) => new Set(k)), boot.boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const { description, ...header } = boot;
    return { ...header, name, tick_count: perTick.length, inputs: folded.inputs, ...extra };
}

/**
 * `solveSegment` for the chest from the corridor boot, under `over`: `{out, refusal}` (a `SolverRefusal` or an
 * executor's `BotDriverV2Error` is returned, anything else thrown). A fresh fork run per try, as the page solves.
 */
export async function l40Bk2bSolve(over = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment, SolverRefusal } = await import('./solverBot.js');
    const { BotDriverV2Error } = await import('./botDriverV2.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const levelSource = atlasLevelSource();
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(await l40Bk2bBoot()))));
    return withContactFidelity(over, () => {
        const run = createRunForStaging(staging, levelSource);
        try {
            const out = solveSegment({ run, goals: [L40BK2B_GOAL], name: 'l40bk2b', boot: staging.boot,
                dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
            return { out, refusal: null };
        } catch (e) {
            if (e instanceof SolverRefusal || e instanceof BotDriverV2Error) return { out: null, refusal: e };
            throw e;
        }
    });
}

/**
 * The shipped orbit (`orbitKillPolicy`, `orbitFreeAim` OFF) for one `ORBIT_KILL_CANDIDATES` entry, played from the
 * corridor boot as the orbit arm plays it on a fork: `{keys, hitAt, removedAt}` (`hitAt` the tick index of the first
 * player hit, then `L40BK2B_AFTER_HIT` more ticks of the same policy).
 */
export async function l40Bk2bShippedOrbit(index = 2) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { ORBIT_KILL, ORBIT_KILL_CANDIDATES, orbitKillPolicy, strikePolicyFor } = await import('./solverBot.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(await l40Bk2bBoot()))));
    return withContactFidelity({ orbitFreeAim: false }, () => {
        const run = createRunForStaging(staging, atlasLevelSource());
        const strike = strikePolicyFor(run, { dashMode: 'all' });
        const keys = [];
        let hitAt = null;
        let removedAt = null;
        for (let i = 0; i < ORBIT_KILL.ticks; i += 1) {
            if (hitAt !== null && i >= hitAt + L40BK2B_AFTER_HIT) break;
            const held = orbitKillPolicy(run, L40BK2B_BODY, ORBIT_KILL_CANDIDATES[index], strike);
            if (held === null) { removedAt = i; break; }
            keys.push([...held]);
            run.advance(held);
            if (hitAt === null && (run.ledger('playerHits') ?? []).length > 0) hitAt = i + 1;
        }
        return { keys, hitAt, removedAt };
    });
}

/** `l40bk2b-orbit-plain`: the shipped orbit's candidate `r 22 cw far 110°` from the corridor boot, to its hit and on. */
export async function l40Bk2bPlainTape() {
    const { keys, hitAt } = await l40Bk2bShippedOrbit(2);
    if (hitAt === null) throw new Error('l40Bk2bPlainTape: the shipped orbit was NOT hit — the witness is its hit; re-derive');
    return l40Bk2bTape('l40bk2b-orbit-plain', keys, {
        description: 'seedling-fidelity-l40bk2b W0/D1: L40\'s corridor west of bobsoldier@880,832\'s notch (both corridor '
            + 'spinners banked) — the SHIPPED orbit kill\'s candidate `r 22 cw far 110°` (orbitKillPolicy, orbitFreeAim OFF), '
            + `steered straight at its circle point: the blade lands at orbit tick ${hitAt} (probe-seedling-l40bk2b.mjs)`,
    });
}

/**
 * `l40bk2b-orbit-free`: the solver's own ticks for the chest from the corridor boot with `orbitFreeAim` ON, cut
 * `L40BK2B_AFTER_REMOVAL` ticks after the BobSoldier's removal (the walk on to the chest stance enters the chest's own
 * proximity hazard, a plain-world staging artifact; the AP leg's chest is an `apitem`). Built at record time.
 */
export async function l40Bk2bFreeTape() {
    const { out, refusal } = await l40Bk2bSolve(L40BK2B_D1_SWITCHES);
    const perTick = (out?.perTick ?? refusal?.perTick ?? []).map((k) => [...k]);
    const removedAt = await l40Bk2bRemovalTick(perTick);
    if (removedAt === null) throw new Error('l40Bk2bFreeTape: the BobSoldier was not removed — re-derive');
    return l40Bk2bTape('l40bk2b-orbit-free', perTick.slice(0, removedAt + L40BK2B_AFTER_REMOVAL), {
        description: 'seedling-fidelity-l40bk2b D1: L40\'s corridor west of bobsoldier@880,832\'s notch (both corridor '
            + 'spinners banked) — the SOLVER\'s own ticks for chest@880,816 with orbitFreeAim ON: the chaser arm finds no '
            + 'stance, the orbit arm\'s aims are projected onto free points, bobsoldier@880,832 is killed hitless and '
            + `removed at t${removedAt} (probe-seedling-l40bk2b.mjs)`,
    });
}

/** The first tick after which the BobSoldier is off the chaser roster, replaying `perTick` from the boot (`null`: never). */
export async function l40Bk2bRemovalTick(perTick) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(await l40Bk2bBoot()))));
    const run = createRunForStaging(staging, atlasLevelSource());
    for (let t = 0; t < perTick.length; t += 1) {
        run.advance(new Set(perTick[t]));
        if (!(run.entities('chasers') ?? []).some((c) => c.id === L40BK2B_BODY)) return t + 1;
    }
    return null;
}

// the game poll's fold, the compact row and the model's samples are L40LATCH's (the player, blocks, bodies, hits)
export { l40LatchModelSamples as l40Bk2bModelSamples, l40LatchSampleOf as l40Bk2bSampleOf,
    packL40LatchSample as packL40Bk2bSample, unpackL40LatchSample as unpackL40Bk2bSample };

const soldier = (g) => (g.bodies ?? []).some((b) => b.cls === 'BobSoldier' && b.x > 800 && b.y > 800);

/** The game-side checks of `l40bk2b-orbit-plain` (each `{name, ok, detail}`). */
export function l40Bk2bPlainChecks(samples) {
    const first = samples.find((g) => (g.hits ?? 0) > 0);
    return [{
        name: 'the game HITS the player on the shipped orbit (the BobSoldier\'s blade)',
        ok: first !== undefined, detail: first ? `first hit at t${first.t}` : 'never',
    }];
}

/** The game-side checks of `l40bk2b-orbit-free` (each `{name, ok, detail}`). */
export function l40Bk2bFreeChecks(samples) {
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

/**
 * `l40bk2b-latch-free`: L40LATCH's latch staging (`fixtures/l40latch-witness/latch-boot.json`) solved for Boss Key 2 with
 * `orbitFreeAim` ON — the open pocket's orbit is projected too (candidate 0 now kills, at t137; OFF candidate 1 at t184),
 * so the chain is a different plan to the same refusal (the x≈744 corridor). Its refused prefix, on the latch boot's
 * header with the refusal's `equips`. Built at record time (~110 s).
 */
export async function l40Bk2bLatchFreeTape() {
    const boot = await l40LatchBoot();
    const { out, refusal } = await l40LatchSolve(boot, L40BK2B_D1_SWITCHES);
    if (out) throw new Error('l40Bk2bLatchFreeTape: the latch solve SOLVED — the witness is the refused prefix; re-derive');
    const tape = await l40LatchTape('l40bk2b-latch-free', refusal.perTick.map((k) => [...k]), {
        refused: refusal.message.slice(0, 600),
        description: 'seedling-fidelity-l40bk2b D1: L40LATCH\'s latch staging (the chest, the tree and spinner@880,848 '
            + 'banked) — the SOLVER\'s own ticks for Boss Key 2 with orbitFreeAim ON (every other switch at its default), '
            + 'until it refused: bobsoldier@880,832 killed on the projected orbit, never hit (probe-seedling-l40bk2b.mjs)',
    });
    return { ...tape, equips: [...(boot.equips ?? []), ...(refusal.equips ?? [])] };
}

export const L40BK2B_WITNESSES = Object.freeze({
    'l40bk2b-orbit-plain': Object.freeze({ tape: l40Bk2bPlainTape, switches: { orbitFreeAim: false },
        checks: l40Bk2bPlainChecks }),
    'l40bk2b-orbit-free': Object.freeze({ tape: l40Bk2bFreeTape, switches: L40BK2B_D1_SWITCHES,
        checks: l40Bk2bFreeChecks }),
    'l40bk2b-latch-free': Object.freeze({ tape: l40Bk2bLatchFreeTape, switches: L40BK2B_D1_SWITCHES,
        checks: l40LatchOrbitChecks }),
});
