/**
 * SEEDLING FIDELITY STATICLADDER D2 — a `DarkTrap` dies to a lit `LightPole` (`contactFidelity.darkTrapLight`,
 * `enemyDamage.DARKTRAP_LIGHT_DEATH`, `levelRun.stepDarkTrapsNow`), replayed against the game in node.
 *
 * `fixtures/darktrap-witness/<name>.json` holds a tape and the GAME's DarkTrap rows (`botMobiles()`, p4f headless) at
 * every sampled tick of its boot level, with the player's position
 * (`scripts/procgen/probe-seedling-darktrap-mobiles.mjs --record`):
 *   · `staticladder-l62-step115-light` — survey step 115's solved walk (the light arm: the stance below L62's
 *     planttorch, one Spear thrust at `lightpole@120,200`, the corridor through the dying `darktrap@112,208`);
 *   · `staticladder-l101-light-bob` — L101, Spear and no ghost sword, one thrust north at `lightpole@144,64`: the
 *     light reaches `darktrap@160,80` only while the bob is low (27.2–30.5 px), so the death tick is the clock's.
 * With the switch ON the model reproduces the player at every sampled tick and every body's presence, "die1" and its
 * index. ⚠ The tapes are EMBEDDED, not roster tapes: the roster replays every tape under the default model, and the
 * switch ships OFF — where the L62 walk takes a hit from a darktrap the game has already made harmless.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { staticEnemyDanger } from './dangerMap.js';
import { DARKTRAP_LIGHT_DEATH } from './enemyDamage.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'darktrap-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const byName = (n) => WITNESSES.find((w) => w.name === n);

const levelSource = atlasLevelSource();
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];

/** The model after each tick of a witness's embedded tape (index 0 = boot): the player and the darktraps. */
function replay(w) {
    let run = null;
    const tape = parseTape(JSON.stringify(w.tape));
    const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = { x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
            bodies: (run?.darkTraps ?? []).map((b) => ({ ...b })) };
        r = st.next();
    }
    return col;
}

/** Every disagreement between the game's samples and the model, as strings. */
function disagreements(w, col) {
    const out = [];
    for (const s of w.samples) {
        const m = col[s.t];
        if (!m) { out.push(`t ${s.t}: no model column`); continue; }
        if (m.x !== s.player.x || m.y !== s.player.y) {
            out.push(`t ${s.t}: player game (${s.player.x}, ${s.player.y}) model (${m.x}, ${m.y})`);
        }
        const live = m.bodies.filter((b) => !b.removed);
        if (live.length !== s.bodies.length) out.push(`t ${s.t}: game ${s.bodies.length} DarkTrap(s), model ${live.length}`);
        for (const g of s.bodies) {
            const b = live.find((x) => x.x === g.x && x.y === g.y);
            if (!b) { out.push(`t ${s.t}: no model body at (${g.x}, ${g.y})`); continue; }
            const gd = g.anim === 'die1';
            if (gd !== b.dying) out.push(`t ${s.t} ${b.id}: game anim "${g.anim}" model dying ${b.dying}`);
            else if (gd && g.anim_index !== b.dieIndex) out.push(`t ${s.t} ${b.id}: die1 index game ${g.anim_index} model ${b.dieIndex}`);
        }
    }
    return out;
}

describe('STATICLADDER D2 — the switch', () => {
    // ⚖ (user, 2026-10-10) ON at the wave-10 harvest (the slice shipped it OFF).
    it('ships ON, and OFF builds no darktrap roster (`darkTraps` is null)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.darkTrapLight).toBe(true);
        expect(CONTACT_FIDELITY.darkTrapLight).toBe(true);
        withContactFidelity({ darkTrapLight: false }, () => {
            const run = createLevelRun({ levelSource, boot: { level: 62, x: 48, y: 288 }, roles: ROLES });
            expect(run.entities('darkTraps')).toBe(null);
        });
    });
});

describe('STATICLADDER D2 — the game witnesses, replayed (switch ON)', () => {
    it('the witness set is the two recorded runs', () => {
        expect(WITNESSES.map((w) => w.name)).toEqual(['staticladder-l101-light-bob', 'staticladder-l62-step115-light']);
    });
    for (const w of WITNESSES) {
        it(`${w.name}: the player, and every DarkTrap's presence, "die1" and index, at every sampled tick`, () => {
            const col = withContactFidelity({ darkTrapLight: true }, () => replay(w));
            expect(disagreements(w, col)).toEqual([]);
            expect(w.samples.length).toBeGreaterThan(100);
        });
    }
    it('the death timelines (startDying = the game\'s first "die1" tick − the 30-tick counter; the removal)', () => {
        const at = (w, id) => {
            const col = withContactFidelity({ darkTrapLight: true }, () => replay(w));
            const b = col.at(-1).level === w.tape.boot.level ? col.at(-1).bodies.find((x) => x.id === id)
                : col.filter((c) => c.level === w.tape.boot.level).at(-1).bodies.find((x) => x.id === id);
            const firstDie = w.samples.find((s) => s.bodies.some((g) => g.anim === 'die1')).t;
            const gone = w.samples.find((s) => s.bodies.length === 0).t;
            return { dyingAt: b.dyingAt, removedAt: b.removedAt, firstDie, gone };
        };
        expect(at(byName('staticladder-l62-step115-light'), 'darktrap@112,208'))
            .toEqual({ dyingAt: 139, removedAt: 211, firstDie: 169, gone: 211 });
        expect(at(byName('staticladder-l101-light-bob'), 'darktrap@160,80'))
            .toEqual({ dyingAt: 38, removedAt: 110, firstDie: 68, gone: 110 });
        expect(169 - 139).toBe(DARKTRAP_LIGHT_DEATH.deathCounter);
    });
    it('OFF: the L62 walk is NOT reproduced — the model bills the dying darktrap\'s contact the game no longer makes', () => {
        const w = byName('staticladder-l62-step115-light');
        let col = null;
        let thrown = null;
        try { col = withContactFidelity({ darkTrapLight: false }, () => replay(w)); } catch (e) { thrown = e; }
        if (thrown) {
            expect(String(thrown.message)).toMatch(/darktrap@112,208/);
        } else {
            expect(disagreements(w, col).length).toBeGreaterThan(0);
        }
    });
});

describe('STATICLADDER D2 — the model, directly', () => {
    const bootLit = (level, x, y, poleTag, { clock = true } = {}) => createLevelRun({
        levelSource, boot: { level, x, y }, noclip: false, noDamage: false, roles: ROLES,
        persistence: [{ level, tag: poleTag, note: 'the pole lit (its flag cleared)' }],
        ...(clock ? { seam: { time: 6667 }, pins: ['dead_frames'] } : {}),
    });
    it('a pole lit at the boot: dying on tick 1, harmless, "die1" after 30, removed with its tag written', () => {
        withContactFidelity({ darkTrapLight: true }, () => {
            const run = bootLit(62, 48, 288, 0);
            const seen = [];
            for (let t = 0; t < 80; t += 1) {
                run.advance(new Set());
                const b = run.entities('darkTraps')[0];
                if (t === 0) seen.push(['t1', b.startDying, b.dyingAt, b.deathCounter]);
                if (b.dying && seen.length === 1) seen.push(['die1', run.ticksCompleted]);
            }
            const b = run.entities('darkTraps')[0];
            seen.push(['removed', b.removedAt]);
            expect(seen).toEqual([['t1', true, 1, 29], ['die1', 31], ['removed', 73]]);
            expect(run.ledger('staticBodyDeaths')).toEqual([expect.objectContaining({
                level: 62, id: 'darktrap@112,208', as3: 'DarkTrap', tag: 1, killedAt: 1, removedAt: 73,
            })]);
        });
    });
    it('the danger map stops pricing a dying darktrap (and prices it while the pole is out)', () => {
        withContactFidelity({ darkTrapLight: true }, () => {
            const lit = bootLit(62, 48, 288, 0);
            const unlit = createLevelRun({ levelSource, boot: { level: 62, x: 48, y: 288 }, roles: ROLES,
                seam: { time: 6667 }, pins: ['dead_frames'] });
            lit.advance(new Set());
            unlit.advance(new Set());
            const box = playerBoxAt(120, 216);
            expect(staticEnemyDanger(unlit, box).map((d) => d.id)).toEqual(['darktrap@112,208']);
            expect(staticEnemyDanger(lit, box)).toEqual([]);
        });
    });
    it('no clock and a light band across 28 px: refused by name, never guessed (L101)', () => {
        withContactFidelity({ darkTrapLight: true }, () => {
            const run = bootLit(101, 288, 240, 0, { clock: false });
            expect(() => run.advance(new Set())).toThrow(/27\.20–30\.53 px from darktrap@160,80[\s\S]*no `Game\.time`/);
        });
    });
    it('the row: radiusMin 28, the 16x16 pole image (originY 8), the 2 px bob over Game.timePerFrame', () => {
        expect(DARKTRAP_LIGHT_DEATH.pole).toEqual(expect.objectContaining({ radiusMin: 28, originY: 8, bob: 2, period: 45 }));
        expect(DARKTRAP_LIGHT_DEATH.dieAnim).toEqual(expect.objectContaining({ frames: 14, rate: 10 }));
    });
});
