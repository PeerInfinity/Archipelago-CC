/**
 * sliceTraps — **THE FILESYSTEM IS THE COLLISION GUARD** (R9 slice P4b,
 * ⚖ ruling 54 (8) / ⚖ 63 (e)).
 *
 * ⛓ Every row runs against a TEMP memory directory built by this file. ⛔ The
 * real one is outside the repository and shared with live sessions; a test
 * that wrote there would be a test that edits somebody's notes.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { FAMILIES_FILE, LADDER_FILE, LADDER_FROZEN_AT, TRAPS_DIR } from './sliceRecords.js';
import {
    FREEZE_NOTICE, allocateTrap, declareFamily, familiesIn, families, frontmatterIn, nextNumber,
    readTrap, slugify, trapCensus, trapFiles,
} from './sliceTraps.js';

/** ⛓ A memory directory with the two shapes the real ladder actually holds. */
function fakeMemory() {
    const M = mkdtempSync(join(tmpdir(), 'slice-traps-'));
    writeFileSync(join(M, LADDER_FILE), [
        '# traps',
        '',
        '## 12 — AN OLD-SHAPE ENTRY',
        'the old heading form.',
        '',
        `**${LADDER_FROZEN_AT}. A NEW-SHAPE ENTRY.** R9 slice P4a.`,
        'the new line form.',
        '',
    ].join('\n'));
    writeFileSync(join(M, FAMILIES_FILE), [
        '# Pitfall families',
        '',
        '- Vacuity family (8 files): [a](a.md) · [b](b.md).',
        '- Ops family: [c](c.md).',
        '',
    ].join('\n'));
    mkdirSync(join(M, TRAPS_DIR), { recursive: true });
    return M;
}
const dirs = [];
const M = () => { const d = fakeMemory(); dirs.push(d); return d; };
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const file = (m, title, over = {}) => allocateTrap({
    title, slice: 'R9 slice P4b', family: 'Ops family', body: 'a body.', lesson: 'a lesson.',
    memory: m, ...over,
});

describe('⛔ a number is allocated by the FILESYSTEM, never by reading a tail', () => {
    it('the first allocation lands one above the freeze, into an EMPTY directory', () => {
        const m = M();
        expect(nextNumber({ memory: m })).toBe(LADDER_FROZEN_AT + 1);
        expect(file(m, 'the first one').number).toBe(LADDER_FROZEN_AT + 1);
    });

    it('each next allocation is one above the highest FILE, not above the ladder', () => {
        const m = M();
        const a = file(m, 'first');
        const b = file(m, 'second');
        expect(b.number).toBe(a.number + 1);
        expect(nextNumber({ memory: m })).toBe(b.number + 1);
    });

    it('⛔ TWO ALLOCATIONS RACING: the second REFUSES on `existsSync`', () => {
        const m = M();
        const n = nextNumber({ memory: m });
        file(m, 'one title');
        /* ⛓ the racer read `nextNumber` BEFORE the first write and still holds it. */
        expect(() => file(m, 'one title', { number: n }))
            .toThrow(/already exists — the FILESYSTEM is the collision guard/);
    });

    it('⛔ …and a DIFFERENT title at a taken number is refused too — the number is the identity', () => {
        const m = M();
        const n = file(m, 'first').number;
        expect(() => file(m, 'a completely different title', { number: n }))
            .toThrow(/already allocated as/);
    });

    it('⛔ a number at or below the freeze is refused — that range is the ladder\'s', () => {
        const m = M();
        expect(() => file(m, 't', { number: LADDER_FROZEN_AT }))
            .toThrow(/at or below the frozen ladder/);
    });

    it('a trap with no family is refused BY NAME (⚖ 63 (e))', () => {
        const m = M();
        expect(() => allocateTrap({ title: 't', slice: 's', memory: m })).toThrow(/needs a --family=/);
        expect(() => allocateTrap({ title: 't', family: 'f', memory: m })).toThrow(/needs a --slice=/);
        expect(() => allocateTrap({ slice: 's', family: 'f', memory: m })).toThrow(/needs a --title=/);
    });
});

describe('⛓ a trap file carries its number in its NAME and in its frontmatter', () => {
    it('the filename leads with the number so a sort is numeric order', () => {
        const m = M();
        const t = file(m, 'A Title With Spaces');
        expect(t.file).toBe(`${t.number}-a-title-with-spaces.md`);
    });

    it('the frontmatter agrees with the filename, and the body keeps the ladder\'s shape', () => {
        const m = M();
        const t = file(m, 'the shape is kept');
        const text = readFileSync(t.path, 'utf8');
        expect(frontmatterIn(text)).toEqual({
            number: String(t.number), slice: 'R9 slice P4b', family: 'Ops family',
        });
        expect(text).toContain(`**${t.number}. the shape is kept.** R9 slice P4b.`);
        expect(text).toContain('⇒ a lesson.');
    });

    it('a slug is bounded and never empty', () => {
        expect(slugify('⛔⛔ !!! ')).toBe('trap');
        expect(slugify('one two three four five six seven eight nine ten').split('-')).toHaveLength(8);
    });
});

describe('⛓⛓ a citation resolves from EITHER place — which is why the 907 are not migrated', () => {
    it('below the freeze, the ladder answers — in BOTH of its two shapes', () => {
        const m = M();
        expect(readTrap(12, { memory: m })).toMatchObject({ found: true });
        expect(readTrap(12, { memory: m }).text).toContain('AN OLD-SHAPE ENTRY');
        expect(readTrap(LADDER_FROZEN_AT, { memory: m }).text).toContain('A NEW-SHAPE ENTRY');
    });

    it('above the freeze, a file answers', () => {
        const m = M();
        const t = file(m, 'above the freeze');
        const got = readTrap(t.number, { memory: m });
        expect(got.found).toBe(true);
        expect(got.where).toBe(`${TRAPS_DIR}/${t.file}`);
    });

    it('⛔ a number nothing holds is NOT FOUND, and says which place was asked', () => {
        const m = M();
        expect(readTrap(LADDER_FROZEN_AT + 5, { memory: m }))
            .toMatchObject({ found: false, where: `${TRAPS_DIR}/` });
        expect(readTrap(13, { memory: m })).toMatchObject({ found: false, where: LADDER_FILE });
    });
});

describe('⛓ the families are READ out of the families file, never listed here', () => {
    it('one name per `- <name>(` or `- <name>:` line', () => {
        expect(familiesIn('- A family (3 files): x\n- B/c family: y\nnot a family'))
            .toEqual(['A family', 'B/c family']);
    });

    it('a family no file declares is a FINDING on the census', () => {
        const m = M();
        file(m, 'a trap', { family: 'A Family Nobody Declared' });
        expect(trapCensus({ memory: m }).findings.join('\n'))
            .toMatch(/is not one of the \d+ in reference_pitfall_families\.md/);
    });

    it('⛔⛔ A DECLARED FAMILY MUST READ BACK — the round trip, which the first cut failed', () => {
        const m = M();
        const d = declareFamily('Wrong-subject family — a definition with an em dash in it',
            { memory: m });
        expect(d.name).toBe('Wrong-subject family');
        expect(d.line).toBe('- Wrong-subject family: a definition with an em dash in it');
        expect(families({ memory: m })).toContain('Wrong-subject family');
        /* ⛓ …and a trap naming it is then NOT a finding. */
        file(m, 'a trap', { family: 'Wrong-subject family' });
        expect(trapCensus({ memory: m }).findings).toEqual([]);
    });

    it('declaring the same family twice is a no-op, not a duplicate line', () => {
        const m = M();
        declareFamily('A new family: x', { memory: m });
        const before = readFileSync(join(m, FAMILIES_FILE), 'utf8');
        expect(declareFamily('A new family: x', { memory: m }).already).toBe(true);
        expect(readFileSync(join(m, FAMILIES_FILE), 'utf8')).toBe(before);
    });

    it('a declared family is not', () => {
        const m = M();
        file(m, 'a trap');
        expect(families({ memory: m })).toContain('Ops family');
        expect(trapCensus({ memory: m }).findings).toEqual([]);
    });
});

describe('⛓⛓ the census is what MEMORY.md\'s trap bullet is DERIVED from', () => {
    it('it counts the files, names the freeze, and groups by slice', () => {
        const m = M();
        file(m, 'one');
        file(m, 'two');
        file(m, 'three', { slice: 'R9 slice P4c' });
        const c = trapCensus({ memory: m });
        expect(c.files).toBe(trapFiles({ memory: m }).files.length);
        expect(c.frozenAt).toBe(LADDER_FROZEN_AT);
        expect(c.recent.map((r) => r.slice)).toEqual(['R9 slice P4c', 'R9 slice P4b']);
        expect(c.recent.find((r) => r.slice === 'R9 slice P4b').n).toBe(2);
    });

    it('⛔ a file whose NAME carries no number is reported — a trap nobody can cite', () => {
        const m = M();
        writeFileSync(join(m, TRAPS_DIR, 'no-number-here.md'), '---\nnumber: 1\n---\nx');
        expect(trapCensus({ memory: m }).findings.join('\n')).toMatch(/carries no number/);
    });

    it('⛔ frontmatter that disagrees with the FILENAME is reported, and the filename wins', () => {
        const m = M();
        const t = file(m, 'a trap');
        writeFileSync(t.path, readFileSync(t.path, 'utf8').replace(/number: \d+/, 'number: 1'));
        expect(trapCensus({ memory: m }).findings.join('\n'))
            .toMatch(/disagrees with the FILENAME's/);
    });
});

describe('⛔ the freeze notice is ONE line and this module writes no ladder entry', () => {
    it('it names the freeze, the directory, and how a citation still resolves', () => {
        const n = FREEZE_NOTICE();
        expect(n).toContain(`FROZEN AT ${LADDER_FROZEN_AT}`);
        expect(n).toContain(`${LADDER_FROZEN_AT + 1}`);
        expect(n).toContain(`${TRAPS_DIR}/`);
        expect(n).toContain('--trap=NNN');
    });
});
