/**
 * ⛓ FULL REASONS (⚖ Robert 2026-11-20, "Show the full reasons"; display only) — a ladder-EXHAUSTED refusal's
 * `  rung: why` lines reach the Playback Bot's status and the walk instrument's `[MEASURE end]` line WHOLE, and the
 * whole-game walk's summary still parses that line.
 *
 * The chain, each link the real code: the solve's refusal → `expiryFailure` (the wasm playback's named failure; the
 * plain decline path already carried `res.message` whole) → the controller's `the wasm playback failed: …` →
 * `PlaybackBotUI.onWalkFailed` (the bot's status) → `measureLine` (`[MEASURE end]`, ONE line: newlines escaped as
 * JSON `\n`) → `walk-seedling-whole-game.mjs`'s `summarize` (the cause names every rung).
 *
 * ── THE MUTATION LIST (run during development) ──
 *   m1 `expiryFailure` keeps the first line only (today's)       -> the chain row reds
 *   m2 `measureLine` writes the status's first line only          -> the chain row and the one-line row red
 *   m3 `measureLine` writes the status raw (no JSON escape)       -> the one-line row reds (a raw line break)
 */
import { describe, expect, it } from 'vitest';

import { measureEndExtra, measureLine } from './walkMeasureLine.js';
import { expiryFailure } from '../seedlingDemo/wasmPlayback.js';
import { PlaybackBotUI } from '../playbackBot/playbackBotUI.js';
import { parseMeasureFields, summarize } from '../../../scripts/procgen/walk-seedling-whole-game.mjs';

const RUNGS = [
    '  time: the corridor is hit at tick 41 by wallflyer@64,80',
    '  bait: no bait stance holds the wallflyer off the corridor',
    '  kill: every strike stance is hit first',
];
const LADDER = 'exit level_22 -> level_29: the combat ladder is EXHAUSTED. The corridor passes through danger at (81.0,96.7) '
    + `— wallflyer — and every rung of ⚖ §11.8a's order refused:\n${RUNGS.join('\n')}`;
const GOAL = { kind: 'exit', level: 22, name: 'level_22 -> level_29' };

const FIELDS = {
    t: '739', step: 'bot-plays', checked: 5, botQueue: 48, botCursor: 4, botChecked: 4, botHead: 'Level 029 - Chest',
    botRegion: 'level_22', lastRegionEvent: 'level_22', regionChanges: 12, wasmPushes: 9, transport: 'wasm',
    wasmMemMB: '656', jsHeapMB: '169',
};

describe('the [MEASURE] line', () => {
    it('is today\'s format for a one-line status (byte for byte)', () => {
        const status = 'Sphere 3.1 → playing tick 4/90';
        expect(measureLine('tick', 'seedling-whole-game', { ...FIELDS, status, extra: '' })).toBe(
            '[MEASURE tick] seedling-whole-game t=739s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 '
            + 'botHead="Level 029 - Chest" botRegion="level_22" lastRegionEvent="level_22" regionChanges=12 wasmPushes=9 '
            + 'transport=wasm wasmMemMB=656 jsHeapMB=169 status="Sphere 3.1 → playing tick 4/90"');
        expect(measureEndExtra({ end: 'failed', stepId: 'bot-plays', why: 'its done check never held' }))
            .toBe(' walkEnd=failed walkStep=bot-plays why="its done check never held"');
        expect(measureEndExtra(null)).toBe(' walkEnd=threw walkStep=? why=null');
    });

    it('stays ONE line with a multi-line status: each newline is escaped (\\n) and parses back whole', () => {
        const status = `error: level_22: ${LADDER}`;
        const line = measureLine('end', 'seedling-whole-game', { ...FIELDS, status, extra: measureEndExtra({ end: 'failed', stepId: 'bot-plays', why: 'x\ny' }) });
        expect(line).not.toMatch(/[\r\n]/);
        expect(line).toContain('\\n  time: ');
        const f = parseMeasureFields(line);
        expect(f.status).toBe(status);
        expect(f.why).toBe('x\ny');
    });
});

describe('a ladder-EXHAUSTED refusal reaches the bot status and [MEASURE end] whole', () => {
    it('3 rung lines: the bot\'s status, the measure line and the walk summary each carry all 3', () => {
        // the wasm playback's named failure at its budget's end (a pass that DECLINED leads)
        const why = expiryFailure({ goal: GOAL, budgets: [400, 1600], refusal: { ok: false, kind: 'refusal', pass: 'full', message: LADDER } });
        // `seedlingPlaybackController`'s `onFailed` → `_fail` → `playback:walkFailed` → the bot
        const bot = new PlaybackBotUI({ getSphereData: () => [] });
        bot._currentRegion = 'level_22';
        bot.onWalkFailed({ substrate: 'flash', target: { kind: 'exit', name: 'level_22 -> level_29' }, reason: `the wasm playback failed: ${why}` });
        const status = bot.getStatus();
        expect(status.startsWith('error')).toBe(true);
        for (const r of RUNGS) expect(status).toContain(r);
        // the instrument's end line: the status as the DOM holds it, and botCannotFinish's `why` quoting it
        const whyEnd = `the app shows it cannot finish: the Playback Bot says "${status}"`;
        const line = `BROWSER LOG (log): ${measureLine('end', 'seedling-whole-game', { ...FIELDS, status, extra: measureEndExtra({ end: 'failed', stepId: 'bot-plays', why: whyEnd }) })}`;
        expect(line).not.toMatch(/[\r\n]/);
        for (const r of RUNGS) expect(line).toContain(JSON.stringify(r).slice(1, -1));
        // the whole-game walk's summary still parses it, and its cause names every rung
        const s = summarize(`${line}\n`);
        expect(s).not.toBe(null);
        expect(s.entry).toBe(5);
        expect(s.total).toBe(48);
        expect(s.transport).toBe('wasm');
        expect(s.cause.startsWith('refusal "error: level_22: the bot cannot walk to exit')).toBe(true);
        expect(s.cause).not.toMatch(/[\r\n]/);
        for (const r of RUNGS) expect(JSON.parse(s.cause.slice('refusal '.length))).toContain(r);
    });
});
