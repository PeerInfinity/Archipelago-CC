/**
 * seedling-fidelity-firepush — L40's Boss Key 2 behind `pushableblockfire@576,576`, moved by the room's PULSER
 * (`CONTACT_FIDELITY.fireBlockPulseShove`): the game witness's plan, the model's samples, the game poll's fold and the
 * comparison. Shared by `scripts/procgen/probe-seedling-fire-push.mjs` (plays it on the game, `--record`) and
 * `fidelityFirePush.test.js` (replays the recording against the model at 0 px).
 *
 * THE CHAIN (r5Totem `L40_ARRIVAL_BREAK` + its R7 slice 3 supersession): from the L40 arrival (480,896) the key's
 * corridor north is the one-tile column x=36, plugged by the fire block at (36,36) under the walk block
 * `pushableblock@576,560` (36,35). A Fire press from the south drives the fire block NORTH into the walk block (a
 * `"Solid"` to it), so nothing moves; the room's answer is `pulser@592,576` (37,36), whose publisher is the momentary
 * `button@816,400` {t 4} — behind `wandlock@800,400`, whose only opener is the momentary `button@768,400` {t 5}, which
 * needs a HOLDER. R7 slice 3 found it: `pushableblockfire@480,480`, pushed there by Fire once the ice turret's corpse
 * holds `button@480,384` {t 2} (`r5-l40-part5`'s own legs).
 *
 * The witness `firepush-l40-bosskey2` is that chain in one visit:
 *   1. `r5-l40-part5`'s legs verbatim (the t3 room latch, the turret kill, two `fire.bumps` onto t2, the t2 wait);
 *   2. `FIREPUSH_ROUTE`: 35 Fire presses that walk `pushableblockfire@480,480` from (30,30) to the t5 button (48,25)
 *      — E4 through the open t2 lock, N6 up column 34, E11 along row 24, W1 (the only way to stand north of it), S5
 *      down column 44, E4 along row 29, N4 up column 48 — and a wait for `wandlock@800,400` to open (a SCRIPTED
 *      prefix: the solver's block-route search has no Fire move, which is FIREPUSH's residue);
 *   3. the SOLVER's plan for the key from there, the key ON: hold `button@816,400` until the pulse has parked the fire
 *      block in the west pocket (35,36), shove the walk block north k=3, collect the key.
 *
 * ⚠ The tape is `noDamage` — `r5-l40-part5`'s own relax (its kill stance is inside the turret's attack range), kept
 * for the prefix it shares. The witness is of positions: the player and every pushable block, every tick.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const FIREPUSH_WITNESS_DIR = join(HERE, 'fixtures', 'firepush-witness');
export const FIREPUSH_WITNESS = 'firepush-l40-bosskey2';

/** The switches the witness is planned and replayed under: this slice's key (the rest at their defaults). */
export const FIREPUSH_SWITCHES = Object.freeze({ fireBlockPulseShove: true, fireLiveTurretReach: true,
    pulserPublishLag: true });

/** Boss Key 2's placement (`bosskey@656,528`), the goal the sweep's legs 869/870 ask. */
export const FIREPUSH_GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 656, y: 528 }) });

/** The 35 presses, as runs of one direction: `[dx, dy, count]` from (30,30). */
const ROUTE_RUNS = Object.freeze([[1, 0, 4], [0, -1, 6], [1, 0, 11], [-1, 0, 1], [0, 1, 5], [1, 0, 4], [0, -1, 4]]);

/** Each press: the stance cell (the block's far side), the block's cell before and after. */
export const FIREPUSH_ROUTE = Object.freeze((() => {
    const out = [];
    let at = [30, 30];
    for (const [dx, dy, n] of ROUTE_RUNS) {
        for (let i = 0; i < n; i += 1) {
            const to = [at[0] + dx, at[1] + dy];
            out.push(Object.freeze({ stance: Object.freeze({ tx: at[0] - dx, ty: at[1] - dy }),
                from: Object.freeze({ tx: at[0], ty: at[1] }), to: Object.freeze({ tx: to[0], ty: to[1] }) }));
            at = to;
        }
    }
    return out;
})());

const ENEMY_ROOM = 'seedling-fidelity-firepush: each press glides `pushableblockfire@480,480` one tile inside the '
    + 'east loop (rows 24-30, cols 30-48), whose nearest chaser spawn is bob@352,416 (22,26) beyond the t2 lock; the '
    + 'declaration is answered by the recording (`firepush-l40-bosskey2`, every block position, every tick).';

const centre = (c) => ({ x: c.tx * 16 + 8, y: c.ty * 16 + 8 });

/**
 * Idle ticks after the t5 wait, before the solver's tail — a WINDOW, not a mechanic: `spinner@880,848` roams the
 * south-east loop and the tape declares no `Game.time`, so the danger map prices its hammer as the union over all 45
 * phases; at idle 0, 20 … 300 the walk back to the corridor meets that union at row 42 and the ladder refuses
 * (measured), at 500 it does not.
 */
export const FIREPUSH_IDLE = 500;

/** The scripted prefix (steps 1 and 2): `r5-l40-part5`'s targets, then the 35 presses and the t5 wait. */
export async function firePushPrefixTape(idle = FIREPUSH_IDLE) {
    const { synthesizeLegs } = await import('./botDriverV2.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { L40_ARRIVAL, L40_CORPSE } = await import('./r5Totem.js');
    const TURRET = L40_CORPSE.turret.id;
    const STANCE = { x: 488, y: 440 };
    const SECOND_BUMP = { x: 488, y: 424 };
    const PART5_ENEMY_ROOM = 'the corpse glides two tiles NORTH inside col 30, rows 24-26, and the '
        + 'whole leg stands at (488,440). L40\'s nearest chaser to that column is '
        + 'bob@352,416, 132 px away against a `runRange` of 80 — measured from SPAWN, which '
        + 'is a fact about the map and not about the walk, and is exactly why this is a '
        + 'declaration answered by a recording rather than a prediction.';
    const last = FIREPUSH_ROUTE.at(-1);
    const targets = [
        // r5-l40-part5's targets (`plan-seedling-r5-l40-part5.mjs`), verbatim
        { x: 888, y: 776, hold: { opens: 'wandlock@480,560', ticks: 110, presser: { x: 880, y: 768 } } },
        { ...STANCE, equip: { slot: 0 } },
        { ...STANCE, kill: { id: TURRET, facing: 'N' } },
        { ...STANCE, equip: { slot: 1 } },
        { ...STANCE, fire: { bumps: [{ id: TURRET, to: { tx: 30, ty: 25 } }], enemyRoom: PART5_ENEMY_ROOM } },
        // ⛓ FIREPUSH: the second bump from ONE TILE NEARER — from (488,440) the flame no longer reaches the corpse at
        // (488,407.5) (the game, p4g; `fireLiveTurretReach`), which is where `r5-l40-part5` and the game part
        { ...SECOND_BUMP, fire: { bumps: [{ id: TURRET, to: { tx: 30, ty: 24 } }], enemyRoom: PART5_ENEMY_ROOM } },
        { ...STANCE, wait: { opens: 'wandlock@448,432', ticks: 140,
            why: 'the ICE TURRET CORPSE is standing on button@480,384 {t 2}' } },
        // FIREPUSH: the 35 presses
        ...FIREPUSH_ROUTE.map((p) => ({ ...centre(p.stance),
            fire: { moves: [{ from: { ...p.from }, to: { ...p.to } }], enemyRoom: ENEMY_ROOM } })),
        { ...centre(last.from), wait: { opens: 'wandlock@800,400', ticks: 200,
            why: '`pushableblockfire@480,480` is standing on button@768,400 {t 5}, a `"Solid"` in `Button.hitables`' } },
    ];
    const { withContactFidelity } = await import('./contactFidelity.js');
    const out = withContactFidelity(FIREPUSH_SWITCHES, () => synthesizeLegs([{ level: 40, targets }], {
        levelSource: atlasLevelSource(),
        boot: { level: 40, ...L40_ARRIVAL.boot },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 40, items: ['sword', 'fire', 'conch', 'feather'] }],
            persistence: [
                { level: 40, tag: 13, note: 'chest@880,816 — link 1, banked in the join window' },
                { level: 40, tag: 0, note: 'burnabletree@872,784 — link 2, banked in the join window' },
            ],
            equips: [],
            pins: ['dead_frames'],
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        },
        name: `${FIREPUSH_WITNESS}-prefix`,
        lattice: L40_ARRIVAL.lattice,
        allowGrazes: true,
        maxTicksPerTarget: 6000,
    }));
    if (!idle) return out.tape;
    // the idle tail: stand still `idle` ticks after the t5 wait (the witness's spinner window — see `FIREPUSH_IDLE`)
    const { buildTape } = await import('./botDriverV1.js');
    const { parseTape, heldKeysAt } = await import('./tapeFormat.js');
    const t = parseTape(JSON.stringify(out.tape));
    const perTick = [];
    for (let i = 0; i < t.tick_count; i += 1) perTick.push(new Set(heldKeysAt(t, i)));
    for (let i = 0; i < idle; i += 1) perTick.push(new Set());
    const folded = buildTape(perTick, t.boot, out.tape.name, { noclip: false, noDamage: true, noHazards: [], grants: [] });
    return { ...out.tape, tick_count: perTick.length, inputs: folded.inputs };
}

/**
 * The solver's plan for the key from the end of a prefix tape (`solveSegment` with the prefix, a fresh fork run per
 * try, as the page solves a continuation). `over` = the switches (default: the key ON). Returns `{out, refusal}`.
 */
export async function firePushTail(prefixTape, over = FIREPUSH_SWITCHES) {
    const { parseTape, heldKeysAt } = await import('./tapeFormat.js');
    const { createRunForStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { solveSegment } = await import('./solverBot.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(prefixTape));
    const levelSource = atlasLevelSource();
    const staging = stagingFromTape(tape);
    const prefix = [];
    for (let t = 0; t < tape.tick_count; t += 1) prefix.push(new Set(heldKeysAt(tape, t)));
    return withContactFidelity(over, () => {
        const run = createRunForStaging(staging, levelSource);
        for (const k of prefix) run.advance(k);
        try {
            const out = solveSegment({ run, goals: [FIREPUSH_GOAL], name: FIREPUSH_WITNESS, boot: staging.boot, prefix,
                dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
            return { out, refusal: null, staging };
        } catch (e) {
            return { out: null, refusal: e, staging };
        }
    });
}

/**
 * The witness tape: the prefix and the solver's tail (the key ON), with an idle tail for the poll. ⚠ Folded onto the
 * PREFIX's own header (`noDamage` and all) rather than `buildStagedTape`'s, which writes an honest header — the tail
 * was solved on the prefix's run, so the tape must replay that run.
 */
export async function firePushTape() {
    const { buildTape } = await import('./botDriverV1.js');
    const prefixTape = await firePushPrefixTape();
    const { out, refusal } = await firePushTail(prefixTape);
    if (!out) throw refusal;
    const perTick = [...out.perTick, ...Array.from({ length: 30 }, () => new Set())];
    const folded = buildTape(perTick, prefixTape.boot, FIREPUSH_WITNESS,
        { noclip: false, noDamage: true, noHazards: [], grants: [] });
    const tape = { ...prefixTape, name: FIREPUSH_WITNESS,
        equips: [...(prefixTape.equips ?? []), ...(out.equips ?? [])], tick_count: perTick.length, inputs: folded.inputs };
    return { prefixTape, out, tape: { ...tape, description: 'seedling-fidelity-firepush: L40 from the arrival — '
        + '`r5-l40-part5`\'s legs, 35 Fire presses parking `pushableblockfire@480,480` on button@768,400 {t 5}, then '
        + 'the solver (the key ON): hold button@816,400 until pulser@592,576 has pushed `pushableblockfire@576,576` '
        + 'west, shove the walk block north, collect Boss Key 2 (probe-seedling-fire-push.mjs)' } };
}

const BLOCK_CLASS = /(^|:)(PushableBlockFire|PushableBlock)$/;

/** The game poll's fold: the player and every pushable block (`botStatus` + `botMobiles`). */
export function firePushSampleOf(s, m) {
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y,
        blocks: (m.mobiles ?? []).filter((r) => BLOCK_CLASS.test(r.cls))
            .map((r) => ({ cls: r.cls.split(':').at(-1), x: r.x, y: r.y })),
        // the ice turret's corpse (`r5-l40-part5`'s t2 holder) — read, not compared
        turrets: (m.mobiles ?? []).filter((r) => /(^|:)IceTurret$/.test(r.cls))
            .map((r) => ({ x: r.x, y: r.y, anim: r.anim, type: r.type })),
    };
}

/**
 * The recording's compact row: `[t, level, x, y, blocks, corpse]` — `blocks` is `cls:x,y` joined by `;` (`F` a
 * `PushableBlockFire`, `P` a `PushableBlock`), `corpse` the dead turret's `x,y` or `''`.
 */
export function packFirePushSample(g) {
    const code = (cls) => (cls === 'PushableBlockFire' ? 'F' : (cls === 'PushableBlock' ? 'P' : cls));
    const corpse = (g.turrets ?? []).find((c) => c.anim === 'dead');
    return [g.t, g.level, g.x, g.y, (g.blocks ?? []).map((b) => `${code(b.cls)}:${b.x},${b.y}`).join(';'),
        corpse ? `${corpse.x},${corpse.y}` : ''];
}

/** The inverse of `packFirePushSample` (the corpse comes back as `turrets: [{x, y, anim: 'dead'}]`). */
export function unpackFirePushSample(row) {
    const [t, level, x, y, blocks, corpse] = row;
    const cls = (c) => (c === 'F' ? 'PushableBlockFire' : (c === 'P' ? 'PushableBlock' : c));
    return {
        t, level, x, y,
        blocks: blocks ? blocks.split(';').map((b) => {
            const [c, xy] = b.split(':');
            const [bx, by] = xy.split(',').map(Number);
            return { cls: cls(c), x: bx, y: by };
        }) : [],
        turrets: corpse ? [{ x: Number(corpse.split(',')[0]), y: Number(corpse.split(',')[1]), anim: 'dead' }] : [],
    };
}

/** The model's samples of a tape, by tape tick (`createTapeStepper`'s observations), under `over`. */
export async function firePushModelSamples(tapeJson, over = FIREPUSH_SWITCHES) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let error = null;
    let pushes = [];
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const rows = run ? (run.world.pushables ?? []) : [];
                const live = run ? run.entities('pushables') : null;
                samples[o.t] = {
                    x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    blocks: live ? rows.map((p) => ({ id: p.id, cls: p.as3, b: live.get(p.id) }))
                        .filter((p) => p.b && !p.b.removed)
                        .map((p) => ({ id: p.id, cls: p.cls, x: p.b.rect.x, y: p.b.rect.y })) : [],
                };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        pushes = run ? (run.ledger('pulserPushes') ?? []).map((p) => ({ ...p })) : [];
    });
    return { samples, error, pushes };
}

/** Compare a game witness with the model, every sampled tick: the player, and each class's blocks by position. */
export function compareFirePushWitness(game, model) {
    const bad = [];
    const key = (b) => `${b.cls}@${b.x},${b.y}`;
    for (const g of game) {
        const m = model[g.t];
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.x !== g.x || m.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${m.x}, ${m.y})`);
        if (m.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${m.level}`);
        if (g.level !== 40 || m.level !== 40) continue;
        const gs = (g.blocks ?? []).map(key).sort();
        const ms = m.blocks.map(key).sort();
        if (gs.join(' ') !== ms.join(' ')) bad.push(`t ${g.t}: blocks game [${gs.join(' ')}] model [${ms.join(' ')}]`);
    }
    return bad;
}
