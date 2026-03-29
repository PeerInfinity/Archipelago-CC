/**
 * Vibe Coding Simulator — Panel UI
 *
 * Three-column layout: Features | Tests | Tasks
 * Each column has a scrollable card list and a fixed action area.
 * Simulator toolbar at top with time, credits, speed, and wait controls.
 */

import { setPanelInstance, getModuleApis } from './index.js';
import { TaskStatus, TaskType } from './simEngine.js';

const STATUS_COLORS = {
    pass: '#2d8a4e',
    partial: '#b8860b',
    fail: '#c0392b',
    unknown: '#666',
};

export class VibeCodingSimUI {
    static moduleApis = null;

    static setModuleApis(apis) {
        VibeCodingSimUI.moduleApis = apis;
    }

    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this.apis = VibeCodingSimUI.moduleApis || getModuleApis();
        this.selectedFeatureId = null;
        this.selectedTestId = null;
        this.selectedTaskId = null;
        this.expandedFeatures = new Set();
        this.expandedTests = new Set();
        this.featureSearch = '';
        this.testSearch = '';
        this.featureSort = 'topo';
        this.testSort = 'status';
        this.visibleColumns = { features: true, tests: true, tasks: true };

        // Create root element immediately (required by GoldenLayout)
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'vcs-panel';
        this.rootElement.innerHTML = '<div class="vcs-empty">Waiting for game data...</div>';

        setPanelInstance(this);
    }

    getRootElement() {
        return this.rootElement;
    }

    destroy() {
        setPanelInstance(null);
    }

    get gameState() {
        return this.apis?.getGameState?.();
    }

    // --- Rendering ---

    render() {
        const gs = this.gameState;
        if (!this.rootElement) return;

        this.rootElement.innerHTML = '';
        this.rootElement.className = 'vcs-panel';

        if (!gs) {
            this.rootElement.innerHTML = '<div class="vcs-empty">Waiting for game data...</div>';
            return;
        }

        // Toolbar
        this.rootElement.appendChild(this._renderToolbar(gs));

        // Column toggles
        this.rootElement.appendChild(this._renderColumnToggles());

        // Columns container
        const cols = document.createElement('div');
        cols.className = 'vcs-columns';

        if (this.visibleColumns.features) cols.appendChild(this._renderFeatureColumn(gs));
        if (this.visibleColumns.tests) cols.appendChild(this._renderTestColumn(gs));
        if (this.visibleColumns.tasks) cols.appendChild(this._renderTaskColumn(gs));

        this.rootElement.appendChild(cols);
    }

    // --- Toolbar ---

    _renderToolbar(gs) {
        const bar = document.createElement('div');
        bar.className = 'vcs-toolbar';

        // Time
        const time = document.createElement('span');
        time.className = 'vcs-toolbar-item';
        time.textContent = gs.timeStr;
        bar.appendChild(time);

        // Credits
        const credits = document.createElement('span');
        credits.className = 'vcs-toolbar-item';
        credits.textContent = `Credits: ${gs.creditHours.toFixed(1)}h`;
        bar.appendChild(credits);

        // Progress
        const progress = document.createElement('span');
        progress.className = 'vcs-toolbar-item';
        progress.textContent = `Progress: ${Math.round(gs.overallProgress * 100)}%`;
        bar.appendChild(progress);

        // Speed buttons
        const speeds = [
            { label: '⏸', mult: 0 },
            { label: '1×', mult: 1 },
            { label: '2×', mult: 2 },
            { label: '5×', mult: 5 },
            { label: '10×', mult: 10 },
        ];
        for (const sp of speeds) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-speed';
            if ((sp.mult === 0 && gs.paused) || (!gs.paused && gs.speedMultiplier === sp.mult)) {
                btn.classList.add('vcs-btn-active');
            }
            btn.textContent = sp.label;
            btn.addEventListener('click', () => {
                if (sp.mult === 0) {
                    gs.paused = true;
                } else {
                    gs.paused = false;
                    gs.speedMultiplier = sp.mult;
                }
                this.render();
            });
            bar.appendChild(btn);
        }

        // Wait buttons
        for (const hours of [1, 8]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn';
            btn.textContent = `Wait ${hours}h`;
            btn.addEventListener('click', () => {
                const wasPaused = gs.paused;
                gs.paused = false;
                const oldMult = gs.speedMultiplier;
                gs.speedMultiplier = 1;
                const minutes = hours * 60;
                const steps = Math.max(1, minutes * 2);
                const dtPerStep = minutes / steps / (gs.config.timeScale / 60);
                for (let i = 0; i < steps; i++) {
                    gs.tick(dtPerStep);
                }
                gs.paused = wasPaused;
                gs.speedMultiplier = oldMult;
                this.render();
            });
            bar.appendChild(btn);
        }

        return bar;
    }

    // --- Column toggles ---

    _renderColumnToggles() {
        const row = document.createElement('div');
        row.className = 'vcs-column-toggles';

        for (const [key, label] of [['features', 'Features'], ['tests', 'Tests'], ['tasks', 'Tasks']]) {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-toggle';
            if (this.visibleColumns[key]) btn.classList.add('vcs-btn-active');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.visibleColumns[key] = !this.visibleColumns[key];
                this.render();
            });
            row.appendChild(btn);
        }

        return row;
    }

    // --- Feature Column ---

    _renderFeatureColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        // Header with search and sort
        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Features</strong>';

        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'vcs-search';
        search.placeholder = 'Search...';
        search.value = this.featureSearch;
        search.addEventListener('input', (e) => {
            this.featureSearch = e.target.value;
            this.render();
        });
        header.appendChild(search);

        col.appendChild(header);

        // Scrollable card list
        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        const features = this._getSortedFeatures(gs);
        for (const feat of features) {
            if (this.featureSearch && !feat.name.toLowerCase().includes(this.featureSearch.toLowerCase())) {
                continue;
            }
            list.appendChild(this._renderFeatureCard(gs, feat));
        }

        col.appendChild(list);

        // Action area
        col.appendChild(this._renderFeatureActions(gs));

        return col;
    }

    _getSortedFeatures(gs) {
        const features = [...gs.features.values()];
        // Default: topological (features with no upstream first)
        return features.sort((a, b) => {
            if (a.upstreamIds.size !== b.upstreamIds.size) return a.upstreamIds.size - b.upstreamIds.size;
            return a.name.localeCompare(b.name);
        });
    }

    _renderFeatureCard(gs, feat) {
        const card = document.createElement('div');
        const isSelected = this.selectedFeatureId === feat.id;
        const isExpanded = this.expandedFeatures.has(feat.id);

        // Determine status color from tests
        const testStatuses = feat.relatedTestIds
            .map(id => gs.tests.get(id))
            .filter(Boolean)
            .map(t => t.status);
        const statusColor = this._featureStatusColor(testStatuses);

        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;
        card.style.borderLeftColor = statusColor;

        // Collapsed content (always visible)
        const summary = document.createElement('div');
        summary.className = 'vcs-card-summary';
        summary.addEventListener('click', () => {
            this.selectedFeatureId = feat.id;
            if (this.expandedFeatures.has(feat.id)) {
                this.expandedFeatures.delete(feat.id);
            } else {
                this.expandedFeatures.add(feat.id);
            }
            this.render();
        });

        const lockIcon = feat.isLocked ? '🔒 ' : '';
        const name = document.createElement('span');
        name.className = 'vcs-card-name';
        name.textContent = `${lockIcon}${feat.name}`;
        summary.appendChild(name);

        const bar = this._progressBar(feat.completion);
        summary.appendChild(bar);

        const testCount = document.createElement('span');
        testCount.className = 'vcs-card-meta';
        const passing = testStatuses.filter(s => s === 'pass').length;
        testCount.textContent = `${passing}/${testStatuses.length} tests`;
        summary.appendChild(testCount);

        card.appendChild(summary);

        // Expanded content
        if (isExpanded) {
            card.appendChild(this._renderFeatureDetails(gs, feat));
        }

        return card;
    }

    _renderFeatureDetails(gs, feat) {
        const details = document.createElement('div');
        details.className = 'vcs-card-details';

        // Phases
        const phasesDiv = document.createElement('div');
        phasesDiv.innerHTML = '<div class="vcs-detail-label">Phases</div>';
        for (const phase of feat.phases) {
            const row = document.createElement('div');
            row.className = 'vcs-phase-row';
            const lockIcon = phase._locked ? '🔒' : (phase.isComplete ? '✓' : '○');
            const phaseName = phase.name.includes(':') ? phase.name.split(':').slice(1).join(':').trim() : phase.name;
            const shortName = phaseName.length > 40 ? phaseName.substring(0, 37) + '...' : phaseName;
            row.innerHTML = `<span class="vcs-phase-icon">${lockIcon}</span> ${shortName} <span class="vcs-phase-pct">${Math.round(phase.completion * 100)}%</span>`;
            phasesDiv.appendChild(row);
        }
        details.appendChild(phasesDiv);

        // Dependencies
        if (feat.upstreamIds.size > 0 || feat.downstreamIds.size > 0) {
            const depsDiv = document.createElement('div');
            if (feat.upstreamIds.size > 0) {
                depsDiv.innerHTML += '<div class="vcs-detail-label">Depends on</div>';
                for (const depId of feat.upstreamIds) {
                    const link = document.createElement('a');
                    link.className = 'vcs-dep-link';
                    link.href = '#';
                    link.textContent = gs.features.get(depId)?.name || depId;
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.selectFeature(depId);
                    });
                    depsDiv.appendChild(link);
                }
            }
            if (feat.downstreamIds.size > 0) {
                depsDiv.innerHTML += '<div class="vcs-detail-label">Unlocks</div>';
                for (const depId of feat.downstreamIds) {
                    const link = document.createElement('a');
                    link.className = 'vcs-dep-link';
                    link.href = '#';
                    link.textContent = gs.features.get(depId)?.name || depId;
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.selectFeature(depId);
                    });
                    depsDiv.appendChild(link);
                }
            }
            details.appendChild(depsDiv);
        }

        // Active tasks
        const activeTasks = gs.getRunningTasks().filter(t => t.targetFeatureId === feat.id);
        if (activeTasks.length > 0) {
            const tasksDiv = document.createElement('div');
            tasksDiv.innerHTML = '<div class="vcs-detail-label">Active tasks</div>';
            for (const task of activeTasks) {
                const row = document.createElement('div');
                row.className = 'vcs-task-inline';
                row.appendChild(this._progressBar(task.progress));
                const label = document.createElement('span');
                label.textContent = ` ${task.subtaskLabel}`;
                row.appendChild(label);
                tasksDiv.appendChild(row);
            }
            details.appendChild(tasksDiv);
        }

        return details;
    }

    _renderFeatureActions(gs) {
        const area = document.createElement('div');
        area.className = 'vcs-action-area';

        if (!this.selectedFeatureId || !gs) return area;

        const feat = gs.features.get(this.selectedFeatureId);
        if (!feat) return area;

        const available = gs.getAvailablePhases(this.selectedFeatureId);
        if (available.length > 0) {
            for (const phase of available) {
                const btn = document.createElement('button');
                btn.className = 'vcs-btn vcs-btn-action';
                const phaseName = phase.name.includes(':') ? phase.name.split(':').slice(1).join(':').trim() : phase.name;
                const shortName = phaseName.length > 30 ? phaseName.substring(0, 27) + '...' : phaseName;
                btn.textContent = `Implement: ${shortName}`;
                btn.addEventListener('click', () => {
                    gs.assignImplementTask(phase.nodeId);
                    this.render();
                });
                area.appendChild(btn);
            }
        } else if (feat.isLocked) {
            const msg = document.createElement('span');
            msg.className = 'vcs-action-msg';
            msg.textContent = 'Feature is locked — dependencies not met';
            area.appendChild(msg);
        } else if (feat.completion >= 1) {
            const msg = document.createElement('span');
            msg.className = 'vcs-action-msg';
            msg.textContent = 'Feature complete';
            area.appendChild(msg);
        }

        return area;
    }

    // --- Test Column ---

    _renderTestColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Tests</strong>';

        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'vcs-search';
        search.placeholder = 'Search...';
        search.value = this.testSearch;
        search.addEventListener('input', (e) => {
            this.testSearch = e.target.value;
            this.render();
        });
        header.appendChild(search);
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        const tests = [...gs.tests.values()];
        tests.sort((a, b) => {
            const statusOrder = { fail: 0, partial: 1, unknown: 2, pass: 3 };
            return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
        });

        for (const test of tests) {
            if (this.testSearch && !test.name.toLowerCase().includes(this.testSearch.toLowerCase())) {
                continue;
            }
            list.appendChild(this._renderTestCard(gs, test));
        }

        col.appendChild(list);
        col.appendChild(this._renderTestActions(gs));

        return col;
    }

    _renderTestCard(gs, test) {
        const card = document.createElement('div');
        const isSelected = this.selectedTestId === test.id;
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;
        card.style.borderLeftColor = STATUS_COLORS[test.status] || STATUS_COLORS.unknown;

        card.addEventListener('click', () => {
            this.selectedTestId = test.id;
            this.render();
        });

        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        name.textContent = test.name;
        card.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'vcs-card-meta';
        if (test.linesTotal > 0) {
            meta.textContent = `${test.linesMatching}/${test.linesTotal} lines`;
        } else {
            meta.textContent = 'Not yet tested';
        }
        card.appendChild(meta);

        if (test.relatedFeatureIds.length > 0) {
            const feats = document.createElement('div');
            feats.className = 'vcs-card-meta';
            for (const fid of test.relatedFeatureIds) {
                const link = document.createElement('a');
                link.className = 'vcs-dep-link';
                link.href = '#';
                link.textContent = gs.features.get(fid)?.name || fid;
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.selectFeature(fid);
                });
                feats.appendChild(link);
            }
            card.appendChild(feats);
        }

        return card;
    }

    _renderTestActions(gs) {
        const area = document.createElement('div');
        area.className = 'vcs-action-area';

        if (this.selectedTestId) {
            const test = gs.tests.get(this.selectedTestId);
            if (test && test.relatedFeatureIds.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'vcs-btn vcs-btn-action';
                btn.textContent = 'View Feature';
                btn.addEventListener('click', () => {
                    this.selectFeature(test.relatedFeatureIds[0]);
                });
                area.appendChild(btn);
            }
        }

        return area;
    }

    // --- Task Column ---

    _renderTaskColumn(gs) {
        const col = document.createElement('div');
        col.className = 'vcs-column';

        const header = document.createElement('div');
        header.className = 'vcs-column-header';
        header.innerHTML = '<strong>Tasks</strong>';
        col.appendChild(header);

        const list = document.createElement('div');
        list.className = 'vcs-card-list';

        // Test workflow entry (always visible)
        list.appendChild(this._renderTestWorkflowCard(gs));

        // Running tasks
        for (const task of gs.getRunningTasks()) {
            list.appendChild(this._renderTaskCard(gs, task));
        }

        // Merge conflicts
        for (const task of gs.getMergeConflicts()) {
            list.appendChild(this._renderTaskCard(gs, task));
        }

        // Completed tasks
        const completed = gs.getCompletedTasks();
        for (const task of completed.reverse()) {
            list.appendChild(this._renderTaskCard(gs, task));
        }

        col.appendChild(list);
        col.appendChild(this._renderTaskActions(gs));

        return col;
    }

    _renderTestWorkflowCard(gs) {
        const card = document.createElement('div');
        card.className = 'vcs-card vcs-card-workflow';

        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        name.textContent = '🧪 Test Workflow';
        card.appendChild(name);

        if (gs.testWorkflow && !gs.testWorkflow.isComplete) {
            const progress = gs.testWorkflowProgress ?? 0;
            card.appendChild(this._progressBar(progress));
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = 'Running...';
            card.appendChild(meta);
        } else if (gs.testWorkflow?.isComplete) {
            const passing = [...gs.tests.values()].filter(t => t.status === 'pass').length;
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = `Last run: ${passing}/${gs.tests.size} passing`;
            card.appendChild(meta);

            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action';
            btn.textContent = 'Run Tests';
            btn.addEventListener('click', () => {
                gs.startTestWorkflow();
                this.render();
            });
            card.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'vcs-btn vcs-btn-action';
            btn.textContent = 'Run Tests';
            btn.addEventListener('click', () => {
                gs.startTestWorkflow();
                this.render();
            });
            card.appendChild(btn);
        }

        return card;
    }

    _renderTaskCard(gs, task) {
        const card = document.createElement('div');
        const isSelected = this.selectedTaskId === task.id;
        card.className = `vcs-card ${isSelected ? 'vcs-card-selected' : ''}`;

        if (task.status === TaskStatus.MERGE_CONFLICT) {
            card.style.borderLeftColor = '#e67e22';
        } else if (task.status === TaskStatus.RUNNING) {
            card.style.borderLeftColor = '#3498db';
        } else if (task.status === TaskStatus.COMPLETED) {
            card.style.borderLeftColor = '#2d8a4e';
        } else {
            card.style.borderLeftColor = '#999';
        }

        card.addEventListener('click', () => {
            this.selectedTaskId = task.id;
            this.render();
        });

        const name = document.createElement('div');
        name.className = 'vcs-card-name';
        const statusIcon = {
            [TaskStatus.RUNNING]: '⚡',
            [TaskStatus.COMPLETED]: '✓',
            [TaskStatus.CANCELLED]: '✗',
            [TaskStatus.FAILED]: '✗',
            [TaskStatus.MERGE_CONFLICT]: '⚠',
        }[task.status] || '';
        name.textContent = `${statusIcon} ${task.label}`;
        card.appendChild(name);

        if (task.status === TaskStatus.RUNNING) {
            card.appendChild(this._progressBar(task.progress));
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.subtaskLabel;
            card.appendChild(meta);
        } else if (task.status === TaskStatus.MERGE_CONFLICT) {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta vcs-merge-conflict';
            meta.textContent = 'Merge conflict — needs resolution';
            card.appendChild(meta);
        } else {
            const meta = document.createElement('div');
            meta.className = 'vcs-card-meta';
            meta.textContent = task.status;
            card.appendChild(meta);
        }

        return card;
    }

    _renderTaskActions(gs) {
        const area = document.createElement('div');
        area.className = 'vcs-action-area';

        if (!this.selectedTaskId) return area;

        const task = gs.tasks.find(t => t.id === this.selectedTaskId);
        if (!task) return area;

        if (task.status === TaskStatus.RUNNING) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'vcs-btn vcs-btn-action vcs-btn-danger';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => {
                gs.cancelTask(task.id);
                this.render();
            });
            area.appendChild(cancelBtn);

            const skipBtn = document.createElement('button');
            skipBtn.className = 'vcs-btn vcs-btn-action';
            skipBtn.textContent = 'Skip Testing';
            skipBtn.addEventListener('click', () => {
                gs.skipTesting(task.id);
                this.render();
            });
            area.appendChild(skipBtn);
        }

        if (task.status === TaskStatus.MERGE_CONFLICT) {
            const resolveBtn = document.createElement('button');
            resolveBtn.className = 'vcs-btn vcs-btn-action';
            resolveBtn.textContent = 'Resolve';
            resolveBtn.addEventListener('click', () => {
                gs.assignMergeConflictResolution(task.id);
                this.render();
            });
            area.appendChild(resolveBtn);

            const discardBtn = document.createElement('button');
            discardBtn.className = 'vcs-btn vcs-btn-action vcs-btn-danger';
            discardBtn.textContent = 'Discard';
            discardBtn.addEventListener('click', () => {
                gs.discardMergeConflict(task.id);
                this.render();
            });
            area.appendChild(discardBtn);
        }

        return area;
    }

    // --- Helpers ---

    _progressBar(pct) {
        const bar = document.createElement('div');
        bar.className = 'vcs-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'vcs-progress-fill';
        fill.style.width = `${Math.round(pct * 100)}%`;
        bar.appendChild(fill);
        return bar;
    }

    _featureStatusColor(testStatuses) {
        if (testStatuses.length === 0) return STATUS_COLORS.unknown;
        if (testStatuses.every(s => s === 'pass')) return STATUS_COLORS.pass;
        if (testStatuses.some(s => s === 'fail')) return STATUS_COLORS.fail;
        if (testStatuses.some(s => s === 'partial')) return STATUS_COLORS.partial;
        return STATUS_COLORS.unknown;
    }

    // --- Public methods ---

    selectFeature(featureId) {
        this.selectedFeatureId = featureId;
        this.expandedFeatures.add(featureId);
        this.render();

        // Scroll to feature card
        requestAnimationFrame(() => {
            const card = this.rootElement?.querySelector(`.vcs-card-selected`);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        // Publish for Region Graph
        if (this.apis?.eventBus) {
            this.apis.eventBus.publish('vibeCodingSim:featureSelected', { featureId });
        }
    }

    onPanelShow() {
        this.render();
    }

    onPanelResize() {
        // No special handling needed — CSS flexbox handles it
    }
}
