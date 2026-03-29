/**
 * Vibe Coding Simulator — Simulation Engine
 *
 * JavaScript port of the Python prototype (engine.py).
 * Manages game state: features, phases, tasks, tests, credits, time.
 */

const TaskType = Object.freeze({
    IMPLEMENT: 'implement',
    MERGE_CONFLICT: 'merge_conflict',
    TEST_WORKFLOW: 'test_workflow',
});

const TaskStatus = Object.freeze({
    RUNNING: 'running',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    MERGE_CONFLICT: 'merge_conflict',
});

const SubtaskType = Object.freeze({
    BASELINE_TESTING: 'baseline testing',
    READING_CODE: 'reading code',
    PLANNING: 'planning',
    IMPLEMENTING: 'implementing',
    REGRESSION_TESTING: 'regression testing',
    FIXING_REGRESSIONS: 'fixing regressions',
});

const IMPLEMENT_SUBTASKS = [
    SubtaskType.BASELINE_TESTING,
    SubtaskType.READING_CODE,
    SubtaskType.PLANNING,
    SubtaskType.IMPLEMENTING,
    SubtaskType.REGRESSION_TESTING,
];

// Simple seeded PRNG (xoshiro128**)
class SeededRandom {
    constructor(seed = Date.now()) {
        this.s = new Uint32Array(4);
        this.s[0] = seed >>> 0;
        this.s[1] = (seed * 1664525 + 1013904223) >>> 0;
        this.s[2] = (this.s[1] * 1664525 + 1013904223) >>> 0;
        this.s[3] = (this.s[2] * 1664525 + 1013904223) >>> 0;
    }

    _next() {
        const s = this.s;
        const result = (s[1] * 5) | 0;
        const t = s[1] << 9;
        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = (s[3] << 11) | (s[3] >>> 21);
        return (result >>> 0) / 4294967296;
    }

    random() {
        return this._next();
    }

    gauss(mean = 0, stddev = 1) {
        // Box-Muller transform
        let u, v, s;
        do {
            u = this.random() * 2 - 1;
            v = this.random() * 2 - 1;
            s = u * u + v * v;
        } while (s >= 1 || s === 0);
        const mul = Math.sqrt(-2 * Math.log(s) / s);
        return mean + stddev * u * mul;
    }
}

class SimulationConfig {
    constructor(overrides = {}) {
        // Time
        this.timeScale = 60.0;           // simulated seconds per real second
        this.baseTaskDuration = 10.0;    // base minutes per subtask

        // Weekly credits
        this.weeklyCredits = 5040.0;     // 1 instance × 12h/day × 7 days
        this.weekDuration = 7 * 24 * 60; // 7 days in minutes
        this.creditRate = 1.0;           // credits per simulated minute per instance

        // Regressions
        this.regressionRate = 0.25;
        this.regressionLocalWeight = 0.7;
        this.regressionAdjacentWeight = 0.2;
        this.regressionRemoteWeight = 0.1;
        this.regressionSeverityMean = 0.15;

        // Task duration variance
        this.durationLogSigma = 0.6;

        // Implementation
        this.implementProgressPerTask = 1.0;

        // Test workflow
        this.testWorkflowDuration = 10.0;

        // Inline regression detection
        this.inlineRegressionCatchRate = 0.6;

        // Merge conflicts
        this.mergeConflictRate = 0.25;

        // Task history
        this.maxTaskHistory = 100;

        Object.assign(this, overrides);
    }
}

class Phase {
    constructor(id, name, featureId, dependsOn = []) {
        this.id = id;
        this.name = name;
        this.featureId = featureId;
        this.dependsOn = dependsOn;
        this.completion = 0.0;
    }

    get nodeId() {
        return `${this.featureId}.${this.id}`;
    }

    get isComplete() {
        return this.completion >= 1.0;
    }
}

class Feature {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.phases = [];
        this.upstreamIds = new Set();
        this.downstreamIds = new Set();
        this.relatedTestIds = [];
    }

    get completion() {
        if (this.phases.length === 0) return 0;
        return this.phases.reduce((sum, p) => sum + p.completion, 0) / this.phases.length;
    }

    get isLocked() {
        return this.phases.length > 0 && this.phases.every(p => p._locked);
    }
}

let _nextTaskId = 1;

class Task {
    constructor(type, targetNodeId, config) {
        this.id = `task-${_nextTaskId++}`;
        this.type = type;
        this.targetNodeId = targetNodeId;
        this.targetFeatureId = targetNodeId ? targetNodeId.split('.')[0] : null;
        this.status = TaskStatus.RUNNING;
        this.progress = 0;
        this.subtaskIndex = 0;
        this.subtaskProgress = 0;
        this.subtaskDurations = [];
        this.subtaskLabel = '';
        this.startedAt = 0;
        this.completedAt = null;
        this.creditsUsed = 0;
        this.regressionFixCycles = 0;
        this._config = config;
    }

    get currentSubtask() {
        if (this.status !== TaskStatus.RUNNING) return null;
        if (this.subtaskIndex < IMPLEMENT_SUBTASKS.length) {
            return IMPLEMENT_SUBTASKS[this.subtaskIndex];
        }
        const cycleOffset = this.subtaskIndex - IMPLEMENT_SUBTASKS.length;
        return cycleOffset % 2 === 0
            ? SubtaskType.FIXING_REGRESSIONS
            : SubtaskType.REGRESSION_TESTING;
    }

    get overallProgress() {
        if (this.subtaskDurations.length === 0) return 0;
        const completed = this.subtaskIndex + this.subtaskProgress;
        return Math.min(completed / this.subtaskDurations.length, 1.0);
    }

    get label() {
        return `${this.type}: ${this.targetNodeId}`;
    }
}

class TestResult {
    constructor(id, name, relatedFeatureIds = []) {
        this.id = id;
        this.name = name;
        this.status = 'unknown';    // pass | fail | partial | unknown
        this.linesMatching = 0;
        this.linesTotal = 0;
        this.lastUpdated = null;
        this.relatedFeatureIds = relatedFeatureIds;
    }
}

class TestWorkflow {
    constructor(startedAt, duration, completionSnapshot) {
        this.startedAt = startedAt;
        this.duration = duration;
        this.completionSnapshot = completionSnapshot;
        this.results = null;
    }

    get isComplete() {
        return this.results !== null;
    }

    get progress() {
        return 0; // Will be set by GameState during tick
    }
}

class GameState {
    constructor(config) {
        this.config = config || new SimulationConfig();
        this.features = new Map();      // id -> Feature
        this.allPhases = new Map();     // nodeId -> Phase
        this.tests = new Map();         // id -> TestResult
        this.tasks = [];                // all tasks (running + history)
        this.simulatedTime = 0;         // minutes
        this.creditsRemaining = this.config.weeklyCredits;
        this.weekStart = 0;
        this.testWorkflow = null;
        this.rng = new SeededRandom();
        this.log = [];
        this.paused = true;
        this.speedMultiplier = 1;

        // Callbacks for UI notification
        this.onStateChanged = null;
        this.onLogEntry = null;
    }

    loadFromSlotData(slotData) {
        // slotData comes from rules JSON: { graph_structure: { "1": {...}, "2": {...} }, title, ... }
        const graphStructure = slotData.graph_structure;
        if (!graphStructure) return;

        // Build index→label mapping for dependency resolution
        const indexToLabel = {};
        for (const [idx, step] of Object.entries(graphStructure)) {
            indexToLabel[parseInt(idx)] = step.label;
        }

        // Parse into our node format
        const featurePhases = new Map();

        for (const [idx, step] of Object.entries(graphStructure)) {
            const nodeId = step.label; // e.g., "DATABASE.1"
            let featId, phaseId;
            const dotIdx = nodeId.indexOf('.');
            if (dotIdx >= 0) {
                featId = nodeId.substring(0, dotIdx);
                phaseId = nodeId.substring(dotIdx + 1);
            } else {
                featId = nodeId;
                phaseId = '1';
            }

            // Resolve dependencies from integer indices to node IDs
            const dependsOn = (step.dependencies || []).map(depIdx => indexToLabel[depIdx]).filter(Boolean);

            if (!featurePhases.has(featId)) {
                featurePhases.set(featId, []);
            }
            featurePhases.get(featId).push({
                nodeId,
                phaseId,
                label: step.expression || nodeId,
                dependsOn,
            });
        }

        for (const [featId, phaseDicts] of featurePhases) {
            const firstLabel = phaseDicts[0].label;
            const featName = firstLabel.includes(':')
                ? firstLabel.split(':')[0].trim()
                : featId;

            const feature = new Feature(featId, featName);

            for (const pd of phaseDicts) {
                const phase = new Phase(pd.phaseId, pd.label, featId, pd.dependsOn);
                feature.phases.push(phase);
                this.allPhases.set(pd.nodeId, phase);
            }

            this.features.set(featId, feature);
        }

        // Compute upstream/downstream relationships between features
        for (const [, phase] of this.allPhases) {
            const feat = this.features.get(phase.featureId);
            for (const depId of phase.dependsOn) {
                const depFeatId = depId.split('.')[0];
                if (depFeatId !== phase.featureId) {
                    feat.upstreamIds.add(depFeatId);
                    const depFeat = this.features.get(depFeatId);
                    if (depFeat) depFeat.downstreamIds.add(phase.featureId);
                }
            }
        }

        // Generate simulated tests (one per feature for now)
        for (const [featId, feat] of this.features) {
            const testId = `test_${featId}`;
            const test = new TestResult(testId, `${feat.name} tests`, [featId]);
            feat.relatedTestIds.push(testId);
            this.tests.set(testId, test);
        }

        this._updateLockStatus();
    }

    _updateLockStatus() {
        for (const [nodeId, phase] of this.allPhases) {
            phase._locked = false;
            for (const depId of phase.dependsOn) {
                const dep = this.allPhases.get(depId);
                if (!dep || !dep.isComplete) {
                    phase._locked = true;
                    break;
                }
            }
        }
    }

    isPhaseUnlocked(nodeId) {
        const phase = this.allPhases.get(nodeId);
        return phase && !phase._locked;
    }

    getAvailablePhases(featureId = null) {
        const inProgress = new Set();
        for (const task of this.tasks) {
            if (task.status === TaskStatus.RUNNING) {
                inProgress.add(task.targetNodeId);
            }
        }

        const available = [];
        for (const [nodeId, phase] of this.allPhases) {
            if (featureId && phase.featureId !== featureId) continue;
            if (phase.isComplete) continue;
            if (phase._locked) continue;
            available.push(phase);
        }
        return available;
    }

    getRunningTasks() {
        return this.tasks.filter(t => t.status === TaskStatus.RUNNING);
    }

    getCompletedTasks() {
        return this.tasks
            .filter(t => t.status !== TaskStatus.RUNNING)
            .slice(-this.config.maxTaskHistory);
    }

    getMergeConflicts() {
        return this.tasks.filter(t => t.status === TaskStatus.MERGE_CONFLICT);
    }

    assignImplementTask(targetNodeId) {
        if (!this.allPhases.has(targetNodeId)) return null;
        if (!this.isPhaseUnlocked(targetNodeId)) return null;

        const task = new Task(TaskType.IMPLEMENT, targetNodeId, this.config);
        task.startedAt = this.simulatedTime;

        // Generate random subtask durations
        for (let i = 0; i < IMPLEMENT_SUBTASKS.length; i++) {
            const dur = this.config.baseTaskDuration *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
            task.subtaskDurations.push(dur);
        }

        task.subtaskLabel = IMPLEMENT_SUBTASKS[0];
        this.tasks.push(task);
        this._addLog(`New task: ${task.label}`);
        this._notify();
        return task;
    }

    assignMergeConflictResolution(conflictTaskId) {
        const conflictTask = this.tasks.find(t => t.id === conflictTaskId);
        if (!conflictTask || conflictTask.status !== TaskStatus.MERGE_CONFLICT) return null;

        const task = new Task(TaskType.MERGE_CONFLICT, conflictTask.targetNodeId, this.config);
        task.startedAt = this.simulatedTime;

        // Merge resolution is shorter
        for (let i = 0; i < 3; i++) {
            const dur = this.config.baseTaskDuration * 0.5 *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
            task.subtaskDurations.push(dur);
        }

        task.subtaskLabel = 'resolving merge conflict';
        conflictTask.status = TaskStatus.FAILED; // Mark original as failed, resolution in progress
        this.tasks.push(task);
        this._addLog(`Resolving merge conflict on ${task.targetNodeId}`);
        this._notify();
        return task;
    }

    discardMergeConflict(conflictTaskId) {
        const task = this.tasks.find(t => t.id === conflictTaskId);
        if (!task || task.status !== TaskStatus.MERGE_CONFLICT) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Discarded merge conflict changes on ${task.targetNodeId}`);
        this._notify();
        return true;
    }

    cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.RUNNING) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Cancelled: ${task.label}`);
        this._notify();
        return true;
    }

    skipTesting(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.RUNNING) return false;
        // Jump to end of subtasks
        task.subtaskIndex = task.subtaskDurations.length;
        this._addLog(`Skipped regression testing: ${task.label}`);
        return true;
    }

    startTestWorkflow() {
        if (this.testWorkflow && !this.testWorkflow.isComplete) return false;

        const snapshot = {};
        for (const [nodeId, phase] of this.allPhases) {
            snapshot[nodeId] = phase.completion;
        }

        this.testWorkflow = new TestWorkflow(
            this.simulatedTime,
            this.config.testWorkflowDuration,
            snapshot
        );
        this._addLog('Test workflow started');
        this._notify();
        return true;
    }

    cancelTestWorkflow() {
        if (!this.testWorkflow || this.testWorkflow.isComplete) return false;
        this.testWorkflow = null;
        this._addLog('Test workflow cancelled');
        this._notify();
        return true;
    }

    // --- Game loop ---

    tick(dtReal) {
        if (this.paused) return;

        const dt = dtReal * this.config.timeScale * this.speedMultiplier / 60.0;
        this.simulatedTime += dt;

        // Weekly credit refresh
        if (this.simulatedTime - this.weekStart >= this.config.weekDuration) {
            this.creditsRemaining = this.config.weeklyCredits;
            this.weekStart = this.simulatedTime;
            this._addLog('Weekly credits refreshed!');
        }

        // Update tasks
        let stateChanged = false;
        for (const task of this.tasks) {
            if (task.status !== TaskStatus.RUNNING) continue;
            if (this._tickTask(task, dt)) {
                stateChanged = true;
            }
        }

        // Update test workflow
        if (this.testWorkflow && !this.testWorkflow.isComplete) {
            const elapsed = this.simulatedTime - this.testWorkflow.startedAt;
            if (elapsed >= this.testWorkflow.duration) {
                this._completeTestWorkflow();
                stateChanged = true;
            }
        }

        if (stateChanged) {
            this._updateLockStatus();
            this._notify();
        }
    }

    _tickTask(task, dt) {
        // Consume credits
        const creditCost = dt * this.config.creditRate;
        if (this.creditsRemaining <= 0) return false;
        this.creditsRemaining = Math.max(0, this.creditsRemaining - creditCost);
        task.creditsUsed += creditCost;

        // Check if task is done
        if (task.subtaskIndex >= task.subtaskDurations.length) {
            this._completeTask(task);
            return true;
        }

        // Advance subtask
        const subtaskDuration = task.subtaskDurations[task.subtaskIndex];
        task.subtaskProgress += dt / subtaskDuration;
        task.subtaskLabel = task.currentSubtask || 'finishing';

        if (task.subtaskProgress >= 1.0) {
            task.subtaskProgress = 0;
            task.subtaskIndex++;

            // After main subtasks: roll for inline regression
            if (task.subtaskIndex >= IMPLEMENT_SUBTASKS.length &&
                task.subtaskIndex === IMPLEMENT_SUBTASKS.length) {
                if (this._rollInlineRegression()) {
                    const fixDur = this.config.baseTaskDuration *
                        Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
                    const testDur = this.config.baseTaskDuration * 0.5 *
                        Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
                    task.subtaskDurations.push(fixDur, testDur);
                    task.regressionFixCycles++;
                    this._addLog(`${task.label}: found regression during testing, fixing`);
                }
            }

            // Update label
            task.subtaskLabel = task.currentSubtask || 'finishing';
        }

        task.progress = task.overallProgress;
        return false;
    }

    _rollInlineRegression() {
        return this.rng.random() < this.config.regressionRate &&
               this.rng.random() < this.config.inlineRegressionCatchRate;
    }

    _completeTask(task) {
        const target = this.allPhases.get(task.targetNodeId);
        if (!target) {
            task.status = TaskStatus.FAILED;
            task.completedAt = this.simulatedTime;
            return;
        }

        if (task.type === TaskType.IMPLEMENT) {
            // Check for merge conflict
            if (this._checkMergeConflict(task)) {
                task.status = TaskStatus.MERGE_CONFLICT;
                task.completedAt = this.simulatedTime;
                this._addLog(`MERGE CONFLICT: ${task.label}`);
                return;
            }

            // Apply progress
            const old = target.completion;
            target.completion = Math.min(1.0, target.completion + this.config.implementProgressPerTask);
            task.status = TaskStatus.COMPLETED;
            task.completedAt = this.simulatedTime;
            this._addLog(`Completed: ${task.label} (${Math.round(old * 100)}% → ${Math.round(target.completion * 100)}%)`);

            // Roll for regression (hidden until tests are run)
            if (this.rng.random() < this.config.regressionRate) {
                this._applyHiddenRegression(task.targetNodeId);
            }

        } else if (task.type === TaskType.MERGE_CONFLICT) {
            // Merge resolution: apply progress
            const old = target.completion;
            target.completion = Math.min(1.0, target.completion + this.config.implementProgressPerTask);
            task.status = TaskStatus.COMPLETED;
            task.completedAt = this.simulatedTime;
            this._addLog(`Merge resolved: ${task.targetNodeId} (${Math.round(old * 100)}% → ${Math.round(target.completion * 100)}%)`);

            if (this.rng.random() < this.config.regressionRate) {
                this._applyHiddenRegression(task.targetNodeId);
            }
        }
    }

    _checkMergeConflict(completingTask) {
        const completingFeature = completingTask.targetFeatureId;

        for (const other of this.tasks) {
            if (other.id === completingTask.id) continue;
            if (other.status !== TaskStatus.RUNNING) continue;

            if (other.targetFeatureId === completingFeature) {
                return this.rng.random() < this.config.mergeConflictRate;
            }

            // Shared dependencies
            const cPhase = this.allPhases.get(completingTask.targetNodeId);
            const oPhase = this.allPhases.get(other.targetNodeId);
            if (cPhase && oPhase) {
                const cDeps = new Set(cPhase.dependsOn.map(d => d.split('.')[0]));
                const oDeps = new Set(oPhase.dependsOn.map(d => d.split('.')[0]));
                for (const d of cDeps) {
                    if (oDeps.has(d)) {
                        return this.rng.random() < this.config.mergeConflictRate * 0.5;
                    }
                }
            }
        }
        return false;
    }

    _applyHiddenRegression(sourceNodeId) {
        // Regressions are hidden — they reduce actual completion but the UI
        // won't show them until the test workflow runs and detects them.
        const sourcePhase = this.allPhases.get(sourceNodeId);
        if (!sourcePhase) return;

        const roll = this.rng.random();
        let target;

        if (roll < this.config.regressionLocalWeight) {
            target = sourcePhase;
        } else if (roll < this.config.regressionLocalWeight + this.config.regressionAdjacentWeight) {
            const feature = this.features.get(sourcePhase.featureId);
            const candidates = feature.phases.filter(
                p => p.nodeId !== sourceNodeId && p.completion > 0
            );
            target = candidates.length > 0
                ? candidates[Math.floor(this.rng.random() * candidates.length)]
                : sourcePhase;
        } else {
            const candidates = [...this.allPhases.values()].filter(
                p => p.completion > 0 && p.nodeId !== sourceNodeId
            );
            target = candidates.length > 0
                ? candidates[Math.floor(this.rng.random() * candidates.length)]
                : sourcePhase;
        }

        const severity = Math.abs(this.rng.gauss(this.config.regressionSeverityMean, 0.05));
        target.completion = Math.max(0, target.completion - severity);
        // Note: no log entry here — regressions are hidden until tests detect them
    }

    _completeTestWorkflow() {
        if (!this.testWorkflow) return;

        const results = {};
        // Compare current completion to snapshot to detect regressions
        for (const [nodeId, snapshotCompletion] of Object.entries(this.testWorkflow.completionSnapshot)) {
            const phase = this.allPhases.get(nodeId);
            if (!phase) continue;
            const noise = this.rng.gauss(0, 0.03);
            const matchRate = Math.max(0, Math.min(1, phase.completion + noise));
            results[nodeId] = matchRate;
        }

        this.testWorkflow.results = results;

        // Update test results
        for (const [, test] of this.tests) {
            let totalLines = 0;
            let matchingLines = 0;
            for (const featId of test.relatedFeatureIds) {
                const feature = this.features.get(featId);
                if (!feature) continue;
                for (const phase of feature.phases) {
                    const rate = results[phase.nodeId];
                    if (rate !== undefined) {
                        totalLines += 100; // simulated line count
                        matchingLines += Math.round(rate * 100);
                    }
                }
            }
            test.linesTotal = totalLines;
            test.linesMatching = matchingLines;
            test.lastUpdated = this.simulatedTime;

            if (totalLines === 0) {
                test.status = 'unknown';
            } else if (matchingLines >= totalLines * 0.95) {
                test.status = 'pass';
            } else if (matchingLines >= totalLines * 0.5) {
                test.status = 'partial';
            } else {
                test.status = 'fail';
            }
        }

        const passing = [...this.tests.values()].filter(t => t.status === 'pass').length;
        this._addLog(`Tests complete: ${passing}/${this.tests.size} passing`);
        this._notify();
    }

    // --- Utilities ---

    get timeStr() {
        const totalMinutes = this.simulatedTime;
        const day = Math.floor(totalMinutes / (24 * 60)) + 1;
        const dayMinutes = totalMinutes % (24 * 60);
        const hours = Math.floor(dayMinutes / 60);
        const minutes = Math.floor(dayMinutes % 60);
        return `Day ${day} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    get creditHours() {
        return this.creditsRemaining / 60.0;
    }

    get overallProgress() {
        if (this.allPhases.size === 0) return 0;
        let sum = 0;
        for (const p of this.allPhases.values()) sum += p.completion;
        return sum / this.allPhases.size;
    }

    get isComplete() {
        for (const p of this.allPhases.values()) {
            if (!p.isComplete) return false;
        }
        return true;
    }

    get testWorkflowProgress() {
        if (!this.testWorkflow || this.testWorkflow.isComplete) return null;
        const elapsed = this.simulatedTime - this.testWorkflow.startedAt;
        return Math.min(elapsed / this.testWorkflow.duration, 1.0);
    }

    _addLog(message) {
        const entry = `[${this.timeStr}] ${message}`;
        this.log.push(entry);
        if (this.log.length > 200) this.log.shift();
        if (this.onLogEntry) this.onLogEntry(entry);
    }

    _notify() {
        if (this.onStateChanged) this.onStateChanged();
    }

    setSeed(seed) {
        this.rng = new SeededRandom(seed);
    }
}

export {
    GameState,
    SimulationConfig,
    TaskType,
    TaskStatus,
    SubtaskType,
    Phase,
    Feature,
    Task,
    TestResult,
};
