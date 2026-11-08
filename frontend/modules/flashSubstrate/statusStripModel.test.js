import { describe, expect, it } from 'vitest';
import {
    heldCount, missingItems, ruleState, shortName, levelItemRows, checkRows, findStaticExit, exitRows,
    needsText, createActivityLog, createBotStatus, botNoteText, checkpointName,
} from './statusStripModel.js';

const has = (item_name) => ({ rule: 'Has', args: { item_name } });
const hasAll = (...item_names) => ({ rule: 'HasAll', args: { item_names } });
const R = 'region_3_2';

describe('the status strip model: held and locked', () => {
    it('an item is held only with a positive count, in either inventory shape', () => {
        expect(heldCount({ Clouds: 1 }, 'Clouds')).toBe(1);
        expect(heldCount({ Clouds: 0 }, 'Clouds')).toBe(0);
        expect(heldCount(new Map([['Clouds', 2]]), 'Clouds')).toBe(2);
        expect(heldCount(null, 'Clouds')).toBe(0);
    });

    it('level items follow the inventory: LOCKED becomes HELD when the item arrives', () => {
        const items = [{ name: 'Double Jump', kind: 'ability' }, { name: 'Moving Blocks', kind: 'platform', note: 'from checkpoint 1' }];
        expect(levelItemRows(items, {}).map((r) => r.held)).toEqual([false, false]);
        const after = levelItemRows(items, { 'Moving Blocks': 1 });
        expect(after.map((r) => [r.name, r.held])).toEqual([['Double Jump', false], ['Moving Blocks', true]]);
        expect(after[1].note).toBe('from checkpoint 1');
    });
});

describe('the status strip model: what a rule still needs', () => {
    it('Has, HasAll and And list the unheld items only', () => {
        expect(missingItems(has('Clouds'), {})).toEqual({ missing: ['Clouds'], anyOf: false });
        expect(missingItems(has('Clouds'), { Clouds: 1 })).toEqual({ missing: [], anyOf: false });
        expect(missingItems(hasAll('Double Jump', 'Moving Blocks'), { 'Double Jump': 1 }).missing).toEqual(['Moving Blocks']);
        expect(missingItems({ rule: 'And', children: [has('A'), hasAll('A', 'B')] }, {}).missing).toEqual(['A', 'B']);
    });

    it('a count above one is not met by one', () => {
        expect(missingItems({ rule: 'Has', args: { item_name: 'Gem', count: 2 } }, { Gem: 1 }).missing).toEqual(['Gem']);
    });

    it('HasAny and an Or of single items say "one of"', () => {
        expect(missingItems({ rule: 'HasAny', args: { item_names: ['A', 'B'] } }, {})).toEqual({ missing: ['A', 'B'], anyOf: true });
        expect(missingItems({ rule: 'Or', children: [has('A'), has('B')] }, {})).toEqual({ missing: ['A', 'B'], anyOf: true });
        expect(missingItems({ rule: 'Or', children: [has('A'), has('B')] }, { B: 1 }).missing).toEqual([]);
    });

    it('a rule outside the item vocabulary gives no list (never a wrong one)', () => {
        expect(missingItems({ rule: 'CanReachRegion', args: { region_name: 'x' } }, {})).toBe(null);
        expect(missingItems({ rule: 'And', children: [has('A'), { rule: 'Mystery' }] }, {})).toBe(null);
    });

    it('needsText joins with and/or, and says when nothing is known', () => {
        expect(needsText({ state: 'locked', missing: ['A'] })).toBe('needs A');
        expect(needsText({ state: 'locked', missing: ['A', 'B'] })).toBe('needs A and B');
        expect(needsText({ state: 'locked', missing: ['A', 'B', 'C'], anyOf: true })).toBe('needs A, B or C');
        expect(needsText({ state: 'locked' })).toBe('locked');
        expect(needsText({ state: 'unknown' })).toBe('not known here');
    });

    it('ruleState: open, locked, and an undecidable rule is unknown, never open', () => {
        expect(ruleState(null, {})).toBe('open');
        expect(ruleState(has('A'), { A: 1 })).toBe('open');
        expect(ruleState(has('A'), {})).toBe('locked');
        expect(ruleState({ rule: 'NoSuchRuleKind' }, {})).toBe('unknown');
    });
});

describe('the status strip model: checks k of n', () => {
    const locations = new Map([
        [`${R}__loc_0`, { name: `${R}__loc_0`, access_rule: has('Double Jump') }],
        [`${R}__loc_1`, { name: `${R}__loc_1`, access_rule: hasAll('Double Jump', 'Moving Blocks') }],
    ]);
    const apLocations = { loc_0: `${R}__loc_0`, loc_1: `${R}__loc_1` };

    it('counts the checked ones and judges the rest by their own rule', () => {
        const c = checkRows({ apLocations, regionId: R, checked: [`${R}__loc_0`], locations, inventory: { 'Double Jump': 1 } });
        expect([c.collected, c.total]).toEqual([1, 2]);
        expect(c.rows.map((r) => [r.label, r.state])).toEqual([['loc_0', 'checked'], ['loc_1', 'locked']]);
        expect(c.rows[1].missing).toEqual(['Moving Blocks']);
    });

    it('a reachable unchecked one is open; every checked shape counts', () => {
        const inv = { 'Double Jump': 1, 'Moving Blocks': 1 };
        expect(checkRows({ apLocations, regionId: R, checked: new Set(), locations, inventory: inv }).rows.map((r) => r.state)).toEqual(['open', 'open']);
        expect(checkRows({ apLocations, regionId: R, checked: { [`${R}__loc_1`]: true }, locations, inventory: inv }).collected).toBe(1);
    });

    it('shortName strips only its own region prefix', () => {
        expect(shortName(`${R}__loc_0`, R)).toBe('loc_0');
        expect(shortName('region_2_2__loc_0', R)).toBe('region_2_2__loc_0');
    });
});

describe('the status strip model: exits', () => {
    const staticExits = new Map([
        ['region_3_2__exit_E', { name: 'region_3_2__exit_E', parentRegion: R, connectedRegion: 'region_4_2', access_rule: hasAll('Double Jump', 'Moving Blocks') }],
        ['region_2_2', { name: 'region_2_2', parentRegion: R, connectedRegion: 'region_2_2', access_rule: has('Double Jump') }],
        ['elsewhere', { name: 'exit_E', parentRegion: 'region_9_9', connectedRegion: 'region_4_2', access_rule: null }],
    ]);
    const exits = new Map([
        ['exit_E', { exitName: 'exit_E', side: 'E', targetRegion: 'region_4_2', label: 'to region_4_2' }],
        ['exit_W', { exitName: 'exit_W', side: 'W', targetRegion: 'region_2_2' }],
    ]);

    it('finds the exit by its prefixed name, else by its one target, never in another region', () => {
        expect(findStaticExit(staticExits, R, { exitName: 'exit_E' }).name).toBe('region_3_2__exit_E');
        expect(findStaticExit(staticExits, R, { exitName: 'exit_W', targetRegion: 'region_2_2' }).name).toBe('region_2_2');
        expect(findStaticExit(staticExits, 'region_9_9', { exitName: 'exit_E' }).name).toBe('exit_E');
        expect(findStaticExit(staticExits, R, { exitName: 'nope' })).toBe(null);
    });

    it('a gate change shows: locked with its needs, then open', () => {
        const before = exitRows({ exits, regionId: R, staticExits, inventory: { 'Double Jump': 1 } });
        expect(before.map((x) => [x.side, x.state])).toEqual([['E', 'locked'], ['W', 'open']]);
        expect(before[0].missing).toEqual(['Moving Blocks']);
        const after = exitRows({ exits, regionId: R, staticExits, inventory: { 'Double Jump': 1, 'Moving Blocks': 1 } });
        expect(after.map((x) => x.state)).toEqual(['open', 'open']);
        expect(after[1].label).toBe('to region_2_2');
    });

    it('a same-named exit of another region is never taken, even listed first', () => {
        const foreignFirst = new Map([
            ['x', { name: 'exit_E', parentRegion: 'region_9_9', connectedRegion: 'region_4_2', access_rule: null }],
            ['y', { name: 'region_3_2__exit_E', parentRegion: R, connectedRegion: 'region_4_2', access_rule: has('Moving Blocks') }],
        ]);
        expect(exitRows({ exits, regionId: R, staticExits: foreignFirst, inventory: {} })[0].state).toBe('locked');
    });

    it('an exit the static data does not have is unknown, not open', () => {
        const rows = exitRows({ exits: [{ exitName: 'x', side: 'N' }], regionId: R, staticExits, inventory: {} });
        expect(rows[0].state).toBe('unknown');
    });
});

describe('the status strip model: the activity log', () => {
    const items = {
        [`${R}__loc_0`]: { item: 'Moving Blocks', player: 1 },
        [`${R}__loc_1`]: { item: 'Hookshot', player: 2 },
        [`${R}__loc_2`]: { item: 'Bow', player: 3, playerName: 'Link' },
    };
    const who = (over = {}) => ({
        ownSlot: () => 1,
        playerName: (s) => ({ 2: 'Zelda' })[s] ?? null,
        locationItem: (l) => items[l] ?? null,
        connected: () => false,
        ...over,
    });

    it('the first snapshot is a baseline, not news', () => {
        const log = createActivityLog({ who: who() });
        expect(log.noteSnapshot({ checked: [`${R}__loc_0`], inventory: { 'Moving Blocks': 1 } })).toEqual([]);
        expect(log.entries).toEqual([]);
    });

    it('a local check of my own item is "You found", and its item is not received again', () => {
        const log = createActivityLog({ who: who() });
        log.noteSnapshot({ checked: [], inventory: {} });
        const added = log.noteSnapshot({ checked: [`${R}__loc_0`], inventory: { 'Moving Blocks': 1 } });
        expect(added.map((e) => e.text)).toEqual(['You found Moving Blocks (region_3_2__loc_0)']);
    });

    it('a local check of another player\'s item is "Sent X to <their name>"; no name → their slot', () => {
        const log = createActivityLog({ who: who() });
        log.noteSnapshot({ checked: [] });
        log.noteSnapshot({ checked: [`${R}__loc_1`] });
        log.noteSnapshot({ checked: [`${R}__loc_1`, `${R}__loc_2`] });
        expect(log.entries.map((e) => e.text)).toEqual(['Sent Bow to Link (region_3_2__loc_2)', 'Sent Hookshot to Zelda (region_3_2__loc_1)']);
        const anon = createActivityLog({ who: who({ playerName: () => null }) });
        anon.noteSnapshot({ checked: [] });
        expect(anon.noteSnapshot({ checked: [`${R}__loc_1`] })[0].text).toBe('Sent Hookshot to player 2 (region_3_2__loc_1)');
    });

    it('offline, an inventory gain no find explains is "Received X", with no sender claimed', () => {
        const log = createActivityLog({ who: who() });
        log.noteSnapshot({ checked: [], inventory: {} });
        expect(log.noteSnapshot({ checked: [], inventory: { Clouds: 1 } }).map((e) => e.text)).toEqual(['Received Clouds']);
    });

    it('connected, inventory gains are left to the server\'s received items', () => {
        const log = createActivityLog({ who: who({ connected: () => true }) });
        log.noteSnapshot({ checked: [], inventory: {} });
        expect(log.noteSnapshot({ checked: [], inventory: { Clouds: 1 } })).toEqual([]);
    });

    it('received items name their sender; my own sends are skipped; a full resync is one line', () => {
        const log = createActivityLog({ who: who() });
        expect(log.noteReceived([{ itemName: 'Clouds', senderSlot: 2, senderName: 'Zelda' }], { index: 4 })[0].text).toBe('Received Clouds from Zelda');
        expect(log.noteReceived([{ itemName: 'Moving Blocks', senderSlot: 1, senderName: 'Me' }], { index: 5 })).toEqual([]);
        expect(log.noteReceived([{ itemName: 'Bow', senderSlot: 7 }], { index: 6 })[0].text).toBe('Received Bow from player 7');
        expect(log.noteReceived([{ itemName: 'A' }, { itemName: 'B' }], { index: 0 })[0].text).toBe('Synced 2 items from the server');
    });

    it('the log keeps the newest entries, newest first', () => {
        const log = createActivityLog({ limit: 2, who: who() });
        for (const n of ['A', 'B', 'C']) log.noteReceived([{ itemName: n, senderSlot: 2 }], { index: 9 });
        expect(log.entries.map((e) => e.item)).toEqual(['C', 'B']);
    });

    it('rebaseline makes the next snapshot a baseline again (a reconnect resync is not a burst of finds)', () => {
        const log = createActivityLog({ who: who() });
        log.noteSnapshot({ checked: [] });
        log.rebaseline();
        expect(log.noteSnapshot({ checked: [`${R}__loc_0`, `${R}__loc_1`] })).toEqual([]);
    });
});

describe('the status strip model: the bot', () => {
    it('a walkTo names its target; stop ends it', () => {
        const bot = createBotStatus({ describeTarget: (t) => `<${t.name}>` });
        expect(bot.noteCommand('walkTo', [{ kind: 'location', name: 'loc_0' }])).toMatchObject({ active: true, label: '<loc_0>' });
        expect(bot.noteCommand('stop', [])).toMatchObject({ active: false, result: 'stopped' });
    });

    it('a page\'s notes and results show; pieces read as checkpoints', () => {
        const bot = createBotStatus();
        bot.noteCommand('walkTo', [{ kind: 'exit', name: 'exit_E' }]);
        expect(bot.noteEvent({ kind: 'botNote', note: 'ladder', fromPiece: 0, toPiece: 1 }).note).toBe('ladder: skipped to checkpoint 1');
        expect(bot.noteEvent({ kind: 'bot', result: 'reached' })).toMatchObject({ active: false, result: 'reached' });
        expect(bot.noteEvent({ kind: 'bot', result: 'died', exhausted: true, reason: 'out of tries' }).note).toBe('gave up: out of tries');
    });

    it('note text: restarts, the start, and an unknown kind shows its own text', () => {
        expect(botNoteText({ note: 'restart', reason: 'died', piece: 0, attempt: 2, maxAttempts: 3 })).toBe('died: restarting from the start (try 2/3)');
        expect(botNoteText({ note: 'restart', piece: 2 })).toBe('died: restarting from checkpoint 2');
        expect(botNoteText({ note: 'rewind', text: 'back to the coin' })).toBe('back to the coin');
        expect(checkpointName(0)).toBe('the start');
    });

    it('a walked ladder (P7c) says how it ended, never "skipped"', () => {
        expect(botNoteText({ note: 'ladderWalk', fromPiece: 0, toPiece: 1 })).toBe('ladder: climbing to checkpoint 1');
        expect(botNoteText({ note: 'ladderWalk' })).toBe('ladder: climbing');
        expect(botNoteText({ note: 'ladder', crossing: 'crossed', fromPiece: 1, toPiece: 2, steps: 14 })).toBe('ladder: climbed to checkpoint 2 (14 steps)');
        expect(botNoteText({ note: 'ladder', crossing: 'crossed', toPiece: 1, steps: 1, resync: true })).toBe('ladder: climbed to checkpoint 1 (1 step, resynced)');
        expect(botNoteText({ note: 'ladder', crossing: 'crossed', toPiece: 1 })).toBe('ladder: climbed to checkpoint 1');
        expect(botNoteText({ note: 'ladder', crossing: 'fellBack', toPiece: 1, why: 'missed the jump', steps: 9 })).toBe('ladder: fell back (missed the jump, 9 steps)');
        expect(botNoteText({ note: 'ladder', crossing: 'fellBack' })).toBe('ladder: fell back');
        // an unknown crossing is not claimed to be a skip
        expect(botNoteText({ note: 'ladder', crossing: 'sideways', toPiece: 1, text: 'page text' })).toBe('page text');
        const bot = createBotStatus();
        bot.noteCommand('walkTo', [{ kind: 'exit', name: 'r__exit_E' }]);
        expect(bot.noteEvent({ kind: 'botNote', note: 'ladder', crossing: 'fellBack', why: 'fell' }).note).toBe('ladder: fell back (fell)');
    });
});

describe('the status strip model: a walk on a page that reports no results', () => {
    it('ends when its location is checked; an exit walk is not ended by a check', () => {
        const bot = createBotStatus();
        bot.noteCommand('walkTo', [{ kind: 'location', name: 'r__loc_0' }]);
        expect(bot.noteChecked(['r__loc_1']).active).toBe(true);
        expect(bot.noteChecked(['r__loc_0'])).toMatchObject({ active: false, result: 'reached' });
        const door = createBotStatus();
        door.noteCommand('walkTo', [{ kind: 'exit', name: 'r__exit_E' }]);
        expect(door.noteChecked(['r__exit_E']).active).toBe(true);
    });

    it('a log entry names its location the way the view asks', () => {
        const log = createActivityLog({ where: (l) => l.split('__')[1], who: { ownSlot: () => 1, locationItem: () => ({ item: 'Gem', player: 1 }) } });
        log.noteSnapshot({ checked: [] });
        expect(log.noteSnapshot({ checked: ['r__loc_7'] })[0].text).toBe('You found Gem (loc_7)');
    });
});
