// Type definitions for Behavior Workbench
// Based on design document: docs/behavior-workbench/design.md

// =============================================================================
// Project Metadata Types
// =============================================================================

export interface ProjectMetadata {
  id: string;
  name: string;
  rootPath: string;
  specPaths: {
    features: string;
    diagrams: string;
    mappings?: string;
  };
  testPaths: {
    e2e: string;
    components: string;
    unit?: string;
  };
  editorConfig: EditorConfig;
}

// =============================================================================
// Feature and Scenario Types
// =============================================================================

export interface FeatureSummary {
  id: string;
  title: string;
  description: string;
  path: string;
  scenarioCount: number;
  testCoverage: number; // 0-100%
  lastUpdated: Date;
  status: 'passing' | 'failing' | 'untested';
}

export interface FeatureDetail extends FeatureSummary {
  scenarios: ScenarioSummary[];
  diagrams: DiagramLink[];
  tags: string[];
  background?: GherkinBackground;
  rules?: GherkinRule[];
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  steps: GherkinStep[];
  tags: string[];
  testLinks: TestLink[];
  diagramLinks: DiagramLink[];
  status: TestStatus;
  lastRun?: Date;
}

export interface ScenarioDetail extends ScenarioSummary {
  featureId: string;
  featureTitle: string;
  featurePath: string;
  gherkinSource: string;
  lineNumbers: {
    scenario: number;
    steps: Record<number, number>; // stepIndex -> line number
  };
}

// =============================================================================
// Gherkin Types
// =============================================================================

export interface GherkinStep {
  id: string;
  keyword: string;
  text: string;
  argument?: GherkinArgument;
  line: number;
}

export interface GherkinArgument {
  type: 'doc_string' | 'table';
  content: string | GherkinTable;
  line: number;
}

export interface GherkinTable {
  headers: string[];
  rows: string[][];
  line: number;
}

export interface GherkinBackground {
  keyword: string;
  name: string;
  description: string;
  steps: GherkinStep[];
  line: number;
}

export interface GherkinRule {
  keyword: string;
  name: string;
  description?: string;
  steps: GherkinStep[];
  scenarios: ScenarioSummary[];
  line: number;
}

export interface ParsedFeature {
  id: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
  background?: GherkinBackground;
  rules?: GherkinRule[];
  scenarios: ScenarioSummary[];
  lineNumbers: {
    feature: number;
    background?: number;
    rules?: Record<string, number>;
    scenarios: Record<string, number>;
  };
}

// =============================================================================
// Diagram Types
// =============================================================================

export interface Diagram {
  id: string;
  type: 'mermaid' | 'plantuml' | 'drawio';
  content: string;
  title: string;
}

export interface ParsedDiagram extends Diagram {
  metadata: {
    lineCount: number;
    wordCount: number;
    complexity: 'simple' | 'moderate' | 'complex';
    elements?: number;
  };
  lineNumbers: {
    start: number;
    end: number;
  };
}

export interface DiagramLink {
  type: 'mermaid' | 'plantuml' | 'drawio';
  path: string;
  title: string;
  relevance: 'high' | 'medium' | 'low';
  relevanceScore: number; // 0.0-1.0
}

export interface DiagramContent extends ParsedDiagram {
  link: DiagramLink;
}

// =============================================================================
// Test Integration Types
// =============================================================================

export interface TestLink {
  type: 'playwright' | 'jest' | 'vitest' | 'custom';
  path: string;
  line: number;
  status: 'pass' | 'fail' | 'skipped' | 'not-run';
  duration?: number;
  errorMessage?: string;
}

export interface TestStatus {
  overall: 'pass' | 'fail' | 'skipped' | 'not-run';
  details: TestResultDetail[];
  lastRun: Date;
  flaky: boolean;
}

export interface TestResultDetail {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'skipped' | 'not-run';
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
  timestamp: Date;
  attempt?: number;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'skipped' | 'not-run';
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
  timestamp: Date;
  file: string;
  line?: number;
  tags?: string[];
}

export interface CoverageMetrics {
  scenarioCoverage: number; // 0-100%
  featureCoverage: number; // 0-100%
  totalScenarios: number;
  testedScenarios: number;
  untestedScenarios: number;
  featureMetrics: Record<string, FeatureCoverage>;
}

export interface FeatureCoverage {
  featureId: string;
  featureTitle: string;
  totalScenarios: number;
  testedScenarios: number;
  coverage: number; // 0-100%
  status: 'passing' | 'failing' | 'untested';
}

// =============================================================================
// Editor Integration Types
// =============================================================================

export interface EditorConfig {
  supportedEditors: EditorType[];
  deepLinkPatterns: Record<EditorType, string>;
  openCommand: string;
}

export type EditorType = 'vscode' | 'cursor' | 'intellij';

export interface EditorLink {
  type: EditorType;
  url: string;
  label: string;
  icon: string;
}

export interface EditorLinkService {
  generateScenarioLink(scenarioId: string, behaviorIndex: BehaviorIndex): EditorLink[];
  generateFeatureLink(featureId: string, behaviorIndex: BehaviorIndex): EditorLink[];
  generateTestLink(testLink: TestLink): EditorLink;
  openInEditor(link: EditorLink): Promise<boolean>;
}

// =============================================================================
// Agent Integration Types
// =============================================================================

export interface AgentContext {
  scenario: ScenarioDetail;
  relatedScenarios: ScenarioSummary[];
  testResults: TestResultDetail[];
  diagrams: DiagramContent[];
  codeReferences: CodeReference[];
  suggestedActions: AgentAction[];
}

export interface AgentAction {
  type: 'generate-test' | 'fix-scenario' | 'add-diagram' | 'improve-coverage';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: number; // minutes
}

export interface CodeReference {
  filePath: string;
  startLine: number;
  endLine: number;
  context: string;
  type: 'implementation' | 'test' | 'config' | 'utility';
}

export interface ValidationContext {
  projectRoot: string;
  existingTags: string[];
  stepPatterns: string[];
  scenarioCount: number;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  compatibility: number; // 0-100
}

export interface ValidationWarning {
  message: string;
  severity: 'info' | 'warning' | 'error';
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

export interface ValidationSuggestion {
  message: string;
  type: 'fix' | 'improve' | 'refactor';
  action: 'add' | 'remove' | 'modify' | 'replace';
  details: {
    from?: string;
    to?: string;
  };
}

// =============================================================================
// MCP Server Types
// =============================================================================

export interface BehaviorMCPServerConfig {
  port?: number;
  maxConnections?: number;
  allowedOrigins?: string[];
  debug?: boolean;
}

export interface BehaviorMCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServerStatus;
  handleAgentRequest(request: AgentRequest): Promise<AgentResponse>;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  connectedAgents: number;
  lastActivity: Date;
}

export interface AgentRequest {
  type: 'query' | 'validate' | 'generate' | 'update';
  action: string;
  payload: any;
  agentId?: string;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

// =============================================================================
// Behavior Index Types
// =============================================================================

export interface BehaviorIndex {
  projectMetadata: ProjectMetadata;
  features: Record<string, FeatureDetail>;
  scenarios: Record<string, ScenarioDetail>;
  featureMap: Record<string, string>; // scenarioId -> featureId
  diagramLinks: Record<string, DiagramLink[]>; // scenarioId -> diagram links
  testLinks: Record<string, TestLink[]>; // scenarioId -> test links
  coverage: Record<string, number>; // scenarioId -> coverage score
  tags: Record<string, string[]>; // tag -> [featureIds]
  lastIndexed: Date;
  indexVersion: string;
}

export interface TestIndex {
  testFiles: string[];
  scenarioToTests: Record<string, TestLink[]>;
  testToScenario: Record<string, string>; // testId -> scenarioId
  lastIndexed: Date;
}

// =============================================================================
// Linting Types
// =============================================================================

export interface GherkinLinter {
  lintFile(filePath: string): Promise<LintResult[]>;
  lintContent(content: string, filePath?: string): Promise<LintResult[]>;
  lintFeature(feature: ParsedFeature): Promise<LintResult[]>;
}

export interface LintResult {
  filePath: string;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  line?: number;
  column?: number;
  suggestedFix?: {
    from: string;
    to: string;
  };
}

export interface LinkValidationResult {
  type: 'dead' | 'invalid' | 'mismatch';
  source: string;
  target: string;
  message: string;
}

// =============================================================================
// Export Type Aliases
// =============================================================================

export type RelevanceScore = number; // 0.0-1.0

export type GherkinKeyword = 'Feature' | 'Background' | 'Rule' | 'Scenario' | 'Given' | 'When' | 'Then' | 'And' | 'But';

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'yaml';

export type DevServerOptions = {
  port?: number;
  openBrowser?: boolean;
  host?: string;
};

// =============================================================================
// Catalog and UI Types
// =============================================================================

export interface CatalogData {
  features: FeatureSummary[];
  totalScenarios: number;
  overallCoverage: number;
  statusCounts: {
    passing: number;
    failing: number;
    untested: number;
  };
}

export interface CatalogViewProps {
  catalog: CatalogData;
  filters: CatalogFilters;
  onFeatureSelect: (featureId: string) => void;
  onSearch: (query: string) => void;
  onFilterChange: (filters: CatalogFilters) => void;
}

export interface CatalogFilters {
  status?: 'all' | 'passing' | 'failing' | 'untested';
  coverage?: {
    min: number;
    max: number;
  };
  tags?: string[];
  search?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

export class GherkinSyntaxError extends Error {
  constructor(filePath: string, message: string, line: number, column: number) {
    super(`Gherkin syntax error in ${filePath}:${line}:${column}: ${message}`);
    this.name = 'GherkinSyntaxError';
  }
}

export class ScenarioNotFoundError extends Error {
  constructor(scenarioId: string) {
    super(`Scenario not found: ${scenarioId}`);
    this.name = 'ScenarioNotFoundError';
  }
}

export class EditorNotSupportedError extends Error {
  constructor(editorType: EditorType) {
    super(`Editor not supported: ${editorType}`);
    this.name = 'EditorNotSupportedError';
  }
}

export class EncodingError extends Error {
  constructor(filePath: string, message: string) {
    super(`Encoding error in ${filePath}: ${message}`);
    this.name = 'EncodingError';
  }
}