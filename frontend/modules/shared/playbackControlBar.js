/**
 * Playback control bar — substrate-neutral DOM widget exposing
 * instant / step / play / stop buttons plus a speed slider.
 * Mounted inside whatever panel uses it (the maze panel during
 * Phase 3, the presets-panel procgen-data section during Phase 5).
 *
 * Pure DOM; no Golden Layout integration of its own. Caller
 * wires button events into a controller object via the
 * `actions` argument:
 *
 *   const bar = new PlaybackControlBar({
 *     actions: {
 *       instant: () => visualizer.runToCompletion(),
 *       step:    () => visualizer.stepOnce(),
 *       play:    (rateHz) => visualizer.play(rateHz),
 *       stop:    () => visualizer.stop(),
 *       setRate: (rateHz) => visualizer.setRate(rateHz),
 *     },
 *     initialRate: 4,
 *   });
 *   container.appendChild(bar.getElement());
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 1.3)
 */

const DEFAULT_RATE_HZ = 4;
const MIN_RATE_HZ = 0.5;
const MAX_RATE_HZ = 30;

export class PlaybackControlBar {
    constructor({ actions = {}, initialRate = DEFAULT_RATE_HZ, label = 'Playback' } = {}) {
        this._actions = actions;
        this._rate = clampRate(initialRate);
        this._running = false;
        this._destroyed = false;
        this._listeners = [];
        this._element = null;
        this._buttons = {};
        this._rateSlider = null;
        this._rateInput = null;
        this._statusLabel = null;
        this._mount(label);
    }

    getElement() {
        return this._element;
    }

    setRunning(running) {
        this._running = !!running;
        this._reflectRunningState();
    }

    isRunning() { return this._running; }

    setRate(rateHz) {
        const r = clampRate(rateHz);
        this._rate = r;
        if (this._rateSlider) this._rateSlider.value = String(r);
        if (this._rateInput) this._rateInput.value = String(r);
    }

    getRate() { return this._rate; }

    setStatus(text) {
        if (this._statusLabel) this._statusLabel.textContent = text ?? '';
    }

    destroy() {
        for (const off of this._listeners) off();
        this._listeners.length = 0;
        if (this._element && this._element.parentNode) {
            this._element.parentNode.removeChild(this._element);
        }
        this._element = null;
        this._destroyed = true;
    }

    // --- internal ---

    _mount(label) {
        if (typeof document === 'undefined') {
            // Headless test mode — skip DOM construction.
            return;
        }
        const root = document.createElement('div');
        root.className = 'playback-control-bar';

        const heading = document.createElement('div');
        heading.className = 'playback-control-bar-label';
        heading.textContent = label;
        root.appendChild(heading);

        const buttonsRow = document.createElement('div');
        buttonsRow.className = 'playback-control-bar-buttons';

        this._buttons.instant = makeButton('Instant', '⏭', () => {
            this._call('instant');
        });
        this._buttons.step = makeButton('Step', '⏯', () => {
            this._call('step');
        });
        this._buttons.play = makeButton('Play', '▶', () => {
            this._call('play', this._rate);
        });
        this._buttons.stop = makeButton('Stop', '⏹', () => {
            this._call('stop');
        });

        for (const key of ['instant', 'step', 'play', 'stop']) {
            buttonsRow.appendChild(this._buttons[key]);
            this._listeners.push(() => {
                this._buttons[key].onclick = null;
            });
        }
        root.appendChild(buttonsRow);

        const rateRow = document.createElement('div');
        rateRow.className = 'playback-control-bar-rate';

        const rateLabel = document.createElement('label');
        rateLabel.textContent = 'Speed';
        rateLabel.className = 'playback-control-bar-rate-label';
        rateRow.appendChild(rateLabel);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(MIN_RATE_HZ);
        slider.max = String(MAX_RATE_HZ);
        slider.step = '0.5';
        slider.value = String(this._rate);
        slider.className = 'playback-control-bar-rate-slider';

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.min = String(MIN_RATE_HZ);
        numberInput.max = String(MAX_RATE_HZ);
        numberInput.step = '0.5';
        numberInput.value = String(this._rate);
        numberInput.className = 'playback-control-bar-rate-input';

        const unitLabel = document.createElement('span');
        unitLabel.textContent = 'Hz';
        unitLabel.className = 'playback-control-bar-rate-unit';

        const sliderHandler = () => {
            const next = clampRate(slider.value);
            this._rate = next;
            numberInput.value = String(next);
            this._call('setRate', next);
        };
        const inputHandler = () => {
            const next = clampRate(numberInput.value);
            this._rate = next;
            slider.value = String(next);
            numberInput.value = String(next);
            this._call('setRate', next);
        };
        slider.addEventListener('input', sliderHandler);
        numberInput.addEventListener('change', inputHandler);
        this._listeners.push(() => slider.removeEventListener('input', sliderHandler));
        this._listeners.push(() => numberInput.removeEventListener('change', inputHandler));

        rateRow.appendChild(slider);
        rateRow.appendChild(numberInput);
        rateRow.appendChild(unitLabel);
        root.appendChild(rateRow);

        const statusLabel = document.createElement('div');
        statusLabel.className = 'playback-control-bar-status';
        root.appendChild(statusLabel);

        this._element = root;
        this._rateSlider = slider;
        this._rateInput = numberInput;
        this._statusLabel = statusLabel;
        this._reflectRunningState();
    }

    _reflectRunningState() {
        if (!this._buttons.play || !this._buttons.stop) return;
        if (this._running) {
            this._buttons.play.disabled = true;
            this._buttons.stop.disabled = false;
            if (this._element) this._element.classList.add('is-running');
        } else {
            this._buttons.play.disabled = false;
            this._buttons.stop.disabled = true;
            if (this._element) this._element.classList.remove('is-running');
        }
    }

    _call(name, ...args) {
        const fn = this._actions[name];
        if (typeof fn === 'function') fn(...args);
    }
}

function clampRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n)) return DEFAULT_RATE_HZ;
    if (n < MIN_RATE_HZ) return MIN_RATE_HZ;
    if (n > MAX_RATE_HZ) return MAX_RATE_HZ;
    return n;
}

function makeButton(title, glyph, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.textContent = glyph;
    btn.className = `playback-control-bar-button playback-control-bar-button-${title.toLowerCase()}`;
    btn.onclick = onClick;
    return btn;
}
