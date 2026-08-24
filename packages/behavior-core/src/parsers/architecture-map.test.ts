import { describe, expect, it } from 'vitest';
import { architectureMapIdFromPath } from '../domain/ids.js';
import { parseArchitectureMapContent } from './architecture-map.js';

const VALID_MAP = `{
  "schemaVersion": "0.1",
  "title": "Checkout",
  "description": "Demo",
  "dividerY": 400,
  "userFlows": {
    "nodes": [
      {
        "id": "login",
        "label": "Login",
        "kind": "stage",
        "position": { "x": 0, "y": 0 },
        "featureId": "authentication.login",
        "dataCollected": [
          { "id": "email", "name": "Email", "required": true, "description": "" }
        ],
        "requiredToProceed": ["email"]
      }
    ],
    "edges": []
  },
  "domainModel": {
    "nodes": [
      {
        "id": "user.email",
        "label": "email",
        "kind": "field",
        "position": { "x": 0, "y": 500 },
        "dataType": "email"
      }
    ],
    "edges": []
  },
  "lineage": [
    {
      "id": "lin-1",
      "source": "login",
      "target": "user.email",
      "dataId": "email",
      "label": "email"
    }
  ]
}`;

describe('architectureMapIdFromPath', () => {
  it('strips the architecture.json suffix', () => {
    expect(
      architectureMapIdFromPath(
        'specs/mappings',
        'specs/mappings/product-overview.architecture.json'
      )
    ).toBe('product-overview');
  });
});

describe('parseArchitectureMapContent', () => {
  it('parses a valid map', () => {
    const result = parseArchitectureMapContent({
      path: 'specs/mappings/checkout.architecture.json',
      content: VALID_MAP,
      mappingsRoot: 'specs/mappings',
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.id).toBe('checkout');
    expect(result.value.userFlows.nodes).toHaveLength(1);
    expect(result.value.lineage[0]?.dataId).toBe('email');
  });

  it('rejects invalid JSON as SchemaValidation', () => {
    const result = parseArchitectureMapContent({
      path: 'specs/mappings/broken.architecture.json',
      content: '{',
      mappingsRoot: 'specs/mappings',
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.tag).toBe('SchemaValidation');
  });

  it('rejects an unknown schema version', () => {
    const result = parseArchitectureMapContent({
      path: 'specs/mappings/old.architecture.json',
      content:
        '{"schemaVersion":"9.9","title":"x","userFlows":{"nodes":[],"edges":[]},"domainModel":{"nodes":[],"edges":[]}}',
      mappingsRoot: 'specs/mappings',
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.tag).toBe('SchemaValidation');
  });

  it('rejects a path that cannot derive a map id', () => {
    const result = parseArchitectureMapContent({
      path: 'specs/mappings/!!!.architecture.json',
      content: VALID_MAP,
      mappingsRoot: 'specs/mappings',
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.tag).toBe('SchemaValidation');
    if (result.error.tag !== 'SchemaValidation') return;
    expect(result.error.issues[0]?.message).toMatch(/could not derive a map id/i);
  });
});
