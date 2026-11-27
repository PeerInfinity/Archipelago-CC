/**
 * ⛓ SEEDLING FIDELITY DEADFRAME2 (wave 69) — the staged shapes `freezeFramesStepResponders`, `pulserDeadFrameUpdate`
 * and `blockPressesFallRockButtonSameFrame` are measured on, and their model replay. Ported from
 * `CC/docs/cloud-reports/seedling-fidelity-deadframe2-evidence/tools/stage-deadframe2.mjs` (the game streams are its
 * `d2/witness-all.json`) so the rows need no CC/ import. Each is the vanilla L38 stripped to its two teleporters and
 * `lightalpha`, plus the shape's entities, staged as wave 66's (`fidelityDeadFrame.dfStagedRecord` / `dfShapeTape`).
 *
 * L is `lock@112,48` tag 20 (`persistence_cleared` ∋ (38,20) is its type); a FallRock writes (38,22) on `fall()`. The
 * Pulser shapes read the player: the tick of its first pulse hit (and the knockback in the stream) is the Pulser's phase.
 * `compareDeadFrame2` reads the player from the drained stream and every block from the per-tick samples (the entity
 * point is the rect corner), L at game tick t against row t−1 OFF / row t with `responderStepAfterReaders` ON (wave 65's
 * alignment), the rock's fall at t against row t.
 */
import { CONTACT_FIDELITY } from './contactFidelity.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { DF_LEVEL, DF_LOCK, DF_LOCK_TAG, DF_ROCK_TAG, dfShapeTape, dfStagedRecord } from './fidelityDeadFrame.js';

export { dfShapeTape as df2ShapeTape, dfStagedRecord as df2StagedRecord };
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const rock = (x, y, t, tag) => ({ type: 'fallrock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const pulser = (x, y, t) => ({ type: 'pulser', x, y, attrs: { tset: String(t) } });

const PULSE = [latch(32, 48, 5, 21), pulser(112, 48, 5)];
const PKEY = { boot: { x: 32, y: 48 }, entities: [...PULSE, { type: 'bosskey', x: 64, y: 48, attrs: { keyType: '1' } }] };
const PHEALTH = { boot: { x: 32, y: 48 }, entities: [...PULSE, { type: 'health', x: 64, y: 48, attrs: { tag: '23' } }] };
const PCTL = { boot: { x: 32, y: 48 }, entities: [...PULSE] };
const PSPAN = { boot: { x: 32, y: 48 }, entities: [...PULSE, button(64, 48, 7), rock(192, 32, 7, DF_ROCK_TAG)] };
const SEAL = { boot: { x: 64, y: 48 },
    entities: [latch(64, 48, 5, 21), lock(112, 48, 5, DF_LOCK_TAG), { type: 'chest', x: 64, y: 32, attrs: { tag: '24' } }] };
const BROCK = { boot: { x: 32, y: 48 }, entities: [{ type: 'pushableblock', x: 64, y: 48 }, button(96, 48, 7), rock(192, 32, 7, DF_ROCK_TAG)] };
const TAPS = [[['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1]];

/**
 * Every shape: `{name, key, base, steps}`. `key` is the gap's key (`null`: a control).
 *   p-key / p-span    a Pulser latched from the boot runs through a text-less pickup's lump (150) / a button rock's span
 *                     (165); the player walks on into its ring after it;
 *   p-health(-x)      the same through a texted pickup's lump; `-x` dismisses its dialogue (primary taps) and walks on;
 *   p-ctl             the control, no dead frames;
 *   s-seal            a seal piece's ceremony (331) while L fades from the boot;
 *   b-rock            a block pushed onto a FallRock's Button.
 */
export const DF2_SHAPES = Object.freeze([
    { name: 'p-key', key: 'pulserDeadFrameUpdate', base: PKEY, steps: () => [[['right'], 140], [[], 160]] },
    { name: 'p-health', key: null, base: PHEALTH, steps: () => [[['right'], 140], [[], 160]] },
    { name: 'p-health-x', key: 'pulserDeadFrameUpdate', base: PHEALTH, steps: () => [[['right'], 30], ...TAPS, [[], 200], [['right'], 120], [[], 60]] },
    { name: 'p-ctl', key: null, base: PCTL, steps: () => [[['right'], 140], [[], 160]] },
    { name: 'p-span', key: 'pulserDeadFrameUpdate', base: PSPAN, steps: () => [[['right'], 140], [[], 160]] },
    { name: 's-seal', key: 'freezeFramesStepResponders', base: SEAL, steps: () => [[['up'], 20], [[], 240]] },
    { name: 'b-rock', key: 'blockPressesFallRockButtonSameFrame', base: BROCK, steps: () => [[['right'], 120], [[], 120]] },
]);
export const df2Shape = (name) => DF2_SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no DEADFRAME2 shape ${name}`); })();

/**
 * The model's replay: `rows[i]` after `i` advances — the player, the blocks (`[id, x, y]`), L's open, the rock's fall —
 * and the run's ledgers. Stops on a level change or a throw.
 */
export function replayDeadFrame2(tape, levelSource) {
    const rows = [];
    let run;
    let error = null;
    const snap = () => {
        const L = (run.activatorsNow?.responders ?? []).find((a) => a.id === DF_LOCK) ?? null;
        return { level: run.level, x: run.state.x, y: run.state.y, lock: L ? L.open : null,
            rock: run.rockFalls.some((r) => r.flag?.tag === DF_ROCK_TAG),
            push: run.pushables ? [...run.pushables].filter(([, r]) => !r.removed).map(([id, r]) => [id, r.rect.x, r.rect.y]) : [] };
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
    return { rows, error, rockFalls: run?.rockFalls ?? [], pulserHits: run?.pulserHits ?? [],
        deadPulserFrames: run?.deadPulserFrames ?? [], deadResponderFrames: run?.deadResponderFrames ?? [],
        blockRockPresses: run?.blockRockPresses ?? [], sealCollections: run?.sealCollections ?? [] };
}

/**
 * The model against one witnessed shape's game stream: `{compared, worstPx, first, bad: [t…], lockFirst, rockFirst,
 * gameOpen, modelOpen, gameRock, modelRock}` (ticks are game ticks; null = never). `on` picks L's row alignment.
 */
export function compareDeadFrame2(w, rows, { on = CONTACT_FIDELITY.responderStepAfterReaders } = {}) {
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    let worst = 0;
    let first = null;
    let lockFirst = null;
    let rockFirst = null;
    let compared = 0;
    const bad = [];
    for (let t = 1; t < rows.length; t++) {
        const g = game.get(t);
        const r = rows[t];
        if (!g || !r || r.level !== DF_LEVEL) continue;
        compared += 1;
        const gp = w.whole.stream[t] ?? null;
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : 0;
        const gb = g.rows.filter((x) => /PushableBlock/.test(x.cls)).map((x) => [x.x, x.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const mb = r.push.map(([, x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        if (gb.length !== mb.length) d = Infinity;
        else for (let i = 0; i < gb.length; i++) d = Math.max(d, Math.abs(gb[i][0] - mb[i][0]), Math.abs(gb[i][1] - mb[i][1]));
        if (d > 0) bad.push(t);
        if (d > worst) worst = d;
        if (d > 0 && first === null) first = t;
        const ml = on ? r.lock : (rows[t - 1]?.lock ?? null);
        if (ml !== null && ml !== g.lockOpen && lockFirst === null) lockFirst = t;
        if (r.rock !== g.rockFell && rockFirst === null) rockFirst = t;
    }
    const opensAt = (f) => { for (let t = 1; t < rows.length; t++) if (f(t)) return t; return null; };
    return { compared, worstPx: Math.round(worst * 100) / 100, first, bad, lockFirst, rockFirst,
        gameOpen: w.whole.samples.find((g) => g.lockOpen)?.tick ?? null,
        modelOpen: opensAt((t) => (on ? rows[t].lock : rows[t - 1].lock) === true),
        gameRock: w.whole.samples.find((g) => g.rockFell)?.tick ?? null,
        modelRock: opensAt((t) => rows[t].rock) };
}
