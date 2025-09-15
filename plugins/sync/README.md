# Spec Sync Plugin

[![codecov](https://codecov.io/gh/amondnet/spec-kit-sdk/graph/badge.svg?token=q1VdMk4ZGb&component=plugin-sync)](https://codecov.io/gh/amondnet/spec-kit-sdk)

Universal sync plugin for spec-kit that synchronizes markdown specification documents with issue tracking platforms through a configurable adapter system.

## 🌟 Features

- **Multi-Platform Support**: GitHub, Jira, Asana (and extensible to more)
- **Adapter Architecture**: Pluggable platform adapters with shared core logic
- **Frontmatter Metadata**: YAML frontmatter for sync state tracking
- **Subtask Support**: Hierarchical issue management (platform permitting)
- **Conflict Resolution**: Automatic detection and resolution strategies
- **Auto-sync**: Claude Code hooks integration for seamless workflow
- **Configuration System**: Flexible multi-platform configuration

## 📦 Installation

```bash
# Install dependencies
bun install

# Build the plugin
bun run build

# Install globally (optional)
npm install -g @spec-kit/plugin-sync
```

## 🚀 Usage

### Basic Commands

```bash
# Check sync status
specify-sync status

# Push specs to remote platform
specify-sync push specs/001-feature        # Single spec
specify-sync push --all                    # All specs

# Pull issues from remote platform
specify-sync pull 123                      # Single issue
specify-sync pull --all                    # All issues

# Configuration management
specify-sync config --show                 # Show current config
```

### Platform Selection

```bash
# Use specific platform
specify-sync --platform github push --all
specify-sync --platform jira status
specify-sync --platform asana pull --all
```

### Command Options

```bash
--platform <name>           # Platform: github, jira, asana
--config <path>             # Custom config file path
--dry-run                   # Preview without applying changes
--force                     # Force sync even without changes
--verbose                   # Detailed output
--conflict-strategy <mode>  # manual, theirs, ours, interactive
```

## ⚙️ Configuration

### Centralized Configuration

The sync plugin now uses centralized configuration through Spec-Kit's core configuration system. Create `.specify/config.yml`:

```yaml
version: '1.0'

plugins:
  sync:
    platform: github
    autoSync: true
    conflictStrategy: manual
    github:
      owner: ${GITHUB_OWNER}
      repo: ${GITHUB_REPO}
      auth: cli
      # token: ${GITHUB_TOKEN}  # Optional: for token-based auth
      labels:
        # Document type labels (string or array)
        spec: 'speckit:spec'
        plan: [speckit, plan]
        research: 'speckit:research'
        task: 'speckit:task'
        quickstart: quickstart
        datamodel: 'speckit:data-model'
        contracts: 'speckit:contracts'
        # Common labels added to all issues
        common: speckit
    jira:
      host: company.atlassian.net
      project: SPEC
      auth: oauth
      username: user@company.com
      # token: ${JIRA_TOKEN}
    asana:
      workspace: Engineering Team
      project: Specifications
      token: ${ASANA_TOKEN}

  # Other plugins can be configured here
  # test-runner:
  #   framework: jest
  #   parallel: true
  #   coverage: false
```

### Legacy Configuration

For backward compatibility, the plugin still supports legacy configuration files:

- `.specify/sync.config.yml`
- `.specify/sync.config.json`
- `.spec-kit/sync.config.yml`
- `.spec-kit/sync.config.json`

### CLI Configuration Management

```bash
# Initialize a new config file
specify config init

# Show current configuration
specify config show

# Validate configuration
specify config validate

# List configured plugins
specify config plugins
```

### Environment Variables

```bash
# GitHub (when using token auth)
export GITHUB_TOKEN=your_token
export GITHUB_OWNER=your-org
export GITHUB_REPO=your-repo

# Jira
export JIRA_TOKEN=your_token
export JIRA_USERNAME=your_email

# Asana
export ASANA_TOKEN=your_token
```

### GitHub Labels Configuration

The sync plugin supports flexible GitHub label configuration through the config file:

```yaml
plugins:
  sync:
    github:
      labels:
        # Single label per document type
        spec: spec
        plan: plan

        # Namespace-style labels
        research: 'speckit:research'
        task: 'speckit:task'

        # Multiple labels per document type
        quickstart: [speckit, quickstart, documentation]
        datamodel: [speckit, data-model, architecture]

        # Common labels added to ALL issues
        common: [speckit, feature] # or common: "speckit"
```

#### Label Examples:

| Configuration                                               | Result Labels                            |
| ----------------------------------------------------------- | ---------------------------------------- |
| `spec: "spec"`                                              | `["spec"]`                               |
| `spec: "speckit:spec"`                                      | `["speckit:spec"]`                       |
| `spec: ["speckit", "spec"]`                                 | `["speckit", "spec"]`                    |
| `spec: "spec"` + `common: "speckit"`                        | `["speckit", "spec"]`                    |
| `spec: ["spec", "feature"]` + `common: ["speckit", "epic"]` | `["speckit", "epic", "spec", "feature"]` |

#### Default Labels:

When no labels configuration is provided, the plugin uses these defaults:

```yaml
labels:
  spec: spec
  plan: plan
  research: research
  task: task
  quickstart: quickstart
  datamodel: data-model
  contracts: contracts
```

## 📁 Spec Directory Structure

```
specs/
├── 001-user-authentication/
│   ├── spec.md         # Main spec → Parent issue
│   ├── plan.md         # → Subtask: "Plan: User Authentication"
│   ├── research.md     # → Subtask: "Research: User Authentication"
│   ├── quickstart.md   # → Subtask: "Quickstart: User Authentication"
│   ├── data-model.md   # → Subtask: "Data Model: User Authentication"
│   ├── tasks.md        # → Subtask: "Tasks: User Authentication"
│   └── contracts/      # → Subtask: "API Contracts: User Authentication"
```

## 📝 Frontmatter Format

```yaml
---
github_issue: 123 # Platform-specific issue ID
issue_type: parent # parent | subtask
parent_issue: null # Parent issue ID (for subtasks)
sync_status: synced # draft | synced | conflict
last_sync: 2025-01-14T10:00:00Z
sync_hash: abc12345 # Content hash for change detection
auto_sync: true # Enable/disable auto-sync
---

# Your spec content here...
```

## 🔧 Architecture

### Core Components

```
plugins/sync/
├── src/
│   ├── core/                 # Shared business logic
│   │   ├── sync-engine.ts    # Main sync orchestrator
│   │   ├── scanner.ts        # Spec directory scanner
│   │   └── frontmatter.ts    # Metadata management
│   ├── adapters/             # Platform adapters
│   │   ├── base.adapter.ts   # Abstract base class
│   │   ├── github/           # GitHub implementation
│   │   ├── jira/            # Jira implementation (future)
│   │   └── asana/           # Asana implementation (future)
│   ├── config/              # Configuration system
│   │   └── loader.ts        # Multi-source config loading
│   └── cli.ts              # Command-line interface
```

### Adapter Interface

```typescript
abstract class SyncAdapter {
  abstract readonly platform: string

  // Core operations
  abstract push(spec: SpecDocument): Promise<RemoteRef>
  abstract pull(ref: RemoteRef): Promise<SpecDocument>
  abstract getStatus(spec: SpecDocument): Promise<SyncStatus>

  // Platform capabilities
  abstract capabilities(): AdapterCapabilities

  // Optional: batch operations, subtasks, comments
  pushBatch?(specs: SpecDocument[]): Promise<RemoteRef[]>
  createSubtask?(parent: RemoteRef, title: string, body: string): Promise<RemoteRef>
}
```

## 🔌 Claude Code Integration

Add hooks to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [{
          "type": "command",
          "command": "$CLAUDE_PROJECT_DIR/plugins/sync/dist/cli check --file"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [{
          "type": "command",
          "command": "$CLAUDE_PROJECT_DIR/plugins/sync/dist/cli auto --file"
        }]
      }
    ]
  }
}
```

## 🌊 Workflow

1. **Write Specs**: Create markdown files in `specs/` directory
2. **Configure Platform**: Set up platform credentials and configuration
3. **Push to Platform**: Sync specs to create/update issues
4. **Auto-tracking**: Frontmatter automatically updated with sync metadata
5. **Bidirectional Sync**: Pull remote changes back to local specs
6. **Conflict Resolution**: Handle merge conflicts with configurable strategies

## 🔒 Authentication

### GitHub

```bash
# Using GitHub CLI (recommended)
gh auth login

# Or set token
export GITHUB_TOKEN=ghp_xxxx
```

### Jira (Future)

```bash
# OAuth or basic auth
export JIRA_USERNAME=user@company.com
export JIRA_TOKEN=your_api_token
```

### Asana (Future)

```bash
# Personal access token
export ASANA_TOKEN=your_token
```

## 🚧 Platform Status

| Platform   | Status         | Features                           |
| ---------- | -------------- | ---------------------------------- |
| **GitHub** | ✅ Implemented | Issues, Subtasks, Labels, Comments |
| **Jira**   | 🚧 Planned     | Stories, Epics, Custom Fields      |
| **Asana**  | 🚧 Planned     | Tasks, Projects, Custom Fields     |
| **Linear** | 📋 Roadmap     | Issues, Projects, Cycles           |
| **Notion** | 📋 Roadmap     | Database pages, Relations          |

## 🤝 Contributing

### Adding New Adapters

1. Create adapter directory: `src/adapters/platform-name/`
2. Implement `SyncAdapter` abstract class
3. Add platform configuration schema
4. Update CLI platform factory
5. Add tests and documentation

### Development Setup

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test

# Run linter
bun run lint

# Type checking
bun run typecheck
```

## 📄 Requirements

- **Runtime**: Bun ≥1.2.20 or Node.js ≥18
- **Platform Tools**:
  - GitHub: `gh` CLI with authentication
  - Jira: API credentials (future)
  - Asana: Personal access token (future)
- **Optional**: `gh-sub-issue` extension for enhanced GitHub subtask support

---

**Package**: `@spec-kit/plugin-sync`
**License**: MIT
**Repository**: https://github.com/amondnet/spec-kit-sdk
