/**
 * seedling-fidelity-ceremony126 (wave 37b) — A PRESS WHOSE THRUST LANDS ON A PICKUP CEREMONY'S FIRST FROZEN FRAME IS
 * LOST; A COLLECT GOAL'S STANCE WALK THAT STARTS ITS PICKUP'S CEREMONY HANDS THE CEREMONY TO THE VERB.
 * Shared by `scripts/procgen/probe-seedling-ceremony126.mjs` (plays each witness on the game, `--record`) and
 * `fidelityCeremony126.test.js` (replays the recordings against the model at 0 px).
 *
 * THE GAME (W0):
 *   A placed pickup is touched at a tick's top from where the previous tick left the player (`Pickup.update` →
 *   `collide("Player", x, y)` → `pick_up()`, `Pickups/Pickup.as:78-83`), and a `special` one raises
 *   `Game.freezeObjects` on that same update (`Pickup.as:95`) — the ceremony's first frozen frame. `Player.update`
 *   still runs `slash()` on it (`Player.as:560-563`: only `Mobile.mobileUpdate`'s friction/input/move is gated,
 *   `Mobile.as:35-41`), and `genericHit` returns at its first line under the freeze (`Player.as:1075-1078`): the thrust
 *   a press on the tick before scheduled hits nothing. The model refuses to author such a press (`levelRun`'s
 *   `FROZEN_TICK_PRESS`), so the model of a lost press is the same tape WITHOUT it.
 *
 * WITNESSES (L64, route-survey step 125 — the brief's "126" — from its staged boot, `SEEDLING_CEREMONY_PRESS_FORECAST=1
 * SEEDLING_CEREMONY_WALK_HANDOFF=1`):
 *   `ceremony126-solved` — the solver's tape (150 t, 0 hits): the stance walk enters `ghostspear@72,24`'s rect on
 *     input 43, the ceremony holds observations 45..73 (input 44 its first frozen frame), the verb pages it, and the
 *     walk leaves by `teleporter@32,96` (L64 → L62) on input 149. The game equals the model at 0 px.
 *   `ceremony126-lost` — the same tape without the strike's t37 press (so the next press is a plain swing, not a
 *     `slashTimer` dash), plus `primary` on input 43: its thrust fires on input 44, the ceremony's first frozen frame.
 *     The game equals the model of the tape WITHOUT that press at 0 px: the press is lost.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CEREMONY126_WITNESS_DIR = join(HERE, 'fixtures', 'ceremony126-witness');
/** The pickup, the ceremony span (observations) and the lost press's input, as the model measures them. */
export const CEREMONY126_PICKUP = 'ghostspear@72,24';
export const CEREMONY126_SPAN = Object.freeze({ firstFrozenInput: 44, firstObs: 45, lastObs: 73 });
export const CEREMONY126_LOST_PRESS = 43;
export const CEREMONY126_DROPPED_STRIKE = 37;

const solvedTapeJson = () => JSON.parse(readFileSync(join(CEREMONY126_WITNESS_DIR, 'step125-solved-tape.json'), 'utf8'));
const withoutStrike = (inputs) => inputs.filter((i) => !(i.key === 'primary' && i.from === CEREMONY126_DROPPED_STRIKE));

export function ceremony126SolvedTape() {
    return { ...solvedTapeJson(), name: 'ceremony126-solved' };
}
/** The lost witness's tape (`withPress`) or its model (the same tape without the lost press). */
export function ceremony126LostTape(withPress = true) {
    const t = solvedTapeJson();
    const inputs = withoutStrike(t.inputs);
    if (withPress) inputs.push({ key: 'primary', from: CEREMONY126_LOST_PRESS, to: CEREMONY126_LOST_PRESS + 1 });
    return { ...t, name: withPress ? 'ceremony126-lost' : 'ceremony126-lost-model', inputs };
}

/**
 * ⛓ fidelity CEREMONYEXACT D1 — the KEPT press: the lost witness's tape with its press one input EARLIER (42). CEREMONY126's
 * bound refused it (gap 1.16 px ≤ 4.45); the exact forecast does not (the box after input 42 is clear of the rect, so the
 * ceremony starts on 44, not on the thrust's tick 43). The model authors it (no `FROZEN_TICK_PRESS`): its model is the
 * tape itself.
 */
export const CEREMONYEXACT_KEPT_PRESS = 42;
export function ceremonyExactKeptTape() {
    const t = solvedTapeJson();
    const inputs = withoutStrike(t.inputs);
    inputs.push({ key: 'primary', from: CEREMONYEXACT_KEPT_PRESS, to: CEREMONYEXACT_KEPT_PRESS + 1 });
    return { ...t, name: 'ceremonyexact-kept', inputs };
}

export const CEREMONY126_WITNESSES = Object.freeze({
    'ceremony126-solved': Object.freeze({ tape: () => ceremony126SolvedTape(), model: () => ceremony126SolvedTape() }),
    'ceremony126-lost': Object.freeze({ tape: () => ceremony126LostTape(true), model: () => ceremony126LostTape(false) }),
    // ⛓ fidelity CEREMONYEXACT D1 (a row added at the end).
    'ceremonyexact-kept': Object.freeze({ tape: () => ceremonyExactKeptTape(), model: () => ceremonyExactKeptTape() }),
});

/** The game poll's fold: the player (level, position, hits, frozen timer) and the dead-frame count. */
export function ceremony126SampleOf(s) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, frozen: s.frozen_timer };
}
export const packCeremony126Sample = (g) => [g.t, g.level, g.x, g.y, g.hits, g.frozen];
export function unpackCeremony126Sample([t, level, x, y, hits, frozen]) {
    return { t, level, x, y, hits, frozen };
}

/** The model's samples of a tape, by observation (obs `t` = the state input `t − 1` left), and its ceremony span. */
export async function ceremony126ModelSamples(tapeJson) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    const ceremony = [];
    let error = null;
    let run = null;
    let collected = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    try {
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            samples[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                hits: run ? run.damage.hits : 0, frozen: run ? run.frozenTimer : 0 };
            if (run && run.progress('inCeremony')) ceremony.push(o.t);
            if (run) collected = run.ledger('collected');
            r = st.next();
        }
    } catch (e) {
        error = e.code ?? e.message;
    }
    return { samples, ceremony, collected, error };
}

/** Compare a game witness with the model, every sampled tick. */
export function compareCeremony126Witness(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.level !== g.level) { bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${m.hits}`);
        if (m.frozen !== g.frozen) bad.push(`t ${g.t}: frozen game ${g.frozen} model ${m.frozen}`);
    }
    return bad;
}
