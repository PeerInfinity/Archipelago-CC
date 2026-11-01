/**
 * ⛓ RULES l112-owl-rocklock — a grouped lock's premise is CHECKED.
 *
 * `lockRuling` calls a grouped lock free because its group's in-level
 * Button/ButtonRoom/rope is choreography. Where the level holds no such
 * opener, the group is opened by a script (`SCRIPT_GROUP_OPENERS`, read off
 * the AS3's `Button.activateAll` callers) and the lock costs that body's kill
 * rule — or nothing opens it, and the ruling throws by name.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { conditionKey } from './seedlingSemantics.js';
import {
    PLAYTHROUGH_ENTITY_OVERLAY,
    SCRIPT_GROUP_OPENERS,
    buildCrossLevelOpeners,
    buildGroupOpeners,
    buildScriptOpeners,
    groupedLocksWithoutOpener,
    overlayEntitySemantics,
} from './seedlingPlaythroughOverlay.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(join(HERE, 'atlases/seedling-map.json'), 'utf8'));
const AS3 = join(HERE, '../../../vendor/seedling/src');
/** The AS3 fork is a submodule a checkout may lack; the row that READS it is gated on its presence. */
const haveAS3 = existsSync(join(AS3, 'Puzzlements/Button.as'));

const ctxOf = (level, extra = {}) => ({
    level,
    crossLevelOpeners: buildCrossLevelOpeners(MAP),
    groupOpeners: buildGroupOpeners(MAP),
    scriptOpeners: buildScriptOpeners(MAP),
    ...extra,
});
const rockOf = (level, x, y) => MAP.levels.find((l) => l.level === level).entities
    .find((e) => e.type === 'rocklock' && e.x === x && e.y === y);

describe('the census: grouped locks with no in-level opener', () => {
    it('is ONE placement in the game, and the script table resolves it', () => {
        const rows = groupedLocksWithoutOpener(MAP);
        expect(rows).toEqual([{ site: '112:rocklock@112,16', script: 'finalboss@64,96' }]);
        expect(rows.filter((r) => r.script).length).toBe(1);
    });

    it('the Owl\'s script clears the rock\'s own tag (its tag + 1)', () => {
        const s = buildScriptOpeners(MAP).get('112:0');
        expect(s.tag).toBe(Number(rockOf(112, 112, 16).attrs.tag));
    });
});

describe('the ruling', () => {
    it('prices the L112 rock at the Owl\'s own kill rule', () => {
        const ruled = overlayEntitySemantics(rockOf(112, 112, 16), null, ctxOf(112));
        expect(ruled.kind).toBe('gated');
        expect(conditionKey(ruled.condition)).toBe(conditionKey(PLAYTHROUGH_ENTITY_OVERLAY.finalboss.condition));
        expect(ruled.cite).toMatch(/FinalBoss\.as:212-224/);
    });

    it('a grouped lock with neither an opener nor a script THROWS by name', () => {
        const rock = rockOf(112, 112, 16);
        expect(() => overlayEntitySemantics(rock, null, ctxOf(112, { scriptOpeners: new Map() })))
            .toThrow(/112:rocklock@112,16.*no SCRIPT_GROUP_OPENERS row/);
    });

    it('a script that clears a different tag is not a durable opening, and throws', () => {
        const rock = { ...rockOf(112, 112, 16), attrs: { tset: '0', tag: '7' } };
        expect(() => overlayEntitySemantics(rock, null, ctxOf(112))).toThrow(/clears tag 1/);
    });

    it('without the census (no `groupOpeners`), the ruling is today\'s', () => {
        const ruled = overlayEntitySemantics(rockOf(112, 112, 16), null, { level: 112 });
        expect(ruled.kind).toBe('open');
    });
});

describe('the table is the AS3\'s', () => {
    it.skipIf(!haveAS3)('`Button.activateAll` callers outside Button.as are exactly the table\'s classes (needs vendor/seedling)', () => {
        const files = [];
        const walk = (d) => readdirSync(d).forEach((n) => {
            const p = join(d, n);
            if (statSync(p).isDirectory()) walk(p);
            else if (p.endsWith('.as')) files.push(p);
        });
        walk(AS3);
        const callers = files.filter((p) => !p.endsWith('Puzzlements/Button.as')
            && /Button\.activateAll\s*\(/.test(readFileSync(p, 'latin1')));
        expect(callers.map((p) => relative(AS3, p))).toEqual(['Enemies/FinalBoss.as']);
        const src = readFileSync(join(AS3, 'Enemies/FinalBoss.as'), 'latin1');
        const row = SCRIPT_GROUP_OPENERS.finalboss;
        expect(src).toContain(`Button.activateAll(null, ${row.group}, true)`);
        expect(src).toContain(`Game.setPersistence(tag+${row.tagOffset}, false)`);
        expect(Object.keys(SCRIPT_GROUP_OPENERS)).toEqual(['finalboss']);
    });
});
