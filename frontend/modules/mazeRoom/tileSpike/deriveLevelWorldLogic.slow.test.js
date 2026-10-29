/**
 * The level-world CERTIFIER (`certifyPlaythroughMaze.js`) on the committed `seedling_playthrough_maze` preset
 * (⚖ "Certifier", user 2026-10-21). ⚖ Tier split (user, 2026-10-21, session tile-primitives-grow-levels:
 * "Native all + scripted sample"): here, EVERY region on the NATIVE engine (⚖ Q6 "native default"), and the
 * SCRIPTED tile definition (⚖ Q3 "one def; logic by search" — `scriptedStep` + the helper bodies) on a fixed
 * SAMPLE, which must agree with the native lines for the same regions. The full scripted pass over every
 * region is the calib tier's (`deriveLevelWorldLogic.calib.test.js`): measured over the whole game it is
 * 346 s scripted against 50 s native.
 *
 * The sample: both shared level worlds the parity was built on (L15, L16), one per-sub-region level (L14), and L18 —
 * the preset's first COUNTED rule (r1c1 ↔ r7c10 = Or(Shield×2, …)), once scripted ≠ native (⚖ user 2026-10-25, session
 * tile-primitives-grow-l18: "Add L18 to sample"; 0.35 s scripted), and one region per ring-2 level (⚖ user 2026-10-25, session
 * tile-primitives-grow-ring2: "+L0 r8c0, L19 r5c5, L20 r1c4") — L0's shared world (the preset's start; 6.1 s scripted, any
 * member certifies it whole), L19 r5c5 (once "not priced", a crossing collision) and L20's Shield location (~0.05 s together).
 * And one region per sphere-0 feature (⚖ user 2026-10-25, session tile-primitives-sphere-order-1: "The 3 feature regions"):
 * L3 r0c4 (the ghost rock's rule strike), L8 (the block sink, 1.7 s scripted) and L94 r3c4 (a per-sub-region cliff's entry gates).
 * And two of sphere 0.1's (⚖ user 2026-10-26, session tile-primitives-sphere-order-2: "r42c28 + L67 r3c2"): L12 r42c28 (the magical lock
 * stacked on a boss lock, each opening by its own rule; 4.3 s scripted) and L67 r3c2 (the struck block, priced from r6c11 — its only way in;
 * under 0.1 s). L12 r0c19 (the doorway's touched lock) costs 136 s scripted and stays pinned natively (`sphereOrderLevels.test.js`).
 * And two of sphere 2.2's (⚖ user 2026-10-27, session tile-primitives-sphere-order-3: "Add L28 r0c6 + L30 r0c4"): L28 r0c6 (the rope
 * and the button its fallrock holds, one shared world; 0.9 s scripted) and L30 r0c4 (a struck rock beside two boss-lock events; 1.6 s).
 * And sphere 3.7's L32 (⚖ user 2026-10-27, session tile-primitives-sphere-order-4: "Re-record + add L32"): its two locations on one tile,
 * one spilled to the nearest free floor cell, each behind the boss fight's static weapon gate.
 * And sphere 5.3's (session tile-primitives-sphere-order-6): L39 r25c9 (the press's target and the pocket's gated doors; 1.5 s scripted)
 * and L40 r23c29 (the shared world whose Fire cells carry the corpse ruling; 7.5 s native, 78 s scripted, measured 2026-10-28).
 * And sphere 5.6's two cross-room presses (session tile-primitives-sphere-order-7): L61 r0c10 (it lights L63's pole) and L63 r0c1 (it lights
 * L62's), each a location on its ButtonRoom's cell.
 * And sphere 6.1's poles (⚖ user 2026-10-28, session tile-primitives-lightpoles: "Add L62 + L63 r10c2"): L62 (the cross-room pole's DarkTrap,
 * opened by L63's press or a thrust from a stance, priced from the L64 pocket landing too) and L63 r10c2 (an in-room pole's event, a thrust
 * from its stances); ~15 s scripted with L63's other two regions, measured 2026-10-28.
 * L89 r1c10 → L91, the one open problem sphere-order-7 named (⚖ 2026-10-28 "Ask for a game probe"), is CLOSED: the L91 teleporter
 * stands on a waterfall tile, the game probe sided with the world's Feather (Swim×2), and the rules producer now charges it
 * (session rules-waterfall-door).
 *
 * Slow tier: ~35 s native (every region, then the sample again for its lines) + ~86 s scripted sample on one
 * core (measured 2026-10-21, L13–L17). Since the arrow trap + rope (session tile-primitives-arrow-rope, 2026-10-22)
 * L16's cut doubles its state space; with the facing-free search: native every region 43.5 s, native sample 21.5 s,
 * scripted sample 146 s. No exemption: every region agrees, the rope gate derived from the lane and the cut — except the rows the
 * certifier ACCEPTS by name: those implied by every AP way into their source (L0 r2c13 → r1c6, by the Swim; L39 r25c9 → r0c9 and
 * → r2c11, by the press, priced from the pocket the L38 teleporter lands in), and one on the rules
 * producer's own permissive bound (L89's Feather, entered only from above; `permissive`, read from the producer).
 * Sphere 0.1 (2026-10-26, measured): native every region + the native sample 59 s, the scripted sample 256 s.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import { playthroughPermissiveLocations } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const SAMPLE = ['level_14', 'level_15__r1c5', 'level_15__r1c9', 'level_15__r6c8', 'level_16__r1c1', 'level_16__r4c21',
    'level_18__r1c1', 'level_18__r7c10', 'level_0__r7c6', 'level_19__r5c5', 'level_20__r1c4',
    'level_3__r0c4', 'level_8', 'level_94__r3c4', 'level_12__r42c28', 'level_67__r3c2', 'level_28__r0c6', 'level_30__r0c4', 'level_32', 'level_38',
    'level_39__r25c9', 'level_40__r23c29', 'level_61__r0c10', 'level_63__r0c1', 'level_62', 'level_63__r10c2'];
const PERMISSIVE = playthroughPermissiveLocations();

/** A copy of the preset with one AP exit's rule replaced — the closure comparison's mutant controls. */
const withExitRule = (from, to, rule) => {
    const copy = structuredClone(RULES);
    const exit = copy.regions['1'][from].exits.find((e) => e.connected_region === to);
    expect(exit, `${from} -> ${to}`).toBeDefined();
    exit.access_rule = rule;
    return copy;
};

describe('seedling_playthrough_maze — every region certified against the atlas at every subset', () => {
    let sampleLines;
    it('native engine, every region', () => {
        const { problems, lines, accepted, skipped } = certifyPlaythroughMaze(RULES, HELPERS, { native: true, atlas: ATLAS, permissive: PERMISSIVE });
        expect(problems).toEqual([]);
        expect(lines.length).toBeGreaterThan(0);
        expect(accepted.map((a) => `${a.label} | ${a.by}`).sort()).toEqual([
            'level_0__r2c13 → level_0__r1c6 | Progressive Swim',
            'level_39__r25c9 → level_39__r0c9 | L39 flag 8: wandlock@144,592 cleared',
            'level_39__r25c9 → level_39__r2c11 | L39 flag 8: wandlock@144,592 cleared',
            'level_89__r9c6 @ Level 089 - Feather (from level_89__r11c12) | the rules producer leaves level_89/Level 089 - Feather uncharged (permissiveBindings)',
            'level_91 → level_89__r1c10 (landing 15,4) | Progressive Swim',
        ]);
        // ⛓ THE SKIP CENSUS (session tile-primitives-lightpoles, designer review): every row whose LANDING arrival has points no AP
        // crossing landing there admits — counted and named, so a new skip is a diff here, never silence. L62/L63/L64 are the pole
        // pockets; the rest are landings whose AP crossings already cost an item (water, a lock, a weapon) at that cell.
        expect(skipped.map((k) => `${k.label} | ${k.points}/${k.of}${k.partial ? ' (problem)' : ''}`)).toEqual([
            'level_0__r2c13 → level_89__r11c12 (landing 15,1) | 13/48',
            'level_0__r6c5 → level_1 (landing 5,7) | 21/48',
            'level_0__r11c19 → level_12__r0c19 (landing 18,11) | 21/48',
            'level_5__r1c1 → level_12__r13c6 (landing 1,2) | 1/2',
            'level_12__r40c4 @ L12 flag 3: bosslock@80,656 cleared (landing 2,44) | 3/16',
            'level_12__r40c4 → level_12__r0c19 (landing 2,44) | 3/16',
            'level_12__r40c4 → level_24 (landing 2,44) | 3/16',
            'level_16__r3c7 → level_17 (landing 7,3) | 16/32',
            'level_24 @ L24 flag 0: burnabletree@32,128 cleared (landing 3,8) | 2/4',
            'level_24 → level_12__r40c4 (landing 3,8) | 2/4',
            'level_24 → level_23 (landing 3,8) | 2/4',
            'level_48__r7c0 → level_48__r4c3 (landing 1,7) | 1/2',
            'level_48__r7c0 → level_53__r2c2 (landing 1,7) | 1/2',
            'level_49 @ Level 049 - Conch (landing 2,7) | 1/2',
            'level_49 → level_50 (landing 2,7) | 1/2',
            'level_50 → level_49 (landing 2,1) | 1/2',
            'level_50 → level_51__r3c10 (landing 2,1) | 1/2',
            'level_51__r3c10 → level_50 (landing 9,1) | 1/2',
            'level_51__r3c10 → level_53__r2c2 (landing 9,1) | 1/2',
            'level_51__r14c6 → level_52__r5c10 (landing 15,16) | 1/2',
            'level_52__r0c7 → level_52__r2c2 (landing 7,1) | 1/3',
            'level_52__r0c7 → level_52__r5c10 (landing 7,1) | 1/3',
            'level_52__r0c7 → level_54__r27c8 (landing 7,1) | 1/3',
            'level_52__r2c2 → level_52__r0c7 (landing 1,3) | 1/3',
            'level_52__r2c2 → level_52__r5c10 (landing 1,3) | 1/3',
            'level_52__r2c2 → level_55 (landing 1,3) | 1/3',
            'level_52__r5c10 → level_52__r0c7 (landing 1,7) | 1/3',
            'level_52__r5c10 → level_52__r2c2 (landing 1,7) | 1/3',
            'level_52__r5c10 → level_51__r14c6 (landing 1,7) | 1/3',
            'level_52__r5c10 → level_56 (landing 1,7) | 1/3',
            'level_54__r1c8 → level_53__r14c9 (landing 9,1) | 1/3',
            'level_54__r27c8 → level_52__r0c7 (landing 8,28) | 1/3',
            'level_55 @ Level 055 - Boss Key 3 (landing 4,3) | 1/2',
            'level_55 → level_52__r2c2 (landing 4,3) | 1/2',
            'level_56 → level_52__r5c10 (landing 1,7) | 1/2',
            'level_62 → level_61__r0c7 (landing 7,5) | 1/4',
            'level_62 → level_61__r0c10 (landing 7,5) | 1/4',
            'level_62 → level_64 (landing 7,5) | 1/4',
            'level_62 → level_63__r0c1 (landing 7,5) | 2/8',
            'level_63__r0c1 @ L62 flag 0: lightpole@120,200 cleared (landing 4,1) | 6/96',
            'level_63__r0c1 → level_61__r0c10 (landing 4,1) | 6/96',
            'level_63__r0c1 → level_61__r0c7 (landing 4,1) | 6/96',
            'level_63__r0c1 → level_62 (landing 4,1) | 6/96',
            'level_64 → level_62 (landing 2,5) | 1/4',
            'level_89__r11c12 → level_0__r2c13 (landing 10,18) | 1/3',
            'level_89__r11c12 → level_87__r1c3 (landing 10,18) | 1/3',
            'level_91 → level_89__r1c10 (landing 1,8) | 2/3',
            'level_91 → level_92__r4c2 (landing 1,8) | 2/3',
        ]);
        sampleLines = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: SAMPLE, atlas: ATLAS, permissive: PERMISSIVE }).lines;
        // ⛓ Sphere 2.2 (session tile-primitives-sphere-order-3): L28's rope drops its fallrock on the grass lock's button. The maze
        // lays neither; the cut's minted event gates the r11c4 ↔ r1c18 link the lock stands on, and any of the three strikes cuts it.
        const ROPE28 = 'L28 flag 0: rope@160,64 cleared';
        expect(sampleLines).toContain(`level_28__r11c4>level_28__r1c18=${JSON.stringify([[ROPE28]])}`);
        expect(sampleLines).toContain(`level_28__r1c18>level_28__r11c4=${JSON.stringify([[ROPE28]])}`);
        expect(sampleLines).toContain(`level_28__r0c6@${ROPE28}=${JSON.stringify([['Fire'], ['Ghost Spear'], ['Progressive Sword']])}`);
    }, 300_000);
    it('scripted tile definition on the sample — and it agrees with the native one', () => {
        for (const r of SAMPLE) expect(Object.keys(RULES.preset_sidecars['1'])).toContain(r);
        const { problems, lines } = certifyPlaythroughMaze(RULES, HELPERS, { native: false, regions: SAMPLE, atlas: ATLAS, permissive: PERMISSIVE });
        expect(problems).toEqual([]);
        expect(lines).toEqual(sampleLines);
    }, 600_000);
    // ⛓ The in-world CLOSURE comparison is two-sided: a mutated in-world AP row that makes the atlas stricter than
    // the world (the world LOOSER), or looser than it, is still caught (rules-rope-events; asked by
    // tile-primitives-design). L15 alone: its world is certified when any member is in the sample.
    it('the closure comparison still catches an in-world row the world disagrees with, both ways', () => {
        const L15 = { native: true, regions: ['level_15__r1c5'], atlas: ATLAS };
        expect(certifyPlaythroughMaze(RULES, HELPERS, L15).problems).toEqual([]);
        const looser = certifyPlaythroughMaze(withExitRule('level_15__r1c5', 'level_15__r1c9',
            { rule: 'Has', args: { item_name: 'Progressive Swim' } }), HELPERS, L15).problems;
        expect(looser.some((p) => p.startsWith('level_15__r1c5 → level_15__r1c9 holding') && p.endsWith('derived true, atlas false')),
            JSON.stringify(looser)).toBe(true);
        const stricter = certifyPlaythroughMaze(withExitRule('level_15__r1c5', 'level_15__r1c9', { rule: 'True_' }),
            HELPERS, L15).problems;
        expect(stricter.some((p) => p.startsWith('level_15__r1c5 → level_15__r1c9 holding') && p.endsWith('derived false, atlas true')),
            JSON.stringify(stricter)).toBe(true);
    }, 300_000);
});
