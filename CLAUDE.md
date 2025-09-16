# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@STANDARDS.md
@TESTING.md
@TDD.md

## Commands

### Build Commands
```bash
# Build all packages using Turbo
turbo build

# Build individual packages
cd packages/cli && bun run build
cd packages/scripts && bun run build
cd packages/official-wrapper && bun run build

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
cd packages/official-wrapper && bun test  # Uses Bun test runner

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

### Sync Plugin Commands
```bash
# Browse specs interactively with navigation
specify sync browse

# List all specs in a table format
specify sync list
specify sync list --filter feature-name

# View detailed information about a specific spec
specify sync view specs/001-feature-name

# Traditional sync operations
specify sync push --all
specify sync pull 123
specify sync status
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

- **packages/cli** - Main CLI tool (`@spec-kit/cli`) that provides the `specify` command with dual execution modes
- **packages/scripts** - TypeScript library (`@spec-kit/scripts`) containing core script functionality
- **packages/core** - Core configuration, schema validation, and CLI mode schemas (`@spec-kit/core`)
- **packages/official-wrapper** - Official GitHub spec-kit wrapper and command router (`@spec-kit/official-wrapper`)
- **packages/spec-kit** - Meta package that bundles the CLI for easy installation

### Plugins
- **plugins/sync** - GitHub synchronization plugin (`@spec-kit/plugin-sync`)

### Core Design Patterns

1. **Command Pattern**: The CLI uses commander.js with separate command files in `packages/cli/src/commands/`. Each command is a self-contained module.

2. **Dual Execution Architecture**: The CLI supports both local Bun execution and official GitHub spec-kit integration via `@spec-kit/official-wrapper`. Users can configure `bun-first` or `official-first` execution modes.

3. **Cross-Platform Support**: All scripts are written in TypeScript/Bun to ensure consistent behavior across Windows, macOS, and Linux. The CLI compiles to native executables using Bun's compile feature.

4. **Contract-Based Testing**: The scripts package uses a contract testing approach where core functions export contracts that define their behavior, with tests in `packages/scripts/tests/contract/`.

5. **Spec-Driven Development**: The entire project follows SDD methodology with specs in `.specify/` directory structure.

6. **Dynamic Versioning**: CLI version is automatically synchronized with package.json using JSON imports.

### Key Dependencies

- **Bun**: Runtime and package manager (v1.2.20)
- **Turbo**: Monorepo build orchestration
- **simple-git**: Git operations in scripts
- **commander**: CLI framework
- **@inquirer/prompts**: Interactive CLI prompts
- **picocolors**: Terminal colors
- **uv/uvx**: Optional dependency for official GitHub spec-kit execution

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
- **official-wrapper**: Uses Bun test runner with custom mock implementations (no Jest)
- **Other packages**: Use real implementations, avoid mocking when possible
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
- **Command Routing**: Intelligent fallback between Bun and official implementations

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
- **Official Integration**: Supports uvx for official GitHub spec-kit execution
- **APM Commands**: Full support for Agent Package Manager commands (GitHub PR #271)
- Bash scripts handle efficient common operations
- Markdown frontmatter defines command tool permissions
- Settings in `.claude/settings.local.json` control permissions

## CLI Configuration

### Execution Modes

The CLI supports two execution modes via `.specify/config.yml`:

```yaml
cli:
  mode: bun-first  # or official-first
  official:
    repository: "git+https://github.com/github/spec-kit.git"
```

- **bun-first**: Use local Bun implementation first, fallback to official
- **official-first**: Use official spec-kit first, fallback to local

### Version Management

The CLI version is automatically synchronized with `package.json`:

```typescript
import packageJson from '../package.json' with { type: 'json' }
const VERSION = packageJson.version
```

This ensures the CLI version always matches the package version without manual updates.
### Development Standards

Refer to these guides for detailed standards:
- **[STANDARDS.md](./STANDARDS.md)** - Detailed coding standards and mandatory rules
- **[TESTING.md](./TESTING.md)** - Comprehensive testing guidelines and best practices
- **[TDD.md](./TDD.md)** - Test-Driven Development methodology and core principles
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design patterns

Key points:
- Files must not exceed 300 LOC
- Functions must not exceed 50 LOC
- Always read entire files before modifying
- New features require tests
- Follow DRY but avoid premature abstraction
- Use intention-revealing names