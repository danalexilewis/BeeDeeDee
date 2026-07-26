# Design Document

## System Architecture

The Enspiral Network Commons is a distributed system designed to enable community-run resurfacing, publishing, and carrying of digital things within the Enspiral network. The architecture follows a layered approach with clear separation between presentation, application logic, and data persistence layers.

### Architectural Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Enspiral Web Catalog (Next.js)   │   Enspiral CLI           │
│  • React Components               │   • Command Interface    │
│  • UI State Management            │   • Progress Feedback    │
│  • Authentication UI              │   • Configuration Mgmt   │
└───────────────────┬─────────────────┬───────────────────────┘
                    │                 │
┌───────────────────▼─────────────────▼───────────────────────┐
│                   Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Identity Service        │  Project Service     │  Replication│
│  • Auth/Authorization    │  • Resurfacing       │  • Copying  │
│  • Session Management    │  • Metadata Import   │  • Integrity│
│  • Permission Mgmt       │  • Validation        │  • Recovery │
├─────────────────────────────────────────────────────────────┤
│  Publishing Service      │  Maintenance Service │  Search     │
│  • Bundle Creation       │  • Health Checks     │  • Indexing │
│  • IPFS Integration      │  • Alert System      │  • Filtering│
│  • Content Addressing    │  • Escalation        │  • Ranking  │
└───────────────────┬─────────────────┬───────────────────────┘
                    │                 │
┌───────────────────▼─────────────────▼───────────────────────┐
│                   Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  Network Commons Store      │  External Integrations        │
│  • Digital Thing Metadata   │  • Radicle (Source Code)      │
│  • Carrier Assignments      │  • IPFS (Static Publishing)   │
│  • Audit Trails             │  • Monitoring Systems         │
│  • Performance Metrics      │                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Identity Service
- **Purpose**: Manage authentication and authorization for Enspiral network members
- **Responsibilities**:
  - Validate Enspiral credentials
  - Issue and manage session tokens
  - Enforce granular permission controls
  - Maintain user profiles and preferences
- **Interfaces**: REST API, WebSocket for real-time updates

#### 2. Project Service
- **Purpose**: Handle project resurfacing and metadata management
- **Responsibilities**:
  - Import project metadata from Radicle
  - Validate project accessibility and permissions
  - Create and manage Project_Surface representations
  - Handle import failures with detailed error reporting
- **Dependencies**: Radicle integration, Permission System

#### 3. Publishing Service
- **Purpose**: Manage static experiment publishing and distribution
- **Responsibilities**:
  - Bundle source code, dependencies, and documentation
  - Upload bundles to IPFS
  - Record content hashes in Network Commons
  - Provide runnable preview generation
- **Dependencies**: IPFS integration, Network Commons Store

#### 4. Replication Service
- **Purpose**: Execute favorite-triggered replication of digital things
- **Responsibilities**:
  - Initiate immediate copying on favorite actions
  - Distribute copies to geographically distributed nodes
  - Verify data integrity at each replication step
  - Handle node failures with alternative targeting
- **Dependencies**: Health Checker, Network Topology

#### 5. Maintenance Service
- **Purpose**: Ensure long-term accessibility of carried digital things
- **Responsibilities**:
  - Periodically verify accessibility and integrity
  - Alert carriers when items become inaccessible
  - Facilitate updates and notify carriers
  - Escalate orphaned items to broader network
- **Dependencies**: Carrier Tracking, Alert System

#### 6. Search Service
- **Purpose**: Enable discovery of digital things in the commons
- **Responsibilities**:
  - Index all Digital_Things with metadata
  - Provide search across titles, descriptions, tags
  - Filter results by type, activity level, categories
  - Generate personalized recommendations
- **Dependencies**: Network Commons Store, Identity Service

### Data Models

#### DigitalThing
```typescript
interface DigitalThing {
  id: string;
  type: 'project' | 'experiment' | 'documentation' | 'other';
  title: string;
  description: string;
  source: {
    radicleId?: string;
    ipfsHash?: string;
    originalUrl?: string;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    categories: string[];
    activityLevel: 'high' | 'medium' | 'low' | 'inactive';
  };
  permissions: {
    owner: string;
    carriers: string[];
    visibility: 'public' | 'network' | 'private';
    accessControlList: AccessControlEntry[];
  };
  replication: {
    favoriteCount: number;
    replicaCount: number;
    nodeLocations: string[];
    lastVerified: Date;
    integrityChecksum: string;
  };
  maintenance: {
    currentCarriers: string[];
    lastHealthCheck: Date;
    accessibilityStatus: 'accessible' | 'degraded' | 'inaccessible';
    escalationLevel: number;
  };
}
```

#### UserProfile
```typescript
interface UserProfile {
  id: string;
  enspiralId: string;
  displayName: string;
  preferences: {
    notificationPreferences: NotificationSettings;
    uiPreferences: UISettings;
    searchPreferences: SearchSettings;
  };
  network: {
    connections: string[];
    interests: string[];
    carrying: string[]; // DigitalThing IDs being carried
    favorites: string[]; // DigitalThing IDs favorited
  };
  session: {
    currentSessionId?: string;
    lastActive: Date;
    securityContext: SecurityContext;
  };
}
```

#### ProjectSurface
```typescript
interface ProjectSurface {
  digitalThingId: string;
  display: {
    title: string;
    description: string;
    previewUrl?: string;
    runnablePreview?: boolean;
  };
  access: {
    sourceLinks: SourceLink[];
    documentationLinks: DocumentationLink[];
    apiEndpoints?: APIEndpoint[];
  };
  stats: {
    viewCount: number;
    favoriteCount: number;
    carrierCount: number;
    lastAccessed: Date;
  };
  uiState: {
    expandedSections: string[];
    userNotes?: string;
    personalTags?: string[];
  };
}
```

### Interfaces

#### Authentication Interface
```typescript
interface AuthenticationService {
  authenticate(credentials: Credentials): Promise<AuthenticationResult>;
  validateSession(sessionId: string): Promise<SessionValidationResult>;
  logout(sessionId: string): Promise<void>;
  getPermissions(userId: string, resourceId: string): Promise<PermissionSet>;
}

interface Credentials {
  enspiralId: string;
  password: string;
  twoFactorCode?: string;
}

interface AuthenticationResult {
  success: boolean;
  session?: Session;
  permissions?: PermissionSet;
  error?: AuthenticationError;
}
```

#### Replication Interface
```typescript
interface ReplicationService {
  initiateReplication(digitalThingId: string, triggeredBy: string): Promise<ReplicationJob>;
  getReplicationStatus(jobId: string): Promise<ReplicationStatus>;
  verifyIntegrity(digitalThingId: string, nodeId: string): Promise<IntegrityVerification>;
  redistributeOnFailure(digitalThingId: string, failedNodeId: string): Promise<RedistributionResult>;
}

interface ReplicationJob {
  id: string;
  digitalThingId: string;
  sourceNodeId: string;
  targetNodeIds: string[];
  status: 'pending' | 'copying' | 'verifying' | 'complete' | 'failed';
  integrityChecks: IntegrityCheck[];
  startedAt: Date;
  completedAt?: Date;
}
```

#### Publishing Interface
```typescript
interface PublishingService {
  publishExperiment(experiment: ExperimentBundle): Promise<PublicationResult>;
  getPublicationStatus(publicationId: string): Promise<PublicationStatus>;
  generatePreview(experimentId: string): Promise<PreviewResult>;
  updateExperiment(experimentId: string, updates: ExperimentUpdates): Promise<UpdateResult>;
}

interface ExperimentBundle {
  id: string;
  sourceCode: SourceCodeBundle;
  dependencies: DependencyManifest;
  documentation: DocumentationBundle;
  configuration: ExperimentConfig;
}

interface PublicationResult {
  publicationId: string;
  ipfsHash: string;
  previewUrl?: string;
  recordedInCommons: boolean;
  errors?: PublicationError[];
}
```

### Error Handling

#### Error Categories
1. **Authentication Errors**: Invalid credentials, expired sessions, permission denied
2. **Network Errors**: Connectivity issues, node failures, timeouts
3. **Validation Errors**: Invalid input data, constraint violations
4. **Resource Errors**: Missing resources, insufficient capacity
5. **Integration Errors**: External service failures, protocol mismatches

#### Error Response Format
```typescript
interface SystemError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
  recoverySteps: string[];
  timestamp: Date;
  correlationId: string;
}
```

#### Error Recovery Strategies
1. **Retry with Backoff**: For transient network errors
2. **Fallback to Alternative Nodes**: For replication failures
3. **Queue for Later Processing**: For external service outages
4. **Escalate to Human Intervention**: For complex permission issues
5. **Provide Actionable Guidance**: For user-correctable errors

### Security Considerations

#### Authentication Security
- Use secure session management with JWT tokens
- Implement proper password hashing (bcrypt/argon2)
- Support two-factor authentication
- Regular session rotation and invalidation

#### Authorization Model
- Role-based access control (RBAC) for coarse permissions
- Attribute-based access control (ABAC) for fine-grained controls
- Maintain audit trails for all permission changes
- Regular permission reviews and cleanup

#### Data Protection
- Encrypt sensitive data at rest
- Use secure protocols for data in transit
- Implement proper key management
- Regular security audits and penetration testing

#### Network Security
- Use TLS for all external communications
- Implement rate limiting and DDoS protection
- Regular vulnerability scanning
- Security headers and CSP for web applications

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Authentication Properties

#### Property 1: Valid Authentication Success

*For any* valid Enspiral credentials, the Identity Service SHALL authenticate the user successfully and grant appropriate permissions matching their role and access level.

**Validates: Requirements 1.2**

#### Property 2: Invalid Authentication Failure

*For any* invalid credentials (incorrect password, non-existent user, expired account), the Identity Service SHALL reject authentication and return a clear, actionable error message indicating the specific reason for failure.

**Validates: Requirements 1.3**

#### Property 3: Authenticated Session Security

*For any* authenticated user session, the Identity Service SHALL maintain the session with appropriate security measures including encryption, proper expiration handling, and protection against session hijacking attacks.

**Validates: Requirements 1.5**

#### Property 4: Authenticated UI State

*For any* authenticated user with specific preferences and network connections, the Web Catalog SHALL display user-specific actions, preferences, and personalized content that reflects their current authentication state and profile data.

**Validates: Requirements 1.4**

### Project Resurfacing Properties

#### Property 5: Radicle Metadata Import

*For any* Radicle project with accessible source code, the Resurfacing Process SHALL import complete project metadata including title, description, repository history, collaboration data, and documentation references.

**Validates: Requirements 2.2**

#### Property 6: Project Surface Creation

*For any* imported project metadata, the Web Catalog SHALL create a corresponding Project_Surface with accurate title, description, source links, and categorization that faithfully represents the original project.

**Validates: Requirements 2.3**

#### Property 7: Resurfacing Validation

*For any* project resurfacing attempt, the Resurfacing Process SHALL validate project accessibility, verify permission boundaries, and ensure the importing user has appropriate rights to resurface the project.

**Validates: Requirements 2.4**

#### Property 8: Import Error Handling

*For any* failed project import (due to network issues, permission problems, or data corruption), the Resurfacing Process SHALL provide detailed error information including the specific failure cause, affected components, and actionable recovery steps for the user.

**Validates: Requirements 2.5**

### Publishing Properties

#### Property 9: Experiment Bundle Completeness

*For any* static experiment being published, the Publishing System SHALL create a complete bundle containing all source code files, dependency specifications, documentation, and configuration files required to run the experiment.

**Validates: Requirements 3.1**

#### Property 10: IPFS Publication Integrity

*For any* experiment bundle published when IPFS integration is available, the Publishing System SHALL upload the complete bundle to IPFS, receive a content hash, and verify that the uploaded content matches the original bundle through hash comparison.

**Validates: Requirements 3.2**

#### Property 11: Commons Metadata Recording

*For any* IPFS-published experiment, the Publishing System SHALL record the content hash, publication timestamp, and bundle metadata in the Network Commons, ensuring the record contains all information needed to retrieve and verify the experiment.

**Validates: Requirements 3.3**

#### Property 12: Experiment Display Accessibility

*For any* published experiment in the Web Catalog, the interface SHALL provide clear, direct access to source code files, documentation, and runnable previews (where supported), with all access mechanisms functioning correctly and leading to the appropriate resources.

**Validates: Requirements 3.4, 3.5**

### Replication Properties

#### Property 13: Favorite-Triggered Replication

*For any* Digital_Thing that receives a Favorite_Action from an authenticated user, the Replication Process SHALL immediately initiate copying to at least three available network nodes (when sufficient nodes exist), beginning within 1 second of the favorite action.

**Validates: Requirements 4.1, 4.2**

#### Property 14: Replication Integrity Verification

*For any* Digital_Thing being replicated, the Replication Process SHALL verify data integrity at each copying step using cryptographic hashes, ensuring that every replica bit-for-bit matches the source content before marking the step as complete.

**Validates: Requirements 4.3**

#### Property 15: Replication Fault Tolerance

*For any* replication attempt that encounters node failures, the Replication Process SHALL attempt alternative available nodes, continue until at least three successful copies exist (when possible), and maintain partial progress for later completion if insufficient nodes are immediately available.

**Validates: Requirements 4.4**

#### Property 16: Carrier Tracking Accuracy

*For any* carried Digital_Thing, the Carrying Process SHALL maintain an accurate, up-to-date list of responsible network members, reflecting current assignments, willingness to carry, and capacity to maintain the item.

**Validates: Requirements 4.5**

### Maintenance Properties

#### Property 17: Periodic Health Verification

*For any* Digital_Thing carried by the network, the Carrying Process SHALL periodically verify its accessibility and integrity according to a configured schedule, with verification intervals not exceeding the maximum allowed period for the item's importance level.

**Validates: Requirements 5.1**

#### Property 18: Inaccessibility Alerting

*For any* carried Digital_Thing that becomes inaccessible (unreachable, corrupted, or otherwise unavailable), the Carrying Process SHALL immediately alert all responsible network members with specific details about the failure and suggested recovery actions.

**Validates: Requirements 5.2**

#### Property 19: Update Notification and Facilitation

*For any* carried Digital_Thing with available updates, the Carrying Process SHALL notify all carriers about the updates, provide clear information about what has changed, and offer streamlined mechanisms to apply the updates while maintaining data integrity.

**Validates: Requirements 5.3**

#### Property 20: Orphan Escalation

*For any* Digital_Thing where no current carrier can continue maintenance, the Carrying Process SHALL escalate the item to the broader network for adoption, providing complete context about maintenance requirements and seeking new carriers before the item becomes at risk.

**Validates: Requirements 5.4**

#### Property 21: Maintenance Metadata Consistency

*For any* maintenance activity performed on a Digital_Thing, the Network Commons SHALL maintain accurate, timestamped metadata about the activity, including which carriers performed it, what was verified or changed, and the resulting status of the item.

**Validates: Requirements 5.5**

### Catalog and Discovery Properties

#### Property 22: Project Categorization Accuracy

*For any* project in the Web Catalog, the display SHALL accurately categorize it by type, tags, and activity level based on its metadata and recent activity, with categorization remaining consistent across different views and filter applications.

**Validates: Requirements 6.2**

#### Property 23: Dynamic Filter Response

*For any* combination of filter options selected in the Web Catalog, the interface SHALL dynamically update displayed results to match all active filters, with the update occurring within 500ms and showing accurate counts of matching items.

**Validates: Requirements 6.3**

#### Property 24: Project Surface Information Completeness

*For any* Project_Surface viewed in the Web Catalog, the display SHALL show complete replication status, current carrier information, access statistics, and all other metadata required for users to understand the item's network presence and maintenance status.

**Validates: Requirements 6.4**

#### Property 25: Personalized Recommendation Relevance

*For any* authenticated user with defined interests and network connections, the recommendation system SHALL suggest Digital_Things that are relevant to their interests, connected to their network, and appropriate for their skill level and current engagement with the commons.

**Validates: Requirements 6.5**

### CLI Properties

#### Property 26: CLI Command Feedback Quality

*For any* CLI command execution, the Enspiral_CLI SHALL provide clear, real-time progress feedback during execution and comprehensive error reporting if failures occur, with error messages including specific failure causes and suggested resolutions.

**Validates: Requirements 7.3**

#### Property 27: Network Issue Graceful Handling

*For any* CLI command requiring network access that encounters connectivity issues, the Enspiral_CLI SHALL handle the failure gracefully by providing clear error messages, suggesting network troubleshooting steps, and when appropriate, offering offline alternatives or queuing mechanisms.

**Validates: Requirements 7.4**

#### Property 28: Configuration Persistence

*For any* user preference or connection setting changed through the Enspiral_CLI, the configuration SHALL be persistently saved to disk, survive CLI restarts, and be accurately restored on subsequent CLI sessions, maintaining all user customizations.

**Validates: Requirements 7.5**

### Radicle Integration Properties

#### Property 29: Radicle Data Retrieval Completeness

*For any* project resurfaced from Radicle, the integration SHALL retrieve complete project metadata, full commit history, collaboration data including contributor information, and all available documentation from the Radicle source.

**Validates: Requirements 8.1**

#### Property 30: Radicle Synchronization Seamlessness

*For any* push/pull operation between the Enspiral Commons and Radicle when connectivity is available, the synchronization SHALL occur seamlessly with proper conflict resolution, attribution maintenance, and verification that all changes are properly transferred.

**Validates: Requirements 8.2**

#### Property 31: Contribution Attribution Accuracy

*For any* collaborative work on a Radicle-integrated project, the integration SHALL maintain accurate attribution of all contributions, properly mapping commits to contributors and preserving the original contribution history and credit assignment.

**Validates: Requirements 8.3**

#### Property 32: Connectivity Interruption Queueing

*For any* Radicle operation interrupted by connectivity loss, the integration SHALL queue the operation for later synchronization, preserve all operation details and context, and automatically attempt synchronization when connectivity is restored.

**Validates: Requirements 8.4**

#### Property 33: Radicle Reference Maintenance

*For any* source-based Digital_Thing originating from Radicle, the Network Commons SHALL maintain accurate, verifiable references to the Radicle project identifiers, ensuring bidirectional traceability between commons items and their source repositories.

**Validates: Requirements 8.5**

### Performance Properties

#### Property 34: Web Catalog Render Performance

*For any* initial load of the Enspiral_Web_Catalog, the User Interface SHALL render visible content within 2 seconds, with critical above-the-fold content appearing first and non-critical content loading progressively without blocking user interaction.

**Validates: Requirements 9.1**

#### Property 35: Search Response Time

*For any* search query against a dataset under 10,000 items, the Search Engine SHALL return complete results within 1 second, with results accurately matching the query and properly ranked according to relevance scoring.

**Validates: Requirements 9.2**

#### Property 36: Replication Prioritization

*For any* set of replication operations competing for network bandwidth and carrier capacity, the Replication Process SHALL prioritize operations based on item importance, carrier availability, and network conditions, ensuring critical replications complete before less critical ones.

**Validates: Requirements 9.3**

#### Property 37: Resource-Constrained Throttling

*For any* period where system resources become constrained, the Resource Manager SHALL throttle non-essential operations while maintaining essential functionality, with throttling proportional to resource scarcity and clearly communicated to affected users.

**Validates: Requirements 9.4**

#### Property 38: Performance Metric Collection

*For any* operation performed by major system components, the Monitoring System SHALL collect accurate performance metrics including execution time, resource usage, success/failure status, and any relevant contextual information for analysis.

**Validates: Requirements 9.5**

### Security Properties

#### Property 39: Permission Verification Consistency

*For any* user attempt to access a Digital_Thing, the Permission System SHALL verify access rights consistently across all access paths, returning identical permission decisions for the same user/item combination regardless of how the access is attempted.

**Validates: Requirements 10.1**

#### Property 40: Granular Permission Enforcement

*For any* sensitive project with granular permission controls, the Identity System SHALL enforce those controls precisely, allowing only specifically authorized actions while blocking all others, with enforcement consistent across all interfaces.

**Validates: Requirements 10.2**

#### Property 41: Permission Management Clarity

*For any* permission management operation, the Permission System SHALL provide clear, intuitive interfaces that show current permissions, allow adding/removing access with simple controls, and confirm changes before applying them.

**Validates: Requirements 10.3**

#### Property 42: Unauthorized Access Logging

*For any* unauthorized access attempt, the Security System SHALL log complete details including the attempt time, source, target resource, and method used, and notify administrators according to configured alerting rules for security incidents.

**Validates: Requirements 10.4**

#### Property 43: Audit Trail Completeness

*For any* permission change or access event, the Network Commons SHALL maintain a complete audit trail including who performed the action, what changed, when it occurred, and from where it was initiated, with trails protected against tampering.

**Validates: Requirements 10.5**

### Network Resilience Properties

#### Property 44: Geographic Distribution

*For any* Digital_Thing being replicated where geographically distributed nodes are available, the Replication Process SHALL distribute copies across different geographic regions when possible, minimizing single-point-of-failure risks from regional outages.

**Validates: Requirements 11.1**

#### Property 45: Node Failure Detection Speed

*For any* network node that becomes unavailable, the Health Checker SHALL detect the failure within 5 minutes, update node status accordingly, and trigger appropriate redistribution processes for items carried on that node.

**Validates: Requirements 11.2**

#### Property 46: Failure Redistribution

*For any* node failure affecting carried Digital_Things, the Carrying Process SHALL redistribute those items to alternative available nodes, prioritizing items based on importance and ensuring continued accessibility during the redistribution process.

**Validates: Requirements 11.3**

#### Property 47: Network Partition Consistency

*For any* network partition that splits the network into isolated segments, the Consensus Mechanism SHALL maintain data consistency within each partition, preserve all operations for later reconciliation, and prevent conflicting updates across partitions.

**Validates: Requirements 11.4**

#### Property 48: Automated Failure Recovery

*For any* failed node that returns to service, the Network Commons SHALL automatically recover replicated data to that node, verify data integrity after recovery, and reintegrate the node into the carrying network with updated status.

**Validates: Requirements 11.5**

### User Experience Properties

#### Property 49: Onboarding Content Relevance

*For any* new user first accessing the Web Catalog, the Onboarding Flow SHALL present essential features and concepts relevant to their role and interests, with content paced appropriately for comprehension and opportunities to skip or revisit sections.

**Validates: Requirements 12.1**

#### Property 50: Context-Sensitive Help

*For any* user needing assistance while using the system, the Help System SHALL provide documentation and examples relevant to their current context, task, and proficiency level, with help content actionable and directly applicable to their immediate needs.

**Validates: Requirements 12.2**

#### Property 51: Progressive Disclosure

*For any* common workflow performed in the User Interface, advanced options SHALL be progressively disclosed based on user proficiency and need, with basic functions readily accessible and advanced features available but not overwhelming for beginners.

**Validates: Requirements 12.3**

#### Property 52: Error Recovery Guidance

*For any* error encountered by a user, the Error Handler SHALL provide actionable recovery steps specific to the error context, with guidance clear enough for users to resolve the issue themselves when possible or know when to seek help.

**Validates: Requirements 12.4**

### Cross-Cutting Properties

#### Property 53: System Consistency Under Load

*For any* system load up to designed capacity, all system components SHALL maintain consistent behavior, with performance degrading gracefully rather than failing catastrophically, and all correctness properties continuing to hold.

**Validates: Requirements 9.1-9.5, 11.1-11.5**

#### Property 54: Data Integrity Preservation

*For any* data transformation, transmission, or storage operation, the system SHALL preserve data integrity through cryptographic verification, ensuring that data remains unchanged from its intended form unless explicitly modified by authorized operations.

**Validates: Requirements 4.3, 5.1, 8.3, 10.5, 11.4**

#### Property 55: User Intent Preservation

*For any* user action with clear intent, the system SHALL preserve and fulfill that intent to the greatest extent possible, even in the face of partial failures, by completing intended operations when resources permit or providing clear alternatives when not possible.

**Validates: Requirements 2.5, 4.4, 5.4, 7.4, 8.4, 12.4**

## Implementation Considerations

### Technology Stack
- **Frontend**: Next.js (TypeScript) with React for the Web Catalog
- **Backend Services**: Node.js with TypeScript for application logic
- **Data Storage**: PostgreSQL for relational data, Redis for caching
- **File Storage**: IPFS for static content, S3-compatible for backups
- **Message Queue**: RabbitMQ for async job processing
- **Monitoring**: Prometheus + Grafana for metrics, ELK stack for logs

### Development Phases
1. **Phase 1**: Core identity and basic project resurfacing
2. **Phase 2**: Static experiment publishing and IPFS integration
3. **Phase 3**: Replication system and carrier network
4. **Phase 4**: Advanced search and recommendation engine
5. **Phase 5**: CLI tooling and developer experience
6. **Phase 6**: Performance optimization and scaling

### Testing Strategy
- **Unit Tests**: Verify individual component behavior
- **Integration Tests**: Verify component interactions
- **Property-Based Tests**: Verify correctness properties across generated inputs
- **End-to-End Tests**: Verify complete user workflows
- **Load Tests**: Verify performance under expected loads
- **Security Tests**: Verify security properties and vulnerability resistance

### Deployment Architecture
- **Primary Region**: Host core services with high availability
- **Edge Locations**: Cache static content and catalog data
- **Carrier Nodes**: Distributed network for replication
- **Monitoring Cluster**: Separate infrastructure for observability
- **Backup Systems**: Geographic redundancy for critical data

## Open Questions and Decisions Needed

1. **Radicle Integration Depth**: How deeply should we integrate with Radicle? Mirror vs. shallow linking?
2. **IPFS Pinning Strategy**: Who pays for IPFS pinning costs? Network fund vs. carrier responsibility?
3. **Carrier Incentives**: What incentives encourage network members to carry digital things?
4. **Permission Model Complexity**: How granular should permission controls be?
5. **Orphan Policy**: What happens to truly orphaned digital things with no willing carriers?
6. **Import/Export Formats**: Standard formats for moving digital things in/out of the commons?
7. **Network Growth**: How does the system scale as the Enspiral network grows?
8. **External Integration**: How to integrate with other tools in the Enspiral ecosystem?