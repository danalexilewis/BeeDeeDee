# @eddy/test-support

fast-check arbitraries and fixture builders shared across packages.

## What lives here

```
src/arbitraries/primitives.ts    ISO timestamps, words, phrases, tags, paths
src/arbitraries/test-result.ts   Test results, including retry sequences
src/arbitraries/spec.ts          Features and scenarios, plus Gherkin/Mermaid renderers
```

Arbitraries generate values inside deliberately narrow ranges — timestamps within
one year, short lowercase words — so a shrunk counterexample is readable rather
than a wall of Unicode.

## What does not live here

Port test doubles are in
[`@eddy/behavior-core/testing`](../behavior-core/src/testing), not here. They
reference core's port types, and core already depends on this package for
arbitraries, so the reverse edge would make the two circular.

## Usage

```ts
import { arbFeature, renderGherkin } from '@eddy/test-support';
import fc from 'fast-check';

fc.assert(
  fc.property(arbFeature, function idsAreStable(feature) {
    // renderGherkin turns a generated feature into valid Gherkin source
  })
);
```

Excluded from coverage, since it is test infrastructure rather than shipped logic.
