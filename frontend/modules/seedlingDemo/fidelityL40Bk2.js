/**
 * ⛓⛓⛓ seedling-fidelity-l40bk2 (wave 31) — L40's BOSS KEY 2 CHAIN, end to end, and leg 368's hit-aware dash
 * certificate (⛓ hammer hand-over 368).
 *
 * D1 (`CONTACT_FIDELITY.weighHypothesisChain`, OFF). Legs 869/870 (`level_40__r32c36 … -> location:Level 040 - Boss Key
 * 2`, ids 859/860 at this slice's base) and survey step 67 refuse *"no REACHABLE stance inside button@816,400"*, because
 * guard (iii) asked each `weigh` holder of the world AS IT IS: t2's holder (`iceturret@472,400`'s corpse) stands behind
 * the latched south door, and t5's (`pushableblockfire@480,480`, FIREMOVE's 35-press route) crosses t2. ON the holders
 * are asked under the rest of the hypothesis (`solverBot.chainWeighHypothesis`), and a frontier order that cannot bind
 * yet passes its round to the next door (`nextPastUnbound`). From the arrival the chain then walks the south door's
 * links and dies in the hammer arc's press kill (`kill (spinner@880,848) by press`, PRESS_KILL_REBOOT_GUARD — D3).
 *
 * The rest of the chain is the solver's own from inside the lock room (the pocket boot, `prox-l40-turret-volley`'s
 * header): the Sword circles the turret, the corpse is bumped onto t2, the fire block takes FIREPUSH's 35 presses onto
 * t5, `button@816,400` is held until `pulser@592,576` has pushed `pushableblockfire@576,576` into the pocket — and the
 * walk back to the walk block's stance refuses, because in that staging the south door was never opened (its latch is
 * links 1–3). The witness (`l40bk2-pocket-chain`, p4g) plays the ticks that refusal SPENT (`SolverRefusal.perTick`,
 * with `equips` riding on it under the key) and compares the model at 0 px.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpseBumpSampleOf, packCorpseBumpSample, unpackCorpseBumpSample } from './fidelityCorpseBump.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const L40BK2_WITNESS_DIR = join(HERE, 'fixtures', 'l40bk2-witness');

/** The leg's goal: `bosskey@656,528`, the `Level 040 - Boss Key 2` location. */
export const L40BK2_GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 656, y: 528 }) });

/** D1's switch (every other at its default). */
export const L40BK2_D1_SWITCHES = Object.freeze({ weighHypothesisChain: true });

/** D2's switch (⛓ hammer hand-over 368). */
export const L40BK2_D2_SWITCHES = Object.freeze({ dashSpinnerForecast: true });

async function fixture(name) {
    const { readFileSync } = await import('node:fs');
    return JSON.parse(readFileSync(join(L40BK2_WITNESS_DIR, `${name}.json`), 'utf8'));
}

/** Survey step 67's boot (the survey's staged `r8-solve-11` block re-pointed at L40@480,896), as the survey wrote it. */
export async function l40Bk2Step67Boot() {
    return fixture('step67-boot');
}

/** The pocket boot: `prox-l40-turret-volley`'s committed header (L40 (480,456), inside the turret's pocket), tick 0. */
export async function l40Bk2PocketBoot() {
    const { readFileSync } = await import('node:fs');
    const base = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'prox-l40-turret-volley.json'), 'utf8'));
    return { ...base, name: 'l40bk2-pocket-boot', tick_count: 0, inputs: [] };
}

/**
 * `solveSegment` for the key from a tick-0 boot tape, under `over`: `{out, refusal}` (a `SolverRefusal` is returned,
 * anything else thrown). A fresh fork run per try, as the page solves.
 */
export async function l40Bk2Solve(bootTape, over = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment, SolverRefusal } = await import('./solverBot.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const levelSource = atlasLevelSource();
    const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(bootTape))));
    return withContactFidelity(over, () => {
        const run = createRunForStaging(staging, levelSource);
        try {
            const out = solveSegment({ run, goals: [L40BK2_GOAL], name: 'l40bk2', boot: staging.boot, dashMode: 'all',
                forkRun: () => createRunForStaging(staging, levelSource) });
            return { out, refusal: null };
        } catch (e) {
            if (e instanceof SolverRefusal) return { out: null, refusal: e };
            throw e;
        }
    });
}

/**
 * `l40bk2-pocket-chain`: the ticks the solver spent from the pocket boot before its refusal (D1's switch ON, so the
 * refusal carries its `equips`), folded onto the boot's own header. Built at record time (the solve is ~3.5 min).
 */
export async function l40Bk2PocketTape() {
    const { buildTape } = await import('./botDriverV1.js');
    const boot = await l40Bk2PocketBoot();
    const { out, refusal } = await l40Bk2Solve(boot, L40BK2_D1_SWITCHES);
    if (out) throw new Error('l40Bk2PocketTape: the pocket solve SOLVED — the witness is the refused prefix; re-derive');
    const perTick = refusal.perTick.map((k) => new Set(k));
    const folded = buildTape(perTick, boot.boot, 'l40bk2-pocket-chain',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...boot, name: 'l40bk2-pocket-chain', equips: [...(boot.equips ?? []), ...(refusal.equips ?? [])],
        tick_count: perTick.length, inputs: folded.inputs,
        refused: refusal.message.slice(0, 600),
        description: 'seedling-fidelity-l40bk2 D1: L40 from the pocket boot (prox-l40-turret-volley\'s header) — the '
            + 'SOLVER\'s own ticks for Boss Key 2 until it refused: the Sword circles iceturret@472,400, the corpse is '
            + 'bumped onto button@480,384 {t 2}, pushableblockfire@480,480 takes 35 Fire presses onto button@768,400 '
            + '{t 5}, button@816,400 is held until pulser@592,576 has pushed pushableblockfire@576,576 into the pocket '
            + '(probe-seedling-l40bk2.mjs)' };
}

/** The game poll's fold: `fidelityCorpseBump`'s (the player, every block, every chaser and turret) plus the hits. */
export function l40Bk2SampleOf(s, m) {
    return { ...corpseBumpSampleOf(s, m), hits: s.hits ?? null };
}

/** The recording's compact row: `[t, level, x, y, blocks, bodies, hits]`. */
export function packL40Bk2Sample(g) {
    return [...packCorpseBumpSample(g), g.hits];
}

/** The inverse of `packL40Bk2Sample`. */
export function unpackL40Bk2Sample(row) {
    return { ...unpackCorpseBumpSample(row.slice(0, 6)), hits: row[6] };
}

const onT2 = (g) => (g.bodies ?? []).some((b) => b.cls === 'IceTurret' && b.anim === 'dead' && b.y < 400);
const blockAt = (g, x, y) => (g.blocks ?? []).some((b) => b.cls === 'PushableBlockFire' && b.x === x && b.y === y);

/** The game-side checks of `l40bk2-pocket-chain` (each `{name, ok, detail}`). */
export function l40Bk2PocketChecks(samples) {
    const end = samples.at(-1);
    const corpse = samples.find(onT2);
    const t5 = samples.find((g) => blockAt(g, 768, 400));
    const west = (g) => (g.blocks ?? []).some((b) => b.cls === 'PushableBlockFire' && b.y === 576 && b.x < 576);
    const pushed = samples.find(west);
    return [{
        name: 'the game\'s ice-turret corpse comes to rest on button@480,384 {t 2} and stays',
        ok: corpse !== undefined && samples.filter((g) => g.t >= corpse.t).every(onT2),
        detail: corpse ? `from t${corpse.t}` : 'never',
    }, {
        name: 'the game\'s pushableblockfire@480,480 comes to rest on button@768,400 {t 5} and stays',
        ok: t5 !== undefined && samples.filter((g) => g.t >= t5.t).every((g) => blockAt(g, 768, 400)),
        detail: t5 ? `from t${t5.t}` : 'never',
    }, {
        // ⚠ the prefix ends where the refusal did: the glide is one tick short of the pocket's (560,576) there
        name: 'the game\'s pushableblockfire@576,576 is pushed west toward the pocket (560,576) by pulser@592,576',
        ok: pushed !== undefined && samples.filter((g) => g.t >= pushed.t).every(west)
            && (end.blocks ?? []).some((b) => b.cls === 'PushableBlockFire' && b.y === 576 && b.x <= 561),
        detail: pushed ? `leaves (576,576) at t${pushed.t}; at t${end.t} x ${(end.blocks ?? [])
            .find((b) => b.cls === 'PushableBlockFire' && b.y === 576)?.x}` : 'never',
    }, {
        name: 'the game never hits the player',
        ok: samples.every((g) => (g.hits ?? 0) === 0),
        detail: `max hits ${Math.max(...samples.map((g) => g.hits ?? 0))}`,
    }, {
        name: 'the game\'s player ends on button@816,400 (the hold that published the pulser)',
        ok: end !== undefined && end.level === 40 && Math.abs(end.x - 824) < 8 && Math.abs(end.y - 408) < 8,
        detail: end ? `ends in L${end.level} at (${end.x}, ${end.y})` : 'no sample',
    }];
}

export const L40BK2_WITNESSES = Object.freeze({
    'l40bk2-pocket-chain': Object.freeze({ tape: l40Bk2PocketTape, switches: L40BK2_D1_SWITCHES,
        checks: l40Bk2PocketChecks }),
});
