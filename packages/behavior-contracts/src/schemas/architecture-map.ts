import { z } from 'zod';

/**
 * Architecture maps describe system data / user flow on a split canvas:
 * user-flow nodes above a horizontal divider, domain-model nodes below, with
 * lineage edges showing which collected data lands in which domain fields.
 */

export const architectureMapSchemaVersionSchema = z.literal('0.1');

/** Canvas coordinates authored in the map file. */
export const architecturePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/** A datum captured or required at a user-flow stage. */
export const architectureDataItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Must be present before the user can leave this stage. */
  required: z.boolean().default(false),
  description: z.string().default(''),
});

/**
 * A node in the user-flow half of the canvas.
 *
 * - `hub` — collapsible grouping stage; children hide when collapsed
 * - `stage` — always-visible step in the journey
 * - `leaf` — detail step revealed when zoom exceeds `zoomRevealAt` (and parent hubs are expanded)
 */
export const architectureFlowNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['hub', 'stage', 'leaf']),
  position: architecturePositionSchema,
  description: z.string().default(''),
  /** Parent hub id; collapsing the hub hides this node and its edges. */
  parentId: z.string().min(1).optional(),
  /** Linked catalog feature for drill-in. */
  featureId: z.string().min(1).optional(),
  /** Linked scenario for drill-in (requires featureId for navigation). */
  scenarioId: z.string().min(1).optional(),
  dataCollected: z.array(architectureDataItemSchema).default([]),
  /** Data item ids that must be satisfied to proceed along outgoing flow edges. */
  requiredToProceed: z.array(z.string().min(1)).default([]),
  /** Minimum viewport zoom at which this leaf becomes visible. Ignored for hub/stage. */
  zoomRevealAt: z.number().nonnegative().default(0),
  collapsedByDefault: z.boolean().default(false),
});

/** Directed edge between user-flow nodes. */
export const architectureFlowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().default(''),
});

/**
 * A node in the domain-model half of the canvas.
 *
 * - `entity` — aggregate / table / concept
 * - `field` — attribute on an entity (`parentId` should point at the entity)
 */
export const architectureDomainNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['entity', 'field']),
  position: architecturePositionSchema,
  description: z.string().default(''),
  parentId: z.string().min(1).optional(),
  /** Optional type hint shown in the detail panel (e.g. `email`, `money`). */
  dataType: z.string().default(''),
});

/** Relationship between domain entities (not lineage). */
export const architectureDomainEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().default(''),
});

/**
 * Cross-plane edge: a user-flow stage feeds a domain field.
 * Drawn across the divider to show normalised data landing.
 */
export const architectureLineageEdgeSchema = z.object({
  id: z.string().min(1),
  /** User-flow node id. */
  source: z.string().min(1),
  /** Domain field (or entity) node id. */
  target: z.string().min(1),
  /** Which collected datum this lineage carries; must match a `dataCollected` id when set. */
  dataId: z.string().min(1).optional(),
  label: z.string().default(''),
  description: z.string().default(''),
});

/** Authoring document stored under `specPaths.mappings` as `*.architecture.json`. */
export const architectureMapDocumentSchema = z.object({
  schemaVersion: architectureMapSchemaVersionSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  /** Y coordinate of the horizontal divider between user flow (above) and domain (below). */
  dividerY: z.number().default(420),
  userFlows: z.object({
    nodes: z.array(architectureFlowNodeSchema).default([]),
    edges: z.array(architectureFlowEdgeSchema).default([]),
  }),
  domainModel: z.object({
    nodes: z.array(architectureDomainNodeSchema).default([]),
    edges: z.array(architectureDomainEdgeSchema).default([]),
  }),
  lineage: z.array(architectureLineageEdgeSchema).default([]),
});

/** Indexed architecture map ready for the wire. */
export const architectureMapSchema = architectureMapDocumentSchema.extend({
  id: z.string().min(1),
  path: z.string().min(1),
});

/** Lightweight row for the maps list page. */
export const architectureMapSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  path: z.string().min(1),
  flowNodeCount: z.number().int().nonnegative(),
  domainNodeCount: z.number().int().nonnegative(),
  lineageCount: z.number().int().nonnegative(),
  linkedFeatureIds: z.array(z.string()),
});

export type ArchitecturePosition = z.infer<typeof architecturePositionSchema>;
export type ArchitectureDataItem = z.infer<typeof architectureDataItemSchema>;
export type ArchitectureFlowNode = z.infer<typeof architectureFlowNodeSchema>;
export type ArchitectureFlowEdge = z.infer<typeof architectureFlowEdgeSchema>;
export type ArchitectureDomainNode = z.infer<typeof architectureDomainNodeSchema>;
export type ArchitectureDomainEdge = z.infer<typeof architectureDomainEdgeSchema>;
export type ArchitectureLineageEdge = z.infer<typeof architectureLineageEdgeSchema>;
export type ArchitectureMapDocument = z.infer<typeof architectureMapDocumentSchema>;
export type ArchitectureMap = z.infer<typeof architectureMapSchema>;
export type ArchitectureMapSummary = z.infer<typeof architectureMapSummarySchema>;
