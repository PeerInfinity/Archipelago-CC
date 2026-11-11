/**
 * ⛓⛓⛓ SEEDLING FIDELITY ROCKFIRE (wave 39) — a Fire press that reaches a BREAKABLE ROCK breaks it, exactly as a swing
 * does: `rockType <= (hasGhostSword ? 1 : 0)`, whatever the weapon.
 *
 * THE AS3 (`vendor/seedling/src`):
 *
 *     Player.fire()         :1014-1037  on sprFire frames 3..6, for i in 0..10: `collideRectInto(hitables[i], the 32x32
 *                                       rect centred on the player, vc)` — `vc` is NOT cleared between passes — then
 *                                       the radius cut and `genericHit(e, "Fire", fireForce, fireDamage)`
 *     Player.hitables       :99         `["Enemy","Grass","Tree","Rock","Rope","ShieldBoss","Solid","LightPole",
 *                                       "LavaBall","LavaBoss","Watcher"]`
 *     Player.genericHit     :1073-1092  `if (Game.freezeObjects) return;` … `else if (e is BreakableRock)
 *                                       (e as BreakableRock).hit(hasGhostSword ? 1 : 0);` — `t` is not read
 *     BreakableRock ctor    Puzzlements/BreakableRock.as:24-46  `type = "Solid"; //Was "Rock"` — so a rock is collected
 *                                       on pass i = 6 and dispatched on passes 6..10: FIVE `hit`s a hit tick (not the
 *                                       eight a "Rock" would get)
 *     BreakableRock.hit     :57-67      `if (rockType <= _t) { if (currentAnim != "break") playSound("Rock");
 *                                       play("break"); }` — `Spritemap.play` early-returns for the anim already playing,
 *                                       so dispatches 2..5 of a tick, and every later hit tick, change nothing
 *     BreakableRock.endAnim :69-73      the "break" anim's callback: `Game.setPersistence(tag, false);
 *                                       FP.world.remove(this);`
 *     BreakableRock.check   :48-55      `tag >= 0 && !Game.checkPersistence(tag)` → the room is built without it
 *
 * So: a Fire press breaks a rockType-0 rock with or without the Ghost Sword, breaks a rockType-1 (ghost) rock only with
 * the Ghost Sword held, and otherwise does nothing to it. The rock half is `breakableRocks.hitRock`, which the sword's
 * arm has driven since R5 slice 5; `levelRun.applyFire` had no arm (`FIRE_ARM_POLICY.BreakableRock` says `modelled`),
 * so a Fire press reaching a rock threw. `CONTACT_FIDELITY.fireRockArm` is the arm.
 *
 * This module is the D0 game witness's fold, shared by `scripts/procgen/probe-seedling-rock-fire.mjs` (plays the tapes on
 * the game) and `fidelityRockFire.test.js` (replays the recordings against the model at 0 px). The game exposes no rock
 * row (`botMobiles` walks `Mobile`; a rock is a plain `Entity`), so the rock is read through its two consequences, every
 * tick: its SOLID (the tapes hold the player against it, so x moves on the observation the cell opens) and its
 * PERSISTENCE WRITE (`botStatus.persistence_cleared`, which holds a flag the instant `endAnim` writes it).
 */
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROCKFIRE_WITNESS_DIR = join(HERE, 'fixtures', 'rockfire-witness');

/**
 * The persistence tags of each witness level's BreakableRocks (the atlas: L40 `@176,128` 22, `@160,144` 23, `@176,144`
 * 24; L101 `breakablerockghost@224,96` 2). The compare reads these flags only: once the cell opens the held walk goes
 * on through it and other writers fire (the Sword control reaches L40's {40,1} on obs 38), which are not this arm's.
 */
const L40_ROCK_TAGS = Object.freeze([22, 23, 24]);
const L101_ROCK_TAGS = Object.freeze([2]);

/**
 * The witness stagings: `{level, boot, hold, press, ticks, items, weapon, rock, flag}`. Every tick holds `hold` (onto
 * the rock); `primary` on input `press` (one input, or a list). `boot` is the tape's (`Game` ctor args: the entity is at +8, +8). `items` are
 * laid over the L40 pocket boot's (`fidelityTurretCircle.l40PocketBoot`: Sword, Fire, swim, torch). `weapon: 'fire'`
 * equips the Fire slot at t0. `flag` is the persistence flag `endAnim` writes; `breaks` is the AS3 reading's prediction.
 */
export const ROCKFIRE_TAPES = Object.freeze({
    /** A rockType-0 rock, Fire, NO Ghost Sword: `hit(0)`, `0 <= 0` → breaks. */
    'rockfire-l40-fire': Object.freeze({ level: 40, boot: Object.freeze({ level: 40, x: 192, y: 128 }), hold: 'left',
        press: 10, ticks: 40, items: Object.freeze({}), weapon: 'fire', rock: 'breakablerock@176,128',
        flag: Object.freeze({ level: 40, tag: 22 }), rockTags: L40_ROCK_TAGS, breaks: true }),
    /** The control: the same staging with the Sword (`fidelityRockGone`'s `rockgone-l40-plain`, plus the flag read). */
    'rockfire-l40-sword': Object.freeze({ level: 40, boot: Object.freeze({ level: 40, x: 192, y: 128 }), hold: 'left',
        press: 10, ticks: 40, items: Object.freeze({}), weapon: 'sword', rock: 'breakablerock@176,128',
        flag: Object.freeze({ level: 40, tag: 22 }), rockTags: L40_ROCK_TAGS, breaks: true }),
    /** The same rockType-0 rock, Fire, WITH the Ghost Sword held: `hit(1)`, `0 <= 1` → breaks. */
    'rockfire-l40-fire-ghost': Object.freeze({ level: 40, boot: Object.freeze({ level: 40, x: 192, y: 128 }),
        hold: 'left', press: 10, ticks: 40, items: Object.freeze({ hasGhostSword: true }), weapon: 'fire',
        rock: 'breakablerock@176,128', flag: Object.freeze({ level: 40, tag: 22 }), rockTags: L40_ROCK_TAGS, breaks: true }),
    /**
     * TWO Fire presses: input 10 breaks `@176,128` and `@176,144`; input 30 fires again with the walk standing in the
     * opened cell — the flame's rect covers the two GONE rocks' cells (the game removed them: nothing there to hit) and
     * reaches the third rock, `@160,144` {40,23}, which breaks on its own clock.
     */
    'rockfire-l40-fire-twice': Object.freeze({ level: 40, boot: Object.freeze({ level: 40, x: 192, y: 128 }), hold: 'left',
        press: Object.freeze([10, 30]), ticks: 60, items: Object.freeze({}), weapon: 'fire', rock: 'breakablerock@176,128',
        flag: Object.freeze({ level: 40, tag: 22 }), rockTags: L40_ROCK_TAGS, breaks: true }),
    /** A rockType-1 (GHOST) rock, Fire, NO Ghost Sword: `hit(0)`, `1 <= 0` is false → nothing, for the whole tape. */
    'rockfire-l101-ghostrock-fire': Object.freeze({ level: 101, boot: Object.freeze({ level: 101, x: 240, y: 96 }),
        hold: 'left', press: 10, ticks: 40, items: Object.freeze({}), weapon: 'fire',
        rock: 'breakablerockghost@224,96', flag: Object.freeze({ level: 101, tag: 2 }), rockTags: L101_ROCK_TAGS, breaks: false }),
    /** The same ghost rock, Fire, WITH the Ghost Sword held: `hit(1)`, `1 <= 1` → breaks. */
    'rockfire-l101-ghostrock-fire-ghost': Object.freeze({ level: 101, boot: Object.freeze({ level: 101, x: 240, y: 96 }),
        hold: 'left', press: 10, ticks: 40, items: Object.freeze({ hasGhostSword: true }), weapon: 'fire',
        rock: 'breakablerockghost@224,96', flag: Object.freeze({ level: 101, tag: 2 }), rockTags: L101_ROCK_TAGS, breaks: true }),
});

/** The names, in the order the probe plays them. */
export const ROCKFIRE_WITNESSES = Object.freeze(Object.keys(ROCKFIRE_TAPES));

/** The per-tick held sets of a witness. */
export function rockFirePerTick({ hold, press, ticks }) {
    const out = [];
    for (let t = 0; t < ticks; t += 1) {
        const h = new Set([hold]);
        if ([press].flat().includes(t)) h.add('primary');
        out.push(h);
    }
    return out;
}

/** A witness's tape: the L40 pocket boot's header re-pointed at the staging, `noDamage`, Fire equipped at t0. */
export async function rockFireTape(name, over = {}) {
    const spec = { ...ROCKFIRE_TAPES[name], ...over };
    if (!ROCKFIRE_TAPES[name] && !over.level) {
        throw new Error(`rockFireTape: unknown witness ${name}; known: ${ROCKFIRE_WITNESSES.join(', ')}`);
    }
    const { buildTape } = await import('./botDriverV1.js');
    const { inventorySlotsFor, INVENTORY_ITEM_IDS } = await import('./tapeFormat.js');
    const { l40PocketBoot } = await import('./fidelityTurretCircle.js');
    const base = await l40PocketBoot(spec.items, name);
    const boot = { ...spec.boot };
    const folded = buildTape(rockFirePerTick(spec), boot, name, { noclip: false, noDamage: true, noHazards: [], grants: [] });
    const slots = inventorySlotsFor(base.seam.items);
    const slot = slots.indexOf(INVENTORY_ITEM_IDS.fire);
    if (spec.weapon === 'fire' && slot < 0) throw new Error(`rockFireTape: ${name} holds no Fire slot (${JSON.stringify(slots)})`);
    return {
        ...base, name, boot, noDamage: true, tick_count: spec.ticks, inputs: folded.inputs,
        equips: spec.weapon === 'fire' && slot !== 0 ? [{ t: 0, slot }] : [],
        description: `seedling-fidelity-rockfire D0: L${spec.level} entity (${boot.x + 8},${boot.y + 8}), noDamage, `
            + `${spec.weapon === 'fire' ? 'Fire' : 'the Sword'} equipped${base.seam.items.hasGhostSword ? ', the Ghost Sword held' : ''} — hold ${spec.hold} `
            + `onto ${spec.rock}, primary on ${Array.isArray(spec.press) ? `input(s) ${spec.press.join(', ')}` : `input ${spec.press}`}; the rock's solid and its persistence write, every `
            + 'tick (probe-seedling-rock-fire.mjs)',
    };
}

/** The game poll's fold: the player and the cleared flags of the tape's own level (`persistence_cleared`). */
export function rockFireSampleOf(s, level) {
    return { t: s.tick, level: s.level, x: s.x, y: s.y,
        cleared: (s.persistence_cleared ?? []).filter((c) => c.level === level).map((c) => c.tag).sort((a, b) => a - b) };
}

/** `[t, level, x, y, "tag,tag"]`. */
export const packRockFireSample = (g) => [g.t, g.level, g.x, g.y, g.cleared.join(',')];
export function unpackRockFireSample([t, level, x, y, c]) {
    return { t, level, x, y, cleared: c === '' ? [] : String(c).split(',').map(Number) };
}

/**
 * The model's samples of a tape, by observation, under `over` (contact-fidelity keys): the player, the rocks broken
 * (`hitTick`/`goneAt`) and the Fire/Sword press ledger. `error` is the message a run threw (the OFF arm's throw is a
 * RESULT here, not a crash).
 *
 * ⛓ `written` is the model's answer to the game's `persistence_cleared` for the rocks: `endAnim` runs on update
 * `goneAt`, so the game's readout holds the flag from observation `goneAt + 1` (CLEARTAG's `modelWriteTick`
 * convention: "after T + 1 ticks").
 */
export async function rockFireModelSamples(tapeJson, over = {}) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const levelSource = atlasLevelSource();
    const tape = parseTape(JSON.stringify(tapeJson));
    const samples = [];
    let error = null;
    let presses = [];
    let rocks = [];
    withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        try {
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                const broken = run ? run.rocksBroken.filter((k) => k.level === run.level) : [];
                samples[o.t] = { t: o.t, x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                    written: broken.filter((k) => k.goneAt + 1 <= o.t && (k.tag ?? -1) >= 0).map((k) => k.tag)
                        .sort((a, b) => a - b) };
                r = st.next();
            }
        } catch (e) {
            error = e.message;
        }
        presses = run ? run.presses.map((p) => ({ t: p.t, fired: p.fired, weapon: p.weapon,
            hits: p.hits.filter((h) => h.as3 === 'BreakableRock') })) : [];
        rocks = run ? run.rocksBroken.map((k) => ({ id: k.id, hitTick: k.hitTick, goneAt: k.goneAt, tag: k.tag })) : [];
    });
    return { samples, error, presses, rocks };
}

/** The first observation whose `x` differs from the one before it, after `from` (the cell opening). */
export function firstMoveAfter(samples, from) {
    let prev = null;
    for (const s of samples) {
        if (!s) continue;
        if (s.t > from && prev && prev.t === s.t - 1 && prev.x !== s.x) return s.t;
        prev = s;
    }
    return null;
}

/** The first observation whose cleared set holds `tag` (the game's `cleared`, or the model's `written`). */
export function firstCleared(samples, tag, field = 'cleared') {
    for (const s of samples) if (s && s[field].includes(tag)) return s.t;
    return null;
}

/**
 * Compare a game witness with the model on every sampled tick before the tape's end: the player at 0 px, and the rocks'
 * flags (`tags`: the level's rock tags) — the game's cleared set equals the model's `written`.
 */
export function compareRockFireWitness(game, model, tickCount = Infinity, tags = null) {
    const bad = [];
    const mine = (l) => l.filter((c) => !tags || tags.includes(c)).join(',');
    for (const g of game) {
        if (g.t >= tickCount) continue;
        const m = model[g.t];
        if (!m) { bad.push(`t${g.t}: no model sample`); continue; }
        if (g.x !== m.x || g.y !== m.y) bad.push(`t${g.t}: player game (${g.x},${g.y}) model (${m.x},${m.y})`);
        if (g.level !== m.level) bad.push(`t${g.t}: level game ${g.level} model ${m.level}`);
        if (mine(g.cleared) !== mine(m.written)) bad.push(`t${g.t}: rock flags written game [${mine(g.cleared)}] model [${mine(m.written)}]`);
    }
    return bad;
}

/** A recorded witness (`fixtures/rockfire-witness/<name>.json`). */
export function rockFireWitness(name) {
    return JSON.parse(readFileSync(join(ROCKFIRE_WITNESS_DIR, `${name}.json`), 'utf8'));
}
