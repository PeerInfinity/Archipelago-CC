/**
 * webAudio — the output's states with a FAKE AudioContext: nothing before the
 * unlock, the iOS workarounds, hold/visibility, decode's two forms, and a
 * refused context that never crashes.
 */
import { describe, expect, it } from 'vitest';

import { createAudioOut, silentWavDataUrl, volumeToGain } from './webAudio.js';

/** A fake Web Audio context that records what is made and started. */
function fakeAudio({ throwOnCreate = false, callbackDecodeOnly = false } = {}) {
    const log = [];
    const contexts = [];
    class Ctx {
        constructor() {
            if (throwOnCreate) throw new Error('NotAllowedError');
            this.state = 'suspended';
            this.currentTime = 1.5;
            this.sampleRate = 44100;
            this.destination = { name: 'dest' };
            contexts.push(this);
        }
        createGain() { return { gain: { value: 1 }, connect: (n) => log.push(['gain→', n?.name ?? 'node']) }; }
        createStereoPanner() { return { pan: { value: 0 }, connect: () => {} }; }
        createBuffer(ch, len) { return { ch, len }; }
        createBufferSource() {
            const s = { buffer: null, loop: false, connect: () => {}, start: (when) => log.push(['start', s.buffer, when]), stop: () => log.push(['stop', s.buffer]) };
            return s;
        }
        resume() { this.state = 'running'; log.push(['resume']); return Promise.resolve(); }
        suspend() { this.state = 'suspended'; log.push(['suspend']); return Promise.resolve(); }
        decodeAudioData(ab, ok) {
            if (callbackDecodeOnly) { ok({ decoded: ab.byteLength }); return undefined; }
            return Promise.resolve({ decoded: ab.byteLength });
        }
    }
    const listeners = [];
    const doc = { visibilityState: 'visible' };
    const win = { document: doc, navigator: {}, console: { warn: (m) => log.push(['warn', m]) } };
    const listen = (target, type, handler) => listeners.push({ target, type, handler });
    const fire = (type) => listeners.filter((l) => l.type === type).forEach((l) => l.handler());
    return { Ctx, log, contexts, win, doc, listen, fire, listeners };
}

describe('createAudioOut', () => {
    it('⛔ NOTHING BEFORE THE UNLOCK: no context, play is null, the clock reads 0', () => {
        const f = fakeAudio();
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen });
        expect(out.state).toBe('locked');
        expect(f.contexts).toHaveLength(0);
        expect(out.play({ b: 1 })).toBeNull();
        expect(out.now()).toBe(0);
    });

    it('unlock (in a gesture): one context, resumed, a 1-sample silent source started, listeners for resume', () => {
        const f = fakeAudio();
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen, mediaWorkaround: false });
        expect(out.unlock()).toBe('running');
        expect(f.contexts).toHaveLength(1);
        expect(f.log.some(([k, b]) => k === 'start' && b?.len === 1)).toBe(true);
        expect(f.log.some(([k]) => k === 'resume')).toBe(true);
        expect(f.listeners.map((l) => l.type).sort()).toEqual(['keydown', 'pointerdown', 'touchend', 'visibilitychange']);
        out.unlock();
        expect(f.contexts).toHaveLength(1);
    });

    it('iOS silent switch: the Audio Session API when present, else the silent looping media element', () => {
        const f = fakeAudio();
        f.win.navigator.audioSession = { type: 'auto' };
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen });
        out.unlock();
        expect(f.win.navigator.audioSession.type).toBe('playback');
        expect(out.sessionWorkaround).toBe('audioSession');

        const g = fakeAudio();
        const made = [];
        g.win.Audio = function Audio(src) { this.src = src; this.attrs = {}; this.setAttribute = (k, v) => { this.attrs[k] = v; }; this.play = () => { made.push(this); return Promise.resolve(); }; this.pause = () => {}; };
        const out2 = createAudioOut({ win: g.win, AudioContextCtor: g.Ctx, listen: g.listen });
        out2.unlock();
        expect(out2.sessionWorkaround).toBe('silentMediaElement');
        expect(made[0].loop).toBe(true);
        expect(made[0].attrs).toHaveProperty('playsinline');
        expect(made[0].src).toMatch(/^data:audio\/wav;base64,UklGR/);
    });

    it('⛔ A REFUSED CONTEXT: state refused, every call a no-op, no throw, decode rejects by name', async () => {
        const f = fakeAudio({ throwOnCreate: true });
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen });
        expect(out.unlock()).toBe('refused');
        expect(out.refusedWhy).toMatch(/NotAllowedError/);
        expect(out.play({})).toBeNull();
        out.hold(true); out.setVolume(0.2); out.setMuted(true);
        await expect(out.decode(new ArrayBuffer(2))).rejects.toThrow(/audio refused/);
        const none = createAudioOut({ win: {}, AudioContextCtor: undefined, listen: () => {} });
        expect(none.unlock()).toBe('refused');
        expect(none.refusedWhy).toMatch(/no Web Audio/);
    });

    it('hold and the hidden tab suspend; a show / tap resumes; the readout says suspended meanwhile', () => {
        const f = fakeAudio();
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen, mediaWorkaround: false });
        out.unlock();
        out.hold(true);
        expect(out.state).toBe('suspended');
        out.hold(false);
        expect(out.state).toBe('running');
        f.doc.visibilityState = 'hidden';
        f.fire('visibilitychange');
        expect(out.state).toBe('suspended');
        f.doc.visibilityState = 'visible';
        f.fire('visibilitychange');
        expect(out.state).toBe('running');
        // the browser suspended it (iOS `interrupted`): the next tap brings it back
        f.contexts[0].state = 'interrupted';
        f.fire('pointerdown');
        expect(f.contexts[0].state).toBe('running');
    });

    it('decode waits for the unlock, and takes Safari\'s callback-only form too', async () => {
        const f = fakeAudio({ callbackDecodeOnly: true });
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen, mediaWorkaround: false });
        const pending = out.decode(new ArrayBuffer(7));
        out.unlock();
        expect(await pending).toEqual({ decoded: 7 });
    });

    it('play: gain and pan nodes, start at `when`; volume and mute set the master gain (squared)', () => {
        const f = fakeAudio();
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen, mediaWorkaround: false });
        out.unlock();
        const h = out.play('BUF', { when: 2.25, gain: 0.5, pan: -0.5 });
        expect(h.gainNode.gain.value).toBe(0.5);
        expect(f.log.filter(([k]) => k === 'start').pop()).toEqual(['start', 'BUF', 2.25]);
        h.stop();
        expect(f.log.pop()).toEqual(['stop', 'BUF']);
        expect(volumeToGain(0.5)).toBe(0.25);
        expect(volumeToGain(2)).toBe(1);
        expect(volumeToGain(Number.NaN)).toBe(0);
        expect(silentWavDataUrl()).toMatch(/^data:audio\/wav;base64,/);
    });

    it('⛓ MUSIC — BUSES: a named bus is a gain under the master with its own volume/mute, settable before the unlock', () => {
        const f = fakeAudio();
        const out = createAudioOut({ win: f.win, AudioContextCtor: f.Ctx, listen: f.listen, mediaWorkaround: false });
        out.setBusVolume('music', 0.5);
        out.setBusMuted('music', true);
        expect(out.busState('music')).toEqual({ volume: 0.5, muted: true, made: false });
        expect(out.play('BUF', { bus: 'music' })).toBeNull(); // still locked
        out.unlock();
        const h = out.play('BUF', { bus: 'music', offset: 3.5, when: 2 });
        expect(out.busState('music').made).toBe(true);
        expect(f.log.filter(([k]) => k === 'start').pop()).toEqual(['start', 'BUF', 2]);
        // the bus node's gain follows its own settings, not the master's
        out.setBusMuted('music', false);
        out.setVolume(0.2);
        expect(out.busState('music')).toEqual({ volume: 0.5, muted: false, made: true });
        h.setGain(0.3);
        expect(h.gainNode.gain.value).toBe(0.3);
        // an unnamed play still goes straight to the master; the sfx bus is independent of the music one
        expect(out.play('B2')).not.toBeNull();
        out.setBusMuted('sfx', true);
        expect(out.busState('music').muted).toBe(false);
    });
});
