/**
 * ⛓⛓ SEEDLING FIDELITY IGFADE — the Igneous-to-Lava tile's DEAD-FRAME renders (wave 23; ⚖ the user picked "IGNEOUS
 * load-fade renders", 2026-10-21). One switch, OFF (`contactFidelity.igneousDeadFrames`), under `igneousLava` (ON).
 *
 *  - W0 / D1: a visit's tiles take 1 + `LOAD_FADE_FRAMES` = 21 renders before its first live one — the swap frame's
 *    render is the new world's (`Engine.checkWorld` at the END of the update), then the fade's 20 dead updates each
 *    run `view()` and render. Witnessed on p4g (`igneous-l76-fade-stand` / `-86`): a boot and a death restart in range
 *    turn the tile at the t15 / t61 render (36 − 21), and the game's own `dead_frames` curve says when it restarted.
 *  - D2: a frozen span (a pickup's phase A, a Help, the wand / seed fades) renders once per dead frame at the frozen
 *    position. Witnessed STAGED on p4g (`igneous-l74-phase-a`): the Dark Shield's phase A turns a breaking tile.
 *  - The interim it retires: OFF, `levelRun.renderIgneousNow` refuses both cases by name (`IGNEOUS_UNMODELLED`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { LOAD_FADE_FRAMES } from './gameClock.js';
import { atlasLevelSource } from './levelSource.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'igneous-witness');
const tapeJson = (name) => JSON.parse(readFileSync(join(WIT, `${name}.tape.json`), 'utf8'));
const gameObs = (name) => JSON.parse(readFileSync(join(WIT, `${name}.game-obs.json`), 'utf8'));

/**
 * The model over a witness: |Δ| against the game's drained stream, the first tick the game's `dead_frames` curve
 * disagrees (calibrated: the game's sample at tick T reads the dead frames after the model's tick T − 1), the respawn
 * observations, the non-`frame` igneous events, and the refusal if one fired.
 */
const replay = (name) => {
    const g = gameObs(name);
    const pos = new Map(g.rows.map(([t, level, x, y]) => [t, { level, x, y }]));
    const dead = new Map((g.dead ?? []).map(([t, d]) => [t, d]));
    let run = null;
    const st = createTapeStepper(tapeJson(name), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let worst = 0;
    let first = null;
    let deadOff = null;
    let error = null;
    const jumps = [];
    let prevDead = null;
    try {
        for (let r = st.next(); !r.done; r = st.next()) {
            const o = r.value.observation;
            const p = pos.get(o.t);
            const d = p && p.level === o.level ? Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) : Infinity;
            if (p && d > 0 && first === null) first = o.t;
            if (p) worst = Math.max(worst, d);
            const md = run.deadFramesOwed;
            if (prevDead !== null && md !== prevDead) jumps.push(o.t);
            prevDead = md;
            const gd = dead.get(o.t + 1);
            if (gd !== undefined && gd !== md && deadOff === null) deadOff = o.t;
        }
    } catch (e) { error = e; }
    const igneous = (run?.igneousEvents ?? []).filter((e) => e.event !== 'frame')
        .map((e) => `${e.tile} ${e.event} t${e.t}${e.dead ? ` ${e.dead}` : ''}`);
    return { worst, first, deadOff, jumps, igneous, error };
};

/** The game's restart observations, off its `dead_frames` curve (the boot's fade at t1 excluded). */
const gameRestarts = (name) => {
    const d = gameObs(name).dead;
    return d.filter(([t, v], i) => i > 0 && t > 1 && v !== d[i - 1][1]).map(([t]) => t - 1);
};

const ON = { igneousLava: true, igneousDeadFrames: true };

describe('IGFADE — the switch', () => {
    it('ships OFF, under igneousLava ON (byte-identical OFF: the interim refuses by name)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.igneousDeadFrames).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.igneousLava).toBe(true);
    });

    it('the fade is 1 + LOAD_FADE_FRAMES renders: the swap frame\'s render plus the twenty dead updates\'', () => {
        expect(LOAD_FADE_FRAMES).toBe(20);
    });
});

describe('IGFADE D1 — the load fade, witnessed on p4g', () => {
    for (const [name, tile] of [['igneous-l76-fade-stand', '10,6'], ['igneous-l76-fade-stand-86', '8,6']]) {
        it(`${name}: ON, 0 px and the game's dead curve to the frame — lava at t15 and t61, restarts t46 / t92`, () => {
            const r = withContactFidelity(ON, () => replay(name));
            expect(r.error).toBeNull();
            expect(r.worst).toBe(0);
            expect(r.deadOff).toBeNull();
            expect(gameRestarts(name)).toEqual([46, 92]);
            expect(r.jumps).toEqual([46, 92]);
            expect(r.igneous).toEqual([`${tile} break t1 load`, `${tile} lava t15`, `${tile} break t47 load`,
                `${tile} lava t61`, `${tile} break t93 load`]);
        });

        it(`${name}: the interim (igneousDeadFrames OFF) refuses the arrival by name; igneousLava OFF misses the t46 restart`, () => {
            const interim = withContactFidelity({ igneousLava: true, igneousDeadFrames: false }, () => replay(name));
            expect(interim.error?.code).toBe('IGNEOUS_UNMODELLED');
            expect(interim.error.message).toMatch(/the arrival \(\d+, 100\) in level 76/);
            const off = withContactFidelity({ igneousLava: false, igneousDeadFrames: false }, () => replay(name));
            // OFF the tile is floor: no lava restart (the -86 stand dies later in the chain's arm instead, t77)
            expect(off.jumps).toEqual(name.endsWith('-86') ? [77] : []);
            expect(off.deadOff).toBe(46);
        });
    }
});

describe('IGFADE D2 — a frozen span, witnessed on p4g (staged)', () => {
    it('igneous-l74-phase-a: ON, 0 px over 150 ticks — the phase A turns (5,3), the walk back dies on it', () => {
        const r = withContactFidelity(ON, () => replay('igneous-l74-phase-a'));
        expect(r.error).toBeNull();
        expect(r.worst).toBe(0);
        expect(r.igneous).toEqual(['5,3 break t13', '5,3 lava t31 ceremony']);
        expect(r.jumps).toEqual([31, 126]);
        expect(gameRestarts('igneous-l74-phase-a').at(-1)).toBe(126);
    });

    it('igneous-l74-phase-a: the interim refuses the span by name; igneousLava OFF walks on where the game dies', () => {
        const interim = withContactFidelity({ igneousLava: true, igneousDeadFrames: false },
            () => replay('igneous-l74-phase-a'));
        expect(interim.error?.code).toBe('IGNEOUS_UNMODELLED');
        expect(interim.error.message).toMatch(/150 dead frame\(s\) were spent before tick 31/);
        const off = withContactFidelity({ igneousLava: false, igneousDeadFrames: false },
            () => replay('igneous-l74-phase-a'));
        expect(off.error).toBeNull();
        expect(off.first).toBeGreaterThan(90);
        expect(off.worst).toBeGreaterThan(1);
    });
});

describe('IGFADE — the IGNEOUS witnesses are unmoved by the switch', () => {
    for (const name of ['igneous-l76-leg649', 'igneous-l76-k8', 'igneous-l76-k9-rebuild', 'igneous-l76-k4-stand',
        'igneous-l76-fresh-stand', 'igneous-l76-survey195-on']) {
        it(`${name}: 0 px ON`, () => {
            const r = withContactFidelity(ON, () => replay(name));
            expect(r.error).toBeNull();
            expect(r.worst).toBe(0);
        });
    }
});
