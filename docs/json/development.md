# Development Documentation

## Vision

Create a robust system for using Archipelago's location access rules in web-based applications, enabling:

- Accurate client-side location checking
- Development of new web interfaces
- Enhanced testing capabilities
- Interactive region and path exploration

## Architecture

### Core Components

#### 1. Rule Export System

- Converts Python rule functions to standardized JSON format
- Preserves helper function references
- Handles complex rule patterns including boolean operations, method calls, and conditional expressions
- Exports region graph with entrances, exits, and other metadata

#### 2. Frontend Implementation

- Evaluates rules using native JavaScript helper functions
- Manages inventory and state through a centralized state manager
- Provides rule debugging capabilities
- Supports game-specific logic through helper implementations
- Implements BFS for region traversal and accessibility checks

#### 3. User Interface

- Multiple view modes: locations, regions, and test cases
- Interactive navigation between regions and locations
- Path discovery to visualize routes to regions
- Exit rule visualization to identify blocking conditions
- Inventory management with progressive item support

#### 4. Testing Infrastructure

- Automated test execution via Playwright
- Comprehensive debug logging
- Test result analysis and reporting
- Interactive test case execution from the UI

### Rule Processing Flow

1. Backend (Python)

   - Analyzer parses rule functions using AST
   - Converts to standardized JSON structure
   - Preserves helper function references
   - Exports complete region graph with rules

2. Frontend (JavaScript)
   - Loads exported rules
   - Implements helper functions natively
   - Evaluates rules using unified rule engine
   - Maintains game state and inventory
   - Computes region accessibility using BFS

### Supported Rule Types

1. Basic Rules

   - `item_check`: Direct item requirements
   - `count_check`: Item quantity requirements
   - `helper`: Preserved helper function references
   - `group_check`: Item group requirements
   - `constant`: Static boolean values

2. Composite Rules

   - `and`: Multiple required conditions
   - `or`: Alternative conditions
   - `comparison`: Numeric comparisons
   - `state_method`: State method calls

3. Special Rules
   - Conditional expressions
   - Nested helper calls
   - Progressive item handling
   - State flags and methods

## Implementation Status

### Working Features

- Complete rule analysis and export
- Helper function preservation and execution
- Inventory and state management
- Automated testing infrastructure
- Debug logging system
- Test result analysis
- Region traversal with BFS
- Path discovery and visualization
- Interactive region/location navigation
- Event item automatic collection

### Enhanced Analyzer Capabilities

The analyzer now properly handles:

- Complex lambda expressions
- Nested parentheses
- Multiline rules
- Method chains
- String literals and escaping
- Conditional expressions
- Return statements
- Boolean operations

### Debug Infrastructure

The debug system provides:

- Rule evaluation traces
- Inventory state logs
- Helper function execution logs
- Test execution details
- Step-by-step rule processing
- Performance metrics

### Region-Based Data Structure

The system now uses a comprehensive region-based format (v3) that includes:

- Complete region graph with entrances and exits
- Dungeon and shop data
- Game mode and settings
- Start region information
- Enhanced item and progression data

### State Management

The centralized state manager handles:

- Inventory tracking with progressive items
- Region accessibility calculation
- Event item collection
- Location access evaluation
- Game mode and settings

## Development Priorities

### 1. Rule System Completion (High Priority)

- [ ] Implement remaining helper functions (`old_man`, `basement_key_rule`, etc.)
- [ ] Fix edge cases in helper execution
- [ ] Enhance error handling and recovery
- [ ] Add option to enable/disable JSON file saving

### 2. Testing Infrastructure (Medium Priority)

- [ ] Add performance benchmarking
- [ ] Expand test coverage
- [ ] Enhance failure analysis
- [ ] Set up convenient test script loading

### 3. UI Enhancements (Medium Priority)

- [ ] Set up queuing system for game state updates
- [ ] Improve path visualization and filtering
- [ ] Add advanced inventory management options
- [ ] Implement caching strategies
- [ ] Add robust state management
- [ ] Enhance accessibility

### 4. Archipidle Integration (High Priority)

- [ ] Properly integrate with console
- [ ] Sync inventory state
- [ ] Connect to server functionality
- [ ] Handle multiplayer features
- [ ] Set up timer for location checks
- [ ] Support game progress tracking

### 5. Additional Features (Medium Priority)

- [ ] Implement event items for bosses
- [ ] Calculate steps to escape BK mode
- [ ] Add option to disable automatic event collection
- [ ] Support vanilla item placement

### 6. Performance Optimization (Lower Priority)

- [ ] Profile rule evaluation
- [ ] Optimize BFS implementation
- [ ] Implement caching
- [ ] Add lazy loading
- [ ] Monitor memory usage

### 7. Documentation & Release (Ongoing)

- [ ] Complete user guides
- [ ] Complete API documentation
- [ ] Add debugging guides
- [ ] Document helper implementations
- [ ] Create example implementations
- [ ] Document deployment process

## Technical Details

### JSON Export Format Version 3

The rule export system now uses a comprehensive region-based format that includes:

- Complete region graph with entrances and exits
- Dungeon and shop data
- Game mode and settings
- Start region information
- Enhanced item and progression data

This format is fully documented in `frontend/assets/types/alttp.d.ts` and replaces the previous location-based format.

### State Management Architecture

The state management system follows a singleton pattern:

- Central `stateManager` instance accessed by all components
- `inventory` tracks items including progressive items
- `state` handles game flags, mode, and settings
- BFS implementation for region traversal
- Automatic event item collection
- Cached region accessibility

### Helper Function System

Helper functions are:

- Implemented natively in JavaScript
- Match Python behavior exactly
- Access inventory and state via the stateManager
- Support debug logging
- Handle progressive items

### Rule Evaluation

- Recursive evaluation strategy
- Handles all rule types
- Supports tracing for debugging
- Provides error handling and fallbacks
