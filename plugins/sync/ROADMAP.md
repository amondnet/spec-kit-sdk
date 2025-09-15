# Sync Plugin Roadmap

## Overview

This document outlines the development roadmap for the `@spec-kit/plugin-sync` package, focusing on unimplemented features and future enhancements.

## Current Status

### ✅ Implemented Features
- GitHub adapter with full CRUD operations
- Spec document scanning and parsing
- Frontmatter management and sync tracking
- Subtask creation and management
- Label and milestone support
- Basic conflict detection
- CLI integration

### 🚧 Partially Implemented
- **Batch Operations**: Base infrastructure exists but GitHub adapter currently has `supportsBatch: false`
- **Conflict Resolution**: Basic automatic resolution works, but interactive mode is not implemented
- **File System Operations**: Frontmatter updates work in memory but don't persist to disk

## Unimplemented Features

### 1. File System Write Operations
**Priority: HIGH**
- **Issue**: Frontmatter updates only happen in memory (`sync-engine.ts:258-259`)
- **Impact**: Sync metadata is lost after process restart
- **Implementation**: Add file writing capability to persist frontmatter changes

### 2. Interactive Conflict Resolution
**Priority: MEDIUM**
- **Issue**: `handleConflictInteractive()` returns "not yet implemented" error
- **Implementation**: Use `@inquirer/prompts` for 3-way merge UI
- **Features**:
  - Show diff of conflicting content
  - Allow line-by-line selection
  - Save resolution templates for common patterns

### 3. GitHub Batch Operations Optimization
**Priority: MEDIUM**
- **Discovery**: GitHub CLI v2.28.0+ supports batch issue editing ([PR #7259](https://github.com/cli/cli/pull/7259))
- **Current**: Sequential processing with fallback batch implementation
- **Opportunity**: Leverage `gh issue edit [numbers]` for bulk updates
- **Performance**: Could reduce 16-issue sync from 2+ minutes to seconds

### 4. Additional Platform Adapters
**Priority: LOW-MEDIUM**

#### 4.1 Linear Adapter
- **Rationale**: Popular among development teams, clean GraphQL API
- **Implementation**: Use Linear's GraphQL API for issue management
- **Features**: Teams, projects, issue states, custom fields

#### 4.2 Jira Adapter
- **Rationale**: Enterprise requirement, widely used
- **Implementation**: Jira REST API v3
- **Challenges**: Complex field mapping, custom schemas

#### 4.3 Notion Adapter
- **Rationale**: Document-centric teams, growing adoption
- **Implementation**: Notion API with database/page mapping
- **Challenges**: Block-based content structure

#### 4.4 Asana Adapter
- **Rationale**: Project management integration
- **Implementation**: Asana REST API
- **Features**: Projects, tasks, subtasks, custom fields

## Implementation Roadmap

### Phase 1: Core Functionality (Q4 2025)
1. **File System Write Operations**
   - Implement atomic file updates with rollback
   - Add `.specify/.sync-cache/` for backup during updates
   - Ensure thread-safe operations

2. **GitHub Batch Operations**
   - Update GitHub adapter to `supportsBatch: true`
   - Implement `batchUpdateIssues()` using gh CLI batch edit
   - Add concurrency limiting with `p-limit`

### Phase 2: Enhanced User Experience (Q4 2025)
1. **Interactive Conflict Resolution**
   - Implement CLI-based 3-way merge
   - Add conflict resolution strategies storage
   - Improve error messages and recovery options

2. **Improved Status Reporting**
   - Add progress bars for batch operations
   - Detailed sync reports with statistics
   - Better error aggregation and reporting

### Phase 3: Platform Expansion (Q1 2026)
1. **Linear Adapter** (Priority 1)
   - Complete GraphQL integration
   - Team and project mapping
   - Custom field support

2. **Jira Adapter** (Priority 2)
   - REST API integration
   - Field mapping configuration
   - Custom schema support

### Phase 4: Advanced Features (Q1 2026)
1. **Smart Sync Strategies**
   - Content-aware conflict detection
   - Auto-resolution for common patterns
   - Machine learning for conflict prediction

2. **Additional Platforms**
   - Notion adapter implementation
   - Asana adapter implementation
   - Community adapter framework

## Technical Considerations

### GitHub CLI Batch Operations
```bash
# Current capability (v2.28.0+)
gh issue edit 32 101 507 --add-label bug --add-assignee @me

# Potential implementation
async batchUpdateIssues(issueNumbers: number[], updates: IssueUpdate) {
  const numbers = issueNumbers.join(' ')
  const args = ['issue', 'edit', numbers]

  if (updates.labels) args.push('--add-label', updates.labels.join(','))
  if (updates.assignees) args.push('--add-assignee', updates.assignees.join(','))

  return this.executeGhCommand(args)
}
```

### Conflict Resolution Strategy
```typescript
interface ConflictResolutionStrategy {
  type: 'auto' | 'interactive' | 'template'
  rules: ConflictRule[]
  fallback: 'ours' | 'theirs' | 'manual'
}
```

### File System Safety
```typescript
interface AtomicFileOperation {
  backup(): Promise<string>
  write(content: string): Promise<void>
  rollback(): Promise<void>
  cleanup(): Promise<void>
}
```

## Dependencies and Requirements

### New Dependencies
- `p-limit`: Concurrency control for batch operations
- `tmp`: Temporary file management for atomic operations
- Enhanced `@inquirer/prompts`: Interactive conflict resolution

### Version Requirements
- GitHub CLI v2.28.0+ for batch operations
- Node.js 18+ for better async/await support
- Bun runtime compatibility maintained

## Success Metrics

1. **Performance**: Batch operations 10x faster than sequential
2. **Reliability**: Zero data loss with atomic file operations
3. **Usability**: 90% of conflicts auto-resolved or easily guided
4. **Adoption**: Support for 4+ major platforms by end of 2026

## Community Contributions

### Wanted: Platform Adapters
- Community contributions welcome for platform adapters
- Adapter template and documentation to be provided
- Integration testing framework for new adapters

### Documentation Needs
- Platform-specific setup guides
- Conflict resolution best practices
- Performance optimization guidelines

---

*Last updated: 2025-09-15*
*Next review: Monthly*