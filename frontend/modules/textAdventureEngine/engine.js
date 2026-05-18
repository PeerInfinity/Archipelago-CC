/**
 * TextAdventureEngine — a synthetic, Archipelago-naive text adventure
 * renderer + command parser. Designed to be drivable both standalone
 * (loads bundled sample worlds, auto-mutates state) and from a wrapper
 * (managed mode: emits events, wrapper drives state).
 *
 * See NewDocs/plans/procedural-generation/textadventure-engine-spec.md
 * for the contract.
 */

const DEFAULT_OPTIONS = Object.freeze({
    managed: false,
    discoveryMode: 'full',     // 'full' | 'discovered'
    messageHistoryLimit: 10,
    dataPath: './data',         // relative path to manifest.json + world files
});

export class TextAdventureEngine {
    constructor(container, options = {}) {
        if (!container || !(container instanceof HTMLElement)) {
            throw new Error('TextAdventureEngine: container must be an HTMLElement');
        }
        this.container = container;
        this.options = { ...DEFAULT_OPTIONS, ...options };

        this.world = null;
        this.state = {
            currentRoomId: null,
            rooms: {},      // {[roomId]: {discovered: bool}}
            items: {},      // {[roomId]: {[itemId]: {discovered, collected, accessible}}}
            exits: {},      // {[roomId]: {[exitId]: {accessible}}}
            inventory: {},  // {[invItemId]: {count, label}}
        };
        this.messages = [];
        this.listeners = {};
        this._batchDepth = 0;
        this._renderQueued = false;

        this._manifest = null;
        this._buildDOM();
        this._wireInput();
        this._showInitialView();
    }

    // ─── public: world loading ─────────────────────────────────────

    loadWorld(world) {
        if (!world || typeof world !== 'object' || !world.rooms || !world.startRoomId) {
            throw new Error('TextAdventureEngine.loadWorld: world must have rooms and startRoomId');
        }
        this.world = world;
        this.state = {
            currentRoomId: null,
            rooms: {},
            items: {},
            exits: {},
            inventory: {},
        };
        for (const roomId of Object.keys(world.rooms)) {
            this.state.rooms[roomId] = { discovered: false };
            this.state.items[roomId] = {};
            this.state.exits[roomId] = {};
            const room = world.rooms[roomId];
            for (const item of (room.items || [])) {
                this.state.items[roomId][item.id] = { discovered: false, collected: false, accessible: true };
            }
            for (const exit of (room.exits || [])) {
                this.state.exits[roomId][exit.id] = { accessible: true };
            }
        }
        this.messages = [];
        this._hidePicker();
        this.setCurrentRoom(world.startRoomId);
    }

    async loadDefaultWorld(name) {
        await this._ensureManifest();
        if (!this._manifest || !this._manifest.worlds || this._manifest.worlds.length === 0) {
            throw new Error('TextAdventureEngine: no worlds found in manifest');
        }
        const entry = name
            ? this._manifest.worlds.find(w => w.name === name)
            : this._manifest.worlds[0];
        if (!entry) {
            throw new Error(`TextAdventureEngine: no world named '${name}' in manifest`);
        }
        const resp = await fetch(`${this.options.dataPath}/${entry.file}`);
        if (!resp.ok) {
            throw new Error(`TextAdventureEngine: failed to load ${entry.file}: ${resp.status}`);
        }
        this.loadWorld(await resp.json());
    }

    async getAvailableDefaultWorlds() {
        await this._ensureManifest();
        return this._manifest?.worlds ?? [];
    }

    async _ensureManifest() {
        if (this._manifest) return;
        try {
            const resp = await fetch(`${this.options.dataPath}/manifest.json`);
            if (resp.ok) {
                this._manifest = await resp.json();
            } else {
                this._manifest = { worlds: [] };
            }
        } catch {
            this._manifest = { worlds: [] };
        }
    }

    // ─── public: state mutation ────────────────────────────────────

    setCurrentRoom(roomId) {
        if (!this.world?.rooms[roomId]) {
            this._queueMessage(`Cannot move to unknown room '${roomId}'.`, 'error');
            this._queueRender();
            return;
        }
        this.state.currentRoomId = roomId;
        this.state.rooms[roomId].discovered = true;
        this._queueRender();
    }

    setRoomDiscovered(roomId, value) {
        if (this.state.rooms[roomId]) {
            this.state.rooms[roomId].discovered = !!value;
            this._queueRender();
        }
    }

    setItemDiscovered(roomId, itemId, value) {
        const slot = this.state.items[roomId]?.[itemId];
        if (slot) { slot.discovered = !!value; this._queueRender(); }
    }

    setItemCollected(roomId, itemId, value) {
        const slot = this.state.items[roomId]?.[itemId];
        if (slot) { slot.collected = !!value; this._queueRender(); }
    }

    setItemAccessible(roomId, itemId, value) {
        const slot = this.state.items[roomId]?.[itemId];
        if (slot) { slot.accessible = !!value; this._queueRender(); }
    }

    setExitAccessible(roomId, exitId, value) {
        const slot = this.state.exits[roomId]?.[exitId];
        if (slot) { slot.accessible = !!value; this._queueRender(); }
    }

    setInventory(items) {
        this.state.inventory = {};
        for (const [id, entry] of Object.entries(items || {})) {
            this.state.inventory[id] = { count: entry.count ?? 1, label: entry.label ?? id };
        }
        this._queueRender();
    }

    addInventoryItem(itemId, label, count = 1) {
        const existing = this.state.inventory[itemId];
        if (existing) {
            existing.count += count;
        } else {
            this.state.inventory[itemId] = { count, label: label ?? itemId };
        }
        this._queueRender();
    }

    removeInventoryItem(itemId, count = 1) {
        const existing = this.state.inventory[itemId];
        if (!existing) return;
        existing.count -= count;
        if (existing.count <= 0) delete this.state.inventory[itemId];
        this._queueRender();
    }

    displayMessage(text, kind = 'normal') {
        this._queueMessage(text, kind);
        this._queueRender();
    }

    batchUpdate(fn) {
        this._batchDepth++;
        try {
            fn();
        } finally {
            this._batchDepth--;
            if (this._batchDepth === 0 && this._renderQueued) {
                this._renderQueued = false;
                this._render();
            }
        }
    }

    // ─── public: programmatic triggers ─────────────────────────────

    triggerExit(roomId, exitId, opts = {}) {
        const exit = this.world?.rooms[roomId]?.exits.find(e => e.id === exitId);
        if (!exit) {
            this.displayMessage(`No exit '${exitId}' in room '${roomId}'.`, 'error');
            return;
        }
        const accessible = this.state.exits[roomId]?.[exitId]?.accessible ?? true;
        if (!accessible && !opts.ignoreAccessibility) {
            this.displayMessage(`You can't go that way: ${exit.label}.`, 'error');
            return;
        }
        this._emit('command:move', { fromRoomId: roomId, exitId, targetRoomId: exit.targetRoomId });
        if (!this.options.managed) {
            this.setCurrentRoom(exit.targetRoomId);
        }
    }

    triggerExamineItem(roomId, itemId, opts = {}) {
        const item = this.world?.rooms[roomId]?.items.find(i => i.id === itemId);
        if (!item) {
            this.displayMessage(`No item '${itemId}' in room '${roomId}'.`, 'error');
            return;
        }
        const slot = this.state.items[roomId]?.[itemId];
        if (!(slot?.accessible ?? true) && !opts.ignoreAccessibility) {
            this.displayMessage(`You can't interact with that: ${item.label}.`, 'error');
            return;
        }
        if (slot?.collected) {
            this.displayMessage(`${item.label}: already examined.`, 'system');
            return;
        }
        this._emit('command:examine', { roomId, itemId });
        this.batchUpdate(() => {
            this.displayMessage(item.description || item.label, 'normal');
            if (!this.options.managed) {
                this.setItemDiscovered(roomId, itemId, true);
                this.setItemCollected(roomId, itemId, true);
            }
        });
    }

    simulateCommand(rawText, opts = {}) {
        this._handleCommand(rawText, opts);
    }

    // ─── public: lifecycle ─────────────────────────────────────────

    focus() {
        this._input?.focus();
    }

    destroy() {
        this.container.innerHTML = '';
        this.listeners = {};
        this.world = null;
    }

    // ─── public: events ────────────────────────────────────────────

    on(event, callback) {
        (this.listeners[event] = this.listeners[event] || []).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const arr = this.listeners[event];
        if (!arr) return;
        const i = arr.indexOf(callback);
        if (i >= 0) arr.splice(i, 1);
    }

    _emit(event, payload) {
        for (const cb of (this.listeners[event] || [])) {
            try { cb(payload); } catch (e) { console.error(`[engine] listener for ${event} threw:`, e); }
        }
    }

    // ─── command parsing ───────────────────────────────────────────

    _handleCommand(rawText, opts = {}) {
        const text = (rawText || '').trim();
        if (!text) return;

        const lower = text.toLowerCase();
        const room = this.world?.rooms[this.state.currentRoomId];
        if (!room) {
            this._emit('command:custom', { rawCommand: text });
            return;
        }

        // help
        if (lower === 'help' || lower === '?') {
            this.displayMessage(
                'Commands:\n' +
                '  go <exit> / move <exit>   — travel through an exit\n' +
                '  examine <item> / look <item>  — examine an item\n' +
                '  look                       — describe current room\n' +
                '  inventory / inv            — list inventory (shown in sidebar)\n' +
                '  help                       — this text',
                'system'
            );
            return;
        }

        // look (re-describe room)
        if (lower === 'look' || lower === 'l') {
            this._describeRoom(room, { force: true });
            return;
        }

        // inventory
        if (lower === 'inventory' || lower === 'inv' || lower === 'i') {
            const ids = Object.keys(this.state.inventory);
            if (ids.length === 0) {
                this.displayMessage('Your inventory is empty.', 'system');
            } else {
                const lines = ids.map(id => {
                    const { count, label } = this.state.inventory[id];
                    return count > 1 ? `  ${label} ×${count}` : `  ${label}`;
                });
                this.displayMessage('Inventory:\n' + lines.join('\n'), 'system');
            }
            return;
        }

        // move / go
        const moveMatch = lower.match(/^(?:go|move)\s+(.+)$/);
        if (moveMatch) {
            const target = moveMatch[1].trim();
            const exit = this._findExit(room, target);
            if (!exit) {
                this.displayMessage(`No such exit: '${target}'.`, 'error');
                return;
            }
            this.triggerExit(room.id, exit.id, opts);
            return;
        }

        // examine / look at / check
        const examMatch = lower.match(/^(?:examine|look at|check|inspect)\s+(.+)$/);
        if (examMatch) {
            const target = examMatch[1].trim();
            const item = this._findItem(room, target);
            if (!item) {
                this.displayMessage(`No such item: '${target}'.`, 'error');
                return;
            }
            this.triggerExamineItem(room.id, item.id, opts);
            return;
        }

        // unknown — emit and surface
        this._emit('command:custom', { rawCommand: text });
        if (!this.options.managed) {
            this.displayMessage(`I don't understand: '${text}'. Type 'help' for commands.`, 'error');
        }
    }

    _findExit(room, target) {
        const t = target.toLowerCase();
        // exact id, exact label-prefix, then partial label match
        return room.exits.find(e => e.id.toLowerCase() === t)
            || room.exits.find(e => e.label.toLowerCase().startsWith(t))
            || room.exits.find(e => e.label.toLowerCase().includes(t));
    }

    _findItem(room, target) {
        const t = target.toLowerCase();
        return room.items.find(i => i.id.toLowerCase() === t)
            || room.items.find(i => i.label.toLowerCase().startsWith(t))
            || room.items.find(i => i.label.toLowerCase().includes(t));
    }

    // ─── DOM construction ──────────────────────────────────────────

    _buildDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('tae-root');

        this._mainEl = document.createElement('div');
        this._mainEl.className = 'tae-main';
        this.container.appendChild(this._mainEl);

        this._displayEl = document.createElement('div');
        this._displayEl.className = 'tae-display';
        this._mainEl.appendChild(this._displayEl);

        this._sidebarEl = document.createElement('div');
        this._sidebarEl.className = 'tae-sidebar';
        this._sidebarEl.innerHTML = '<div class="tae-sidebar-title">Inventory</div><div class="tae-inventory-list"></div>';
        this._inventoryListEl = this._sidebarEl.querySelector('.tae-inventory-list');
        this._mainEl.appendChild(this._sidebarEl);

        const inputRow = document.createElement('div');
        inputRow.className = 'tae-input-row';
        this._input = document.createElement('input');
        this._input.type = 'text';
        this._input.className = 'tae-input';
        this._input.placeholder = 'Type a command (try: help)';
        inputRow.appendChild(this._input);
        this.container.appendChild(inputRow);

        this._pickerEl = document.createElement('div');
        this._pickerEl.className = 'tae-picker hidden';
        this.container.appendChild(this._pickerEl);
    }

    _wireInput() {
        this._displayEl.addEventListener('click', (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            const roomId = t.dataset.roomId;
            if (t.dataset.exitId) {
                this.triggerExit(roomId, t.dataset.exitId);
                this.focus();
            } else if (t.dataset.itemId) {
                this.triggerExamineItem(roomId, t.dataset.itemId);
                this.focus();
            }
        });
        this._input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const text = this._input.value;
            this._input.value = '';
            this.batchUpdate(() => {
                this._queueMessage(`> ${text}`, 'user-input');
                this._handleCommand(text);
            });
        });
    }

    async _showInitialView() {
        if (this.world) {
            this._render();
            return;
        }
        if (this.options.managed) {
            this._displayEl.innerHTML = '<div class="tae-placeholder">Waiting for world…</div>';
            return;
        }
        // Standalone with no world: show picker.
        await this._showPicker();
    }

    async _showPicker() {
        await this._ensureManifest();
        this._pickerEl.classList.remove('hidden');
        const worlds = this._manifest?.worlds ?? [];
        this._pickerEl.innerHTML = '';

        const heading = document.createElement('div');
        heading.className = 'tae-picker-heading';
        heading.textContent = 'Select a world';
        this._pickerEl.appendChild(heading);

        if (worlds.length === 0) {
            const warn = document.createElement('div');
            warn.className = 'tae-picker-warn';
            warn.textContent = 'No worlds found in manifest.json.';
            this._pickerEl.appendChild(warn);
        }

        for (const w of worlds) {
            const btn = document.createElement('button');
            btn.className = 'tae-picker-preset';
            btn.innerHTML = `<div class="tae-picker-title">${escapeHtml(w.title || w.name)}</div>
                             <div class="tae-picker-desc">${escapeHtml(w.description || '')}</div>`;
            btn.addEventListener('click', () => {
                this.loadDefaultWorld(w.name).catch(err => {
                    this.displayMessage(`Failed to load: ${err.message}`, 'error');
                });
            });
            this._pickerEl.appendChild(btn);
        }

        const fileLabel = document.createElement('label');
        fileLabel.className = 'tae-picker-file';
        fileLabel.textContent = 'or load a world from a JSON file: ';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json,.json';
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                this.loadWorld(JSON.parse(text));
            } catch (err) {
                this.displayMessage(`Failed to parse file: ${err.message}`, 'error');
            }
        });
        fileLabel.appendChild(fileInput);
        this._pickerEl.appendChild(fileLabel);
    }

    _hidePicker() {
        this._pickerEl?.classList.add('hidden');
    }

    // ─── rendering ─────────────────────────────────────────────────

    _queueMessage(text, kind = 'normal') {
        this.messages.push({ text, kind });
        const limit = this.options.messageHistoryLimit;
        if (this.messages.length > limit) {
            this.messages = this.messages.slice(-limit);
        }
    }

    _queueRender() {
        if (this._batchDepth > 0) {
            this._renderQueued = true;
            return;
        }
        this._render();
    }

    _render() {
        if (!this.world || !this.state.currentRoomId) {
            this._displayEl.innerHTML = '<div class="tae-placeholder">No world loaded.</div>';
            this._renderInventory();
            return;
        }
        const room = this.world.rooms[this.state.currentRoomId];
        if (!room) {
            this._displayEl.innerHTML = `<div class="tae-error">Unknown room: ${this.state.currentRoomId}</div>`;
            return;
        }

        // Add room-description on first render of each new room.
        // Detect by comparing rendered room id to current.
        if (this._lastRenderedRoomId !== this.state.currentRoomId) {
            this._describeRoom(room, { force: false });
            this._lastRenderedRoomId = this.state.currentRoomId;
        }

        // Build the room view: messages history + exits + items
        const html = [];
        for (const m of this.messages) {
            html.push(`<div class="tae-msg tae-msg-${m.kind}">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>`);
        }

        // Always show clickable exits + items panel at the bottom of the display
        html.push('<div class="tae-actions">');
        html.push(`<div class="tae-actions-title">${escapeHtml(room.title)}</div>`);

        // Exits
        const exitItems = (room.exits || []).map(exit => this._renderExit(room.id, exit)).filter(Boolean);
        if (exitItems.length > 0) {
            html.push('<div class="tae-actions-label">Exits:</div>');
            html.push('<div class="tae-actions-list">' + exitItems.join(' · ') + '</div>');
        }

        // Items
        const itemEls = (room.items || []).map(item => this._renderItem(room.id, item)).filter(Boolean);
        if (itemEls.length > 0) {
            html.push('<div class="tae-actions-label">Items:</div>');
            html.push('<div class="tae-actions-list">' + itemEls.join(' · ') + '</div>');
        }

        html.push('</div>');

        this._displayEl.innerHTML = html.join('');
        this._displayEl.scrollTop = this._displayEl.scrollHeight;
        this._renderInventory();
    }

    _describeRoom(room, { force }) {
        // Push the room description into the message log when entering.
        this._queueMessage(room.description || `You are in ${room.title}.`, 'normal');
    }

    _renderExit(roomId, exit) {
        const accessible = this.state.exits[roomId]?.[exit.id]?.accessible ?? true;
        const targetRoom = this.world.rooms[exit.targetRoomId];
        const targetDiscovered = this.state.rooms[exit.targetRoomId]?.discovered ?? false;
        const discoveryMode = this.options.discoveryMode;

        let label = exit.label;
        if (discoveryMode === 'discovered' && !targetDiscovered) {
            label = 'an unfamiliar passage';
        }

        const cls = ['tae-link', 'tae-link-exit'];
        cls.push(accessible ? 'tae-link-accessible' : 'tae-link-inaccessible');
        return `<span class="${cls.join(' ')}" data-room-id="${escapeHtml(roomId)}" data-exit-id="${escapeHtml(exit.id)}">${escapeHtml(label)}</span>`;
    }

    _renderItem(roomId, item) {
        const slot = this.state.items[roomId]?.[item.id];
        if (!slot) return null;
        if (this.options.discoveryMode === 'discovered' && !slot.discovered && !slot.collected) {
            return null; // hidden until discovered
        }
        const cls = ['tae-link', 'tae-link-item'];
        if (slot.collected) cls.push('tae-link-collected');
        else if (!slot.accessible) cls.push('tae-link-inaccessible');
        else cls.push('tae-link-accessible');
        return `<span class="${cls.join(' ')}" data-room-id="${escapeHtml(roomId)}" data-item-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</span>`;
    }

    _renderInventory() {
        if (!this._inventoryListEl) return;
        const ids = Object.keys(this.state.inventory);
        if (ids.length === 0) {
            this._inventoryListEl.innerHTML = '<div class="tae-inventory-empty">(empty)</div>';
            return;
        }
        this._inventoryListEl.innerHTML = ids.map(id => {
            const { count, label } = this.state.inventory[id];
            const countTxt = count > 1 ? ` <span class="tae-inventory-count">×${count}</span>` : '';
            return `<div class="tae-inventory-item">${escapeHtml(label)}${countTxt}</div>`;
        }).join('');
    }
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
