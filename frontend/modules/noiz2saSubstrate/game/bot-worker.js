/**
 * The Noiz2sa region page's bot, in a Web Worker (slice N4), so the page's game keeps its speed while the bot thinks.
 * Modelled on the game repo's own `web/bot-worker.js` (the play page's), but for a REGION: one ATTEMPT of the span
 * (`../noiz2saRegion.js` createRegionRun, the copy of `segment-run.js`), the way `segment-run.js` runSegment plays it.
 *
 * The worker plays its OWN copy of the attempt: the engine is deterministic and the bot's input is the only input,
 * so its copy and the page's stay identical frame for frame. It runs ahead of the page by up to LEAD frames and posts
 * the inputs; the page plays them as they come and waits (never guesses) if one is late. The bot's budget is a count
 * (BROWSER_BUDGET), not wall-clock, so the page plays exactly what a headless runSegment plays.
 *
 * An attempt ends at a hit or at the clear; the page then starts the next attempt (a hit) with the next attempt's
 * bot seed. A boss that is not the region's end leads into the next stage: a NEW bot for the new game, as runSegment
 * makes one per game.
 *
 * Messages in:  {type: 'init', patterns}  (packed with packBulletML: a worker has no XML parser)
 *               {type: 'start', id, span, inputs, bot, botSeed}
 *                 — `inputs` are the attempt's frames played so far (replayed here), the bot takes over after them;
 *                 `bot` = makeBot options without the seeds (human.js botOptions at the trainer's knobs), `botSeed`
 *                 the attempt's (segment-run.js attemptBotSeed)
 *               {type: 'ack', id, frame}  the page's attempt frame;  {type: 'stop', id}
 * Messages out: {type: 'inputs', id, from, inputs}  inputs for attempt frames from, from+1, …;
 *               {type: 'ready'};  {type: 'error', message}
 */
import { unpackBulletML } from '../../bulletml-dodge/src/bulletml.js';
import { newGame, stepGame } from '../../bulletml-dodge/src/game/noiz2sa-game.js';
import { makeBot, BROWSER_BUDGET } from '../../bulletml-dodge/src/game/bot.js';
import { createRegionRun } from '../noiz2saRegion.js';

// frames the worker may run ahead of the page (~3 s at 1×): the bot's bursts are paid back from this lead
const LEAD = 180;
const kick = new MessageChannel();
let kicked = false;
kick.port1.onmessage = () => { kicked = false; pump(); };
let patterns = null, run = null, pumping = false;

const newBot = (m) => makeBot({ variant: 'attack', budget: BROWSER_BUDGET, ...m.bot, botSeed: m.botSeed, gameSeed: m.span.seed });

function start(m) {
    const region = createRegionRun(m.span, { engine: { newGame, stepGame }, patterns });
    for (const b of m.inputs) region.step(b);
    run = { id: m.id, m, region, bot: newBot(m), frame: m.inputs.length, pageFrame: m.inputs.length, out: [], from: m.inputs.length, done: false };
    pump();
}

function flush() {
    if (!run || !run.out.length) return;
    postMessage({ type: 'inputs', id: run.id, from: run.from, inputs: run.out });
    run.from += run.out.length;
    run.out = [];
}

function pump() {
    if (pumping) return;
    pumping = true;
    const t0 = performance.now();
    while (run && !run.done && run.frame - run.pageFrame < LEAD) {
        const b = run.bot(run.region.g);
        const out = run.region.step(b);
        run.out.push(b);
        run.frame++;
        if (out.hit || out.cleared) run.done = true; // the attempt is over (the page sees the same frame)
        else if (out.stageChanged) run.bot = newBot(run.m);
        if (run.out.length >= 4 || performance.now() - t0 > 8) break;
    }
    flush();
    pumping = false;
    if (run && !run.done && run.frame - run.pageFrame < LEAD && !kicked) { kicked = true; kick.port2.postMessage(null); }
}

onmessage = (e) => {
    const m = e.data;
    try {
        if (m.type === 'init') {
            patterns = {};
            for (const k of Object.keys(m.patterns)) patterns[k] = m.patterns[k].map(unpackBulletML);
            postMessage({ type: 'ready' });
        } else if (m.type === 'start') start(m);
        else if (m.type === 'ack') { if (run && run.id === m.id) { run.pageFrame = m.frame; if (!kicked) pump(); } }
        else if (m.type === 'stop') { if (run && run.id === m.id) run = null; }
    } catch (err) {
        postMessage({ type: 'error', message: String((err && err.stack) || err) });
    }
};
