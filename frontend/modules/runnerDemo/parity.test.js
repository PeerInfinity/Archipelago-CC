/**
 * Parity harness: pins runnerDemo/physics.js to the UNMODIFIED
 * upstream toolkit port (vendor/toolkit-physics-original.js, copied
 * verbatim from ~/CC/platformer-toolkit/web/physics.js).
 *
 * The vendored file is a DOM-bound page script, not a module; we
 * evaluate it inside a function scope with stub window/document/rAF
 * globals and an epilogue that returns its internals. Both engines
 * are then driven with IDENTICAL input tapes, under every preset, and
 * every tick's kinematic + jump state must be EXACTLY equal (same
 * float ops in the same order — no tolerance).
 *
 * The port runs with AUTO_RUN off and SIDE_WALLS off for this test
 * (both are structural data fields; the original has neither), which
 * is also why the harness survives the auto-run mechanic: parity is
 * against the input-driven core that Brake/Left will re-expose.
 *
 * Vacuousness guards: each tape's `check(stats)` asserts the physics
 * path it targets actually executed (the toolkit playground's low
 * platforms bonk most launches one tick after takeoff, which silently
 * skipped the variable-jump paths in an earlier draft), and a final
 * test injects a deliberate constant perturbation and asserts the
 * harness DETECTS the divergence.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { step, spawnState, PROFILES } from './physics.js';

const VENDOR_PATH = join(
    dirname(fileURLToPath(import.meta.url)), 'vendor', 'toolkit-physics-original.js');

/** Evaluate the vendored page script headless; return its internals. */
function loadOriginal() {
    const src = readFileSync(VENDOR_PATH, 'utf8');

    const ctxStub = new Proxy({}, {
        get: (t, prop) => (prop in t ? t[prop] : () => {}),
        set: (t, prop, v) => { t[prop] = v; return true; },
    });
    const makeElement = () => ({
        appendChild: () => {},
        addEventListener: () => {},
        focus: () => {},
        getContext: () => ctxStub,
        width: 960,
        height: 540,
        value: '',
        checked: false,
        innerHTML: '',
        className: '',
        type: '',
        id: '',
        min: 0, max: 0, step: 0,
    });
    const documentStub = {
        getElementById: () => makeElement(),
        createElement: () => makeElement(),
        createTextNode: () => ({}),
    };
    const windowStub = { addEventListener: () => {} };

    const epilogue = `
;return { params, defaults, presets, platforms, character, keys,
          resetCharacter, physicsStep, applyPreset };`;
    // eslint-disable-next-line no-new-func
    const factory = new Function('window', 'document', 'requestAnimationFrame', src + epilogue);
    return factory(windowStub, documentStub, () => {});
}

/** The original's world as a runner level (bottom-left coords match;
 *  all solid ground; spawn matches the original SPAWN_X/Y). The
 *  original's module-level `platforms` array is shared by reference,
 *  so mutating it for the 'floor' variant affects both engines. */
function worldAsLevel(origPlatforms) {
    return {
        id: 'parity',
        size: { width: 30, height: 16.875 },
        platforms: origPlatforms.map((p, i) => ({ id: `p${i}`, ...p, type: 'ground' })),
        hazards: [],
        pickups: [],
        portals: [],
        spawn: { x: 2, y: 2 },
    };
}

/** Parity constants: the profile with the original's missing features
 *  switched off (both are structural data fields), plus optional
 *  test-only perturbations (the divergence-detection control). */
function parityConstants(profileId, perturb = {}) {
    return { ...PROFILES[profileId].constants, AUTO_RUN: false, SIDE_WALLS: false, ...perturb };
}

/**
 * Input tapes. `events` are { at, ...held-state changes } applied at
 * tick boundaries (exactly how the original's key handlers mutate
 * state between physicsStep calls); an optional `dynamic(portState,
 * stats)` hook returns the same kind of change object computed from
 * the live PORT state — applied to BOTH engines, which is legitimate
 * because any prior divergence fails the field comparison first.
 * `world: 'floor'` strips the playground to its floor so jumps get
 * open sky. `check(stats)` asserts the tape's target path ran.
 */
const TAPES = [
    {
        name: 'playground: run, jump into ceilings, run off ledge',
        world: 'playground',
        ticks: 400,
        events: [
            { at: 0, right: true },
            { at: 60, jump: true },
            { at: 100, jump: false },
            { at: 180, right: false, left: true },
            { at: 320, left: false },
        ],
        check: (st) => { expect(st.launches).toBeGreaterThan(0); },
    },
    {
        name: 'playground: hops and turnarounds among platforms',
        world: 'playground',
        ticks: 300,
        events: [
            { at: 0, right: true },
            { at: 20, jump: true },
            { at: 25, jump: false },
            { at: 26, jump: true },
            { at: 60, jump: false },
            { at: 90, right: false, left: true },
            { at: 140, left: false, right: true },
            { at: 200, jump: true },
            { at: 260, jump: false },
        ],
        check: (st) => { expect(st.launches).toBeGreaterThan(0); },
    },
    {
        name: 'floor: full jump then early-release cut (open air)',
        world: 'floor',
        ticks: 260,
        events: [
            { at: 0, right: true },
            { at: 10, right: false },   // brief run, then decel to rest
            { at: 40, jump: true },     // full-hold jump
            { at: 110, jump: false },
            { at: 160, jump: true },    // early release → jumpCutOff
            { at: 165, jump: false },
        ],
        check: (st) => {
            expect(st.launches).toBeGreaterThanOrEqual(2);
            expect(st.upMultSeen).toBe(true);   // rising while held
            expect(st.cutoffSeen).toBe(true);   // rising after release
        },
    },
    {
        name: 'floor: buffered jump lands and refires',
        world: 'floor',
        ticks: 200,
        events: [
            { at: 0, right: true },
            { at: 8, right: false },
            { at: 30, jump: true },
            { at: 36, jump: false },
        ],
        // press again while FALLING from the first jump so the buffer
        // carries the press into the landing tick
        dynamic: (s, st) => {
            if (st.launches === 1 && !s.onGround && s.vy < 0 && !st.rePressed) {
                st.rePressed = true;
                return { jump: true };
            }
            if (st.rePressed && st.launches >= 2 && !st.reReleased) {
                st.reReleased = true;
                return { jump: false };
            }
            return null;
        },
        check: (st) => {
            expect(st.rePressed).toBe(true);
            expect(st.launches).toBeGreaterThanOrEqual(2);
        },
    },
    {
        name: 'floor: coyote jump off the left edge',
        world: 'floor',
        ticks: 300,
        events: [{ at: 0, left: true }],
        // press once the coyote counter clears doAJump's 0.03 floor
        // (2 ticks = 0.04 at 50Hz, inside every preset's 0.15 window)
        dynamic: (s, st) => {
            if (!s.onGround && !s.currentlyJumping && !st.coyotePressed
                    && s.coyoteTimeCounter > 0.03) {
                st.coyotePressed = true;
                return { jump: true };
            }
            if (st.coyotePressed && st.launches > 0 && !st.coyoteReleased) {
                st.coyoteReleased = true;
                return { jump: false };
            }
            return null;
        },
        check: (st) => {
            expect(st.coyotePressed).toBe(true);
            expect(st.coyoteLaunch).toBe(true);
        },
    },
    {
        name: 'floor: fall off the world edge (reset parity)',
        world: 'floor',
        ticks: 500,
        events: [
            { at: 0, left: true },
            { at: 400, left: false },
        ],
        check: (st) => { expect(st.respawns).toBeGreaterThan(0); },
    },
];

// pressingJump is deliberately absent: after a fall-respawn with the
// key still held, the original's event-driven flag reads false while
// the port's held-state flag reads true — behaviorally identical (no
// rising edge either way; its every effect shows up in the compared
// kinematics and counters).
const COMPARED_FIELDS = [
    'x', 'y', 'vx', 'vy',
    'desiredJump', 'jumpBufferCounter', 'coyoteTimeCounter',
    'currentlyJumping', 'canJumpAgain', 'gravityScale', 'gravMultiplier',
    'onGround',
];

function runParity(profileId, tape, perturb = {}) {
    const orig = loadOriginal();
    if (profileId !== 'toolkit') orig.applyPreset(profileId);
    orig.resetCharacter();
    if (tape.world === 'floor') orig.platforms.splice(1); // floor only, open sky

    const C = parityConstants(profileId, perturb);
    const level = worldAsLevel(orig.platforms);
    let ported = spawnState(level, C);

    const held = { left: false, right: false, jump: false };
    const dt = 1 / C.TICK_HZ;
    const stats = {
        launches: 0, respawns: 0,
        upMultSeen: false, cutoffSeen: false, coyoteLaunch: false,
    };

    const apply = (ev) => {
        if ('left' in ev) { held.left = ev.left; orig.keys.left = ev.left; }
        if ('right' in ev) { held.right = ev.right; orig.keys.right = ev.right; }
        if ('jump' in ev) {
            if (ev.jump && !held.jump) {
                // original keydown: the press edge sets both flags
                orig.character.desiredJump = true;
                orig.character.pressingJump = true;
            } else if (!ev.jump) {
                orig.character.pressingJump = false;
            }
            held.jump = ev.jump;
        }
    };

    for (let t = 0; t < tape.ticks; t++) {
        for (const ev of tape.events) if (ev.at === t) apply(ev);
        if (tape.dynamic) {
            const ev = tape.dynamic(ported, stats);
            if (ev) apply(ev);
        }

        const wasAirborne = !ported.onGround;
        const vyBefore = ported.vy;

        orig.physicsStep(dt);
        ported = step(ported, { ...held }, level, {}, C);

        // stats (port side; parity below guarantees they describe both)
        if (ported.currentlyJumping && ported.vy > vyBefore + 1) {
            stats.launches += 1;
            if (wasAirborne) stats.coyoteLaunch = true;
        }
        if (ported.respawned) stats.respawns += 1;
        if (!ported.onGround && ported.vy > 0.01) {
            if (ported.gravMultiplier === C.jumpCutOff) stats.cutoffSeen = true;
            if (ported.gravMultiplier === C.upwardMovementMultiplier) stats.upMultSeen = true;
        }

        for (const f of COMPARED_FIELDS) {
            if (!Object.is(orig.character[f], ported[f])) {
                throw new Error(
                    `${profileId} / "${tape.name}" tick ${t}: field '${f}' diverged — `
                    + `original=${orig.character[f]} ported=${ported[f]} `
                    + `(orig x=${orig.character.x} y=${orig.character.y}, `
                    + `port x=${ported.x} y=${ported.y})`);
            }
        }
    }
    return stats;
}

describe('runner physics parity vs vendored toolkit original', () => {
    const profileIds = Object.keys(PROFILES); // toolkit + 4 presets
    for (const profileId of profileIds) {
        for (const tape of TAPES) {
            it(`${profileId}: ${tape.name}`, () => {
                const stats = runParity(profileId, tape);
                tape.check(stats);
            });
        }
    }

    it('detects an injected divergence (harness is not vacuous)', () => {
        // Perturb the PORT's jumpCutOff only; the open-air cut tape
        // exercises that exact path, so the per-tick comparison must
        // throw. If this test ever fails, the harness went blind.
        const cutTape = TAPES.find((t) => t.name.includes('early-release cut'));
        expect(() => runParity('toolkit', cutTape, { jumpCutOff: 3.5 }))
            .toThrow(/diverged/);
    });
});
