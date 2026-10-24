/**
 * seedlingDemo/fidelityArrival — **AN ARRIVAL INSIDE A SOLID, AND THE SAVED
 * FLAG THAT DECIDES WHETHER THE SOLID IS THERE** (Seedling fidelity ARRIVAL).
 *
 * ⚖ The user (2026-10-05): *"Arrival inside a solid should only happen if we
 * play the game out of order. The proper fix for this might be to restart
 * using the menu, or just take a different path. The broken state of some
 * obstacles is saved in the save data."*
 *
 * ⛓ THE GAME'S RULE. A door lands the player at its `(playerx, playery)` in a
 * `new Game(to, …)`; `Game.update` runs `check()` on every entity on that
 * world's first frame, and every class below removes itself there when its
 * persistence flag is CLEARED (`Game.checkPersistence(tag)` false — the save's
 * "broken / burned / opened"):
 *
 *     BreakableRock.check(): if (tag >= 0 && !Game.checkPersistence(tag)) FP.world.remove(this);
 *     BreakableRock.endAnim(): Game.setPersistence(tag, false); FP.world.remove(this);
 *
 * So a landing whose box overlaps such a solid is INSIDE it exactly when the
 * flag still holds — the obstacle has not been broken from its own side yet,
 * which is the out-of-order arrival. `Entity.moveBy` sweeps one pixel at a
 * time and stops at the first `collide("Solid", x + sign, y)`, so a box that
 * starts inside a 16x16 rock never takes a step (measured on the game:
 * `probe-seedling-arrival-solid.mjs`).
 *
 * One derivation, shared by the census (`census-seedling-arrival-solid.mjs`),
 * the game probe and the node rows (`fidelityArrival.test.js`), so the tape
 * the game played and the tape the rows replay are one tape.
 */

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { stepOffStagingAt } from './fidelityStepOff.js';
import { PERSISTENCE_RESPONSE, tagOf, clearedAwayByTag } from './levelWorld.js';
import { FLAG_ACTIONS, STUCK_DIRS, modelStuck, solidIdOf, solidsAt } from './arrivalSolid.js';

export { FLAG_ACTIONS, STUCK_DIRS, modelStuck, solidIdOf };

/** A solid row's map entity: the solid's class tag and its top-left cell (the build's `x, y`). */
const entityFor = (levelRecord, solid) => (levelRecord.entities ?? []).find((e) => e.type === solid.tag
    && ((e.x === solid.x && e.y === solid.y) || (e.x === solid.rect.x && e.y === solid.rect.y)));

/**
 * Every GAME landing in the map: one row per door entity (`to`, `playerx`,
 * `playery`) — both directions of every link, since each side has its own door.
 */
export function gameLandings(map) {
    const out = [];
    for (const L of map.levels) {
        for (const e of L.entities ?? []) {
            const a = e.attrs ?? {};
            if (!Number.isInteger(Number(a.to)) || a.playerx === undefined) continue;
            out.push({ from: L.level, door: `${e.type}@${e.x},${e.y}`, level: Number(a.to),
                x: Number(a.playerx), y: Number(a.playery) });
        }
    }
    return out;
}

/** The persistence-reading solids a run's box overlaps, each with its flag. */
export function solidsUnderBox(run, levelRecord) {
    return solidsAt(run.world, run.state.x, run.state.y).map((so) => {
        const e = entityFor(levelRecord, so);
        const tag = e ? tagOf(e.type, e.attrs) : -1;
        const response = e ? PERSISTENCE_RESPONSE[e.type] ?? null : null;
        const removable = e ? tag >= 0 && clearedAwayByTag(e, new Set([tag])) : false;
        return { id: solidIdOf(so), cls: so.tag, rect: so.rect, tag, response, removable,
            flag: tag >= 0 ? { level: run.level, tag } : null, ...(FLAG_ACTIONS[so.tag] ?? {}) };
    });
}

/** A fresh JS-runtime boot at a landing, optionally with the given tags of its level cleared. */
export const arrivalStaging = ({ level, x, y }, { items = [], cleared = [] } = {}) => {
    const st = stepOffStagingAt({ level, x, y }, items);
    return cleared.length === 0 ? st : {
        ...st, persistence: cleared.map((tag) => ({ level, tag, note: `fidelityArrival: tag ${tag} cleared` })),
    };
};

/**
 * ⛓ D1(c)/D2 — ONE CENSUS ROW PER (landing, persistence-decided solid):
 * build the landing with NO clears and with the solid's own tag cleared, and
 * say whether the box is inside it in each state (`flagHolds` / `flagCleared`)
 * and whether the model is stuck there. A landing inside a solid no flag
 * removes is a row too (`flag: null`) — the map would have to be wrong.
 * `arm` classes (a FallRock) are asked the other way round: built by the clear.
 */
export function arrivalSolidCensus(map, levelSource, { solve = false } = {}) {
    const byLevel = new Map(map.levels.map((L) => [L.level, L]));
    const rows = [];
    for (const landing of gameLandings(map)) {
        const rec = byLevel.get(landing.level);
        if (!rec) continue;
        let run;
        try { run = createRunForStaging(arrivalStaging(landing), levelSource); } catch { continue; }
        const held = solidsUnderBox(run, rec);
        // An `arm` solid is absent while the flag holds: try each nearby arm tag cleared.
        const near = (e) => Math.abs(e.x - landing.x) <= 32 && Math.abs(e.y - landing.y) <= 32;
        const armTags = [...new Set((rec.entities ?? []).filter((e) => near(e)
            && ['arm'].includes(PERSISTENCE_RESPONSE[e.type])).map((e) => tagOf(e.type, e.attrs)).filter((t) => t >= 0))];
        const armed = [];
        for (const t of armTags) {
            try {
                const r2 = createRunForStaging(arrivalStaging(landing, { cleared: [t] }), levelSource);
                for (const s of solidsUnderBox(r2, rec)) if (s.tag === t && s.response === 'arm') armed.push(s);
            } catch { /* a clear the build refuses is not an arrival */ }
        }
        if (held.length === 0 && armed.length === 0) continue;
        const stuckHeld = held.length ? modelStuck(run) : null;
        // ⛓ D3 — the solver's answer from the landing, flag held, asked for the
        // door back to where the player came from (the nearest one to `from`).
        let solver = null;
        if (solve && held.length) {
            const back = run.world.teleporters.filter((tp) => tp.to === landing.from)
                .sort((a, b) => Math.hypot(a.x - landing.x, a.y - landing.y) - Math.hypot(b.x - landing.x, b.y - landing.y))[0];
            const goal = back ? { kind: 'reach-exit', exit: { x: back.x, y: back.y } } : null;
            if (goal) {
                const r2 = createRunForStaging(arrivalStaging(landing), levelSource);
                try {
                    const out = solveSegment({ run: r2, goals: [goal], name: `census-arrival-${landing.level}-${landing.x}-${landing.y}`,
                        boot: { level: landing.level, x: landing.x, y: landing.y } });
                    solver = { kind: 'SOLVES', ticks: out.perTick.length };
                } catch (e) {
                    solver = { kind: e.obstacle?.kind ?? String(e.message).slice(0, 60),
                        wayOut: e.obstacle?.wayOut ?? null, goal: `reach-exit ${back.isStairs ? 'stairs' : 'teleporter'}@${back.x},${back.y}` };
                }
            }
        }
        for (const s of held) {
            let cleared = null;
            if (s.tag >= 0) {
                const r2 = createRunForStaging(arrivalStaging(landing, { cleared: [s.tag] }), levelSource);
                cleared = { inside: solidsUnderBox(r2, rec).some((o) => o.id === s.id), stuck: modelStuck(r2).stuck };
            }
            rows.push({ landing, solid: s.id, cls: s.cls, flag: s.flag, response: s.response,
                action: s.action ?? null, item: s.item ?? null, solver,
                flagHolds: { inside: true, stuck: stuckHeld.stuck, moved: stuckHeld.moved },
                flagCleared: cleared });
        }
        // A landing inside two stacked solids (L12's magical + boss lock) is free
        // only when EVERY flag is cleared: asked once per landing.
        const tags = [...new Set(held.map((h) => h.tag).filter((t) => t >= 0))];
        if (held.length > 1 && tags.length > 1) {
            const r3 = createRunForStaging(arrivalStaging(landing, { cleared: tags }), levelSource);
            const all = { tags, inside: solidsUnderBox(r3, rec).length > 0, stuck: modelStuck(r3).stuck };
            for (const row of rows.slice(-held.length)) row.allCleared = all;
        }
        for (const s of armed) {
            rows.push({ landing, solid: s.id, cls: s.cls, flag: s.flag, response: s.response,
                action: s.action ?? null, item: s.item ?? null,
                flagHolds: { inside: false, stuck: false },
                flagCleared: { inside: true, stuck: modelStuck(createRunForStaging(
                    arrivalStaging(landing, { cleared: [s.tag] }), levelSource)).stuck } });
        }
    }
    return rows;
}

/**
 * ⛓ D1 — THE GAME ARMS. Each boots a fresh JS-runtime staging at a GAME
 * landing (a boot is a `new Game`, the landing's own first frame) with the
 * flag held or cleared, and either stands, holds one cardinal, or presses the
 * primary (with the Sword). The game's stream is compared with the model's.
 */
export const ARRIVAL_SOLID_LANDINGS = Object.freeze([
    // L12 `teleporter@0,80` -> L0 (288,176), inside `breakablerock@288,176` (tag 1).
    Object.freeze({ key: 'L0-from-L12', boot: { level: 0, x: 288, y: 176 }, tag: 1, solid: 'breakablerock@288,176',
        exit: { x: 304, y: 176 }, pressThen: 'left' }),
    // L1 `teleporter@64,112` -> L0 (80,112), inside `breakablerock@80,112` (tag 4).
    Object.freeze({ key: 'L0-from-L1', boot: { level: 0, x: 80, y: 112 }, tag: 4, solid: 'breakablerock@80,112',
        exit: { x: 64, y: 112 }, pressThen: 'right' }),
    // L12 `teleporter@40,688` -> L24 (48,128), inside `burnabletree@32,128` (tag 0, 32x32).
    Object.freeze({ key: 'L24-from-L12', boot: { level: 24, x: 48, y: 128 }, tag: 0, solid: 'burnabletree@32,128',
        exit: null, press: false }),
    // L115 `teleporter@64,144` -> L113 (112,16), inside `finaldoor@112,0` (tag 0, 32x32).
    Object.freeze({ key: 'L113-from-L115', boot: { level: 113, x: 112, y: 16 }, tag: 0, solid: 'finaldoor@112,0',
        exit: null, press: false }),
]);

export const ARM_TICKS = 30;

/**
 * One arm's tape: `hold` is a cardinal, 'stand', or 'press' — the primary
 * once at tick 0, then `landing.pressThen` held to the end, so the stream
 * says whether the press freed the player.
 */
export function arrivalArmTape(landing, { hold, cleared = false, items = [] }) {
    const staging = arrivalStaging(landing.boot, { items, cleared: cleared ? [landing.tag] : [] });
    const inputs = hold === 'stand' ? []
        : hold === 'press' ? [{ key: 'primary', from: 0, to: 1 }, { key: landing.pressThen, from: 1, to: ARM_TICKS }]
            : [{ key: hold, from: 0, to: ARM_TICKS }];
    return parseTape({
        tape_version: 8, game: 'seedling',
        name: `arrival-${landing.key}-${cleared ? 'cleared' : 'held'}-${hold}`,
        ...staging, tick_count: ARM_TICKS, inputs,
    });
}

/** Every arm: per landing, flag HELD × (stand, 4 holds, press with the Sword), and flag CLEARED × the same holds. */
export function arrivalArms() {
    const out = [];
    for (const l of ARRIVAL_SOLID_LANDINGS) {
        for (const cleared of [false, true]) {
            for (const hold of ['stand', ...STUCK_DIRS]) {
                out.push({ arm: `${l.key}-${cleared ? 'CLEARED' : 'HELD'}-${hold}`, landing: l, hold, cleared,
                    tape: arrivalArmTape(l, { hold, cleared }) });
            }
        }
        if (l.press === false) continue;
        out.push({ arm: `${l.key}-HELD-press-sword`, landing: l, hold: 'press', cleared: false,
            tape: arrivalArmTape(l, { hold: 'press', items: ['hasSword'] }) });
    }
    return out;
}

/**
 * ⛓ D4 — THE RULES ARC'S INPUT: every EDGE (a door and its landing) whose
 * passability depends on a SAVED obstacle state, one row per census row.
 *   · `edge` — the door in `from` and where it lands in `to`;
 *   · `solid`, `flag` `{level, tag}`, `action` / `item` / `cite` — what clears it;
 *   · `side` — where the action is taken: OUTSIDE the solid, in the landing
 *     level's room. The landing is ON the obstacle's cell, so the in-order
 *     route is room → action → the door back to `from` → (later) this edge,
 *     landing on the cleared cell;
 *   · `flagHeld` / `flagCleared` — the arrival's verdict in each save state
 *     (model; `gameWitnessed` when `probe-seedling-arrival-solid.mjs` played it);
 *   · `backDoors` — the landing level's doors to `from` (the in-order crossing);
 *   · `otherWaysIntoSource` — the doors that land in `from` from any level other
 *     than `to`: crossing this edge with the flag held needs one of them first,
 *     i.e. the game played out of order.
 */
export function arrivalEdgeTable(map, rows) {
    const witnessed = new Set(ARRIVAL_SOLID_LANDINGS.map((l) => `${l.boot.level}|${l.boot.x}|${l.boot.y}`));
    const landings = gameLandings(map);
    const doorsOf = (level) => (map.levels.find((L) => L.level === level)?.entities ?? [])
        .filter((e) => Number.isInteger(Number(e.attrs?.to)) && e.attrs?.playerx !== undefined);
    return rows.map((r) => {
        const L = r.landing;
        return {
            edge: { from: L.from, door: L.door, to: L.level, landing: { x: L.x, y: L.y } },
            solid: r.solid, cls: r.cls, flag: r.flag, response: r.response,
            action: r.action, item: r.item, cite: FLAG_ACTIONS[r.cls]?.cite ?? null,
            side: r.response === 'arm'
                ? 'a clear ADDS this solid: the landing is inside it only after the flag is cleared'
                : `outside ${r.solid}, in level ${L.level}'s room: the landing is ON its cell`,
            flagHeld: r.flagHolds.inside ? (r.flagHolds.stuck ? 'inside, stuck (no cardinal hold moves the box)' : 'inside, can walk out')
                : 'outside',
            flagCleared: r.flagCleared ? (r.flagCleared.inside ? 'inside' : (r.flagCleared.stuck
                ? `outside this solid, still stuck (${r.allCleared ? `free once {${r.allCleared.tags.join(',')}} are all cleared` : 'another solid'})`
                : 'outside, walks free')) : null,
            gameWitnessed: witnessed.has(`${L.level}|${L.x}|${L.y}`),
            solver: r.solver?.kind ?? null,
            backDoors: doorsOf(L.level).filter((e) => Number(e.attrs.to) === L.from).map((e) => `${e.type}@${e.x},${e.y}`),
            otherWaysIntoSource: landings.filter((o) => o.level === L.from && o.from !== L.level)
                .map((o) => `L${o.from} ${o.door} -> (${o.x},${o.y})`),
        };
    });
}
