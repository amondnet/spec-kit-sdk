# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@STANDARDS.md

## Commands

### Build Commands
```bash
# Build all packages using Turbo
turbo build

# Build individual packages
cd packages/cli && bun run build
cd packages/scripts && bun run build

# Build CLI for multiple platforms
cd packages/cli
bun run build:windows  # Creates dist/specify-win.exe
bun run build:mac      # Creates dist/specify-mac
bun run build:linux    # Creates dist/specify-linux
```

### Testing Commands
```bash
# Run all tests
bun test

# Run tests for specific packages
cd packages/scripts && bun test
cd packages/cli && bun test

# Run specific test categories
bun test:contract      # Contract tests
bun test:unit         # Unit tests
bun test:coverage     # With coverage report

# Run a single test file
bun test path/to/test.test.ts
```

### Development Commands
```bash
# Install dependencies
bun install

# Run linting (uses @antfu/eslint-config)
turbo lint
bun run lint

# Type checking
turbo typecheck
bun run typecheck

# Run the CLI in development mode
cd packages/cli && bun run dev

# Run scripts in development mode
cd packages/scripts && bun run src/index.ts
```

## Architecture

### Monorepo Structure
This is a Turborepo monorepo using Bun as the package manager and runtime. The workspace contains:

- **packages/cli** - Main CLI tool (`@spec-kit/cli`) that provides the `specify` command
- **packages/scripts** - TypeScript library (`@spec-kit/scripts`) containing core script functionality
- **packages/spec-kit** - Meta package that bundles the CLI for easy installation
- **packages/tooling-config** - Shared configuration for development tools

### Core Design Patterns

1. **Command Pattern**: The CLI uses commander.js with separate command files in `packages/cli/src/commands/`. Each command is a self-contained module.

2. **Cross-Platform Support**: All scripts are written in TypeScript/Bun to ensure consistent behavior across Windows, macOS, and Linux. The CLI compiles to native executables using Bun's compile feature.

3. **Contract-Based Testing**: The scripts package uses a contract testing approach where core functions export contracts that define their behavior, with tests in `packages/scripts/tests/contract/`.

4. **Spec-Driven Development**: The entire project follows SDD methodology with specs in `.specify/` directory structure.

### Key Dependencies

- **Bun**: Runtime and package manager (v1.2.20)
- **Turbo**: Monorepo build orchestration
- **simple-git**: Git operations in scripts
- **commander**: CLI framework
- **@inquirer/prompts**: Interactive CLI prompts
- **picocolors**: Terminal colors

### Script Exports

The `@spec-kit/scripts` package provides modular exports:
- `/create-feature` - Create new feature branches and specs
- `/setup-plan` - Set up implementation plans
- `/update-agent-context` - Update AI agent context
- `/check-prerequisites` - Check task prerequisites
- `/get-paths` - Get feature directory paths

### Testing Strategy

Tests are organized by type:
- **Contract tests** (`tests/contract/`): Verify that functions meet their behavioral contracts
- **Unit tests** (`tests/unit/`): Test individual functions
- **Compatibility tests** (`tests/compatibility/`): Ensure cross-platform behavior

The project uses Bun's built-in test runner with coverage reporting configured at 80% threshold.

### Development Standards

Refer to STANDARDS.md for detailed coding standards. Key points:
- Files must not exceed 300 LOC
- Functions must not exceed 50 LOC
- Always read entire files before modifying
- New features require tests
- Follow DRY but avoid premature abstraction
- Use intention-revealing names