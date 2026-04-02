/**
 * APCalc Generator — UI panel
 *
 * Parameter inputs, save/load to localStorage, generate button,
 * detailed step-by-step log output, download/load results.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import { generate, exportRulesJson } from './apcalcGeneratorEngine.js';

const LS_KEY = 'apcalcGenerator_params';

const DEFAULT_PARAMS = {
    seed: 42,
    numSpheres: 5,
    opsPerSphere: 1,
    numsPerSphere: 1,
    trashPerSphere: 1,
    maxBranches: 3,
    divideSphere: '',  // '' = auto
};

export class APCalcGeneratorUI {
    static moduleApis = null;
    static setModuleApis(apis) { APCalcGeneratorUI.moduleApis = apis; }

    constructor(container, componentState) {
        this.container = container;
        this.params = { ...DEFAULT_PARAMS };
        this.logLines = [];
        this.generatedRulesJson = null;
        this.isGenerating = false;
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'apcalc-gen-panel';
        setPanelInstance(this);
        this._loadFromLocalStorage();
        this.render();
    }

    get apis() { return APCalcGeneratorUI.moduleApis || getModuleApis(); }

    getRootElement() { return this.rootElement; }
    destroy() { setPanelInstance(null); }
    onPanelShow() { this.render(); }
    onPanelResize() {}

    render() {
        this.rootElement.innerHTML = '';
        this.rootElement.appendChild(this._renderParams());
        this.rootElement.appendChild(this._renderActions());
        this.rootElement.appendChild(this._renderResults());
        this.rootElement.appendChild(this._renderLog());
    }

    // --- Parameter UI ---

    _renderParams() {
        const section = document.createElement('div');
        section.className = 'apcalc-gen-params';

        section.innerHTML = '<div class="apcalc-gen-section-title">Parameters</div>';

        const grid = document.createElement('div');
        grid.className = 'apcalc-gen-grid';

        const fields = [
            { key: 'seed', label: 'Seed', type: 'number' },
            { key: 'numSpheres', label: 'Spheres', type: 'number', min: 2, max: 20 },
            { key: 'opsPerSphere', label: 'Ops / sphere', type: 'number', min: 1, max: 5 },
            { key: 'numsPerSphere', label: 'Nums / sphere', type: 'number', min: 1, max: 5 },
            { key: 'trashPerSphere', label: 'Min trash / sphere', type: 'number', min: 0, max: 10 },
            { key: 'maxBranches', label: 'Max branches', type: 'number', min: 1, max: 10 },
            { key: 'divideSphere', label: 'Divide sphere', type: 'text', placeholder: 'auto' },
        ];

        for (const f of fields) {
            const row = document.createElement('div');
            row.className = 'apcalc-gen-field';

            const label = document.createElement('label');
            label.textContent = f.label;
            label.htmlFor = `apcalc-gen-${f.key}`;

            const input = document.createElement('input');
            input.type = f.type;
            input.id = `apcalc-gen-${f.key}`;
            input.value = this.params[f.key];
            if (f.min !== undefined) input.min = f.min;
            if (f.max !== undefined) input.max = f.max;
            if (f.placeholder) input.placeholder = f.placeholder;
            input.addEventListener('change', () => {
                if (f.type === 'number') {
                    this.params[f.key] = parseInt(input.value, 10) || 0;
                } else {
                    this.params[f.key] = input.value;
                }
            });

            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        }

        section.appendChild(grid);

        // Save/Load buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'apcalc-gen-btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'apcalc-gen-btn';
        saveBtn.textContent = 'Save Params';
        saveBtn.addEventListener('click', () => this._saveToLocalStorage());

        const loadBtn = document.createElement('button');
        loadBtn.className = 'apcalc-gen-btn';
        loadBtn.textContent = 'Load Params';
        loadBtn.addEventListener('click', () => {
            this._loadFromLocalStorage();
            this.render();
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'apcalc-gen-btn';
        resetBtn.textContent = 'Reset Defaults';
        resetBtn.addEventListener('click', () => {
            this.params = { ...DEFAULT_PARAMS };
            this.render();
        });

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(loadBtn);
        btnRow.appendChild(resetBtn);
        section.appendChild(btnRow);

        return section;
    }

    // --- Actions ---

    _renderActions() {
        const section = document.createElement('div');
        section.className = 'apcalc-gen-actions';

        const genBtn = document.createElement('button');
        genBtn.className = 'apcalc-gen-btn apcalc-gen-btn-primary';
        genBtn.textContent = this.isGenerating ? 'Generating...' : 'Generate';
        genBtn.disabled = this.isGenerating;
        genBtn.addEventListener('click', () => this._runGeneration());

        section.appendChild(genBtn);

        if (this.isGenerating) {
            const spinner = document.createElement('span');
            spinner.className = 'apcalc-gen-spinner';
            spinner.textContent = ' ...';
            section.appendChild(spinner);
        }

        return section;
    }

    // --- Results ---

    _renderResults() {
        const section = document.createElement('div');
        section.className = 'apcalc-gen-results';

        if (!this.generatedRulesJson) return section;

        section.innerHTML = '<div class="apcalc-gen-section-title">Results</div>';

        const btnRow = document.createElement('div');
        btnRow.className = 'apcalc-gen-btn-row';

        // Download link
        const blob = new Blob([JSON.stringify(this.generatedRulesJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.className = 'apcalc-gen-btn';
        downloadLink.href = url;
        downloadLink.download = `apcalc_rules_seed${this.params.seed}.json`;
        downloadLink.textContent = 'Download rules.json';

        // Load into frontend button
        const loadBtn = document.createElement('button');
        loadBtn.className = 'apcalc-gen-btn apcalc-gen-btn-primary';
        loadBtn.textContent = 'Load in Frontend';
        loadBtn.addEventListener('click', () => this._loadIntoFrontend());

        btnRow.appendChild(downloadLink);
        btnRow.appendChild(loadBtn);
        section.appendChild(btnRow);

        // Summary
        const nodeCount = this.generatedRulesJson.regions?.['1']
            ? Object.keys(this.generatedRulesJson.regions['1']).length - 1  // minus start region
            : 0;
        const summary = document.createElement('div');
        summary.className = 'apcalc-gen-summary';
        summary.textContent = `${nodeCount} nodes generated, seed ${this.params.seed}`;
        section.appendChild(summary);

        return section;
    }

    // --- Log ---

    _renderLog() {
        const section = document.createElement('div');
        section.className = 'apcalc-gen-log-section';

        const header = document.createElement('div');
        header.className = 'apcalc-gen-section-title';
        header.textContent = `Log (${this.logLines.length} lines)`;
        if (this.logLines.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'apcalc-gen-btn-small';
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', () => {
                this.logLines = [];
                this.render();
            });
            header.appendChild(clearBtn);
        }
        section.appendChild(header);

        const logArea = document.createElement('div');
        logArea.className = 'apcalc-gen-log';
        for (const line of this.logLines) {
            const div = document.createElement('div');
            div.className = 'apcalc-gen-log-line';
            if (line.startsWith('===')) {
                div.classList.add('apcalc-gen-log-header');
            } else if (line.includes('WARNING')) {
                div.classList.add('apcalc-gen-log-warn');
            } else if (line.includes('Division planning')) {
                div.classList.add('apcalc-gen-log-info');
            }
            div.textContent = line;
            logArea.appendChild(div);
        }
        section.appendChild(logArea);

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            logArea.scrollTop = logArea.scrollHeight;
        });

        return section;
    }

    // --- Generation ---

    async _runGeneration() {
        if (this.isGenerating) return;
        this.isGenerating = true;
        this.logLines = [];
        this.generatedRulesJson = null;
        this.render();

        const config = {
            seed: this.params.seed,
            numSpheres: this.params.numSpheres,
            opsPerSphere: this.params.opsPerSphere,
            numsPerSphere: this.params.numsPerSphere,
            trashPerSphere: this.params.trashPerSphere,
            maxBranches: this.params.maxBranches,
            divideSphere: this.params.divideSphere === '' ? null : parseInt(this.params.divideSphere, 10),
        };

        const log = (msg) => {
            this.logLines.push(msg);
            // Re-render log periodically (every sphere boundary)
            if (msg.startsWith('===') || msg.includes('complete:')) {
                this.render();
            }
        };

        try {
            const gameData = await generate(config, log);
            this.generatedRulesJson = exportRulesJson(gameData);
            log('Export complete.');
        } catch (e) {
            log(`ERROR: ${e.message}`);
        }

        this.isGenerating = false;
        this.render();
    }

    // --- Load into frontend ---

    _loadIntoFrontend() {
        if (!this.generatedRulesJson) return;

        const { eventBus } = this.apis;
        if (!eventBus) {
            this.logLines.push('ERROR: Module not yet initialized. Try again in a moment.');
            this.render();
            return;
        }

        try {
            // Use the same event the Editor and JSON panels use
            eventBus.publish('files:jsonLoaded', {
                jsonData: this.generatedRulesJson,
                selectedPlayerId: '1',
                sourceName: 'apcalcGenerator',
            });
            this.logLines.push('Loaded rules into frontend via files:jsonLoaded.');
        } catch (e) {
            this.logLines.push(`ERROR loading rules: ${e.message}`);
        }
        this.render();
    }

    // --- localStorage ---

    _saveToLocalStorage() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.params));
            this.logLines.push('Parameters saved to localStorage.');
            this.render();
        } catch (e) {
            this.logLines.push(`ERROR saving params: ${e.message}`);
            this.render();
        }
    }

    _loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(LS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.params = { ...DEFAULT_PARAMS, ...parsed };
            }
        } catch (e) {
            // ignore
        }
    }
}
