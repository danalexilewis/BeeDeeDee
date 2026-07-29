# Tasks Document: Behavior Workbench

## Implementation status

Implemented across ten phases. This section reconciles the plan below with what
actually shipped; the checkboxes have been updated to match.

**Delivered:** specification indexing with error recovery, the catalog dashboard,
the three-panel feature view, editor deep links for four editors, test result
ingestion for Playwright/Vitest/Jest, real-time status updates, an MCP server,
Gherkin linting, the CLI, and a test suite of 785 unit/integration tests plus 34
end-to-end.

### Deliberate substitutions

| Plan said | Shipped instead | Why |
| --- | --- | --- |
| `@eddy/behavior-next` with Next.js 14 App Router | `@eddy/behavior-web`, a Vite + React 19 SPA | Nothing here needs SSR, SEO, or server components. Fastify already existed for the watcher, and now serves the SPA too, so `behavior serve` is one process. |
| Zustand for state management | TanStack Query, Zod-validated URL search params, and panel-library storage | Server state, filter state, and layout state each already had a natural home. A third store had nothing left to hold. |
| Classes (`GherkinParser`, `BehaviorMCPServer`, `EditorLinkService`) | Factory functions returning plain objects | Repository convention; enforced by lint. Error classes became a tagged union a `switch` can exhaust. |
| WebSocket server for real-time updates | Server-sent events | Updates are one-directional. SSE needs no extra dependency and reconnects on its own. |
| `mermaid` package for diagram parsing | Plain text analysis | The library needs a DOM to render, which would put a browser dependency in the domain layer. Rendering stays in the SPA. |
| Husky git hooks | CI gates only | Hooks are per-clone and easily skipped; CI runs typecheck, lint, format, tests, and build on every push. |
| shadcn/ui via its CLI | Hand-written components on the same Tailwind token system | Seven small components did not justify a generator, and the tokens are what shared styling actually needs. |

### Not implemented, and why not

- **Incremental indexing, streaming parsing, caching layer, worker-thread parallelism, performance monitoring.** A full re-index of 1000 scenarios takes ~213ms against the design's 30-second budget, and 5000 takes ~3.8s. Every one of these optimisations would add machinery with no measurable problem to solve. Revisit if a project approaches the design's 10,000-scenario ceiling.
- **Manual test-to-scenario mapping via JSON files.** Heuristic matching plus the explicit `@scenario:<id>` tag covers the cases seen so far. `specPaths.mappings` is reserved in the config schema.
- **Coverage and quality trend tracking.** Both need a historical store the workbench does not have; it holds one current index in memory.
- **Interactive configuration wizard and config migration.** `behavior init` writes a documented starter file, which is enough while there is one config version.
- **MCP prompt templates.** The tool set plus server `instructions` proved sufficient to steer an agent.
- **Optimistic updates.** SSE round trips are local and sub-second, so optimistic rendering would add rollback paths for no perceived gain.

### Where things live

Directory layout differs from the plan because the layering does. See
[the root README](../../../README.md) for the package map,
[docs/conventions.md](../../../docs/conventions.md) for the neverthrow, Zod, and
ts-rest conventions, and [docs/decisions.md](../../../docs/decisions.md) for the
reasoning behind each choice above.

## Overview

This document outlines the implementation tasks for building the Behavior Workbench, organized by priority, dependencies, and phases. The workbench is divided into three core packages: `@eddy/behavior-core`, `@eddy/behavior-next`, and `@eddy/behavior-cli`.

## Phase 1: Foundation & Core Infrastructure

### Priority: High
**Goal**: Establish the core infrastructure and basic functionality for specification indexing and parsing.

#### Task 1.1: Project Structure and Package Setup
**ID**: T1.1
**Priority**: High
**Estimated Effort**: 2 hours
**Dependencies**: None

**Description**: Create the monorepo structure with three packages and basic configuration.

**Subtasks**:
- [x] Initialize monorepo with pnpm/npm workspaces
- [x] Create `@eddy/behavior-core` package with TypeScript configuration
- [ ] Create `@eddy/behavior-next` package with Next.js 14 + App Router
- [x] Create `@eddy/behavior-cli` package with Commander.js
- [x] Set up shared TypeScript configuration and build scripts
- [ ] Configure ESLint, Prettier, and Husky for code quality

**Acceptance Criteria**:
- All three packages can be built independently
- TypeScript compiles without errors
- Basic test framework (Vitest) is configured
- Development scripts work (dev, build, test, lint)

#### Task 1.2: Core Type Definitions and Interfaces
**ID**: T1.2
**Priority**: High
**Estimated Effort**: 3 hours
**Dependencies**: T1.1

**Description**: Define the core TypeScript interfaces and types for the behavior workbench.

**Subtasks**:
- [x] Define `BehaviorIndex` interface with project metadata
- [x] Define `Feature`, `Scenario`, `Step` interfaces for Gherkin
- [x] Define `Diagram`, `TestLink`, `EditorLink` interfaces
- [x] Define `TestStatus`, `CoverageMetrics` types
- [x] Create validation types for Gherkin parsing results
- [x] Define MCP server interfaces for agent integration

**Acceptance Criteria**:
- All core types are defined with proper TypeScript interfaces
- Interfaces support all use cases from requirements
- Type definitions are exported from `@eddy/behavior-core`
- Compilation passes with strict TypeScript settings

#### Task 1.3: Gherkin Parsing Implementation
**ID**: T1.3
**Priority**: High
**Estimated Effort**: 4 hours
**Dependencies**: T1.2

**Description**: Implement Gherkin file parsing using @cucumber/gherkin library.

**Subtasks**:
- [x] Install and configure @cucumber/gherkin dependency
- [x] Implement `parseGherkinFile()` function with error handling
- [x] Create `GherkinParser` class with file system scanning
- [x] Implement scenario extraction with unique ID generation
- [x] Add syntax validation and error reporting
- [x] Write unit tests for parsing edge cases

**Acceptance Criteria**:
- Can parse .feature files with all Gherkin constructs
- Extracts features, scenarios, steps, and tags correctly
- Reports syntax errors with line numbers
- Generates consistent scenario IDs
- Unit tests achieve 90% coverage

#### Task 1.4: Mermaid Diagram Parsing
**ID**: T1.4
**Priority**: High
**Estimated Effort**: 3 hours
**Dependencies**: T1.2

**Description**: Implement Mermaid diagram file parsing and analysis.

**Subtasks**:
- [x] Install mermaid.js dependency
- [x] Implement `parseMermaidFile()` function
- [x] Create diagram metadata extraction (title, type, complexity)
- [x] Implement basic syntax validation
- [x] Add diagram-to-scenario relevance scoring
- [x] Write unit tests for diagram parsing

**Acceptance Criteria**:
- Can parse .mmd files with Mermaid syntax
- Extracts diagram metadata and structure
- Validates basic Mermaid syntax
- Calculates relevance scores between diagrams and scenarios
- Unit tests cover parsing and validation

## Phase 2: Test Integration & Status Tracking

### Priority: High
**Goal**: Integrate with test runners and implement status tracking for scenarios.

#### Task 2.1: Test File Indexing and Mapping
**ID**: T2.1
**Priority**: High
**Estimated Effort**: 4 hours
**Dependencies**: T1.3

**Description**: Implement test file discovery and scenario mapping.

**Subtasks**:
- [x] Implement test file scanning for Playwright, Jest, Vitest
- [x] Create test parser for different test frameworks
- [x] Implement heuristic matching between tests and scenarios
- [ ] Add manual mapping support via .json files
- [x] Create `TestIndex` class for managing test relationships
- [x] Write unit tests for test-scenario matching

**Acceptance Criteria**:
- Can discover test files in configured directories
- Parses test names and structures for different frameworks
- Maps tests to scenarios using naming conventions and tags
- Supports explicit mappings via JSON files
- Unit tests verify matching accuracy

#### Task 2.2: Test Result Ingestion
**ID**: T2.2
**Priority**: High
**Estimated Effort**: 3 hours
**Dependencies**: T2.1

**Description**: Implement ingestion of test results from various formats.

**Subtasks**:
- [x] Implement Playwright JSON report ingestion
- [x] Add Jest/Vitest result ingestion
- [x] Create `TestResult` interface for unified results
- [x] Implement status aggregation for scenarios
- [x] Add flaky test detection logic
- [x] Write unit tests for result ingestion

**Acceptance Criteria**:
- Can ingest Playwright JSON reports
- Supports multiple test result formats
- Aggregates test status at scenario level
- Detects flaky tests based on historical data
- Unit tests cover ingestion and aggregation

#### Task 2.3: Coverage Metrics Calculation
**ID**: T2.3
**Priority**: Medium
**Estimated Effort**: 2 hours
**Dependencies**: T2.1, T2.2

**Description**: Implement coverage metrics calculation for scenarios and features.

**Subtasks**:
- [x] Implement scenario coverage calculation (tested/untested)
- [x] Add feature-level coverage aggregation
- [x] Create coverage visualization data structures
- [ ] Implement coverage trend tracking
- [x] Add coverage reporting utilities
- [x] Write unit tests for coverage calculations

**Acceptance Criteria**:
- Calculates accurate coverage percentages
- Aggregates coverage at feature level
- Tracks coverage trends over time
- Provides coverage data for UI display
- Unit tests verify calculation accuracy

## Phase 3: UI Foundation & Navigation

### Priority: High
**Goal**: Build the Next.js UI foundation and basic navigation components.

#### Task 3.1: Next.js App Router Setup
**ID**: T3.1
**Priority**: High
**Estimated Effort**: 3 hours
**Dependencies**: T1.1

**Description**: Set up Next.js 14 with App Router and basic layout.

**Subtasks**:
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure App Router with layout structure
- [x] Set up Tailwind CSS for styling
- [x] Add shadcn/ui component library
- [x] Configure React Query for data fetching
- [ ] Set up Zustand for state management

**Acceptance Criteria**:
- Next.js app runs on localhost:3000
- App Router structure is properly configured
- Tailwind CSS is working with custom theme
- shadcn/ui components can be imported
- Data fetching and state management are set up

#### Task 3.2: Catalog View Implementation
**ID**: T3.2
**Priority**: High
**Estimated Effort**: 4 hours
**Dependencies**: T3.1, T1.3

**Description**: Implement the catalog/dashboard view showing all features.

**Subtasks**:
- [x] Create `CatalogView` component with feature cards
- [x] Implement feature status visualization (pass/fail/untested)
- [x] Add search and filter functionality
- [x] Implement virtual scrolling for large feature lists
- [x] Create feature card component with key metrics
- [x] Add loading states and error handling
- [x] Write component tests for CatalogView

**Acceptance Criteria**:
- Displays all features with status badges
- Supports searching by feature name and tags
- Filters features by status and coverage
- Handles large datasets with virtual scrolling
- Shows loading states during data fetching
- Component tests verify rendering and interactions

#### Task 3.3: Three-Panel Feature View
**ID**: T3.3
**Priority**: High
**Estimated Effort**: 5 hours
**Dependencies**: T3.2, T1.3, T1.4

**Description**: Implement the three-panel feature view layout.

**Subtasks**:
- [x] Create responsive three-panel layout component
- [x] Implement left panel: feature details and scenarios list
- [x] Implement middle panel: scenario steps and details
- [x] Implement right panel: linked diagrams and tests
- [x] Add panel resizing functionality
- [x] Implement scenario selection and navigation
- [x] Create diagram rendering with mermaid.js
- [x] Write component tests for three-panel layout

**Acceptance Criteria**:
- Responsive three-panel layout works on different screen sizes
- Panels can be resized by users
- Scenario selection updates all panels appropriately
- Diagrams render correctly with interactive elements
- Test results display with status indicators
- Component tests cover layout and interactions

## Phase 4: Editor Integration & Deep Links

### Priority: Medium
**Goal**: Implement editor deep link integration and code navigation.

#### Task 4.1: Editor Deep Link Generation
**ID**: T4.1
**Priority**: Medium
**Estimated Effort**: 3 hours
**Dependencies**: T1.2, T3.1

**Description**: Implement generation of editor deep links for scenarios and tests.

**Subtasks**:
- [x] Implement `EditorLinkService` class
- [x] Add support for vscode:// deep links
- [x] Add support for cursor:// deep links
- [x] Add support for kiro:// deep links
- [x] Implement fallback logic for missing editors
- [x] Create UI components for editor links
- [x] Write unit tests for link generation

**Acceptance Criteria**:
- Generates correct deep links for all supported editors
- Links open files at correct line numbers
- Provides fallback options when editors not installed
- UI shows editor links with appropriate icons
- Unit tests verify link format and functionality

#### Task 4.2: File System Integration
**ID**: T4.2
**Priority**: Medium
**Estimated Effort**: 2 hours
**Dependencies**: T4.1

**Description**: Implement file system operations for editor integration.

**Subtasks**:
- [x] Implement file existence checking
- [x] Add line number extraction for scenarios
- [x] Create file path resolution utilities
- [x] Implement safe file system operations
- [x] Add error handling for missing files
- [x] Write unit tests for file system operations

**Acceptance Criteria**:
- Can check if files exist before generating links
- Extracts correct line numbers from source files
- Handles file path resolution across platforms
- Provides graceful error handling
- Unit tests cover file system operations

## Phase 5: Agent Integration & MCP Server

### Priority: Medium
**Goal**: Implement MCP server for AI agent integration.

#### Task 5.1: MCP Server Implementation
**ID**: T5.1
**Priority**: Medium
**Estimated Effort**: 4 hours
**Dependencies**: T1.2, T2.1

**Description**: Implement Model Context Protocol server for agent integration.

**Subtasks**:
- [x] Install @modelcontextprotocol/sdk
- [x] Implement `BehaviorMCPServer` class
- [x] Add tools: getBehaviorContext, validateGherkin, suggestTests
- [x] Implement resource: behavior://scenarios/{id}
- [ ] Add prompt templates for agent interactions
- [x] Implement security controls for write operations
- [x] Write integration tests for MCP server

**Acceptance Criteria**:
- MCP server starts and accepts connections
- Provides behavior context for scenarios
- Validates agent-generated Gherkin
- Suggests test improvements based on coverage
- Requires user confirmation for write operations
- Integration tests verify server functionality

#### Task 5.2: Agent Context Generation
**ID**: T5.2
**Priority**: Medium
**Estimated Effort**: 3 hours
**Dependencies**: T5.1

**Description**: Implement context generation for AI agents.

**Subtasks**:
- [x] Implement `generateAgentContext()` function
- [x] Create structured context data format
- [x] Include related scenarios and patterns
- [x] Add test history and coverage information
- [x] Implement context summarization for token limits
- [x] Write unit tests for context generation

**Acceptance Criteria**:
- Generates comprehensive context for agents
- Includes relevant scenario relationships
- Provides test coverage and history
- Summarizes context for token efficiency
- Unit tests verify context structure and content

## Phase 6: Quality Tools & Linting

### Priority: Medium
**Goal**: Implement specification quality checks and linting tools.

#### Task 6.1: Gherkin Linting Implementation
**ID**: T6.1
**Priority**: Medium
**Estimated Effort**: 3 hours
**Dependencies**: T1.3

**Description**: Implement Gherkin linting with style checks and best practices.

**Subtasks**:
- [x] Implement `GherkinLinter` class
- [x] Add style checks: step pattern consistency, tag conventions
- [x] Implement best practice validations
- [x] Add duplicate scenario detection
- [x] Create auto-fix suggestions for common issues
- [x] Write unit tests for linting rules

**Acceptance Criteria**:
- Detects style violations in Gherkin files
- Checks for best practice compliance
- Identifies duplicate or conflicting scenarios
- Suggests auto-fixes for common issues
- Unit tests verify linting accuracy

#### Task 6.2: Quality Metrics Dashboard
**ID**: T6.2
**Priority**: Low
**Estimated Effort**: 2 hours
**Dependencies**: T6.1, T2.3

**Description**: Implement quality metrics visualization in UI.

**Subtasks**:
- [x] Create quality metrics calculation utilities
- [x] Implement metrics aggregation at project level
- [ ] Add quality trends tracking
- [x] Create UI components for metrics display
- [x] Implement quality score visualization
- [x] Write component tests for metrics display

**Acceptance Criteria**:
- Calculates quality scores for specifications
- Shows quality trends over time
- Displays metrics in intuitive dashboard
- Highlights areas needing improvement
- Component tests verify metrics display

## Phase 7: CLI Tools & Developer Experience

### Priority: Low
**Goal**: Implement CLI tools for developer workflow integration.

#### Task 7.1: CLI Command Implementation
**ID**: T7.1
**Priority**: Low
**Estimated Effort**: 3 hours
**Dependencies**: T1.1, T2.2

**Description**: Implement CLI commands for common workflows.

**Subtasks**:
- [x] Implement `behavior index` command for spec indexing
- [x] Implement `behavior ingest-tests` for test result ingestion
- [x] Implement `behavior lint` for spec quality checking
- [x] Implement `behavior serve` for starting dev server
- [ ] Add interactive prompts for configuration
- [x] Write integration tests for CLI commands

**Acceptance Criteria**:
- CLI commands work with proper arguments
- Provides helpful error messages
- Supports interactive configuration
- Integrates with core functionality
- Integration tests verify command execution

#### Task 7.2: Configuration Management
**ID**: T7.2
**Priority**: Low
**Estimated Effort**: 2 hours
**Dependencies**: T7.1

**Description**: Implement configuration file management for CLI.

**Subtasks**:
- [x] Implement `.behaviorrc` configuration file format
- [x] Add configuration validation
- [ ] Implement configuration migration utilities
- [ ] Create configuration wizard for first-time setup
- [x] Write unit tests for configuration management

**Acceptance Criteria**:
- Loads and validates configuration files
- Provides sensible defaults
- Supports configuration migration
- Guides users through first-time setup
- Unit tests verify configuration handling

## Phase 8: Performance & Optimization

### Priority: Low
**Goal**: Optimize performance for large projects and add advanced features.

#### Task 8.1: Performance Optimization
**ID**: T8.1
**Priority**: Low
**Estimated Effort**: 4 hours
**Dependencies**: T1.3, T2.1, T3.2

**Description**: Optimize performance for large projects with 1000+ scenarios.

**Subtasks**:
- [ ] Implement incremental indexing for changed files
- [x] Add file system watching with debouncing
- [ ] Optimize memory usage with streaming parsing
- [ ] Implement caching layer for frequently accessed data
- [ ] Add performance metrics and monitoring
- [x] Write performance tests for large datasets

**Acceptance Criteria**:
- Indexes 1000+ scenarios in under 30 seconds
- Memory usage stays under 500MB for typical projects
- UI remains responsive during large operations
- Performance tests verify optimization targets

#### Task 8.2: Real-time Updates
**ID**: T8.2
**Priority**: Low
**Estimated Effort**: 3 hours
**Dependencies**: T8.1

**Description**: Implement real-time updates for file changes.

**Subtasks**:
- [ ] Implement WebSocket server for real-time updates
- [x] Add file system watcher integration
- [x] Implement change detection and notification
- [x] Add UI components for real-time status
- [ ] Implement optimistic updates for better UX
- [x] Write integration tests for real-time features

**Acceptance Criteria**:
- UI updates automatically when files change
- Notifies users of changes in real-time
- Supports optimistic updates for better responsiveness
- Handles multiple simultaneous changes gracefully
- Integration tests verify real-time functionality

## Dependencies Graph

```
T1.1 → T1.2 → T1.3 → T2.1 → T2.2 → T2.3
       ↓
      T1.4 → T3.3
       ↓
      T4.1 ← T4.2
       ↓
T3.1 → T3.2 → T3.3 → T6.2
       ↓
      T5.1 → T5.2
       ↓
      T6.1 → T6.2
       ↓
T7.1 → T7.2
       ↓
T8.1 → T8.2
```

## Risk Assessment

### High Risk Areas
1. **Gherkin Parsing Complexity** (T1.3): Parsing edge cases and error recovery
2. **Test-Scenario Mapping** (T2.1): Heuristic matching accuracy
3. **Performance with Large Projects** (T8.1): Meeting 30-second indexing target

### Mitigation Strategies
1. **Incremental Implementation**: Start with basic parsing, add complexity gradually
2. **Extensive Testing**: Comprehensive test suite for parsing and matching
3. **Performance Monitoring**: Early performance testing and profiling
4. **Fallback Mechanisms**: Graceful degradation when optimizations fail

## Success Metrics

1. **Functional Completeness**: All acceptance criteria from requirements met
2. **Performance Targets**: 30-second indexing for 1000+ scenarios, <100ms UI response
3. **Test Coverage**: 90% unit test coverage for core modules
4. **User Experience**: Intuitive navigation and helpful error messages
5. **Integration Success**: Seamless integration with existing development workflows

## Notes

- All tasks assume TypeScript 5+ and Node.js 18+ environment
- UI tasks assume React 18+ and Next.js 14+ with App Router
- Test tasks assume Vitest for unit tests, Playwright for integration tests
- Phase 1-3 are required for MVP; later phases add polish and advanced features
- Tasks are estimated for a senior developer; adjust for team experience level