/**
 * seedlingDemo/hammerBridgeOpenStray.test — ⛓⛓ SEEDLING HAMMER-PHASE SKIPWALLS (`BRIDGE_OPEN_STRAY`, OFF): the bridge
 * verb's stance audit no longer counts a bridge tile this visit already opened as a stray (a Spear hit on an open bridge
 * is a no-op: `bridges.bridgeHit`).
 * The rows:
 *   - the switch ships ON (the BOS/GSW/PM flip), the env channel carries its name, and `withBridgeOpenStray` toggles it;
 *   - the source: one guarded filter in `resolveBridgeStrategy`'s stray audit;
 *   - the predicate: an OPEN bridge tile is waived (and counted), a CLOSED one, a non-`Tile` responder and a tile with no
 *     bridge id are not;
 *   - the page worker's own request from re-measure-7's skip probe (P1 33:5, L61 → L63, under the capture's
 *     `GOAL_START_WAIT` + `PREVIEW_METER`): OFF refuses verbatim on bridge@11,13 (every stance "also reaches
 *     tile:Bridge@168,216", the open (10,13)); ON it solves, and the keys replayed on a FRESH run cross into L63 with no
 *     hit and no death.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { solveCapturedP1 } from './hammerBridgeOpenStrayRows.js';
import {
    BRIDGE_OPEN_STRAY, BRIDGE_OPEN_STRAY_COUNTS, BRIDGE_OPEN_STRAY_DEFAULT, bridgeStrayAlreadyOpen,
    resetBridgeOpenStrayCounts, withBridgeOpenStray, withGoalStartWait, withPreviewMeter,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const BRIDGE_WALL = /^solverBot: bridge bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's 32x5 rect on it and is reachable: \(168,216\) facing E's rect also reaches tile:Bridge@168,216; \(152,216\) facing E's rect also reaches tile:Bridge@168,216; .*\(200,216\) facing W's rect also reaches tile:Bridge@168,216;/;

/** The capture's own env (`SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1`). */
const asCaptured = (fn) => withGoalStartWait(true, () => withPreviewMeter(true, fn));

describe('hammer-phase SKIPWALLS: BRIDGE_OPEN_STRAY', () => {
    it('ships ON (the BOS/GSW/PM flip), the env channel carries it, and the wrapper toggles it', () => {
        expect(BRIDGE_OPEN_STRAY_DEFAULT).toBe(true);
        expect(BRIDGE_OPEN_STRAY.enabled).toBe(globalThis.process?.env?.SEEDLING_BRIDGE_OPEN_STRAY !== '0');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_BRIDGE_OPEN_STRAY');
        const was = BRIDGE_OPEN_STRAY.enabled;
        expect(withBridgeOpenStray(true, () => BRIDGE_OPEN_STRAY.enabled)).toBe(true);
        expect(withBridgeOpenStray(false, () => BRIDGE_OPEN_STRAY.enabled)).toBe(false);
        expect(BRIDGE_OPEN_STRAY.enabled).toBe(was);
    });

    it('the source: one guarded filter on the bridge stance audit', () => {
        const src = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
        expect(src.split('&& bridgeStrayAlreadyOpen(').length - 1).toBe(1);
        expect(src).toMatch(/\.illegal\.filter\(\(r\) => PRESS_ARM_POLICY\[r\.as3\]\?\.policy !== 'inert'\)\n\s+\.filter\(\(r\) => !\(BRIDGE_OPEN_STRAY\.enabled && bridgeStrayAlreadyOpen\(run, obstacle, at, r\)\)\);/);
        const fn = src.slice(src.indexOf('function resolveBridgeStrategy('), src.indexOf('function execBridge('));
        expect(fn).toContain('BRIDGE_OPEN_STRAY.enabled && bridgeStrayAlreadyOpen');
    });

    it('the predicate: only a bridge tile the run already opened is waived', () => {
        const run = { entities: (k) => (k === 'openBridges' ? new Set(['10,13']) : null) };
        const obstacle = { id: 'bridge@11,13' };
        const tile = (tx, ty) => ({ as3: 'Tile', tag: 'tile:Bridge', tile: { tx, ty } });
        resetBridgeOpenStrayCounts();
        expect(bridgeStrayAlreadyOpen(run, obstacle, '(a)', tile(10, 13))).toBe(true);
        expect(bridgeStrayAlreadyOpen(run, obstacle, '(b)', tile(12, 13))).toBe(false);
        expect(bridgeStrayAlreadyOpen(run, obstacle, '(c)', { as3: 'PushableBlockSpear', x: 160, y: 208 })).toBe(false);
        expect(bridgeStrayAlreadyOpen(run, obstacle, '(d)', { as3: 'Tile' })).toBe(false);
        expect(bridgeStrayAlreadyOpen({ entities: () => null }, obstacle, '(e)', tile(10, 13))).toBe(false);
        expect(BRIDGE_OPEN_STRAY_COUNTS.waived).toEqual([{ bridge: 'bridge@11,13', stance: '(a)', open: '10,13' }]);
    });

    it('P1 33:5 (L61 → L63): OFF refuses on the open bridge as a stray; ON reaches L63 hitless on a fresh run', () => {
        resetBridgeOpenStrayCounts();
        const off = asCaptured(() => withBridgeOpenStray(false, () => solveCapturedP1()));
        expect(off.ok).toBe(false);
        expect(off.answer).toBe('74d893565dd6'); // the page's own answer (re-measure-7's P1 33:5)
        expect(off.message).toMatch(BRIDGE_WALL);
        expect(BRIDGE_OPEN_STRAY_COUNTS.waived).toEqual([]);
        const on = asCaptured(() => withBridgeOpenStray(true, () => solveCapturedP1()));
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.crossed?.to).toBe(63);
        expect(on.passes.every((p) => !p.ok || (p.modelHits?.hits === 0 && p.modelHits?.deaths === 0))).toBe(true);
        expect(new Set(BRIDGE_OPEN_STRAY_COUNTS.waived.map((w) => `${w.bridge} ${w.open}`))).toEqual(new Set(['bridge@11,13 10,13']));
    }, 120000);
});
