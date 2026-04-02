/**
 * APCalc — Calculator panel UI
 *
 * Calculator with button-press tracking, discovered paths list,
 * and remaining-buttons sidebar.
 */

import { setPanelInstance, getModuleApis } from './index.js';

export class APCalcUI {
    static moduleApis = null;
    static setModuleApis(apis) { APCalcUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.apis = APCalcUI.moduleApis || getModuleApis();
        this.showRemainingList = true;
        this.pathFilter = null; // region name to filter paths by
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'apcalc-panel';
        this.rootElement.innerHTML = '<div class="apcalc-empty">Waiting for game data...</div>';
        setPanelInstance(this);
    }

    getRootElement() { return this.rootElement; }
    destroy() { setPanelInstance(null); }
    onPanelShow() { this.render(); }
    onPanelResize() {}
    get gameState() { return this.apis?.getGameState?.(); }

    render() {
        const gs = this.gameState;
        if (!this.rootElement) return;
        this.rootElement.innerHTML = '';
        this.rootElement.className = 'apcalc-panel';
        if (!gs) {
            this.rootElement.innerHTML = '<div class="apcalc-empty">Waiting for game data...</div>';
            return;
        }

        // Main layout: calculator + sidebar
        const main = document.createElement('div');
        main.className = 'apcalc-main';

        main.appendChild(this._renderCalculator(gs));
        if (this.showRemainingList) {
            main.appendChild(this._renderRemainingButtons(gs));
        }
        this.rootElement.appendChild(main);

        // Status bar
        this.rootElement.appendChild(this._renderStatus(gs));

        // Discovered paths
        this.rootElement.appendChild(this._renderPaths(gs));
    }

    _renderCalculator(gs) {
        const calc = document.createElement('div');
        calc.className = 'apcalc-calculator';

        // Display
        const display = document.createElement('div');
        display.className = 'apcalc-display';
        const opIndicator = gs.getPendingOpText();
        const displayText = gs.getDisplayText();
        const nodeLabel = gs.currentNode || 'Start';
        display.innerHTML = `
            <div class="apcalc-display-node">${this._esc(nodeLabel)}</div>
            <div class="apcalc-display-value">
                <span class="apcalc-display-op">${this._esc(opIndicator)}</span>
                ${this._esc(displayText) || '&nbsp;'}
            </div>
        `;
        calc.appendChild(display);

        // Number pad
        const pad = document.createElement('div');
        pad.className = 'apcalc-pad';

        // Row 1: 7 8 9
        // Row 2: 4 5 6
        // Row 3: 1 2 3
        // Row 4: 0 = C
        const numRows = [[7, 8, 9], [4, 5, 6], [1, 2, 3], [0, '=', 'C']];
        for (const row of numRows) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'apcalc-row';
            for (const key of row) {
                const btn = this._makeButton(gs, key);
                rowDiv.appendChild(btn);
            }
            pad.appendChild(rowDiv);
        }

        // Operation column
        const ops = document.createElement('div');
        ops.className = 'apcalc-ops';
        for (const op of gs.operations) {
            ops.appendChild(this._makeButton(gs, op));
        }

        const calcBody = document.createElement('div');
        calcBody.className = 'apcalc-calc-body';
        calcBody.appendChild(pad);
        calcBody.appendChild(ops);
        calc.appendChild(calcBody);

        return calc;
    }

    _makeButton(gs, key) {
        const btn = document.createElement('button');
        const label = String(key);
        btn.className = 'apcalc-btn';
        btn.textContent = label;

        if (key === '=' || key === 'C') {
            btn.classList.add(`apcalc-btn-${key === '=' ? 'eq' : 'clear'}`);
            btn.addEventListener('click', () => {
                if (key === '=') {
                    const result = gs.pressEquals();
                    if (result && !result.moved && result.success) {
                        // Flash display to show the computed value briefly
                        this._flashResult(result.value);
                    }
                } else {
                    gs.reset();
                }
                this.render();
            });
        } else if (gs.operations.includes(label)) {
            const remaining = gs.remainingPresses[label] || 0;
            btn.dataset.remaining = remaining;
            if (remaining <= 0) btn.classList.add('apcalc-btn-disabled');
            btn.addEventListener('click', () => {
                if (gs.pressOperation(label)) this.render();
            });
        } else {
            // Number button
            const num = Number(key);
            const remaining = gs.remainingPresses[label] || 0;
            btn.dataset.remaining = remaining;
            if (remaining <= 0) btn.classList.add('apcalc-btn-disabled');
            btn.addEventListener('click', () => {
                if (gs.pressNumber(num)) this.render();
            });
        }

        return btn;
    }

    _renderRemainingButtons(gs) {
        const sidebar = document.createElement('div');
        sidebar.className = 'apcalc-sidebar';

        const header = document.createElement('div');
        header.className = 'apcalc-sidebar-header';
        header.innerHTML = `<span>Buttons</span>`;
        const hideBtn = document.createElement('button');
        hideBtn.className = 'apcalc-hide-btn';
        hideBtn.textContent = 'Hide';
        hideBtn.addEventListener('click', () => {
            this.showRemainingList = false;
            this.render();
        });
        header.appendChild(hideBtn);
        sidebar.appendChild(header);

        // Sort: operations first, then numbers
        const allLabels = Object.keys(gs.totalPresses).sort((a, b) => {
            const aIsOp = gs.operations.includes(a);
            const bIsOp = gs.operations.includes(b);
            if (aIsOp && !bIsOp) return -1;
            if (!aIsOp && bIsOp) return 1;
            return a.localeCompare(b, undefined, { numeric: true });
        });

        for (const label of allLabels) {
            const total = gs.totalPresses[label] || 0;
            const remaining = gs.remainingPresses[label] || 0;
            if (total <= 0) continue;

            const row = document.createElement('div');
            row.className = 'apcalc-btn-row';
            if (remaining <= 0) row.classList.add('apcalc-btn-row-empty');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'apcalc-btn-label';
            nameSpan.textContent = label;

            const bar = document.createElement('span');
            bar.className = 'apcalc-btn-bar';
            let pips = '';
            for (let i = 0; i < total; i++) {
                pips += i < remaining ? '\u2588' : '\u2591';
            }
            bar.textContent = `${pips} (${remaining}/${total})`;

            row.appendChild(nameSpan);
            row.appendChild(bar);
            sidebar.appendChild(row);
        }

        return sidebar;
    }

    _renderStatus(gs) {
        const status = document.createElement('div');
        status.className = 'apcalc-status';

        const neighbors = gs.getNeighbors();
        const neighborText = neighbors.length > 0
            ? `Targets: ${neighbors.map(n => n.value).join(', ')}`
            : 'No targets from here';
        const checkedCount = gs.checkedLocations.size;
        const totalNodes = Object.keys(gs.nodes).length;

        status.innerHTML = `
            <span class="apcalc-status-pos">${this._esc(gs.currentNode || 'Start')}</span>
            <span class="apcalc-status-neighbors">${this._esc(neighborText)}</span>
            <span class="apcalc-status-progress">${checkedCount}/${totalNodes} checked</span>
        `;
        return status;
    }

    _renderPaths(gs) {
        const section = document.createElement('div');
        section.className = 'apcalc-paths';

        const header = document.createElement('div');
        header.className = 'apcalc-paths-header';
        header.textContent = 'Discovered Paths';
        if (this.pathFilter) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'apcalc-filter-clear';
            clearBtn.textContent = `\u2715 ${this.pathFilter}`;
            clearBtn.addEventListener('click', () => {
                this.pathFilter = null;
                this.render();
            });
            header.appendChild(clearBtn);
        }
        if (!this.showRemainingList) {
            const showBtn = document.createElement('button');
            showBtn.className = 'apcalc-show-sidebar-btn';
            showBtn.textContent = 'Show Buttons';
            showBtn.addEventListener('click', () => {
                this.showRemainingList = true;
                this.render();
            });
            header.appendChild(showBtn);
        }
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'apcalc-paths-list';

        let paths = gs.discoveredPaths;
        if (this.pathFilter) {
            paths = paths.filter(p => {
                // Show paths that pass through the filtered node
                if (p.node === this.pathFilter) return true;
                // Check intermediate nodes in the sequence
                return this._pathPassesThrough(gs, p, this.pathFilter);
            });
        }

        if (paths.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'apcalc-paths-empty';
            empty.textContent = this.pathFilter ? 'No paths through this node' : 'No paths discovered yet';
            list.appendChild(empty);
        }

        for (const path of paths) {
            const row = document.createElement('div');
            row.className = 'apcalc-path-row';
            row.addEventListener('click', () => this._loadPath(gs, path));

            const nodeInfo = gs.nodes[path.node];
            const label = document.createElement('span');
            label.className = 'apcalc-path-label';
            label.textContent = nodeInfo ? `${nodeInfo.value}` : path.node;

            const seq = document.createElement('span');
            seq.className = 'apcalc-path-seq';
            seq.textContent = path.sequence.map(s => s === '=' ? '=' : `[${s}]`).join(' ');

            row.appendChild(label);
            row.appendChild(seq);
            list.appendChild(row);
        }

        section.appendChild(list);
        return section;
    }

    /** Load a discovered path: replay the button sequence. */
    _loadPath(gs, path) {
        gs.reset();
        // Replay the sequence up to the node
        for (const label of path.sequence) {
            if (label === '=') {
                gs.pressEquals();
            } else if (gs.operations.includes(label)) {
                gs.pressOperation(label);
            } else {
                gs.pressNumber(Number(label));
            }
        }
        this.render();
    }

    /** Check if a path passes through a given node. */
    _pathPassesThrough(gs, path, regionName) {
        // Walk the path's node chain backward
        let nodeName = path.node;
        while (nodeName) {
            if (nodeName === regionName) return true;
            const info = gs.nodes[nodeName];
            nodeName = info?.parent || null;
        }
        return false;
    }

    /** Flash a result value on the display briefly (for non-move results). */
    _flashResult(value) {
        const display = this.rootElement.querySelector('.apcalc-display-value');
        if (!display) return;
        display.textContent = String(value);
        display.classList.add('apcalc-flash');
        setTimeout(() => {
            display.classList.remove('apcalc-flash');
            this.render();
        }, 800);
    }

    /** Set the path filter to a specific node (called from region graph clicks). */
    setPathFilter(regionName) {
        this.pathFilter = regionName;
        this.render();
    }

    _esc(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}
