/**
 * seedlingDemo/crossSwapStatics.test — the audit's own guard.
 *
 * The table is prose with structure, so the tests are about the structure:
 * that every candidate the brief enumerated is present, that no entry can
 * claim "inert" without either a cited read site or a stated way of
 * knowing there is none, and that the two dead-frame kinds stay distinct.
 */

import { describe, expect, it } from 'vitest';

import {
    CROSS_SWAP_STATICS, CrossSwapStaticsError, DEAD_FRAME_KINDS,
    auditFindings, classify, liveEntries,
} from './crossSwapStatics.js';

/** Exactly the candidates the slice-5 brief listed, plus the three known. */
const ENUMERATED = [
    'Game.time',                                // pinned, slice 3
    'Music.<swim channel>',                     // modelled, slice 5 step 1
    'Game.shake',                               // the known-inert one
    'Game.underwater',
    'Game.raining',
    'Game.cameraSpeedDivisor',
    'Game._cameraTarget',
    'Game.currentCharacter',
    'Game.framesPerCharacter',
    'Game.daysPassed',
    'Game.snowing / blizzardOffset',
    'Game.healthc / healths',
    'Game.sign',
    'Game.fallthroughSign',
    'Game.levelMusics',
    'Game.cutscene',
    'Game.talking / talkingText / talkingPic',
    'Music.currentSet / currentIndex',
    'Music.songs[] — the background channels',
];

describe('coverage', () => {
    it('classifies every enumerated candidate', () => {
        for (const name of ENUMERATED) {
            expect(Object.keys(CROSS_SWAP_STATICS), `${name} was enumerated by the brief`)
                .toContain(name);
        }
    });

    it('and the two the audit itself added', () => {
        // `todaysTime` + the text-timer trio, because the brief listed them
        // as statics and they are INSTANCE vars — a distinction worth
        // keeping on the record rather than dropping silently.
        expect(CROSS_SWAP_STATICS['Game.todaysTime'].survives).toBe('instance');
        expect(CROSS_SWAP_STATICS['Game.cTextIndex / textTimer / proceedText'].survives)
            .toBe('instance');
        // ⛓ and the SECOND physics class that reads the mixer, found here.
        expect(CROSS_SWAP_STATICS['Music.<the "Other" channel 4>'].readSites[0])
            .toMatch(/Crusher\.as:77/);
    });
});

describe('the construction guard', () => {
    it('the shipped table passes its own audit', () => {
        expect(auditFindings()).toEqual([]);
    });

    it('an inert entry with NO read site and no explanation is a finding', () => {
        const bad = {
            'Game.invented': {
                decl: 'Game.as:1 `public static var invented:int`',
                survives: 'yes',
                verdict: 'inert',
                readSites: [],
                why: 'I looked for a while and did not find anything that reads it.',
            },
        };
        expect(auditFindings(bad)).toEqual([expect.stringContaining('SAY WHY')]);
    });

    it('...and passes once it says HOW it knows', () => {
        const fixed = {
            'Game.invented': {
                decl: 'Game.as:1 `public static var invented:int`',
                survives: 'yes',
                verdict: 'inert',
                readSites: [],
                noReaderConfirmedBy: 'grep over all 210 sources returns only the decl',
                why: 'a write-only counter, and the grep above is how that is known.',
            },
        };
        expect(auditFindings(fixed)).toEqual([]);
    });

    it('catches a missing citation, an unknown verdict and a missing reason', () => {
        const bad = {
            A: { decl: 'somewhere', survives: 'yes', verdict: 'inert', readSites: ['x'], why: 'x'.repeat(50) },
            B: { decl: 'Game.as:1', survives: 'yes', verdict: 'probably fine', readSites: ['x'], why: 'x'.repeat(50) },
            C: { decl: 'Game.as:1', survives: 'maybe', verdict: 'inert', readSites: ['x'], why: 'short' },
        };
        const found = auditFindings(bad);
        expect(found).toEqual(expect.arrayContaining([
            expect.stringContaining('A: no declaration line cited'),
            expect.stringContaining('B: verdict'),
            expect.stringContaining('C: survives'),
            expect.stringContaining('C: no reason given'),
        ]));
    });
});

describe('the verdicts', () => {
    it('only four entries are not inert, and each names its mechanism', () => {
        const live = liveEntries();
        expect(live).toEqual(expect.arrayContaining([
            { name: 'Game.time', verdict: 'pinned' },
            { name: 'Music.<swim channel>', verdict: 'modelled' },
            { name: 'Game.shake', verdict: 'refused' },
        ]));
    });

    it('⚠ `Game.shake` is REFUSED, not inert — the model throws rather than guess', () => {
        // The distinction is the whole point of the fourth verdict: shake
        // reaches the camera, the camera gates `Enemy.update`'s off-screen
        // return, and the only reason no tape has met it is that a
        // fallrock's freeze (90) outlasts its shake (30).
        const e = classify('Game.shake');
        expect(e.verdict).toBe('refused');
        expect(e.why).toMatch(/90/);
        expect(e.why).toMatch(/30/);
        expect(e.why).toMatch(/L43/);   // step 4 has to re-check it
    });

    it('the two entries that survive AND are read stale-free say so explicitly', () => {
        expect(classify('Game.framesPerCharacter').survives).toBe('yes');
        expect(classify('Game.framesPerCharacter').why).toMatch(/NPC\.as:269/);
        expect(classify('Game.healthc / healths').why).toMatch(/Player\.as:1403/);
    });

    it('`Game.sign` is the deliberate mailbox, and Message is why it is inert', () => {
        const e = classify('Game.sign');
        expect(e.readSites.join(' ')).toMatch(/begin\(\)/);
        expect(e.why).toMatch(/Message/);
        expect(e.why).toMatch(/no `type`|NO `type`/);
    });

    it('`Game.levelMusics` is inert by its READER, not by nobody writing it', () => {
        const e = classify('Game.levelMusics');
        expect(e.why).toMatch(/BobBoss\.as:45/);
        expect(e.why).toMatch(/songs/);
    });

    it('`Game.raining` has a byte-identical WITNESS, not an argument', () => {
        expect(classify('Game.raining').why).toMatch(/L60/);
        expect(classify('Game.raining').why).toMatch(/r5-l60-kill/);
    });
});

describe('the two dead-frame kinds', () => {
    it('differ on whether `super.update()` runs at all', () => {
        expect(DEAD_FRAME_KINDS.fade.superUpdateRuns).toBe(false);
        expect(DEAD_FRAME_KINDS.frozen.superUpdateRuns).toBe(true);
    });

    it('and both are counted dead by the same line in Bot.as', () => {
        expect(DEAD_FRAME_KINDS.frozen.as3).toMatch(/Bot\.as:1305/);
        expect(DEAD_FRAME_KINDS.fade.as3).toMatch(/blackCover <= 0/);
    });
});

describe('classify', () => {
    it('refuses an unaudited name rather than returning undefined', () => {
        expect(() => classify('Game.notAudited')).toThrow(CrossSwapStaticsError);
        expect(() => classify('Game.notAudited')).toThrow(/has not been classified/);
    });
});
