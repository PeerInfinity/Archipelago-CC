/**
 * ⛓⛓⛓ seedling-fidelity-rockbutton (wave 41): A LANDED FALLROCK IS A SOLID THAT HOLDS A BUTTON DOWN
 * (`CONTACT_FIDELITY.fallRockHoldsButton`).
 *
 * `Button.update` collides `["Player","Enemy","Solid"]` and excludes only a `Cover` (`Puzzlements/Button.as:16,30-39`); a
 * landed `FallRock` is `type = "Solid"` (`Scenery/FallRock.as:42-47` at the ctor of a visit that boots it fallen, `:80`
 * at the landing). L28 is the one shipped room where a rock lands on a button: `fallrock@112,240` (group 1, tag 1, dropped
 * by `rope@160,64`'s pull) rests on `button@112,240` (group 0), whose group's only responder is `grasslock@176,208` (tag
 * 2) — the lock on the way north to the L30 door. Hammer ROCK-HOLDER witnessed it on the game (report
 * `CC/docs/cloud-reports/seedling-hammer-rock-holder.md`); these are this slice's recordings of it:
 *
 *   rockbutton-l28-walk      boot (128,288) [state (136,296)], {28,0} + {28,1} cleared (the rock booted fallen): the
 *                            lock fades from the first update and writes {28,2} at t102, and the walk crosses its tile.
 *   rockbutton-l28-control   the same inputs, nothing cleared: the rock is parked overhead, the button bare, the walk
 *                            stalls under the lock at y 226.04.
 *   rockbutton-l28-livefall  boot (96,16) (the L25 arrival), nothing cleared: the solver's rope cut (clear-tag {28,0}),
 *                            then an idle tail — the rock falls IN PLAY (the 186-frame frozen span the model collapses
 *                            into one tick) and lands on the button; the lock's write tick pins which update first counts
 *                            the landed rock.
 *
 * The walk/control inputs are hammer's (`build-l28-walk-tape.mjs`, steered closed loop on the model along the bot's own
 * `planTilePath` tiles, then `up` held 54 ticks, then 10 idle); `rockButtonWalkInputs` re-derives them here so the
 * recording has one source. A sample is `{t, level, x, y, hits, cleared}` (`cleared` = level 28's persistence-cleared
 * tags), the LAST poll of each tick; the tape's final tick is dropped (the game runs on past a tape's end).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROCKBUTTON_WITNESS_DIR = join(HERE, 'fixtures', 'rockbutton-witness');

/** The switch the witnesses reproduce under. */
export const ROCKBUTTON_SWITCHES = Object.freeze({ fallRockHoldsButton: true });

/** L28's pieces, by id. */
export const L28 = Object.freeze({
    level: 28,
    rope: Object.freeze({ id: 'rope@160,64', tag: 0 }),
    rock: Object.freeze({ id: 'fallrock@112,240', tag: 1, group: 1 }),
    button: Object.freeze({ id: 'button@112,240', group: 0 }),
    lock: Object.freeze({ id: 'grasslock@176,208', tag: 2, tile: Object.freeze({ tx: 11, ty: 13 }) }),
});

export const ROCKBUTTON_WITNESSES = Object.freeze([
    Object.freeze({ name: 'rockbutton-l28-walk', kind: 'walk', boot: Object.freeze({ level: 28, x: 128, y: 288 }),
        items: ['hasSword'], cleared: [0, 1] }),
    Object.freeze({ name: 'rockbutton-l28-control', kind: 'walk', boot: Object.freeze({ level: 28, x: 128, y: 288 }),
        items: ['hasSword'], cleared: [] }),
    Object.freeze({ name: 'rockbutton-l28-livefall', kind: 'livefall', boot: Object.freeze({ level: 28, x: 96, y: 16 }),
        items: ['hasSword'], cleared: [], idle: 160 }),
]);

/** Ticks the up hold runs past the 32 px crossing, and the idle tail after it (hammer's numbers). */
const HOLD_EXTRA = 24;
const WALK_IDLE = 10;

/**
 * hammer ROCK-HOLDER's walk inputs, re-derived: leg A steered greedily, closed loop on a model run booted with {28,0} +
 * {28,1} (the switch at its default — the steering never reaches the lock, so it does not read it), along
 * `planTilePath`'s tiles to the tile below the lock; then `up` for the crossing + 24, then 10 idle.
 * @returns {{perTick: Set<string>[], holdFrom: number}}
 */
export async function rockButtonWalkInputs(boot = ROCKBUTTON_WITNESSES[0].boot) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { arrivalStaging } = await import('./fidelityArrival.js');
    const { DEFAULT_LATTICE, nodeCentre, planTilePath } = await import('./botDriverV2.js');
    const src = atlasLevelSource();
    const mk = () => createRunForStaging(arrivalStaging(boot, { items: ['hasSword'], cleared: [0, 1] }), src);
    const probe = mk();
    const centre = (t) => nodeCentre(t.tx, t.ty, DEFAULT_LATTICE);
    const below = centre({ tx: L28.lock.tile.tx, ty: L28.lock.tile.ty + 1 });
    const above = centre({ tx: L28.lock.tile.tx, ty: L28.lock.tile.ty - 1 });
    const path = planTilePath(probe.worldFor(28), { x: probe.state.x, y: probe.state.y }, below, null, { snapStart: true });
    const run = mk();
    const ticks = [];
    for (const [i, wp] of path.entries()) {
        const c = centre(wp);
        const tol = i === path.length - 1 ? 1.5 : 3;
        let n = 0;
        while (Math.abs(run.state.x - c.x) > tol || Math.abs(run.state.y - c.y) > tol) {
            if (++n > 200 || run.level !== 28) throw new Error(`rockButtonWalkInputs: leg A stuck at ${wp.tx},${wp.ty}`);
            const s = new Set();
            const dx = c.x - run.state.x;
            const dy = c.y - run.state.y;
            if (dx > 1) s.add('right'); else if (dx < -1) s.add('left');
            if (dy > 1) s.add('down'); else if (dy < -1) s.add('up');
            run.advance(s);
            ticks.push(s);
        }
    }
    const r = mk();
    const y0 = r.state.y;
    r.advance(new Set(['up']));
    r.advance(new Set(['up']));
    const ySpeed = Math.abs(r.state.y - y0) / 2 || 1;
    const cross = Math.ceil((below.y - above.y) / ySpeed) + HOLD_EXTRA;
    return {
        perTick: [...ticks, ...Array.from({ length: cross }, () => new Set(['up'])),
            ...Array.from({ length: WALK_IDLE }, () => new Set())],
        holdFrom: ticks.length,
    };
}

/** The witness's staging (`arrivalStaging`, the Sword, the row's cleared L28 tags). */
export async function rockButtonStaging(w) {
    const { arrivalStaging } = await import('./fidelityArrival.js');
    return arrivalStaging(w.boot, { items: w.items, cleared: w.cleared });
}

/** The witness's tape: hammer's walk for `kind: 'walk'`; the solver's rope cut + an idle tail for `'livefall'`. */
export async function rockButtonTape(w) {
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await rockButtonStaging(w);
    if (w.kind === 'walk') {
        const { perTick, holdFrom } = await rockButtonWalkInputs(w.boot);
        const tape = buildStagedTape({ staging, perTick, name: w.name });
        return { ...tape, description: `seedling-fidelity-rockbutton: L28 boot (${w.boot.x},${w.boot.y}) → under `
            + `${L28.lock.id}, then up across it (the hold starts at tick ${holdFrom}); persistence `
            + `${JSON.stringify(w.cleared)} (hammer ROCK-HOLDER's inputs; probe-seedling-rock-button.mjs)` };
    }
    const { atlasLevelSource } = await import('./levelSource.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { solveSegment } = await import('./solverBot.js');
    const run = createRunForStaging(staging, atlasLevelSource());
    const out = solveSegment({ run, name: w.name, boot: staging.boot, goals: [{ kind: 'clear-tag',
        tag: { level: 28, tag: L28.rope.tag }, at: { x: 160, y: 64 }, obstacle: L28.rope.id }] });
    const tape = buildStagedTape({ staging, perTick: [...out.perTick, ...Array.from({ length: w.idle }, () => new Set())],
        name: w.name });
    return { ...tape, description: `seedling-fidelity-rockbutton: L28 boot (${w.boot.x},${w.boot.y}), the solver's cut of `
        + `${L28.rope.id} (${out.perTick.length} t), then ${w.idle} idle ticks: ${L28.rock.id} falls in play onto `
        + `${L28.button.id} (probe-seedling-rock-button.mjs)` };
}

/** One `botStatus` poll, folded to a sample. */
export function rockButtonSampleOf(s) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === L28.level).map((c) => c.tag)
            .sort((a, b) => a - b) };
}

/**
 * The model's samples for a tape (`over` laid on the switches; default: ON), and its ledgers: `written` at tick t is
 * the L28 tags the run wrote at a tick < t (the game's readout of tick t holds a write made on the frame that tick
 * ran, which the model stamps one tick earlier — the same `+1` FIREBREAK's rocks read), from the rope pull, the rock's
 * fall and the lock's open.
 */
export async function rockButtonModelSamples(tapeJson, over = ROCKBUTTON_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let ledger = null;
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        const writesOf = (rn) => [
            ...rn.ledger('ropePulls').filter((p) => p.flag?.level === L28.level).map((p) => ({ tag: p.flag.tag, t: p.t })),
            ...rn.rockFalls.filter((f) => f.flag?.level === L28.level).map((f) => ({ tag: f.flag.tag, t: f.t })),
            ...rn.lockWrites.filter((l) => l.flag.level === L28.level && l.value === false)
                .map((l) => ({ tag: l.flag.tag, t: l.t })),
        ];
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const writes = run ? writesOf(run) : [];
            samples[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                written: [...new Set([...tape.persistence.filter((p) => p.level === L28.level).map((p) => p.tag),
                    ...writes.filter((w) => w.t + 1 <= o.t).map((w) => w.tag)])].sort((a, b) => a - b) };
            r = st.next();
        }
        ledger = run ? { writes: writesOf(run), rockFalls: run.rockFalls, lockWrites: run.lockWrites,
            activators: run.activatorsNow } : null;
    });
    return { samples, ledger };
}

/** Game vs model, tick by tick: the player at 0 px, the level, the hits and L28's cleared tags. */
export function compareRockButton(game, model) {
    const bad = [];
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (m.hits !== g.hits) bad.push(`t ${g.t}: hits game ${g.hits} model ${m.hits}`);
        if (g.cleared.join(',') !== m.written.join(',')) {
            bad.push(`t ${g.t}: L28 flags game [${g.cleared}] model [${m.written}]`);
        }
    }
    return bad;
}
