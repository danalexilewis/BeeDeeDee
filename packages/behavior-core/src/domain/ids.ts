/**
 * Identifier generation. Every id is derived deterministically from file paths
 * and titles so that re-indexing an unchanged project yields an identical index.
 */

/** Normalises text into a URL and filename safe slug. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Converts Windows separators and strips leading `./` so ids are platform stable. */
function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Strips a leading root directory from a path, if present. */
function stripRoot(filePath: string, root: string): string {
  const posixPath = toPosixPath(filePath);
  const posixRoot = toPosixPath(root).replace(/\/+$/, '');
  if (posixRoot.length === 0) return posixPath;
  if (posixPath === posixRoot) return '';
  const prefix = `${posixRoot}/`;
  return posixPath.startsWith(prefix) ? posixPath.slice(prefix.length) : posixPath;
}

/**
 * Derives a feature id from its file path, relative to the features root.
 * `specs/features/auth/login.feature` under `specs/features` becomes `auth/login`.
 */
export function featureIdFromPath(featuresRoot: string, filePath: string): string {
  const relative = stripRoot(filePath, featuresRoot).replace(/\.feature$/i, '');
  return relative
    .split('/')
    .filter(function isNotEmpty(segment) {
      return segment.length > 0;
    })
    .map(slugify)
    .filter(function isNotEmpty(segment) {
      return segment.length > 0;
    })
    .join('/');
}

/** Derives a diagram id from its file path, relative to the diagrams root. */
export function diagramIdFromPath(diagramsRoot: string, filePath: string): string {
  const relative = stripRoot(filePath, diagramsRoot).replace(/\.(mmd|mermaid|puml|drawio)$/i, '');
  return relative
    .split('/')
    .filter(function isNotEmpty(segment) {
      return segment.length > 0;
    })
    .map(slugify)
    .filter(function isNotEmpty(segment) {
      return segment.length > 0;
    })
    .join('/');
}

/**
 * Builds a scenario id as `featureId/scenario-slug`. Scenarios with duplicate
 * names within a feature are disambiguated by their one-based ordinal, so ids
 * stay stable as long as scenario order does.
 */
export function scenarioIdFrom(featureId: string, scenarioName: string, ordinal: number): string {
  const slug = slugify(scenarioName);
  const base = slug.length > 0 ? slug : `scenario-${ordinal}`;
  return `${featureId}/${base}`;
}

/**
 * Assigns ids to every scenario in a feature, appending `-2`, `-3` and so on to
 * later scenarios that would otherwise collide.
 */
export function assignScenarioIds(featureId: string, scenarioNames: readonly string[]): string[] {
  const used = new Map<string, number>();

  return scenarioNames.map(function toId(name, index) {
    const candidate = scenarioIdFrom(featureId, name, index + 1);
    const seen = used.get(candidate) ?? 0;
    used.set(candidate, seen + 1);
    return seen === 0 ? candidate : `${candidate}-${seen + 1}`;
  });
}

/** Identifies a test by file path and line, which is stable across renames of the test name. */
export function testIdFrom(filePath: string, line: number): string {
  return `${toPosixPath(filePath)}:${line}`;
}

/** Identifies a step within a scenario. */
export function stepIdFrom(scenarioId: string, index: number): string {
  return `${scenarioId}#step-${index + 1}`;
}
