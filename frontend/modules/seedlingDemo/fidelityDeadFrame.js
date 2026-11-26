/**
 * ⛓ SEEDLING FIDELITY DEADFRAME (wave 66) — the staged shapes `deadFrameResponderStep` and `enemyPressesFallRockButton`
 * are measured on, and their model replay. Ported from `CC/docs/cloud-reports/seedling-fidelity-deadframe-evidence/
 * tools/stage-deadframe.mjs` (game streams in its `d2/witness-all.json` and `d2/witness-edges.json`) so the rows need no
 * CC/ import. Each is the vanilla L38 stripped to its two teleporters and `lightalpha`, plus the shape's entities (level
 * data through `botLoadLevels` on the game), as waves 64 and 65 stage.
 *
 * L is `lock@112,48` tag 20 (its type is the page's `persistence_cleared` ∋ (38,20)); a FallRock writes (38,22) false on
 * `fall()`, so the page shows the frame it falls. `compareDeadFrame` reads the game stream as wave 65's `compareShape`
 * does — the player from the drained stream, the spinners / wallflyers from the per-tick samples, from t1 — and L's type
 * at game tick t against the model's L in row t−1 OFF (`responderStepAfterReaders` OFF: the step at the end of advance
 * t−1 is the game's frame-t responder update) or row t ON; the rock's fall at game tick t against row t (a fall is
 * charged in its frame-A advance both ways).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { L25_TAPE } from './fidelityL25ApItem.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';

export const DF_LEVEL = 38;
export const DF_LOCK_TAG = 20;
export const DF_ROCK_TAG = 22;
export const DF_LOCK = 'lock@112,48';
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const cover = (x, y, t) => ({ type: 'cover', x, y, attrs: { tset: String(t) } });
const rock = (x, y, t, tag) => ({ type: 'fallrock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const spinner = (x, y) => ({ type: 'spinner', x, y, attrs: { tag: '-1' } });

const LATCH = [latch(32, 48, 5, 21), lock(112, 48, 5, DF_LOCK_TAG)];
const KEY = { boot: { x: 32, y: 48 }, entities: [...LATCH, { type: 'bosskey', x: 64, y: 48, attrs: { keyType: '1' } }] };
const HEALTH = { boot: { x: 32, y: 48 }, entities: [...LATCH, { type: 'health', x: 64, y: 48, attrs: { tag: '23' } }] };
const SPAN = { boot: { x: 32, y: 48 }, entities: [...LATCH, button(64, 48, 7), rock(192, 48, 7, DF_ROCK_TAG)] };
const FLY = (t, extra) => ({ boot: { x: 144, y: 256 },
    entities: [lock(144, 128, 9, -1), { type: 'wallflyer', x: 144, y: 144 }, button(144, 208, t), lock(144, 224, 9, -1), ...extra] });
const SPINR = { boot: { x: 144, y: 240 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), button(144, 176, 7), cover(144, 224, 9), rock(64, 272, 7, DF_ROCK_TAG)] };

/**
 * Every shape: `{name, gap, base, steps}` (`steps()` → `[[keys], n]`). `gap`: 1 the dead frames, 2 the wallflyer's press,
 * 3 an enemy on a FallRock's Button. The `-at<T>` edges put the contact (d-key, d-health) at advance #T and the rock's
 * frame A (d-span) at advance #T+1, around L's opening frame (102 from the boot).
 */
export const DF_SHAPES = Object.freeze([
    { name: 'd-key', gap: 1, base: KEY, steps: () => [[['right'], 22], [[], 200]] },
    { name: 'd-health', gap: 1, base: HEALTH, steps: () => [[['right'], 30], [[], 260]] },
    { name: 'd-span', gap: 1, base: SPAN, steps: () => [[['right'], 22], [[], 200]] },
    { name: 'w-fly-rest', gap: 2, base: FLY(6, [lock(112, 48, 6, DF_LOCK_TAG)]), steps: () => [[[], 220]] },
    { name: 'e-fly-rock', gap: 3, base: FLY(7, [rock(64, 272, 7, DF_ROCK_TAG)]), steps: () => [[[], 260]] },
    { name: 'e-spin-rock', gap: 3, base: SPINR, steps: () => [[['up'], 300]] },
    ...[100, 101, 102, 103].flatMap((T) => [
        { name: `d-key-at${T}`, gap: 1, base: KEY, steps: () => [[[], T - 24], [['right'], 22], [[], 60]] },
        { name: `d-health-at${T}`, gap: 1, base: HEALTH, steps: () => [[[], T - 26], [['right'], 30], [[], 120]] },
        { name: `d-span-at${T}`, gap: 1, base: SPAN, steps: () => [[[], T - 24], [['right'], 22], [[], 60]] },
    ]),
]);
export const dfShape = (name) => DF_SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no DEADFRAME shape ${name}`); })();

/** `[[keys], n]` runs → the tape's inputs and its tick count. */
const seq = (steps) => {
    const inputs = [];
    let t = 0;
    for (const [keys, n] of steps) {
        for (const k of keys) inputs.push({ key: k, from: t, to: t + n });
        t += n;
    }
    return { inputs, ticks: t };
};

/** The staged L38: its teleporters and lightalpha, plus the shape's entities. Any other level passes through. */
export function dfStagedRecord(rec, shape) {
    if (rec?.level !== DF_LEVEL) return rec;
    const keep = rec.entities.filter((e) => e.type === 'teleporter' || e.type === 'lightalpha');
    return { ...rec, entities: [...keep, ...shape.base.entities.map((e) => ({ ...e, attrs: e.attrs ? { ...e.attrs } : undefined }))] };
}

/** The shape's tape: the L25 survey tape's header (its rng, pins, save), booted in L38 at the shape's OEL point. */
export function dfShapeTape(root, shape) {
    const { inputs, ticks } = seq(shape.steps());
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    return parseTape({ ...base, name: `readerorder-${shape.name}`, boot: { level: DF_LEVEL, x: shape.base.boot.x, y: shape.base.boot.y },
        inputs: inputs.filter((r) => r.to > r.from), tick_count: ticks });
}

/**
 * The model's replay: `rows[i]` = the state after `i` advances (row 0 the boot) — the player, the spinners and
 * wallflyers, L's open and whether the rock (tag 22) has fallen — plus the run's `rockFalls`. Stops on a level change
 * or a throw.
 */
export function replayDeadFrame(tape, levelSource) {
    const rows = [];
    let run;
    let error = null;
    const snap = () => {
        const L = (run.activatorsNow?.responders ?? []).find((a) => a.id === DF_LOCK) ?? null;
        return { level: run.level, x: run.state.x, y: run.state.y, lock: L ? L.open : null,
            rock: run.rockFalls.some((r) => r.flag?.tag === DF_ROCK_TAG),
            readers: [...(run.spinnerBodies ?? []).map((b) => [b.x, b.y]), ...(run.wallFlyerBodies ?? []).map((b) => [b.x, b.y])] };
    };
    try {
        run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true });
        rows.push(snap());
        for (let t = 0; t < tape.tick_count; t++) {
            run.advance(heldKeysAt(tape, t));
            rows.push(snap());
            if (run.level !== DF_LEVEL) break;
        }
    } catch (e) {
        error = { name: e?.name ?? 'Error', message: String(e?.message ?? e).slice(0, 400) };
    }
    return { rows, error, rockFalls: run?.rockFalls ?? [], deadResponderFrames: run?.deadResponderFrames ?? [],
        enemyRockPresses: run?.enemyRockPresses ?? [], hits: run?.playerHits?.length ?? null };
}

/**
 * The model against one witnessed shape's game stream. `{compared, first: {t, px}|null, worstPx, lockFirst, rockFirst,
 * gameOpen, modelOpen, gameRock, modelRock}` (ticks are game ticks; null = never). `on` picks L's row alignment.
 */
export function compareDeadFrame(w, rows, { on = CONTACT_FIDELITY.responderStepAfterReaders } = {}) {
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    let first = null;
    let worst = 0;
    let lockFirst = null;
    let rockFirst = null;
    let compared = 0;
    for (let t = 1; t < rows.length; t++) {
        const g = game.get(t);
        const r = rows[t];
        if (!g || !r || r.level !== DF_LEVEL) continue;
        const gp = w.whole.stream[t] ?? null;
        const gr = g.rows.filter((x) => /Spinner|WallFlyer/.test(x.cls)).map((x) => [x.x, x.y]);
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : Infinity;
        if (gr.length !== r.readers.length) d = Infinity;
        else for (let i = 0; i < gr.length; i++) d = Math.max(d, Math.abs(gr[i][0] - r.readers[i][0]), Math.abs(gr[i][1] - r.readers[i][1]));
        const ml = rows[on ? t : t - 1]?.lock ?? null;
        if (ml !== null && ml !== g.lockOpen && lockFirst === null) lockFirst = { t, game: g.lockOpen, model: ml };
        if (r.rock !== g.rockFell && rockFirst === null) rockFirst = { t, game: g.rockFell, model: r.rock };
        if (d > 1e-9 && first === null) first = { t, px: +d.toFixed(4) };
        worst = Math.max(worst, d);
        compared += 1;
    }
    const gameOpen = w.whole.samples.find((g) => g.lockOpen)?.tick ?? null;
    const gameRock = w.whole.samples.find((g) => g.rockFell)?.tick ?? null;
    const iL = rows.findIndex((r) => r.lock);
    const iR = rows.findIndex((r) => r.rock);
    return { compared, first, worstPx: worst === Infinity ? Infinity : +worst.toFixed(4), lockFirst, rockFirst,
        gameOpen, modelOpen: iL < 0 ? null : (on ? iL : iL + 1), gameRock, modelRock: iR < 0 ? null : iR };
}
