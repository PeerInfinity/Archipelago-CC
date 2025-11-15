/**
 * Super Metroid helper functions for rule evaluation.
 *
 * Super Metroid uses a custom SMBoolManager system with evalSMBool patterns.
 * These helpers implement the JavaScript equivalents of the Python logic.
 */

/**
 * Evaluate an SMBool result against a difficulty threshold.
 *
 * In Python: evalSMBool(smbool, maxDiff) returns smbool.bool == True and smbool.difficulty <= maxDiff
 *
 * Since the frontend doesn't have the full SMBool system, we simplify:
 * - If the first arg (smbool) evaluates to a helper call to 'func', we assume it returns true
 * - Otherwise we evaluate the rule normally
 *
 * @param {Object} state - The game state
 * @param {Array} args - Arguments: [smbool_result, maxDiff]
 * @param {Object} ruleEngine - The rule engine instance
 * @returns {boolean} Whether the SMBool passes the difficulty check
 */
export function evalSMBool(state, args, ruleEngine) {
    if (!args || args.length < 2) {
        console.warn('[SM helpers] evalSMBool called with insufficient args:', args);
        return false;
    }

    const [smboolArg, maxDiffArg] = args;

    // Most traverse functions in SM return SMBool(True) with difficulty 0
    // For now, we simplify by treating evalSMBool(func(...), maxDiff) as always true
    // This handles the common case where traverse functions are lambda sm: SMBool(True)

    // If the smbool arg is a helper call to 'func', treat it as SMBool(True)
    if (smboolArg && smboolArg.type === 'helper' && smboolArg.name === 'func') {
        // func(...) is a traverse function, typically returns SMBool(True) for basic access
        return true;
    }

    // If it's a direct SMBool construction, evaluate it
    if (smboolArg && smboolArg.type === 'function_call' &&
        smboolArg.function && smboolArg.function.name === 'SMBool') {
        const args = smboolArg.args || [];
        if (args.length > 0) {
            // First arg is the boolean value
            const boolValue = ruleEngine.evaluateRule(args[0], state);
            if (!boolValue) {
                return false;
            }

            // Second arg (if present) is difficulty - default to 0
            const difficulty = args.length > 1 ? ruleEngine.evaluateRule(args[1], state) : 0;

            // Evaluate maxDiff
            const maxDiff = ruleEngine.evaluateRule(maxDiffArg, state);

            return difficulty <= maxDiff;
        }
    }

    // For other cases, try to evaluate the smbool arg directly as a boolean
    try {
        const result = ruleEngine.evaluateRule(smboolArg, state);
        return Boolean(result);
    } catch (e) {
        console.warn('[SM helpers] Failed to evaluate smbool arg:', e);
        return false;
    }
}

/**
 * Placeholder for 'func' helper calls.
 * These represent traverse functions from the VARIA randomizer.
 * Most return SMBool(True), so we default to true.
 *
 * @param {Object} state - The game state
 * @param {Array} args - Arguments to the function
 * @param {Object} ruleEngine - The rule engine instance
 * @returns {Object} SMBool-like result
 */
export function func(state, args, ruleEngine) {
    // Default traverse function behavior: always accessible (SMBool(True))
    return { bool: true, difficulty: 0 };
}

export default {
    evalSMBool,
    func
};
