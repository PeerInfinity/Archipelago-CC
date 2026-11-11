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
 * And spheres 6.10/7.8's two features (session tile-primitives-sphere-order-8): L58 r3c3 (the Yeti's talk location; its world's portal door)
 * and L65 r0c8 (an in-room pole and the pocket door into L63's r6c9).
 * And sphere 8.5's two (⚖ user 2026-10-29, session tile-primitives-sphere-order-9: "Add L80 r0c2 + L71 r0c6"): L80 r0c2 (the level world its
 * LavaTraps' pulls made of it; 0.9 s scripted) and L71 r0c6 (the shield lock, its own event skipped at its landing; 13.6 s scripted, load ~24).
 * L89 r1c10 → L91, the one open problem sphere-order-7 named (⚖ 2026-10-28 "Ask for a game probe"), is CLOSED: the L91 teleporter
 * stands on a waterfall tile, the game probe sided with the world's Feather (Swim×2), and the rules producer now charges it
 * (session rules-waterfall-door).
 *
 * Slow tier: ~35 s native (every region, then the sample again for its lines) + ~86 s scripted sample on one
 * core (measured 2026-10-21, L13–L17). Since the arrow trap + rope (session tile-primitives-arrow-rope, 2026-10-22)
 * L16's cut doubles its state space; with the facing-free search: native every region 43.5 s, native sample 21.5 s,
 * scripted sample 146 s. No exemption: every region agrees, the rope gate derived from the lane and the cut — except the rows the
 * certifier ACCEPTS by name: those implied by every AP way into their source (L0 r2c13 → r1c6, by the Swim; L39 r25c9 → r0c9 and
 * → r2c11, by the press, priced from the pocket the L38 teleporter lands in), and (session
 * tile-primitives-sphere-order-8, ⚖ "Excuse on mismatch") L63 r6c9's rows at points no crossing into it from outside admits — its
 * entrance is the L65 pocket landing. One row stays OPEN by name (`OPEN_L63`, ⚖ "Land, name it; route to rules"),
 * and from sphere 11.6 a second (`OPEN_L3_L111`), since closed by the rules (below).
 * Sphere 0.1 (2026-10-26, measured): native every region + the native sample 59 s, the scripted sample 256 s.
 *
 * ⚖ Robert 2026-11-02 CI manual-only P3 — SUPERSEDES the 2026-10-21 tier split ("Native all + scripted sample") for push:
 * the SCRIPTED-sample case moved to `deriveLevelWorldLogic.train.test.js` (train pushes + dispatch `-f train=true`). On push
 * this file keeps the NATIVE certifier on every region and the closure mutants; the per-helper parity stays on push in the
 * gadget-room tests (tileStep.test.js and the latch/pull/pulser rooms). What a push no longer catches: scripted ≠ native on
 * REAL levels. design-2's rule: a slice that touches tileStep.js, maze_tiles.helpers.json, maze_tiles.py or an engine
 * primitive runs the train tier (CI dispatch or cloud, not the box) before its designer review, and reports it.
 */
import { describe, it, expect } from 'vitest';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, ATLAS, SAMPLE, OPEN_L53, OPEN_L60, OPEN_L63, PERMISSIVE } from './deriveLevelWorldLogic.fixture.js';


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
        // ⛓ rules-l26-rocklock-pocket: + OPEN_L53 (the fixture says why: the atlas is the game's side).
        // ⛓ rules-l60-l71-killlock: + OPEN_L60 (its mirror: the latch's own across-the-cut arm, which the level world does not lay).
        expect(problems).toEqual([OPEN_L53, OPEN_L60, OPEN_L63]);
        expect(lines.length).toBeGreaterThan(0);
        expect(accepted.map((a) => `${a.label} | ${a.by}`).sort()).toEqual([
            'level_0__r2c13 → level_0__r1c6 | Progressive Swim',
            'level_39__r25c9 → level_39__r0c9 | L39 flag 8: wandlock@144,592 cleared',
            'level_39__r25c9 → level_39__r2c11 | L39 flag 8: wandlock@144,592 cleared',
            'level_57 @ Level 057 - Tentacled Beast | Progressive Swim',
            'level_63__r5c14 @ Level 063 - Chest (from level_63__r6c9) | Ghost Spear',
            'level_63__r5c14 @ Level 063 - Chest (from level_63__r6c9) | Progressive Swim',
            'level_63__r5c14 @ Level 063 - Chest (from level_63__r6c9) | no AP crossing into level_63__r6c9 from outside its world admits this arrival',
            'level_63__r6c9 → level_63__r10c2 | Progressive Swim',
            'level_63__r6c9 → level_63__r10c2 | no AP crossing into level_63__r6c9 from outside its world admits this arrival',
            'level_63__r6c9 → level_63__r5c14 | Ghost Spear',
            'level_63__r6c9 → level_63__r5c14 | Progressive Swim',
            'level_63__r6c9 → level_63__r5c14 | no AP crossing into level_63__r6c9 from outside its world admits this arrival',
            'level_63__r6c9 → level_63__r6c15 | Ghost Spear',
            'level_63__r6c9 → level_63__r6c15 | Progressive Swim',
            'level_63__r6c9 → level_63__r6c15 | no AP crossing into level_63__r6c9 from outside its world admits this arrival',
            'level_82 @ Level 082 - King of Fire | Dark Suit',
            // ⛓ RULES l89-feather: `level_89__r9c6 @ Level 089 - Feather (from level_89__r11c12) | … (permissiveBindings)` is gone —
            // the Feather is bound to its cheapest way (level_89__r1c10, by Swim), so its row AGREES instead of being excused.
            // ⛓ rules-certifier-tail: `level_91 → level_89__r1c10 (landing 15,4) | Progressive Swim` is gone — L91's door now
            // charges the Swim every way onto it pays (`chargeNecessaryApproaches`), so the row AGREES instead of being excused.
        ]);
        // ⛓ THE SKIP CENSUS (session tile-primitives-lightpoles, designer review): every row whose LANDING arrival has points no AP
        // crossing landing there admits — counted and named, so a new skip is a diff here, never silence. L62/L63/L64 are the pole
        // pockets; the rest are landings whose AP crossings already cost an item (water, a lock, a weapon) at that cell. `[own event]`
        // (session tile-primitives-sphere-order-8): an event location's points holding its OWN event at a landing are not asked.
        // Sphere 8.5 (session tile-primitives-sphere-order-9) adds 13: L12 r42c28's landing from L83 (2,54), wired now, admits only
        // with its two stacked lock events (8 rows); L69's from L70 (2); L71's shield lock at its landing (14,18) [own event] (1); L83's (2).
        // ⛓ RULES l63-pole-crossings: the poles' Ghost Sword arm (the fusion's three items) puts Ghost Sword Fusion and
        // Progressive Sword into L62's and L63's subset universe, so their rows count 4x the subsets — same rows. The fractions stay,
        // but for the L65 pocket landings (8,18)/(2,18): 60/192 → 192/768, since the L65 door now also admits the swing (fewer
        // unadmitted points); their [own event] rows are exactly 4x (48 → 192).
        // Sphere 9.10 (session tile-primitives-sphere-order-10) adds 6: L71 r0c6's landing from L76 (18,16), wired now, whose AP
        // crossing costs L71's shield lock (flag 2) — admitted only holding it, as its other landing (14,18).
        // Sphere 10.2 (session tile-primitives-sphere-order-11) adds 6, all already in the whole game's census: L82's landing from L71
        // (9,1) (2); L93 r5c7's from L98 (7,6), wired now, so r5c7 is priced from its landings (2); L101 r4c9 ↔ L102 r5c9 (2).
        // Sphere 11.6 (session tile-primitives-sphere-order-12) adds 8, all but one already in the whole game's census: L102 r5c9 → L107
        // (11,6), wired now (1); L112's landing from L113 (7,1) (2) and its rock-lock event at its L111 landing (2,13) [own event] (1); L3 r0c4
        // priced from L111's return landing (1,4) (3); and L113's finaldoor at its L114 landing (1,1) [own event] (1), which the whole game
        // prices over twice the points (L115's Swim exit adds an axis item).
        // Spheres 12.2 + 12.3 (session tile-primitives-sphere-order-13) take 1 and add 13, all in the whole game's census: L115 lands in
        // L113 on the FinalDoor's lower row (7,1)/(8,1), whose crossing from L115 already holds the event (10: the event, its own-event row,
        // and L113's three ways out, per landing), L113's own (1,1) row now over L115's Swim axis (7/96 → 14/192), and L115 r9c4's
        // landings from L113 (4,8)/(5,8) (2). L110 adds none.
        // ⛓ rules-sided-openers adds 2 [own event] rows: the two latching ShieldLocks' events (L12 flag 10, L20 flag 0), and
        // L12 r0c19's subset universe doubles with its new event item (2048 → 4096; the two bosslock rows 144 → 216).
        // ⛓ R-A2 (session tile-rules-automation-r-a2, the input/output split; re-recorded at c5764cf46f on main 06fe11dea5): 18 plain
        // levels play as ONE level world. Their in-world crossings are walked pairs, not exit rows, and a member is priced over
        // the whole world's axis: 16 rows go (L52 ×8, L48 r7c0 → r4c3, L93 r5c7 → r10c7, L102 ×2, L112 r0c7 → r2c2, and the
        // [own event] rows of L31, L68 and L112), and 3 are RE-COUNTED over the larger axis (L48 r7c0 → L53 1/2 → 6/16, L93 → L98
        // 1/2 → 4/12, L112 → L113 4/8 → 8/16). 118 → 102.
        // ⛓ tile-l12-one-world (⚖ Robert 2026-11-04 "A: Build after R-A3 (Recommended)"; designer design-3 GO): L12 is ONE level
        // world, its rows priced over the whole world's 17-item axis (131,072 points). 16 per-sub-region L12 rows go (r0c19's three
        // [own event] lock rows over 4,096, r13c6's flag 11, r40c4's four, r42c28's eight over 128) and 11 one-world rows come:
        // r0c37 → L37 r12c6 / L21 from its landing (27,35) 2,700 (F1: newly partial), r40c4's flag 3 ×2 and → L24 from (2,44),
        // r42c28's chest, flags 7/12 ×2 and → L83 from (2,54). r42c28 → r0c19 / r0c37 are pairs inside the world now. 104 → 99.
        // ⛓ tile-l89-feather-swim (⚖ Robert 2026-11-07 "Re-record (Recommended)"): L89's Feather is bound to its cheapest way,
        // level_89__r1c10, so it is priced from r1c10's landing from L91 (13,1) like r1c10's door to L91 beside it (1/3). 99 → 100.
        expect(skipped.map((k) => `${k.label} | ${k.points}/${k.of}${k.partial ? ' (problem)' : ''}${k.why ? ` [${k.why}]` : ''}`)).toEqual([
            'level_0__r2c13 → level_89__r11c12 (landing 15,1) | 13/48',
            'level_0__r6c5 → level_1 (landing 5,7) | 21/48',
            'level_0__r11c19 → level_12__r0c19 (landing 18,11) | 21/48',
            'level_3__r0c4 → level_111 (landing 1,4) | 8/16',
            'level_3__r0c4 → level_2 (landing 1,4) | 8/16',
            'level_3__r0c4 → level_4 (landing 1,4) | 8/16',
            'level_5__r1c1 → level_12__r13c6 (landing 1,2) | 1/2',
            'level_12__r0c37 → level_37__r12c6 (landing 27,35) | 2700/131072',
            'level_12__r0c37 → level_21 (landing 27,35) | 2700/131072',
            'level_12__r40c4 @ L12 flag 3: bosslock@80,656 cleared (landing 2,44) | 2700/131072',
            'level_12__r40c4 @ L12 flag 3: bosslock@80,656 cleared (landing 2,44) | 1800/131072 [own event]',
            'level_12__r40c4 → level_24 (landing 2,44) | 2700/131072',
            'level_12__r42c28 @ Level 012 - Chest (landing 2,54) | 7020/131072',
            'level_12__r42c28 @ L12 flag 7: magicallock@32,864 cleared (landing 2,54) | 7020/131072',
            'level_12__r42c28 @ L12 flag 7: magicallock@32,864 cleared (landing 2,54) | 1080/131072 [own event]',
            'level_12__r42c28 @ L12 flag 12: bosslock@32,864 cleared (landing 2,54) | 7020/131072',
            'level_12__r42c28 @ L12 flag 12: bosslock@32,864 cleared (landing 2,54) | 1080/131072 [own event]',
            'level_12__r42c28 → level_83 (landing 2,54) | 7020/131072',
            'level_16__r3c7 → level_17 (landing 7,3) | 16/32',
            'level_24 @ L24 flag 0: burnabletree@32,128 cleared (landing 3,8) | 2/4',
            'level_24 @ L24 flag 0: burnabletree@32,128 cleared (landing 3,8) | 1/4 [own event]',
            'level_24 → level_12__r40c4 (landing 3,8) | 2/4',
            'level_24 → level_23 (landing 3,8) | 2/4',
            'level_24 @ L24 flag 0: burnabletree@32,128 cleared (landing 6,5) | 1/4 [own event]',
            // ⛓ tile-lay-l40-latches: L40's two r0c53 presses, priced from r0c53's second landing (53,1): the points holding
            // the press's own event are skipped [own event] (as L24's tree). L40 flag 12's press stands in r48c54, which no AP
            // exit lands in (walked in from another member), so it has no landing row. 102 → 104.
            'level_40__r0c53 @ L40 flag 1: wandlock@176,80 cleared (landing 53,1) | 192/512 [own event]',
            'level_40__r0c53 @ L40 flag 7: wandlock@208,128 cleared (landing 53,1) | 192/512 [own event]',
            'level_48__r7c0 → level_53__r2c2 (landing 1,7) | 6/16',
            'level_49 @ Level 049 - Conch (landing 2,7) | 1/2',
            'level_49 → level_50 (landing 2,7) | 1/2',
            'level_50 → level_49 (landing 2,1) | 1/2',
            'level_50 → level_51__r3c10 (landing 2,1) | 1/2',
            'level_51__r3c10 → level_50 (landing 9,1) | 1/2',
            'level_51__r3c10 → level_53__r2c2 (landing 9,1) | 1/2',
            'level_51__r14c6 → level_52__r5c10 (landing 15,16) | 1/2',
            'level_52__r0c7 → level_54__r27c8 (landing 7,1) | 1/3',
            'level_52__r2c2 → level_55 (landing 1,3) | 1/3',
            // ⛓ rules-l26-rocklock-pocket: 24/48 -> 46/96, `L53 flag 2` joins the pocket's subset universe (2x the subsets).
            'level_53__r14c9 → level_54__r1c8 (landing 9,14) | 46/96',
            'level_54__r1c8 → level_53__r14c9 (landing 9,1) | 1/3',
            'level_54__r27c8 → level_52__r0c7 (landing 8,28) | 1/3',
            'level_55 @ Level 055 - Boss Key 3 (landing 4,3) | 1/2',
            'level_55 → level_52__r2c2 (landing 4,3) | 1/2',
            'level_56 → level_52__r5c10 (landing 1,7) | 16/32',
            'level_56 → level_57 (landing 1,7) | 16/32',
            'level_57 @ Level 057 - Tentacled Beast (landing 6,4) | 10/24',
            'level_57 → level_58__r4c1 (landing 6,4) | 10/24',
            'level_58__r4c1 → level_57 (landing 3,6) | 18/32',
            'level_62 → level_61__r0c7 (landing 7,5) | 4/16',
            'level_62 → level_61__r0c10 (landing 7,5) | 4/16',
            'level_62 → level_64 (landing 7,5) | 4/16',
            'level_62 → level_63__r0c1 (landing 7,5) | 8/32',
            'level_63__r0c1 @ L62 flag 0: lightpole@120,200 cleared (landing 4,1) | 24/768',
            'level_63__r0c1 → level_61__r0c10 (landing 4,1) | 24/768',
            'level_63__r0c1 → level_61__r0c7 (landing 4,1) | 24/768',
            'level_63__r0c1 → level_62 (landing 4,1) | 24/768',
            'level_63__r6c9 @ L63 flag 7: lightpole@112,272 cleared (landing 8,18) | 192/768',
            'level_63__r6c9 @ L63 flag 7: lightpole@112,272 cleared (landing 8,18) | 192/768 [own event]',
            'level_63__r6c9 → level_65__r0c8 (landing 8,18) | 192/768',
            'level_63__r10c2 @ L63 flag 6: lightpole@48,272 cleared (landing 2,18) | 192/768',
            'level_63__r10c2 @ L63 flag 6: lightpole@48,272 cleared (landing 2,18) | 192/768 [own event]',
            'level_63__r10c2 → level_61__r13c12 (landing 2,18) | 192/768',
            'level_63__r10c2 → level_65__r0c2 (landing 2,18) | 192/768',
            'level_64 → level_62 (landing 2,5) | 1/4',
            'level_69 @ Level 069 - Lights (landing 3,8) | 1/8',
            'level_69 → level_36 (landing 3,8) | 1/8',
            'level_71__r0c6 @ L71 flag 2: shieldlock@288,256 cleared (landing 14,18) | 8/48 [own event]',
            'level_71__r0c6 @ Level 071 - Chest (landing 18,16) | 24/48',
            'level_71__r0c6 @ L71 flag 2: shieldlock@288,256 cleared (landing 18,16) | 24/48',
            'level_71__r0c6 @ L71 flag 2: shieldlock@288,256 cleared (landing 18,16) | 8/48 [own event]',
            'level_71__r0c6 → level_75 (landing 18,16) | 24/48',
            'level_71__r0c6 → level_80__r0c2 (landing 18,16) | 24/48',
            'level_71__r0c6 → level_72 (landing 18,16) | 24/48',
            'level_82 @ Level 082 - King of Fire (landing 9,1) | 5/8',
            'level_82 → level_96 (landing 9,1) | 5/8',
            'level_83 → level_12__r42c28 (landing 2,3) | 20/64',
            'level_83 → level_84__r2c4 (landing 2,3) | 20/64',
            'level_89__r1c10 @ Level 089 - Feather (landing 13,1) | 1/3',
            'level_89__r1c10 → level_91 (landing 13,1) | 1/3',
            'level_89__r11c12 → level_0__r2c13 (landing 10,18) | 1/3',
            'level_89__r11c12 → level_87__r1c3 (landing 10,18) | 1/3',
            'level_91 → level_89__r1c10 (landing 1,8) | 2/3',
            'level_91 → level_92__r4c2 (landing 1,8) | 2/3',
            'level_93__r5c7 → level_98 (landing 7,6) | 4/12',
            'level_101__r4c9 → level_102__r5c9 (landing 9,5) | 32/128',
            'level_111 → level_112__r2c2 (landing 18,11) | 1/2',
            'level_111 → level_3__r0c4 (landing 18,11) | 1/2',
            'level_112__r0c7 → level_113 (landing 7,1) | 8/16',
            'level_113 @ L113 flag 0: finaldoor@112,0 cleared (landing 1,1) | 14/192 [own event]',
            'level_113 @ L113 flag 0: finaldoor@112,0 cleared (landing 7,1) | 84/192',
            'level_113 @ L113 flag 0: finaldoor@112,0 cleared (landing 7,1) | 14/192 [own event]',
            'level_113 → level_114 (landing 7,1) | 84/192',
            'level_113 → level_112__r0c7 (landing 7,1) | 84/192',
            'level_113 → level_115__r9c4 (landing 7,1) | 84/192',
            'level_113 @ L113 flag 0: finaldoor@112,0 cleared (landing 8,1) | 84/192',
            'level_113 @ L113 flag 0: finaldoor@112,0 cleared (landing 8,1) | 14/192 [own event]',
            'level_113 → level_114 (landing 8,1) | 84/192',
            'level_113 → level_112__r0c7 (landing 8,1) | 84/192',
            'level_113 → level_115__r9c4 (landing 8,1) | 84/192',
            'level_115__r9c4 → level_113 (landing 4,8) | 17/36',
            'level_115__r9c4 → level_113 (landing 5,8) | 17/36',
        ]);
        sampleLines = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions: SAMPLE, atlas: ATLAS, permissive: PERMISSIVE }).lines;
        // ⛓ Sphere 2.2 (session tile-primitives-sphere-order-3): L28's rope drops its fallrock on the grass lock's button. The maze
        // lays neither; the cut's minted event gates the r11c4 ↔ r1c18 link the lock stands on, and any of the three strikes cuts it.
        const ROPE28 = 'L28 flag 0: rope@160,64 cleared';
        expect(sampleLines).toContain(`level_28__r11c4>level_28__r1c18=${JSON.stringify([[ROPE28]])}`);
        expect(sampleLines).toContain(`level_28__r1c18>level_28__r11c4=${JSON.stringify([[ROPE28]])}`);
        expect(sampleLines).toContain(`level_28__r0c6@${ROPE28}=${JSON.stringify([['Fire'], ['Ghost Spear'], ['Progressive Sword']])}`);
    }, 300_000);
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
