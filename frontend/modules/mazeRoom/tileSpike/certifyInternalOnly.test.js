/**
 * ⛓ INTERNAL-ONLY MEMBERS (session tile-primitives-sphere-order-2, ⚖ 2026-10-26 "Price from inbound"). A member of a
 * level world that no AP exit enters from outside that world is entered only by walking in from another member, so its
 * fresh arrival is no AP state: L67's key room r3c2 is entered only after r6c11 spears the block onto the button that
 * silences the key's lane. Such a member is priced from each inbound member's arrival (the full search from there)
 * against the AP closure through it. The pins (designer-2's conditions):
 *   - the scope is mechanical, and an AP entrance from outside the world falls back to fresh-arrival pricing;
 *   - a world whose fresh arrival is STRICTER and whose inbound arrival is LOOSER than AP still reports LOOSER;
 *   - the inbound framing exposed a one-sided lock priced from its far side: BossLock tests the key only on a player
 *     BELOW it (`BossLock.update`'s `collideLine`), so its gate event opens from its `probe` side only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const texts = new Map();
/** A fresh copy of the compiled rules per call (the mutants edit theirs); one compile per level list. */
const compile = (levels) => {
    const key = levels.join(',');
    if (!texts.has(key)) texts.set(key, buildPlaythroughMaze({ levels }).text);
    return JSON.parse(texts.get(key));
};
const certify = (rules) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS });
const L67 = ['level_59', 'level_67'];
const L19 = ['level_18', 'level_19', 'level_20'];
const KEY = 'Level 067 - Boss Key 4';
const FLAG = 'L19 flag 1: bosslock@48,32 cleared';

describe('the scope is mechanical', () => {
    it('L67 r3c2 (entered only from r6c11) is priced from r6c11; its own fresh-arrival rows are gone', () => {
        const out = certify(compile(L67));
        expect(out.problems).toEqual([]);
        expect(out.lines).toContain(`level_67__r3c2@${KEY}<level_67__r6c11=[["Ghost Spear"]]`);
        expect(out.lines.filter((l) => l.startsWith('level_67__r3c2>') || l.startsWith(`level_67__r3c2@${KEY}=`))).toEqual([]);
    }, 120000); // the first compile in the file pays the producer's cold analysis pass

    it('a member with an AP entrance from outside its world keeps fresh-arrival pricing (L19 r1c1, from L20)', () => {
        const out = certify(compile(L19));
        expect(out.problems).toEqual([]);
        expect(out.lines.some((l) => l.startsWith('level_19__r1c1>level_19__r3c3='))).toBe(true);
        expect(out.lines.some((l) => l.startsWith(`level_19__r3c3@${FLAG}<level_19__r1c1=`))).toBe(true);
    });

    it('give r3c2 an outside entrance and it falls back to its fresh arrival — whose armed lane the certifier names', () => {
        const rules = compile(L67);
        rules.regions['1'].level_59.exits.push({ name: 'level_59 -> level_67__r3c2 (mutant)', connected_region: 'level_67__r3c2', access_rule: { rule: 'True_' } });
        const out = certify(rules);
        expect(out.lines.some((l) => l.startsWith(`level_67__r3c2@${KEY}=`))).toBe(true);
        expect(out.problems.some((p) => p.startsWith(`level_67__r3c2 @ ${KEY} holding [`) && p.endsWith(']: derived false, atlas true'))).toBe(true);
    });
});

describe('a LOOSER row is never hidden', () => {
    it('fresh arrival STRICTER, inbound LOOSER (AP charges r6c11 → r3c2 a Fire it does not need): LOOSER is reported', () => {
        const rules = compile(L67);
        const exit = rules.regions['1'].level_67__r6c11.exits.find((e) => e.connected_region === 'level_67__r3c2');
        exit.access_rule = { rule: 'And', children: [exit.access_rule, { rule: 'Has', args: { item_name: 'Fire' } }] };
        const out = certify(rules);
        expect(out.problems).toContain(`level_67__r3c2 @ ${KEY} (from level_67__r6c11) holding [Ghost Spear]: derived true, atlas false`);
    });

    it('a BossLock opened from its far side: without `probe`, L19\'s lock event from r1c1 (north of it) reads LOOSER', () => {
        const rules = compile(L19);
        for (const sc of Object.values(rules.preset_sidecars['1'])) {
            for (const entry of Object.values(sc.playable_payload?.obstacleLib ?? {})) for (const ev of entry.events ?? []) delete ev.probe;
        }
        const out = certify(rules);
        expect(out.problems).toContain(`level_19__r3c3 @ ${FLAG} (from level_19__r1c1) holding [Red Key]: derived true, atlas false`);
    });
});
