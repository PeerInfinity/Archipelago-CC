// frontend/modules/stateManager/ruleEngine.js

// Remove stateManagerSingleton import and getter
// import stateManagerSingleton from './stateManagerSingleton.js';
// function getStateManager() {
//   return stateManagerSingleton.instance;
// }

// Evaluation trace object for capturing debug info
class RuleTrace {
  constructor(rule, depth) {
    this.type = rule?.type || 'unknown';
    this.rule = rule;
    this.depth = depth;
    this.children = [];
    this.result = null;
    this.startTime = new Date().toISOString();
    this.endTime = null;
  }

  addChild(child) {
    this.children.push(child);
  }

  complete(result) {
    this.result = result;
    this.endTime = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      type: this.type,
      rule: this.rule,
      depth: this.depth,
      result: this.result,
      startTime: this.startTime,
      endTime: this.endTime,
      children: this.children,
    };
  }
}

/**
 * Recursively checks if a rule object contains defeat methods in its chain
 * @param {Object} ruleObj - The rule object to check
 * @param {StateSnapshotInterface} stateSnapshotInterface - Provides state access methods
 * @returns {boolean} - True if a defeat method was found in the chain
 */
function hasDefeatMethod(ruleObj, stateSnapshotInterface) {
  if (!ruleObj || typeof ruleObj !== 'object') return false;

  // Check if this is an attribute access to can_defeat or defeat_rule
  if (
    ruleObj.type === 'attribute' &&
    (ruleObj.attr === 'can_defeat' || ruleObj.attr === 'defeat_rule')
  ) {
    return true;
  }

  // Recursively check object property for attribute chains
  if (ruleObj.object) {
    // Pass the interface down
    return hasDefeatMethod(ruleObj.object, stateSnapshotInterface);
  }

  // Check function property for function calls
  if (ruleObj.function) {
    // Pass the interface down
    return hasDefeatMethod(ruleObj.function, stateSnapshotInterface);
  }

  return false;
}

function safeLog(message, level = 'debug') {
  if (
    window.consoleManager &&
    typeof window.consoleManager[level] === 'function'
  ) {
    window.consoleManager[level](message);
  } else {
    console[level] ? console[level](message) : console.log(message);
  }
}

/**
 * Specifically checks if a rule is a boss defeat check using targeted pattern matching
 * @param {Object} rule - The rule object to check
 * @param {StateSnapshotInterface} stateSnapshotInterface - Provides state access methods
 * @returns {boolean} - True if this is a boss defeat check
 */
function isBossDefeatCheck(rule, stateSnapshotInterface) {
  // Direct check for simple cases
  if (
    rule.type === 'attribute' &&
    (rule.attr === 'can_defeat' || rule.attr === 'defeat_rule')
  ) {
    return true;
  }

  // Check for the specific nested structure we're seeing in Desert Palace - Prize
  if (
    rule.type === 'function_call' &&
    rule.function &&
    rule.function.type === 'attribute'
  ) {
    // Check if the attribute is 'can_defeat'
    if (
      rule.function.attr === 'can_defeat' ||
      rule.function.attr === 'defeat_rule'
    ) {
      return true;
    }

    // Check deeper in the chain if we have a boss or dungeon reference
    let current = rule.function.object;
    while (current) {
      if (current.type === 'attribute') {
        // If we see boss or dungeon in the chain, consider it a boss defeat check
        if (current.attr === 'boss' || current.attr === 'dungeon') {
          return true;
        }
        current = current.object;
      } else {
        break;
      }
    }
  }

  return false;
}

/**
 * Evaluates a rule against the provided state snapshot.
 * @param {any} rule - The rule object (or primitive) to evaluate.
 * @param {object} stateSnapshotInterface - An object providing methods to access state (e.g., hasItem, hasFlag, getSetting).
 * @param {number} [depth=0] - Current recursion depth for debugging.
 * @returns {boolean|any} - The result of the rule evaluation.
 */
export const evaluateRule = (rule, stateSnapshotInterface, depth = 0) => {
  if (!rule) {
    return true; // Empty rule is true
  }

  // Validate the state snapshot interface (basic check)
  if (
    !stateSnapshotInterface ||
    typeof stateSnapshotInterface.hasItem !== 'function'
  ) {
    console.error(
      '[evaluateRule] Invalid or missing stateSnapshotInterface provided.',
      { rule }
    );
    // Depending on strictness, either throw an error or return false
    // Returning false might mask issues but prevents crashes.
    return false;
  }

  // Create trace object for this evaluation
  const trace = new RuleTrace(rule, depth);

  let result = false;
  // Use a consistent type check for the rule itself
  const ruleType = rule?.type;

  switch (ruleType) {
    case 'helper': {
      // Check if the snapshot interface provides a way to execute helpers
      if (typeof stateSnapshotInterface.executeHelper === 'function') {
        // Process arguments - they may be complex objects needing evaluation
        const processedArgs = (rule.args || []).map((arg) => {
          if (arg && typeof arg === 'object' && arg.type) {
            // Recursively evaluate argument using the same snapshot interface
            return evaluateRule(arg, stateSnapshotInterface, depth + 1);
          }
          return arg; // Primitives or non-rule objects passed as-is
        });

        try {
          result = stateSnapshotInterface.executeHelper(
            rule.name,
            ...processedArgs
          );
        } catch (e) {
          console.error(
            `[evaluateRule] Error executing helper '${rule.name}' via snapshot interface:`,
            e,
            { args: processedArgs }
          );
          result = false;
        }
      } else {
        console.warn(
          `[evaluateRule] stateSnapshotInterface does not provide executeHelper method. Cannot execute helper: ${rule.name}`
        );
        result = false;
      }
      break;
    }

    case 'and': {
      result = true;
      for (const condition of rule.conditions || []) {
        // Add default empty array
        const conditionResult = evaluateRule(
          condition,
          stateSnapshotInterface,
          depth + 1
        );
        trace.addChild(
          new RuleTrace(condition, depth + 1).complete(conditionResult)
        );
        if (!conditionResult) {
          result = false;
          break; // Short-circuit
        }
      }
      break;
    }

    case 'or': {
      result = false;
      for (const condition of rule.conditions || []) {
        // Add default empty array
        const conditionResult = evaluateRule(
          condition,
          stateSnapshotInterface,
          depth + 1
        );
        trace.addChild(
          new RuleTrace(condition, depth + 1).complete(conditionResult)
        );
        if (conditionResult) {
          result = true;
          break; // Short-circuit
        }
      }
      break;
    }

    case 'item_check': {
      let itemName;
      if (typeof rule.item === 'string') {
        itemName = rule.item;
      } else if (rule.item && rule.item.type === 'constant') {
        itemName = rule.item.value;
      } else if (rule.item) {
        // Evaluate complex item expression
        itemName = evaluateRule(rule.item, stateSnapshotInterface, depth + 1);
      }

      if (typeof itemName === 'string') {
        try {
          result = stateSnapshotInterface.hasItem(itemName);
        } catch (e) {
          console.error(
            `[evaluateRule] Error calling hasItem for '${itemName}':`,
            e
          );
          result = false;
        }
      } else {
        console.warn(
          '[evaluateRule] item_check resolved to non-string value:',
          itemName
        );
        result = false;
      }
      break;
    }

    case 'count_check': {
      let itemName;
      let requiredCount = 0;

      // Resolve item name
      if (typeof rule.item === 'string') {
        itemName = rule.item;
      } else if (rule.item?.type === 'constant') {
        itemName = rule.item.value;
      } else if (rule.item) {
        itemName = evaluateRule(rule.item, stateSnapshotInterface, depth + 1);
      }

      // Resolve required count
      if (typeof rule.count === 'number') {
        requiredCount = rule.count;
      } else if (rule.count?.type === 'constant') {
        requiredCount = Number(rule.count.value); // Ensure numeric
      } else if (rule.count) {
        requiredCount = Number(
          evaluateRule(rule.count, stateSnapshotInterface, depth + 1)
        ); // Ensure numeric
      }

      if (typeof itemName === 'string' && !isNaN(requiredCount)) {
        try {
          const currentCount = stateSnapshotInterface.countItem(itemName);
          result = currentCount >= requiredCount;
        } catch (e) {
          console.error(
            `[evaluateRule] Error calling countItem for '${itemName}':`,
            e
          );
          result = false;
        }
      } else {
        console.warn('[evaluateRule] count_check had invalid item or count:', {
          itemName,
          requiredCount,
        });
        result = false;
      }
      break;
    }

    case 'group_check': {
      // Added Group Check
      let groupName;
      let requiredCount = 0;

      // Resolve group name
      if (typeof rule.group === 'string') {
        groupName = rule.group;
      } else if (rule.group?.type === 'constant') {
        groupName = rule.group.value;
      } else if (rule.group) {
        groupName = evaluateRule(rule.group, stateSnapshotInterface, depth + 1);
      }

      // Resolve required count
      if (typeof rule.count === 'number') {
        requiredCount = rule.count;
      } else if (rule.count?.type === 'constant') {
        requiredCount = Number(rule.count.value);
      } else if (rule.count) {
        requiredCount = Number(
          evaluateRule(rule.count, stateSnapshotInterface, depth + 1)
        );
      }

      if (
        typeof groupName === 'string' &&
        !isNaN(requiredCount) &&
        typeof stateSnapshotInterface.countGroup === 'function'
      ) {
        try {
          const currentCount = stateSnapshotInterface.countGroup(groupName);
          result = currentCount >= requiredCount;
        } catch (e) {
          console.error(
            `[evaluateRule] Error calling countGroup for '${groupName}':`,
            e
          );
          result = false;
        }
      } else {
        if (typeof stateSnapshotInterface.countGroup !== 'function')
          console.warn(
            '[evaluateRule] countGroup not available on snapshot interface.'
          );
        console.warn('[evaluateRule] group_check had invalid group or count:', {
          groupName,
          requiredCount,
        });
        result = false;
      }
      break;
    }

    case 'setting_check': {
      // Added Setting Check
      let settingName;
      let expectedValue = true; // Default assumption for boolean settings

      // Resolve setting name
      if (typeof rule.setting === 'string') {
        settingName = rule.setting;
      } else if (rule.setting?.type === 'constant') {
        settingName = rule.setting.value;
      } else if (rule.setting) {
        settingName = evaluateRule(
          rule.setting,
          stateSnapshotInterface,
          depth + 1
        );
      }

      // Resolve expected value (if provided)
      if (rule.value !== undefined) {
        if (rule.value?.type) {
          expectedValue = evaluateRule(
            rule.value,
            stateSnapshotInterface,
            depth + 1
          );
        } else {
          expectedValue = rule.value;
        }
      }

      if (
        typeof settingName === 'string' &&
        typeof stateSnapshotInterface.getSetting === 'function'
      ) {
        try {
          const actualValue = stateSnapshotInterface.getSetting(settingName);
          result = actualValue === expectedValue;
        } catch (e) {
          console.error(
            `[evaluateRule] Error calling getSetting for '${settingName}':`,
            e
          );
          result = false;
        }
      } else {
        if (typeof stateSnapshotInterface.getSetting !== 'function')
          console.warn(
            '[evaluateRule] getSetting not available on snapshot interface.'
          );
        console.warn('[evaluateRule] setting_check had invalid setting name:', {
          settingName,
        });
        result = false;
      }
      break;
    }

    case 'state_method': {
      // Added State Method execution
      if (
        typeof stateSnapshotInterface.executeStateManagerMethod === 'function'
      ) {
        const processedArgs = (rule.args || []).map((arg) => {
          if (arg && typeof arg === 'object' && arg.type) {
            return evaluateRule(arg, stateSnapshotInterface, depth + 1);
          }
          return arg;
        });
        try {
          result = stateSnapshotInterface.executeStateManagerMethod(
            rule.method,
            ...processedArgs
          );
        } catch (e) {
          console.error(
            `[evaluateRule] Error executing state method '${rule.method}' via snapshot interface:`,
            e,
            { args: processedArgs }
          );
          result = false;
        }
      } else {
        console.warn(
          `[evaluateRule] stateSnapshotInterface does not provide executeStateManagerMethod. Cannot execute: ${rule.method}`
        );
        result = false;
      }
      break;
    }

    case 'constant': {
      // Constants simply evaluate to their value
      result = rule.value;
      break;
    }

    case 'attribute': {
      // Evaluate the base object
      const baseObject = evaluateRule(
        rule.object,
        stateSnapshotInterface,
        depth + 1
      );
      // Access the attribute if the base object is valid
      if (baseObject !== null && baseObject !== undefined) {
        try {
          result = baseObject[rule.attr];
        } catch (e) {
          console.error(
            `[evaluateRule] Error accessing attribute '${rule.attr}' on object:`,
            { baseObject, error: e }
          );
          result = undefined; // Indicate failure to access
        }
      } else {
        result = undefined; // Indicate failure to access
      }
      break;
    }

    case 'function_call': {
      // This is complex. Could be calling a helper, state method, or something else.
      // Simplified: Assume it resolves to a callable function (perhaps via state_method or helper)
      // Proper implementation would need to evaluate rule.function to get the function reference.
      // For now, let's try treating it like a state_method call if the structure fits
      if (rule.function?.type === 'attribute' && rule.function?.object?.type) {
        // Heuristic: looks like object.method()
        const methodName = rule.function.attr;
        if (
          typeof stateSnapshotInterface.executeStateManagerMethod === 'function'
        ) {
          const processedArgs = (rule.args || []).map((arg) => {
            if (arg && typeof arg === 'object' && arg.type) {
              return evaluateRule(arg, stateSnapshotInterface, depth + 1);
            }
            return arg;
          });
          try {
            // This assumes the method exists on the conceptual 'state manager' represented by the interface
            result = stateSnapshotInterface.executeStateManagerMethod(
              methodName,
              ...processedArgs
            );
          } catch (e) {
            console.error(
              `[evaluateRule] Error executing method '${methodName}' from function_call:`,
              e,
              { args: processedArgs }
            );
            result = false;
          }
        } else {
          console.warn(
            `[evaluateRule] Cannot execute function_call '${methodName}', executeStateManagerMethod not available.`
          );
          result = false;
        }
      } else {
        console.warn('[evaluateRule] Unhandled function_call type:', rule);
        result = false;
      }
      break;
    }

    // START NEW CASE
    case 'conditional': {
      // Evaluate the test condition first
      const testResult = evaluateRule(rule.test, stateSnapshotInterface);
      // Evaluate the appropriate branch based on the test result
      const branchToEvaluate = testResult ? rule.if_true : rule.if_false;
      if (branchToEvaluate) {
        return evaluateRule(branchToEvaluate, stateSnapshotInterface);
      } else {
        // If the chosen branch doesn't exist, the condition effectively evaluates to false/unmet
        // (or true if testResult was true and only if_true existed, but standard is usually false if branch missing)
        return false;
      }
    }
    // END NEW CASE

    // START NEW COMPARE CASE
    case 'compare': {
      const leftValue = evaluateRule(
        rule.left,
        stateSnapshotInterface,
        depth + 1
      );
      const rightValue = evaluateRule(
        rule.right,
        stateSnapshotInterface,
        depth + 1
      );
      switch (rule.op) {
        case '==':
          result = leftValue === rightValue;
          break;
        case '!=':
          result = leftValue !== rightValue;
          break;
        case '>':
          result = leftValue > rightValue;
          break;
        case '>=':
          result = leftValue >= rightValue;
          break;
        case '<':
          result = leftValue < rightValue;
          break;
        case '<=':
          result = leftValue <= rightValue;
          break;
        default:
          console.warn(
            `[evaluateRule] Unknown comparison operator: ${rule.op}`
          );
          result = false;
      }
      break;
    }
    // END NEW COMPARE CASE

    // START NEW LIST CASE
    case 'list': {
      // Evaluate each element in the list
      result = (rule.value || []).map((element) =>
        evaluateRule(element, stateSnapshotInterface, depth + 1)
      );
      break;
    }
    // END NEW LIST CASE

    // START NEW NAME CASE
    case 'name': {
      // Attempt to resolve the name from the snapshot context
      // Simple cases first: player slot?
      if (
        rule.name === 'player' &&
        typeof stateSnapshotInterface.getPlayerSlot === 'function'
      ) {
        result = stateSnapshotInterface.getPlayerSlot();
      } else {
        // TODO: Need a more general way to resolve names/variables
        // console.warn(`[evaluateRule] Unhandled name reference: ${rule.name}`);
        result = undefined; // Return undefined for unresolved names
      }
      break;
    }
    // END NEW NAME CASE

    // Basic types / Fallback
    case 'string':
    case 'number':
    case 'boolean':
      result = rule; // Primitives evaluate to themselves in this context
      break;

    default:
      // If the rule is just a string (legacy format? e.g., region name for can_reach)
      // Handle simple string rules as potential region checks for can_reach? Risky.
      // Let's explicitly require rule objects for clarity.
      if (typeof rule === 'string') {
        console.warn(
          `[evaluateRule] Encountered raw string rule '${rule}'. Evaluation logic might be incomplete. Assuming false.`
        );
        result = false;
      } else {
        console.warn('[evaluateRule] Unknown rule type:', ruleType, rule);
        result = false; // Default to false for unknown types
      }
  }

  // Complete the trace
  trace.complete(result);
  // TODO: Add trace logging/storage if needed

  return result;
};

// Debugging helper function for visualizing rule structures in console
export function debugRule(rule, indent = 0) {
  const prefix = ' '.repeat(indent);

  if (!rule) {
    console.log(`${prefix}null or undefined rule`);
    return;
  }

  console.log(`${prefix}Type: ${rule.type}`);

  switch (rule.type) {
    case 'constant':
      console.log(`${prefix}Value: ${rule.value}`);
      break;

    case 'name':
      console.log(`${prefix}Name: ${rule.name}`);
      break;

    case 'attribute':
      console.log(`${prefix}Attribute: ${rule.attr}`);
      console.log(`${prefix}Object:`);
      debugRule(rule.object, indent + 2);
      break;

    case 'subscript':
      console.log(`${prefix}Subscript:`);
      console.log(`${prefix}  Value:`);
      debugRule(rule.value, indent + 4);
      console.log(`${prefix}  Index:`);
      debugRule(rule.index, indent + 4);
      break;

    case 'function_call':
      console.log(`${prefix}Function Call:`);
      console.log(`${prefix}  Function:`);
      debugRule(rule.function, indent + 4);
      console.log(`${prefix}  Args:`);
      (rule.args || []).forEach((arg, i) => {
        console.log(`${prefix}    Arg ${i + 1}:`);
        debugRule(arg, indent + 6);
      });
      break;

    case 'item_check':
      if (typeof rule.item === 'string') {
        console.log(`${prefix}Item: ${rule.item}`);
      } else {
        console.log(`${prefix}Item (complex):`);
        debugRule(rule.item, indent + 2);
      }
      break;

    case 'count_check':
      if (typeof rule.item === 'string') {
        console.log(`${prefix}Item: ${rule.item}`);
      } else {
        console.log(`${prefix}Item (complex):`);
        debugRule(rule.item, indent + 2);
      }

      if (typeof rule.count === 'number') {
        console.log(`${prefix}Count: ${rule.count}`);
      } else if (rule.count) {
        console.log(`${prefix}Count (complex):`);
        debugRule(rule.count, indent + 2);
      }
      break;

    case 'group_check':
      if (typeof rule.group === 'string') {
        console.log(`${prefix}Group: ${rule.group}`);
      } else {
        console.log(`${prefix}Group (complex):`);
        debugRule(rule.group, indent + 2);
      }

      console.log(`${prefix}Count: ${rule.count || 1}`);
      break;

    case 'helper':
      console.log(`${prefix}Helper: ${rule.name}`);
      if (rule.args && rule.args.length > 0) {
        console.log(`${prefix}Args:`);
        rule.args.forEach((arg, i) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            console.log(`${prefix}  Arg ${i + 1}: ${arg}`);
          } else {
            console.log(`${prefix}  Arg ${i + 1} (complex):`);
            debugRule(arg, indent + 4);
          }
        });
      }
      break;

    case 'and':
    case 'or':
      console.log(
        `${prefix}${rule.type.toUpperCase()} with ${
          rule.conditions.length
        } conditions:`
      );
      rule.conditions.forEach((cond, i) => {
        console.log(`${prefix}  Condition ${i + 1}:`);
        debugRule(cond, indent + 4);
      });
      break;

    case 'state_method':
      console.log(`${prefix}Method: ${rule.method}`);
      if (rule.args && rule.args.length > 0) {
        console.log(`${prefix}Args:`);
        rule.args.forEach((arg, i) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            console.log(`${prefix}  Arg ${i + 1}: ${arg}`);
          } else {
            console.log(`${prefix}  Arg ${i + 1} (complex):`);
            debugRule(arg, indent + 4);
          }
        });
      }
      break;

    case 'comparison':
      console.log(`${prefix}Comparison: ${rule.op}`);
      console.log(`${prefix}Left:`);
      if (typeof rule.left === 'object' && rule.left.type) {
        debugRule(rule.left, indent + 2);
      } else {
        console.log(`${prefix}  ${rule.left}`);
      }

      console.log(`${prefix}Right:`);
      if (typeof rule.right === 'object' && rule.right.type) {
        debugRule(rule.right, indent + 2);
      } else {
        console.log(`${prefix}  ${rule.right}`);
      }
      break;

    default:
      console.log(`${prefix}${JSON.stringify(rule, null, 2)}`);
  }
}

/**
 * Helper to extract function path from a Python AST function node
 * @param {Object} funcNode - Function node from the AST
 * @returns {string} - Extracted function path
 */
export function extractFunctionPath(funcNode) {
  if (!funcNode) return '(unknown)';

  if (funcNode.type === 'attribute') {
    // Handle attribute access (e.g., foo.bar)
    const objectPath = extractFunctionPath(funcNode.object);
    return `${objectPath}.${funcNode.attr}`;
  } else if (funcNode.type === 'name') {
    // Handle direct name (e.g., function_name)
    return funcNode.name;
  } else if (funcNode.type === 'subscript') {
    // Handle subscript access (e.g., foo[bar])
    return `${extractFunctionPath(funcNode.value)}[...]`;
  } else {
    // Other node types
    return `(${funcNode.type})`;
  }
}

/**
 * Log a Python AST structure with better formatting
 * @param {Object} rule - The AST node to visualize
 */
export function debugPythonAST(rule) {
  if (!rule) {
    console.log('null or undefined rule');
    return;
  }

  console.group(`Python AST Node: ${rule.type}`);

  switch (rule.type) {
    case 'function_call':
      console.log(`Function: ${extractFunctionPath(rule.function)}`);
      console.log('Arguments:');
      (rule.args || []).forEach((arg, i) => {
        console.group(`Arg ${i + 1}:`);
        debugPythonAST(arg);
        console.groupEnd();
      });
      break;

    case 'attribute':
      console.log(`Attribute: ${rule.attr}`);
      console.log('Object:');
      debugPythonAST(rule.object);
      break;

    case 'subscript':
      console.log('Value:');
      debugPythonAST(rule.value);
      console.log('Index:');
      debugPythonAST(rule.index);
      break;

    case 'name':
      console.log(`Name: ${rule.name}`);
      break;

    case 'constant':
      console.log(`Constant: ${rule.value}`);
      break;

    default:
      console.log(`${JSON.stringify(rule, null, 2)}`);
  }

  console.groupEnd();
}
