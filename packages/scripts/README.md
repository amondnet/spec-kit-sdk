# @spec-kit/scripts

TypeScript implementation of Spec-Kit scripts providing Spec-Driven Development (SDD) workflow automation.

## Overview

This package provides both a programmatic TypeScript API and CLI interface for Spec-Kit operations. It maintains 100% compatibility with the original bash scripts while offering improved type safety, error handling, and cross-platform support.

## Installation

```bash
bun install @spec-kit/scripts
```

## API Usage

### Core Functions

```typescript
import {
  checkTaskPrerequisites,
  createNewFeature,
  getFeaturePaths,
  setupPlan,
  updateAgentContext
} from '@spec-kit/scripts'

// Create a new feature
const result = await createNewFeature('implement user authentication', { json: true })
console.log(result) // { BRANCH_NAME: "001-implement-user-authentication", SPEC_FILE: "...", FEATURE_NUM: "001" }

// Setup implementation plan
const planResult = await setupPlan({ json: true })
console.log(planResult) // { FEATURE_SPEC: "...", IMPL_PLAN: "...", SPECS_DIR: "...", BRANCH: "..." }

// Check prerequisites
const prereqResult = await checkTaskPrerequisites({ json: true })
console.log(prereqResult) // { STATUS: "READY", MISSING_FILES: [], READY: true }

// Get feature paths
const pathsResult = await getFeaturePaths({ json: true })
console.log(pathsResult) // Complete set of feature-related file paths

// Update agent context
const agentResult = await updateAgentContext('claude', { json: true })
console.log(agentResult) // { AGENT_FILE: "...", UPDATED: true, AGENT_TYPE: "claude" }
```

### Modular Imports

The package supports modular imports for specific commands:

```typescript
import { checkTaskPrerequisites } from '@spec-kit/scripts/check-prerequisites'
// Import specific commands
import { createNewFeature } from '@spec-kit/scripts/create-feature'
import { getFeaturePaths } from '@spec-kit/scripts/get-paths'
import { setupPlan } from '@spec-kit/scripts/setup-plan'
import { updateAgentContext } from '@spec-kit/scripts/update-agent-context'
```

## CLI Usage

The package can be used as a CLI tool:

```bash
# Create a new feature
bun run @spec-kit/scripts create-feature "implement user authentication"
bun run @spec-kit/scripts create-feature "add dark mode" --json

# Setup implementation plan
bun run @spec-kit/scripts setup-plan
bun run @spec-kit/scripts setup-plan --json

# Check prerequisites
bun run @spec-kit/scripts check-prerequisites
bun run @spec-kit/scripts check-prerequisites --json

# Get feature paths
bun run @spec-kit/scripts get-paths
bun run @spec-kit/scripts get-paths --json

# Update agent context
bun run @spec-kit/scripts update-agent-context claude
bun run @spec-kit/scripts update-agent-context gemini --json
```

## Type Definitions

### Result Types

```typescript
// Feature creation result
interface CreateFeatureResult {
  BRANCH_NAME: string // e.g., "001-implement-auth"
  SPEC_FILE: string // Absolute path to spec.md
  FEATURE_NUM: string // e.g., "001"
}

// Plan setup result
interface SetupPlanResult {
  FEATURE_SPEC: string // Absolute path to spec.md
  IMPL_PLAN: string // Absolute path to plan.md
  SPECS_DIR: string // Absolute path to specs directory
  BRANCH: string // Current branch name
}

// Prerequisites check result
interface CheckTaskPrerequisitesResult {
  STATUS: 'READY' | 'NOT_READY'
  MISSING_FILES: string[]
  READY: boolean
}

// Feature paths result
interface FeaturePathsResult {
  REPO_ROOT: string
  CURRENT_BRANCH: string
  FEATURE_DIR: string
  FEATURE_SPEC: string
  IMPL_PLAN: string
  TASKS: string
  RESEARCH: string
  DATA_MODEL: string
  QUICKSTART: string
  CONTRACTS_DIR: string
}

// Agent context update result
interface UpdateAgentContextResult {
  AGENT_FILE: string // Absolute path to updated file
  UPDATED: boolean // Always true on success
  AGENT_TYPE: SupportedAgentType
}
```

### Option Types

```typescript
interface CommonOptions {
  json?: boolean // Output in JSON format
}

interface CreateFeatureOptions extends CommonOptions {
  // Additional options for feature creation
}

interface CheckTaskPrerequisitesOptions extends CommonOptions {
  requireFeatureBranch?: boolean
  checkPlanning?: boolean
  requiredFiles?: string[]
}

interface UpdateAgentContextOptions extends CommonOptions {
  // Additional options for agent context updates
}

type SupportedAgentType = 'claude' | 'gemini' | 'copilot'
```

## Error Handling

The package provides specific error types for better error handling:

```typescript
import {
  FeatureBranchError,
  FileOperationError,
  GitRepositoryError,
  SpecKitError,
  TemplateError
} from '@spec-kit/scripts'

try {
  await createNewFeature('my feature')
}
catch (error) {
  if (error instanceof FeatureBranchError) {
    console.error('Branch-related error:', error.message)
  }
  else if (error instanceof FileOperationError) {
    console.error('File operation failed:', error.message)
  }
  else if (error instanceof SpecKitError) {
    console.error('Spec-Kit error:', error.message)
  }
}
```

## Bash Script Synchronization

This TypeScript implementation is designed to be 100% compatible with the original bash scripts. The bash scripts located in `.specify/scripts/bash/` now act as wrappers that call this TypeScript implementation, ensuring:

- Identical output formats (both JSON and text)
- Same command-line argument parsing
- Consistent error messages and exit codes
- Preserved file path conventions

### Output Format Compatibility

The TypeScript implementation produces output identical to the bash scripts:

**JSON Output:**

```bash
# Bash script
$ .specify/scripts/bash/create-new-feature.sh "test feature" --json
{"BRANCH_NAME":"001-test-feature","SPEC_FILE":"/path/to/spec.md","FEATURE_NUM":"001"}

# TypeScript equivalent
$ bun run @spec-kit/scripts create-feature "test feature" --json
{"BRANCH_NAME":"001-test-feature","SPEC_FILE":"/path/to/spec.md","FEATURE_NUM":"001"}
```

**Text Output:**

```bash
# Bash script
$ .specify/scripts/bash/create-new-feature.sh "test feature"
BRANCH_NAME: 001-test-feature
SPEC_FILE: /path/to/spec.md
FEATURE_NUM: 001

# TypeScript equivalent
$ bun run @spec-kit/scripts create-feature "test feature"
BRANCH_NAME: 001-test-feature
SPEC_FILE: /path/to/spec.md
FEATURE_NUM: 001
```

## Development

### Building

```bash
# Build the package
bun run build

# Watch mode for development
bun run dev
```

### Testing

This project uses a **2-layer testing approach**:

#### 1. Contract Tests ✅
```bash
bun test              # Default: runs contract tests only
bun test:contract     # Explicit contract test execution
```
- **Purpose**: Validate TypeScript implementation output format
- **Status**: ✅ Working (36 tests passing)
- **Speed**: Fast (~50ms)

#### 2. Compatibility Tests 🚧
```bash
bun test:compatibility  # Currently disabled
bun test:full          # Contract + compatibility (when enabled)
```
- **Purpose**: Compare with original spec-kit shell scripts
- **Status**: 🚧 Temporarily disabled due to Bun segfault
- **Location**: `tests/compatibility.disabled/`

#### Coverage
```bash
bun test:coverage     # Generate coverage report
```

### Linting

```bash
# Run linting
bun run lint

# Fix linting issues
bun run lint:fix
```

## Architecture

The package is organized into several modules:

- **commands/**: Individual command implementations
- **core/**: Domain logic and main classes (`SpecKitProject`, `Feature`)
- **utils/**: Utility functions for file operations, git, and path handling
- **contracts/**: TypeScript type definitions and interfaces
- **tests/**: Comprehensive test suites

### Key Classes

- `SpecKitProject`: Main orchestrator for project-level operations
- `Feature`: Represents a single feature with its files and metadata
- `FileOperations`: File system utilities
- `GitOperations`: Git repository interactions
- `PathUtilities`: Path resolution and validation

## Requirements

- **Runtime**: Bun 1.0.0+
- **Node Compatibility**: Node.js 20+ (for environments without Bun)
- **Git**: Required for repository operations
- **Platform**: Linux, macOS, Windows (via WSL or native Windows support)

## Contributing

When contributing to this package:

1. Ensure all tests pass
2. Maintain compatibility with bash scripts
3. Follow TypeScript best practices
4. Update documentation for API changes
5. Preserve the `.specify/` directory structure
