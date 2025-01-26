# Development Planning

## Vision
Create a robust system for using Archipelago's location access rules in web-based applications, enabling:
- Accurate client-side location checking
- Development of new web interfaces
- Enhanced testing capabilities

## Current Status

### Working Features

#### Rule Export System
- JSON export format defined and implemented
- Basic location/region relationships exported
- Simple rules successfully converted
  - Item checks
  - Basic AND/OR operations
  - Group checks

#### Frontend Implementation
- Basic inventory management
- Location accessibility checking
- Rule evaluation engine
- Filtering and sorting
- Visual indication of new locations

#### Testing Framework
- Basic test runner functioning
- JSON test case format defined
- Comparison with Python results

### Current Challenges

#### Rule Analysis
- Helper function conversion needs improvement
- Closure variable handling not complete
- Complex conditional rules need better support
- Some lambda expressions fail to parse

#### Frontend Implementation
- Need better error handling
- Debug tools could be improved
- Code organization needs refinement
- Performance untested with large rulesets

#### Data Export
- May need to expand JSON format
- Missing some advanced rule types
- Export configuration limited

## Development Priorities

### 1. Rule System Completion (High Priority)
- [ ] Fix complex helper function parsing
- [ ] Implement proper closure handling
- [ ] Support all rule patterns
- [ ] Improve lambda expression analysis
- [ ] Add error recovery for failed conversions
- [ ] Add option to enable/disable JSON file saving (similar to spoiler file option)

### 2. Testing Infrastructure (High Priority)
- [ ] Automate test execution
- [ ] Support multiple test files
- [ ] Create comprehensive test suite
- [ ] Add performance benchmarks
- [ ] Generate test data sets

### 3. Frontend Development (Medium Priority)
- [ ] Improve rule inspection tools
- [ ] Enhance error messages
- [ ] Add advanced filtering
- [ ] Create visual rule debugger
- [ ] Improve component organization
- [ ] Add robust state management
- [ ] Enhance accessibility

### 4. Archipidle Integration (Medium Priority)
- [ ] Properly integrate with console
- [ ] Sync inventory state
- [ ] Connect to server functionality
- [ ] Handle multiplayer features
- [ ] Support game progress tracking

### 5. Performance Optimization (Lower Priority)
- [ ] Profile rule evaluation
- [ ] Optimize React rendering
- [ ] Implement caching
- [ ] Add lazy loading
- [ ] Monitor memory usage

### 6. Documentation & Release (Ongoing)
- [ ] Complete user guides
- [ ] Add API documentation
- [ ] Write contribution guidelines
- [ ] Create example implementations
- [ ] Document deployment process

### 7. Code Style (Lower Priority)
- [ ] Update Python string quotes to match style guide
- [ ] Adjust JavaScript/HTML/CSS indentation
- [ ] Add type annotations in Python code
- [ ] Add docstrings to new classes
- [ ] Standardize JavaScript quote usage

## Technical Details

### Rule Format
```javascript
{
  "type": String,     // Rule type (item_check, helper, and, or, etc.)
  "conditions": Array, // For composite rules
  "item": String,     // For item checks
  "count": Number,    // For counting rules
  "name": String,     // For helper functions
  "args": Array       // For helper function arguments
}
```

### Supported Rule Types
1. Basic Rules
   - item_check: Item requirements
   - count_check: Item quantity requirements
   - group_check: Item group requirements
   - helper: Known helper functions

2. Composite Rules
   - and: Multiple required conditions
   - or: Alternative conditions

3. Planned Complex Rules
   - lambda: Complex expressions
   - comparison: Numeric comparisons
   - conditional: State-based conditions

### Current Limitations
1. Rule Parsing
   - Complex lambda expressions may fail
   - Helper function context sometimes lost
   - Nested rules can cause issues
   - Some closure variables not captured

2. Frontend
   - Large ruleset performance unknown
   - Some edge cases in rule evaluation
   - Limited error recovery
   - Basic debugging tools

## Design Questions

### Rule System
1. How to handle very complex game-specific rules?
2. What's the best way to handle state-dependent rules?
3. How to maintain rule version compatibility?

### Frontend Design
1. What additional interfaces might be useful?
2. How to structure components for reusability?
3. What state management solution fits best?

### Integration
1. How to best integrate with Archipelago generation?
2. What's the optimal way to handle updates?
3. How to support different game types?

## Next Steps

### Immediate Tasks
1. Complete test automation
2. Fix remaining test failures
3. Document system architecture
4. Improve error handling

### Near-term Goals
1. Full rule system support
2. Enhanced debugging tools
3. Complete Archipidle integration
4. Performance optimization

### Long-term Vision
1. Multiple interface options
2. Plugin system for game-specific rules
3. Integrated testing framework
4. Comprehensive documentation

### Future Projects
1. Create Python client for rules system
2. Test lambda function consistency across configurations
3. Remove dill dependency if lambda functions prove consistent