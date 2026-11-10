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
 * ⛓ OPEN_L53 (session rules-l26-rocklock-pocket, routed to the planner): the rules now price L53's `lock@144,208` (tset -1) from its
 * L54 door pocket `level_53__r14c9` as its EVENT (`L53 flag 2`, collected in r9c10): from the pocket the room is never cleared —
 * `puncher@136,96` sits 120 px away, beyond its `runRange` 80 (`Puncher.as:22`) and every arm that passes the shut lock
 * (`seedlingObstacleEvents.encounterLockSides`; game witness `probe-seedling-encounter-latch.mjs` BARE: the lock stands and no
 * `{53,2}` is written). The maze's level-world derivation does not know a one-sided clear: holding the Ghost Spear (whose thrust
 * is not line-tested, `Player.as:966-985`) it reaches the event from the pocket. The atlas is the game's side here; the
 * derivation's kill model is the open half (not this slice's: a tileSpike / derived-table engine change).
 */
export const OPEN_L53 = 'level_53__r9c10 @ L53 flag 2: lock@144,208 cleared (from level_53__r14c9) holding [Ghost Spear]: derived true, atlas false';
/**
 * ⛓ OPEN_L60 (session rules-l60-l71-killlock, routed to the planner): the rules now price L60's `lock@128,80` (tset -1) from its
 * L61 door pocket `level_60__r5c9` as `Or(<its event, L60 flag 0, collected in r5c0>, Ghost Spear)`: the pocket reaches the room's
 * jellyfish only ACROSS the shut lock, where the Spear's thrust and the Ghost Sword's slash kill them and no other arm does
 * (`seedlingObstacleEvents.encounterLockSides` `across`; game witness `probe-seedling-killlock-arms.mjs`: both arms empty the
 * roster from the pocket, the game writes `{60,0}` and the lock opens). The grid carries that as a LATCH entered from the pocket,
 * and the latch's own arm lives in the rules' `latchEvent`; the maze's level world lays the latch and knows only its event, so
 * holding the Spear with no event it does not cross. The atlas is the game's side here; the derivation's latch model is the open
 * half (not this slice's: a tileSpike / derived-table engine change). The MIRROR of OPEN_L53: there the derivation is looser than
 * the game, here it is tighter.
 */
export const OPEN_L60 = 'level_60__r5c9 → level_60__r5c0 holding [Ghost Spear,Progressive Swim]: derived false, atlas true';
/**
 * ⛓ The second OPEN row, `OPEN_L3_L111` (⚖ user 2026-10-31, session tile-primitives-sphere-order-12: "Going from L3 to L111 requires
 * swim, and the rules should model that"), is GONE: `level_3__r0c4 → level_111 holding [Ghost Spear,Ghost Sword Fusion,Progressive
 * Sword]: derived false, atlas true` closed when ⛓ RULES rules-certifier-tail landed (⚖ 2026-11-02 "Yes, land it"). A door now costs
 * what EVERY way onto its tile pays (`chargeNecessaryApproaches`), and the only way onto L3's teleporter (0,4) is the water at (1,4),
 * so the rules charge the Swim the world always did. Its pin and both expectations were removed with it.
 */
export const PERMISSIVE = playthroughPermissiveLocations();

/**
 * ⛓ L40'S THREE LATCHES (session tile-latch-prune measured them; session tile-lay-l40-latches LAYS them from the data —
 * `seedlingAtlasAnalysis.seedlingLevelEntities` from the rules' in-room press events). Read from the game's three in-level
 * ButtonRooms and the wandlocks each opens, by GROUP (the ButtonRoom's `tset`). ⛔ Not an input: the producer never reads it.
 * `latchSandwich.test.js` asserts the committed payload lays exactly these (a literal only ever CHECKS).
 */
export const L40_LATCHES = Object.freeze({
    0: { button: [17, 13], locks: [[13, 8], [13, 9], [13, 10]] },
    1: { button: [10, 8], locks: [[11, 5], [11, 13]] },
    3: { button: [55, 48], locks: [[30, 35]] },
});
export const L40_REGIONS = ['level_40__r0c53', 'level_40__r23c29', 'level_40__r32c36', 'level_40__r36c35', 'level_40__r48c54'];

/**
 * The latches a payload LAYS, by group: `{<group>: {button: [x, y], locks: [[x, y]…], event}}` — each latching button
 * (`buttonLib.<id>.latch`) and the doors its held token clears. Read off the payload, for the equality pin.
 */
export function payloadLatches(payload) {
    const out = {};
    for (const [id, entry] of Object.entries(payload.buttonLib ?? {})) {
        if (!entry.latch) continue;
        const group = id.replace(/^button_/, '');
        const cells = (payload.buttons ?? []).filter((b) => b.id === id).map((b) => [b.x, b.y]);
        const locks = (payload.obstacles ?? []).filter((o) => (payload.obstacleLib?.[o.id]?.clear_set ?? []).some((c) => c.includes(entry.holds)))
            .map((o) => [o.x, o.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        out[group] = { button: cells.length === 1 ? cells[0] : cells, locks, event: entry.latch.event };
    }
    return out;
}

/**
 * Every latch UNLAID (the sandwich pins' "not laid" arm, no level named): each latching button, its entry, and the doors on
 * its held token are removed, which leaves those cells the plain floor the grid has them as (the overlay rules a latched
 * group's locks open). Returns a deep copy of `rules`.
 */
export function unlayLatches(rules = RULES) {
    const r = structuredClone(rules);
    for (const sc of Object.values(r.preset_sidecars['1'])) {
        const p = sc.playable_payload;
        if (!p?.buttonLib) continue;
        const latched = Object.entries(p.buttonLib).filter(([, e]) => e.latch);
        if (latched.length === 0) continue;
        const tokens = new Set(latched.map(([, e]) => e.holds));
        const ids = new Set(latched.map(([id]) => id));
        const doors = new Set(Object.entries(p.obstacleLib ?? {})
            .filter(([, o]) => (o.clear_set ?? []).some((c) => c.some((t) => tokens.has(t)))).map(([id]) => id));
        p.buttons = p.buttons.filter((b) => !ids.has(b.id));
        for (const id of ids) delete p.buttonLib[id];
        p.obstacles = p.obstacles.filter((o) => !doors.has(o.id));
        for (const id of doors) delete p.obstacleLib[id];
        if (p.buttons.length === 0) { delete p.buttons; delete p.buttonLib; }
    }
    return r;
}
