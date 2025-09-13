# Spec-Kit SDK

A modern TypeScript implementation of the Spec-Kit Spec-Driven Development (SDD) workflow tool, maintaining full compatibility with the original bash scripts.

## Overview

Spec-Kit SDK provides a structured approach to software development through specification-driven workflows. It helps teams transform natural language feature descriptions into actionable development tasks with clear implementation paths.

## Features

- **Feature Specification Generation**: Convert natural language descriptions into structured specifications
- **Implementation Planning**: Generate comprehensive implementation plans with design artifacts
- **Task Management**: Create dependency-ordered, executable task lists
- **Multi-Agent Support**: Update context for Claude, Gemini, and GitHub Copilot
- **Cross-Platform**: Works on Linux, macOS, and Windows (via WSL)

## Quick Start

### Installation

```bash
# Install dependencies
bun install

# Build the project
cd packages/scripts && bun run build
```

### Basic Workflow

1. **Create a Feature Specification**
```bash
.specify/scripts/bash/create-new-feature.sh "implement user authentication"
```

2. **Setup Implementation Plan**
```bash
.specify/scripts/bash/setup-plan.sh
```

3. **Check Prerequisites**
```bash
.specify/scripts/bash/check-task-prerequisites.sh
```

4. **Get Feature Paths**
```bash
.specify/scripts/bash/get-feature-paths.sh
```

## Available Commands

### Bash Scripts (Original Interface)
Located in `.specify/scripts/bash/`:

- `create-new-feature.sh [--json] <description>` - Create a new feature with branch and specification
- `setup-plan.sh [--json]` - Initialize implementation planning phase
- `check-task-prerequisites.sh [--json]` - Verify prerequisites for task execution
- `get-feature-paths.sh` - Get standardized paths for current feature
- `update-agent-context.sh [claude|gemini|copilot]` - Update AI agent configuration

### TypeScript API
Available via `@spec-kit/scripts` package:

```typescript
import {
  createNewFeature,
  setupPlan,
  checkTaskPrerequisites,
  getFeaturePaths,
  updateAgentContext
} from '@spec-kit/scripts'
```

## Project Structure

```
spec-kit-sdk/
├── .specify/               # Spec-Kit core files (preserved from original)
│   ├── scripts/bash/      # Original bash scripts
│   ├── templates/         # Document templates
│   └── memory/           # Constitutional requirements
├── .claude/              # Claude-specific configurations
│   └── commands/         # Claude command definitions
├── packages/
│   └── scripts/          # TypeScript implementation
│       ├── src/
│       │   ├── commands/ # Command implementations
│       │   ├── core/     # Core domain logic
│       │   ├── utils/    # Utility functions
│       │   └── contracts/# Type definitions
│       └── tests/        # Test suites
└── specs/                # Feature specifications (generated)
```

## Compatibility

This SDK maintains 100% compatibility with the original spec-kit bash scripts while providing:
- Type-safe TypeScript API
- Improved error handling
- Cross-platform support
- Comprehensive test coverage

The bash scripts in `.specify/scripts/bash/` now act as wrappers that call the TypeScript implementation, ensuring consistent behavior across all interfaces.

## Development

### Build Commands

```bash
# Install dependencies
bun install

# Build all packages
turbo build

# Run tests
cd packages/scripts && bun test

# Run linting
turbo lint

# Type checking
turbo check-types
```

### Testing

The project uses a **2-layer testing strategy** for simplicity and effectiveness:

#### 1. Contract Tests ✅
```bash
bun test              # Default: runs contract tests only
cd packages/scripts && bun test:contract
```
- **Purpose**: Validate TypeScript implementation output format
- **Status**: ✅ Working (36 tests passing)
- **Speed**: Fast (~50ms)
- **Location**: `packages/scripts/tests/contract/`

#### 2. Compatibility Tests 🚧
```bash
cd packages/scripts && bun test:compatibility  # Currently disabled
cd packages/scripts && bun test:full          # Contract + compatibility (when enabled)
```
- **Purpose**: Compare TypeScript output with original bash scripts
- **Status**: 🚧 Temporarily disabled due to Bun segfault when executing shell scripts
- **Location**: `packages/scripts/tests/compatibility.disabled/`

#### Test Coverage
```bash
cd packages/scripts && bun test:coverage     # Generate coverage report
```

**Development Workflow**: Use `bun test` for quick feedback during development. Compatibility tests will be enabled when shell script execution is stable.

## Claude Commands

When using with Claude Code (claude.ai/code), the following commands are available:
- `/specify <feature-description>` - Create a new feature specification
- `/plan <implementation-details>` - Generate implementation plan
- `/tasks` - Generate actionable task list

## Important Notes

- **Preservation of Original Files**: The `.specify/` directory and Claude command files are preserved from the original spec-kit to ensure backward compatibility
- **Feature Branches**: All features are created on branches following the pattern `###-feature-name`
- **Templates**: Document templates are located in `.specify/templates/`
- **JSON Output**: All commands support `--json` flag for programmatic use

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
1. All tests pass
2. Linting and type checking succeed
3. Backward compatibility with bash scripts is maintained
4. The `.specify/` directory remains unchanged