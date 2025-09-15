# Sync Issue Structure Documentation

## Overview

The `@spec-kit/plugin-sync` implements a universal adapter pattern to synchronize markdown specification documents with various issue tracking platforms. This document details how specs are mapped to issues across different platforms.

## Core Concepts

### Spec-to-Issue Mapping

Each spec directory represents a feature and maps to a **parent issue** with multiple **subtask issues** for different aspects of the feature.

```
specs/001-user-authentication/
├── spec.md         → Parent Issue: "Feature Specification: User Authentication"
├── plan.md         → Subtask: "Plan: User Authentication"
├── research.md     → Subtask: "Research: User Authentication"
├── quickstart.md   → Subtask: "Quickstart: User Authentication"
├── data-model.md   → Subtask: "Data Model: User Authentication"
├── tasks.md        → Subtask: "Tasks: User Authentication"
└── contracts/      → Subtask: "API Contracts: User Authentication"
```

### Issue Hierarchy

1. **Parent Issue** (`spec.md`)
   - Main feature specification
   - Contains overall feature description
   - Tracks completion status of subtasks
   - Labeled with `spec` tag

2. **Subtask Issues** (other `.md` files)
   - Specific aspects of feature implementation
   - Linked to parent issue (platform permitting)
   - Individual tracking and assignable
   - Labeled with `subtask` tag

## Platform-Specific Implementations

### GitHub

#### Issue Structure

- **Parent Issue**: Standard GitHub issue for `spec.md`
- **Subtasks**: Separate GitHub issues linked via `gh-sub-issue` extension
- **Labels**: `spec` for parent, `subtask` for children
- **Linking**: Uses `gh sub-issue add <parent> <child>` when extension available

#### Frontmatter Mapping

```yaml
---
# Core fields (platform-agnostic)
spec_id: 550e8400-e29b-41d4-a716-446655440000 # Unique spec identifier
sync_hash: abc12345 # Content hash for change detection
last_sync: '2025-01-14T10:00:00Z'
sync_status: synced # draft | synced | conflict
issue_type: parent # parent | subtask
auto_sync: true # Enable/disable auto-sync

# Platform-specific fields
github:
  issue_number: 123 # GitHub issue number
  parent_issue: null # Parent issue ID (for subtasks)
  updated_at: '2025-01-14T09:55:00Z' # GitHub's last update time
  labels: [spec, enhancement] # Issue labels
  assignees: [user1] # Assigned users
  milestone: 1 # Milestone number
---
```

#### GitHub API Integration

```typescript
// Create parent issue
const issueNumber = await client.createIssue(title, body, ['spec'])

// Create and link subtasks
for (const subtaskFile of subtaskFiles) {
  const subtaskNumber = await client.createSubtask(issueNumber, title, body)
}

// Update existing issue
await client.updateIssue(issueNumber, { title, body })
```

### Jira (Planned)

#### Issue Structure

- **Epic**: Maps to parent spec (`spec.md`)
- **Stories**: Maps to subtask files
- **Issue Types**: Epic → Story relationship
- **Linking**: Native epic-story relationships

#### Planned Frontmatter

```yaml
---
# Core fields (platform-agnostic)
spec_id: 550e8400-e29b-41d4-a716-446655440000
sync_hash: abc12345
last_sync: '2025-01-14T10:00:00Z'
sync_status: synced
issue_type: parent # parent | subtask
auto_sync: true

# Platform-specific fields
jira:
  issue_key: PROJ-123 # Jira epic key
  epic_key: PROJ-100 # Parent epic (for stories)
  issue_type: Epic # Epic | Story | Task
  updated: '2025-01-14T09:55:00Z' # Jira's last update time
---
```

#### Planned Integration

```typescript
// Create epic
const epic = await jira.createEpic({
  summary: title,
  description: body,
  issueType: 'Epic',
  project: config.project
})

// Create stories under epic
for (const subtaskFile of subtaskFiles) {
  await jira.createStory({
    summary: subtaskTitle,
    description: subtaskBody,
    epic: epic.key,
    issueType: 'Story'
  })
}
```

### Asana (Planned)

#### Issue Structure

- **Project**: Container for all spec-related tasks
- **Parent Task**: Maps to main spec (`spec.md`)
- **Subtasks**: Native Asana subtasks for other files
- **Sections**: Organize by feature/spec

#### Planned Frontmatter

```yaml
---
# Core fields (platform-agnostic)
spec_id: 550e8400-e29b-41d4-a716-446655440000
sync_hash: abc12345
last_sync: '2025-01-14T10:00:00Z'
sync_status: synced
issue_type: parent # parent | subtask
auto_sync: true

# Platform-specific fields
asana:
  task_gid: '1234567890123456' # Asana task GID
  project_gid: '987654321098765' # Asana project GID
  parent_task: '1234567890123456' # Parent task (for subtasks)
  modified_at: '2025-01-14T09:55:00Z' # Asana's last modification time
---
```

## Sync State Management

### Sync Status Values

| Status     | Description                   | Actions           |
| ---------- | ----------------------------- | ----------------- |
| `draft`    | Local changes not synced      | Push to sync      |
| `synced`   | Local and remote in sync      | No action needed  |
| `conflict` | Both local and remote changed | Resolve conflict  |
| `unknown`  | Cannot determine status       | Manual inspection |

### Change Detection

1. **Content Hash**: SHA-256 hash of markdown content (first 12 chars stored in `sync_hash`)
2. **Timestamp Tracking**:
   - `last_sync`: Local sync timestamp
   - Platform-specific: `github.updated_at`, `jira.updated`, `asana.modified_at`
3. **Unique Identification**: `spec_id` UUID for cross-platform tracking
4. **Comparison Logic**:
   - Local changes: Current hash ≠ stored `sync_hash`
   - Remote changes: Platform `updated_at` > `last_sync`
   - Conflicts: Both local and remote have changes

### Conflict Resolution Strategies

| Strategy      | Description                | Implementation                |
| ------------- | -------------------------- | ----------------------------- |
| `manual`      | User must resolve manually | Stop sync, show conflicts     |
| `theirs`      | Use remote version         | Overwrite local with remote   |
| `ours`        | Use local version          | Overwrite remote with local   |
| `interactive` | Prompt user for resolution | CLI prompts for each conflict |

## Adapter Pattern Implementation

### Base Adapter Interface

```typescript
export abstract class SyncAdapter {
  abstract readonly platform: string

  // Core operations
  abstract push(spec: SpecDocument): Promise<RemoteRef>
  abstract pull(ref: RemoteRef): Promise<SpecDocument>
  abstract getStatus(spec: SpecDocument): Promise<SyncStatus>

  // Platform capabilities
  abstract capabilities(): AdapterCapabilities

  // Optional features
  async createSubtask?(parent: RemoteRef, title: string, body: string): Promise<RemoteRef>
  async getSubtasks?(parent: RemoteRef): Promise<RemoteRef[]>
}
```

### Platform Capabilities

```typescript
export interface AdapterCapabilities {
  supportsBatch: boolean // Batch sync operations
  supportsSubtasks: boolean // Hierarchical issues
  supportsLabels: boolean // Issue tagging
  supportsAssignees: boolean // Issue assignment
  supportsMilestones: boolean // Milestone tracking
  supportsComments: boolean // Comments/discussions
  supportsConflictResolution: boolean // Automated conflict handling
}
```

### Remote Reference Structure

```typescript
export interface RemoteRef {
  id: string | number // Platform-specific ID
  url?: string // Optional web URL
  type: 'parent' | 'subtask' // Issue hierarchy type
}
```

## Configuration Management

### Multi-Platform Configuration

```json
{
  "platform": "github",
  "autoSync": true,
  "conflictStrategy": "manual",
  "github": {
    "owner": "your-org",
    "repo": "your-repo",
    "auth": "cli"
  },
  "jira": {
    "host": "company.atlassian.net",
    "project": "SPEC",
    "auth": "oauth",
    "username": "user@company.com"
  },
  "asana": {
    "workspace": "Engineering Team",
    "project": "Specifications",
    "token": "${ASANA_TOKEN}"
  }
}
```

### Environment Variables

```bash
# GitHub
export GITHUB_TOKEN=ghp_xxxx
export GITHUB_OWNER=your-org
export GITHUB_REPO=your-repo

# Jira
export JIRA_TOKEN=your_token
export JIRA_USERNAME=your_email

# Asana
export ASANA_TOKEN=your_token
```

## Sync Workflows

### Push Workflow (Local → Platform)

1. **Scan Specs**: Find all spec directories
2. **Calculate Changes**: Hash content, compare with stored
3. **Authenticate**: Verify platform credentials
4. **Create/Update Issues**:
   - New specs → Create parent + subtasks
   - Modified specs → Update existing issues
5. **Update Frontmatter**: Store issue IDs, hashes, timestamps

### Pull Workflow (Platform → Local)

1. **Fetch Issues**: Get issue data from platform
2. **Map to Specs**: Convert issue content to spec format
3. **Detect Conflicts**: Compare with local versions
4. **Update Files**: Write content with updated frontmatter
5. **Resolve Conflicts**: Apply resolution strategy

### Status Check Workflow

1. **Scan Local Specs**: Read all spec files
2. **Check Remote Status**: Query platform for each linked issue
3. **Compare States**: Detect changes and conflicts
4. **Display Results**: Color-coded status summary

## File Structure Conventions

### Spec Directory Layout

```
specs/
├── 001-user-authentication/     # Feature directory (numbered)
│   ├── spec.md                 # Main specification (required)
│   ├── plan.md                 # Implementation plan (optional)
│   ├── research.md             # Research notes (optional)
│   ├── quickstart.md          # Quick start guide (optional)
│   ├── data-model.md          # Data model design (optional)
│   ├── tasks.md               # Task breakdown (optional)
│   └── contracts/             # API contracts (optional)
│       └── api-spec.yml
├── 002-payment-processing/
└── 003-analytics-dashboard/
```

### File Naming Conventions

| File            | Purpose             | Issue Title Pattern                |
| --------------- | ------------------- | ---------------------------------- |
| `spec.md`       | Main feature spec   | "Feature Specification: {Feature}" |
| `plan.md`       | Implementation plan | "Plan: {Feature}"                  |
| `research.md`   | Research findings   | "Research: {Feature}"              |
| `quickstart.md` | Quick start guide   | "Quickstart: {Feature}"            |
| `data-model.md` | Data model design   | "Data Model: {Feature}"            |
| `tasks.md`      | Task breakdown      | "Tasks: {Feature}"                 |
| `contracts/`    | API contracts       | "API Contracts: {Feature}"         |

## CLI Integration

### Main Commands

```bash
# Sync operations
specify sync push [spec-path]     # Push specs to platform
specify sync pull [issue-id]      # Pull issues to specs
specify sync status               # Check sync status
specify sync config --show       # Show configuration

# Platform selection
specify sync --platform github push --all
specify sync --platform jira status

# Conflict resolution
specify sync push --conflict-strategy theirs
specify sync push --conflict-strategy interactive
```

### Options and Flags

| Option                | Description       | Values                            |
| --------------------- | ----------------- | --------------------------------- |
| `--platform`          | Target platform   | github, jira, asana               |
| `--config`            | Config file path  | Custom path                       |
| `--dry-run`           | Preview only      | No changes made                   |
| `--force`             | Force sync        | Ignore change detection           |
| `--verbose`           | Detailed output   | Show debug info                   |
| `--all`               | Process all specs | Batch operation                   |
| `--conflict-strategy` | Resolution method | manual, theirs, ours, interactive |

## Error Handling

### Common Error Scenarios

1. **Authentication Failures**
   - Platform credentials expired
   - Insufficient permissions
   - Network connectivity issues

2. **Sync Conflicts**
   - Both local and remote changed
   - Issue deleted on platform
   - Spec file corrupted locally

3. **Platform Limitations**
   - API rate limiting
   - Feature not supported
   - Service unavailable

### Error Recovery

1. **Graceful Degradation**: Continue with available operations
2. **Retry Logic**: Exponential backoff for transient failures
3. **Clear Messaging**: Actionable error messages with solutions
4. **State Preservation**: Don't corrupt local state on failures

## Testing Strategy

### Unit Tests

- Adapter interface compliance
- Mapping logic verification
- Configuration validation
- Error handling scenarios

### Integration Tests

- Platform API interactions
- End-to-end sync workflows
- Conflict resolution flows
- Authentication mechanisms

### Mock Testing

- Platform API mocking
- Offline development
- CI/CD pipeline testing
- Error simulation

## Future Extensions

### Additional Platforms

- **Linear**: Issues, Projects, Cycles
- **Notion**: Database pages, Relations
- **Azure DevOps**: Work items, Backlogs
- **Trello**: Cards, Boards, Lists

### Enhanced Features

- **Bulk Operations**: Mass import/export
- **Template System**: Customizable issue templates
- **Webhook Integration**: Real-time sync triggers
- **Advanced Conflict Resolution**: Three-way merge
- **Audit Logging**: Complete sync history
- **Performance Metrics**: Sync timing and statistics

---

This documentation provides a comprehensive overview of how the sync plugin handles issue structures across different platforms while maintaining consistency and flexibility through the adapter pattern.
