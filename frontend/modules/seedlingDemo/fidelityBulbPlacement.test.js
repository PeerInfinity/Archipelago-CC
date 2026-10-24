/**
 * SEEDLING FIDELITY BULB D3 — A BULB'S KILL IS PLACED (`bulbPlacement.js`). ⚖ The user, 2026-10-10: *"We don't want
 * them to die on a tile that we need to walk on."* The strike policy (one per walk, ⚖ ruling 30(c)) asks a veto
 * before every press: a press whose swing would kill a Bulb whose lava would cut a goal the segment still owes is
 * refused. The game witness `bulb-l77-placed` is the policy's own kill, at 0 px.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { PIN_NAMES, parseTape } from './tapeFormat.js';
import { ROLES } from './levelWorld.js';
import { createTapeStepper } from './tapeRunner.js';
import { deriveKillByChaser, exitAimFor, strikePolicyFor } from './solverBot.js';
import { dropKillVetoFor, dropTileCandidates, setDropKillNeeds } from './bulbPlacement.js';
import { strikeCandidates } from './strikePolicy.js';
import { facingToward } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const levelSource = atlasLevelSource();

const stage = (boot, items = { hasSword: true }) => createLevelRun({
    levelSource, boot, noclip: false, noHazards: [], noDamage: false, grants: [], persistence: [], despawn: [],
    equips: [], pins: [...PIN_NAMES], save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null,
    seam: { items }, roles: ROLES,
});
const planOpts = (run) => ({ liveBag: run.liveGeometryOpts(), avoidVolumes: false, keys: run.progress('keys'),
    contacts: new Set(), lattice: 16, inventory: run.progress('inventory'), noHazards: run.noHazards });
const bulbAt = (cx, cy, id = 'bulb@48,112') => ({ id, tag: 'bulb', as3: 'Enemy', enemyClass: 'Bulb', hits: 0,
    hitsTimer: 0, x: cx, y: cy, rect: { x: cx - 6, y: cy - 6, w: 12, h: 12, right: cx + 6, bottom: cy + 6 } });

/** L74's survey-step-160 needs: the Darkshield (48,32) — any cell around it — then `teleporter@16,144`. */
function l74Needs(run) {
    const ti = run.world.teleporters.findIndex((t) => t.rect.x === 16 && t.rect.y === 144);
    return [
        { what: 'the Darkshield', aims: [{ x: 56, y: 24 }, { x: 72, y: 40 }, { x: 56, y: 56 }, { x: 40, y: 40 }],
            allowTeleporter: null },
        { what: 'the exit (16,144)', aims: [exitAimFor(run.world, ti, planOpts(run))], allowTeleporter: ti },
    ];
}

describe('fidelity BULB D3 — the veto', () => {
    it('no needs → no veto (every policy built before this slice is the policy it was)', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 74, x: 16, y: 112 });
            expect(dropKillVetoFor(run)).toBeNull();
        });
    });
    it('the candidate tiles: the body\'s centre grown by (SLASH_HIT_TICKS + 2) · 0.65 px', () => {
        expect(dropTileCandidates('bulb', 56, 120)).toEqual([{ tx: 3, ty: 7 }]);
        expect(dropTileCandidates('bulb', 50, 120).map((t) => `${t.tx},${t.ty}`)).toEqual(['2,7', '3,7']);
    });
    it('⛔ L74: a Bulb on the one-tile bridge (3,7), the player west of it, is VETOED — its lava would cut the Darkshield', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 74, x: 16, y: 112 });
            setDropKillNeeds(run, l74Needs(run), () => planOpts(run));
            const v = dropKillVetoFor(run)(bulbAt(56, 120), { x: 40, y: 120 });
            expect(v?.tile).toEqual({ tx: 3, ty: 7 });
            expect(v?.need).toBe('the Darkshield');
            expect(v?.why).toMatch(/We don't want them to die on a tile that we need to walk on/);
        });
    });
    it('L77: the same body is vetoed in the column\'s mouth (7,6) and not in the open room (6,5)', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 77, x: 112, y: 96 });
            const south = run.world.teleporters.findIndex((t) => t.rect.x === 96 && t.rect.y === 304);
            setDropKillNeeds(run, [{ what: 'the south exit', aims: [exitAimFor(run.world, south, planOpts(run))],
                allowTeleporter: south }], () => planOpts(run));
            const veto = dropKillVetoFor(run);
            expect(veto(bulbAt(120, 104, 'bulb@80,72'), { x: 120, y: 88 })?.tile).toEqual({ tx: 7, ty: 6 });
            expect(veto(bulbAt(104, 88, 'bulb@80,72'), { x: 120, y: 88 })).toBeNull();
            // ⛓ the needs are the REST of the segment FROM THE PLAYER: south of the body, the exit is not cut
            expect(veto(bulbAt(120, 120, 'bulb@80,72'), { x: 120, y: 136 })).toBeNull();
        });
    });
    it('a body already at `hitsMax` is not vetoed (no new death to place)', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 74, x: 16, y: 112 });
            setDropKillNeeds(run, l74Needs(run), () => planOpts(run));
            expect(dropKillVetoFor(run)({ ...bulbAt(56, 120), hits: 1 }, { x: 40, y: 120 })).toBeNull();
        });
    });
    it('`strikeCandidates`: a candidate whose swing would kill a vetoed body is rejected WITH the veto\'s reason; no veto → chosen', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 74, x: 16, y: 112 });
            setDropKillNeeds(run, l74Needs(run), () => planOpts(run));
            const veto = dropKillVetoFor(run);
            const player = { x: 44, y: 120 };
            const bodies = [bulbAt(56, 120)];
            const off = strikeCandidates(player, bodies, { facingToward, owed: new Map(), tick: 0 });
            expect(off.chosen.map((c) => c.id)).toEqual(['bulb@48,112']);
            const on = strikeCandidates(player, bodies, { facingToward, owed: new Map(), tick: 0, vetoBody: veto });
            expect(on.chosen).toEqual([]);
            expect(on.rejected[0].why).toMatch(/would kill bulb@48,112: ⛔ a kill here may write LAVA at tile \(3,7\)/);
        });
    });
    it('`strikePolicyFor` carries the veto only while needs are set', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const run = stage({ level: 74, x: 16, y: 112 });
            setDropKillNeeds(run, l74Needs(run), () => planOpts(run));
            const p = strikePolicyFor(run);
            const d = p.decide({ x: 44, y: 120, direction: 0 }, [bulbAt(56, 120)], 0, new Set());
            expect(d.decision).toBe('none');
            expect(p.trace.at(-1).rejected[0].veto.tile).toEqual({ tx: 3, ty: 7 });
        });
    });
});

describe('fidelity BULB D3 — the kill rung on L74\'s bridge', () => {
    it('without needs the chaser arm kills the Bulb from the corridor\'s west end; WITH them every stance is refused by name', () => {
        withContactFidelity({ bulbLive: true }, () => {
            const free = stage({ level: 74, x: 16, y: 112 });
            const body = free.entities('strikeBodies').find((b) => b.tag === 'bulb');
            const k0 = deriveKillByChaser(free, body, new Set(), { aim: null, tolerance: 2 });
            const placed = stage({ level: 74, x: 16, y: 112 });
            setDropKillNeeds(placed, l74Needs(placed), () => planOpts(placed));
            const k1 = deriveKillByChaser(placed, body, new Set(), { aim: null, tolerance: 2 });
            expect(k1.stance).toBeNull();
            expect(k1.why).toMatch(/no stance derives for bulb@48,112/);
            expect(k1.why).toMatch(/the WAIT is dangerous at tick \d+ — chaser:bulb@48,112/);
            // the control: the same scan without the veto finds a stance (its kill is ON the corridor)
            expect(k0.stance).not.toBeNull();
        });
    });
});

describe('fidelity BULB D3 — the GAME witness `bulb-l77-placed` (the policy\'s own kill)', () => {
    const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'bulb-l77-placed.json'), 'utf8'));
    it('ON: the player and the Bulb at every sampled tick; the kill, the lava at (6,5), the removal', () => {
        withContactFidelity({ bulbLive: true }, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
            const bad = [];
            const col = [];
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                col[o.t] = { x: o.x, y: o.y, b: (run?.entities('chasers') ?? []).filter((c) => c.tag === 'bulb' && !c.removed) };
                r = st.next();
            }
            for (const s of W.samples) {
                const m = col[s.t];
                if (m.x !== s.player.x || m.y !== s.player.y) bad.push(`t ${s.t} player`);
                if (m.b.length !== s.bodies.length) { bad.push(`t ${s.t} count`); continue; }
                for (const g of s.bodies) {
                    const b = m.b[0];
                    if (b.x !== g.x || b.y !== g.y || b.vx !== g.vx || b.vy !== g.vy) bad.push(`t ${s.t} body`);
                    if (g.hits !== b.hits || g.hits_timer !== b.hitsTimer) bad.push(`t ${s.t} hits`);
                }
            }
            expect(bad).toEqual([]);
            expect(W.samples.length).toBe(110);
            expect(run.bulbEvents.map((e) => [e.t, e.kind, e.tile ?? null])).toEqual([
                [46, 'drop', { tx: 6, ty: 5 }], [72, 'lava', { tx: 6, ty: 5 }], [99, 'removed', null]]);
        });
    });
});
