/**
 * ⛓ HOLD SEAM (js slice `seedling-js-hold-seam`) — THE FRAMES A HOLD RAN, READ OFF THE GAME.
 *
 * A held game runs engine frames with the world frozen: `Game.time` and the player stay put, but `Bot.update` steps
 * `Music.pinStep()` above the armed check, so the pinned Swim channel advances one frame per held frame (fidelity
 * SLOWFIX D-B, `fidelityHoldSeam.test.js`: 33 → 43 over a 300 ms hold at L15's chest). A continuation solved from the
 * shadow without those frames plays a shifted boost window (`Player.as:548`, `soundPosition("Swim") < 0.1`): the
 * `l15-post-chest-walk` divergence, +0.25 px at t18.
 *
 * The count is never assumed (a hold's length is the solve's wall time): it is the game's own pin
 * (`botStatus.sound_pin.channels[0]`, `Music.pinReadout("Swim")`) against the model's channel at the same tick. The
 * channel only moves forward while held, and closes (frames 0) at its length, so the count is the forward distance:
 *   · model closed, or no swim sound this run           → 0 (a held frame steps nothing)
 *   · model open at a, game open at b ≥ a                → b − a
 *   · model open at a, game closed at 0 (it completed)   → length − a (more frames change nothing)
 *   · anything else (b < a, a stopped game channel, another length) is not a hold — refused by name, nothing stepped.
 * Only under the `sound` pin: unpinned, the game's channel is the mixer's and the model's is not its copy.
 */

import { replayTape } from './jsRuntimeSolver.js';
import { stepChannel } from './swimSoundClock.js';

/** The game's pinned swim channel (`sound_pin.channels[0]`) as the model writes one, or null when the status has none. */
export function pinChannelOf(status) {
    const c = status?.sound_pin?.channels?.[0];
    if (!c || !Number.isInteger(c.frames) || !Number.isInteger(c.len_frames)) return null;
    return { frames: c.frames, open: c.playing === true, lengthFrames: c.len_frames };
}

/**
 * The held frames that carry the model's `channel` (`levelRun.state.swim` at the seam) to the game's pin.
 * @returns {{n: number, game: ?object, refusal?: string}}
 */
export function heldSwimFrames({ channel, status, pins }) {
    if (!(pins ?? []).includes('sound')) return { n: 0, game: null };
    const game = pinChannelOf(status);
    if (!channel || !channel.open) return { n: 0, game };
    if (!game) return { n: 0, game, refusal: 'the held game reports no swim pin (sound_pin.channels[0])' };
    if (game.lengthFrames !== channel.lengthFrames) {
        return { n: 0, game, refusal: `the game's swim channel is ${game.lengthFrames} frame(s) long, the model's ${channel.lengthFrames}` };
    }
    if (game.open && game.frames >= channel.frames) return { n: game.frames - channel.frames, game };
    if (!game.open && game.frames === 0) return { n: channel.lengthFrames - channel.frames, game };
    return { n: 0, game, refusal: `the game's swim channel ${JSON.stringify(game)} is not the model's ${JSON.stringify(channel)} `
        + 'stepped forward — no hold reaches it' };
}

/** `[{t, n}]` (room ticks) → the Map `replayTape` / `continuationSolveRequest` read (two holds at one tick add); null when empty. */
export function holdsMap(rows) {
    if (!rows?.length) return null;
    const m = new Map();
    for (const { t, n } of rows) m.set(t, (m.get(t) ?? 0) + n);
    return m;
}

/**
 * A continuation's seam (the room HELD at tick `shipped.length`): the model's swim channel there (the shadow, every
 * earlier hold of the room replayed), the game's pin, and the frames between them; `holds` is the room's holds with
 * this one added — what the continuation's request replays. No `sound` pin, or a channel not open at the seam →
 * `seam` null, no shadow replayed here, `holds` the room's own (the request unchanged).
 * @returns {{seam: ?{t: number, model: object, game: ?object, n: number, refusal: ?string}, holds: ?Map<number, number>}}
 */
export function continuationHoldSeam({ staging, shipped, levelSource, equips = null, roomHolds = [], status }) {
    const t = shipped.length;
    let seam = null;
    if ((staging?.pins ?? []).includes('sound')) {
        const model = replayTape({ staging, perTick: shipped.map((h) => new Set(h)), levelSource, scratchPersistence: true,
            equips, holds: holdsMap(roomHolds) }).state.swim;
        if (model?.open) {
            const m = heldSwimFrames({ channel: model, status, pins: staging.pins });
            seam = { t, model: { ...model }, game: m.game, n: m.n, refusal: m.refusal ?? null };
        }
    }
    return { seam, holds: holdsMap([...(roomHolds ?? []), ...(seam?.n && !seam.refusal ? [{ t, n: seam.n }] : [])]) };
}

/**
 * ⛓ At the ship: the game's pin re-read against the channel the plan was solved on. The hold ran on while the solver
 * thought, so a different channel NOW means the plan's first tick would see another boost window: `{n, game}` (the
 * count as it reads now) = re-stage; null = ship (the same channel — a closed one never moves again).
 */
export function holdSeamRestage(seam, status, pins) {
    if (!seam || seam.refusal) return null;
    const again = heldSwimFrames({ channel: seam.model, status, pins });
    if (again.refusal) return null;
    const solvedOn = stepChannel({ ...seam.model }, seam.n);
    const reads = stepChannel({ ...seam.model }, again.n);
    return reads.open === solvedOn.open && reads.frames === solvedOn.frames ? null : { n: again.n, game: again.game };
}
