/**
 * ⛓⛓⛓ **SEEDLING EDITOR E2 — ENTITY LINKS.** `entityLinks.js`: the census over the 116 vanilla rooms, the overlay,
 * rewiring a group, a rope's end, the issues by name, and a link edit moving SOLVE's verdict both ways.
 * Every row names its MUTANT.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createEditSession, foldEdits } from '../procgenCore/editCore.js';
import { createSeedlingEditAdapter } from './seedlingEditAdapter.js';
import { applyEdit } from './watchEdit.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel, recordToOel } from './procgenLevelOel.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { solveEditedRoom } from './editSolve.js';
import {
    LINK_ISSUES, bindOps, describeLinks, freshGroup, groupMembers, linkIssues, linkShapes, linksOf, partnersOf,
    ropeEndOp, saveRefusal, solverNotes, unlinkableReason,
} from './entityLinks.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const MAP = JSON.parse(readFileSync(here('../flashPanel/atlases/seedling-map.json'), 'utf8'));
const EMBED = JSON.parse(readFileSync(here('./fixtures/seedling-vanilla-set.json'), 'utf8'));
const schema = JSON.parse(readFileSync(here('./fixtures/seedling-ogmo-schema.json'), 'utf8'));
const adapter = createSeedlingEditAdapter({
    schema, levelSource: levelSourceFromAtlas(MAP), vanillaSetId: EMBED.set_id, parseOel: parseOelLevel,
});
const L = (n) => MAP.levels.find((l) => l.level === n);
const O = { schema };
const place = (r, tx, ty, type, attrs = {}) => applyEdit(r, { op: 'place', tx, ty, type, attrs });
const room = () => emptyLevel({ level: 1, width: 10, height: 10 });
const indexOf = (r, type, x, y) => r.entities.findIndex((e) => e.type === type && e.x === x && e.y === y);
const codes = (r) => linkIssues(r, O).map((i) => i.code);

describe('the census, over the 116 vanilla rooms', () => {
    const count = (fn) => MAP.levels.reduce((n, l) => n + fn(l), 0);
    const kind = (l, k, implicit = false) => linksOf(l, O)
        .filter((x) => x.kind === k && Boolean(x.implicit) === implicit).length;

    /** MUTANT: treat a cross-room `buttonroom` as a local publisher, or count sentinel groups as wires. */
    it('finds every wire the rooms carry, and no more', () => {
        expect(count((l) => kind(l, 'group'))).toBe(45);
        expect(count((l) => kind(l, 'group', true))).toBe(4);
        expect(count((l) => kind(l, 'rope'))).toBe(3);
        expect(count((l) => kind(l, 'cross-room'))).toBe(4);
    });

    /** MUTANT: make a shipped pattern refuse, so no vanilla room could be saved. */
    it('refuses no vanilla room, and warns only about groups with no publisher in their own room', () => {
        const all = MAP.levels.flatMap((l) => linkIssues(l, O));
        expect(all.filter((i) => i.severity === 'refuse')).toEqual([]);
        expect([...new Set(all.map((i) => i.code))]).toEqual([LINK_ISSUES.GROUP_NO_PUBLISHER]);
        expect(all).toHaveLength(4);
        for (const l of MAP.levels) expect(saveRefusal(l, O)).toBe(null);
    });

    /** MUTANT: an unedited room's record or OEL is rewritten by reading its links. */
    it('reading a room\'s links leaves it byte-identical, node order included', () => {
        for (const l of MAP.levels.filter((x) => x.entities.some((e) => e.nodes))) {
            const before = recordToOel(l);
            linksOf(l, O);
            linkShapes(l, O);
            linkIssues(l, O);
            expect(recordToOel(l)).toBe(before);
        }
    });
});

describe('seeing the links', () => {
    const wired = () => {
        let r = room();
        r = place(r, 1, 1, 'button', { tset: '2' });
        r = place(r, 3, 1, 'lock', { tset: '2', tag: '0' });
        r = place(r, 5, 1, 'cover', { tset: '4' });
        return r;
    };

    /** MUTANT: partners answered in one direction only (`from` alone). */
    it('a pick\'s partners are found from either end of the wire', () => {
        const r = wired();
        const button = indexOf(r, 'button', 16, 16);
        const lock = indexOf(r, 'lock', 48, 16);
        expect(partnersOf(r, button, O)).toEqual([lock]);
        expect(partnersOf(r, lock, O)).toEqual([button]);
        expect(partnersOf(r, indexOf(r, 'cover', 80, 16), O)).toEqual([]);
    });

    /** MUTANT: arrows drawn responder → publisher, or the highlight lost. */
    it('draws publisher → responder in cell space and highlights the picked wire and its partners', () => {
        const r = wired();
        const lines = linkShapes(r, O).filter((s) => s.kind === 'polyline');
        expect(lines).toHaveLength(1);
        expect(lines[0].points).toEqual([{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }]);
        expect(lines[0].arrow).toBe(true);
        expect(lines[0].highlight).toBe(false);
        const picked = linkShapes(r, { schema, selected: indexOf(r, 'lock', 48, 16) });
        expect(picked.filter((s) => s.kind === 'polyline')[0].highlight).toBe(true);
        expect(picked.filter((s) => s.kind === 'rect').map((s) => [s.x, s.y])).toEqual([[3, 1], [1, 1]]);
    });

    /** MUTANT: a sentinel `-1` drawn as a wire between every kill lock in the room. */
    it('a sentinel group draws no wire', () => {
        let r = place(room(), 1, 1, 'lock', { tset: '-1', tag: '0' });
        r = place(r, 3, 1, 'lock', { tset: '-1', tag: '1' });
        r = place(r, 5, 1, 'button', { tset: '-1' });
        expect(linksOf(r, O)).toEqual([]);
    });

    /** MUTANT: a cross-room button treated as publishing its `tset` here. */
    it('a cross-room button is named with its far end and wires nothing here', () => {
        let r = place(room(), 1, 1, 'buttonroom', { tset: '2', tag: '0', flip: '0', room: '39' });
        r = place(r, 3, 1, 'lock', { tset: '2', tag: '0' });
        const links = linksOf(r, O);
        expect(links.map((l) => l.kind)).toEqual(['cross-room']);
        expect(describeLinks(r, 0, O)).toMatch(/writes persistence flag 2 of level 39/);
    });

    /** MUTANT: forget the implicit publishers, so the wand's rock room warns "no publisher". */
    it('an implicit publisher is a partner, drawn and counted', () => {
        let r = place(room(), 1, 1, 'wand', { tag: '0' });
        r = place(r, 3, 1, 'fallrock', { tset: '0', tag: '0' });
        expect(linksOf(r, O).filter((l) => l.implicit)).toHaveLength(1);
        expect(codes(r)).toEqual([]);
    });

    /** MUTANT: read a missing `tset` as "no group". */
    it('a missing tset is group 0, as the game reads it', () => {
        let r = place(room(), 1, 1, 'button', {});
        r = place(r, 3, 1, 'lock', { tag: '0' });
        expect(linksOf(r, O).map((l) => l.group)).toEqual([0]);
    });
});

describe('rewiring a group', () => {
    const two = () => {
        let r = room();
        r = place(r, 1, 1, 'button', { tset: '0' });
        r = place(r, 3, 1, 'lock', { tset: '1', tag: '0' });
        r = place(r, 5, 1, 'lock', { tset: '1', tag: '1' });
        return r;
    };
    const B = (r) => indexOf(r, 'button', 16, 16);
    const D = (r) => indexOf(r, 'lock', 48, 16);
    const D2 = (r) => indexOf(r, 'lock', 80, 16);

    /** MUTANT: write `tset` on the partner, or drop the body's other attributes. */
    it('the picked body joins its partner\'s group through one attrs op, keeping its other attributes', () => {
        const r = two();
        const op = bindOps(r, D(r), B(r), O);
        expect(op).toEqual({ op: 'attrs', tx: 3, ty: 1, attrs: { tset: '0', tag: '0' } });
        const after = applyEdit(r, op);
        expect(partnersOf(after, B(after), O)).toEqual([D(after)]);
        expect(after.entities[D2(after)].attrs.tset).toBe('1');
    });

    /** MUTANT: emit two ops (two undos), or reuse a group already in the room. */
    it('Shift gives the two a fresh group as ONE edit, and undoes and redoes as one step', () => {
        const r = two();
        expect(freshGroup(r, O)).toBe(2);
        const session = createEditSession(adapter, r, { base: { kind: 'oel', xml: recordToOel(r) } });
        expect(session.apply(bindOps(r, B(r), D(r), { schema, fresh: true })).applied).toBe(true);
        expect(session.ops()).toHaveLength(1);
        const after = session.record();
        expect(after.entities[B(after)].attrs.tset).toBe('2');
        expect(after.entities[D(after)].attrs.tset).toBe('2');
        expect(after.entities[D2(after)].attrs.tset).toBe('1');
        session.undo();
        expect(session.record().entities[B(r)].attrs.tset).toBe('0');
        session.redo();
        expect(session.record().entities[D(r)].attrs.tset).toBe('2');
    });

    /** MUTANT: fresh group ignores the implicit publisher, and lands in the wand's group 0. */
    it('a fresh group skips a group an implicit publisher reaches', () => {
        expect(freshGroup(place(room(), 1, 1, 'wand', { tag: '0' }), O)).toBe(1);
    });

    /** MUTANT: drop `which`, so the edit lands on the cell's last body. */
    it('addresses a body that is not the cell\'s last with `which`, and omits it for the last', () => {
        let r = place(room(), 1, 1, 'button', { tset: '0' });
        r = place(r, 1, 1, 'cover', { tset: '0' });
        r = place(r, 3, 1, 'lock', { tset: '5', tag: '0' });
        const button = indexOf(r, 'button', 16, 16);
        const cover = indexOf(r, 'cover', 16, 16);
        const lock = indexOf(r, 'lock', 48, 16);
        expect(bindOps(r, button, lock, O).which).toBe(0);
        expect('which' in bindOps(r, cover, lock, O)).toBe(false);
        expect(applyEdit(r, bindOps(r, button, lock, O)).entities[button].attrs.tset).toBe('5');
    });

    /** MUTANT: any of the four refusals missing. */
    it('refuses BY NAME: a body with no group, a forced group, a sentinel partner, a cross-room button', () => {
        let r = two();
        r = place(r, 7, 1, 'sword', {});
        r = place(r, 8, 1, 'bosslock', { keyType: '0', tag: '2' });
        r = place(r, 1, 3, 'lock', { tset: '-1', tag: '3' });
        r = place(r, 3, 3, 'buttonroom', { tset: '1', tag: '4', flip: '0', room: '7' });
        const button = B(r);
        expect(bindOps(r, button, indexOf(r, 'sword', 112, 16), O).refused).toMatch(/declares no `tset`/);
        expect(bindOps(r, button, indexOf(r, 'bosslock', 128, 16), O).refused).toMatch(/fixes its group at -1/);
        expect(bindOps(r, button, indexOf(r, 'lock', 16, 48), O).refused).toMatch(/sentinel group -1/);
        expect(bindOps(r, button, indexOf(r, 'buttonroom', 48, 48), O).refused).toMatch(/of level 7/);
        expect(bindOps(r, D(r), D2(r), O).refused).toMatch(/already in group 1/);
        expect(unlinkableReason(r, button, O)).toBe(null);
    });

    /** MUTANT: a door (teleporter) accepted as a partner, which would break a generated room's round trip. */
    it('a door or an AP item cannot be wired, so no link edit can move one', () => {
        let r = two();
        r = place(r, 7, 1, 'teleporter', { to: '1' });
        expect(bindOps(r, B(r), indexOf(r, 'teleporter', 112, 16), O).refused).toMatch(/declares no `tset`/);
    });
});

describe('a rope\'s end', () => {
    const rope = (nodes = [{ x: 96, y: 32 }]) => {
        const r = place(room(), 2, 2, 'rope', { tset: '0', tag: '0' });
        return nodes.length ? applyEdit(r, { op: 'nodes', tx: 2, ty: 2, nodes }) : r;
    };

    /** MUTANT: the node written at the click's row, or in tile coordinates. */
    it('moves through one `nodes` op, on the rope\'s own row whatever row was clicked', () => {
        const r = rope();
        const op = ropeEndOp(r, 0, 8, O);
        expect(op).toEqual({ op: 'nodes', tx: 2, ty: 2, nodes: [{ x: 128, y: 32 }] });
        expect(linksOf(applyEdit(r, op), O).find((l) => l.kind === 'rope').end).toEqual({ x: 128, y: 32 });
    });

    /** MUTANT: a NODE gesture on a node-less rope refused rather than adding its end. */
    it('adds the end of a rope that has none, one undo step, and REDO brings it back', () => {
        const r = rope([]);
        expect(saveRefusal(r, O)).toMatch(/has no <node>/);
        const session = createEditSession(adapter, r, { base: { kind: 'oel', xml: recordToOel(r) } });
        session.apply(ropeEndOp(r, 0, 6, O));
        expect(session.ops()).toHaveLength(1);
        expect(saveRefusal(session.record(), O)).toBe(null);
        session.undo();
        expect(session.record().entities[0].nodes).toBeUndefined();
        session.redo();
        expect(session.record().entities[0].nodes).toEqual([{ x: 96, y: 32 }]);
    });

    /** MUTANT: the left-of-pulley refusal removed. */
    it('refuses a column left of the pulley, and a type with no path, by name', () => {
        const r = rope();
        expect(ropeEndOp(r, 0, 1, O).refused).toMatch(/to the RIGHT of its pulley/);
        const s = place(r, 5, 5, 'button', { tset: '0' });
        expect(ropeEndOp(s, indexOf(s, 'button', 80, 80), 7, O).refused).toMatch(/declares `<nodes>` only on a rope/);
    });

    /** MUTANT: read the FIRST node, where the game keeps the last. */
    it('reads the last node, as the game does', () => {
        const r = rope([{ x: 64, y: 32 }, { x: 128, y: 32 }]);
        expect(linksOf(r, O).find((l) => l.kind === 'rope').end).toEqual({ x: 128, y: 32 });
    });
});

describe('the issues, by name', () => {
    /** MUTANT: any warning promoted to `refuse`, or a code missing. */
    it('only a rope with no node refuses; the rest warn', () => {
        const rope = (nodes) => {
            const r = place(room(), 2, 2, 'rope', { tset: '0', tag: '0' });
            return applyEdit(place(r, 4, 4, 'lock', { tset: '0', tag: '1' }), { op: 'nodes', tx: 2, ty: 2, nodes });
        };
        const sev = (r, code) => linkIssues(r, O).find((i) => i.code === code)?.severity;
        expect(sev(place(room(), 2, 2, 'rope', { tset: '0', tag: '0' }), LINK_ISSUES.ROPE_NO_NODE)).toBe('refuse');
        expect(sev(rope([{ x: 64, y: 32 }, { x: 96, y: 32 }]), LINK_ISSUES.ROPE_MANY_NODES)).toBe('warn');
        expect(sev(rope([{ x: 0, y: 32 }]), LINK_ISSUES.ROPE_NODE_LEFT)).toBe('warn');
        expect(sev(rope([{ x: 96, y: 48 }]), LINK_ISSUES.ROPE_NODE_ROW)).toBe('warn');
        expect(sev(place(room(), 1, 1, 'button', { tset: '0' }), LINK_ISSUES.GROUP_NO_RESPONDER)).toBe('warn');
        expect(sev(place(room(), 1, 1, 'lock', { tset: '3', tag: '0' }), LINK_ISSUES.GROUP_NO_PUBLISHER)).toBe('warn');
        expect(sev(place(room(), 1, 1, 'button', { tset: '-1' }), LINK_ISSUES.PUBLISHER_SENTINEL)).toBe('warn');
        expect(sev(place(room(), 1, 1, 'sword', { tset: '1' }), LINK_ISSUES.TSET_UNREAD)).toBe('warn');
        expect(sev(place(room(), 1, 1, 'lock', { tset: 'x', tag: '0' }), LINK_ISSUES.TSET_NOT_INT)).toBe('warn');
    });

    /** MUTANT: a removal leaves no issue behind. */
    it('removing a button names the lock it leaves with no publisher', () => {
        let r = place(room(), 1, 1, 'button', { tset: '2' });
        r = place(r, 3, 1, 'lock', { tset: '2', tag: '0' });
        expect(codes(r)).toEqual([]);
        const after = applyEdit(r, { op: 'remove', tx: 1, ty: 1 });
        expect(linkIssues(after, O).map((i) => i.message)).toEqual([expect.stringMatching(/group 2 has no publisher.*<lock> at \(48,16\)/)]);
    });

    /** MUTANT: the no-schema path misses the rope, so a generated room's save would not refuse it. */
    it('the save refusal needs no schema', () => {
        expect(saveRefusal(place(room(), 2, 2, 'rope', {}), { schema: null })).toMatch(/has no <node>/);
    });
});

describe('SOLVE and a link edit', () => {
    /**
     * The goal up a corridor behind a lock, its button directly below the lock (the shape of L71's own button and
     * lock). The walls are thick because a pickup one wall away is approached through it. A cover in group 9 sits
     * out of the way as a partner to rewire to.
     */
    const vault = (buttonGroup) => {
        let r = emptyLevel({ level: 1, width: 11, height: 12 });
        for (let y = 1; y <= 6; y += 1) {
            for (let x = 3; x <= 7; x += 1) {
                if (!(x === 5 && y >= 4)) r = applyEdit(r, { op: 'paint', tx: x, ty: y, terrain: 'wall' });
            }
        }
        r = place(r, 5, 4, 'sword', {});
        r = place(r, 5, 6, 'lock', { tset: '1', tag: '0' });
        r = place(r, 5, 7, 'button', { tset: String(buttonGroup) });
        return place(r, 1, 1, 'cover', { tset: '9' });
    };
    const boot = { level: 1, x: 32, y: 128 };
    const verdict = (r) => solveEditedRoom(r, { boot }).verdict;
    const button = (r) => indexOf(r, 'button', 80, 112);

    /** MUTANT: `bindOps` writes the partner instead of the pick, so the button never leaves or joins the group. */
    it('solved → refused when the button is rewired away from its lock', () => {
        const r = vault(1);
        expect(verdict(r)).toBe('SOLVED');
        const away = applyEdit(r, bindOps(r, button(r), indexOf(r, 'cover', 16, 16), O));
        expect(partnersOf(away, button(away), O)).toEqual([indexOf(away, 'cover', 16, 16)]);
        expect(verdict(away)).toBe('REFUSED');
    }, 60000);

    /** MUTANT: as above; the verdict stays REFUSED. */
    it('refused → solved when the button is rewired to the lock', () => {
        const r = vault(3);
        expect(verdict(r)).toBe('REFUSED');
        const wired = applyEdit(r, bindOps(r, button(r), indexOf(r, 'lock', 80, 96), O));
        expect(verdict(wired)).toBe('SOLVED');
    }, 60000);

    const notesFor = (r) => solverNotes(r, { schema, buildWorld: buildLevelWorld });

    /** MUTANT: the notes answer from a hardcoded list, or say nothing and imply a check. */
    it('names the wires SOLVE cannot see, by asking the model', () => {
        let r = place(room(), 1, 1, 'button', { tset: '1' });
        r = place(r, 3, 1, 'lock', { tset: '1', tag: '0' });
        expect(notesFor(r)).toEqual([]);
        const pole = place(r, 5, 1, 'lightpole', { tset: '1', tag: '1', c: '0xFFFFFF', invert: '0' });
        expect(notesFor(pole)).toEqual([expect.stringMatching(/does not model <lightpole> at \(80,16\) answering group 1/)]);
        const rock = place(r, 5, 1, 'fallrocklarge', { tset: '1', tag: '1' });
        expect(notesFor(rock)).toEqual([expect.stringMatching(/does not model <fallrocklarge>/)]);
        const far = place(room(), 1, 1, 'buttonroom', { tset: '1', tag: '0', flip: '0', room: '39' });
        expect(notesFor(far)).toEqual([expect.stringMatching(/does not see <buttonroom>.*flag 1 of level 39: it solves one room/)]);
    });

    it('says so when the model cannot build the room', () => {
        expect(notesFor(place(room(), 2, 2, 'rope', { tset: '0', tag: '0' }))[0]).toMatch(/model cannot build this room/);
    });
});

describe('identity', () => {
    /** MUTANT: a link edit rewrites other entities, or the fold loses the nodes. */
    it('a link edit changes only the body it addresses, and a fold replays it', () => {
        const l = L(38);
        const members = groupMembers(l, O).filter((m) => m.role === 'publisher' && m.t >= 0);
        const a = members[0];
        const b = members.find((m) => m.t !== a.t);
        const op = bindOps(l, a.index, b.index, O);
        const after = applyEdit(l, op);
        after.entities.forEach((e, i) => {
            if (i !== a.index) expect(e).toEqual(l.entities[i]);
        });
        expect(foldEdits(adapter, l, [op]).record.entities[a.index].attrs.tset).toBe(String(b.t));
    });
});
