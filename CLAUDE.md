# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@STANDARDS.md
@TESTING.md

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
bun run lint

# Auto-fix lint errors
bun run lint:fix

# Type checking
bun run typecheck

# Run the CLI in development mode
cd packages/cli && bun run dev

# Run scripts in development mode
cd packages/scripts && bun run src/index.ts
```

### Quality Check Commands
```bash
# Fix all lint errors automatically
bun run lint:fix

# Verify no lint errors remain
bun run lint

# Check for type errors
bun run typecheck

# Run all tests
bun run test

# Complete quality check sequence
bun run lint:fix && bun run typecheck && bun run test
```

## Architecture

### Monorepo Structure
This is a Turborepo monorepo using Bun as the package manager and runtime. The workspace contains:

- **packages/cli** - Main CLI tool (`@spec-kit/cli`) that provides the `specify` command
- **packages/scripts** - TypeScript library (`@spec-kit/scripts`) containing core script functionality
- **packages/core** - Core configuration and schema validation (`@spec-kit/core`)
- **packages/spec-kit** - Meta package that bundles the CLI for easy installation

### Plugins
- **plugins/sync** - GitHub synchronization plugin (`@spec-kit/plugin-sync`)

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

## Testing Strategy

- Use `test-runner` agent for all test execution
- Tests log to `tests/logs/` directory automatically
- Never mock services - use real implementations
- Tests designed to be verbose for debugging
- Validate test structure before assuming codebase issues

## Code Search Strategy

### Prioritize claude-context MCP tool for semantic code search (if available)

When searching for code implementations, understanding codebase structure, or gathering context:

1. **Index the codebase first** (only needed once per project):
    - Use `mcp__claude-context__index_codebase` with absolute project path
    - Re-index only when significant structural changes occur

2. **Use semantic search for code discovery**:
    - Use `mcp__claude-context__search_code` for natural language queries
    - Examples: "authentication logic", "database connection handling", "error validation"

### Search Tool Selection Guide

| Tool | Best For | Example Usage |
|------|----------|---------------|
| `mcp__claude-context__search_code` | Semantic/conceptual searches | "Find user authentication", "Where is data validated" |
| `Grep` | Exact text/pattern matching | Finding specific function names, error messages |
| `Glob` | File discovery by name pattern | `**/*.test.ts`, `src/**/*.js` |
| `code-analyzer` agent | Complex multi-file analysis | Bug hunting, logic flow tracing |


## File Operations

### Standard Patterns
- Always use agents for heavy file analysis
- Create required directories without asking permission
- Use sensible defaults, ask only for destructive operations
- Keep main conversation context clean

## Command Execution Guidelines

### Path Management
- **Always use absolute paths instead of `cd` commands** to ensure consistent behavior
- Avoid changing directories during command execution to prevent path confusion

**Preferred approach:**
```bash
# Good: Use absolute paths
bun run /absolute/path/to/packages/cli/build

# Avoid: Using cd commands
cd packages/cli && bun run build
```

**Exception:** When multiple commands must run in the same directory context:
```bash
# Acceptable when directory context is required
cd /absolute/path/to/packages/cli
bun run build:windows
bun run build:mac
bun run build:linux
```

## Error Handling

- **Fail Fast**: Check critical prerequisites immediately
- **Clear Messages**: Show exact error and solution
- **Trust System**: Don't over-validate common operations
- **Graceful Degradation**: Continue when optional features fail

## Code Quality Standards

### Lint Configuration
- Uses `@antfu/eslint-config` for comprehensive linting
- Enforces import ordering, proper TypeScript usage, and style consistency
- Auto-fixable rules should be resolved with `turbo lint --fix`

### Type Safety
- All packages must pass TypeScript compilation with `turbo check-types`
- Missing type declarations should be added to devDependencies
- No implicit `any` types allowed

### Testing Requirements
- All new code requires corresponding tests
- Tests must pass before any commits
- Use contract-based testing approach for core functionality

## Integration Notes

- Requires GitHub CLI (`gh`) with authentication
- Uses `gh-sub-issue` extension for issue hierarchies
- Bash scripts handle efficient common operations
- Markdown frontmatter defines command tool permissions
- Settings in `.claude/settings.local.json` control permissions
- 
### Development Standards

Refer to these guides for detailed standards:
- **[STANDARDS.md](./STANDARDS.md)** - Detailed coding standards and mandatory rules
- **[TESTING.md](./TESTING.md)** - Comprehensive testing guidelines and best practices
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design patterns

Key points:
- Files must not exceed 300 LOC
- Functions must not exceed 50 LOC
- Always read entire files before modifying
- New features require tests
- Follow DRY but avoid premature abstraction
- Use intention-revealing names