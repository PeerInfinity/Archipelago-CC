/**
 * ⛓ SEEDLING FIDELITY RESPONDERORDER (wave 65) — the staged shapes `responderStepAfterReaders` is measured on, and their
 * model replay. Wave 64's thirteen (`CC/docs/cloud-reports/seedling-fidelity-readerorder-evidence/tools/stage.mjs`,
 * game streams in its `d3/`) and wave 65's D1 witnesses (`…-responderorder-evidence/tools/stage-order.mjs`, game
 * streams in its `d2/witness-order.json`), ported here so the rows need no CC/ import. Each is the vanilla L38 stripped
 * to its two teleporters and `lightalpha`, plus the shape's entities (level data through `botLoadLevels` on the game).
 *
 * `replayShape` rows: `rows[i]` = the state after `i` advances (row 0 the boot) — the player, every reader (pushables,
 * spinners, wallflyers) and the responder R. `compareShape` reads the game stream the way wave 64's `replay-arms.mjs`
 * did: the player from the drained stream, the readers from the per-tick `botMobiles` samples, from t1; R's type at game
 * tick t against the model's R in row t-1 OFF (the step at the end of advance t-1 is the game's frame-t responder
 * update) and in row t ON (that step runs inside advance t). R is compared only when it is the tag-20 lock (its type is
 * the page's `persistence_cleared` ∋ (38,20)); a Cover's type is not on the page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { L25_TAPE } from './fidelityL25ApItem.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';

export const RO_LEVEL = 38;
export const RO_LOCK_TAG = 20;
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const cover = (x, y, t) => ({ type: 'cover', x, y, attrs: { tset: String(t) } });
const spinner = (x, y) => ({ type: 'spinner', x, y, attrs: { tag: '-1' } });

// ── wave 64's bases (stage.mjs) ──
const A1 = { resp: 'lock@112,48', boot: { x: 32, y: 48 },
    entities: [latch(32, 48, 5, 21), { type: 'pushableblock', x: 80, y: 48 }, lock(112, 48, 5, RO_LOCK_TAG)] };
const A2 = { resp: 'lock@192,48', boot: { x: 32, y: 32 },
    entities: [latch(32, 32, 6, 22), button(64, 48, 5), { type: 'pulser', x: 160, y: 48, attrs: { tset: '6' } },
        { type: 'pushableblockfire', x: 176, y: 48 }, lock(192, 48, 5, RO_LOCK_TAG)] };
const B1 = { resp: 'lock@144,224', boot: { x: 64, y: 272 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), lock(144, 224, 5, RO_LOCK_TAG), button(64, 272, 5)] };
const B2 = { resp: 'lock@144,224', boot: { x: 128, y: 224 },
    entities: [lock(144, 128, 9, -1), { type: 'wallflyer', x: 144, y: 144 }, lock(144, 224, 5, RO_LOCK_TAG), button(128, 224, 5)] };
// ── wave 65's bases (stage-order.mjs) ──
const LATCH = { resp: 'lock@112,48', boot: { x: 64, y: 48 }, entities: [latch(32, 48, 5, 21), lock(112, 48, 5, RO_LOCK_TAG)] };
const BLOCK = { resp: 'lock@192,48', boot: { x: 32, y: 48 },
    entities: [{ type: 'pushableblock', x: 64, y: 48 }, button(96, 48, 5), lock(192, 48, 5, RO_LOCK_TAG)] };
const COVER = { resp: 'cover@144,224', boot: { x: 64, y: 272 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), cover(144, 224, 5), button(64, 272, 5)] };
const LEAVE = { resp: 'lock@64,224', boot: { x: 144, y: 288 }, entities: [lock(64, 224, 5, RO_LOCK_TAG), button(144, 288, 5)] };
const SPINB = { resp: 'cover@144,224', boot: { x: 144, y: 240 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), button(144, 176, 6), cover(144, 224, 6)] };

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
const a2 = (release) => (p) => [[[], p.latch], [['right'], p.right], [['down'], p.down], [[], release - p.latch - p.right - p.down], [['up'], p.after]];
const A2P = { latch: 1, right: 24, down: 10, after: 40 };

/** Every shape: `{name, wave, base, steps}` (`steps()` → `[[keys], n]`). */
export const RO_SHAPES = Object.freeze([
    { name: 'a1-open', wave: 64, base: A1, steps: () => [[['right'], 140]] },
    { name: 'a1-ctl', wave: 64, base: A1, steps: () => [[[], 130], [['right'], 110]] },
    ...[['a2-reset', 150], ['a2-r149', 149], ['a2-r151', 151], ['a2-ctl', 140]].map(([name, r]) => ({ name, wave: 64, base: A2, steps: () => a2(r)(A2P) })),
    ...[['b1-spinner', 125], ['b1-occ', 127], ['b1-r124', 124]].map(([name, r]) => ({ name, wave: 64, base: B1, steps: () => [[[], r], [['left'], 40]] })),
    { name: 'b1-ctl', wave: 64, base: { ...B1, boot: { x: 64, y: 240 } }, steps: () => [[[], 200]] },
    ...[['b2-flyer', 10], ['b2-occ', 11]].map(([name, pause]) => ({ name, wave: 64, base: B2, steps: () => [[[], 130], [['right'], 14], [[], pause], [['right'], 30]] })),
    { name: 'b2-ctl', wave: 64, base: { ...B2, boot: { x: 144, y: 256 } }, steps: () => [[[], 60]] },
    { name: 'w-latch', wave: 65, base: LATCH, steps: () => [[['left'], 30], [[], 160]] },
    { name: 'w-latch-boot', wave: 65, base: { ...LATCH, boot: { x: 32, y: 48 } }, steps: () => [[[], 150]] },
    { name: 'w-block', wave: 65, base: BLOCK, steps: () => [[['right'], 50], [[], 130], [['right'], 60]] },
    ...[100, 104, 108, 112, 116, 120, 124, 128].map((r) => ({ name: `w-cover-${r}`, wave: 65, base: COVER, steps: () => [[[], r], [['left'], 50]] })),
    ...[110, 108, 112].map((stand) => ({ name: `w-leave-${stand}`, wave: 65, base: LEAVE, steps: () => [[[], stand], [['down'], 40]] })),
    { name: 'w-spin-button', wave: 65, base: SPINB, steps: () => [[['up'], 300]] },
]);
export const roShape = (name) => RO_SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no RESPONDERORDER shape ${name}`); })();

/** The staged L38: its teleporters and lightalpha, plus the shape's entities. Any other level passes through. */
export function roStagedRecord(rec, shape) {
    if (rec?.level !== RO_LEVEL) return rec;
    const keep = rec.entities.filter((e) => e.type === 'teleporter' || e.type === 'lightalpha');
    return { ...rec, entities: [...keep, ...shape.base.entities.map((e) => ({ ...e, attrs: e.attrs ? { ...e.attrs } : undefined }))] };
}

/** The shape's tape: the L25 survey tape's header (its rng, pins, save), booted in L38 at the shape's OEL point. */
export function roShapeTape(root, shape) {
    const { inputs, ticks } = seq(shape.steps());
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    return parseTape({ ...base, name: `readerorder-${shape.name}`, boot: { level: RO_LEVEL, x: shape.base.boot.x, y: shape.base.boot.y },
        inputs: inputs.filter((r) => r.to > r.from), tick_count: ticks });
}

/** The model's replay (rows as in the module docblock). Stops on a level change or a throw. */
export function replayShape(tape, levelSource, responderId) {
    const rows = [];
    let run;
    let error = null;
    const snap = () => {
        const R = (run.activatorsNow?.responders ?? []).find((a) => a.id === responderId) ?? null;
        const push = run.pushables ? [...run.pushables].filter(([, r]) => !r.removed).map(([id, r]) => ({ id, x: r.rect.x, y: r.rect.y })) : [];
        return { level: run.level, x: run.state.x, y: run.state.y, push,
            spin: (run.spinnerBodies ?? []).map((b) => ({ x: b.x, y: b.y })),
            fly: (run.wallFlyerBodies ?? []).map((b) => ({ x: b.x, y: b.y })),
            resp: R ? { open: R.open, alpha: R.alpha, held: R.held } : null };
    };
    try {
        run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true });
        rows.push(snap());
        for (let t = 0; t < tape.tick_count; t++) {
            run.advance(heldKeysAt(tape, t));
            rows.push(snap());
            if (run.level !== RO_LEVEL) break;
        }
    } catch (e) {
        error = { name: e?.name ?? 'Error', message: String(e?.message ?? e).slice(0, 400) };
    }
    return { rows, error, hits: run?.playerHits?.length ?? null };
}

const READ = /PushableBlock|Spinner|WallFlyer/;
/**
 * The model against one witnessed shape's game stream (`w` = a witness row: `{shape, whole: {samples, stream}}`).
 * `{compared, first: {t, px}|null, worstPx, lockFirst: {t, game, model}|null}`. `on` picks R's row alignment.
 */
export function compareShape(w, rows, { on = CONTACT_FIDELITY.responderStepAfterReaders } = {}) {
    const shape = roShape(w.shape);
    const lockSeen = shape.base.resp.startsWith('lock@');
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    let first = null;
    let worst = 0;
    let lockFirst = null;
    let compared = 0;
    for (let t = 1; t < rows.length; t++) {
        const g = game.get(t);
        const r = rows[t];
        if (!g || !r || r.level !== RO_LEVEL) continue;
        const gp = w.whole.stream[t] ?? null;
        const gr = g.rows.filter((x) => READ.test(x.cls));
        const mr = [...r.push, ...r.spin, ...r.fly];
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : Infinity;
        if (gr.length !== mr.length) d = Infinity;
        else for (let i = 0; i < gr.length; i++) d = Math.max(d, Math.abs(gr[i].x - mr[i].x), Math.abs(gr[i].y - mr[i].y));
        const ml = rows[on ? t : t - 1]?.resp?.open ?? null;
        if (lockSeen && ml !== null && ml !== g.lockOpen && lockFirst === null) lockFirst = { t, game: g.lockOpen, model: ml };
        if (d > 1e-9 && first === null) first = { t, px: +d.toFixed(4) };
        worst = Math.max(worst, d);
        compared += 1;
    }
    return { compared, first, worstPx: worst === Infinity ? Infinity : +worst.toFixed(4), lockFirst };
}
