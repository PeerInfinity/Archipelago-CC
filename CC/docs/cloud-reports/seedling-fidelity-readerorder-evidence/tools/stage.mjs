// Staging for fidelity READERORDER (wave 64): the reader-before-responder shapes, each staged in the VANILLA L38 as
// level data (`botLoadLevels`, its own `set_id`; no game edit). L38 is stripped to its two teleporters and its
// `lightalpha`, and each shape adds its own entities. Groups 5/6/9 and tags 20-29 are free in the stripped room.
//
// The responder is always a plain `Lock` with a tag, because `Lock.turnOff` / `returnToNormal` write
// `Game.setPersistence(tag, …)` ON THE TRANSITION (`Lock.as:90-107`), so the page's `persistence_cleared` at a
// hold-cut IS the lock's `type` at that frame ("cleared" = `""`, open). A Cover writes nothing, so its type is not
// readable on the page; that is why no shape uses one.
//
// The tape's `boot` is OEL coordinates: the player's entity origin lands 8 px right and down of it.
// Shapes (the `params` are the knobs the search in `search.mjs` sets; the defaults are the chosen ones):
//   a1-open     A1: a PushableBlock pushed (by the player) against lock L; L's group is latched by a ButtonRoom the
//               player boots on, so L opens 101+ frames later WHILE the block presses on it.
//   a1-ctl      control: the same room, the player waits on the latch until L is open, then pushes.
//   a2-reset    A2: a PushableBlockFire driven by a Pulser (latched group 6) into lock L (group 5, a plain Button the
//               player holds). The player steps off at `release`, so L resets when the pulse drives the block in.
//   a2-ctl      control: the same, released early (L shut well before the pulse).
//   b1-spinner  B1: a Spinner bouncing in the col-9 corridor between a static lock (row 8) and L (row 14), L on a
//               Button the player holds in the lower room; released so L resets as the spinner reaches it.
//   b1-ctl      control: no press (L never moves).
//   b2-flyer    B2: a WallFlyer at the corridor's sealed top (`decideMotion` d=7: south) launched by the player in L's
//               box; the player held L's Button, stepped into L's box (Player occupancy), and leaves it so L resets
//               as the flyer arrives.
//   b2-ctl      control: no press; the player triggers the flyer from below a shut L.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(`${ROOT}frontend/modules/seedlingDemo/${p}`);
const { L25_TAPE } = await M('fidelityL25ApItem.js');
const { heldKeysAt, parseTape } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');

export const LEVEL = 38;
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
export const L_ID = (s) => `lock@${s.lock.x},${s.lock.y}`;
export const L_TAG = 20;

const A1 = { lock: { x: 112, y: 48 }, boot: { x: 32, y: 48 },
    entities: [latch(32, 48, 5, 21), { type: 'pushableblock', x: 80, y: 48 }, lock(112, 48, 5, L_TAG)] };
const A2 = { lock: { x: 192, y: 48 }, boot: { x: 32, y: 32 },
    entities: [latch(32, 32, 6, 22), button(64, 48, 5), { type: 'pulser', x: 160, y: 48, attrs: { tset: '6' } },
        { type: 'pushableblockfire', x: 176, y: 48 }, lock(192, 48, 5, L_TAG)] };
const B1 = { lock: { x: 144, y: 224 }, boot: { x: 64, y: 272 },
    entities: [lock(144, 128, 9, -1), { type: 'spinner', x: 144, y: 160, attrs: { tag: '-1' } }, lock(144, 224, 5, L_TAG), button(64, 272, 5)] };
const B2 = { lock: { x: 144, y: 224 }, boot: { x: 128, y: 224 },
    entities: [lock(144, 128, 9, -1), { type: 'wallflyer', x: 144, y: 144 }, lock(144, 224, 5, L_TAG), button(128, 224, 5)] };

/** Inputs per shape from its params. Each returns `[{key, from, to}]` and the tick count. */
const seq = (steps) => {
    const inputs = [];
    let t = 0;
    for (const [keys, n] of steps) {
        for (const k of keys) inputs.push({ key: k, from: t, to: t + n });
        t += n;
    }
    return { inputs, ticks: t };
};
export const SHAPES = [
    // (A1) the block presses on L from t64; L opens after step 101 (model). `meet` = the reader's first crossing tick.
    { name: 'a1-open', base: A1, pairing: 'A', meet: 102, expect: 'A pushableblock → lock (open only: a latch)', defaults: { walk: 140 },
        steps: (p) => [[['right'], p.walk]] },
    { name: 'a1-ctl', base: A1, pairing: 'A', meet: null, expect: 'the same pair as a1-open', defaults: { wait: 130, walk: 110 },
        steps: (p) => [[[], p.wait], [['right'], p.walk]] },
    // (A2) the pulse after L opens pushes once at t155; the block's first move is tick 156. release 150: L open after
    // S154, shut after S155 (the meeting). 149 / 151 bracket it (both readings agree); 140 is the far control.
    ...[['a2-reset', 150, 156], ['a2-r149', 149, null], ['a2-r151', 151, null], ['a2-ctl', 140, null]].map(([name, release, meet]) => ({
        name, base: A2, pairing: 'A', meet, expect: 'A pushableblockfire → lock, reset Y', defaults: { latch: 1, right: 24, down: 10, release, after: 40 },
        steps: (p) => [[[], p.latch], [['right'], p.right], [['down'], p.down], [[], p.release - p.latch - p.right - p.down], [['up'], p.after]] })),
    // (B1) the spinner first crosses L's top on tick 132. release 125: L open after S130, shut after S131 (the
    // meeting). 127: the spinner is inside L's box when the model shuts it (the Enemy-occupancy case).
    ...[['b1-spinner', 125, 132], ['b1-occ', 127, null]].map(([name, release, meet]) => ({
        name, base: B1, pairing: 'B', meet, expect: 'B spinner → lock, reset Y', defaults: { release, after: 40 },
        steps: (p) => [[[], p.release], [['left'], p.after]] })),
    { name: 'b1-ctl', base: { ...B1, boot: { x: 64, y: 240 } }, pairing: 'B', meet: null, expect: 'the same pair (never pressed)', defaults: { stand: 200 },
        steps: (p) => [[[], p.stand]] },
    // (B2) the flyer launches at t143 and first crosses L's top on tick 160. pause 10: L open after S158, shut after
    // S159 (the meeting). 11: the flyer is inside L's box when the model shuts it.
    ...[['b2-flyer', 10, 160], ['b2-occ', 11, null]].map(([name, pause, meet]) => ({
        name, base: B2, pairing: 'B', meet, expect: 'B wallflyer → lock, reset Y', defaults: { wait: 130, toLine: 14, pause, out: 30 },
        steps: (p) => [[[], p.wait], [['right'], p.toLine], [[], p.pause], [['right'], p.out]] })),
    { name: 'b2-ctl', base: { ...B2, boot: { x: 144, y: 256 } }, pairing: 'B', meet: null, expect: 'the same pair (never pressed)', defaults: { stand: 60 },
        steps: (p) => [[[], p.stand]] },
];
export const shape = (name) => SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no shape ${name}`); })();

/** The staged L38: its teleporters and lightalpha, plus the shape's entities. Any other level passes through. */
export function stagedRecord(rec, s) {
    if (rec?.level !== LEVEL) return rec;
    const keep = rec.entities.filter((e) => e.type === 'teleporter' || e.type === 'lightalpha');
    return { ...rec, entities: [...keep, ...s.base.entities.map((e) => ({ ...e, attrs: e.attrs ? { ...e.attrs } : undefined }))] };
}

export function shapeTape(s, params = {}) {
    const p = { ...s.defaults, ...params };
    const { inputs, ticks } = seq(s.steps(p));
    const base = JSON.parse(readFileSync(join(ROOT, L25_TAPE), 'utf8'));
    return parseTape({ ...base, name: `readerorder-${s.name}`, boot: { level: LEVEL, x: s.base.boot.x, y: s.base.boot.y },
        inputs: inputs.filter((r) => r.to > r.from), tick_count: ticks });
}

/**
 * The model's replay: `rows[i]` = the state after `i` completed ticks (row 0 = the boot): the player, every reader
 * (pushables, spinners, wallflyers), lock L's state, and the lock events. Stops on a level change or a throw.
 */
export function replay(tape, levelSource, { capabilities = null, lockId = null } = {}) {
    const rows = [];
    let run;
    let error = null;
    const snap = () => {
        const acts = run.activatorsNow?.responders ?? [];
        const L = lockId ? acts.find((a) => a.id === lockId) : null;
        const push = run.pushables ? [...run.pushables].filter(([, r]) => !r.removed).map(([id, r]) => ({ id, x: r.rect.x, y: r.rect.y })) : [];
        return { level: run.level, x: run.state.x, y: run.state.y,
            push, spin: (run.spinnerBodies ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y })),
            fly: (run.wallFlyerBodies ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
            lock: L ? { open: L.open, alpha: L.alpha, held: L.held } : null };
    };
    try {
        run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true, capabilities });
        rows.push(snap());
        for (let t = 0; t < tape.tick_count; t++) {
            run.advance(heldKeysAt(tape, t));
            rows.push(snap());
            if (run.level !== LEVEL) break;
        }
    } catch (e) {
        error = { name: e?.name ?? 'Error', message: String(e?.message ?? e).slice(0, 400) };
    }
    return { rows, error };
}
