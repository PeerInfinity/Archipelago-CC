/**
 * The committed `seedling_playthrough_maze` preset and the certifier's named rows, SHARED by the two tiers that certify it:
 * `deriveLevelWorldLogic.slow.test.js` (native, every region: on every push) and `deriveLevelWorldLogic.train.test.js` (the
 * SCRIPTED tile definition on `SAMPLE`: on train pushes and dispatch). ⚖ Robert 2026-11-02 CI manual-only P3 split the two;
 * one copy of `SAMPLE` and the OPEN rows keeps them from drifting apart. The sample's history (which ruling added which
 * region, and what each costs scripted) is the slow file's header.
 */
import { readFileSync } from 'node:fs';
import { playthroughPermissiveLocations } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';

export const RULES = JSON.parse(readFileSync(
    new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
export const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
export const SAMPLE = ['level_14', 'level_15__r1c5', 'level_15__r1c9', 'level_15__r6c8', 'level_16__r1c1', 'level_16__r4c21',
    'level_18__r1c1', 'level_18__r7c10', 'level_0__r7c6', 'level_19__r5c5', 'level_20__r1c4',
    'level_3__r0c4', 'level_8', 'level_94__r3c4', 'level_12__r42c28', 'level_67__r3c2', 'level_28__r0c6', 'level_30__r0c4', 'level_32', 'level_38',
    'level_39__r25c9', 'level_40__r23c29', 'level_61__r0c10', 'level_63__r0c1', 'level_62', 'level_63__r10c2', 'level_58__r3c3', 'level_65__r0c8',
    'level_80__r0c2', 'level_71__r0c6', 'level_78__r0c2', 'level_101__r4c2'];
/**
 * The one OPEN row (⚖ 2026-10-29 "Land, name it; route to rules", session tile-primitives-sphere-order-8) was r6c9 → r10c2 derived
 * false: from the L65 pocket landing, L63 r0c1's east end is cut from its west by the DarkTrap at (4,6) and the spear block that jams
 * (5,6) (a block never enters an Enemy's tile, `PushableBlock.as:28`), so the world needs L61's press (L63 flag 1). ⛓ RULES
 * l63-pole-crossings closed it: the rules charge r6c9 -> r0c1 that flag too (`playthroughBlockCrossings`), and r10c2 now agrees. The
 * row left is its mirror, the ACCEPTED framing row (design-2): r6c9's world entrance is the L65 pocket cell (8,19), whose dark trap
 * (8,17) costs f7 (or the swing); the witness pushes the block (7,6) → (5,6), where it stops at the trap, and stands on (6,6), a cell
 * of the dead end (5,5)/(5,6)/(6,6) the partition gives r0c1 — per-cell ownership, which the game agrees with (the probe's
 * east-no-f1 tape halts the block on [5,6]). AP's crossing into r0c1 proper still costs f1.
 */
export const OPEN_L63 = 'level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: lightpole@112,272 cleared]: derived true, atlas false';
/**
 * ⛓ The second OPEN row, `OPEN_L3_L111` (⚖ user 2026-10-31, session tile-primitives-sphere-order-12: "Going from L3 to L111 requires
 * swim, and the rules should model that"), is GONE: `level_3__r0c4 → level_111 holding [Ghost Spear,Ghost Sword Fusion,Progressive
 * Sword]: derived false, atlas true` closed when ⛓ RULES rules-certifier-tail landed (⚖ 2026-11-02 "Yes, land it"). A door now costs
 * what EVERY way onto its tile pays (`chargeNecessaryApproaches`), and the only way onto L3's teleporter (0,4) is the water at (1,4),
 * so the rules charge the Swim the world always did. Its pin and both expectations were removed with it.
 */
export const PERMISSIVE = playthroughPermissiveLocations();

/**
 * ⛓ L40 WITH ITS LATCHES LAID (session tile-latch-prune; the lay session tile-mechanisms-m4-latch measured, read from the game's
 * three in-level ButtonRooms and the wandlocks each opens): the LATCH SANDWICH's subject (`deriveLevelWorldLogic.js`). The committed
 * preset does NOT lay them (⚖ Robert 2026-11-03 "B: Prune, then lay" — the lay is its own later slice), so the pins lay them by hand
 * onto `level_40__r0c53`'s payload: each latch `buttonLib.latch: {event: "L40 latch tN"}`, its locks doors on its held token.
 * The item axis grows 6 → 9. Returns a deep copy of `rules`; the payload's other entities are untouched.
 */
export const L40_LATCHES = Object.freeze({
    t0: { button: [17, 13], locks: [[13, 8], [13, 9], [13, 10]] },
    t1: { button: [10, 8], locks: [[11, 5], [11, 13]] },
    t3: { button: [55, 48], locks: [[30, 35]] },
});
export const L40_REGIONS = ['level_40__r0c53', 'level_40__r23c29', 'level_40__r32c36', 'level_40__r36c35', 'level_40__r48c54'];
export function layL40Latches(rules = RULES) {
    const r = structuredClone(rules);
    const lay = r.preset_sidecars['1'].level_40__r0c53.playable_payload;
    lay.buttons = [...(lay.buttons ?? [])];
    lay.buttonLib = { ...(lay.buttonLib ?? {}) };
    lay.obstacleLib = { ...(lay.obstacleLib ?? {}) };
    for (const [g, { button: [bx, by], locks }] of Object.entries(L40_LATCHES)) {
        lay.buttons.push({ x: bx, y: by, id: `latch_${g}` });
        lay.buttonLib[`latch_${g}`] = { kind: 'button', holds: `sw_l${g}`, latch: { event: `L40 latch ${g}` } };
        lay.obstacleLib[`wl_${g}`] = { id: `wl_${g}`, name: `wandlock ${g}`, kind: 'door', clear_set: [[`sw_l${g}`]] };
        for (const [x, y] of locks) {
            lay.obstacles = lay.obstacles.filter((o) => !(o.x === x && o.y === y));
            lay.tiles[y * lay.width + x] = 0;
            lay.obstacles.push({ x, y, id: `wl_${g}` });
        }
    }
    return r;
}
