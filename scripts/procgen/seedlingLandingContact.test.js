/**
 * ⛓ RULES rules-landing-contact-census — the pure half of `probe-seedling-landing-contact.mjs`: the landing/body
 * boxes, the screen, and the probe's per-input verdict. The boxes are the classes' own (`combat.ENEMY_CLASSES`, the
 * Player's `HITBOX`), so these rows pin the arithmetic, not a level.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    bodyOf, boxGap, contactOf, landingContactCensus, landingsOfRules, playerBoxAt,
} from './seedlingLandingContact.js';
import { hasNoCleanInput, inputVerdict, isArrivalHit } from './probe-seedling-landing-contact.mjs';
import { PLAYTHROUGH_MAP } from './make-seedling-playthrough-rules.mjs';
import { SEEDLING_SET_PATCHES, patchedMapDocument } from '../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));

describe('the boxes', () => {
    it('the player at a landing is `setHitbox(4, 5, 2, 2)` about the spawn centre (tile + 8)', () => {
        expect(playerBoxAt({ x: 64, y: 16 })).toEqual({ cx: 72, cy: 24, x: 70, y: 22, right: 74, bottom: 27 });
    });
    it('a lavarunner is a Bob: centre = placement + 8, box 12×12 about it, 1.5 px/tick, a homer with runRange 80', () => {
        const b = bodyOf({ type: 'lavarunner', x: 72, y: 24 });
        expect(b).toMatchObject({ cx: 80, cy: 32, x: 74, y: 26, right: 86, bottom: 38, speed: 1.5, homer: true, range: 80 });
    });
    it('a tag with no contact row (a rock, a door) is not a body', () => {
        expect(bodyOf({ type: 'breakablerock', x: 64, y: 48 })).toBeNull();
        expect(bodyOf({ type: 'teleporter', x: 64, y: 0 })).toBeNull();
    });
    it('the gap is the larger axis gap; touching is 0, overlap is negative', () => {
        const a = { x: 0, y: 0, right: 10, bottom: 10 };
        expect(boxGap(a, { x: 10, y: 0, right: 20, bottom: 10 })).toBe(0);
        expect(boxGap(a, { x: 13, y: 4, right: 20, bottom: 8 })).toBe(3);
        expect(boxGap(a, { x: 5, y: 5, right: 20, bottom: 20 })).toBe(-5);
    });
});

describe('the screen', () => {
    it('L73\'s L74 landing vs the vanilla runner: gap 0, so within one tick of a 1.5 px/tick homer', () => {
        const c = contactOf(playerBoxAt({ x: 64, y: 16 }), bodyOf({ type: 'lavarunner', x: 72, y: 24 }));
        expect(c).toMatchObject({ gap: 0, overlap: false, reach: true, hit: true, awake: true });
    });
    it('the chase tier: a homer faster than the player\'s walk, awake at the boot, whatever the gap', () => {
        const p = playerBoxAt({ x: 96, y: 288 });
        expect(contactOf(p, bodyOf({ type: 'lavarunner', x: 80, y: 272 }))).toMatchObject({ hit: false, chase: true, gap: 8 });
        // a bob is a homer but slower than the player (0.5 < 0.8): never the chase tier
        expect(contactOf(p, bodyOf({ type: 'bob', x: 80, y: 272 }))).toMatchObject({ chase: false, awake: true });
        // asleep (beyond runRange 80) is not the chase tier either
        expect(contactOf(p, bodyOf({ type: 'lavarunner', x: 200, y: 288 })).chase).toBe(false);
    });
    it('a still body is a screen hit only by overlap', () => {
        const p = playerBoxAt({ x: 32, y: 288 });
        const trap = bodyOf({ type: 'darktrap', x: 32, y: 272 });
        expect(trap.speed).toBe(0);
        expect(contactOf(p, trap)).toMatchObject({ overlap: false, reach: false, hit: false });
    });
});

describe('the census of the committed rules', () => {
    const delivered = landingContactCensus(RULES, PLAYTHROUGH_MAP);
    it('enumerates the rules\' landings, each with the regions it serves', () => {
        expect(delivered.landings.length).toBeGreaterThan(300);
        const l74 = delivered.landings.find((l) => l.level === 73 && l.x === 64 && l.y === 16);
        // ⛓ rules-k-pursuit-resume: rule K splits L74 at its lavarunners' leash cuts; its L73 door is in member r8c18
        expect(l74.arrivedFrom).toEqual(['level_74__r8c18']);
    });
    it('the delivered set leaves no screen hit that a door arrives through (the L73 runner is moved)', () => {
        const arrived = delivered.rows.filter((r) => r.hit && r.arrivedFrom.length > 0);
        expect(arrived.map((r) => `L${r.level} (${r.x},${r.y}) ${r.body.id}`)).toEqual([]);
    });
    it('WITHOUT the L73 move the screen finds the L74 arrival (the regression this census exists for)', () => {
        const without = patchedMapDocument(MAP, SEEDLING_SET_PATCHES.filter((p) => p.id !== 'l73-lavarunner-moved'));
        const rows = landingContactCensus(RULES, without).rows.filter((r) => r.hit && r.arrivedFrom.length > 0);
        expect(rows.map((r) => `L${r.level} (${r.x},${r.y}) ${r.body.id}`)).toEqual(['L73 (64,16) lavarunner@72,24']);
    });
    it('the other screen hits are pit spawns that no edge arrives through', () => {
        const rest = delivered.rows.filter((r) => r.hit);
        expect(rest.every((r) => r.arrivedFrom.length === 0 && r.overlap)).toBe(true);
        expect(landingsOfRules(RULES, PLAYTHROUGH_MAP).length).toBe(delivered.landings.length);
    });
});

describe('the probe\'s per-input verdict', () => {
    const read = (tick, level, hits, timer = 0, dead = 0) => ({ tick, level, hits, hits_timer: timer, dead_frames: dead });
    it('a hit is dated by the timer (tick + hits_timer − 20 + 1), an ejection by the first read in another level', () => {
        const v = inputVerdict([read(1, 73, 0), read(3, 73, 1, 19), read(6, 74, 0)], 73);
        expect(v).toMatchObject({ firstHit: 3, left: { level: 74, tick: 6 }, verdict: 'hit@3,left->L74@6' });
    });
    it('a read before tick 1 is the previous tape\'s and is ignored', () => {
        expect(inputVerdict([read(0, 73, 1, 8), read(1, 73, 0), read(180, 73, 0)], 73).verdict).toBe('clear');
    });
    it('a count left standing by the previous tape (timer run out before tick 20) is the baseline, not a hit', () => {
        const v = inputVerdict([read(1, 73, 1, 0), read(40, 73, 1, 0), read(61, 73, 2, 19)], 73);
        expect(v).toMatchObject({ staleHits: 1, firstHit: 61, verdict: 'hit@61' });
        // a real hit at t1 still carries its timer, so it is not taken for a stale count
        expect(inputVerdict([read(2, 73, 1, 19)], 73)).toMatchObject({ staleHits: 0, firstHit: 2 });
    });
    it('an arrival hit needs every input hit or thrown out, and at least one hit', () => {
        const hit = { firstHit: 2, left: null };
        const out = { firstHit: null, left: { level: 74, tick: 4 } };
        const clear = { firstHit: null, left: null };
        expect(isArrivalHit([hit, hit, out])).toBe(true);
        expect(isArrivalHit([hit, clear])).toBe(false);
        expect(isArrivalHit([out, out])).toBe(false);
    });
    it('no clean input: each input hit, dead or gone, one hit at least (a lava death is no entry either)', () => {
        const hit = { firstHit: 65, left: null, restarts: 0 };
        const dies = { firstHit: null, left: null, restarts: 2 };
        const out = { firstHit: null, left: { level: 71, tick: 7 }, restarts: 0 };
        const clear = { firstHit: null, left: null, restarts: 0 };
        expect(hasNoCleanInput([hit, dies, dies, out, hit])).toBe(true);
        expect(isArrivalHit([hit, dies, dies, out, hit])).toBe(false);
        expect(hasNoCleanInput([hit, dies, clear])).toBe(false);
        expect(hasNoCleanInput([dies, out])).toBe(false);
    });
});
