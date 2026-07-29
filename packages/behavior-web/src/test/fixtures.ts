import type {
  CatalogData,
  DiagramContent,
  EditorLink,
  FeatureDetail,
  FeatureSummary,
  ScenarioSummary,
  TestStatus,
} from '@eddy/behavior-contracts';

const AT = '2026-07-29T10:00:00.000Z';

export function aTestStatus(overrides: Partial<TestStatus> = {}): TestStatus {
  return {
    scenarioId: 'login.successful-login',
    overall: 'not-run',
    results: [],
    lastRun: null,
    flaky: false,
    ...overrides,
  };
}

export function aScenario(overrides: Partial<ScenarioSummary> = {}): ScenarioSummary {
  return {
    id: 'login.successful-login',
    name: 'Successful login',
    description: '',
    steps: [
      {
        id: 'login.successful-login#step-1',
        keyword: 'Given ',
        text: 'a registered user',
        line: 6,
      },
      {
        id: 'login.successful-login#step-2',
        keyword: 'When ',
        text: 'they submit valid credentials',
        line: 7,
      },
    ],
    tags: ['@smoke'],
    testLinks: [],
    diagramLinks: [],
    status: aTestStatus(),
    line: 5,
    ...overrides,
  };
}

export function aFeatureSummary(overrides: Partial<FeatureSummary> = {}): FeatureSummary {
  return {
    id: 'login',
    title: 'Login',
    description: 'Users sign in to reach their dashboard.',
    path: 'specs/features/login.feature',
    tags: ['@auth'],
    scenarioCount: 2,
    testCoverage: 50,
    status: 'passing',
    lastUpdated: AT,
    ...overrides,
  };
}

export function aFeatureDetail(overrides: Partial<FeatureDetail> = {}): FeatureDetail {
  return {
    ...aFeatureSummary(),
    scenarios: [aScenario()],
    diagramLinks: [],
    rules: [],
    gherkinSource: 'Feature: Login\n',
    ...overrides,
  };
}

export function aCatalog(overrides: Partial<CatalogData> = {}): CatalogData {
  return {
    features: [aFeatureSummary()],
    totalScenarios: 2,
    overallCoverage: 50,
    statusCounts: { passing: 1, failing: 0, untested: 0 },
    tags: ['@auth'],
    ...overrides,
  };
}

export function aDiagram(overrides: Partial<DiagramContent> = {}): DiagramContent {
  return {
    id: 'login',
    type: 'mermaid',
    path: 'specs/diagrams/login.mmd',
    title: 'Login flow',
    content: 'flowchart TD\n  user --> dashboard\n',
    metadata: { lineCount: 2, wordCount: 5, nodeCount: 2, complexity: 'simple' },
    lineNumbers: { start: 1, end: 2 },
    link: {
      diagramId: 'login',
      type: 'mermaid',
      path: 'specs/diagrams/login.mmd',
      title: 'Login flow',
      relevance: 'high',
      relevanceScore: 0.8,
    },
    ...overrides,
  };
}

export function anEditorLink(overrides: Partial<EditorLink> = {}): EditorLink {
  return {
    editor: 'vscode',
    url: 'vscode://file//repo/specs/features/login.feature:5',
    label: 'Successful login in VS Code',
    path: '/repo/specs/features/login.feature',
    line: 5,
    targetExists: true,
    ...overrides,
  };
}
