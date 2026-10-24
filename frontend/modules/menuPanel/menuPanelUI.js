/**
 * menuPanelUI — the panel. DOM only; every decision it renders comes from
 * `menuPanelEngine.describeMenu` and every action it takes is a call into
 * `menuPanel/index.js`.
 *
 * What it shows (all of it derived from the loaded rules.json, per the user's
 * ruling that anything game-specific be sourced from the document):
 *   - the game name and seed (`game_name` / `seed_name`);
 *   - the declared start region(s) (`start_regions[<player>].default`, read
 *     through `procgenCore/rulesGraph.startRegionsOf`);
 *   - ONE BUTTON PER EXIT of the start region the player is standing in
 *     (`regions[<player>][start].exits[]`, labelled by the exit's own name) —
 *     alttp's three Save-and-Quit warps ARE that region's three exits, so
 *     "one button per exit" is also the multi-start UI, with no special case;
 *   - one line of instructions (no links: the help module does not exist yet);
 *   - the player's current position;
 *   - the "Skip the menu" checkbox.
 *
 * ⛔ Nothing here branches on the name "Menu". `content.atStartRegion` is
 * `gameState.isStartRegion(currentRegion)` in the engine's terms.
 */

import {
    getMenuContent,
    getModuleEventBus,
    isSkipMenuEnabled,
    setSkipMenuEnabled,
    takeExit,
    restart,
} from './index.js';

function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level]('menuPanelUI', message, ...data);
    } else {
        const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
        consoleMethod(`[menuPanelUI] ${message}`, ...data);
    }
}

export class MenuPanelUI {
    /**
     * @param {object} container GoldenLayout container
     * @param {object} componentState
     * @param {string} [componentType]
     */
    constructor(container, componentState, componentType) {
        this.container = container;
        this.componentState = componentState;
        this.componentType = componentType;
        this.eventBus = getModuleEventBus();

        this.rootElement = document.createElement('div');
        this.rootElement.classList.add('menu-panel-container', 'panel-container');

        // ⛔ No self-append: the GoldenLayout factory appends getRootElement()
        // itself after validating the class (a second append would double-mount).

        this._subscriptions = [];
        this._subscribe('stateManager:rawJsonDataLoaded', () => this.render());
        this._subscribe('stateManager:rulesLoaded', () => this.render());
        this._subscribe('gameState:regionChanged', () => this.render());
        this._subscribe('gameState:pathUpdated', () => this.render());

        this.container?.on?.('destroy', () => this._onDestroy());

        this.render();
        log('info', 'MenuPanelUI constructed');
    }

    getRootElement() {
        return this.rootElement;
    }

    _subscribe(eventName, handler) {
        const unsub = this.eventBus?.subscribe?.(eventName, handler);
        this._subscriptions.push(
            typeof unsub === 'function'
                ? unsub
                : () => this.eventBus?.unsubscribe?.(eventName, handler),
        );
    }

    _onDestroy() {
        for (const unsub of this._subscriptions) {
            try { unsub(); } catch (error) { log('warn', 'unsubscribe failed', error); }
        }
        this._subscriptions = [];
    }

    /**
     * Rebuild the panel from the current document + position.
     *
     * Rendered wholesale rather than patched: the panel is small, and every
     * element in it (which exits exist, whether they are shown at all) is a
     * function of the same two inputs.
     */
    render() {
        const root = this.rootElement;
        root.replaceChildren();

        const content = getMenuContent();
        if (!content) {
            const empty = document.createElement('p');
            empty.className = 'menu-panel-empty';
            empty.textContent = 'No game loaded.';
            root.appendChild(empty);
            root.appendChild(this._buildSkipRow());
            return;
        }

        const header = document.createElement('div');
        header.className = 'menu-panel-header';
        const title = document.createElement('h3');
        title.className = 'menu-panel-title';
        title.textContent = content.gameName ?? 'Unnamed game';
        header.appendChild(title);
        if (content.seedName) {
            const seed = document.createElement('div');
            seed.className = 'menu-panel-seed';
            seed.textContent = `Seed ${content.seedName}`;
            header.appendChild(seed);
        }
        root.appendChild(header);

        const instructions = document.createElement('p');
        instructions.className = 'menu-panel-instructions';
        instructions.textContent = content.atStartRegion
            ? 'Choose where to begin — each button takes one exit out of the start region.'
            : 'Restart to return to the start region and choose again.';
        root.appendChild(instructions);

        root.appendChild(this._buildExits(content));
        root.appendChild(this._buildPosition(content));
        root.appendChild(this._buildControls());
        root.appendChild(this._buildSkipRow());
    }

    _buildExits(content) {
        const wrap = document.createElement('div');
        wrap.className = 'menu-panel-exits';

        if (!content.atStartRegion) {
            const note = document.createElement('p');
            note.className = 'menu-panel-note';
            note.textContent = content.startRegions.length
                ? `Start region: ${content.startRegions.join(', ')}`
                : 'This game declares no start region.';
            wrap.appendChild(note);
            return wrap;
        }

        if (content.exits.length === 0) {
            const note = document.createElement('p');
            note.className = 'menu-panel-note';
            note.textContent = `'${content.currentRegion}' has no exits to take.`;
            wrap.appendChild(note);
            return wrap;
        }

        for (const exit of content.exits) {
            const button = document.createElement('button');
            button.className = 'button menu-panel-exit-button';
            // The exit's own name is the label; the destination is the subtitle.
            // A world that leaves an exit unnamed falls back to the destination.
            button.textContent = exit.name ?? exit.targetRegion;
            button.title = `Move to ${exit.targetRegion}`;
            button.dataset.targetRegion = exit.targetRegion;
            if (exit.name) button.dataset.exitName = exit.name;
            button.addEventListener('click', () => {
                takeExit(exit);
            });
            wrap.appendChild(button);
        }
        return wrap;
    }

    _buildPosition(content) {
        const el = document.createElement('div');
        el.className = 'menu-panel-position';
        el.textContent = content.currentRegion
            ? `You are in: ${content.currentRegion}`
            : 'Position unknown.';
        return el;
    }

    _buildControls() {
        const wrap = document.createElement('div');
        wrap.className = 'menu-panel-controls';

        const restartButton = document.createElement('button');
        restartButton.className = 'button menu-panel-restart-button';
        restartButton.id = 'menu-panel-restart';
        restartButton.textContent = 'Restart';
        restartButton.title = 'Clear the path and return to the start region';
        restartButton.addEventListener('click', () => {
            restart();
            this.render();
        });
        wrap.appendChild(restartButton);
        return wrap;
    }

    _buildSkipRow() {
        const label = document.createElement('label');
        label.className = 'menu-panel-skip';

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'menu-panel-skip-menu';
        box.checked = isSkipMenuEnabled();
        box.addEventListener('change', () => {
            setSkipMenuEnabled(box.checked);
        });

        const text = document.createElement('span');
        text.textContent = 'Skip the menu';

        label.appendChild(box);
        label.appendChild(text);
        label.title = 'When on, loading a game takes the start region’s first exit automatically.';
        return label;
    }
}
