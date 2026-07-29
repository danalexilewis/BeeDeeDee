import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Writes the OpenAPI document derived from the ts-rest contract.
 *
 * Runs against the built output rather than the sources: the package emits ESM
 * with explicit `.js` specifiers, which Node's type stripping cannot resolve from
 * a `.ts` entry point. Requiring a build keeps one module resolution story.
 */
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const builtEntry = join(packageRoot, 'dist/openapi.js');

if (!existsSync(builtEntry)) {
  process.stderr.write(
    'error: dist/openapi.js is missing. Run `pnpm --filter @eddy/behavior-contracts build` first.\n',
  );
  process.exit(1);
}

const { generateBehaviorOpenApi } = await import(builtEntry);
const outputPath = join(packageRoot, 'openapi.json');

await writeFile(outputPath, `${JSON.stringify(generateBehaviorOpenApi(), null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
